export function load() {
  let gx=`
<sbadmin-content-page golgi:hook="octopus">
  <sbadmin-spacer />
  <sbadmin-card bgColor="white" textColor="dark" widthStyle="60%" position="center">
    <sbadmin-card-header text="Octopus Credentials" />
    <sbadmin-card-body>
      <sbadmin-form golgi:ref="form">
        <fieldset>
          <sbadmin-card-text>If you know your Octopus Key, Agility can auto-generate your URL details</sbadmin-card-text>
          <sbadmin-card-text>using your Octopus Account Id and your API Key</sbadmin-card-text>
          <sbadmin-input type="text" name="accountId" label="Account Id:" placeholder="Your Octopus Account Id" />
          <sbadmin-input type="text" name="username" label="API Key:" placeholder="Your Octopus API Key" />
          <sbadmin-button color="cyan" text="Create URL Fields" golgi:ref="genBtn" />
          <hr />
          <sbadmin-input type="text" name="zone" label="Your DNO Zone:" placeholder="A-P" />
          <sbadmin-input type="text" name="url1" label="Octopus Agile Price URL (part 1):" placeholder="URL string preceding the DNO zone" />
          <sbadmin-input type="text" name="url2" label="Octopus Agile Price URL (part 2):" placeholder="URL string following the DNO zone" />
          <sbadmin-button color="green" text="Save Changes" golgi:ref="saveBtn" />
        </fieldset>
      </sbadmin-form>

      <sbadmin-spacer />

      <sbadmin-div golgi:ref="tests">
        <sbadmin-card-text>Test your Octopus API Credentials Below:</sbadmin-card-text>

        <sbadmin-form golgi:ref="testingform">
          <fieldset>
            <sbadmin-button-group>
              <sbadmin-button color="blue" text="Fetch Agile Tariff" golgi:ref="fetchBtn" />
              <sbadmin-button color="orange" text="Clear Results" golgi:ref="clearBtn" />
            </sbadmin-button-group>
            <sbadmin-card-text golgi:ref="testResults"></sbadmin-card-text>

          </fieldset>
        </sbadmin-form>
      </sbadmin-div>

    </sbadmin-card-body>
  </sbadmin-card>

  <sbadmin-toast golgi:ref="toast" />

</sbadmin-content-page>
  `;

  let hooks = {
    'sbadmin-content-page': {
      octopus: function() {
        let _this = this;
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
          }

          _this.saveBtn.on('clicked', async () => {
            let url = '/agility/config/octopus';

            let body = {};
            for (let [name, field] of _this.form.fieldsByName) {
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
              accountId: _this.form.fieldsByName.get('accountId').value,
              key: _this.form.fieldsByName.get('username').value
            }
            let json = await _this.context.request('/agility/octopus/urlfields', 'POST', body);
            if (json.error) {
              _this.toast.headerTxt = 'Error';
              _this.toast.display(json.error);
            }
            else {
              _this.toast.headerTxt = 'Success!';
              _this.toast.display('Agility was able to fetch your Agile Tariff URL Details');

              _this.form.fieldsByName.get('zone').value = json.dnoCode;
              _this.form.fieldsByName.get('url1').value = json.url1;
              _this.form.fieldsByName.get('url2').value = json.url2;
            }
          });


          _this.fetchBtn.on('clicked', async () => {
            let json = await _this.context.request('/agility/octopus/agiletariff');
            if (json.error) {
              _this.toast.headerTxt = 'Error';
              _this.toast.display(json.error + '<br>Check that your credentials are correct');
              _this.testResults.rootElement.innerHTML = `<p>Error Details:</p><p>` + json.details + `</p>`;
            }
            else {
              _this.toast.headerTxt = 'Success!';
              _this.toast.display('Agility was able to fetch the Octopus Agile Tariff');
              _this.testResults.rootElement.innerHTML = `<p>Here is a sample:</p><p>` + JSON.stringify(json.example) + `</p>`;
            }

          });

          _this.clearBtn.on('clicked', async () => {
            _this.testResults.rootElement.textContent = '';
          });

        });
      }
    }
  };

  return {gx, hooks};
};