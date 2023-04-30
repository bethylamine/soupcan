var browser = browser || chrome;

function start() {
  browser.storage.local.get(["database", "state"], v => {
    if (!v.database) {
      if (!v.state) {
        // First time setup
        browser.tabs.create({
          url: getURL('start.html')
        });
      } else {
        // Logged in but not database
        browser.tabs.create({
          url: getURL('start.html?download=1')
        });
      }
    }
  });

  browser.contextMenus.create({
    id: "report-transphobe",
    title: "🍅 Report transphobe",
    contexts: ["link"],
    targetUrlPatterns: ["*://*.twitter.com/*"]
  });
  browser.contextMenus.create({
    id: "appeal-label",
    title: "😇 Appeal label",
    contexts: ["link"],
    targetUrlPatterns: ["*://*.twitter.com/*"]
  });
  browser.contextMenus.create({
    id: "run-setup",
    title: "📐 Re-run setup",
    contexts: ["page"],
    targetUrlPatterns: ["*://*.twitter.com/*"]
  });
  browser.contextMenus.create({
    id: "update-database",
    title: "🌐 Update database",
    contexts: ["page"],
    targetUrlPatterns: ["*://*.twitter.com/*"]
  });

  browser.contextMenus.onClicked.addListener(function (info, tab) {
    var action = info.menuItemId;
    if (action == "appeal-label") {
      browser.tabs.sendMessage(tab.id, {
        "action": "appeal-label",
        "url": info.linkUrl
      }).then((response) => {
        console.log("Response is " + response);
      });
    } else if (action == "report-transphobe") {
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
    } else if (action == "update-database") {
      browser.tabs.sendMessage(tab.id, {
        "action": "update-database"
      }).then((response) => {
        console.log("Response is " + response);
      });
    }
  });
}

function getURL(path) {
  return chrome.runtime.getURL(path);
}

const handleFetch = async (url, sendResponse) => {
  const response = await fetch(url);
  console.log("Got fetch response");
  console.log(response);
  var json = "";
  try {
    json = await response.clone().json();
  } catch (error) {

  }
  const text = await response.text();
  sendResponse({"text": text, "json": json});
  //sendResponse(response);
};

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Got message");
  if (message.action == "fetch") {
    console.log("Got fetch command");
    handleFetch(message.url, sendResponse);
    return true;
  }
  return false;
});

start();