// =====================================================
// SYSTEM EXPLORER — ENGINEERING-GRADE INTERACTIVE MODEL
// =====================================================
const isMobile = window.innerWidth < 768;
// -----------------------------
// DOM REFERENCES
// -----------------------------
const solar = document.getElementById("solar");
const capacity = document.getElementById("capacity");
const stack = document.getElementById("stack");
const cooling = document.getElementById("cooling");

const solarVal = document.getElementById("solarVal");
const capVal = document.getElementById("capVal");
const stackVal = document.getElementById("stackVal");
const coolVal = document.getElementById("coolVal");

const h2 = document.getElementById("h2");
const eff = document.getElementById("eff");
const loss = document.getElementById("loss");
const limiter = document.getElementById("limiter");
const interpretation = document.getElementById("interpretation");



// -----------------------------
// CONSTANTS (MODEL ASSUMPTIONS)
// -----------------------------
const REF_CAPACITY_MW = 10;     // reference electrolyzer size
const T_MAX = 80;              // °C — safe steady-state temperature ceiling
const REGIME_COLORS = {
  solar: "#22c55e",
  capacity: "#f97316",
  thermal: "#ef4444"
};

let envelopeData = [];

// -----------------------------
// LOAD PERFORMANCE ENVELOPE
// -----------------------------
fetch("project8_oversizing.json")
  .then(r => r.json())
  .then(d => {
    envelopeData = d;
    update();
  });

[solar, capacity, stack, cooling].forEach(s =>
  s.addEventListener("input", update)
);

// =====================================================
// MAIN UPDATE LOOP
// =====================================================
function update() {

  // ---- Read sliders ----
  const s = +solar.value;
  const cap = +capacity.value;
  const stk = +stack.value;
  const cool = +cooling.value;

  solarVal.textContent = s.toFixed(2);
  capVal.textContent = cap;
  stackVal.textContent = stk.toFixed(2);
  coolVal.textContent = cool.toFixed(2);

  // ---- Envelope interpolation (physics baseline) ----
  const env = interpolateEnvelope(s);

  // ---- Constraint modifiers ----
  const stackFactor = Math.min(1, 1 / stk);
  const thermalFactor = Math.min(1, cool);
  const feasibilityFactor = stackFactor * thermalFactor;

  // ---- Constraint-limited hydrogen ----
  const h2_from_solar = env.h2 * feasibilityFactor;
  const h2_from_capacity = env.h2 * (cap / REF_CAPACITY_MW);
  const h2_out = Math.min(h2_from_solar, h2_from_capacity);

  // ---- Identify active constraint ----
  let regime = "solar";
  if (h2_from_capacity < h2_from_solar) regime = "capacity";
  else if (feasibilityFactor < 0.98) regime = "thermal";

  // ---- KPIs (operating point only) ----
  h2.textContent = h2_out.toFixed(2);

  const utilization = h2_out / env.h2;
  const effective_kwh = env.kwh / Math.max(utilization, 0.4);
  eff.textContent = effective_kwh.toFixed(1);

  loss.textContent = ((1 - utilization) * 100).toFixed(1) + " %";

  limiter.textContent =
    regime === "solar" ? "Renewable availability" :
    regime === "capacity" ? "Electrolyzer capacity" :
    "Thermal / stack limit";

  limiter.style.color = REGIME_COLORS[regime];

  interpretation.textContent = explanationText(regime);

  // ---- Draw plots ----
  drawMainPlot(s, h2_out, h2_from_capacity, regime);
  drawPowerPlot(cap, stk, cool);
  drawTempPlot(stk, cool);
  drawEffPlot();
  drawLossPlot(utilization, stk, cool);
  drawRegimePlot(stk, cool);
}

// =====================================================
// ENVELOPE INTERPOLATION
// =====================================================
function interpolateEnvelope(x) {
  for (let i = 0; i < envelopeData.length - 1; i++) {
    const a = envelopeData[i];
    const b = envelopeData[i + 1];
    if (x >= a.oversize_ratio && x <= b.oversize_ratio) {
      const w = (x - a.oversize_ratio) /
                (b.oversize_ratio - a.oversize_ratio);
      return {
        h2: a.h2_kg_day + w * (b.h2_kg_day - a.h2_kg_day),
        kwh: a.kwh_per_kg + w * (b.kwh_per_kg - a.kwh_per_kg)
      };
    }
  }
  return envelopeData[envelopeData.length - 1];
}

// =====================================================
// PLOTS
// =====================================================

// ---- Primary envelope plot ----
function drawMainPlot(x, y, capLimit, regime) {
  const xs = envelopeData.map(d => d.oversize_ratio);
  const ys = envelopeData.map(d => d.h2_kg_day);

  Plotly.react("plot", [
    {
      x: xs,
      y: ys,
      mode: "lines",
      name: "Physical production envelope",
      line: { dash: "dash", color: "#22c55e" }
    },
    {
      x: [Math.min(...xs), Math.max(...xs)],
      y: [capLimit, capLimit],
      mode: "lines",
      name: "Capacity limit",
      line: { dash: "dot", color: REGIME_COLORS.capacity }
    },
    {
      x: [x],
      y: [y],
      mode: "markers",
      name: "Operating point",
      marker: { size: 14, color: REGIME_COLORS[regime] }
    }
  ], baseLayout(
    "Solar oversizing ratio",
    "Hydrogen production (kg/day)"
  ));
}

// ---- Power constraints ----
function drawPowerPlot(cap, stk, cool) {
  const xs = envelopeData.map(d => d.oversize_ratio);
  const solarP = xs.map(x => x * REF_CAPACITY_MW);
  const capP = xs.map(() => cap);
  const thermalP = xs.map(() => cap * stk * cool);

  Plotly.react("powerPlot", [
    { x: xs, y: solarP, name: "Available renewable power", line: { color: REGIME_COLORS.solar }},
    { x: xs, y: capP, name: "Electrolyzer capacity", line: { dash: "dot", color: REGIME_COLORS.capacity }},
    { x: xs, y: thermalP, name: "Thermal absorption limit", line: { dash: "dash", color: REGIME_COLORS.thermal }}
  ], baseLayout("Solar oversizing", "Power (MW)"));
}

// ---- Temperature (clipped at Tmax) ----
function drawTempPlot(stk, cool) {
  const xs = envelopeData.map(d => d.oversize_ratio);
  const rawTemp = xs.map(x => T_MAX * x / (stk * cool));
  const temp = rawTemp.map(t => Math.min(t, T_MAX));

  Plotly.react("tempPlot", [
    { x: xs, y: temp, name: "Stack temperature", line: { color: REGIME_COLORS.solar }},
    { x: xs, y: xs.map(() => T_MAX), name: "Thermal limit", line: { dash: "dot", color: REGIME_COLORS.thermal }}
  ], baseLayout("Solar oversizing", "Temperature (°C)"));
}

// ---- Specific energy ----
function drawEffPlot() {
  Plotly.react("effPlot", [
    {
      x: envelopeData.map(d => d.oversize_ratio),
      y: envelopeData.map(d => d.kwh_per_kg),
      mode: "lines",
      name: "Ideal specific energy",
      line: { color: "#22c55e" }
    }
  ], baseLayout("Solar oversizing", "kWh / kg"));
}

// ---- Loss attribution (operating point based) ----
function drawLossPlot(utilization, stk, cool) {
  const thermalLoss = Math.max(0, 1 - cool);
  const stackLoss = Math.max(0, 1 - 1 / stk);
  const curtailmentLoss = Math.max(0, 1 - utilization);

  Plotly.react("lossPlot", [
    { x: ["Losses"], y: [thermalLoss], name: "Thermal" },
    { x: ["Losses"], y: [stackLoss], name: "Stack" },
    { x: ["Losses"], y: [curtailmentLoss], name: "Curtailment" }
  ], {
    ...baseLayout("", "Fraction"),
    barmode: "stack"
  });
}

// ---- Dominant regime over explored space ----
function drawRegimePlot(stk, cool) {
  let solarCount = 0, capacityCount = 0, thermalCount = 0;

  envelopeData.forEach(d => {
    const feasible = Math.min(1, 1 / stk) * Math.min(1, cool);
    if (feasible < 0.98) thermalCount++;
    else capacityCount++;
  });

  const total = envelopeData.length;

  Plotly.react("regimePlot", [
    { x: ["Solar"], y: [solarCount / total], type: "bar", marker: { color: REGIME_COLORS.solar }},
    { x: ["Capacity"], y: [capacityCount / total], type: "bar", marker: { color: REGIME_COLORS.capacity }},
    { x: ["Thermal"], y: [thermalCount / total], type: "bar", marker: { color: REGIME_COLORS.thermal }}
  ], {
    ...baseLayout("", "Fraction of operating range"),
    barmode: "stack"
  });
}

// =====================================================
// UTILITIES
// =====================================================
function baseLayout(xlab, ylab) {
  const isMobile = window.innerWidth <= 768;

  return {
    paper_bgcolor: "#0f1623",
    plot_bgcolor: "#0f1623",

    font: {
      color: "#ffffff",
      size: isMobile ? 11 : 13
    },

    margin: isMobile
      ? { t: 40, l: 42, r: 10, b: 46 }
      : { t: 40, l: 60, r: 30, b: 60 },

    xaxis: {
      title: isMobile ? "" : xlab,
      tickfont: { size: isMobile ? 10 : 12 }
    },

    yaxis: {
      title: isMobile ? "" : ylab,
      tickfont: { size: isMobile ? 10 : 12 }
    },

    legend: {
      orientation: isMobile ? "h" : "v",
      x: isMobile ? 0 : 1.02,
      y: isMobile ? -0.25 : 1,
      xanchor: isMobile ? "left" : "left",
      yanchor: isMobile ? "top" : "top",
      font: { size: isMobile ? 10 : 12 }
    },

    height: isMobile ? 360 : 480
  };
}



function explanationText(regime) {
  if (regime === "capacity") {
    return "Hydrogen output is capped by electrolyzer size. Additional renewable power cannot be absorbed without increasing installed capacity.";
  }
  if (regime === "thermal") {
    return "Thermal limits are active. The system must derate to avoid exceeding safe operating temperature.";
  }
  return "Hydrogen production is limited by available renewable energy. Equipment capacity and cooling are sufficient.";
}
