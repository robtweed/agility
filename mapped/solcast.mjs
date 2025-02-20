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
    this.updateTimes = ['02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '18:00', '21:00', '23:00'];
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

  get isAutoAdjustEnabled() {
    if (!this.config.$('autoAdjust').exists) {
      return false;
    }
    return this.config.$('autoAdjust').value;
  }

  enableAutoAdjust() {
    this.config.$('autoAdjust').value = 'true';
  }

  disableAutoAdjust() {
    this.config.$('autoAdjust').delete();
  }


  calculateAdjustment() {

    if (!this.isAutoAdjustEnabled) return;

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
        let solisRecord = _this.solis.$(dateIndex);
        if (solisRecord.exists) {
          count++;
          let predictedTotal = dateNode.$('total').value;
          totalP += predictedTotal;
          let actualTotal = solisRecord.lastChild.$('pvOutputTotal').value;
          //console.log(d.dayText + '/' + d.monthText + ': predicted: ' + predictedTotal + '; actual: ' + actualTotal);
          totalA += actualTotal;
        }
      }
    });

    if (count > 1) {
      let diff = ((totalA - totalP) / totalP) * 100;
      //console.log('percent difference: ' + diff);
      this.adjustment = diff;
    }
  }

  get predictionHistory() {
    let _this = this;
    let history = [];
    let todayDateIndex = this.date.now().dateIndex;
    this.totals.forEachChildNode(function(dateNode) {
      if (dateNode.key < todayDateIndex) {
        let solisRecord = _this.solis.$(dateNode.key);
        if (solisRecord.exists) {
          let data = dateNode.document;
          let date = data.day + '/' + data.month;
          let prediction = data.total;
          let lastSolisRecord = solisRecord.lastChild;
          let actualPV = lastSolisRecord.$('pvOutputTotal').value;
          //console.log('dateIndex: ' + dateNode.key);
          //console.log('prediction: ' + prediction);
          //console.log('actual: ' + actualPV);
          history.push({
            date: date,
            prediction: prediction,
            actual: actualPV
          });
        }
      }
    });
    return history;
  }

  async request() {
    if (!this.isConfigured) {
      return {
        error: 'Solcast configuration is incomplete'
      };
    }

    if (!this.isEnabled) {
      return {
        error: 'Solcast is not enabled for use with Agility'
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
      return {
        error: 'Request for Solcast Data failed',
        status: res.status,
        statusText: res.statusText
      };
    }
    if (res.status !== 200) {
      return {
        error: 'Solcast returned status code ' + res.status
      };
    }
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
          let status = _this.persist(res);
          if (status) {
            _this.lastUpdated = now.slotTimeText;
            _this.logger.write('Solcast data updated successfully');
          }
          else {
            _this.logger.write('Solcast data could not be updated. Request limit may have been exceeded');
          }
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
    if (!data) return false;
    if (typeof data !== 'object') {
      if (typeof data === 'string') this.logger.write('Error fetching Solcast update: ' + data);
      return false;
    }
    this.predictions.delete();
    let totals = {};
    let totals_10 = {};
    let totals_50 = {};
    let totals_90 = {};
    for (let record of data.forecasts) {
      let d = this.date.at(record.period_end);
      let timeIndex = d.timeIndex;
      let dateIndex = d.dateIndex;
      let kw = +record.pv_estimate;
      let kwh = kw / 2;
      let pv_10 = +record.pv_estimate10;
      let pv_10kwh = pv_10 / 2;
      let pv_50 = +record.pv_estimate;
      let pv_50kwh = pv_50 / 2;
      let pv_90 = +record.pv_estimate90;
      let pv_90kwh = pv_90 / 2;
      if (!totals[dateIndex]) totals[dateIndex] = 0;
      totals[dateIndex] += kwh;
      if (!totals_10[dateIndex]) totals_10[dateIndex] = 0;
      totals_10[dateIndex] += pv_10kwh;
      if (!totals_50[dateIndex]) totals_50[dateIndex] = 0;
      totals_50[dateIndex] += pv_50kwh;
      if (!totals_90[dateIndex]) totals_90[dateIndex] = 0;
      totals_90[dateIndex] += pv_90kwh;
      let tot = totals[dateIndex];
      if (tot > 0) tot = tot.toFixed(4);
      let tot_10 = totals_10[dateIndex];
      if (tot_10 > 0) tot_10 = tot_10.toFixed(4);
      let tot_50 = totals_50[dateIndex];
      if (tot_50 > 0) tot_50 = tot_50.toFixed(4);
      let tot_90 = totals_90[dateIndex];
      if (tot_90 > 0) tot_90 = tot_90.toFixed(4);
      this.predictions.$([dateIndex, timeIndex]).document = {
        kwh: kwh,
        pv_10kwh: pv_10kwh,
        pv_50kwh: pv_50kwh,
        pv_90kwh: pv_90kwh,
        total: tot,
        total_10: tot_10,
        total_50: tot_50,
        total_90: tot_90,
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
      /*
      if (+dateIndex === +todayDateIndex && !_this.totals.$(dateIndex).exists) {
        let total = dateNode.lastChild.$('total').value;
        _this.totals.$(dateIndex).document = {
          total: total,
          month: d.monthText,
          day: d.dayText
        }
      }
      */
      if (dateIndex > todayDateIndex) {
        _this.totals.$(dateIndex).delete();
        let total = dateNode.lastChild.$('total').value;
        let total_10 = dateNode.lastChild.$('total_10').value;
        let total_50 = dateNode.lastChild.$('total_50').value;
        let total_90 = dateNode.lastChild.$('total_90').value;
        _this.totals.$(dateIndex).document = {
          total: total,
          total_10: total_10,
          total_50: total_50,
          total_90: total_90,
          month: d.monthText,
          day: d.dayText
        }
      }
    });
    return true;
  }

  get currentSlotPower() {
    let now = this.date.now();
    return this.predictions.$([now.dateIndex, now.slotTimeIndex, 'kwh']).value;
  }

  get firstProductionTime() {
    let d = this.date.atMidnight(1); 
    // use tomorrow's data to ensure we have a full set of data
    let dateIndex = d.dateIndex;
    let timeIndex;
    this.predictions.$(dateIndex).forEachChildNode(function(timeNode) {
      if (+timeNode.$('kwh').value > 0) {
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

      if (todaysPredictions.exists) {
        let pvAtStart = todaysPredictions.$([timeIndex, 'total']).value;
        let pvAtEnd = todaysPredictions.lastChild.$('total').value;
        total = pvAtEnd - pvAtStart;
      }

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

  expectedPowerBetween(fromTimeText, toTimeText, override, adjust, log) {
    if (typeof adjust === 'undefined') adjust = true;
    if (typeof log === 'undefined') log = true;
    // override for now
    log = false;
    //
    let fromD = this.date.atTime(fromTimeText);
    let dateIndex = fromD.dateIndex;
    let fromTimeIndex = fromD.slotTimeIndex;
    let todaysPredictions = this.predictions.$(dateIndex);
    //this.logger.write('Solcast expectedPowerBetween: fromTimeText = ' + fromTimeText);
    //this.logger.write('Solcast expectedPowerBetween: toTimeText = ' + toTimeText);
    //this.logger.write('Solcast expectedPowerBetween: dateIndex = ' + dateIndex);
    let total = 0;

    if (!override && this.octopus.tomorrowsTariffsAvailable) {
      // get today's total estimated power from now until 23:30

      if (log) {
        this.logger.write('Tomorrows Octopus Tariffs available');
        this.logger.write('Get Solcast prediction from now until 23:30');
        this.logger.write('And also from midnight until 22:30 tomorrow');
      }
      if (todaysPredictions.exists) {
        let pvAtStart = todaysPredictions.$([fromTimeIndex, 'total']).value;
        let pvAtEnd = todaysPredictions.lastChild.$('total').value;
        total = pvAtEnd - pvAtStart;
        if (log) this.logger.write('Prediction today: ' + total.toFixed(2));
      }
      else {
        if (log) this.logger.write('Solcast predictions for today are not yet available');
      }

      //  and add tomorrow's total estimated power from midnight until specified time

      let tomorrowDateIndex = this.octopus.lastSlot.dateIndex;
      let d = this.date.atTime(toTimeText, tomorrowDateIndex);
      let pv = +this.predictions.$([tomorrowDateIndex, d.timeIndex, 'total']).value;
      if (log) this.logger.write('Prediction tomorrow: ' + pv.toFixed(2));
      total += pv;
      if (log) this.logger.write('Total prediction: ' + total.toFixed(2));
    }
    else {
      // get today's total estimated power from now until end time
      if (log) this.logger.write('Get Solcast prediction from ' + fromTimeText + ' until ' + toTimeText + ' today');
      let pvAtStart = +todaysPredictions.$([fromTimeIndex, 'total']).value;
      console.log('Solcast predictions from ' + fromTimeText + ' until ' + toTimeText + ' today');
      console.log('fromTimeIndex: ' + fromTimeIndex + '; pvAtStart: ' + pvAtStart);
      let d = this.date.atTime(toTimeText);
      let pvAtEnd = +todaysPredictions.$([d.slotTimeIndex, 'total']).value;
      console.log('d.slotTimeIndex: ' + d.slotTimeIndex + '; pvAtEnd: ' + pvAtEnd);
      total = pvAtEnd - pvAtStart;
      if (log) this.logger.write('Prediction: ' + total.toFixed(2));
    }
    // apply adjustment
    if (adjust) {
      console.log('applyimng adjustment');
      total = total + ((total * this.adjustment) / 100);
      if (log) this.logger.write('Prediction after adjustment: ' + total.toFixed(2));
    }
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
    // this.predictions always only contains latest data and up to 2 days ahead
    let noOfDaysToKeep = this.agility.movingAveragePeriod + 2; // allows for an extra 2 days ahead of predictions
    let count = 0;
    let _this = this;
    this.totals.forEachChildNode({direction: 'reverse'}, function(dateNode) {
      count++;
      if (count > noOfDaysToKeep) {
        dateNode.delete();
      }
    });
    this.logger.write('Solcast data cleared down to most recent ' + noOfDaysToKeep + ' days');
    if (this.isAutoAdjustEnabled) {
      this.calculateAdjustment();
    }
  }

};

export {Solcast}
