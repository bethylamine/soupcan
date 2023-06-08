var browser = browser || chrome;

const maskNoneRadio = document.getElementById("maskNone");
const maskTransphobeMediaRadio = document.getElementById("maskTransphobeMedia");
const maskAllTransphobeMediaRadio = document.getElementById("maskAllTransphobeMedia");
const maskAllTransphobeContentRadio = document.getElementById("maskAllTransphobeContent");
const preventZalgoTextCheckbox = document.getElementById("preventZalgoText");
const hideAdsCheckbox = document.getElementById("hideAds");
const contentMatchingThresholdDescriptionText = document.getElementById("contentMatchingThresholdDescription");
const contentMatchingSlider = document.getElementById("contentMatchingRange");

var inputs = document.getElementsByTagName("input");
for (let el of inputs) {
  el.addEventListener("change", () => {
    updateContentMatchingThresholdDescription();
    saveOptions();
  });
};

contentMatchingSlider.addEventListener("mousemove", () => {
  updateContentMatchingThresholdDescription();
});

var options = {}

loadOptions();
updateContentMatchingThresholdDescription();

function updateContentMatchingThresholdDescription() {
  var thresholdDescription = "";
  switch (contentMatchingSlider.value) {
    case "0":
      thresholdDescription = "<b>Disabled</b>: No content matching";
      break;
    case "5":
      thresholdDescription = "<b>Severe</b>: Surgery gore, suicide imagery";
      break;
    case "4":
      thresholdDescription = "<b>High</b>: Surgery-related imagery, other shock or triggering content";
      break;
    case "3":
      thresholdDescription = "<b>Medium</b>: Nazi imagery, pornography or fetish imagery shared for the purpose of transphobia";
      break;
    case "2":
      thresholdDescription = "<b>Distasteful</b>: Soyjack memes, transphobic comics, nonconsensual pre-transition images";
      break;
    case "1":
      thresholdDescription = "<b>Low</b>: All images shared for the purpose of transphobia";
      break;
  }

  contentMatchingThresholdDescriptionText.innerHTML = thresholdDescription;
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
      contentMatchingSlider.value = `${options["contentMatchingThreshold"]}`;
      updateContentMatchingThresholdDescription();
    }
  });
}

function saveOptions() {
  options["maskMode"] = document.querySelector('input[name="maskMode"]:checked').value;

  options["hideAds"] = hideAdsCheckbox.checked;
  options["preventZalgoText"] = preventZalgoTextCheckbox.checked;
  options["contentMatchingThreshold"] = contentMatchingSlider.value;

  browser.storage.local.set({
    "options": options
  });
}