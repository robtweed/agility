import {Agility} from '/opt/agility/mapped/agility.mjs';
let agility = new Agility();

let obj = agility.battery.positionNow(false, '22:30');

if (agility.isAlreadyRunning) {

let status = 'UNKNOWN';
if (obj.deficit > 0) {
status = 'DEFICIT';
}
if (obj.deficit <= 0) {
status = 'SURPLUS';
}

agility.logger.write('Checking Status for Export Management:');
console.log('AGILITY STATUS:');
console.log(obj.deficit);
console.log(status);
console.log('FORECAST LOAD:');
console.log(obj.solis.load);
console.log('BATTERY RESERVE:');
console.log(obj.battery.availablePower);
console.log('FORECAST SOLAR GENERATION:');
console.log(obj.solcast.adjustedPrediction);
console.log('FORECAST BATTERY SURPLUS:');
console.log(obj.battery.availablePower - obj.solis.load);

if (obj.battery.availablePower - obj.solis.load < 0) {
status = 'DEFICIT';
}

agility.logger.write(status);
console.log(status);

let url = '/v2/api/atRead';
let body ={
  inverterSn: agility.solis.inverterSn,
  cid: 636
};

let resp = await agility.solis.api(url, body);
console.log(resp);
//resp.data.msg = 2;
//resp.data.msg = 35;
//resp.data.msg = 43;
//resp.data.msg = 98;
//resp.data.msg = 99;

let newVal = parseInt(resp.data.msg);
let ourBits = (newVal & 1) + (newVal & 64);

console.log('Solis Bits');
console.log(newVal.toString(2).padStart(16,'0'));
console.log('Bits of Interest');
console.log(ourBits.toString(2).padStart(16,'0'));

if ((newVal & 1) + (newVal & 64) == 65) {
console.log('Mode is UNKNOWN');
newVal = resp.data.msg;
console.log('Do nothing');
}
else if ((newVal & 1) + (newVal & 64) == 0) {
console.log('Mode is UNKNOWN');
newVal = resp.data.msg;
console.log('Do nothing');
}
else if ((resp.data.msg & 1) == 1) {
agility.logger.write('Mode is Self-Use');
console.log('Mode is Self-Use');
newVal = newVal + 64 - 1;
console.log('If needed, SetCID 636 to ' + newVal + ' to change to Feed-in Priority mode');
console.log(newVal.toString(2).padStart(16,'0'));
if (status == 'SURPLUS' && (resp.data.msg & 1) == 1) {
console.log('CHANGE MODE');
agility.logger.write('CHANGE MODE');
let resFIP = await agility.solis.controlAPI(636, newVal)
agility.logger.write(resFIP)
console.log(resFIP)
}
else {
agility.logger.write('MODE ALREADY CORRECT');
console.log('MODE ALREADY CORRECT');
}
}
else if ((resp.data.msg & 64) == 64) {
agility.logger.write('Mode is Feed-In Priority');
console.log('Mode is Feed-In Priority');
newVal = newVal - 64 + 1;
console.log('Set CID 636 to ' + newVal + ' to change to Self-Use mode');
console.log(newVal.toString(2).padStart(16,'0'));
if (status == 'DEFICIT' && (resp.data.msg & 64) == 64) {
agility.logger.write('CHANGE MODE');
console.log('CHANGE MODE');
let resSU = await agility.solis.controlAPI(636, newVal)
console.log(resSU)
agility.logger.write(resSU)
}
else {
console.log('MODE CORRECT');
}
}

}
else {
console.log('Agility is not running');
}
console.log('=======================');
agility.glsdb.close();


