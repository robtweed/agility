import {glsDB} from 'glsdb';
const glsdb = new glsDB();

glsdb.open({
  type: "YottaDB",
  path: "/usr/local/lib/yottadb/r206",
  env_vars: {
    ydb_gbldir: '/opt/yottadb/yottadb.gld',
    ydb_routines: '/opt/agility/m /usr/local/lib/yottadb/r206/libyottadbutil.so',
    ydb_ci: '/usr/local/lib/yottadb/r206/zmgsi.ci'
  }
});

export {glsdb};
