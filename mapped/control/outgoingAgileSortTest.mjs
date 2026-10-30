import {Agility} from '/opt/agility/mapped/agility.mjs';

let agility = new Agility();

agility.octopus.sortRemainingAgileExportSlotsForToday();
//agility.octopus.sortAllAgileExportSlotsForDay(1);
//agility.octopus.sortAgileExportSlots();
let json = agility.octopus.bestExportPrices;
console.log(JSON.stringify(json, null, 2));

