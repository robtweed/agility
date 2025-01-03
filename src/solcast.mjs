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

 3 January 2025

*/

import fs from 'fs';

let Solcast = class {

  constructor(agility) {
    this.document = new agility.glsdb.node('solcast');
    this.predictions = this.document.$('data');
    this.totals = this.document.$('original');
    this.config = agility.config.$('solcast');
    this.solis = new agility.glsdb.node('solis');
    this.logger = agility.logger;
    this.date = agility.date;
    this.agility = agility;
    this.octopus = agility.octopus;
    this.use = true;
    this.updateTimes = ['02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '18:00', '22:00'];
  }

  get isConfigured() {
    if (!this.config.exists) return false;
    let data = this.config.document;
    if (!data.endpoint) return false;
    if (!data.key) return false;
    return true;
  }

  get minFetchDelay() {
    let delay = this.config.$(['fetchDelay', 'minimum']).value;
    if (delay === '') delay = 2;
    return delay;
  }

  set minFetchDelay(value) {
    this.config.$(['fetchDelay', 'minimum']).value = value;
  }

  get maxFetchDelay() {
    let delay = this.config.$(['fetchDelay', 'maximum']).value;
    if (delay === '') delay = 29;
    return delay;
  }

  set maxFetchDelay(value) {
    this.config.$(['fetchDelay', 'maximum']).value = value;
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

  get adjustment() {
    if (!this.config.$('adjustment').exists) {
      return 0;
    }
    return this.config.$('adjustment').value;
  }

  set adjustment(value) {
    this.config.$('adjustment').value = value;
  }

  calculateAdjustment() {
    //compare historical solcast original totals with solis historical actual totals
    // and calculate average percentage difference to apply
    // then reset into configuration document
    
    let count = 0;
    let totalP = 0;
    let totalA = 0;
    let _this = this;
    this.totals.forEachChildNode(function(dateNode) {
      let dateIndex = dateNode.key;
      let d = _this.date.at(dateIndex);
      if (d.dateIndex < _this.date.now().dateIndex) {
        count++;
        if (_this.solis.$(dateIndex).exists) {
          let predictedTotal = dateNode.$('total').value;
          totalP += predictedTotal;
          let actualTotal = _this.solis.$(dateIndex).lastChild.$('pvOutputTotal').value;
          console.log(d.dayText + '/' + d.monthText + ': predicted: ' + predictedTotal + '; actual: ' + actualTotal);
          totalA += actualTotal;
        }
      }
    });
    if (count > 0) {
      let diff = ((totalA - totalP) / totalP) * 100;
      console.log('percent difference: ' + diff);
      this.adjustment = diff;
    }
  }

  async request() {
    let options = {
      method: 'GET',
      headers: {
        authorization: 'Bearer ' + this.key
      }
    };
    let res = await fetch(this.url, options);
    try {
      let data = await res.json();
      return data;
    }
    catch(err) {
      this.logger.write('Solcast Error: ' + res.status + ': ' + res.statusText);
      return {
        error: 'Request for Solcast Data failed',
        status: res.status,
        statusText: res.statusText
      };
    }
  }

  update() {

    function getRandomInt(min, max) {
      const minCeiled = Math.ceil(min);
      const maxFloored = Math.floor(max);
      return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled);
    }

    let now = this.date.now();
    this.agility.removeTask('updateSolcastData');
    if (this.updateTimes.includes(now.slotTimeText) && now.slotTimeText !== this.lastUpdated) {
      let time = getRandomInt(this.minFetchDelay, this.maxFetchDelay);
      this.logger.write('Will try to fetch Solcast update in ' + time + ' minutes');
      let _this = this;
      setTimeout(async function() {
        _this.logger.write('Fetching Solcast Update now');
        let res = await _this.request();
        if (res.error) {
          _this.agility.addTask('updateSolcastData');
          _this.agility.taskFailed('updateSolcastData');
          _this.logger.write(JSON.stringify(res));
        }
        else {
          _this.persist(res);
          _this.lastUpdated = now.slotTimeText;
          _this.logger.write('Solcast data updated successfully');
        }
      }, time * 60000);
      return {status: 'Solcast update scheduled successfully'};
    }
    return {status: 'Solcast data not to be updated to this time'};
  }

  async updateNow() {
    this.logger.write('Fetching Solcast Update now');
    let res = await this.request();
    if (res.error) {
      // dont do anything else for now
    }
    else {
      this.persist(res);
    }
  }

  get lastUpdated() {
    return this.document.$('lastUpdated').value;
  }

  set lastUpdated(value) {
    this.document.$('lastUpdated').value = value;
  }


  persist(data) {
    this.predictions.delete();
    let totals = {};
    for (let record of data.forecasts) {
      let d = this.date.at(record.period_end);
      let timeIndex = d.timeIndex;
      let dateIndex = d.dateIndex;
      let kw = +record.pv_estimate;
      let kwh = kw / 2;
      if (!totals[dateIndex]) totals[dateIndex] = 0;
      totals[dateIndex] += kwh;
      let tot = totals[dateIndex];
      if (tot > 0) tot = tot.toFixed(4);
      this.predictions.$([dateIndex, timeIndex]).document = {
        kw: kw,
        kwh: kwh,
        total: tot,
        day: d.dayText,
        time: d.timeText,
        month: d.monthText
      };
    }
    let todayDateIndex = this.date.now().dateIndex;
    let _this = this;
    this.predictions.forEachChildNode(function(dateNode) {
      let dateIndex = dateNode.key;
      let d = _this.date.at(dateIndex);
      if (+dateIndex === +todayDateIndex && !_this.totals.$(dateIndex).exists) {
        let total = dateNode.lastChild.$('total').value;
        _this.totals.$(dateIndex).document = {
          total: total,
          month: d.monthText,
          day: d.dayText
        }
      }
      if (dateIndex > todayDateIndex) {
        _this.totals.$(dateIndex).delete();
        let total = dateNode.lastChild.$('total').value;
        _this.totals.$(dateIndex).document = {
          total: total,
          month: d.monthText,
          day: d.dayText
        }
      }
    });
  }

  get currentSlotPower() {
    let now = this.date.now();
    return this.predictions.$([now.dateIndex, now.slotTimeIndex, 'kwh']).value;
  }

  firstProductionTime() {
    let d = this.date.atMidnight(1); 
    // use tomorrow's data to ensure we have a full set of data
    let dateIndex = d.dateIndex;
    let timeIndex;
    this.predictions.$(dateIndex).forEachChildNode(function(timeNode) {
      if (timeNode.$('pv').value > 0) {
        timeIndex = timeNode.key;
        return false;
      }
    });
    if (timeIndex) {
      return this.date.at(timeIndex);
    }
    else {
      return false;
    }
  }

  expectedTotalPower() {
    let now = this.date.now();
    let todayDateIndex = now.dateIndex;
    let timeIndex = now.slotTimeIndex;
    let todaysPredictions = this.predictions.$(todayDateIndex);
    let total = 0;

    if (this.octopus.tomorrowsTariffsAvailable) {
      // get today's total estimated power from now until 23:30

      let pvAtStart = todaysPredictions.$([timeIndex, 'total']).value;
      let pvAtEnd = todaysPredictions.lastChild.$('total').value;
      total = pvAtEnd - pvAtStart;

      //  and add tomorrow's total estimated power from midnight until 22:30

      let tomorrowDateIndex = this.octopus.lastSlot.dateIndex;
      let d = this.date.atTime('22:30', tomorrowDateIndex);
      total += this.predictions.$([tomorrowDateIndex, d.timeIndex, 'total']).value;
    }
    else {
      // get today's total estimated power from now until 22:30

      console.log('tomorrows Octopus tariffs not yet available');

      let pvAtStart = todaysPredictions.$([timeIndex, 'total']).value;
      console.log('pvAtStart: ' + pvAtStart);
      let d = this.date.atTime('22:30');
      let pvAtEnd = this.predictions.$([todayDateIndex, d.timeIndex, 'total']).value;
      console.log('pvAtEnd: ' + pvAtEnd);
      total = pvAtEnd - pvAtStart;
    }
    // apply adjustment
    console.log('total: ' + total.toFixed(4));
    console.log('adjust by ' + this.adjustment + '%');
    total = total + ((total * this.adjustment) / 100);
    return total.toFixed(4);
  }

  expectedPowerBetween(fromTimeText, toTimeText) {
    let fromD = this.date.atTime(fromTimeText);
    let dateIndex = fromD.dateIndex;
    let fromTimeIndex = fromD.slotTimeIndex;
    let todaysPredictions = this.predictions.$(dateIndex);
    let total = 0;

    if (this.octopus.tomorrowsTariffsAvailable) {
      // get today's total estimated power from now until 23:30

      this.logger.write('Tomorrows Octopus Triffs available');
      this.logger.write('Get Solcast prediction from now until 23:30');
      this.logger.write('And also from midnight until 22:30 tomorrow');

      let pvAtStart = todaysPredictions.$([fromTimeIndex, 'total']).value;
      let pvAtEnd = todaysPredictions.lastChild.$('total').value;
      total = pvAtEnd - pvAtStart;
      this.logger.write('Prediction today: ' + total.toFixed(2));
      //  and add tomorrow's total estimated power from midnight until specified time

      let tomorrowDateIndex = this.octopus.lastSlot.dateIndex;
      let d = this.date.atTime(toTimeText, tomorrowDateIndex);
      let pv = +this.predictions.$([tomorrowDateIndex, d.timeIndex, 'total']).value;
      this.logger.write('Prediction tomorrow: ' + pv.toFixed(2));
      total += pv;
      this.logger.write('Total prediction: ' + total.toFixed(2));
    }
    else {
      // get today's total estimated power from now until 22:30
      this.logger.write('Get Solcast prediction from now until 22:30 today');
      let pvAtStart = +todaysPredictions.$([fromTimeIndex, 'total']).value;
      let d = this.date.atTime(toTimeText);
      let pvAtEnd = +todaysPredictions.$([d.slotTimeIndex, 'total']).value;
      total = pvAtEnd - pvAtStart;
      this.logger.write('Prediction today: ' + total.toFixed(2));
    }
    // apply adjustment
    total = total + ((total * this.adjustment) / 100);
    this.logger.write('Prediction after adjustment: ' + total.toFixed(2));
    return total.toFixed(4);
  }

  loadConfig(filepath) {
    filepath = filepath || './solcastConfig.json';
    try {
      let json = fs.readFileSync(filepath, { encoding: 'utf8', flag: 'r' });
      this.config.delete();
      this.config.document = JSON.parse(json);
      return true;
    }
    catch(err) {
      // config couldn't be set up
      return false;
    }
  }


  cleardown() {
    let noOfDaysToKeep = this.agility.movingAveragePeriod;
    let count = 0;
    let _this = this;
    this.predictions.forEachChildNode({direction: 'reverse'}, function(dateNode) {
      count++;
      if (count > noOfDaysToKeep) {
        _this.totals.$(dateNode.key).delete();
        dateNode.delete();
      }
    });
    this.logger.write('Solcast data cleared down to most recent ' + noOfDaysToKeep + ' days');
    this.calculateAdjustment();
  }

};

export {Solcast}