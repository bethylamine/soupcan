var browser = browser || chrome;

const maskNoneRadio = document.getElementById("maskNone");
const maskTransphobeMediaRadio = document.getElementById("maskTransphobeMedia");
const maskAllTransphobeMediaRadio = document.getElementById("maskAllTransphobeMedia");
const maskAllTransphobeContentRadio = document.getElementById("maskAllTransphobeContent");
const hideAllTransphobeContentRadio = document.getElementById("hideAllTransphobeContent");
const preventZalgoTextCheckbox = document.getElementById("preventZalgoText");
const hideAdsCheckbox = document.getElementById("hideAds");

const useMediaMatching = document.getElementById("useMediaMatching");

const themeExamples = [
  document.getElementById("light-mode-example"),
  document.getElementById("dark-mode-example")
]

const inputs = document.getElementsByTagName("input");
for (let el of inputs) {
  el.addEventListener("change", () => {
    saveOptions();
  });
};

const colorBlindThemeSelect = document.getElementById("color-blind-theme");

colorBlindThemeSelect.addEventListener("change", () => {
  for (let themeEx of themeExamples) {
    themeEx.classList.remove.apply(themeEx.classList, Array.from(themeEx.classList).filter(v => v.startsWith("soupcan-cb-")));
    if (colorBlindThemeSelect.value != "off") {
      themeEx.classList.add("soupcan-cb-" + colorBlindThemeSelect.value);
    }
  }
  saveOptions();
});

const useSymbolsCheckbox = document.getElementById("useSymbols");
let useSymbols = false;
useSymbolsCheckbox.addEventListener("change", () => {
  useSymbols = useSymbolsCheckbox.checked;
  loadThemeExamples();
  saveOptions();
});

let options = {};

useMediaMatching.addEventListener("change", () => {
  saveOptions();
});

loadOptions();

loadThemeExamples();

function loadThemeExamples() {
  for (let themeEx of themeExamples) {
    var i = 0;
    while (i < themeEx.childNodes.length) {
      var node = themeEx.childNodes[i];
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
    themeEx.appendChild(newEl);

    newEl = document.createElement("span");
    newEl.classList.add("text");
    newEl.classList.add("wiaw-label-local-transphobe");
    newEl.style.left = "63px";
    newEl.style.top = "31px";
    newEl.style.setProperty("font-weight", "normal", "important");
    newEl.innerText = (useSymbols ? "⊖" : "@") + "ImTransphobic";
    themeEx.appendChild(newEl);

    newEl = document.createElement("span");
    newEl.classList.add("text");
    newEl.style.left = "11px";
    newEl.style.top = "70px";
    newEl.style.setProperty("font-weight", "normal", "important");
    newEl.innerText = "Check this out!";
    themeEx.appendChild(newEl);

    newEl = document.createElement("span");
    newEl.classList.add("text");
    newEl.classList.add("wiaw-label-transphobe");
    newEl.style.left = "53px";
    newEl.style.top = "122px";
    newEl.innerText = "Extra large transphobe";
    themeEx.appendChild(newEl);

    newEl = document.createElement("span");
    newEl.classList.add("text");
    newEl.classList.add("wiaw-label-transphobe");
    newEl.style.left = "240px";
    newEl.style.top = "122px";
    newEl.style.setProperty("font-weight", "normal", "important");
    newEl.innerText = (useSymbols ? "⊗" : "@") + "BigTransphobe · Jun 5";
    themeEx.appendChild(newEl);


    newEl = document.createElement("span");
    newEl.classList.add("text");
    newEl.classList.add("text-gray");
    newEl.style.left = "23px";
    newEl.style.top = "153px";
    newEl.style.setProperty("font-weight", "normal", "important");
    newEl.innerHTML = "Replying to @regularPerson and <span class='wiaw-label-local-appeal'>" + (useSymbols ? "⊡" : "@") +  "appealedByYou</span>";
    themeEx.appendChild(newEl);
  }
}

function loadOptions() {
  browser.storage.local.get(["options"], v => {
    if (v.options) {
      options = v.options || {};
    }

    if (options["maskMode"]) {
      const mm = options["maskMode"];
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
        case "hide-all":
          hideAllTransphobeContentRadio.checked = true;
          break;
      }
    } else {
      maskNoneRadio.checked = true;
    }

    if (options["hideAds"]) {
      hideAdsCheckbox.checked = true;
    }

    if (options["preventZalgoText"]) {
      preventZalgoTextCheckbox.checked = true;
    }

    if (options["cbTheme"]) {
      colorBlindThemeSelect.value = options["cbTheme"];
    }

    if (options["cbUseSymbols"]) {
      useSymbols = options["cbUseSymbols"];
      useSymbolsCheckbox.checked = useSymbols;
    }

    if (options["mediaMatching"]) {
      useMediaMatching.checked = options["mediaMatching"];
    }

    loadThemeExamples();
  });
}

function saveOptions() {
  options["maskMode"] = document.querySelector('input[name="maskMode"]:checked').value;

  options["hideAds"] = hideAdsCheckbox.checked;
  options["preventZalgoText"] = preventZalgoTextCheckbox.checked;

  options["mediaMatching"] = useMediaMatching.checked;
  options["cbTheme"] = colorBlindThemeSelect.value;
  options["cbUseSymbols"] = useSymbols;

  browser.storage.local.set({
    "options": options
  });
}