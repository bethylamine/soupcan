var browser = browser || chrome;

var notifier = new AWN({
  "position": "top-left"
});

var database = {
  "entries": {}
}

var localEntries = {

}

var options = {

}

var state = "";

var isModerator = false;

function init() {
  browser.storage.local.get(["database", "local_entries", "state", "options", "is_moderator"], v => {
    if (v.database) {
      database = v.database || {};
    }
    if (v.local_entries) {
      localEntries = v.local_entries || {};
    }
    if (v.state) {
      state = v.state;
    }
    if (v.options) {
      options = v.options || {};
    }
    if (v.is_moderator) {
      isModerator = v.is_moderator;
    }

    if (options["maskTransphobeMedia"]) {
      document.getElementsByTagName("body")[0].classList.add("wiawbe-mask-media");
    } 
    if (options["maskAllTransphobeMedia"]) {
      document.getElementsByTagName("body")[0].classList.add("wiawbe-mask-all-media");
    } 
    if (options["preventZalgoText"]) {
      document.getElementsByTagName("body")[0].classList.add("hide-zalgo");
    }
  });

  createObserver();
}

function createObserver() {
  var observer = new MutationObserver(mutationsList => {
    for (const mutation of mutationsList) {
      if (location.href != lastUpdatedUrl) {
        updatePage();
      }
      if (mutation.type == 'childList') {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLAnchorElement) {
            processLink(node);
          }
          if (node instanceof HTMLDivElement) {
            checkNode(node);
            if (isProfilePage()) {
              applyLinkToUsernameOnProfilePage();
            }
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

function checkNode(node) {
  var dt = node.getAttribute("data-testid")
  if (dt == "TypeaheadUser" || dt == "typeaheadRecentSearchesItem" || dt == "User-Name" || dt == "UserName" || dt == "conversation") {
    processDiv(node);
  }

  if (dt == "tweet") {
    // mark the tweet as a labelled area
    processDiv(node, true)
  }

  if (node.hasChildNodes()) {
    for(var i = 0; i < node.children.length; i++){
      var child = node.children[i];
      checkNode(child);
    }
  }
}

function updateAllLabels() {
  for (const a of document.getElementsByTagName('a')) {
    processLink(a);
  }
  
  for (const div of document.getElementsByTagName('div')) {
    checkNode(div);
  }

  if (isProfilePage) {
    applyLinkToUsernameOnProfilePage();
  }
}

function isProfilePage() {
  const localUrl = getLocalUrl(location.href);
  if (localUrl) {
    const isProfilePage = localUrl.toLowerCase().startsWith("/" + getIdentifier(localUrl));
    return isProfilePage;
  } else {
    return false;
  }
}

function applyLinkToUsernameOnProfilePage() {
  if (!document.querySelector("a.wiaw-username-link")) {
    // Check for username at top of profile page
    var usernameDiv = document.body.querySelector("div[data-testid='UserName']");
    if (usernameDiv && !usernameDiv.classList.contains("wiawbe-linked")) {
      const link = document.createElement('a');
      link.href = location.href;
      link.classList.add("wiaw-username-link");
      // Remove any previous link wrapper
      var previousLink = usernameDiv.closest("a.wiaw-username-link");
      if (previousLink) {
        //var parent = previousLink.closest("div");
        previousLink.before(previousLink.childNodes[0]); // move username div to just before link
        previousLink.remove(); // delete the link
      }

      usernameDiv.after(link);
      link.appendChild(usernameDiv);
      usernameDiv.classList.add("wiawbe-linked");
      appliedLinkedToUsernameOnProfilePage = true;
    }
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

async function processDiv(div, markArea = false) {
  var div_identifier = div.innerHTML.replace(/^.*?>@([A-Za-z0-9_]+)<.*$/gs, "$1");

  if (!div_identifier) {
    return;
  }

  var database_entry = await getDatabaseEntry(div_identifier);

  var hasLabelToApply = 'has-wiaw-label';
  var labelPrefix = 'wiaw-label-';
  var removedLabel = 'wiaw-removed';

  if (markArea) {
    hasLabelToApply = 'has-wiaw-area-label';
    labelPrefix = 'wiaw-area-label-';
    removedLabel = 'wiaw-area-removed';
  }

  if (database_entry) {
    div.wiawLabel = database_entry["label"]
    div.wiawReason =  database_entry["reason"];
    var labelToApply = labelPrefix + div.wiawLabel;
    if (div.wiawLabel && !div.classList.contains(labelToApply)) {
      div.classList.remove.apply(div.classList, Array.from(div.classList).filter(v => v.startsWith("wiaw-label-")));
      div.classList.add(hasLabelToApply);
      div.classList.add(labelToApply);
      div.setAttribute("data-wiawbeidentifier", div_identifier);
    }
  } else {
    div.classList.remove(hasLabelToApply);
    div.classList.remove(labelToApply);
    div.classList.add(removedLabel);
    div.removeAttribute("data-wiawbeidentifier");
    div.wiawLabel = null;
    div.wiawReason = null;
  }

  if (div.getAttribute("data-testid") == "UserName") {
    addReasonToUserNameDiv(div);
  }

  if (!div.observer) {
    div.observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {

        if (div.getAttribute("data-testid") == "UserName") {
          addReasonToUserNameDiv(div);
        }

        if (mutation.attributeName == "class") {
          var labelToApply = labelPrefix + div.wiawLabel;
          if (div.wiawLabel && !mutation.target.classList.contains(labelToApply)) {
            div.classList.remove.apply(div.classList, Array.from(div.classList).filter(v => v.startsWith(labelPrefix)));
            mutation.target.classList.add(hasLabelToApply);
            mutation.target.classList.add(labelToApply);
          }
        } else if (mutation.attributeName == "data-wiawbe-reason") {
          applyProfileDecorations(div);
        }
      });
    });

    div.observer.observe(div, {attributes: true});
  }
}

function addReasonToUserNameDiv(div) {
  if (!/wiawbe-profile-reason/.test(div.innerHTML)) {
    if (div.wiawReason) {
      div.insertAdjacentHTML("beforeend", "<span id='wiawbe-profile-reason' class='wiawbe-reason'>[" + div.wiawReason + "]</span>");
    }
  }
}

async function identifierRed(identifier) {
  var dbEntry = await getDatabaseEntry(identifier);
  if (dbEntry) {
    if (dbEntry["label"].includes("transphobe")) {
      return true;
    }
  }

  return false;
}

async function getDatabaseEntry(identifier) {
  var hashedIdentifier = await hash(identifier.toLowerCase() + ":" + database["salt"]);

  var databaseEntry = database["entries"][hashedIdentifier];
  var localEntry = localEntries[hashedIdentifier];

  var finalEntry = databaseEntry;

  if (!databaseEntry) {
    if (localEntry) {
      if (localEntry["label"] == "local-transphobe") {
        finalEntry = localEntry;
      }
    }
  }

  if (!localEntry) {
    finalEntry = databaseEntry;
  }

  if (!!databaseEntry && !!localEntry) {
    // prioritize
    if (databaseEntry["label"] == "transphobe" && localEntry["label"] == "local-appeal") {
      finalEntry = localEntry;
    } else {
      finalEntry = databaseEntry;
    }
  }

  return finalEntry;
}

async function processLink(a) {
  if (a.getAttribute("role") == "tab") {
    // don't label tabs
    return;
  }

  var localUrl = getLocalUrl(a.href);
  if (!localUrl) {
    return;
  }
  
  var identifier = getIdentifier(localUrl);
  a.wiawLabel = null;
  a.wiawReason = null;

  const databaseEntry = await getDatabaseEntry(identifier);

  if (databaseEntry) {
    a.wiawLabel = databaseEntry["label"]
    a.wiawReason = databaseEntry["reason"]

    if (!a.className.includes("wiaw-label-" + a.wiawLabel)) {
      a.classList.remove.apply(a.classList, Array.from(a.classList).filter(v => v.startsWith("wiaw-label-")));
      a.classList.remove("has-wiaw-label");
    }

    if (a.wiawLabel && !a.classList.contains('has-wiaw-label')) {
      a.classList.add('has-wiaw-label');
      a.classList.add('wiaw-label-' + a.wiawLabel);
      a.setAttribute("data-wiawbeidentifier", identifier);
    }
  } else {
    a.classList.remove('has-wiaw-label');
    a.classList.remove.apply(a.classList, Array.from(a.classList).filter(v => v.startsWith("wiaw-label-")));
    a.classList.add('wiaw-removed');
    a.wiawLabel = null;
    a.wiawReason = null;
    a.removeAttribute("data-wiawbeidentifier");
  }

  if (!a.observer) {
    a.observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.attributeName == "class" || mutation.attributeName == "href") {
          if (a.wiawLabel) {
            if (!a.className.includes("wiaw-label-" + a.wiawLabel)) {
              a.classList.remove.apply(a.classList, Array.from(a.classList).filter(v => v.startsWith("wiaw-label-")));
              mutation.target.classList.add('has-wiaw-label');
              mutation.target.classList.add('wiaw-label-' + a.wiawLabel);
            }
          }
        }
      });
    });

    a.observer.observe(a, {attributes: true});
  }
}

function getIdentifier(localUrl) {
  if (!localUrl) {
    return null;
  }
  
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
    if (url.includes("#")) {
      url = url.substr(0, url.indexOf("#"));
    }
  } catch {
    return null;
  }


  if (!url) {
    return null;
  }

  var reservedUrls = [
    "/home",
    "/explore",
    "/notifications",
    "/messages",
    "/tos",
    "/privacy"
  ]

  for (const reservedUrl of reservedUrls) {
    if (url == reservedUrl) {
      return null;
    }
  }

  var reservedSlugs = [
    "/compose/",
    "/following",
    "/followers",
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

  for (const reservedSlug of reservedSlugs) {
    if (url.includes(reservedSlug)) {
      return null;
    }
  }

  return url;
}

var lastUpdatedUrl = null;
function updatePage() {
  if (location.href != lastUpdatedUrl) {
    lastUpdatedUrl = location.href;
    appliedLinkedToUsernameOnProfilePage = false;
    var linkedDiv = document.querySelector("div.wiawbe-linked");
    if (linkedDiv) {
      linkedDiv.classList.remove("wiawbe-linked");
    }

    function removeProfileReason() {
      var profileReason = document.getElementById("wiawbe-profile-reason");
      if (profileReason) {
        profileReason.remove();
      }
    }  

    setTimeout(updateAllLabels, 25);
    setTimeout(updateAllLabels, 200);

    setTimeout(removeProfileReason, 25);
    setTimeout(removeProfileReason, 200);
  }
  
  // Color-code all links
  for (const a of document.querySelectorAll('a')) {
    if (a.wiawLabel && !a.classList.contains('has-wiaw-label')) {
      a.classList.add('wiaw-label-' + a.wiawLabel);
      a.classList.add('has-wiaw-label');
    }
  }
  // Color-code all divs
  for (const div of document.querySelectorAll('div')) {
    if (div.wiawLabel && !div.classList.contains('has-wiaw-label')) {
      div.classList.add('wiaw-label-' + div.wiawLabel);
      div.classList.add('has-wiaw-label');
    }
  }
}

async function sendLabel(reportType, identifier, sendResponse, localKey, reason = "") {
  var successMessage = "";
  var failureMessage = "";
  var endpoint = "";

  if (reportType == "transphobe") {
    endpoint = "report-transphobe";
    successMessage = "Report received: @" + identifier;
    failureMessage = "Failed to submit report: ";
    notifier.tip("Sending report: @" + identifier);
  } else if (reportType == "appeal") {
    endpoint = "appeal-label";
    successMessage = "Appeal received: @" + identifier;
    failureMessage = "Failed to submit appeal: ";
    notifier.tip("Sending appeal: @" + identifier);
  } else {
    notifier.alert("Invalid report type: " + reportType);
    return;
  }

  localEntries[localKey]["time"] = Date.now();
  saveLocalEntries();


  // Report to WIAW
  browser.runtime.sendMessage({
    "action": "fetch",
    "url": "https://api.beth.lgbt/" + endpoint + "?state=" + state + "&screen_name=" + identifier + "&reason=" + reason
  }).then(async response => {
    try {
      const jsonData = response["json"];

      localEntries[localKey]["status"] = "received";

      saveLocalEntries();

      notifier.success(successMessage);
      sendResponse(jsonData);
    } catch (error) {
      notifier.alert(failureMessage + error);
      
      updateAllLabels();
      sendResponse("Failed");
    }
  });
  return true;
}

function sendPendingLabels() {
  Object.keys(localEntries).forEach(localKey => {
    const localEntry = localEntries[localKey];

    if (localEntry["status"] == "pending") {
      const when = localEntry["time"];
      const now = Date.now();

      if (!when || now > when + 10000) { // it's been at least 10 seconds
        const reportType = localEntry["label"].replace("local-", "");
        // check if the report already went through
        browser.runtime.sendMessage({
          "action": "fetch",
          "url": "https://api.beth.lgbt/check-report?state=" + state + "&screen_name=" + localEntry["identifier"]
        }).then(async response => {
          try {
            const reported = response["text"];
            if (reported == "1") {
              localEntries[localKey]["status"] = "received";
        
              saveLocalEntries();
            } else {
              notifier.info("Re-sending pending report for @" + localEntry["identifier"] + "...");
              sendLabel(reportType, localEntry["identifier"], () => {}, localKey, localEntry["submitReason"]);
            }
          } catch (error) {
            notifier.alert(error);
          }
        });
      }
    }
  });
}

function saveLocalEntries() {
  browser.storage.local.set({
    "local_entries": localEntries
  });
}

async function checkForDatabaseUpdates() {
  // See if we haven't checked for database updates in a while.
  if (database["downloading"]) {
    return;
  }

  if (database) {
    if (database["last_updated"]) {
      var lastUpdated = database["last_updated"];
      if (Date.now() > lastUpdated + 5 * 60 * 1000) { // 5 minutes
        browser.runtime.sendMessage({
          "action": "fetch",
          "url": "https://api.beth.lgbt/get-db-version"
        }).then(async response => {
          const version = response["text"];
          const numberVersion = parseInt(version);
          if (!database["version"] || database["version"] < numberVersion) {
            // update the database
            updateDatabase(() => {}, numberVersion);
          }
          database["last_updated"] = Date.now();
        });
      }
    }
  }
}

async function updateDatabase(sendResponse, version) {
  notifier.info("Database downloading");
  database["downloading"] = true;
  browser.runtime.sendMessage({
    "action": "fetch",
    "url": "https://wiaw-extension.s3.us-west-2.amazonaws.com/dataset.json"
  }).then(async response => {
    try {
      const jsonData = response["json"];

      database = {
        "version": version,
        "last_updated": Date.now(),
        "salt": jsonData["salt"],
        "entries": jsonData["entries"],
        "downloading": false,
      };

      browser.storage.local.set({
        "database": database
      });
      notifier.success("Database updated!");
      sendResponse("OK");
    } catch (error) {
      database["downloading"] = false;
      notifier.alert("Database update failed! " + error);
      sendResponse("Fail");
      return true;
    }
  });

  return true;
}

// Receive messages from background script
browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action == "report-transphobe") {
    if (!state) {
      sendResponse("Invalid state!");
      return true;
    }
    var localUrl = getLocalUrl(message.url);
    if (!localUrl) {
      notifier.alert("Invalid report target");
      sendResponse("Invalid report target!");
      return true;
    }

    const identifier = getIdentifier(localUrl);

    // see if they're already reported
    const dbEntry = await getDatabaseEntry(identifier);
    if (dbEntry && dbEntry["label"] && dbEntry["label"].includes("transphobe")) {
      notifier.alert("@" + identifier + " is already souped! 🍅🥫");
      return false;
    } else {
      var clonedTweetButton = document.querySelector("a[aria-label='Tweet']").cloneNode(true);
      var icon = clonedTweetButton.querySelector("div[dir='ltr'] svg");
      if (icon) {
        icon.remove();
      }
      clonedTweetButton.href = "javascript:void(0)";

      for (const span of clonedTweetButton.querySelectorAll('span')) {
        span.innerText = 'Send Report';
      }

      notifier.modal(
        '<h2>🍅 Report @' + identifier + "</h2><p>You can provide reasoning for your report here, if you think it may help verify your report, including links to tweets, etc. It's optional, so if it's obvious, feel free to skip it.</p><textarea rows='8' cols='50' maxlength='1024' id='wiawbe-reason-textarea'></textarea>",
        'modal-reason'
      );
      var popupElements = document.getElementsByClassName("awn-popup-modal-reason");
      var bodyBackgroundColor = document.getElementsByTagName("body")[0].style["background-color"];
      var textColor = window.getComputedStyle(document.querySelector("span"), null).getPropertyValue("color");
      if (popupElements) {
        for (let el of popupElements) {
          el.style["background-color"] = bodyBackgroundColor;
          el.style["color"] = textColor;
        }
      }
      var textArea = document.getElementById("wiawbe-reason-textarea");
      if (textArea) {
        textArea.style["backgroundColor"] = bodyBackgroundColor;
        textArea.style["color"] = textColor;
        textArea.style["border-color"] = textColor;
      }
      textArea.after(clonedTweetButton);

      clonedTweetButton.addEventListener('click', async function() {
        textArea.disabled = true;
        var submitReason = textArea.value;
        var awnPopupWrapper = document.getElementById("awn-popup-wrapper");
        awnPopupWrapper.classList.add("awn-hiding");
        setTimeout(() => awnPopupWrapper.remove(), 300);
        
        // Add locally
        var localKey = await hash(identifier + ":" + database["salt"])
        localEntries[localKey] = {"label": "local-transphobe", "reason": "Reported by you", "status": "pending", "submitReason": submitReason, "time": Date.now(), "identifier": identifier};

        saveLocalEntries();
        
        updateAllLabels();
        sendLabel("transphobe", identifier, sendResponse, localKey, submitReason);
      });
      return true;
    }
  } else if (message.action == "appeal-label") {
    if (!state) {
      sendResponse("Invalid state!");
      return true;
    }
    var localUrl = getLocalUrl(message.url);
    if (!localUrl) {
      notifier.alert("Invalid appeal target");
      sendResponse("Invalid report target!");
      return true;
    }

    const identifier = getIdentifier(localUrl);

    dbEntry = await getDatabaseEntry(identifier);
    if (dbEntry || isModerator) {
      // Add locally
      var localKey = await hash(identifier + ":" + database["salt"])
      localEntries[localKey] = {"label": "local-appeal", "reason": "Appealed by you", "status": "pending", "time": Date.now(), "identifier": identifier};

      saveLocalEntries();
      
      updateAllLabels();
      sendLabel("appeal", identifier, sendResponse, localKey);
    } else {
      notifier.warning("Nothing to appeal");
    }
    return true;
  } else if (message.action == "update-database") {
    updateDatabase(sendResponse, database["version"]);
  }
  return false;
});

init();
setInterval(updatePage, 10000);
setInterval(updateAllLabels, 3000);
setInterval(sendPendingLabels, 4000);
setInterval(checkForDatabaseUpdates, 10000);