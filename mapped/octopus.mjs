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

 30 March 2025

*/

// https://api.octopus.energy/v1/products/AGILE-23-12-06/electricity-tariffs/E-1R-AGILE-23-12-06-J/standard-unit-rates/

let Octopus = class {

  constructor(agility) {
    let glsdb = agility.glsdb;
    this.config = agility.config.$('octopus');
    this.operation = agility.config.$('operation');
    this.tariffs = new glsdb.node('octopusAgile');
    this.byTime = this.tariffs.$('byTime');
    this.byPrice = this.tariffs.$('byPrice');
    this.customTariff = new glsdb.node('customTariff');
    this.date = agility.date;
    this.agility = agility;
    this.logger = agility.logger;
  }

  get isConfigured() {
    if (!this.config.exists) return false;
    if (this.customTariffEnabled) return true;
    let data = this.config.document;
    if (!data.url1) return false;
    if (!data.url2) return false;
    if (!data.zone) return false;
    //if (!data.username) return false;
    return true;
  }

  get url1() {
    return this.config.$('url1').value;
  }

  get url2() {
    return this.config.$('url2').value;
  }

  get zone() {
    return this.config.$('zone').value;
  }

  get username() {
    return this.config.$('username').value;
  }

  set username(value) {
    this.config.$('username').value = value;
  }

  get key() {
    return this.config.$('username').value;
  }

  set key(value) {
    this.config.$('username').value = value;
  }

  get accountId() {
    return this.config.$('accountId').value;
  }

  set accountId(value) {
    this.config.$('accountId').value = value;
  }

  get customTariffEnabled() {
    let node = this.config.$('customTariffEnabled');
    if (!node.exists) return false;
    return node.value;
  }

  enableCustomTariff() {
    if (!this.customTariff.exists) return false;
    this.config.$('customTariffEnabled').value = true;
    this.tariffs.delete();
    let _this = this;
    setTimeout(async function() {
      await _this.getLatestTariffTable();
    }, 100);
    /*
    if (this.date.now().hour > 15) {
      setTimeout(async function() {
        await _this.getLatestTariffTable();
      }, 300);
    }
    */
    return true;
  }

  disableCustomTariff() {
    this.config.$('customTariffEnabled').delete();
    this.tariffs.delete();
    let _this = this;
    setTimeout(async function() {
      await _this.getLatestTariffTable();
    }, 100);
  }

  get calculationCutoffTime() {
    let node = this.operation.$('calculationCutoffTime');
    if (!node.exists) return '22:30';
    return node.value;
  }

  set calculationCutoffTime(value) {
    this.operation.$('calculationCutoffTime').value = value;
  }

  async request(url, username) {
    let options = {
      method: 'GET',
      headers: {
        'Content-type': 'application/json'
      }
    };
    if (username && username !== '') {
      options.headers.Authorization = 'Basic ' + Buffer.from(username + ':', 'utf8').toString('base64');
    }
    let res = await fetch(url, options);
    try {
      let json = await res.json();
      return json;
    }
    catch(err) {
      return {
        error: 'API Request failed',
        err: err
      };
    }
  }

  async fetchTariff(offset) {
    if (this.customTariffEnabled) {
      offset = offset || 0;
      let json = {
        results: this.generateCustomAgileTariff(offset)
      };
      return json;
    }

    if (!this.config.exists) {
      return {error: 'Agility has not been configured to access Octopus Tariffs'};
    }
    else {
      let url = this.url1 + this.zone + this.url2;
      return await this.request(url, this.username);
    }
  }

  async generateUrlFields(accountId, key) {
    let url = 'https://api.octopus.energy/v1/accounts/' + accountId;
    let json = await this.request(url, key);
    if (json.error) {
      return json;
    }
    if (!json.properties) {
      return {
        error: 'Octopus did not return usable information for your account',
        json: json
      };
    }
    let now = this.date.now();
    let error;
    let stop = false;
    let results = {};
    for (let property of json.properties) {
      if (stop) break;
      if (property.moved_out_at === null) {
        for (let point of property.electricity_meter_points) {
          if (stop) break;
          if (!point.is_export) {
            for (let agreement of point.agreements) {
              let from = this.date.at(agreement.valid_from);
              if (from.timeIndex < now.timeIndex) {
                let to = this.date.at(agreement.valid_to);
                if (to.timeIndex > now.timeIndex) {
                  // what was the Agile product code at the from date?
                  let url = 'https://api.octopus.energy/v1/products/?available_at=' + agreement.valid_from + '&is_green=true';
                  let json = await this.request(url, key);
                  //console.log(json);
                  if (json.error) {
                    error = json;
                    stop = true;
                    break;
                  }
                  if (!json.results) {
                    error = {
                      error: 'Octopus did not return your tariff results',
                      json: json
                    };
                    stop = true;
                    break;
                  }
                  if (json.results) {
                    for (let tariff of json.results) {
                      if (tariff.direction === 'IMPORT' && tariff.brand === 'OCTOPUS_ENERGY' && tariff.code.includes('AGILE')) {
                        let product = tariff.code;
                        let dnoCode = agreement.tariff_code.slice(-1);
                        let url1 = 'https://api.octopus.energy/v1/products/' + product + '/electricity-tariffs/' + agreement.tariff_code.slice(0, -1);
                        let url2 = '/standard-unit-rates/';
                        results = {
                          dnoCode: dnoCode,
                          url1: url1,
                          url2: url2
                        };
                        stop = true;
                        break;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    if (error) {
      return error;
    }
    if (!results.dnoCode) {
      return {error: 'Unable to auto-generate URL fields'};
    }
    return results;
  }

  get isBefore4() {
    return this.date.now().hour < 16;
  }

  get dateIndexNow() {
    return this.date.atMidnight(0).timeIndex;
  }

  get dateIndexTomorrow() {
    if (this.customTariffEnabled) {
      return this.date.atMidnight(2).timeIndex;
    }
    else {
      return this.date.atMidnight(1).timeIndex;
    }
  }

  async getLatestTariffTable(offset) {
    offset = offset || 0;
    let json;
    if (this.isBefore4) {
      // has tariff already been saved for today?
      if (!this.byTime.$(this.dateIndexNow).exists) {
        json = await this.fetchTariff(offset);
      }
    }
    else {
      // has tariff already been saved for today?
      if (!this.byTime.$(this.dateIndexNow).exists) {
        json = await this.fetchTariff(offset);
      }
      else if (!this.byTime.$(this.dateIndexTomorrow).exists) {
        json = await this.fetchTariff(offset);
      }
    }
    if (json) {
      if (json.error) {
        return json;
      }
      if (!json.results || !Array.isArray(json.results)) {
        return {error: 'No results returned from Octopus'};
      }
      console.log(json);
      for (let slot of json.results) {
        let slotTime = this.date.at(slot.valid_from);
        let dateIndex = slotTime.dateIndex;
        let timeIndex = slotTime.timeIndex;
        let slotNode = this.byTime.$([dateIndex, timeIndex]);
        if (!slotNode.exists) {
          let startTimeStr = slotTime.timeText;
          let to_d = this.date.at(slot.valid_to);
          let endTimeStr = to_d.timeText;
          let price = +slot.value_inc_vat;
          slotNode.document = {
            start: startTimeStr,
            hour: slotTime.hourText,
            min: slotTime.minuteText,
            end: endTimeStr,
            endTimeIndex: to_d.timeIndex,
            price: price,
            day: slotTime.day,
            month: slotTime.month,
            timeIndex: timeIndex,
            dateIndex: dateIndex
          }
        }
      }
      return {status: 'Octopus Tariff Table fetched and updated'}
    }
    else {
      return {status: 'Tariff Table already up to date'}
    }
  }

  get lastSlot() {
    if (this.byTime.exists) {
      let lc = this.byTime.lastChild;
      if (lc && lc.exists) {
        let lc2 = lc.lastChild;
        if (lc2 && lc2.exists) {
          return lc2.document;
        }
      }
    }
    return;
  }

  get tomorrowsTariffsAvailable() {
    let lastSlot = this.lastSlot;
    if (lastSlot && +this.date.now().dateIndex < +lastSlot.dateIndex) return true;
    return false;
  }

  get priceNow() {
    let d = this.date.now();
    return this.byTime.$([d.dateIndex, d.slotTimeIndex, 'price']).value;
  }

  getPriceAt(timeStr, offset) {
    offset = offset || 0;
    timeStr = timeStr || '00:00';
    let d = this.date.atTime(timeStr, dateIndex);
    return this.byTime.$([d.dateIndex, d.timeIndex, 'price']).value;
  }

  sortSlots(to) {
    to = to || '18:00';
    this.byPrice.delete();
    let now = this.date.now();
    let dateIndex = now.dateIndex;
    let timeIndex = now.slotTimeIndex;
    let _this = this;

    function addToSortIndex(timeNode) {
      let price = +timeNode.$('price').value;
      let dateIndex = timeNode.$('dateIndex').value;
      let priceIndex = +(price * 100).toFixed(2);
      let time = timeNode.$('start').value;
      let day = timeNode.$('day').value;
      let timeIndex = timeNode.key;
      _this.byPrice.$([priceIndex, dateIndex, timeIndex]).document = {
        time: time,
        day: day,
        price: price
      };
    }

    if (!this.byTime.exists) {
      return;
    }

    if (this.tomorrowsTariffsAvailable) {
      console.log('tomorrows tariffs available');
      // use todays slots from now until 23:30 and tomorrows from midnight until to time (default 18:00)
      this.byTime.$(dateIndex).forEachChildNode({from: timeIndex}, function(timeNode) {
        addToSortIndex(timeNode);
      });
      let tomorrow = this.date.atMidnight(1);
      //let toTimeIndex = this.date.atTime(to, this.lastSlot.dateIndex).timeIndex;
      let toTimeIndex = this.date.atTime(to, tomorrow.dateIndex).timeIndex;
      console.log('toTimeIndex: ' + toTimeIndex);
      //this.byTime.$(this.lastSlot.dateIndex).forEachChildNode({to: toTimeIndex}, function(timeNode) {
      this.byTime.$(tomorrow.dateIndex).forEachChildNode({to: toTimeIndex}, function(timeNode) {
        addToSortIndex(timeNode);
      });
    }
    else {
     // use todays slots from now until to time (default 18:00)
      console.log('tomorrows tariffs not yet available');
      let toTimeIndex = this.date.atTime(to).timeIndex;
      console.log('toTimeIndex: ' + toTimeIndex);
      this.byTime.$(this.lastSlot.dateIndex).forEachChildNode({from: timeIndex, to: toTimeIndex}, function(timeNode) {
        addToSortIndex(timeNode);
      });
    }
  }

  get cheapestSlotArray() {
    let arr = [];
    let _this = this;
    this.byPrice.forEachChildNode(function(priceNode) {
      priceNode.forEachChildNode(function(dateNode) {
        let dateIndex = dateNode.key;
        dateNode.forEachChildNode(function(timeNode) {
          let timeText = _this.date.at(timeNode.key).timeText;
          arr.push({
            dateIndex: dateIndex,
            timeIndex: timeNode.key,
            timeText: timeText,
            price: timeNode.$('price').value
          });
        });
      });
    });
    return arr;
  }

  getEarliestSlotToUse(noOfSlots) {
    console.log('calculating earliest slot of ' + noOfSlots);
    // includes slots under always use price
    this.sortSlots();
    let slots = this.cheapestSlotArray;
    console.log(JSON.stringify(slots));
    let count = 0;
    let currentSlot = this.date.now().slotTimeIndex;
    console.log('current slot timeIndex: ' + currentSlot);
    let alwaysUsePrice = this.agility.alwaysUsePrice;
    let earliestSlot = 9999999999999;
    for (let slot of slots) {
      count++;
      console.log('count: ' + count + '; timeIndex: ' + slot.timeIndex);
      if (slot.timeIndex > currentSlot) {
        if (slot.price <= alwaysUsePrice) {
          if (slot.timeIndex < earliestSlot) {
            earliestSlot = slot.timeIndex;
            let d = this.date.at(slot.timeIndex);
            console.log('slot under always buy price');
            console.log('slot: ' + d.timeText + ': price: ' + slot.price + 'updated earliest slot');
          }
        }
        else {
          if (count <= noOfSlots && slot.timeIndex < earliestSlot) {
            earliestSlot = slot.timeIndex;
            let d = this.date.at(slot.timeIndex);
            console.log('slot over always buy price');
            console.log('slot: ' + d.timeText + ': price: ' + slot.price + 'updated earliest slot');
          }
        }
      }
    }
    return earliestSlot;
  }

  useCurrentSlotOf(noOfCheapSlots) {
    noOfCheapSlots = noOfCheapSlots || 0;
    noOfCheapSlots = + noOfCheapSlots;
    let useSlot = false;
    if (noOfCheapSlots > 0) {
      // get cheapest slots in price order up to default time of 18:00
      this.sortSlots();
      let slots = this.cheapestSlotArray;
      let now = this.date.now();
      let count = 0;
      for (let slot of slots) {
        count++
        let d = this.date.at(slot.timeIndex);
        this.logger.write('Slot ' + count + ': ' + d.dayText + '/' + d.monthText + '/' + d.year + ': ' + d.timeText + ': ' + slot.price);
        if (+slot.dateIndex === +now.dateIndex && +slot.timeIndex === +now.slotTimeIndex) {
          return true;
        }
        if (count === noOfCheapSlots) break;
      }
      return false;
    }
    return  false;
  }

  get noOfAlwaysBuySlots() {
    this.sortSlots();
    let slots = this.cheapestSlotArray;
    let noOfAlwaysBuySlots = 0;
    let alwaysUsePrice = this.agility.alwaysUsePrice;
    for (let slot of slots) {
      if (slot.price <= alwaysUsePrice) {
        noOfAlwaysBuySlots++;
      }
    }
    return noOfAlwaysBuySlots;
  }

  get noOfUnmatchedAlwaysBuySlots() {
    this.sortSlots();
    let slots = this.cheapestSlotArray;
    let noOfUnmatchedAlwaysBuySlots = 0;
    let alwaysUsePrice = this.agility.alwaysUsePrice;
    for (let slot of slots) {
      if (slot.price <= alwaysUsePrice) {
        if (!this.isAlwaysBuySlotMatched(slot.dateIndex, slot.timeIndex)) {
          noOfUnmatchedAlwaysBuySlots++;
        }
      }
    }
    return noOfUnmatchedAlwaysBuySlots;
  }

  matchAlwaysBuySlot(dateIndex, timeIndex) {
    this.byTime.$([dateIndex, timeIndex, 'matched']).value = true;
  }

  isAlwaysBuySlotMatched(dateIndex, timeIndex) {
    return this.byTime.$([dateIndex, timeIndex, 'matched']).exists;
  }

  get firstUnmatchedAlwaysBuySlot() {
    this.sortSlots();
    let slots = this.cheapestSlotArray;
    let alwaysUsePrice = this.agility.alwaysUsePrice;
    for (let slot of slots) {
      if (slot.price <= alwaysUsePrice) {
        if (!this.isAlwaysBuySlotMatched(slot.dateIndex, slot.timeIndex)) {
          return slot;
        }
      }
    }
    return false;
  }

  getCustomTariff() {
    let prices = [];
    if (this.customTariff.exists) {
      this.customTariff.forEachChildNode(function(hrNode) {
        prices.push(hrNode.document);
      });
    }
    return {
      prices: prices,
      cutoff: this.calculationCutoffTime
    };
  }

  saveCustomTariff(pricesArr) {
    this.customTariff.delete();
    for (let record of pricesArr) {
      this.customTariff.$(record.hour).document = record;
    }
  }

  generateCustomAgileTariff(offset) {
    offset = offset || 0;
    let _this = this;
    function createData(timeText, offset, price) {
      let d = _this.date.atTime(timeText, offset);
      let tz = 'Z';
      if (d.daylightSaving) tz = '+01:00';
      let from = d.year + '-' + d.monthText + '-' + d.dayText + 'T' + d.timeText + ':00' + tz;
      let d2 = _this.date.at(d.slotEndTimeIndex);
      let to = d2.year + '-' + d2.monthText + '-' + d2.dayText + 'T' + d2.timeText + ':00' + tz;

      return {
        value_inc_vat: price,
        valid_from: from,
        valid_to: to
      };
    }

    let cutoffTime = this.calculationCutoffTime;
    let cutoffHour = cutoffTime.split(':')[0];

    let now = this.date.now();
    let arr = [];

    // tariffs for now until midnight tonight

    let timeIndex = this.date.atMidnight(offset).timeIndex;
    for (let hour = now.hour; hour < 24; hour++) {
      let hrText = hour.toString();
      if (hour < 10) hrText = '0' + hrText;
      let price = this.customTariff.$([hour, 'price']).value;
      let time = hrText + ':00';
      arr.push(createData(time, timeIndex, price));
      time = hrText + ':30';
      arr.push(createData(time, timeIndex, price));
    }

    // tariffs for all tomorrow

    timeIndex = this.date.atMidnight(offset + 1).timeIndex;
    for (let hour = 0; hour < 24; hour++) {
      let hrText = hour.toString();
      if (hour < 10) hrText = '0' + hrText;
      let price = this.customTariff.$([hour, 'price']).value;
      let time = hrText + ':00';
      arr.push(createData(time, timeIndex, price));
      time = hrText + ':30';
      arr.push(createData(time, timeIndex, price));
    }


    // tariffs until cutoff time next day

    timeIndex = this.date.atMidnight(offset + 2).timeIndex;
    for (let hour = 0; hour < cutoffHour; hour++) {
      let hrText = hour.toString();
      if (hour < 10) hrText = '0' + hrText;
      let price = this.customTariff.$([hour, 'price']).value;
      let time = hrText + ':00';
      arr.push(createData(time, timeIndex, price));
      time = hrText + ':30';
      arr.push(createData(time, timeIndex, price));
    }

    this.logger.write('Custom tariff update generated');

    return arr;
  }

  cleardown() {
    let noOfDaysToKeep = this.agility.movingAveragePeriod;
    let count = 0;
    this.byTime.forEachChildNode({direction: 'reverse'}, function(dateNode) {
      count++;
      if (count > noOfDaysToKeep) {
        dateNode.delete();
      }
    });
    this.logger.write('Octopus data cleared down to most recent ' + noOfDaysToKeep + ' days');
  }

};

export {Octopus};

