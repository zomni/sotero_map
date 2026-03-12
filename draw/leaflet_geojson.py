"""
Leaflet GeoJSON classes
"""


class Lcoord:
    def __init__(self, lat: float, lng: float) -> None:
        self.lat = lat  # instance attribute
        self.lng = lng

    def get(self) -> list:
        return [self.lat, self.lng]

    def toString(self):
        return str(self.get())


class Lpoint:
    type: str = "Point"  # class attribute != instance attribute

    def __init__(self, coord: Lcoord) -> None:
        self.coordinates = coord

    def get(self) -> dict:
        return {"type": self.type,
                "coordinates": self.coordinates.get()}

    def toString(self):
        return str(self.get())


class Lpolygon:
    type: str = "Polygon"

    def __init__(self, lcoord: list[list[Lcoord]]) -> None:
        self.coordinates = lcoord[:]  # copy the list

    def get(self) -> dict:
        return {"type": self.type,
                "coordinates": [[e.get() for e in self.coordinates[0]]]}

    def toString(self):
        return str(self.get())


Lgeometry = Lpoint | Lpolygon


class LdisplayOptions:
    def __init__(self,) -> None:
        self.marker = True
        self.title = True
        self.polygon = True

    def get(self) -> dict:
        return {"marker": self.marker,
                "title": self.title,
                "polygon": self.polygon}

    def toString(self):
        return str(self.get())


class Lstyle:
    def __init__(self, icon: str, displayOptions: LdisplayOptions, fill: bool, fillColor: str, fillOpacity: int, stroke: bool, color: str, weight: int, opacity: int) -> None:
        self.icon = icon
        self.displayOptions = displayOptions
        self.fill = fill
        self.fillColor = fillColor
        self.fillOpacity = fillOpacity
        self.stroke = stroke
        self.color = color
        self.weight = weight
        self.opacity = opacity

    def get(self) -> dict:
        return {"icon": self.icon,
                "displayOptions": self.displayOptions.get(),
                "fill": self.fill,
                "fillColor": self.fillColor,
                "fillOpacity": self.fillOpacity,
                "stroke": self.stroke,
                "color": self.color,
                "weight": self.weight,
                "opacity": self.opacity}

    def toString(self):
        return str(self.get())


class Ltranslation:
    def __init__(self, title: str) -> None:
        self.title = title
        self.subtitle = ""
        self.language = "fr"

    def get(self) -> dict:
        return {"title": self.title,
                "subtitle": self.subtitle,
                "language": self.language}

    def toString(self):
        return str(self.get())


class Lproperties:
    def __init__(self, id: str, name: str, alias: str, floor: int, isPublished: bool, isSearchable: bool, isVisible: bool, isClickable: bool,  style: Lstyle, placeType: str, center: Lcoord, building: str) -> None:
        self.id = id
        self.name = name
        self.alias = alias
        self.floor = floor
        self.isPublished = isPublished
        self.isSearchable = isSearchable
        self.isVisible = isVisible
        self.isClickable = isClickable
        self.style = style
        self.placeType = placeType
        self.translations = Ltranslation(name)
        self.center = center
        self.building = building

    def get(self) -> dict:
        return {"id": self.id,
                "name": self.name,
                "alias": self.alias,
                "floor": self.floor,
                "isPublished": self.isPublished,
                "isSearchable": self.isSearchable,
                "isVisible": self.isVisible,
                "isClickable": self.isClickable,
                "style": self.style.get(),
                "placeType": self.placeType,
                "translations": [self.translations.get()],
                "center": self.center.get(),
                "building": self.building}

    def toString(self):
        return str(self.get())

    def make_search_loc(self, floor: int):
        return {"id": self.id,
                "floor": floor,
                "popupContent": self.name + ', étage ' + str(floor),
                "title": self.name,
                "description": self.translations.subtitle,
                "image": self.style.icon}

    def make_search_url(self, location: str, floor: int):
        return {"id": self.id,
                "name": self.name,
                "floor": floor,
                "center": self.center.get(),
                "location": location}


class Lproperties_search_loc:

    def __init__(self, properties: Lproperties, floor: int) -> None:
        self.id = properties.id
        self.floor = floor
        self.popupContent = properties.name + ', étage ' + str(floor)
        self.title = properties.name
        self.description = properties.translations.subtitle
        self.image = properties.style.icon

    def get(self) -> dict:
        return {"id": self.id,
                "floor": self.floor,
                "popupContent": self.popupContent,
                "title": self.title,
                "description": self.description,
                "image": self.image}

    def toString(self):
        return str(self.get())


class Lproperties_search_url:

    def __init__(self, properties: Lproperties, location: str, floor: int) -> None:
        self.id = properties.id
        self.name = properties.name
        self.floor = floor
        self.center = properties.center
        self.location = location

    def get(self) -> dict:
        return {"id": self.id,
                "name": self.name,
                "floor": self.floor,
                "center": self.center.get(),
                "location": self.location}


Ltype_properties = Lproperties | Lproperties_search_loc | Lproperties_search_url


class Lfeature:
    type: str = "Feature"

    def __init__(self, geometry: Lgeometry, properties: Ltype_properties) -> None:
        self.geometry = geometry
        self.properties = properties

    def get(self) -> dict:
        return {"type": self.type,
                "geometry": self.geometry.get(),
                "properties": self.properties.get()}

    def toString(self):
        return str(self.get())


class Lgeojson:
    type: str = "FeatureCollection"

    def __init__(self, lLfeatures: list[Lfeature]) -> None:
        self.features = lLfeatures[:]

    def get(self) -> dict:
        return {"type": self.type,
                "features": [e.get() for e in self.features]}

    def toString(self):
        return str(self.get())
