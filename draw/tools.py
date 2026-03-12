"""
Tool functions for app
"""

import codecs
import json
import csv
import re
import uuid
from datetime import datetime
import numpy as np
import os
import shutil


def import_json(json_path: str) -> dict:
    with codecs.open(json_path, 'r', encoding='utf-8') as json_file:
        data = json.load(json_file)
    print(f"Action: Importing JSON from {json_path}")
    return data


def import_csv(csv_path: str) -> list[list[str]]:
    with open(csv_path, 'r') as csv_file:
        data = list(csv.reader(csv_file, delimiter=","))[1:]
        print(f"Action: Importing CSV from {csv_path}")
    return data


def export_json(json_path: str, data: dict | list) -> None:
    with codecs.open(json_path, 'w', encoding='utf-8') as json_file:
        json.dump(data, json_file, indent=4, ensure_ascii=False)
    print(f"Action: Exporting JSON to {json_path}")


def export_csv(csv_path: str, data: list[list[str]]) -> None:
    with open(csv_path, 'w') as csv_file:
        writer = csv.writer(csv_file)
        writer.writerow(['Campus', 'Name', 'ID', 'URL with ID',
                        'Alias', 'URL with Alias'])  # header row
        for element in data:
            writer.writerow(element)
    print(f"Action: Exporting CSV to {csv_path}")


def get_location(draw_json: str) -> str:
    info = str.split(draw_json, '_')
    return info[1]


def get_floor(draw_json: str) -> str:
    info = str.split(draw_json, '_')
    return info[2]


def is_ps(building: str):
    if building == "bouygues" or building == "eiffel" or building == "breguet" or building == "ps":
        return True

def get_location_floor_file_name(floor: int, building: str) -> str:
    if building == "rennes" or building == "metz":
        return f'cs_{building}_{str(floor)}.json'
    elif is_ps(building):
        return f'cs_ps_{str(floor)}.json'
    else:
        raise NameError(f"\nUnkown building: '{building}'.\nAvailable options are : 'bouygues', 'breguet', 'eiffel', 'metz' and 'rennes'.")

def get_location_search_file_name(building: str) -> str:
    if building == "rennes" or building == "metz":
        return f'cs_{building}_search.json'
    elif is_ps(building):
        return f'cs_ps_search.json'
    else:
        raise NameError(f"\nUnkown building: '{building}'.\nAvailable options are : 'bouygues', 'breguet', 'eiffel', 'metz' and 'rennes'.")

def get_url_search_file_name() -> str:
        return 'cs_searchByURL.json'

def get_csv_search_file_name() -> str:
        return 'cs_features_data.csv'

def remove_non_ascii(string: str) -> str:
    res = re.sub(r'[^\x00-\x7F]+', '_', string)
    res = res.replace(' ', '_')
    return res.lower()


def generate_uuid() -> str:
    seed = str(datetime.now().timestamp())
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, seed))


def center_polygon(coords: list[list[float]]) -> list[float]:
    polygon = np.array(coords)
    center = polygon.mean(axis=0)
    return list(center)


def id_url(id: str) -> str:
    return 'https://maps.centralesupelec.fr/?id={}&zoom=20'.format(id)


def alias_url(alias: str) -> str:
    return 'https://maps.centralesupelec.fr/?alias={}&zoom=20'.format(alias)


def create_dir(path: str) -> None:
    if not os.path.exists(path):
        os.mkdir(path)
        print(f'Action: "{path}/" created')


def file_exists(path: str) -> bool:
    return os.path.isfile(path)


def move_files(source: str, destination: str) -> None:
    for file in os.listdir(source):
        old_file = os.path.join(destination, file)
        if file_exists(old_file):
            os.remove(old_file)
            print(f'Action: "{old_file}" deleted')
        new_file = os.path.join(source, file)
        shutil.move(new_file, destination)
        print(f'Action: "{new_file}" moved to "{destination}/"')

def delete_file(path: str) -> None:
    if file_exists(path):
        print(f'Action: Deleting {path}')
        os.remove(path)