/////////////////////////////////////////////////////////////////////////////////
///////////////////////////// Add layers to the map /////////////////////////////
/////////////////////////////////////////////////////////////////////////////////

import "../views/draw.js"

import { map } from "../views/map.js";

import { filter, style, onEachFeature } from "../views/featureDisplay.js"; // GeoJSON  options

import { createMarkers } from "../components/markers.js"; // Create markers for the map

import { latlngBuildings, campusBuildings } from "../views/buildingsInfo.js"; // Buildings info

import { createSvgElement } from "../utils/tools.js"; // Create SVG empty element

// Create a layer group
var layerGroup = L.layerGroup().addTo(map);

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

const featuresLayerGroup = (json) => {
  /* Add Leaflet GeoJSON to layerGroup */
  var markers, geoJson;
  json.features.map((feature) => {
    if (feature.geometry.type === "Polygon") {
      geoJson = L.geoJSON(feature, {
        filter: filter,
        style: style,
        onEachFeature: onEachFeature,
      });
      layerGroup.addLayer(geoJson);
    }
  });
  markers = createMarkers(json);
  var toAdd = L.layerGroup(markers.concat([geoJson]));
  layerGroup.addLayer(toAdd);
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
    url: "data/" + school + "_" + location + "_" + floorNumber.toString() + ".json",
    type: "GET",
    data: {},
    dataType: "json",
    success: function (json) {
      featuresLayerGroup(json);
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
