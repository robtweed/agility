export function load() {
  let gx=`
<sbadmin-content-page golgi:hook="profile">
  <sbadmin-spacer />
  <sbadmin-card bgColor="white" textColor="dark" widthStyle="60%" position="center">
    <sbadmin-card-header text="Your Power Usage Profile" />
    <sbadmin-card-body>

      <sbadmin-card-text>Based on your Historical SolisCloud Data</sbadmin-card-text>
      <canvas golgi:ref="profileChart" />

    </sbadmin-card-body>
  </sbadmin-card>

  <sbadmin-toast golgi:ref="toast" />

</sbadmin-content-page>
  `;

  let hooks = {
    'sbadmin-content-page': {
      profile: function() {
        let _this = this;

        this.on('selected', async function() {

          let json = await _this.context.request('/agility/solis/profile');
          if (json.error) {
            _this.toast.headerTxt = 'Error';
            _this.toast.display(json.error);
          }
          else {

            let cumulative = [];
            let total = 0;
            for (let value of json.profile) {
              total = total + value;
              cumulative.push(total);
            }

            let labels = ['00:30', '01:00', '01:30', '02:00', '02:30', '03:00', '03:30', '04:00', '04:30', '05:00', '05:30', '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30'];

            let data = {
              labels: labels,
              datasets: [
                {
                  label: 'Energy Usage (kWh)',
                  data: json.profile,
                  fill: false,
                  borderColor: 'rgb(75, 192, 192)',
                  tension: 0.2,
                  yAxisID: 'y1'
                },
                {
                  label: 'Cumulative Energy (kWh)',
                  data: cumulative,
                  fill: false,
                  borderColor: 'blue',
                  tension: 0.2,
                  yAxisID: 'y2'

                },

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

            if (_this.context.profileChart) _this.context.profileChart.destroy();

            _this.context.profileChart = new _this.context.Chart(_this.profileChart, config);

          }

        });

      }
    }
  };

  return {gx, hooks};
};