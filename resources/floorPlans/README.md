# About this directory

## Description

This directory contains CentraleSupélec's floor plans for :
- Metz campus : main building.
- Paris-Saclay campus : Bouygues, Breguet and Eiffel buildings.
- Rennes campus : main building.

### *How to use this directory*

Every building's subdirectory is constructed as fllows :
- The original PNGs are in `base_png`.
- Transformed SGVs are in `transformation_<number>`.
- The final SGVs are in the root of the subdirectory.

The original ones (Large PNGs) are taken from former map provider : MapWize, the new ones (optimized SVGs) are generated using Adobe Illustrator :

### *How it was done ?*

- Import one PNG.
- Use the `Image Trace` function, setting it to color, to automatic color range & to remove the white areas.
- Align the generated SVG with the current map elements using the rotate function : simply screen shot the current map elements and change its orientation (ex: Breguet : -0.98°).
- Make sure all *artboards* have the same size and the SVG are well alligned for the same building.
- Export to a SVG using *artboard* (for the transparency).