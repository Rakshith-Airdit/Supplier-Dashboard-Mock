sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/viz/ui5/format/ChartFormatter",
    "sap/viz/ui5/api/env/Format",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
  ],
  function (
    Controller,
    JSONModel,
    ChartFormatter,
    Format,
    MessageToast,
    MessageBox
  ) {
    "use strict";

    return Controller.extend(
      "com.dashboard.supplierbusinessdashboard.controller.Dashboard",
      {
        onInit: function () {
          this._loadModels();
          this._initializeVizFrame();
        },

        _loadModels: function () {
          const oDemandForecastModel = new JSONModel(
            sap.ui.require.toUrl(
              "com/dashboard/supplierbusinessdashboard/model/demandForecast.json"
            )
          );
          const oContractsModel = new JSONModel(
            sap.ui.require.toUrl(
              "com/dashboard/supplierbusinessdashboard/model/contracts.json"
            )
          );
          const oProductSelectionModel = new JSONModel({
            products: [
              { key: "Bearings", name: "Bearings", selected: true },
              {
                key: "Hydraulic Pumps",
                name: "Hydraulic Pumps",
                selected: true,
              },
              { key: "Valves", name: "Valves", selected: true },
            ],
          });
          const oAnnouncementsModel = new JSONModel(
            sap.ui.require.toUrl(
              "com/dashboard/supplierbusinessdashboard/model/announcements.json"
            )
          );
          const oProductsModel = new JSONModel(
            sap.ui.require.toUrl(
              "com/dashboard/supplierbusinessdashboard/model/products.json"
            )
          );
          const oBusinessDataModel = new JSONModel(
            sap.ui.require.toUrl(
              "com/dashboard/supplierbusinessdashboard/model/businessData.json"
            )
          );
          const oComplianceModel = new JSONModel(
            sap.ui.require.toUrl(
              "com/dashboard/supplierbusinessdashboard/model/compliance.json"
            )
          );
          const oPurchaseOrdersModel = new JSONModel(
            sap.ui.require.toUrl(
              "com/dashboard/supplierbusinessdashboard/model/purchaseOrders.json"
            )
          );
          const oPPMDataModel = new JSONModel(
            sap.ui.require.toUrl(
              "com/dashboard/supplierbusinessdashboard/model/ppmData.json"
            )
          );

          this.getView().setModel(oDemandForecastModel, "demandForecast");
          this.getView().setModel(oContractsModel, "contracts");
          this.getView().setModel(oProductSelectionModel, "productSelection");
          this.getView().setModel(oAnnouncementsModel, "announcements");
          this.getView().setModel(oProductsModel, "products");
          this.getView().setModel(oBusinessDataModel, "businessData");
          this.getView().setModel(oComplianceModel, "compliance");
          this.getView().setModel(oPurchaseOrdersModel, "purchaseOrders");
          this.getView().setModel(oPPMDataModel, "ppmData");
        },

        _initializeVizFrame: function () {
          Format.numericFormatter(ChartFormatter.getInstance());

          const oVizFrame = this.byId("demandVizFrame");
          const oPopover = this.byId("demandPopOver");
          const oToolTip = this.byId("demandToolTip");

          // Initialize MultiComboBox with all products selected
          const oMultiComboBox = this.byId("productMultiComboBox");

          if (oMultiComboBox) {
            const aSelectedKeys = ["Bearings", "Hydraulic Pumps", "Valves"];
            oMultiComboBox.setSelectedKeys(aSelectedKeys);
          }

          // Ensure Popover is connected to the VizFrame for tooltips
          if (oPopover) {
            oPopover.connect(oVizFrame.getVizUid());
          }

          // Ensure Popover is connected to the VizFrame for tooltips
          if (oToolTip) {
            oToolTip.connect(oVizFrame.getVizUid());
          }

          this._setDefaultVizProperties();
        },

        _setDefaultVizProperties: function () {
          const oVizFrame = this.byId("demandVizFrame");

          const oVizProperties = {
            plotArea: {
              dataLabel: {
                visible: true,
              },
            },
            title: {
              visible: true,
              text: "Weekly Demand Forecast",
            },
            legend: {
              visible: true,
              position: "bottom",
              alignment: "center",
            },
            legendGroup: {
              layout: { position: "bottom", alignment: "center" },
            },
            interaction: {
              selectability: { mode: "complete" },
              zoom: { enablement: "enabled" },
              gestures: { enable: true },
              tooltip: {
                enabled: true,
                type: "datum",
              },
            },
            valueAxis: {
              title: { visible: true, text: "Quantity" },
            },
            categoryAxis: {
              title: { visible: true, text: "Weeks" },
            },
          };

          oVizFrame.setVizProperties(oVizProperties);
        },

        onProductSelectionChanged: function (oEvent) {
          const aSelectedKeys = oEvent.getSource().getSelectedKeys();
          const oVizFrame = this.byId("demandVizFrame");
          var oItems = oEvent.getSource().getItems();
          const oMultiComboBox = oEvent.getSource();
          let aItems = [];
          oItems.map((item) => aItems.push(item.getText()));

          let sChangedItemKey = oEvent.getParameter("changedItem").getKey();

          if (aSelectedKeys.length < 1) {
            MessageBox.warning("Atleast One Product Should be Selected.");
            oMultiComboBox.setSelectedKeys(sChangedItemKey);
            return;
          }

          console.log("Selected products:", aSelectedKeys);

          var feedValueAxis = this.getView().byId("valueAxisFeed");
          oVizFrame.removeFeed(feedValueAxis);
          feedValueAxis.setValues(aSelectedKeys);
          oVizFrame.addFeed(feedValueAxis);
        },

        _updateChartDataset: function (aSelectedProducts) {
          const oVizFrame = this.byId("demandVizFrame");
          const oDataset = oVizFrame.getDataset();

          // Modify the dataset based on selected products
          const oModel = this.getView().getModel("demandForecast");
          const aChartData = oModel.getProperty("/demandForecast/chartData");

          // Filter the dataset based on selected products
          const filteredData = aChartData.map((entry) => {
            const filteredEntry = { Week: entry.Week };
            aSelectedProducts.forEach((product) => {
              if (entry[product]) {
                filteredEntry[product] = entry[product];
              }
            });
            return filteredEntry;
          });

          // Update the dataset in the VizFrame
          const oFlattenedDataset = this.byId("demandVizFrame").getDataset();
          oFlattenedDataset.setData(filteredData);

          // Update the measures dynamically based on selected products
          const aMeasures = aSelectedProducts.map((product) => {
            return new sap.viz.ui5.data.MeasureDefinition({
              name: product,
              value: `{${product}}`,
            });
          });

          // Set the measures dynamically to the VizFrame
          oFlattenedDataset.setMeasures(aMeasures);

          // Redraw the VizFrame
          // oVizFrame.refresh();
        },

        _getValueFeed: function (oVizFrame) {
          const aFeeds = oVizFrame.getFeeds();
          return aFeeds.find((oFeed) => oFeed.getUid() === "valueAxis");
        },

        onDatasetSelected: function (oEvent) {
          const sSelectedKey = oEvent
            .getSource()
            .getSelectedButton()
            .getBindingContext("demandForecast")
            .getObject().key;
          this._updateChartDataset(sSelectedKey);
        },

        onSeriesSelected: function (oEvent) {
          const sSelectedKey = oEvent
            .getSource()
            .getSelectedButton()
            .getBindingContext("demandForecast")
            .getObject().key;
          this._updateChartType(sSelectedKey);
        },

        _updateChartType: function (sChartType) {
          const oVizFrame = this.byId("demandVizFrame");
          let sVizType = "line";
          if (sChartType === "column") sVizType = "column";
          else if (sChartType === "stacked") sVizType = "stacked_column";

          oVizFrame.setVizType(sVizType);

          // Update legend position for better centering
          const oProps = oVizFrame.getVizProperties() || {};
          oVizFrame.setVizProperties({
            ...oProps,
            legend: {
              ...oProps.legend,
              position: "bottom",
              alignment: "center",
              layout: {
                position: "bottom",
                alignment: "center",
              },
            },
          });
        },

        formatQuantity: function (quantity, formattedNumber) {
          return formattedNumber + " units";
        },

        formatNumber: function (value) {
          if (!value) return "0";
          return value.toLocaleString();
        },

        formatCurrency: function (value, currency) {
          if (!value) return "$0";
          return "$" + value.toLocaleString();
        },

        formatTrend: function (value) {
          if (value > 0) {
            return "+" + value + "%";
          }
          return value + "%";
        },

        getTrendState: function (value) {
          if (value > 0) return "Success";
          if (value < 0) return "Error";
          return "None";
        },
      }
    );
  }
);
