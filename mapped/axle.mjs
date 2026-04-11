/*

 ----------------------------------------------------------------------------
 | Agility: Solar Battery Optimisation against Octopus Agile Tariff          |
 |           specifically for Solis Inverters                                |
 |                                                                           |
 | Copyright (c) 2024-26 MGateway Ltd,                                       |
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

 1 April 2026

*/

import fs from 'fs';

let Axle = class {

  constructor(agility) {
    this.document = new agility.glsdb.node('axle');
    this.config = agility.config.$('axle');
    this.logger = agility.logger;
    this.date = agility.date;
    this.agility = agility;
    this.octopus = agility.octopus;
    this.use = true;
  }

  get isConfigured() {
    if (!this.config.exists) return false;
    let data = this.config.document;
    if (!data.endpoint) return false;
    if (!data.key) return false;
    return true;
  }

  get isEnabled() {
    return this.config.$('enabled').exists;
  }

  get enabled() {
    return this.config.$('enabled').exists;
  }

  enable() {
    this.config.$('enabled').value = true;
  }

  disable() {
    this.config.$('enabled').delete();
  }

  get url() {
    return this.config.$('endpoint').value;
  }

  set url(value) {
    this.config.$('endpoint').value = value;
  }

  get key() {
    return this.config.$('key').value;
  }

  set key(value) {
    this.config.$('key').value = value;
  }

  get powerAdjustment() {
    let doc = this.document.$('powerAdjustment');
    if (doc.exists) {
      return +doc.value;
    }
    else {
      return 0;
    }
  }

  set powerAdjustment(value) {
    this.document.$('powerAdjustment').value = value;
  }

  deletePowerAdjustment() {
    this.document.$('powerAdjustment').delete();
  }

  async request() {
    if (!this.isConfigured) {
      return {
        error: 'Axle configuration is incomplete'
      };
    }

    if (!this.isEnabled) {
      return {
        error: 'Axle is not enabled for use with Agility'
      };
    }

    let options = {
      method: 'GET',
      headers: {
        authorization: 'Bearer ' + this.key
      }
    };
    let res;
    try {
      res = await fetch(this.url, options);
    }
    catch(err) {
      if (!res) {
        res = {
          status: 'unknown',
          statusText: err
        };
      }
      return {
        error: 'Request for Axle Notification failed',
        status: res.status,
        statusText: res.statusText
      };
    }
    if (res.status !== 200) {
      return {
        error: 'Axle returned status code ' + res.status
      };
    }
    try {
      let data = await res.json();
      return data;
    }
    catch(err) {
      this.logger.write('Axle Error: ' + res.status + ': ' + res.statusText);
      return {
        error: 'Request for Axle Notification failed',
        status: res.status,
        statusText: res.statusText,
        err: err
      };
    }
  }

  async update() {
    this.deletePowerAdjustment();
    this.logger.write('Fetching Axle Event Notification Update now');
    let res = await this.request();
    if (res.error) {
      this.agility.addTask('updateAxleData');
      this.agility.taskFailed('updateAxleData');
      this.logger.write(JSON.stringify(res));
    }
    else {
      // process Axle Notification

      this.logger.write('Axle Event Notification fetched successfully');
      this.logger.write(JSON.stringify(res));

      if (res.start_time === null && res.end_time === null) {
        this.logger.write('No impending Axle Event: no action taken');
      }
      else if (res.import_export !== 'export') {
        this.logger.write('Axle event is not an export event: no action taken');
        return {status: 'Axle event is not an export one'};
      }
      else {
        let eventStart = this.agility.date.at(res.start_time);
        let eventEnd = this.agility.date.at(res.end_time);
        this.logger.write('Impending Axle Event: ' + eventStart.day + '/' + eventStart.month + '/' + eventStart.year + ' from ' + eventStart.slotTimeText + ' until ' + eventEnd.slotTimeText);
        let now = this.agility.date.now();

        if (now.slotTimeIndex >= eventStart.slotTimeIndex && now.slotTimeIndex < eventEnd.slotEndTimeIndex) {
          // Event is now!
          this.logger.write('Event starts at current Time Slot: start discharge');
          this.agility.addTask('inverterDischarge');
          this.agility.removeTask('shouldBatteryBeCharged');
          return {status: 'Axle Event Now: Discharge Battery'};
        }
        if (now.slotIndex > eventEnd.slotIndex) {
          this.logger.write('Event has finished');
          return {status: 'Axle Event has ended'};
        }

        let noOfSlots = (eventEnd.slotTimeIndex - eventStart.slotTimeIndex) / 1800000;
        if (eventStart.dateIndex === now.dateIndex) {
          // happening today, so set adjustment
          this.setPowerAdjustment(noOfSlots);
          this.logger.write('Event Power adjustment set to ' + this.powerAdjustment.toFixed(2));
        }
        else if (eventStart.dateIndex - now.dateIndex === 86400000) {
          // happening tomorrow

          // if tomorrow's Octopus tariffs are available, set the adjustment

          if (this.octopus.tomorrowsTariffsAvailable) {
            // set the adjustment
            this.setPowerAdjustment(noOfSlots);
            this.logger.write('Event Power adjustment set to ' + this.powerAdjustment.toFixed(2));
          }
          else {
            // ignore notification
            this.logger.write('Octopus tariff for tomorrow not yet available, so ignore Axle notification for now');
          }
        }
        else {
          // ignore notification
          this.logger.write('Notification is more than a day away, so ignore Axle notification for now');
        }

      }

    }
    return {status: 'Axle Event Notification Handling completed'};
  }

  setPowerAdjustment(noOfSlots) {
    noOfSlots = noOfSlots || 1;
    let aveDischarge = this.agility.battery.percentDecreasePerDischarge * noOfSlots;
    let dischargePower = this.agility.battery.powerFromPercentage(aveDischarge);
    this.powerAdjustment = dischargePower;
  }

};

export {Axle}