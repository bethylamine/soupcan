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

function hash(identifier) {
  let string = identifier + ":" + database["salt"];
  const utf8 = new TextEncoder().encode(string);
  return crypto.subtle.digest('SHA-256', utf8).then((hashBuffer) => {
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((bytes) => bytes.toString(16).padStart(2, '0'))
      .join('');
    return hashHex;
  });
}

async function getDatabaseEntry(identifier) {
  var hashedIdentifier = await hash(identifier.toLowerCase());

  var databaseEntry = database["entries"][hashedIdentifier];
  var localEntry = localEntries[hashedIdentifier];
  var isTransphobeInShinigamiEyes = shinigami.test(identifier);

  var finalEntry = databaseEntry;

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
  if (!!databaseEntry && databaseEntry["label"] == "transphobe" && !!localEntry && localEntry["label"] == "transphobe-se") {
    // Shinigami Eyes report was accepted
    finalEntry = databaseEntry;
  }
  if (!!databaseEntry && databaseEntry["label"] == "appealed" && !!localEntry && localEntry["label"] == "local-appeal") {
    // Appeal was accepted
    finalEntry = databaseEntry;
  }

  if (!finalEntry) {
    if (isTransphobeInShinigamiEyes) {
      // Create an entry to show they are marked in Shinigami
      finalEntry = {
        "screen_name": identifier,
        "label": "transphobe-se",
        "reason": "Detected by Shinigami Eyes",
        "time": Date.now()
      };

      localEntries[hashedIdentifier] = finalEntry;
      saveLocalEntries();

      // Report to server
      try {
        var fetchUrl = "https://api.beth.lgbt/report-shinigami?screen_name=" + identifier;
        doFetch(fetchUrl);
      } catch (error) {
        // ignore
      }
    }
  }
  
  return finalEntry;
}