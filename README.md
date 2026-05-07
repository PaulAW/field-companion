# 🌿 Field Companion

Mobile-first PWA for native prairie and woodland stewardship on Paul Winer's 7.77-acre SE Iowa property.

**Features:**
- 📷 **Plant ID** — take a photo, Claude AI identifies it and gives property-specific action advice
- 📍 **Field Log** — GPS-tagged observation entry, history view, CSV export for Google Sheets
- 🗺️ **Zones** — all 8 zones with invasive priorities and restoration goals
- ✅ **Tasks** — seasonal maintenance checklist with persistent state
- 📁 **Drive** — quick links to all Google Drive landscaping documents
- 📵 **Offline** — Log, Zones, Tasks, and Drive all work without internet

---

## Setup

### 1. Add your Google Drive links

Edit [`public/js/data/drive-links.json`](public/js/data/drive-links.json) and replace each `PASTE_YOUR_GOOGLE_DRIVE_LINK_HERE` value with the actual sharing URL from your Google Drive documents.

To get a sharing link in Google Drive: open the file → Share → Get link → Copy.

### 2. Get an Anthropic API key (for Plant ID only)

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account and add a payment method
3. Go to **API Keys** → **Create Key**
4. Copy the key (starts with `sk-ant-`)

> **Cost:** roughly $0.01 per plant identification. $5 in credits will last months at normal field use.
>
> **Note:** This is separate from Claude Pro. Claude Pro is the chat app; this requires the API.

### 3. Deploy to GitHub Pages

```bash
# 1. Create a new repo on github.com (e.g. "field-companion")

# 2. Push this folder
git init
git add .
git commit -m "Initial Field Companion build"
git remote add origin https://github.com/YOUR-USERNAME/field-companion.git
git push -u origin main

# 3. Enable GitHub Pages
#    Go to repo → Settings → Pages → Source: Deploy from branch → main → /public → Save
```

Your app will be live at: `https://YOUR-USERNAME.github.io/field-companion/`

### 4. Install on your phone (Android)

1. Open Chrome on your Samsung Galaxy S22
2. Navigate to your GitHub Pages URL
3. Tap the three-dot menu → **Add to Home screen**
4. The app installs as a PWA — works like a native app

### 5. Enter your API key

Open the app → tap ⚙️ in the top right → paste your `sk-ant-…` key → **Save key**.

The key is stored only on your device (localStorage) and is sent only to `api.anthropic.com`.

---

## App icons

The PWA manifest references `icons/icon-192.png` and `icons/icon-512.png`. For now these are missing (the app works without them but won't show a custom icon). To add icons:

1. Create a 512×512 PNG with a leaf or plant icon
2. Save it as `public/icons/icon-512.png`
3. Create a 192×192 version as `public/icons/icon-192.png`
4. Commit and push — the PWA will use them on next install

Free icon sources: [favicon.io](https://favicon.io) lets you generate from emoji — use 🌿.

---

## Updating zone data or tasks

- **Zone info** (invasives, targets, goals): edit `public/js/data/zones.json`
- **Seasonal tasks**: edit `public/js/data/tasks.json`
- **Drive links**: edit `public/js/data/drive-links.json`
- **AI prompt context** (confirmed natives, kill list): edit `public/js/data/property-context.json`

After editing, commit and push — GitHub Pages auto-deploys within ~1 minute.

---

## CSV column order (for Google Sheets paste)

```
Date | Zone | Lat | Lng | Location | Common Name | Latin Name | Native | Keystone | Type | Action | Photo | Logged By | Notes
```

---

## File structure

```
field-companion/
└── public/
    ├── index.html              ← App shell (single page)
    ├── manifest.json           ← PWA install config
    ├── service-worker.js       ← Offline cache
    ├── css/
    │   └── style.css
    ├── js/
    │   ├── app.js              ← Core: routing, IndexedDB, offline, toast
    │   ├── plant-id.js         ← Camera, Claude API, result display
    │   ├── logger.js           ← Observation form, history, CSV export
    │   ├── zones.js            ← Zone grid and detail
    │   ├── tasks.js            ← Seasonal checklist
    │   └── data/
    │       ├── zones.json
    │       ├── tasks.json
    │       ├── drive-links.json
    │       └── property-context.json
    └── icons/
        ├── icon-192.png        ← (add manually — see above)
        └── icon-512.png        ← (add manually — see above)
```
