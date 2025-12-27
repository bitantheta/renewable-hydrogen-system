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

const REF_CAPACITY_MW = 10;
let data = [];

fetch("project8_oversizing.json")
  .then(r => r.json())
  .then(d => {
    data = d;
    update();
  });

[solar, capacity, stack, cooling].forEach(s =>
  s.addEventListener("input", update)
);

function update() {

  const s = +solar.value;
  const cap = +capacity.value;
  const stk = +stack.value;
  const cool = +cooling.value;

  solarVal.textContent = s.toFixed(2);
  capVal.textContent = cap;
  stackVal.textContent = stk.toFixed(2);
  coolVal.textContent = cool.toFixed(2);

  const interp = interpolate(s);

  const stackPenalty = Math.min(1, 1 / stk);
  const thermalPenalty = Math.min(1, cool);
  const feasibleFactor = stackPenalty * thermalPenalty;

  const h2Solar = interp.h2 * feasibleFactor;
  const h2Cap = interp.h2 * (cap / REF_CAPACITY_MW);
  const h2Out = Math.min(h2Solar, h2Cap);

  h2.textContent = h2Out.toFixed(2);
  eff.textContent = (interp.kwh / Math.max(h2Out / interp.h2, 0.5)).toFixed(1);
  loss.textContent = ((1 - h2Out / interp.h2) * 100).toFixed(1) + " %";

  let limiting = "Solar availability";
  if (h2Cap < h2Solar) limiting = "Electrolyzer capacity";
  else if (feasibleFactor < 0.98) limiting = "Thermal / stack";

  limiter.textContent = limiting;

  let explanation = "";

  if (limiting === "Electrolyzer capacity") {
  explanation = `
  What this means right now:
  
  Your renewable supply could produce more hydrogen, but the electrolyzer is too small to process all the available power.
  The orange dashed line shows this hard limit.
  
  Increasing electrolyzer capacity would allow the operating point to move upward.
  Increasing solar oversizing would not help until capacity is increased.
  `;
  }
  else if (limiting === "Thermal / stack") {
  explanation = `
  What this means right now:
  
  The system is limited by internal constraints such as stack scaling or cooling.
  Even though renewable power and electrolyzer capacity are available, thermal limits prevent higher operation.
  
  Improving cooling or stack configuration would move the operating point closer to the green envelope.
  `;
  }
  else {
  explanation = `
  What this means right now:
  
  Hydrogen production is limited by renewable availability.
  The electrolyzer and cooling system are capable of handling more power, but not enough energy is coming from the source.
  
  Increasing solar oversizing would move the operating point upward along the green curve.
  Increasing electrolyzer capacity or cooling would not change output in this state.
  `;
  }

  interpretation.textContent = explanation.trim();


  drawPlot(s, h2Out, h2Cap);
}

function interpolate(x) {
  for (let i = 0; i < data.length - 1; i++) {
    const a = data[i], b = data[i + 1];
    if (x >= a.oversize_ratio && x <= b.oversize_ratio) {
      const w = (x - a.oversize_ratio) /
                (b.oversize_ratio - a.oversize_ratio);
      return {
        h2: a.h2_kg_day + w * (b.h2_kg_day - a.h2_kg_day),
        kwh: a.kwh_per_kg + w * (b.kwh_per_kg - a.kwh_per_kg)
      };
    }
  }
  return {
    h2: data[data.length - 1].h2_kg_day,
    kwh: data[data.length - 1].kwh_per_kg
  };
}

function drawPlot(x, y, cap) {

  const xs = data.map(d => d.oversize_ratio);
  const ys = data.map(d => d.h2_kg_day);

  Plotly.newPlot("plot", [
    {
      x: xs, y: ys,
      mode: "lines+markers",
      name: "Project 8 Envelope",
      line: { color: "#22c55e" }
    },
    {
      x: [Math.min(...xs), Math.max(...xs)],
      y: [cap, cap],
      mode: "lines",
      name: "Capacity Limit",
      line: { dash: "dot", color: "#f97316" }
    },
    {
      x: [x], y: [y],
      mode: "markers",
      name: "Operating Point",
      marker: { size: 12, color: "#22c55e" }
    }
  ], {
    paper_bgcolor: "#0f1623",
    plot_bgcolor: "#0f1623",
    font: { color: "#ffffff" },
    margin: { t: 30 },
    xaxis: { title: "Solar Oversizing Ratio" },
    yaxis: { title: "Hydrogen Production (kg/day)" }
  });
}
