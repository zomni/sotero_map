/////////////////////////////////////////////////////////////////////////////////
///////////////////////////// Add layers to the map /////////////////////////////
/////////////////////////////////////////////////////////////////////////////////

import "../views/draw.js";

import { map } from "../views/map.js";

import {
  filter,
  style,
  onEachFeature,
  currentOpenFeatureId,
} from "../views/featureDisplay.js"; // GeoJSON options + popup state

import { createMarkers } from "../components/markers.js"; // Create markers for the map

import { latlngBuildings, campusBuildings } from "../views/buildingsInfo.js"; // Buildings info

import { createSvgElement } from "../utils/tools.js"; // Create SVG empty element

// Create a layer group
var layerGroup = L.layerGroup().addTo(map);

let buildingsCatalogCache = null;

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
    buildingsCatalogCache = data;
    return data;
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

    // Si tiene pisos definidos, respetarlos
    if (floors.length > 0) {
      if (floors.includes(Number(floorNumber))) {
        allowedIds.add(building.id);
      }
    } else {
      // Si aún no tiene pisos definidos, mostrarlo solo en piso 0
      if (Number(floorNumber) === 0) {
        allowedIds.add(building.id);
      }
    }
  }

  return allowedIds;
};

const SVGLayerGroup = (svg, floorNumber, building, location) => {
  /* Add Leaflet SVG overlay to layerGroup */
  var floor = "floor" + floorNumber.toString();
  var svgElement = createSvgElement();
  var svgOverlay = "";
  svgElement.innerHTML = svg;
  svgOverlay = L.svgOverlay(
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
        layer.openPopup();
      }
    });
  });
};

const featuresLayerGroup = (json) => {
  /* Add Leaflet GeoJSON to layerGroup */
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

  // Reopen popup automatically after the new floor is drawn
  reopenPopupIfNeeded(geoJsonLayers);
};

const addSVG = (floorNumber, building, location) => {
  /* Get the SVG from the server */
  $.ajax({
    url: "assets/svg/" + building + floorNumber.toString() + ".svg",
    type: "GET",
    data: {},
    dataType: "text",
    success: function (svg) {
      SVGLayerGroup(svg, floorNumber, building, location);
    },
    error: function () {
      console.log("ERROR Failed to load SVG");
    },
  });
};

const addFeatures = (school, floorNumber, location) => {
  /* Get the GeoJSON from the server */
  $.ajax({
    url:
      "data/" +
      school +
      "_" +
      location +
      "_" +
      floorNumber.toString() +
      ".json?v=" +
      Date.now(),
    type: "GET",
    data: {},
    dataType: "json",
    success: async function (json) {
      const allowedBuildingIds = await getAllowedBuildingIdsForFloor(floorNumber);

      const filteredJson = {
        ...json,
        features: (json.features || []).filter((feature) => {
          const featureId = feature?.properties?.id;
          if (!featureId) return false;
          return allowedBuildingIds.has(featureId);
        }),
      };

      featuresLayerGroup(filteredJson);
    },
    error: function () {
      console.log("ERROR Failed to load JSON");
    },
  });
};

export const addDataToMap = (school, floorNumber, location) => {
  /* Add GeoJSON and SVGs to the map */
  layerGroup.clearLayers();
  addFeatures(school, floorNumber, location);

  // Iterate on the buildings of the location
  Object.keys(campusBuildings[location]).map((key) => {
    // Check if the floor exists before adding the SVG
    if (campusBuildings[location][key].includes(floorNumber)) {
      addSVG(floorNumber, key, location);
    }
  });
};