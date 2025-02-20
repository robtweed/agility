import {Agility} from '/opt/agility/mapped/agility.mjs';
let agility = new Agility();

let obj = agility.battery.positionNow(false, '02:00');

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
console.log('BATTERY INCREMENT PER SLOT:');
console.log(obj.battery.increasePerCharge.toFixed(2) + '%');
console.log('BATTERY RESERVE:');
console.log(obj.battery.availablePower);
console.log('FORECAST SOLAR GENERATION:');
console.log(obj.solcast.adjustedPrediction);
console.log('FORECAST BATTERY SURPLUS:');
console.log(obj.battery.availablePower - obj.solis.load);

if (obj.battery.availablePower - obj.solis.load > obj.battery.powerAddedPerCharge) {
status = 'EXPORTABLE BATTERY SURPLUS';
let resp = await agility.solis.inverterDischarge(1);
console.log(resp);
agility.logger.write('EXPORTING FOR THIS TIMESLOT');
}

agility.logger.write(status);
console.log(obj.battery.availablePower - obj.solis.load);
console.log(obj.battery.powerAddedPerCharge);
console.log(status);


};

console.log('=======================');
agility.glsdb.close();


