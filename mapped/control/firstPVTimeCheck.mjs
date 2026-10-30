import {Agility} from '/opt/agility/mapped/agility.mjs';

let agility = new Agility();


let d = agility.firstPVTimeToday;
console.log(JSON.stringify(d, null, 2));

