/* f4 — Legenda da camada ativa (controlo Leaflet). Classes e cores vêm do catálogo.

   A estrutura (botão + lista + nota) é criada uma vez. Recolher/abrir só troca
   uma classe: substituir o innerHTML dentro do handler tirava o botão da página
   antes de o Leaflet filtrar o clique, e o mapa recebia-o (o ponto selecionado
   saltava para baixo da legenda). */

const LEGEND = { control: null, collapsed: false, els: null, position: null };
const LEGEND_NARROW_MAP_PX = 620;   // abaixo disto, a legenda em baixo à esquerda toca na atribuição

function legendPosition(map) {
  return map.getSize().x < LEGEND_NARROW_MAP_PX ? "topright" : "bottomleft";
}

function initLegend(map) {
  LEGEND.position = legendPosition(map);
  LEGEND.collapsed = LEGEND.position === "topright";
  LEGEND.control = L.control({ position: LEGEND.position });
  LEGEND.control.onAdd = () => {
    const div = L.DomUtil.create("div", "map-legend");
    div.innerHTML = `
      <button type="button" class="legend-toggle" aria-controls="legend-items"></button>
      <ol id="legend-items"></ol>
      <p class="legend-note"></p>`;
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);
    const toggle = div.querySelector(".legend-toggle");
    L.DomEvent.on(toggle, "click", (e) => {
      L.DomEvent.stop(e);
      LEGEND.collapsed = !LEGEND.collapsed;
      applyLegendCollapsed();
    });
    LEGEND.els = { div, toggle, items: div.querySelector("ol"), note: div.querySelector(".legend-note") };
    applyLegendCollapsed();
    return div;
  };
  LEGEND.control.addTo(map);
  map.on("resize", () => {
    const position = legendPosition(map);
    if (position === LEGEND.position) return;
    LEGEND.position = position;
    LEGEND.control.setPosition(position);
  });
}

/* Cor da amostra = cor da classe com a opacidade da camada sobre a cor média do fundo. */
function blendHex(hex, bgHex, alpha) {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [c, b] = [rgb(hex), rgb(bgHex)];
  return `rgb(${c.map((v, i) => Math.round(alpha * v + (1 - alpha) * b[i])).join(",")})`;
}

function applyLegendCollapsed() {
  LEGEND.els.div.classList.toggle("collapsed", LEGEND.collapsed);
  LEGEND.els.toggle.setAttribute("aria-expanded", String(!LEGEND.collapsed));
}

function renderLegend(layerMeta) {
  const cat = APP_STATE.catalog;
  const els = LEGEND.els;
  if (!layerMeta) {
    els.toggle.textContent = "Sem camada";
    els.items.innerHTML = "";
    els.note.textContent = "";
    return;
  }
  const product = cat.products[layerMeta.product];
  const period = cat.periods[layerMeta.period];
  const unit = layerMeta.legend.unit ? ` (${layerMeta.legend.unit})` : "";
  els.toggle.textContent = `${product.label}${unit}, ${period.label.toLowerCase()}`;
  const bm = currentBasemap();
  els.items.innerHTML = layerMeta.legend.labels.map((label, i) =>
    `<li><span class="swatch" style="background:${blendHex(layerMeta.legend.colors[i], bm.swatchBg, bm.opacity)}"></span>${label}</li>`).join("");
  els.note.textContent = layerMeta.product === "COOL_ISLAND"
    ? `Pontos urbanos mais de ${fmtNumber(cat.parameters.cool_island_delta_k, 0)} °C abaixo da mediana urbana em pelo menos ${fmtNumber(100 * cat.parameters.cool_island_min_frequency, 0)}% das passagens.`
    : `${period.label}: ${period.n_scenes} passagens do satélite.`;
}
