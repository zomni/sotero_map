import campuses from "../data/campuses.js";
import { BACKEND_API_URL, map } from "../views/map.js";
import { goTo } from "@app/goToCampus";
import { mergeCatalogWithSoteroSearch } from "@app/soteroSearchMetadata";
import { clearRouteHighlight, closeCurrentPopup, setRouteHighlight } from "@app/featureDisplay";

const DEFAULT_CAMPUS = Object.keys(campuses)[0] || "sotero";
const MAX_ATTEMPTS = 48;
const RETRY_DELAY_MS = 250;

let plannerElements = null;
let routeOverlayLayer = null;
let buildingsCache = null;
let walkingRoutesCache = null;
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

const normalizeRouteStatus = (status) => String(status || "open").trim().toLowerCase();

const loadWalkingRoutes = async () => {
  if (walkingRoutesCache) {
    return walkingRoutesCache;
  }

  try {
    const response = await fetch(`${BACKEND_API_URL}/api/walking-routes?campus=${encodeURIComponent(DEFAULT_CAMPUS)}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("No se pudo cargar la red caminable.");
    }

    const data = await response.json();
    const nodes = Array.isArray(data?.nodes) ? data.nodes : [];
    const edges = Array.isArray(data?.edges) ? data.edges : [];
    const nodesById = new Map(nodes.map((node) => [node.externalId, node]));

    walkingRoutesCache = { nodes, edges, nodesById };
    return walkingRoutesCache;
  } catch (error) {
    console.error("Error cargando rutas caminables:", error);
    walkingRoutesCache = { nodes: [], edges: [], nodesById: new Map() };
    return walkingRoutesCache;
  }
};

const resetWalkingRoutesCache = () => {
  walkingRoutesCache = null;
};

window.refreshWalkingRoutesCache = resetWalkingRoutesCache;

const nodeToLatLng = (node) => L.latLng(Number(node.latitude), Number(node.longitude));

const normalizePolygonLatLngs = (layer) => {
  const latlngs = layer?.getLatLngs?.();
  if (!Array.isArray(latlngs) || latlngs.length === 0) return [];

  const ring = Array.isArray(latlngs[0]?.[0]) ? latlngs[0][0] : latlngs[0];
  return Array.isArray(ring) ? ring : [];
};

const nearestPointOnSegment = (latlng, start, end) => {
  const point = map.latLngToLayerPoint(latlng);
  const startPoint = map.latLngToLayerPoint(start);
  const endPoint = map.latLngToLayerPoint(end);
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared <= 0 ? 0 : Math.max(0, Math.min(1, ((point.x - startPoint.x) * dx + (point.y - startPoint.y) * dy) / lengthSquared));
  return map.layerPointToLatLng(L.point(startPoint.x + t * dx, startPoint.y + t * dy));
};

const findNearestPointOnPolygonBoundary = (targetLatLng, layer) => {
  const ring = normalizePolygonLatLngs(layer);
  if (ring.length < 2) return null;

  let bestPoint = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < ring.length; index += 1) {
    const start = ring[index];
    const end = ring[(index + 1) % ring.length];
    const candidate = nearestPointOnSegment(targetLatLng, start, end);
    const distance = map.distance(targetLatLng, candidate);
    if (distance < bestDistance) {
      bestPoint = candidate;
      bestDistance = distance;
    }
  }

  return bestPoint;
};

const findNearestRouteNode = (latlng, nodes) => {
  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const node of nodes) {
    const nodeLatLng = nodeToLatLng(node);
    const distance = map.distance(latlng, nodeLatLng);
    if (distance < bestDistance) {
      best = node;
      bestDistance = distance;
    }
  }

  return best ? { node: best, distance: bestDistance } : null;
};

const buildRouteGraph = (network) => {
  const graph = new Map();

  for (const node of network.nodes) {
    graph.set(node.externalId, []);
  }

  for (const edge of network.edges) {
    const status = normalizeRouteStatus(edge.status);
    if (status === "closed") {
      continue;
    }

    const from = edge.fromNodeExternalId;
    const to = edge.toNodeExternalId;
    if (!graph.has(from) || !graph.has(to)) {
      continue;
    }

    const baseWeight = Number(edge.distanceMeters) || 1;
    const weight = status === "restricted" ? baseWeight * 1.8 : baseWeight;
    const entry = { to, edge, weight };
    const reverseEntry = { to: from, edge, weight };
    graph.get(from).push(entry);
    graph.get(to).push(reverseEntry);
  }

  return graph;
};

const calculateShortestRoute = (network, originNodeId, destinationNodeId) => {
  const graph = buildRouteGraph(network);
  const distances = new Map();
  const previous = new Map();
  const visited = new Set();
  const queue = new Set(graph.keys());

  graph.forEach((_, nodeId) => distances.set(nodeId, Number.POSITIVE_INFINITY));
  distances.set(originNodeId, 0);

  while (queue.size > 0) {
    let current = null;
    let currentDistance = Number.POSITIVE_INFINITY;

    for (const nodeId of queue) {
      const distance = distances.get(nodeId) ?? Number.POSITIVE_INFINITY;
      if (distance < currentDistance) {
        current = nodeId;
        currentDistance = distance;
      }
    }

    if (!current || currentDistance === Number.POSITIVE_INFINITY) {
      break;
    }

    queue.delete(current);
    visited.add(current);

    if (current === destinationNodeId) {
      break;
    }

    for (const next of graph.get(current) || []) {
      if (visited.has(next.to)) {
        continue;
      }

      const candidate = currentDistance + next.weight;
      if (candidate < (distances.get(next.to) ?? Number.POSITIVE_INFINITY)) {
        distances.set(next.to, candidate);
        previous.set(next.to, { nodeId: current, edge: next.edge });
      }
    }
  }

  if (!previous.has(destinationNodeId) && originNodeId !== destinationNodeId) {
    return null;
  }

  const nodeIds = [destinationNodeId];
  const edges = [];
  let cursor = destinationNodeId;

  while (cursor !== originNodeId) {
    const step = previous.get(cursor);
    if (!step) {
      return null;
    }

    edges.unshift(step.edge);
    cursor = step.nodeId;
    nodeIds.unshift(cursor);
  }

  return { nodeIds, edges, distance: distances.get(destinationNodeId) || 0 };
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

const getBuildingAccessLatLng = (building, layer, network) => {
  const fallback = getBuildingLatLng(building, layer);
  if (!fallback || !Array.isArray(network?.nodes) || network.nodes.length === 0) {
    return fallback;
  }

  const nearestToCenter = findNearestRouteNode(fallback, network.nodes);
  if (!nearestToCenter) {
    return fallback;
  }

  const routeLatLng = nodeToLatLng(nearestToCenter.node);
  return findNearestPointOnPolygonBoundary(routeLatLng, layer) || fallback;
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

  const network = await loadWalkingRoutes();
  const originLatLng = getBuildingAccessLatLng(originBuilding, originLayer, network);
  const destinationLatLng = getBuildingAccessLatLng(destinationBuilding, destinationLayer, network);

  if (!originLatLng || !destinationLatLng) {
    return null;
  }

  const nearestOrigin = findNearestRouteNode(originLatLng, network.nodes);
  const nearestDestination = findNearestRouteNode(destinationLatLng, network.nodes);
  const shortestRoute =
    nearestOrigin && nearestDestination
      ? calculateShortestRoute(network, nearestOrigin.node.externalId, nearestDestination.node.externalId)
      : null;

  if (shortestRoute) {
    const routeLatLngs = [
      originLatLng,
      ...shortestRoute.nodeIds
        .map((nodeId) => network.nodesById.get(nodeId))
        .filter(Boolean)
        .map(nodeToLatLng),
      destinationLatLng,
    ];
    const bounds = L.latLngBounds(routeLatLngs);
    const hasRestrictedSegments = shortestRoute.edges.some(
      (edge) => normalizeRouteStatus(edge.status) === "restricted"
    );

    return {
      originBuilding,
      destinationBuilding,
      originLatLng,
      destinationLatLng,
      routeLatLngs,
      routeEdges: shortestRoute.edges,
      hasWalkingNetwork: true,
      routeUnavailable: false,
      hasRestrictedSegments,
      bounds,
    };
  }

  if (network.nodes.length > 0 && nearestOrigin && nearestDestination) {
    return {
      originBuilding,
      destinationBuilding,
      originLatLng,
      destinationLatLng,
      routeLatLngs: [originLatLng, destinationLatLng],
      routeEdges: [],
      hasWalkingNetwork: true,
      routeUnavailable: true,
      hasRestrictedSegments: false,
      bounds: buildRouteBounds(originLatLng, destinationLatLng, originLayer, destinationLayer),
    };
  }

  return {
    originBuilding,
    destinationBuilding,
    originLatLng,
    destinationLatLng,
    routeLatLngs: [originLatLng, destinationLatLng],
    routeEdges: [],
    hasWalkingNetwork: false,
    routeUnavailable: false,
    hasRestrictedSegments: false,
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

  const {
    originLatLng,
    destinationLatLng,
    routeLatLngs,
    hasWalkingNetwork,
    routeUnavailable,
    hasRestrictedSegments,
  } = routeGeometry;

  clearRouteOverlay();
  const overlay = ensureRouteOverlayLayer();

  L.polyline(routeLatLngs, {
    color: routeUnavailable ? "#dc2626" : "#0f766e",
    weight: 5,
    opacity: 0.95,
    dashArray: !hasWalkingNetwork || routeUnavailable ? "12 10" : null,
    lineCap: "round",
    interactive: false,
  }).addTo(overlay);

  const arrowSegments = routeLatLngs.length > 1 ? routeLatLngs.slice(0, -1) : [originLatLng];
  [0.25, 0.5, 0.75].forEach((fraction) => {
    const segmentIndex = Math.min(
      arrowSegments.length - 1,
      Math.max(0, Math.floor((routeLatLngs.length - 1) * fraction))
    );
    const start = routeLatLngs[segmentIndex] || originLatLng;
    const end = routeLatLngs[segmentIndex + 1] || destinationLatLng;
    if (!routeUnavailable) {
      createArrowMarker(interpolateLatLng(start, end, 0.5), getArrowRotation(start, end)).addTo(overlay);
    }
  });

  const description = await buildRouteDescription(originId, destinationId);
  routeRequestInFlight = false;
  updateSubmitState();
  if (routeUnavailable) {
    setStatus(`No hay camino disponible entre ${description}. Revisa tramos cerrados o dibuja una alternativa.`, "error");
  } else if (!hasWalkingNetwork) {
    setStatus(`Ruta directa: ${description}. Dibuja rutas caminables para calcular un camino real.`, "warning");
  } else if (hasRestrictedSegments) {
    setStatus(`Ruta activa: ${description}. Incluye tramo(s) restringidos.`, "warning");
  } else {
    setStatus(`Ruta activa: ${description}.`, "success");
  }
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
    resetWalkingRoutesCache();
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
