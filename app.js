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

  // Tomamos la serie que exista: EFFR o FEDFUNDS
  const effrSeries = s.EFFR || s.FEDFUNDS;

  const sofrLast   = last(s.SOFR.values).toFixed(2);
  const effrLast   = last(effrSeries.values).toFixed(2);
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


init();
