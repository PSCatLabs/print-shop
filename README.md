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
a modern browser with module workers, Blob URLs and native gzip decompression.
Its module packaging and exact WASM payload are tested under Node. The initial
environment prevented a real-browser run; browser acceptance remains open.

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

The engine is PSCat **0.6.3 from `feature/functional-postscript`**, pinned at
`e8d6cf29a3e9ae62390a834961df2fdb58c7d78e`, with a small vector ABI adapter.
Main and released/npm builds must not be substituted without checking their
capabilities. Source/patch/artifact hashes are in
[`public/engine/provenance.json`](public/engine/provenance.json).

## Verification and engine rebuilding

```sh
npm test                    # parser/schema, real WASM, layout, exports, packaging
npm run build               # verifies WASM provenance and emits static/offline builds
npm run test:browser        # real Chrome UI/download checks; set CHROME_BIN if needed
python3 scripts/build-engine.py
# Or reuse a dedicated checkout at the exact pin:
python3 scripts/build-engine.py --source /path/to/pscat --offline
```

Normal tests/build need neither Rust nor network; a committed WASM artifact is
included. Engine rebuild requires Rust, `wasm32-unknown-unknown`, the pinned
source and locked Cargo dependencies. The builder refuses unrelated changes.
Tests generate actual PDFs/SVGs under ignored `artifacts/` for inspection.

## Status and next work

The rendering API and generated documents are verified. Browser acceptance,
GitHub publication and production PDF metadata are unfinished. PDFs use RGB
and outlined type, with no ICC output intent, PDF/X certification, TrimBox,
BleedBox or crop marks. Menus have no additional bleed. QR awaits the separate
upstream PS library; XLSX, arbitrary template import, fulfillment and MCP are
future work. See [print limitations](docs/PRINT-PRODUCTION.md).

- [Architecture and decisions](docs/ARCHITECTURE.md)
- [PSCat investigation and browser-demo findings](docs/PSCAT-INVESTIGATION.md)
- [Roadmap and issue ledger](docs/ROADMAP.md)
- [Verification record](docs/VERIFICATION.md)
- [Next-session handoff](docs/HANDOFF.md)

## Initial repository handoff

The managed workspace reserves `.git`, so this session stores repository
metadata in ignored `.local-git/`. The source is a standalone Printshop working
tree, not part of PSCat. Use `sh scripts/git-local.sh status` and other Git
arguments in this environment. Once normal filesystem access is available:

```sh
mv .local-git .git
gh auth status
gh repo create PSCatLabs/printshop --public
git remote add origin https://github.com/PSCatLabs/printshop.git
git push -u origin feature/initial-vertical-slice
npm run issues:publish
```

Repository creation and issue publishing were attempted with `gh`; network and
authentication checks failed. None are claimed to exist remotely. The 15 issue
definitions retain dependencies and acceptance criteria, and publication uses
remote markers to avoid duplicates. Review the feature branch before merging.

Printshop application code is MIT licensed. Distributed PSCat, fonts and Rust
dependencies retain the additional notices in [public/licenses](public/licenses/README.md).
