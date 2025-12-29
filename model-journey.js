// ----- Stage 1 Reference Physics -----

const current = Array.from({ length: 50 }, (_, i) => i * 0.2); // A/cm²

const Vrev = 1.23;

const voltage = current.map(i =>
  Vrev + 0.08 * Math.log(i + 1) + 0.25 * i
);

const power = current.map((i, idx) => voltage[idx] * i);

const heat = current.map((i, idx) => i * (voltage[idx] - Vrev));

// ----- Chart Config Helper -----
function makeLineChart(id, label, ydata, color) {
  new Chart(document.getElementById(id), {
    type: 'line',
    data: {
      labels: current,
      datasets: [{
        label,
        data: ydata,
        borderColor: color,
        borderWidth: 2,
        tension: 0.35,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          title: { display: true, text: 'Current Density (A/cm²)' }
        },
        y: {
          title: { display: true, text: label }
        }
      }
    }
  });
}

makeLineChart('voltageChart', 'Cell Voltage (V)', voltage, '#00e676');
makeLineChart('powerChart', 'Power (W)', power, '#4fc3f7');
makeLineChart('heatChart', 'Heat Generation (W)', heat, '#ff8a65');
