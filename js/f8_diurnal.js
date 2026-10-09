/* f8 — Ciclo diário: a ilha de calor ao longo das 24 h, com todas as passagens
   selecionadas (incluindo as que não entram nos mapas), a curva ajustada (p6,
   fit_diurnal_cycle) e a mesma curva por Local Climate Zone. Lê catalog.diurnal. */

const DIURNAL = { chart: null, lcz: null };

/* Os pontos separam-se pelo mapa onde entram: é o que liga o gráfico aos mapas.
   O nascer e o pôr do sol e a noite antes da meia-noite ficam numa só série. */
function diurnalGroups() {
  const periods = APP_STATE.catalog.periods;
  return [
    { key: "day", label: `${periods.day.label} (mapa)`, color: APP_CONFIG.periodColors.day,
      test: (s) => s.period === "day" && s.in_map },
    { key: "night", label: `${periods.night.label} (mapa)`, color: APP_CONFIG.periodColors.night,
      test: (s) => s.period === "night" && s.in_map },
    { key: "out", label: "Fora dos mapas", color: "#7d8f9f", test: (s) => !s.in_map },
  ];
}

const FIT_BAND = ["IC baixo", "IC alto"];

/* 90 a partir dos percentis do intervalo gravados pelo p6 ([5, 95]). */
function ciLevel(f) {
  return f.ci_percentiles[1] - f.ci_percentiles[0];
}
const FIT_LINE = "Curva ajustada";

function binMid(b) {
  return (b.hour_min + b.hour_max) / 2;
}

/* 9.5 -> "9h30", 21 -> "21h", 10.23 -> "10h15" (arredondado ao quarto de hora). */
function fmtHour(h) {
  const q = Math.round(((h % 24) + 24) % 24 * 4) / 4 % 24;
  const whole = Math.floor(q);
  const min = Math.round((q - whole) * 60);
  return min ? `${whole}h${String(min).padStart(2, "0")}` : `${whole}h`;
}

/* Data e hora local da passagem, a partir da hora UTC do catálogo. */
function sceneWhen(scene, offset) {
  const t = new Date(`${scene.time_utc}Z`);
  t.setUTCHours(t.getUTCHours() + offset);
  const dd = String(t.getUTCDate()).padStart(2, "0");
  const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
  const hh = String(t.getUTCHours()).padStart(2, "0");
  const mi = String(t.getUTCMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${t.getUTCFullYear()}, ${hh}:${mi}`;
}

function binRange(b) {
  return `entre as ${b.hour_min}h e as ${b.hour_max}h`;
}

function diurnalLead(d) {
  const bins = d.bins.filter((b) => b.median !== undefined);
  if (!bins.length) return "";
  const hi = bins.reduce((a, b) => (b.median > a.median ? b : a));
  const lo = bins.reduce((a, b) => (b.median < a.median ? b : a));
  const parts = [`A ilha de calor é mais forte ${binRange(hi)} (${signed(hi.median, 1)} °C).`];
  if (lo.median < 0) {
    parts.push(`A cidade fica mais fresca do que o campo sobretudo ${binRange(lo)} (${signed(lo.median, 1)} °C).`);
  } else {
    parts.push(`É mais fraca ${binRange(lo)} (${signed(lo.median, 1)} °C).`);
  }
  // As horas de troca de sinal e a média vêm da curva ajustada: são os resultados
  // robustos entre variantes do modelo. O pico e o mínimo vêm das medianas acima.
  const f = d.fit;
  if (f && f.sign_changes.down && f.sign_changes.up) {
    const when = (c) => `por volta das ${fmtHour(c.hour)} (entre as ${fmtHour(c.ci[0])} e as ${fmtHour(c.ci[1])})`;
    parts.push(`A diferença passa a negativa ${when(f.sign_changes.down)} e volta a positiva ${when(f.sign_changes.up)}.`);
  }
  if (f) {
    const mean = Math.abs(f.daily_mean_k) < 0.05 ? "ao nível do campo"
      : `${fmtNumber(Math.abs(f.daily_mean_k), 1)} °C ${f.daily_mean_k > 0 ? "acima" : "abaixo"} do campo`;
    parts.push(`Em média, ao longo das 24 horas, Lisboa fica ${mean}: `
      + `o mapa de dia mostra ${signed(f.maps.day.suhi_intensity_k_median, 1)} °C e o de madrugada `
      + `${signed(f.maps.night.suhi_intensity_k_median, 1)} °C.`);
  }
  return parts.join(" ");
}

function diurnalNote(d) {
  const cat = APP_STATE.catalog;
  const nOut = d.n_scenes - d.n_scenes_in_maps;
  const sparse = d.bins.filter((b) => b.median === undefined).map((b) => `${b.hour_min}–${b.hour_max}h`);
  const f = d.fit;
  return `Cada ponto é uma passagem do satélite, num dia diferente (${d.n_scenes} passagens, verões de `
    + `${cat.years[0]} a ${cat.years[cat.years.length - 1]}). A linha contínua é a mediana a cada ${d.bin_h} h. `
    + (f ? `A tracejada é uma sinusoide ajustada a todas as passagens, e a faixa o seu intervalo de `
      + `${ciLevel(f)}% (reamostrando verões inteiros). Serve para a média e para as horas de troca de sinal; `
      + `o pico e o mínimo leem-se nas medianas. ` : "")
    + (sparse.length ? `Onde há poucas passagens para uma mediana (${sparse.join(", ")}) a linha da mediana só liga as vizinhas. ` : "")
    + `É um ciclo composto a partir de muitos dias, não o ciclo de um dia real. `
    + `As ${nOut} passagens cinzentas só entram aqui. Hora legal de verão (UTC+${d.local_utc_offset_h}).`;
}

/* Curva ajustada a fechar nas 24 h (o último ponto repete o das 0 h). */
function fitPoints(f, key) {
  const pts = f.curve.map((c) => ({ x: c.hour, y: c[key] }));
  return [...pts, { x: 24, y: f.curve[0][key] }];
}

function hourAxis(font) {
  return {
    type: "linear", min: 0, max: 24,
    title: { display: true, text: "Hora local", font },
    ticks: { font, stepSize: 3, callback: (v) => `${v}h` },
    grid: { color: "#e3e8ec" },
  };
}

function suhiAxis(font) {
  return {
    title: { display: true, text: "°C face ao campo envolvente", font },
    ticks: { font, callback: (v) => signed(v, 0) },
    // o zero é a fronteira entre ilha de calor e cidade mais fresca: linha mais forte
    grid: { color: (ctx) => (ctx.tick && ctx.tick.value === 0 ? "#4a5a6a" : "#e3e8ec") },
  };
}

function initDiurnalChart() {
  const d = APP_STATE.catalog.diurnal;
  const canvas = document.getElementById("chart-diurnal");
  if (!d || !canvas) return;
  const font = { family: "Public Sans", size: 11 };
  const withMedian = d.bins.filter((b) => b.median !== undefined);

  const bandStyle = { showLine: true, pointRadius: 0, pointHitRadius: 0, borderWidth: 0,
    backgroundColor: "rgba(90, 90, 90, 0.13)" };
  const fit = d.fit ? [
    { ...bandStyle, label: FIT_BAND[0], data: fitPoints(d.fit, "lo"), fill: false },
    { ...bandStyle, label: FIT_BAND[1], data: fitPoints(d.fit, "hi"), fill: "-1" },
    {
      label: FIT_LINE, showLine: true, pointRadius: 0, borderWidth: 1.5, borderDash: [5, 4],
      // fundo transparente: na legenda fica só o contorno tracejado, como a linha
      borderColor: "#4a4a4a", backgroundColor: "rgba(0, 0, 0, 0)", data: fitPoints(d.fit, "value"),
    },
  ] : [];
  const datasets = [
    ...fit,
    {
      label: `Mediana a cada ${d.bin_h} h`, showLine: true, pointRadius: 0, borderWidth: 2.5,
      borderColor: "#1f5fa8", backgroundColor: "#1f5fa8",
      data: withMedian.map((b) => ({ x: binMid(b), y: b.median })),
    },
    ...diurnalGroups().map((g) => ({
      label: g.label, pointRadius: 3.5, pointHoverRadius: 5,
      backgroundColor: g.color, borderColor: g.color,
      data: d.scenes.filter(g.test)
        .map((s) => ({ x: s.hour_local, y: s.suhi_intensity_k, scene: s })),
    })),
  ];

  DIURNAL.chart = new Chart(canvas, {
    type: "scatter",
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: {
        legend: {
          position: "top",
          labels: { font, boxWidth: 12, filter: (item) => !FIT_BAND.includes(item.text) },
        },
        tooltip: {
          filter: (item) => !FIT_BAND.includes(item.dataset.label),
          callbacks: {
            title: (items) => {
              if (!items.length) return "";   // só a banda do IC sob o rato, que o filtro tira
              const s = items[0].raw.scene;
              if (s) return sceneWhen(s, d.local_utc_offset_h);
              if (items[0].dataset.label === FIT_LINE) return fmtHour(items[0].raw.x);
              return `${items[0].raw.x - d.bin_h / 2}h–${items[0].raw.x + d.bin_h / 2}h`;
            },
            label: (ctx) => {
              const s = ctx.raw.scene;
              if (ctx.dataset.label === FIT_LINE) return `Curva ajustada: ${signed(ctx.raw.y, 1)} °C`;
              if (!s) return `Mediana: ${signed(ctx.raw.y, 1)} °C`;
              return [`${signed(s.suhi_intensity_k, 1)} °C face ao campo`,
                `Cidade ${fmtNumber(s.urban_median_c, 1)} °C, campo ${fmtNumber(s.reference_median_c, 1)} °C`];
            },
          },
        },
      },
      scales: { x: hourAxis(font), y: suhiAxis(font) },
    },
  });

  const lead = document.getElementById("chart-diurnal-lead");
  if (lead) lead.textContent = diurnalLead(d);
  const note = document.getElementById("chart-diurnal-note");
  if (note) note.textContent = diurnalNote(d);
}

/* --- Por Local Climate Zone ---------------------------------------------- */

function lczName(c) {
  return `${c.short} ${c.label.toLowerCase()}`;
}

/* Na hora de maior e de menor ilha de calor: entre que valores ficam os
   tecidos construídos (LCZ 1–10) e onde fica o arvoredo denso (LCZ A). As
   classes naturais pequenas dentro de Lisboa (ex.: LCZ D, ~300 píxeis
   espalhados pela periferia) ficam de fora da frase, mas continuam no gráfico. */
function lczLead(d) {
  const bins = d.bins.filter((b) => b.median !== undefined);
  if (!bins.length || !d.lcz.length) return "";
  const phrase = (when, bin) => {
    const i = d.bins.indexOf(bin);
    const built = d.lcz.filter((c) => c.code <= 10)
      .map((c) => ({ c, v: c.bins[i].median })).filter((x) => x.v !== undefined)
      .sort((a, b) => a.v - b.v);
    if (built.length < 2) return "";
    const lo = built[0];
    const hi = built[built.length - 1];
    const trees = d.lcz.find((c) => c.code === 11);
    const t = trees ? trees.bins[i].median : undefined;
    return `${when} (${bin.hour_min}h–${bin.hour_max}h) os tecidos construídos vão de ${signed(lo.v, 1)} °C `
      + `(${lczName(lo.c)}) a ${signed(hi.v, 1)} °C (${lczName(hi.c)})`
      + (t !== undefined ? `; o arvoredo denso fica em ${signed(t, 1)} °C.` : ".");
  };
  const hi = bins.reduce((a, b) => (b.median > a.median ? b : a));
  const lo = bins.reduce((a, b) => (b.median < a.median ? b : a));
  return [phrase("No pico da ilha de calor", hi), phrase("No outro extremo", lo)].filter(Boolean).join(" ");
}

function lczDatasets(d) {
  return d.lcz.map((c) => {
    const selected = APP_STATE.lcz === c.code;
    const dim = APP_STATE.lcz && d.lcz.some((x) => x.code === APP_STATE.lcz) && !selected;
    return {
      label: lczName(c), code: c.code,
      data: c.bins.map((b) => ({ x: binMid(b), y: b.median === undefined ? null : b.median, n: b.n })),
      borderColor: dim ? `${c.color}88` : c.color, backgroundColor: c.color,
      borderWidth: selected ? 4 : 2, pointRadius: selected ? 3 : 1.5,
      // liga as classes com uma só passagem, como a mediana do separador 24 horas
      showLine: true, spanGaps: true,
    };
  });
}

function initLczChart() {
  const d = APP_STATE.catalog.diurnal;
  const canvas = document.getElementById("chart-lcz");
  if (!d || !canvas || !d.lcz || !d.lcz.length) return;
  const font = { family: "Public Sans", size: 11 };
  DIURNAL.lcz = new Chart(canvas, {
    type: "scatter",
    data: { datasets: lczDatasets(d) },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: {
        legend: { position: "top", labels: { font, boxWidth: 10, boxHeight: 10 } },
        tooltip: {
          callbacks: {
            title: (items) => `${items[0].raw.x - d.bin_h / 2}h–${items[0].raw.x + d.bin_h / 2}h`,
            label: (ctx) => `${ctx.dataset.label}: ${signed(ctx.raw.y, 1)} °C (${ctx.raw.n} passagens)`,
          },
        },
      },
      scales: { x: hourAxis(font), y: suhiAxis(font) },
    },
  });
  const lead = document.getElementById("chart-lcz-lead");
  if (lead) lead.textContent = lczLead(d);
  const note = document.getElementById("chart-lcz-note");
  if (note) {
    // quanto de Lisboa cai na LCZ 8: é onde o mapa global mais simplifica
    const classes = (APP_STATE.catalog.lcz || {}).classes || [];
    const total = classes.reduce((s, c) => s + c.n_pixels_lisboa, 0);
    const lcz8 = classes.find((c) => c.code === 8);
    const share = total && lcz8 ? Math.round((100 * lcz8.n_pixels_lisboa) / total) : null;
    note.textContent = "Mapa global de Local Climate Zones (Demuzere et al., 2022), a 100 m. "
      + "O centro histórico sai bem como LCZ 2, mas "
      + (share ? `${share}% de Lisboa fica em LCZ 8, ` : "a LCZ 8 cobre ")
      + "quase toda a periferia norte e oriental, onde muita habitação em bloco aberto seria LCZ 4 ou 5 "
      + "num mapa local. Clica numa zona da legenda para a esconder, ou no mapa para destacar a zona desse ponto.";
  }
}

/* Destaca a LCZ do ponto clicado (APP_STATE.lcz). */
function highlightLcz() {
  if (!DIURNAL.lcz) return;
  const d = APP_STATE.catalog.diurnal;
  const hidden = DIURNAL.lcz.data.datasets.map((_, i) => !DIURNAL.lcz.isDatasetVisible(i));
  DIURNAL.lcz.data.datasets = lczDatasets(d);
  hidden.forEach((h, i) => { if (h) DIURNAL.lcz.setDatasetVisibility(i, false); });
  DIURNAL.lcz.update();
}

/* Frase curta para o diagnóstico: como a zona do ponto varia ao longo do dia. */
function lczRangeText(code) {
  const d = APP_STATE.catalog.diurnal;
  const c = d && d.lcz.find((x) => x.code === code);
  if (!c) return "";
  const bins = c.bins.filter((b) => b.median !== undefined);
  if (bins.length < 2) return "";
  const hi = bins.reduce((a, b) => (b.median > a.median ? b : a));
  const lo = bins.reduce((a, b) => (b.median < a.median ? b : a));
  return `Nesta zona a diferença para o campo vai de ${signed(lo.median, 1)} °C (${lo.hour_min}h–${lo.hour_max}h) `
    + `a ${signed(hi.median, 1)} °C (${hi.hour_min}h–${hi.hour_max}h).`;
}
