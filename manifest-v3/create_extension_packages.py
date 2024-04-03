import os, shutil, sys

try:
    if os.path.exists("soupcan-chrome.zip"):
        os.remove("soupcan-chrome.zip")
    if os.path.exists("soupcan-ff.zip"):
        os.remove("soupcan-ff.zip")
except Exception as e:
    print("Unable to remove existing zips. Are they in use?")
    raise e

shutil.copytree(".", "extension-chrome")
os.remove(os.path.join("extension-chrome", "manifest-firefox.json"))
shutil.make_archive(base_name="soupcan-chrome", format="zip", root_dir="extension-chrome")
shutil.rmtree("extension-chrome")

shutil.copytree(".", "extension-firefox")
os.remove(os.path.join("extension-firefox", "manifest.json"))
os.remove(os.path.join("extension-firefox", "soupcan-chrome.zip"))
os.rename(os.path.join("extension-firefox", "manifest-firefox.json"), os.path.join("extension-firefox", "manifest.json"))
shutil.make_archive(base_name="soupcan-ff", format="zip", root_dir="extension-firefox")
shutil.rmtree("extension-firefox")
