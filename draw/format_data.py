"""
Functions that format the data for the web app.
"""

import leaflet_geojson as L
import tools as T


def format_location_search(data: L.Lgeojson, floor: int) -> dict:
    new_data = []
    new_element: L.Lfeature
    new_properties: L.Lproperties_search_loc
    for element in data.features:
        new_properties = L.Lproperties_search_loc(element.properties, floor)
        new_element = L.Lfeature(element.geometry, new_properties)
        new_data.append(new_element)
    geojson = L.Lgeojson(new_data)
    return geojson.get()


def format_url_search(data: L.Lgeojson, floor: int, location: str) -> dict:
    new_data = []
    new_element: L.Lfeature
    new_properties: L.Lproperties_search_url
    for element in data.features:
        new_properties = L.Lproperties_search_url(
            element.properties, location, floor)
        new_element = L.Lfeature(element.geometry, new_properties)
        new_data.append(new_element)
    geojson = L.Lgeojson(new_data)
    new_gejson = geojson.get()
    for element in new_gejson["features"]:
        del element["geometry"]
    return new_gejson


def format_csv_search(geojson: L.Lgeojson, location: str):
    data = []
    id = ''
    #alias = ''
    for feature in geojson.features:
        id = feature.properties.id
        #alias = location[:2]+'_'+feature.properties.alias
        data.append([location, feature.properties.name, id,
                    T.id_url(id)
                    #, alias, T.alias_url(alias)
                    ])
    return data
