/////////////////////////////////////////////////////////////////////////////////
/////////////////// Create buttons to choose campus location ////////////////////
/////////////////////////////////////////////////////////////////////////////////

var location = "";

import { map, locateMe } from "../views/map.js";

import { setCookie } from "../utils/locationCookie.js";

import {
  showSearch,
  removeSearchContainerElements,
} from "../components/autocompleteSearchBox.js?v=20260414b";

import { addDataToMap, resetBuildingsCatalogCache } from "./addData.js";

import campuses from "../data/campuses.js";
import { resetSoteroSearchMetadataCaches } from "./soteroSearchMetadata.js?v=20260414b";

const selectFloor = (floorButtonId) => {
  var floorButtonsId = document.querySelectorAll("[id^='b']");
  floorButtonsId = Array.from(floorButtonsId).map((element) => element.id);
  floorButtonsId.filter((value, index, array) => {
    if (value == floorButtonId) {
      array.splice(index, 1);
      return true;
    }
    return false;
  });
  document.getElementById(floorButtonId).classList.add("selectedFloorButton");
  for (var i = 0; i < floorButtonsId.length; i++) {
    document
      .getElementById(floorButtonsId[i])
      .classList.remove("selectedFloorButton");
  }
};

const addFloorData = (school, floorButtonId, location) => {
  addDataToMap(
    school,
    parseInt(document.getElementById(floorButtonId).innerHTML),
    location
  );
};

const forceChange = (school, button, location) => {
  addFloorData(school, button, location);
  selectFloor(button);
};

/////////////////////////////////////////////////////////////////////////////////
/////////////////// Create buttons for displaying each floor ////////////////////
/////////////////////////////////////////////////////////////////////////////////

document.getElementById("bLoc").onclick = function () {
  locateMe();
};

/////////////////////////////////////////////////////////////////////////////////
////////////////// Export functions to go to a specific campus //////////////////
/////////////////////////////////////////////////////////////////////////////////

export const goTo = (campus, options = {}) => {
  if(!(campus in campuses)) {
    return;
  }

  const preserveView = !!options.preserveView;
  var campus_info = campuses[campus];
  location = campus;
  removeSearchContainerElements();
  if (!preserveView) {
    map.setView(campus_info["center"], campus_info["zoom"]);
  }
  // select in js all elements with id b*
  var floorButtons = document.querySelectorAll("[id^='b']");
  
  for (var i = 0; i < floorButtons.length; i++) {
    if(floorButtons[i].id == "bLoc" || floorButtons[i].id == "buttons-container" || floorButtons[i].id == "floorButtons-container") continue;
    floorButtons[i].remove();
  }
  // create new buttons
  for(var i = 0; i < campus_info["floors"].length; i++) {
    var button = document.createElement("button");
    button.id = "b" + i;
    
    button.innerHTML = parseInt(campus_info["floors"][i]);
    button.classList.add("floorButton");
    
    document.getElementById("floorButtons-container").appendChild(button);
  }

  showSearch(location, campus_info["school"]);
  setCookie("location", location, 365);

  document.querySelectorAll("[id^='b']").forEach((button) => {
    if(button.id == "bLoc" || button.id == "buttons-container" || button.id == "floorButtons-container") return;
    
    button.onclick = function () {
      forceChange(campus_info["school"], button.id, location);
    };
  });

  return;
};

export const setDefaultFloor = (campus) => {
  if(!(campus in campuses)) {
    return;
  }
  
  forceChange(campuses[campus]["school"], campuses[campus]["defaultFloor"], campus);
  return;
};
export const refreshCurrentMapData = () => {
  if (!(location in campuses)) {
    return;
  }

  const selectedFloorButton = document.getElementsByClassName("selectedFloorButton")[0];
  if (!selectedFloorButton) {
    return;
  }

  const campusInfo = campuses[location];
  const currentFloor = parseInt(selectedFloorButton.innerHTML, 10);

  resetSoteroSearchMetadataCaches();
  resetBuildingsCatalogCache();
  removeSearchContainerElements();
  showSearch(location, campusInfo["school"]);
  addDataToMap(campusInfo["school"], currentFloor, location);
};




