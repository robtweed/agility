import {Agility} from './agility.mjs';

let agility = new Agility();
agility.stop();
agility.waitUntilStopped();
agility.glsdb.close();

