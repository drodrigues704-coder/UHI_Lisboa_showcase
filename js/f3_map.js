/* f3 — Mapa Leaflet: fundo, camada temática, limites e marcador. */

const MAP = {
  map: null,
  dataLayer: null,
  selectedLayer: null,
  marker: null,
  basemap: null,
  boundaryLayers: [],
  dataMeta: null,      // camada visível no mapa (pode não ser a última escolhida, enquanto carrega)
  requestId: 0,
};

function initMap(onClick) {
  const map = L.map("map", { zoomControl: true, minZoom: 10, maxZoom: 17, zoomSnap: 0.25, attributionControl: false })
    .setView(APP_CONFIG.mapCenter, APP_CONFIG.mapZoom);

  map.createPane("data").style.zIndex = 350;
  map.createPane("boundaries").style.zIndex = 420;
  map.createPane("labels").style.zIndex = 450;
  map.getPane("labels").style.pointerEvents = "none";
  map.createPane("marker").style.zIndex = 460;   // acima dos nomes do fundo

  // Atribuição curta (cada fundo traz a sua): longa, ocupava várias linhas no
  // telemóvel e tapava a legenda. Os créditos dos dados estão em "Dados e limitações".
  L.control.attribution({ prefix: '<a href="https://leafletjs.com">Leaflet</a>' }).addTo(map);
  addBasemaps(map);

  map.on("click", (e) => onClick(e.latlng));
  MAP.map = map;
  return map;
}

/* Mapas de fundo Esri (sem chave de API; os mosaicos CARTO passaram a mostrar
   "API KEY REQUIRED"). Cada fundo é um grupo base + nomes, trocado no controlo
   de camadas do Leaflet. */
function addBasemaps(map) {
  const esri = "https://server.arcgisonline.com/ArcGIS/rest/services";
  const groups = {};
  const byLabel = {};
  for (const [key, bm] of Object.entries(APP_CONFIG.basemaps)) {
    const opts = { maxZoom: 17, maxNativeZoom: bm.maxNativeZoom };
    groups[key] = L.layerGroup([
      L.tileLayer(`${esri}/${bm.base}/MapServer/tile/{z}/{y}/{x}`, { ...opts, attribution: bm.attribution }),
      L.tileLayer(`${esri}/${bm.labels}/MapServer/tile/{z}/{y}/{x}`, { ...opts, pane: "labels" }),
    ]);
    groups[key].basemapKey = key;
    byLabel[bm.label] = groups[key];
  }
  groups[APP_CONFIG.defaultBasemap].addTo(map);
  MAP.basemap = APP_CONFIG.defaultBasemap;
  const control = L.control.layers(byLabel, null, { position: "topleft", collapsed: true }).addTo(map);
  map.on("baselayerchange", (e) => {
    MAP.basemap = e.layer.basemapKey;
    document.getElementById("map").dataset.basemap = MAP.basemap;
    styleBoundaries();
    if (MAP.dataLayer) MAP.dataLayer.setStyle({ fillOpacity: currentBasemap().opacity });
    // No toque a lista ficava aberta e tocar no mapa para a fechar mudava o ponto selecionado
    control.collapse();
  });
  document.getElementById("map").dataset.basemap = MAP.basemap;
}

function currentBasemap() {
  return APP_CONFIG.basemaps[MAP.basemap];
}

/* Limites escuros no fundo claro; claros no escuro e no satélite. O contorno da
   freguesia selecionada também muda, para manter contraste. */
function styleBoundaries() {
  const bm = currentBasemap();
  for (const { layer, weight, opacity } of MAP.boundaryLayers) {
    layer.setStyle({ color: bm.lines, weight, opacity, fill: false });
  }
  if (MAP.selectedLayer) MAP.selectedLayer.setStyle({ color: bm.highlight });
}

async function addBoundaries() {
  const cat = APP_STATE.catalog;
  const [municipio, freguesias] = await Promise.all([
    fetchJSON(dataUrl(cat.boundaries.municipio)),
    fetchJSON(dataUrl(cat.boundaries.freguesias)),
  ]);
  const freguesiasLayer = L.geoJSON(freguesias, { pane: "boundaries", interactive: false }).addTo(MAP.map);
  const municipioLayer = L.geoJSON(municipio, { pane: "boundaries", interactive: false }).addTo(MAP.map);
  MAP.boundaryLayers = [
    { layer: freguesiasLayer, weight: 0.7, opacity: 0.6 },
    { layer: municipioLayer, weight: 2, opacity: 0.9 },
  ];
  styleBoundaries();
  MAP.map.fitBounds(municipioLayer.getBounds(), { padding: [12, 12] });
  return freguesias;
}

function currentLayerMeta() {
  return APP_STATE.catalog.layers.find(
    (l) => l.period === APP_STATE.period && l.product === APP_STATE.product);
}

/* Troca a camada temática. Pedidos antigos que cheguem tarde são ignorados.
   Se o pedido mais recente falhar, a camada anterior é retirada para o mapa
   nunca mostrar uma camada diferente da selecionada. */
async function showDataLayer(onStatus) {
  const meta = currentLayerMeta();
  const requestId = ++MAP.requestId;
  onStatus("A carregar a camada…");
  try {
    const geojson = await loadLayer(meta);
    if (requestId !== MAP.requestId) return null;
    if (MAP.dataLayer) MAP.map.removeLayer(MAP.dataLayer);
    MAP.dataMeta = meta;
    MAP.dataLayer = L.geoJSON(geojson, {
      pane: "data", interactive: false,
      style: (f) => ({ fillColor: f.properties.fill, fillOpacity: currentBasemap().opacity, stroke: false }),
    }).addTo(MAP.map);
    onStatus("");
    return meta;
  } catch (err) {
    if (requestId !== MAP.requestId) return null;
    if (MAP.dataLayer) MAP.map.removeLayer(MAP.dataLayer);
    MAP.dataLayer = null;
    MAP.dataMeta = null;
    onStatus(`Não foi possível carregar a camada (${err.message}). Escolhe outra camada ou recarrega a página.`);
    return null;
  }
}

function setMarker(latlng) {
  if (MAP.marker) MAP.marker.setLatLng(latlng);
  else {
    MAP.marker = L.circleMarker(latlng, {
      pane: "marker", interactive: false,
      radius: 7, color: "#ffffff", weight: 3, fillColor: "#1f5fa8", fillOpacity: 1,
    }).addTo(MAP.map);
  }
}

function highlightParish(freguesias, parishId) {
  if (MAP.selectedLayer) MAP.map.removeLayer(MAP.selectedLayer);
  MAP.selectedLayer = null;
  if (!parishId) return;
  const feature = freguesias.features.find((f) => f.properties.parish_id === parishId);
  if (!feature) return;
  MAP.selectedLayer = L.geoJSON(feature, {
    pane: "boundaries", interactive: false,
    style: { color: currentBasemap().highlight, weight: 3, opacity: 1, fill: false },
  }).addTo(MAP.map);
}
