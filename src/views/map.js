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

let locationTrackingActive = false;
let userLocationMarker = null;
let userAccuracyCircle = null;
let hasCenteredOnUser = false;

const userLocationIcon = L.divIcon({
  className: "user-location-marker-wrapper",
  html: '<span class="user-location-marker" aria-hidden="true"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const updateLocationButton = (state, message) => {
  const button = document.getElementById("bLoc");
  if (!button) return;

  button.classList.toggle("locationTrackingActive", state === "active");
  button.classList.toggle("locationTrackingError", state === "error");
  button.setAttribute("aria-pressed", String(state === "active"));
  button.title = message;
};

const clearLocationLayers = () => {
  if (userLocationMarker) {
    map.removeLayer(userLocationMarker);
    userLocationMarker = null;
  }

  if (userAccuracyCircle) {
    map.removeLayer(userAccuracyCircle);
    userAccuracyCircle = null;
  }
};

const handleLocationFound = (event) => {
  const position = event.latlng;
  const accuracy = Math.max(Number(event.accuracy) || 0, 1);

  if (!userLocationMarker) {
    userLocationMarker = L.marker(position, {
      icon: userLocationIcon,
      keyboard: false,
      zIndexOffset: 3000,
    })
      .bindTooltip("Tu ubicación", {
        direction: "top",
        offset: [0, -12],
      })
      .addTo(map);
  } else {
    userLocationMarker.setLatLng(position);
  }

  if (!userAccuracyCircle) {
    userAccuracyCircle = L.circle(position, {
      radius: accuracy,
      color: "#1677b8",
      weight: 1,
      opacity: 0.65,
      fillColor: "#3ba5e7",
      fillOpacity: 0.14,
      interactive: false,
    }).addTo(map);
  } else {
    userAccuracyCircle.setLatLng(position);
    userAccuracyCircle.setRadius(accuracy);
  }

  if (!hasCenteredOnUser) {
    map.setView(position, Math.max(map.getZoom(), 18), { animate: true });
    hasCenteredOnUser = true;
  } else if (!map.getBounds().pad(-0.2).contains(position)) {
    map.panTo(position, { animate: true, duration: 0.45 });
  }

  updateLocationButton(
    "active",
    `Siguiendo tu ubicación (precisión aproximada: ${Math.round(accuracy)} m)`
  );
};

const handleLocationError = (event) => {
  locationTrackingActive = false;
  hasCenteredOnUser = false;
  map.stopLocate();
  clearLocationLayers();
  updateLocationButton("error", event?.message || "No se pudo obtener tu ubicación");
  console.error("[ubicación] No se pudo iniciar el seguimiento:", event);
};

map.on("locationfound", handleLocationFound);
map.on("locationerror", handleLocationError);

export const stopLocationTracking = () => {
  locationTrackingActive = false;
  hasCenteredOnUser = false;
  map.stopLocate();
  clearLocationLayers();
  updateLocationButton("inactive", "Activar seguimiento de ubicación");
};

export const startLocationTracking = () => {
  locationTrackingActive = true;
  hasCenteredOnUser = false;
  updateLocationButton("active", "Buscando tu ubicación...");

  map.locate({
    watch: true,
    setView: false,
    enableHighAccuracy: true,
    maximumAge: 3000,
    timeout: 15000,
  });
};

export const toggleLocationTracking = () => {
  if (locationTrackingActive) {
    stopLocationTracking();
    return false;
  }

  startLocationTracking();
  return true;
};

export const HOST_URL =
  window.location.protocol +
  "//" +
  window.location.hostname +
  (window.location.port ? ":" + window.location.port : "");

export const BACKEND_API_URL =
  window.location.protocol + "//" + window.location.hostname + ":5000";
