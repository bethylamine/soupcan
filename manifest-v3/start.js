import http from "./fetch-progress.js";

var browser = browser || chrome;

var downloadButton = document.getElementById("download-button");
var closeButton = document.getElementById("close-button");
var continueButton = document.getElementById("continue-button");
var loginButton = document.getElementById("login-button");
var skipButton = document.getElementById("skip-button");
var progressBarWrapper = document.getElementById("progress-bar-wrapper");
var progressBar = document.getElementById("progress-bar");
var progressRole = document.getElementById("progress-role");
var topText = document.getElementById("top-text");
var instructions = document.getElementById("instructions");
var header = document.getElementById("header");

downloadButton.addEventListener("click", startDownload);
closeButton.addEventListener("click", () => window.close());
continueButton.addEventListener("click", setupAuth);
skipButton.addEventListener("click", goToEnd);

const { json, cancel } = http('https://wiaw-extension.s3.us-west-2.amazonaws.com/');

var result = {};

async function startDownload() {
  progressBarWrapper.classList.remove("d-none");
  downloadButton.classList.add("d-none");
  topText.innerText = "Downloading extension data... Please keep this tab open.";
  header.innerText = "Update";

  result = await json("browser_extension_entries.json");

  browser.storage.local.set({
    "database": {
        "last_updated": Date.now(),
        "entries": result
      }
  });

  showDownloadResult();
}

function goToEnd() {
  header.innerText = "You're all set!";
  topText.innerHTML = "You're ready to start enjoying your new Twitter experience. You may close this page now.";
  closeButton.classList.remove("d-none");
  instructions.classList.remove("d-none");
  skipButton.classList.add("d-none");
  loginButton.classList.add("d-none");
}

function showDownloadResult() {
  progressBarWrapper.classList.add("d-none");
  var number = Object.keys(result).length;
  topText.innerText = `Success! ${number} entries were loaded into the database.`;
  header.innerText = "Results";
  continueButton.classList.remove("d-none");
}

function setupAuth() {
  header.innerText = "Authorization";
  topText.innerHTML = "If you'd like to be able to report transphobes, you will need to log in with Twitter. " +
    "Your public Twitter ID is transmitted with the report for auditing purposes, but no other profile information is saved. " +
    "You can skip this part and come back to it later if you want by right-clicking any Twitter page and selecting 'Re-run setup'."
  continueButton.classList.add("d-none");
  loginButton.classList.remove("d-none");
  skipButton.classList.remove("d-none");
}

const setProgressbarValue = (payload) => {
  const { received, length, loading } = payload;
  const value = Math.round((received / length) * 100);
  progressBar.innerText = `${value}%`;
  progressBar.style.width = `${value}%`;
  progressRole.setAttribute('aria-valuenow', value);
};

window.addEventListener('fetch-progress', (e) => {
  setProgressbarValue(e.detail);
});

window.addEventListener('fetch-finished', (e) => {
  setProgressbarValue(e.detail);
});