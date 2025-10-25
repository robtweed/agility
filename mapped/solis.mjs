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

 10 April 2025

 */

import { createHash, createHmac } from 'crypto';
import {Battery} from './battery.mjs';

class Solis {

  constructor(agility) {
    this.config = agility.config.$('solisCloud');
    this.logger = agility.logger;
    this.date = agility.date;
    let glsdb = agility.glsdb;
    this.data = new glsdb.node('solis');
    this.agility = agility;
    this.battery = new Battery(agility);
    this.chargeHistory = new glsdb.node('agilityChargeHistory');
    this.octopusAgile = new glsdb.node('octopusAgile.byTime');
  }

  get isConfigured() {
    if (!this.config.exists) return false;
    let data = this.config.document;
    if (!data.inverterSn) {
      this.logger.write('InverterSn not set in SolisCloud configuration');
      return false;
    }
    if (!data.key) {
      this.logger.write('Key not set in SolisCloud configuration');
      return false;
    }
    if (!data.secret) {
      this.logger.write('Secret not set in SolisCloud configuration');
      return false;
    }
    return true;
  }

  get endpoint() {
    if (!this.config.$('endpoint').exists) {
      return 'https://www.soliscloud.com:13333';
    }
    return this.config.$('endpoint').value;
  }

  set endpoint(value) {
    this.config.$('endpoint').value = value;
  }

  get inverterSn() {
    return this.config.$('inverterSn').value;
  }

  set inverterSn(value) {
    this.config.$('inverterSn').value = value;
  }

  get key() {
    return this.config.$('key').value.toString();
  }

  set key(value) {
    this.config.$('key').value = value;
  }

  get secret() {
    return this.config.$('secret').value;
  }

  set secret(value) {
    this.config.$('secret').value = value;
  }

  async getFirmwareVersion() {
    let node = this.config.$('firmwareVersion');
    if (!node.exists) {
      let ok = await this.setFirmwareVersion();
      if (!ok) return 'Unknown';
    }
    return node.value;
  }

  async setFirmwareVersion() {
    let url = '/v1/api/inverterDetail';
    let body = {
      sn: this.inverterSn
    };
    let res = await this.api(url, body);
    if (res && res.data && res.data.stationId) {
      let stationId = res.data.stationId;
      url = '/v1/api/inverterList';
      body = {
        stationId: stationId
      };
      res = await this.api(url, body);
      if (res && res.data && res.data.page && res.data.page.records) {
        let found = false;
        let firmwareVersion;
        for (let record of res.data.page.records) {
          if (record.inverterSoftwareVersion) {
            firmwareVersion = record.inverterSoftwareVersion.toUpperCase();
            break;
          }
        }
        if (firmwareVersion) {
          let version = 'pre-4B00';
          if (firmwareVersion.startsWith('4')) {
            let c2Ascii = firmwareVersion.charCodeAt(1);
            if (c2Ascii >= 66) version = 'post-4B00';
          }
          this.config.$('firmwareVersion').value = version;
          return true;
        }
      }
    }
    return false;
  }

  get keepInverterTimeSynchronised() {
    if (!this.config.$('keepInverterTimeSynchronised').exists) return false;
    return this.config.$('keepInverterTimeSynchronised').value;
  }

  set keepInverterTimeSynchronised(value) {
    this.config.$('keepInverterTimeSynchronised').value = value;
  }

  get chargeCurrent() {
    if (!this.agility.config.$(['battery', 'chargeCurrent']).exists) return 50;
    return +this.agility.config.$(['battery', 'chargeCurrent']).value;
  }

  set chargeCurrent(value) {
    return this.agility.config.$(['battery', 'chargeCurrent']).value;
  }

  get dischargeCurrent() {
    if (!this.agility.config.$(['battery', 'dischargeCurrent']).exists) return 50;
    return +this.agility.config.$(['battery', 'dischargeCurrent']).value;
  }

  set dischargeCurrent(value) {
    return this.agility.config.$(['battery', 'dischargeCurrent']).value;
  }

  get productionDelay() {
    if (!this.agility.config.$(['battery', 'productionDelay']).exists) return 7200000;
    return +this.agility.config.$(['battery', 'productionDelay']).value;
  }

  set productionDelay(value) {
    this.agility.config.$(['battery', 'productionDelay']).value = value
  }

  get availableDataDates() {
    let arr = [];
    let _this = this;
    this.data.forEachChildNode({direction: 'reverse'}, function(dateNode) {
      let dateIndex = +dateNode.key;
      let d = _this.date.at(dateIndex);
      arr.push({
        dateIndex: dateIndex,
        date: d.dayText + '/' + d.monthText + '/' + d.year
      });
    });
    return arr;
  }

  getHistory(dateIndex) {
    let dateNode = this.data.$(dateIndex);
    if (!dateNode.exists) {
      return false;
    }
    let history = [];
    let timeIndex = +dateIndex;
    let sum = {
      houseLoadTotal: 0,
      gridExportTotal: 0,
      gridImportTotal: 0,
      pvOutputTotal: 0

    };
    let now = this.date.now();
    for (let i = 0; i < 47; i++) {
      timeIndex += 1800000;
      if (timeIndex > now.timeIndex) break;
      let timeText = this.date.at(timeIndex).timeText;
      let data = this.powerAt(dateIndex, timeIndex);
      data.time = timeText;
      let agileNode = this.octopusAgile.$([dateIndex, timeIndex]);
      let price = 'not available';
      if (agileNode.exists) {
        price = agileNode.$('price').value;
      }
      data.price = price;
      for (let name in sum) {
        let value = data[name] + 0;
        data[name] = +(value - sum[name]).toFixed(2);
        sum[name] = value;
      }
      history.push(data);
    }
    return history;
  }

  md5(data) {
    return createHash("md5").update(data).digest('base64');
  }

  stringToSign(body, url, method, contentType, date) {
    method = method || 'POST';
    date = date || new Date().toUTCString();
    contentType = contentType || 'application/json;charset=UTF-8';
    let data = body;
    if (typeof body === 'object') {
      data = JSON.stringify(body);
    }
    const lf = '\n'
    let md5 = this.md5(data);
    let str = method + lf + md5 + lf + contentType + lf + date + lf + url;
    return {
      stringToSign: str,
      md5: md5
    }
  }

  signature(stringToSign, secretKey) {
    return createHmac('sha1', secretKey).update(stringToSign).digest('base64');
  }

  async request(args) {
    args = args || {};
    if (!args.url) {
      this.logger.write('solis.request aborted: url not specified');
      return;
    }
    let url = this.endpoint + args.url;
    let method = args.method || 'POST';
    let options = {
      method: method,
      headers: {
        'Content-type': 'application/json;charset=UTF-8'
      }
    };
    if (args.headers) {
      for (let name in args.headers) {
        options.headers[name] = args.headers[name];
      }
    }
    if (args.date) {
      options.headers.Time = args.date;
    }
    if (args.auth) {
      options.headers.Authorization = args.auth;
    }
    if (args.md5) {
      options.headers['Content-Md5'] = args.md5;
    }
    if (args.body) {
      options.body = JSON.stringify(args.body);
      options.headers['Content-Length'] = options.body.length;
    }
    this.logger.write('solis.request at ' + new Date().toUTCString() + ': ' + url);
    this.logger.write('options: ' + JSON.stringify(options));
    try {
      let res = await fetch(url, options);
      if (res.status !== 200) {
        this.logger.write('solis.request failed: status: ' + res.status);
        return {
          error: 'solis.request returned status ' + res.status
        }
      }
      let json = await res.json();
      /*
      if (url.endsWith('/atRead') || url.endsWith('/control')) {
        console.log('solis.request response:')
        console.log(JSON.stringify(json, null, 2));
      }
      */
      this.logger.write('solis.request successful');
      return json;
    }
    catch(err) {
      console.log(err);
      return {
        error: 'solis.request failed',
        err: err
      };
    }
  }

  async api(url, payload, method) {
    method = method || 'POST';
    let date = new Date().toUTCString();
    let sts = this.stringToSign(payload, url, method,'application/json', date);
    let auth = 'API ' + this.key + ':' + this.signature(sts.stringToSign, this.secret);
    let resp = await this.request({
      url: url, 
      method: method, 
      body: payload, 
      date: date, 
      headers: {}, 
      auth: auth, 
      md5: sts.md5
    });
    return resp;
  }

  async inverterDayAPI(offset) {

    if (!this.isConfigured) {
      return {
        error: 'SolisCloud credentials are incomplete'
      };
    }
 
    offset = offset || 0;
    let d = this.date.atMidnight(offset);
    let time = `${d.year}-${d.monthText}-${d.dayText}`;
    let url = '/v1/api/inverterDay';
    let tz = 0;
    if (d.daylightSaving) tz = 1;
    let body ={
      sn: this.inverterSn,
      money: 'UKP',
      time: time,
      timeZone: tz
    };
    let resp = await this.api(url, body);
    if (!resp.error) {
      if (!resp.data || !Array.isArray(resp.data)) {
        this.logger.write('solis.inverterDay API failed');
        console.log('solis.inverterDay API Response:');
        console.log(JSON.stringify(resp, null, 2));
        return {error: 'solis.inverterDay API failed'};
      }
    }
    return resp;
  }

  async atReadAPI() {
    let url = '/v2/api/atRead';
    let body ={
      inverterSn: this.inverterSn,
      cid: 4643
    };
    let resp = await this.api(url, body);
    if (resp.error) {
      return resp;
    }
    if (!resp.data || typeof resp.data === 'string') {
      this.logger.write('solis.atRead API failed (1)');
      console.log(JSON.stringify(resp, null, 2));
      return {error: 'solis.atRead API failed (1)'};
    }
    if (!resp.data.msg) {
      this.logger.write('solis.atRead API failed (2)');
      console.log(JSON.stringify(resp, null, 2));
      return {error: 'solis.atRead API failed (2)'};
    }
    if (!resp.data.yuanzhi) {
      this.logger.write('solis.atRead API failed (3)');
      console.log(JSON.stringify(resp, null, 2));
      return {error: 'solis.atRead API failed (3)'};
    }
    let yuanzhi = resp.data.yuanzhi;
    if (yuanzhi.slice(0, 4) === 'fail') {
      this.logger.write('solis.atRead API failed (4)');
      console.log(JSON.stringify(resp, null, 2));
      return {error: 'solis.atRead API failed (4)'};
    }
    if (yuanzhi.slice(0, 5) === 'error') {
      this.logger.write('solis.atRead API failed (5)');
      console.log(JSON.stringify(resp, null, 2));
      return {error: 'solis.atRead API failed (5)'};
    }
    return resp;
  }

  async controlAPI(cid, value) {
    let url = '/v2/api/control';
    let body ={
      inverterSn: this.inverterSn,
      cid: cid,
      value: value
    };
    return await this.api(url, body);
  }

  async chargeAPI(chargeTimeString) {
    let resp = await this.controlAPI(4643, chargeTimeString);
    if (resp.error) {
      return resp;
    }
    if (!resp.data) {
      this.logger.write('Solis charge API failed');
      console.log(JSON.stringify(resp, null, 2));
      return {error: 'Solis charge API failed'};
    }
    return resp;
  }

  async dischargeAPI(dischargeTimeString) {
    let resp = await this.controlAPI(4643, dischargeTimeString);
    if (resp.error) {
      return resp;
    }
    if (!resp.data) {
      this.logger.write('Solis discharge API failed');
      console.log(JSON.stringify(resp, null, 2));
      return {error: 'Solis discharge API failed'};
    }
    return resp;
  }

  async setTimeNowAPI() {
    let d = this.date.now();
    let value = d.year + '-' + d.monthText + '-' + d.dayText + ' ' + d.fullTimeText; 
    let resp = await this.controlAPI(56, value);
    console.log('Solis setTime API response:');
    console.log(JSON.stringify(resp, null, 2));
    return resp;
  }

  chargeTimeString(currentSetting, fromTimeText, toTimeText) {
    let pcs = currentSetting.split(',');
    pcs[0] = this.chargeCurrent;
    pcs[1] = 0;
    pcs[2] = fromTimeText + '-' + toTimeText;
    pcs[3] = '00:00-00:00';
    pcs[6] = '00:00-00:00';
    pcs[10] = '00:00-00:00';
    return pcs.join(',');
  }

  dischargeTimeString(currentSetting, fromTimeText, toTimeText) {
    let pcs = currentSetting.split(',');
    pcs[0] = 0;
    pcs[1] = this.dischargeCurrent;
    pcs[2] = '00:00-00:00';
    pcs[3] = fromTimeText + '-' + toTimeText;
    pcs[6] = '00:00-00:00';
    pcs[10] = '00:00-00:00';
    return pcs.join(',');
  }

  gridOnlyTimeString(currentSetting, fromTimeText, toTimeText) {
    let pcs = currentSetting.split(',');
    pcs[0] = 0;
    pcs[1] = 0;
    pcs[2] = '00:00-00:00';
    pcs[3] = fromTimeText + '-' + toTimeText;
    pcs[6] = '00:00-00:00';
    pcs[10] = '00:00-00:00';
    return pcs.join(',');
  }


  resetTimeString(currentSetting) {
    let pcs = currentSetting.split(',');
    pcs[0] = 0;
    pcs[1] = 0;
    pcs[2] = '00:00-00:00';
    pcs[3] = '00:00-00:00';
    pcs[6] = '00:00-00:00';
    pcs[10] = '00:00-00:00';
    return pcs.join(',');
  }

  async post4B00Charge(fromTimeText, toTimeText, current) {
    // set current as required, SOC to 100, time period as specified
    current = current || this.chargeCurrent;
    let resp = await this.controlAPI(5948, current);
    if (resp.error) {
      return resp;
    }
    if (!resp.data) {
      this.logger.write('Solis charge current setting 5948 API failed');
      console.log(JSON.stringify(resp, null, 2));
      return {error: 'Solis charge current setting 5948 API failed'};
    }
    resp = await this.controlAPI(5928, 100);
    if (resp.error) {
      return resp;
    }
    if (!resp.data) {
      this.logger.write('Solis charge SOC setting 5928 API failed');
      console.log(JSON.stringify(resp, null, 2));
      return {error: 'Solis charge SOC setting 5928 API failed'};
    }
    resp = await this.controlAPI(5946, fromTimeText + '-' + toTimeText);
    if (resp.error) {
      return resp;
    }
    if (!resp.data) {
      this.logger.write('Solis charge setting 5946 API failed');
      console.log(JSON.stringify(resp, null, 2));
      return {error: 'Solis charge setting 5946 API failed'};
    }
    return {status: 'Inverter successfully set to charge between ' + fromTimeText + ' and ' + toTimeText};
  }

  async post4B00Discharge(fromTimeText, toTimeText, current) {
    // set current as required, SOC to zero, time period as specified
    current = current || this.dischargeCurrent;
    let resp = await this.controlAPI(5967, current);
    if (resp.error) {
      return resp;
    }
    if (!resp.data) {
      this.logger.write('Solis discharge current setting 5967 API failed');
      console.log(JSON.stringify(resp, null, 2));
      return {error: 'Solis discharge current setting 5967 API failed'};
    }
    resp = await this.controlAPI(5965, 0);
    if (resp.error) {
      return resp;
    }
    if (!resp.data) {
      this.logger.write('Solis discharge SOC setting 5965 API failed');
      console.log(JSON.stringify(resp, null, 2));
      return {error: 'Solis discharge SOC setting 5965 API failed'};
    }
    resp = await this.controlAPI(5964, fromTimeText + '-' + toTimeText);
    if (resp.error) {
      return resp;
    }
    if (!resp.data) {
      this.logger.write('Solis discharge setting 5964 API failed');
      console.log(JSON.stringify(resp, null, 2));
      return {error: 'Solis discharge setting 5964 API failed'};
    }
    return {status: 'Inverter successfully set to discharge between ' + fromTimeText + ' and ' + toTimeText};
  }

  async update(offset) {
    offset = offset || 0;
    let resp = await this.inverterDayAPI(offset);
    if (resp.error) {
      return resp;
    }
    else {
      let dateIndex = this.date.atMidnight(offset).timeIndex;
      let record = this.data.$(dateIndex);
      for (let snapshot of resp.data) {
        let time = snapshot.dataTimestamp;
        let tsRec = record.$(time);
        if (!tsRec.exists && +snapshot.homeLoadTodayEnergy !== 0) {
          let d = this.date.at(+time);
          tsRec.document = {
            at: d.dayText + '/' + d.monthText + '/' + d.year + ': ' + d.timeText,
            time: d.timeText,
            pvOutputNow: +snapshot.pac / 1000,
            pvOutputTotal: snapshot.eToday,
            houseLoadNow: +snapshot.familyLoadPower / 1000,
            houseLoadTotal: snapshot.homeLoadTodayEnergy,
            gridImportNow: (0 - +snapshot.pSum) / 1000,
            gridImportTotal: snapshot.gridPurchasedTodayEnergy,
            gridExportTotal: snapshot.gridSellTodayEnergy,
            batteryLevel: snapshot.batteryCapacitySoc,
            batteryChargePower: snapshot.batteryPower
          };
        }
      }
      return {ok: 'Solis Data updated successfully'};
    }
  }

  async inverterChargeTest(forMinutes) {
    // Set inverter to charge for specified time: five minutes by default

    if (!this.isConfigured) {
      return {
        error: 'SolisCloud credentials are incomplete'
      };
    }

    forMinutes = forMinutes || 5;
    let forMs = forMinutes * 60000;
    let fromD = this.date.now();
    let toD = this.date.at(fromD.timeIndex + forMs);

    let firmwareVersion = await this.getFirmwareVersion();
    if (firmwareVersion === 'post-4B00') {
      // set charge for slot 1
      let resp = await this.post4B00Charge(fromD.timeText, toD.timeText)
      return resp;
    }

    // pre-4B00

    // first get current inverter charge settings
    let resp = await this.atReadAPI();
    if (resp.error) {
      return resp;
    }
    let chargeString = resp.data.msg;
    chargeString = this.chargeTimeString(chargeString, fromD.timeText, toD.timeText);
    resp = await this.chargeAPI(chargeString);
    if (resp.error) {
      return resp;
    }
    return {status: 'Inverter successfully set to charge between ' + fromD.timeText + ' and ' + toD.timeText};
  }

  startNewChargeHistoryRecord() {
    let levelNow = this.batteryLevelNow;
    if (levelNow) {
      let d = this.date.now();
      this.chargeHistory.$([d.slotTimeIndex, 'start']).value = levelNow;
      this.chargeHistory.$([d.slotTimeIndex, 'startMinute']).value = d.minute;
    }
  }

  endChargeHistoryRecord() {
    let levelNow = this.batteryLevelNow;
    if (levelNow) {
      let d = this.date.now();
      if (this.chargeHistory.$(d.previousSlotTimeIndex).exists) {
        this.chargeHistory.$([d.previousSlotTimeIndex, 'end']).value = levelNow;
      }
    }
  }

  async inverterCharge(override) {
    if (!override && !this.agility.chargingEnabled) {
      this.logger.write('Charging logic is currently disabled');
      return {status: 'Inverter Charge task ignored'};
    }
    this.startNewChargeHistoryRecord();
    let fromD = this.date.now();
    let toD = this.date.at(fromD.slotEndTimeIndex);

    let firmwareVersion = await this.getFirmwareVersion();
    if (firmwareVersion === 'post-4B00') {
      // set charge for slot 1
      let resp = await this.post4B00Charge(fromD.timeText, toD.timeText)
      return resp;
    }

    // first get current inverter charge settings
    let resp = await this.atReadAPI();
    if (resp.error) {
      return resp;
    }
    let chargeString = resp.data.msg;

    chargeString = this.chargeTimeString(chargeString, fromD.timeText, toD.timeText);
    resp = await this.chargeAPI(chargeString);
    if (resp.error) {
      return resp;
    }
    return {status: 'Inverter set to charge between ' + fromD.timeText + ' and ' + toD.timeText};
  }

  async inverterChargeBetween(fromTimeText, toTimeText) {

    let firmwareVersion = await this.getFirmwareVersion();
    if (firmwareVersion === 'post-4B00') {
      // set charge for slot 1
      let resp = await this.post4B00Charge(fromTimeText, toTimeText)
      return resp;
    }

    // first get current inverter charge settings
    let resp = await this.atReadAPI();
    if (resp.error) {
      return resp;
    }
    let chargeString = resp.data.msg;
    chargeString = this.chargeTimeString(chargeString, fromTimeText, toTimeText);
    resp = await this.chargeAPI(chargeString);
    if (resp.error) {
      return resp;
    }
    return {status: 'Inverter set to charge between ' + fromTimeText + ' and ' + toTimeText};
  }

  async inverterDischarge(override) {
    if (!override && !this.agility.dischargingEnabled) {
      this.logger.write('Discharging logic is currently disabled');
      return {status: 'Inverter Discharge task ignored'};
    }

    let fromD = this.date.now();
    let toD = this.date.at(fromD.slotEndTimeIndex);

    let firmwareVersion = await this.getFirmwareVersion();
    if (firmwareVersion === 'post-4B00') {
      // set discharge for slot 1
      let resp = await this.post4B00Discharge(fromD.timeText, toD.timeText)
      return resp;
    }

    // first get current inverter charge settings
    let resp = await this.atReadAPI();
    if (resp.error) {
      return resp;
    }
    let chargeString = resp.data.msg;
    chargeString = this.dischargeTimeString(chargeString, fromD.timeText, toD.timeText);
    resp = await this.dischargeAPI(chargeString);
    if (resp.error) {
      return resp;
    }
    this.battery.unsetDischargeControlFlag();  // in case it had been set to trigger this discharge
    return {status: 'Inverter set to discharge between ' + fromD.timeText + ' and ' + toD.timeText};
  }

  async inverterDischargeBetween(fromTimeText, toTimeText) {

    let firmwareVersion = await this.getFirmwareVersion();
    if (firmwareVersion === 'post-4B00') {
      // set discharge for slot 1
      let resp = await this.post4B00Discharge(fromD.timeText, toD.timeText)
      return resp;
    }

    // first get current inverter charge settings
    let resp = await this.atReadAPI();
    if (resp.error) {
      return resp;
    }
    let chargeString = resp.data.msg;
    chargeString = this.dischargeTimeString(chargeString, fromTimeText, toTimeText);
    resp = await this.dischargeAPI(chargeString);
    if (resp.error) {
      return resp;
    }
    return {status: 'Inverter set to discharge between ' + fromTimeText + ' and ' + toTimeText};
  }


  async inverterGridOnly(override) {
    if (!override && !this.agility.chargingEnabled) {
      this.logger.write('Charging logic is currently disabled');
      return {status: 'Inverter Grid Only task ignored'};
    }

    let fromD = this.date.now();
    let toD = this.date.at(fromD.slotEndTimeIndex);

    let firmwareVersion = await this.getFirmwareVersion();
    if (firmwareVersion === 'post-4B00') {
      // set discharge for slot 1
      let resp = await this.post4B00Discharge(fromD.timeText, toD.timeText, 0)
      return resp;
    }

    // first get current inverter charge settings
    let resp = await this.atReadAPI();
    if (resp.error) {
      return resp;
    }
    let chargeString = resp.data.msg;
    chargeString = this.gridOnlyTimeString(chargeString, fromD.timeText, toD.timeText);
    resp = await this.dischargeAPI(chargeString);
    if (resp.error) {
      return resp;
    }
    return {status: 'Inverter set to only use grid power between ' + fromD.timeText + ' and ' + toD.timeText};
  }

  async inverterGridPowerBetween(fromTimeText, toTimeText) {

    let firmwareVersion = await this.getFirmwareVersion();
    if (firmwareVersion === 'post-4B00') {
      // set discharge for slot 1
      let resp = await this.post4B00Discharge(fromTimeText, toTimeText, 0)
      return resp;
    }

    // first get current inverter charge settings
    let resp = await this.atReadAPI();
    if (resp.error) {
      return resp;
    }
    let chargeString = resp.data.msg;
    chargeString = this.gridOnlyTimeString(chargeString, fromTimeText, toTimeText);
    resp = await this.dischargeAPI(chargeString);

    if (resp.error) {
      return resp;
    }
    return {status: 'Inverter set to only use grid power between ' + fromTimeText + ' and ' + toTimeText};
  }

  async inverterResetNow(override) {
    if (!override && !this.agility.chargingEnabled) {
      return {error: 'Charging logic is currently disabled, so no reset command sent'};
    }

    let firmwareVersion = await this.getFirmwareVersion();
    if (firmwareVersion === 'post-4B00') {
      // set charge for slot 1
      let resp = await this.post4B00Charge('00:00', '00:00', 0)
      return resp;
    }

    // first get current inverter charge settings
    let resp = await this.atReadAPI();
    if (resp.error) {
      return resp;
    }
    let chargeString = this.resetTimeString(resp.data.msg);
    resp = await this.chargeAPI(chargeString);
    if (resp.error) {
      return resp;
    }
    return {status: 'Inverter reset successfully'};
  }

  async inverterReset() {
    // only if midnight
    let d = this.date.now();
    if (d.timeText === '00:00') {
      return await this.inverterResetNow();
    }
    else {
      return {status: 'Inverter reset only done at midnight'};
    }
  }

  async updateInverterTime() {
    if (this.keepInverterTimeSynchronised) {
      let resp = await this.setTimeNowAPI();
      if (resp.error) return resp;
      return {status: 'Inverter time updated successfully'};
    }
    else {
      return {status: 'Agility is configured not to update the Inverter Time'};
    }
  }

  getDataAt(timeText, offset) {
    offset = offset || 0;
    let dateIndex = this.date.atMidnight(offset).timeIndex;
    let d = this.date.atTime(timeText, dateIndex);
    let timeIndex = d.timeIndex;
    let dataRecord = this.data.$(dateIndex);
    if (dataRecord.$(timeIndex).exists) {
      // record exists for the exact specified time - use it
      return dataRecord.$(timeIndex).document;
    }
    else {
      // get the record after the specified time
      let record = dataRecord.childAfter(timeIndex);
      if (!record) {
        record = dataRecord.childBefore(timeIndex);
      }
      if (record) {
        return record.document;
      }
      else {
        return;
      }
    }
  }

  get dataNow() {
    let now = this.date.now();
    let timeIndex = now.timeIndex;
    let dataRecord = this.data.$(now.dateIndex);
    if (dataRecord.$(timeIndex).exists) {
      // record exists for the exact specified time - use it
      return dataRecord.$(timeIndex).document;
    }
    else {
      // get the most recent record
      let record = dataRecord.childBefore(timeIndex);
      if (record) {
        return record.document;
      }
      else {
        if (now.slotTimeText === '00:00') {
          // get last record from yesterday
          let d = this.date.atMidnight(-1);
          let record2 = this.data.$(d.dateIndex).lastChild;
          return record2.document;
        }
        return;
      }
    }
  }

  get batteryLevelNow() {
    let dataNow = this.dataNow;
    if (dataNow) {
      return dataNow.batteryLevel;
    }
    return;
  }

  get datesAvailable() {
    return this.data.properties;
  }

  averagePowerBetweenTimeIndices(fromTimeIndex, toTimeIndex, log) {
    if (typeof log === 'undefined') log = true;
    let fromD = this.date.at(fromTimeIndex);
    let fromTimeText = fromD.timeText;
    let fromDateIndex = fromD.dateIndex;
    let toD = this.date.at(toTimeIndex);
    let toTimeText = toD.timeText;
    let toDateIndex = toD.dateIndex;
    let power;
    if (fromDateIndex === toDateIndex) {
      power = this.averagePowerBetween(fromTimeText, toTimeText);
      if (log) this.logger.write('Power between ' + fromTimeText + ' and ' + toTimeText + ':');
      if (log) this.logger.write(JSON.stringify(power));
    }
    else {
      // split across two days
      let power1 = this.averagePowerBetween(fromTimeText, '23:30');
      if (log) {
        this.logger.write('Power between ' + fromTimeText + ' and 22:30:');
        this.logger.write(JSON.stringify(power1));
      }
      let power2 = this.averagePowerBetween('00:00', toTimeText);
      if (log) {
        this.logger.write('Power between 00:00 and ' + toTimeText + ':');
        this.logger.write(JSON.stringify(power2));
      }
      power = {
        load: power1.load + power2.load,
        pv: power1.pv + power2.pv
      };
    }
    return power;
  }

  averagePowerBetween(from, to) {
    //console.log('averagePowerBetween: from = ' + from + '; to = ' + to);
    from = from || '00:00';
    to = to || '23:59';
    let totalLoad = 0;
    let totalPV = 0;
    let offset = 0;
    let count = 0;
    let _this = this;
    if (!this.data.exists) {
      return {
        load: 0,
        pv: 0
      };
    }
    let lc = this.data.lastChild;
    let key;
    if (lc && lc.exists) {
      let ps = lc.previousSibling;
      if (ps && ps.exists) {
        key = ps.key
      }
    }
    if (!key) {
      return {
        load: 0,
        pv: 0
      };
    }
    let startDateIndex = key;
    this.data.forEachChildNode({direction: 'reverse', from: startDateIndex}, function(dateNode) {
      offset--;
      //console.log('from = ' + from + '; offset = ' + offset);
      let data = _this.getDataAt(from, offset);
      //console.log(data);
      if (data) {
        count++;
        let startLoad = data.houseLoadTotal;
        let startPV = data.pvOutputTotal;
        data = _this.getDataAt(to, offset);
        //console.log(data);
        let endLoad = data.houseLoadTotal;
        let endPV = data.pvOutputTotal;
        let totalDayLoad = endLoad - startLoad;
        let totalDayPV = endPV - startPV;
        totalLoad += totalDayLoad;
        totalPV += totalDayPV;
        //console.log('total for day: ' + totalDayLoad);
      }
    });
    //console.log('grand total: ' + totalLoad + '; total days: ' + count);
    //console.log('totalPV: ' + totalPV);
    let aveLoad = totalLoad / count;
    let avePV = totalPV / count;
    return {
      load: aveLoad,
      pv: avePV
    };
  }

  powerAt(dateIndex, timeIndex) {
    let dateNode = this.data.$(dateIndex);
    if (!dateNode.exists) return;
    let timeNode = dateNode.$(timeIndex);
    if (timeNode.exists) {
      return {
        batteryLevel: timeNode.$('batteryLevel').value,
        houseLoadTotal: timeNode.$('houseLoadTotal').value,
        gridExportTotal: timeNode.$('gridExportTotal').value,
        gridimportTotal: timeNode.$('gridimportTotal').value,
        pvOutputTotal: timeNode.$('pvOutputTotal').value
      }
    }
    let nodeBefore = dateNode.childBefore(timeIndex);
    let beforeIndex;
    if (nodeBefore) beforeIndex = +nodeBefore.key;
    let nodeAfter = dateNode.childAfter(timeIndex);
    let afterIndex;
    if (nodeAfter) afterIndex = +nodeAfter.key;
    if (!beforeIndex) {
      timeIndex = afterIndex;
    }
    else if (!afterIndex) {
      timeIndex = beforeIndex;
    }
    else {
      let diff1 = timeIndex - beforeIndex;
      let diff2 = afterIndex - timeIndex;
      if (diff1 < diff2) {
        timeIndex = beforeIndex;
      }
      else if (diff1 > diff2) {
        timeIndex = afterIndex;
      }
      else {
        timeIndex = beforeIndex;
      }
    }
    timeNode = dateNode.$(timeIndex);
    return {
      batteryLevel: timeNode.$('batteryLevel').value,
      houseLoadTotal: timeNode.$('houseLoadTotal').value,
      gridExportTotal: timeNode.$('gridExportTotal').value,
      gridImportTotal: timeNode.$('gridImportTotal').value,
      pvOutputTotal: timeNode.$('pvOutputTotal').value
    };
  }

  get profile() {
    let offset = 0;
    let count = 0;
    let _this = this;
    let lc = this.data.lastChild;
    if (lc && lc.exists) {
      let ps = lc.previousSibling;
      if (ps && ps.exists) {
        let startDateIndex = ps.key;
        let d = this.date.at(startDateIndex);
        let slots = [];
        let totals = [];
        for (let i = 0; i < 47; i++) {
          slots.push(0);
          totals.push(0);
        }
        this.data.forEachChildNode({direction: 'reverse', from: startDateIndex}, function(dateNode) {

          let dateIndex = +dateNode.key;
          let d = _this.date.at(dateIndex);
          let timeIndex = dateIndex;

          let tix = timeIndex + 1800000;
          let timeText = _this.date.at(tix).timeText;
          let power = _this.powerAt(dateIndex, timeIndex);
          if (power.pvOutputTotal > 0.1) {
            // corrupt data record - shouldn't be any PV for 00:30
            return;
          }

          count++;
          for (let i = 0; i < 47; i++) {
            timeIndex += 1800000;
            let timeText = _this.date.at(timeIndex).timeText;
            let power = _this.powerAt(dateIndex, timeIndex);
            slots[i] = power.houseLoadTotal; 
          }
          //console.log(slots);
          let sum = 0;
          for (let i = 0; i < 47; i++) {
            let value = slots[i] + 0;
            if (value < sum) value = sum;
            slots[i] = +(value - sum).toFixed(2);
            sum = value;
          }
          //console.log(slots);
          for (let i = 0; i < 47; i++) {
            totals[i] += slots[i]
          }
        });
        //console.log('profile total days with data: ' + count);
        //console.log(totals);
        for (let i = 0; i < 47; i++) {
          totals[i] = +(totals[i] / count).toFixed(2);
        }
        return totals;
      }
    }
    return {
      error: 'No historical Solis Data is available yet'
    };
  }

  async restore(cleardown) {
    if (cleardown) this.data.delete();
    let noOfDaysToStore = this.agility.movingAveragePeriod + 1;
    let res = await this.update();
    if (!res.error) {
      console.log('today updated');
      for (let i = 1; i < noOfDaysToStore; i++) {
        res = await this.update(-i);
        if (!res.error) {
          console.log('Updated for offset - ' + i );
        }
      }
    }
  }

  cleardown() {
    let noOfDaysToKeep = this.agility.movingAveragePeriod + 1;
    let count = 0;
    let _this = this;
    this.data.forEachChildNode({direction: 'reverse'}, function(dateNode) {
      count++;
      if (count > noOfDaysToKeep) {
        dateNode.delete();
      }
    });
    this.logger.write('Solis data cleared down to most recent ' + noOfDaysToKeep + ' days');
  }

};
export {Solis};