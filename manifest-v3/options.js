var browser = browser || chrome;

const maskNoneRadio = document.getElementById("maskNone");
const maskTransphobeMediaRadio = document.getElementById("maskTransphobeMedia");
const maskAllTransphobeMediaRadio = document.getElementById("maskAllTransphobeMedia");
const maskAllTransphobeContentRadio = document.getElementById("maskAllTransphobeContent");
const preventZalgoTextCheckbox = document.getElementById("preventZalgoText");
const hideAdsCheckbox = document.getElementById("hideAds");

const mmOff = document.getElementById("media-matching-off");
const mm1 = document.getElementById("media-matching-1");
const mm2 = document.getElementById("media-matching-2");
const mm3 = document.getElementById("media-matching-3");
const mm4 = document.getElementById("media-matching-4");
const mm5 = document.getElementById("media-matching-5");

const mmEls = [
  mmOff, mm1, mm2, mm3, mm4, mm5
]

const mmExamples = [
  document.getElementById("light-mode-example"),
  document.getElementById("dark-mode-example")
]

var inputs = document.getElementsByTagName("input");
for (let el of inputs) {
  el.addEventListener("change", () => {
    updateMediaMatchingOptions();
    saveOptions();
  });
};

var colorBlindThemeSelect = document.getElementById("color-blind-theme");

colorBlindThemeSelect.addEventListener("change", () => {
  for (let mmEx of mmExamples) {
    mmEx.classList.remove.apply(mmEx.classList, Array.from(mmEx.classList).filter(v => v.startsWith("soupcan-cb-")));
    if (colorBlindThemeSelect.value != "off") {
      mmEx.classList.add("soupcan-cb-" + colorBlindThemeSelect.value);
    }
  }
  saveOptions();
});

var useSymbolsCheckbox = document.getElementById("useSymbols");
var useSymbols = false;
useSymbolsCheckbox.addEventListener("change", () => {
  useSymbols = useSymbolsCheckbox.checked;
  loadMmExamples();
  saveOptions();
});

var options = {}
var contentMatchingThreshold = -1;

loadOptions();

for (let mmEl of mmEls) {
  mmEl.addEventListener("change", () => {
    contentMatchingThreshold = mmEl.value;
    updateMediaMatchingOptions();
    saveOptions();
  });
}

loadMmExamples();

function loadMmExamples() {
  for (let mmEx of mmExamples) {
    var i = 0;
    while (i < mmEx.childNodes.length) {
      var node = mmEx.childNodes[i];
      if (node instanceof HTMLImageElement) {
        i++;
        continue;
      }
      node.remove();
    }

    var newEl = document.createElement("span");
    newEl.classList.add("text");
    newEl.classList.add("wiaw-label-local-transphobe");
    newEl.style.left = "63px"; // -1
    newEl.style.top = "12px";  // -7
    newEl.innerText = "Transphobe Reported By You";
    mmEx.appendChild(newEl);

    newEl = document.createElement("span");
    newEl.classList.add("text");
    newEl.classList.add("wiaw-label-local-transphobe");
    newEl.style.left = "63px";
    newEl.style.top = "31px";
    newEl.style.setProperty("font-weight", "normal", "important");
    newEl.innerText = (useSymbols ? "⊖" : "@") + "ImTransphobic";
    mmEx.appendChild(newEl);

    newEl = document.createElement("span");
    newEl.classList.add("text");
    newEl.style.left = "11px";
    newEl.style.top = "70px";
    newEl.style.setProperty("font-weight", "normal", "important");
    newEl.innerText = "Check this out!";
    mmEx.appendChild(newEl);

    newEl = document.createElement("span");
    newEl.classList.add("text");
    newEl.classList.add("wiaw-label-transphobe");
    newEl.style.left = "53px";
    newEl.style.top = "122px";
    newEl.innerText = "Extra large transphobe";
    mmEx.appendChild(newEl);

    newEl = document.createElement("span");
    newEl.classList.add("text");
    newEl.classList.add("wiaw-label-transphobe");
    newEl.style.left = "240px";
    newEl.style.top = "122px";
    newEl.style.setProperty("font-weight", "normal", "important");
    newEl.innerText = (useSymbols ? "⊗" : "@") + "BigTransphobe · Jun 5";
    mmEx.appendChild(newEl);


    newEl = document.createElement("span");
    newEl.classList.add("text");
    newEl.classList.add("text-gray");
    newEl.style.left = "23px";
    newEl.style.top = "153px";
    newEl.style.setProperty("font-weight", "normal", "important");
    newEl.innerHTML = "Replying to @regularPerson and <span class='wiaw-label-local-appeal'>" + (useSymbols ? "⊡" : "@") +  "appealedByYou</span>";
    mmEx.appendChild(newEl);
  }
}

function updateMediaMatchingOptions() {
  for (let mmEl of mmEls) {
    mmEl.checked = false;
  }

  if (contentMatchingThreshold <= 0) {
    // Off
    mmOff.checked = true;
  } else {
    if (contentMatchingThreshold < 2) {
      mm1.checked = true;
    }
    if (contentMatchingThreshold < 3) {
      mm2.checked = true;
    }
    if (contentMatchingThreshold < 4) {
      mm3.checked = true;
    }
    if (contentMatchingThreshold < 5) {
      mm4.checked = true;
    }
    mm5.checked = true;
  }
}

function loadOptions() {
  browser.storage.local.get(["options"], v => {
    if (v.options) {
      options = v.options || {};
    }

    if (options["maskMode"]) {
      var mm = options["maskMode"];
      switch (mm) {
        case "none":
          maskNoneRadio.checked = true;
          break;
        case "direct-media-only":
          maskTransphobeMediaRadio.checked = true;
          break;
        case "media-incl-retweets":
          maskAllTransphobeMediaRadio.checked = true;
          break;
        case "all-content":
          maskAllTransphobeContentRadio.checked = true;
          break;
      }
    }

    if (options["hideAds"]) {
      hideAdsCheckbox.checked = true;
    }

    if (options["preventZalgoText"]) {
      preventZalgoTextCheckbox.checked = true;
    }

    if (options["contentMatchingThreshold"]) {
      contentMatchingThreshold = `${options["contentMatchingThreshold"]}`;
      updateMediaMatchingOptions();
    }

    if (options["cbTheme"]) {
      colorBlindThemeSelect.value = options["cbTheme"];
    }

    if (options["cbUseSymbols"]) {
      useSymbols = options["cbUseSymbols"];
      useSymbolsCheckbox.checked = useSymbols;
    }

    loadMmExamples();
  });
}

function saveOptions() {
  options["maskMode"] = document.querySelector('input[name="maskMode"]:checked').value;

  options["hideAds"] = hideAdsCheckbox.checked;
  options["preventZalgoText"] = preventZalgoTextCheckbox.checked;
  options["contentMatchingThreshold"] = contentMatchingThreshold;

  options["cbTheme"] = colorBlindThemeSelect.value;
  options["cbUseSymbols"] = useSymbols;

  browser.storage.local.set({
    "options": options
  });
}