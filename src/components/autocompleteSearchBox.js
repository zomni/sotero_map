/* 
    Created on : Aug 31, 2015
    Author     : yeozkaya@gmail.com
    repo       : https://github.com/utahemre/Leaflet.GeoJSONAutocomplete
    https://github.com/utahemre/Leaflet.GeoJSONAutocomplete/blob/master/LICENSE.md
    Adapted for this project by commenting, keeping the good stuff (JQuery), removing paging and adding Fuse JS to search
*/

import { map, HOST_URL } from "../views/map.js";
import campuses from "../data/campuses.js";

// import "../lib/jquery/jquery-3.6.0.min.js"; // Not working with webpack

import Fuse from "../lib/fuse/fuse.basic.esm.min.js";

(function ($) {
  const fuseSearch = (geoJson, pattern, resultLimit) => {
    var fuseResult,
      result = [];
    const options = { keys: ["properties.title"] };

    const fuse = new Fuse(geoJson.features, options);

    fuseResult = fuse.search(pattern, { limit: resultLimit });
    fuseResult.map((item) => {
      result.push(item.item);
    });

    return result; // list of features
  };

  var options = {
    geojsonServiceAddress: "http://yourGeoJsonSearchAddress",
    placeholderMessage: "Search...",
    searchButtonTitle: "Search",
    clearButtonTitle: "Clear",
    foundRecordsMessage: "showing results.",
    limit: 10,
    notFoundMessage: "not found.",
    notFoundHint: "Make sure your search criteria is correct and try again.",
    drawColor: "blue",
    pointGeometryZoomLevel: -1, //Set zoom level for point geometries -1 means use leaflet default.
    place: "", // set campus
  };

  var activeResult = -1;
  var resultCount = 0; // Number of results found for the current search with ajax call
  var lastSearch = ""; // Current search box input value
  var searchLayer; // A layer to show the search results
  var features = [];
  var collapseOnBlur = true;

  // fn literally refers to the jquery prototype.
  $.fn.GeoJsonAutocomplete = function (userDefinedOptions) {
    var keys = Object.keys(userDefinedOptions);

    for (var i = 0; i < keys.length; i++) {
      // Change default keys value to the user defined options
      options[keys[i]] = userDefinedOptions[keys[i]];
    }

    $(this).each(function () {
      var element = $(this);
      // create search box in search container, this = div#searchContainer
      element.addClass("autocomplete-searchContainer"); // add class to search container this = div#searchContainer.autocomplete-searchContainer
      element.append(
        '<input id="searchBox" class="autocomplete-searchBox" placeholder="' +
          options.placeholderMessage +
          '"/>'
      ); // add input box to search container with id = searchBox
      element.append(
        '<input id="searchButton" class="autocomplete-searchButton" type="submit" value="" title="' +
          options.searchButtonTitle +
          '"/>'
      ); // add search button to search container with id = searchButton, class = autocomplete-searchButton
      element.append(
        '<span id="classDivider" class="autocomplete-divider"></span>'
      ); // add divider between search & clear buttons to search container
      element.append(
        '<input id="clearButton" class="autocomplete-clearButton" type="submit"  value="" title="' +
          options.clearButtonTitle +
          '">'
      ); // add clear button to search container with id = clearButton, class = autocomplete-clearButton

      $("#searchBox")[0].value = ""; // set search box value to empty string

      $("#searchBox").delayKeyup(function (event) {
        // add delayKeyup to search box arguments = (callback function, timeout)
        switch (event.keyCode) {
          case 13: // enter
            searchButtonClick(); // fix here when search button is clicked menu still open & same on search click
            break;
          case 38: // up arrow
            prevResult();
            break;
          case 40: // down arrow
            nextResult();
            break;
          case 37: //left arrow, Do Nothing
          case 39: //right arrow, Do Nothing
            break;
          default:
            if ($("#searchBox")[0].value.length > 0) {
              getValuesAsGeoJson();
            } else {
              clearButtonClick();
            }
            break;
        }
      }, 300);

      $("#searchBox").focus(function () {
        // make results menu visible when search box is focused (opened + results)
        if ($("#resultsDiv")[0] !== undefined) {
          $("#resultsDiv")[0].style.visibility = "visible";
        }
      });

      $("#searchBox").blur(function () {
        if ($("#resultsDiv")[0] !== undefined) {
          if (collapseOnBlur) {
            $("#resultsDiv")[0].style.visibility = "collapse";
          } else {
            collapseOnBlur = true;

            window.setTimeout(function () {
              $("#searchBox").focus();
            }, 0);
          }
        }
      });

      $("#searchButton").click(function () {
        // add click event to search button
        searchButtonClick();
      });

      $("#clearButton").click(function () {
        // clear search box and results menu
        clearButtonClick();
      });
    });
  };

  $.fn.delayKeyup = function (callback, ms) {
    // On keyup delay create callback except Up Down Enter
    var timer = 0;
    $(this).keyup(function (event) {
      if (
        event.keyCode !== 13 &&
        event.keyCode !== 38 &&
        event.keyCode !== 40
      ) {
        clearTimeout(timer);
        timer = setTimeout(function () {
          callback(event);
        }, ms);
      } else {
        callback(event);
      }
    });
    return $(this);
  };

  function getValuesAsGeoJson() {
    // get values as GeoJson with ajax call

    activeResult = -1;
    features = [];
    var limitToSend = options.limit;

    lastSearch = $("#searchBox")[0].value; // get current search box value

    if (lastSearch === "") {
      // if search box is empty do nothing
      return;
    }

    var data = {
      search: lastSearch,
      limit: limitToSend,
    };

    $.ajax({
      // HERE IS EVERYTHING,  USE FUSE JS FUNCTION TO SELECT THE ELEMENTS
      url: options.geojsonServiceAddress,
      type: "GET",
      data: data,
      dataType: "json",
      success: function (json) {
        if (json.type === "Feature") {
          resultCount = 1;
          features[0] = json;
        } else {
          resultCount = fuseSearch(json, lastSearch, options.limit).length;
          features = fuseSearch(json, lastSearch, options.limit);
        }
        createDropDown();
      },
      error: function () {
        processNoRecordsFoundOrError();
      },
    });
  }

  function createDropDown() {
    // Create the dropdown with the results
    var parent = $("#searchBox").parent();

    $("#resultsDiv").remove();
    parent.append(
      "<div id='resultsDiv' class='autocomplete-result'><ul id='resultList' class='autocomplete-list'></ul><div>"
    );

    $("#resultsDiv")[0].style.position = $("#searchBox")[0].style.position;
    $("#resultsDiv")[0].style.left =
      parseInt($("#searchBox")[0].style.left) - 10 + "px";
    $("#resultsDiv")[0].style.bottom = $("#searchBox")[0].style.bottom;
    $("#resultsDiv")[0].style.right = $("#searchBox")[0].style.right;
    $("#resultsDiv")[0].style.top =
      parseInt($("#searchBox")[0].style.top) + 25 + "px";
    $("#resultsDiv")[0].style.zIndex = $("#searchBox")[0].style.zIndex;

    var loopCount = features.length; // Number of results got from Ajax call + Fuse search

    for (var i = 0; i < loopCount; i++) {
      var html =
        "<li id='listElement" + i + "' class='autocomplete-listResult'>";
      html +=
        "<span id='listElementContent" +
        i +
        "' class='autocomplete-content'><img src='assets/icons_os/" +
        features[i].properties.image +
        "' class='autocomplete-iconStyle' align='middle'>";
      html +=
        "<font size='2' color='#333' class='autocomplete-title'>" +
        features[i].properties.title +
        "</font><font size='1' color='#8c8c8c'> " +
        features[i].properties.description +
        "<font></span></li>";
      $("#resultList").append(html);

      $("#listElement" + i).mouseenter(function () {
        listElementMouseEnter(this);
      });

      $("#listElement" + i).mouseleave(function () {
        listElementMouseLeave(this);
      });

      $("#listElement" + i).mousedown(function () {
        listElementMouseDown(this);
      });
    }
  }

  function listElementMouseEnter(listElement) {
    // Mouse enter on list element (mouse hover on)

    var index = parseInt(listElement.id.substr(11));

    if (index !== activeResult) {
      $("#listElement" + index).toggleClass("mouseover");
    }
  }

  function listElementMouseLeave(listElement) {
    // Mouse leave event (mouse hover off)
    var index = parseInt(listElement.id.substr(11));

    if (index !== activeResult) {
      $("#listElement" + index).removeClass("mouseover");
    }
  }

  function listElementMouseDown(listElement) {
    // Mouse down (click) on list element event
    var index = parseInt(listElement.id.substr(11));

    if (index !== activeResult) {
      if (activeResult !== -1) {
        $("#listElement" + activeResult).removeClass("active");
      }

      $("#listElement" + index).removeClass("mouseover");
      $("#listElement" + index).addClass("active");
      activeResult = index;
      fillSearchBox();
      drawGeoJson(activeResult);
    }
  }

  function drawGeoJson(index) {
    // Draws the selected feature on the map

    let floorNumber = features[index].properties.floor; // Get floor number for the selected item
    let resetFloorNumber = campuses[options.place]["floors"].indexOf(
      floorNumber.toString()
    );
    let button = "b" + resetFloorNumber.toString(); // Craft the floor button id
    document.getElementById(button).click();

    if (searchLayer !== undefined) {
      map.removeLayer(searchLayer);
      searchLayer = undefined;
    }

    if (index === -1) return;

    var drawStyle = {
      color: options.drawColor,
      weight: 5,
      opacity: 0.65,
      fill: false,
    };

    var link = `${HOST_URL}/?id=${features[index].properties.id}&zoom=20`;
    var copyButtonHtml = `<button class="floorButton copy-button" onclick='
      navigator.clipboard.writeText("${link}")
        .then(()=>{this.innerHTML="Lien copié &check;"})
        .catch(()=>{alert("Impossible de copier le lien : ${link}");});
      '>Copier le lien</button>`;

    searchLayer = L.geoJson(features[index].geometry, {
      style: drawStyle,
      onEachFeature: function (feature, layer) {
        layer
          .bindPopup(features[index].properties.popupContent + copyButtonHtml, {
            closeOnClick: null,
          })
          .addTo(map)
          .togglePopup();
      },
    });
    map.addLayer(searchLayer);

    if (
      features[index].geometry.type === "Point" &&
      options.pointGeometryZoomLevel !== -1
    ) {
      map.setView(
        [
          features[index].geometry.coordinates[1],
          features[index].geometry.coordinates[0],
        ],
        options.pointGeometryZoomLevel
      );
    } else {
      map.fitBounds(L.geoJson(features[index].geometry).getBounds());
    }
  }

  function fillSearchBox() {
    // fill the search box with the selected result when arrow up/down is used or
    if (activeResult === -1) {
      $("#searchBox")[0].value = lastSearch;
    } else {
      $("#searchBox")[0].value = features[activeResult].properties.title;
    }
  }

  function nextResult() {
    // for down arrow

    if (resultCount > 0) {
      if (activeResult !== -1) {
        $("#listElement" + activeResult).toggleClass("active");
      }

      if (activeResult < resultCount - 1) {
        $("#listElement" + (activeResult + 1)).toggleClass("active");
        activeResult++;
      } else {
        activeResult = -1;
      }

      fillSearchBox();

      if (activeResult !== -1) {
        drawGeoJson(activeResult);
      }
    }
  }

  function prevResult() {
    // for up arrow
    if (resultCount > 0) {
      if (activeResult !== -1) {
        $("#listElement" + activeResult).toggleClass("active");
      }

      if (activeResult === -1) {
        $("#listElement" + (resultCount - 1)).toggleClass("active");
        activeResult = resultCount - 1;
      } else if (activeResult === 0) {
        activeResult--;
      } else {
        $("#listElement" + (activeResult - 1)).toggleClass("active");
        activeResult--;
      }

      fillSearchBox();

      if (activeResult !== -1) {
        drawGeoJson(activeResult);
      }
    }
  }

  function clearButtonClick() {
    // clear the search box and remove the search layer
    $("#searchBox")[0].value = "";
    lastSearch = "";
    resultCount = 0;
    features = [];
    activeResult = -1;
    $("#resultsDiv").remove();
    if (searchLayer !== undefined) {
      map.removeLayer(searchLayer);
      searchLayer = undefined;
    }
  }

  function searchButtonClick() {
    // search for the entered text
    getValuesAsGeoJson();
  }

  function processNoRecordsFoundOrError() {
    // error message when ajax call fails
    resultCount = 0;
    features = [];
    activeResult = -1;
    $("#resultsDiv").remove();
    if (searchLayer !== undefined) {
      map.removeLayer(searchLayer);
      searchLayer = undefined;
    }

    var parent = $("#searchBox").parent();
    $("#resultsDiv").remove();
    parent.append(
      "<div id='resultsDiv' class='autocomplete-result'><i>" +
        lastSearch +
        " " +
        options.notFoundMessage +
        " <p><small>" +
        options.notFoundHint +
        "</small></i><div>"
    );
  }
})(jQuery);

/////////////////////////////////////////////////////////////////////////////////
///////////////////////////// Configure search box //////////////////////////////
/////////////////////////////////////////////////////////////////////////////////

export const loadSearchBox = (path, campus) => {
  var options = {
    geojsonServiceAddress: path,
    placeholderMessage: "Search in CentraleSupélec ...",
    searchButtonTitle: "Search",
    clearButtonTitle: "Clear",
    foundRecordsMessage: "showing results.",
    limit: 8,
    notFoundMessage: "not found.",
    notFoundHint: "Make sure your search criteria is correct and try again.",
    drawColor: "#4E5FC4",
    pointGeometryZoomLevel: -1,
    place: campus,
  };
  $("#searchContainer").GeoJsonAutocomplete(options);
};

export const removeSearchContainerElements = () => {
  // Remove search container elements so no duplicates are made when changing campuses
  var element = document.getElementById("searchContainer");
  element.innerHTML = "";
};

export const showSearch = (location, school) => {
  loadSearchBox("data/" + school + "_" + location + "_search.json", location);
};
