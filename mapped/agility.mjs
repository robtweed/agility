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

 27 March 2026

 */

import {glsdb} from '../glsdb_loader.mjs';
import {date} from './dates.mjs';
import {Logger} from './logger.mjs';
import {Backup} from './backup.mjs';
import {Octopus} from './octopus.mjs';
import {Solcast} from './solcast.mjs';
import {Axle} from './axle.mjs';
import {Solis} from './solis.mjs';
import {Battery} from './battery.mjs';
import {Actions} from './actions.mjs';
import fs from 'fs';
import {execSync} from 'node:child_process';

let Agility = class {

  constructor() {

    let listeners = new Map();

    this.name = 'Agility';
    this.glsdb = glsdb;
    this.todayIndex = this.getDateIndex(0);
    this.logger = new Logger(this);
    this.date = date;
    this.backup = new Backup(glsdb);
    this.control = new glsdb.node('agilityControl');
    this.tasks = this.control.$('tasks');
    this.config = new glsdb.node('agilityConfig');
    this.solis = new Solis(this);
    this.octopus = new Octopus(this);
    if (!this.isConfigured) this.loadConfig();
    this.solcast = new Solcast(this);
    this.axle = new Axle(this);
    this.battery = new Battery(this);
    this.actions = new Actions(this);
    let _this = this;

    this.on = function(type, callback) {
      if (!listeners.has(type)) {
        listeners.set(type, callback);
      }
    };

    this.off = function(type) {
      if (listeners.has(type)) {
        listeners.delete(type);
      }
    };

    this.emit = function(type, data) {
      if (listeners.has(type)) {
        let handler =  listeners.get(type);
        handler.call(_this, data);
      }
    }

  }

  async sleep(delay) {
    new Promise((resolve) => setTimeout(resolve, delay));
  }

  exec(cmd) {
    execSync(cmd, {stdio:[0,1,2]});
  }

  get isAlreadyRunning() {
    let status = this.control.$('running').lock(1);
    return !status;
  }

  waitUntilStopped() {
    if (this.isAlreadyRunning) {
      this.logger.write('Waiting for Agility to stop: this may take up to a minute')
      let status = this.control.$('running').lock(65);
    }
    this.releaseLock();
    this.removeTask('stop');
    this.logger.write('Agility has stopped');
  }

  releaseLock() {
    this.control.$('running').unlock();
  }

  getDateIndex(offset) {
    offset = offset || 0;
    let mn = date.atMidnight(offset);
    return mn.timeIndex;
  }

  get isConfigured() {
    return this.config.exists;
  }

  get dischargingEnabled() {
    // disabled by default
    let dischargeConfig = this.config.$(['operation', 'dischargingEnabled']);
    if (!dischargeConfig.exists) return false;
    return dischargeConfig.value;
  }

  enableDischarging() {
    this.config.$(['operation', 'dischargingEnabled']).value = true;
  }

  disableDischarging() {
    this.config.$(['operation', 'dischargingEnabled']).delete();
  }

  get chargingEnabled() {
    // enabled by default in config.json
    let chargeConfig = this.config.$(['operation', 'chargingEnabled']);
    if (!chargeConfig.exists) return false;
    return chargeConfig.value;
  }

  enableCharging() {
    this.config.$(['operation', 'chargingEnabled']).value = true;
  }

  disableCharging() {
    this.config.$(['operation', 'chargingEnabled']).delete();
  }

  get peakExportEnabled() {
    // disabled by default
    let peakExport = this.config.$(['operation', 'peakExportEnabled']);
    if (!peakExport.exists) return false;
    return peakExport.value;
  }

  enablePeakExport() {
    this.config.$(['operation', 'peakExportEnabled']).value = true;
  }

  disablePeakExport() {
    this.config.$(['operation', 'peakExportEnabled']).delete();
  }

  get now() {
    return date.now().timeText;
  }

  clearAllData() {
    this.octopus.tariffs.delete();
    if (this.solcast) this.solcast.document.delete();
    this.solis.data.delete();
    this.logger.deleteAll();
  }

  get alwaysUsePrice() {
    if (!this.config.$(['operation', 'alwaysUseSlotPrice']).exists) return 10;
    return +this.config.$(['operation', 'alwaysUseSlotPrice']).value;
  }

  set alwaysUsePrice(value) {
    this.config.$(['operation', 'alwaysUseSlotPrice']).value = value;
  }

  get isTodaysAlwaysUsePriceSet() {
    if (this.config.$(['operation', 'todaysAlwaysUseSlotPrice']).exists) return true;
    return false;
  }

  get todaysAlwaysUsePrice() {
    let node = this.config.$(['operation', 'todaysAlwaysUseSlotPrice']);
    if (!node.exists) return;
    return +node.value;
  }

  set todaysAlwaysUsePrice(value) {
    this.config.$(['operation', 'todaysAlwaysUseSlotPrice']).value = value;
  }

  deleteTodaysAlwaysUsePrice() {
    this.config.$(['operation', 'todaysAlwaysUseSlotPrice']).delete();
  }

  get movingAveragePeriod() {
    return +this.config.$(['operation', 'movingAveragePeriod']).value;
  }

  set movingAveragePeriod(days) {
    if (!this.config.$(['operation', 'movingAveragePeriod']).exists) return 14;
    this.config.$(['operation', 'movingAveragePeriod']).value = days;
  }

  get lastSlotHandled() {
    return this.control.$('lastSlotHandled').value;
  }

  set lastSlotHandled(timeText) {
    this.control.$('lastSlotHandled').value = timeText;
  }

  get chargingHasStarted() {
    let node = this.control.$('chargingStarted');
    if (!node.exists) return false;
    return node.value;
  }

  setChargingStartedFlag() {
    this.control.$('chargingStarted').value = true;
  }

  unsetChargingStartedFlag() {
    this.control.$('chargingStarted').delete();
  }

  set updateAvailable(version) {
    this.control.$('updateVersion').value = version;
  }

  get updateAvailable() {
    let node = this.control.$('updateVersion');
    if (!node.exists) return false;
    return +this.control.$('updateVersion').value;
  }

  removeUpdateAvailable() {
    this.control.$('updateVersion').delete();
  }

  clearLogs() {
    fs.copyFileSync('/opt/agility/mapped/logs/agility.log', '/opt/agility/mapped/logs/agility.log.bak');
    fs.truncateSync('/opt/agility/mapped/logs/agility.log');
    fs.copyFileSync('/opt/agility/mapped/mgweb/mgweb.log', '/opt/agility/mapped/mgweb/mgweb.log.bak');
    fs.truncateSync('/opt/agility/mapped/mgweb/mgweb.log');
    fs.copyFileSync('/opt/agility/mapped/mgweb/mgweb_server.log', '/opt/agility/mapped/mgweb/mgweb_server.log.bak');
    fs.truncateSync('/opt/agility/mapped/mgweb/mgweb_server.log');
  }

  addTask(task) {
    this.tasks.$(task).value = true;
  }

  taskFailed(task) {
    this.tasks.$(task).value = false;
  }

  resetFailedTasks() {
    let _this = this;
    this.tasks.forEachChildNode(function(taskNode) {
      _this.addTask(taskNode.key);
    });
  }

  removeTask(task) {
    this.tasks.$(task).delete();
  }

  clearTasks() {
    let stopSet = this.tasks.$('stop').exists;
    this.tasks.delete();
    if (stopSet) this.addTask('stop');
  }

  todo(task) {
    if (this.tasks.$(task).exists) {
      return this.tasks.$(task).value;
    }
    return false;
  }

  get hasTasks() {
    let _this = this;
    let status = false;
    this.tasks.forEachChildNode(function(taskNode) {
      let task = taskNode.key;
      if (!_this.actions.fn[task]) {
        // no method assigned to task so remove it
        taskNode.delete();
      }
      else if (_this.todo(task)) {
        status = true;
        return false;
      }
    });
    //console.log('hasTasks: ' + status);
    return status;
  }

  setTasks() {
    // based on current time, add tasks to be done
    let now = date.now();
    let newSlot = (now.minute === 0 || now.minute === 30);
    if (!newSlot && now.slotTimeText !== this.lastSlotHandled) {
      // this slot was missed for some reason, so handle it now
      newSlot = true;
    }
    if (newSlot) {
      this.clearTasks();
      this.addTask('updateOctopusTariffs');
      if (this.solcast.isEnabled) this.addTask('updateSolcastData');
      this.addTask('updateSolisData');
      if (this.axle.isEnabled) this.addTask('updateAxleData');
      this.addTask('shouldBatteryBeCharged');
      if (now.slotTimeText === '00:00') {
        // started a new day
        this.addTask('cleardownInfo');
        this.addTask('updateYesterdaysSolisData');
      }
      if (now.slotTimeText === '04:00') {
        this.addTask('updateInverterTime');
      }
      if (now.slotTimeText === '16:00') {
        this.addTask('deleteTodaysAlwaysUsePrice');
      }
      if (now.slotTimeText === '19:00') {
        this.addTask('resetPeakHours');
      }

    }
    if (now.minute === 15 || now.minute === 45) {
      this.addTask('backup');
    }
    this.lastSlotHandled = now.slotTimeText;
  }

  stop() {
    this.addTask('stop');
  }

  async performTask(task) {
    this.logger.write('perform task ' + task);
    if (this.actions.fn[task]) {
      let fn = this.actions.fn[task];
      let status;
      if (fn.constructor.name == 'AsyncFunction') {
        status = await fn.call(this);
        this.logger.write(JSON.stringify(status));
      }
      else {
        status = fn.call(this);
        this.logger.write(JSON.stringify(status));
      }
      if (status.error) {
        console.log('error running ' + task);
        console.log(status);
        this.taskFailed(task);
      }
      else {
        this.removeTask(task);
      }
    }
    else {
      this.removeTask(task);
    }
  }

  async invokeTasks() {
    if (this.todo('stop')) {
      await this.shutdown();
      return;
    }
    for (let task in this.actions.fn) {
      if (this.todo(task)) {
        await this.performTask(task);
      }
    }
  }

  async shutdown() {
    this.logger.write('Agility instructed to shut down');
    this.removeTask('stop');
    let ignore = ['agilityLog', 'agilityControl'];
    this.backup.now(ignore, 'agility.bak'); 
    clearInterval(this.timer);
    await this.sleep(2000);
    this.releaseLock();
    this.glsdb.close();
    process.exit();
  }

  initialise() {
    let ok = true;
    let _this = this;
    if (!this.config.exists) {
      this.logger.write('No Configuration defined for Agility: Attempt to load from config.json');
      let ok = this.loadConfig();
      if (!ok) {
        this.logger.write('Unable to load from config.json');
      }
    }
    if (ok && !this.config.exists) {
      this.logger.write('No Configuration defined for Agility');
      ok = false;
    }
    if (ok && !this.battery.isConfigured) {
      this.logger.write('Battery Configuration does not exist or is incomplete');
      ok = false;
    }
    if (ok && !this.octopus.isConfigured) {
      this.logger.write('Octopus Configuration does not exist or is incomplete');
      ok = false;
    }
    if (ok && this.solcast.isEnabled && !this.solcast.isConfigured) {
      this.logger.write('Solcast Configuration does not exist or is incomplete');
      ok = false;
    }
    if (ok && !this.solis.isConfigured) {
      this.logger.write('SolisCloud Configuration does not exist or is incomplete');
      ok = false;
    }
    setTimeout(async function() {
      await _this.solis.getFirmwareVersion();
    }, 0);
    if (!ok) {
      this.logger.write('Unable to start');
      setTimeout(function() {
        process.exit();
      }, 1000);
      return false;
    }
    else {
      this.logger.write('Agility started');
    }
    if (!this.solis.data.exists) {
      this.logger.write('No historical SolisCloud Data exists, so loading it now');
      this.solis.restore();
    }

    setTimeout(async function() {
      await _this.octopus.getLatestTariffTable(-1);
    }, 100);

    return ok;
  }

  async sendSignal(args) {
    args = args || {};
    let url = 'localhost:8080/agility/signal';
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
    if (args.body) {
      options.body = JSON.stringify(args.body);
      options.headers['Content-Length'] = options.body.length;
    }
    try {
      let res = await fetch(url, options);
      if (res.status !== 200) {
        this.logger.write('SSE signal to Agility Web Server failed: status: ' + res.status);
        return {
          error: 'Agility Web Server returned status ' + res.status
        }
      }
      let json = await res.json();
    }
    catch(err) {
      console.log(err);
      return {
        error: 'Agility Web Server signal request failed',
        err: err
      };
    }
  }

  run() {
    if (this.isAlreadyRunning) {
      this.logger.write('Agility is already running - run request ignored');
      return;
    }
    // get pid for SSE if available
    let sseDoc = new this.glsdb.node('agilitySSE.byPid');
    let _this = this;
    this.on('logger', function(data) {
      sseDoc.forEachChildNode(function(pidNode) {
        try {
          process.kill(pidNode.key, 'SIGHUP');
        }
        catch(err) {
          // invalid / non-existent process id
          pidNode.delete();
        }
      });
    });
    let ok = this.initialise();
    if (!ok) return;
    this.timer = setInterval(async function() {
      _this.logger.write('Checking at ' + _this.now);
      _this.setTasks();
      do {
        await _this.invokeTasks();
      }
      while (_this.hasTasks);
      _this.resetFailedTasks();
    }, 60000);
  }

  loadConfig(filepath) {
    filepath = filepath || '/opt/agility/mapped/config.json';
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

  async getLatestVersionNo() {
    //let url = 'https://cdn.jsdelivr.net/gh/robtweed/agility/mapped/version.json';
    let url = 'https://raw.githubusercontent.com/robtweed/agility/refs/heads/master/mapped/version.json';
    let options = {
      method: 'GET',
      headers: {
        'Content-type': 'application/json;charset=UTF-8'
      }
    };
    let json;
    try {
      let res = await fetch(url, options);
      if (res.status !== 200) {
        let error = 'Attempt to fetch version file from Agility repository failed: status: ' + res.status;
        this.logger.write(error);
        return {
          error: error
        }
      }
      json = await res.json();
    }
    catch(err) {
      let error = 'Attempt to fetch version file from Agility repository failed';
      this.logger.write(error);
      return {
        error: error,
        err: err
      };
    }
    return json;
  }

  get myCurrentVersion() {
    let filepath = '/opt/agility/mapped/version.json';
    try {
      let res = fs.readFileSync(filepath, { encoding: 'utf8', flag: 'r' });
      let json = JSON.parse(res);
      return json.version;
    }
    catch(err) {
      return;
    }
  }

  async isUpdateAvailable() {
    let json = await this.getLatestVersionNo();
    if (json.error) return false;
    let latestVersion = +json.version;
    let currentVersion = +this.myCurrentVersion;
    if (latestVersion > currentVersion) {
      return {
        latestVersion: latestVersion,
        currentVersion: currentVersion
      };
    }
    return false;
  }

  resetData() {
    // delete all the operational data
    //  Agility will reload what it can when it is restarted
    this.solis.data.delete();
    this.octopus.tariffs.delete();
    if (this.solcast.isEnabled) this.solcast.document.delete();
    this.logger.loggerDoc.delete(); 
    this.logger.write('Agility Data has been deleted');
  }

  update() {
    let copyDir = '/opt/copy';
    if (fs.existsSync(copyDir)) {
      fs.rmSync(copyDir, { 
        recursive: true
      }); 
    }
    fs.mkdirSync(copyDir);
    this.exec('git clone https://github.com/robtweed/agility ' + copyDir);
    let fileArr = fs.readdirSync(copyDir + '/mapped');
    for (let filename of fileArr) {
      if (filename.endsWith('.mjs') || filename === 'version.json') {
        fs.copyFileSync(copyDir + '/mapped/' + filename, '/opt/agility/mapped/' + filename);
      }
    }

    fileArr = fs.readdirSync(copyDir + '/mapped/www');
    for (let filename of fileArr) {
      if (filename.endsWith('.html') || filename.endsWith('.ico')) {
        fs.copyFileSync(copyDir + '/mapped/www/' + filename, '/opt/agility/mapped/www/' + filename);
      }
    }

    fileArr = fs.readdirSync(copyDir + '/mapped/www/js');
    for (let filename of fileArr) {
      if (filename.endsWith('.js')) {
        fs.copyFileSync(copyDir + '/mapped/www/js/' + filename, '/opt/agility/mapped/www/js/' + filename);
      }
    }

    fileArr = fs.readdirSync(copyDir + '/mapped/www/js/components/sbadmin');
    for (let filename of fileArr) {
      if (filename.endsWith('.js')) {
        fs.copyFileSync(copyDir + '/mapped/www/js/components/sbadmin/' + filename, '/opt/agility/mapped/www/js/components/sbadmin/' + filename);
      }
    }

    fileArr = fs.readdirSync(copyDir + '/mapped/www/js/assemblies');
    for (let filename of fileArr) {
      if (filename.endsWith('.js')) {
        fs.copyFileSync(copyDir + '/mapped/www/js/assemblies/' + filename, '/opt/agility/mapped/www/js/assemblies/' + filename);
      }
    }

    fileArr = fs.readdirSync(copyDir + '/mapped/mgweb');
    for (let filename of fileArr) {
      if (filename.endsWith('.mjs')) {
        fs.copyFileSync(copyDir + '/mapped/mgweb/' + filename, '/opt/agility/mapped/mgweb/' + filename);
      }
    }

    fileArr = fs.readdirSync(copyDir + '/mapped/control');
    for (let filename of fileArr) {
      if (filename.endsWith('.mjs')) {
        fs.copyFileSync(copyDir + '/mapped/control/' + filename, '/opt/agility/mapped/control/' + filename);
      }
    }

    fs.rmSync(copyDir, { 
      recursive: true
    });

    this.exec('/opt/agility/nginx reload');
  }
}

export {Agility}

