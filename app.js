async function loadData() {
  const res = await fetch("data/plumbing_data.json");
  if (!res.ok) {
    console.error("No se pudo cargar plumbing_data.json");
    return null;
  }
  return await res.json();
}

function last(arr) {
  return arr[arr.length - 1];
}

function setCards(data) {
  const s = data.series;

  const sofrLast   = last(s.SOFR.values).toFixed(2);
  const effrLast   = last(s.EFFR.values).toFixed(2);
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

function plotFunding(data) {
  const s = data.series;

  const traceSOFR = {
    x: s.SOFR.dates,
    y: s.SOFR.values,
    name: "SOFR",
    mode: "lines"
  };
  const traceEFFR = {
    x: s.EFFR.dates,
    y: s.EFFR.values,
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
    yaxis: { title: "Tasa (%)" }
  };

  Plotly.newPlot("chart-funding", [traceSOFR, traceEFFR, traceIORB], layout);
}

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
    yaxis: { title: "Balance Fed (USD bn)" }
  };
  Plotly.newPlot("chart-balance", [trace], layout);
}

async function init() {
  const data = await loadData();
  if (!data) return;

  document.getElementById("last-updated").textContent =
    "Última actualización (UTC): " + data.last_updated_utc;

  setCards(data);
  plotFunding(data);
  plotBalance(data);
}

init();
