var browser = browser || chrome;

const maskTransphobeMediaCheckbox = document.getElementById("maskTransphobeMedia");
const maskAllTransphobeMediaCheckbox = document.getElementById("maskAllTransphobeMedia");
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
      maskTransphobeMediaCheckbox.checked = true;
    }
    if (options["maskAllTransphobeMedia"]) {
      maskAllTransphobeMediaCheckbox.checked = true;
    }
    if (options["preventZalgoText"]) {
      preventZalgoTextCheckbox.checked = true;
    }

    maskAllTransphobeMediaCheckbox.disabled = !maskTransphobeMediaCheckbox.checked;
  });
}

function saveOptions() {
  options["maskTransphobeMedia"] = maskTransphobeMediaCheckbox.checked;
  options["maskAllTransphobeMedia"] = maskAllTransphobeMediaCheckbox.checked;
  options["preventZalgoText"] = preventZalgoTextCheckbox.checked;

  maskAllTransphobeMediaCheckbox.disabled = !maskTransphobeMediaCheckbox.checked;

  browser.storage.local.set({
    "options": options
  });
}