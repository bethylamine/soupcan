var browser = browser || chrome;

var database = {
  "entries": {}
}

var localEntries = {

};

var options = {

};

var state = "";

var isModerator = false;

var notifier = new AWN();

function init() {
  notifier = new AWN({
    "position": "top-left",
    "labels": {
      "tip": browser.i18n.getMessage("toast_label_tip"),
      "info": browser.i18n.getMessage("toast_label_info"),
      "success": browser.i18n.getMessage("toast_label_success"), 
      "warning": browser.i18n.getMessage("toast_label_warning"),
      "alert": browser.i18n.getMessage("toast_label_alert"),
    }
  });
  
  browser.storage.local.get(["database", "local_entries", "state", "is_moderator"], v => {
    if (v.database) {
      database = v.database || {};
    }
    if (v.local_entries) {
      localEntries = v.local_entries || {};
    }
    if (v.state) {
      state = v.state;
    }
    if (v.is_moderator) {
      isModerator = v.is_moderator;
    }
  });

  applyOptions();
  createObserver();
}

function applyOptions() {
  if (checkForInvalidExtensionContext()) {
    return;
  }

  browser.storage.local.get(["options"], v => {
    var oldOptions = {...options};
    var different = false;

    if (v.options) {
      options = v.options || {};
    }

    for (let optionKey in options) {
      if (options[optionKey] != oldOptions[optionKey]) {
        different = true;
      }
    }
    for (let optionKey in oldOptions) {
      if (options[optionKey] != oldOptions[optionKey]) {
        different = true;
      }
    }

    if (!different) {
      return;
    }

    const body = document.getElementsByTagName("body")[0];

    if (options["maskMode"]) {
      var mm = options["maskMode"];
      body.classList.remove.apply(body.classList, Array.from(body.classList).filter(v => v.startsWith("wiawbe-mask-")));
      switch (mm) {
        case "direct-media-only":
          body.classList.add("wiawbe-mask-direct-media");
          break;
        case "media-incl-retweets":
          body.classList.add("wiawbe-mask-direct-media");
          body.classList.add("wiawbe-mask-media-incl-retweets");
          break;
        case "all-content":
          body.classList.add("wiawbe-mask-direct-media");
          body.classList.add("wiawbe-mask-media-incl-retweets");
          body.classList.add("wiawbe-mask-all-content");
          break;
      }
    }
    
    body.classList.remove("wiawbe-hide-zalgo");
    if (options["preventZalgoText"]) {
      body.classList.add("wiawbe-hide-zalgo");
    }
  });
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
            checkNode(node, true);
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

var nodeCheckCache = {}
var divCacheId = 1;

function checkNode(node, force = false) {
  node.cacheId = node.cacheId || ('hashID' + (divCacheId++));

  if (!force) {
    if (node.cacheId in nodeCheckCache) {
      if (Date.now() - nodeCheckCache[node.cacheId] < 2000) {
        return;
      }
    }
  }

  nodeCheckCache[node.cacheId] = Date.now() + Math.floor(Math.random() * 2000);

  var dt = node.getAttribute("data-testid")
  if (dt == "TypeaheadUser" || dt == "typeaheadRecentSearchesItem" || dt == "User-Name" || dt == "UserName" || dt == "conversation") {
    processDiv(node);
  }

  if (dt == "tweet") {
    // mark the tweet as a labelled area
    processDiv(node, true)
  }

  processForMasking(node);

  if (node.hasChildNodes()) {
    for(var i = 0; i < node.children.length; i++){
      var child = node.children[i];
      checkNode(child);
    }
  }
}

function processForMasking(node) {
  var tweets = node.querySelectorAll("article[data-testid='tweet']:not([data-wiawbe-mask-checked])");

  tweets.forEach(tweet => {
    applyMasking(tweet);
  });
}

function applyAuthorMaskingObserver(authorElement, callback) {
  if (!authorElement.maskingObserver) {
    authorElement.maskingObserver = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.attributeName == "data-wiawbeidentifier") {
          callback();
        }
      });
    });

    authorElement.maskingObserver.observe(authorElement, {attributes: true});
  }
}

function applyMasking(tweet) {
  // Check if there is a social context element e.g. ("Username Retweeted")
  var socialContext = tweet.querySelector("span[data-testid='socialContext']");
  if (socialContext) {
    var userLink = socialContext.closest("a");
    applyAuthorMaskingObserver(userLink, () => applyMasking(tweet));
    if (userLink.className.includes("transphobe")) {
      // User in social context is a transphobe
      tweet.setAttribute("wiawbe-mask-tag", "retweet");

    }
  }

  // Check for the tweet author
  var tweetAuthor = tweet.querySelector("div[data-testid='User-Name'] a");
  if (tweetAuthor) {
    applyAuthorMaskingObserver(tweetAuthor, () => applyMasking(tweet));
    if (tweetAuthor.className.includes("transphobe")) {
      tweet.setAttribute("wiawbe-mask-tag", "tweet");
    }
  }

  var videoComponent = tweet.querySelector("div[data-testid='videoComponent']");
  if (videoComponent) {
    videoComponent.setAttribute("wiawbe-mask-tag", "media");
  }

  var tweetPhotos = tweet.querySelectorAll("div[data-testid='tweetPhoto']");
  if (tweetPhotos) {
    tweetPhotos.forEach(tweetPhoto => {
      tweetPhoto.setAttribute("wiawbe-mask-tag", "media");
    });
  }
  
  // Check for QRT
  var qrtDiv = tweet.querySelector("div[tabindex='0'][role='link']");
  if (qrtDiv) {
    var qrtAuthor = qrtDiv.querySelector("div[data-testid='User-Name']");
    if (qrtAuthor) {
      applyAuthorMaskingObserver(qrtAuthor, () => applyMasking(tweet));
      if (qrtAuthor.className.includes("transphobe")) {
        // QRT'ed a transphobe
        qrtDiv.setAttribute("wiawbe-mask-tag", "tweet");
      }
    }
  }

  // Mark the tweet as checked for masking
  tweet.setAttribute("data-wiawbe-mask-checked", "true");

  // Add observer to catch changes and mask them
  if (!tweet.observer) {
    tweet.observer = new MutationObserver(function(mutations) {
      applyMasking(tweet);
    });

    tweet.observer.observe(tweet, {attributes: false, childList: true, characterData: false, subtree:true});
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
  if (!document.querySelector("a.wiaw-username-link") || !appliedLinkedToUsernameOnProfilePage) {
    // Check for username at top of profile page
    var usernameDiv = document.body.querySelector("div[data-testid='UserName']");
    if (usernameDiv && !usernameDiv.classList.contains("wiawbe-linked")) {
      const link = document.createElement('a');
      link.setAttribute("href", location.href);
      link.setAttribute("draggable", "false");
      link.addEventListener("click", e => {
        e.preventDefault();
        return false;
      });
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
  var div_identifier = div.innerHTML.replace(/^.*?>@([A-Za-z0-9_]+)<\/span><\/div>.*$/gs, "$1");

  if (!div_identifier) {
    div_identifier = div.innerHTML.replace(/^.*?>@([A-Za-z0-9_]+)<.*$/gs, "$1");
    if (!div_identifier) {
      return;
    }
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
  
  return finalEntry;
}

async function processLink(a) {
  if (a.getAttribute("role") == "tab") {
    // don't label tabs
    return;
  }

  var identifier = null;

  var dataIdentifier = a.getAttribute("data-wiawbeidentifier");
  if (dataIdentifier) {
    var identifier = dataIdentifier;
  } else {
    var localUrl = getLocalUrl(a.href);
    if (!localUrl) {
      return;
    }
    
    identifier = getIdentifier(localUrl);
  }

  if (!identifier) {
    return;
  }

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

var countedTerfs = 0;
var countedUserCells = 0;
var usersCounted = [];

async function countTerf(userCell) {
  var link = userCell.querySelector("a");
  if (link) {
    var href = link.getAttribute("href");
    var entry = await getDatabaseEntry(getIdentifier(href));
    if (href && !usersCounted.includes(href)) {
      countedUserCells++;
      usersCounted.push(href);
      if (entry && entry["label"] && entry["label"].includes("transphobe")) {
        countedTerfs++;
        usersCounted.push(href);
      }
    }
  }

  var count = document.getElementById("soupcan-count");
  if (count) {
    percentage = 0;
    if (countedUserCells > 0) {
      percentage = Math.max(0, Math.min(100, Math.floor(100 * countedTerfs / countedUserCells)));
    }
    count.textContent = countedTerfs + " / " + countedUserCells + " (" + percentage + "%)";
  }
}

function doCountTerfs(kind) {
  if (checkForInvalidExtensionContext()) {
    return;
  }

  if (!kind) {
    // Remove terf count UI
    var el = document.getElementById("soupcan-terf-count");
    if (el) {
      el.remove();
    }
  } else {
    try {
      // Delete existing panel
      var el = document.getElementById("soupcan-terf-count");
      if (el) {
        el.remove();
      }

      // Reset count values
      countedTerfs = 0;
      countedUserCells = 0;
      usersCounted = [];

      // Create a copy of the "Who to follow" panel as a basis for the transphobe counter panel
      var whoToFollowPanel = document.querySelector("div[data-testid='sidebarColumn'] div[tabindex='0'] :has(>div>aside)");
      var transphobeCountPanel = whoToFollowPanel.cloneNode(true);
      // Set the id for later reference
      transphobeCountPanel.id = "soupcan-terf-count";
      // Make the panel the right size
      transphobeCountPanel.querySelector("div").style["min-height"] = "0";
      // Change the heading
      transphobeCountPanel.querySelector("h2 span").innerText = "🥫 " + browser.i18n.getMessage("transphobeCounter");
      // Remove "Show more" link
      transphobeCountPanel.querySelector("aside>a").remove();
      // Remove all entries but the first in the panel
      transphobeCountPanel.querySelectorAll("aside>div:not(:has(h2)) div[data-testid='UserCell']:not(:nth-child(1))").forEach(el => {
        el.remove();
      });
      // Remove all "Follows you" badges
      transphobeCountPanel.querySelectorAll("[data-testid='userFollowIndicator']").forEach(el => {
        el.remove();
      });
      // Remove the avatar from the entry
      transphobeCountPanel.querySelector("div[data-testid='UserCell']>div>div").remove();
      // Remove the follow button from the entry
      transphobeCountPanel.querySelector("div[data-testid='UserCell']>div>div>div>div:not([dir]):nth-last-child(2)").remove();
      // Remove the pointer cursor from the entry
      transphobeCountPanel.querySelector("div[data-testid='UserCell']").style.cursor = "default";
      // Remove the UserCell attribute to avoid conflicting queries
      transphobeCountPanel.querySelector("aside>div:not(:has(h2)) div[data-testid='UserCell']").removeAttribute("data-testid");
      // Unlink the anchor tags
      transphobeCountPanel.querySelectorAll("a").forEach(anchor => {
        anchor.style.cursor = "default";
        anchor.style["pointer-events"] = "none";
      });
      // Change the label
      transphobeCountPanel.querySelector("a span").textContent = browser.i18n.getMessage("counterName_" + kind) + " " + browser.i18n.getMessage("scrollInstructions");
      // Change the subtext
      var countSpan = transphobeCountPanel.querySelectorAll("a:has(span)")[1].querySelector("span");
      countSpan.id = "soupcan-count";
      countSpan.textContent = "0/0";

      // Add it to the page after the "Who to follow" panel
      whoToFollowPanel.after(transphobeCountPanel);

      document.querySelectorAll("[data-testid='primaryColumn'] [data-testid='UserCell']").forEach(userCell => {
        countTerf(userCell);
      });
      
      var terfObserver = new MutationObserver(mutationsList => {
        for (const mutation of mutationsList) {
          if (lastUpdatedUrl.includes("follow")) {
            if (mutation.type == 'childList') {
              for (const node of mutation.addedNodes) {
                if (node instanceof HTMLDivElement) {
                  var userCell = node.querySelector("[data-testid='UserCell']");
                  if (userCell) {
                    countTerf(userCell);
                  }
                }
              }
            }
          }
        }
      });
      terfObserver.observe(document.body, {
        childList: true,
        subtree: true
      });

    } catch {
      setTimeout(() => doCountTerfs(kind), 250);
    }
  }
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

    if (lastUpdatedUrl.endsWith("/followers")) {
      doCountTerfs("followers");
    } else if (lastUpdatedUrl.endsWith("/following")) {
      doCountTerfs("following");
    } else {
      doCountTerfs();
    }

    function removeProfileReason() {
      var profileReason = document.getElementById("wiawbe-profile-reason");
      if (profileReason) {
        var usernameDiv = profileReason.closest("[data-testid='UserName']");
        profileReason.remove();
        addReasonToUserNameDiv(usernameDiv);
      }
    }  

    nodeCheckCache = {};

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
  if (checkForInvalidExtensionContext()) {
    return;
  }

  var successMessage = "";
  var failureMessage = "";
  var endpoint = "";

  if (reportType == "transphobe") {
    endpoint = "report-transphobe";
    successMessage = browser.i18n.getMessage("reportReceived", [identifier]);
    failureMessage = browser.i18n.getMessage("reportSubmissionFailed") + " ";
    notifier.tip(browser.i18n.getMessage("sendingReport", [identifier]));
  } else if (reportType == "appeal") {
    endpoint = "appeal-label";
    successMessage = browser.i18n.getMessage("appealReceived", [identifier]);
    failureMessage = browser.i18n.getMessage("appealSubmissionFailed") + " ";
    notifier.tip(browser.i18n.getMessage("sendingAppeal", [identifier]));
  } else {
    notifier.alert(browser.i18n.getMessage("invalidReportType", [reportType]));
    return;
  }

  localEntries[localKey]["time"] = Date.now();
  saveLocalEntries();


  // Report to WIAW
  browser.runtime.sendMessage({
    "action": "fetch",
    "url": "https://api.beth.lgbt/" + endpoint + "?state=" + state + "&screen_name=" + identifier + "&reason=" + encodeURI(reason)
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
  if (checkForInvalidExtensionContext()) {
    return;
  }

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
              notifier.info(browser.i18n.getMessage("resendingReport", [localEntry["identifier"]]));
              sendLabel(reportType, localEntry["identifier"], () => {}, localKey, localEntry["submitReason"]);
            }
          } catch (error) {
            notifier.alert(browser.i18n.getMessage("genericError", [error]));
          }
        });
      }
    }
  });
}

function saveLocalEntries() {
  if (checkForInvalidExtensionContext()) {
    return;
  }

  browser.storage.local.set({
    "local_entries": localEntries
  });
}

async function checkForDatabaseUpdates() {
  if (checkForInvalidExtensionContext()) {
    return;
  }

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
  if (checkForInvalidExtensionContext()) {
    return;
  }

  notifier.info(browser.i18n.getMessage("databaseDownloading"));
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
      notifier.success(browser.i18n.getMessage("databaseUpdated"));
      sendResponse("OK");
    } catch (error) {
      database["downloading"] = false;
      notifier.alert(browser.i18n.getMessage("databaseUpdateFailed", [error]));
      sendResponse("Fail");
      return true;
    }
  });

  return true;
}

// Receive messages from background script
browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action == "report-transphobe") {
    var initialReason = "";
    try {
      initialReason = contextMenuElement.closest("article").querySelector("a[href*='status']").href;
    } catch {

    }

    try {
      if (!state) {
        notifier.alert(browser.i18n.getMessage("authorizationInvalid"));
        sendResponse("Invalid state!");
        return true;
      }
      var localUrl = getLocalUrl(message.url);
      if (!localUrl) {
        notifier.alert(browser.i18n.getMessage("invalidReportTarget"));
        sendResponse("Invalid report target!");
        return true;
      }
      const identifier = getIdentifier(localUrl);

      // see if they're already reported
      const dbEntry = await getDatabaseEntry(identifier);
      if (dbEntry && dbEntry["label"] && dbEntry["label"] == "transphobe") {
        notifier.alert(browser.i18n.getMessage("userAlreadyRed", [identifier]));
        return false;
      } else {
        var clonedTweetButton = document.querySelector("a[data-testid='SideNav_NewTweet_Button']").cloneNode(true);
        var icon = clonedTweetButton.querySelector("div[dir='ltr'] svg");
        if (icon) {
          icon.remove();
        }
        clonedTweetButton.removeAttribute("href");

        for (const span of clonedTweetButton.querySelectorAll('span')) {
          span.innerText = browser.i18n.getMessage("sendReportButton");
        }

        notifier.modal(
          browser.i18n.getMessage("reportReasonInstructions", [identifier]) + "<textarea rows='8' cols='50' maxlength='1024' id='wiawbe-reason-textarea'></textarea>",
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
          textArea.value = initialReason;
          textArea.focus();
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
        },{once:true});
        return true;
      }
    } catch (error) {
      notifier.alert(browser.i18n.getMessage("genericError", [error]));
    }
  } else if (message.action == "appeal-label") {
    try {
      if (!state) {
        notifier.alert(browser.i18n.getMessage("authorizationInvalid"));
        sendResponse("Invalid state!");
        return true;
      }
      var localUrl = getLocalUrl(message.url);
      if (!localUrl) {
        notifier.alert(browser.i18n.getMessage("invalidAppealTarget"));
        sendResponse("Invalid appeal target!");
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
        notifier.warning(browser.i18n.getMessage("nothingToAppeal"));
      }
      return true;
    } catch (error) {
      notifier.alert(browser.i18n.getMessage("genericError", [error]));
    }
  } else if (message.action == "search-tweets") {
    try {
      var localUrl = getLocalUrl(message.url);
      if (!localUrl) {
        notifier.alert(browser.i18n.getMessage("invalidTarget"));
        sendResponse(null);
        return true;
      }

      const identifier = getIdentifier(localUrl);
      sendResponse(identifier);
      return identifier;
    } catch (error) {
      notifier.alert(browser.i18n.getMessage("genericError", [error]));
    }
  } else if (message.action == "update-database") {
    updateDatabase(sendResponse, database["version"]);
  }
  return false;
});

var contextInvalidated = false;
const contextInvalidatedMessage = browser.i18n.getMessage("extensionContextInvalidated");
var intervals = [];
function checkForInvalidExtensionContext() {
  if (contextInvalidated) {
    return true;
  }

  try {
    browser.storage.local.get([]);
    return false;
  } catch (error) {
    if (!contextInvalidated) {
      notifier.alert(contextInvalidatedMessage);
      contextInvalidated = true;
      intervals.forEach(interval => {
        clearInterval(interval);
      });
      intervals = [];
    }
  }
}

var contextMenuElement = null;

// Populate DOM element for context menu
document.addEventListener("contextmenu", function(event){
  contextMenuElement = event.target;
}, true);

function reloadLocalDb() {
  browser.storage.local.get(["local_entries"], v => {
    if (v.local_entries) {
      newLocalEntries = v.local_entries;
      for (let key in newLocalEntries) {
        if (!(key in localEntries)) {
          localEntries[key] = newLocalEntries[key];
        }
      }
    }
  });
}

init();
intervals.push(setInterval(checkForInvalidExtensionContext, 1000));
intervals.push(setInterval(updatePage, 10000));
intervals.push(setInterval(updateAllLabels, 5000));
intervals.push(setInterval(sendPendingLabels, 4000));
intervals.push(setInterval(checkForDatabaseUpdates, 10000));
intervals.push(setInterval(applyOptions, 100));
intervals.push(setInterval(reloadLocalDb, 1000));