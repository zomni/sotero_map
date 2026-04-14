import campuses from "../data/campuses.js";
import { map } from "../views/map.js";
import { goTo } from "@app/goToCampus";
import { mergeCatalogWithSoteroSearch } from "@app/soteroSearchMetadata";
import { clearRouteHighlight, closeCurrentPopup, setRouteHighlight } from "@app/featureDisplay";

const DEFAULT_CAMPUS = Object.keys(campuses)[0] || "sotero";
const MAX_ATTEMPTS = 48;
const RETRY_DELAY_MS = 250;

let plannerElements = null;
let routeOverlayLayer = null;
let buildingsCache = null;
let activeRoute = {
  originId: "",
  destinationId: "",
};
let activeRouteRequestId = 0;
let routeRequestInFlight = false;

const stopEventPropagation = (event) => {
  if (!event) return;
  event.stopPropagation();
};

const registerControlSurface = (element) => {
  if (!element || element.dataset.mapControlBound === "true") {
    return;
  }

  element.dataset.mapControlBound = "true";

  if (window.L?.DomEvent) {
    window.L.DomEvent.disableClickPropagation(element);
    window.L.DomEvent.disableScrollPropagation(element);
  }

  ["pointerdown", "mousedown", "touchstart", "dblclick", "click", "wheel"].forEach((eventName) => {
    element.addEventListener(eventName, stopEventPropagation, { passive: false });
  });
};

const getPlannerElements = () => {
  if (
    plannerElements &&
    plannerElements.toggleButton?.isConnected &&
    plannerElements.panel?.isConnected
  ) {
    return plannerElements;
  }

  const toggleButton = document.getElementById("route-planner-toggle");
  const panel = document.getElementById("route-planner-panel");
  const originSelect = document.getElementById("route-origin-select");
  const destinationSelect = document.getElementById("route-destination-select");
  const submitButton = document.getElementById("route-planner-submit");
  const clearButton = document.getElementById("route-planner-clear");
  const status = document.getElementById("route-planner-status");

  if (!toggleButton || !panel || !originSelect || !destinationSelect || !submitButton || !clearButton || !status) {
    return null;
  }

  plannerElements = {
    toggleButton,
    panel,
    originSelect,
    destinationSelect,
    submitButton,
    clearButton,
    status,
  };

  registerControlSurface(document.getElementById("top-container"));
  registerControlSurface(document.getElementById("map-status-panel"));
  registerControlSurface(panel);

  return plannerElements;
};

const ensureRouteOverlayLayer = () => {
  if (!routeOverlayLayer) {
    routeOverlayLayer = L.layerGroup().addTo(map);
  }

  return routeOverlayLayer;
};

const getBuildingDisplayName = (building) =>
  String(
    building?.displayName || building?.realName || building?.searchTitle || building?.shortName || building?.id || "Edificio"
  ).trim();

const getBuildingOptionLabel = (building) => `${getBuildingDisplayName(building)} (${building.id})`;

const buildCollator = () => new Intl.Collator("es", { sensitivity: "base", numeric: true });

const loadBuildingsCatalog = async () => {
  if (Array.isArray(buildingsCache)) {
    return buildingsCache;
  }

  try {
    const response = await fetch(`data/sotero_buildings_catalog.json?v=${Date.now()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("No se pudo cargar sotero_buildings_catalog.json");
    }

    const catalog = await response.json();
    const mergedCatalog = await mergeCatalogWithSoteroSearch(catalog);
    const collator = buildCollator();

    buildingsCache = [...(mergedCatalog?.buildings || [])].sort((a, b) =>
      collator.compare(getBuildingDisplayName(a), getBuildingDisplayName(b))
    );

    return buildingsCache;
  } catch (error) {
    console.error("Error cargando catalogo para rutas entre edificios:", error);
    buildingsCache = [];
    return buildingsCache;
  }
};

const findBuildingById = async (buildingId) => {
  const buildings = await loadBuildingsCatalog();
  return buildings.find((building) => building.id === buildingId) || null;
};

const setStatus = (message, tone = "neutral") => {
  const ui = getPlannerElements();
  if (!ui) return;

  ui.status.textContent = message;
  ui.status.dataset.tone = tone;
};

const updateSubmitState = () => {
  const ui = getPlannerElements();
  if (!ui) return;

  const hasOrigin = !!ui.originSelect.value;
  const hasDestination = !!ui.destinationSelect.value;
  ui.submitButton.disabled = routeRequestInFlight || !(hasOrigin && hasDestination);
};

const fillSelectOptions = (selectElement, buildings, selectedValue) => {
  if (!selectElement) return;

  selectElement.innerHTML = "";
  selectElement.append(new Option("Selecciona un edificio", ""));

  for (const building of buildings) {
    const option = new Option(getBuildingOptionLabel(building), building.id, false, building.id === selectedValue);
    selectElement.append(option);
  }
};

const populateBuildingSelectors = async (preserveSelection = true) => {
  const ui = getPlannerElements();
  if (!ui) return;

  const selectedOrigin = preserveSelection ? ui.originSelect.value : activeRoute.originId || "";
  const selectedDestination = preserveSelection ? ui.destinationSelect.value : activeRoute.destinationId || "";
  const buildings = await loadBuildingsCatalog();

  fillSelectOptions(ui.originSelect, buildings, selectedOrigin);
  fillSelectOptions(ui.destinationSelect, buildings, selectedDestination);
  updateSubmitState();
};

const togglePanel = async (forceOpen) => {
  const ui = getPlannerElements();
  if (!ui) return;

  const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : ui.panel.hidden;
  ui.panel.hidden = !shouldOpen;
  ui.toggleButton.setAttribute("aria-expanded", String(shouldOpen));

  if (shouldOpen) {
    await populateBuildingSelectors(true);
  }
};

const getFeatureLayerById = (featureId) => {
  let matchedLayer = null;

  map.eachLayer((layer) => {
    if (matchedLayer) {
      return;
    }

    if (layer?.feature?.properties?.id === featureId) {
      matchedLayer = layer;
      return;
    }

    if (typeof layer?.eachLayer === "function") {
      layer.eachLayer((childLayer) => {
        if (matchedLayer) {
          return;
        }

        if (childLayer?.feature?.properties?.id === featureId) {
          matchedLayer = childLayer;
        }
      });
    }
  });

  return matchedLayer;
};

const getFloorButtons = () =>
  Array.from(document.querySelectorAll("#floorButtons-container .floorButton")).filter(
    (button) => button.id !== "bLoc"
  );

const getFloorButtonForValue = (floorValue) => {
  const normalizedFloor = String(floorValue ?? "0").trim();
  return (
    getFloorButtons().find(
      (button) => String((button.textContent || "").trim()) === normalizedFloor
    ) || null
  );
};

const waitForFloorButtons = (callback, attempt = 0) => {
  const floorButtons = getFloorButtons();
  if (floorButtons.length > 0) {
    callback(floorButtons);
    return;
  }

  if (attempt >= MAX_ATTEMPTS) {
    console.warn("No se encontraron botones de piso para la ruta entre edificios.");
    callback([]);
    return;
  }

  window.setTimeout(() => waitForFloorButtons(callback, attempt + 1), RETRY_DELAY_MS);
};

const activateOverviewFloor = (requestId, callback) => {
  closeCurrentPopup();
  goTo(DEFAULT_CAMPUS, { preserveView: true });

  waitForFloorButtons((floorButtons) => {
    if (requestId !== activeRouteRequestId) {
      return;
    }

    const overviewButton = getFloorButtonForValue(0) || floorButtons[0] || null;

    if (!overviewButton) {
      callback();
      return;
    }

    overviewButton.click();
    window.setTimeout(() => {
      if (requestId !== activeRouteRequestId) {
        return;
      }
      callback();
    }, RETRY_DELAY_MS);
  });
};

const getBuildingLatLng = (building, layer) => {
  if (typeof layer?.getBounds === "function") {
    return layer.getBounds().getCenter();
  }

  if (typeof layer?.getLatLng === "function") {
    return layer.getLatLng();
  }

  if (Array.isArray(building?.centroid) && building.centroid.length >= 2) {
    return L.latLng(Number(building.centroid[1]), Number(building.centroid[0]));
  }

  return null;
};

const buildRouteBounds = (originLatLng, destinationLatLng, originLayer, destinationLayer) => {
  const bounds = L.latLngBounds([originLatLng, destinationLatLng]);

  if (typeof originLayer?.getBounds === "function") {
    bounds.extend(originLayer.getBounds());
  }

  if (typeof destinationLayer?.getBounds === "function") {
    bounds.extend(destinationLayer.getBounds());
  }

  return bounds;
};

const interpolateLatLng = (start, end, fraction) =>
  L.latLng(
    start.lat + (end.lat - start.lat) * fraction,
    start.lng + (end.lng - start.lng) * fraction
  );

const getArrowRotation = (originLatLng, destinationLatLng) => {
  const originPoint = map.latLngToLayerPoint(originLatLng);
  const destinationPoint = map.latLngToLayerPoint(destinationLatLng);
  return (Math.atan2(destinationPoint.y - originPoint.y, destinationPoint.x - originPoint.x) * 180) / Math.PI;
};

const createArrowMarker = (latlng, rotation) =>
  L.marker(latlng, {
    interactive: false,
    keyboard: false,
    icon: L.divIcon({
      className: "route-arrow-icon-container",
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      html: `
        <div class="route-arrow-marker" style="transform: rotate(${rotation}deg);">
          <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
            <path d="M4 14 H18" stroke="#0f766e" stroke-width="3.5" stroke-linecap="round" />
            <path d="M14 9 L20 14 L14 19" fill="none" stroke="#0f766e" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
      `,
    }),
  });

const clearRouteOverlay = () => {
  if (routeOverlayLayer) {
    routeOverlayLayer.clearLayers();
  }
};

const resolveRouteGeometry = async (originId, destinationId, originLayer, destinationLayer) => {
  const [originBuilding, destinationBuilding] = await Promise.all([
    findBuildingById(originId),
    findBuildingById(destinationId),
  ]);

  const originLatLng = getBuildingLatLng(originBuilding, originLayer);
  const destinationLatLng = getBuildingLatLng(destinationBuilding, destinationLayer);

  if (!originLatLng || !destinationLatLng) {
    return null;
  }

  return {
    originBuilding,
    destinationBuilding,
    originLatLng,
    destinationLatLng,
    bounds: buildRouteBounds(originLatLng, destinationLatLng, originLayer, destinationLayer),
  };
};

const focusRouteOnMap = async (originId, destinationId, originLayer, destinationLayer) => {
  const routeGeometry = await resolveRouteGeometry(originId, destinationId, originLayer, destinationLayer);
  if (!routeGeometry) {
    return null;
  }

  if (typeof map.stop === "function") {
    map.stop();
  }

  map.fitBounds(routeGeometry.bounds.pad(0.22), {
    maxZoom: 19,
    padding: [70, 70],
    animate: false,
  });

  return routeGeometry;
};

const buildRouteDescription = async (originId, destinationId) => {
  const [originBuilding, destinationBuilding] = await Promise.all([
    findBuildingById(originId),
    findBuildingById(destinationId),
  ]);

  return `${getBuildingDisplayName(originBuilding)} -> ${getBuildingDisplayName(destinationBuilding)}`;
};

const renderRoute = async (originId, destinationId, originLayer, destinationLayer, requestId = activeRouteRequestId) => {
  if (requestId !== activeRouteRequestId) {
    return;
  }

  const routeGeometry = await focusRouteOnMap(originId, destinationId, originLayer, destinationLayer);

  if (requestId !== activeRouteRequestId) {
    return;
  }

  if (!routeGeometry) {
    routeRequestInFlight = false;
    updateSubmitState();
    setStatus("No pude resolver la ubicacion de uno de los edificios.", "error");
    return;
  }

  const { originLatLng, destinationLatLng } = routeGeometry;

  clearRouteOverlay();
  const overlay = ensureRouteOverlayLayer();

  L.polyline([originLatLng, destinationLatLng], {
    color: "#0f766e",
    weight: 5,
    opacity: 0.95,
    dashArray: "12 10",
    lineCap: "round",
    interactive: false,
  }).addTo(overlay);

  const rotation = getArrowRotation(originLatLng, destinationLatLng);
  [0.28, 0.52, 0.76].forEach((fraction) => {
    createArrowMarker(interpolateLatLng(originLatLng, destinationLatLng, fraction), rotation).addTo(overlay);
  });

  const description = await buildRouteDescription(originId, destinationId);
  routeRequestInFlight = false;
  updateSubmitState();
  setStatus(`Ruta activa: ${description}.`, "success");
};

const handleSubmit = async () => {
  const ui = getPlannerElements();
  if (!ui) return;

  const originId = ui.originSelect.value;
  const destinationId = ui.destinationSelect.value;

  if (!originId || !destinationId) {
    setStatus("Selecciona origen y destino.", "warning");
    updateSubmitState();
    return;
  }

  if (originId === destinationId) {
    setStatus("El origen y el destino deben ser distintos.", "error");
    return;
  }

  activeRoute = { originId, destinationId };
  activeRouteRequestId += 1;
  routeRequestInFlight = true;
  const requestId = activeRouteRequestId;
  updateSubmitState();
  setRouteHighlight(originId, destinationId);
  setStatus("Preparando ruta sobre la vista general del campus...", "neutral");

  activateOverviewFloor(requestId, () => {
    if (requestId !== activeRouteRequestId) {
      return;
    }

    void renderRoute(
      originId,
      destinationId,
      getFeatureLayerById(originId),
      getFeatureLayerById(destinationId),
      requestId
    );
  });
};

const handleClear = () => {
  const ui = getPlannerElements();
  if (!ui) return;

  activeRouteRequestId += 1;
  routeRequestInFlight = false;
  activeRoute = { originId: "", destinationId: "" };
  ui.originSelect.value = "";
  ui.destinationSelect.value = "";
  clearRouteOverlay();
  clearRouteHighlight();
  updateSubmitState();
  setStatus("Sin ruta activa.", "neutral");
};

const attachPlannerEvents = () => {
  const ui = getPlannerElements();
  if (!ui || ui.panel.dataset.bound === "true") {
    return;
  }

  ui.panel.dataset.bound = "true";
  ui.toggleButton.addEventListener("click", () => {
    void togglePanel();
  });
  ui.originSelect.addEventListener("change", updateSubmitState);
  ui.destinationSelect.addEventListener("change", updateSubmitState);
  ui.submitButton.addEventListener("click", () => {
    void handleSubmit();
  });
  ui.clearButton.addEventListener("click", handleClear);
};

const initializeRoutePlanner = async () => {
  const ui = getPlannerElements();
  if (!ui) return;

  attachPlannerEvents();
  await populateBuildingSelectors(true);
  updateSubmitState();
  setStatus("Selecciona origen y destino.", "neutral");

  window.refreshRoutePlannerBuildings = async () => {
    buildingsCache = null;
    await populateBuildingSelectors(true);

    if (activeRoute.originId && activeRoute.destinationId) {
      const description = await buildRouteDescription(activeRoute.originId, activeRoute.destinationId);
      setStatus(`Ruta activa: ${description}.`, "success");
      return;
    }

    setStatus("Selecciona origen y destino.", "neutral");
  };
};

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", () => {
    void initializeRoutePlanner();
  }, { once: true });
} else {
  void initializeRoutePlanner();
}