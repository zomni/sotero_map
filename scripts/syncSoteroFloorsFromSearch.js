const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "src", "data");
const searchPath = path.join(dataDir, "cs_sotero_search.json");
const catalogPath = path.join(dataDir, "sotero_buildings_catalog.json");
const floorFiles = [-1, 0, 1, 2, 3, 4, 5].map((floor) => ({
  floor,
  path: path.join(dataDir, `cs_sotero_${floor}.json`),
}));

const DEFAULT_STYLE = {
  color: "#3388ff",
  weight: 2,
  opacity: 1,
  fillColor: "#3388ff",
  fillOpacity: 0.2,
};

const isBuildingId = (id) => /^SR-BLD-\d+$/.test(String(id || ""));

const readJson = (filePath, fallback) => {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(`Error leyendo ${filePath}:`, error);
    return fallback;
  }
};

const writeJson = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
};

const uniqueSortedFloors = (floors) =>
  [...new Set((floors || []).map((floor) => Number(floor)).filter((floor) => Number.isFinite(floor)))]
    .sort((a, b) => a - b);

const parseFloorsFromText = (text) => {
  const value = String(text || "");
  const match = value.match(/Pisos?:\s*([^<\n]+)/i) || value.match(/piso\(s\):\s*([^<\n]+)/i);

  if (!match) {
    return [];
  }

  const normalized = match[1].trim();
  if (!normalized || normalized.toUpperCase() === "N/D") {
    return [];
  }

  return uniqueSortedFloors(
    normalized
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
  );
};

const parseFloorsFromProperties = (properties) => {
  const popupFloors = parseFloorsFromText(properties.popupContent);
  if (popupFloors.length > 0) return popupFloors;

  const descriptionFloors = parseFloorsFromText(properties.description);
  if (descriptionFloors.length > 0) return descriptionFloors;

  if (Number.isFinite(Number(properties.floor))) {
    return [Number(properties.floor)];
  }

  return [0];
};

const makeSlug = (text) =>
  String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const collectExistingBuildingTemplates = () => {
  const templates = new Map();

  for (const floorFile of floorFiles) {
    const geojson = readJson(floorFile.path, { type: "FeatureCollection", features: [] });

    for (const feature of geojson.features || []) {
      const properties = feature?.properties || {};
      if (!isBuildingId(properties.id)) continue;
      if (!templates.has(properties.id)) {
        templates.set(properties.id, feature);
      }
    }
  }

  return templates;
};

const buildFeatureForFloor = (searchFeature, floor, templateFeature) => {
  const properties = searchFeature?.properties || {};
  const templateProperties = templateFeature?.properties || {};

  return {
    type: "Feature",
    properties: {
      ...templateProperties,
      id: properties.id,
      name: properties.title || templateProperties.name || properties.id,
      kind: templateProperties.kind || "building",
      buildingType: templateProperties.buildingType || "yes",
      sourceId: templateProperties.sourceId || "",
      floor,
      isClickable: templateProperties.isClickable ?? true,
      showLabel: templateProperties.showLabel ?? false,
      slug: templateProperties.slug || makeSlug(properties.title || properties.id),
      centroid: templateProperties.centroid || null,
      isVisible: templateProperties.isVisible ?? true,
      isPublished: templateProperties.isPublished ?? true,
      style: templateProperties.style || DEFAULT_STYLE,
    },
    geometry: searchFeature.geometry,
  };
};

const syncFloorGeojsons = (searchBuildings, templates) => {
  const searchById = new Map(searchBuildings.map((feature) => [feature.properties.id, feature]));
  let updatedFeatures = 0;

  for (const floorFile of floorFiles) {
    const geojson = readJson(floorFile.path, { type: "FeatureCollection", features: [] });
    const nonBuildings = (geojson.features || []).filter(
      (feature) => !isBuildingId(feature?.properties?.id)
    );

    const buildingFeatures = [];

    for (const searchFeature of searchBuildings) {
      const floors = parseFloorsFromProperties(searchFeature.properties);
      if (!floors.includes(floorFile.floor)) continue;

      const templateFeature = templates.get(searchFeature.properties.id);
      buildingFeatures.push(buildFeatureForFloor(searchFeature, floorFile.floor, templateFeature));
      updatedFeatures += 1;
    }

    const nextGeojson = {
      ...geojson,
      features: [...buildingFeatures, ...nonBuildings],
    };

    writeJson(floorFile.path, nextGeojson);
    console.log(
      `Actualizado ${path.basename(floorFile.path)} con ${buildingFeatures.length} edificios`
    );
  }

  return { updatedFeatures, searchById };
};

const syncCatalog = (searchBuildings, existingCatalog) => {
  const catalogBuildings = Array.isArray(existingCatalog?.buildings) ? existingCatalog.buildings : [];
  const byId = new Map(catalogBuildings.map((building) => [building.id, building]));

  for (const feature of searchBuildings) {
    const properties = feature.properties || {};
    const id = properties.id;
    const current = byId.get(id) || {};

    byId.set(id, {
      id,
      slug: current.slug || makeSlug(properties.title || id),
      displayName: properties.title || current.displayName || id,
      shortName: current.shortName || id.replace("SR-", ""),
      realName: current.realName || properties.title || "",
      type: current.type || "unknown",
      floors: parseFloorsFromProperties(properties),
      hasInteriorMap: current.hasInteriorMap ?? false,
      hasInventory: current.hasInventory ?? false,
      responsibleArea: current.responsibleArea || "",
      notes: current.notes || "",
      sourceId: current.sourceId || "",
      centroid: current.centroid || null,
    });
  }

  const mergedCatalog = {
    buildings: [...byId.values()].sort((a, b) => String(a.id).localeCompare(String(b.id))),
  };

  writeJson(catalogPath, mergedCatalog);
  console.log(`Actualizado ${path.basename(catalogPath)} con ${mergedCatalog.buildings.length} edificios`);
};

function main() {
  const searchJson = readJson(searchPath, { type: "FeatureCollection", features: [] });
  const existingCatalog = readJson(catalogPath, { buildings: [] });
  const searchBuildings = (searchJson.features || []).filter((feature) =>
    isBuildingId(feature?.properties?.id)
  );

  const templates = collectExistingBuildingTemplates();
  const { updatedFeatures } = syncFloorGeojsons(searchBuildings, templates);
  syncCatalog(searchBuildings, existingCatalog);

  console.log(`Edificios sincronizados desde cs_sotero_search.json: ${searchBuildings.length}`);
  console.log(`Instancias de edificio escritas en pisos: ${updatedFeatures}`);
}

main();
