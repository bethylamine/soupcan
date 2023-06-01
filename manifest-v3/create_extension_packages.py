import glob, os, shutil, sys

all_files = glob.glob("*")
for file in all_files:
	if file == sys.argv[0]:
		all_files.remove(file)
	if file.endswith(".zip"):
		all_files.remove(file)
	if file.startswith("extension-"):
		all_files.remove(file)

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
