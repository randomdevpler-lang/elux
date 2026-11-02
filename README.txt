ELUX 0.1.0 — iPhone-friendly PWA prototype

WHAT THIS VERSION DOES
- Provides an Elux-style interface.
- Lets the user select .ipa files from the iPhone Files picker.
- Saves IPA filenames and metadata in browser local storage.
- Can be added to the iPhone Home Screen when hosted over HTTPS.

IMPORTANT LIMITATION
This prototype does NOT sign or install IPA files. iOS requires a valid Apple signing certificate and a matching provisioning profile. A PWA cannot bypass iOS code-signing or install arbitrary apps.

NO-PC SETUP
1. Create a GitHub account if needed and create a new public repository named elux.
2. On your iPhone, open the repository in Safari and choose Add file > Upload files.
3. Upload index.html, style.css, app.js, manifest.webmanifest, and sw.js from this folder.
4. In the repository, open Settings > Pages.
5. Under Build and deployment, choose Deploy from a branch, select main and /(root), then Save.
6. Wait for GitHub Pages to publish, then open the Pages URL in Safari on your iPhone.
7. Tap Share > Add to Home Screen.

NOTE
The selected IPA's contents are not retained by this prototype; only its filename and metadata are saved. This is an initial UI/library foundation, not a native IPA installer.
