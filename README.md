# Printshop

A small-business publishing application powered by the actual PSCat
PostScript interpreter in WebAssembly. Import menu CSV, choose a real
PostScript template, customize it, preview the vector result, and download
SVG or PDF. No AI model, API key, backend, account or print provider.

## Run

Use Node 22 or later. There are no npm dependencies to install.

```sh
npm test
npm run dev
# Open the printed http://127.0.0.1:5173 URL.
```

For a static host or an offline file:

```sh
npm run build
# Serve dist/ as static files, or open dist/printshop-offline.html directly.
```

The offline file contains the same app, templates and actual WASM. It requires
a modern browser with workers, Blob URLs and native gzip decompression.
Headless Chrome 156 passes all nine workflow checks in both the offline file
and the served edition, at desktop and 390 px mobile viewports. The offline worker is packaged as a single classic script so it
can start from a file origin. The served edition uses ordinary module workers.

## Included

- RFC-style CSV import with typed menu models, useful validation errors,
  dietary/add-on fields and a downloadable [example](public/example-menu.csv).
- Classic Bistro, Modernist and Retro Diner PostScript templates, each built
  on actual font measurement and wrapping, aligned prices, columns, pagination,
  repeated category headings and named overflow errors.
- Business name, subtitle, palette, body typography, page size, columns,
  spacing and optional ornaments. Standard-font Latin-1 support, with explicit
  errors for unsupported scripts/currency symbols.
- Actual SVG page previews; native multipage PDF; selected-page SVG/PNG export.
- A QR-free front/back business card at 3.5 × 2 in trim plus 1/8 in bleed.
- Print preflight that distinguishes vector proofs from production certification.

The engine is unmodified PSCat **`main` at `db44e12`** (crate 0.7.0-rc.3),
which includes the WASM SVG/PDF output (PSCatLabs/pscat#1004) and
`lib/functional.ps` (PSCatLabs/pscat#923). Neither is in a pscat release yet,
so an older release or the current npm package must not be substituted. Source/patch/artifact hashes are in
[`public/engine/provenance.json`](public/engine/provenance.json).

## Verification and engine rebuilding

```sh
npm test                    # parser/schema, real WASM, layout, exports, packaging
npm run build               # verifies WASM provenance and emits static/offline builds
npm run test:browser        # headless Chrome, offline + served, desktop + mobile; set CHROME_BIN if needed
python3 scripts/build-engine.py
# Or reuse a dedicated checkout at the exact pin:
python3 scripts/build-engine.py --source /path/to/pscat --offline
```

Normal tests/build need neither Rust nor network; a committed WASM artifact is
included. Engine rebuild requires Rust, `wasm32-unknown-unknown`, the pinned
source and locked Cargo dependencies. The builder refuses unrelated changes.
Tests generate actual PDFs/SVGs under ignored `artifacts/` for inspection.

## Status and next work

The rendering API, generated documents and offline browser workflow are
verified in both the offline and served editions. Production PDF metadata
remains unfinished. PDFs use RGB
and outlined type, with no ICC output intent, PDF/X certification, TrimBox,
BleedBox or crop marks. Menus have no additional bleed. QR awaits
integration of pscat's `lib/qr.ps` (#13); XLSX, arbitrary template import, fulfillment and MCP are
future work. See [print limitations](docs/PRINT-PRODUCTION.md).

- [Architecture and decisions](docs/ARCHITECTURE.md)
- [PSCat investigation and browser-demo findings](docs/PSCAT-INVESTIGATION.md)
- [Roadmap and issue ledger](docs/ROADMAP.md)
- [Verification record](docs/VERIFICATION.md)
- [Next-session handoff](docs/HANDOFF.md)

## Repository and issues

The repository is [PSCatLabs/print-shop](https://github.com/PSCatLabs/print-shop).
Work is tracked in its GitHub Issues; `docs/issues.json` holds the original
definitions (PS-001 to PS-015) and maps each to its GitHub issue. Re-running
`npm run issues:publish` is idempotent: it matches issues by a hidden marker.

Printshop application code is MIT licensed. Distributed PSCat, fonts and Rust
dependencies retain the additional notices in [public/licenses](public/licenses/README.md).

<!-- sdlcify:managed:start -->
## SDLC

See [`SDLC.md`](SDLC.md) for how this repo's development lifecycle
works (issue → branch → PR → review → merge → cleanup) and the
branch-protection/merge policy currently enforced on GitHub — generated
and kept in sync by the `sdlcify` skill.
<!-- sdlcify:managed:end -->
