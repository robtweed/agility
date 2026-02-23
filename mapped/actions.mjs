/*

 ----------------------------------------------------------------------------
 | Agility: Solar Battery Optimisation against Octopus Agile Tariff          |
 |           specifically for Solis Inverters                                |
 |                                                                           |
 | Copyright (c) 2024-25 MGateway Ltd,                                       |
 | Redhill, Surrey UK.                                                       |
 | All rights reserved.                                                      |
 |                                                                           |
 | https://www.mgateway.com                                                  |
 | Email: rtweed@mgateway.com                                                |
 |                                                                           |
 |                                                                           |
 | Licensed under the Apache License, Version 2.0 (the "License");           |
 | you may not use this file except in compliance with the License.          |
 | You may obtain a copy of the License at                                   |
 |                                                                           |
 |     http://www.apache.org/licenses/LICENSE-2.0                            |
 |                                                                           |
 | Unless required by applicable law or agreed to in writing, software       |
 | distributed under the License is distributed on an "AS IS" BASIS,         |
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  |
 | See the License for the specific language governing permissions and       |
 |  limitations under the License.                                           |
 ----------------------------------------------------------------------------

 19 February 2025

 */

class Actions {

  constructor(agility) {
    this.fn = {
      updateOctopusTariffs: async function() {
        return await this.octopus.getLatestTariffTable();
      },
      updateSolcastData: async function() {
        return await this.solcast.update();
      },
      updateSolisData: async function() {
        return await this.solis.update();
      },
      updateYesterdaysSolisData: async function() {
        return await this.solis.update(-1);
      },
      shouldBatteryBeCharged: function() {
        let charge = this.battery.shouldBeCharged;
        if (charge === 'charge') {
          this.addTask('inverterCharge');
        }
        else if (charge === 'gridonly') {
          this.addTask('inverterGridOnly');
        }
        else {
          this.addTask('shouldBatteryBeDischarged');

          /*
          let now = this.date.now();
          this.logger.write('Check if peak time');
          this.logger.write('hour now: ' + now.hour);
          if (now.hour > 15 && now.hour < 19) {
            this.logger.write('Peak time: check if peak export enabled');
            if (this.peakExportEnabled) {
              this.logger.write('Peak export enabled');
              this.addTask('peakExport');
            }
            else {
              this.logger.write('Peak export not enabled');
              this.addTask('shouldBatteryBeDischarged');
            }
          }
          else {
            this.logger.write('Not peak time');
            this.addTask('shouldBatteryBeDischarged');
          }
          */
        }
        return {charge: charge};
      },
      shouldBatteryBeDischarged: function() {
        let discharge = this.battery.shouldBeDischarged;
        if (discharge) {
          this.addTask('inverterDischarge');
        }
        else {
          this.addTask('inverterReset');
        }
        return {discharge: discharge};
      },
      inverterCharge: async function() {
        return await this.solis.inverterCharge();
      },
      inverterExport: async function() {
        return await this.solis.inverterDischarge(true);
      },
      inverterDischarge: async function() {
        let override = false;
        if (this.battery.isDischargeControlFlagSet()) {
          override = true;
        }
        return await this.solis.inverterDischarge(override);
      },
      inverterGridOnly: async function() {
        return await this.solis.inverterGridOnly();
      },
      inverterReset: async function() {
        return await this.solis.inverterReset();
      },
      updateInverterTime: async function() {
        return await this.solis.updateInverterTime();
      },
      peakExport: async function() {
        return await this.battery.peakExport();
      },
      resetPeakHours: function() {
        return this.battery.resetPeakHours();
      },
      deleteTodaysAlwaysUsePrice: function() {
        this.deleteTodaysAlwaysUsePrice();
        this.unsetChargingStartedFlag();
        return {status: 'Todays always use price reset'};
      },
      checkForUpdates: async function() {
        let update = false;
        let json = await this.getLatestVersionNo();
        if (json.error) {
          return {status: 'Unable to check for updates'};
        }
        let latestVersion = json.version;
        if (+latestVersion > +this.myCurrentVersion) update = true;
        if (update) {
          this.updateAvailable = latestVersion;
          return {status: 'System should be updated to version ' + latestVersion};
        }
        else {
          this.removeUpdateAvailable();
          return {status: 'You are currently running the latest version: ' + latestVersion};
        }
      },

      backup: function() {
        let ignore = ['agilitySSE'];
        this.backup.now(ignore, 'agility.bak');
        return {status: 'Backup completed'};
      },
      cleardownInfo: function() {
        this.octopus.cleardown();
        if (this.solcast.isEnabled) this.solcast.cleardown();
        this.solis.cleardown();
        this.logger.cleardown(this.movingAveragePeriod);
        this.battery.cleardownChargeHistory();
        this.clearLogs();
        //this.exec('/opt/agility/mapped/control/clearLogs');
        return {status: 'Cleardown completed'};
      }
    }
  }

};

export {Actions};

