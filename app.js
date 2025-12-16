// app.js – versión simplificada: 1 gráfico por pestaña, sin brush

let plumbingRows = [];
let tgaRows = [];

const charts = {};          // charts[panelId]
let activePanel = "panel-sofr";

function normalizePlumbing(plumbJson) {
  if (!plumbJson || !plumbJson.series || !plumbJson.series.SOFR) {
    throw new Error("Formato inesperado de plumbing_data.json");
  }

  const s = plumbJson.series;

  const dates = s.SOFR.dates;
  const sofrVals = s.SOFR.values;
  const effrVals = s.EFFR?.values ?? [];
  const iorbVals = s.IORB?.values ?? [];
  const walclVals = s.WALCL?.values ?? [];
  const tgcrVals  = s.TGCR?.values ?? [];
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

  return rows.filter(r => r.date instanceof Date && !isNaN(r.date));
}

const panelRanges = {
  "panel-sofr": "6M",
  "panel-spread": "6M",
  "panel-tga": "6M",
  "panel-walcl": "3Y",
  "panel-repo": "6M",
};

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const [plumbData, tgaData] = await Promise.all([
      fetchJson("data/plumbing_data.json"),
      fetchJson("data/tga_data.json").catch(() => []),
    ]);

    // Normalizamos
    plumbingRows = plumbData
      .map((row) => ({
        date: new Date(row.date),
        sofr: toNumber(row.SOFR ?? row.sofr),
        effr: toNumber(row.EFFR ?? row.effr),
        iorb: toNumber(row.IORB ?? row.iorb),
        walcl: toNumber(row.WALCL ?? row.walcl),
        tgcr: toNumber(row.TGCR ?? row.tgcr),
        onrrp: toNumber(row.ONRRP ?? row.onrrp),
      }))
      .sort((a, b) => a.date - b.date);

    tgaRows = tgaData
      .map((row) => ({
        date: new Date(row.date),
        tga: toNumber(row.TGA ?? row.tga),
      }))
      .sort((a, b) => a.date - b.date);

    updateCards();
    setupTabs();
    setupRangeButtons();

    // construimos sólo el panel inicial
    buildChartForPanel(activePanel);

    updateLastUpdateLabel();
  } catch (err) {
    console.error("Error inicializando dashboard:", err);
  }
});

/* ---------- Helpers ---------- */

async function fetchJson(path) {
  const resp = await fetch(path);
  if (!resp.ok) throw new Error(`No se pudo leer ${path}`);
  return resp.json();
}

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

function updateCards() {
  if (!plumbingRows.length) return;

  const lastSofr = getLastNonNull(plumbingRows, "sofr");
  const lastEffr = getLastNonNull(plumbingRows, "effr");
  const lastIorb = getLastNonNull(plumbingRows, "iorb");

  const vSofr = lastSofr ? lastSofr.sofr : null;
  const vEffr = lastEffr ? lastEffr.effr : null;
  const vIorb = lastIorb ? lastIorb.iorb : null;
  const spread = vSofr != null && vIorb != null ? (vSofr - vIorb) * 100 : null;

  document.getElementById("card-sofr").textContent = formatPercent(vSofr);
  document.getElementById("card-effr").textContent = formatPercent(vEffr);
  document.getElementById("card-iorb").textContent = formatPercent(vIorb);
  document.getElementById("card-spread").textContent = formatSpreadPp(spread);
}

function updateLastUpdateLabel() {
  if (!plumbingRows.length) return;
  const lastDate = plumbingRows[plumbingRows.length - 1].date;

  const utc = new Date(
    Date.UTC(
      lastDate.getUTCFullYear(),
      lastDate.getUTCMonth(),
      lastDate.getUTCDate(),
      lastDate.getUTCHours(),
      lastDate.getUTCMinutes(),
      lastDate.getUTCSeconds()
    )
  );

  const label =
    utc.getUTCFullYear() +
    "-" +
    String(utc.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(utc.getUTCDate()).padStart(2, "0") +
    " " +
    String(utc.getUTCHours()).padStart(2, "0") +
    ":" +
    String(utc.getUTCMinutes()).padStart(2, "0") +
    " UTC";

  document.getElementById("last-update").textContent =
    "Última actualización (UTC): " + label;
}

/* ---------- Tabs ---------- */

function setupTabs() {
  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = btn.dataset.panel;
      if (!panel || panel === activePanel) return;

      document
        .querySelectorAll(".tab-button")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      document.getElementById(panel).classList.add("active");

      activePanel = panel;
      buildChartForPanel(panel);
    });
  });
}

/* ---------- Rangos ---------- */

function setupRangeButtons() {
  document.querySelectorAll(".range-buttons").forEach((group) => {
    const panel = group.dataset.panel;
    group.querySelectorAll(".range-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const range = btn.dataset.range;
        if (!range) return;
        panelRanges[panel] = range;

        group.querySelectorAll(".range-btn").forEach((b) =>
          b.classList.remove("active")
        );
        btn.classList.add("active");

        if (panel === activePanel) buildChartForPanel(panel);
      });
    });
  });
}

function filterByRange(rows, range) {
  if (!rows.length || range === "ALL") return rows;

  const lastDate = rows[rows.length - 1].date;
  let from = new Date(lastDate);

  switch (range) {
    case "6M":
      from.setMonth(from.getMonth() - 6);
      break;
    case "1Y":
      from.setFullYear(from.getFullYear() - 1);
      break;
    case "3Y":
      from.setFullYear(from.getFullYear() - 3);
      break;
    case "5Y":
      from.setFullYear(from.getFullYear() - 5);
      break;
    default:
      return rows;
  }
  return rows.filter((r) => r.date >= from);
}

/* ---------- Construcción de gráficos ---------- */

function buildChartForPanel(panelId) {
  // destruimos si ya existe
  if (charts[panelId]) {
    charts[panelId].destroy();
    charts[panelId] = null;
  }

  switch (panelId) {
    case "panel-sofr":
      charts[panelId] = buildSofrChart();
      break;
    case "panel-spread":
      charts[panelId] = buildSpreadChart();
      break;
    case "panel-tga":
      charts[panelId] = buildTgaChart();
      break;
    case "panel-walcl":
      charts[panelId] = buildWalclChart();
      break;
    case "panel-repo":
      charts[panelId] = buildRepoChart();
      break;
  }
}

/* ---- 1) SOFR / EFFR / IORB ---- */

function buildSofrChart() {
  const range = panelRanges["panel-sofr"];
  const data = filterByRange(plumbingRows, range);

  const series = [
    {
      name: "SOFR",
      data: data
        .filter((r) => r.sofr != null)
        .map((r) => ({ x: r.date, y: r.sofr * 100 })),
    },
    {
      name: "EFFR",
      data: data
        .filter((r) => r.effr != null)
        .map((r) => ({ x: r.date, y: r.effr * 100 })),
    },
    {
      name: "IORB",
      data: data
        .filter((r) => r.iorb != null)
        .map((r) => ({ x: r.date, y: r.iorb * 100 })),
    },
  ];

  const options = {
    chart: {
      type: "line",
      height: 460,
      toolbar: { show: true },
      zoom: { enabled: true },
    },
    series,
    xaxis: { type: "datetime" },
    yaxis: {
      title: { text: "Tasa (%)" },
      labels: { formatter: (v) => v.toFixed(2) },
    },
    stroke: { width: 2 },
    legend: { position: "top" },
  };

  const el = document.getElementById("chart-sofr");
  const chart = new ApexCharts(el, options);
  chart.render();
  return chart;
}

/* ---- 2) Spread SOFR - IORB ---- */

function buildSpreadChart() {
  const range = panelRanges["panel-spread"];
  const withSpread = plumbingRows
    .filter((r) => r.sofr != null && r.iorb != null)
    .map((r) => ({
      date: r.date,
      spread: (r.sofr - r.iorb) * 100, // puntos básicos
    }));

  const data = filterByRange(withSpread, range);

  const options = {
    chart: {
      type: "line",
      height: 460,
      toolbar: { show: true },
      zoom: { enabled: true },
    },
    series: [
      {
        name: "SOFR - IORB",
        data: data.map((r) => ({ x: r.date, y: r.spread })),
      },
    ],
    xaxis: { type: "datetime" },
    yaxis: {
      title: { text: "Spread (pp)" },
      labels: { formatter: (v) => v.toFixed(2) },
    },
    stroke: { width: 2 },
  };

  const el = document.getElementById("chart-spread");
  const chart = new ApexCharts(el, options);
  chart.render();
  return chart;
}

/* ---- 3) TGA ---- */

function buildTgaChart() {
  const range = panelRanges["panel-tga"];
  const data = filterByRange(tgaRows, range);

  const options = {
    chart: {
      type: "area",
      height: 460,
      toolbar: { show: true },
      zoom: { enabled: true },
    },
    series: [
      {
        name: "TGA",
        data: data
          .filter((r) => r.tga != null)
          .map((r) => ({ x: r.date, y: r.tga / 1e3 })), // Bn
      },
    ],
    xaxis: { type: "datetime" },
    yaxis: {
      title: { text: "TGA (USD Bn)" },
      labels: { formatter: (v) => v.toFixed(1) },
    },
    dataLabels: { enabled: false },
    stroke: { curve: "straight", width: 2 },
    fill: { opacity: 0.3 },
  };

  const el = document.getElementById("chart-tga");
  const chart = new ApexCharts(el, options);
  chart.render();
  return chart;
}

/* ---- 4) WALCL ---- */

function buildWalclChart() {
  const range = panelRanges["panel-walcl"];
  const data = filterByRange(plumbingRows, range);

  const options = {
    chart: {
      type: "area",
      height: 460,
      toolbar: { show: true },
      zoom: { enabled: true },
    },
    series: [
      {
        name: "WALCL",
        data: data
          .filter((r) => r.walcl != null)
          .map((r) => ({ x: r.date, y: r.walcl / 1e3 })), // Bn
      },
    ],
    xaxis: { type: "datetime" },
    yaxis: {
      title: { text: "Balance Fed (USD Bn)" },
      labels: { formatter: (v) => v.toFixed(0) },
    },
    dataLabels: { enabled: false },
    stroke: { curve: "straight", width: 2 },
    fill: { opacity: 0.4 },
  };

  const el = document.getElementById("chart-walcl");
  const chart = new ApexCharts(el, options);
  chart.render();
  return chart;
}

/* ---- 5) Repo & RRP ---- */

function buildRepoChart() {
  const range = panelRanges["panel-repo"];
  const data = filterByRange(plumbingRows, range);

  const options = {
    chart: {
      type: "line",
      height: 460,
      toolbar: { show: true },
      zoom: { enabled: true },
    },
    series: [
      {
        name: "TGCR",
        data: data
          .filter((r) => r.tgcr != null)
          .map((r) => ({ x: r.date, y: r.tgcr * 100 })),
      },
      {
        name: "SOFR",
        data: data
          .filter((r) => r.sofr != null)
          .map((r) => ({ x: r.date, y: r.sofr * 100 })),
      },
      {
        name: "ON RRP",
        data: data
          .filter((r) => r.onrrp != null)
          .map((r) => ({ x: r.date, y: r.onrrp * 100 })),
      },
    ],
    xaxis: { type: "datetime" },
    yaxis: {
      title: { text: "Tasa (%)" },
      labels: { formatter: (v) => v.toFixed(2) },
    },
    stroke: { width: 2 },
    legend: { position: "top" },
  };

  const el = document.getElementById("chart-repo");
  const chart = new ApexCharts(el, options);
  chart.render();
  return chart;
}
