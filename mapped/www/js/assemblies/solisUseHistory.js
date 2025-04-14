export function load() {
  let gx=`
<sbadmin-content-page golgi:hook="history">
  <sbadmin-spacer />
  <sbadmin-card bgColor="white" textColor="dark" widthStyle="60%" position="center">
    <sbadmin-card-header text="Your Power Usage History" />
    <sbadmin-card-body>
      <sbadmin-form golgi:ref="form">
        <sbadmin-select name="availableDates" label="Select a Date" golgi:ref="dateSelect" golgi:hook="dateSelected"/>
      </sbadmin-form>

      <canvas golgi:ref="useHistoryChart" />

      <sbadmin-modal golgi:ref="modal" />

    </sbadmin-card-body>
  </sbadmin-card>

  <sbadmin-toast golgi:ref="toast" />

</sbadmin-content-page>
  `;

  let hooks = {
    'sbadmin-content-page': {
      history: function() {
        let _this = this;

document.addEventListener('touchend', function (event) {
  if (event.target && event.target.tagName.toLowerCase() !== "canvas") {
    CHART_INSTANCE.canvas.dispatchEvent(new Event('mouseout'));
  }
});

        this.fetchHistory = async function(dateIndex) {
	  let jsonbatt = await _this.context.request('/agility/config/battery');
          let json = await _this.context.request('/agility/solis/data/history/' + dateIndex);
          if (jsonbatt.error) {
            _this.toast.headerTxt = 'Error';
            _this.toast.display(jsonbatt.error);
          }
	  else if (json.error) {
            _this.toast.headerTxt = 'Error';
            _this.toast.display(json.error);
          }
          else {
	    let battMax = +jsonbatt.data.chargeLimit;
	    let battMin = +jsonbatt.data.minimumLevel;
            let labels = [];
            let batteryLevels = [];
            let prices = [];
            let gridImports = [];
            let gridExports = [];
            let pvs = [];
            let load = [];
            for (let record of json.history) {
              labels.push(record.time);
              batteryLevels.push(record.batteryLevel);
              gridImports.push(record.gridImportTotal);
              gridExports.push(record.gridExportTotal);
              pvs.push(record.pvOutputTotal);
              load.push(record.houseLoadTotal);
              prices.push(record.price);
            }


            let data = {
              labels: labels,
              datasets: [
                {
                  label: 'Battery',
                  data: batteryLevels,
                  fill: false,
                  borderColor: 'red',
                  tension: 0.2,
                  yAxisID: 'battery'
                },
                {
                  label: 'Price',
                  data: prices,
                  fill: {
                	target: 'origin',
                	above: 'rgba(0, 0, 0, 0.0)',   // Area will be clear
                	below: 'rgba(240, 80, 248, 0.6)'    // And Octopus pink below the origin
              		},
                  borderColor: 'blue',
                  stepped: 'before',
                  yAxisID: 'price'
                },
                {
                  label: 'Grid Import',
                  data: gridImports,
                  fill: true,
                  borderColor: 'green',
                  stepped: 'after',
                  yAxisID: 'power'
                },
                {
                  label: 'Load',
                  data: load,
                  fill: false,
                  tension: 0.2,
                  borderColor: 'rgba(10, 10, 90, 0.3)',
                  yAxisID: 'power'
                },
                {
                  label: 'Solar',
                  data: pvs,
                  fill: false,
                  borderColor: 'orange',
                  tension: 0.2,
                  yAxisID: 'power'
                },
                {
                  label: 'Grid Export',
                  data: gridExports,
                  fill: true,
                  stepped: 'after',
                  borderColor: 'orange',
                  backgroundColor: 'yellow',
                  yAxisID: 'power'
                }
              ]
            };

            let config = {
              type: 'line',
              data: data,
              options: {
                interaction: {
                  intersect: false,
                  mode: 'index',
                },
                plugins: {
                  tooltip: {
                    callbacks: {
                      afterBody:  function(tooltipItems) {
                        let slot = tooltipItems[0].label;
                        let decision = json.chargeDecisionHistory[slot];
                        let lines = [];
                        let cutoffTime = decision.calculationCutoffTime || '22:30';
                        let until = 'until ' + cutoffTime + ' today: ';
                        if (decision.untilTomorrow) until = 'until ' + cutoffTime + ' tomorrow: ';
                        let load = +decision.solis.load;
                        lines.push('Expected load ' + until + load.toFixed(2) + ' kWh');
                        let pv = +decision.solis.pv;
                        if (decision.solcast) pv = +decision.solcast.adjustedPrediction;
                        lines.push('Predicted PV ' + until + pv.toFixed(2) + ' kWh');
                        let deficit = +decision.deficit;
                        if (deficit < 0) {
                          deficit = 0 - deficit;
                          lines.push('Power surplus ' + until + deficit.toFixed(2) + ' kWh');
                        }
                        else {
                          lines.push('Power deficit ' + until + deficit.toFixed(2) + ' kWh');
                        }
                        if (decision.chargingDecision.charge) {
                          if (decision.chargingDecision.charge === 'charge') lines.push('Charging from Grid');
                          if (decision.chargingDecision.charge === 'gridonly') lines.push('Using Grid Power but not charging');
                        }
                        lines.push(decision.chargingDecision.reason);
                        return lines;
                      }
                    }
                  }
                },
                scales: {
                  price: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                      display: true,
                      text: 'Price (p)'
                    }
                  },
                  battery: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    min: battMin,
                    max: battMax,
                    title: {
                      display: true,
                      text: 'Battery Level (%)'
                    }
                  },
                  power: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    min: 0,
                    title: {
                      display: true,
                      text: 'Load / Grid / Solar (kWh)'
                    }
                  }
                }
              }
            };  

            if (_this.context.useHistoryChart) _this.context.useHistoryChart.destroy();
            _this.context.useHistoryChart= new _this.context.Chart(_this.useHistoryChart, config);
          }
        };

        this.on('selected', async function() {
          let json = await _this.context.request('/agility/solis/data/availableDates');
          if (json.error) {
            _this.toast.headerTxt = 'Error';
            _this.toast.display(json.error);
          }
          else {
            let options = [];
            for (let obj of json.dates) {
              options.push({
                text: obj.date,
                value: obj.dateIndex
              });
            }
            _this.dateSelect.options = options;
            await _this.fetchHistory(json.dates[0].dateIndex);
          }
        });

      }
    },
    'sbadmin-select': {
      dateSelected: function() {
        let contentPage = this.getParentComponent('sbadmin-content-page');
        this.form.on('changed', async function(select) {
          await contentPage.fetchHistory(select.value);
        });
      }
    }
  };

  return {gx, hooks};
};
