# Printshop

**Try it: [pscatlabs.github.io/print-shop](https://pscatlabs.github.io/print-shop/)**
— a demo of deterministic documents rendered client-side by pscat's
WebAssembly build: no server, no account, no AI. The page also offers the
offline edition as a single HTML file.

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

The app uses relative URLs only, so `dist/` works at a site root or under a
path prefix. `.github/workflows/pages.yml` deploys it to GitHub Pages on every
push to `main`. To check the live site in headless Chrome:
`npm run test:browser -- --url https://pscatlabs.github.io/print-shop/`.

The offline file contains the same app, templates and actual WASM. It requires
a modern browser with workers, Blob URLs and native gzip decompression.
Headless Chrome 156 passes all eleven workflow checks in both the offline file
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
- A front/back business card at 3.5 × 2 in trim plus 1/8 in bleed, with an
  optional QR code on the back drawn by pscat's own `lib/qr.ps`.
- Print preflight that distinguishes vector proofs from production certification.

The engine is the unmodified **pscat 0.7.0-rc.4** release (tag
`v0.7.0-rc.4`, commit `df39114`): the npm package tarball attached to the
[GitHub pre-release](https://github.com/PSCatLabs/pscat/releases/tag/v0.7.0-rc.4).
It includes the WASM SVG/PDF output (PSCatLabs/pscat#1004) and
`lib/functional.ps` (PSCatLabs/pscat#923). It is not on the npm registry,
where `pscat` is still 0.6.3, so the npm package must not be substituted until
0.7.0 is published there. Printshop drives it through the package's own
`createRenderer()` API (`svg:true, pdf:true` recording, `svgPages()`,
`pdf()`). The pinned version, URL, tarball SHA-256 and the hash of every
installed file are in [`public/engine/provenance.json`](public/engine/provenance.json).

## Verification and the engine

```sh
npm run engine:fetch        # install the pinned pscat release into public/engine/ (verified by SHA-256)
npm test                    # parser/schema, real WASM, layout, exports, packaging
npm run build               # verifies every engine file's hash and emits static/offline builds
npm run test:browser        # headless Chrome, offline + served (under /print-shop/), desktop + mobile; set CHROME_BIN if needed
npm run test:qr             # decode card QR codes from SVG, PDF (Poppler) and PNG with Chrome's BarcodeDetector
```

The engine is not committed (#17): every engine bump would add another 11 MB
`pscat.wasm` to the history. Instead `scripts/fetch-engine.mjs` downloads the
release tarball pinned in `provenance.json` (cached in the ignored
`.engine-cache/`), refuses it unless its SHA-256 matches, extracts it and
installs `index.js`, `renderer.js`, `core.js`, `pscat.wasm` and
`THIRD_PARTY_LICENSES.html` unchanged into the ignored `public/engine/`,
each checked against its own pinned hash. `npm test`, `npm run build`,
`test:browser`, `test:qr` and `dev` run it first; it needs the network only
the first time, and needs neither Rust nor a pscat checkout. The offline
edition embeds the fetched module at build time. To move to another release
(or to `pscat@0.7.0` from npm once it is published), change `url`, `version`,
`sha256` and the file hashes in `provenance.json`, after checking the new
tarball's build-provenance attestation with
`gh attestation verify <tarball> --repo PSCatLabs/pscat`.
Tests generate actual PDFs/SVGs under ignored `artifacts/` for inspection.

## Status and next work

The rendering API, generated documents and offline browser workflow are
verified in both the offline and served editions. Production PDF metadata
remains unfinished. PDFs use RGB
and outlined type, with no ICC output intent, PDF/X certification, TrimBox,
BleedBox or crop marks. Menus have no additional bleed. XLSX, arbitrary template import, fulfillment and MCP are
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
