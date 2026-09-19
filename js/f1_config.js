/* f1 — Configuração do frontend.
   MODE "api": backend FastAPI local (dev/QA).
   MODE "static": site estático (showcase) com api/catalog.json e data/<caminho>.
   Nenhum caminho físico de dados está aqui: todos vêm do catálogo. */

const APP_CONFIG = {
  MODE: "static",
  urls: {
    api: { catalog: "api/catalog", data: (p) => `api/data/${p}` },
    static: { catalog: "api/catalog.json", data: (p) => `data/${p}` },
  },
  defaultPeriod: "day",
  defaultProduct: "SUHI",
  productOrder: ["SUHI", "UTFVI_CLASS", "COOL_ISLAND", "LST_C"],
  mapCenter: [38.7436, -9.1602],
  mapZoom: 12,
  // Mapas de fundo Esri (sem chave de API), cada um com:
  //   opacity   opacidade da camada temática (no escuro e no satélite mais alta, senão
  //             as classes amarelas/laranja ficam acastanhadas e deixam de parecer as da legenda)
  //   swatchBg  cor média do fundo, usada para as amostras da legenda terem a cor que se vê no mapa
  //   lines / highlight  cor dos limites e do contorno da freguesia selecionada
  defaultBasemap: "light",
  basemaps: {
    light: {
      label: "Claro",
      base: "Canvas/World_Light_Gray_Base", labels: "Canvas/World_Light_Gray_Reference",
      maxNativeZoom: 16, attribution: "&copy; Esri, HERE, Garmin, OpenStreetMap",
      opacity: 0.65, swatchBg: "#e4e4e4", lines: "#1c2b3a", highlight: "#1f5fa8",
    },
    dark: {
      label: "Escuro",
      base: "Canvas/World_Dark_Gray_Base", labels: "Canvas/World_Dark_Gray_Reference",
      maxNativeZoom: 16, attribution: "&copy; Esri, HERE, Garmin, OpenStreetMap",
      opacity: 0.8, swatchBg: "#343434", lines: "#e8eef4", highlight: "#7cc4ff",
    },
    satellite: {
      label: "Satélite",
      base: "World_Imagery", labels: "Reference/World_Boundaries_and_Places",
      maxNativeZoom: 18, attribution: "&copy; Esri, Maxar, Earthstar Geographics",
      opacity: 0.8, swatchBg: "#6f6f63", lines: "#ffffff", highlight: "#ffe14d",
    },
  },
  periodColors: { day: "#e3a33b", night: "#1c2b3a" },
};

const APP_STATE = {
  catalog: null,
  period: APP_CONFIG.defaultPeriod,
  product: APP_CONFIG.defaultProduct,
  point: null,          // {lat, lng}
  parishId: null,       // freguesia do ponto selecionado
};

function dataUrl(path) {
  return APP_CONFIG.urls[APP_CONFIG.MODE].data(path);
}

function catalogUrl() {
  return APP_CONFIG.urls[APP_CONFIG.MODE].catalog;
}

const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
  "agosto", "setembro", "outubro", "novembro", "dezembro"];

function fmtNumber(value, decimals) {
  // "−" tipográfico, como nas legendas: o toLocaleString devolve o hífen "-"
  return value.toLocaleString("pt-PT", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    .replace("-", "−");
}
