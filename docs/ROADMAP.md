# Phased implementation roadmap

The durable ledger is GitHub Issues in `PSCatLabs/print-shop`. The 15
definitions in [`issues.json`](issues.json) include scope, dependencies, local
status and acceptance criteria; each maps to its GitHub issue URL.

| Phase | Focus | Issue IDs | Current state |
| --- | --- | --- | --- |
| 1 | Repository bootstrap and WASM integration | PS-001 | Local app/repository, pinned bridge built; remote blocked |
| 2 | Structured menu data model | PS-002, PS-012 | CSV implemented; XLSX and broader encoding optional |
| 3 | First complete menu template | PS-003 | Classic Bistro verified in WASM and desktop/mobile Chrome |
| 4 | Deterministic layout and pagination | PS-004, PS-010 | Measured flow implemented; balancing/look-ahead follow-up |
| 5 | Additional visual templates | PS-005 | All three verified in desktop/mobile Chrome |
| 6 | SVG/PDF export | PS-006, PS-009 | Offline and served browser exports pass (headless Chrome, desktop and mobile) |
| 7 | Business-card support | PS-007, PS-013 | Two-sided card passes browser tests; upstream QR dependency pending |
| 8 | Print preflight and production readiness | PS-008, PS-011 | Basic preflight; advanced exporter requirements open |
| 9 | Future fulfillment and MCP integration | PS-014, PS-015 | Boundaries documented; no provider/agent/server implemented |

## Recommended next session

PS-009 is complete (2026-11-04): `npm run test:browser` drives headless Chrome
over the DevTools protocol and passes nine checks in the offline file and the
served edition, each at desktop and a 390 px mobile viewport. JSON reports are
in `verification/`. The repository is published at PSCatLabs/print-shop.

Then PS-010 improves short-menu composition without inventing a desktop
publishing engine. PS-011 addresses production metadata with upstream PSCat.
QR and template import remain dependency-/validation-gated. Fulfillment and
MCP are later adapters, not prerequisites for downloading a useful menu.
