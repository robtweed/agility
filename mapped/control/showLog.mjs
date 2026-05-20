import {Agility} from '/opt/agility/mapped/agility.mjs';

let agility = new Agility();

let offset = process.argv[2] || 0;
let dateIndex = agility.getDateIndex(offset);

agility.logger.logDoc.$(dateIndex).forEachChildNode(function(node) {
  if (node.key !== 'counter') {
    console.log(agility.logger.displayFormat(dateIndex, node.key));
  }
});

agility.glsdb.close();
