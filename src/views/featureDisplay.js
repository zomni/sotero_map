/////////////////////////////////////////////////////////////////////////////////
///////////////////////// Add interactions with the map /////////////////////////
/////////////////////////////////////////////////////////////////////////////////

import { map, HOST_URL } from "../views/map.js";

export let currentOpenFeatureId = null;
let currentOpenLayer = null;

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

const popupViewState = {};
const popupRoomState = {};

const loadBuildingsCatalog = async () => {
  try {
    const response = await fetch(`data/sotero_buildings_catalog.json?v=${Date.now()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("No se pudo cargar sotero_buildings_catalog.json");
    }

    return await response.json();
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

  const roomsByFloor = await Promise.all(roomFilePromises);
  return roomsByFloor.flat();
};

const loadDevicesForBuilding = async (building) => {
  if (!building) return [];

  try {
    const response = await fetch(
      `data/interiors/${building.id}/devices.json?v=${Date.now()}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return Array.isArray(data.devices) ? data.devices : [];
  } catch (error) {
    console.error(`Error cargando devices de ${building.id}:`, error);
    return [];
  }
};

const getFeatureDisplayName = (feature, building) => {
  if (building) {
    return (
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
  const counts = { pc: 0, printer: 0, phone: 0, other: 0 };

  for (const device of devices) {
    const type = device?.type || "other";

    if (type === "pc") counts.pc += 1;
    else if (type === "printer") counts.printer += 1;
    else if (type === "phone") counts.phone += 1;
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

const filterDevicesByFloor = (devices, roomsInFloor) => {
  const roomIds = new Set(roomsInFloor.map((room) => room.roomId));
  return devices.filter((device) => roomIds.has(device.roomId));
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
  padding: ${compact ? "4px 10px" : "6px 12px"};
  min-width: ${compact ? "0" : "40px"};
  border-radius: 999px;
  border: 2px solid ${isActive ? "#444" : "#2f7ea8"};
  background: ${isActive ? "#e9ecef" : "#fff"};
  color: #333;
  font-weight: ${isActive ? "700" : "600"};
  font-size: ${compact ? "12px" : "13px"};
  line-height: 1.1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
`;

const getActionButtonStyle = () => `
  margin: 0;
  padding: 6px 12px;
  border-radius: 999px;
  border: 2px solid #2f7ea8;
  background: #fff;
  color: #333;
  font-weight: 600;
  font-size: 13px;
  line-height: 1.1;
  white-space: nowrap;
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
    ${buildKeyValueRow("Teléfonos", counts.phone)}
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
    const roomName = room?.name || room?.shortName || device.roomId || "Sin sala";

    html += `
      <div style="margin-bottom:8px; padding:8px 10px; border:1px solid #ddd; border-radius:8px; background:#fafafa;">
        <div style="font-weight:600;">${escapeHtml(device.name || device.deviceId || "Sin nombre")}</div>
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

const buildHistorySummaryHtml = (devices, floorLabel) => {
  const events = getRecentEvents(devices);

  if (!events.length) {
    return `No hay historial registrado para el piso ${escapeHtml(floorLabel)}.`;
  }

  const incidents = events.filter((event) => event.type === "incident").slice(0, 3);
  const maintenance = events.filter((event) => event.type === "maintenance").slice(0, 3);
  const recent = events.slice(0, 5);

  let html = "";

  if (incidents.length) {
    html += `<b>Incidentes recientes</b><br/>`;
    for (const event of incidents) {
      html += `• ${escapeHtml(event.date)} — ${escapeHtml(event.deviceName)} — ${escapeHtml(event.description || "Sin descripción")}<br/>`;
    }
    html += `<br/>`;
  }

  if (maintenance.length) {
    html += `<b>Mantenimientos recientes</b><br/>`;
    for (const event of maintenance) {
      html += `• ${escapeHtml(event.date)} — ${escapeHtml(event.deviceName)} — ${escapeHtml(event.description || "Sin descripción")}<br/>`;
    }
    html += `<br/>`;
  }

  html += `<b>Últimos eventos</b><br/>`;
  for (const event of recent) {
    html += `• ${escapeHtml(event.date)} — ${escapeHtml(event.type)} — ${escapeHtml(event.deviceName)}<br/>`;
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
  const copyButtonHtml = `<button class="floorButton copy-button" onclick='
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

  const [buildingDetail, allRooms, allDevices] = await Promise.all([
    loadBuildingDetail(building),
    loadRoomsForBuilding(building),
    loadDevicesForBuilding(building),
  ]);

  const roomsInFloor = filterRoomsByFloor(allRooms, currentFloor);
  const devicesInFloor = filterDevicesByFloor(allDevices, roomsInFloor);

  const featureName = getFeatureDisplayName(feature, building);
  const type = building?.type || "unknown";
  const shortName = building?.shortName || "";
  const responsibleArea = building?.responsibleArea || "";
  const floors = Array.isArray(building?.floors) ? building.floors.join(", ") : "";

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
        <div style="font-weight:600; margin-bottom:6px;">Historial resumido del piso ${escapeHtml(floorLabel)}</div>
        ${buildHistorySummaryHtml(devicesInFloor, floorLabel)}
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
  layer.setStyle({
    weight: 5,
    color: "#666",
    dashArray: "",
    fillOpacity: 0.7,
  });

  if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
    layer.bringToFront();
  }
};

const resetHighlight = (e) => {
  var layer = e.target;
  layer.setStyle(style(layer.feature));
};

export const onEachFeature = (feature, layer) => {
  if (feature.properties.isClickable) {
    layer.bindPopup("Cargando información...");

    layer.on("popupopen", async () => {
      setCurrentOpenFeatureId(feature?.properties?.id || null);
      currentOpenLayer = layer;

      if (!popupViewState[feature.properties.id]) {
        popupViewState[feature.properties.id] = "summary";
      }

      const popupHtml = await getFeaturePopupHtml(feature);
      layer.setPopupContent(popupHtml);
    });

    if (feature.geometry.type == "Polygon") {
      layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: zoomToFeature,
      });
    } else if (feature.geometry.type == "Point") {
      layer.on({
        click: zoomToFeaturePoint,
      });
    }
  }
};