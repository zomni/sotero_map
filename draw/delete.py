"""
Functions to delete data in JSON and CSV files
"""
import tools as T


def delete_floor_building(floor: int, building: str, data_dir: str) -> None:
    new_data = {"location_floor": {}, "location_search": {},
                "url_search": {}, "csv_search": []}
    path_location_floor: str = T.get_location_floor_file_name(floor, building)
    path_location_search: str = T.get_location_search_file_name(building)
    path_url_search: str = T.get_url_search_file_name()
    path_csv_search: str = T.get_csv_search_file_name()
    new_data["location_floor"] = T.import_json(
        data_dir+"/"+path_location_floor)
    new_data["location_search"] = T.import_json(
        data_dir+"/"+path_location_search)
    new_data["url_search"] = T.import_json(data_dir+"/"+path_url_search)
    new_data["csv_search"] = T.import_csv(data_dir+"/"+path_csv_search)

    # remove from location floor
    remove_these = []
    new_floor_features: list = new_data["location_floor"]["features"][:]
    for elmt in new_data["location_floor"]["features"]:
        if elmt["properties"]["floor"] == floor and elmt["properties"]["building"] == building:
            remove_these.append(elmt["properties"]["id"])
            new_floor_features.remove(elmt)
    new_data["location_floor"]["features"] = new_floor_features

    # remove from [location_search] [url_search] and [csv_search]
    new_location_features: list = new_data["location_search"]["features"][:]
    new_url_features: list = new_data["url_search"]["features"][:]
    new_csv_features: list = new_data["csv_search"][:]
    for id in remove_these:
        for elmt in new_data["location_search"]["features"]:
            if elmt["properties"]["id"] == id:
                new_location_features.remove(elmt)
        for elmt in new_data["url_search"]["features"]:
            if elmt["properties"]["id"] == id:
                new_url_features.remove(elmt)
        for elmt in new_data["csv_search"]:
            if elmt[2] == id:
                new_csv_features.remove(elmt)

    # update data
    new_data["location_floor"]["features"] = new_floor_features
    new_data["location_search"]["features"] = new_location_features
    new_data["url_search"]["features"] = new_url_features
    new_data["csv_search"] = new_csv_features

    # export new data
    T.create_dir('generated_data')
    T.export_json(
        f'generated_data/{path_location_floor}', new_data["location_floor"])
    T.export_json(
        f'generated_data/{path_location_search}', new_data["location_search"])
    T.export_json(f'generated_data/{path_url_search}', new_data["url_search"])
    T.export_csv(f'generated_data/{path_csv_search}', new_data["csv_search"])


def delete_element(id: str, data_dir: str) -> None:
    new_data = {"location_floor": {}, "location_search": {},
                "url_search": {}, "csv_search": []}

    # Check if the element exist in database and remove it from [url_search]
    path_url_search: str = T.get_url_search_file_name()
    new_data["url_search"] = T.import_json(data_dir+"/"+path_url_search)
    found = 0
    floor: int = -10  # Doesn't exist
    building: str = ""
    new_url_features: list = new_data["url_search"]["features"][:]
    for elmt in new_data["url_search"]["features"]:
        if elmt["properties"]["id"] == id:
            found += 1
            floor = int(elmt["properties"]["floor"])
            building = elmt["properties"]["location"]
            new_url_features.remove(elmt)
    if found == 0:
        raise ValueError(
            "\nElement not found in database.\nMake sure you copied the right url.")

    # import rest of the data
    path_location_floor: str = T.get_location_floor_file_name(floor, building)
    path_location_search: str = T.get_location_search_file_name(building)
    path_csv_search: str = T.get_csv_search_file_name()
    new_data["location_floor"] = T.import_json(
        data_dir+"/"+path_location_floor)
    new_data["location_search"] = T.import_json(
        data_dir+"/"+path_location_search)
    new_data["csv_search"] = T.import_csv(data_dir+"/"+path_csv_search)

    # remove from [location_floor]
    new_floor_features: list = new_data["location_floor"]["features"][:]
    for elmt in new_data["location_floor"]["features"]:
        if elmt["properties"]["id"] == id:
            new_floor_features.remove(elmt)

    # remove from [location_search]
    new_location_features: list = new_data["location_search"]["features"][:]
    for elmt in new_data["location_search"]["features"]:
        if elmt["properties"]["id"] == id:
            new_location_features.remove(elmt)

    # remove from [csv_search]
    new_csv_features: list = new_data["csv_search"][:]
    for elmt in new_data["csv_search"]:
        if elmt[2] == id:
            new_csv_features.remove(elmt)

    # update data
    new_data["location_floor"]["features"] = new_floor_features
    new_data["location_search"]["features"] = new_location_features
    new_data["url_search"]["features"] = new_url_features
    new_data["csv_search"] = new_csv_features

    # export new data
    T.create_dir('generated_data')
    T.export_json(
        f'generated_data/{path_location_floor}', new_data["location_floor"])
    T.export_json(
        f'generated_data/{path_location_search}', new_data["location_search"])
    T.export_json(f'generated_data/{path_url_search}', new_data["url_search"])
    T.export_csv(f'generated_data/{path_csv_search}', new_data["csv_search"])
