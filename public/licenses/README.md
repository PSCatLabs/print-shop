# Distributed dependency notices

Printshop distributes unmodified PSCat at the exact source commit in
`../engine/provenance.json`. The JavaScript wrapper is copied unchanged. The WASM core code is
MIT OR Apache-2.0; compiled-in font/library assets additionally carry OFL-1.1
and LPPL-1.3c/GUST terms.

- `LICENSE-MIT`, `LICENSE-APACHE`: upstream core license texts.
- `LICENSE-OFL`, `FONTS-LICENSE`, `URW-LICENSE.OFL`, `URW-LICENSE.md`,
  `URW-PROVENANCE.md`: font terms and notices.
- `GUST-FONT-LICENSE.txt`: TeX Gyre terms.
- `THIRD_PARTY_NOTICES.md`: unchanged upstream copyright/component inventory.
  Repository-relative links in that document refer to the upstream PSCat tree.
- `wasm-dependency-licenses.html`: complete generated dependency license texts
  originally from the functional studio. The WASM build's dependency tree at the
  current pin (`cargo tree --target wasm32-unknown-unknown --no-default-features`)
  is the same 32 crates, so the texts still apply. Every other file here is
  byte-identical to its upstream copy at the pin.
- `LICENSE-CC0`: upstream public-domain dedication for example materials.

Upstream: https://github.com/PSCatLabs/pscat/tree/db44e121123ceb737f70daffd34c0a6853dc37a1

Printshop's original UI, templates and application code use the root MIT
license. Redistribution of the WASM must retain its additional notices.
