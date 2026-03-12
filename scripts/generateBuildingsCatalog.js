const fs = require("fs");
const path = require("path");

const geojsonPath = path.join(__dirname, "..", "src", "data", "cs_sotero_0.json");
const outputPath = path.join(__dirname, "..", "src", "data", "sotero_buildings_catalog.json");

function main() {
  const raw = fs.readFileSync(geojsonPath, "utf-8");
  const geojson = JSON.parse(raw);

  const buildings = (geojson.features || []).map((feature) => {
    const p = feature.properties || {};

    return {
      id: p.id || "",
      slug: p.slug || "",
      displayName: p.name || "",
      shortName: (p.id || "").replace("SR-", ""),
      realName: "",
      type: "unknown",
      floors: [],
      hasInteriorMap: false,
      hasInventory: false,
      responsibleArea: "",
      notes: "",
      sourceId: p.sourceId || "",
      centroid: p.centroid || null
    };
  });

  const result = { buildings };

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8");

  console.log(`Catálogo generado en: ${outputPath}`);
  console.log(`Total de edificios: ${buildings.length}`);
}

main();