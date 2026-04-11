import {Router} from 'mgw-router';
import {Agility} from '../agility.mjs';
let agility = new Agility();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let router = new Router({logging: true});

router.get('/agility/helloworld', (Request, ctx) => {

  return {
    payload: {
      hello: 'Hello from Agility!',
      name: agility.name
    }
  };

});

router.get('/agility/isRunning', (Request, ctx) => {

  let isRunning = true;
  if (!agility.isAlreadyRunning) {
    isRunning = false;
    agility.releaseLock();
  }

  return {
    payload: {
      isRunning: isRunning
    }
  };

});

router.get('/agility/charging/isEnabled', (Request, ctx) => {

  return {
    payload: {
      enabled: agility.chargingEnabled
    }
  };

});

router.get('/agility/charging/enable', (Request, ctx) => {

  agility.enableCharging();

  return {
    payload: {
      ok: true
    }
  };

});

router.get('/agility/charging/disable', (Request, ctx) => {

  agility.disableCharging();

  return {
    payload: {
      ok: true
    }
  };

});

router.get('/agility/discharging/isEnabled', (Request, ctx) => {

  return {
    payload: {
      enabled: agility.dischargingEnabled
    }
  };

});

router.get('/agility/discharging/enable', (Request, ctx) => {

  agility.enableDischarging();

  return {
    payload: {
      ok: true
    }
  };

});

router.get('/agility/discharging/disable', (Request, ctx) => {

  agility.disableDischarging();

  return {
    payload: {
      ok: true
    }
  };

});


router.get('/agility/start', async (Request, ctx) => {

  if (agility.isAlreadyRunning) {
    return {
      payload: {
        error: 'Agility is already running'
      }
    };
  }
  else {
    agility.releaseLock();
  }

  console.log('Agility requested to start');
  //agility.exec('/opt/agility/mapped/control/start');
  agility.exec('nohup /root/.bun/bin/bun /opt/agility/mapped/start.mjs >> /opt/agility/mapped/logs/agility.log 2>&1 &');
  await sleep(2000);

  if (!agility.isAlreadyRunning) {
    agility.releaseLock();
    return {
      payload: {
        error: 'Agility was unable to start: check the log for details'
      }
    }
  }
  else {
    return {
      payload: {
        ok: true
      }
    }
  }

});

router.get('/agility/stop', async (Request, ctx) => {

  if (!agility.isAlreadyRunning) {
    agility.releaseLock();
    return {
      payload: {
        error: 'Agility is not running'
      }
    };
  }

  agility.stop();

  return {
    payload: {
      ok: true
    }
  };

});

router.get('/agility/version', (Request, ctx) => {

  return {
    payload: {
      version: agility.myCurrentVersion
    }
  };

});


router.get('/agility/solcast/isenabled', (Request, ctx) => {

  return {
    payload: {
      configured: agility.solcast.isConfigured,
      enabled: agility.solcast.isEnabled
    }
  };

});

router.get('/agility/solcast/enable', (Request, ctx) => {

  if (!agility.solcast.isConfigured) {
    return {
      payload: {
        error: 'Solcast Configuration is incomplete, so unable to enable'
      }
    };
  }

  agility.solcast.enable();

  return {
    payload: {
      ok: true
    }
  };

});

router.get('/agility/solcast/disable', (Request, ctx) => {

  agility.solcast.disable();

  return {
    payload: {
      ok: true
    }
  };

});

router.get('/agility/solcast/isAutoAdjustEnabled', (Request, ctx) => {

  if (!agility.solcast.isConfigured) {
    return {
      payload: {
        error: 'Solcast Configuration is incomplete, so request ignored'
      }
    };
  }

  return {
    payload: {
      enabled: agility.solcast.isAutoAdjustEnabled
    }
  };

});

router.get('/agility/solcast/enableAutoAdjust', (Request, ctx) => {

  if (!agility.solcast.isConfigured) {
    return {
      payload: {
        error: 'Solcast Configuration is incomplete, so request ignored'
      }
    };
  }

  agility.solcast.enableAutoAdjust();

  return {
    payload: {
      ok: true
    }
  };

});

router.get('/agility/solcast/disableAutoAdjust', (Request, ctx) => {

  if (!agility.solcast.isConfigured) {
    return {
      payload: {
        error: 'Solcast Configuration is incomplete, so request ignored'
      }
    };
  }

  agility.solcast.disableAutoAdjust();

  return {
    payload: {
      ok: true
    }
  };

});

router.get('/agility/solcast/adjustment', (Request, ctx) => {

  if (!agility.solcast.isConfigured) {
    return {
      payload: {
        error: 'Solcast Configuration is incomplete, so request ignored'
      }
    };
  }

  return {
    payload: {
      adjustment: agility.solcast.adjustment
    }
  };

});

router.post('/agility/solcast/adjustment', (Request, ctx) => {

  if (!agility.solcast.isConfigured) {
    return {
      payload: {
        error: 'Solcast Configuration is incomplete, so request ignored'
      }
    };
  }

  let body = Request.body;

  if (!body) {
    return {
      payload: {
        error: 'Missing body'
      }
    };
  }

  let adjustment = body.adjustment;
  if (!adjustment || adjustment === '') {
    return {
      payload: {
        error: 'Missing or empty adjustment value'
      }
    };
  }

  agility.solcast.adjustment = +adjustment;

  return {
    payload: {
      ok: true
    }
  };

});

router.get('/agility/solcast/predictionHistory', (Request, ctx) => {

  if (!agility.solcast.isConfigured) {
    return {
      payload: {
        error: 'Solcast Configuration is incomplete, so request ignored'
      }
    };
  }

  let data = agility.solcast.predictionHistory;

  return {
    payload: {
      data: data
    }
  };

});

router.get('/agility/axle/isenabled', (Request, ctx) => {

  return {
    payload: {
      configured: agility.axle.isConfigured,
      enabled: agility.axle.isEnabled
    }
  };

});

router.get('/agility/axle/enable', (Request, ctx) => {

  if (!agility.axle.isConfigured) {
    return {
      payload: {
        error: 'Axle Configuration is incomplete, so unable to enable'
      }
    };
  }

  agility.axle.enable();

  return {
    payload: {
      ok: true
    }
  };

});

router.get('/agility/axle/disable', (Request, ctx) => {

  agility.axle.disable();

  return {
    payload: {
      ok: true
    }
  };

});

router.get('/agility/axle/update', async (Request, ctx) => {

  let res = await agility.axle.request();
  console.log('Axle res:');
  console.log(res);
  if (res.error) {
    return {
      payload: {
        error: 'Unable to fetch your Axle Notification',
        details: res.error
      }
    };
  }

  return {
    payload: {
      ok: true,
      content: res
    }
  };

});



router.get('/agility/clockSync/isEnabled', (Request, ctx) => {

  return {
    payload: {
      enabled: agility.solis.keepInverterTimeSynchronised
    }
  };

});

router.get('/agility/clockSync/enable', (Request, ctx) => {

  if (!agility.solis.isConfigured) {
    return {
      payload: {
        error: 'Solis Configuration is incomplete, so unable to enable'
      }
    };
  }

  agility.solis.keepInverterTimeSynchronised = true;

  return {
    payload: {
      ok: true
    }
  };

});

router.get('/agility/clockSync/disable', (Request, ctx) => {

  agility.solis.keepInverterTimeSynchronised = false;

  return {
    payload: {
      ok: true
    }
  };

});

router.get('/agility/clockSync/now', async (Request, ctx) => {

  let res = await agility.solis.setTimeNowAPI();

  return {
    payload: {
      results: res
    }
  };

});



router.get('/agility/config/:category', (Request, ctx) => {
  let allowed = ['solisCloud', 'solcast', 'octopus', 'battery', 'operation', 'axle'];
  let category = Request.params.category;
  if (!allowed.includes(category)) {
    return {
      payload: {
        error: 'invalid category: ' + category
      }
    };
  }

  let data = {};
  if (agility.config.$(category).exists) {
    data = agility.config.$(category).document;
  }
  if (category === 'solcast') {
    if (!data.endpoint) data.endpoint = '';
    if (!data.key) data.key = '';
  }
  if (category === 'axle') {
    if (!data.endpoint || data.endpoint === '') data.endpoint = 'https://api.axle.energy/vpp/home-assistant/event';
    if (!data.key) data.key = '';
  }


  return {
    payload: {
      data: data
    }
  }
});

router.post('/agility/config/:category', (Request, ctx) => {
  //let allowed = ['solisCloud', 'solcast', 'octopus', 'battery', 'operation', 'axle'];
  let fieldNames = {
    solisCloud: ['endpoint', 'key', 'secret', 'inverterSn'],
    octopus: ['zone', 'url1', 'url2'],
    battery: ['storage', 'chargeCurrent', 'dischargeCurrent', 'chargeLimit', 'minimumLevel'],
    solcast: ['endpoint', 'key'],
    axle: ['endpoint', 'key'],
    operation: ['alwaysUseSlotPrice', 'movingAveragePeriod']
  };

  let category = Request.params.category;
  if (!fieldNames[category]) {
    return {
      payload: {
        error: 'invalid category: ' + category
      }
    };
  }

  let error;
  let data = {};
  let body = Request.body;

  for (let name of fieldNames[category]) {
    if (!body[name]) {
      error = name + ' must not be an empty value';
      break;
    }
    if (body[name] === '') {
      error = name + ' is empty';
      break;
    }
    let value = body[name];
    if (category === 'solisCloud' && name === 'endpoint' && !value.startsWith('http')) {
      error = 'Invalid endpoint';
      break;
    }
    if (category === 'octopus' && name === 'zone') {
      let validzones = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P'];
      if (!validzones.includes(value)) {
        error = 'Invalid DNO zone';
        break;
      }
    }
    if (category === 'battery') {
      value = +value;
      if (name === 'storage') {
        if (!Number.isFinite(value)) {
          error = name + ' must be a numeric value';
          break;
        }
      }
      else {
        if (!Number.isInteger(value)) {
          error = name + ' must be a numeric (integer) value';
          break;
        }
        if (value < 0 || value > 100) {
          error = name + ' must be between 0 and 100';
          break;
        }
      }
    }
    if (category === 'operation') {
      value = +value;
      if (name === 'movingAveragePeriod' && !Number.isInteger(value)) {
        error = name + ' must be a numeric (integer) value';
        break;
      }
      if (name === 'alwaysUseSlotPrice' && !Number.isFinite(value)) {
        error = name + ' must be a numeric value';
        break;
      }

    }

    data[name] = value;
  }
  if (error) {
    return {
      payload: {
        error: error
      }
    };
  }

  agility.config.$(category).document = data;

  return {
    payload: {
      ok: true
    }
  }
});

router.get('/agility/soliscloud/test1', async (Request, ctx) => {

  let res = await agility.solis.inverterDayAPI(0);
  if (res.error) {
    return {
      payload: {
        error: 'Unable to fetch your SolisCloud data',
        details: res.error
      }
    };

  }

  return {
    payload: {
      ok: true,
      example: res.data[0]
    }
  };

});

router.get('/agility/solis/atRead/:cid', async (Request, ctx) => {

  let cid = Request.params.cid;

  if (Request.query && Request.query.value) {
    let res = await agility.solis.controlAPI(cid, Request.query.value);
    return {
      payload: res
    };
  }

  let url = '/v2/api/atRead';
  let body = {
    inverterSn: agility.solis.inverterSn,
    cid: cid
  };

  let res = await agility.solis.api(url, body);
  return {
    payload: res
  };
});

router.get('/agility/solis/dataLogger', async (Request, ctx) => {
  let url = '/v1/api/inverterDetail';
  let body = {
    sn: agility.solis.inverterSn
  };
  let res = await agility.solis.api(url, body);
  if (res && res.data && res.data.stationId) {
    let stationId = res.data.stationId;
    url = '/v1/api/collectorList';
    body = {
      stationId: stationId
    };
    res = await agility.solis.api(url, body);
    if (res && res.data && res.data.page && res.data.page.records) {
      let dataLogger = 'Unknown';
      for (let record of res.data.page.records) {
        if (record.monitorModel) {
          dataLogger = record.monitorModel;
          break;
        }
      }
      return {
        payload: {
          dataLogger: dataLogger
        }
      };
    }
    else {
      let err = 'Unknown error';
      let status = 'Unknown status';
      let data = {};
      if (res) {
        if (res.status) status = res.status;
        if (res.error) err = res.error;
        if (res.data) data = res.data;
      }
      return {
        payload: {
          error: 'Unable to run collectorList API',
          details: err,
          data: data,
          status: status
        }
      };
    }
  }
  else {
    let err = 'Unknown error';
    let status = 'Unknown status';
    let data = {};
    if (res) {
      if (res.status) status = res.status;
      if (res.error) err = res.error;
      if (res.data) data = res.data;
    }
    return {
      payload: {
        error: 'Unable to run inverterDetail API',
        details: err,
        data: data,
        status: status
      }
    };
  }
});

router.get('/agility/solis/softwareVersion', async (Request, ctx) => {
  let url = '/v1/api/inverterDetail';
  let body = {
    sn: agility.solis.inverterSn
  };
  let res = await agility.solis.api(url, body);
  if (res && res.data && res.data.stationId) {
    let stationId = res.data.stationId;
    url = '/v1/api/inverterList';
    body = {
      stationId: stationId
    };
    res = await agility.solis.api(url, body);
    if (res && res.data && res.data.page && res.data.page.records) {
      let found = false;
      let results = {};
      for (let record of res.data.page.records) {
        for (let name in record) {
          if (name.toLowerCase().includes('version')) {
            results[name] = record[name];
            found = true;
          }
        }
        if (found) break;
      }
      return {
        payload: results
      };
    }
    else {
      let err = 'Unknown error';
      let status = 'Unknown status';
      let data = {};
      if (res) {
        if (res.status) status = res.status;
        if (res.error) err = res.error;
        if (res.data) data = res.data;
      }
      return {
        payload: {
          error: 'Unable to run inverterList API',
          details: err,
          data: data,
          status: status
        }
      };
    }
  }
  else {
    let err = 'Unknown error';
    let status = 'Unknown status';
    let data = {};
    if (res) {
      if (res.status) status = res.status;
      if (res.error) err = res.error;
      if (res.data) data = res.data;
    }
    return {
      payload: {
        error: 'Unable to run inverterDetail API',
        details: err,
        data: data,
        status: status
      }
    };
  }
});

router.get('/agility/solis/charge/:time', async (Request, ctx) => {

  let res = await agility.solis.inverterChargeTest(+Request.params.time);
  if (res.error) {
    return {
      payload: {
        error: 'Unable to set your inverter to charge',
        details: res.error
      }
    };
  }

  console.log(res);

  return {
    payload: {
      ok: true
    }
  };

});

router.post('/agility/solis/inverterCharge', async (Request, ctx) => {
  let body = Request.body;
  let fromTime = body.fromTime;
  let toTime = body.toTime;

  if (!fromTime || fromTime === '') {
    return {
      payload: {
        error: 'From Time not defined or empty'
      }
    };
  }

  if (!fromTime.includes(':')) {
    return {
      payload: {
        error: 'From time is invalid'
      }
    };
  }

  if (!toTime || toTime === '') {
    return {
      payload: {
        error: 'To Time not defined or empty'
      }
    };
  }

  if (!toTime.includes(':')) {
    return {
      payload: {
        error: 'To time is invalid'
      }
    };
  }

  let status = await agility.solis.inverterChargeBetween(fromTime, toTime);

  return {
    payload: status
  };

});

router.post('/agility/solis/inverterDischarge', async (Request, ctx) => {
  let body = Request.body;
  let fromTime = body.fromTime;
  let toTime = body.toTime;

  if (!fromTime || fromTime === '') {
    return {
      payload: {
        error: 'From Time not defined or empty'
      }
    };
  }

  if (!fromTime.includes(':')) {
    return {
      payload: {
        error: 'From time is invalid'
      }
    };
  }

  if (!toTime || toTime === '') {
    return {
      payload: {
        error: 'To Time not defined or empty'
      }
    };
  }

  if (!toTime.includes(':')) {
    return {
      payload: {
        error: 'To time is invalid'
      }
    };
  }

  let status = await agility.solis.inverterDischargeBetween(fromTime, toTime);

  return {
    payload: status
  };

});

router.post('/agility/solis/inverterGridPower', async (Request, ctx) => {
  let body = Request.body;
  let fromTime = body.fromTime;
  let toTime = body.toTime;

  if (!fromTime || fromTime === '') {
    return {
      payload: {
        error: 'From Time not defined or empty'
      }
    };
  }

  if (!fromTime.includes(':')) {
    return {
      payload: {
        error: 'From time is invalid'
      }
    };
  }

  if (!toTime || toTime === '') {
    return {
      payload: {
        error: 'To Time not defined or empty'
      }
    };
  }

  if (!toTime.includes(':')) {
    return {
      payload: {
        error: 'To time is invalid'
      }
    };
  }

  let status = await agility.solis.inverterGridPowerBetween(fromTime, toTime);

  return {
    payload: status
  };

});

router.get('/agility/solis/inverterChargeNow', async (Request, ctx) => {
  let d = agility.date.now();
  let toTimeText = agility.date.at(d.slotEndTimeIndex).timeText;
  let status = await agility.solis.inverterChargeBetween(d.timeText, toTimeText);
  return {
    payload: status
  };
});

router.get('/agility/solis/inverterDischargeNow', async (Request, ctx) => {
  let d = agility.date.now();
  let toTimeText = agility.date.at(d.slotEndTimeIndex).timeText;
  let status = await agility.solis.inverterDischargeBetween(d.timeText, toTimeText);
  agility.solis.startNewDischargeHistoryRecord();
  return {
    payload: status
  };
});

router.get('/agility/solis/inverterGridPowerNow', async (Request, ctx) => {
  let d = agility.date.now();
  let toTimeText = agility.date.at(d.slotEndTimeIndex).timeText;
  let status = await agility.solis.inverterGridPowerBetween(d.timeText, toTimeText);
  return {
    payload: status
  };
});

router.get('/agility/octopus/cheapestSlotsNow', (Request, ctx) => {

  let slots = agility.battery.availableSlotsByPrice(false).slots;

  let fromTimeText = agility.date.now().slotTimeText;

  let slotData = [];
  for (let slot of slots) {
    let d = agility.date.at(slot.timeIndex);
    let date = d.dayText + '/' + d.monthText;
    let time = d.timeText;
    slotData.push({
      date: date,
      time: time,
      price: slot.price
    });
  }

  return {
    payload: {
      slots: slotData,
      slotFrom: fromTimeText,
      untilTomorrow: agility.octopus.tomorrowsTariffsAvailable
    }
  };

});

router.post('/agility/octopus/urlfields', async (Request, ctx) => {

  let body = Request.body;
  let results = await agility.octopus.generateUrlFields(body.accountId, body.key);
  if (!results.error) {
    agility.octopus.accountId = body.accountId;
    agility.octopus.key = body.key;
  }
  return {
    payload: results
  };

});

router.post('/agility/operation/peakSlots', async (Request, ctx) => {

  let body = Request.body;
  if (body && body.slots) {
    let peakSlots = agility.config.$(['operation', 'peakSlots']);
    peakSlots.delete();
    for (let slot in body.slots) {
      peakSlots.$(slot).value = body.slots[slot];
    }
  }

  return {
    payload: {
      ok: true
    }
  };

});


router.get('/agility/positionNow', async (Request, ctx) => {

  let obj = agility.battery.availableSlotsByPrice(false);

  let positionNow = agility.battery.shouldUseSlotToCharge(obj.positionNow, obj.slots, false, false);

  return {
    payload: positionNow
  };
});


router.get('/agility/solis/resetInverter', async (Request, ctx) => {
  let status = await agility.solis.inverterResetNow(true);
  return {
    payload: status
  };
});

router.get('/agility/solis/profile', (Request, ctx) => {
  let res = agility.solis.profile;
  if (res.error) {
    return {
      payload: res
    };
  }

  return {
    payload: {
      profile: res
    }
  };
});

router.get('/agility/solis/data/availableDates', (Request, ctx) => {

  return {
    payload: {
      dates: agility.solis.availableDataDates
    }
  };
});

router.get('/agility/solis/data/history/:dateIndex', (Request, ctx) => {

  let dateIndex = Request.params.dateIndex;
  let history = agility.solis.getHistory(dateIndex);
  let chargeDecisionHistory = agility.battery.getChargeDecisionHistory(dateIndex);

  if (!history) {
    return {
      payload: {
        error: 'No history records for the specified date'
      }
    };
  }

  return {
    payload: {
      history: history,
      chargeDecisionHistory: chargeDecisionHistory,
      battery: {
        max: agility.battery.chargeLimit,
        min: agility.battery.minimumLevel
      }
    }
  };
});

router.get('/agility/solis/productionDelay', (Request, ctx) => {

  let productionDelay = agility.solis.productionDelay / 60000;

  return {
    payload: {
      productionDelay: productionDelay
    }
  };
});

router.post('/agility/solis/productionDelay', (Request, ctx) => {

  let body = Request.body;
  if (body && body.productionDelay && body.productionDelay !== '' && body.productionDelay >= 0 && body.productionDelay < 500) {
    agility.solis.productionDelay = body.productionDelay * 60000;

    return {
      payload: {
        ok: true
      }
    };
  }
  else {
    return {
      payload: {
        error: 'Missing or invalid production delay value'
      }
    };
  }
});



router.get('/agility/solis/reload', async (Request, ctx) => {

  await agility.solis.restore(true);

  return {
    payload: {
      ok: true
    }
  };
});

router.get('/agility/octopus/agiletariff', async (Request, ctx) => {

  let res = await agility.octopus.fetchTariff();
  if (res.error) {
    return {
      payload: {
        error: 'Unable to fetch the Octopus Agile Tariff',
        details: res.error
      }
    };

  }

  return {
    payload: {
      ok: true,
      example: res.results[0]
    }
  };

});

router.get('/agility/octopus/customAgileTariff', (Request, ctx) => {

  let tariffArray = agility.octopus.generateCustomAgileTariff();

  return {
    payload: {
      results: tariffArray
    }
  };

});


router.get('/agility/octopus/customTariff', (Request, ctx) => {

  return {
    payload: agility.octopus.getCustomTariff()
  };

});


router.post('/agility/octopus/customTariff', (Request, ctx) => {

  let body = Request.body;

  if (!body || !body.prices) {
    return {
      payload: {
        error: 'Missing or empty price table'
      }
    };
  }

  agility.octopus.saveCustomTariff(body.prices);
  if (body.cutoff) {
    agility.octopus.calculationCutoffTime = body.cutoff + ':00';
  }

  return {
    payload: {
      ok: true
    }
  };

});

router.get('/agility/octopus/isCustomTariffEnabled', (Request, ctx) => {

  return {
    payload: {
     enabled: agility.octopus.customTariffEnabled
    }
  };

});

router.get('/agility/octopus/enableCustomTariff', (Request, ctx) => {

  let ok = agility.octopus.enableCustomTariff();

  if (!ok) {
    return {
      payload: {
        error: 'You have not saved a Custom Tariff'
      }
    };

  }

  return {
    payload: {
      ok: true
    }
  };

});

router.get('/agility/octopus/disableCustomTariff', (Request, ctx) => {

  agility.octopus.disableCustomTariff();

  return {
    payload: {
      ok: true
    }
  };

});

router.get('/agility/isPeakExportEnabled', (Request, ctx) => {

  return {
    payload: {
     enabled: agility.peakExportEnabled
    }
  };

});

router.get('/agility/enablePeakExport', (Request, ctx) => {

  let ok = agility.enablePeakExport();

  return {
    payload: {
      ok: true
    }
  };

});

router.get('/agility/disablePeakExport', (Request, ctx) => {

  agility.disablePeakExport();

  return {
    payload: {
      ok: true
    }
  };

});


router.get('/agility/solcast/update', async (Request, ctx) => {

  let res = await agility.solcast.request();
  if (res.error) {
    return {
      payload: {
        error: 'Unable to fetch your Solcast prediction',
        details: res.error
      }
    };
  }

  return {
    payload: {
      ok: true,
      example: res.forecasts[0]
    }
  };

});

router.get('/agility/solcast/latest', (Request, ctx) => {
  return {
    payload: agility.solcast.rawData.document
  };
});


router.get('/agility/log/activity/:lastKey', (Request, ctx) => {

  let now = agility.date.now();
  let lastKey = Request.params.lastKey;
  let log = [];
  let count = 0;
  agility.logger.logDoc.$(now.dateIndex).forEachChildNode({from: +lastKey + 1}, function(node) {
    count++;
    if (count > 1000) return false;
    if (node.key !== 'counter') {
      lastKey = +node.key;
      log.push(agility.logger.displayFormat(now.dateIndex, node.key));
    }
    else {
      lastKey = '';
    }
  });

  // prevent browser fetch loop if no log info yet
  if (+lastKey === 0) lastKey = '';

  let lastRecordKey = 0;
  let lc = agility.logger.logDoc.$(now.dateIndex).lastChild;
  if (lc) {
    lc = lc.previousSibling;
    if (lc) lastRecordKey = lc.key;
  }
  return {
    payload: {
      log: log,
      lastKey: lastKey,
      lastRecordKey: lastRecordKey
    }
  };

});

router.get('/agility/nginx/reload', (Request, ctx) => {

  setTimeout(function() {
    agility.exec('/opt/agility/nginx reload');
  }, 1000);

  return {
    payload: {
      ok: true
    }
  };
});

router.get('/agility/update', (Request, ctx) => {

  agility.update();

  return {
    payload: {
      ok: true
    }
  };

});

router.get('/agility/isUpdateAvailable', async (Request, ctx) => {

  let updateAvailable = await agility.isUpdateAvailable();

  return {
    payload: {
      updateAvailable: updateAvailable
    }
  };

});

router.get('/agility/closeSSE/:pid', async (Request, ctx) => {

  let sseDoc = new agility.glsdb.node('agilitySSE.byPid');
  sseDoc.$(Request.params.pid).delete();

  return {
    payload: {
      ok: true
    }
  };

});


router.sse('/agility/sse', function(ws, ctx)  {

  //console.log('in sse handler');
  //console.log(ws);
  ws.write('data:server_process:' + process.pid + '\r\n\r\n');
  
  let sseDoc = new agility.glsdb.node('agilitySSE.byPid');
  sseDoc.$(process.pid).value = Date.now();
  let lastKey = 0;
  let timeout;

  let now = agility.date.now();
  let logDoc = agility.logger.logDoc.$(now.dateIndex);
  if (logDoc.exists) {
    let lastRec = logDoc.lastChild;
    if (lastRec && lastRec.exists) {
      let prevRec = lastRec.previousSibling;
      if (prevRec && prevRec.exists) {
        lastKey = +prevRec.key;
        console.log('lastKey = ' + lastKey);
      }
    }
  } 

  function displayNextLogRecords(lastKey) {
    console.log('starting at ' + lastKey);
    agility.logger.logDoc.$(now.dateIndex).forEachChildNode({from: lastKey + 1}, function(node) {
      if (node.key !== 'counter') {
        lastKey = +node.key;
        ws.write('data:' + agility.logger.displayFormat(now.dateIndex, node.key) + '\r\n\r\n');
      }
    });
    return lastKey;
  }

  lastKey = displayNextLogRecords(lastKey);
  console.log('lastKey is now ' + lastKey);
 

  let fn = function() {
    //get any new records and display them...
    console.log('SIGHUP!');
    lastKey = displayNextLogRecords(lastKey);
    console.log('lastKey is now ' + lastKey);
  };

  process.on('SIGHUP', fn);

  let interval = setInterval(function() {
    if (!sseDoc.$(process.pid).exists) {
      console.log('SSE connection closed');
      process.removeListener('SIGHUP', fn);
      clearTimeout(timeout);
      ws.close();
      clearInterval(interval);
    }
    else {
      ws.write('data:keepalive\r\n\r\n');
    }
  }, 15000);

  timeout = setTimeout(function() {
    sseDoc.$(process.pid).delete();
  }, 360000)

  return {
    payload: {
      ok: true
    }
  };

});


let handler = router.handler();

export {handler};