# Distributed dependency notices

Printshop distributes PSCat at the exact source commit in
`../engine/provenance.json`, plus the vector ABI patch in the application
repository. The JavaScript wrapper is copied unchanged. The WASM core code is
MIT OR Apache-2.0; compiled-in font/library assets additionally carry OFL-1.1
and LPPL-1.3c/GUST terms.

- `LICENSE-MIT`, `LICENSE-APACHE`: upstream core license texts.
- `LICENSE-OFL`, `FONTS-LICENSE`, `URW-LICENSE.OFL`, `URW-LICENSE.md`,
  `URW-PROVENANCE.md`: font terms and notices.
- `GUST-FONT-LICENSE.txt`: TeX Gyre terms.
- `THIRD_PARTY_NOTICES.md`: unchanged upstream copyright/component inventory.
  Repository-relative links in that document refer to the upstream PSCat tree.
- `wasm-dependency-licenses.html`: complete generated dependency license texts
  from the pinned functional studio, whose dependency set is unchanged by the
  vector bridge.
- `LICENSE-CC0`: upstream public-domain dedication for example materials.

Upstream: https://github.com/PSCatLabs/pscat/tree/e8d6cf29a3e9ae62390a834961df2fdb58c7d78e

Printshop's original UI, templates and application code use the root MIT
license. Redistribution of the WASM must retain its additional notices.
