var browser = browser || chrome;

const maskNoneRadio = document.getElementById("maskNone");
const maskTransphobeMediaRadio = document.getElementById("maskTransphobeMedia");
const maskAllTransphobeMediaRadio = document.getElementById("maskAllTransphobeMedia");
const maskAllTransphobeContentRadio = document.getElementById("maskAllTransphobeContent");
const preventZalgoTextCheckbox = document.getElementById("preventZalgoText");

var inputs = document.getElementsByClassName("form-check-input");
for (let el of inputs) {
  el.addEventListener("change", saveOptions);
};

var options = {}

loadOptions();

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

    if (options["preventZalgoText"]) {
      preventZalgoTextCheckbox.checked = true;
    }
  });
}

function saveOptions() {
  options["maskMode"] = document.querySelector('input[name="maskMode"]:checked').value;
  console.log(options["maskMode"]);

  options["preventZalgoText"] = preventZalgoTextCheckbox.checked;

  browser.storage.local.set({
    "options": options
  });
}