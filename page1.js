const explanation = document.getElementById("explanation");
const components = document.querySelectorAll(".component");

/* ============================= */
/* EXPLANATION CONTENT */
/* ============================= */

const text = {
  solar:
    "Solar panels convert incoming sunlight into electrical energy. Increasing solar capacity raises available power, but any excess cannot be used unless downstream systems are sized to absorb it.",

  power:
    "Power electronics regulate voltage, current, and ramp rates before electricity enters the electrolyzer. These controls protect equipment and enforce safe operating limits.",

  electrolyzer:
    "The electrolyzer is where electricity is converted into hydrogen. Hydrogen output, efficiency, and heat generation are all governed by electrochemical and thermal constraints.",

  cooling:
    "Electrolysis generates heat proportional to electrical losses. The cooling system must continuously remove this heat to prevent temperature runaway and enforce safe operation.",

  hydrogen:
    "Hydrogen is the final energy carrier produced by the system. Its production reflects all upstream limitations, efficiencies, and constraints."
};

/* ============================= */
/* INTERACTION LOGIC */
/* ============================= */

components.forEach(comp => {
  comp.addEventListener("click", () => {
    const key = comp.dataset.key;

    /* Fade text out */
    explanation.style.opacity = 0;

    /* Update text after fade */
    setTimeout(() => {
      explanation.textContent = text[key];
      explanation.style.opacity = 1;
    }, 200);

    /* Active state handling */
    components.forEach(c => c.classList.remove("active"));
    comp.classList.add("active");
  });
});

/* ============================= */
/* DEFAULT STATE */
/* ============================= */

/* Automatically focus Electrolysis on load */
window.addEventListener("load", () => {
  const defaultComp = document.querySelector(".component.electrolyzer");
  if (defaultComp) defaultComp.click();
});
