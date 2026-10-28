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
checks run before composition. Preflight validates completed result presence,
item/page counts, measured menu bounds and font substitution warnings.

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

## Primary references

- [Adobe PDF marks, bleeds and color output](https://helpx.adobe.com/illustrator/desktop/save-and-export/export-files-to-different-formats/pdf-marks-bleeds-and-color-output-options.html)
  documents trim marks, a typical 0.125 in bleed and PDF/X output-intent settings.
- [Adobe PDF settings](https://helpx.adobe.com/acrobat/desktop/create-documents/explore-advanced-conversion-settings/pdf-settings-overview.html)
  explains that output intent identifies the intended printing condition for
  PDF/X compliance, along with trim/bleed box settings.
- [Adobe output preview](https://helpx.adobe.com/acrobat/using/previewing-output-acrobat-pro.html)
  describes color warnings, separations and page-box inspection. A visual
  screen proof alone does not validate every printing/finishing setting.
- [PGprint file preparation](https://www.pgprint.com/online-printing/downloads/PGPrint_FilePreparationGuidelines.pdf)
  gives a printer's example of 3.5 × 2 in cards, extra bleed and a safe design
  area. Provider-specific templates still take precedence.

Next work is PS-011 in `issues.json`: specify upstream page-box/output-intent
requirements, verify actual PDF metadata independently, and only then consider
an optional printer-specific production workflow.
