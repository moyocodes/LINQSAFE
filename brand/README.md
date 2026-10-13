# Brand source files

The original logo artwork, kept out of `public/` so it isn't served to visitors.

| File | What it is |
| --- | --- |
| `LOGO TRANSPARENT.png` | The mark on its own, 2000×2000, transparent |
| `LINQSAFE 2.png` | Mark + wordmark, 1186×356, transparent |
| `LINQSAFE.png` | The same lock-up on a solid white background |

Everything the site uses is generated from these:

| Served file | Made from |
| --- | --- |
| `public/logo-mark.png` | `LOGO TRANSPARENT.png`, unchanged |
| `public/logo-wordmark.png` | `LINQSAFE 2.png`, unchanged (navy letters, for light backgrounds) |
| `public/logo-wordmark-dark.png` | the same with the navy letters recoloured cream, for dark backgrounds |
| `public/favicon-32.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | the mark, cropped to its ink and centred |
| `public/og-image.png` | `siteCardSvg()` in `server/og.js`, rendered by `npm run og-image` (then bump `OG_VERSION` in `server/seo.js`) |

The mark's ink sits in a 548×754 box at (726, 623) inside the 2000×2000 file; the code that crops it
(`src/components/QrCard.jsx`, `server/og.js`) refers to those numbers, so re-exporting the artwork at
a different size means updating them.
