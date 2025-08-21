import "./style.css"
import Selekt from "./selekt.js";

const listOne = document.querySelector("#list-one");
const listTwo = document.querySelector("#list-two");

// Initialize Selekt
const selekt = new Selekt(listOne, {
    selectorItemsIgnore: ".ignore",
    classSelected: "is-selected",
    multiple: true,
    onSelect: (data) => {
        console.log("Selected items:", data.selected);
    },
    onDeselect: (data) => {
        console.log("Deselected items:", data.selected);
    }
});
