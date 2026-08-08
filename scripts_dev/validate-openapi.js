const fs = require('fs');
const path = require('path');

function collectIssues(spec) {
  const issues = [];
  const schemas = spec.components?.schemas || {};
  for (const [name, sch] of Object.entries(schemas)) {
    if (!sch || typeof sch !== 'object') {
      issues.push(`Schema ${name}: no es objeto`);
      continue;
    }
    if (!sch.type && !sch.allOf && !sch.oneOf && !sch.anyOf && !sch.$ref) {
      issues.push(`Schema ${name}: falta type`);
    }
    for (const [prop, def] of Object.entries(sch.properties || {})) {
      if (!def || typeof def !== 'object') {
        issues.push(`${name}.${prop}: definición inválida`);
        continue;
      }
      const hasType = def.type || def.$ref || def.allOf || def.oneOf || def.anyOf;
      if (!hasType) {
        issues.push(`${name}.${prop}: falta type (causa INVALID en Swagger UI)`);
      }
    }
  }
  for (const [p, methods] of Object.entries(spec.paths || {})) {
    for (const [method, op] of Object.entries(methods)) {
      if (!op || typeof op !== 'object' || method.startsWith('x-')) continue;
      const refs = JSON.stringify(op).match(/#\/components\/schemas\/([A-Za-z0-9_]+)/g) || [];
      for (const r of refs) {
        const sn = r.split('/').pop();
        if (!schemas[sn]) issues.push(`Path ${method.toUpperCase()} ${p}: schema ${sn} no existe`);
      }
    }
  }
  return issues;
}

const spec = require('../config/swagger');
const issues = collectIssues(spec);
if (issues.length) {
  console.error('ISSUES:\n' + issues.join('\n'));
  process.exit(1);
}
console.log('OK: OpenAPI schemas válidos (' + Object.keys(spec.components.schemas).length + ' schemas)');
