/////////////////////////////////////////////////////////////////////////////////
////////////////// Url search by id redirection to map feature //////////////////
/////////////////////////////////////////////////////////////////////////////////

import { goTo } from "../utils/goToCampus.js";

import { map, HOST_URL } from "../views/map.js";

import { reArrange } from "../utils/tools.js";

let url = new URL(window.location.href);

const findByUrl = (inputType, finder, campusSearch, zoom) => {
  // make use of search json it's lighter by 1.7 MB (now it s only 651KB)
  let findMe = null;
  let floorNumber = "";
  let button = "b";
  let elementName = "";
  if (zoom == null) {
    zoom = 19;
  }
  campusSearch.features.map((element) => {
    if (element.properties[inputType] == finder) {
      var link = `${HOST_URL}/?id=${element.properties.id}&zoom=20`;
      var copyButtonHtml = `<button class="floorButton copy-button" onclick='
        navigator.clipboard.writeText("${link}")
          .then(()=>{this.innerHTML="Lien copié &check;"})
          .catch(()=>{alert("Impossible de copier le lien : ${link}");});
        '>Copier le lien</button>`;

      findMe = { position: element.properties.center, location: element.properties.location };
      floorNumber = element.properties.floor;
      elementName =
        element.properties.name + ", étage "+ floorNumber.toString() + copyButtonHtml;
      if (element.properties.location === "metz") {
        // metz has a -1 floor but the buttons id are still b<0 to 4>
        floorNumber++;
      }
      else if (element.properties.location === "rennes") {
        // rennes starts at floor <1 to 5> but the buttons id are still b<0 to 4>
        floorNumber--;
      }
      button += floorNumber.toString(); // Craft the floor button id
    }
  });
  if (findMe !== null) {
    goTo(findMe.location);
    document.getElementById(button).click(); // Set current floor to match the searched item's floor
    L.marker(reArrange(findMe.position))
      .bindPopup(elementName, { closeOnClick: null })
      .addTo(map)
      .togglePopup();
    map.setView(reArrange(findMe.position), zoom);
  } else if (finder === null) {
  } else {
    alert("Element not found");
  }
};

const searchByUrlJson = () => {
  /* Get the GeoJSON from the server */
  $.ajax({
    url: "data/cs_searchByURL.json",
    type: "GET",
    data: {},
    dataType: "json",
    success: function (json) {
      findByUrl(
        "id",
        url.searchParams.get("id"),
        json,
        url.searchParams.get("zoom")
      );
    },
    error: function () {
      console.log("ERROR Failed to load JSON");
    },
  });
};


if (url.searchParams.get("id") != null) {
  searchByUrlJson();
}
