# F1 Stories

F1 Stories is a Greek-language Formula 1 publishing site at [f1-stories.gr](https://f1-stories.gr), covering news, analysis and history. This repository contains the main site, its editorial and build tools, and the static publishing pipeline. Separate sibling repositories provide applications that are assembled into the same deployed site.

## What's on the site

- Articles, the blog archive and editorial discovery pages.
- THE GRID standings and Race Desk Grand Prix pages.
- Browser-based author tools for creating and maintaining articles.
- An Intelligence dashboard backed by an encrypted snapshot.

The deployment also includes these sibling applications. Their source repositories and exact commit pins are recorded in [sources.json](scripts/deployment/sources.json); TYRES additionally refreshes data from its configured `main` data path during assembly.

| Application | Site path | Source repository |
| --- | --- | --- |
| Telemetry | `/telemetry/` | [f1-telemetry-dashboard](https://github.com/georgiosbalatzis/f1-telemetry-dashboard) |
| GhostCar | `/ghostcar/` | [ghostcar](https://github.com/georgiosbalatzis/ghostcar) |
| TYRES | `/tyres/` | [Tyres](https://github.com/georgiosbalatzis/Tyres) |
| BetCast | `/betcast/` | [BetCastVisualisation](https://github.com/georgiosbalatzis/BetCastVisualisation) |

## Quick start

Use Node.js 22, the version used for the main site in CI; `package.json` requires Node 22 or newer.

```bash
npm ci
npm run preview
```

Preview builds and checks assets, then serves the repository root at `http://127.0.0.1:4173/` by default. To run the author tools, use another terminal:

```bash
node scripts/author/serve-tools.mjs
```

The author server defaults to `http://127.0.0.1:4179/` and prints the tool URLs. A root preview is not the production artifact: production serves the filtered `dist/` build.

## Common tasks

| Command | Purpose |
| --- | --- |
| `npm run build` | Generate shared HTML, blog output and browser assets. |
| `npm run build:public` | Build and validate the main site's public `dist/` artifact. |
| `npm run build:blog` | Rebuild blog output and stamp article HTML. |
| `npm run build:blog:force` | Force a full blog rebuild. |
| `npm run build:assets` | Generate and stamp browser assets. |
| `npm run build:image-variants` | Generate article image variants. |
| `npm run test:blog` | Run blog and widget tests and golden-output checks. |
| `npm run test:author` | Run author tool tests. |
| `npm run test:standings` | Run standings core tests. |
| `npm run test:build` | Run build tests. |
| `npm run test:deployment` | Run deployment tests. |
| `npm run build:check` | Check generated output for drift. |
| `npm run quality:static` | Run static source, CSS, rendering-sink and design-token guards. |
| `npm run perf:budget` | Check asset size budgets. |
| `npm run verify` | Run the broader local build, test, browser and performance gate. |
| `npm run build:ecosystem -- --node-bin 24=<bin-directory>` | Build the assembled site with sibling applications. |
| `npm run test:integration` | Smoke-test an assembled site. |

With Node 22, the ecosystem build also needs a Node 24 installation for TYRES; point `<bin-directory>` to its binaries. Release builds require clean sources. `verify` needs Chrome; `test:integration` needs Chromium or Chrome. Set `CHROME_PATH` if needed.

## Publishing an article

1. Start the author server and use `generate.html` to create an article, or `housekeeping.html` to edit an existing one. The latter only edits articles with a `source.txt` file.
2. Add a fine-grained GitHub token in the tool and publish. Ordinary publishes use an `author/...` branch; editorial-review publishes and material corrections use `editorial/review/...`.
3. **Site Quality** checks the PR. After it succeeds, **Publish Article** verifies and merges trusted author-branch PRs. Editorial-review PRs require human review and manual merge.
4. The publishing workflow runs the blog build and commits generated changes when needed, then calls deployment. For manual local work, run `npm run build:blog`: it generates article HTML, indexes and discovery pages, author pages, sitemap and feed from the article sources and committed data.

See the [publishing model](docs/static-publishing-model.md) and [article media policy](docs/article-media-policy.md) for details.

## Build and deploy

A main-site `build:public` runs Pages and newsletter guards, expands shared HTML, builds the blog and assets, validates data contracts, then assembles and validates a filtered `dist/`. Generated blog output is committed; `dist/` is the deployment artifact.

On a push to `main`, **Site Maintenance** routes the change, regenerates blog artifacts when needed and calls **Deploy Pages**. The deploy workflow checks out current `main`, runs the shared Pages preparation action, uploads `dist/` and deploys it to GitHub Pages. Successful blog maintenance deploys even without generated changes; standings maintenance deploys when it commits a change. **Deploy Pages** also has scheduled and manual entry points.

Aggregation is enabled in [sources.json](scripts/deployment/sources.json): the Pages action builds the pinned sibling applications, assembles them with the main site and runs artifact and release checks. **Ecosystem acceptance** exercises the assembled site on relevant PRs. **Publish Article** handles the trusted author PR flow; **Intelligence Snapshot**, **Intelligence Health**, **TYRES pin update**, and **Security Headers** handle their respective operational checks and updates.

## Repository layout

| Directory | Contents |
| --- | --- |
| `.claude/` | Coding-assistant settings. |
| `.github/` | Actions, workflows and dependency configuration. |
| `assets/` | Fonts and their licences. |
| `authors/` | Generated author pages. |
| `blog-module/` | Article sources, media, publishing engine and blog runtime. |
| `dashboard/` | Intelligence dashboard and snapshot. |
| `data/` | Site data, manifests and provider captures. |
| `docs/` | Maintainer guides and operational documentation. |
| `experiments/` | Research and editorial experiments. |
| `f1telemetry/` | Legacy telemetry redirect. |
| `ghostcar/` | GhostCar fallback page. |
| `images/` | Site and editorial image assets. |
| `partials/` | Shared HTML fragments. |
| `perf/` | Performance budgets, fixtures and RUM material. |
| `privacy/` | Privacy and terms pages. |
| `quality/` | Reviewed rendering-sink baseline. |
| `race-desk/` | Generated Grand Prix pages. |
| `scripts/` | Build, authoring, deployment, quality and operations tools. |
| `standings/` | THE GRID runtime, data and tests. |
| `styles/` | Shared and route-specific styles. |
| `tyres/` | TYRES fallback page. |

## Quality gates

**Site Quality** runs on PRs to `main`, with a narrower route for content-only changes. Its checks include:

- Public artifact build, Pages and newsletter guards, data contracts and artifact validation.
- Generated drift checks for non-content-only changes, plus static source, rendering and design-token guards.
- Asset size budgets and editorial media checks.
- Blog, author, standings, security and deployment tests, with additional module tests where applicable.
- Browser and presentation checks, including Race Desk and layout checks for applicable changes.

**Ecosystem acceptance** also builds and checks the assembled site for relevant changes. See the [CI guide](docs/ci/README.md) for routing and details.

## Further documentation

- [Static publishing model](docs/static-publishing-model.md)
- [CI guide](docs/ci/README.md)
- [Deployment architecture](docs/deployment-architecture.md)
- [Article media policy](docs/article-media-policy.md)
- [Article URL policy](docs/search/article-url-policy.md)
- [Release checklist](docs/release-checklist.md)
- [Intelligence operations](docs/intelligence/operations.md)
