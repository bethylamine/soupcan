var browser = browser || chrome;

const markTransphobeMediaCheckbox = document.getElementById("maskTransphobeMedia");

markTransphobeMediaCheckbox.addEventListener("change", saveOptions);

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
  });
}

function saveOptions() {
  options["maskTransphobeMedia"] = markTransphobeMediaCheckbox.checked;

  browser.storage.local.set({
    "options": options
  });
}