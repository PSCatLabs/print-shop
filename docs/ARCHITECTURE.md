# Architecture

Printshop is a standalone static browser application. No model, API key,
inference service, account, backend, database, or print provider is required.
The web interface is ordinary HTML/CSS and ES modules, compatible with PSCat's
dependency-free browser demo. Node 22+ is needed for development checks only.

## Four layers

| Layer | Implementation | Contract |
| --- | --- | --- |
| Structured content | `src/types.d.ts`, `src/model.js`, `src/csv.js` | JSDoc-typed menu/card models; deterministic import and runtime validation |
| Templates and styling | `templates/*.ps`, `src/postscript.js` | Content becomes escaped literal dictionaries; parameters select trusted PS composition |
| Deterministic rendering | `src/renderer.js`, `src/render-worker.js`, pinned PSCat WASM | Same interpreter run records all SVG pages and the complete PDF |
| Browser application | `index.html`, `styles.css`, `src/app.js` | Upload/edit, choose a design, customize, navigate actual vector pages, download |

`importMenu(csv) → validateMenu(menu) → compileMenu(menu, parameters, sources)
→ VectorRenderer → {svgs, pdf, output, warnings} → preflightPrint` is the shared
application API. Business cards use `compileCard` and the same renderer.
Future MCP operations call these APIs; no separate rendering implementation.

## Decisions

1. **Pin the functional feature branch.** Dependency is PSCat
   `e8d6cf29a3e9ae62390a834961df2fdb58c7d78e`, crate 0.6.3. It is not the newer
   main release. `fp-map`, `fp-each`, and `fp-curry` are used by the measured
   item pipeline; they are real PS library procedures, not JS emulations.
2. **Bridge existing vector recorders.** The original `web/pscat.js` is copied
   unchanged. A checked-in patch enables `Interp::enable_svg/enable_pdf` before
   execution and adds two C ABI exports to copy serializer results. No changes
   to parser, operators, fonts, measurement, drawing, or serializers. SVG and
   PDF are captured together, without rerunning content for each format.
3. **PostScript owns layout.** `stringwidth` and artkit `tfwrap` measure names,
   descriptions, dietary labels and add-ons using the actual fonts. Blocks
   reserve a measured price area, stay together, flow columns then pages, and
   repeat their category heading at a break. A category heading stays with its
   first item. A whole item that exceeds a fresh column is refused. Items are
   measured once; the same flow procedure then runs as arithmetic-only dry
   passes or as the drawn pass, so look-ahead never needs a second layout
   engine. Two refinements (PS-010): a category's final item never continues
   alone under a repeated heading when the pair fits a fresh column; and a
   multi-column menu that fits on one page gets the highest column floor that
   keeps it on one page without giving any category a single-item piece, which
   balances the columns. Type is never shrunk. There is no hyphenation,
   kerning-aware shaping, general widow/orphan optimization, last-page
   balancing of long menus, or complete publishing engine.
4. **Bounded data and trusted templates.** CSV is capped at 512 KB / 500 items;
   fields and parameters have explicit limits. Literal strings escape every
   delimiter and byte. Latin-1 is explicitly re-encoded into the bundled
   standard fonts. Common pasted smart punctuation is normalized; other scripts
   and emoji are rejected with an error. Fonts are outlined by PSCat.
5. **Worker isolation and cancellation.** Every browser job gets a worker and
   a fresh interpreter. New edits terminate stale work. Object slices yield;
   a 12-million-object budget and 20-second external watchdog bound failures.
   UI downloads are disabled for pending, invalid and failed renders. Last
   successful previews remain visibly labeled as old until replaced. This is
   not a general sandbox for externally authored PostScript.
6. **Actual SVG preview.** The UI displays a Blob-backed `<img>` containing
   PSCat's SVG page. No document layout is reproduced with DOM/CSS. PDF is the
   native vector PDF document. PNG rasterizes that exact exported SVG at
   300/72 scale, one selected page per download. Its pixel count corresponds
   to 300 ppi at trim/media size; PNG resolution metadata is not guaranteed.
7. **Offline and hosted packaging.** `npm run build` copies a static `dist/`
   and creates `dist/printshop-offline.html`. The offline edition packages the
   same modules as Blob modules, embedded PS sources, CSV, notices and gzipped
   WASM. Its worker is one classic script because module-worker startup failed
   from Chrome's file origin. Packaging removes the two app imports and class
   export keywords, and converts the upstream wrapper's `import.meta.url`
   expression to `self.location.href`; the byte-instantiation path is otherwise
   unchanged. The served edition still uses the original ES module wrapper and
   module worker. This is packaging of the same renderer, not a second pipeline.
   It requires workers, Blob URLs, WASM and native gzip `DecompressionStream`.
   Both editions pass the headless browser suite in Chrome 156 at desktop and
   390 px mobile viewports (`npm run test:browser`).
8. **QR stays upstream.** Cards are QR-free. A future QR adapter accepts
   `{payload, sizePt, quietZoneModules, errorCorrection}` and loads a versioned
   PSCat library, invoking its documented PS entry point inside a bounded card
   rectangle. Until upstream API/version are published, there is no assumed
   operator name and no local encoder or JS/Rust QR dependency.

## Template publication boundary

The three menu templates are real independent `.ps` files using a shared layout
vocabulary. They define fonts, masthead composition, category marks and visual
hierarchy, while data and parameters are supplied separately. A future
versioned template package should include a manifest with stable ID/version,
document kinds, parameter schema, dimensions, supported columns, font/library
dependencies, source hash, license, sample fixtures and preflight requirements.
Validate that package, render under hard limits, and require visual review
before publication. ArtColony can author such a package externally. This
application neither implements an agent nor accepts arbitrary PS uploads.

## Fulfillment and MCP

`src/fulfillment.js` describes the provider-neutral product, specification,
quote and order boundary, with a download-only provider today. Future quotes
must bind to a document hash, stock, finish, trim, bleed, sides and quantity;
submission is a separate explicit action. No provider SDK or credentials are
present. Future MCP `list_templates`, `describe_template`, `render_template`,
`validate_document`, and `preflight_print` reuse this model and renderer.
