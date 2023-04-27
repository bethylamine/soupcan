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
continueButton.addEventListener("click", goToEnd);
loginButton.addEventListener("click", launchTwitterLogin)

var result = {};

async function startDownload() {
  progressBarWrapper.classList.remove("d-none");
  downloadButton.classList.add("d-none");
  topText.innerText = "Downloading extension data... Please keep this tab open. If this doesn't start within 10 seconds, please DM me on Twitter";
  header.innerText = "Update";

  setTimeout(async () => {
    const { json, cancel } = http('https://wiaw-extension.s3.us-west-2.amazonaws.com/');
    result = await json("dataset.json");

    browser.storage.local.set({
      "database": {
          "last_updated": Date.now(),
          "salt": result["salt"],
          "entries": result["entries"]
        }
    });

    showDownloadResult();
  }, 100);
}

function makeid(length) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

function launchTwitterLogin() {
  var state = makeid(30);
  var url = "https://twitter.com/i/oauth2/authorize?response_type=code&client_id=VGs4NXk4c19MR3M3bFYwNGlhdDA6MTpjaQ&redirect_uri=https%3A%2F%2Fapi.beth.lgbt%2Fextension-login&scope=tweet.read+users.read+offline.access&state=" + state + "&code_challenge=challenge&code_challenge_method=plain"
  window.open(url);

  checkLogin(state);
}

async function checkLogin(state) {
  try {
    const response = await fetch("https://api.beth.lgbt/extension-login-check?state=" + state);
    const jsonData = await response.json();
    if ("response" in jsonData) {
      var resp = jsonData["response"]
      if (resp == "none") {
        // retry in a bit
        setTimeout(() => checkLogin(state), 1000);
      } else if (resp == "true") {
        // all good
        browser.storage.local.set({
          "state": state
        });
        goToDownload();
      } else if (resp == "false") {
        // all bad
      } else {
        topText.innerHTML = "Something went wrong with the authorization validation. Sorry, please contact @bethylamine! resp was " + resp;
      }
    } else {
      topText.innerHTML = "Something went wrong with the authorization validation. Sorry, please contact @bethylamine! jsonData was " + JSON.stringify(jsonData);
    }

  } catch (error) {
    topText.innerHTML = "Something went wrong with the authorization validation. Sorry, please contact @bethylamine! Error: " + error;
  }
}

function goToDownload() {
  header.innerText = "Download";
  topText.innerHTML = "Now we will need to download the extension database.";
  loginButton.classList.add("d-none");
  downloadButton.classList.remove("d-none");
}

function goToEnd() {
  header.innerText = "You're all set!";
  topText.innerHTML = "You're ready to start enjoying your new Twitter experience. You may close this page now.";
  closeButton.classList.remove("d-none");
  instructions.classList.remove("d-none");
  loginButton.classList.add("d-none");
  continueButton.classList.add("d-none");
}

function showDownloadResult() {
  progressBarWrapper.classList.add("d-none");
  var number = Object.keys(result).length;
  topText.innerText = `Success! The database was loaded.`;
  header.innerText = "Results";
  continueButton.classList.remove("d-none");
}

const setProgressbarValue = (payload) => {
  const { received, length, loading } = payload;
  const value = Math.max(0, Math.min(100, Math.round((received / length) * 100)));
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