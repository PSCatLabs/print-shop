# Verification record — 2026-10-28

## Headless and served-edition browser acceptance (PS-009) — 2026-11-04

Host: macOS 15 (Darwin 24.6), Node 24.14.0, Google Chrome 156.0.8078.80,
headless. `npm test` (18 tests) and `npm run build` pass first.

The old harness passed `--dump-dom` to headless Chrome, which snapshots the
DOM at the load event, before the asynchronous in-page suite reports. It
exited 0 with no report on this host too, so the earlier failure was the
harness, not only the sandbox. `scripts/browser-check.mjs` now drives Chrome
over the DevTools protocol (`--remote-debugging-pipe`, no port, no npm
dependencies). For each configuration it:

1. loads the page and waits for the first real render, saves a viewport and
   a full-page screenshot, and checks `scrollWidth <= innerWidth`;
2. reloads with `?browser-test` and waits for the nine-check in-page suite;
3. fails on any page or worker exception, `console.error` or browser error
   log entry (worker targets are auto-attached);
4. for the file edition, fails on any request that is not `file:`, `blob:`
   or `data:`, and runs Chrome behind a dead proxy (`127.0.0.1:9`) so an HTTP
   request could not succeed anyway.

| Configuration | Edition | Viewport | Suite | Problems | Requests |
| --- | --- | --- | --- | --- | --- |
| offline-desktop | `dist/printshop-offline.html` | 1440 × 900 | 9/9 passed | none | `file:`, `blob:` only |
| offline-mobile | `dist/printshop-offline.html` | 390 × 844 @3x, mobile, Android UA | 9/9 passed | none | `file:`, `blob:` only |
| served-desktop | `scripts/serve.mjs --dist` | 1440 × 900 | 9/9 passed | none | app modules, templates, `pscat.wasm` over HTTP |
| served-mobile | `scripts/serve.mjs --dist` | 390 × 844 @3x, mobile, Android UA | 9/9 passed | none | as above |

The nine checks are those listed below for the offline continuation: initial
vector SVG, name/palette rerender, all three templates, real SVG/PDF/PNG
bytes with a 2550 px (300 ppi) PNG, invalid CSV with disabled exports, file
upload and pagination, card front/back with print notes, rapid edits, and
viewport fit. Reports: [`verification/headless-*.json`](verification/).

The first served run found one real defect: the page had no icon, so the
browser requested `/favicon.ico` and logged a 404. `index.html` now declares an
empty data-URL icon. The served run's request list shows the worker's
`pscat.wasm` fetch, which confirms worker traffic is observed, so the offline
edition's `file:`/`blob:`-only result is meaningful. A negative probe (an
exception injected into the served `app.js`) made the harness report FAIL.

Screenshots (regenerated under ignored `artifacts/browser-*.png`) were viewed:
desktop shows the full studio with the two-column Classic Bistro preview,
export row and print notes; mobile stacks controls, template picker, preview,
exports and print notes in one column with no horizontal clipping.
The mobile run is Chrome device emulation, not a physical Android device or
Safari.

## Publication — 2026-11-04

Published to `PSCatLabs/print-shop` with ordinary `git push`. The
`.local-git/` publishing helper (`scripts/open-pr.sh`), its tests and
`scripts/git-local.sh` were retired once the repository existed; the record
below is kept as history.

## Publishing-script follow-up — 2026-10-30

`scripts/open-pr.sh` supports the managed `.local-git/` checkout and ordinary
Git checkouts. It runs checks, bootstraps a shared empty base for a new
repository while preserving feature commits, pushes and opens/reuses the PR.
The description is tracked in `.github/pull-request-mvp.md`.

Six isolated publishing tests pass using actual Git histories/local bare
repositories and mocked `gh` calls: new repository plus retry, an existing
shared base, dirty-tree rejection, connectivity failure, an unrelated remote
base, and a mismatched origin. Shell syntax and installed CLI flag support
were checked. The complete `npm test` suite now passes **24 tests**, and
`npm run build` passes. GitHub publication itself happens when the owner runs
the script from a terminal with working network/authentication.

## Passed

- Actual pinned PSCat core compiled to `wasm32-unknown-unknown` with the
  checked-in vector adapter: release, locked dependencies, offline Cargo.
- `cargo clippy --lib --release --locked --offline --target
  wasm32-unknown-unknown --no-default-features -- -D warnings` passed on that
  patched dependency. This is the WASM library gate, not a claim to have run
  PSCat's entire native test suite.
- `node --test tests/*.test.mjs`: **18 tests passed, zero failures** in the
  recorded run (Node 24.14.0). Includes malformed/quoted/multiline CSV,
  schema/parameters, actual WASM exports, exact repeat determinism, three
  distinct templates, 1/40/500-item menus, A4/one-column/density/wrapped text,
  named overflow errors, literal-content injection resistance, render failure
  and recovery, two-sided card/QR rejection, preflight and artifact hashes.
- The packaging check builds the static/offline editions, restores the exact
  WASM from the compressed offline payload, resolves the real Blob module
  dependency graph, syntax-checks the packaged modules, and executes the actual
  packaged classic worker against the real WASM to produce a 14-item SVG/PDF.
  This exposed and fixed an offline packaging bug that incorrectly treated
  JSDoc type imports as executable imports. It does not substitute for a
  browser test.
- Actual SVGs contain outlined paths and no embedded preview image. PDF
  checks validate signature, media dimensions, page counts, compressed vector
  streams, xref offset and EOF. Same input/parameters give identical SVG/PDF
  bytes and interpreter logs on repeated runs.
- Small/medium/large fixtures check each item exactly once and measured column
  bounds, independently of screenshots. The 40-item example paginates to three
  pages in the balanced two-column layout.
- The issue-publication dry run loads all 15 definitions with acceptance and
  dependencies; actual publishing stops at the failed repository lookup.

## Visual inspection

Generated PDFs were rasterized with Poppler `pdftoppm`, then inspected:
Classic Bistro, Modernist, Retro Diner, and both business-card sides. Typography is legible,
prices align, category hierarchy and ornamentation are restrained, descriptions
wrap without collision, and margins are intentional. Output files are
regenerated by tests in `artifacts/` and are not static previews in the app.
The sample's greedy flow can leave one category item at the top of the next
column; PS-010 records the composition improvement separately.

## Real-browser continuation: passed offline desktop and mobile

Native Chrome control became available during the continuation. It exposed a
real startup failure in the file edition: module workers failed before running
the renderer. A self-contained classic worker fixes this without changing the
rendering API, PostScript source, engine or exporters. An asynchronous example
load also needed to set its pending state before reading the asset, so a prior
CSV error would not remain active during the load.

Chrome 156 passed **nine browser checks at both 1843 × 834 and 390 × 747**:
initial actual SVG, name/palette changes, all templates, real SVG/PDF/PNG file
bytes and PNG dimensions, invalid CSV/stale exports, file upload and pagination,
card front/back and print warnings, rapid-edit cancellation, viewport fit.
The mobile run used Chrome responsive emulation with an Android user agent;
it does not establish physical Android-device or Safari compatibility.
Desktop and mobile interfaces were visually inspected, including the mobile
upload/customization controls, preview and export row. No horizontal clipping
was observed. The DevTools console showed no messages during the successful run.

The reports were downloaded through Chrome's native Save dialog and copied
unchanged into [`verification/offline-desktop.json`](verification/offline-desktop.json)
and [`verification/offline-mobile.json`](verification/offline-mobile.json).
The browser's export suite inspects Blob bytes; a separate PDF download was
also saved normally as `artifacts/browser-menu.pdf`. `pdfinfo` confirms one
612 × 792 pt page, producer `pscat`, PDF 1.4, and `cmp` confirms exact equality
with the Node-rendered `artifacts/classic-bistro.pdf`.

## Blocked checks at the time (2026-10-28) — resolved 2026-11-04

The served edition and headless runner now pass (see the top of this file);
GitHub publication happened on 2026-11-04.

- `npm run dev`: socket bind rejected with `EPERM` for `127.0.0.1:5173`.
- The Chrome headless runner still aborts before producing a DOM report or
  screenshot under this sandbox. Native Chrome now works and its offline suite
  passes as recorded above. The served edition and CLI harness remain the
  unverified part of PS-009; they are not counted as passed.
- `gh auth status` reports invalid authentication; `gh` API/repository creation
  and issue publication fail to connect to `api.github.com`. `git ls-remote`
  reports DNS resolution failure. No remote repository, issues, push or PR
  were created. Use terminal `gh` and `git` for the next attempt, per the owner.
- Initial `git init` in the root `.git` path was rejected by the managed
  filesystem. Git metadata is retained in `.local-git/`, with a small terminal
  wrapper, rather than left only in temporary storage.

## Reproduce

Use the README commands on a host with normal CLI/browser access. A generated
`dist/printshop-offline.html` is available for direct opening; the static
edition serves from `dist/`. `npm run test:browser` runs the offline and served
editions at desktop and mobile viewports.
