(() => {
  function normalise(value) { return String(value || '').toLowerCase().trim(); }
  function matches(item, query) { const q = normalise(query); return !q || [item.title,item.artist,item.album,item.description,item.category].filter(Boolean).join(' ').toLowerCase().includes(q); }
  window.SonoraSearch = { matches, normalise };
})();
