const path = require("path");

const src = (...segments) => path.resolve(__dirname, "src", ...segments);

module.exports = {
  mode: "production",
  entry: ["./src/index.js"],
  output: {
    filename: "index.js",
    path: path.resolve(__dirname, "dist/"),
  },
  experiments: {
    topLevelAwait: true,
  },
  resolve: {
    alias: {
      "@app/index": src("index.js"),
      "@app/campusSelector": src("components", "campusSelector.js"),
      "@app/findByUrl": src("utils", "findByUrl.js"),
      "@app/routePlanner": src("components", "routePlanner.js"),
      "@app/featureDisplay": src("views", "featureDisplay.js"),
      "@app/goToCampus": src("utils", "goToCampus.js"),
      "@app/soteroSearchMetadata": src("utils", "soteroSearchMetadata.js"),
      "@app/addData": src("utils", "addData.js"),
      "@app/autocompleteSearchBox": src("components", "autocompleteSearchBox.js"),
      "@app/walkingRouteLayer": src("components", "walkingRouteLayer.js"),
      "@app/webPublicControls": src("components", "webPublicControls.js"),
      "@app/manualBuildingEditor": src("components", "manualBuildingEditor.js"),
      "@app/sessionModeBadge": src("components", "sessionModeBadge.js"),
      "@app/buildingGeometryEditor": src("components", "buildingGeometryEditor.js"),
      "@app/walkingRouteEditor": src("components", "walkingRouteEditor.js"),
      "@app/adminMapToolsPanel": src("components", "adminMapToolsPanel.js"),
    },
  },
  module: {
    rules: [],
  },
};