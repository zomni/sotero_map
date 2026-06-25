import { map } from "../views/map.js";
import { loadWalkingRouteNetwork } from "../utils/walkingRouteStorage.js?v=20260608b";

const ROUTE_VISIBILITY_STORAGE_KEY = "sotero_map_walking_routes_visible";
let routesLayer = null;
let routesCache = null;
let routesVisible = window.sessionStorage?.getItem(ROUTE_VISIBILITY_STORAGE_KEY) === "true";

const ensureRoutesLayer = () => {
  if (!routesLayer) {
    routesLayer = L.layerGroup().addTo(map);
  }

  return routesLayer;
};

const edgeColor = (status) => {
  const normalized = String(status || "open").toLowerCase();
  if (normalized === "closed") return "#dc2626";
  if (normalized === "restricted") return "#f59e0b";
  return "#0f766e";
};

const loadRoutes = async () => {
  if (routesCache) return routesCache;

  routesCache = await loadWalkingRouteNetwork("sotero");
  return routesCache;
};

const updateButtonState = () => {
  const button = document.getElementById("walking-route-toggle");
  if (!button) return;

  button.textContent = routesVisible ? "Ocultar rutas" : "Mostrar rutas";
  button.setAttribute("aria-pressed", String(routesVisible));
  button.classList.toggle("is-muted", !routesVisible);
};

export const resetWalkingRoutesLayerCache = () => {
  routesCache = null;
};

export const hideWalkingRoutesLayer = () => {
  routesLayer?.clearLayers();
};

export const refreshWalkingRoutesLayer = async () => {
  resetWalkingRoutesLayerCache();
  if (!routesVisible) {
    hideWalkingRoutesLayer();
    updateButtonState();
    return;
  }

  await renderWalkingRoutesLayer();
};

export const renderWalkingRoutesLayer = async () => {
  const layer = ensureRoutesLayer();
  layer.clearLayers();

  if (!routesVisible) {
    updateButtonState();
    return;
  }

  try {
    const network = await loadRoutes();
    const nodesById = new Map((network.nodes || []).map((node) => [node.externalId, node]));

    for (const edge of network.edges || []) {
      const from = nodesById.get(edge.fromNodeExternalId);
      const to = nodesById.get(edge.toNodeExternalId);
      if (!from || !to) continue;

      L.polyline(
        [
          [from.latitude, from.longitude],
          [to.latitude, to.longitude],
        ],
        {
          color: edgeColor(edge.status),
          weight: 4,
          opacity: 0.72,
          dashArray: String(edge.status || "").toLowerCase() === "closed" ? "4 8" : null,
          interactive: false,
        }
      ).addTo(layer);
    }
  } catch (error) {
    console.error("Error mostrando rutas caminables:", error);
  } finally {
    updateButtonState();
  }
};

export const setWalkingRoutesVisible = async (isVisible) => {
  routesVisible = Boolean(isVisible);
  window.sessionStorage?.setItem(ROUTE_VISIBILITY_STORAGE_KEY, String(routesVisible));
  updateButtonState();

  if (routesVisible) {
    await renderWalkingRoutesLayer();
  } else {
    hideWalkingRoutesLayer();
  }
};

export const bindWalkingRouteToggleButton = (button) => {
  if (!button || button.dataset.bound === "true") return;

  button.dataset.bound = "true";
  L.DomEvent.disableClickPropagation(button);
  button.addEventListener("mousedown", (event) => event.stopPropagation());
  button.addEventListener("dblclick", (event) => event.stopPropagation());
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void setWalkingRoutesVisible(!routesVisible);
  });

  updateButtonState();
};

export const initWalkingRouteLayer = () => {
  updateButtonState();
  if (routesVisible) {
    void renderWalkingRoutesLayer();
  }
};

window.refreshVisibleWalkingRoutes = refreshWalkingRoutesLayer;
