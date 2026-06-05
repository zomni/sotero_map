import { BACKEND_API_URL, map } from "../views/map.js";
import {
  closeCurrentPopup,
  currentOpenFeatureId,
} from "@app/featureDisplay";
import { refreshCurrentMapData } from "@app/goToCampus";
import { resetBuildingsCatalogCache } from "@app/addData";
import { resetSoteroSearchMetadataCaches } from "@app/soteroSearchMetadata";
import {
  getAdminMapToolsButtons,
  removeAdminMapToolsPanelIfEmpty,
  requestAdminMapToolMode,
  setAdminMapToolActiveMode,
  setAdminMapToolsStatus,
} from "@app/adminMapToolsPanel";

const controlsId = "building-geometry-editor-controls";
const editButtonId = "building-shape-editor-button";
const moveButtonId = "building-move-editor-button";

let activeMode = null;
let activeBuildingId = null;
let originalLatLngs = [];
let previewLayer = null;
let markerLayer = null;
let moveMarker = null;

const setStatus = (message) => {
  setAdminMapToolsStatus(message);
};

const cloneLatLng = (latlng) => L.latLng(latlng.lat, latlng.lng);

const normalizePolygonLatLngs = (layer) => {
  const latlngs = layer?.getLatLngs?.();
  if (!Array.isArray(latlngs) || latlngs.length === 0) return [];

  const ring = Array.isArray(latlngs[0]?.[0]) ? latlngs[0][0] : latlngs[0];
  return Array.isArray(ring) ? ring.map(cloneLatLng) : [];
};

const findFeatureLayerById = (featureId) => {
  let found = null;

  const inspect = (layer) => {
    if (found) return;

    if (layer?.feature?.properties?.id === featureId && typeof layer.getLatLngs === "function") {
      found = layer;
      return;
    }

    if (typeof layer?.eachLayer === "function") {
      layer.eachLayer(inspect);
    }
  };

  map.eachLayer(inspect);
  return found;
};

const clearEditorLayers = () => {
  if (previewLayer) {
    map.removeLayer(previewLayer);
    previewLayer = null;
  }

  if (markerLayer) {
    map.removeLayer(markerLayer);
    markerLayer = null;
  }

  if (moveMarker) {
    map.removeLayer(moveMarker);
    moveMarker = null;
  }
};

const redrawPreview = (latlngs) => {
  if (previewLayer) {
    previewLayer.setLatLngs(latlngs);
    return;
  }

  previewLayer = L.polygon(latlngs, {
    color: "#2d79a0",
    weight: 3,
    fillColor: "#2d79a0",
    fillOpacity: 0.22,
    dashArray: "6 6",
  }).addTo(map);
};

const getPreviewLatLngs = () => normalizePolygonLatLngs(previewLayer);

const latLngsToCoordinates = (latlngs) => {
  const coordinates = latlngs.map((point) => [point.lng, point.lat]);
  if (coordinates.length > 0) {
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coordinates.push([first[0], first[1]]);
    }
  }

  return coordinates;
};

const saveGeometry = async () => {
  const latlngs = getPreviewLatLngs();
  if (!activeBuildingId || latlngs.length < 3) {
    setStatus("Selecciona un edificio y deja al menos 3 puntos.");
    return;
  }

  try {
    const response = await fetch(`${BACKEND_API_URL}/api/building-geometry-overrides`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        buildingExternalId: activeBuildingId,
        coordinates: latLngsToCoordinates(latlngs),
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.message || "No se pudo guardar la geometria.");
    }

    resetSoteroSearchMetadataCaches();
    resetBuildingsCatalogCache();
    stopGeometryEditor();
    await refreshCurrentMapData();
  } catch (error) {
    setStatus(error.message || "Error guardando geometria.");
  }
};

const buildActionButtons = () => {
  const wrapper = document.createElement("div");
  wrapper.className = "building-geometry-active-actions";
  wrapper.innerHTML = `
    <button type="button" class="dashboard-link manual-building-editor-button" data-geometry-save>Guardar forma</button>
    <button type="button" class="dashboard-link" data-geometry-cancel>Cancelar</button>
  `;

  wrapper.querySelector("[data-geometry-save]")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    saveGeometry();
  });

  wrapper.querySelector("[data-geometry-cancel]")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    stopGeometryEditor();
  });

  return wrapper;
};

const setActiveControls = () => {
  const controls = document.getElementById(controlsId);
  if (!controls || controls.querySelector(".building-geometry-active-actions")) return;
  controls.appendChild(buildActionButtons());
};

const removeActiveControls = () => {
  document.querySelector(".building-geometry-active-actions")?.remove();
};

export const stopGeometryEditor = ({ clearActiveTool = true } = {}) => {
  activeMode = null;
  activeBuildingId = null;
  originalLatLngs = [];
  clearEditorLayers();
  removeActiveControls();
  document.getElementById(editButtonId)?.classList.remove("is-active");
  document.getElementById(moveButtonId)?.classList.remove("is-active");
  if (clearActiveTool) {
    setAdminMapToolActiveMode(null);
  }
  setStatus("");
};

const beginShapeEdit = (layer, featureId) => {
  if (!layer) {
    setStatus("Haz click sobre el edificio que quieres editar.");
    return;
  }

  stopGeometryEditor({ clearActiveTool: false });
  activeMode = "shape";
  activeBuildingId = featureId || layer?.feature?.properties?.id || "";
  originalLatLngs = normalizePolygonLatLngs(layer);

  if (originalLatLngs.length < 3) {
    activeMode = null;
    activeBuildingId = null;
    setAdminMapToolActiveMode(null);
    setStatus("Este edificio no tiene un poligono editable.");
    return;
  }

  closeCurrentPopup();
  map.closePopup?.();
  redrawPreview(originalLatLngs);

  markerLayer = L.layerGroup(
    originalLatLngs.map((point, index) => {
      const marker = L.marker(point, {
        draggable: true,
        zIndexOffset: 2000,
        icon: L.divIcon({
          className: "building-geometry-vertex-marker",
          html: "",
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
      });

      marker.on("drag", (event) => {
        const next = getPreviewLatLngs();
        next[index] = event.latlng;
        redrawPreview(next);
      });

      return marker;
    })
  ).addTo(map);

  document.getElementById(editButtonId)?.classList.add("is-active");
  setActiveControls();
  setStatus("Arrastra los puntos blancos y luego guarda la forma.");
};

const startShapeEdit = () => {
  stopGeometryEditor();
  requestAdminMapToolMode("geometry-shape");
  const layer = findFeatureLayerById(currentOpenFeatureId);
  if (layer) {
    beginShapeEdit(layer, currentOpenFeatureId);
    return;
  }

  activeMode = "shape-pending";
  setAdminMapToolActiveMode("geometry-shape");
  document.getElementById(editButtonId)?.classList.add("is-active");
  setStatus("Haz click sobre el edificio que quieres editar.");
};

const getPolygonCenter = (latlngs) => {
  const lat = latlngs.reduce((sum, point) => sum + point.lat, 0) / latlngs.length;
  const lng = latlngs.reduce((sum, point) => sum + point.lng, 0) / latlngs.length;
  return L.latLng(lat, lng);
};

const beginMoveEdit = (layer, featureId) => {
  if (!layer) {
    setStatus("Haz click sobre el edificio que quieres mover.");
    return;
  }

  stopGeometryEditor({ clearActiveTool: false });
  activeMode = "move";
  activeBuildingId = featureId || layer?.feature?.properties?.id || "";
  originalLatLngs = normalizePolygonLatLngs(layer);

  if (originalLatLngs.length < 3) {
    activeMode = null;
    activeBuildingId = null;
    setAdminMapToolActiveMode(null);
    setStatus("Este edificio no tiene un poligono editable.");
    return;
  }

  closeCurrentPopup();
  map.closePopup?.();
  redrawPreview(originalLatLngs);

  let previousCenter = getPolygonCenter(originalLatLngs);
  moveMarker = L.marker(previousCenter, {
    draggable: true,
    zIndexOffset: 2500,
    title: "Arrastra para mover el edificio",
    icon: L.divIcon({
      className: "building-geometry-move-marker",
      html: "",
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    }),
  }).addTo(map);

  moveMarker.on("drag", (event) => {
    const nextCenter = event.latlng;
    const deltaLat = nextCenter.lat - previousCenter.lat;
    const deltaLng = nextCenter.lng - previousCenter.lng;
    const moved = getPreviewLatLngs().map((point) => L.latLng(point.lat + deltaLat, point.lng + deltaLng));
    previousCenter = nextCenter;
    redrawPreview(moved);
  });

  document.getElementById(moveButtonId)?.classList.add("is-active");
  setActiveControls();
  setStatus("Arrastra el marcador para mover el edificio y luego guarda.");
};

const startMoveEdit = () => {
  stopGeometryEditor();
  requestAdminMapToolMode("geometry-move");
  const layer = findFeatureLayerById(currentOpenFeatureId);
  if (layer) {
    beginMoveEdit(layer, currentOpenFeatureId);
    return;
  }

  activeMode = "move-pending";
  setAdminMapToolActiveMode("geometry-move");
  document.getElementById(moveButtonId)?.classList.add("is-active");
  setStatus("Haz click sobre el edificio que quieres mover.");
};

const createGeometryControls = () => {
  const buttons = getAdminMapToolsButtons();
  if (!buttons || document.getElementById(controlsId)) return;

  const wrapper = document.createElement("div");
  wrapper.id = controlsId;
  wrapper.className = "admin-map-tools-group";

  const editButton = document.createElement("button");
  editButton.id = editButtonId;
  editButton.className = "dashboard-link manual-building-editor-button";
  editButton.type = "button";
  editButton.textContent = "Editar forma";
  editButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    startShapeEdit();
  });

  const moveButton = document.createElement("button");
  moveButton.id = moveButtonId;
  moveButton.className = "dashboard-link manual-building-editor-button";
  moveButton.type = "button";
  moveButton.textContent = "Mover edificio";
  moveButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    startMoveEdit();
  });

  wrapper.appendChild(editButton);
  wrapper.appendChild(moveButton);
  buttons.appendChild(wrapper);
};

const removeGeometryControls = () => {
  stopGeometryEditor();
  document.getElementById(controlsId)?.remove();
  removeAdminMapToolsPanelIfEmpty();
};

export const syncBuildingGeometryEditorForSession = (session) => {
  if (session?.isAdmin) {
    createGeometryControls();
  } else {
    removeGeometryControls();
  }
};

export const initBuildingGeometryEditor = async () => {
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/auth/session`, {
      credentials: "include",
      cache: "no-store",
    });
    const session = response.ok ? await response.json() : {};
    syncBuildingGeometryEditorForSession(session);
  } catch {
    syncBuildingGeometryEditorForSession({});
  }
};

window.addEventListener("sotero-session-changed", (event) => {
  syncBuildingGeometryEditorForSession(event.detail || {});
});

window.addEventListener("sotero-admin-map-tool-mode", (event) => {
  if (!["geometry-shape", "geometry-move"].includes(event.detail?.mode) && activeMode) {
    stopGeometryEditor({ clearActiveTool: false });
  }
});

window.addEventListener("sotero-building-layer-click", (event) => {
  if (activeMode === "shape-pending") {
    event.preventDefault();
    event.stopPropagation();
    beginShapeEdit(event.detail?.layer, event.detail?.featureId);
    return;
  }

  if (activeMode === "move-pending") {
    event.preventDefault();
    event.stopPropagation();
    beginMoveEdit(event.detail?.layer, event.detail?.featureId);
  }
});
