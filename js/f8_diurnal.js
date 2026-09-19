/* f8 — Ciclo diário: a ilha de calor ao longo das 24 h, com todas as passagens
   selecionadas (incluindo as de sol baixo, que não entram nos mapas), e a mesma
   curva por Local Climate Zone. Lê catalog.diurnal (p6). */

const DIURNAL = { chart: null, lcz: null };

/* O nascer e o pôr do sol juntam-se numa só série: são o mesmo critério (sol
   entre os dois limiares) e distinguem-se pela hora no eixo. */
function diurnalGroups() {
  return [
    { key: "day", periods: ["day"], label: "Dia", color: APP_CONFIG.periodColors.day },
    { key: "transition", periods: ["dawn", "dusk"], label: "Nascer e pôr do sol", color: "#7d8f9f" },
    { key: "night", periods: ["night"], label: "Noite", color: APP_CONFIG.periodColors.night },
  ];
}

function binMid(b) {
  return (b.hour_min + b.hour_max) / 2;
}

/* 9.5 -> "9h30", 21 -> "21h" (arredondado à meia hora). */
function fmtHour(h) {
  const half = Math.round(((h % 24) + 24) % 24 * 2) / 2;
  const whole = Math.floor(half);
  return half === whole ? `${whole}h` : `${whole}h30`;
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

/* Horas a que a mediana troca de sinal, por interpolação linear entre classes
   vizinhas (dando a volta à meia-noite). */
function signChanges(bins) {
  const pts = bins.filter((b) => b.median !== undefined).map((b) => [binMid(b), b.median]);
  const out = [];
  for (let i = 0; i < pts.length; i += 1) {
    const [h0, v0] = pts[i];
    const [h1raw, v1] = pts[(i + 1) % pts.length];
    const h1 = h1raw <= h0 ? h1raw + 24 : h1raw;
    if (v0 === 0 || Math.sign(v0) === Math.sign(v1)) continue;
    out.push({ hour: (h0 + (h1 - h0) * (v0 / (v0 - v1))) % 24, rising: v1 > v0 });
  }
  return out;
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
  const changes = signChanges(d.bins);
  const down = changes.find((c) => !c.rising);
  const up = changes.find((c) => c.rising);
  if (down && up) {
    parts.push(`A diferença passa a negativa por volta das ${fmtHour(down.hour)} e volta a positiva por volta das ${fmtHour(up.hour)}.`);
  }
  return parts.join(" ");
}

function diurnalNote(d) {
  const n = d.n_scenes_by_period;
  const nTrans = (n.dawn || 0) + (n.dusk || 0);
  const cat = APP_STATE.catalog;
  return `Cada ponto é uma passagem do satélite, num dia diferente (${d.n_scenes} passagens, verões de `
    + `${cat.years[0]} a ${cat.years[cat.years.length - 1]}). A linha é a mediana a cada ${d.bin_h} h e a `
    + `faixa vai do 1.º ao 3.º quartil. É um ciclo composto a partir de muitos dias, não o ciclo de um dia real. `
    + `As ${nTrans} passagens do nascer e do pôr do sol só entram aqui: os mapas de dia e de noite não as usam. `
    + `Hora legal de verão (UTC+${d.local_utc_offset_h}).`;
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

  const bandStyle = { showLine: true, pointRadius: 0, borderWidth: 0, backgroundColor: "rgba(31, 95, 168, 0.12)" };
  const datasets = [
    { ...bandStyle, label: "p25", data: withMedian.map((b) => ({ x: binMid(b), y: b.p25 })), fill: false },
    { ...bandStyle, label: "p75", data: withMedian.map((b) => ({ x: binMid(b), y: b.p75 })), fill: "-1" },
    {
      label: `Mediana a cada ${d.bin_h} h`, showLine: true, pointRadius: 0, borderWidth: 2.5,
      borderColor: "#1f5fa8", backgroundColor: "#1f5fa8",
      data: withMedian.map((b) => ({ x: binMid(b), y: b.median })),
    },
    ...diurnalGroups().map((g) => ({
      label: g.label, pointRadius: 3.5, pointHoverRadius: 5,
      backgroundColor: g.color, borderColor: g.color,
      data: d.scenes.filter((s) => g.periods.includes(s.period))
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
          labels: { font, boxWidth: 12, filter: (item) => !["p25", "p75"].includes(item.text) },
        },
        tooltip: {
          filter: (item) => !["p25", "p75"].includes(item.dataset.label),
          callbacks: {
            title: (items) => {
              const s = items[0].raw.scene;
              return s ? sceneWhen(s, d.local_utc_offset_h) : `${items[0].raw.x - d.bin_h / 2}h–${items[0].raw.x + d.bin_h / 2}h`;
            },
            label: (ctx) => {
              const s = ctx.raw.scene;
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
