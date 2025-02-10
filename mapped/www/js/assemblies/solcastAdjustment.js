export function load() {
  let gx=`
<sbadmin-content-page golgi:hook="solcast">
  <sbadmin-toast golgi:ref="toast" />
  <sbadmin-spacer />
  <sbadmin-card bgColor="white" textColor="dark" widthStyle="60%" position="center">
    <sbadmin-card-header text="Solcast Prediction Adjustment" />
    <sbadmin-card-body>
      <sbadmin-form golgi:ref="form">
        <fieldset>
          <sbadmin-checkbox-group name="autoAdjust" switch="true" scale="1.8" value="yes" offValue="no" label=" : Enable" title="Automatic Adjustment:" golgi:hook="configure" golgi:ref="autoAdjust" />
        </fieldset>
      </sbadmin-form>

      <sbadmin-spacer />

      <sbadmin-form golgi:ref="adjustmentForm">
        <fieldset>
          <sbadmin-input type="text" name="adjustment" label="Adjustment (%):" placeholder="Numeric value" golgi:ref="adjustment" />
          <sbadmin-button color="green" text="Update" golgi:hook="adjustment" />
        </fieldset>
      </sbadmin-form>

      <hr />

      <sbadmin-card-text>Your Solcast Predictions versus Actual PV Generation</sbadmin-card-text>
      <sbadmin-table cls="table-sm table-responsive" golgi:ref="table" />

    </sbadmin-card-body>
  </sbadmin-card>

</sbadmin-content-page>
  `;

  let hooks = {

    'sbadmin-content-page': {
      solcast: async function() {
        let _this = this;
        this.on('selected', async function() {
          let json = await _this.context.request('/agility/solcast/predictionHistory');
          if (json.error) {
            _this.toast.headerTxt = 'Error';
            _this.toast.display(json.error);
          }
          if (json.data) {
            let table = {
              head: [
                {value: 'Date'},
                {value: 'Prediction (kWh)'},
                {value: 'Actual PV (kWh)'},
                {value: 'Difference'}
              ],
              body: []
            };
            let totals = ['Total', 0, 0, 0];
            for (let record of json.data) {
              let diff = (((record.actual - record.prediction) / record.prediction) * 100).toFixed(1) + '%';
              table.body.push([{value: record.date}, {value: record.prediction.toFixed(2)}, {value: record.actual}, {value: diff}]);
              totals[1] += record.prediction;
              totals[2] += record.actual;
              totals[3] = (((totals[2] - totals[1]) / totals[1]) * 100).toFixed(1) + '%';
            }
            table.body.push([{value: totals[0]}, {value: totals[1].toFixed(2)}, {value: totals[2].toFixed(2)}, {value: totals[3]}]);
            _this.table.render(table);
          }

          json = await _this.context.request('/agility/solcast/adjustment');
          if (json.error) {
            _this.toast.headerTxt = 'Error';
            _this.toast.display(json.error);
          }
          if (typeof json.adjustment !== 'undefined') {
              _this.adjustment.value = parseFloat(json.adjustment).toFixed(2);
          }

          let cb = _this.autoAdjust.cb;
          console.log(cb);
          console.log('checked: ' + cb.checked);
          json = await _this.context.request('/agility/solcast/isAutoAdjustEnabled');
          if (json.error) {
            _this.toast.headerTxt = 'Error';
            _this.toast.display(json.error);
          }
          if (cb) {
            if (json.enabled && !cb.checked) {
              cb.check();
            }
            else if (!json.enabled && cb.checked) {
              cb.uncheck();
            }
         }

        });
      }
    },

    'sbadmin-button': {
      adjustment: function() {
        let _this = this;
        let contentPage = this.getParentComponent('sbadmin-content-page');
        this.on('clicked', async function() {
          let body = {
            adjustment: _this.form.fieldsByName.get('adjustment').value
          };
          let json = await _this.context.request('/agility/solcast/adjustment', 'POST', body);
          if (json.error) {
            contentPage.toast.headerTxt = 'Error';
            contentPage.toast.display(json.error);
          }
          else {
            contentPage.toast.headerTxt = 'Success!';
            contentPage.toast.display('Update was successful');
          }
        });
      }
    },

    'sbadmin-checkbox-group': {
      configure: function() {
        let _this = this;
        this.on('cbReady', async function(cb) {
          let contentPage = _this.getParentComponent('sbadmin-content-page');

          let json = await _this.context.request('/agility/solcast/isAutoAdjustEnabled');
          if (json.error) {
            setTimeout(function() {
              contentPage.toast.headerTxt = 'Error';
              contentPage.toast.display(json.error);
            }, 2000);
          }
          if (json.enabled) {
            cb.check();
          }
          else {
            cb.uncheck();
          }

          cb.on('clicked', async function() {
            let json;
            if (cb.checked) {
              json = await _this.context.request('/agility/solcast/enableAutoAdjust');
              if (json.error) {
                contentPage.toast.headerTxt = 'Error';
                contentPage.toast.display(json.error);
                cb.uncheck();
              }
              else {
                contentPage.toast.headerTxt = 'Success!';
                contentPage.toast.display('Agility will automatically calculate adjustments to your Solcast predictions from tonight');
              }
            }
            else {
              json = await _this.context.request('/agility/solcast/disableAutoAdjust');
              if (json.error) {
                contentPage.toast.headerTxt = 'Error';
                contentPage.toast.display(json.error);
              }
              else {
                contentPage.toast.headerTxt = 'Attention!';
                contentPage.toast.display('Any adjustments to your Solcast predictions must be made manually');
              }
            }
          });

        });
      }
    }
  };

  return {gx, hooks};
};
