# Next-session handoff

The standalone Printshop application is published at
[PSCatLabs/print-shop](https://github.com/PSCatLabs/print-shop) (2026-11-04).
Its initial history was built by Codex in a managed workspace with Git metadata
in `.local-git/`; that is no longer used. It is an ordinary Git checkout now.
Do not place these sources in PSCat.

The engine is not committed. `npm run engine:fetch` (run automatically by
`npm test`, `npm run build` and the browser/QR checks) installs the pscat
release tarball pinned in `public/engine/provenance.json`, verified by
SHA-256, into the ignored `public/engine/`; no pscat checkout or Rust is
needed. No modifications were made to the separate ongoing QR project.

## State and next tasks

The repository follows `SDLC.md`: issue → feature branch → PR → CI → an
independent Codex review → merge; nothing goes straight to `main`. Use Node
24.14.0 from nvm (`source ~/.nvm/nvm.sh && nvm use 24.14.0`); the original
host's Homebrew Node was broken.

- PS-009 (#9) is done: `npm run test:browser` drives headless Chrome over the
  DevTools protocol and passes offline and served editions at desktop and
  390 px mobile. Run it after any UI or rendering change.
- PS-010 (#10) is done: see `docs/VERIFICATION.md` for the layout tradeoff,
  The 40-page cap it mentions was removed by #31.
- PS-008 (#8) is done: preflight blocks on missing output, engine warnings,
  media size, counts and bounds; `ps-font` refuses a substituted face; a test
  ties every stated exporter limitation to the PDF bytes. See
  `docs/PRINT-PRODUCTION.md`.
- #16 is done, and #28/#17 replaced its clone build: the engine is the
  unmodified pscat 0.7.0-rc.4 release (tag commit `df39114`; vector output
  from PSCatLabs/pscat#1004, `lib/functional.ps` from #923), fetched at build
  time from the GitHub release tarball and pinned by version and SHA-256 in
  `provenance.json`. `src/renderer.js` uses the package's `createRenderer()`
  API. Next: when pscat 0.7.0 is on npm, repin to the registry tarball
  (`url`, `version`, `sha256`, file hashes). The package's Renderer has no
  page count, so `VectorRenderer.progress` probes `svg(n)` for it.
  The templates keep `fp-map`/`fp-each`/`fp-curry` per the owner's decision.
- #13 is done: optional card QR through pscat's `lib/qr.ps`. `npm run
  test:qr` decodes SVG, Poppler-rasterized PDF and PNG with Chrome's
  `BarcodeDetector`, and the browser suite decodes the app's PNG download.
- #30 is done: the public demo is on GitHub Pages at
  https://pscatlabs.github.io/print-shop/, deployed by
  `.github/workflows/pages.yml` on every push to `main` (Pages source: GitHub
  Actions). All app URLs are relative; the served browser check runs under
  `/print-shop/` and 404s anything outside it. The page links the offline
  edition. The package's loader compiles the bytes when the host does not send
  `application/wasm`, so the `.wasm` MIME type does not matter. Check the live site with `npm run test:browser -- --url <URL>`.
- #31 is done: no arbitrary limits (pages, items, CSV size, field lengths,
  QR length below capacity). Only measured layout errors and QR capacity
  remain. Long renders show progress and a Cancel button instead of a step
  budget and watchdog; see `docs/VERIFICATION.md`.
- Open, not started: #11 (page boxes/color intent; needs upstream exporter
  work).
- Deferred: #12, #14, #15, #17.

## What works under automated verification

CSV → typed/validated model → escaped PS content → shared measured PS layout →
real WASM execution → outlined vector SVG/native PDF. Three menu styles,
parameter changes, 1/40/250/500-item menus (250 with long descriptions runs past 40 pages) and two-sided cards with and without a QR code are covered.
The app includes UI upload/edit, customization, paging, exports and preflight.
The offline package resolves all real JS modules, restores the exact engine,
and executes its actual packaged classic worker under Node. Headless browser
reports pass for the offline and served editions at 1440 × 900 desktop and
390 × 844 mobile (earlier native-Chrome offline runs: 1843 × 834 and 390 × 747). A PDF saved through
Chrome's native Save dialog matches the Node-generated sample byte for byte.

## Browser fixes from the continuation

The file edition originally failed to start its module worker. It now bundles
the same wrapper/adapter/worker as one classic script, with syntax-only module
conversion. The server edition keeps module workers. Do not reintroduce imports
into the classic worker. Packaging tests check that invariant and execute it.
Loading the example now sets its pending state before awaiting the asset, so
the UI clears an earlier error immediately and keeps stale exports disabled.

## Known limits

- Column flow keeps a category's last two items together and balances
  one-page multi-column menus (PS-010). The last page of a multi-page menu is
  not balanced, and there is no general widow/orphan optimization.
- CSV only; no XLSX, general Unicode or euro encoding (PS-012). Smart quotes,
  dashes and ellipses are normalized; accented Latin-1 is supported.
- RGB PDF 1.4 with outlined type. No ICC intent, PDF/X validation, trim/bleed
  metadata or crop marks. Card media has geometric bleed; menu media does not.
- No local QR encoder: QR comes from pscat's `lib/qr.ps` (PS-013). Payloads
  are printable ASCII up to 203 bytes, the capacity of a version 12 symbol at
  level Q with 4 px modules in 1 in.
- Trusted bundled templates only. External package validation is PS-014.
- No authentication, billing, backend, ecommerce, fulfillment adapter or MCP
  server. Future boundaries are documented without introducing dependencies.
