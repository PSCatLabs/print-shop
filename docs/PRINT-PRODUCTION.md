# Print production and current preflight

The application exports vector proofs, not certified production PDFs. It must
not advertise general print readiness until a printer's requirements are
specified and verified. Printers differ on bleed, profiles and marks.

## Implemented geometry and checks

Menus use Letter (612 × 792 pt) or rounded A4 (595 × 842 pt), 42 pt side
margins, a reserved masthead/footer and a lower content boundary of 55 pt.
The background fills the media, with no extra bleed around the selected page.
For edge-to-edge paper color a printer needs a separate bleed workflow; white
stock with an unprinted background is a future palette improvement.

Cards use 252 × 144 pt trim (3.5 × 2 in), positioned 9 pt inside 270 × 162 pt
media (3.75 × 2.25 in). The 9 pt extension is 1/8 in bleed. Critical text uses
a 24 pt media inset, and bottom baselines are checked before export. PDF front
and back are separate pages with no imposition or duplex flipping assumption.

The PS layout refuses over-wide words, prices and names, over-tall items, card
contact overflow, oversized subtitles and more than 40 pages. UI data/schema
checks run before composition. Preflight checks are described below.

## Exporter findings at the pinned commit

| Requirement | Current behavior | Production consequence |
| --- | --- | --- |
| Vector geometry/type | Native path geometry; glyph outlines in SVG/PDF | Preserves shapes without embedding fonts; text is not searchable or accessible as text |
| PDF compatibility | Native PDF 1.4, valid streams/xref/page tree | Widely readable proof format, not a PDF/X guarantee |
| Color | Graphics reach the exporter as RGB; embedded images use DeviceRGB | PS `setcmykcolor` is not preserved as CMYK plates; no spot-color or separation contract |
| ICC/output intent | No output intent/profile API found | No certified color-managed press condition; consult the printer |
| Page boxes | MediaBox; no TrimBox/BleedBox in the serializer | Card trim is external instructions; geometric bleed alone is insufficient metadata |
| Crop marks | Not added by these templates/exporter | Requires an explicit press/finishing workflow; do not draw marks inside bleed |
| Bleed | Card background extends through bleed media; menus have none | Menu edge printing and provider-specific dimensions need follow-up |
| Transparency/gradients | PDF has transparency support; shading can use an average-color approximation | Current templates deliberately use flat inks and avoid that unsupported fidelity case |
| SVG | One native outlined vector file per page | Digital scaling works without external fonts; large menus have larger path payloads |
| PNG | Rasterized from the exact exported SVG at 300/72 scale | Selected page only; pixel count corresponds to 300 ppi, resolution metadata not guaranteed |

No SVG-to-PDF conversion or browser print dialog is used. SVG and PDF are native
recordings of the same paint events in one interpreter run.

## How preflight decides (PS-008)

`src/preflight.js` is a pure function used by the UI and future MCP adapters.
It **blocks** export (error findings; download buttons stay disabled) when:

- there is no completed SVG and PDF (`missing-render`);
- the engine reported any warning (`engine-warning`);
- a PDF MediaBox, SVG size or result size differs from the selected page or
  the 270 × 162 pt card media (`media-size`);
- the page or item count differs from the document, or a card is not exactly
  front and back (`content-count`);
- a menu item lies outside the measured layout area (`layout-bounds`).

Font substitution cannot reach preflight. PSCat's `findfont` silently falls
back for an unknown name (`/NoSuchFont` becomes Helvetica; `/Palatino-Roman`
becomes TeX Gyre Pagella) without a warning, so `ps-font` in
`templates/common.ps` compares the resolved `FontName` with the requested one
and fails the render with `printshop-font-substituted`. Every face the bundled
templates use resolves to itself; the check leaves output byte-identical.

It **warns** about RGB PDF 1.4 output without ICC output intent, CMYK
separation or PDF/X, and about missing TrimBox/BleedBox, crop marks and menu
bleed. It always ends with `proof-not-certified`: passing means a complete
proof ready for review, never certified print readiness
(`productionCertified` is always `false`). A test ("preflight claims match the
exported PDF bytes") checks each stated limitation against real exports: PDF
1.4 header, no font objects, no output intent/ICC/PDF/X identifiers, no
TrimBox/BleedBox, and only RGB color operators. If a future engine adds any
of these, that test fails until this text and the findings are updated.

## Printer requirements compared

PGprint's file-preparation guide (verified 2026-11-04) is a representative
commercial printer's specification:

| Requirement | PGprint | Printshop today |
| --- | --- | --- |
| Card size | 3.5 × 2 in finished size | 252 × 144 pt trim (3.5 × 2 in) |
| Bleed | "usually 1/8 inch"; extend color "at least .125 inches past your page size" | Card: 9 pt (1/8 in) on all sides. Menu: none |
| Safe area | 3.25 × 1.75 in "safe zone" (1/8 in inside trim) | Card text inside a 24 pt media inset, 15 pt inside trim |
| Marks | "save the file as a .PDF with crops and bleeds" | No crop marks; trim must be given as instructions |
| Color | Select colors "using CMYK definitions instead of RGB"; RGB must be converted | RGB only; preflight warns |

Ghostscript's PDF/X documentation (verified 2026-11-04) lists what a PDF/X
file needs and Printshop lacks: an output-intent definition
(`OutputConditionIdentifier`, optionally an ICC profile), Trim or Art boxes
"for all page descriptions", and Gray or CMYK color ("RGB is not allowed").
Preflight therefore never claims PDF/X. Upstream page boxes and color intent
are PS-011.

## Primary references

- [PGprint file preparation guidelines](https://www.pgprint.com/online-printing/downloads/PGPrint_FilePreparationGuidelines.pdf):
  bleed, safe zone, crop marks and CMYK for a 3.5 × 2 in card. Text extracted
  and checked 2026-11-04. Provider-specific templates still take precedence.
- [Ghostscript: creating a PDF/X document](https://ghostscript.readthedocs.io/en/latest/VectorDevices.html):
  output intent, required Trim/Art boxes and the RGB exclusion. Checked
  2026-11-04.

Further reading, cited by the original investigation. Adobe's help site
refuses automated fetches, so these were not re-checked on 2026-11-04:

- [Adobe PDF marks, bleeds and color output](https://helpx.adobe.com/illustrator/desktop/save-and-export/export-files-to-different-formats/pdf-marks-bleeds-and-color-output-options.html)
- [Adobe PDF settings](https://helpx.adobe.com/acrobat/desktop/create-documents/explore-advanced-conversion-settings/pdf-settings-overview.html)
- [Adobe output preview](https://helpx.adobe.com/acrobat/using/previewing-output-acrobat-pro.html)

Next work is PS-011 in `issues.json`: specify upstream page-box/output-intent
requirements, verify actual PDF metadata independently, and only then consider
an optional printer-specific production workflow.
