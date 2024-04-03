let database = {
  "entries": {}
}

let localEntries = {};

function initDatabase() {
  browser.storage.local.get(["database", "local_entries"], v => {
    if (v.database) {
      let new_database = v.database || {};
      for (let key in new_database) {
        database[key] = new_database[key];
      }
    }
    if (v.local_entries) {
      localEntries = v.local_entries || {};
    }
  });
}