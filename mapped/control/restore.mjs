import {Agility} from '/opt/agility/mapped/agility.mjs';
import fs from 'fs';

// restore from backup if backup file exists but no Agility data in YDB
//  use the logger data document as an indication of this

let filepath = '/opt/agility/mapped/logs/agility.bak';

if (fs.existsSync(filepath)) {

  let agility = new Agility();
  if (!agility.logger.logDoc.exists) {
    await agility.backup.restore(filepath);
    agility.solis.data.delete();
    let sseDoc = new agility.glsdb.node('agilitySSE');
    sseDoc.delete();
  }
  // start Agility Daemon
  agility.exec('nohup /root/.bun/bin/bun /opt/agility/mapped/start.mjs >> /opt/agility/mapped/logs/agility.log 2>&1 &');
  agility.glsdb.close();
}
