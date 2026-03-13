/////////////////////////////////////////////////////////////////////////////////
///////////////////////// Add interactions with the map /////////////////////////
/////////////////////////////////////////////////////////////////////////////////

import { map, HOST_URL } from "../views/map.js";

export let currentOpenFeatureId = null;

export const setCurrentOpenFeatureId = (featureId) => {
  currentOpenFeatureId = featureId || null;
};

export const clearCurrentOpenFeatureId = () => {
  currentOpenFeatureId = null;
};

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
  if (!building) {
    return [];
  }

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
  const counts = {
    pc: 0,
    printer: 0,
    phone: 0,
    other: 0,
  };

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

const buildCollapsibleSection = (title, innerHtml, open = false) => {
  return `
    <details ${open ? "open" : ""} style="margin-top:8px;">
      <summary style="cursor:pointer; font-weight:600;">${escapeHtml(title)}</summary>
      <div style="margin-top:6px; padding-left:4px; line-height:1.35;">
        ${innerHtml}
      </div>
    </details>
  `;
};

const filterRoomsByFloor = (rooms, floor) => {
  return rooms.filter((room) => Number(room.floor) === Number(floor));
};

const filterDevicesByFloor = (devices, roomsInFloor) => {
  const roomIds = new Set(roomsInFloor.map((room) => room.roomId));
  return devices.filter((device) => roomIds.has(device.roomId));
};

const buildBuildingDetailHtml = (buildingDetail) => {
  if (!buildingDetail) {
    return "Sin información adicional.";
  }

  let html = "";

  if (buildingDetail.mappingStatus) {
    html += `Estado de mapeo: ${escapeHtml(buildingDetail.mappingStatus)}<br/>`;
  }

  if (buildingDetail.inventoryStatus) {
    html += `Estado de inventario: ${escapeHtml(buildingDetail.inventoryStatus)}<br/>`;
  }

  if (buildingDetail.lastUpdate) {
    html += `Última actualización: ${escapeHtml(buildingDetail.lastUpdate)}<br/>`;
  }

  if (buildingDetail.operationalNotes) {
    html += `Nota operativa: ${escapeHtml(buildingDetail.operationalNotes)}<br/>`;
  }

  if (buildingDetail.technicalNotes) {
    html += `Nota técnica: ${escapeHtml(buildingDetail.technicalNotes)}<br/>`;
  }

  if (Array.isArray(buildingDetail.tags) && buildingDetail.tags.length > 0) {
    html += `Etiquetas: ${escapeHtml(buildingDetail.tags.join(", "))}<br/>`;
  }

  return html || "Sin datos adicionales.";
};

const buildRoomsSummaryHtml = (rooms, devices, floorLabel) => {
  if (!rooms.length) {
    return `No hay salas cargadas para el piso ${escapeHtml(floorLabel)}.`;
  }

  const firstRooms = rooms.slice(0, 8);
  let html = "";

  for (const room of firstRooms) {
    const roomDevicesCount = devices.filter((device) => device.roomId === room.roomId).length;
    const roomName = escapeHtml(room.name || room.shortName || room.roomId);
    const roomType = escapeHtml(room.type || "sin_tipo");
    const roomStatus = escapeHtml(room.status || "sin_estado");

    html += `• ${roomName} — ${roomType} — ${roomStatus} — ${roomDevicesCount} equipo(s)<br/>`;
  }

  if (rooms.length > 8) {
    html += `... y ${rooms.length - 8} sala(s) más<br/>`;
  }

  return html;
};

const buildDevicesSummaryHtml = (devices, floorLabel) => {
  if (!devices.length) {
    return `No hay equipos cargados para el piso ${escapeHtml(floorLabel)}.`;
  }

  const counts = countDevicesByType(devices);

  return `
    PCs: ${counts.pc}<br/>
    Impresoras: ${counts.printer}<br/>
    Teléfonos: ${counts.phone}<br/>
    Otros: ${counts.other}
  `;
};

const buildDevicesListHtml = (devices, rooms, floorLabel) => {
  if (!devices.length) {
    return `No hay equipos destacados para el piso ${escapeHtml(floorLabel)}.`;
  }

  const roomsMap = buildRoomsMap(rooms);
  const firstDevices = devices.slice(0, 8);

  let html = "";

  for (const device of firstDevices) {
    const room = roomsMap.get(device.roomId);
    const roomName = room?.name || room?.shortName || device.roomId || "Sin sala";
    const deviceName = escapeHtml(device.name || device.deviceId || "Sin nombre");
    const deviceType = escapeHtml(device.type || "sin_tipo");
    const ip = escapeHtml(device.ip || "sin IP");
    const status = escapeHtml(device.status || "sin estado");
    const roomLabel = escapeHtml(roomName);

    html += `• ${deviceName} — ${deviceType} — ${roomLabel} — IP: ${ip} — ${status}<br/>`;
  }

  if (devices.length > 8) {
    html += `... y ${devices.length - 8} equipo(s) más<br/>`;
  }

  return html;
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

const getFeaturePopupHtml = async (feature) => {
  const building = await findBuildingInCatalog(feature);
  const featureId = feature?.properties?.id || "Sin ID";
  const currentFloor = feature?.properties?.floor ?? 0;
  const floorLabel = currentFloor;

  const link = `${HOST_URL}/?id=${featureId}&zoom=20`;
  const copyButtonHtml = `<button class="floorButton copy-button" onclick='
    navigator.clipboard.writeText("${link}")
      .then(()=>{this.innerHTML="Copiado ✓"})
      .catch(()=>{alert("No se pudo copiar el enlace: ${link}");});
    '>Copiar enlace</button>`;

  if (!building) {
    return `
      <div style="min-width:280px; max-width:360px; max-height:60vh; overflow-y:auto;">
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

  const totalRoomsCount = allRooms.length;
  const totalDevicesCount = allDevices.length;
  const floorRoomsCount = roomsInFloor.length;
  const floorDevicesCount = devicesInFloor.length;

  let detailsHtml = `
    <div style="min-width:280px; max-width:360px; max-height:60vh; overflow-y:auto; line-height:1.35;">
      <b style="font-size:15px;">${escapeHtml(featureName)}</b><br/>
      ID: ${escapeHtml(featureId)}<br/>
      Piso actual: ${escapeHtml(floorLabel)}<br/>
      Tipo: ${escapeHtml(type)}
  `;

  if (shortName) {
    detailsHtml += `<br/>Código: ${escapeHtml(shortName)}`;
  }

  if (responsibleArea) {
    detailsHtml += `<br/>Área: ${escapeHtml(responsibleArea)}`;
  }

  if (floors) {
    detailsHtml += `<br/>Pisos: ${escapeHtml(floors)}`;
  }

  detailsHtml += `<br/>Salas edificio: ${escapeHtml(totalRoomsCount)}`;
  detailsHtml += `<br/>Equipos edificio: ${escapeHtml(totalDevicesCount)}`;
  detailsHtml += `<br/>Salas piso ${escapeHtml(floorLabel)}: ${escapeHtml(floorRoomsCount)}`;
  detailsHtml += `<br/>Equipos piso ${escapeHtml(floorLabel)}: ${escapeHtml(floorDevicesCount)}`;

  detailsHtml += buildCollapsibleSection(
    "Estado del edificio",
    buildBuildingDetailHtml(buildingDetail),
    false
  );

  detailsHtml += buildCollapsibleSection(
    `Salas del piso ${floorLabel}`,
    buildRoomsSummaryHtml(roomsInFloor, devicesInFloor, floorLabel),
    true
  );

  detailsHtml += buildCollapsibleSection(
    `Equipos por tipo (piso ${floorLabel})`,
    buildDevicesSummaryHtml(devicesInFloor, floorLabel),
    false
  );

  detailsHtml += buildCollapsibleSection(
    `Equipos destacados (piso ${floorLabel})`,
    buildDevicesListHtml(devicesInFloor, roomsInFloor, floorLabel),
    false
  );

  detailsHtml += buildCollapsibleSection(
    `Historial resumido (piso ${floorLabel})`,
    buildHistorySummaryHtml(devicesInFloor, floorLabel),
    false
  );

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