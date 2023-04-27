var browser = browser || chrome;

console.log("I've been loaded!")

var database = {
  "entries": {}
}

var local_entries = {

}

var state = "";

function init() {
  browser.storage.local.get(["database", "local_entries", "state"], v => {
    if (v.database) {
      database = v.database;
      console.log("Loaded database");
    }
    if (v.local_entries) {
      local_entries = v.local_entries;
      console.log("Loaded local entries");
    }
    if (v.state) {
      state = v.state;
      console.log("Loaded state");
    }
  });
  
  createObserver();
}


function createObserver() {
  var observer = new MutationObserver(mutationsList => {
    for (const mutation of mutationsList) {
      if (mutation.type == 'childList') {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLAnchorElement) {
            processLink(node);
          }
          if (node instanceof HTMLElement) {
            for (const subnode of node.querySelectorAll('a')) {
              processLink(subnode);
            }
          }
        }
      }
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function updateAllLabels() {
  for (const a of document.getElementsByTagName('a')) {
    processLink(a);
  }
}

function hash(string) {
  const utf8 = new TextEncoder().encode(string);
  return crypto.subtle.digest('SHA-256', utf8).then((hashBuffer) => {
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((bytes) => bytes.toString(16).padStart(2, '0'))
      .join('');
    return hashHex;
  });
}

async function processLink(a) {
  localUrl = getLocalUrl(a.href);
  if (!localUrl) {
    return;
  }
  
  identifier = getIdentifier(localUrl);

  hashed_identifier = await hash(identifier + ":" + database["salt"]);

  database_entry = database["entries"][hashed_identifier];
  if (database_entry) {
    a.wiawLabel = database_entry["label"]
    if (a.wiawLabel && !a.classList.contains('has-wiaw-label')) {
      a.classList.add('has-wiaw-label');
      a.classList.add('wiaw-label-' + a.wiawLabel);
    }
  } else {
    a.classList.remove('has-wiaw-label');
    a.classList.remove('wiaw-label-' + a.wiawLabel);
    a.classList.add('wiaw-removed');
    a.wiawLabel = null;
  }

  if (!a.observer) {
    a.observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.attributeName == "class") {
          if (a.wiawLabel && !mutation.target.classList.contains('has-wiaw-label')) {
            mutation.target.classList.add('has-wiaw-label');
            mutation.target.classList.add('wiaw-label-' + a.wiawLabel);
          }
        }
      });
    });

    a.observer.observe(a, {attributes: true});
  }
}

function getIdentifier(localUrl) {
  var identifier = localUrl;

  if (identifier.startsWith("/")) {
    identifier = identifier.substr(1);
  }

  if (identifier.includes("/")) {
    identifier = identifier.substr(0, identifier.indexOf("/"));
  }

  return identifier.toLowerCase();
}

function getLocalUrl(url) {
  try {
    url = url.replace(new URL(url).origin, "");
  } catch {
    return null;
  }


  if (!url) {
    return null;
  }

  var reserved_urls = [
    "/home",
    "/explore",
    "/notifications",
    "/messages",
    "/tos",
    "/privacy"
  ]

  for (const reserved_url of reserved_urls) {
    if (url == reserved_url) {
      return null;
    }
  }

  var reserved_slugs = [
    "/compose/",
    "/explore/",
    "/i/",
    "/articles/",
    "/hashtag/",
    "/resources/",
    "/search?",
    "/help/",
    "/troubleshooting/",
    "/analytics",
  ]

  for (const reserved_slug of reserved_slugs) {
    if (url.includes(reserved_slug)) {
      return null;
    }
  }

  return url;
}

var lastUpdatedUrl = null;
function updatePage() {
  if (location.href != lastUpdatedUrl) {
    lastUpdatedUrl = location.href;
    setTimeout(updateAllLabels, 25);
    setTimeout(updateAllLabels, 200);
  }
  
  // Color-code all links
  for (const a of document.querySelectorAll('a')) {
    if (a.wiawLabel && !a.classList.contains('has-wiaw-label')) {
      a.classList.add('wiaw-label-' + a.wiawLabel);
      a.classList.add('has-wiaw-label');
    }
  }
}

// Receive messages from background script
browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log(message);
  if (message.action == "report-transphobe") {
    if (!state) {
      sendResponse("Invalid state!");
      return true;
    }
    var localUrl = getLocalUrl(message.url);
    if (!localUrl) {
      sendResponse("Invalid report target!");
      return true;
    }

    identifier = getIdentifier(localUrl);

    const response = await fetch("https://api.beth.lgbt/report-transphobe?state=" + state + "&screen_name=" + identifier);
    const jsonData = await response.json();
    console.log(jsonData);
    sendResponse(jsonData);
    return true;
  }
  sendResponse("Hello from content!");
  return true;
});

init();
setInterval(updatePage, 1000);
setInterval(updateAllLabels, 2000);