/////////////////////////////////////////////////////////////////////////////////
///////////////////////// Add interactions with the map /////////////////////////
/////////////////////////////////////////////////////////////////////////////////

import { map, HOST_URL, BACKEND_API_URL } from "../views/map.js";
import { mergeCatalogWithSoteroSearch, resetSoteroSearchMetadataCaches } from "../utils/soteroSearchMetadata.js";
import { refreshCurrentMapData } from "../utils/goToCampus.js";
import { resetBuildingsCatalogCache } from "../utils/addData.js";

export let currentOpenFeatureId = null;
let currentOpenLayer = null;
let currentHoveredLayer = null;
let currentSelectedLayer = null;

export const setPopupViewForFeature = (featureId, viewKey) => {
  if (!featureId || !viewKey) return;
  popupViewState[featureId] = viewKey;
};

export const setPopupRoomForFeature = (featureId, roomId) => {
  if (!featureId) return;
  popupRoomState[featureId] = roomId || null;
};

export const setCurrentOpenFeatureId = (featureId) => {
  currentOpenFeatureId = featureId || null;
};

export const clearCurrentOpenFeatureId = () => {
  currentOpenFeatureId = null;
  currentOpenLayer = null;
};

export const closeCurrentPopup = () => {
  if (currentOpenLayer?.closePopup) {
    currentOpenLayer.closePopup();
  } else if (map?.closePopup) {
    map.closePopup();
  }

  clearCurrentOpenFeatureId();
};

map.on("click", (event) => {
  const originalTarget = event?.originalEvent?.target;
  const clickedInsideFeature =
    originalTarget?.closest?.(".leaflet-interactive") ||
    originalTarget?.closest?.(".leaflet-popup");

  if (!clickedInsideFeature) {
    closeCurrentPopup();
  }
});

const applyHighlightedStyle = (layer) => {
  if (!layer?.feature) return;

  const baseStyle = style(layer.feature) || {};
  const baseWeight = Number(baseStyle.weight);
  const baseFillOpacity = Number(baseStyle.fillOpacity);

  layer.setStyle({
    ...baseStyle,
    weight: Number.isFinite(baseWeight) ? Math.max(baseWeight, 5) : 5,
    color: "#666",
    dashArray: "",
    fillOpacity: Number.isFinite(baseFillOpacity) ? Math.max(baseFillOpacity, 0.7) : 0.7,
  });
};

const applyDefaultStyle = (layer) => {
  if (!layer?.feature) return;

  if (currentSelectedLayer === layer) {
    applyHighlightedStyle(layer);
    return;
  }

  layer.setStyle(style(layer.feature));
};

const setSelectedLayer = (layer) => {
  if (currentSelectedLayer && currentSelectedLayer !== layer) {
    currentSelectedLayer.setStyle(style(currentSelectedLayer.feature));
  }

  currentSelectedLayer = layer || null;

  if (!currentSelectedLayer) {
    return;
  }

  applyHighlightedStyle(currentSelectedLayer);

  if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
    currentSelectedLayer.bringToFront();
  }
};

const clearSelectedLayer = (layer = currentSelectedLayer) => {
  if (!layer) return;

  if (currentSelectedLayer === layer) {
    currentSelectedLayer = null;
  }

  layer.setStyle(style(layer.feature));
};

const clearHoveredLayer = () => {
  if (!currentHoveredLayer) return;
  applyDefaultStyle(currentHoveredLayer);
  currentHoveredLayer = null;
};

const popupViewState = {};
const popupRoomState = {};
let loadedEquipmentRevision = null;
let pendingEquipmentRevision = null;
let latestEquipmentSyncState = null;
let backendStatusPanel = null;
const EQUIPMENT_SYNC_POLL_MS = 30000;

const formatSyncTimestamp = (value) => {
  if (!value) return "Sin registros";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sin registros";
  }

  return date.toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const getBackendStatusPanelMarkup = () => `
  <div class="backend-status-header">
    <div class="backend-status-title-row">
      <span id="backend-status-indicator" class="backend-status-indicator"></span>
      <div>
        <div id="backend-status-text" class="backend-status-subtitle backend-status-inline">Consultando estado...</div>
      </div>
    </div>
    <button id="backend-refresh-button" type="button" class="backend-refresh-button" data-backend-refresh hidden>
      Actualizar mapa
    </button>
  </div>
  <div class="backend-status-body">
    <div class="backend-status-line">
      <span class="backend-status-label">Version</span>
      <span id="backend-version">Sin datos</span>
    </div>
    <div class="backend-status-line">
      <span class="backend-status-label">BDD</span>
      <span id="backend-last-change">Sin registros</span>
    </div>
    <div id="backend-sync-message" class="backend-status-message">No hay actualizaciones pendientes.</div>
  </div>
`;

const ensureBackendStatusPanel = () => {
  if (
    backendStatusPanel &&
    backendStatusPanel.root?.isConnected &&
    backendStatusPanel.statusText?.isConnected &&
    backendStatusPanel.message?.isConnected
  ) {
    return backendStatusPanel;
  }

  const root = document.getElementById("map-status-panel");
  if (!root) return null;

  if (!root.querySelector("#backend-status-text") || !root.querySelector("#backend-sync-message")) {
    root.innerHTML = getBackendStatusPanelMarkup();
  }

  const panel = {
    root,
    statusText: root.querySelector("#backend-status-text"),
    version: root.querySelector("#backend-version"),
    lastChange: root.querySelector("#backend-last-change"),
    message: root.querySelector("#backend-sync-message"),
    refreshButton: root.querySelector("#backend-refresh-button"),
    dashboardLink: document.getElementById("dashboard-link"),
  };

  if (panel.dashboardLink) {
    panel.dashboardLink.href = `${BACKEND_API_URL}/admin`;
  }

  panel.refreshButton?.addEventListener("click", async () => {
    loadedEquipmentRevision = pendingEquipmentRevision || loadedEquipmentRevision;
    pendingEquipmentRevision = null;
    resetSoteroSearchMetadataCaches();
    resetBuildingsCatalogCache();
    refreshCurrentMapData();
    updateBackendStatusPanel(latestEquipmentSyncState);
    await refreshCurrentPopup();
  });

  backendStatusPanel = panel;
  return panel;
};

const updateBackendStatusPanel = (syncState) => {
  const panel = ensureBackendStatusPanel();
  if (!panel) return;

  const isOnline = !!syncState;
  const hasPendingChanges = !!pendingEquipmentRevision;

  panel.root.dataset.backendState = isOnline ? "online" : "offline";
  panel.root.dataset.pendingChanges = hasPendingChanges ? "true" : "false";

  if (!isOnline) {
    panel.statusText.textContent = "Sin conexion con la API";
    panel.version.textContent = "Sin datos";
    panel.lastChange.textContent = "Sin registros";
    panel.message.textContent = "No hay actualizaciones pendientes.";
    panel.refreshButton.hidden = true;
    return;
  }

  panel.statusText.textContent = hasPendingChanges ? "API activa con cambios pendientes" : "API activa";
  panel.version.textContent = syncState.backendVersion || "Sin datos";
  panel.lastChange.textContent = formatSyncTimestamp(syncState.latestChangeUtc);
  panel.message.textContent = hasPendingChanges
    ? `Hay cambios pendientes. ${syncState.assignedItems ?? 0} equipo(s) asignados esperan refresco. Usa Actualizar mapa.`
    : "No hay actualizaciones pendientes.";
  panel.refreshButton.hidden = !hasPendingChanges;
};

const loadEquipmentSyncState = async () => {
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/inventory-import/sync-state`, {
      cache: "no-store",
    });

    if (!response.ok) {
      latestEquipmentSyncState = null;
      updateBackendStatusPanel(null);
      return null;
    }

    const syncState = await response.json();
    latestEquipmentSyncState = syncState;
    return syncState;
  } catch (error) {
    console.error("Error consultando sync-state de equipos:", error);
    latestEquipmentSyncState = null;
    updateBackendStatusPanel(null);
    return null;
  }
};

const checkEquipmentSyncState = async () => {
  const syncState = await loadEquipmentSyncState();
  const revision = syncState?.revision;

  if (!syncState || !revision) {
    updateBackendStatusPanel(syncState);
    return;
  }

  if (!loadedEquipmentRevision) {
    loadedEquipmentRevision = revision;
    pendingEquipmentRevision = null;
    updateBackendStatusPanel(syncState);
    return;
  }

  pendingEquipmentRevision = revision !== loadedEquipmentRevision ? revision : null;
  updateBackendStatusPanel(syncState);
};

const startEquipmentSyncMonitor = () => {
  ensureBackendStatusPanel();
  updateBackendStatusPanel(latestEquipmentSyncState);
  checkEquipmentSyncState();
  window.setInterval(() => {
    backendStatusPanel = null;
    checkEquipmentSyncState();
  }, EQUIPMENT_SYNC_POLL_MS);
};

const loadBuildingsCatalog = async () => {
  try {
    const response = await fetch(`data/sotero_buildings_catalog.json?v=${Date.now()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("No se pudo cargar sotero_buildings_catalog.json");
    }

    const catalog = await response.json();
    return await mergeCatalogWithSoteroSearch(catalog);
  } catch (error) {
    console.error("Error cargando catálogo de edificios:", error);
    return { buildings: [] };
  }
};

const findBuildingInCatalog = async (feature) => {
  const id = feature?.properties?.id;
  if (!id) return null;

  const catalog = await loadBuildingsCatalog();
  const buildings = catalog?.buildings || [];

  return buildings.find((building) => building.id === id) || null;
};

const loadBuildingDetail = async (building) => {
  if (!building) return null;

  try {
    const response = await fetch(
      `data/interiors/${building.id}/building_detail.json?v=${Date.now()}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error cargando building_detail de ${building.id}:`, error);
    return null;
  }
};

const loadBackendRoomsForBuilding = async (building) => {
  if (!building?.id) {
    return [];
  }

  try {
    const response = await fetch(
      `${BACKEND_API_URL}/api/synced-rooms?buildingExternalId=${encodeURIComponent(building.id)}`,
      { cache: "no-store" }
    );

    const items = response.ok ? await response.json() : [];
    return Array.isArray(items) ? items : [];
  } catch (error) {
    console.error(`Error cargando override de salas del backend de ${building.id}:`, error);
    return [];
  }
};

const mergeRoomsWithBackendOverrides = (localRooms, backendRooms) => {
  const backendRoomsById = new Map(backendRooms.map((room) => [room.externalId, room]));

  return localRooms.map((room) => {
    const backendRoom = backendRoomsById.get(room.roomId);
    if (!backendRoom) {
      return room;
    }

    return {
      ...room,
      name: backendRoom.name || room.name,
      floor: backendRoom.floor ?? room.floor,
      type: backendRoom.type || room.type,
      unit: backendRoom.unit || room.unit,
      service: backendRoom.service || room.service,
      status: backendRoom.status || room.status,
      responsibleArea: backendRoom.responsibleArea || room.responsibleArea,
      responsiblePerson: backendRoom.responsiblePerson || room.responsiblePerson,
    };
  });
};

const loadRoomsForBuilding = async (building) => {
  if (!building || !Array.isArray(building.floors) || building.floors.length === 0) {
    return [];
  }

  const roomFilePromises = building.floors.map(async (floor) => {
    try {
      const response = await fetch(
        `data/interiors/${building.id}/floor_${floor}_rooms.json?v=${Date.now()}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return Array.isArray(data.rooms) ? data.rooms : [];
    } catch (error) {
      console.error(`Error cargando salas de ${building.id} piso ${floor}:`, error);
      return [];
    }
  });

  const [roomsByFloor, backendRooms] = await Promise.all([
    Promise.all(roomFilePromises),
    loadBackendRoomsForBuilding(building),
  ]);

  return mergeRoomsWithBackendOverrides(roomsByFloor.flat(), backendRooms);
};

const loadBackendInventoryForBuilding = async (building) => {
  if (!building?.id) {
    return [];
  }

  try {
    const response = await fetch(
      `${BACKEND_API_URL}/api/inventory-import/items?assignedBuildingExternalId=${encodeURIComponent(
        building.id
      )}`,
      { cache: "no-store" }
    );

    const items = response.ok ? await response.json() : [];
    return Array.isArray(items) ? items : [];
  } catch (error) {
    console.error(`Error cargando inventory del backend de ${building.id}:`, error);
    return [];
  }
};

const loadBuildingActivity = async (building) => {
  if (!building?.id) {
    return [];
  }

  try {
    const response = await fetch(
      `${BACKEND_API_URL}/api/activity-log/building?buildingExternalId=${encodeURIComponent(building.id)}&take=6`,
      { cache: "no-store" }
    );

    const items = response.ok ? await response.json() : [];
    return Array.isArray(items) ? items : [];
  } catch (error) {
    console.error(`Error cargando actividad del edificio ${building.id}:`, error);
    return [];
  }
};

const normalizeImportedInventoryItems = (items) => {
  return items.map((item) => ({
    deviceId: item?.id ? `inventory-${item.id}` : `inventory-row-${item?.rowNumber || "na"}`,
    name: item?.serialNumber || item?.description || item?.itemNumber || "Equipo",
    type: item?.inferredCategory || "other",
    status: item?.inferredStatus || "active",
    ip: item?.ipAddress || "",
    roomId: item?.assignedRoomExternalId || "",
    assignedFloor:
      item?.assignedFloor === null || item?.assignedFloor === undefined || item?.assignedFloor === ""
        ? null
        : Number(item.assignedFloor),
    assignedTo: item?.responsibleUser || "",
    inventoryCode: item?.itemNumber || "",
    serialNumber: item?.serialNumber || "",
    description: item?.description || "",
    organizationalUnit: item?.organizationalUnit || "",
    unitOrDepartment: item?.unitOrDepartment || "",
    notes: item?.assignmentNotes || item?.observation || "",
    history: [],
  }));
};

const getFeatureDisplayName = (feature, building) => {
  if (building) {
    return (
      building.searchTitle ||
      building.realName ||
      building.displayName ||
      feature?.properties?.name ||
      feature?.properties?.sourceId ||
      "Edificio sin nombre"
    );
  }

  return (
    feature?.properties?.name ||
    feature?.properties?.sourceId ||
    "Edificio sin nombre"
  );
};

const escapeHtml = (value) => {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

const countDevicesByType = (devices) => {
  const counts = { pc: 0, printer: 0, scanner: 0, other: 0 };

  for (const device of devices) {
    const type = device?.type || "other";

    if (type === "pc") counts.pc += 1;
    else if (type === "printer") counts.printer += 1;
    else if (type === "scanner") counts.scanner += 1;
    else counts.other += 1;
  }

  return counts;
};

const buildRoomsMap = (rooms) => {
  const roomMap = new Map();
  for (const room of rooms) {
    roomMap.set(room.roomId, room);
  }
  return roomMap;
};

const filterRoomsByFloor = (rooms, floor) => {
  return rooms.filter((room) => Number(room.floor) === Number(floor));
};

const getDeviceFloor = (device, roomsMap) => {
  const assignedFloor = Number(device?.assignedFloor);
  if (Number.isFinite(assignedFloor)) {
    return assignedFloor;
  }

  if (device?.roomId && roomsMap.has(device.roomId)) {
    return Number(roomsMap.get(device.roomId)?.floor);
  }

  return null;
};

const filterDevicesByFloor = (devices, roomsInFloor, allRooms, floor) => {
  const roomIds = new Set(roomsInFloor.map((room) => room.roomId));
  const roomsMap = buildRoomsMap(allRooms);

  return devices.filter((device) => {
    if (device?.roomId && roomIds.has(device.roomId)) {
      return true;
    }

    const deviceFloor = getDeviceFloor(device, roomsMap);
    if (deviceFloor === null) {
      return true;
    }

    return Number(deviceFloor) === Number(floor);
  });
};

const getRecentEvents = (devices) => {
  const events = [];

  for (const device of devices) {
    const history = Array.isArray(device.history) ? device.history : [];

    for (const event of history) {
      events.push({
        deviceName: device.name || device.deviceId || "Equipo",
        date: event.date || "",
        type: event.type || "",
        description: event.description || "",
      });
    }
  }

  events.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return events;
};

const popupShellStyle = `
  min-width: 300px;
  max-width: 390px;
  max-height: 68vh;
  overflow-y: auto;
  line-height: 1.35;
  font-size: 13px;
  word-break: break-word;
  overflow-wrap: anywhere;
  padding-right: 2px;
`;

const sectionBoxStyle = `
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #ddd;
`;

const chipRowStyle = `
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
`;

const getChipButtonStyle = (isActive = false, compact = false) => `
  margin: 0;
  padding: ${compact ? "6px 12px" : "8px 14px"};
  width: auto;
  min-width: 0;
  height: auto;
  min-height: ${compact ? "34px" : "38px"};
  border-radius: 999px;
  border: 2px solid ${isActive ? "#444" : "#2f7ea8"};
  background: ${isActive ? "#e9ecef" : "#fff"};
  color: #333;
  font-weight: ${isActive ? "700" : "600"};
  font-size: ${compact ? "12px" : "13px"};
  line-height: 1.15;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  white-space: nowrap;
  box-sizing: border-box;
`;

const getActionButtonStyle = () => `
  margin: 0;
  padding: 8px 14px;
  width: auto;
  min-width: 0;
  height: auto;
  min-height: 36px;
  border-radius: 999px;
  border: 2px solid #2f7ea8;
  background: #fff;
  color: #333;
  font-weight: 600;
  font-size: 13px;
  line-height: 1.15;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  white-space: nowrap;
  box-sizing: border-box;
`;

const buildKeyValueRow = (label, value) => {
  return `<div style="margin-bottom:3px;"><b>${escapeHtml(label)}:</b> ${escapeHtml(value)}</div>`;
};

const buildBuildingDetailHtml = (buildingDetail) => {
  if (!buildingDetail) return "Sin información adicional.";

  let html = "";

  if (buildingDetail.mappingStatus) {
    html += buildKeyValueRow("Estado de mapeo", buildingDetail.mappingStatus);
  }

  if (buildingDetail.inventoryStatus) {
    html += buildKeyValueRow("Estado de inventario", buildingDetail.inventoryStatus);
  }

  if (buildingDetail.lastUpdate) {
    html += buildKeyValueRow("Última actualización", buildingDetail.lastUpdate);
  }

  if (buildingDetail.operationalNotes) {
    html += buildKeyValueRow("Nota operativa", buildingDetail.operationalNotes);
  }

  if (buildingDetail.technicalNotes) {
    html += buildKeyValueRow("Nota técnica", buildingDetail.technicalNotes);
  }

  if (Array.isArray(buildingDetail.tags) && buildingDetail.tags.length > 0) {
    html += buildKeyValueRow("Etiquetas", buildingDetail.tags.join(", "));
  }

  return html || "Sin datos adicionales.";
};

const buildDevicesSummaryHtml = (devices, floorLabel) => {
  if (!devices.length) {
    return `No hay equipos cargados para el piso ${escapeHtml(floorLabel)}.`;
  }

  const counts = countDevicesByType(devices);

  return `
    ${buildKeyValueRow("PCs", counts.pc)}
    ${buildKeyValueRow("Impresoras", counts.printer)}
    ${buildKeyValueRow("Escáneres", counts.scanner)}
    ${buildKeyValueRow("Otros", counts.other)}
  `;
};

const buildDevicesListHtml = (devices, rooms, floorLabel) => {
  if (!devices.length) {
    return `No hay equipos destacados para el piso ${escapeHtml(floorLabel)}.`;
  }

  const roomsMap = buildRoomsMap(rooms);
  const firstDevices = devices.slice(0, 10);

  let html = "";

  for (const device of firstDevices) {
    const room = roomsMap.get(device.roomId);
    const roomName = room?.name || room?.shortName || "Sin sala";
    const title = device.serialNumber || device.name || device.deviceId || "Sin S/N";
    const description = device.description || device.name || "Sin descripción";

    html += `
      <div style="margin-bottom:8px; padding:8px 10px; border:1px solid #ddd; border-radius:8px; background:#fafafa;">
        <div style="font-weight:600;">${escapeHtml(title)}</div>
        <div style="margin-top:2px; font-size:12px;">
          ${escapeHtml(description)}
        </div>
        <div style="margin-top:2px; font-size:12px;">
          ${escapeHtml(device.type || "sin_tipo")} · ${escapeHtml(roomName)} · IP: ${escapeHtml(device.ip || "sin IP")} · ${escapeHtml(device.status || "sin estado")}
        </div>
      </div>
    `;
  }

  if (devices.length > 10) {
    html += `... y ${devices.length - 10} equipo(s) más<br/>`;
  }

  return html;
};

const buildHistorySummaryHtml = (activityItems) => {
  if (!activityItems.length) {
    return `No hay actualizaciones pendientes ni cambios recientes para este edificio.`;
  }

  let html = `<b>Últimos cambios del edificio</b><br/>`;

  for (const entry of activityItems.slice(0, 6)) {
    const when = formatSyncTimestamp(entry?.createdAtUtc);
    const actor = entry?.changedByUsername || "sistema";
    const summary = entry?.summary || "Cambio registrado";
    const details = entry?.details || "Sin detalle adicional";

    html += `
      <div style="margin-top:8px; padding:8px 10px; border:1px solid #ddd; border-radius:8px; background:#fafafa;">
        <div style="font-weight:600;">${escapeHtml(summary)}</div>
        <div style="margin-top:2px; font-size:12px; color:#475569;">${escapeHtml(actor)} · ${escapeHtml(when)}</div>
        <div style="margin-top:4px; font-size:12px; color:#334155;">${escapeHtml(details)}</div>
      </div>
    `;
  }

  return html;
};

const buildFloorSelectorHtml = (building, currentFloor) => {
  const floors = Array.isArray(building?.floors) ? building.floors : [];
  if (!floors.length) return "";

  let html = `
    <div style="margin-top:10px;">
      <div style="font-weight:600; margin-bottom:4px;">Pisos del edificio</div>
      <div style="${chipRowStyle}">
  `;

  for (const floor of floors) {
    const isCurrent = Number(floor) === Number(currentFloor);

    html += `
      <button
        class="floorButton"
        style="${getChipButtonStyle(isCurrent, false)}"
        onclick="window.selectBuildingFloor && window.selectBuildingFloor('${escapeHtml(String(floor))}')"
      >
        ${escapeHtml(String(floor))}
      </button>
    `;
  }

  html += `</div></div>`;
  return html;
};

const buildViewSelectorHtml = (featureId, currentView) => {
  const views = [
    { key: "summary", label: "Resumen" },
    { key: "rooms", label: "Salas" },
    { key: "devices", label: "Equipos" },
    { key: "history", label: "Historial" },
  ];

  let html = `
    <div style="margin-top:10px;">
      <div style="font-weight:600; margin-bottom:4px;">Vista</div>
      <div style="${chipRowStyle}">
  `;

  for (const view of views) {
    const isCurrent = view.key === currentView;

    html += `
      <button
        class="floorButton"
        style="${getChipButtonStyle(isCurrent, true)}"
        onclick="window.setPopupView && window.setPopupView('${escapeHtml(featureId)}','${escapeHtml(view.key)}')"
      >
        ${escapeHtml(view.label)}
      </button>
    `;
  }

  html += `</div></div>`;
  return html;
};

const refreshCurrentPopup = async () => {
  if (!currentOpenLayer || !currentOpenLayer.feature) return;

  currentOpenLayer.setPopupContent("Cargando información...");
  const popupHtml = await getFeaturePopupHtml(currentOpenLayer.feature);
  currentOpenLayer.setPopupContent(popupHtml);
};

window.preparePopupNavigation = (featureId, viewKey, roomId = "") => {
  if (!featureId) return;

  popupViewState[featureId] = viewKey || "summary";
  popupRoomState[featureId] = roomId || null;
};

window.setPopupView = (featureId, viewKey) => {
  if (!featureId || !viewKey) return;

  popupViewState[featureId] = viewKey;
  popupRoomState[featureId] = null;
  refreshCurrentPopup();
};

window.selectBuildingFloor = (targetFloor) => {
  const floorText = String(targetFloor).trim();

  const candidates = Array.from(document.querySelectorAll("button, a")).filter((el) => {
    const text = (el.textContent || "").trim();
    const insidePopup = !!el.closest(".leaflet-popup-content");
    return text === floorText && !insidePopup;
  });

  if (candidates.length > 0) {
    candidates[0].click();
    return;
  }

  console.warn(`No se encontró botón global para el piso ${floorText}`);
};

window.selectRoomDetail = (featureId, roomId) => {
  if (!featureId || !roomId) return;

  popupViewState[featureId] = "rooms";
  popupRoomState[featureId] = roomId;
  refreshCurrentPopup();
};

window.backToRoomsList = (featureId) => {
  popupRoomState[featureId] = null;
  refreshCurrentPopup();
};

const buildRoomsListWithButtonsHtml = (featureId, rooms, devices, floorLabel) => {
  if (!rooms.length) {
    return `No hay salas cargadas para el piso ${escapeHtml(floorLabel)}.`;
  }

  let html = "";

  for (const room of rooms.slice(0, 10)) {
    const roomDevicesCount = devices.filter((device) => device.roomId === room.roomId).length;

    html += `
      <div style="margin-bottom:10px; padding:10px; border:1px solid #ddd; border-radius:8px; background:#fafafa;">
        <div style="font-weight:600; margin-bottom:3px;">${escapeHtml(room.name || room.shortName || room.roomId)}</div>
        <div style="font-size:12px; color:#444;">
          ${escapeHtml(room.type || "sin_tipo")} · ${escapeHtml(room.status || "sin_estado")} · ${roomDevicesCount} equipo(s)
        </div>
        <div style="margin-top:8px;">
          <button
            class="floorButton"
            style="${getActionButtonStyle()}"
            onclick="window.selectRoomDetail && window.selectRoomDetail('${escapeHtml(featureId)}','${escapeHtml(room.roomId)}')"
          >
            Ver
          </button>
        </div>
      </div>
    `;
  }

  if (rooms.length > 10) {
    html += `... y ${rooms.length - 10} sala(s) más<br/>`;
  }

  return html;
};

const buildRoomDetailHtml = (featureId, room, roomDevices) => {
  const recentEvents = getRecentEvents(roomDevices).slice(0, 5);

  let html = `
    <div style="margin-bottom:10px;">
      <button
        class="floorButton"
        style="${getActionButtonStyle()}"
        onclick="window.backToRoomsList && window.backToRoomsList('${escapeHtml(featureId)}')"
      >
        ← Volver
      </button>
    </div>
  `;

  html += buildKeyValueRow("Nombre", room.name || "");
  html += buildKeyValueRow("Código", room.shortName || "");
  html += buildKeyValueRow("Tipo", room.type || "");
  html += buildKeyValueRow("Estado", room.status || "");
  html += buildKeyValueRow("Unidad", room.unit || "");
  html += buildKeyValueRow("Área responsable", room.responsibleArea || "");
  html += buildKeyValueRow("Equipos", roomDevices.length);

  if (room.notes) {
    html += buildKeyValueRow("Notas", room.notes);
  }

  html += `<div style="margin-top:10px; font-weight:600;">Equipos de la sala</div>`;

  if (!roomDevices.length) {
    html += `No hay equipos asociados.<br/>`;
  } else {
    for (const device of roomDevices) {
      html += `
        <div style="margin-top:6px; padding:8px 10px; border:1px solid #ddd; border-radius:8px; background:#fafafa;">
          <div style="font-weight:600;">${escapeHtml(device.name || device.deviceId)}</div>
          <div style="font-size:12px; margin-top:2px;">
            ${escapeHtml(device.type || "sin_tipo")} · IP: ${escapeHtml(device.ip || "sin IP")} · ${escapeHtml(device.status || "sin estado")}
          </div>
        </div>
      `;
    }
  }

  html += `<div style="margin-top:12px; font-weight:600;">Historial reciente</div>`;

  if (!recentEvents.length) {
    html += `No hay historial reciente.`;
  } else {
    for (const event of recentEvents) {
      html += `• ${escapeHtml(event.date)} — ${escapeHtml(event.type)} — ${escapeHtml(event.description || "Sin descripción")}<br/>`;
    }
  }

  return html;
};

const getFeaturePopupHtml = async (feature) => {
  const building = await findBuildingInCatalog(feature);
  const featureId = feature?.properties?.id || "Sin ID";
  const currentFloor = feature?.properties?.floor ?? 0;
  const floorLabel = currentFloor;
  const currentView = popupViewState[featureId] || "summary";
  const selectedRoomId = popupRoomState[featureId] || null;

  const link = `${HOST_URL}/?id=${featureId}&zoom=20`;
  const copyButtonHtml = `<button class="floorButton" onclick='
    navigator.clipboard.writeText("${link}")
      .then(()=>{this.innerHTML="Copiado ✓"})
      .catch(()=>{alert("No se pudo copiar el enlace: ${link}");});
    ' style="${getActionButtonStyle()}">Copiar enlace</button>`;

  if (!building) {
    return `
      <div style="${popupShellStyle}">
        <b>${escapeHtml(feature?.properties?.name || "Edificio sin nombre")}</b><br/>
        ID: ${escapeHtml(featureId)}<br/>
        Piso: ${escapeHtml(floorLabel)}<br/><br/>
        ${copyButtonHtml}
      </div>
    `;
  }

  const [buildingDetail, allRooms, backendInventoryItems, buildingActivityItems] = await Promise.all([
    loadBuildingDetail(building),
    loadRoomsForBuilding(building),
    loadBackendInventoryForBuilding(building),
    loadBuildingActivity(building),
  ]);

  loadedEquipmentRevision = pendingEquipmentRevision || loadedEquipmentRevision;
  pendingEquipmentRevision = null;
  updateBackendStatusPanel(latestEquipmentSyncState);

  const allDevices = normalizeImportedInventoryItems(backendInventoryItems);
  const roomsInFloor = filterRoomsByFloor(allRooms, currentFloor);
  const devicesInFloor = filterDevicesByFloor(allDevices, roomsInFloor, allRooms, currentFloor);

  const featureName = getFeatureDisplayName(feature, building);
  const type = building?.type || "unknown";
  const shortName = building?.shortName || "";
  const responsibleArea = building?.responsibleArea || "";
  const floors = Array.isArray(building?.floors) ? building.floors.join(", ") : "";
  const searchPopupContent = building?.searchPopupContent || "";

  let detailsHtml = `
    <div style="${popupShellStyle}">
      <b style="font-size:16px;">${escapeHtml(featureName)}</b><br/>
      ID: ${escapeHtml(featureId)}<br/>
      Piso actual: ${escapeHtml(floorLabel)}<br/>
      Tipo: ${escapeHtml(type)}
  `;

  if (shortName) detailsHtml += `<br/>Código: ${escapeHtml(shortName)}`;
  if (responsibleArea) detailsHtml += `<br/>Área: ${escapeHtml(responsibleArea)}`;
  if (floors) detailsHtml += `<br/>Pisos: ${escapeHtml(floors)}`;

  detailsHtml += `<br/>Salas edificio: ${escapeHtml(allRooms.length)}`;
  detailsHtml += `<br/>Equipos edificio: ${escapeHtml(allDevices.length)}`;
  detailsHtml += `<br/>Salas piso ${escapeHtml(floorLabel)}: ${escapeHtml(roomsInFloor.length)}`;
  detailsHtml += `<br/>Equipos piso ${escapeHtml(floorLabel)}: ${escapeHtml(devicesInFloor.length)}`;

  detailsHtml += buildFloorSelectorHtml(building, currentFloor);
  detailsHtml += buildViewSelectorHtml(featureId, currentView);

  if (currentView === "summary") {
    detailsHtml += `
      <div style="${sectionBoxStyle}">
        <div style="font-weight:600; margin-bottom:6px;">Resumen</div>
        ${searchPopupContent ? `<div>${searchPopupContent}</div>` : ""}
        ${buildBuildingDetailHtml(buildingDetail)}
      </div>
    `;

  }

  if (currentView === "rooms") {
    detailsHtml += `<div style="${sectionBoxStyle}">`;

    if (selectedRoomId) {
      const selectedRoom = roomsInFloor.find((room) => room.roomId === selectedRoomId);
      const roomDevices = devicesInFloor.filter((device) => device.roomId === selectedRoomId);

      if (selectedRoom) {
        detailsHtml += `<div style="font-weight:600; margin-bottom:6px;">Detalle de sala</div>`;
        detailsHtml += buildRoomDetailHtml(featureId, selectedRoom, roomDevices);
      } else {
        detailsHtml += `Sala no encontrada en este piso.`;
      }
    } else {
      detailsHtml += `<div style="font-weight:600; margin-bottom:6px;">Salas del piso ${escapeHtml(floorLabel)}</div>`;
      detailsHtml += buildRoomsListWithButtonsHtml(featureId, roomsInFloor, devicesInFloor, floorLabel);
    }

    detailsHtml += `</div>`;
  }

  if (currentView === "devices") {
    detailsHtml += `
      <div style="${sectionBoxStyle}">
        <div style="font-weight:600; margin-bottom:6px;">Equipos por tipo</div>
        ${buildDevicesSummaryHtml(devicesInFloor, floorLabel)}
        <div style="margin-top:10px; font-weight:600;">Equipos destacados</div>
        <div style="margin-top:4px;">
          ${buildDevicesListHtml(devicesInFloor, roomsInFloor, floorLabel)}
        </div>
      </div>
    `;
  }

  if (currentView === "history") {
    detailsHtml += `
      <div style="${sectionBoxStyle}">
        <div style="font-weight:600; margin-bottom:6px;">Historial del edificio</div>
        ${buildHistorySummaryHtml(buildingActivityItems)}
      </div>
    `;
  }

  detailsHtml += `<div style="margin-top:12px;">${copyButtonHtml}</div>`;
  detailsHtml += `</div>`;

  return detailsHtml;
};

export const filter = (feature) => {
  return feature.properties.isVisible && feature.properties.isPublished;
};

export const style = (feature) => {
  return feature.properties.style;
};

const zoomToFeature = (e) => {
  map.fitBounds(e.target.getBounds());
};

const zoomToFeaturePoint = (e) => {
  map.setView([e.latlng.lat, e.latlng.lng], 19);
};

const highlightFeature = (e) => {
  var layer = e.target;

  if (currentHoveredLayer && currentHoveredLayer !== layer) {
    applyDefaultStyle(currentHoveredLayer);
  }

  layer.setStyle({
    weight: 5,
    color: "#666",
    dashArray: "",
    fillOpacity: 0.7,
  });

  currentHoveredLayer = layer;

  if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
    layer.bringToFront();
  }
};

const resetHighlight = (e) => {
  var layer = e.target;
  applyDefaultStyle(layer);

  if (currentHoveredLayer === layer) {
    currentHoveredLayer = null;
  }
};

export const onEachFeature = (feature, layer) => {
  if (feature.properties.isClickable) {
    layer.bindPopup("Cargando información...");

    if (layer.getPopup()) {
      layer.getPopup().options.autoPan = true;
      layer.getPopup().options.keepInView = true;
      layer.getPopup().options.closeOnClick = false;
    }

        layer.on("popupopen", async () => {
      setCurrentOpenFeatureId(feature?.properties?.id || null);
      currentOpenLayer = layer;
      setSelectedLayer(layer);

      if (!popupViewState[feature.properties.id]) {
        popupViewState[feature.properties.id] = "summary";
      }

      const popupHtml = await getFeaturePopupHtml(feature);
      layer.setPopupContent(popupHtml);
    });

    layer.on("popupclose", () => {
      if (currentOpenLayer === layer) {
        clearCurrentOpenFeatureId();
      }

      clearSelectedLayer(layer);
    });

    if (feature.geometry.type == "Polygon") {
      layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: zoomToFeature,
      });

      layer.on("remove", () => {
        if (currentHoveredLayer === layer) {
          currentHoveredLayer = null;
        }
      });
    } else if (feature.geometry.type == "Point") {
      layer.on({
        click: zoomToFeaturePoint,
      });
    }
  }
};
if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", startEquipmentSyncMonitor, { once: true });
} else {
  startEquipmentSyncMonitor();
}













