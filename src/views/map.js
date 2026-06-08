import "../lib/leaflet/leaflet.js";
import campuses from "../data/campuses.js";

const firstCampus = Object.keys(campuses)[0];
const firstCampusBounds = Array.isArray(campuses[firstCampus]?.bounds)
  ? L.latLngBounds(campuses[firstCampus].bounds)
  : null;

export const map = L.map("map", {
  zoomControl: false,
  attributionControl: false,
  maxBounds: firstCampusBounds ? firstCampusBounds.pad(0.02) : undefined,
  maxBoundsViscosity: 1.0,
}).setView(campuses[firstCampus].center, campuses[firstCampus].zoom);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  keepBuffer: 8,
  updateWhenIdle: false,
  updateWhenZooming: true,
}).addTo(map);

export const locateMe = () => {
  map.locate({ setView: true, maxZoom: 19 });
};

export const HOST_URL =
  window.location.protocol +
  "//" +
  window.location.hostname +
  (window.location.port ? ":" + window.location.port : "");

export const BACKEND_API_URL =
  window.location.protocol + "//" + window.location.hostname + ":5000";
