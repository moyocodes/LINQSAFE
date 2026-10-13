// Renders public/og-image.png, the site-wide link preview, from siteCardSvg() in server/og.js.
// Run after changing that design or the logo:  npm run og-image
// Then bump OG_VERSION in server/seo.js so X, WhatsApp and the rest fetch the new picture.
import fs from 'node:fs'
import { siteCardSvg, renderPng } from '../server/og.js'

fs.writeFileSync(new URL('../public/og-image.png', import.meta.url), renderPng(siteCardSvg()))
console.log('Wrote public/og-image.png')
