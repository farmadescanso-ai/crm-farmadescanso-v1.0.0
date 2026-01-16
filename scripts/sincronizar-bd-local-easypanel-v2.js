/**
 * Sincroniza BD Local -> EasyPanel (MySQL remoto) respetando dependencias por Foreign Keys.
 *
 * Objetivo:
 * - Rellenar tablas vacías en EasyPanel con los datos correctos de la BD local
 * - Mantener consistencia (orden por FK) y evitar timeouts (batches)
 * - Evitar duplicados usando UPSERT (ON DUPLICATE KEY UPDATE) cuando sea posible
 *
 * Uso:
 *   node scripts/sincronizar-bd-local-easypanel-v2.js --only-empty
 *   node scripts/sincronizar-bd-local-easypanel-v2.js --tables clientes,pedidos,visitas
 *   node scripts/sincronizar-bd-local-easypanel-v2.js --dry-run
 *
 * Variables de entorno (recomendado):
 *   Local:
 *     DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 *   EasyPanel (remoto):
 *     EASYPANEL_DB_HOST, EASYPANEL_DB_PORT, EASYPANEL_DB_USER, EASYPANEL_DB_PASSWORD, EASYPANEL_DB_NAME
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function parseArgs(argv) {
  const args = {
    onlyEmpty: false,
    dryRun: false,
    tables: null,
    batchSize: 500
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--only-empty') args.onlyEmpty = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a.startsWith('--tables=')) {
      const v = a.split('=')[1] || '';
      args.tables = v.split(',').map(s => s.trim()).filter(Boolean);
    } else if (a === '--tables' && argv[i + 1]) {
      args.tables = argv[i + 1].split(',').map(s => s.trim()).filter(Boolean);
      i++;
    } else if (a.startsWith('--batch=')) {
      const v = Number(a.split('=')[1]);
      if (!Number.isNaN(v) && v > 0) args.batchSize = v;
    }
  }
  return args;
}

const opts = parseArgs(process.argv);

const localConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'farmadescanso',
  charset: 'utf8mb4',
  connectTimeout: 20000
};

const remoteConfig = {
  host: process.env.EASYPANEL_DB_HOST || '31.97.122.151',
  port: Number(process.env.EASYPANEL_DB_PORT || 3306),
  user: process.env.EASYPANEL_DB_USER || 'mysql',
  // No imprimir password nunca. Si no está en env, queda vacío y fallará con access denied.
  password: process.env.EASYPANEL_DB_PASSWORD || '',
  database: process.env.EASYPANEL_DB_NAME || 'crm_farmadescanso',
  charset: 'utf8mb4',
  connectTimeout: 20000
};

async function setUtf8(conn) {
  await conn.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
  await conn.query('SET CHARACTER SET utf8mb4');
}

async function fetchTables(conn, schemaName) {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ?
       AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`,
    [schemaName]
  );
  return rows.map(r => r.TABLE_NAME);
}

async function fetchForeignKeys(conn, schemaName) {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME, REFERENCED_TABLE_NAME
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ?
       AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [schemaName]
  );
  return rows;
}

function topoSortTables(tables, fkRows) {
  const nodes = new Set(tables);
  const indeg = new Map();
  const adj = new Map();

  for (const t of nodes) {
    indeg.set(t, 0);
    adj.set(t, new Set());
  }

  for (const fk of fkRows) {
    const child = fk.TABLE_NAME;
    const parent = fk.REFERENCED_TABLE_NAME;
    if (!nodes.has(child) || !nodes.has(parent)) continue;
    if (!adj.get(parent).has(child)) {
      adj.get(parent).add(child);
      indeg.set(child, (indeg.get(child) || 0) + 1);
    }
  }

  const queue = [];
  for (const [t, d] of indeg.entries()) {
    if (d === 0) queue.push(t);
  }
  queue.sort();

  const out = [];
  while (queue.length) {
    const t = queue.shift();
    out.push(t);
    const children = Array.from(adj.get(t) || []);
    children.sort();
    for (const c of children) {
      indeg.set(c, (indeg.get(c) || 0) - 1);
      if (indeg.get(c) === 0) {
        queue.push(c);
        queue.sort();
      }
    }
  }

  // Si hay ciclos, añadir lo que falte al final (orden alfabético)
  if (out.length !== tables.length) {
    const remaining = tables.filter(t => !out.includes(t)).sort();
    return { ordered: out.concat(remaining), hasCycles: true, remaining };
  }

  return { ordered: out, hasCycles: false, remaining: [] };
}

async function describeTable(conn, tableName) {
  const [rows] = await conn.query(`DESCRIBE \`${tableName}\``);
  return rows;
}

async function getPrimaryKeyColumns(conn, tableName) {
  const [keys] = await conn.query(
    `SHOW KEYS FROM \`${tableName}\` WHERE Key_name = 'PRIMARY' ORDER BY Seq_in_index ASC`
  );
  return keys.map(k => k.Column_name).filter(Boolean);
}

async function countTable(conn, tableName) {
  const [rows] = await conn.query(`SELECT COUNT(*) as total FROM \`${tableName}\``);
  return Number(rows?.[0]?.total ?? 0);
}

async function getShowCreate(conn, tableName) {
  const [rows] = await conn.query(`SHOW CREATE TABLE \`${tableName}\``);
  if (!rows?.length) return null;
  return rows[0]['Create Table'] || null;
}

function buildRemoteTableMap(remoteTables) {
  const map = new Map();
  for (const t of remoteTables) {
    map.set(String(t).toLowerCase(), t);
  }
  return map;
}

async function ensureTableExists(localConn, remoteConn, localTableName, remoteTableName) {
  // Si no existe en remoto, crearla con el CREATE TABLE de local
  const [existsRows] = await remoteConn.query(
    `SELECT COUNT(*) as c FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [remoteTableName]
  );
  const exists = Number(existsRows?.[0]?.c ?? 0) > 0;
  if (exists) return { created: false };

  const createStmt = await getShowCreate(localConn, localTableName);
  if (!createStmt) throw new Error(`No se pudo obtener SHOW CREATE TABLE de local: ${localTableName}`);

  // Reemplazar nombre de tabla por el nombre remoto deseado (por si varía en mayúsculas)
  const replaced = createStmt.replace(
    new RegExp(`CREATE TABLE\\s+\`?${localTableName}\\`?`, 'i'),
    `CREATE TABLE \`${remoteTableName}\``
  );

  await remoteConn.query(replaced);
  return { created: true };
}

async function addMissingColumns(localConn, remoteConn, localTableName, remoteTableName) {
  const localCols = await describeTable(localConn, localTableName);
  const remoteCols = await describeTable(remoteConn, remoteTableName);

  const localMap = new Map(localCols.map(c => [String(c.Field).toLowerCase(), c]));
  const remoteSet = new Set(remoteCols.map(c => String(c.Field).toLowerCase()));

  const missing = [];
  for (const [k, c] of localMap.entries()) {
    if (!remoteSet.has(k)) missing.push(c);
  }
  if (!missing.length) return 0;

  for (const col of missing) {
    let sql = `ALTER TABLE \`${remoteTableName}\` ADD COLUMN \`${col.Field}\` ${col.Type}`;
    if (col.Null === 'NO') sql += ' NOT NULL';
    if (col.Default !== null) {
      if (String(col.Default).toUpperCase() === 'CURRENT_TIMESTAMP') sql += ' DEFAULT CURRENT_TIMESTAMP';
      else sql += ` DEFAULT ${mysql.escape(col.Default)}`;
    } else if (col.Null === 'YES') {
      sql += ' DEFAULT NULL';
    }
    if (col.Extra) sql += ` ${col.Extra}`;
    await remoteConn.query(sql);
  }

  return missing.length;
}

function buildUpsertSql(tableName, columns, pkColumns) {
  const colList = columns.map(c => `\`${c}\``).join(', ');
  const placeholdersRow = `(${columns.map(() => '?').join(', ')})`;
  const updateCols = columns.filter(c => !pkColumns.some(pk => String(pk).toLowerCase() === String(c).toLowerCase()));

  // Si no hay columnas a actualizar (tabla solo PK), el upsert no tiene sentido.
  // En ese caso usaremos INSERT IGNORE.
  if (updateCols.length === 0) {
    return {
      mode: 'insert_ignore',
      makeSql: (rowsCount) =>
        `INSERT IGNORE INTO \`${tableName}\` (${colList}) VALUES ${Array(rowsCount).fill(placeholdersRow).join(', ')}`
    };
  }

  // MySQL 8: VALUES() está deprecado, usar alias
  const updateClause = updateCols.map(c => `\`${c}\` = new.\`${c}\``).join(', ');
  return {
    mode: 'upsert',
    makeSql: (rowsCount) =>
      `INSERT INTO \`${tableName}\` (${colList}) VALUES ${Array(rowsCount).fill(placeholdersRow).join(', ')} AS new
ON DUPLICATE KEY UPDATE ${updateClause}`
  };
}

function normalizeRowValue(row, col) {
  // Mantener 0/false correctamente (no usar ||)
  if (Object.prototype.hasOwnProperty.call(row, col)) return row[col];
  if (Object.prototype.hasOwnProperty.call(row, col.toUpperCase())) return row[col.toUpperCase()];
  if (Object.prototype.hasOwnProperty.call(row, col.toLowerCase())) return row[col.toLowerCase()];
  return null;
}

async function syncTableData(localConn, remoteConn, localTableName, remoteTableName, batchSize) {
  const localColsDesc = await describeTable(localConn, localTableName);
  const columns = localColsDesc.map(c => c.Field);
  const pkCols = await getPrimaryKeyColumns(localConn, localTableName);
  const upsert = buildUpsertSql(remoteTableName, columns, pkCols);

  // Estrategia de paginación
  const singleNumericPk =
    pkCols.length === 1 &&
    localColsDesc.some(c => String(c.Field).toLowerCase() === String(pkCols[0]).toLowerCase() && /int|bigint/i.test(String(c.Type)));

  let insertedBatches = 0;
  let totalRows = 0;

  if (singleNumericPk) {
    const pk = pkCols[0];
    let last = -1;
    while (true) {
      const [rows] = await localConn.query(
        `SELECT * FROM \`${localTableName}\` WHERE \`${pk}\` > ? ORDER BY \`${pk}\` ASC LIMIT ?`,
        [last, batchSize]
      );
      if (!rows.length) break;
      last = Number(normalizeRowValue(rows[rows.length - 1], pk));

      const values = [];
      for (const r of rows) {
        for (const c of columns) values.push(normalizeRowValue(r, c));
      }
      if (opts.dryRun) {
        totalRows += rows.length;
        insertedBatches++;
        continue;
      }
      await remoteConn.query(upsert.makeSql(rows.length), values);
      totalRows += rows.length;
      insertedBatches++;
    }
  } else {
    let offset = 0;
    while (true) {
      const [rows] = await localConn.query(
        `SELECT * FROM \`${localTableName}\` LIMIT ? OFFSET ?`,
        [batchSize, offset]
      );
      if (!rows.length) break;
      offset += rows.length;

      const values = [];
      for (const r of rows) {
        for (const c of columns) values.push(normalizeRowValue(r, c));
      }
      if (opts.dryRun) {
        totalRows += rows.length;
        insertedBatches++;
        continue;
      }
      await remoteConn.query(upsert.makeSql(rows.length), values);
      totalRows += rows.length;
      insertedBatches++;
    }
  }

  return { totalRows, insertedBatches, mode: upsert.mode };
}

async function main() {
  console.log(`\n${colors.bright}${colors.magenta}🔄 Sincronización BD Local → EasyPanel (v2)${colors.reset}`);
  console.log(`${colors.cyan}   Local:  ${localConfig.host}:${localConfig.port} / ${localConfig.database}${colors.reset}`);
  console.log(`${colors.cyan}   Remoto: ${remoteConfig.host}:${remoteConfig.port} / ${remoteConfig.database}${colors.reset}`);
  console.log(`${colors.yellow}   Modo: ${opts.dryRun ? 'DRY-RUN (no escribe)' : 'ESCRITURA'}${colors.reset}`);
  if (opts.onlyEmpty) console.log(`${colors.yellow}   Solo tablas vacías en remoto: SI${colors.reset}`);
  if (opts.tables?.length) console.log(`${colors.yellow}   Tablas solicitadas: ${opts.tables.join(', ')}${colors.reset}`);
  console.log('');

  if (!remoteConfig.password) {
    console.log(`${colors.red}❌ Falta EASYPANEL_DB_PASSWORD en tu .env/variables.${colors.reset}`);
    process.exit(1);
  }

  let localConn;
  let remoteConn;

  try {
    localConn = await mysql.createConnection(localConfig);
    remoteConn = await mysql.createConnection(remoteConfig);
    await setUtf8(localConn);
    await setUtf8(remoteConn);

    const localTables = await fetchTables(localConn, localConfig.database);
    const remoteTables = await fetchTables(remoteConn, remoteConfig.database);
    const remoteMap = buildRemoteTableMap(remoteTables);

    const fkRows = await fetchForeignKeys(localConn, localConfig.database);
    const { ordered, hasCycles, remaining } = topoSortTables(localTables, fkRows);

    if (hasCycles) {
      console.log(`${colors.yellow}⚠️  Hay ciclos de dependencias FK. Se continuará, pero el orden no es perfecto para: ${remaining.join(', ')}${colors.reset}`);
    }

    // Filtrar por --tables si se pasa
    let planTables = ordered;
    if (opts.tables?.length) {
      const want = new Set(opts.tables.map(t => t.toLowerCase()));
      planTables = ordered.filter(t => want.has(String(t).toLowerCase()));
    }

    // Construir plan (resolver nombre real en remoto por case-insensitive)
    const plan = planTables.map(localName => ({
      localName,
      remoteName: remoteMap.get(String(localName).toLowerCase()) || localName
    }));

    console.log(`${colors.cyan}📋 Tablas en local: ${localTables.length} | en remoto: ${remoteTables.length} | a procesar: ${plan.length}${colors.reset}`);

    if (!opts.dryRun) {
      await remoteConn.query('SET FOREIGN_KEY_CHECKS = 0');
    }

    let totalTablesTouched = 0;
    for (const t of plan) {
      const remoteExists = remoteMap.has(String(t.localName).toLowerCase());

      // Si onlyEmpty: saltar si remoto tiene filas
      if (opts.onlyEmpty && remoteExists) {
        try {
          const c = await countTable(remoteConn, t.remoteName);
          if (c > 0) {
            console.log(`${colors.blue}⏭️  ${t.localName} (remoto: ${t.remoteName}) ya tiene ${c} filas → saltando${colors.reset}`);
            continue;
          }
        } catch (e) {
          console.log(`${colors.yellow}⚠️  No se pudo contar ${t.remoteName} en remoto (${e.message}). Se intentará sincronizar igualmente.${colors.reset}`);
        }
      }

      // Si la tabla no existe en remoto con ese nombre exacto, crearla
      if (!remoteExists) {
        console.log(`${colors.cyan}🧱 Creando tabla remota: ${t.remoteName} (desde local ${t.localName})${colors.reset}`);
        if (!opts.dryRun) await ensureTableExists(localConn, remoteConn, t.localName, t.remoteName);
      }

      // Asegurar columnas
      let added = 0;
      try {
        if (!opts.dryRun) {
          added = await addMissingColumns(localConn, remoteConn, t.localName, t.remoteName);
        }
      } catch (e) {
        console.log(`${colors.yellow}⚠️  Error ajustando columnas en ${t.remoteName}: ${e.message}${colors.reset}`);
      }

      // Datos
      const localCount = await countTable(localConn, t.localName).catch(() => null);
      console.log(`${colors.cyan}📦 Sincronizando datos: ${t.localName} → ${t.remoteName} (local=${localCount ?? '¿?'}; batch=${opts.batchSize})${colors.reset}`);
      const { totalRows, insertedBatches, mode } = await syncTableData(localConn, remoteConn, t.localName, t.remoteName, opts.batchSize);

      console.log(`${colors.green}✓ ${t.remoteName}: ${totalRows} filas procesadas en ${insertedBatches} lotes (${mode})${colors.reset}${added ? ` ${colors.yellow}(+${added} columnas)${colors.reset}` : ''}`);
      totalTablesTouched++;
    }

    if (!opts.dryRun) {
      await remoteConn.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    console.log(`\n${colors.green}✅ Sincronización terminada. Tablas procesadas: ${totalTablesTouched}${colors.reset}`);
    console.log(`${colors.cyan}👉 Revisa en Vercel: /api/health/db/diag y el dashboard.${colors.reset}\n`);
  } catch (e) {
    console.error(`\n${colors.red}❌ Error:${colors.reset} ${e.message}`);
    process.exitCode = 1;
  } finally {
    try { if (localConn) await localConn.end(); } catch (_) {}
    try { if (remoteConn) await remoteConn.end(); } catch (_) {}
  }
}

main();

