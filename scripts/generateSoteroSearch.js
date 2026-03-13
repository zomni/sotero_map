const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "src", "data");
const catalogPath = path.join(dataDir, "sotero_buildings_catalog.json");
const interiorsDir = path.join(dataDir, "interiors");
const outputPath = path.join(dataDir, "cs_sotero_search.json");

const geojsonFloorPaths = [
  path.join(dataDir, "cs_sotero_-1.json"),
  path.join(dataDir, "cs_sotero_0.json"),
  path.join(dataDir, "cs_sotero_1.json"),
  path.join(dataDir, "cs_sotero_2.json"),
  path.join(dataDir, "cs_sotero_3.json"),
  path.join(dataDir, "cs_sotero_4.json"),
  path.join(dataDir, "cs_sotero_5.json"),
];

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (error) {
    console.error(`Error leyendo ${filePath}:`, error);
    return fallback;
  }
}

function getFeatureMapFromGeojsons() {
  const featureMap = new Map();

  for (const filePath of geojsonFloorPaths) {
    const json = readJsonSafe(filePath, { features: [] });

    for (const feature of json.features || []) {
      const id = feature?.properties?.id;
      if (!id) continue;

      if (!featureMap.has(id)) {
        featureMap.set(id, feature);
      }
    }
  }

  return featureMap;
}

function makePointFeature(lon, lat, properties) {
  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [lon, lat],
    },
    properties,
  };
}

function buildSearchText(parts) {
  return parts
    .filter(Boolean)
    .map((x) => String(x).trim())
    .filter(Boolean)
    .join(" | ");
}

function buildBuildingPopup(building) {
  const floors = Array.isArray(building.floors) ? building.floors.join(", ") : "";

  return `
    <b>${building.realName || building.displayName || building.id}</b><br/>
    ID: ${building.id}<br/>
    Tipo: ${building.type || "unknown"}<br/>
    Código: ${building.shortName || ""}<br/>
    Área: ${building.responsibleArea || ""}<br/>
    Pisos: ${floors || "N/D"}
  `;
}

function buildRoomPopup(room, building) {
  return `
    <b>${room.name || room.roomId}</b><br/>
    Sala ID: ${room.roomId}<br/>
    Edificio: ${building.realName || building.displayName || building.id}<br/>
    Piso: ${room.floor}<br/>
    Tipo: ${room.type || "room"}<br/>
    Estado: ${room.status || "active"}
  `;
}

function buildDevicePopup(device, room, building) {
  return `
    <b>${device.name || device.deviceId}</b><br/>
    Equipo ID: ${device.deviceId}<br/>
    Edificio: ${building.realName || building.displayName || building.id}<br/>
    Sala: ${room?.name || room?.roomId || device.roomId || "Sin sala"}<br/>
    Piso: ${room?.floor ?? "N/D"}<br/>
    Tipo: ${device.type || "other"}<br/>
    IP: ${device.ip || "sin IP"}<br/>
    Inventario: ${device.inventoryCode || ""}<br/>
    Serie: ${device.serialNumber || ""}
  `;
}

function main() {
  const catalog = readJsonSafe(catalogPath, { buildings: [] });
  const featureMap = getFeatureMapFromGeojsons();

  const output = {
    type: "FeatureCollection",
    features: [],
  };

  for (const building of catalog.buildings || []) {
    const buildingFeature = featureMap.get(building.id);
    const centroid = Array.isArray(building.centroid) ? building.centroid : null;
    const buildingFloor =
      Array.isArray(building.floors) && building.floors.length > 0 ? building.floors[0] : 0;

    let geometry = null;

    if (buildingFeature?.geometry) {
      geometry = buildingFeature.geometry;
    } else if (centroid && centroid.length === 2) {
      geometry = {
        type: "Point",
        coordinates: [centroid[0], centroid[1]],
      };
    }

    if (!geometry) continue;

    output.features.push({
      type: "Feature",
      geometry,
      properties: {
        id: building.id,
        title: building.realName || building.displayName || building.id,
        description: `Edificio · ${building.shortName || ""} · piso(s): ${(building.floors || []).join(", ") || "0"}`,
        floor: buildingFloor,
        popupContent: buildBuildingPopup(building),
        searchType: "building",
        buildingId: building.id,
        roomId: "",
        deviceId: "",
        view: "summary",
        searchText: buildSearchText([
          building.id,
          building.realName,
          building.displayName,
          building.shortName,
          building.type,
          building.responsibleArea,
          ...(building.floors || []),
        ]),
      },
    });

    const buildingDir = path.join(interiorsDir, building.id);
    const devicesJson = readJsonSafe(path.join(buildingDir, "devices.json"), { devices: [] });
    const devices = Array.isArray(devicesJson.devices) ? devicesJson.devices : [];

    const rooms = [];
    for (const floor of building.floors || []) {
      const roomsJson = readJsonSafe(
        path.join(buildingDir, `floor_${floor}_rooms.json`),
        { rooms: [] }
      );
      rooms.push(...(Array.isArray(roomsJson.rooms) ? roomsJson.rooms : []));
    }

    const roomsMap = new Map(rooms.map((room) => [room.roomId, room]));

    for (const room of rooms) {
      if (!centroid || centroid.length !== 2) continue;

      output.features.push(
        makePointFeature(centroid[0], centroid[1], {
          id: room.roomId,
          title: room.name || room.roomId,
          description: `Sala · ${building.realName || building.displayName || building.id} · piso ${room.floor}`,
          floor: room.floor ?? buildingFloor,
          popupContent: buildRoomPopup(room, building),
          searchType: "room",
          buildingId: building.id,
          roomId: room.roomId,
          deviceId: "",
          view: "rooms",
          searchText: buildSearchText([
            room.roomId,
            room.name,
            room.shortName,
            room.type,
            room.unit,
            room.service,
            room.responsibleArea,
            building.id,
            building.realName,
            building.displayName,
            building.shortName,
            room.floor,
          ]),
        })
      );
    }

    for (const device of devices) {
      if (!centroid || centroid.length !== 2) continue;

      const room = roomsMap.get(device.roomId);
      const deviceFloor = room?.floor ?? buildingFloor;

      output.features.push(
        makePointFeature(centroid[0], centroid[1], {
          id: device.deviceId,
          title: device.name || device.deviceId,
          description: `Equipo · ${device.type || "other"} · ${room?.name || device.roomId || "Sin sala"} · piso ${deviceFloor}`,
          floor: deviceFloor,
          popupContent: buildDevicePopup(device, room, building),
          searchType: "device",
          buildingId: building.id,
          roomId: room?.roomId || device.roomId || "",
          deviceId: device.deviceId,
          view: "rooms",
          searchText: buildSearchText([
            device.deviceId,
            device.name,
            device.type,
            device.subtype,
            device.inventoryCode,
            device.serialNumber,
            device.ip,
            device.mac,
            device.brand,
            device.model,
            device.assignedTo,
            device.responsiblePerson,
            device.status,
            room?.roomId,
            room?.name,
            room?.shortName,
            building.id,
            building.realName,
            building.displayName,
            building.shortName,
            deviceFloor,
          ]),
        })
      );
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`Archivo generado: ${outputPath}`);
  console.log(`Resultados totales: ${output.features.length}`);
}

main();