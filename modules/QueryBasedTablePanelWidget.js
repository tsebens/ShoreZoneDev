/**
 * Class QueryBasedTablePanelWidget
 *
 * Widget for display of table with map
 *   subclass of QueryBasedPanelWidget
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
  "dstore/Memory",
  "dstore/Trackable",
  "dgrid/OnDemandGrid",
  "dgrid/extensions/ColumnHider",
  "dgrid/extensions/ColumnReorder",
  "dgrid/extensions/ColumnResizer",
  "dgrid/Selector",
  "noaa/QueryBasedPanelWidget"
], function(declare, lang, Memory, Trackable, OnDemandGrid, ColumnHider, ColumnReorder, ColumnResizer, Selector, QueryBasedPanelWidget){


  return declare(QueryBasedPanelWidget, {

    constructor: function(/*Object*/ kwArgs){

      lang.mixin(this, kwArgs);

      this.hideEmptyColumns = true;
      this.store = null;
      this.grid = null;

      this.makeTable = function(fields, features) {
        // Create a dGrid table from returned data
        getEl(this.displayDivName).innerHTML = "";      // clear the DIV

        var unitColumns = [];
        var nonNullCount = new Object();
        var columnStyleHTML = "";
        for (var i=0; i<fields.length; i++) {
          unitColumns.push({
            field: fields[i].name,
            label: fields[i].alias
          });
          var colWidth = (fields[i].alias.length + 1) * 12;
          columnStyleHTML += ".dataTable .field-" + fields[i].name + " { width: " + colWidth + "px;} ";
          nonNullCount[fields[i].name] = 0;
        }

        // Create style-sheet for columns
        var sheet = document.createElement('style');
        sheet.innerHTML = columnStyleHTML;
        document.body.appendChild(sheet);

        var unitData = [];
        for (var i=0; i<features.length; i++) {
          //*JN*/ features[i].attributes["item"] = i;
          unitData.push(features[i].attributes);
          for (a in features[i].attributes) {
            if (features[i].attributes[a]) {
              nonNullCount[a] += 1;
              //features[i].attributes[a] = "<i>" + features[i].attributes[a] + "</i>";
            }
          }
        }
        //this.store = null;
        this.store = new (declare([Memory, Trackable]))({
          data: unitData
        });
/*
        for (var c=0; c<unitColumns.length; c++) {
          var col = unitColumns[c];
          col.hidden = (nonNullCount[col.field]==0);
        }
/**/
        // Instantiate grid
        //this.grid = null;
        this.grid = new (declare([OnDemandGrid, ColumnHider, ColumnReorder, ColumnResizer]))({
          className: "dataTable",
          loadingMessage: 'Loading data...',
          noDataMessage: 'No results found.',
          collection: this.store,
          columns: unitColumns
        }, this.displayDivName);
        this.grid.startup();


        this.grid.on('dgrid-error', function(event) {
          debug('dgrid-error:  ' + event.error.message);
        });
        this.grid.on('dgrid-refresh-complete', function(event) {
          //debug('dgrid-refresh-complete');
        });

        this.grid.on('.dgrid-header .dgrid-cell:mouseover', function (event) {
          this.showHeaderTooltip(event);
        }.bind(this));

        this.grid.on('.dgrid-header .dgrid-cell:mouseout', function (event) {
          this.hideGridTooltip(event);
        }.bind(this));

        this.grid.on('.dgrid-content .dgrid-row:mouseover', function (event) {
          var row = this.grid.row(event);
          var rowIndex = event.selectorTarget.rowIndex;
          var associatedGraphic = this.clickableLayer.graphics.items[rowIndex];
          this.showGridTooltip(event, rowIndex, associatedGraphic);
          if (this.clickableLayer.visible) {
            this.displayPlayButton(associatedGraphic);
          }
          // row.element == the element with the dgrid-row class
          // row.id == the identity of the item represented by the row
          // row.data == the item represented by the row
        }.bind(this));

        this.grid.on('.dgrid-content .dgrid-row:mouseout', function (event) {
          this.hideGridTooltip(event);
        }.bind(this));


        this.showHeaderTooltip = function(event){
          var fieldName = event.selectorTarget.field;
          var description = this.attrName(fieldName,this.UnitAttrsInfo);
          if (description != fieldName) {
            var toolTipText = description;
            var cell=this.grid.cell(event);
            dijit.showTooltip(toolTipText, cell.element);
          }
        };

        this.showGridTooltip = function(event, r, associatedGraphic){
          var cell=this.grid.cell(event);
          if (cell.column) {
            var fieldName = cell.column.field;
            var fieldValueDescr = this.attrValDescription(fieldName, associatedGraphic.attributes);
            if (fieldValueDescr != associatedGraphic.attributes[fieldName]) {
              var toolTipText = fieldValueDescr;
              dijit.showTooltip(toolTipText, cell.element);
            }
          }
        };

        this.hideGridTooltip = function(event){
          var cell=this.grid.cell(event);
          dijit.hideTooltip(cell.element);
        };

      }

      this.processData = function(results) {
        //console.log("processData: Table");
        var fields = results.fields;
        var features = results.features;
        this.makeClickableGraphics(features);
        this.makeTable(fields, features);
      };

    }

  });
});

