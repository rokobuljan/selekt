import "./style.css"
import Selekt from "./lib/selekt.js";

const opts = {
    onSelect: (data) => {
        const elCount = data.parent.closest(".explorer").querySelector(".count");
        elCount.textContent = data.selected.length;
    }
};

document.querySelectorAll(".explorer ul").forEach(el => {
    new Selekt(el, opts);
});

