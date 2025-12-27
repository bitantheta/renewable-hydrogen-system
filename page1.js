const explanation = document.getElementById("explanation");
const components = document.querySelectorAll(".component");

const text = {
  solar:
    "Solar panels capture sunlight and convert it into electricity. Adding more panels increases available energy, but excess power may be curtailed if downstream systems cannot use it.",

  power:
    "Power electronics condition and regulate electricity before it enters the electrolyzer. Control limits prevent instantaneous or unlimited power transfer.",

  electrolyzer:
    "The electrolyzer converts electrical energy into hydrogen. This process operates efficiently only within specific electrical and thermal limits.",

  cooling:
    "Electrolysis generates heat. The cooling system removes this heat to maintain safe and efficient operation.",

  hydrogen:
    "Hydrogen is the final energy carrier produced by the system, reflecting all upstream efficiencies and losses."
};

components.forEach(comp => {
  comp.addEventListener("click", () => {
    const key = comp.dataset.key;

    // Smooth text transition
    explanation.style.opacity = 0;
    setTimeout(() => {
      explanation.textContent = text[key];
      explanation.style.opacity = 1;
    }, 200);

    // Highlight selected component
    components.forEach(c => c.classList.remove("active"));
    comp.classList.add("active");
  });
});
