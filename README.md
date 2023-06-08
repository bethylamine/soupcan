# Soupcan

![icon128](https://user-images.githubusercontent.com/130214958/235278689-2c66607f-2665-48da-b668-915c23296418.png)

### A cross-browser extension for Twitter to bring [@WhatIsAWomanBot](https://twitter.com/WhatIsAWomanBot) features into your browser created by [@bethylamine](https://twitter.com/bethylamine).

Thank you to [@VehpuS](https://twitter.com/VehpuS) for helping me get started with extension development!

## Features

* Highlight users on WhatIsAWomanBot's transphobe database
* Report transphobes/appeal unfair labels
* Hide media/tweets from transphobes behind interstitials (prevent shock posting)

## Future Features

* Be able to highlight hashtags / report transphobic hashtags
* Add trans-supportive library tool to provide you with relevant trans-supportive information you can reply with quickly
* Auto-suggest debunking sources

If you have any cool ideas, please pop a message into the **Issues** tab, or message me, [@bethylamine](https://twitter.com/bethylamine), on Twitter.

## Install

[![Available from Chrome Webstore](chrome.png)](https://chrome.google.com/webstore/detail/soupcan/hcneafegcikghlbibfmlgadahjfckonj)
[![Available from Firefox Add-ons](firefox.png)](https://addons.mozilla.org/en-US/firefox/addon/soupcan/)

For Edge, Opera, Arc and other Chromium-based browsers, use the Chrome version.

### From Source (Latest features, may have bugs, no auto-update)

1. Download the repository (either by zip or with git, if you're comfortable) and save it somewhere.
2. Search for how to load an unpacked extension in your browser of choice, then select the `manifest-v3` directory as the extension.
3. For firefox, delete `manifest.json` and rename `manifest-firefox.json` to `manifest.json`, and load that.

## How to update (from source)

1. With new features you'll need to update the extension. Download the latest version from here (or if you have it checked
   out with git, just do a git pull) and reload the extension (click the reload button in your extension page)
   
![image](https://user-images.githubusercontent.com/130214958/235387341-f1449b9d-7a41-46a0-95e3-b51aa3a6a498.png)

## Conflicts

The extension works while Shinigami Eyes is installed, but for the best experience, disable Shinigami Eyes while using this extension.

The extension *should* work with GoodTwitter2.

## How To Use

Full guide: https://bethylamine.github.io/library/browser-extension/

### Reporting Users

Right click on the username and select soupcan click on "report user"

### Appealing User Labels

Right click on the username and select soupcan click on "appeal label"
