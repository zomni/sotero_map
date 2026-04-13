/////////////////////////////////////////////////////////////////////////////////
/////////////////// Create buttons to choose campus location ////////////////////
/////////////////////////////////////////////////////////////////////////////////

import { getCookie } from "../utils/locationCookie.js";
import { goTo, setDefaultFloor } from "../utils/goToCampus.js?v=20260413q";
import campuses from "../data/campuses.js";

var SelectDiv,
  j,
  numberOfOptions,
  selectElmnts,
  selectedOption,
  optionsDiv,
  newSelectDivs;
SelectDiv = document.getElementById("custom-select");
selectElmnts = SelectDiv.getElementsByTagName("select")[0];

const EMPTY_LABEL = "Campus";

const setCampusBar = () => {
  const divs = document.getElementById("selected-option");
  if (!divs) {
    return;
  }

  divs.innerHTML = EMPTY_LABEL;
};

const setSelectValue = (campus) => {
  const selectedIndex = Array.from(selectElmnts.options).findIndex((option) => option.value === campus);
  selectElmnts.selectedIndex = selectedIndex >= 0 ? selectedIndex : 0;
};

const activateCampus = (campus, applyDefaultFloor = true) => {
  if (!(campus in campuses)) {
    setSelectValue("");
    setCampusBar();
    return;
  }

  setSelectValue(campus);
  setCampusBar();
  goTo(campus);

  if (applyDefaultFloor) {
    setDefaultFloor(campus);
  }
};

for (var campus in campuses) {
  var selec = document.createElement("option");
  selec.value = campus;
  selec.innerHTML = campuses[campus]["fullName"];
  selectElmnts.appendChild(selec);
}
numberOfOptions = selectElmnts.length;
selectedOption = document.createElement("DIV");
selectedOption.setAttribute("class", "select-selected");
selectedOption.setAttribute("id", "selected-option");
selectedOption.innerHTML = EMPTY_LABEL;
SelectDiv.appendChild(selectedOption);
optionsDiv = document.createElement("DIV");
optionsDiv.setAttribute("class", "select-items select-hide");
for (j = 1; j < numberOfOptions; j++) {
  newSelectDivs = document.createElement("DIV");
  newSelectDivs.innerHTML = selectElmnts.options[j].innerHTML;
  newSelectDivs.addEventListener("click", function () {
    const campusValue = Array.from(selectElmnts.options).find(
      (option) => option.innerHTML === this.innerHTML
    )?.value;

    activateCampus(campusValue, true);
    this.parentNode.previousSibling.click();

    const selectedItems = this.parentNode.getElementsByClassName("same-as-selected");
    Array.from(selectedItems).forEach((item) => item.removeAttribute("class"));
    this.setAttribute("class", "same-as-selected");
  });
  optionsDiv.appendChild(newSelectDivs);
}
SelectDiv.appendChild(optionsDiv);
selectedOption.addEventListener("click", function (e) {
  e.stopPropagation();
  closeAllSelect(this);
  this.nextSibling.classList.toggle("select-hide");
  this.classList.toggle("select-arrow-active");
});

function closeAllSelect(elmnt) {
  var x,
    y,
    i,
    xl,
    yl,
    arrNo = [];
  x = document.getElementsByClassName("select-items");
  y = document.getElementsByClassName("select-selected");
  xl = x.length;
  yl = y.length;
  for (i = 0; i < yl; i++) {
    if (elmnt == y[i]) {
      arrNo.push(i);
    } else {
      y[i].classList.remove("select-arrow-active");
    }
  }
  for (i = 0; i < xl; i++) {
    if (arrNo.indexOf(i)) {
      x[i].classList.add("select-hide");
    }
  }
}

document.addEventListener("click", closeAllSelect);

const rememberCampus = () => {
  var campus = getCookie("location");
  activateCampus(campus, true);
};

rememberCampus();



