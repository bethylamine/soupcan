var browser = browser || chrome;

console.log("I've been loaded!")

var database = {
  "entries": {}
}

var local_entries = {

}

function init() {
  browser.storage.local.get(["database", "local_entries"], v => {
    if (v.database) {
      database = v.database;
      console.log("Loaded database");
    }
    if (v.local_entries) {
      local_entries = v.local_entries;
      console.log("Loaded local entries");
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

function processLink(a) {
  localUrl = getLocalUrl(a.href);
  if (!localUrl) {
    return;
  }
  
  identifier = getIdentifier(localUrl);

  database_entry = database["entries"][identifier];
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
  url = url.replace(new URL(url).origin, "");

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

init();
setInterval(updatePage, 1000);
setInterval(updateAllLabels, 2000);