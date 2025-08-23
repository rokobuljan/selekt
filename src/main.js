import "./style.css"
import Selekt from "./lib/selekt.js";

const listOne = document.querySelector("#list-one");
const listTwo = document.querySelector("#list-two");
const listTre = document.querySelector("#list-tre");
const opts = {
    onSelect: (data) => {
        console.log("Selected items:", data.selected);
    }
};
// Initialize Selekt
new Selekt(listOne, opts);
new Selekt(listTwo, opts);
new Selekt(listTre, opts);
