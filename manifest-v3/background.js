var browser = browser || chrome;

const blueBlockerExtensionIds = [
  "jgpjphkbfjhlbajmmcoknjjppoamhpmm", // Chrome
  "{119be3f3-597c-4f6a-9caf-627ee431d374}", // Firefox
  "jphoieibjlbddgacnjpfjphmpambipfl" // local testing
];

function iOS() {
  return [
    'iPad Simulator',
    'iPhone Simulator',
    'iPod Simulator',
    'iPad',
    'iPhone',
    'iPod'
  ].includes(navigator.platform) || navigator.maxTouchPoints &&
  navigator.maxTouchPoints > 2 &&
  /MacIntel/.test(navigator.platform);
}

function start() {
  initDatabase();

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

    if (v.state) {
      handleFetch("https://api.beth.lgbt/moderation/is-moderator?state=" + v.state, response => {
        if (response["text"] == "1") {
          browser.storage.local.set({
            "is_moderator": true
          });
          if (!iOS()) {
            browser.contextMenus.create({
              id: "moderate",
              title: browser.i18n.getMessage("actionModerateReports"),
              contexts: ["page"]
            });
          }
        }
      });
    }
  });

  if (!browser.menus) {
    browser.menus = browser.contextMenus;
  }

  if (!iOS()) {
    browser.contextMenus.create({
      id: "report-transphobe",
      title: browser.i18n.getMessage("actionReportTransphobe"),
      contexts: ["link"],
      targetUrlPatterns: ["*://*.twitter.com/*", "*://*.x.com/*"]
    });
    browser.contextMenus.create({
      id: "appeal-label",
      title: browser.i18n.getMessage("actionAppealLabel"),
      contexts: ["link"],
      targetUrlPatterns: ["*://*.twitter.com/*", "*://*.x.com/*"]
    });
    browser.contextMenus.create({
      id: "search-tweets",
      title: browser.i18n.getMessage("searchTweets"),
      contexts: ["link"],
      targetUrlPatterns: ["*://*.twitter.com/*", "*://*.x.com/*"]
    });
    browser.menus.create({
      id: "run-setup",
      title: browser.i18n.getMessage("actionRerunSetup"),
      contexts: ["page"]
    });
    browser.menus.create({
      id: "update-database",
      title: browser.i18n.getMessage("actionUpdateDatabase"),
      contexts: ["page"]
    });
    browser.menus.create({
      id: "options",
      title: browser.i18n.getMessage("actionOptions"),
      contexts: ["page"]
    });
    browser.menus.create({
      id: "wiawbot",
      title: browser.i18n.getMessage("actionWiawbot"),
      contexts: ["page"]
    });
  }

  browser.contextMenus.onClicked.addListener(function (info, tab) {
    switch (info.menuItemId) {
      case "appeal-label":
        browser.tabs.sendMessage(tab.id, {
          "action": "appeal-label",
          "url": info.linkUrl
        }).then((response) => {
          // ?
        });
        break;
      case "moderate":
        browser.tabs.create({
          url: getURL('moderation.html')
        });
        break;
      case "options":
        browser.tabs.create({
          url: getURL('options.html')
        });
        break;
      case "wiawbot":
        browser.tabs.create({
          url: getURL('wiawbot.html')
        });
        break;
      case "report-transphobe":
        browser.tabs.sendMessage(tab.id, {
          "action": "report-transphobe",
          "url": info.linkUrl
        }).then((response) => {
          // ?
        });
        break;
      case "run-setup":
        browser.tabs.create({
          url: getURL('start.html')
        });
        break;
      case "search-tweets":
        browser.tabs.sendMessage(tab.id, {
          "action": "search-tweets",
          "url": info.linkUrl
        }).then((response) => {
          if (response) {
            browser.tabs.create({
              url: "https://twitter.com/search?q=from%3A" + response + "%20(trans%20OR%20transgender%20OR%20gender%20OR%20TERF%20OR%20cis)&src=typed_query&f=top"
            });
          }
        });
        break;
      case "update-database":
        browser.tabs.sendMessage(tab.id, {
          "action": "update-database"
        }).then((response) => {
          // ?
        });
        break;
      default:
        // Do not process.
        break;
    }
  });
}

function getURL(path) {
  return chrome.runtime.getURL(path);
}

async function doFetch(url) {
  return new Promise((resolve, reject) => {
    function callback(response) {
      if ([200, 201, 202].includes(response["status"])) {
        resolve(response);
      } else {
        reject(response);
      }
    };

    handleFetch(url, callback);
  });
}

const handleFetch = async (url, sendResponse) => {
  const response = await fetch(url);
  var json = "";
  try {
    json = await response.clone().json();
  } catch (error) {

  }
  const text = await response.text();
  sendResponse({"status": response.status, "text": text, "json": json});
};

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action == "fetch") {
    handleFetch(message.url, sendResponse);
    return true;
  }
  return false;
});

// BlueBlocker integration
browser.runtime.onMessageExternal.addListener((m, s, r) => { (async (message, sender, sendResponse) => {
  console.log("Got external message",message,sender);
  if (blueBlockerExtensionIds.includes(sender.id)) {
    if (message.action == "check_twitter_user") {
      if (message.screen_name) {
        let dbEntry = await getDatabaseEntry(message.screen_name);

        if (dbEntry) {
          sendResponse({
            status: dbEntry["label"].includes("transphobe") ? "transphobic" : "normal",
            reason: dbEntry.reason,
            reported_at: dbEntry.time
          });
        } else {
          sendResponse({
            screen_name: message.screen_name,
            status: "not_found",
          });
        }
      }
    }
  }
})(m, s, r); return true });

if ('function' === typeof(importScripts)) {
  importScripts("shinigami_eyes_data1.js", "shinigami_eyes_data2.js", "shinigami.js", "database.js");
}
start();
