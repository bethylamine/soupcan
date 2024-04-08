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

function hash(string) {
  const utf8 = new TextEncoder().encode(string);
  return crypto.subtle.digest('SHA-256', utf8).then((hashBuffer) => {
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray
        .map((bytes) => bytes.toString(16).padStart(2, '0'))
        .join('');
  });
}
async function getDatabaseEntry(identifier) {
  const hashedIdentifier = await hash(identifier.toLowerCase() + ":" + database["salt"]);

  const databaseEntry = database["entries"][hashedIdentifier];
  let localEntry = localEntries[hashedIdentifier];
  let finalEntry = databaseEntry;

  if (localEntry) {
    // Treat local entries with detected reason as nonexistent.
    if (localEntry["reason"] === "Detected by Shinigami Eyes") {
      localEntry = null;
    }
  }

  if (!!localEntry) {
    // Local entry takes precedence over db
    finalEntry = localEntry;
  }

  // check for time precedence
  if (!!databaseEntry && !!localEntry) {
    if (databaseEntry["time"] && !localEntry["time"]) {
      finalEntry = databaseEntry;
    } else if (localEntry["time"] && !databaseEntry["time"]) {
      finalEntry = localEntry;
    } else if (databaseEntry["time"] && localEntry["time"]) {
      if (databaseEntry["time"] > localEntry["time"]) {
        finalEntry = databaseEntry;
      } else {
        finalEntry = localEntry;
      }
    }
  }

  if (!!databaseEntry && databaseEntry["label"] == "transphobe" && !!localEntry && localEntry["label"] == "local-transphobe") {
    // Report was accepted
    finalEntry = databaseEntry;
  }
  if (!!databaseEntry && databaseEntry["label"] == "appealed" && !!localEntry && localEntry["label"] == "local-appeal") {
    // Appeal was accepted
    finalEntry = databaseEntry;
  }

  if (finalEntry && finalEntry["label"] === "appealed") {
    return null;
  }
  
  return finalEntry;
}