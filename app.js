let plumbingRows = [];
let tgaRows = [];

const charts = {};
let activePanel = "panel-sofr";

const panelRanges = {
  "panel-sofr": "6M",
  "panel-spread": "6M",
  "panel-tga": "6M",
  "panel-walcl": "3Y",
  "panel-repo": "6M",
};

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const cacheBust = `?v=${Date.now()}`;

    const [plumbData, tgaData] = await Promise.all([
      fetchJson(`./data/plumbing_data.json${cacheBust}`),
      fetchJson(`./data/tga_data.json${cacheBust}`).catch(() => []),
    ]);

    plumbingRows = normalizePlumbing(plumbData).sort((a, b) => a.date - b.date);
    tgaRows = normalizeTGA(tgaData).sort((a, b) => a.date - b.date);

    updateCards();
    setupTabs();
    setupRangeButtons();

    buildChartForPanel(activePanel);
    updateLastUpdateLabel(plumbData?.last_updated_utc);
  } catch (err) {
    console.error("Error inicializando dashboard:", err);
  }
});

/* ---------- Normalización ---------- */

function normalizePlumbing(plumbJson) {
  if (!plumbJson || !plumbJson.series || !plumbJson.series.SOFR) {
    throw new Error("Formato inesperado de plumbing_data.json");
  }

  const s = plumbJson.series;

  const dates = s.SOFR.dates || [];
  const sofrVals = s.SOFR.values || [];

  const effrVals = s.EFFR?.values ?? [];
  const iorbVals = s.IORB?.values ?? [];
  const walclVals = s.WALCL?.values ?? [];
  const tgcrVals = s.TGCR?.values ?? [];
  const onrrpVals = s.ONRRP?.values ?? [];

  const rows = [];
  for (let i = 0; i < dates.length; i++) {
    rows.push({
      date: new Date(dates[i]),
      sofr: toNumber(sofrVals[i]),
      effr: toNumber(effrVals[i]),
      iorb: toNumber(iorbVals[i]),
      walcl: toNumber(walclVals[i]),
      tgcr: toNumber(tgcrVals[i]),
      onrrp: toNumber(onrrpVals[i]),
    });
  }

  return rows.filter((r) => r.date instanceof Date && !isNaN(r.date));
}

function normalizeTGA(tgaData) {
  // soporta tanto array row-based como series-based (por si lo cambiás después)
  if (Array.isArray(tgaData)) {
    return tgaData.map((row) => ({
      date: new Date(row.date),
      tga: toNumber(row.TGA ?? row.tga ?? row.value),
    })).filter(r => r.date instanceof Date && !isNaN(r.date));
  }

  // series-based
  if (tgaData?.series?.TGA?.dates && tgaData?.series?.TGA?.values) {
    const dates = tgaData.series.TGA.dates;
    const vals = tgaData.series.TGA.values;
    return dates.map((d, i) => ({
      date: new Date(d),
      tga: toNumber(vals[i]),
    })).filter(r => r.date instanceof Date && !isNaN(r.date));
  }

  return [];
}

/* ---------- Fetch ---------- */

async function fetchJson(path) {
  const resp = await fetch(path, { cache: "no-store" });
  if (!resp.ok) throw new Error(`No se pudo leer ${path} (HTTP ${resp.status})`);
  return resp.json();
}

/* ---------- Helpers ---------- */

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatPercent(x) {
  if (x == null || !Number.isFinite(x)) return "–";
  return (x * 100).toFixed(2) + " %";
}

function formatSpreadPp(x) {
  if (x == null || !Number.isFinite(x)) return "–";
  return x.toFixed(2) + " pp";
}

function getLastNonNull(arr, field) {
  for (let i = arr.length - 1; i >= 0; i--) {
    const v = arr[i][field];
    if (v != null && Number.isFinite(v)) return arr[i];
  }
  return null;
}

function filterByRange(rows, range) {
  if (!rows.length || range === "ALL") return rows;

  const lastDate = rows[rows.length - 1].date;
  let from = new Date(lastDate);

  switch (range) {
    case "6M": from.setMonth(from.getMonth() - 6); break;
    case "1Y": from.setFullYear(from.getFullYear() - 1); break;
    case "3Y": from.setFullYear(from.getFullYear() - 3); break;
    case "5Y": from.setFullYear(from.getFullYear() - 5); break;
    default: return rows;
  }

  return rows.filter((r) => r.date >= from);
}

function clearEl(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  el.innerHTML = "";
  return el;
}

/* ---------- Cards + Label ---------- */

function updateCards() {
  if (!plumbingRows.length) return;

  const lastSofr = getLastNonNull(plumbingRows, "sofr");
  const lastEffr = getLastNonNull(plumbingRows, "effr");
  const lastIorb = getLastNonNull(plumbingRows, "iorb");

  const vSofr = lastSofr ? lastSofr.sofr : null;
  const vEffr = lastEffr ? lastEffr.effr : null;
  const vIorb = lastIorb ? lastIorb.iorb : null;

  const spreadPp = vSofr != null && vIorb != null ? (vSofr - vIorb) * 100 : null;

  document.getElementById("card-sofr").textContent = formatPercent(vSofr);
  document.getElementById("card-effr").textContent = formatPercent(vEffr);
  document.getElementById("card-iorb").textContent = formatPercent(vIorb);
  document.getElementById("card-spread").textContent = formatSpreadPp(spreadPp);
}

function updateLastUpdateLabel(lastUpdatedUtc) {
  const el = document.getElementById("last-update");
  if (!el) return;

  if (lastUpdatedUtc) {
    el.textContent = "Última actualización (UTC): " + lastUpdatedUtc.replace("T", " ").replace("Z", "");
    return;
  }

  if (!plumbingRows.length) return;
  const lastDate = plumbingRows[plumbingRows.length - 1].date;
  el.textContent = "Última actualización (UTC): " + lastDate.toISOString().replace("T", " ").slice(0, 16);
}

/* ---------- Tabs ---------- */

function setupTabs() {
  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = btn.dataset.panel;
      if (!panel || panel === activePanel) return;

      document.querySelectorAll(".tab-button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      document.getElementById(panel).classList.add("active");

      activePanel = panel;
      buildChartForPanel(panel);
    });
  });
}

/* ---------- Ranges ---------- */

function setupRangeButtons() {
  document.querySelectorAll(".range-buttons").forEach((group) => {
    const panel = group.dataset.panel;
    group.querySelectorAll(".range-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const range = btn.dataset.range;
        if (!range) return;

        panelRanges[panel] = range;

        group.querySelectorAll(".range-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        if (panel === activePanel) buildChartForPanel(panel);
      });
    });
  });
}

/* ---------- Chart routing ---------- */

function buildChartForPanel(panelId) {
  if (charts[panelId]) {
    try { charts[panelId].destroy(); } catch {}
    charts[panelId] = null;
  }

  switch (panelId) {
    case "panel-sofr":   charts[panelId] = buildSofrChart(); break;
    case "panel-spread": charts[panelId] = buildSpreadChart(); break;
    case "panel-tga":    charts[panelId] = buildTgaChart(); break;
    case "panel-walcl":  charts[panelId] = buildWalclChart(); break;
    case "panel-repo":   charts[panelId] = buildRepoChart(); break;
  }
}

/* ---------- Charts ---------- */

function buildSofrChart() {
  const range = panelRanges["panel-sofr"];
  const data = filterByRange(plumbingRows, range);

  const series = [
    { name: "SOFR", data: data.filter(r => r.sofr != null).map(r => ({ x: r.date, y: r.sofr * 100 })) },
    { name: "EFFR", data: data.filter(r => r.effr != null).map(r => ({ x: r.date, y: r.effr * 100 })) },
    { name: "IORB", data: data.filter(r => r.iorb != null).map(r => ({ x: r.date, y: r.iorb * 100 })) },
  ];

  const el = clearEl("chart-sofr");
  if (!el) return null;

  const options = {
    chart: { type: "line", height: 520, toolbar: { show: true }, zoom: { enabled: true } },
    series,
    xaxis: { type: "datetime" },
    yaxis: { title: { text: "Tasa (%)" }, labels: { formatter: v => v.toFixed(2) } },
    stroke: { width: 2 },
    legend: { position: "top" },
  };

  const chart = new ApexCharts(el, options);
  chart.render();
  return chart;
}

function buildSpreadChart() {
  const range = panelRanges["panel-spread"];

  const withSpread = plumbingRows
    .filter(r => r.sofr != null && r.iorb != null)
    .map(r => ({ date: r.date, spreadPp: (r.sofr - r.iorb) * 100 })); // pp

  const data = filterByRange(withSpread, range);

  const el = clearEl("chart-spread");
  if (!el) return null;

  const options = {
    chart: { type: "line", height: 520, toolbar: { show: true }, zoom: { enabled: true } },
    series: [{ name: "SOFR - IORB (pp)", data: data.map(r => ({ x: r.date, y: r.spreadPp })) }],
    xaxis: { type: "datetime" },
    yaxis: { title: { text: "Spread (pp)" }, labels: { formatter: v => v.toFixed(2) } },
    stroke: { width: 2 },
  };

  const chart = new ApexCharts(el, options);
  chart.render();
  return chart;
}

function buildTgaChart() {
  const range = panelRanges["panel-tga"];
  const data = filterByRange(tgaRows, range);

  const el = clearEl("chart-tga");
  if (!el) return null;

  const seriesData = data
    .filter(r => r.tga != null)
    .map(r => ({ x: r.date, y: r.tga / 1e3 })); // USD Bn

  const options = {
    chart: { type: "area", height: 520, toolbar: { show: true }, zoom: { enabled: true } },
    series: [{ name: "TGA (USD Bn)", data: seriesData }],
    xaxis: { type: "datetime" },
    yaxis: { title: { text: "TGA (USD Bn)" }, labels: { formatter: v => v.toFixed(1) } },
    dataLabels: { enabled: false },
    stroke: { curve: "straight", width: 2 },
    fill: { opacity: 0.25 },
  };

  const chart = new ApexCharts(el, options);
  chart.render();
  return chart;
}

function buildWalclChart() {
  const range = panelRanges["panel-walcl"];
  const data = filterByRange(plumbingRows, range);

  const el = clearEl("chart-walcl");
  if (!el) return null;

  const seriesData = data
    .filter(r => r.walcl != null)
    .map(r => ({ x: r.date, y: r.walcl / 1e3 })); // USD Bn

  const options = {
    chart: { type: "area", height: 520, toolbar: { show: true }, zoom: { enabled: true } },
    series: [{ name: "WALCL (USD Bn)", data: seriesData }],
    xaxis: { type: "datetime" },
    yaxis: { title: { text: "Balance Fed (USD Bn)" }, labels: { formatter: v => v.toFixed(0) } },
    dataLabels: { enabled: false },
    stroke: { curve: "straight", width: 2 },
    fill: { opacity: 0.3 },
  };

  const chart = new ApexCharts(el, options);
  chart.render();
  return chart;
}

function buildRepoChart() {
  const range = panelRanges["panel-repo"];
  const data = filterByRange(plumbingRows, range);

  const el = clearEl("chart-repo");
  if (!el) return null;

  const series = [
    { name: "TGCR", data: data.filter(r => r.tgcr != null).map(r => ({ x: r.date, y: r.tgcr * 100 })) },
    { name: "SOFR", data: data.filter(r => r.sofr != null).map(r => ({ x: r.date, y: r.sofr * 100 })) },
    { name: "ON RRP", data: data.filter(r => r.onrrp != null).map(r => ({ x: r.date, y: r.onrrp * 100 })) },
  ];

  const options = {
    chart: { type: "line", height: 520, toolbar: { show: true }, zoom: { enabled: true } },
    series,
    xaxis: { type: "datetime" },
    yaxis: { title: { text: "Tasa / % (ON RRP aprox.)" }, labels: { formatter: v => v.toFixed(2) } },
    stroke: { width: 2 },
    legend: { position: "top" },
  };

  const chart = new ApexCharts(el, options);
  chart.render();
  return chart;
}

