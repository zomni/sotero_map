import { BACKEND_API_URL, map } from "../views/map.js";
import {
  getAdminMapToolsButtons,
  removeAdminMapToolsPanelIfEmpty,
  requestAdminMapToolMode,
  setAdminMapToolActiveMode,
  setAdminMapToolsStatus,
} from "@app/adminMapToolsPanel";
import { refreshWalkingRoutesLayer } from "@app/walkingRouteLayer";

const controlsId = "walking-route-editor-controls";
const editorButtonId = "walking-route-editor-toggle";
const deleteButtonId = "walking-route-delete-toggle";
const activeActionsClass = "walking-route-active-actions";

let isDrawing = false;
let isDeleteMode = false;
let points = [];
let previewLayer = null;
let pointsLayer = null;
let routesLayer = null;
let modalRoot = null;
let routeNetworkCache = null;

const setStatus = (message) => setAdminMapToolsStatus(message);
const getEditorButton = () => document.getElementById(editorButtonId);
const getDeleteButton = () => document.getElementById(deleteButtonId);
const getEditorControls = () => document.getElementById(controlsId);

const stopEvent = (event) => {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  event?.originalEvent?.preventDefault?.();
  event?.originalEvent?.stopPropagation?.();
};

const clearPreview = () => {
  if (previewLayer) {
    map.removeLayer(previewLayer);
    previewLayer = null;
  }

  if (pointsLayer) {
    map.removeLayer(pointsLayer);
    pointsLayer = null;
  }
};

const removeModal = () => {
  modalRoot?.remove();
  modalRoot = null;
};

const removeActiveControls = () => {
  document.querySelector(`.${activeActionsClass}`)?.remove();
};

const redrawPreview = () => {
  clearPreview();

  pointsLayer = L.layerGroup(
    points.map((point) =>
      L.circleMarker(point, {
        radius: 5,
        color: "#0f766e",
        weight: 2,
        fillColor: "#ccfbf1",
        fillOpacity: 1,
      })
    )
  ).addTo(map);

  if (points.length >= 2) {
    previewLayer = L.polyline(points, {
      color: "#0f766e",
      weight: 4,
      dashArray: "8 8",
      lineCap: "round",
    }).addTo(map);
  }
};

const loadRoutes = async () => {
  if (routeNetworkCache) return routeNetworkCache;

  const response = await fetch(`${BACKEND_API_URL}/api/walking-routes?campus=sotero`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("No se pudieron cargar las rutas caminables.");
  }

  routeNetworkCache = await response.json();
  return routeNetworkCache;
};

const resetRoutesCache = () => {
  routeNetworkCache = null;
  window.refreshWalkingRoutesCache?.();
};

const edgeColor = (status) => {
  const normalized = String(status || "open").toLowerCase();
  if (normalized === "closed") return "#dc2626";
  if (normalized === "restricted") return "#f59e0b";
  return "#0f766e";
};

const renderRoutesLayer = async ({ deleteMode = isDeleteMode } = {}) => {
  if (!routesLayer) {
    routesLayer = L.layerGroup().addTo(map);
  }

  routesLayer.clearLayers();

  try {
    const network = await loadRoutes();
    const nodesById = new Map((network.nodes || []).map((node) => [node.externalId, node]));

    for (const edge of network.edges || []) {
      const from = nodesById.get(edge.fromNodeExternalId);
      const to = nodesById.get(edge.toNodeExternalId);
      if (!from || !to) continue;

      const polyline = L.polyline(
        [
          [from.latitude, from.longitude],
          [to.latitude, to.longitude],
        ],
        {
          color: deleteMode ? "#b91c1c" : edgeColor(edge.status),
          weight: deleteMode ? 7 : 5,
          opacity: deleteMode ? 0.88 : 0.78,
          dashArray: String(edge.status).toLowerCase() === "closed" ? "4 8" : null,
        }
      );

      polyline.on("click", (event) => {
        stopEvent(event);
        if (deleteMode) {
          void confirmDeleteEdge(edge);
        } else {
          openEdgeModal(edge);
        }
      });

      polyline.addTo(routesLayer);
    }
  } catch (error) {
    setStatus(error.message || "No se pudieron cargar rutas caminables.");
  }
};

const hideRoutesLayer = () => {
  if (routesLayer) {
    routesLayer.clearLayers();
  }
};

const savePath = async (status, notes) => {
  const coordinates = points.map((point) => [point.lng, point.lat]);
  const response = await fetch(`${BACKEND_API_URL}/api/walking-routes/paths`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      campus: "sotero",
      status,
      notes,
      coordinates,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.message || "No se pudo guardar la ruta.");
  }
};

const openPathModal = () => {
  removeModal();

  if (points.length < 2) {
    setStatus("Marca al menos 2 puntos para guardar una ruta caminable.");
    return;
  }

  modalRoot = document.createElement("div");
  modalRoot.className = "manual-building-modal-backdrop";
  modalRoot.innerHTML = `
    <div class="manual-building-modal" role="dialog" aria-modal="true" aria-label="Guardar ruta caminable">
      <div class="manual-building-modal-header">
        <div>
          <div class="manual-building-modal-title">Guardar ruta caminable</div>
          <div class="manual-building-modal-subtitle">${points.length} puntos marcados</div>
        </div>
        <button type="button" class="manual-building-icon-button" data-route-close>&times;</button>
      </div>
      <form class="manual-building-form">
        <label>
          <span>Estado</span>
          <select name="status" class="walking-route-select">
            <option value="open">Abierta</option>
            <option value="restricted">Restringida / con aviso</option>
            <option value="closed">Cerrada / cortada</option>
          </select>
        </label>
        <label>
          <span>Notas</span>
          <textarea name="notes" rows="3" placeholder="Ej: Pasillo principal, acceso temporal, obra, etc."></textarea>
        </label>
        <div class="manual-building-modal-actions">
          <button type="button" class="manual-building-secondary" data-route-cancel>Cancelar</button>
          <button type="submit" class="manual-building-primary">Guardar ruta</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modalRoot);
  const form = modalRoot.querySelector("form");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
      const formData = new FormData(form);
      try {
        await savePath(String(formData.get("status") || "open"), String(formData.get("notes") || ""));
        removeModal();
        points = [];
        clearPreview();
        resetRoutesCache();
        await refreshWalkingRoutesLayer();
        await renderRoutesLayer();
        await window.acknowledgeCurrentMapSyncState?.();
        setStatus("Ruta caminable guardada. Puedes seguir marcando otra ruta.");
      } catch (error) {
      setStatus(error.message || "No se pudo guardar la ruta.");
    }
  });

  modalRoot.querySelector("[data-route-close]")?.addEventListener("click", removeModal);
  modalRoot.querySelector("[data-route-cancel]")?.addEventListener("click", removeModal);
};

const updateEdge = async (edgeExternalId, status, notes) => {
  const response = await fetch(`${BACKEND_API_URL}/api/walking-routes/edges/${encodeURIComponent(edgeExternalId)}`, {
    method: "PUT",
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status, notes }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.message || "No se pudo actualizar el tramo.");
  }
};

const deleteEdge = async (edgeExternalId) => {
  const response = await fetch(`${BACKEND_API_URL}/api/walking-routes/edges/${encodeURIComponent(edgeExternalId)}`, {
    method: "DELETE",
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.message || "No se pudo eliminar el tramo.");
  }
};

const confirmDeleteEdge = async (edge) => {
  if (!window.confirm("¿Estas seguro que quieres borrar esta ruta?")) return;

  try {
    await deleteEdge(edge.externalId);
    removeModal();
    resetRoutesCache();
    await refreshWalkingRoutesLayer();
    await renderRoutesLayer({ deleteMode: true });
    await window.acknowledgeCurrentMapSyncState?.();
    setStatus("Ruta eliminada. Puedes seguir borrando otra ruta.");
  } catch (error) {
    setStatus(error.message || "No se pudo eliminar la ruta.");
  }
};

const openEdgeModal = (edge) => {
  removeModal();
  modalRoot = document.createElement("div");
  modalRoot.className = "manual-building-modal-backdrop";
  modalRoot.innerHTML = `
    <div class="manual-building-modal" role="dialog" aria-modal="true" aria-label="Editar tramo caminable">
      <div class="manual-building-modal-header">
        <div>
          <div class="manual-building-modal-title">Editar tramo</div>
          <div class="manual-building-modal-subtitle">${edge.externalId}</div>
        </div>
        <button type="button" class="manual-building-icon-button" data-route-close>&times;</button>
      </div>
      <form class="manual-building-form">
        <label>
          <span>Estado</span>
          <select name="status" class="walking-route-select">
            <option value="open">Abierta</option>
            <option value="restricted">Restringida / con aviso</option>
            <option value="closed">Cerrada / cortada</option>
          </select>
        </label>
        <label>
          <span>Notas</span>
          <textarea name="notes" rows="3"></textarea>
        </label>
        <div class="manual-building-modal-actions">
          <button type="button" class="manual-building-secondary" data-route-delete>Eliminar tramo</button>
          <button type="submit" class="manual-building-primary">Guardar estado</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modalRoot);
  const form = modalRoot.querySelector("form");
  form.elements.status.value = String(edge.status || "open").toLowerCase();
  form.elements.notes.value = edge.notes || "";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    try {
      await updateEdge(edge.externalId, String(formData.get("status") || "open"), String(formData.get("notes") || ""));
      removeModal();
      resetRoutesCache();
      await refreshWalkingRoutesLayer();
      await renderRoutesLayer();
      await window.acknowledgeCurrentMapSyncState?.();
      setStatus("Tramo actualizado. Los caminos cerrados ya no se usaran al calcular rutas.");
    } catch (error) {
      setStatus(error.message || "No se pudo actualizar el tramo.");
    }
  });

  modalRoot.querySelector("[data-route-close]")?.addEventListener("click", removeModal);
  modalRoot.querySelector("[data-route-delete]")?.addEventListener("click", async () => {
    try {
      await deleteEdge(edge.externalId);
      removeModal();
      resetRoutesCache();
      await refreshWalkingRoutesLayer();
      await renderRoutesLayer();
      await window.acknowledgeCurrentMapSyncState?.();
      setStatus("Tramo eliminado.");
    } catch (error) {
      setStatus(error.message || "No se pudo eliminar el tramo.");
    }
  });
};

const buildActionButtons = () => {
  const wrapper = document.createElement("div");
  wrapper.className = `${activeActionsClass} building-geometry-active-actions`;
  wrapper.innerHTML = `
    <button type="button" class="dashboard-link manual-building-editor-button" data-route-save>Guardar ruta</button>
    <button type="button" class="dashboard-link" data-route-cancel>Cancelar</button>
  `;

  wrapper.querySelector("[data-route-save]")?.addEventListener("click", (event) => {
    stopEvent(event);
    openPathModal();
  });
  wrapper.querySelector("[data-route-cancel]")?.addEventListener("click", (event) => {
    stopEvent(event);
    stopDrawing();
    setStatus("");
  });

  return wrapper;
};

const setActiveControls = () => {
  const buttons = getAdminMapToolsButtons();
  if (!buttons || buttons.querySelector(`.${activeActionsClass}`)) return;
  buttons.appendChild(buildActionButtons());
};

const stopDrawing = ({ clearActiveTool = true } = {}) => {
  isDrawing = false;
  isDeleteMode = false;
  points = [];
  clearPreview();
  removeActiveControls();
  map.off("click", handleMapClick);
  map.doubleClickZoom.enable();
  getEditorButton()?.classList.remove("is-active");
  getDeleteButton()?.classList.remove("is-active");
  if (clearActiveTool) {
    setAdminMapToolActiveMode(null);
    hideRoutesLayer();
  }
};

function handleMapClick(event) {
  if (!isDrawing) return;
  points.push(event.latlng);
  redrawPreview();
  setStatus(`${points.length} punto(s). Guarda la ruta cuando termines.`);
}

const startDrawing = async () => {
  stopDrawing();
  requestAdminMapToolMode("walking-routes");
  isDrawing = true;
  isDeleteMode = false;
  points = [];
  map.doubleClickZoom.disable();
  map.on("click", handleMapClick);
  getEditorButton()?.classList.add("is-active");
  setActiveControls();
  await renderRoutesLayer();
  setStatus("Modo rutas: marca puntos para crear caminos. Haz click en un tramo existente para cambiar su estado.");
};

const startDeleteMode = async () => {
  stopDrawing();
  requestAdminMapToolMode("walking-route-delete");
  isDeleteMode = true;
  points = [];
  getDeleteButton()?.classList.add("is-active");
  await renderRoutesLayer({ deleteMode: true });
  setStatus("Modo eliminar rutas: haz click en una ruta y confirma para borrarla.");
};

const toggleDrawing = () => {
  if (isDrawing) {
    stopDrawing();
    setStatus("");
    return;
  }

  void startDrawing();
};

const toggleDeleteMode = () => {
  if (isDeleteMode) {
    stopDrawing();
    setStatus("");
    return;
  }

  void startDeleteMode();
};

const createEditorControls = () => {
  const buttons = getAdminMapToolsButtons();
  if (!buttons || getEditorButton()) return;

  const wrapper = document.createElement("div");
  wrapper.id = controlsId;
  wrapper.className = "admin-map-tools-group";

  const button = document.createElement("button");
  button.id = editorButtonId;
  button.className = "dashboard-link manual-building-editor-button";
  button.type = "button";
  button.textContent = "Editar rutas";
  button.addEventListener("click", (event) => {
    stopEvent(event);
    toggleDrawing();
  });

  const deleteButton = document.createElement("button");
  deleteButton.id = deleteButtonId;
  deleteButton.className = "dashboard-link manual-building-editor-button";
  deleteButton.type = "button";
  deleteButton.textContent = "Eliminar ruta";
  deleteButton.addEventListener("click", (event) => {
    stopEvent(event);
    toggleDeleteMode();
  });

  wrapper.appendChild(button);
  wrapper.appendChild(deleteButton);
  buttons.appendChild(wrapper);
};

const removeEditorControls = () => {
  stopDrawing();
  removeModal();
  getEditorControls()?.remove();
  removeAdminMapToolsPanelIfEmpty();
};

const loadSession = async () => {
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/auth/session`, {
      credentials: "include",
      cache: "no-store",
    });
    return response.ok ? await response.json() : {};
  } catch {
    return {};
  }
};

export const syncWalkingRouteEditorForSession = (session) => {
  if (session?.isAdmin) {
    createEditorControls();
  } else {
    removeEditorControls();
  }
};

export const initWalkingRouteEditor = async () => {
  syncWalkingRouteEditorForSession(await loadSession());
};

window.addEventListener("sotero-session-changed", (event) => {
  syncWalkingRouteEditorForSession(event.detail || {});
});

window.addEventListener("sotero-admin-map-tool-mode", (event) => {
  const mode = event.detail?.mode;
  if (!["walking-routes", "walking-route-delete"].includes(mode) && (isDrawing || isDeleteMode)) {
    stopDrawing({ clearActiveTool: false });
    hideRoutesLayer();
  }
});
