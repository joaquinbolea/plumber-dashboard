// ==============================
//  Helpers generales de carga
// ==============================

// Carga principal (plumbing_data.json)
async function loadData() {
  try {
    const res = await fetch("data/plumbing_data.json");
    if (!res.ok) {
      console.error("No se pudo cargar plumbing_data.json:", res.status);
      return null;
    }
    const data = await res.json();
    console.log(
      "plumbing_data.json cargado, series:",
      Object.keys(data.series || {})
    );
    return data;
  } catch (err) {
    console.error("Error cargando plumbing_data.json:", err);
    return null;
  }
}

// Carga TGA
async function loadTgaData() {
  try {
    const res = await fetch("data/tga_data.json");
    if (!res.ok) {
      console.warn("No se pudo cargar tga_data.json:", res.status);
      return null;
    }
    const data = await res.json();
    console.log("tga_data.json cargado, series:", Object.keys(data.series || {}));
    return data;
  } catch (err) {
    console.error("Error cargando tga_data.json:", err);
    return null;
  }
}

// Carga Repo / RRP
async function loadRepoData() {
  try {
    const res = await fetch("data/repo.json");
    if (!res.ok) {
      console.warn("No se pudo cargar repo.json:", res.status);
      return null;
    }
    const data = await res.json();
    console.log("repo.json cargado, series:", Object.keys(data.series || {}));
    return data;
  } catch (err) {
    console.error("Error cargando repo.json:", err);
    return null;
  }
}

// Devuelve la primera serie que exista en una lista de claves
function getSeries(seriesObj, keys) {
  if (!seriesObj) return null;
  for (const k of keys) {
    if (seriesObj[k]) return seriesObj[k];
  }
  return null;
}

// Para el eje Y de tasas: rango [min, max] + padding
function computeRateRange(seriesObj, keys, padding) {
  const all = [];
  keys.forEach((k) => {
    const s = seriesObj[k];
    if (s && Array.isArray(s.values)) {
      s.values.forEach((v) => {
        if (typeof v === "number" && !isNaN(v)) {
          all.push(v);
        }
      });
    }
  });

  if (all.length === 0) return null;

  const min = Math.min(...all);
  const max = Math.max(...all);
  return [min - padding, max + padding];
}

// Líneas verticales para cierres de mes / trimestre
function buildMonthQuarterEndShapes(dateStrings) {
  if (!dateStrings || dateStrings.length === 0) return [];

  const firstDate = new Date(dateStrings[0]);
  const lastDate = new Date(dateStrings[dateStrings.length - 1]);

  const shapes = [];
  const d = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);

  while (d <= lastDate) {
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const iso = monthEnd.toISOString().slice(0, 10);
    const isQuarterEnd = [2, 5, 8, 11].includes(monthEnd.getMonth());

    shapes.push({
      type: "line",
      xref: "x",
      yref: "paper",
      x0: iso,
      x1: iso,
      y0: 0,
      y1: 1,
      line: {
        width: isQuarterEnd ? 2 : 1,
        color: isQuarterEnd
          ? "rgba(180, 52, 24, 0.6)"
          : "rgba(0,0,0,0.15)",
        dash: isQuarterEnd ? "solid" : "dot",
      },
      layer: isQuarterEnd ? "above" : "below",
    });

    d.setMonth(d.getMonth() + 1);
  }

  return shapes;
}

// ==============================
//  Cards de arriba
// ==============================

function setCards(data) {
  if (!data || !data.series) return;

  const s = data.series;

  const sofr = getSeries(s, ["SOFR"]);
  const effr = getSeries(s, ["EFFR"]);
  const iorb = getSeries(s, ["IORB"]);

  const last = (serie) => {
    if (!serie || !serie.values || serie.values.length === 0) return null;
    return serie.values[serie.values.length - 1];
  };

  const sofrLast = last(sofr);
  const effrLast = last(effr);
  const iorbLast = last(iorb);
  const spreadLast =
    sofrLast != null && iorbLast != null ? sofrLast - iorbLast : null;

  const setCardText = (id, val, suffix) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (val == null || isNaN(val)) {
      el.textContent = "-";
      return;
    }
    el.textContent = val.toFixed(2) + (suffix || "");
  };

  setCardText("card-sofr", sofrLast, " %");
  setCardText("card-effr", effrLast, " %");
  setCardText("card-iorb", iorbLast, " %");
  setCardText("card-spread", spreadLast, " pp");
}

// ==============================
//  Gráfico 1: SOFR vs EFFR vs IORB
// ==============================

function plotFunding(data) {
  if (!data || !data.series) return;
  const s = data.series;

  const sofr = getSeries(s, ["SOFR"]);
  const effr = getSeries(s, ["EFFR"]);
  const iorb = getSeries(s, ["IORB"]);

  if (!sofr || !effr || !iorb) {
    console.error("Faltan series para plotFunding");
    return;
  }

  const traceSOFR = {
    x: sofr.dates,
    y: sofr.values,
    name: "SOFR",
    mode: "lines",
  };

  const traceEFFR = {
    x: effr.dates,
    y: effr.values,
    name: "EFFR",
    mode: "lines",
  };

  const traceIORB = {
    x: iorb.dates,
    y: iorb.values,
    name: "IORB",
    mode: "lines",
  };

  const yRange = computeRateRange(s, ["SOFR", "EFFR", "IORB"], 0.15);

  const layout = {
    margin: { t: 30, r: 40 },
    legend: { orientation: "h" },
    xaxis: {
      type: "date",
      rangeselector: {
        buttons: [
          { count: 1, label: "1M", step: "month", stepmode: "backward" },
          { count: 3, label: "3M", step: "month", stepmode: "backward" },
          { count: 6, label: "6M", step: "month", stepmode: "backward" },
          { count: 1, label: "1A", step: "year", stepmode: "backward" },
          { step: "all", label: "Todos" },
        ],
      },
      rangeslider: { visible: true },
    },
    yaxis: {
      title: "Tasa (%)",
      range: yRange || undefined,
    },
    shapes: buildMonthQuarterEndShapes(sofr.dates),
  };

  Plotly.newPlot("chart-funding", [traceSOFR, traceEFFR, traceIORB], layout);
}

// ==============================
//  Gráfico 2: Spread SOFR - IORB
// ==============================

function plotSpread(data) {
  if (!data || !data.series) return;

  const s = data.series;
  const sofr = getSeries(s, ["SOFR"]);
  const iorb = getSeries(s, ["IORB"]);

  if (!sofr || !iorb) {
    console.error("Faltan series para plotSpread");
    return;
  }

  const dates = [];
  const spread = [];

  const n = Math.min(sofr.dates.length, iorb.dates.length);

  for (let i = 0; i < n; i++) {
    const dS = sofr.dates[i];
    const dI = iorb.dates[i];
    if (dS === dI) {
      dates.push(dS);
      spread.push(sofr.values[i] - iorb.values[i]);
    }
  }

  const traceSpread = {
    x: dates,
    y: spread,
    name: "SOFR - IORB",
    mode: "lines",
  };

  const layout = {
    margin: { t: 30, r: 40 },
    legend: { orientation: "h" },
    xaxis: {
      type: "date",
      rangeselector: {
        buttons: [
          { count: 1, label: "1M", step: "month", stepmode: "backward" },
          { count: 3, label: "3M", step: "month", stepmode: "backward" },
          { count: 6, label: "6M", step: "month", stepmode: "backward" },
          { count: 1, label: "1A", step: "year", stepmode: "backward" },
          { step: "all", label: "Todos" },
        ],
      },
      rangeslider: { visible: true },
    },
    yaxis: {
      title: "Spread (pp)",
    },
  };

  Plotly.newPlot("chart-spread", [traceSpread], layout);
}

// ==============================
//  Gráfico 3: TGA
// ==============================

function plotTGA(tgaData) {
  if (!tgaData || !tgaData.series) return;

  const s = tgaData.series;
  const tga = getSeries(s, ["TGA", "WTREGEN"]); // por las dudas

  if (!tga) {
    console.error("No se encontró la serie TGA en tga_data.json");
    return;
  }

  const traceTGA = {
    x: tga.dates,
    y: tga.values,
    name: "TGA (USD bn)",
    type: "scatter",
    fill: "tozeroy",
  };

  const layout = {
    margin: { t: 30, r: 40 },
    legend: { orientation: "h" },
    xaxis: {
      type: "date",
      rangeselector: {
        buttons: [
          { count: 1, label: "1M", step: "month", stepmode: "backward" },
          { count: 3, label: "3M", step: "month", stepmode: "backward" },
          { count: 6, label: "6M", step: "month", stepmode: "backward" },
          { count: 1, label: "1A", step: "year", stepmode: "backward" },
          { step: "all", label: "Todos" },
        ],
      },
      rangeslider: { visible: true },
    },
    yaxis: {
      title: "TGA (USD bn)",
    },
  };

  Plotly.newPlot("chart-tga", [traceTGA], layout);
}

// ==============================
//  Gráfico 4: Balance de la Fed (WALCL)
// ==============================

function plotBalance(data) {
  if (!data || !data.series) return;
  const s = data.series;

  const walcl = getSeries(s, ["WALCL"]);

  if (!walcl) {
    console.error("No se encontró WALCL en plumbing_data.json");
    return;
  }

  const traceBal = {
    x: walcl.dates,
    y: walcl.values,
    name: "Balance de la Fed (USD bn)",
    type: "scatter",
    fill: "tozeroy",
  };

  const layout = {
    margin: { t: 30, r: 40 },
    legend: { orientation: "h" },
    xaxis: {
      type: "date",
      rangeselector: {
        buttons: [
          { count: 1, label: "1M", step: "month", stepmode: "backward" },
          { count: 3, label: "3M", step: "month", stepmode: "backward" },
          { count: 6, label: "6M", step: "month", stepmode: "backward" },
          { count: 1, label: "1A", step: "year", stepmode: "backward" },
          { step: "all", label: "Todos" },
        ],
      },
      rangeslider: { visible: true },
    },
    yaxis: {
      title: "Balance Fed (USD bn)",
    },
  };

  Plotly.newPlot("chart-balance", [traceBal], layout);
}

// ==============================
//  Gráfico 5: Repo & RRP (TGCR, SOFR, ON RRP)
// ==============================

function plotRepo(mainData, repoData) {
  const container = document.getElementById("chart-repo");
  if (!container) {
    console.error("No existe el contenedor chart-repo");
    return;
  }

  if (!repoData || !repoData.series) {
    console.error("repoData vacío o sin series");
    container.innerHTML =
      "<p style='color:#b42318'>No se pudo cargar repo.json</p>";
    return;
  }

  const sRepo = repoData.series;
  const sMain = mainData.series || {};

  const tgcr = sRepo.TGCRRATE;
  const rrpVol = sRepo.RRPONTSYD;
  const rrpRate = sRepo.RRPONTSYAWARD;
  const sofr = getSeries(sMain, ["SOFR"]);

  if (!tgcr || !rrpVol || !rrpRate) {
    console.error("Faltan series en repo.json", Object.keys(sRepo));
    container.innerHTML =
      "<p style='color:#b42318'>Faltan series de repo en repo.json</p>";
    return;
  }

  const traceTGCR = {
    x: tgcr.dates,
    y: tgcr.values,
    name: "TGCR (repo GC)",
    mode: "lines",
    yaxis: "y1",
  };

  const traceRRPRate = {
    x: rrpRate.dates,
    y: rrpRate.values,
    name: "ON RRP rate",
    mode: "lines",
    yaxis: "y1",
  };

  const traces = [traceTGCR, traceRRPRate];

  if (sofr && sofr.dates && sofr.values) {
    traces.push({
      x: sofr.dates,
      y: sofr.values,
      name: "SOFR",
      mode: "lines",
      yaxis: "y1",
    });
  }

  const traceRRPVol = {
    x: rrpVol.dates,
    y: rrpVol.values,
    name: "ON RRP volumen (USD bn)",
    type: "bar",
    opacity: 0.3,
    yaxis: "y2",
  };

  traces.push(traceRRPVol);

  const layout = {
    barmode: "overlay",
    margin: { t: 30, r: 60 },
    legend: { orientation: "h" },
    xaxis: {
      type: "date",
      rangeselector: {
        buttons: [
          { count: 1, label: "1M", step: "month", stepmode: "backward" },
          { count: 3, label: "3M", step: "month", stepmode: "backward" },
          { count: 6, label: "6M", step: "month", stepmode: "backward" },
          { count: 1, label: "1A", step: "year", stepmode: "backward" },
          { step: "all", label: "Todos" },
        ],
      },
      rangeslider: { visible: true },
    },
    yaxis: {
      title: "Tasa (%)",
      side: "left",
    },
    yaxis2: {
      title: "ON RRP volumen (USD bn)",
      overlaying: "y",
      side: "right",
      showgrid: false,
    },
  };

  Plotly.newPlot("chart-repo", traces, layout);
}

// ==============================
//  Navegación entre gráficos
// ==============================

const CHARTS = ["funding", "spread", "tga", "balance", "repo"];

function setActiveChart(name) {
  CHARTS.forEach((ch) => {
    const panel = document.getElementById("panel-" + ch);
    const btn = document.getElementById("btn-" + ch);
    const isActive = ch === name;

    if (panel) {
      panel.classList.toggle("active", isActive);
    }
    if (btn) {
      btn.classList.toggle("active", isActive);
    }
  });
}

// ==============================
//  Init
// ==============================

async function init() {
  try {
    const [mainData, tgaData, repoData] = await Promise.all([
      loadData(),
      loadTgaData(),
      loadRepoData(),
    ]);

    if (!mainData) return;

    const lastUpdatedEl = document.getElementById("last-updated");
    if (lastUpdatedEl) {
      lastUpdatedEl.textContent =
        "Última actualización (UTC): " + mainData.last_updated_utc;
    }

    setCards(mainData);
    plotFunding(mainData);
    plotSpread(mainData);

    if (tgaData) {
      plotTGA(tgaData);
    }

    plotBalance(mainData);

    if (repoData) {
      plotRepo(mainData, repoData);
    }

    // Por defecto mostramos el gráfico de tasas
    setActiveChart("funding");
  } catch (err) {
    console.error("Error inicializando dashboard:", err);
  }
}

init();
