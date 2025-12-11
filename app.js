// app.js

let plumbingRows = [];
let tgaRows = [];
let repoRows = []; // lo tomamos desde plumbingRows (TGCR, SOFR, ONRRP), pero dejo separado por si en el futuro hay otro JSON.

let charts = {};
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

    repoRows = plumbingRows; // por ahora usamos las tasas del mismo JSON

    updateCards();
    setupTabs();
    setupRangeButtons();

    buildAllCharts();
    updateLastUpdateLabel();
  } catch (err) {
    console.error("Error inicializando dashboard:", err);
  }
});

/* ---------- Helpers básicos ---------- */

async function fetchJson(path) {
  const resp = await fetch(path);
  if (!resp.ok) {
    throw new Error(`No se pudo leer ${path}`);
  }
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

function formatBillions(x) {
  if (x == null || !Number.isFinite(x)) return "–";
  return (x / 1e3).toFixed(1) + " Bn";
}

function getLastNonNull(arr, field) {
  for (let i = arr.length - 1; i >= 0; i--) {
    const v = arr[i][field];
    if (v != null && Number.isFinite(v)) return arr[i];
  }
  return null;
}

/* ---------- Cards superiores ---------- */

function updateCards() {
  if (!plumbingRows.length) return;

  const lastSofr = getLastNonNull(plumbingRows, "sofr");
  const lastEffr = getLastNonNull(plumbingRows, "effr");
  const lastIorb = getLastNonNull(plumbingRows, "iorb");

  const sofrValue = lastSofr ? lastSofr.sofr : null;
  const effrValue = lastEffr ? lastEffr.effr : null;
  const iorbValue = lastIorb ? lastIorb.iorb : null;
  const spreadValue =
    sofrValue != null && iorbValue != null ? (sofrValue - iorbValue) * 100 : null;

  document.getElementById("card-sofr").textContent = formatPercent(sofrValue);
  document.getElementById("card-effr").textContent = formatPercent(effrValue);
  document.getElementById("card-iorb").textContent = formatPercent(iorbValue);
  document.getElementById("card-spread").textContent = formatSpreadPp(spreadValue);
}

function updateLastUpdateLabel() {
  let lastDate = null;
  if (plumbingRows.length) lastDate = plumbingRows[plumbingRows.length - 1].date;
  if (!lastDate) return;

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

/* ---------- Tabs / Paneles ---------- */

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.panel;
      if (!target || target === activePanel) return;

      document
        .querySelectorAll(".tab-button")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      document.getElementById(target).classList.add("active");

      activePanel = target;
      // reajustamos tamaño del gráfico al cambiar de panel
      Object.values(charts).forEach((ch) => ch && ch.resize());
    });
  });
}

/* ---------- Botones de rango ---------- */

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

        updateChartForPanel(panel);
      });
    });
  });
}

/* ---------- Time range helper ---------- */

function filterByRange(rows, range) {
  if (!rows.length || range === "ALL") return rows;

  const lastDate = rows[rows.length - 1].date;
  let fromDate;

  switch (range) {
    case "6M":
      fromDate = new Date(lastDate);
      fromDate.setMonth(fromDate.getMonth() - 6);
      break;
    case "1Y":
      fromDate = new Date(lastDate);
      fromDate.setFullYear(fromDate.getFullYear() - 1);
      break;
    case "3Y":
      fromDate = new Date(lastDate);
      fromDate.setFullYear(fromDate.getFullYear() - 3);
      break;
    case "5Y":
      fromDate = new Date(lastDate);
      fromDate.setFullYear(fromDate.getFullYear() - 5);
      break;
    default:
      return rows;
  }

  return rows.filter((r) => r.date >= fromDate);
}

/* ---------- Construcción de todos los gráficos ---------- */

function buildAllCharts() {
  buildSofrChart();
  buildSpreadChart();
  buildTgaChart();
  buildWalclChart();
  buildRepoChart();
}

/* ---------- 1) SOFR / EFFR / IORB ---------- */

function buildSofrChart() {
  const range = panelRanges["panel-sofr"];
  const data = filterByRange(plumbingRows, range);

  const sofrSeries = data
    .filter((r) => r.sofr != null)
    .map((r) => ({ x: r.date, y: r.sofr * 100 }));
  const effrSeries = data
    .filter((r) => r.effr != null)
    .map((r) => ({ x: r.date, y: r.effr * 100 }));
  const iorbSeries = data
    .filter((r) => r.iorb != null)
    .map((r) => ({ x: r.date, y: r.iorb * 100 }));

  const mainOptions = {
    chart: {
      id: "sofr-main",
      type: "line",
      height: 420,
      toolbar: { show: true },
      zoom: { enabled: true },
    },
    series: [
      { name: "SOFR", data: sofrSeries },
      { name: "EFFR", data: effrSeries },
      { name: "IORB", data: iorbSeries },
    ],
    xaxis: { type: "datetime" },
    yaxis: {
      title: { text: "Tasa (%)" },
      labels: { formatter: (v) => v.toFixed(2) },
    },
    stroke: { width: 2 },
    legend: { position: "top" },
  };

  const allData = plumbingRows;
  const brushSeries = [
    {
      name: "SOFR",
      data: allData
        .filter((r) => r.sofr != null)
        .map((r) => ({ x: r.date, y: r.sofr * 100 })),
    },
  ];

  const brushOptions = {
    chart: {
      id: "sofr-brush",
      type: "area",
      height: 120,
      brush: { enabled: true, target: "sofr-main" },
      selection: {
        enabled: true,
        xaxis: {
          min: data.length ? data[0].date.getTime() : undefined,
          max: data.length ? data[data.length - 1].date.getTime() : undefined,
        },
      },
    },
    series: brushSeries,
    xaxis: { type: "datetime" },
    yaxis: { labels: { show: false } },
    dataLabels: { enabled: false },
    stroke: { width: 1 },
  };

  if (charts.sofrMain) charts.sofrMain.destroy();
  if (charts.sofrBrush) charts.sofrBrush.destroy();

  charts.sofrMain = new ApexCharts(
    document.getElementById("chart-sofr-main"),
    mainOptions
  );
  charts.sofrBrush = new ApexCharts(
    document.getElementById("chart-sofr-brush"),
    brushOptions
  );

  charts.sofrMain.render();
  charts.sofrBrush.render();
}

/* ---------- 2) Spread SOFR - IORB ---------- */

function buildSpreadChart() {
  const range = panelRanges["panel-spread"];

  const withSpread = plumbingRows
    .filter((r) => r.sofr != null && r.iorb != null)
    .map((r) => ({
      date: r.date,
      spread: (r.sofr - r.iorb) * 100, // pp
    }));

  const data = filterByRange(withSpread, range);

  const seriesMain = [
    {
      name: "SOFR - IORB",
      data: data.map((r) => ({ x: r.date, y: r.spread })),
    },
  ];

  const mainOptions = {
    chart: {
      id: "spread-main",
      type: "line",
      height: 420,
      toolbar: { show: true },
      zoom: { enabled: true },
    },
    series: seriesMain,
    xaxis: { type: "datetime" },
    yaxis: {
      title: { text: "Spread (pp)" },
      labels: { formatter: (v) => v.toFixed(2) },
    },
    stroke: { width: 2, curve: "straight" },
  };

  const brushSeries = [
    {
      name: "SOFR - IORB",
      data: withSpread.map((r) => ({ x: r.date, y: r.spread })),
    },
  ];

  const brushOptions = {
    chart: {
      id: "spread-brush",
      type: "area",
      height: 120,
      brush: { enabled: true, target: "spread-main" },
      selection: {
        enabled: true,
        xaxis: {
          min: data.length ? data[0].date.getTime() : undefined,
          max: data.length ? data[data.length - 1].date.getTime() : undefined,
        },
      },
    },
    series: brushSeries,
    xaxis: { type: "datetime" },
    yaxis: { labels: { show: false } },
    dataLabels: { enabled: false },
    stroke: { width: 1 },
  };

  if (charts.spreadMain) charts.spreadMain.destroy();
  if (charts.spreadBrush) charts.spreadBrush.destroy();

  charts.spreadMain = new ApexCharts(
    document.getElementById("chart-spread-main"),
    mainOptions
  );
  charts.spreadBrush = new ApexCharts(
    document.getElementById("chart-spread-brush"),
    brushOptions
  );

  charts.spreadMain.render();
  charts.spreadBrush.render();
}

/* ---------- 3) TGA ---------- */

function buildTgaChart() {
  const range = panelRanges["panel-tga"];
  const data = filterByRange(tgaRows, range);

  const seriesMain = [
    {
      name: "TGA",
      data: data
        .filter((r) => r.tga != null)
        .map((r) => ({ x: r.date, y: r.tga / 1e3 })), // en Bn
    },
  ];

  const mainOptions = {
    chart: {
      id: "tga-main",
      type: "area",
      height: 420,
      toolbar: { show: true },
      zoom: { enabled: true },
    },
    series: seriesMain,
    xaxis: { type: "datetime" },
    yaxis: {
      title: { text: "TGA (USD Bn)" },
      labels: { formatter: (v) => v.toFixed(1) },
    },
    dataLabels: { enabled: false },
    stroke: { curve: "straight", width: 2 },
    fill: { opacity: 0.3 },
  };

  const brushSeries = [
    {
      name: "TGA",
      data: tgaRows
        .filter((r) => r.tga != null)
        .map((r) => ({ x: r.date, y: r.tga / 1e3 })),
    },
  ];

  const brushOptions = {
    chart: {
      id: "tga-brush",
      type: "area",
      height: 120,
      brush: { enabled: true, target: "tga-main" },
      selection: {
        enabled: true,
        xaxis: {
          min: data.length ? data[0].date.getTime() : undefined,
          max: data.length ? data[data.length - 1].date.getTime() : undefined,
        },
      },
    },
    series: brushSeries,
    xaxis: { type: "datetime" },
    yaxis: { labels: { show: false } },
    dataLabels: { enabled: false },
  };

  if (charts.tgaMain) charts.tgaMain.destroy();
  if (charts.tgaBrush) charts.tgaBrush.destroy();

  charts.tgaMain = new ApexCharts(
    document.getElementById("chart-tga-main"),
    mainOptions
  );
  charts.tgaBrush = new ApexCharts(
    document.getElementById("chart-tga-brush"),
    brushOptions
  );

  charts.tgaMain.render();
  charts.tgaBrush.render();
}

/* ---------- 4) WALCL ---------- */

function buildWalclChart() {
  const range = panelRanges["panel-walcl"];
  const data = filterByRange(plumbingRows, range);

  const seriesMain = [
    {
      name: "WALCL",
      data: data
        .filter((r) => r.walcl != null)
        .map((r) => ({ x: r.date, y: r.walcl / 1e3 })), // Bn
    },
  ];

  const mainOptions = {
    chart: {
      id: "walcl-main",
      type: "area",
      height: 420,
      toolbar: { show: true },
      zoom: { enabled: true },
    },
    series: seriesMain,
    xaxis: { type: "datetime" },
    yaxis: {
      title: { text: "Balance Fed (USD Bn)" },
      labels: { formatter: (v) => v.toFixed(0) },
    },
    stroke: { curve: "straight", width: 2 },
    fill: { opacity: 0.4 },
    dataLabels: { enabled: false },
  };

  const brushSeries = [
    {
      name: "WALCL",
      data: plumbingRows
        .filter((r) => r.walcl != null)
        .map((r) => ({ x: r.date, y: r.walcl / 1e3 })),
    },
  ];

  const brushOptions = {
    chart: {
      id: "walcl-brush",
      type: "area",
      height: 120,
      brush: { enabled: true, target: "walcl-main" },
      selection: {
        enabled: true,
        xaxis: {
          min: data.length ? data[0].date.getTime() : undefined,
          max: data.length ? data[data.length - 1].date.getTime() : undefined,
        },
      },
    },
    series: brushSeries,
    xaxis: { type: "datetime" },
    yaxis: { labels: { show: false } },
    dataLabels: { enabled: false },
  };

  if (charts.walclMain) charts.walclMain.destroy();
  if (charts.walclBrush) charts.walclBrush.destroy();

  charts.walclMain = new ApexCharts(
    document.getElementById("chart-walcl-main"),
    mainOptions
  );
  charts.walclBrush = new ApexCharts(
    document.getElementById("chart-walcl-brush"),
    brushOptions
  );

  charts.walclMain.render();
  charts.walclBrush.render();
}

/* ---------- 5) Repo & RRP ---------- */

function buildRepoChart() {
  const range = panelRanges["panel-repo"];
  const data = filterByRange(repoRows, range);

  const tgcrSeries = data
    .filter((r) => r.tgcr != null)
    .map((r) => ({ x: r.date, y: r.tgcr * 100 }));
  const sofrSeries = data
    .filter((r) => r.sofr != null)
    .map((r) => ({ x: r.date, y: r.sofr * 100 }));
  const onrrpSeries = data
    .filter((r) => r.onrrp != null)
    .map((r) => ({ x: r.date, y: r.onrrp * 100 }));

  const mainOptions = {
    chart: {
      id: "repo-main",
      type: "line",
      height: 420,
      toolbar: { show: true },
      zoom: { enabled: true },
    },
    series: [
      { name: "TGCR", data: tgcrSeries },
      { name: "SOFR", data: sofrSeries },
      { name: "ON RRP", data: onrrpSeries },
    ],
    xaxis: { type: "datetime" },
    yaxis: {
      title: { text: "Tasa (%)" },
      labels: { formatter: (v) => v.toFixed(2) },
    },
    stroke: { width: 2 },
    legend: { position: "top" },
  };

  const brushSeries = [
    {
      name: "TGCR",
      data: repoRows
        .filter((r) => r.tgcr != null)
        .map((r) => ({ x: r.date, y: r.tgcr * 100 })),
    },
  ];

  const brushOptions = {
    chart: {
      id: "repo-brush",
      type: "area",
      height: 120,
      brush: { enabled: true, target: "repo-main" },
      selection: {
        enabled: true,
        xaxis: {
          min: data.length ? data[0].date.getTime() : undefined,
          max: data.length ? data[data.length - 1].date.getTime() : undefined,
        },
      },
    },
    series: brushSeries,
    xaxis: { type: "datetime" },
    yaxis: { labels: { show: false } },
    dataLabels: { enabled: false },
    stroke: { width: 1 },
  };

  if (charts.repoMain) charts.repoMain.destroy();
  if (charts.repoBrush) charts.repoBrush.destroy();

  charts.repoMain = new ApexCharts(
    document.getElementById("chart-repo-main"),
    mainOptions
  );
  charts.repoBrush = new ApexCharts(
    document.getElementById("chart-repo-brush"),
    brushOptions
  );

  charts.repoMain.render();
  charts.repoBrush.render();
}

/* ---------- Actualizar un panel cuando cambiás rango ---------- */

function updateChartForPanel(panelId) {
  switch (panelId) {
    case "panel-sofr":
      buildSofrChart();
      break;
    case "panel-spread":
      buildSpreadChart();
      break;
    case "panel-tga":
      buildTgaChart();
      break;
    case "panel-walcl":
      buildWalclChart();
      break;
    case "panel-repo":
      buildRepoChart();
      break;
  }
}
