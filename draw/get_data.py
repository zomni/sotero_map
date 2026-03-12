"""
Functions to get data from the web interface generated drawings, the icons.json file and already existing JSON and CSV files.
"""

import leaflet_geojson as L
import tools as T


def get_styles_from_icons(icons_path: str) -> list[L.Lstyle]:
    displayOptions = L.LdisplayOptions()
    style: L.Lstyle
    lstyles: list[L.Lstyle] = []
    marker_collection = T.import_json(icons_path)
    for marker in marker_collection["markers"]:
        style = L.Lstyle(marker["icon"], displayOptions, marker["fill"], marker["fillColor"],
                         marker["fillOpacity"], marker["stroke"], marker["color"], marker["weight"], marker["opacity"])
        lstyles.append(style)
    return lstyles


def get_geojson_from_draw(draw_path: str, icons_path: str) -> L.Lgeojson:
    features = []
    # import the drawn data with the web interface
    data = T.import_json(draw_path)
    lstyles = get_styles_from_icons(icons_path)  # import icons.json
    alias = ''  # default value
    id = ''  # default value
    style = L.Lstyle("", L.LdisplayOptions(),
                     False, "", 0, False, "", 0, 0)  # default value
    center = L.Lcoord(0, 0)  # default value
    geometry = L.Lpoint(center)  # default value
    for element in data:
        match element["geometryType"]:
            case "Point":
                coords = element["geometryCoordinates"][:]
                # transform list of floats into Lcoord
                Lcoords = L.Lcoord(coords[0], coords[1])
                geometry = L.Lpoint(Lcoords)
                center = Lcoords  # center of a point is itself
            case "Polygon":
                coords = element["geometryCoordinates"][0]
                centroid = T.center_polygon(coords)  # center of a polygon
                center = L.Lcoord(centroid[0], centroid[1])
                # transform list of list of floats into list of Lcoord
                Lcoords = [L.Lcoord(coord[0], coord[1]) for coord in coords]
                geometry = L.Lpolygon([Lcoords])
        for e_style in lstyles:
            if element["placeType"]+".svg" == e_style.icon:
                style = e_style
        if element["id"] == "giveMeId":
            id = T.generate_uuid()
        else:
            id = element["id"]
        if element["alias"] == "giveMeAlias":
            alias = T.remove_non_ascii(element["name"])
        else:
            alias = element["alias"]
        properties = L.Lproperties(id, element["name"], alias, element["floor"], element["isPublished"], element["isSearchable"],
                                   element["isVisible"], element["isClickable"], style, element["placeType"], center, element["building"])
        feature = L.Lfeature(geometry, properties)
        features.append(feature)
    geojson = L.Lgeojson(features)
    return geojson


def get_existing_json(file_name: str, dir: str) -> dict:
    data = {"type": "FeatureCollection", "features": []}  # default value
    # if file exists in campusmap/app/generated_data/ folder
    if T.file_exists(f'data/{file_name}'):
        data = T.import_json(f'data/{file_name}')
    # if file exists in campusmap/src/data/ folder
    elif T.file_exists(f'{dir}/{file_name}'):
        data = T.import_json(f'{dir}/{file_name}')
    return data


def get_existing_csv(file_name: str, dir: str) -> list[list[str]]:
    data = []  # default value
    # if file exists in campusmap/app/generated_data/ folder
    if T.file_exists(f'generated_data/{file_name}'):
        data = T.import_csv(f'generated_data/{file_name}')
    # if file exists in campusmap/src/data/ folder
    elif T.file_exists(f'{dir}/{file_name}'):
        data = T.import_csv(f'{dir}/{file_name}')
    return data
