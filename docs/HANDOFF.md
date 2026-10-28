# Next-session handoff

The standalone Printshop application is implemented on
`feature/initial-vertical-slice`. Git metadata is in `.local-git/` because the
managed root `.git` path is reserved. Run `sh scripts/git-local.sh log --oneline`
to inspect commits. Restore ordinary `.git` as described in the README when
the workspace permits it. Do not place these sources in PSCat.

The actual dependency checkout used during investigation/build was
`/tmp/printshop-pscat`; it is disposable. The committed module, unchanged
wrapper, patch and provenance are sufficient for tests and packaging without
that directory. To rebuild, clone the exact recorded feature commit into a
dedicated directory and use `scripts/build-engine.py`. No modifications were
made to the separate ongoing QR project.

## First task: PS-009

Complete browser acceptance on a machine that can run Chrome and bind localhost.

1. Use terminal `gh`/`git`, as requested by the owner. Check access; create the
   proposed `PSCatLabs/printshop` repository if it is still absent. Publish the
   feature branch and issue definitions with the included idempotent CLI script.
2. Read architecture, investigation and print-production notes. Run `npm test`
   and `npm run build` using a working Node 22+ installation. The initial host's
   Homebrew Node had a missing dylib; the working Node was the installed nvm
   24.14.0 binary.
3. Run `npm run test:browser` (`CHROME_BIN` can select Chrome). It opens the
   self-contained file with an opt-in suite and records a report/screenshot.
   Fix any real errors; the initial host could not launch Chrome at all.
4. Run `npm run dev`, inspect the served edition too, and inspect desktop and
   390 px mobile UI. Verify file upload, repeated edits, stale-export disabling,
   every template, multipage navigation, card front/back and actual downloads.
5. Update the verification record with evidence. Close acceptance issues only
   when their browser criteria pass; Node tests alone do not establish the UI.

## What works under automated verification

CSV → typed/validated model → escaped PS content → shared measured PS layout →
real WASM execution → outlined vector SVG/native PDF. Three menu styles,
parameter changes, 1/40/500-item menus and two-sided QR-free cards are covered.
The app includes UI upload/edit, customization, paging, exports and preflight.
The offline package resolves all real JS modules and restores the exact engine
under Node; browser initialization/download behavior still needs PS-009.

## Known limits

- Greedy columns, without balancing or widow/orphan optimization (PS-010).
- CSV only; no XLSX, general Unicode or euro encoding (PS-012). Smart quotes,
  dashes and ellipses are normalized; accented Latin-1 is supported.
- RGB PDF 1.4 with outlined type. No ICC intent, PDF/X validation, trim/bleed
  metadata or crop marks. Card media has geometric bleed; menu media does not.
- No local QR encoder. Upstream library integration is PS-013.
- Trusted bundled templates only. External package validation is PS-014.
- No authentication, billing, backend, ecommerce, fulfillment adapter or MCP
  server. Future boundaries are documented without introducing dependencies.
