// Carga del JSON con las series
async function loadData() {
  const res = await fetch("data/plumbing_data.json");
  if (!res.ok) {
    console.error("No se pudo cargar plumbing_data.json");
    return null;
  }
  return await res.json();
}

// Helper para tomar el último valor de un array
function last(arr) {
  return arr[arr.length - 1];
}

// Tarjetas de SOFR / EFFR / IORB / Spread
function setCards(data) {
  const s = data.series;

  // En el JSON la serie de fed funds se llama FEDFUNDS
  const sofrLast   = last(s.SOFR.values).toFixed(2);
  const effrLast   = last(s.FEDFUNDS.values).toFixed(2);
  const iorbLast   = last(s.IORB.values).toFixed(2);
  const spreadLast = last(s.SOFR_minus_IORB.values).toFixed(2);

  document.getElementById("card-sofr").innerHTML =
    `<h3>SOFR</h3><p>${sofrLast} %</p>`;
  document.getElementById("card-effr").innerHTML =
    `<h3>EFFR</h3><p>${effrLast} %</p>`;
  document.getElementById("card-iorb").innerHTML =
    `<h3>IORB</h3><p>${iorbLast} %</p>`;
  document.getElementById("card-spread").innerHTML =
    `<h3>SOFR - IORB</h3><p>${spreadLast} pp</p>`;
}

// Gráfico SOFR vs EFFR(FEDFUNDS) vs IORB con botones tipo TradingView
function plotFunding(data) {
  const s = data.series;

  const traceSOFR = {
    x: s.SOFR.dates,
    y: s.SOFR.values,
    name: "SOFR",
    mode: "lines"
  };
  const traceEFFR = {
    x: s.FEDFUNDS.dates,
    y: s.FEDFUNDS.values,
    name: "EFFR",
    mode: "lines"
  };
  const traceIORB = {
    x: s.IORB.dates,
    y: s.IORB.values,
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
          {count: 5,  label: "5D",  step: "day",   stepmode: "backward"},
          {count: 1,  label: "1M",  step: "month", stepmode: "backward"},
          {count: 3,  label: "3M",  step: "month", stepmode: "backward"},
          {count: 6,  label: "6M",  step: "month", stepmode: "backward"},
          {count: 1,  label: "YTD", step: "year",  stepmode: "todate"},
          {count: 1,  label: "1A",  step: "year",  stepmode: "backward"},
          {count: 5,  label: "5A",  step: "year",  stepmode: "backward"},
          {step: "all", label: "Todos"}
        ]
      },
      rangeslider: { visible: true }
    }
  };

  Plotly.newPlot("chart-funding", [traceSOFR, traceEFFR, traceIORB], layout);
}

// Gráfico del balance de la Fed con botones de rango y range slider
function plotBalance(data) {
  const s = data.series.WALCL;
  const trace = {
    x: s.dates,
    y: s.values.map(v => v / 1e3), // miles de millones
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
          {count: 5,  label: "5D",  step: "day",   stepmode: "backward"},
          {count: 1,  label: "1M",  step: "month", stepmode: "backward"},
          {count: 3,  label: "3M",  step: "month", stepmode: "backward"},
          {count: 6,  label: "6M",  step: "month", stepmode: "backward"},
          {count: 1,  label: "YTD", step: "year",  stepmode: "todate"},
          {count: 1,  label: "1A",  step: "year",  stepmode: "backward"},
          {count: 5,  label: "5A",  step: "year",  stepmode: "backward"},
          {step: "all", label: "Todos"}
        ]
      },
      rangeslider: { visible: true }
    }
  };

  Plotly.newPlot("chart-balance", [trace], layout);
}

// Inicialización del dashboard
async function init() {
  const data

