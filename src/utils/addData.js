/////////////////////////////////////////////////////////////////////////////////
///////////////////////////// Add layers to the map /////////////////////////////
/////////////////////////////////////////////////////////////////////////////////

import "../views/draw.js";

import { BACKEND_API_URL, map } from "../views/map.js";

import {
  filter,
  style,
  onEachFeature,
  currentOpenFeatureId,
  openBuildingPopupLayer,
} from "@app/featureDisplay"; // GeoJSON options + popup state

import { createMarkers } from "../components/markers.js"; // Create markers for the map

import { latlngBuildings, campusBuildings } from "../views/buildingsInfo.js"; // Buildings info

import { createSvgElement } from "../utils/tools.js"; // Create SVG empty element
import {
  loadManualBuildings,
  mergeCatalogWithSoteroSearch,
  mergeGeoJsonWithSoteroSearch,
} from "@app/soteroSearchMetadata";

// Create a layer group
var layerGroup = L.layerGroup().addTo(map);

let buildingsCatalogCache = null;
let renderSequence = 0;

const loadBuildingsCatalog = async () => {
  if (buildingsCatalogCache) {
    return buildingsCatalogCache;
  }

  try {
    const response = await fetch(`data/sotero_buildings_catalog.json?v=${Date.now()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("No se pudo cargar sotero_buildings_catalog.json");
    }

    const data = await response.json();
    const mergedData = await mergeCatalogWithSoteroSearch(data);
    buildingsCatalogCache = mergedData;
    return mergedData;
  } catch (error) {
    console.error("Error cargando catálogo de edificios:", error);
    return { buildings: [] };
  }
};

const getAllowedBuildingIdsForFloor = async (floorNumber) => {
  const catalog = await loadBuildingsCatalog();
  const buildings = Array.isArray(catalog.buildings) ? catalog.buildings : [];

  const allowedIds = new Set();

  for (const building of buildings) {
    const floors = Array.isArray(building.floors) ? building.floors : [];

    if (floors.length > 0) {
      if (floors.includes(Number(floorNumber))) {
        allowedIds.add(building.id);
      }
    } else if (Number(floorNumber) === 0) {
      allowedIds.add(building.id);
    }
  }

  return allowedIds;
};

const SVGLayerGroup = (svg, floorNumber, building, location, expectedRenderSequence) => {
  if (expectedRenderSequence !== renderSequence) {
    return null;
  }

  var floor = "floor" + floorNumber.toString();
  var svgElement = createSvgElement();
  svgElement.innerHTML = svg;
  var svgOverlay = L.svgOverlay(
    svgElement,
    latlngBuildings[location][building][floor],
    {
      opacity: 0.7,
      interactive: false,
    }
  );
  var toAdd = L.layerGroup([svgOverlay]);
  layerGroup.addLayer(toAdd);
  return toAdd;
};

const reopenPopupIfNeeded = (geoJsonLayers) => {
  if (!currentOpenFeatureId || !Array.isArray(geoJsonLayers)) {
    return;
  }

  geoJsonLayers.forEach((geoJsonLayer) => {
    if (!geoJsonLayer || !geoJsonLayer.eachLayer) return;

    geoJsonLayer.eachLayer((layer) => {
      const featureId = layer?.feature?.properties?.id;
      if (featureId === currentOpenFeatureId) {
        openBuildingPopupLayer(layer, {
          zoom: true,
          rememberView: false,
          maxZoom: 20,
          padding: [40, 40],
        });
      }
    });
  });
};

const featuresLayerGroup = (json, expectedRenderSequence) => {
  if (expectedRenderSequence !== renderSequence) {
    return;
  }

  var markers;
  var geoJsonLayers = [];

  json.features.map((feature) => {
    if (feature.geometry.type === "Polygon") {
      const geoJson = L.geoJSON(feature, {
        filter: filter,
        style: style,
        onEachFeature: onEachFeature,
      });

      geoJsonLayers.push(geoJson);
      layerGroup.addLayer(geoJson);
    }
  });

  markers = createMarkers(json);
  var toAdd = L.layerGroup(markers);
  layerGroup.addLayer(toAdd);

  reopenPopupIfNeeded(geoJsonLayers);
};

const addSVG = (floorNumber, building, location, expectedRenderSequence) => {
  $.ajax({
    url: "assets/svg/" + building + floorNumber.toString() + ".svg",
    type: "GET",
    data: {},
    dataType: "text",
    success: function (svg) {
      SVGLayerGroup(svg, floorNumber, building, location, expectedRenderSequence);
    },
    error: function () {
      console.log("ERROR Failed to load SVG");
    },
  });
};

const buildFloorGeoJsonUrl = (school, location, floorNumber) => {
  return `data/${school}_${location}_${floorNumber.toString()}.json?v=${Date.now()}`;
};

const loadFloorGeoJson = async (school, location, floorNumber) => {
  const response = await fetch(buildFloorGeoJsonUrl(school, location, floorNumber), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`No se pudo cargar el piso ${floorNumber}`);
  }

  return response.json();
};

const cloneFeatureForFloor = (feature, floorNumber) => {
  return {
    ...feature,
    properties: {
      ...(feature?.properties || {}),
      floor: Number(floorNumber),
      footprintFloor: feature?.properties?.floor ?? 0,
    },
  };
};

const addBaseFootprintsForMissingBuildings = async (
  school,
  location,
  floorNumber,
  filteredJson,
  allowedBuildingIds
) => {
  if (Number(floorNumber) === 0) {
    return filteredJson;
  }

  const currentFeatures = Array.isArray(filteredJson.features) ? filteredJson.features : [];
  const currentIds = new Set(currentFeatures.map((feature) => feature?.properties?.id).filter(Boolean));
  const missingIds = new Set([...allowedBuildingIds].filter((id) => !currentIds.has(id)));

  if (missingIds.size === 0) {
    return filteredJson;
  }

  try {
    const baseJson = await loadFloorGeoJson(school, location, 0);
    const enrichedBaseJson = await mergeGeoJsonWithSoteroSearch(baseJson);
    const fallbackFeatures = (enrichedBaseJson.features || [])
      .filter((feature) => missingIds.has(feature?.properties?.id))
      .map((feature) => cloneFeatureForFloor(feature, floorNumber));

    return {
      ...filteredJson,
      features: [...currentFeatures, ...fallbackFeatures],
    };
  } catch (error) {
    console.error("Error cargando huellas base de edificios:", error);
    return filteredJson;
  }
};

const parseManualFloors = (floorsJson) => {
  try {
    const floors = JSON.parse(floorsJson || "[]");
    return Array.isArray(floors) ? floors.map(Number).filter((floor) => Number.isFinite(floor)) : [];
  } catch {
    return [];
  }
};

const manualBuildingToFeature = (building, floorNumber) => {
  let geometry = null;
  try {
    geometry = JSON.parse(building.geometryJson || "{}");
  } catch {
    geometry = null;
  }

  if (!geometry?.type || !geometry?.coordinates) {
    return null;
  }

  return {
    type: "Feature",
    properties: {
      id: building.externalId,
      name: building.displayName || building.externalId,
      kind: "building",
      buildingType: building.type || "manual",
      sourceId: "manual",
      floor: Number(floorNumber),
      isClickable: true,
      showLabel: false,
      slug: String(building.externalId || "").toLowerCase().replaceAll("_", "-"),
      centroid:
        building.centroidLongitude && building.centroidLatitude
          ? [building.centroidLongitude, building.centroidLatitude]
          : null,
      isVisible: true,
      isPublished: true,
      style: {
        color: "#3388ff",
        weight: 2,
        opacity: 1,
        fillColor: "#3388ff",
        fillOpacity: 0.2,
      },
    },
    geometry,
  };
};

const loadManualFeaturesForFloor = async (floorNumber) => {
  const manualBuildings = await loadManualBuildings();
  return manualBuildings
    .filter((building) => {
      const floors = parseManualFloors(building.floorsJson);
      return floors.length ? floors.includes(Number(floorNumber)) : Number(floorNumber) === 0;
    })
    .map((building) => manualBuildingToFeature(building, floorNumber))
    .filter(Boolean);
};

const addFeatures = (school, floorNumber, location, expectedRenderSequence) => {
  $.ajax({
    url: buildFloorGeoJsonUrl(school, location, floorNumber),
    type: "GET",
    data: {},
    dataType: "json",
    success: async function (json) {
      if (expectedRenderSequence !== renderSequence) {
        return;
      }

      const allowedBuildingIds = await getAllowedBuildingIdsForFloor(floorNumber);
      const enrichedJson = await mergeGeoJsonWithSoteroSearch(json);

      if (expectedRenderSequence !== renderSequence) {
        return;
      }

      const filteredJson = {
        ...enrichedJson,
        features: (enrichedJson.features || []).filter((feature) => {
          const featureId = feature?.properties?.id;
          if (!featureId) return false;
          return allowedBuildingIds.has(featureId);
        }),
      };

      const renderJson = await addBaseFootprintsForMissingBuildings(
        school,
        location,
        floorNumber,
        filteredJson,
        allowedBuildingIds
      );
      const manualFeatures = await loadManualFeaturesForFloor(floorNumber);

      if (expectedRenderSequence !== renderSequence) {
        return;
      }

      featuresLayerGroup(
        {
          ...renderJson,
          features: [...(renderJson.features || []), ...manualFeatures],
        },
        expectedRenderSequence
      );
    },
    error: function () {
      console.log("ERROR Failed to load JSON");
    },
  });
};

export const addDataToMap = (school, floorNumber, location) => {
  renderSequence += 1;
  const expectedRenderSequence = renderSequence;
  layerGroup.clearLayers();
  addFeatures(school, floorNumber, location, expectedRenderSequence);

  Object.keys(campusBuildings[location]).map((key) => {
    if (campusBuildings[location][key].includes(floorNumber)) {
      addSVG(floorNumber, key, location, expectedRenderSequence);
    }
  });
};

export const resetBuildingsCatalogCache = () => {
  buildingsCatalogCache = null;
};




