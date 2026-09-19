/* f2 — Pedidos de dados, com cache em memória. */

const DATA_CACHE = new Map();

function cached(url, load) {
  if (DATA_CACHE.has(url)) return DATA_CACHE.get(url);
  const promise = load();
  DATA_CACHE.set(url, promise);
  promise.catch(() => DATA_CACHE.delete(url));
  return promise;
}

function fetchJSON(url) {
  return cached(url, () => fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ao pedir ${url}`);
    return r.json();
  }));
}

function loadCatalog() {
  return fetchJSON(catalogUrl());
}

function loadLayer(layer) {
  return fetchJSON(dataUrl(layer.path));
}

/* Grelha Int16 little-endian; o tamanho tem de bater com o catálogo
   (apanha grelhas desatualizadas face ao catalog.json). */
function loadGrid(name) {
  const g = APP_STATE.catalog.grids;
  const url = dataUrl(g.files[name]);
  return cached(url, () => fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ao pedir ${url}`);
    return r.arrayBuffer();
  }).then((buf) => {
    const expected = 2 * g.width * g.height * g.bands[name].length;
    if (buf.byteLength !== expected) {
      throw new Error(`grelha ${name} com ${buf.byteLength} bytes, esperados ${expected}`);
    }
    const view = new DataView(buf);
    const out = new Int16Array(buf.byteLength / 2);
    for (let i = 0; i < out.length; i++) out[i] = view.getInt16(2 * i, true);
    return out;
  }));
}
