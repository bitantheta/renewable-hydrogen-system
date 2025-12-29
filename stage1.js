// =====================================================
// Stage 1 & 2 — Single Electrolyzer Cell + Thermal Model
// =====================================================

window.addEventListener("DOMContentLoaded", () => {

  // ---------- Safety check ----------
  if (typeof Chart === "undefined") {
    console.error("Chart.js not loaded");
    return;
  }

  // ---------- Physical constants ----------
  const F = 96485;
  const R = 8.314;
  const n = 2;

  // ---------- Cell parameters ----------
  const A = 0.01;
  const E_rev = 1.23;
  const i0 = 1e-3;
  const alpha = 0.5;
  const ASR = 0.0002;

  // ---------- Thermal parameters ----------
  const T_cool = 298;
  const UA = 15;

  // ---------- Current density range ----------
  const i_vals = [];
  for (let i = 5000; i <= 20000; i += 300) {
    i_vals.push(i);
  }

  // ---------- Electrochemistry ----------
  function activationOverpotential(i, T) {
    return (R * T / (alpha * n * F)) * Math.log(i / i0);
  }

  function ohmicOverpotential(i, T) {
    const ASR_T = ASR * (333 / T);
    return i * ASR_T;
  }

  function cellVoltage(i, T) {
    return E_rev + activationOverpotential(i, T) + ohmicOverpotential(i, T);
  }

  // ---------- Thermal balance ----------
  function steadyTemperature(i) {
    let T = 333;
    for (let k = 0; k < 25; k++) {
      const V = cellVoltage(i, T);
      const Q_gen = (i * A) * (V - E_rev);
      const Q_rem = UA * (T - T_cool);
      T += 0.25 * (Q_gen - Q_rem) / UA;
    }
    return T;
  }

  // ---------- Compute arrays ----------
  const voltage = [];
  const power = [];
  const heat = [];
  const temperatureC = [];

  i_vals.forEach(i => {
    const T = steadyTemperature(i);
    const V = cellVoltage(i, T);
    const I = i * A;

    voltage.push(V);
    power.push(V * I);
    heat.push(I * (V - E_rev));
    temperatureC.push(T - 273.15);
  });

  // ---------- Plot helper ----------
  function makePlot(canvasId, yData, yLabel, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.error(`Canvas not found: ${canvasId}`);
      return;
    }

    new Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels: i_vals,
        datasets: [{
          data: yData,
          borderColor: color,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.35
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            title: { display: true, text: "Current Density (A/m²)", color: "#aaa" },
            ticks: { color: "#aaa" },
            grid: { color: "rgba(255,255,255,0.06)" }
          },
          y: {
            title: { display: true, text: yLabel, color: "#aaa" },
            ticks: { color: "#aaa" },
            grid: { color: "rgba(255,255,255,0.06)" }
          }
        }
      }
    });
  }

  // ---------- Render Stage 1 ----------
  makePlot("voltagePlot", voltage, "Voltage (V)", "#3ddc97");
  makePlot("powerPlot", power, "Power (W)", "#4ea8de");
  makePlot("heatPlot", heat, "Heat (W)", "#ff6b6b");

  // ---------- Render Stage 2 ----------
  makePlot("temperaturePlot", temperatureC, "Temperature (°C)", "#ffd166");

  // =====================================================
// Stage 3 — Stack-level scaling
// =====================================================

const N_cells = 50;          // number of cells in stack
const M_H2 = 2.016e-3;       // kg/mol

const stackVoltage = [];
const stackPower = [];
const stackHydrogen = [];

i_vals.forEach((i, idx) => {
  const V_cell = voltage[idx];
  const I = i * A;

  const V_stack = N_cells * V_cell;
  const P_stack = V_stack * I;           // W
  const mH2 = (N_cells * I) / (2 * F) * M_H2 * 3600; // kg/h

  stackVoltage.push(V_stack);
  stackPower.push(P_stack / 1000);        // kW
  stackHydrogen.push(mH2);
});

makePlot(
  "stackVoltagePlot",
  stackVoltage,
  "Stack Voltage (V)",
  "#a78bfa"
);

makePlot(
  "stackPowerPlot",
  stackPower,
  "Stack Power (kW)",
  "#60a5fa"
);

makePlot(
  "stackHydrogenPlot",
  stackHydrogen,
  "Hydrogen Production (kg/h)",
  "#34d399"
);

// =====================================================
// Stage 4 — Cooling constraint
// =====================================================

const T_max = 80; // °C (safe operating limit)

function makeThermalLimitPlot() {
  const canvas = document.getElementById("thermalLimitPlot");
  if (!canvas) return;

  new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: i_vals,
      datasets: [
        {
          label: "Cell Temperature",
          data: temperatureC,
          borderColor: "#fbbf24",
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 0
        },
        {
          label: "Max Allowable Temperature",
          data: i_vals.map(() => T_max),
          borderColor: "#ef4444",
          borderWidth: 2,
          borderDash: [6, 6],
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          title: { display: true, text: "Current Density (A/m²)", color: "#aaa" },
          ticks: { color: "#aaa" },
          grid: { color: "rgba(255,255,255,0.06)" }
        },
        y: {
          title: { display: true, text: "Temperature (°C)", color: "#aaa" },
          ticks: { color: "#aaa" },
          grid: { color: "rgba(255,255,255,0.06)" }
        }
      }
    }
  });
}

makeThermalLimitPlot();

// =====================================================
// Stage 5 — Control & protection logic
// =====================================================

const T_soft = 75;   // °C
const T_hard = 80;   // °C
const V_max = 2.0;   // V (cell-level safety)

const requestedCurrent = [];
const appliedCurrent = [];

i_vals.forEach((i, idx) => {
  const T = temperatureC[idx];
  const V = voltage[idx];

  // Requested current (ideal)
  requestedCurrent.push(i);

  // Temperature derating
  let fT = 1.0;
  if (T >= T_hard) {
    fT = 0.0;
  } else if (T > T_soft) {
    fT = (T_hard - T) / (T_hard - T_soft);
  }

  // Voltage limit
  let fV = 1.0;
  if (V > V_max) fV = V_max / V;

  const i_applied = i * Math.min(fT, fV);
  appliedCurrent.push(i_applied);
});


function makeControlPlot() {
  const canvas = document.getElementById("controlPlot");
  if (!canvas) return;

  new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: i_vals,
      datasets: [
        {
          label: "Requested Current",
          data: requestedCurrent,
          borderColor: "#94a3b8",
          borderDash: [6, 6],
          borderWidth: 2,
          pointRadius: 0
        },
        {
          label: "Applied Current",
          data: appliedCurrent,
          borderColor: "#22c55e",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.35
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          title: { display: true, text: "Requested Current Density (A/m²)", color: "#aaa" },
          ticks: { color: "#aaa" },
          grid: { color: "rgba(255,255,255,0.06)" }
        },
        y: {
          title: { display: true, text: "Applied Current Density (A/m²)", color: "#aaa" },
          ticks: { color: "#aaa" },
          grid: { color: "rgba(255,255,255,0.06)" }
        }
      }
    }
  });
}

makeControlPlot();

// =====================================================
// Stage 6 — Renewable power integration
// =====================================================

const DAY = 24;                  // hours
const time = [];
for (let t = 0; t <= DAY; t += 0.25) {
  time.push(t);
}

const P_peak = 500;              // kW (example)

const solarPower = [];
const electrolyzerPower = [];

time.forEach(t => {
  const P_solar = P_peak * Math.max(0, Math.sin(Math.PI * t / DAY));
  solarPower.push(P_solar);

  // Use max feasible operating point (from Stage 5)
  const i_applied = Math.max(...appliedCurrent);
  const idx = appliedCurrent.indexOf(i_applied);

  const V_cell = voltage[idx];
  const I = i_applied * A;
  const P_stack = N_cells * V_cell * I / 1000; // kW

  electrolyzerPower.push(Math.min(P_solar, P_stack));
});


function makeRenewablePlot() {
  const canvas = document.getElementById("renewablePlot");
  if (!canvas) return;

  new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: time,
      datasets: [
        {
          label: "Solar Power Available",
          data: solarPower,
          borderColor: "#94a3b8",
          borderDash: [6, 6],
          borderWidth: 2,
          pointRadius: 0
        },
        {
          label: "Electrolyzer Power Used",
          data: electrolyzerPower,
          borderColor: "#22c55e",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          title: { display: true, text: "Time (hours)", color: "#aaa" },
          ticks: { color: "#aaa" },
          grid: { color: "rgba(255,255,255,0.06)" }
        },
        y: {
          title: { display: true, text: "Power (kW)", color: "#aaa" },
          ticks: { color: "#aaa" },
          grid: { color: "rgba(255,255,255,0.06)" }
        }
      }
    }
  });
}

makeRenewablePlot();

// =====================================================
// Stage 7 — Performance metrics
// =====================================================

// Time step (hours)
const dt = time[1] - time[0];

// Energy integrals (kWh)
let E_used = 0;
let E_solar = 0;

for (let k = 0; k < time.length; k++) {
  E_used += electrolyzerPower[k] * dt;
  E_solar += solarPower[k] * dt;
}

// Hydrogen production rate (kg/h)
const mH2_rate = [];
time.forEach((t, k) => {
  const P = electrolyzerPower[k]; // kW
  const idx = appliedCurrent.indexOf(Math.max(...appliedCurrent));
  const I = appliedCurrent[idx] * A;
  const mH2 = (N_cells * I) / (2 * F) * 2.016e-3 * 3600;
  mH2_rate.push(mH2);
});

// Daily hydrogen (kg/day)
let mH2_day = 0;
mH2_rate.forEach(m => {
  mH2_day += m * dt;
});

// KPIs
const kWh_per_kg = E_used / mH2_day;
const CF = E_used / (P_peak * DAY);
const RE_util = E_used / E_solar;

// Render KPIs
document.getElementById("kpi-h2").textContent = mH2_day.toFixed(2);
document.getElementById("kpi-eff").textContent = kWh_per_kg.toFixed(1);
document.getElementById("kpi-cf").textContent = (CF * 100).toFixed(1) + "%";
document.getElementById("kpi-re").textContent = (RE_util * 100).toFixed(1) + "%";

// =====================================================
// Stage 8.1 — Renewable oversizing
// =====================================================
const charts = {};

function renderChart(id, config) {
  if (charts[id]) {
    charts[id].destroy();
  }
  charts[id] = new Chart(
    document.getElementById(id).getContext("2d"),
    config
  );
}

// =====================================================
// Stage 8.1 — Renewable Oversizing (FIXED)
// =====================================================

const oversize = [0.5, 0.8, 1.0, 1.2, 1.5, 2.0];
const h2 = oversize.map(r => ({
  x: r,
  y: Math.min(r, 1.6) * 2.5
}));

renderChart("oversizingPlot", {
  type: "line",
  data: {
    datasets: [{
      data: h2,
      borderColor: "#22c55e",
      borderWidth: 2,
      pointRadius: 4,
      tension: 0.3
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { type: "linear", title: { display: true, text: "Oversizing Ratio" }},
      y: { title: { display: true, text: "Hydrogen (kg/day)" }}
    }
  }
});



// =====================================================
// Stage 8.2 — Electrolyzer oversizing
// =====================================================

const capacity = [0.5, 0.8, 1.0, 1.2, 1.5];
const h2cap = capacity.map(c => ({
  x: c,
  y: Math.min(c, 1.0) * 2.6
}));

renderChart("capacityPlot", {
  type: "line",
  data: {
    datasets: [{
      data: h2cap,
      borderColor: "#38bdf8",
      borderWidth: 2,
      pointRadius: 4,
      tension: 0.3
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { type: "linear", title: { display: true, text: "Capacity Scaling" }},
      y: { title: { display: true, text: "Hydrogen (kg/day)" }}
    }
  }
});

const j = [0.5, 0.7, 1.0, 1.3, 1.6];
const efficiency = j.map(v => ({
  x: v,
  y: 70 - v * 12
}));

renderChart("currentDensityPlot", {
  type: "line",
  data: {
    datasets: [{
      data: efficiency,
      borderColor: "#f97316",
      borderWidth: 2,
      pointRadius: 4,
      tension: 0.3
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { type: "linear", title: { display: true, text: "Current Density" }},
      y: { title: { display: true, text: "Efficiency (kWh/kg)" }}
    }
  }
});



});
