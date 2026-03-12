import sys
import tools as T
from update_data import *
from get_data import get_geojson_from_draw
from delete import *


def main() -> None:
    args = sys.argv[1:]
    n = len(args)
    usage_msg = 'Usage:\npython draw.py --file <path_to_draw_json> --icons <path_to_icons.json> --data_dir <path_to_data_directory>\npython draw.py delete --floor <floor_number> --building <building_name> --data_dir <path_to_data_directory>\npython draw.py delete --url <element_url> --data_dir <path_to_data_directory>\npython draw.py --move_to <path_to_destination_directory>\npython draw.py --help'

    if n == 6 and args[0] == '--file' and args[2] == '--icons' and args[4] == '--data_dir':
        draw_path = args[1]
        icons_path = args[3]
        data_dir = args[5]

        floor = T.get_floor(draw_path)
        location = T.get_location(draw_path)

        new_data = get_geojson_from_draw(draw_path, icons_path)
        new_location_floor = update_location_floor(
            new_data, int(floor), location, data_dir)
        new_location_search = update_location_search(
            new_data, int(floor), location, data_dir)
        new_url_search = update_url_search(
            new_data, int(floor), location, data_dir)
        new_csv = update_csv(new_data, location, data_dir)

        T.create_dir('generated_data')
        T.export_json(
            f'generated_data/cs_{location}_{floor}.json', new_location_floor)
        T.export_json('generated_data/cs_searchByURL.json', new_url_search)
        T.export_json(
            f'generated_data/cs_{location}_search.json', new_location_search)
        T.export_csv('generated_data/cs_features_data.csv', new_csv)
        T.delete_file(draw_path)

        print('\nUse "python draw.py --move_to <path_to_destination_directory>" to move the generated files to the destination directory\n')
        sys.exit(0)

    elif n == 7 and args[0] == 'delete' and args[1] == '--floor' and args[3] == '--building' and args[5] == '--data_dir':
        floor = int(args[2])
        building = args[4]
        data_dir = args[6]
        delete_floor_building(floor, building, data_dir)
        print(
            f'Deleting floor {floor} in building {building}')
        print('\nUse "python draw.py --move_to <path_to_destination_directory>" to move the generated files to the destination directory\n')
        sys.exit(0)

    elif n == 5 and args[0] == 'delete' and args[1] == '--url' and args[3] == '--data_dir':
        url = args[2]
        data_dir = args[4]
        temp = url.split('?id=')[1]
        id = temp.split('&zoom=')[0]
        delete_element(id, data_dir)
        print(
            f'Deleting element {id}')
        print('\nUse "python draw.py --move_to <path_to_destination_directory>" to move the generated files to the destination directory\n')
        sys.exit(0)

    elif n == 2 and args[0] == '--move_to':
        dest = args[1]
        source = 'generated_data'
        answer = input(
            f'WARNING: This action will change current files in {dest}.\nAre you sure that you want to proceed ?\nyes(y)/no(n): ')
        if answer.lower() in ["y", "yes"]:
            T.move_files(source, dest)
        elif answer.lower() in ["n", "no"]:
            print('ABORT: Action cancelled')
            sys.exit(0)
        else:
            print('ERROR: Invalid answer')
            sys.exit(1)

    elif n == 1 and args[0] == '--help':
        print('Help:\n'+usage_msg)
        sys.exit(0)

    else:
        print('ERROR: Invalid arguments\n'+usage_msg)
        sys.exit(1)


if __name__ == '__main__':
    main()
