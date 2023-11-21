var browser = browser || chrome;

var options = {

};

var state = "";

var isModerator = false;

var notifier = new AWN();
var localReasonsCache = {};

var cbTheme = "off";
var cbUseSymbols = false;

function init() {
  notifier = new AWN({
    "position": "bottom-right",
    "labels": {
      "tip": browser.i18n.getMessage("toast_label_tip"),
      "info": browser.i18n.getMessage("toast_label_info"),
      "success": browser.i18n.getMessage("toast_label_success"), 
      "warning": browser.i18n.getMessage("toast_label_warning"),
      "alert": browser.i18n.getMessage("toast_label_alert"),
      "confirm": browser.i18n.getMessage("toast_label_confirm"),
      "confirmOk": browser.i18n.getMessage("toast_label_confirmOk"),
      "confirmCancel": browser.i18n.getMessage("toast_label_confirmCancel"),
      "async": browser.i18n.getMessage("toast_label_async"),
    }
  });
  
  initDatabase();

  browser.storage.local.get(["state", "is_moderator"], v => {
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

function changeSoupcanTheme(body, theme) {
  body.classList.remove.apply(body.classList, Array.from(body.classList).filter(v => v.startsWith("soupcan-theme-")));
  body.classList.add("soupcan-theme-" + theme);
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

    if (options["mediaMatching"]) {
      mediaMatching = options["mediaMatching"];
    }

    function checkTheme() {
      changeSoupcanTheme(body, "light"); // default to light mode if all else fails

      // Check if Twitter is using light or dark mode
      var computedStyle = window.getComputedStyle(body, null);
      if (computedStyle) {
        var backgroundColor = computedStyle.getPropertyValue("background-color");
      
        if (backgroundColor.includes("FFFFFF") || backgroundColor.includes("255, 255, 255")) {
          changeSoupcanTheme(body, "light");
        } else {
          changeSoupcanTheme(body, "dark");
        }
      }
    }

    checkTheme();

    var bodyStyleObserver = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.attributeName == "style") {
          checkTheme();
        }
      });
    });

    bodyStyleObserver.observe(body, {attributes: true});

    if (options["cbTheme"]) {
      cbTheme = options["cbTheme"];
    }

    body.classList.remove.apply(body.classList, Array.from(body.classList).filter(v => v.startsWith("soupcan-cb-")));
    body.classList.add("soupcan-cb-" + cbTheme);

    if (options["cbUseSymbols"]) {
      cbUseSymbols = options["cbUseSymbols"];
    }
    
    body.classList.remove("wiawbe-hide-zalgo");
    if (options["preventZalgoText"]) {
      body.classList.add("wiawbe-hide-zalgo");
    }

    applyHideAds();
  });
}

var content_match_cache = {};

function getImageKey(url) {
  return url.split('?')[0];
}

var mediaMatching = false;

async function checkVideo(videoEl) {
  if (!mediaMatching || !database["media_matching_data"]) {
    return;
  }

  var videoContainer = videoEl.closest("[data-testid='videoComponent']");
  if (["true", "false"].includes(videoContainer.getAttribute("wiawbe-content-match"))) {
    return;
  }

  videoContainer.setAttribute("wiawbe-content-match", "pending");
  var posterUrl = videoEl.getAttribute("poster");
  var tmpImgEl = document.createElement("img");
  tmpImgEl.src = posterUrl;

  var fragment = document.createDocumentFragment();
  var tmpImgContainer = document.createElement("div");
  tmpImgContainer.setAttribute("aria-label", "Image");
  tmpImgContainer.appendChild(tmpImgEl);
  fragment.appendChild(tmpImgContainer);

  safeCheckImage(tmpImgEl, () => {
    videoContainer.setAttribute("wiawbe-content-match", tmpImgContainer.getAttribute("wiawbe-content-match"));
    videoContainer.setAttribute("wiawbe-content-match-note", tmpImgContainer.getAttribute("wiawbe-content-match-note"));
    videoEl.setAttribute("data-soupcan-imghash", tmpImgEl.getAttribute("data-soupcan-imghash"));
    videoEl.setAttribute("data-soupcan-matched-imghash", tmpImgEl.getAttribute("data-soupcan-matched-imghash"));
  });
}

async function safeCheckImage(imgEl, callback) {
  if (!mediaMatching || !database["media_matching_data"]) {
    return;
  }

  let imageContainer = imgEl.closest("[aria-label='Image']");
  if (imageContainer == null) {
    return;
  }

  try {
    // Mark it pending until we have a result
    imageContainer.setAttribute("wiawbe-content-match", "pending");

    await checkImage(imgEl, callback);
  }
   catch (error) {
    imageContainer.setAttribute("wiawbe-content-match", "error");
    if (callback) {
      callback();
    }
  }
}

async function checkImage(imgEl, callback) {
  if (imgEl.getAttribute("wiawbe-content-match")) {
    // already has attribute
    return;
  }

  let imageContainer = imgEl.closest("[aria-label='Image']");
  if (imageContainer == null) {
    return;
  }
  if (["true", "false"].includes(imageContainer.getAttribute("wiawbe-content-match"))) {
    // already has attribute
    return;
  }

  let imgCacheKey = getImageKey(imgEl.src);

  // Check for transphobic imagery
  if (imgEl.src.includes("/media") ||
      imgEl.src.includes("/tweet_video_thumb") ||
      imgEl.src.includes("ext_tw_video_thumb") ||
      imgEl.src.includes("amplify_video_thumb")) {

    if (imgCacheKey in content_match_cache) {
      // already processed
      const cacheVal = content_match_cache[imgCacheKey];
      imageContainer.setAttribute("wiawbe-content-match", cacheVal["match-attribute"]);
      imageContainer.setAttribute("wiawbe-content-match-note", cacheVal["note"]);
      imgEl.setAttribute("data-soupcan-border-total", "none");
      callback();
      return;
    }

    // check with pHash
    const matchMediaResult = await matchMedia(imgEl);
    if (matchMediaResult.match) {
      // matched
      let note = "cw/ " + matchMediaResult.label.cws + "\n(" + matchMediaResult.label.description + ")";
      imageContainer.setAttribute("wiawbe-content-match", "true");
      imageContainer.setAttribute("wiawbe-content-match-note", note);
      content_match_cache[imgCacheKey] = {"match-attribute": "true", "note": note};
    } else {
      imageContainer.setAttribute("wiawbe-content-match", "false");
      content_match_cache[imgCacheKey] = {"match-attribute": "false", "note": ""};
    }
  } else {
    // Not a supported image URL
    content_match_cache[imgCacheKey] = {"match-attribute": "false", "note": ""};
    imageContainer.setAttribute("wiawbe-content-match", "false");
  }

  if (callback) {
    callback();
  }
}

function applyHideAds() {
  // Hide "Get Verified" panel
  var getVerifiedAside = document.querySelector("aside[aria-label='Get Verified']");
  if (getVerifiedAside && getVerifiedAside.parentElement) {
    if (options["hideAds"]) {
      getVerifiedAside.parentElement.style.display = "none";
    } else {
      getVerifiedAside.parentElement.style.display = "";
    }
  }

  // Hide promoted tweets
  var tweets = document.querySelectorAll("article[data-testid='tweet']");

  tweets.forEach((tweet) => {
    var promotedPath = tweet.querySelector("path[d*='M19.498 3h-15c-1.381']");
    if (promotedPath) {
      if (options["hideAds"]) {      
        tweet.style.display = "none";
      } else {
        tweet.style.display = "";
      }
      var parentDiv = tweet.closest("div[data-testid='cellInnerDiv']");
      if (parentDiv) {
        if (options["hideAds"]) {      
          parentDiv.style.display = "none";
        } else {
          parentDiv.style.display = "";
        }
      }
    }
  });

  // Hide promoted trends
  var trends = document.querySelectorAll("div[data-testid='trend']");
  trends.forEach((trend) => {
    var promotedPath = trend.querySelector("path[d*='M19.498 3h-15c-1.381 0-2.5 1.12-2.5 2.5v13c0']");
    if (promotedPath) {
      if (options["hideAds"]) {
        trend.style.display = "none";
      } else {
        trend.style.display = "";
      }
    }
  })

}

function createObserver() {
  var observer = new MutationObserver(mutationsList => {
    for (const mutation of mutationsList) {
      if (location.href != lastUpdatedUrl) {
        updatePage();
      }
      if (mutation.type == 'childList') {
        processForMasking();
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLAnchorElement) {
            processLink(node);
          }
          if (node instanceof HTMLDivElement) {
            checkNode(node, true);
            applyHideAds();
            if (isProfilePage()) {
              applyLinkToUsernameOnProfilePage();
            }
          }
          if (node instanceof HTMLImageElement) {
            safeCheckImage(node);
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

function checkNode(node, force = false, depth = 0) {
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
    processDiv(node, false, depth);
  }

  if (dt == "tweet") {
    // mark the tweet as a labelled area
    processDiv(node, true, depth)
  }

  if (node.hasChildNodes()) {
    for(var i = 0; i < node.children.length; i++){
      var child = node.children[i];
      checkNode(child, force, depth + 1);
    }
  }
}

function processForMasking() {
  var tweets = document.querySelectorAll("article[data-testid='tweet']:not([data-wiawbe-mask-checked])");

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
    var videoEl = videoComponent.querySelector("video");
    if (videoEl) {
      checkVideo(videoEl);
    }
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
      // This is necessary to apply masking to tweets that are loaded asynchronously
      // e.g. images that only appeared *after* the first applyMasking() call
      applyMasking(tweet);
    });

    tweet.observer.observe(tweet, {attributes: false, childList: true, characterData: false, subtree:true});
  }
}

function updateAllLabels() {
  processForMasking();
  applyHideAds();

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

function getUsernameFromDiv(div) {
  var div_identifier = div.innerHTML.replace(/^.*?>[@⊗⊖⊡]([A-Za-z0-9_]+)<\/span><\/div>.*$/gs, "$1");

  if (!div_identifier) {
    div_identifier = div.innerHTML.replace(/^.*?>[@⊗⊖⊡]([A-Za-z0-9_]+)<.*$/gs, "$1");
    if (!div_identifier) {
      return null;
    }
  }

  return div_identifier
}

async function processDiv(div, markArea = false, depth = -1) {
  var div_identifier = getUsernameFromDiv(div);

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
    div.wiawReason = database_entry["reason"];
    if (database_entry["time"]) {
      if (database_entry["time"] < 99900000000) {
        database_entry["time"] *= 1000; // convert seconds to milliseconds
      }
      div.wiawReason += " " + timeSince(database_entry["time"]);
    }
    var labelToApply = labelPrefix + div.wiawLabel;
    if (div.wiawLabel && !div.classList.contains(labelToApply)) {
      div.classList.remove.apply(div.classList, Array.from(div.classList).filter(v => v.startsWith("wiaw-label-")));
      div.classList.add(hasLabelToApply);
      div.classList.add(labelToApply);
      div.setAttribute("data-wiawbeidentifier", div_identifier);
      applySymbols(div);
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
    addReasonToUserNameDiv(div, div_identifier);
  }

  if (!div.observer) {
    div.observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {

        if (div.getAttribute("data-testid") == "UserName") {
          addReasonToUserNameDiv(div, div_identifier);
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

function addReasonToUserNameDiv(div, identifier) {
  if (!/wiawbe-profile-reason/.test(div.innerHTML)) {
    if (div.wiawReason) {
      var spanContents = "[" + div.wiawReason + "]";
      div.insertAdjacentHTML("beforeend", "<span id='wiawbe-profile-reason' class='wiawbe-reason'></span>");
      var profileReasonSpan = document.getElementById("wiawbe-profile-reason")
      profileReasonSpan.innerText = spanContents;
      var reasonAnchor = document.createElement("a");
      reasonAnchor.href = "javascript:;"
      reasonAnchor.addEventListener("click", () => getReasoning(identifier));
      profileReasonSpan.innerText = "";
      reasonAnchor.innerText = spanContents;
      profileReasonSpan.appendChild(reasonAnchor);
    }
  }
}

function waitForElm(selector) {
  return new Promise(resolve => {
      if (document.querySelector(selector)) {
          return resolve(document.querySelector(selector));
      }

      const observer = new MutationObserver(mutations => {
          if (document.querySelector(selector)) {
              resolve(document.querySelector(selector));
              observer.disconnect();
          }
      });

      observer.observe(document.body, {
          childList: true,
          subtree: true
      });
  });
}

function linkify(text) {
  var urlRegex = /(\bhttps?:\/\/(twitter\.com|x\.com)\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
  return text.replace(urlRegex, function(url) {
    return '<a href="' + url + '">' + url + '</a>';
  });
}

function getReasoning(identifier) {
  var fetchUrl = "https://api.beth.lgbt/moderation/reasons?state=" + state + "&identifier=" + identifier;

  notifier.async(
    new Promise(async resolve => {
      try {
        var jsonData = "[]";

        if (identifier in localReasonsCache && new Date() - localReasonsCache[identifier][1] < 30000) {
          jsonData = localReasonsCache[identifier][0];
        } else {
          let response = await doFetch(fetchUrl);
          if (response["status"] != 200) {
            throw new Error(fetchUrl + ": " + browser.i18n.getMessage("serverFailure") + " (" + response["status"] + ")");
          }

          jsonData = response["json"];
          localReasonsCache[identifier] = [jsonData, new Date()];
        }

        var reasonsTable = document.createElement("table");
        reasonsTable.classList.add("reasons-table")
        var reasonsHeader = document.createElement("thead");
        var header1 = document.createElement("th");
        header1.innerText = browser.i18n.getMessage("reasonHeaderWhen");
        reasonsHeader.appendChild(header1);
        var header2 = document.createElement("th");
        header2.innerText = browser.i18n.getMessage("reasonHeaderReporter");
        reasonsHeader.appendChild(header2);
        var header3 = document.createElement("th");
        header3.innerText = browser.i18n.getMessage("reasonHeaderReason");
        reasonsHeader.appendChild(header3);

        var reasonsBody = document.createElement("tbody")

        reasonsTable.appendChild(reasonsHeader);
        reasonsTable.appendChild(reasonsBody);

        var noReasonsSpan = document.createElement("span");
        noReasonsSpan.innerText = browser.i18n.getMessage("noReasons");

        for (let report of jsonData) {
          var when = new Date(report["report_time"] * 1000).toString().replace(/\ ..:.*/g, "").trim();
          var reason = report["reason"];
          
          if (!reason) {
            reason = "(no reason provided)";
          }

          var rowEl = document.createElement("tr");

          var timestampEl = document.createElement("td");
          timestampEl.classList.add("nowrap");
          var reporterEl = document.createElement("td");
          var reasonEl = document.createElement("td");

          timestampEl.innerText = when;
          var reporter = report["reporter_screen_name"]
          if (reporter == "redacted") {
            reporterEl.innerText = reporter;
          } else {
            var reporterAnchor = document.createElement("a");
            reporterAnchor.href = "https://twitter.com/" + report["reporter_screen_name"];
            reporterAnchor.innerText = reporter;
            reporterEl.appendChild(reporterAnchor);
          }
          reasonEl.innerHTML = linkify(reason);

          rowEl.appendChild(timestampEl);
          rowEl.appendChild(reporterEl);
          rowEl.appendChild(reasonEl);
          reasonsBody.appendChild(rowEl);
        }

        waitForElm("div[data-testid='DMDrawerHeader'] span").then((elm) => {
          notifier.modal(
            "<div id='soupcan-reasons'></div>",
            'modal-reasons'
          );
          var popupElements = document.getElementsByClassName("awn-popup-modal-reasons");
          var bodyBackgroundColor = window.getComputedStyle(document.body, null).getPropertyValue("background-color");
          var textColor = window.getComputedStyle(document.querySelector("div[data-testid='DMDrawerHeader'] span"), null).getPropertyValue("color");
          if (popupElements) {
            for (let el of popupElements) {
              el.style["background-color"] = bodyBackgroundColor;
              el.style["color"] = textColor;
            }
          }

          if (reasonsBody.childElementCount == 0) {
            document.getElementById("soupcan-reasons").appendChild(noReasonsSpan);
          } else {
            var reasonsExplainer = document.createElement("p");
            reasonsExplainer.innerText = browser.i18n.getMessage("reasonsExplanation");
            document.getElementById("soupcan-reasons").appendChild(reasonsExplainer);
            document.getElementById("soupcan-reasons").appendChild(reasonsTable);
          }
        });
      } catch (error) {
        notifier.alert(browser.i18n.getMessage("serverFailure") + " (" + error.text + ")");
        console.log(error);
      }
      resolve();
    }),
    response => {}, // success
    response => {
      notifier.alert(browser.i18n.getMessage("serverFailure") + " (" + error + ")");
    }, // failure
    browser.i18n.getMessage("loadingReasons") // loading message
  );
}

async function getDatabaseEntry(identifier) {
  var hashedIdentifier = await hash(identifier.toLowerCase() + ":" + database["salt"]);

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

  if (finalEntry && finalEntry["label"] == "appealed") {
    return null;
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

  if (a.querySelector("a>time")) {
    a.removeAttribute("data-wiawbeidentifier");
    return;
  }

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

  if (cbUseSymbols) {
    applySymbols(a);
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
              if (cbUseSymbols) {
                applySymbols(a);
              }
            }
          }
        }
      });
    });

    a.observer.observe(a, {attributes: true});
  }
}

function applySymbols(element) {
  if (!cbUseSymbols) {
    return;
  }
  const innerSpans = element.querySelectorAll("span");
  for (let innerSpan of innerSpans) {
    if (innerSpan) {
      if (innerSpan.childNodes.length === 1 && innerSpan.childNodes[0].nodeType === 3) {
        // leaf node
        if (innerSpan.innerText.includes("@")) {
          // has @ symbol (username)
          let textNode = innerSpan.childNodes[0]
          if (element.className.includes("label-transphobe")) {
            textNode.nodeValue = innerSpan.innerText.replace(/@/, "⊗");
          } else if (element.className.includes("label-local-transphobe")) {
            textNode.nodeValue = innerSpan.innerText.replace(/@/, "⊖");
          } else if (element.className.includes("label-local-appeal")) {
            textNode.nodeValue = innerSpan.innerText.replace(/@/, "⊡");
          }
        }
      }
    }
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

  if (identifier.includes("?")) {
    identifier = identifier.substr(0, identifier.indexOf("?"));
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
    "/followers_you_follow",
    "/verified_followers",
    "/creator-subscriptions",
    "/explore/",
    "/i/",
    "/articles/",
    "/hashtag/",
    "/resources/",
    "/search?",
    "/help/",
    "/troubleshooting/",
    "/analytics",
    "/topics",
    "/lists",
    "/hidden",
    "/quotes",
    "/retweets"
  ]

  for (const reservedSlug of reservedSlugs) {
    if (url.includes(reservedSlug)) {
      return null;
    }
  }

  if (url.includes("/status") && url.includes("/likes")) {
    return null;
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
      var whatsHappeningDiv = document.querySelector("div[data-testid='sidebarColumn'] div[tabindex='0'] div>section[aria-labelledby]");
      var whatsHappeningPanel = whatsHappeningDiv.parentElement.parentElement;

      if (!whatsHappeningPanel || !whatsHappeningPanel.querySelector("a") || whatsHappeningPanel.querySelectorAll("div[tabindex='0'] div>div>div>span").length < 4) {
        // Not fully loaded
        setTimeout(() => doCountTerfs(kind), 250);
        return;
      }

      var transphobeCountPanel = whatsHappeningPanel.cloneNode(true);
      // Set the id for later reference
      transphobeCountPanel.id = "soupcan-terf-count";
      // Make the panel the right size
      transphobeCountPanel.querySelector("div").style["min-height"] = "0";
      // Change the heading
      transphobeCountPanel.querySelector("h2 span").innerText = "🥫 " + browser.i18n.getMessage("transphobeCounter");
      // Remove links
      for (let linkEl of transphobeCountPanel.querySelectorAll("a")) {
        linkEl.remove();
      }
      // Remove all entries but the first in the panel
      let first = true;
      transphobeCountPanel.querySelectorAll("section>div div[role='link']").forEach(el => {
        if (!first) {
          el.remove();
        }
        first = false;
      });
      // Remove picture
      transphobeCountPanel.querySelector("div[style*='padding-bottom']").parentElement.parentElement.remove();
      // Remove the testid attribute to avoid conflicting queries
      transphobeCountPanel.querySelector("section>div div[role='link']").removeAttribute("data-testid");
      // Unlink the anchor tags
      transphobeCountPanel.querySelectorAll("div[role='link']").forEach(anchor => {
        anchor.style.cursor = "default";
        anchor.style["pointer-events"] = "none";
      });
      // Change the labels
      let labelNumber = 0;
      transphobeCountPanel.querySelectorAll("div[tabindex='0'] div>div>div>span").forEach(el => {
        switch (labelNumber) {
          case 0:
            el.childNodes[0].nodeValue = browser.i18n.getMessage("counterName_" + kind);
            break;
          case 1:
            break;        
          case 2:
            el.childNodes[0].nodeValue = browser.i18n.getMessage("scrollInstructions");
            el.parentElement.parentElement.style.maxWidth = "100%";
            break;
          case 3:
            el.id = "soupcan-count";
            el.childNodes[0].nodeValue = "0/0";
            break;
        }
        labelNumber++;
      });
      // Remove unnecessary labels
      let textDivsToRemove = [];
      for (let textDiv of transphobeCountPanel.querySelectorAll("div[tabindex='0'] div>div>div>div")) {
        let allChildNodes = true;
        for (let textChildDiv of textDiv.childNodes) {
          if (textChildDiv.nodeType !== 3) {
            allChildNodes = false;
          }
        }
        if (allChildNodes) {
          textDivsToRemove.push(textDiv);
        }
      }

      for (let textDivToRemove of textDivsToRemove) {
        textDivToRemove.remove();
      }

      // transphobeCountPanel.querySelector("div span").textContent = browser.i18n.getMessage("counterName_" + kind) + " " + browser.i18n.getMessage("scrollInstructions");
      // Change the subtext
      // var countSpan = transphobeCountPanel.querySelectorAll("a")[1].querySelector("span");
      // countSpan.id = "soupcan-count";
      // countSpan.textContent = "0/0";

      // Add it to the page before the "What's happening" panel
      whatsHappeningPanel.before(transphobeCountPanel);

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

    if (lastUpdatedUrl.endsWith("/followers") || lastUpdatedUrl.endsWith("/followers_you_follow") || lastUpdatedUrl.endsWith("/verified_followers")) {
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
        addReasonToUserNameDiv(usernameDiv, getUsernameFromDiv(usernameDiv));
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
  var notificationMessage = "";
  var endpoint = "";

  if (reportType == "transphobe") {
    endpoint = "report-transphobe";
    successMessage = browser.i18n.getMessage("reportReceived", [identifier]);
    failureMessage = browser.i18n.getMessage("reportSubmissionFailed") + " ";
    notificationMessage = browser.i18n.getMessage("sendingReport", [identifier]);
  } else if (reportType == "appeal") {
    endpoint = "appeal-label";
    successMessage = browser.i18n.getMessage("appealReceived", [identifier]);
    failureMessage = browser.i18n.getMessage("appealSubmissionFailed") + " ";
    notificationMessage = browser.i18n.getMessage("sendingAppeal", [identifier]);
  } else {
    notifier.alert(browser.i18n.getMessage("invalidReportType", [reportType]));
    return;
  }

  localEntries[localKey]["time"] = Date.now();
  saveLocalEntries();

  var fetchUrl = "https://api.beth.lgbt/" + endpoint + "?state=" + state + "&screen_name=" + identifier + "&reason=" + encodeURI(reason);
  // Report to WIAW
  notifier.async(
    doFetch(fetchUrl),
    async response => {
      try {
        if (response["status"] != 200) {
          throw new Error(fetchUrl + ": " + browser.i18n.getMessage("serverFailure") + " (" + response["status"] + ")");
        }
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
    },
    response => { notifier.alert(failureMessage + ": " + response["status"]) },
    notificationMessage
  );

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

        var fetchUrl = "https://api.beth.lgbt/check-report?state=" + state + "&screen_name=" + localEntry["identifier"];
        // check if the report already went through
        browser.runtime.sendMessage({
          "action": "fetch",
          "url": fetchUrl
        }).then(async response => {
          try {
            if (response["status"] != 200) {
              throw new Error(fetchUrl + ": " + browser.i18n.getMessage("serverFailure") + " (" + response["status"] + ")");
            }

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
      var fetchUrl = "https://api.beth.lgbt/get-db-version";
      if (Date.now() > lastUpdated + 5 * 60 * 1000) { // 5 minutes
        browser.runtime.sendMessage({
          "action": "fetch",
          "url": fetchUrl
        }).then(async response => {
          if (response["status"] != 200) {
            throw new Error(fetchUrl + ": " + browser.i18n.getMessage("serverFailure") + " (" + response["status"] + ")");
          }

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

/*
 * Returns a promise for fetching a URL.
 */
async function doFetch(url) {
  return new Promise((resolve, reject) => {
    function callback(response) {
      if ([200, 201, 202].includes(response["status"])) {
        resolve(response);
      } else {
        reject(response);
      }
    };

    browser.runtime.sendMessage({
      "action": "fetch",
      "url": url
    }, null, callback);
  });
}

async function updateDatabase(sendResponse, version) {
  if (checkForInvalidExtensionContext()) {
    return;
  }

  database["downloading"] = true;
  var fetchUrl = "https://wiaw-extension.s3.us-west-2.amazonaws.com/dataset.json"

  notifier.async(
    new Promise(async resolve => {
      try {
        let response = await doFetch(fetchUrl);
        if (response["status"] != 200) {
          throw new Error(fetchUrl + ": " + browser.i18n.getMessage("serverFailure") + " (" + response["status"] + ")");
        }

        const jsonData = response["json"];

        database = {
          "version": jsonData["version"],
          "last_updated": Date.now(),
          "salt": jsonData["salt"],
          "entries": jsonData["entries"],
          "content_match_data": jsonData["content_matching"],
          "media_matching_data": jsonData["media_matching"],
          "downloading": false,
        };

        browser.storage.local.set({
          "database": database
        });
        notifier.success(browser.i18n.getMessage("databaseUpdated"));
        sendResponse("OK");
      } catch (error) {
        database["downloading"] = false;
        notifier.alert(browser.i18n.getMessage("databaseUpdateFailed", [error.text]));
        sendResponse("Fail");
      }
      resolve();
    }),
    response => {}, // success
    response => {
      notifier.alert(browser.i18n.getMessage("databaseUpdateFailed", [response["status"]]));
    }, // failure
    browser.i18n.getMessage("databaseDownloading") // loading message
  );

  return true;
}

// Receive messages from background script
browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action == "report-transphobe") {
    var initialReason = "";

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

      try {
        initialReason = contextMenuElement.closest("article").querySelector("a[href*='status'][href*='" + identifier + "' i]").href;
      } catch {
  
      }

      var clonedTweetButton = document.querySelector("a[data-testid='SideNav_NewTweet_Button'], #navbar-tweet-button").cloneNode(true);
      var icon = clonedTweetButton.querySelector("div[dir='ltr'] svg");
      if (icon) {
        icon.remove();
      }
      clonedTweetButton.removeAttribute("href");

      for (const span of clonedTweetButton.querySelectorAll('span')) {
        if (span.id !== "navbar-tweet-highlight") {
          span.innerText = browser.i18n.getMessage("sendReportButton");
        }
      }

      waitForElm("div[data-testid='DMDrawerHeader'] span").then((elm) => {
        notifier.modal(
          browser.i18n.getMessage("reportReasonInstructions", [identifier]) + "<textarea rows='8' cols='50' maxlength='1024' id='wiawbe-reason-textarea'></textarea>",
          'modal-reason'
        );
        var popupElements = document.getElementsByClassName("awn-popup-modal-reason");
        var bodyBackgroundColor = window.getComputedStyle(document.body, null).getPropertyValue("background-color");
        var textColor = window.getComputedStyle(document.querySelector("div[data-testid='DMDrawerHeader'] span"), null).getPropertyValue("color");
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
      });
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
        if (confirm(`Are you sure you would like to appeal @${identifier}'s label?`)) {
          // Add locally
          var localKey = await hash(identifier + ":" + database["salt"])
          localEntries[localKey] = {"label": "local-appeal", "reason": "Appealed by you", "status": "pending", "time": Date.now(), "identifier": identifier};

          saveLocalEntries();

          updateAllLabels();
          sendLabel("appeal", identifier, sendResponse, localKey);
        }
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
  } else if (message.action == "check-transphobe") {
    let dbEntry = getDatabaseEntry(message.screen_name);

    return {
      screen_name: dbEntry.identifier,
      status: dbEntry.includes("transphobe") ? "transphobic" : "normal",
      reason: dbEntry.reason,
      reported_at: dbEntry.time
    }
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
      notifier.confirm(contextInvalidatedMessage, () => location.reload());

      var popupElements = document.getElementsByClassName("awn-popup-confirm");
      var bodyBackgroundColor = document.getElementsByTagName("body")[0].style["background-color"];
      var textColor = window.getComputedStyle(document.querySelector("span"), null).getPropertyValue("color");
      var fontFamily = window.getComputedStyle(document.querySelector("span"), null).getPropertyValue("font-family");
      if (popupElements) {
        for (let el of popupElements) {
          el.style["background-color"] = bodyBackgroundColor;
          el.style["color"] = textColor;
          el.style["font-family"] = fontFamily;
        }
      }

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