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
| 3 | First complete menu template | PS-003 | Classic Bistro verified in WASM and desktop/mobile Chrome |
| 4 | Deterministic layout and pagination | PS-004, PS-010 | Measured flow implemented; balancing/look-ahead follow-up |
| 5 | Additional visual templates | PS-005 | All three verified in desktop/mobile Chrome |
| 6 | SVG/PDF export | PS-006, PS-009 | Offline browser exports pass; served-site verification remains open |
| 7 | Business-card support | PS-007, PS-013 | Two-sided card passes browser tests; upstream QR dependency pending |
| 8 | Print preflight and production readiness | PS-008, PS-011 | Basic preflight; advanced exporter requirements open |
| 9 | Future fulfillment and MCP integration | PS-014, PS-015 | Boundaries documented; no provider/agent/server implemented |

## Recommended next session

PS-009's offline acceptance now passes: nine checks in both desktop Chrome and
a 390 px mobile viewport. JSON reports are in `verification/`. The initial
module-worker startup failure and async example-load feedback were fixed;
the packaged classic worker also executes actual WASM in the automated suite.
The remaining PS-009 task is the served edition and headless CLI runner on a
host with normal localhost/process permissions. GitHub publication also still
requires functioning terminal access. Do not close the complete issue solely
from the offline results.

Then PS-010 improves short-menu composition without inventing a desktop
publishing engine. PS-011 addresses production metadata with upstream PSCat.
QR and template import remain dependency-/validation-gated. Fulfillment and
MCP are later adapters, not prerequisites for downloading a useful menu.
