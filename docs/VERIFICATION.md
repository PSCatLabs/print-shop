# Verification record — 2026-10-28

## Card QR codes from pscat's lib/qr.ps (PS-013) — 2026-11-04

- **Upstream contract** (PSCatLabs/pscat `main` `db44e12`, the engine pin;
  `docs/guides/qr-codes.md` there): `lib/qr.ps`, MIT OR Apache-2.0 like the
  other pscat libraries, embedded in the WASM build. Entry points
  `payload opts qrencode -> symbol` and `symbol opts qrdraw -`; byte mode,
  raw bytes with no ECI; levels L, M, Q and H; a quiet zone of at least 4
  modules. Printshop uses level Q, quiet zone 4, `/ModuleSize`, and the card's
  ink and paper colors.
- **Validation:** printable ASCII only (the library writes raw bytes, and
  non-ASCII would need UTF-8 plus ECI), at most 200 bytes. 200 bytes give
  version 12 at 0.96 pt modules within 72 pt, at about 6.9 M of the 12 M
  render-step budget (266 ms). Beyond the validated length, a 4-pixel
  minimum module raises `printshop-qr-too-dense` (tested at 230 bytes).
- **Geometry:** each module is a whole number of 300 dpi pixels with the
  origin on that grid. A test checks this for five payloads, and also that
  the symbol stays within 1 in.
- **Independent decoding** (`npm run test:qr`): five payloads (19 to 200
  bytes, versions 2 to 12, four palettes). Each is decoded from three
  sources: the SVG back page rasterized by Chrome at 300 dpi; page 2 of the
  PDF rasterized at 300 dpi by Poppler `pdftoppm`; and a PNG made through the
  app's export path. The decoder is Chrome 156's `BarcodeDetector` (Shape
  Detection API, Apple Vision on macOS), which shares no code with
  `lib/qr.ps`. All 15 decodes return the exact payload, and the card front,
  used as a control, decodes to nothing. The browser suite gained a tenth
  check: it types a link into the real UI, downloads the PNG and decodes it.
  This passed offline and served, desktop and mobile.
- The card back was rasterized and viewed: the symbol sits lower right in
  the safe area, with the contact column beside it. The front is
  byte-identical with and without a QR code; QR-free cards and all menus are
  byte-identical to the previous commit. Images:
  [46-byte link](verification/ps-013/card-back-qr.png),
  [200 bytes](verification/ps-013/card-back-qr-200.png).

## Engine repin to pscat main (#16) — 2026-11-04

- **Source:** a fresh clone of `PSCatLabs/pscat` (never the owner's checkout)
  at `main` `db44e121123ceb737f70daffd34c0a6853dc37a1`, which contains the
  WASM SVG/PDF output (#1004, `c1a2852`) and `lib/functional.ps` (#923).
  `scripts/build-engine.py --source <clone> --offline` built it unmodified
  (`cargo rustc --lib --release --locked --target wasm32-unknown-unknown
  --no-default-features --crate-type cdylib`, rustc 1.96.1); the script now
  refuses a dirty checkout and applies no patch. `patches/` is gone, and
  `provenance.json` records branch `main`, the commit, crate 0.7.0-rc.3,
  `patches: none` and the WASM/wrapper hashes. Templates still load
  `lib/functional.ps`, now from the engine itself, per the owner's decision.
- **Renderer:** `begin(source, w, h, 1, {svg:true, pdf:true})`, then
  `svgCount()`/`svg(i)` and `pdf()` from the unchanged upstream wrapper. The
  worker and offline packaging needed no change: the packaging test still
  runs the packaged classic worker against the new WASM.
- **Output change, fully characterized** over menus in every template, A4,
  sans, one column, 40 and 500 items, and the business card. Layout logs are
  identical. SVGs are identical after mapping upstream's new
  `width="612pt" height="792pt"` back to unitless. PDFs are identical up to the
  `/Info` dictionary, which now carries the job's `%%Title:` (for example
  `/Title (Printshop menu)`), and the xref offsets after it. No geometry
  changed, so no visual change. Since a `pt`-sized SVG's intrinsic width is
  816 CSS px, the browser check now asserts the viewBox and that width; PNG
  export already sized itself from the page.
- **Licences:** every file in `public/licenses/` except the generated
  dependency page and the README is byte-identical to its upstream copy at the
  pin. The WASM build's dependency tree is the same 32 crates as at the old
  pin, so `wasm-dependency-licenses.html` still applies.
- `npm test` 22/22 (including repeat determinism and the provenance test),
  `npm run build`, the issues dry run, and `npm run test:browser` 9/9 in all
  four configurations. The preview was viewed after the change.

## Print preflight (PS-008) — 2026-11-04

- Probed the engine: `findfont` on an unknown name returns a fallback with no
  warning (`/NoSuchFont` gives `/Helvetica`, `/Palatino-Roman` gives
  `/texgyrepagella-regular`), so the old warnings-based substitution check
  could never fire. `ps-font` now refuses a face whose resolved `FontName`
  differs (`printshop-font-substituted`); a test renders a template patched to
  `/Palatino-Roman` and expects that error. All 74 comparison files (menus in
  every template and size, 1–500 items) and the business card are
  byte-identical to `main` with the check in place.
- Preflight now also blocks on media size (PDF MediaBox, SVG size, result
  size) and on a card that is not exactly front and back. A test tampers with a
  real result for each blocking check and expects exactly that finding.
- A test checks every stated limitation against real menu and card PDFs: PDF
  1.4, no font objects, no output intent/ICC/PDF/X, no TrimBox/BleedBox, and
  only `rg`/`RG` color operators.
- References: PGprint's guide (PDF text extracted) and Ghostscript's PDF/X
  documentation were fetched and quoted in `PRINT-PRODUCTION.md`. Adobe's help
  pages return 403 to automated fetches and are listed as unverified further
  reading.
## Column balancing and lone continuations (PS-010) — 2026-11-04

`templates/common.ps` now measures each category once, lazily, and runs one flow
procedure either as an arithmetic-only dry pass or as the drawn pass, so both
see identical positions.

- **Lone continuation.** When the penultimate item of a category fits but
  the final one would not, and the column already holds something, the pair
  moves to the next column together, if the pair and a heading fit a fresh
  column. Otherwise the greedy break stands.
- **Balance.** A multi-column menu that fits on one page is set with the
  highest column floor at which it still fits on that page, in order, without
  giving any category a kind of single-item piece (an opening item before a
  break, or a final item after one) that the unbalanced flow avoids. A
  whole-menu count was not enough: Codex review found balancing could trade
  one category's lone opening item for another's lone final item; that case
  is now a test. Feasibility is
  not monotone in the floor (binary search missed `[2 | 4]` → one category
  per column), so every candidate floor is scanned. All measured heights and
  positions are multiples of 0.5 pt, so half-point steps miss no feasible
  interval; a whole-point scan did (found by Codex review: a menu with 12.5 pt
  description lines got column bottoms 65.5 / 303 pt instead of 256 / 157.5;
  now a test). The scan starts at the floor that would just hold the content,
  which keeps the sample's render at about 80 ms versus 74 ms before. Starting
  there gave byte-identical output to scanning from the top in all 14
  comparison cases.

| Case | Before | After |
| --- | --- | --- |
| 14-item sample, all templates | "Aubergine & lentils" alone at the top of column 2 under a repeated "From the Kitchen" | "Roast chicken" moves with it; column bottoms 154 / 122.5 pt (were 99.5 / 177) |
| One category of 3 | column 1 only | unchanged: balancing would split it 1 + 2, which adds a lone piece |
| Categories of 2 and 4 | both in column 1 | one category per column |
| 4 + 5 + 2 items | all 11 in column 1 | 4 + 2 \| 3 + 2, bottoms 346.5 / 388 pt |
| 1 item, one-column menus, airy sample | | byte-identical SVG/PDF |
| 40 items | 3 pages | 3 pages |
| 500 items | 30 pages | 32 pages: pairs kept together cost two pages |

The tradeoff: keeping the final pair together leaves a little space at the
foot of a column, which costs two pages over 500 items; a one-page menu is
balanced but not justified vertically, so short menus end with white space
below both columns. Long menus' last pages are not balanced.

Near the 40-page cap this matters. A sweep of 500-item-class menus with 2–5
item categories found menus that render at 39–40 pages on `main` and now raise
`printshop-too-many-pages` (for example 2-item categories, 4-line descriptions,
394–400 items, two columns). Letting the pair rule yield near the cap would
need a full-menu dry pass, which is the eager measurement that changed named
errors above, so the cap stays a hard guard and this is accepted: a 40-page
menu is far outside the intended use. Away from the cap, page counts in the
sweep matched or grew by at most two.

Two more checks: the balance scan's cost peaked at 1.95 M interpreter steps
for one-page two-column menus of 1–60 items (12 M budget), and at 825 k for
lopsided menus with one very tall item. Pages 2–3 of the 40-item menu and page
16 of the 500-item menu were rasterized and viewed: continuation headings,
names, descriptions and prices are painted, and page 16 shows a final pair
kept together under its repeated heading.

One review finding was not changed: a 460-item single-category menu whose
`main` render used the entire 12 M-step budget (12,025,000 steps) before its
page-limit error now hits the budget slightly earlier. The budget is a resource
guard, and any added per-item work moves inputs that sit exactly on it.

Before and after (Classic Bistro sample, then the 2 + 4 menu):
[before](verification/ps-010/sample-classic-before.png),
[after](verification/ps-010/sample-classic-after.png),
[before](verification/ps-010/short-6-before.png),
[after](verification/ps-010/short-6-after.png). All three templates, A4,
compact and short fixtures were rasterized with `pdftoppm` and viewed.

Named errors must come out exactly as on `main`. An intermediate version
measured the whole menu before the flow, and Codex review found inputs where
that turned `printshop-item-too-tall`, `printshop-too-many-pages` or a heading's
`printshop-word-too-wide` into the generic render-budget error. Categories are
now measured lazily, heading first, when a pass reaches them, and then cached.
Page 1's masthead is drawn before any measuring, the first dry pass stops work
once it passes page 1, and only a menu that fits one page (hence fully
measured) is balanced. A long menu therefore measures and draws in the same
interleaved order as before. Ten adversarial cases (title, subtitle, words in
items and headings, early and late too-tall items, page limit in one and two
columns) give the same result as `main`'s template; four are tests.

New tests (`tests/render.test.mjs`) read the PSITEM placements and fail on
the old layout: no category ends with a lone continuation (all three
templates, 40 and 500 items), and short-menu balance (sample columns end
within 60 pt, 3 items stay together, 2 + 4 take a column each, one column is
never balanced, and both Codex counterexamples). `npm test`: 20 tests pass.

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
4. fails, rather than waits, when Chrome is missing or exits, and times out
   any DevTools command after 30 s;
5. for the file edition, fails on any request that is not `file:`, `blob:`
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
At the time, the sample's greedy flow left one category item at the top of the
next column; PS-010 (below, 2026-11-04) fixed it.

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
