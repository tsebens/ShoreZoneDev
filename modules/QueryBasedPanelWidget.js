/**
 * Class QueryBasedPanelWidget
 *
 * generic widget for spatial queries on map service layers, with associated panel for results
 *   Subclasses of this must set the processData function in the constructor  (see example in VideoPanelWidget.js)
 *
 * Constructor arguments:
 *    mapServiceLayer: MapImageLayer
 *    layerName: String     name of a sublayer of mapServiceLayer
 *    panel: ContentPane    panel where processed query results are displayed
 *    -- perhaps other args for outFields and where clause?
 */

define([
  "dojo/_base/declare",
  "dojo/_base/lang",
  "dojo/dom",
  "dijit/layout/BorderContainer",
  "dijit/layout/ContentPane",
  "esri/tasks/support/Query",
  "esri/tasks/QueryTask",
  "esri/layers/GraphicsLayer",
  "esri/renderers/SimpleRenderer",
  "esri/symbols/PictureMarkerSymbol",
  "esri/symbols/SimpleMarkerSymbol",
  "esri/symbols/SimpleLineSymbol",
  "esri/symbols/SimpleFillSymbol",
  "esri/geometry/Extent",
  "esri/geometry/Point",
  "esri/geometry/support/webMercatorUtils",
  "esri/Graphic"
], function(declare, lang, dom, BorderContainer, ContentPane, Query, QueryTask, GraphicsLayer, SimpleRenderer,
              PictureMarkerSymbol, SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol, Extent, Point, webMercatorUtils, Graphic){

  var queryComplete = true;

  return declare(null, {

    constructor: function(/*Object*/ kwArgs){
      lang.mixin(this, kwArgs);

      //this.addPanelHtml();

      if (this.clickableSymbolInfo) {
        // Add (transparent) Graphics Layer for selecting feature
        this.clickableLayer = new GraphicsLayer();
        this.clickableLayer.listMode = "hide";
        this.clickableLayer.id = this.panelName + "_Clickable";
        this.clickableLayer.title = this.clickableLayer.id;
        this.clickableLayer.visible = true;

        if (this.clickableSymbolType == "point")
          this.clickableSymbol = new SimpleMarkerSymbol(this.clickableSymbolInfo);
        else if (this.clickableSymbolType == "polyline")
          this.clickableSymbol = new SimpleLineSymbol(this.clickableSymbolInfo);
        else if (this.clickableSymbolType == "polygon" || this.clickableSymbolType == "extent")
          this.clickableSymbol = new SimpleFillSymbol(this.clickableSymbolInfo);

        this.clickableLayer.renderer = new SimpleRenderer(this.clickableSymbol);
        this.clickableLayer.widgetController = this;    // Custom property added to Graphics Layer object, to reference back to this widget
        this.map.add(this.clickableLayer);
        this.mouseStillOver = false;
        this.infoWin = this.view.popup;
        this.counter = 0;

        // To indicate item currently hovered-over or touched
        if (!this.highlightSymbolType)
          this.highlightSymbolType = this.clickableSymbolType;
        this.highlightLayer = new GraphicsLayer();
        this.highlightLayer.listMode = "hide";
        this.highlightLayer.id = this.panelName + "_highlight";
//        this.highlightLayer.title = this.highlightLayer.id;
        this.highlightLayer.visible = true;

        if (!this.highlightSymbolInfo) {
          this.highlightSymbol = this.clickableSymbol.clone();
          // So far, the only ones that don't have separate highlightSymbolInfo are Points
          this.highlightSymbol.color.a = 0;
          this.highlightSymbol.outline.color = "red";
          this.highlightSymbol.outline.width = "2px";
          this.highlightSymbol.size += 5;
        } else {
          if (this.highlightSymbolType == "polyline")
            this.highlightSymbol = new SimpleLineSymbol(this.highlightSymbolInfo);
        }

        /*
        this.highlightSymbol = this.clickableSymbol.clone();
        if (this.highlightSymbolType == "polyline") {
          //this.highlightSymbol.color.a = 0;
          this.highlightSymbol.color = "red";
          this.highlightSymbol.width = "2px";
          //this.highlightSymbol.size += 5;
        } else{
          this.highlightSymbol.color.a = 0;
          this.highlightSymbol.outline.color = "red";
          this.highlightSymbol.outline.width = "2px";
          this.highlightSymbol.size += 5;
        }
        */

        this.highlightLayer.renderer = new SimpleRenderer(this.highlightSymbol);
//        this.highlightLayer.widgetController = this;    // Custom property added to Graphics Layer object, to reference back to this widget
        this.map.add(this.highlightLayer);
      }

      if (this.trackingSymbolInfo) {
        // Add Graphics Layer for tracking icon
        this.trackingLayer = new GraphicsLayer();
        this.trackingLayer.listMode = "hide";
        this.trackingLayer.id = this.panelName + "_Tracking";
        this.trackingLayer.title = this.trackingLayer.id;
        this.trackingLayer.visible = true;
        var symbolArgs = this.trackingSymbolInfo.split(":");
        this.trackingImageURL = symbolArgs[0];
        this.trackingSymbol = new PictureMarkerSymbol(symbolArgs[0], symbolArgs[1], symbolArgs[2]);
        this.trackingLayer.renderer = new SimpleRenderer(this.trackingSymbol);
        this.map.add(this.trackingLayer);
        this.playDir = 1;     // playback direction
      }

      if (this.disabledMsgDivName)
        setMessage(this.disabledMsgDivName, this.dfltCaptionHTML);
        //getEl(this.headerDivName).innerHTML = this.dfltCaptionHTML;

      // Skip if the widget doesn't get its data directly from a query
      // e.g. PhotoPlaybackWidget, which uses a subset of the data from VideoPanelWidget
      if (!this.noQuery) {
        this.subLayerID = getSubLayerID(this.mapServiceLayer, this.layerName);
        this.subLayerURL = this.mapServiceLayer.url + "/" + this.subLayerID.toString();
        this.queryTask = new QueryTask(this.subLayerURL);
        this.query = new Query();
        with (this.query) {
          returnGeometry = true;
          spatialRelationship = this.spatialRelationship;      //"contains";
          outFields = this.queryOutFields;      // [];
          orderByFields = [];
          where = "";
          //returnCountOnly = true;
        }

      }


      // placeholder -- function will be overridden by subclasses of QueryBasedPanelWidget
      this.processData = function(results) {
      };

      // placeholder -- function will be overridden by subclasses of QueryBasedPanelWidget
      this.updateMedia = function(attrs) {
      };

      this.moveButtonPressHandler = function(attrs) {
        this.changeCurrentFeature(attrs.item);
        this.moveToFeature(attrs);
        this.infoWin.close();
      };

      // default method, returns argument
      // override this method in subwidget
      this.attrValDescription = function(a, attrs) {
        return attrs[a];
      };

      // default method, returns argument
      // override this method in subwidget
      this.attrName = function(a) {
        return a;
      };

      this.displayPlayButton = function(e) {
        //debug("displayPlayButton");
        var infoWin = view.popup;
        if (popupsDocked) {
          infoWin.dockEnabled = true;
          infoWin.dockOptions = {position: "bottom-right" };
        }
        attrs = e.attributes;
        infoWin.title = this.popupTitle;    // this.baseName + " point";
        infoWin.content = "<nobr><b>" + attrs.Caption.replace(":",":</b>") + "</nobr><br>";        //+ "</b>";
        //a.Caption = "<b>" + a.Caption.replace(":","</b>");      //

        if (this.showFieldsInPopup) {
          for (f in this.query.outFields) {
            a = this.query.outFields[f];
            if (attrs[a])
              infoWin.content += "<nobr><b>" + this.attrName(a) + ": </b>" + this.attrValDescription(a, attrs) + "</nobr><br>";
          }
        }

        if (this.clickableMsg) {
          infoWin.actions.items[0].visible = true;
          infoWin.actions.items[0].title = this.clickableMsg;
          infoWin.actions.items[0].image = this.trackingImageURL;
        } else {
          infoWin.actions.items[0].visible = false;
        }

        //    Positions the popup.  Disabled for now, as it can cause panning of display.
        if (e.geometry.type == "point")
          infoWin.location = e.geometry;
        else
          infoWin.location = e.geometry.center;


        //view.popup.reposition();
        //infoWin.alignment = "left";
        infoWin.open();
        this.clearAllHighlights();
        this.highlightFeature(e.highlightGeometry);          // geometry);
        //debug("displayPlayButton complete");
      };

      console.log(this.panelName);

    },

/*
    addPanelHtml: function() {
      var contentPaneId = this.baseName + "Div";
      var name = this.baseName;
      var classType = this.panelType;
      var panelDiv = dom.byId(contentPaneId);
      var S = '';
      S = '<div id="panelDisabled_' + name + '" class="PanelDisabled" >\n';
      S += '  <label id="disabledMsg_' + name + '" class="MsgDisabled" >Zoom in further to see ' + name + '</label>\n';
      S += '</div>\n';
      panelDiv.innerHTML = S;

      var topCP = new ContentPane({id: name + 'HeaderDiv', class: classType + 'HeaderDiv', region: 'top'});
      // TODO: tabs or title "banners" for all?
      var panelBC =  new BorderContainer({id: "panelEnabled_" + name, class: classType + "PanelEnabled" });
      panelBC.addChild(topCP);

      var midCPcontent = '';
      if (classType === 'media') {
        var imgHtml = '    <img id="photoImage" class="imageContainer" src="">\n';
        if (name === 'video')
          imgHtml = '    <div id="videoImageContainer" class="imageContainer"></div>\n';
        midCPcontent = '<div id="' + name + 'NoImageMessage" class="mediaMessageDiv" style="padding: 0" ><b>No ' + name + '</b></div>' + imgHtml;
        var bottomCP = new ContentPane({id: name + 'ToolsDiv', class: 'mediaToolsContainer', region: 'bottom'});
        panelBC.addChild(bottomCP);
      }
      var midCP = new ContentPane({content: midCPcontent, id: name + 'Container', class: classType + 'ContainerDiv', region: 'center'});
      panelBC.addChild(midCP);
      panelBC.startup();
      panelDiv.appendChild(panelBC.domNode);
    },
*/


    runQuery: function(extent) {
      var pad = extent.width/50;      // Shrink query extent by 4%, to ensure that graphic points and markers are well within view
      this.query.geometry = null;     // By default, no spatial filter unless there is a spatialRelationship defined
      if (this.query.spatialRelationship) {
        var queryExtent = new Extent({spatialReference: extent.spatialReference, xmin: extent.xmin+pad, xmax: extent.xmax-pad, ymin: extent.ymin+pad, ymax: extent.ymax-pad});
        this.query.geometry = queryExtent;
      }
      this.query.outFields = this.queryOutFields.concat(this.tableFields);       // ["*"];     //TODO: change back to
      //this.query.spatialRelationship = "";    // "intersects";
      //*JN:  Experiment */  this.query.where = "Habitat='Eelgrass'";
      queryComplete = false;

      /* test count
       this.queryTask.executeForCount({where: ""}).when(function(count){
                alert(count, " features matched the input query");
       }, function(error){
            alert(error); // Will print error in console if unsupported layers are used
       });
       /**/

      this.queryTask.execute(this.query).then(function(results){
          //var theFeatures = results.features;
          if (results.features.length==maxSZFeatures) {
              console.log(this.baseName + ":  maxSZFeatures (" + maxSZFeatures + ") returned.");
              //alert("Too many features for " + this.layerName + ".  Zoom in further.");
          } else {
              this.processData(results);
          }
      }.bind(this), function(error) {
          //*JN alert("QueryTask failed.");
          console.log(this.baseName + ":  QueryTask failed.");
      }.bind(this));
    },

    changeCurrentFeature: function(newIndex) {
      if (newIndex<0 || newIndex>=this.getClickableGraphicsCount())
        return null;     // Do nothing: out of range
      this.counter = newIndex;
      var attrs = this.getClickableGraphicAttributes(this.counter);
      this.moveToFeature(attrs);
      this.updateMedia(attrs);
    },

    moveToFeature: function (attrs) {
      // if (!mapVisible)
      //   return;
      this.trackingLayer.removeAll();
      var projPoint = new Point(attrs.x, attrs.y);
      var markerPoint = webMercatorUtils.webMercatorToGeographic(projPoint);   //this._webMercatorToGeographic(projPoint);
      var newFeature = new Graphic(markerPoint, this.trackingSymbol);
      this.trackingLayer.add(newFeature);
      if (this.headerDivName) {
        var headerDiv = getEl(this.headerDivName);
        if (attrs.Caption)
          headerDiv.innerHTML = attrs.Caption;
        else
          headerDiv.innerHTML = this.dfltCaptionHTML;
      }
    },

    /*
    _webMercatorToGeographic: function(point) {
      if (!point) {
        alert("Point is null");
        return;
      }
      try {
        var geogPoint = webMercatorUtils.webMercatorToGeographic(point);
        return geogPoint;
      }
      catch(err) {
        alert(err.message)
      }
    },
    */

    clearAllHighlights: function() {
      szVideoWidget.highlightLayer.removeAll();
      szPhotoWidget.highlightLayer.removeAll();
    },

    highlightFeature: function(g) {
      this.highlightLayer.removeAll();
      var newFeature = new Graphic(g, this.highlightSymbol);
      this.highlightLayer.add(newFeature);
    },

    makeClickableGraphics: function(features) {
      if (!this.clickableSymbol)
          return;
      for (var n = 0; n < features.length; n++) {
          var g = features[n];
          var a = {};
          for (i in g.attributes) {
              a[i] = g.attributes[i];
          }
          a.item = n;

          var geom = g.geometry
          var centroid = g.geometry;
        // If feature is not a point, use center of feature extent for "x" and "y" attributes
          if (g.geometry.type != "point") {
            geom = g.geometry.extent;
            centroid = geom.center;
          }
          a.x = centroid.x;    // g.geometry.x;
          a.y = centroid.y;    // g.geometry.y;

          var mapFeature = webMercatorUtils.webMercatorToGeographic(geom);      //projPoint);   //this._webMercatorToGeographic(projPoint);
          var mapFeatureCenter = webMercatorUtils.webMercatorToGeographic(centroid);
          a.Caption = decDegCoords_to_DegMinSec(mapFeatureCenter.x, mapFeatureCenter.y);
          var graphic = new Graphic({
            geometry: mapFeature,
            symbol: this.clickableSymbol,
            attributes: a,
            highlightGeometry: g.geometry
          });
          this.clickableLayer.add(graphic);
      }
    },

    getClickableGraphicsCount: function() {
      return this.clickableLayer.graphics.length;
    },

    getClickableGraphicAttributes: function(p) {
      return this.clickableLayer.graphics.items[p].attributes;
    },

    indexFirstFeatureGreaterThan: function(attrName, attrValue) {
      for (var n = 0; n < this.getClickableGraphicsCount(); n++) {
        if (this.getClickableGraphicAttributes(n)[attrName] >= attrValue)
          return n;
      }
      return -1;
    },

    playerControl: function(action) {
      switch(action) {
        case "toStart":       this.toStart(); break;
        case "playBackward":  this.playBackward(); break;
        case "pause":         this.pause(); break;
        case "playForward":   this.playForward(); break;
        case "toEnd":         this.toEnd(); break;
      }
    }

  });
});


