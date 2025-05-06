## 📖 Overview

The `garage/` folder powers the **2025 Cars Garage** section of the F1 Stories site. It provides an interactive, 3D-driven showcase of each team’s 2025 car, accompanied by dynamic driver cards and technical specifications. Everything here is client-side and static, leveraging JSON data and modular JavaScript to render models and related info.

---

## 🗂 Folder Structure

```
garage/
├── garage.html              # Main interactive 3D car viewer page citeturn1file3
├── garage.css               # Styles for the 3D model container, badges, and layout citeturn1file2
├── garage.js                # Main script: team selection, model toggling, data loading
├── f1-driver-cards.css      # Styles for driver info cards and standings tables citeturn1file0
├── f1-driver-cards.js       # Script: generates driver cards from JSON data
├── enhanced-specs.js        # Script: augments static car specs with interactive features
└── f1-teams-data.json       # JSON with teams, constructors, drivers, and current standings citeturn1file1
```

---

## 📄 garage.html

* Contains the **hero section** and **navbar** linking back to main site.
* Renders a grid of **team badges** (`.team-badge`) that users click to select a team.
* Hosts a `.model-container` with hidden `<iframe>` embeds for each team’s Sketchfab model.
* Includes placeholders: a loading spinner and a "select a team" prompt. citeturn1file3

---

## 🎨 garage.css

* Styles `.team-badges` flex layout for badge grid and active/hover states on `.team-badge` elements.
* Defines `.model-container` dimensions, gradient header bar, and smooth fade-in of visible models.
* Provides responsive adjustments for mobile breakpoints, ensuring car models and badges scale properly. citeturn1file2

---

## 🛠 Scripts Overview

### `garage.js`

Handles:

1. **Initialization**: Loads `f1-teams-data.json` and initializes badge elements.
2. **Team Selection**: On `.team-badge` click, hides all model iframes, marks clicked badge active, shows corresponding iframe with fade-in.
3. **Driver & Specs Rendering**: Invokes functions from `f1-driver-cards.js` and `enhanced-specs.js` to populate driver cards and technical details.

### `f1-driver-cards.js`

* Reads `f1-teams-data.json` to extract each driver’s name, number, position, nationality, and age.
* Dynamically builds `.driver-card` elements and appends them into a grid under the model viewer.

### `enhanced-specs.js`

* Parses the same JSON to pull constructor info (chassis, power unit, base, principal).
* Enhances static HTML spec blocks by injecting values and adding interactive tooltips or animations.

> *Note: Both scripts are written in vanilla JS and have no external dependencies.*

---

## 🗃 f1-teams-data.json

This file is the single source of truth for:

* **Driver details**: name, car number, age, nationality, and championship position.
* **Constructor info**: team name, principal, base, first season, current standings, points, chassis, power unit.
* **Season standings**: top 20 driver standings with points and teams.

Updating this JSON (e.g., after a race) immediately reflects changes across driver cards and spec sections without touching any script or HTML. citeturn1file1

---

## 🚀 Usage

1. **Clone** the repo and `cd garage/`.
2. **Serve** with a static server:

   ```bash
   npx http-server . -p 4000
   ```
3. **Visit** `http://localhost:4000/garage.html` to explore.

> No build tools or package installs are required—everything runs in-browser.

---

## ✨ Customization

* **Add new teams**: Append an entry in `f1-teams-data.json`, include a badge in `garage.html`, and ensure a corresponding Sketchfab `<iframe>` wrapper with matching `id`.
* **Swap models**: Update the `src` URL on the iframe for each team.
* **Style tweaks**: Modify `garage.css` or theme via CSS variables at the top of the file.
* **Custom scripts**: Extend `enhanced-specs.js` to add charts or graphs for power unit performance.

---

## 🛠 Troubleshooting

* **Models not visible**: Confirm the `<iframe id>` matches the `.team-badge[data-team]` value.
* **JSON load errors**: Serve via HTTP (file:// won’t load JSON due to CORS). Ensure `f1-teams-data.json` is in the same directory.
* **Badge hover inactive**: Check CSS selectors in `f1-driver-cards.css` and `garage.css` for overrides.

---

## 📘 License & Contribution

This folder follows the project’s **MIT License**. Contributions (new teams, improved specs, UI enhancements) are welcome via PRs against `main` branch—please follow existing style and test via local server before submitting.
