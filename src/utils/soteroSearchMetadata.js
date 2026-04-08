import { BACKEND_API_URL } from "../views/map.js";

const SOTERO_SEARCH_PATH = `data/cs_sotero_search.json?v=${Date.now()}`;

let soteroSearchMetadataCache = null;
let backendBuildingOverridesCache = null;

const isBuildingId = (id) => /^SR-BLD-\d+$/.test(String(id || ""));
const DEFAULT_FLOOR = 0;

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

const parseFloorsFromMetadata = (properties) => {
  const popupFloors = parseFloorsFromText(properties.popupContent);
  if (popupFloors.length > 0) {
    return popupFloors;
  }

  const descriptionFloors = parseFloorsFromText(properties.description);
  if (descriptionFloors.length > 0) {
    return descriptionFloors;
  }

  if (Number.isFinite(Number(properties.floor))) {
    return [Number(properties.floor)];
  }

  return [DEFAULT_FLOOR];
};

const extractBuildingMetadata = (feature) => {
  const properties = feature?.properties || {};
  const id = properties.id;

  if (!isBuildingId(id)) {
    return null;
  }

  return {
    id,
    title: properties.title || "",
    description: properties.description || "",
    popupContent: properties.popupContent || "",
    floor: properties.floor ?? 0,
    floors: parseFloorsFromMetadata(properties),
    searchText: properties.searchText || "",
    geometry: feature?.geometry || null,
  };
};

const loadBackendBuildingOverrides = async () => {
  if (backendBuildingOverridesCache) {
    return backendBuildingOverridesCache;
  }

  try {
    const response = await fetch(`${BACKEND_API_URL}/api/synced-buildings`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("No se pudo cargar synced-buildings");
    }

    const items = await response.json();
    const overrides = new Map();

    for (const item of Array.isArray(items) ? items : []) {
      overrides.set(item.externalId, item);
    }

    backendBuildingOverridesCache = overrides;
    return backendBuildingOverridesCache;
  } catch (error) {
    console.error("Error cargando overrides de edificios desde backend:", error);
    backendBuildingOverridesCache = new Map();
    return backendBuildingOverridesCache;
  }
};

const parseFloorsJson = (floorsJson) => {
  if (!floorsJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(floorsJson);
    return uniqueSortedFloors(parsed);
  } catch {
    return [];
  }
};

const applyBackendOverrideToBuilding = (building, backendOverride) => {
  if (!backendOverride) {
    return building;
  }

  const backendDisplayName = backendOverride.displayName || building.displayName || building.realName || building.id;
  const backendFloors = parseFloorsJson(backendOverride.floorsJson);
  const mergedSearchText = [
    backendDisplayName,
    building.displayName || "",
    building.realName || "",
    building.shortName || "",
    building.id || "",
    building.searchTitle || "",
    building.searchDescription || "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    ...building,
    displayName: backendDisplayName,
    realName: backendDisplayName,
    searchTitle: backendDisplayName,
    searchDescription: mergedSearchText,
    floors: backendFloors.length ? backendFloors : building.floors,
    campus: backendOverride.campus || building.campus || "",
  };
};

const applyBackendOverrideToFeature = (feature, backendOverride) => {
  if (!backendOverride) {
    return feature;
  }

  const properties = feature?.properties || {};
  const backendDisplayName = backendOverride.displayName || properties.title || properties.name || properties.id;
  const mergedSearchText = [
    backendDisplayName,
    properties.title || "",
    properties.name || "",
    properties.id || "",
    properties.searchText || "",
    properties.description || "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    ...feature,
    properties: {
      ...properties,
      name: backendDisplayName,
      title: backendDisplayName,
      searchText: mergedSearchText,
    },
  };
};

export const loadSoteroSearchMetadata = async () => {
  if (soteroSearchMetadataCache) {
    return soteroSearchMetadataCache;
  }

  try {
    const response = await fetch(SOTERO_SEARCH_PATH, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("No se pudo cargar cs_sotero_search.json");
    }

    const json = await response.json();
    const features = Array.isArray(json?.features) ? json.features : [];
    const metadataById = new Map();

    for (const feature of features) {
      const metadata = extractBuildingMetadata(feature);
      if (!metadata) continue;
      metadataById.set(metadata.id, metadata);
    }

    soteroSearchMetadataCache = metadataById;
    return metadataById;
  } catch (error) {
    console.error("Error cargando metadatos desde cs_sotero_search.json:", error);
    soteroSearchMetadataCache = new Map();
    return soteroSearchMetadataCache;
  }
};

export const mergeCatalogWithSoteroSearch = async (catalog) => {
  const metadataById = await loadSoteroSearchMetadata();
  const backendOverridesById = await loadBackendBuildingOverrides();
  const buildings = Array.isArray(catalog?.buildings) ? catalog.buildings : [];
  const mergedBuildings = buildings.map((building) => {
    const metadata = metadataById.get(building.id);

    const mergedWithSearch = !metadata
      ? building
      : {
          ...building,
          displayName: metadata.title || building.displayName,
          realName: metadata.title || building.realName,
          floors: metadata.floors?.length ? metadata.floors : building.floors,
          searchTitle: metadata.title || "",
          searchDescription: metadata.description || "",
          searchPopupContent: metadata.popupContent || "",
        };

    return applyBackendOverrideToBuilding(mergedWithSearch, backendOverridesById.get(building.id));
  });

  const existingIds = new Set(mergedBuildings.map((building) => building.id));

  for (const metadata of metadataById.values()) {
    if (existingIds.has(metadata.id)) continue;

    mergedBuildings.push(
      applyBackendOverrideToBuilding(
        {
          id: metadata.id,
          slug: metadata.id.toLowerCase().replaceAll("_", "-"),
          displayName: metadata.title || metadata.id,
          shortName: metadata.id.replace("SR-", ""),
          realName: metadata.title || "",
          type: "unknown",
          floors: metadata.floors || [DEFAULT_FLOOR],
          hasInteriorMap: false,
          hasInventory: false,
          responsibleArea: "",
          notes: "",
          sourceId: "",
          centroid: null,
          searchTitle: metadata.title || "",
          searchDescription: metadata.description || "",
          searchPopupContent: metadata.popupContent || "",
        },
        backendOverridesById.get(metadata.id)
      )
    );
  }

  return {
    ...catalog,
    buildings: mergedBuildings,
  };
};

export const mergeGeoJsonWithSoteroSearch = async (geoJson) => {
  const metadataById = await loadSoteroSearchMetadata();
  const backendOverridesById = await loadBackendBuildingOverrides();
  const features = Array.isArray(geoJson?.features) ? geoJson.features : [];

  return {
    ...geoJson,
    features: features.map((feature) => {
      const properties = feature?.properties || {};
      const metadata = metadataById.get(properties.id);

      const enrichedFeature = !metadata
        ? feature
        : {
            ...feature,
            properties: {
              ...properties,
              name: metadata.title || properties.name,
              title: metadata.title || properties.title,
              description: metadata.description || properties.description,
              popupContent: metadata.popupContent || properties.popupContent,
              searchText: metadata.searchText || properties.searchText,
            },
          };

      return applyBackendOverrideToFeature(enrichedFeature, backendOverridesById.get(properties.id));
    }),
  };
};

export const resetSoteroSearchMetadataCaches = () => {
  soteroSearchMetadataCache = null;
  backendBuildingOverridesCache = null;
};

