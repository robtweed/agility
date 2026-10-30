export function load() {
  let gx=`
<sbadmin-content-page golgi:hook="slotsNow">
  <sbadmin-spacer />
  <sbadmin-card bgColor="white" textColor="dark" widthStyle="60%" position="center">
    <sbadmin-card-header text="Octopus Outgoing Agile Slots in Descending Price" />
    <sbadmin-card-body>

      <sbadmin-card-text golgi:ref="heading"/>

      <sbadmin-table cls="table-sm table-responsive" golgi:ref="table" />

    </sbadmin-card-body>
  </sbadmin-card>

  <sbadmin-toast golgi:ref="toast" />

</sbadmin-content-page>
  `;

  let hooks = {
    'sbadmin-content-page': {
      slotsNow: function() {
        let _this = this;
        this.on('selected', async function() {

          let positionNow = await _this.context.request('/agility/positionNow');
          if (positionNow.error) {
            _this.toast.headerTxt = 'Error';
            _this.toast.display(json.error);
            return;
          }

          let json = await _this.context.request('/agility/octopus/bestExportSlotsNow');
          if (json.error) {
            _this.toast.headerTxt = 'Error';
            _this.toast.display(json.error);
          }
          else {
            let until;
            if (json.untilTomorrow) {
              until = positionNow.calculationCutoffTime + ' tomorrow';
            }
            else {
              until = positionNow.calculationCutoffTime + ' today';
            }
            _this.heading.text = 'Available Outgoing Agile slots from current slot (' + json.slotFrom + ') until ' + until;

            // render results in table
            let table = {
              head: [
                {value: 'Priority'},
                {value: 'Date'},
                {value: 'Time'},
                {value: 'Price (p)'}
              ],
              body: []
            };
            
            function addRow(slot, cls) {
              let row = [{value: slot.no}, {value: slot.date}, {value: slot.time}, {value: slot.price}];
              if (cls) row.unshift({cls: cls});
              table.body.push(row);
            }

            let count = 0;
            for (let slot of json.slots) {
              count++;
              slot.no = count;
              let cls;
              //if (count <= positionNow.battery.noOfSlotsToFillBattery) cls = 'table-danger';
              //if (count > positionNow.battery.noOfSlotsToFillBattery && count <= positionNow.chargeSlotsNeeded) cls = 'table-success';
              //if (slot.price <= positionNow.alwaysUsePrice) cls = 'table-warning';
              //if (positionNow.todaysAlwaysUsePrice && slot.price <= positionNow.todaysAlwaysUsePrice) cls = 'table-warning';
              addRow(slot, cls);
            }

            _this.table.render(table);
          }

        });
      }
    }
  };

  return {gx, hooks};
};