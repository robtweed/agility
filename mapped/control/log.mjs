import {Agility} from '/opt/agility/mapped/agility.mjs';

let agility = new Agility();
agility.logger.log(-1, '00:00', '01:30');
agility.glsdb.close();

