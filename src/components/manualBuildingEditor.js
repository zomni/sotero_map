import { map, BACKEND_API_URL } from "../views/map.js";
import { refreshCurrentMapData } from "@app/goToCampus";
import { resetBuildingsCatalogCache } from "@app/addData";
import { resetSoteroSearchMetadataCaches } from "@app/soteroSearchMetadata";
import {
  getAdminMapToolsButtons,
  removeAdminMapToolsPanelIfEmpty,
  requestAdminMapToolMode,
  setAdminMapToolsStatus,
} from "@app/adminMapToolsPanel";

let isDrawing = false;
let points = [];
let previewLayer = null;
let markerLayer = null;
let modalRoot = null;

const editorStatusId = "manual-building-editor-status";
const editorButtonId = "manual-building-editor-toggle";

const getEditorButton = () => document.getElementById(editorButtonId);
const getEditorControls = () => document.getElementById("manual-building-editor-controls");

const setStatus = (message) => {
  setAdminMapToolsStatus(message);
};

const clearPreview = () => {
  if (previewLayer) {
    map.removeLayer(previewLayer);
    previewLayer = null;
  }

  if (markerLayer) {
    map.removeLayer(markerLayer);
    markerLayer = null;
  }
};

const redrawPreview = () => {
  clearPreview();

  markerLayer = L.layerGroup(
    points.map((point) =>
      L.circleMarker(point, {
        radius: 5,
        color: "#0f766e",
        weight: 2,
        fillColor: "#99f6e4",
        fillOpacity: 0.9,
      })
    )
  ).addTo(map);

  if (points.length >= 2) {
    previewLayer = L.polyline(points, {
      color: "#0f766e",
      weight: 3,
      dashArray: "6 6",
    }).addTo(map);
  }
};

const buildDefaultId = () => `MAN-BLD-${Date.now().toString().slice(-6)}`;

const removeModal = () => {
  modalRoot?.remove();
  modalRoot = null;
};

const getFormValue = (form, name) => String(form.elements[name]?.value || "").trim();

const submitManualBuildingForm = async (form) => {
  const externalId = getFormValue(form, "externalId");
  const displayName = getFormValue(form, "displayName");
  const campus = getFormValue(form, "campus") || "sotero";
  const floorsCsv = getFormValue(form, "floorsCsv") || "0, 1";
  const type = getFormValue(form, "type") || "manual";
  const notes = getFormValue(form, "notes");
  const coordinates = points.map((point) => [point.lng, point.lat]);

  if (!externalId || !displayName) {
    setStatus("Completa ID y nombre del edificio.");
    return;
  }

  try {
    const response = await fetch(`${BACKEND_API_URL}/api/manual-buildings`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        externalId,
        campus,
        displayName,
        floorsCsv,
        type,
        notes,
        coordinates,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.message || "No se pudo guardar el edificio manual.");
    }

    removeModal();
    stopDrawing();
    resetSoteroSearchMetadataCaches();
    resetBuildingsCatalogCache();
    refreshCurrentMapData();
    setStatus("Edificio manual guardado correctamente.");
  } catch (error) {
    setStatus(error.message || "Error guardando edificio manual.");
  }
};

const openManualBuildingForm = () => {
  removeModal();

  modalRoot = document.createElement("div");
  modalRoot.className = "manual-building-modal-backdrop";
  modalRoot.innerHTML = `
    <div class="manual-building-modal" role="dialog" aria-modal="true" aria-label="Agregar edificio">
      <div class="manual-building-modal-header">
        <div>
          <div class="manual-building-modal-title">Agregar edificio</div>
          <div class="manual-building-modal-subtitle">${points.length} puntos marcados en el mapa</div>
        </div>
        <button type="button" class="manual-building-icon-button" data-manual-building-close>&times;</button>
      </div>
      <form class="manual-building-form">
        <label>
          <span>ID</span>
          <input name="externalId" value="${buildDefaultId()}" required />
        </label>
        <label>
          <span>Nombre</span>
          <input name="displayName" value="Nuevo edificio manual" required />
        </label>
        <label>
          <span>Campus</span>
          <input name="campus" value="sotero" />
        </label>
        <label>
          <span>Pisos</span>
          <input name="floorsCsv" value="0, 1" />
        </label>
        <label>
          <span>Tipo</span>
          <input name="type" value="manual" />
        </label>
        <label>
          <span>Notas</span>
          <textarea name="notes" rows="3"></textarea>
        </label>
        <div class="manual-building-modal-actions">
          <button type="button" class="manual-building-secondary" data-manual-building-cancel>Cancelar</button>
          <button type="submit" class="manual-building-primary">Guardar edificio</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modalRoot);

  const form = modalRoot.querySelector("form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitManualBuildingForm(form);
  });

  modalRoot.querySelector("[data-manual-building-close]")?.addEventListener("click", removeModal);
  modalRoot.querySelector("[data-manual-building-cancel]")?.addEventListener("click", removeModal);
};

const stopDrawing = () => {
  isDrawing = false;
  points = [];
  clearPreview();
  map.off("click", handleMapClick);
  map.off("dblclick", finishPolygon);
  map.doubleClickZoom.enable();
  getEditorButton()?.classList.remove("is-active");
};

async function finishPolygon(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  event?.originalEvent?.preventDefault?.();
  event?.originalEvent?.stopPropagation?.();

  if (!isDrawing || points.length < 3) {
    setStatus("Marca al menos 3 puntos para cerrar el poligono.");
    return;
  }

  openManualBuildingForm();
}

function handleMapClick(event) {
  if (!isDrawing) return;

  points.push(event.latlng);
  redrawPreview();
  setStatus(`${points.length} punto(s). Doble clic o Cerrar poligono para terminar.`);
}

const startDrawing = () => {
  requestAdminMapToolMode("manual-building");
  stopDrawing();
  isDrawing = true;
  points = [];
  map.doubleClickZoom.disable();
  map.on("click", handleMapClick);
  map.on("dblclick", finishPolygon);
  getEditorButton()?.classList.add("is-active");
  setStatus("Modo agregar edificio: marca puntos en el mapa.");
};

const toggleDrawing = () => {
  if (isDrawing) {
    stopDrawing();
    setStatus("");
    return;
  }

  startDrawing();
};

const createEditorControls = () => {
  const buttons = getAdminMapToolsButtons();
  if (!buttons || getEditorButton()) return;

  const wrapper = document.createElement("div");
  wrapper.id = "manual-building-editor-controls";
  wrapper.className = "admin-map-tools-group";

  const button = document.createElement("button");
  button.id = editorButtonId;
  button.className = "dashboard-link manual-building-editor-button";
  button.type = "button";
  button.textContent = "Agregar edificio";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleDrawing();
  });

  const finishButton = document.createElement("button");
  finishButton.className = "dashboard-link manual-building-editor-button";
  finishButton.type = "button";
  finishButton.textContent = "Cerrar poligono";
  finishButton.addEventListener("click", finishPolygon);

  wrapper.appendChild(button);
  wrapper.appendChild(finishButton);
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

    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
};

export const initManualBuildingEditor = async () => {
  const session = await loadSession();
  syncManualBuildingEditorForSession(session);
};

export const syncManualBuildingEditorForSession = (session) => {
  if (session?.isAdmin) {
    createEditorControls();
  } else {
    removeEditorControls();
  }
};

window.addEventListener("sotero-session-changed", (event) => {
  syncManualBuildingEditorForSession(event.detail || {});
});

window.addEventListener("sotero-admin-map-tool-mode", (event) => {
  if (event.detail?.mode !== "manual-building" && isDrawing) {
    stopDrawing();
  }
});
