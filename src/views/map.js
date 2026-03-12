/////////////////////////////////////////////////////////////////////////////////
///////////////////// Insert the map centered on PS's campus ////////////////////
/////////////////////////////////////////////////////////////////////////////////
import "../lib/leaflet/leaflet.js";
import campuses from "../data/campuses.js";
// Par défaut, le campus montré lors de l'ouverture de l'appli est le premier indiqué en config
var firstCampus = Object.keys(campuses)[0];
export var map = L.map("map", {
  zoomControl: false,
  attributionControl: false,
}).setView(campuses[firstCampus]["center"], campuses[firstCampus]["zoom"]);
// Import the tile from OSM, has to be replaced by our own tiles
L.tileLayer("https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png", {
  maxZoom: 20, // Maximum 19 avec openstreetmap.org, avec la version fr on arrive à 20 mais si on zoom plus on perd la carte
}).addTo(map);

export const locateMe = () => {
  // Locate the user on the map
  map.locate({ setView: true, maxZoom: 19 });
};

export const HOST_URL =
  window.location.protocol +
  "//" +
  window.location.hostname +
  (window.location.port ? ":" + window.location.port : "");
