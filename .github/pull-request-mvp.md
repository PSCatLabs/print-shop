Printshop turns restaurant-menu CSV into composed vector documents using the actual PSCat WebAssembly interpreter. It includes three reusable PostScript menu templates, customization, measured wrapping and pagination, SVG/PDF/PNG exports, and QR-free two-sided business cards. It runs entirely in the browser without an AI model, API key, backend, or print provider.

The renderer pins PSCat’s functional branch at `e8d6cf29a3e9ae62390a834961df2fdb58c7d78e`. A small, versioned WASM adapter exposes PSCat’s existing SVG/PDF recorders. Composition stays in PostScript, and both vector formats come from the same interpreter run.

Includes:

- Typed menu/card models, bounded CSV import, useful validation errors, and an example spreadsheet.
- Classic Bistro, Modernist, and Retro Diner templates with measured text, aligned prices, columns, pagination, and overflow errors.
- Actual SVG previews, native multipage PDF, selected-page PNG, and stale-export prevention.
- A two-sided 3.5 × 2 inch card with geometric bleed and an upstream-only QR integration boundary.
- Static and offline builds, print preflight, CI, architecture records, and 15 issue definitions with acceptance criteria.

Validation:

- Application tests cover actual WASM execution, deterministic bytes, 1/40/500-item menus, layout failures, SVG/PDF structure, and the exact packaged offline worker.
- The publishing script runs `npm test` and `npm run build` before pushing.
- Nine browser workflow checks passed in Chrome 156 at desktop and 390 px mobile-emulation viewports; reports are tracked in `docs/verification/`.
- All three menu designs and both card sides were visually inspected. A PDF saved through Chrome matched the Node-rendered sample byte for byte.
- The patched WASM library passed Clippy with warnings denied and Rust formatting checks.

Remaining limits:

- Served-site verification and the headless CLI browser harness remain unverified because of the development sandbox’s permissions; the offline browser workflow is verified.
- PDF exports are outlined RGB PDF 1.4 proofs, without ICC output intent, PDF/X certification, TrimBox/BleedBox metadata, or crop marks. Menus have no extra bleed.
- XLSX, broader text encoding, upstream QR integration, external template import, fulfillment, and MCP remain follow-up work.

See `docs/ARCHITECTURE.md`, `docs/PSCAT-INVESTIGATION.md`, and `docs/VERIFICATION.md` for decisions and evidence.
