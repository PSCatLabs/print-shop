# Distributed dependency notices

Printshop distributes the unmodified pscat release pinned in
`../engine/provenance.json` (the npm package tarball attached to the
PSCatLabs/pscat GitHub release, verified by SHA-256). Its JavaScript and WASM
are installed unchanged by `scripts/fetch-engine.mjs`. The WASM core code is
MIT OR Apache-2.0; compiled-in font/library assets additionally carry OFL-1.1
and LPPL-1.3c/GUST terms.

- `LICENSE-MIT`, `LICENSE-APACHE`: upstream core license texts.
- `LICENSE-OFL`, `FONTS-LICENSE`, `URW-LICENSE.OFL`, `URW-LICENSE.md`,
  `URW-PROVENANCE.md`: font terms and notices.
- `GUST-FONT-LICENSE.txt`: TeX Gyre terms.
- `THIRD_PARTY_NOTICES.md`: unchanged upstream copyright/component inventory.
  Repository-relative links in that document refer to the upstream PSCat tree.
- `LICENSE-CC0`: upstream public-domain dedication for example materials.

Every file above except `LICENSE-CC0` is byte-identical to the package's copy
at the pin (`fonts/LICENSE` is `FONTS-LICENSE`; the `fonts/base35/URW-symbols/`
files are the `URW-*` ones; TeX Gyre's `GUST-FONT-LICENSE.txt` is the same for
every face). The complete generated dependency license texts are the
package's own `THIRD_PARTY_LICENSES.html`, installed with the engine at
`../engine/THIRD_PARTY_LICENSES.html` and shipped beside the WASM.

Upstream: https://github.com/PSCatLabs/pscat/releases/tag/v0.7.0-rc.4
(commit df39114f1223cf475c0c2350c47d7475274c72ee)

Printshop's original UI, templates and application code use the root MIT
license. Redistribution of the WASM must retain its additional notices.
