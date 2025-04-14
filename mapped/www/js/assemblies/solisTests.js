export function load() {
  let gx=`
<sbadmin-content-page>
  <sbadmin-spacer />
  <sbadmin-card bgColor="white" textColor="dark" widthStyle="60%" position="center">
    <sbadmin-card-header text="Solis Inverter API Tests" />
    <sbadmin-card-body>
      <sbadmin-card-text>
        If you are having problems getting Agility to instruct your inverter to charge your batteries
        from the grid, you need to check the responses being returned from your inverter via the
        SolisCloud APIs.
      </sbadmin-card-text>
      <sbadmin-card-text>
        The responses returned by the following tests will help to determine what might be going wrong.
      </sbadmin-card-text>

      <sbadmin-form golgi:ref="testingform">
        <fieldset>
          <hr />
          <sbadmin-card-text>
            Agility only currently supports the Solis S3-Wifi DataLogger
          </sbadmin-card-text>
          <sbadmin-button color="orange" text="Discover Your DataLogger Type" golgi:hook="dataLogger" />
          <hr />
          <sbadmin-card-text>
            Agility needs to know your inverter firmware version
          </sbadmin-card-text>
          <sbadmin-button color="cyan" text="Inverter Software Version" golgi:hook="softwareVersion" />
          <hr />
          <sbadmin-card-text>
            Check whether Agility can successfully read your inverter settings
          </sbadmin-card-text>
          <sbadmin-button color="blue" text="Read Inverter Charge Settings" golgi:hook="chargeSetting" />
          <sbadmin-spacer />
          <sbadmin-button color="green" text="Read Inverter Mode Settings" golgi:hook="modeSetting" />
          <sbadmin-spacer />
          <sbadmin-card-text golgi:ref="testResults"></sbadmin-card-text>
        </fieldset>
      </sbadmin-form>

    </sbadmin-card-body>
  </sbadmin-card>

  <sbadmin-toast golgi:ref="toast" />

</sbadmin-content-page>
  `;

  let hooks = {
    'sbadmin-button': {
      chargeSetting: function() {
        let _this = this;
        let contentPage = this.getParentComponent('sbadmin-content-page');
        this.on('clicked', async function() {
          contentPage.testResults.rootElement.innerHTML = '';
          let json = await _this.context.request('/agility/solis/atRead/4643');
          if (json.error) {
            contentPage.toast.headerTxt = 'Error';
            contentPage.toast.display(json.error);
          }
          let resp = JSON.stringify(json, null, 2);
          contentPage.testResults.rootElement.innerHTML = `<p>Response:</p><pre>` + resp + `</pre>`;
        });
      },
      modeSetting: function() {
        let _this = this;
        let contentPage = this.getParentComponent('sbadmin-content-page');
        this.on('clicked', async function() {
          contentPage.testResults.rootElement.innerHTML = '';
          let json = await _this.context.request('/agility/solis/atRead/636');
          if (json.error) {
            contentPage.toast.headerTxt = 'Error';
            contentPage.toast.display(json.error);
          }
          let resp = JSON.stringify(json, null, 2);
	  let resp2 = +json.data.msg;
	  let resp3 = resp2.toString(2).padStart(16,'0');
	  let resp4 = ((resp2 & 1) + (resp2 & 64)).toString(2).padStart(16,'0');
	  let resp5 = 'Mode is <b>UNKNOWN</b>';
	  if ((resp2 & 1) == 1 && (resp2 & 64) == 0) { resp5 = 'Mode is <b>SELF-USE</b>'; }
	  if ((resp2 & 64) == 64 && (resp2 & 1) == 0) { resp5 = 'Mode is <b>FEED-IN PRIORITY</b>'; }
          contentPage.testResults.rootElement.innerHTML = `<p>Response:</p><pre>` + resp + '<br><br>'
		+ 'Decimal:          ' + resp2 + '<br>'
		+ 'Solis bits:       ' + resp3 + '<br>'
		+ 'Bits of interest: ' + resp4 + '<br>'
		+ resp5 
		+`</pre>`;
        });
      },
      dataLogger: function() {
        let _this = this;
        let contentPage = this.getParentComponent('sbadmin-content-page');
        this.on('clicked', async function() {
          contentPage.testResults.rootElement.innerHTML = '';
          let json = await _this.context.request('/agility/solis/dataLogger');
          if (json.error) {
            contentPage.toast.headerTxt = 'Error';
            contentPage.toast.display(json.error);
          }
          let resp = JSON.stringify(json, null, 2);
          contentPage.testResults.rootElement.innerHTML = `<p>Response:</p><pre>` + resp + `</pre>`;
        });
      },
      softwareVersion: function() {
        let _this = this;
        let contentPage = this.getParentComponent('sbadmin-content-page');
        this.on('clicked', async function() {
          contentPage.testResults.rootElement.innerHTML = '';
          let json = await _this.context.request('/agility/solis/softwareVersion');
          if (json.error) {
            contentPage.toast.headerTxt = 'Error';
            contentPage.toast.display(json.error);
          }
          let resp = JSON.stringify(json, null, 2);
          contentPage.testResults.rootElement.innerHTML = `<p>Response:</p><pre>` + resp + `</pre>`;
        });
      }

    }
  };

  return {gx, hooks};
};
