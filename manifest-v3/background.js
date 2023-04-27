var browser = browser || chrome;

function start() {
  browser.storage.local.get(["database"], v => {
    if (!v.database) {
      // No database found, create it
      browser.tabs.create({
        url: getURL('start.html')
      });
    }
  });

  browser.contextMenus.create({
    id: "report-transphobe",
    title: "Report Transphobe",
    contexts: ["link"],
    targetUrlPatterns: ["*://*.twitter.com/*"]
  });
  browser.contextMenus.create({
    id: "run-setup",
    title: "Re-run setup",
    contexts: ["page"],
    targetUrlPatterns: ["*://*.twitter.com/*"]
  });

  browser.contextMenus.onClicked.addListener(function (info, tab) {
    var action = info.menuItemId;
    if (action == "report-transphobe") {
      browser.tabs.sendMessage(tab.id, {
        "action": "report-transphobe",
        "url": info.linkUrl
      }).then((response) => {
        console.log("Response is " + response);
      });
    } else if (action == "run-setup") {
      browser.tabs.create({
        url: getURL('start.html')
      });
    }
  });
}

function getURL(path) {
  return chrome.runtime.getURL(path);
}

start();