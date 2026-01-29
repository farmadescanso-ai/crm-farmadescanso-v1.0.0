// Búsqueda inteligente (fallback robusto) para /dashboard/clientes
// - No depende del mega-script inline (por si falla por alguna razón).
// - Implementa búsqueda por URL: escribe 2+ caracteres -> recarga con ?q=...
// - Botón "Limpiar" -> elimina q y vuelve a listado paginado.
(() => {
  'use strict';

  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearSearch');
  const busquedaActiva = document.getElementById('busquedaActiva');
  const searchInfo = document.getElementById('searchInfo');

  if (!searchInput || !clearBtn) return;
  // Evitar doble inicialización si el script inline también funciona
  if (window.__clientesSearchUrlInitialized) return;
  window.__clientesSearchUrlInitialized = true;

  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.search);

  // Mantener el valor del input sincronizado con q si venimos desde URL
  const qInitial = (params.get('q') || '').trim();
  if (qInitial && !searchInput.value) {
    searchInput.value = qInitial;
  }

  let t = null;
  const debounceMs = 350;

  const setStatus = (txt) => {
    if (busquedaActiva) busquedaActiva.textContent = txt;
    if (searchInfo) {
      if (txt === 'Buscando...') {
        searchInfo.innerHTML = '<span class="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true"></span>';
        searchInfo.title = 'Buscando en toda la base de datos...';
      } else {
        searchInfo.innerHTML = '<i class="fas fa-brain text-primary"></i>';
        searchInfo.title = 'Búsqueda inteligente activa - Busca en todos los campos';
      }
    }
  };

  const applyQuery = (q) => {
    const next = new URL(window.location.href);
    const p = new URLSearchParams(next.search);
    // Reset a página 1 al buscar
    p.set('page', '1');
    // Mantener pageSize actual si existe, si no, el servidor ya defaulta a 20
    if (!p.get('pageSize')) p.set('pageSize', '20');

    if (q && q.length >= 2) {
      p.set('q', q);
    } else {
      p.delete('q');
    }
    next.search = p.toString();
    window.location.href = next.toString();
  };

  searchInput.addEventListener('input', () => {
    const q = (searchInput.value || '').trim();
    clearTimeout(t);
    if (!q || q.length < 2) {
      setStatus('Inactiva');
      return;
    }
    setStatus('Buscando...');
    t = setTimeout(() => applyQuery(q), debounceMs);
  }, { passive: true });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = (searchInput.value || '').trim();
      if (q && q.length >= 2) {
        setStatus('Buscando...');
        applyQuery(q);
      }
    }
  });

  clearBtn.addEventListener('click', (e) => {
    e.preventDefault();
    searchInput.value = '';
    setStatus('Inactiva');
    applyQuery('');
  }, true);
})();

