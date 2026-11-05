# PSCat investigation — 2026-10-28

> **Superseded for the engine pin (2026-11-04, 2026-11-05).** Printshop
> now uses the unmodified pscat 0.7.0-rc.4 release, fetched at build time
> from its GitHub release tarball and pinned by SHA-256 (#28): the vector
> output below was adopted upstream (PSCatLabs/pscat#1004) and
> `lib/functional.ps` merged (PSCatLabs/pscat#923). See `ARCHITECTURE.md`.
> The findings below, including the adapter build, are kept as history.

Reference: [PSCatLabs/pscat](https://github.com/PSCatLabs/pscat).
Inspected main at `07f054c19d7045281a667e185b9bfc74f3cde29e` (0.7.0-rc.1),
and the long-running functional branch at
`e8d6cf29a3e9ae62390a834961df2fdb58c7d78e` (0.6.3).
The functional branch is not an ancestor of the inspected main, and main does
not contain `lib/functional.ps`. Printshop deliberately depends on the feature
commit, with its small vector ABI adapter patch, not a floating branch or npm.

## What was studied

- `AGENTS.md`, `SDLC.md`, `docs/dev/HANDOFF.md`, `ARCHITECTURE.md`, `TASTE.md`,
  the contributor index, functional skill/API/design/implementation/progress
  docs, browser guide, and the functional browser validation records.
- `Cargo.toml`, `build.rs`, `src/object.rs`, `interp.rs`, `gfx.rs`, `wasm.rs`,
  `svg.rs`, `pdf.rs`, `limits.rs`, color operators, font re-encoding tests.
- `web/pscat.js`, `web/index.html`, npm renderer/types/package, WASM build,
  functional studio build and Node/browser checks, test and CI conventions.
- `lib/functional.ps`, `aspect.ps`, paragraph section of `artkit.ps`,
  `examples/paragraph_layout.ps`, functional typography/poster examples,
  gallery organization and vector/PDF/font/render integration tests.

## Reusable architecture

The Rust core has an explicit operand/dictionary/execution machine. `Object`
uses byte strings and reference semantics for composites. `begin_source` /
`step_n` let front ends schedule a bounded amount of work, independent of a
window. `Gfx` rasterizes and mirrors paint events into native SVG and PDF
recorders. Text reaches both exporters as outlines. Multiple pages are
snapshotted at `showpage`, with pending canvas erasure handled by the core.

The WASM target uses a hand-written C ABI, not wasm-bindgen. The actual
`Pscat` wrapper instantiates a module without imports, passes UTF-8 or raw
source bytes, begins/steps/runs, reads errors/stdout/font warnings and exposes
RGBA pixels. Its npm wrapper adds higher-level convenience but still exposes
only raster output at this commit. The original WASM ABI has no SVG/PDF export.

The functional extension is entirely PostScript: array map/filter/fold/each,
explicit one-value curry, composition/dip, and optional aspect decorators.
Captures share composites, names remain dynamic, callbacks preserve caller
prefix and dictionary/graphics balance. It is neither a type system nor a
sandbox. `tfwrap` and `stringwidth` already provide measured greedy wrapping;
a single word may exceed its line, so Printshop checks and rejects that case.
Artkit's scratch variables need local dictionaries for nested/reentrant use.

## The actual browser demo

[`live-studio.html`](https://github.com/PSCatLabs/pscat/blob/e8d6cf29a3e9ae62390a834961df2fdb58c7d78e/docs/functional-postscript/live-studio.html)
is the relevant live entry point, including `#press` for the AOP proof. Its
generated local script contains gzipped actual WASM, the unchanged wrapper,
and real inlined PS programs. Browser `DecompressionStream` plus Blob module
URLs permit `file://` execution. `studio.js` constructs bounded parameters,
steps the real interpreter and blits returned RGBA. It is not an SVG preview.
The older `index.html` includes saved images, so it must not be mistaken for
the live renderer. The committed payload is ~7.1 MB, raw module ~11.5 MB.

Printshop reuses this core pattern, functional library loading, local byte
instantiation, stepped execution, real errors and bundled standard fonts.
It adds worker scheduling and vector result access. It does not reuse the
artwork, static screenshots or title-word styling as menu layout.

## Missing capabilities and decisions

| Capability | Upstream inspected state | Printshop action |
| --- | --- | --- |
| SVG/PDF WASM bindings | Native recorders exist; browser access absent | Versioned 2-function C ABI bridge plus recorder enabling |
| Menu blocks/pagination | General paragraph flow; no menu model | Reusable measured PS blocks; column/page cursor; explicit overflow guards |
| Standard fonts | Bundled; byte encoding | Latin-1 re-encoding; outlines; reject unsupported characters |
| PDF | 1.4, RGB paint, outlined type | Export vector proofs; disclose production limitations |
| Advanced print metadata | No TrimBox/BleedBox/output intent/PDF-X contract | Preflight warnings; follow-up issue |
| Shading | SVG gradients; PDF average-color approximation | Templates use flat inks and paths only |
| QR library | Separate in-progress branch; no published contract assumed | QR-free card and a clean future PS-library boundary |
| External template safety | Interpreter limits are not complete isolation | Trusted bundled templates only |
| XLSX | No importer needed by upstream | Deferred; CSV is working and tested |

## Adapter reproducibility

`scripts/build-engine.py` checks the exact source commit and patch, builds
`cargo rustc --lib --release --locked --target wasm32-unknown-unknown
--no-default-features --crate-type cdylib`, and copies WASM plus the unchanged
wrapper. `public/engine/provenance.json` records source, patch, wrapper and
module hashes and compiler. The committed module makes normal `npm test` /
build independent of Rust and network. Rebuild needs a stable Rust toolchain
supporting the pinned code, the WASM target and locked Cargo dependencies.

`ps_vector_export(0)` serializes existing SVG pages into a UTF-8 JSON array;
`ps_vector_export(1)` copies the existing PDF bytes. It returns a buffer length;
`ps_vector_ptr()` returns its pointer. The JS adapter copies the buffer before
another export. Recorders start before execution in the existing install hook.
Source semantics, rendering and serializer implementations are unchanged.

Upstream code is MIT OR Apache-2.0, with bundled font/library terms OFL-1.1 and
LPPL-1.3c. Notices and full WASM dependency license texts ship under
`public/licenses/`; do not distribute the bare WASM without these terms.
