const fs = require("fs");
const path = require("path");

const root = __dirname;
const distDir = path.join(root, "dist");

const copyEntry = (source, target) => {
  if (!fs.existsSync(source)) {
    return;
  }

  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      copyEntry(path.join(source, entry), path.join(target, entry));
    }
    return;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
};

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

[
  ["src/assets", "dist/assets"],
  ["src/data", "dist/data"],
  ["src/lib/jquery", "dist/lib/jquery"],
  ["src/lib/leaflet/leaflet.css", "dist/lib/leaflet/leaflet.css"],
  ["src/lib/leaflet/images", "dist/lib/leaflet/images"],
  ["src/lib/leaflet.draw/leaflet.draw.css", "dist/lib/leaflet.draw/leaflet.draw.css"],
  ["src/lib/leaflet.draw/images", "dist/lib/leaflet.draw/images"],
  ["src/styles", "dist/styles"],
  ["src/index.css", "dist/index.css"],
  ["src/index.html", "dist/index.html"],
].forEach(([source, target]) => {
  copyEntry(path.join(root, source), path.join(root, target));
});
