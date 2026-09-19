/* f6 — Gráficos por freguesia (Chart.js), a partir de stats/parish_stats.json. */

const CHARTS = { order: [], suhi: null, utfvi: null, cool: null, cover: null };

/* Dica do painel: o separador "Coberto" não é por freguesia. */
const CHART_HINTS = {
  "tab-cover": "Mediana de cada passagem do satélite, por tipo de coberto. Floresta, matos e agricultura são o campo à volta de Lisboa, que serve de referência; o verde de Lisboa é Monsanto e os outros parques.",
  default: "Mediana sobre a área terrestre de cada freguesia. A freguesia do ponto selecionado fica destacada.",
};

function parishOrder(stats) {
  // Ordem fixa em todos os gráficos: da mais quente de dia para a mais fresca
  return [...stats.freguesias].sort((a, b) => b.day.suhi_median - a.day.suhi_median);
}

function isSelected(index) {
  const p = CHARTS.order[index];
  return p !== undefined && p.parish_id === APP_STATE.parishId;
}

function baseOptions(xTitle, stacked) {
  const font = { family: "Public Sans", size: 11 };
  return {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    layout: { padding: { left: 6 } },
    plugins: {
      legend: { position: "top", labels: { font, boxWidth: 12 } },
      tooltip: { callbacks: {} },
    },
    scales: {
      x: { stacked, title: { display: true, text: xTitle, font }, ticks: { font }, grid: { color: "#e3e8ec" } },
      y: {
        stacked,
        grid: { display: false },
        ticks: {
          autoSkip: false,
          color: (ctx) => (isSelected(ctx.index) ? "#1f5fa8" : "#1c2b3a"),
          font: (ctx) => ({ ...font, weight: isSelected(ctx.index) ? "600" : "400" }),
        },
      },
    },
  };
}

function initCharts(stats) {
  CHARTS.order = parishOrder(stats);
  const labels = CHARTS.order.map((p) => p.freguesia);

  const suhiOpts = baseOptions("°C acima do campo envolvente", false);
  suhiOpts.plugins.tooltip.callbacks.label = (ctx) => `${ctx.dataset.label}: ${fmtNumber(ctx.raw, 2)} °C`;
  CHARTS.suhi = new Chart(document.getElementById("chart-suhi"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Dia", data: CHARTS.order.map((p) => p.day.suhi_median), backgroundColor: APP_CONFIG.periodColors.day },
        { label: "Noite", data: CHARTS.order.map((p) => p.night.suhi_median), backgroundColor: APP_CONFIG.periodColors.night },
      ],
    },
    options: suhiOpts,
  });

  const utfviOpts = baseOptions("% da área terrestre", true);
  utfviOpts.scales.x.max = 100;
  utfviOpts.plugins.tooltip.callbacks.label = (ctx) => `${ctx.dataset.label}: ${fmtNumber(ctx.raw ?? 0, 1)}%`;
  CHARTS.utfvi = new Chart(document.getElementById("chart-utfvi"), {
    type: "bar", data: { labels, datasets: [] }, options: utfviOpts,
  });

  const coolOpts = baseOptions("% da área urbana", false);
  coolOpts.plugins.legend.display = false;
  coolOpts.plugins.tooltip.callbacks.label = (ctx) => `${fmtNumber(ctx.raw ?? 0, 1)}%`;
  CHARTS.cool = new Chart(document.getElementById("chart-cool"), {
    type: "bar", data: { labels, datasets: [] }, options: coolOpts,
  });

  initCoverChart();
  updatePeriodCharts();
}

/* Coberto: diferença de cada tipo de coberto para a mediana urbana do mesmo
   período. Em temperatura absoluta o dia (~37 °C) e a noite (~20 °C) não cabem
   na mesma escala e as barras ficariam todas iguais; com o zero na cidade as
   duas séries comparam-se e lê-se logo o essencial: de dia o campo está acima
   da cidade e de noite abaixo, e o verde de Lisboa não segue o campo. */
function coverSeries(period) {
  const covers = (APP_STATE.catalog.summary[period] || {}).by_cover_type || [];
  const urban = covers.find((c) => c.code === 1);
  if (!urban) return null;
  return new Map(covers.map((c) => [c.code, { ...c, delta: c.lst_c_median - urban.lst_c_median }]));
}

/* "0,6 °C abaixo da cidade" / "1,9 °C acima da cidade" a partir do sinal. */
function vsCity(delta) {
  if (Math.abs(delta) < 0.05) return "ao nível da cidade";
  return `${fmtNumber(Math.abs(delta), 1)} °C ${delta > 0 ? "acima" : "abaixo"} da cidade`;
}

/* Frase sobre o campo num período, escrita a partir dos dados e não do resultado
   de hoje: se todo o campo estiver do mesmo lado da cidade diz-se quanto, senão
   diz-se que está misturado. */
function campSentence(when, deltas) {
  if (!deltas.length) return "";
  const lo = Math.min(...deltas);
  const hi = Math.max(...deltas);
  if (lo > 0) return `${when} todo o campo está mais quente do que a cidade, entre ${fmtNumber(lo, 1)} e ${fmtNumber(hi, 1)} °C acima.`;
  if (hi < 0) return `${when} todo o campo está mais fresco do que a cidade, entre ${fmtNumber(-hi, 1)} e ${fmtNumber(-lo, 1)} °C abaixo.`;
  return `${when} o campo fica entre ${fmtNumber(-lo, 1)} °C abaixo e ${fmtNumber(hi, 1)} °C acima da cidade.`;
}

function initCoverChart() {
  const day = coverSeries("day");
  const night = coverSeries("night");
  if (!day) return;
  const urban = day.get(1);
  const covers = [...day.values()].filter((c) => c.code !== 1);
  const note = document.getElementById("chart-cover-note");
  if (note && urban) {
    note.textContent = `O zero é a mediana urbana de Lisboa: ${fmtNumber(urban.lst_c_median, 1)} °C de dia, `
      + `${fmtNumber((night && night.get(1) || {}).lst_c_median ?? 0, 1)} °C de noite.`;
  }

  const lead = document.getElementById("chart-cover-lead");
  const inside = day.get(5);
  const nightInside = night && night.get(5);
  if (lead && inside && nightInside) {
    const others = covers.filter((c) => c.code !== 5);
    const nightOthers = others.map((c) => (night.get(c.code) || {}).delta).filter((v) => v != null);
    lead.textContent = [
      campSentence("De dia", others.map((c) => c.delta)),
      campSentence("De noite", nightOthers),
      `O verde de Lisboa fica ${vsCity(inside.delta)} de dia e ${vsCity(nightInside.delta)} de noite.`,
    ].join(" ");
  }

  const options = baseOptions("°C face à mediana urbana", false);
  options.plugins.tooltip.callbacks.label = (ctx) => {
    const series = ctx.datasetIndex === 0 ? day : night;
    const cover = series && series.get(covers[ctx.dataIndex].code);
    if (!cover) return "";
    const sign = cover.delta > 0 ? "+" : "";
    return `${ctx.dataset.label}: ${sign}${fmtNumber(cover.delta, 1)} °C `
      + `(${fmtNumber(cover.lst_c_median, 1)} °C, ${fmtNumber(cover.n_pixels, 0)} píxeis)`;
  };
  // Aqui o eixo y são cobertos, não freguesias: sem destaque de freguesia
  options.scales.y.ticks.color = "#1c2b3a";
  options.scales.y.ticks.font = { family: "Public Sans", size: 11 };
  options.datasets = { bar: { maxBarThickness: 26 } };
  const delta = (series, code) => (series && series.has(code) ? series.get(code).delta : null);
  CHARTS.cover = new Chart(document.getElementById("chart-cover"), {
    type: "bar",
    data: {
      labels: covers.map((c) => c.label),
      datasets: [
        { label: "Dia", data: covers.map((c) => delta(day, c.code)), backgroundColor: APP_CONFIG.periodColors.day },
        { label: "Noite", data: covers.map((c) => delta(night, c.code)), backgroundColor: APP_CONFIG.periodColors.night },
      ],
    },
    options,
  });
}

function updatePeriodCharts() {
  if (!CHARTS.utfvi) return;
  const period = APP_STATE.period;
  const periodLabel = APP_STATE.catalog.periods[period].label.toLowerCase();

  const legend = layerLegend(period, "UTFVI_CLASS");
  CHARTS.utfvi.data.datasets = legend.labels.map((label, k) => ({
    label, backgroundColor: legend.colors[k],
    data: CHARTS.order.map((p) => p[period].utfvi_class_pct_land[k]),
  }));
  CHARTS.utfvi.update();

  const cool = layerLegend(period, "COOL_ISLAND");
  CHARTS.cool.data.datasets = [{
    label: "Refúgios térmicos", backgroundColor: cool.colors[0],
    data: CHARTS.order.map((p) => p[period].cool_island_pct_urban ?? 0),
  }];
  CHARTS.cool.update();

  document.getElementById("chart-utfvi-title").textContent = `Stress térmico (UTFVI), % da área, ${periodLabel}`;
  document.getElementById("chart-cool-title").textContent = `Refúgios térmicos, % da área urbana, ${periodLabel}`;
}

/* Separadores: um gráfico de cada vez. O Chart.js não mede um canvas escondido,
   por isso o gráfico é redimensionado ao ser mostrado. Funciona mesmo que os
   gráficos ainda não existam (ou tenham falhado). */
function initChartTabs() {
  const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
  const charts = {
    "tab-suhi": () => CHARTS.suhi, "tab-utfvi": () => CHARTS.utfvi,
    "tab-cool": () => CHARTS.cool, "tab-cover": () => CHARTS.cover,
  };
  const hint = document.getElementById("charts-hint");
  const select = (tab, focus) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    });
    if (hint) hint.textContent = CHART_HINTS[tab.id] || CHART_HINTS.default;
    const chart = charts[tab.id]();
    if (chart) chart.resize();
    if (focus) tab.focus();
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(tab, false));
    tab.addEventListener("keydown", (e) => {
      const targets = {
        ArrowRight: tabs[(i + 1) % tabs.length],
        ArrowLeft: tabs[(i + tabs.length - 1) % tabs.length],
        Home: tabs[0],
        End: tabs[tabs.length - 1],
      };
      if (!targets[e.key]) return;
      select(targets[e.key], true);
      e.preventDefault();
    });
  });
}

function highlightChartsParish() {
  for (const chart of [CHARTS.suhi, CHARTS.utfvi, CHARTS.cool]) {
    if (chart) chart.update();
  }
}
