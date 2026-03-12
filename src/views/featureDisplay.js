/////////////////////////////////////////////////////////////////////////////////
///////////////////////// Add interactions with the map /////////////////////////
/////////////////////////////////////////////////////////////////////////////////

import { map, HOST_URL } from "../views/map.js";

let buildingsCatalog = null;
let buildingsCatalogPromise = null;

const loadBuildingsCatalog = async () => {
  if (buildingsCatalog) {
    return buildingsCatalog;
  }

  if (!buildingsCatalogPromise) {
    buildingsCatalogPromise = fetch("data/sotero_buildings_catalog.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error("No se pudo cargar sotero_buildings_catalog.json");
        }
        return response.json();
      })
      .then((data) => {
        buildingsCatalog = data;
        return data;
      })
      .catch((error) => {
        console.error("Error cargando catálogo de edificios:", error);
        return { buildings: [] };
      });
  }

  return buildingsCatalogPromise;
};

const findBuildingInCatalog = async (feature) => {
  const id = feature?.properties?.id;
  if (!id) return null;

  const catalog = await loadBuildingsCatalog();
  const buildings = catalog?.buildings || [];

  return buildings.find((building) => building.id === id) || null;
};

const getFeatureDisplayName = async (feature) => {
  const building = await findBuildingInCatalog(feature);

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

const getFeaturePopupHtml = async (feature) => {
  const building = await findBuildingInCatalog(feature);
  const featureName = await getFeatureDisplayName(feature);
  const featureId = feature?.properties?.id || "Sin ID";
  const floor = feature?.properties?.floor ?? "N/D";

  const type = building?.type || "unknown";
  const realName = building?.realName || "";
  const shortName = building?.shortName || "";
  const responsibleArea = building?.responsibleArea || "";
  const floors = Array.isArray(building?.floors) ? building.floors.join(", ") : "";
  const hasInteriorMap = building?.hasInteriorMap ? "Sí" : "No";
  const hasInventory = building?.hasInventory ? "Sí" : "No";
  const notes = building?.notes || "";

  const link = `${HOST_URL}/?id=${featureId}&zoom=20`;
  const copyButtonHtml = `<button class="floorButton copy-button" onclick='
    navigator.clipboard.writeText("${link}")
      .then(()=>{this.innerHTML="Lien copié &check;"})
      .catch(()=>{alert("Impossible de copier le lien : ${link}");});
    '>Copier le lien</button>`;

  let detailsHtml = `
    <b>${featureName}</b><br/>
    ID: ${featureId}<br/>
    Piso: ${floor}
  `;

  if (building) {
    detailsHtml += `<br/>Tipo: ${type}`;

    if (shortName) {
      detailsHtml += `<br/>Código corto: ${shortName}`;
    }

    if (realName) {
      detailsHtml += `<br/>Nombre real: ${realName}`;
    }

    if (responsibleArea) {
      detailsHtml += `<br/>Área responsable: ${responsibleArea}`;
    }

    if (floors) {
      detailsHtml += `<br/>Pisos registrados: ${floors}`;
    }

    detailsHtml += `<br/>Mapa interior: ${hasInteriorMap}`;
    detailsHtml += `<br/>Inventario: ${hasInventory}`;

    if (notes) {
      detailsHtml += `<br/>Notas: ${notes}`;
    }
  }

  detailsHtml += `<br/><br/>${copyButtonHtml}`;

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