const fs = require("fs");
const path = require("path");

const interiorsBasePath = path.join(__dirname, "..", "src", "data", "interiors");

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (error) {
    console.error(`Error leyendo ${filePath}:`, error);
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function normalizeRoom(room, fallbackBuildingId, fallbackFloor) {
  return {
    roomId: room.roomId || "",
    name: room.name || "",
    shortName: room.shortName || "",
    type: room.type || "room",
    floor: room.floor ?? fallbackFloor,
    buildingId: room.buildingId || fallbackBuildingId,
    sector: room.sector || "",
    unit: room.unit || room.responsibleArea || "",
    service: room.service || "",
    isMapped: Boolean(room.isMapped),
    geometry: room.geometry ?? null,
    status: room.status || "active",
    capacity: room.capacity ?? null,
    devicesCount: typeof room.devicesCount === "number" ? room.devicesCount : 0,
    responsibleArea: room.responsibleArea || "",
    responsiblePerson: room.responsiblePerson || "",
    notes: room.notes || ""
  };
}

function processFloorRoomsFile(filePath, buildingId, floor) {
  const data = readJsonSafe(filePath, null);
  if (!data) return false;

  const rooms = Array.isArray(data.rooms) ? data.rooms : [];
  const normalizedRooms = rooms.map((room) => normalizeRoom(room, buildingId, floor));

  const output = {
    buildingId: data.buildingId || buildingId,
    buildingName: data.buildingName || buildingId,
    floor: data.floor ?? floor,
    rooms: normalizedRooms
  };

  writeJson(filePath, output);
  return true;
}

function main() {
  if (!fs.existsSync(interiorsBasePath)) {
    console.log("No existe la carpeta interiors.");
    return;
  }

  const buildingDirs = fs.readdirSync(interiorsBasePath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  let processedFiles = 0;

  for (const buildingId of buildingDirs) {
    const buildingPath = path.join(interiorsBasePath, buildingId);
    const files = fs.readdirSync(buildingPath);

    for (const fileName of files) {
      const match = fileName.match(/^floor_(-?\d+)_rooms\.json$/);
      if (!match) continue;

      const floor = Number(match[1]);
      const filePath = path.join(buildingPath, fileName);

      if (processFloorRoomsFile(filePath, buildingId, floor)) {
        processedFiles += 1;
      }
    }
  }

  console.log(`Archivos de salas normalizados: ${processedFiles}`);
}

main();