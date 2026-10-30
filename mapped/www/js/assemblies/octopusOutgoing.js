export function load() {
  let gx=`
<sbadmin-content-page golgi:hook="octopusOutgoing">
  <sbadmin-spacer />
  <sbadmin-card bgColor="white" textColor="dark" widthStyle="60%" position="center">
    <sbadmin-card-header text="Octopus Outgoing Agile Configuration" />
    <sbadmin-card-body>
      <sbadmin-form golgi:ref="form">
        <fieldset>
          <sbadmin-checkbox-group name="enableAgileExport" switch="true" scale="1.8" value="no" offValue="no" label=" : Enable" golgi:ref="enableAgileExport" golgi:hook="agileExport" />
          <sbadmin-spacer /> 
          <hr />
          <sbadmin-button color="cyan" text="Create URL Fields" golgi:ref="genBtn" />
          <sbadmin-spacer /> 
          <hr />
          <sbadmin-input type="text" name="xurl1" label="Octopus Agile Outgoing Price URL (part 1):" placeholder="URL string preceding the DNO zone" />
          <sbadmin-spacer />
          <sbadmin-button color="green" text="Save Changes" golgi:ref="saveBtn" />
        </fieldset>
      </sbadmin-form>

      <hr />

      <sbadmin-form golgi:ref="controlForm">
        <fieldset>
          <sbadmin-card-text>Export Control Configuration</sbadmin-card-text>

          <sbadmin-card-text>When Outgoing Agile is enabled:</sbadmin-card-text>

          <sbadmin-card-text>- prior to the 16:00-19:00 peak, Agility will try to get your battery up to 100% by topping up with grid power if cost-effective</sbadmin-card-text>
          <sbadmin-card-text>- during the 16:00-19:00 peak, Agility will try to export any surplus power at the slots with the best export rates</sbadmin-card-text>

          <sbadmin-card-text>The following parameters control/modify these behaviours</sbadmin-card-text>

          <sbadmin-card-text>Minimum Margin (p): Automatic import will NOT take place at pre-peak times if the difference between the best export price and the current slot's import price is this amount or less</sbadmin-card-text>
          <sbadmin-input type="text" name="minMargin" placeholder="Minimum margin price difference (p)" />

          <sbadmin-card-text>Always Buy Margin (p): Prior to peak times, import will ALWAYS occur if the difference between the best export price and the current slot's import price is greater or equal to this amount</sbadmin-card-text>
          <sbadmin-input type="text" name="alwaysBuyMargin" placeholder="Always Buy Margin Price (p)" />

          <sbadmin-card-text>Minimum Export Price (p): Automatic export at peak times will NOT take place if the slot's export price is this price or less</sbadmin-card-text>
          <sbadmin-input type="text" name="minPrice" placeholder="Minimum export price (p)" />
          <sbadmin-spacer />

          <sbadmin-button color="green" text="Save Changes" golgi:ref="saveControlBtn" />

        </fieldset>
      </sbadmin-form>


    </sbadmin-card-body>
  </sbadmin-card>

  <sbadmin-toast golgi:ref="toast" />

</sbadmin-content-page>
  `;

  let hooks = {
    'sbadmin-content-page': {
      octopusOutgoing: function() {
        let _this = this;
        let accountId;
        let key;
        this.on('selected', async function() {

          // fetch the current values

          let url = '/agility/config/octopus';
          let json = await _this.context.request(url);
          if (json.error) {
            _this.toast.headerTxt = 'Error';
            _this.toast.display(json.error);
          }
          else {
            for (let name in json.data) {
              if (_this.form.fieldsByName.get(name)) {
                _this.form.fieldsByName.get(name).value = json.data[name];
              }
            }
            accountId = json.data.accountId;
            key = json.data.username;
          }

          url = '/agility/octopus/agileexportconfig';
          json = await _this.context.request(url);
          if (json.error) {
            _this.toast.headerTxt = 'Error';
            _this.toast.display(json.error);
          }
          else {
            for (let name in json) {
              if (_this.controlForm.fieldsByName.get(name)) {
                console.log('found');
                _this.controlForm.fieldsByName.get(name).value = json[name];
              }
            }
          }

          _this.saveBtn.on('clicked', async () => {
            let url = '/agility/config/octopusexport';

            let body = {
              xurl1: _this.form.fieldsByName.get('xurl1').value
            };

            let json = await _this.context.request(url, 'POST', body);
            if (json.error) {
              _this.toast.headerTxt = 'Error';
              _this.toast.display(json.error);
            }
            else {
              _this.toast.headerTxt = 'Success!';
              _this.toast.display('Update was successful');
            }
          });

          _this.saveControlBtn.on('clicked', async () => {
            let url = '/agility/octopus/agileexportconfig';

            let body = {};
            for (let [name, field] of _this.controlForm.fieldsByName) {
              body[name] = field.value;
            }

            let json = await _this.context.request(url, 'POST', body);
            if (json.error) {
              _this.toast.headerTxt = 'Error';
              _this.toast.display(json.error);
            }
            else {
              _this.toast.headerTxt = 'Success!';
              _this.toast.display('Update was successful');
            }
          });


          _this.genBtn.on('clicked', async () => {
            let body = {
              accountId: accountId,
              key: key
            }
            let json = await _this.context.request('/agility/octopus/urlfields', 'POST', body);
            if (json.error) {
              _this.toast.headerTxt = 'Error';
              _this.toast.display(json.error);
            }
            else {
              _this.toast.headerTxt = 'Success!';
              _this.toast.display('Agility was able to fetch your Agile Tariff URL Details');
              _this.form.fieldsByName.get('xurl1').value = json.xurl1;
            }
          });

        });
      }
    },
    'sbadmin-checkbox-group': {
      agileExport: function() {
        let _this = this;
        this.on('cbReady', async function(cb) {
          // see if charging is enabled
          let contentPage = _this.getParentComponent('sbadmin-content-page');

          let json = await _this.context.request('/agility/octopus/isAgileExportEnabled');
          if (json.error) {
            contentPage.toast.headerTxt = 'Error';
            contentPage.toast.display(json.error);
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
              json = await _this.context.request('/agility/octopus/enableAgileExport');
              if (json.error) {
                contentPage.toast.headerTxt = 'Error';
                contentPage.toast.display(json.error);
                cb.uncheck();
              }
              else {
                contentPage.toast.headerTxt = 'Success!';
                contentPage.toast.display('Agility will manage your exports using the Outgoing Agile tariff');
              }
            }
            else {
              json = await _this.context.request('/agility/octopus/disableAgileExport');
              if (json.error) {
                contentPage.toast.headerTxt = 'Error';
                contentPage.toast.display(json.error);
              }
              else {
                contentPage.toast.headerTxt = 'Attention!';
                contentPage.toast.display('Agility will no longer manage exports using the Outgoing Agile tariff');
              }
            }
          });
        });
      }
    }
  };

  return {gx, hooks};
};