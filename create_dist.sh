#!/bin/bash

mkdir -p dist/lib

rsync --progress -rutp src/assets/* dist/assets/
rsync --progress -rutp src/data/* dist/data/
rsync --progress -rutp src/lib/jquery/* dist/lib/jquery/
rsync --progress -rutp src/lib/leaflet/leaflet.css dist/lib/leaflet/
rsync --progress -rutp src/lib/leaflet/images/* dist/lib/leaflet/images/
rsync --progress -rutp src/lib/leaflet.draw/leaflet.draw.css dist/lib/leaflet.draw/
rsync --progress -rutp src/lib/leaflet.draw/images/* dist/lib/leaflet.draw/images/
rsync --progress -rutp src/styles/* dist/styles/
rsync --progress -rutp src/index.css dist/index.css
rsync --progress -rutp src/index.html dist/index.html