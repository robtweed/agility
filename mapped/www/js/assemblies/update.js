export function load() {
  let gx=`
<sbadmin-content-page golgi:hook="isAvailable">
  <sbadmin-spacer />
  <sbadmin-card bgColor="white" textColor="dark" widthStyle="60%" position="center">
    <sbadmin-card-header text="Update Agility" />
    <sbadmin-card-body>
      <sbadmin-form golgi:ref="form">
        <fieldset>
          <sbadmin-card-text golgi:ref="cardText1" />
          <sbadmin-card-text golgi:ref="cardText2" />
          <sbadmin-button color="green" text="Update Agility" golgi:ref="updateBtn" golgi:hook="configure" />
        </fieldset>
      </sbadmin-form>
    </sbadmin-card-body>
  </sbadmin-card>

  <sbadmin-toast golgi:ref="toast" />

</sbadmin-content-page>
  `;

  let hooks = {
    'sbadmin-content-page': {
      isAvailable: function() {

        let _this = this;
        this.on('selected', async function() {
          _this.updateBtn.hide();

          let json = await _this.context.request('/agility/isUpdateAvailable');
          if (json.error) {
            _this.toast.headerTxt = 'Error';
            _this.toast.display(json.error);
          }
          else if (json.updateAvailable) {
            if (json.updateAvailable.updateContainer) {
              _this.cardText1.rootElement.textContent = 'Agility Version ' +  json.updateAvailable.latestVersion + 'is available';
              _this.cardText2.rootElement.textContent = 'You must update the Agility Container to install it';
              _this.updateBtn.hide();
            }
            else {
              _this.cardText1.rootElement.textContent = 'You are currently running version ' + json.updateAvailable.currentVersion;
              _this.cardText2.rootElement.textContent = 'Update Agility to version ' + json.updateAvailable.latestVersion;
              _this.updateBtn.show();
            }
          }
          else {
            _this.cardText1.rootElement.textContent = 'You are running the latest version of Agility';
            _this.updateBtn.hide();
          }
        });
      }
    },
    'sbadmin-button': {
      configure: function() {
        let contentPage = this.getParentComponent('sbadmin-content-page');
        this.on('clicked', async () => {
          let json = await this.context.request('/agility/update');
          contentPage.toast.headerTxt = 'Attention!';
          contentPage.toast.display('Agility has been updated to the latest version');
          contentPage.cardText1.rootElement.textContent = 'Agility has been Updated';
          contentPage.cardText2.rootElement.textContent = 'You must restart Agility for changes to take effect';
          this.hide();
        });
      }
    }

  };

  return {gx, hooks};
};

