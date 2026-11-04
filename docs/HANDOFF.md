# Next-session handoff

The standalone Printshop application is published at
[PSCatLabs/print-shop](https://github.com/PSCatLabs/print-shop) (2026-11-04).
Its initial history was built by Codex in a managed workspace with Git metadata
in `.local-git/`; that is no longer used. It is an ordinary Git checkout now.
Do not place these sources in PSCat.

The actual dependency checkout used during investigation/build was
`/tmp/printshop-pscat`; it is disposable. The committed module, unchanged
wrapper, patch and provenance are sufficient for tests and packaging without
that directory. To rebuild, clone the exact recorded feature commit into a
dedicated directory and use `scripts/build-engine.py`. No modifications were
made to the separate ongoing QR project.

## State and next tasks

The repository follows `SDLC.md`: issue → feature branch → PR → CI → an
independent Codex review → merge; nothing goes straight to `main`. Use Node
24.14.0 from nvm (`source ~/.nvm/nvm.sh && nvm use 24.14.0`); the original
host's Homebrew Node was broken.

- PS-009 (#9) is done: `npm run test:browser` drives headless Chrome over the
  DevTools protocol and passes offline and served editions at desktop and
  390 px mobile. Run it after any UI or rendering change.
- PS-010 (#10) is done: see `docs/VERIFICATION.md` for the layout tradeoff.
- Next: PS-008 (#8) preflight acceptance, then
  #16 (repin to a released pscat once PSCatLabs/pscat#1003 lands its WASM
  SVG/PDF output and the functional library is on pscat main) and #13 (QR).
- Deferred: #12, #14, #15, #17.

## What works under automated verification

CSV → typed/validated model → escaped PS content → shared measured PS layout →
real WASM execution → outlined vector SVG/native PDF. Three menu styles,
parameter changes, 1/40/500-item menus and two-sided QR-free cards are covered.
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
- No local QR encoder. Upstream library integration is PS-013.
- Trusted bundled templates only. External package validation is PS-014.
- No authentication, billing, backend, ecommerce, fulfillment adapter or MCP
  server. Future boundaries are documented without introducing dependencies.
