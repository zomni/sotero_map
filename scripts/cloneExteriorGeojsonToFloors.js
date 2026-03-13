const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "src", "data");
const sourcePath = path.join(dataDir, "cs_sotero_0.json");

const targetFloors = [-1, 1, 2, 3, 4, 5];

function main() {
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf-8"));

  for (const floor of targetFloors) {
    const cloned = {
      ...source,
      features: (source.features || []).map((feature) => ({
        ...feature,
        properties: {
          ...(feature.properties || {}),
          floor: floor
        }
      }))
    };

    const targetPath = path.join(dataDir, `cs_sotero_${floor}.json`);
    fs.writeFileSync(targetPath, JSON.stringify(cloned, null, 2), "utf-8");
    console.log(`Generado: ${targetPath}`);
  }
}

main();