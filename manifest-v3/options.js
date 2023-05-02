var browser = browser || chrome;

const markTransphobeMediaCheckbox = document.getElementById("maskTransphobeMedia");
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

    if (options["maskTransphobeMedia"]) {
      markTransphobeMediaCheckbox.checked = true;
    }
    if (options["preventZalgoText"]) {
      preventZalgoTextCheckbox.checked = true;
    }
  });
}

function saveOptions() {
  options["maskTransphobeMedia"] = markTransphobeMediaCheckbox.checked;
  options["preventZalgoText"] = preventZalgoTextCheckbox.checked;

  browser.storage.local.set({
    "options": options
  });
}