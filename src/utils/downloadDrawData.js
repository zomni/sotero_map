

export const downloadDrawData = (FeatureLayer, floorNumber, location) => {
// Select the layers
    const layers = FeatureLayer._layers;

    // Get only the info we need
    var floorFeatures = [];
    for (var key in layers) {
    if (layers.hasOwnProperty(key)) {
        // Set the floor to the button push
        layers[key].options.properties.setFloor(floorNumber);
        floorFeatures.push(layers[key].options.properties);
    }
    }

    const filename = "_"+ location + "_" + floorNumber + "_data.json";

    const jsonStr = JSON.stringify(floorFeatures);

    let element = document.createElement("a");
    element.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(jsonStr)
    );
    element.setAttribute("download", filename);

    element.style.display = "none";
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
};
