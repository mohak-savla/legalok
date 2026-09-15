/**
 * Word-compatible HTML wrapper for the legacy "Download DOC" endpoint.
 *
 * The endpoint used to send the raw body fragment with Content-Type
 * application/msword. Word then opened it with US-Letter defaults, no
 * heading styling and no line-height — producing "huge margins, heading
 * not centered, 2 pages" that never matched the PDF/DOCX exporters.
 *
 * This wraps the fragment in a full Word HTML document whose @page geometry
 * and typography mirror docx.service.ts + pdf.service.ts exactly:
 *   A4, 56pt margins · Georgia 11pt justified · line 20.4pt (1.7×, at-least)
 *   h1 17pt centered after 20pt · h2 13pt before 14pt/after 8pt · h3 11.5pt
 *   .sig-block 30pt gap · .sig-typed Segoe Script 24pt · .sig-label 8pt gray
 */
const PAGE_CSS = `
@page WordSection1 {
  size: 595.35pt 841.95pt;
  margin: 56pt 56pt 56pt 56pt;
  mso-page-orientation: portrait;
}
div.WordSection1 { page: WordSection1; }
body { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; color: #111827; }
p { margin: 0 0 6pt 0; text-align: justify; line-height: 20.4pt; mso-line-height-rule: at-least; }
h1 { font-size: 17pt; font-weight: bold; color: #111827; text-align: center; text-transform: uppercase;
     margin: 0 0 20pt 0; line-height: 28.9pt; mso-line-height-rule: exactly; }
h2 { font-size: 13pt; font-weight: bold; color: #111827; text-align: left;
     margin: 14pt 0 8pt 0; line-height: 22.1pt; mso-line-height-rule: exactly; }
h3 { font-size: 11.5pt; font-weight: bold; color: #111827; text-align: left;
     margin: 12pt 0 6pt 0; line-height: 19.6pt; mso-line-height-rule: exactly; }
h4, h5, h6 { font-weight: bold; color: #111827; text-align: left; margin: 10pt 0 5pt 0; }
ul, ol { margin: 0 0 6pt 0; padding-left: 24pt; }
li { margin: 0 0 4pt 0; line-height: 20.4pt; mso-line-height-rule: at-least; }
table { border-collapse: collapse; width: 100%; margin: 0 0 6pt 0; }
th, td { border: 1px solid #cccccc; padding: 4pt 6pt; font-size: 11pt; text-align: left; }
th { font-weight: bold; }
blockquote { margin: 8pt 0 8pt 20pt; font-style: italic; color: #374151; }
img { max-width: 100%; }
hr { border: none; border-top: 1px solid #cccccc; margin: 10pt 0; }
a { color: #1D4ED8; }
/* Signature blocks — mirror the website/DOCX/PDF look */
div.sig-block { margin-top: 30pt; }
div.sig-execution { margin-top: 30pt; }
div.sig-typed { font-family: 'Segoe Script', 'Brush Script MT', cursive; font-size: 24pt; color: #111827; }
div.sig-label { font-size: 8pt; color: #6B7280; text-transform: uppercase; letter-spacing: 1pt; }
div.sig-line { border-bottom: 1px solid #111827; }
`;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Wrap a rendered document body fragment into a complete Word HTML (.doc) file */
export function renderWordHtml(bodyHtml: string, title: string): string {
  const safeTitle = escapeHtml(title || 'Document');
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="Legalok">
<title>${safeTitle}</title>
<!--[if gte mso 9]><xml>
<w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument>
</xml><![endif]-->
<style>${PAGE_CSS}</style>
</head>
<body>
<div class="WordSection1">
${bodyHtml}
</div>
</body>
</html>`;
}
