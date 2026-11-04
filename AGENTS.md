# Printshop engineering conventions

Read `docs/ARCHITECTURE.md`, `docs/PSCAT-INVESTIGATION.md`, and `docs/HANDOFF.md`
before changing rendering. `docs/ROADMAP.md` links the durable issue definitions.

- Printable composition belongs in PostScript. No HTML/CSS/canvas document
  layout, screenshot export, image model, LLM dependency, backend, or API key.
- Keep structured content, template/style, rendering, and browser UI separate.
- Use the upstream commit and adapter recorded in `public/engine/provenance.json`.
  Never imply the functional libraries or vector ABI are available on main/npm.
- Use issues, a focused feature branch, meaningful checks, and coherent commits.
  If GitHub is unavailable, record an issue in `docs/issues/` for publication.
- Run `npm test` and `npm run build` for implementation changes. Run
  `npm run test:browser` when a browser is available; report a blocked browser
  check honestly. Visually inspect PDF/SVG output for visible template changes.
- Test layout with varying content and inspect item counts/bounds, rather than
  relying only on screenshots. Preserve exact named errors for overflow.
- Treat CSV cells as data. Escape PS literals; validate every public render API.
  Do not enable arbitrary template/code upload until a separate sandbox review.
- Functional quotations capture values, not lexical scope. Keep callback
  operand effects balanced. Put artkit's scratch definitions in a local dict.
- Preserve font/library/dependency notices with distributed WASM artifacts.
- Do not implement QR encoding here. Integrate the future upstream PS library.
- Print preflight must distinguish a downloadable proof from a production-
  certified file. Document exporter limitations in the UI as well as docs.
- No external orchestration database or independent MCP rendering pipeline.

<!-- sdlcify:managed:start -->
## SDLC

`SDLC.md` is the authoritative record of this repo's development
lifecycle (issue → feature branch → PR → CI → independent Codex review →
merge → cleanup) and the branch-protection/merge policy currently
enforced on GitHub — generated and kept in sync by the `sdlcify` skill.
<!-- sdlcify:managed:end -->
