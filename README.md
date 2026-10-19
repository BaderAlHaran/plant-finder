# 🌿 Plant Finder – كاشف النباتات

The site is in **Arabic** (right-to-left) and is made for phones.

Identify a plant from a photo and get a full care guide: watering schedule (summer & winter), light, soil, humidity, temperature, fertilizer, pet safety, repotting, propagation, common problems and tips.

## Privacy – nothing is saved

- The photo is analysed **inside your browser** with the open-source CLIP AI model (via [Transformers.js](https://github.com/huggingface/transformers.js)).
- Photos are **never uploaded** to any server.
- **No database, no accounts, no cookies, no localStorage.** Close the tab and everything is gone.
- The only network requests are downloading the code library and the AI model (~150 MB, the browser caches it so later visits are fast).

## Files

| File | What it does |
|------|--------------|
| `index.html` | The page |
| `style.css` | Styling (light & dark mode, works on phones) |
| `app.js` | Photo upload, AI detection, care guide display |
| `plants.js` | Care database – add more plants here |
| `render.yaml` | Render deploy settings (free static site) |
| `manifest.webmanifest`, `icon-*.png` | Home-screen app icon |

## 1. Put the code on GitHub

Create a new repository on GitHub (e.g. `plant-finder`) and upload all files in this folder (drag them into the GitHub web page, or use git):

```bash
git init
git add .
git commit -m "Plant Finder"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/plant-finder.git
git push -u origin main
```

## 2. Put it online with Render (free)

Deploy it as a **Static Site**, not a Web Service. Free static sites on Render are served from a CDN and **never go to sleep**, so no keep-alive ping is needed and the site opens instantly every time.

**Option A – Blueprint (uses `render.yaml`):**
1. In the Render dashboard click **New → Blueprint**.
2. Connect your GitHub account and pick the `plant-finder` repo.
3. Click **Apply**. Done.

**Option B – by hand:**
1. In the Render dashboard click **New → Static Site** and pick the repo.
2. **Build Command:** leave empty (or `echo ok`). **Publish Directory:** `.`
3. Click **Create Static Site**.

Your site is live at `https://plant-finder.onrender.com` (or similar) within a minute. Every push to GitHub updates it automatically.

**Add it to the phone home screen:** open the site on the phone → Share (iPhone) or ⋮ menu (Android) → **Add to Home Screen**. It gets its own leaf icon.

### Alternative: GitHub Pages

In the repo go to **Settings → Pages**, choose branch `main`, folder `/ (root)`, and click **Save**. It will be at `https://YOUR-USERNAME.github.io/plant-finder/`.

## Run it on your computer

Browsers block JavaScript modules opened directly from a file, so use a tiny local server:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Add a plant

Copy one entry in `plants.js` and change the details. Write the care text in Arabic, but keep the `label` field in **English**: it's what the AI compares the photo against (the model only understands English), so describe what the plant **looks like** (leaf shape, colour, flowers). Set `petSafe` to `true` or `false`.

## Note

The AI chooses the closest match among the plants in `plants.js` – a best guess, not a botanist. Double-check before eating any plant or if pets might chew it.
