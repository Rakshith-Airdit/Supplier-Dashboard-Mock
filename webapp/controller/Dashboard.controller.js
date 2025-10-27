sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
  ],
  function (Controller, JSONModel, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend(
      "com.dashboard.supplierbusinessdashboard.controller.Dashboard",
      {
        onInit: function () {
          this._loadAllModels();
          this._initializeChartControls();
          this._setupEventHandlers();
        },

        /**
         * Load all JSON models for the dashboard
         */
        _loadAllModels: function () {
          const aModelConfigs = [
            { name: "demandForecast", path: "demandForecast.json" },
            { name: "contracts", path: "contracts.json" },
            { name: "announcements", path: "announcements.json" },
            { name: "products", path: "products.json" },
            { name: "businessData", path: "businessData.json" },
            { name: "compliance", path: "compliance.json" },
            { name: "purchaseOrders", path: "purchaseOrders.json" },
            { name: "ppmData", path: "ppmData.json" },
            { name: "categories", path: "categories.json" },
          ];

          // Load all data models
          aModelConfigs.forEach((config) => {
            try {
              const oModel = new JSONModel(
                sap.ui.require.toUrl(
                  `com/dashboard/supplierbusinessdashboard/model/${config.path}`
                )
              );
              this.getView().setModel(oModel, config.name);
            } catch (error) {
              console.error(`Failed to load model: ${config.name}`, error);
              this._showError(`Failed to load ${config.name} data`);
            }
          });

          // Initialize product selection model
          this._initializeProductSelectionModel();
          // Initialize filter model
          this._initializeFilterModel();
        },

        /**
         * Initialize product selection model with default values
         */
        _initializeProductSelectionModel: function () {
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
          this.getView().setModel(oProductSelectionModel, "productSelection");
        },

        /**
         * Initialize filter model with selected state
         */
        _initializeFilterModel: function () {
          const oFilterModel = new JSONModel({
            selectedCategory: "All",
          });
          this.getView().setModel(oFilterModel, "filter");
        },

        /**
         * Initialize chart controls and connections
         */
        _initializeChartControls: function () {
          // Initialize MultiComboBox with all products selected
          const oMultiComboBox = this.byId("productMultiComboBox");
          if (oMultiComboBox) {
            oMultiComboBox.setSelectedKeys([
              "Bearings",
              "Hydraulic Pumps",
              "Valves",
            ]);
          }

          // Connect tooltip and popover for demand chart
          this._connectChartTools();
        },

        /**
         * Connect chart tooltips and popovers
         */
        _connectChartTools: function () {
          const oVizFrame = this.byId("demandVizFrame");
          const oPopover = this.byId("demandPopOver");
          const oToolTip = this.byId("demandToolTip");

          if (oPopover && oVizFrame) {
            oPopover.connect(oVizFrame.getVizUid());
          }
          if (oToolTip && oVizFrame) {
            oToolTip.connect(oVizFrame.getVizUid());
          }
        },

        /**
         * Setup additional event handlers
         */
        _setupEventHandlers: function () {
          // Add any additional event handlers here
        },

        /**
         * Handle product selection changes for filtering
         */
        onProductSelectionChanged: function (oEvent) {
          const aSelectedKeys = oEvent.getSource().getSelectedKeys();
          const oMultiComboBox = oEvent.getSource();

          // Validation - at least one product must be selected
          if (aSelectedKeys.length < 1) {
            MessageBox.warning("At least one product must be selected.");
            const sChangedItemKey = oEvent.getParameter("changedItem").getKey();
            oMultiComboBox.setSelectedKeys([sChangedItemKey]);
            return;
          }

          console.log("Selected products:", aSelectedKeys);

          // Update chart feeds based on selection
          this._updateChartFeeds(aSelectedKeys);

          // Show success message for user feedback
          MessageToast.show(`Filtered ${aSelectedKeys.length} products`);
        },

        /**
         * Update chart feeds based on selected products
         */
        _updateChartFeeds: function (aSelectedProducts) {
          const oVizFrame = this.byId("demandVizFrame");
          const feedValueAxis = this.byId("valueAxisFeed");

          if (oVizFrame && feedValueAxis) {
            try {
              oVizFrame.removeFeed(feedValueAxis);
              feedValueAxis.setValues(aSelectedProducts);
              oVizFrame.addFeed(feedValueAxis);
            } catch (error) {
              console.error("Error updating chart feeds:", error);
              this._showError("Failed to update chart display");
            }
          }
        },

        /**
         * Handle after rendering for any post-render adjustments
         */
        onAfterRendering: function () {
          this._adjustResponsiveLayout();
        },

        /**
         * Adjust layout for responsiveness
         */
        _adjustResponsiveLayout: function () {
          // Add responsive behavior if needed
          const oWindow = window;
          if (oWindow.addEventListener) {
            oWindow.addEventListener("resize", this._onWindowResize.bind(this));
          }
        },

        /**
         * Handle window resize for responsive adjustments
         */
        _onWindowResize: function () {
          // Add responsive layout adjustments here
          console.log("Window resized - adjust layout if needed");
        },

        /**
         * Show error message to user
         */
        _showError: function (sMessage) {
          MessageBox.error(sMessage);
        },

        // ============ FORMATTER FUNCTIONS ============

        /**
         * Format quantity with units
         */
        formatQuantity: function (quantity, formattedNumber) {
          if (!quantity && quantity !== 0) return "0 units";
          return `${formattedNumber} units`;
        },

        /**
         * Format number with locale-specific formatting
         */
        formatNumber: function (value) {
          if (!value && value !== 0) return "0";
          return value.toLocaleString();
        },

        /**
         * Format currency value
         */
        formatCurrency: function (value, currency) {
          if (!value && value !== 0) return "$0";
          const formattedValue = value.toLocaleString();
          return currency === "EUR"
            ? `€${formattedValue}`
            : `$${formattedValue}`;
        },

        /**
         * Format trend percentage
         */
        formatTrend: function (value) {
          if (!value && value !== 0) return "0%";
          return value > 0 ? `+${value}%` : `${value}%`;
        },

        /**
         * Determine trend state for styling
         */
        getTrendState: function (value) {
          if (!value && value !== 0) return "None";
          if (value > 0) return "Success";
          if (value < 0) return "Error";
          return "None";
        },

        /**
         * Format date for display
         */
        formatDate: function (dateString) {
          if (!dateString) return "";
          try {
            const oDate = new Date(dateString);
            return oDate.toLocaleDateString();
          } catch (error) {
            return dateString;
          }
        },

        /**
         * Calculate days until expiry
         */
        getDaysUntilExpiry: function (expiryDate) {
          if (!expiryDate) return 0;
          try {
            const oExpiryDate = new Date(expiryDate);
            const oToday = new Date();
            const iTimeDiff = oExpiryDate.getTime() - oToday.getTime();
            return Math.ceil(iTimeDiff / (1000 * 3600 * 24));
          } catch (error) {
            return 0;
          }
        },

        // More comprehensive formatter
        getAnnouncementIcon: function (category) {
          const iconMap = {
            RFQ: "sap-icon://message-information",
            "Business Announcement": "sap-icon://bell",
            "Compliance Notification": "sap-icon://alert",
            Alert: "sap-icon://warning",
            Maintenance: "sap-icon://wrench",
            Urgent: "sap-icon://error",
          };
          return iconMap[category] || "sap-icon://hint";
        },

        // Optional: Formatter for background colors
        getAnnouncementColor: function (category) {
          const colorMap = {
            RFQ: "Accent6",
            "Business Announcement": "Accent8",
            "Compliance Notification": "Accent2",
            Urgent: "Accent4",
          };
          return colorMap[category] || "Accent6";
        },

        // Formatter for status state
        getStatusState: function (category) {
          const stateMap = {
            RFQ: "Information",
            "Business Announcement": "Success",
            "Compliance Notification": "Warning",
            Alert: "Error",
            Maintenance: "Indication06",
            Urgent: "Error",
          };
          return stateMap[category] || "None";
        },

        // Filter change handler
        onCategoryFilterChanged: function (oEvent) {
          const sSelectedKey = oEvent.getSource().getSelectedKey();
          const oFilterModel = this.getView().getModel("filter");
          oFilterModel.setProperty("/selectedCategory", sSelectedKey);

          this._filterAnnouncements(sSelectedKey);

          if (oSelectedCategory) {
            sap.m.MessageToast.show(`Showing: ${oSelectedCategory.text}`);
          }
        },

        // Filter announcements based on selected category
        _filterAnnouncements: function (sCategory) {
          const oAnnouncementsModel = this.getView().getModel("announcements");
          const aAllItems = oAnnouncementsModel.getProperty(
            "/announcements/items"
          );

          if (!aAllItems) return;

          let aFilteredItems;
          if (sCategory === "All") {
            aFilteredItems = aAllItems;
          } else {
            aFilteredItems = aAllItems.filter(function (item) {
              return item.category === sCategory;
            });
          }

          // Update the filtered items in the model
          oAnnouncementsModel.setProperty(
            "/announcements/items",
            aFilteredItems
          );
        },

        // ============ CLEANUP ============

        /**
         * Clean up event listeners on exit
         */
        onExit: function () {
          const oWindow = window;
          if (oWindow.removeEventListener) {
            oWindow.removeEventListener(
              "resize",
              this._onWindowResize.bind(this)
            );
          }
        },
      }
    );
  }
);
