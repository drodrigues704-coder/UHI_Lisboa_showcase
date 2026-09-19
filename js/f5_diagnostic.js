/* f5 — Diagnóstico do ponto clicado: lê as grelhas binárias do catálogo
   (valores dos compostos de dia e de noite) sem pedir cálculos ao backend.
   As classes vêm de bandas próprias, calculadas no pipeline sobre o valor
   original; recalculá-las aqui sobre o valor arredondado mudava de classe junto
   aos limites. */

function gridIndex(latlng) {
  const g = APP_STATE.catalog.grids;
  const [a, , c, , e, f] = g.transform;
  const col = Math.floor((latlng.lng - c) / a);
  const row = Math.floor((latlng.lat - f) / e);
  if (col < 0 || row < 0 || col >= g.width || row >= g.height) return null;
  return row * g.width + col;
}

function bandValue(array, bands, name, idx) {
  const g = APP_STATE.catalog.grids;
  const b = bands.findIndex((x) => x.name === name);
  if (b < 0) throw new Error(`banda ${name} não existe na grelha`);
  const raw = array[b * g.width * g.height + idx];
  return raw === g.nodata ? null : raw / bands[b].scale;
}

async function readPoint(latlng) {
  const cat = APP_STATE.catalog;
  const idx = gridIndex(latlng);
  if (idx === null) return { outside: true };

  const [stat, day, night] = await Promise.all([loadGrid("static"), loadGrid("day"), loadGrid("night")]);
  const parishId = bandValue(stat, cat.grids.bands.static, "parish_id", idx);
  const cover = bandValue(stat, cat.grids.bands.static, "cover", idx);
  if (!parishId) return { outside: true };

  const names = ["LST_C", "SUHI", "UTFVI", "COOL_FREQ", "LST_C_CLASS", "SUHI_CLASS", "UTFVI_CLASS"];
  const values = {};
  for (const [period, arr] of [["day", day], ["night", night]]) {
    const bands = cat.grids.bands[period];
    values[period] = Object.fromEntries(names.map((n) => [n, bandValue(arr, bands, n, idx)]));
  }
  return { outside: false, parishId, cover, values };
}

function layerLegend(period, product) {
  return APP_STATE.catalog.layers.find((l) => l.period === period && l.product === product).legend;
}

function signedNumber(v, decimals) {
  const text = fmtNumber(Math.abs(v) < 0.5 * 10 ** -decimals ? 0 : v, decimals);
  return v > 0 && text !== fmtNumber(0, decimals) ? `+${text}` : text;
}

function cellHtml(period, key, vals, cover) {
  const cat = APP_STATE.catalog;
  const v = vals[key];
  if (key === "COOL_FREQ") {
    if (cover !== cat.grids.cover_codes.urban) return `<span class="cls">Só se aplica a pontos urbanos</span>`;
    if (v === null) return "Sem dados";
    const isRefuge = v >= cat.parameters.cool_island_min_frequency;
    return `${isRefuge ? "Sim" : "Não"}<span class="cls">mais fresco em ${fmtNumber(100 * v, 0)}% das passagens</span>`;
  }
  if (v === null) return "Sem dados";
  const cls = vals[`${key}_CLASS`];
  if (key === "UTFVI") {
    const label = cls === null ? "" : layerLegend(period, "UTFVI_CLASS").labels[cls];
    return `${fmtNumber(v, 5)}<span class="cls">${label}</span>`;
  }
  const legend = layerLegend(period, key);
  const text = key === "SUHI" ? signedNumber(v, 2) : fmtNumber(v, 2);
  const label = cls === null ? "" : `classe ${legend.labels[cls]}`;
  return `${text} °C<span class="cls">${label}</span>`;
}

function renderDiagnostic(result, parishName) {
  const body = document.getElementById("diag-body");
  if (!result) {
    body.innerHTML = `<p class="hint">Clica no mapa para ver os valores desse ponto, de dia e de noite.</p>`;
    return;
  }
  if (result.outside) {
    body.innerHTML = `<p class="hint">Este ponto fica fora do município de Lisboa. Clica dentro do limite.</p>`;
    return;
  }
  const grids = APP_STATE.catalog.grids;
  const place = `<p class="diag-place">${parishName}<small>${grids.cover_labels[result.cover]}</small></p>`;
  if (result.cover === grids.cover_codes.water) {
    body.innerHTML = `${place}<p class="hint">A água é excluída dos cálculos.</p>`;
    return;
  }
  const rows = [
    ["LST_C", "Temperatura da superfície"],
    ["SUHI", "Ilha de calor (SUHI)"],
    ["UTFVI", "Stress térmico (UTFVI)"],
    ["COOL_FREQ", "Refúgio térmico"],
  ];
  const current = APP_STATE.period;
  body.innerHTML = `${place}
    <table class="diag">
      <colgroup><col><col class="${current === "day" ? "current" : ""}"><col class="${current === "night" ? "current" : ""}"></colgroup>
      <thead><tr><th scope="col"><span class="sr-only">Indicador</span></th><th scope="col">Dia</th><th scope="col">Noite</th></tr></thead>
      <tbody>${rows.map(([key, label]) => `<tr><th scope="row">${label}</th>
        <td>${cellHtml("day", key, result.values.day, result.cover)}</td>
        <td>${cellHtml("night", key, result.values.night, result.cover)}</td></tr>`).join("")}
      </tbody>
    </table>`;
}
