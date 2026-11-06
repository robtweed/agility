export function load() {
  let gx=`
<sbadmin-content-page golgi:hook="solcast">
  <sbadmin-spacer />
  <sbadmin-card bgColor="white" textColor="dark" widthStyle="60%" position="center">
    <sbadmin-card-header text="Solcast Predictions" />
    <sbadmin-card-body>
      <sbadmin-form golgi:ref="form">
        <sbadmin-select name="availableDates" label="Select a Date" golgi:ref="dateSelect" golgi:hook="dateSelected"/>
      </sbadmin-form>

      <canvas golgi:ref="predictionChart" />

    </sbadmin-card-body>
  </sbadmin-card>

  <sbadmin-toast golgi:ref="toast" />

</sbadmin-content-page>
  `;

  let hooks = {
    'sbadmin-content-page': {
      solcast: function() {
        let _this = this;

        this.fetchPrediction = async function(dateIndex) {
          let json = await _this.context.request('/agility/solcast/data/prediction/' + dateIndex);
          if (json.error) {
            _this.toast.headerTxt = 'Error';
            _this.toast.display(json.error);
          }
          else {
            let labels = [];
            let kwh = [];
            let total = [];
            for (let record of json.prediction) {
              labels.push(record.time);
              kwh.push(record.kwh);
              total.push(record.total);
            }

            let data = {
              labels: labels,
              datasets: [
                {
                  label: 'Energy',
                  data: kwh,
                  fill: false,
                  borderColor: 'red',
                  tension: 0.2,
                  yAxisID: 'y1'
                },
                {
                  label: 'Cumulative Energy',
                  data: total,
                  fill: false,
                  borderColor: 'blue',
                  tension: 0.2,
                  yAxisID: 'y2'
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
                scales: {
                  y1: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                      display: true,
                      text: 'Energy (kWh)'
                    }
                  },
                  y2: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                      display: true,
                      text: 'Cumulative Energy (kWh)'
                    }
                  }
                }
              }
            };
            if (_this.context.predictionChart) _this.context.predictionChart.destroy();
            _this.context.predictionChart= new _this.context.Chart(_this.predictionChart, config);
 
          }
        };

        this.on('selected', async function() {
          let json = await _this.context.request('/agility/solcast/data/availableDates');
          if (json.error) {
            _this.toast.headerTxt = 'Error';
            _this.toast.display(json.error);
          }
          else {
            let options = [];
            for (let obj of json.dates) {
              options.push({
                text: obj.dateText,
                value: obj.dateIndex
              });
            }
            _this.dateSelect.options = options;
            await _this.fetchPrediction(json.dates[0].dateIndex);
          }
        });

      }
    },
    'sbadmin-select': {
      dateSelected: function() {
        let contentPage = this.getParentComponent('sbadmin-content-page');
        this.form.on('changed', async function(select) {
          await contentPage.fetchPrediction(select.value);
        });
      }
    }
  };

  return {gx, hooks};
};
