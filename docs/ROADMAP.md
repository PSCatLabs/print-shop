# Phased implementation roadmap

The intended durable ledger is GitHub Issues in `PSCatLabs/printshop`.
The initial session could not create that repository: `gh` reports an invalid
credential and cannot reach `api.github.com`; `git ls-remote` also reports DNS
failure. No remote issues have been created. The 15 definitions in
[`issues.json`](issues.json) include scope, dependencies, local status and
independently verifiable acceptance criteria. Publish them idempotently with
`npm run issues:publish` once the repository and CLI access exist. Their marker
IDs survive retries and will be mapped to returned GitHub URLs in that file.
These local IDs are not GitHub issue numbers.

| Phase | Focus | Issue IDs | Current state |
| --- | --- | --- | --- |
| 1 | Repository bootstrap and WASM integration | PS-001 | Local app/repository, pinned bridge built; remote blocked |
| 2 | Structured menu data model | PS-002, PS-012 | CSV implemented; XLSX and broader encoding optional |
| 3 | First complete menu template | PS-003 | Classic Bistro implemented and output inspected |
| 4 | Deterministic layout and pagination | PS-004, PS-010 | Measured flow implemented; balancing/look-ahead follow-up |
| 5 | Additional visual templates | PS-005 | Modernist and Retro Diner implemented |
| 6 | SVG/PDF export | PS-006, PS-009 | Actual vector export passes Node tests; browser release gate open |
| 7 | Business-card support | PS-007, PS-013 | Two-sided card implemented; upstream QR dependency pending |
| 8 | Print preflight and production readiness | PS-008, PS-011 | Basic preflight; advanced exporter requirements open |
| 9 | Future fulfillment and MCP integration | PS-014, PS-015 | Boundaries documented; no provider/agent/server implemented |

## Recommended next session

PS-009 is the next focused task. On a host that can start Chrome and serve
localhost, run `npm test`, `npm run build`, and `npm run test:browser`. Exercise
the served edition too, inspect desktop/mobile UI, verify all downloads and
record concrete browser evidence. Fix observed issues before closing browser
acceptance or claiming the restaurant-owner workflow is fully verified.

Then PS-010 improves short-menu composition without inventing a desktop
publishing engine. PS-011 addresses production metadata with upstream PSCat.
QR and template import remain dependency-/validation-gated. Fulfillment and
MCP are later adapters, not prerequisites for downloading a useful menu.
