// --------- Carga de datos principales (plumbing_data.json) ---------

async function loadData() {
  const res = await fetch("data/plumbing_data.json");
  if (!res.ok) {
    console.error("No se pudo cargar plumbing_data.json", res.status);
    return null;
  }
  const data = await res.json();
  console.log("Series main:", Object.keys(data.series));
  return data;
}

// --------- Carga de datos de TGA (tga.json) ---------

async function loadTgaData() {
  const res = await fetch("data/tga.json");
  if (!res.ok) {
    console.error("No se pudo cargar tga.json", res.status);
    return null;
  }
  const data = await res.json();
  console.log("Series TGA:", Object.keys(data.series));
  return data;
}
async function loadRepoData() {
  try {
    const res = await fetch("data/repo.json");
    if (!res.ok) {
      console.error("No se pudo cargar repo.json:", res.status);
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

// --------- Helpers ---------

function last(arr) {
  return arr[arr.length - 1];
}

// Busca la primera serie existente entre los nombres dados
function getSeries(seriesObj, preferredNames) {
  for (const name of preferredNames) {
    if (seriesObj[name]) {
      return seriesObj[name];
    }
  }
  console.error("No se encontró ninguna de las series:", preferredNames);
  return null;
}

// --------- Tarjetas superiores (SOFR / EFFR / IORB / Spread) ---------

function setCards(data) {
  const s = data.series;

  const sofr   = getSeries(s, ["SOFR"]);
  const effr   = getSeries(s, ["EFFR", "FEDFUNDS"]);
  const iorb   = getSeries(s, ["IORB"]);
  const spread = getSeries(s, ["SOFR_minus_IORB"]);

  if (!sofr || !effr || !iorb || !spread) {
    console.error("Faltan series para armar las cards");
    return;
  }

  const sofrLast   = last(sofr.values).toFixed(2);
  const effrLast   = last(effr.values).toFixed(2);
  const iorbLast   = last(iorb.values).toFixed(2);
  const spreadLast = last(spread.values).toFixed(2);

  document.getElementById("card-sofr").innerHTML =
    `<h3>SOFR</h3><p>${sofrLast} %</p>`;
  document.getElementById("card-effr").innerHTML =
    `<h3>EFFR</h3><p>${effrLast} %</p>`;
  document.getElementById("card-iorb").innerHTML =
    `<h3>IORB</h3><p>${iorbLast} %</p>`;
  document.getElementById("card-spread").innerHTML =
    `<h3>SOFR - IORB</h3><p>${spreadLast} pp</p>`;
}

// --------- Gráfico SOFR vs EFFR/FEDFUNDS vs IORB ---------

function plotFunding(data) {
  const s = data.series;

  const sofr = getSeries(s, ["SOFR"]);
  const effr = getSeries(s, ["EFFR", "FEDFUNDS"]);
  const iorb = getSeries(s, ["IORB"]);

  if (!sofr || !effr || !iorb) {
    console.error("Faltan series para el gráfico de funding");
    return;
  }

  const traceSOFR = {
    x: sofr.dates,
    y: sofr.values,
    name: "SOFR",
    mode: "lines"
  };
  const traceEFFR = {
    x: effr.dates,
    y: effr.values,
    name: "EFFR",
    mode: "lines"
  };
  const traceIORB = {
    x: iorb.dates,
    y: iorb.values,
    name: "IORB",
    mode: "lines"
  };

  const layout = {
    margin: { t: 30 },
    legend: { orientation: "h" },
    yaxis: { title: "Tasa (%)" },
    xaxis: {
      type: "date",
      rangeselector: {
        buttons: [
          { count: 5,  label: "5D",  step: "day",   stepmode: "backward" },
          { count: 1,  label: "1M",  step: "month", stepmode: "backward" },
          { count: 3,  label: "3M",  step: "month", stepmode: "backward" },
          { count: 6,  label: "6M",  step: "month", stepmode: "backward" },
          { count: 1,  label: "YTD", step: "year",  stepmode: "todate"   },
          { count: 1,  label: "1A",  step: "year",  stepmode: "backward" },
          { count: 5,  label: "5A",  step: "year",  stepmode: "backward" },
          { step: "all", label: "Todos" }
        ]
      },
      rangeslider: { visible: true }
    }
  };

  Plotly.newPlot("chart-funding", [traceSOFR, traceEFFR, traceIORB], layout);
}

// --------- Gráfico TGA (tga.json separado) ---------

function plotTGA(tgaData) {
  if (!tgaData || !tgaData.series || !tgaData.series.TGA) {
    console.error("No hay datos de TGA para graficar");
    return;
  }

  const tga = tgaData.series.TGA;

  const trace = {
    x: tga.dates,
    y: tga.values.map(v => v / 1000), // millones -> miles de millones
    name: "TGA",
    mode: "lines",
    fill: "tozeroy"
  };

  const layout = {
    margin: { t: 30 },
    yaxis: { title: "TGA (USD bn)" },
    xaxis: {
      type: "date",
      rangeselector: {
        buttons: [
          { count: 1,  label: "1A",  step: "year",  stepmode: "backward" },
          { count: 3,  label: "3A",  step: "year",  stepmode: "backward" },
          { count: 5,  label: "5A",  step: "year",  stepmode: "backward" },
          { step: "all", label: "Todos" }
        ]
      },
      rangeslider: { visible: true }
    }
  };

  Plotly.newPlot("chart-tga", [trace], layout);
}

// --------- Gráfico Balance Fed (WALCL) ---------

function plotBalance(data) {
  const s = data.series;
  const walcl = getSeries(s, ["WALCL"]);
  if (!walcl) {
    console.error("No se encontró la serie WALCL");
    return;
  }

  const trace = {
    x: walcl.dates,
    y: walcl.values.map(v => v / 1000), // millones -> miles de millones
    name: "WALCL",
    mode: "lines",
    fill: "tozeroy"
  };

  const layout = {
    margin: { t: 30 },
    yaxis: { title: "Balance Fed (USD bn)" },
    xaxis: {
      type: "date",
      rangeselector: {
        buttons: [
          { count: 1,  label: "1A",  step: "year",  stepmode: "backward" },
          { count: 3,  label: "3A",  step: "year",  stepmode: "backward" },
          { count: 5,  label: "5A",  step: "year",  stepmode: "backward" },
          { step: "all", label: "Todos" }
        ]
      },
      rangeslider: { visible: true }
    }
  };

  Plotly.newPlot("chart-balance", [trace], layout);
}

// --------- Inicialización ---------

async function init() {
  try {
    const [mainData, tgaData, repoData] = await Promise.all([
      loadData(),
      loadTgaData(),
      loadRepoData()
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

    if (repoData) {
      plotRepo(mainData, repoData);   // 👈 nuevo
    }

    plotBalance(mainData);
  } catch (err) {
    console.error("Error inicializando dashboard:", err);
  }
}

init();

