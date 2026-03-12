"""
Functions to update data in JSON and CSV files
"""

import leaflet_geojson as L
from format_data import *
from get_data import *


def update_location_floor(geojson: L.Lgeojson, floor: int, location: str, dir: str) -> dict:
    """
    Return updated location floor JSON object
    """
    print(f'Updating data in {location} floor {floor} ...')
    file_name = f'cs_{location}_{floor}.json'
    data = get_existing_json(file_name, dir)
    add_to_data = geojson.get()
    data["features"].extend(add_to_data["features"])
    print(f'Data in {location} floor {floor} updated')
    return data


def update_location_search(geojson: L.Lgeojson, floor: int, location: str, dir: str) -> dict:
    """
    Return updated location search JSON object
    """
    print(f'Updating location search data in {location} ...')
    file_name = f'cs_{location}_search.json'
    search = get_existing_json(file_name, dir)
    add_to_search = format_location_search(geojson, floor)
    search["features"].extend(add_to_search["features"])
    print(f'Location search data in {location} updated')
    return search


def update_url_search(geojson: L.Lgeojson, floor: int, location: str, dir: str) -> dict:
    """
    Return updated URL search JSON object
    """
    print(f'Updating url search data in {location} ...')
    file_name = 'cs_searchByURL.json'
    search = get_existing_json(file_name, dir)
    add_to_search = format_url_search(geojson, floor, location)
    search["features"].extend(add_to_search["features"])
    print(f'URL search data in {location} updated')
    return search


def update_csv(geojson: L.Lgeojson, location: str, dir: str) -> list[list[str]]:
    """
    Return updated CSV search object
    """
    print(f'Updating csv search data in {location} ...')
    file_name = 'cs_features_data.csv'
    search = get_existing_csv(file_name, dir)
    add_to_search = format_csv_search(geojson, location)
    search.extend(add_to_search)
    print(f'CSV search data in {location} updated')
    return search
