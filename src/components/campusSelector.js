/////////////////////////////////////////////////////////////////////////////////
/////////////////// Create buttons to choose campus location ////////////////////
/////////////////////////////////////////////////////////////////////////////////

import { getCookie } from "../utils/locationCookie.js";
import { goTo, setDefaultFloor } from "../utils/goToCampus.js";
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

for(var campus in campuses) {
  var selec = document.createElement("option");
  selec.value = campus;
  selec.innerHTML = campuses[campus]["fullName"];
  selectElmnts.appendChild(selec);
}
numberOfOptions = selectElmnts.length;
/* For each element, create a new DIV that will act as the selected item */
selectedOption = document.createElement("DIV");
selectedOption.setAttribute("class", "select-selected");
selectedOption.setAttribute("id", "selected-option")
selectedOption.innerHTML =
  selectElmnts.options[selectElmnts.selectedIndex].innerHTML;
SelectDiv.appendChild(selectedOption);
/* For each element, create a new DIV that will contain the option list */
optionsDiv = document.createElement("DIV");
optionsDiv.setAttribute("class", "select-items select-hide");
for (j = 1; j < numberOfOptions; j++) {
  /* For each option in the original select element,
    create a new DIV that will act as an option item */
  newSelectDivs = document.createElement("DIV");
  newSelectDivs.innerHTML = selectElmnts.options[j].innerHTML;
  newSelectDivs.addEventListener("click", function (e) {
    /* When an item is clicked, update the original select box,
         the selected item and go to the selected campus */
    var y, i, k, selectBox, parentDiv, selectlBoxLength, yl;
    selectBox = this.parentNode.parentNode.getElementsByTagName("select")[0];
    selectlBoxLength = selectBox.length;
    parentDiv = this.parentNode.previousSibling;
    /* Add value to the selected div */
    Object.keys(selectElmnts.options).map((key) => {
      if (selectElmnts.options[key].innerHTML == this.innerHTML) {
        this.setAttribute("value", selectElmnts.options[key].value.toString());
      }
    });
    for (i = 0; i < selectlBoxLength; i++) {
      if (selectBox.options[i].innerHTML == this.innerHTML) {
        selectBox.selectedIndex = i;
        parentDiv.innerHTML = this.innerHTML;
        y = this.parentNode.getElementsByClassName("same-as-selected");
        yl = y.length;
        for (k = 0; k < yl; k++) {
          y[k].removeAttribute("class");
        }
        this.setAttribute("class", "same-as-selected");
        break;
      }
    }
    parentDiv.click();
    var campus = this.getAttribute("value")
    goTo(campus); // Go to the selected campus
    setDefaultFloor(campus); // set the default floor 
  });
  optionsDiv.appendChild(newSelectDivs);
}
SelectDiv.appendChild(optionsDiv);
selectedOption.addEventListener("click", function (e) {
  /* When the select box is clicked, close any other select boxes,
    and open/close the current select box */
  e.stopPropagation();
  closeAllSelect(this);
  this.nextSibling.classList.toggle("select-hide");
  this.classList.toggle("select-arrow-active");
});

function closeAllSelect(elmnt) {
  /* A function that will close all select boxes in the document,
  except the current select box */
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

/* If the user clicks anywhere outside the select box,
then close all select boxes */
document.addEventListener("click", closeAllSelect);

/* Remember last campus */

const campusToText = (campus) => {

  if(campus in campuses){
      return campuses[campus].fullName
  }
  return "Campus :";
}

const setCampusBar = (campus) => {
  var divs = document.getElementById("selected-option")
  divs.innerHTML = campusToText(campus)
};

const rememberCampus = () => {
  var campus = getCookie("location");
  goTo(campus);
  setDefaultFloor(campus);
  setCampusBar(campus);
};

rememberCampus();