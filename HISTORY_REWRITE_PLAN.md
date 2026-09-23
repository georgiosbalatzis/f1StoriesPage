# History Rewrite Plan

Status: **EXECUTED as strategy B1 (clean baseline, force-push to the same repo) on 2026-09-23**, on owner instruction. See the Execution record at the end.
Prepared 2026-09-23 against `main` at `96e70a7aa`, after the current-tree cleanup in [`REPO_CLEANUP_REPORT.md`](./REPO_CLEANUP_REPORT.md).

**Precondition:** commit and push the current-tree cleanup to `main` first. For the clean baseline, also commit the refreshed icon-sprite shells: run `npm run build:public`, then commit the 10 shell files. That way `main^{tree}`, which the backup records and the rewrite must reproduce, is a tree that passes `build:check`. The purge list is computed as "historical paths that are **not** in the current tree". It must run after `audit/`, `design-experiments/` and `graphify-out/` are gone from `main`, or they would be kept.

## Current Git history size

| Measure | Value |
|---|---|
| Local `.git` | 1.4 GB. `size-pack` 1.35 GiB, 3 packs, 79,640 objects |
| On-disk objects by type | blobs 41,058 = 1,383.8 MB · trees 37,058 = 3.2 MB · commits 1,598 = 0.5 MB |
| Commits on `main` | 1,594 (2025-04-02 → 2026-09-23) |
| Unique blobs in history | 40,316, with 5,253 MB unpacked / 1,382 MB packed (`git filter-repo --analyze`) |
| Blobs still needed by the cleaned tree | 203.6 MB packed |
| History not needed by the cleaned tree | 1,178.3 MB packed (85% of the pack) |
| GitHub-reported size | 1,417,609 KB |
| Refs | `refs/heads/main` only. 0 tags, 0 notes, 0 replace refs, 0 stashes. GitHub holds 188 read-only `refs/pull/*`. 0 forks. |

Tooling used: `git filter-repo --analyze` (read-only report in `.git/filter-repo/analysis/`), `git cat-file --batch-all-objects`, `git log`. `git-sizer` is not installed.

## Top historical bloat

By class of packed bytes that no current file needs:

| Source | Packed | Notes |
|---|---:|---|
| `audit/` screenshots | 440.4 MB | Removed from the tree in this pass |
| `blog-entries/*/narration.mp3` (TTS audio) | 375.5 MB | 203 paths, all deleted 2026-04-22 |
| `blog-entries/**/*.docx` (article sources) | 118.3 MB | 246 paths, all deleted 2026-04-14 and now gitignored. **Owner decision:** these are the only original sources of the legacy articles. |
| `design-experiments/` | 75.5 MB | Removed from the tree in this pass |
| `garage/` (3D `.glb`/`.usdz`, data) | 28.7 MB | Deleted 2026-03-14 |
| Deleted raw article `.png/.jpg/.jpeg` | 17.0 MB | Includes the 14 removed in this pass |
| Deleted `images/**` (`sponsors/*.png`, `default.png`, `logo.png`, old `bg`, `4041/4042.webp`, …) | 17.3 MB | Old versions of now-optimized site images |
| DOCX `extracted/` temp folders | 6.5 MB | Processor scratch output that was committed by mistake |
| `memes/` | 5.9 MB | Deleted 2026-03-14 |
| Deleted/renamed-away article `.webp/.avif` | 9.4 MB | Only blobs not also used by a current path |
| Other deleted media (`.mp4`, `images/audio`, `images/fallback`, `.bak`, `.build/`, `graphify-out/`) | 8.3 MB | |
| **Old versions of current files** (mostly 28,982 `article.html` revisions) | ≈ 75 MB | **Only the clean-baseline strategy removes these** |

Top 20 historical paths by packed size:

| Packed | Unpacked | Deleted | Path |
|---:|---:|---|---|
| 12.2 MB | 14.1 MB | 2026-04-22 | `blog-module/blog-entries/20250530G/narration.mp3` |
| 10.9 MB | 17.0 MB | 2026-04-14 | `blog-module/blog-entries/20250613G/Now write an article like the one you just read,....docx` |
| 9.8 MB | 9.9 MB | 2026-04-14 | `blog-module/blog-entries/20250602-1G/Ισπανικό GP 2025_ Αναφορά Αγώνα_.docx` |
| 9.7 MB | 10.6 MB | 2026-04-22 | `blog-module/blog-entries/20250528G/narration.mp3` |
| 9.7 MB | 9.9 MB | 2026-04-14 | `blog-module/blog-entries/20250704G/Οριστε και τα updates..docx` |
| 9.2 MB | 11.5 MB | 2026-04-22 | `blog-module/blog-entries/20250804G/narration.mp3` |
| 9.0 MB | 10.3 MB | 2026-04-22 | `blog-module/blog-entries/20250817G/narration.mp3` |
| 8.9 MB | 17.5 MB | 2026-03-14 | `garage/data/AudiF12026.glb` |
| 8.8 MB | 34.6 MB | 2026-03-14 | `garage/data/f1circ.usdz` |
| 8.1 MB | 9.0 MB | 2026-04-22 | `blog-module/blog-entries/20250603GF/narration.mp3` |
| 7.7 MB | 7.9 MB | 2026-04-14 | `blog-module/blog-entries/20250712G/Ψύξη F1_ Απόδοση και Θερμοκρασία_(1).docx` |
| 7.5 MB | 8.2 MB | 2026-04-22 | `blog-module/blog-entries/20250602-1G/narration.mp3` |
| 7.4 MB | 7.5 MB | 2026-04-14 | `blog-module/blog-entries/20250530-1G/2025SpainGpUpgrades.docx` |
| 7.4 MB | 8.0 MB | 2026-04-22 | `blog-module/blog-entries/20250610G/narration.mp3` |
| 6.7 MB | 7.4 MB | 2026-04-22 | `blog-module/blog-entries/20250607G/narration.mp3` |
| 6.5 MB | 7.4 MB | 2026-04-22 | `blog-module/blog-entries/20250919G/narration.mp3` |
| 6.5 MB | 7.4 MB | 2026-04-22 | `blog-module/blog-entries/20250725G/narration.mp3` |
| 6.2 MB | 6.8 MB | 2026-04-22 | `blog-module/blog-entries/20250515GF/narration.mp3` |
| 6.0 MB | 12.2 MB | 2026-04-14 | `blog-module/blog-entries/20250627G/2025AustriaGPUpgrades.docx` |
| 6.0 MB | 6.1 MB | this pass | `audit/final-sweep/tables-390-light--full.png` |

Checked and absent from history: `node_modules/`, `dist/`, zip/tar archives, PDFs, source maps (5.6 KB only).

### Top 100 historical blobs

"First / last commit" is the first and last commit that touched the blob's primary path. "In cleaned tree" means the blob is still needed after this pass. A blob is a rewrite candidate when it is in the surgical purge set below.

| # | Packed | Unpacked | Blob SHA | Path(s) | First / last commit (path) | In HEAD | In cleaned tree | Rewrite candidate | Reason |
|---:|---:|---:|---|---|---|---|---|---|---|
| 1 | 12.20 MB | 14.09 MB | `9ac7dcb125f7` | `blog-module/blog-entries/20250530G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 2 | 9.73 MB | 10.57 MB | `7afb2161e237` | `blog-module/blog-entries/20250528G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 3 | 9.21 MB | 11.48 MB | `e97b444bdef3` | `blog-module/blog-entries/20250804G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 4 | 8.95 MB | 10.27 MB | `66b2a3ed63ae` | `blog-module/blog-entries/20250817G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 5 | 8.88 MB | 17.54 MB | `9f92e7f298e1` | `garage/data/AudiF12026.glb` | 2291a43b6 2025-05-03 / ae50efa37 2026-03-14 | no | no | yes | 3D model asset, garage/ removed 2026-03-14 |
| 6 | 8.76 MB | 34.63 MB | `fcacd027b39e` | `garage/data/f1circ.usdz` | 7563e4bcc 2025-05-03 / ae50efa37 2026-03-14 | no | no | yes | 3D model asset, garage/ removed 2026-03-14 |
| 7 | 8.13 MB | 9.03 MB | `581892918e13` | `blog-module/blog-entries/20250603GF/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 8 | 7.53 MB | 8.16 MB | `f8fd24adfd36` | `blog-module/blog-entries/20250602-1G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 9 | 7.36 MB | 8.00 MB | `c6be418537b8` | `blog-module/blog-entries/20250610G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 10 | 6.82 MB | 6.86 MB | `35d4bcc9468c` | `blog-module/blog-entries/20250613G/Now write an article like the one you just read,....docx` | c19456aae 2025-06-13 / 246d0655f 2026-04-14 | no | no | yes | article source DOCX, untracked by policy (owner decision) |
| 11 | 6.74 MB | 7.41 MB | `7c0a496b0f4b` | `blog-module/blog-entries/20250607G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 12 | 6.55 MB | 7.42 MB | `a21d75a83b40` | `blog-module/blog-entries/20250919G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 13 | 6.48 MB | 7.41 MB | `01ead964e053` | `blog-module/blog-entries/20250725G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 14 | 6.20 MB | 6.79 MB | `7b786ab7c1cd` | `blog-module/blog-entries/20250515GF/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 15 | 5.99 MB | 6.07 MB | `f0a2a61888ce` | `audit/final-sweep/tables-390-light--full.png` | a51c3a716 2026-09-23 / a51c3a716 2026-09-23 | yes | no | yes | agent audit screenshot (removed in this cleanup) |
| 16 | 5.92 MB | 6.73 MB | `8db5342d4495` | `blog-module/blog-entries/20250820G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 17 | 5.88 MB | 5.93 MB | `864d68d6b0c2` | `blog-module/blog-entries/20250602-1G/Ισπανικό GP 2025_ Αναφορά Αγώνα_.docx` | 968c98a79 2025-06-02 / 246d0655f 2026-04-14 | no | no | yes | article source DOCX, untracked by policy (owner decision) |
| 18 | 5.87 MB | 5.92 MB | `9441c45c4ca6` | `blog-module/blog-entries/20250602G/Aston Martin F1_ Γιατί οι Οδηγοί της «Δουλεύουν» Περισσότερο το Τιμο…` | a06351103 2025-06-02 / 246d0655f 2026-04-14 | no | no | yes | article source DOCX, untracked by policy (owner decision) |
| 19 | 5.87 MB | 5.91 MB | `352cacbe3b62` | `blog-module/blog-entries/20250919G/Ενημέρωση Άρθρου GP Μπακού 2025.docx` | a591fadd4 2025-09-19 / 246d0655f 2026-04-14 | no | no | yes | article source DOCX, untracked by policy (owner decision) |
| 20 | 5.87 MB | 5.91 MB | `4e5aa7d01994` | `blog-module/blog-entries/20250704G/Οριστε και τα updates..docx` | fcbd20e66 2025-07-04 / 246d0655f 2026-04-14 | no | no | yes | article source DOCX, untracked by policy (owner decision) |
| 21 | 5.86 MB | 5.91 MB | `d626cd3a3132` | `blog-module/blog-entries/20250618G/Kausima.docx` | 9df312a6f 2025-06-20 / 246d0655f 2026-04-14 | no | no | yes | article source DOCX, untracked by policy (owner decision) |
| 22 | 5.85 MB | 6.57 MB | `3f87bc5574a1` | `blog-module/blog-entries/20250808G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 23 | 5.84 MB | 6.39 MB | `228c2464e9fd` | `blog-module/blog-entries/20250602G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 24 | 5.81 MB | 7.24 MB | `3ff00b977457` | `blog-module/blog-entries/20250727G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 25 | 5.51 MB | 6.16 MB | `9d110f3984a9` | `blog-module/blog-entries/20250615G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 26 | 5.34 MB | 6.18 MB | `4c6fde07ef06` | `blog-module/blog-entries/20250823G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 27 | 5.12 MB | 5.70 MB | `bf69d503e296` | `blog-module/blog-entries/20250806G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 28 | 5.07 MB | 7.40 MB | `653290878df9` | `garage/data/AudiF12026.usdz` | 794902b46 2025-05-03 / ae50efa37 2026-03-14 | no | no | yes | 3D model asset, garage/ removed 2026-03-14 |
| 29 | 5.05 MB | 5.73 MB | `4692631d2e65` | `blog-module/blog-entries/20250814G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 30 | 4.98 MB | 5.95 MB | `5fdd090942cb` | `blog-module/blog-entries/20250901G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 31 | 4.92 MB | 5.52 MB | `e31bc854885f` | `blog-module/blog-entries/20250805G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 32 | 4.91 MB | 4.99 MB | `ac3be3dfdeb5` | `audit/final-sweep/tables-320-light--full.png` | a51c3a716 2026-09-23 / a51c3a716 2026-09-23 | yes | no | yes | agent audit screenshot (removed in this cleanup) |
| 33 | 4.91 MB | 4.99 MB | `f7d4ad168c42` | `audit/final-sweep/tables-390-dark--full.png` | a51c3a716 2026-09-23 / a51c3a716 2026-09-23 | yes | no | yes | agent audit screenshot (removed in this cleanup) |
| 34 | 4.84 MB | 5.47 MB | `0c8a5e685323` | `blog-module/blog-entries/20250821G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 35 | 4.21 MB | 4.29 MB | `054f0e3502a3` | `audit/final-sweep/tables-1440-light--full.png` | a51c3a716 2026-09-23 / a51c3a716 2026-09-23 | yes | no | yes | agent audit screenshot (removed in this cleanup) |
| 36 | 4.09 MB | 4.19 MB | `bbeec2eac8f3` | `blog-module/blog-entries/20250613G/Now write an article like the one you just read,....docx` | c19456aae 2025-06-13 / 246d0655f 2026-04-14 | no | no | yes | article source DOCX, untracked by policy (owner decision) |
| 37 | 4.04 MB | 4.11 MB | `10a02cc03c0b` | `audit/final-sweep/tables-320-dark--full.png` | a51c3a716 2026-09-23 / a51c3a716 2026-09-23 | yes | no | yes | agent audit screenshot (removed in this cleanup) |
| 38 | 3.98 MB | 4.00 MB | `38093fa0b007` | `blog-module/blog-entries/20250530-1G/2025SpainGpUpgrades.docx` | 456b79e47 2025-05-30 / 246d0655f 2026-04-14 | no | no | yes | article source DOCX, untracked by policy (owner decision) |
| 39 | 3.94 MB | 4.39 MB | `a9a83ccad907` | `blog-module/blog-entries/20250507-1G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 40 | 3.87 MB | 3.97 MB | `f25d2f462dcd` | `blog-module/blog-entries/20250712G/Ψύξη F1_ Απόδοση και Θερμοκρασία_(1).docx` | 448062cf3 2025-07-17 / 246d0655f 2026-04-14 | no | no | yes | article source DOCX, untracked by policy (owner decision) |
| 41 | 3.87 MB | 3.97 MB | `89fff05f782e` | `blog-module/blog-entries/20250712G/Ψύξη F1_ Απόδοση και Θερμοκρασία_(1).docx` | 448062cf3 2025-07-17 / 246d0655f 2026-04-14 | no | no | yes | article source DOCX, untracked by policy (owner decision) |
| 42 | 3.87 MB | 3.97 MB | `05df62363f42` | `blog-module/blog-entries/20250602-1G/Ισπανικό GP 2025_ Αναφορά Αγώνα_.docx` | 968c98a79 2025-06-02 / 246d0655f 2026-04-14 | no | no | yes | article source DOCX, untracked by policy (owner decision) |
| 43 | 3.87 MB | 3.97 MB | `fcf2baae34ee` | `blog-module/blog-entries/20250603GF/F1 Αεροδυναμική_ Κάτω Δύναμη & Αντίσταση_.docx` | 8ac1f1b25 2026-02-18 / 246d0655f 2026-04-14 | no | no | yes | article source DOCX, untracked by policy (owner decision) |
| 44 | 3.87 MB | 3.97 MB | `667924ff3d40` | `blog-module/blog-entries/20250725G/Ανάλυση GP Βελγίου 2025_.docx` | d8021ea9e 2025-07-25 / 246d0655f 2026-04-14 | no | no | yes | article source DOCX, untracked by policy (owner decision) |
| 45 | 3.87 MB | 3.97 MB | `5a55afcb27db` | `blog-module/blog-entries/20250610G/Ελαστικά Formula 1_ Οδηγός Επιβίωσης για τον Ενθουσιώδη Θεατή.docx` | 8ac1f1b25 2026-02-18 / 246d0655f 2026-04-14 | no | no | yes | article source DOCX, untracked by policy (owner decision) |
| 46 | 3.87 MB | 3.97 MB | `560c0cbc576e` | `blog-module/blog-entries/20250817G/Alpine F1_ Τι συμβαίνει;_.docx` | d8e66782a 2025-08-21 / 246d0655f 2026-04-14 | no | no | yes | article source DOCX, untracked by policy (owner decision) |
| 47 | 3.86 MB | 3.96 MB | `6b0e7090967b` | `blog-module/blog-entries/20250607G/Γιατί η F1 είναι RWD;_.docx` | 8ac1f1b25 2026-02-18 / 246d0655f 2026-04-14 | no | no | yes | article source DOCX, untracked by policy (owner decision) |
| 48 | 3.86 MB | 3.96 MB | `888969dc0fcb` | `blog-module/blog-entries/20250821G/McLaren_ Κυριαρχία στη Formula 1_.docx` | aeb217a7d 2025-08-23 / 246d0655f 2026-04-14 | no | no | yes | article source DOCX, untracked by policy (owner decision) |
| 49 | 3.86 MB | 4.52 MB | `20d83c9e6dfc` | `blog-module/blog-entries/20250801G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 50 | 3.86 MB | 3.95 MB | `3146cca79054` | `blog-module/blog-entries/20250704G/Οριστε και τα updates..docx` | fcbd20e66 2025-07-04 / 246d0655f 2026-04-14 | no | no | yes | article source DOCX, untracked by policy (owner decision) |
| 51 | 3.85 MB | 3.95 MB | `9bf1fcaed131` | `blog-module/blog-entries/20250619G/PitStop Strategy.docx` | 9df312a6f 2025-06-20 / 246d0655f 2026-04-14 | no | no | yes | article source DOCX, untracked by policy (owner decision) |
| 52 | 3.85 MB | 4.25 MB | `178cf4e25287` | `blog-module/blog-entries/20250530-1G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 53 | 3.64 MB | 3.71 MB | `2ecb551eaeec` | `audit/final-sweep/tables-1440-dark--full.png` | a51c3a716 2026-09-23 / a51c3a716 2026-09-23 | yes | no | yes | agent audit screenshot (removed in this cleanup) |
| 54 | 3.62 MB | 3.67 MB | `ae9f3ef5c415` | `audit/final-sweep/article-320-light--full.png` | a51c3a716 2026-09-23 / a51c3a716 2026-09-23 | yes | no | yes | agent audit screenshot (removed in this cleanup) |
| 55 | 3.61 MB | 3.66 MB | `2a8cc31e7828` | `audit/final-sweep/article-390-light--full.png` | a51c3a716 2026-09-23 / a51c3a716 2026-09-23 | yes | no | yes | agent audit screenshot (removed in this cleanup) |
| 56 | 3.47 MB | 4.01 MB | `75957e1eb18b` | `blog-module/blog-entries/20250809J/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 57 | 3.42 MB | 3.45 MB | `25c600365c8e` | `audit/final-sweep/tables-768-light--full.png` | a51c3a716 2026-09-23 / a51c3a716 2026-09-23 | yes | no | yes | agent audit screenshot (removed in this cleanup) |
| 58 | 3.41 MB | 3.51 MB | `30521a8fa0cc` | `blog-module/blog-entries/20250530-1G/2025SpainGpUpgrades.docx` | 456b79e47 2025-05-30 / 246d0655f 2026-04-14 | no | no | yes | article source DOCX, untracked by policy (owner decision) |
| 59 | 3.39 MB | 3.44 MB | `34f0a7cc92ff` | `design-experiments/screenshots/initial/a-article-desktop.png` | 49c8169b2 2026-09-22 / 49c8169b2 2026-09-22 | yes | no | yes | design prototype screenshot (removed in this cleanup) |
| 60 | 3.35 MB | 3.71 MB | `2e86a55b473f` | `blog-module/blog-entries/20250613G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 61 | 3.29 MB | 3.34 MB | `41ec3218c11c` | `design-experiments/screenshots/final/a-article-desktop.png` | 49c8169b2 2026-09-22 / 49c8169b2 2026-09-22 | yes | no | yes | design prototype screenshot (removed in this cleanup) |
| 62 | 3.28 MB | 3.32 MB | `3137f14db45a` | `design-experiments/screenshots/initial/b-article-desktop.png` | 49c8169b2 2026-09-22 / 49c8169b2 2026-09-22 | yes | no | yes | design prototype screenshot (removed in this cleanup) |
| 63 | 3.22 MB | 3.58 MB | `b8f610261cd0` | `blog-module/blog-entries/20250706G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 64 | 3.18 MB | 3.53 MB | `6d50bdbbb175` | `blog-module/blog-entries/20250707G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 65 | 3.18 MB | 3.27 MB | `40678fcc3b1a` | `blog-module/blog-entries/20250627G/2025AustriaGPUpgrades.docx` | 02c756555 2025-06-27 / 246d0655f 2026-04-14 | no | no | yes | article source DOCX, untracked by policy (owner decision) |
| 66 | 3.15 MB | 3.17 MB | `3be79ece8831` | `audit/final-sweep/tables-768-dark--full.png` | a51c3a716 2026-09-23 / a51c3a716 2026-09-23 | yes | no | yes | agent audit screenshot (removed in this cleanup) |
| 67 | 3.14 MB | 3.48 MB | `be038e7e98fb` | `blog-module/blog-entries/20250630G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 68 | 3.12 MB | 3.16 MB | `ca446fee36a5` | `design-experiments/screenshots/final/b-article-desktop.png` | 49c8169b2 2026-09-22 / 49c8169b2 2026-09-22 | yes | no | yes | design prototype screenshot (removed in this cleanup) |
| 69 | 3.08 MB | 3.13 MB | `c753164492ad` | `audit/final-sweep/article-390-dark--full.png` | a51c3a716 2026-09-23 / a51c3a716 2026-09-23 | yes | no | yes | agent audit screenshot (removed in this cleanup) |
| 70 | 3.08 MB | 3.08 MB | `2ff14c98b0df` | `images/bg/bg1.mp4` | 12b91777f 2025-04-02 / ab85c693c 2025-07-07 | no | no | yes | deleted media |
| 71 | 3.02 MB | 3.06 MB | `403a7c6aead6` | `audit/final-sweep/article-320-dark--full.png` | a51c3a716 2026-09-23 / a51c3a716 2026-09-23 | yes | no | yes | agent audit screenshot (removed in this cleanup) |
| 72 | 3.01 MB | 3.01 MB | `8d0bc0bacd34` | `blog-module/blog-entries/20260423G/1.png` | c382d6a3a 2026-04-23 / c382d6a3a 2026-04-23 | yes | no | yes | raw article original (removed; policy: zero raw) |
| 73 | 2.86 MB | 5.91 MB | `700bda6ca43f` | `blog-module/blog-entries/20250627G/2025AustriaGPUpgrades.docx` | 02c756555 2025-06-27 / 246d0655f 2026-04-14 | no | no | yes | article source DOCX, untracked by policy (owner decision) |
| 74 | 2.86 MB | 2.95 MB | `dea63b92399e` | `blog-module/blog-entries/20250605W/Αφιέρωμα στη Benneton B186.docx` | 8ac1f1b25 2026-02-18 / 246d0655f 2026-04-14 | no | no | yes | article source DOCX, untracked by policy (owner decision) |
| 75 | 2.85 MB | 3.17 MB | `6f3ddecb4abd` | `blog-module/blog-entries/20260402G/narration.mp3` | 606465c48 2026-04-02 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 76 | 2.78 MB | 2.82 MB | `a7b9568b6440` | `design-experiments/screenshots/initial/a-homepage-desktop.png` | 49c8169b2 2026-09-22 / 49c8169b2 2026-09-22 | yes | no | yes | design prototype screenshot (removed in this cleanup) |
| 77 | 2.75 MB | 3.07 MB | `5d0e60538a44` | `blog-module/blog-entries/20250704G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 78 | 2.63 MB | 2.68 MB | `f3aafd0cab8f` | `blog-module/blog-entries/20260329G/1.png | blog-module/blog-entries/20260329G/2.png` | 2ce4a8110 2026-03-29 / f2ec93b8c 2026-03-29 | no | no | yes | raw article original (removed; policy: zero raw) |
| 79 | 2.60 MB | 2.62 MB | `3f70e631e5ef` | `images/default.png` | ebece7df8 2025-04-30 / c515d6ae6 2025-04-30 | no | no | yes | deleted site image (old unoptimized version) |
| 80 | 2.59 MB | 2.68 MB | `24f614d08837` | `blog-module/blog-entries/20250413G/Ανάλυση Κατατακτήριων GP Bahrain.docx` | b29942616 2025-04-21 / 246d0655f 2026-04-14 | no | no | yes | article source DOCX, untracked by policy (owner decision) |
| 81 | 2.52 MB | 2.52 MB | `99c63373909a` | `images/bg/bg2.mp4` | 12b91777f 2025-04-02 / ab85c693c 2025-07-07 | no | no | yes | deleted media |
| 82 | 2.52 MB | 2.60 MB | `bf79cfe69670` | `blog-module/blog-entries/20250405G/Ανάλυση Κατατακτήριων GP Japan 2025.docx` | b29942616 2025-04-21 / 246d0655f 2026-04-14 | no | no | yes | article source DOCX, untracked by policy (owner decision) |
| 83 | 2.51 MB | 2.54 MB | `18ebc2e50342` | `audit/final-sweep/home-390-light--full.png` | a51c3a716 2026-09-23 / a51c3a716 2026-09-23 | yes | no | yes | agent audit screenshot (removed in this cleanup) |
| 84 | 2.46 MB | 2.49 MB | `a094f0a5b2bc` | `design-experiments/screenshots/initial/b-homepage-desktop.png` | 49c8169b2 2026-09-22 / 49c8169b2 2026-09-22 | yes | no | yes | design prototype screenshot (removed in this cleanup) |
| 85 | 2.38 MB | 2.41 MB | `b3f9192f7f82` | `audit/final-sweep/article-1440-light--full.png` | a51c3a716 2026-09-23 / a51c3a716 2026-09-23 | yes | no | yes | agent audit screenshot (removed in this cleanup) |
| 86 | 2.35 MB | 2.63 MB | `5241b6c8eaf4` | `blog-module/blog-entries/20250617J/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 87 | 2.32 MB | 2.55 MB | `6865bb513a11` | `blog-module/blog-entries/20250512G/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 88 | 2.29 MB | 2.34 MB | `fcf65f9d9c2d` | `audit/final-sweep/blog-390-light--full.png` | a51c3a716 2026-09-23 / a51c3a716 2026-09-23 | yes | no | yes | agent audit screenshot (removed in this cleanup) |
| 89 | 2.26 MB | 2.65 MB | `ebbf9b8ddecc` | `blog-module/blog-entries/20250608J/narration.mp3` | 1bc539f7d 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 90 | 2.21 MB | 2.23 MB | `e9ceace863d3` | `audit/final-sweep/home-1440-light--full.png` | a51c3a716 2026-09-23 / a51c3a716 2026-09-23 | yes | no | yes | agent audit screenshot (removed in this cleanup) |
| 91 | 2.20 MB | 2.57 MB | `cd9153572ae2` | `blog-module/blog-entries/20250421J/narration.mp3` | 9f7dcc6ab 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 92 | 2.14 MB | 2.33 MB | `24238fcab75f` | `blog-module/blog-entries/20250303G/narration.mp3` | 9f7dcc6ab 2026-03-17 / f97f24b42 2026-04-22 | no | no | yes | TTS narration audio, removed 2026-04-22 |
| 93 | 2.10 MB | 2.12 MB | `967f02a4d337` | `audit/final-sweep/home-320-light--full.png` | a51c3a716 2026-09-23 / a51c3a716 2026-09-23 | yes | no | yes | agent audit screenshot (removed in this cleanup) |
| 94 | 2.08 MB | 2.10 MB | `5515d34cbcd3` | `audit/final-sweep/blog-1440-light--full.png` | a51c3a716 2026-09-23 / a51c3a716 2026-09-23 | yes | no | yes | agent audit screenshot (removed in this cleanup) |
| 95 | 2.08 MB | 2.11 MB | `f60c832e7af6` | `images/sponsors/GrandRealm.png` | b910823c2 2026-03-28 / f2ec93b8c 2026-03-29 | no | no | yes | deleted site image (old unoptimized version) |
| 96 | 2.07 MB | 2.09 MB | `8341027b34c6` | `audit/final-sweep/home-390-dark--full.png` | a51c3a716 2026-09-23 / a51c3a716 2026-09-23 | yes | no | yes | agent audit screenshot (removed in this cleanup) |
| 97 | 2.07 MB | 2.07 MB | `c8b90a5f7265` | `audit/sweep/longform-1920-light--fold.png` | a51c3a716 2026-09-23 / a51c3a716 2026-09-23 | yes | no | yes | agent audit screenshot (removed in this cleanup) |
| 98 | 2.04 MB | 2.08 MB | `3cb8a26ad1e1` | `audit/final-sweep/st-quali-390-light--full.png` | a51c3a716 2026-09-23 / a51c3a716 2026-09-23 | yes | no | yes | agent audit screenshot (removed in this cleanup) |
| 99 | 1.98 MB | 2.02 MB | `a64a08e12684` | `audit/final-sweep/blog-320-light--full.png` | a51c3a716 2026-09-23 / a51c3a716 2026-09-23 | yes | no | yes | agent audit screenshot (removed in this cleanup) |
| 100 | 1.98 MB | 2.01 MB | `993054e6cfc9` | `images/sponsors/Balatzis.png` | b910823c2 2026-03-28 / f2ec93b8c 2026-03-29 | no | no | yes | deleted site image (old unoptimized version) |

## Surgical strategy (A)

Keep all meaningful commits and remove only paths that **no longer exist in the current tree** and are either:
- binary media or documents (`mp3 mp4 wav usdz glb docx png jpg jpeg gif webp avif bak odt`), or
- under a removed directory (`audit/ design-experiments/ graphify-out/ garage/ memes/ .build/ images/audio/ images/fallback/`), or
- an `extracted/` folder.

**The purge list is computed, never hand-written, and it excludes every path in the current tree by construction.** A current article or media asset can never be purged, whatever its size. No `--strip-blobs-bigger-than` is used.

The purge set: 2,107 paths, of which 246 are `.docx`.

| Class | Paths | Blobs freed | Packed saved |
|---|---:|---:|---:|
| `audit/` | 729 | 672 | 440.4 MB |
| `blog-entries/**/*.mp3` | 203 | 205 | 375.5 MB |
| `blog-entries/**/*.docx` *(optional, see A′)* | 246 | 293 | 118.3 MB |
| `design-experiments/` | 141 | 138 | 75.5 MB |
| `garage/` | 96 | 162 | 28.7 MB |
| deleted `images/**/*.png` etc. | 9 | 16 | 13.8 MB |
| deleted raw article `.png` | 9 | 7 | 10.8 MB |
| `blog-entries/*/extracted/` | 104 | 65 | 6.5 MB |
| deleted raw article `.jpg/.jpeg` | 31 | 29 | 6.2 MB |
| `memes/` | 91 | 114 | 5.9 MB |
| `.mp4` (2 files) | 2 | 2 | 5.6 MB |
| deleted article `.webp/.avif` | 339 | 95 | 9.4 MB |
| deleted `images/**/*.webp/.avif/.jpg` | 44 | 29 | 3.5 MB |
| `images/audio/`, `images/fallback/` | 8 | 8 | 2.4 MB |
| `graphify-out/`, `.build/`, `*.bak` | 55 | 25 | 0.3 MB |
| **Total A (with DOCX)** | **2,107** | | **≈ 1,103 MB** |
| **Total A′ (DOCX kept)** | 1,861 | | **≈ 985 MB** |

Estimated result (blob sizes from the analysis, plus 3.7 MB of trees and commits):
- **A:** about **285 MB** pack, down from 1.39 GB (−80%).
- **A′:** about **400 MB** (−71%).
- About 75 MB of what remains is the revision history of current `article.html`/JSON files. That is the provenance being preserved.

Commits that touched **only** purged paths (for example, audit-only or TTS-only commits) become empty and are pruned by `filter-repo`'s default `--prune-empty=auto`. Every other commit keeps its message, author and dates, with a new SHA.

## Clean-baseline strategy (B)

Replace all history with one root commit whose tree equals the cleaned `main` tree.

- **Size:** about **205–215 MB** (the cleaned tree's blobs are 203.6 MB packed, plus one tree set). That is **−85%**, only about 75 MB smaller than A.
- **Commit links:** every historical SHA disappears from `main`. Links in commit messages, docs and external posts to `github.com/.../commit/<sha>` keep resolving on GitHub only while the object stays reachable through `refs/pull/*`. Commits that were never part of a PR 404 after GitHub GC.
- **Branches/tags:** only `main` exists and there are no tags, so there is nothing else to rewrite.
- **PR references:** PR pages #1–#188 stay, but their "merged commit" no longer appears in `main`'s history.
- **Clones:** every clone must be discarded; `git pull` fails with unrelated histories.
- **Collaborators:** effectively single-maintainer (0 forks). Author tools create branches through the API from the live `main`, so they are unaffected once no author PR is open.
- **GitHub Pages:** deploys from the Actions artifact (`build_type: workflow`), not from the branch. The first push redeploys an identical `dist/`.
- **Author publishing workflow:** the `Restore git mtimes for blog entries` step derives mtimes from `git log`. After a reset, every file has the same mtime. `shouldSkip()` compares with a strict `>`, so equal mtimes mean "skip", and later edits get newer commit times and rebuild normally. The workflow keeps working.
- **Lost:** `git log`/`git blame` for build scripts and workflows, article publish provenance, and the ability to recover the TTS audio, DOCX sources or any deleted asset from git (only the backup keeps them).

## Recommended strategy

**CLEAN BASELINE (B).** Owner decision, 2026-09-23: old history has no value; only the current working product must be preserved.

With history explicitly out of scope, B dominates A:
1. It is the smallest result (about 210 MB against about 285 MB for A), with no tuning of purge lists, DOCX decisions or empty-commit pruning.
2. It is the simplest to verify: the new root commit's tree must equal the verified cleaned tree (`main^{tree}`), and nothing else exists.
3. The publishing pipeline is unaffected. The `git log` mtime restore works with a single commit, as the B section above shows.

The baseline tree should be the **cleaned tree plus the refreshed icon-sprite shells** (the 10 files `build:check` flags). The first commit of the new history then passes `npm run verify`'s drift gate instead of carrying a known failure.

### Two ways to land B

| | B1: orphan commit + force-push (same repo) | B2: delete and recreate the repo |
|---|---|---|
| Local / fresh clone | about 210 MB | about 210 MB |
| GitHub-reported size | Stays about 1.4 GB until **GitHub Support** removes `refs/pull/*` and runs GC | About 210 MB immediately |
| Lost | Commit history only (PR pages #1–#188 remain, read-only) | Also PRs #1–#188, closed issues, repo ID. There are 0 stars, 0 forks, 0 open issues, 0 secrets, 0 variables |
| Must be reconfigured | Nothing | Pages: source "GitHub Actions" and custom domain `f1stories.gr` (DNS unchanged). Environment `github-pages` with its custom branch policy for `main`. Ruleset "Force Protection" (deletion + non-fast-forward, Admin bypass). Actions default workflow permissions **read/write**. Allow merge commits. **Re-issue the author tools' fine-grained GitHub tokens**, which are bound to the old repository ID |
| Risk | Low: one ref changes, and settings are untouched | Medium: a missed setting breaks deploys or author publishing until fixed |

**Recommendation: B1**, plus a GitHub Support request to purge the old objects server-side. Use B2 only if GitHub's reported size must drop immediately and you accept the reconfiguration checklist.

## Remote references that can keep blobs alive

| Ref | Present? | Effect after rewriting `main` |
|---|---|---|
| Other branches | none (`claude-redesign`, `visuals/polish` already deleted) | none |
| Tags | none | none |
| Notes / replace refs / stash | none | none |
| Forks | 0 | none |
| **`refs/pull/1..188/head` (and `/merge`)** | **188 on GitHub, read-only** | They keep every pre-rewrite object reachable **on GitHub**. The owner cannot delete them. |
| GitHub cached views / PR diffs | yes | Keep old objects until GitHub runs GC |

**Rewriting `main` alone will not shrink the GitHub-reported size.** Local clones and fresh clones of `main` shrink immediately, because a clone does not fetch `refs/pull/*`. The server-side size (1.4 GB) only drops after **GitHub Support** removes the PR refs/cached views and runs garbage collection. The request form is linked from GitHub's "Removing sensitive data from a repository" guide: provide the repo name, the purged paths list, and the old→new SHA map from `.git/filter-repo/commit-map` in the rewrite clone. The only self-service alternative is deleting and recreating the repository, which loses PRs, issues, stars, the ruleset and the Pages/custom-domain configuration. That is **not recommended.**

## Backup procedure

Store the backup **outside the working directory**, somewhere that will never be pushed:

```bash
BK="$HOME/Backups/f1stories-$(date +%Y%m%d)"
mkdir -p "$BK"

# 1. Full mirror: includes refs/heads/*, and refs/pull/* from GitHub
git clone --mirror https://github.com/georgiosbalatzis/f1StoriesPage.git "$BK/f1StoriesPage-pre-rewrite.git"

# 2. Single-file bundle of every ref, verified
git -C "$BK/f1StoriesPage-pre-rewrite.git" bundle create "$BK/f1StoriesPage-pre-rewrite.bundle" --all
git bundle verify "$BK/f1StoriesPage-pre-rewrite.bundle"

# 3. Record the pre-rewrite state
git -C "$BK/f1StoriesPage-pre-rewrite.git" rev-parse main         > "$BK/main-sha.txt"
git -C "$BK/f1StoriesPage-pre-rewrite.git" rev-parse 'main^{tree}' > "$BK/main-tree.txt"
git -C "$BK/f1StoriesPage-pre-rewrite.git" count-objects -vH       > "$BK/count-objects.txt"

# 4. (Required before purging DOCX) export every historical .docx by blob id
mkdir -p "$BK/docx-archive"
git -C "$BK/f1StoriesPage-pre-rewrite.git" rev-list --all --objects \
  | grep -iE '\.docx$' \
  | while read -r sha path; do
      git -C "$BK/f1StoriesPage-pre-rewrite.git" cat-file blob "$sha" \
        > "$BK/docx-archive/${sha:0:10}-$(basename "$path")"
    done
ls "$BK/docx-archive" | wc -l   # expect about 290 files (blob versions)
```

Keep the backup until the rewrite has been live for at least one full publishing cycle (author PR → publish → deploy), and keep the bundle long-term. **Never run `git push` from the mirror with `--mirror`**: GitHub rejects `refs/pull/*`, and it would re-push the old history.

## Branch/tag handling

- Only `main` is rewritten. No other branches or tags exist.
- Confirm `gh pr list --state open` is empty, and that no `author/*` branch exists, immediately before starting.
- Disable the three content workflows so no bot commit races the rewrite, and re-enable them afterwards.

## Exact commands to execute

```bash
set -euo pipefail
REPO=georgiosbalatzis/f1StoriesPage
BK="$HOME/Backups/f1stories-$(date +%Y%m%d)"      # the backup from above must exist
WORK="$HOME/f1stories-rewrite"

# 0. Freeze publishing
gh pr list --repo "$REPO" --state open                       # must print nothing
gh workflow disable "Site Maintenance" --repo "$REPO"
gh workflow disable "Publish Article"  --repo "$REPO"
gh workflow disable "Deploy Pages"     --repo "$REPO"

# 1. Fresh, non-mirror clone (filter-repo requires a fresh clone)
git clone "https://github.com/$REPO.git" "$WORK"
cd "$WORK"
test "$(git rev-parse main)" = "$(cat "$BK/main-sha.txt")"   # nothing landed since the backup

# 2. Generate the purge list (never contains a current path; asserts it)
cat > ../gen-purge.py <<'PY'
#!/usr/bin/env python3
import re, subprocess, sys
git = lambda *a: subprocess.run(['git', '-c', 'core.quotepath=off', *a], capture_output=True, check=True).stdout.decode()
current = set(git('ls-files', '-z').split('\0')) - {''}
history = set(git('log', '--all', '--name-only', '--format=', '-z', '--no-renames').replace('\n', '\0').split('\0')) - {''}
DIRS = ('audit/', 'design-experiments/', 'graphify-out/', 'garage/', 'memes/', '.build/', 'images/audio/', 'images/fallback/')
MEDIA = re.compile(r'\.(mp3|mp4|wav|usdz|glb|docx|png|jpe?g|gif|webp|avif|bak|odt)$', re.I)
keep_docx = '--keep-docx' in sys.argv
purge = sorted(p for p in history - current
               if (p.startswith(DIRS) or MEDIA.search(p) or '/extracted/' in p)
               and not (keep_docx and p.lower().endswith('.docx')))
assert not set(purge) & current
sys.stdout.write('\n'.join(purge) + '\n')
PY
python3 ../gen-purge.py > ../purge-paths.txt          # strategy A
# python3 ../gen-purge.py --keep-docx > ../purge-paths.txt   # strategy A′
wc -l ../purge-paths.txt                              # expect 2107 (A) / 1861 (A′)

# 3. Rewrite
git filter-repo --invert-paths --paths-from-file ../purge-paths.txt

# 4. Local verification (see next section) BEFORE pushing
test "$(git rev-parse 'main^{tree}')" = "$(cat "$BK/main-tree.txt")"   # identical current tree
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git count-objects -vH

# 5. Push (force)
git remote add origin "https://github.com/$REPO.git"
git push --force origin main

# 6. Unfreeze
gh workflow enable "Deploy Pages"     --repo "$REPO"
gh workflow enable "Publish Article"  --repo "$REPO"
gh workflow enable "Site Maintenance" --repo "$REPO"
gh workflow run "Deploy Pages" --repo "$REPO" --ref main
```

For the clean-baseline strategy B (not recommended), replace steps 2–3 with the following. The tree check in step 4 applies unchanged.

```bash
git checkout --orphan baseline
git commit -m "F1 Stories baseline (history reset $(date +%Y-%m-%d); pre-reset history in offline backup)"
git branch -D main && git branch -m baseline main
```

## Exact force-push requirements

- Only one ref changes: `refs/heads/main`, as a non-fast-forward.
- Ruleset **"Force Protection"** (id `14773308`, target `~DEFAULT_BRANCH`) enforces `non_fast_forward` and `deletion`. Its bypass list is **Repository role: Admin, mode `always`**, so the repository owner's push is allowed **without changing the ruleset**.
- If the push is rejected anyway (for example, the token is not admin-scoped), disable the ruleset, push, and re-enable it immediately:
  ```bash
  gh api -X PUT repos/georgiosbalatzis/f1StoriesPage/rulesets/14773308 -f enforcement=disabled
  git push --force origin main
  gh api -X PUT repos/georgiosbalatzis/f1StoriesPage/rulesets/14773308 -f enforcement=active
  ```
- Never use `git push --mirror` or `--all` from the rewrite clone or the backup mirror.

## Branch protection implications

- There is no classic branch protection on `main` (API returns 404). The ruleset above is the only guard, and it is left **active**.
- Required status checks: none are configured, so the push is not blocked by CI.
- `Deploy Pages` is disabled during the push, so no push-triggered run happens. Step 6 dispatches it manually, and it redeploys an identical site. Disabled workflows do not queue events, so neither `Site Maintenance` nor `Publish Article` reacts to the force push.

## Collaborator instructions after rewrite

Send this notice:

> The `main` history of f1StoriesPage was rewritten on <date> to remove ~1.1 GB of obsolete binaries. Commit SHAs changed. **Do not pull or merge.**
> 1. Push or save any unpublished work as a patch: `git format-patch origin/main..HEAD -o ~/f1s-patches`.
> 2. Delete your clone and re-clone: `git clone https://github.com/georgiosbalatzis/f1StoriesPage.git`.
> 3. Re-apply patches with `git am ~/f1s-patches/*.patch`, or rebase a branch with `git rebase --onto origin/main <old-base> <branch>`.
> 4. Author tools (`generate.html`, `housekeeping.html`) need no action; they branch from the live `main`.
> 5. Never push a branch created before the rewrite: it would re-upload the removed history.

## Verification after rewrite

1. `git rev-parse main^{tree}` equals the recorded pre-rewrite `main^{tree}`. This proves the current site tree is byte-for-byte unchanged.
2. `git log --oneline | wc -l`: the count drops only by the commits that became empty. Spot-check that recent publish commits are present, for example `git log -3 -- blog-module/blog-entries/20260922W`.
3. The purged paths are gone: `git log --all --oneline -- '*.mp3' audit design-experiments | wc -l` returns 0.
4. Size: `git count-objects -vH` shows `size-pack` of about 285 MB (A) / 400 MB (A′) / 210 MB (B).
5. Site: `npm ci && npm run build:public`, then compare `dist/` SHA-256 hashes with a `dist/` built from the backup at the same tree. They must be identical.
6. `npm run verify`: expect only the pre-existing failures documented in `REPO_CLEANUP_REPORT.md` (build:check sprite drift, perf:budget, perf:article-media, perf:lighthouse) until they are fixed separately.
7. GitHub: the `Deploy Pages` run succeeds and https://f1stories.gr serves normally. A fresh clone is about 285 MB. Open one author PR end to end (Site Quality → Publish Article → deploy) before deleting the backup.
8. Remote size: after GitHub Support confirms GC, `gh api repos/georgiosbalatzis/f1StoriesPage --jq .size` drops from 1,417,609 KB.

## Rollback procedure

Available for as long as the backup exists:

```bash
BK="$HOME/Backups/f1stories-<date>"
gh workflow disable "Site Maintenance" --repo georgiosbalatzis/f1StoriesPage
gh workflow disable "Publish Article"  --repo georgiosbalatzis/f1StoriesPage

# Push ONLY main from the mirror (explicit refspec, never --mirror)
git -C "$BK/f1StoriesPage-pre-rewrite.git" push --force \
  https://github.com/georgiosbalatzis/f1StoriesPage.git refs/heads/main:refs/heads/main

# Or from the bundle
git clone "$BK/f1StoriesPage-pre-rewrite.bundle" restore && cd restore
git push --force https://github.com/georgiosbalatzis/f1StoriesPage.git main:main

gh workflow enable "Publish Article"  --repo georgiosbalatzis/f1StoriesPage
gh workflow enable "Site Maintenance" --repo georgiosbalatzis/f1StoriesPage
```

Then check that `git ls-remote origin main` equals `$BK/main-sha.txt`, and tell collaborators to re-clone. If anything was published between the rewrite and the rollback, cherry-pick those commits onto the restored `main` first; their content is in the rewritten clone.

## Execution record

- **Strategy:** B1, a clean baseline. `main` was replaced by one root commit (no parents) whose tree is the cleaned tree plus the refreshed sprite shells.
- **Replaced tip:** `96e70a7aaf4fae51a9fae47c57ac4c5b2cdc2703` (1,594 commits).
- **Backup:** `~/Backups/f1stories-20260923/`
  - `f1StoriesPage-pre-rewrite.git`: mirror with `main` and 188 `refs/pull/*`
  - `f1StoriesPage-pre-rewrite.bundle`: verified
  - `main-sha.txt`, `main-tree.txt`, `count-objects.txt`
- **Rollback:** the procedure above, which pushes `refs/heads/main` from the mirror or bundle.
- **Server-side size:** GitHub keeps the old objects through `refs/pull/*` until GitHub Support purges them. Open a support request that references this rewrite.

