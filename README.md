∂
---

## 📖 Overview

**F1 Stories Page** is a static, single-page website dedicated to all things Formula 1. It aggregates and presents:

* A rich collection of **episodes** (podcasts, audio stories, interviews)
* An integrated **blog module** for written articles
* An **e-shop** for merch and memorabilia
* Fun **memes** and **media galleries**
* Embedded **Spotify** players
* A dedicated **“Garage”** section showcasing behind-the-scenes content
* Privacy policy and fallback pages for robust UX

Built with plain HTML, CSS and JavaScript, this repository is optimized for deployment via GitHub Pages (custom domain supported via the included `CNAME`) and can be served by any static-site host.

The project’s codebase is organized into logical modules for easy navigation and future expansion ([GitHub][1]).

---

## 🚀 Features

* **Episode Browser**
  Browse and stream F1 audio stories; metadata and media files live under `episodes/` ([GitHub][1]).
* **Blog Module**
  A lightweight blog system located in `blog-module/` with templating scripts for new posts ([GitHub][1]).
* **E-Shop Integration**
  A static storefront in `eshop/` showcasing merch, with cart fallbacks under `fallback/` ([GitHub][1]).
* **Spotify Embeds**
  Preconfigured embeds live in `spotify/` for seamless audio integration ([GitHub][1]).
* **Privacy & Fallback**
  GDPR-ready privacy policy in `privacy/` and offline/fallback pages to handle missing routes ([GitHub][1]).
* **Responsive Design**
  Mobile-first layout defined in `styles/` (with `styles.css` at the root for global overrides) ([GitHub][1]).
* **Asset Management**
  Organized images under `images/`, plus a dedicated `memes/` folder for F1 humor ([GitHub][1]).
* **Automation & Scripts**
  Build, deploy and data-ingest scripts reside in `scripts/` for CI workflows ([GitHub][1]).

---

## 📦 Installation

This is a static site—no build step is strictly required. To run locally:

1. **Clone the repository**

   ```bash
   git clone https://github.com/georgiosbalatzis/f1StoriesPage.git
   cd f1StoriesPage
   ```
2. **Serve with any static HTTP server**

    * Using [http-server](https://www.npmjs.com/package/http-server):

      ```bash
      npx http-server . -p 8080
      ```
    * Or simply open `index.html` in your browser.

---

## 💻 Usage

* **Navigate** to `http://localhost:8080` (or whichever host/port you chose).
* **Browse** the Episodes, read Blog posts, visit the Garage, or shop in the E-shop.
* All content is client-side; no backend or database is required.

---

## 🗂 Project Structure

```
f1StoriesPage/
├── .idea/              # IDE configs
├── blog-module/        # Templates & assets for blog posts
├── data/               # Raw data files (JSON, CSV) powering episodes
├── episodes/           # Individual episode pages
├── eshop/              # Static storefront pages
├── fallback/           # Offline/fallback HTML pages
├── garage/             # “Garage” section content
├── images/             # Global images and icons
├── memes/              # F1-themed meme assets
├── privacy/            # GDPR/privacy policy page
├── scripts/            # Build & deployment scripts
├── spotify/            # Spotify embed code snippets
├── styles/             # SCSS/CSS partials
├── CNAME               # Custom domain file for GitHub Pages
├── index.html          # Main entry point
├── styles.css          # Global stylesheet
└── .DS_Store           # macOS metadata (safe to ignore)
```

*All major modules are organized for clarity and maintainability* ([GitHub][1]).

---

## 🛠 Technologies

* **HTML5** (73.7%)
* **JavaScript** (16.5%)
* **CSS3** (7.2%)
* **Shell** scripts (2.6%)
  *(percentages reflect GitHub language statistics)* ([GitHub][1])

---

## ⚙️ Scripts

All automation scripts live in the `scripts/` folder. Common tasks include:

| Script           | Description                               |
| ---------------- | ----------------------------------------- |
| `build.sh`       | Preprocess assets, compile SCSS, etc.     |
| `deploy.sh`      | Push `main` branch to GitHub Pages        |
| `import_data.sh` | Ingest new episode metadata from CSV/JSON |

*Run with `bash scripts/<script-name>.sh`.*

---

## 🚢 Deployment

This project is ideally deployed to **GitHub Pages**:

1. Ensure `CNAME` contains your custom domain (if used).
2. Push to the `main` branch.
3. Enable GitHub Pages under **Settings → Pages** in your repo, selecting `main` as the source.

Alternatively, any static host (Netlify, Vercel, Surge) will work out of the box.

---

## 🤝 Contributing

1. Fork the repo.
2. Create a feature branch: `git checkout -b feature/my-feature`.
3. Commit your changes: `git commit -m "Add my feature"`.
4. Push to your fork: `git push origin feature/my-feature`.
5. Open a Pull Request against `main`.

Please follow the existing code style, and ensure any new code is covered by relevant tests or manual QA.

---

## 📝 License

This project is released under the **MIT License**. See [LICENSE](LICENSE) for details.

---

## ✉️ Contact

For questions or feedback, reach out to:

* **Georgios Balatzis**
* Email: `your.email@example.com` (replace with your actual address)

---

*Built with ❤️ for the F1 community.*

[1]: https://github.com/georgiosbalatzis/f1StoriesPage "GitHub - georgiosbalatzis/f1StoriesPage"
