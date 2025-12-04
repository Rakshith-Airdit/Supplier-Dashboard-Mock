sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
  ],
  function (Controller, JSONModel, MessageToast, MessageBox, Filter, FilterOperator) {
    "use strict";

    return Controller.extend(
      "com.dashboard.supplierbusinessdashboard.controller.Dashboard",
      {
        onInit: function () {
          this._loadLocalModels();
          this._loadBackendData();
          // this._initializeChartControls();
          // this._setupEventHandlers();
        },

        _loadLocalModels: function () {
          const aLocalModels = [
            { name: "demandForecast", path: "demandForecast.json" },
            { name: "announcements", path: "announcements.json" },
            { name: "compliance", path: "compliance.json" },
            { name: "categories", path: "categories.json" },
            { name: "ppmData", path: "ppmData.json" }
          ];

          aLocalModels.forEach(config => {
            const oModel = new JSONModel(
              sap.ui.require.toUrl(`com/dashboard/supplierbusinessdashboard/model/${config.path}`)
            );
            this.getView().setModel(oModel, config.name);
          });

          this._initializeProductSelectionModel();
          this._initializeFilterModel();
        },

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

        _initializeFilterModel: function () {
          const oFilterModel = new JSONModel({
            selectedCategory: "All",
          });
          this.getView().setModel(oFilterModel, "filter");
        },

        _loadBackendData: async function () {
          const oModel = this.getOwnerComponent().getModel();
          debugger;
          if (!oModel) {
            MessageBox.error("OData service not configured!");
            return;
          }

          const sVendorCode = "100000"; // You can get this dynamically later

          try {
            // Load all data in parallel (faster!)
            const [
              businessTrend,
              topProducts,
              openPOs,
              commitments
            ] = await Promise.all([
              this._loadODataEntity("BusinessValueTrend", sVendorCode),
              this._loadODataEntity("TopProducts", sVendorCode),
              this._loadODataEntity("TopOpenPurchaseOrders", sVendorCode),
              this._loadODataEntity("BusinessCommitments", sVendorCode)
            ]);

            // Transform & bind — clean and separate
            if (businessTrend.length > 0) {
              const oBusiness = this._transformBusinessValueTrend(businessTrend);
              this.getView().setModel(new JSONModel(oBusiness), "businessData");
              this._updateFinancialTiles(businessTrend[0]); // still needed for tiles
            }

            this.getView().setModel(new JSONModel(this._transformTopProducts(topProducts)), "products");
            this.getView().setModel(new JSONModel(this._transformTopOpenPOs(openPOs)), "purchaseOrders");
            this.getView().setModel(new JSONModel(this._transformBusinessCommitments(commitments)), "contracts");
          } catch (oError) {
            console.log(oError);
            MessageBox.error("Something went wrong while fetching dashboard data. Please try again later.");
          }
        },

        // 1. Business Value Trend → Chart + Tiles
        _transformBusinessValueTrend: function (aData) {
          if (!aData || aData.length === 0) return null;
          const o = aData[0];

          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const chartData = months.map(m => ({
            month: m,
            spend: parseFloat(o[`PoValue_${m}`]) || 0
          }));

          return {
            businessData: {
              monthlySpendTrend: { data: chartData },
              totalPOValue: parseFloat(o.PoValue_Y2D) || 0,
              currentMonthValue: this._getCurrentMonthSpend(o),
              currency: o.TotalAmountCurrency || "INR",
              raw: o // optional: keep raw for debugging
            }
          };
        },

        // 2. Top Products
        _transformTopProducts: function (aData) {
          return {
            topProducts: {
              title: "Top Products by Spend",
              items: (aData || []).slice(0, 5).map((item, idx) => ({
                rank: idx + 1,
                name: item.MaterialName || "Unknown Material",
                quantity: parseInt(item.TotalOrderedQuantity) || 0,
                totalSpend: parseFloat(item.TotalAmount) || 0,
                currency: item.TotalAmountCurrency || "INR",
                trend: [15.3, -8.1, 22.7, 5.4, 11.2][idx] || 0
              }))
            }
          };
        },

        // 3. Top Open POs
        _transformTopOpenPOs: function (aData) {
          return {
            purchaseOrders: {
              orders: (aData || []).map(po => ({
                id: po.PoNo,
                description: `Purchase Order ${po.PoNo}`,
                value: parseFloat(po.TotalAmount) || 0,
                status: "Open",
                currency: po.TotalAmountCurrency || "INR"
              }))
            }
          };
        },

        // 4. Business Commitments (Contracts)
        _transformBusinessCommitments: function (aData) {
          return {
            contracts: {
              title: "Active Contracts & Commitments",
              items: (aData || []).map(c => {
                const days = parseInt(c.DaysPendingToExpire) || 0;
                const state = days <= 30 ? "Error" : days <= 90 ? "Warning" : "Success";
                const status = days > 0 ? "Active" : "Expired";

                return {
                  contractNo: c.PurchaseContract,
                  productName: "Framework Agreement",
                  validityPeriod: `${this.formatDate(c.ValidityStartDate)} – ${this.formatDate(c.ValidityEndDate)}`,
                  totalOrderedQty: `${c.TotalOrderedQuantity || 0} ${c.TotalOrderedQuantityUnit || ""}`,
                  daysToExpiry: days > 0 ? `${days} days` : "Expired",
                  expiryState: state,
                  status: status,
                  statusState: days > 0 ? "Success" : "Error"
                };
              })
            }
          };
        },

        _getCurrentMonthSpend: function (oData) {
          const oDate = new Date();
          const sMonth = oDate.toLocaleString('default', { month: 'short' });
          return parseFloat(oData[`PoValue_${sMonth}`]) || 0;
        },

        _updateFinancialTiles: function (oData) {
          const iTotal = parseFloat(oData.PoValue_Y2D) || 0;
          const iCurrent = this._getCurrentMonthSpend(oData);
          const iGrowth = iCurrent > 0 ? ((iCurrent / (iTotal - iCurrent)) * 100).toFixed(1) : 0;

        },

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

        _loadODataEntity: function (sEntitySet, sVendorCode, mParameters = {}) {
          return new Promise((resolve, reject) => {
            const oODataModel = this.getOwnerComponent().getModel();
            const aFilters = [new Filter("VendorCode", FilterOperator.EQ, sVendorCode)];

            oODataModel.read(`/${sEntitySet}`, {
              filters: aFilters,
              urlParameters: mParameters.urlParameters || {},
              success: (oData) => {
                if (!oData.results || oData.results.length === 0) {
                  console.warn(`No data for ${sEntitySet} (Vendor: ${sVendorCode})`);
                  resolve([]);
                } else {
                  resolve(oData.results);
                }
              },
              error: (oError) => {
                console.error(`Failed to load ${sEntitySet}`, oError);
                MessageToast.show(`Failed to load ${mParameters.title || sEntitySet}`);
                reject(oError);
              }
            });
          });
        },


        // ============ FORMATTER FUNCTIONS ============
        formatQuantity: function (quantity, formattedNumber) {
          if (!quantity && quantity !== 0) return "0 units";
          return `${formattedNumber} units`;
        },

        formatNumber: function (value) {
          if (!value && value !== 0) return "0";
          return value.toLocaleString();
        },

        formatCurrency: function (value, currency) {
          if (!value && value !== 0) return "$0";
          const formattedValue = value.toLocaleString();
          return currency === "EUR"
            ? `€${formattedValue}`
            : `$${formattedValue}`;
        },

        formatTrend: function (value) {
          if (!value && value !== 0) return "0%";
          return value > 0 ? `+${value}%` : `${value}%`;
        },

        formatDate: function (dateString) {
          if (!dateString) return "";
          try {
            const oDate = new Date(dateString);
            return oDate.toLocaleDateString();
          } catch (error) {
            return dateString;
          }
        },

        getTrendState: function (value) {
          if (!value && value !== 0) return "None";
          if (value > 0) return "Success";
          if (value < 0) return "Error";
          return "None";
        },

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

        getAnnouncementColor: function (category) {
          const colorMap = {
            RFQ: "Accent6",
            "Business Announcement": "Accent8",
            "Compliance Notification": "Accent2",
            Urgent: "Accent4",
          };
          return colorMap[category] || "Accent6";
        },

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
