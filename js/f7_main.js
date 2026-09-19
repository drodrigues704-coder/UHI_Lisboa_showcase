/* f7 — Arranque e ligação entre controlos, mapa, legenda, diagnóstico e gráficos. */

const UI = { freguesias: null, stats: null, clickId: 0 };

function setStatus(text) {
  document.getElementById("layer-status").textContent = text;
}

/* Erros gerais (catálogo, limites, estatísticas) num elemento próprio, para o
   estado da camada não os apagar. */
function setAppError(text) {
  document.getElementById("app-error").textContent = text;
}

function parishName(parishId) {
  const p = UI.stats ? UI.stats.freguesias.find((f) => f.parish_id === parishId) : null;
  return p ? p.freguesia : "Freguesia";
}

function listYears(years) {
  if (years.length === 1) return `verão de ${years[0]}`;
  return `verões de ${years.slice(0, -1).join(", ")} e ${years[years.length - 1]}`;
}

function renderPeriodNote() {
  const cat = APP_STATE.catalog;
  const p = cat.periods[APP_STATE.period];
  const years = p.years.length === cat.years.length
    ? `todos os verões de ${p.years[0]} a ${p.years[p.years.length - 1]}`
    : listYears(p.years);
  const s = cat.summary[APP_STATE.period];
  const inten = s ? s.suhi_intensity_k_scene_median : null;
  const vs = inten === null || inten === undefined ? ""
    : inten < 0
      ? ` Lisboa fica ${fmtNumber(-inten, 1)} °C mais fresca do que o campo.`
      : ` Lisboa fica ${fmtNumber(inten, 1)} °C mais quente do que o campo.`;
  document.getElementById("period-note").textContent =
    `${p.label}: mediana de ${p.n_scenes} passagens do satélite, ${years}.${vs}`;
}

/* Número com sinal explícito: a ilha de calor diurna é negativa e o "+" evita
   que um valor positivo se leia como a mesma coisa. */
function signed(value, decimals) {
  // arredondar antes de decidir o sinal: −0,04 com uma casa é "0,0", não "−0,0"
  const rounded = Number(value.toFixed(decimals));
  const text = fmtNumber(Math.abs(rounded), decimals);
  if (rounded > 0) return `+${text}`;
  if (rounded < 0) return `−${text}`;
  return text;
}

/* "−0,3 °C de manhã, −0,8 °C ao meio-dia e −1,5 °C à tarde" a partir das classes horárias. */
function hoursText(classes) {
  if (!classes || !classes.length) return "";
  const when = { "Manhã": "de manhã", "Meio-dia": "ao meio-dia", "Tarde": "à tarde",
                 "Antes da meia-noite": "antes da meia-noite", "Madrugada": "de madrugada" };
  const parts = classes.map((h) =>
    `${signed(h.suhi_intensity_k_median, 1)} °C ${when[h.label] || h.label.toLowerCase()} (${h.n_scenes})`);
  return parts.length === 1 ? parts[0]
    : `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
}

/* Números dos textos explicativos, preenchidos a partir do catálogo. */
function fillCatalogText() {
  const cat = APP_STATE.catalog;
  const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  const range = `${cat.years[0]} a ${cat.years[cat.years.length - 1]}`;
  document.querySelectorAll("[data-cat='years']").forEach((el) => { el.textContent = range; });
  const breaks = cat.parameters.utfvi_class_breaks;
  set("txt-utfvi-max", fmtNumber(breaks[breaks.length - 1], 3));
  set("txt-cool-delta", fmtNumber(cat.parameters.cool_island_delta_k, 0));
  set("txt-cool-freq", fmtNumber(100 * cat.parameters.cool_island_min_frequency, 0));
  set("txt-sun-min", fmtNumber(cat.parameters.sun_elevation_day_min_deg, 0));
  set("txt-sun-night", fmtNumber(cat.parameters.sun_elevation_night_max_deg, 0));

  set("txt-hours-day", hoursText(cat.summary.day.suhi_intensity_by_hour));
  set("txt-hours-night", hoursText(cat.summary.night.suhi_intensity_by_hour));
  set("txt-n-day", String(cat.periods.day.n_scenes));
  const neg = cat.summary.day.suhi_negative_pct_land;
  if (neg !== undefined) set("txt-neg-share", `${fmtNumber(neg, 0)}%`);
  // + = a correção aumenta a SUHI, logo sem ela a SUHI ficaria abaixo do real
  const corr = cat.summary.night.elev_correction_k;
  if (corr !== undefined) {
    set("txt-elev-corr", Math.abs(corr) < 0.05
      ? "Neste caso a correção quase não muda a ilha de calor noturna."
      : `Sem isto a ilha de calor noturna ficava ${fmtNumber(Math.abs(corr), 1)} °C `
        + `${corr > 0 ? "abaixo" : "acima"} do real.`);
  }
  set("txt-n-night", String(cat.periods.night.n_scenes));
  const missingDay = cat.years.filter((y) => !cat.periods.day.years.includes(String(y)));
  const joinList = (items) => (items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`);
  set("txt-day-missing", missingDay.length ? `Sem passagens diurnas válidas em ${joinList(missingDay.map(String))}.` : "");
  set("txt-months", `${MONTH_NAMES[cat.months[0] - 1]} a ${MONTH_NAMES[cat.months[cat.months.length - 1] - 1]}`);
  const suhiRange = (q) => `${signed(q.p05, 1)} a ${signed(q.p95, 1)} °C`;
  set("txt-day-range", suhiRange(cat.summary.day.SUHI_land));
  set("txt-night-range", suhiRange(cat.summary.night.SUHI_land));
  set("txt-cos-source", cat.parameters.landcover_source);
  if (cat.diurnal) {
    const n = cat.diurnal.n_scenes_by_period;
    set("txt-n-transition", String((n.dawn || 0) + (n.dusk || 0)));
  }
  if (cat.parameters.lcz_min_pixels) set("txt-lcz-minpx", fmtNumber(cat.parameters.lcz_min_pixels, 0));

  const band = cat.parameters.reference_elev_band_m;
  if (band) {
    const text = `${fmtNumber(band[0], 0)} a ${fmtNumber(band[1], 0)}`;
    set("txt-ref-band", text);
    document.querySelectorAll("[data-ref-band]").forEach((el) => { el.textContent = text; });
  }
  if (cat.parameters.reference_n_pixels) {
    set("txt-ref-pixels", fmtNumber(cat.parameters.reference_n_pixels, 0));
  }
  if (cat.parameters.reference_min_dist_to_built_m) {
    const km = fmtNumber(cat.parameters.reference_min_dist_to_built_m / 1000, 0);
    set("txt-ref-mindist", km);
    document.querySelectorAll("[data-ref-mindist]").forEach((el) => { el.textContent = km; });
  }
  if (cat.parameters.reference_median_dist_to_built_m) {
    set("txt-ref-meddist", fmtNumber(cat.parameters.reference_median_dist_to_built_m / 1000, 1));
  }
  // As duas referências lado a lado: é a diferença mais importante do projeto
  const dayRef = cat.summary.day.suhi_intensity_by_reference;
  const nightRef = cat.summary.night.suhi_intensity_by_reference;
  if (dayRef && nightRef && dayRef.inside !== undefined && nightRef.inside !== undefined) {
    set("txt-ref-compare",
      `de dia ${signed(dayRef.inside, 1)} °C em vez de ${signed(dayRef.surrounding, 1)} °C, `
      + `e de noite ${signed(nightRef.inside, 1)} °C em vez de ${signed(nightRef.surrounding, 1)} °C`);
  }
}

function populateProducts() {
  const select = document.getElementById("ctl-product");
  const products = APP_STATE.catalog.products;
  select.innerHTML = APP_CONFIG.productOrder
    .map((key) => `<option value="${key}">${products[key].label}</option>`).join("");
  select.value = APP_STATE.product;
}

async function refreshLayer() {
  const meta = await showDataLayer(setStatus);
  // null também quando o pedido foi ultrapassado por outro: só limpar a legenda se falhou de facto
  if (meta) renderLegend(meta);
  else if (!MAP.dataLayer) renderLegend(null);
}

async function setPeriod(period) {
  if (period === APP_STATE.period) return;
  APP_STATE.period = period;
  document.body.dataset.period = period;
  document.querySelectorAll("#period-switch button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.period === period)));
  renderPeriodNote();
  updatePeriodCharts();
  const layerPromise = refreshLayer();
  if (APP_STATE.point) await onMapClick(APP_STATE.point);
  await layerPromise;
}

/* Cada clique tem um id: uma resposta lenta de um clique antigo não escreve
   por cima do diagnóstico de um clique mais recente. */
async function onMapClick(latlng) {
  const clickId = ++UI.clickId;
  APP_STATE.point = latlng;
  setMarker(latlng);
  let result = null;
  let error = null;
  try {
    result = await readPoint(latlng);
  } catch (err) {
    error = err;
  }
  if (clickId !== UI.clickId) return;

  if (error) {
    APP_STATE.parishId = null;
    APP_STATE.lcz = null;
    document.getElementById("diag-body").innerHTML =
      `<p class="hint">Não foi possível ler os valores deste ponto (${error.message}). Clica de novo.</p>`;
  } else {
    APP_STATE.parishId = result.outside ? null : result.parishId;
    APP_STATE.lcz = result.outside ? null : result.lcz;
    renderDiagnostic(result, result.outside ? "" : parishName(result.parishId));
  }
  if (UI.freguesias) highlightParish(UI.freguesias, APP_STATE.parishId);
  highlightChartsParish();
}

async function main() {
  try {
    APP_STATE.catalog = await loadCatalog();
  } catch (err) {
    setAppError(`Não foi possível carregar o catálogo de dados (${err.message}). Confirma que o servidor está a correr e recarrega a página.`);
    return;
  }
  populateProducts();
  renderPeriodNote();

  const map = initMap(onMapClick);
  initLegend(map);
  initChartTabs();
  // Os textos explicativos vêm depois do mapa: um erro aqui não o pode impedir,
  // e fica visível na consola em vez de passar despercebido
  try {
    fillCatalogText();
  } catch (err) {
    console.error("Textos do catálogo:", err);
  }
  // A legenda acompanha a camada que está mesmo no mapa, não a última escolhida
  map.on("baselayerchange", () => { if (MAP.dataMeta) renderLegend(MAP.dataMeta); });

  document.querySelectorAll("#period-switch button").forEach((b) =>
    b.addEventListener("click", () => setPeriod(b.dataset.period)));
  document.getElementById("ctl-product").addEventListener("change", (e) => {
    APP_STATE.product = e.target.value;
    refreshLayer();
  });

  const layerPromise = refreshLayer();
  try {
    const [freguesias, stats] = await Promise.all([
      addBoundaries(), fetchJSON(dataUrl(APP_STATE.catalog.stats.parishes)),
    ]);
    UI.freguesias = freguesias;
    UI.stats = stats;
    // O Chart.js mede os rótulos ao criar o gráfico: esperar pela Public Sans evita nomes cortados
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    initCharts(stats);
    // Um clique feito durante o arranque fica completo (nome e destaque da freguesia)
    if (APP_STATE.point) await onMapClick(APP_STATE.point);
  } catch (err) {
    setAppError(`Não foi possível carregar os limites ou as estatísticas (${err.message}). Recarrega a página.`);
  }
  await layerPromise;
}

document.addEventListener("DOMContentLoaded", main);
