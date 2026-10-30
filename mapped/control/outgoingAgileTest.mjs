import {Agility} from '/opt/agility/mapped/agility.mjs';

let agility = new Agility();


let json = await agility.octopus.getLatestAgileExportTariffTable();
console.log(JSON.stringify(json, null, 2));

