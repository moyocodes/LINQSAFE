import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Download, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SITE } from '@/config'

const INK = '#261F1C'
const COBALT = '#2B4FAF'
const LOGO = { tile: '#2B4FAF', a: '#F2D29A', b: '#F2A07E', c: '#6CC3BA' }

// The hub mark (same shapes as LogoMark) drawn onto a canvas at (x, y), `size` px square.
function drawLogo(ctx, x, y, size) {
  const s = size / 64
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.fillStyle = LOGO.tile
  ctx.beginPath(); ctx.roundRect(0, 0, 64, 64, 16); ctx.fill()
  const g = ctx.createLinearGradient(0, 0, 64, 64)
  g.addColorStop(0, LOGO.a); g.addColorStop(1, LOGO.b)
  ctx.strokeStyle = g; ctx.lineWidth = 4; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(32, 34); ctx.lineTo(32, 16); ctx.moveTo(32, 34); ctx.lineTo(17, 44); ctx.moveTo(32, 34); ctx.lineTo(47, 44); ctx.stroke()
  const dot = (cx, cy, r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill() }
  dot(32, 34, 7, g); dot(32, 14, 5, LOGO.a); dot(15, 45, 5, LOGO.c); dot(49, 45, 5, LOGO.a)
  ctx.restore()
}

// A printable card: the code with the logo in its centre, the site's wordmark under it and the
// username small and quiet. High error correction keeps it scannable with the logo covering the middle.
async function renderCard(url, username) {
  await document.fonts?.ready
  const W = 1080, H = 1320, pad = 90, qr = W - pad * 2
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#FCFAF8'
  ctx.beginPath(); ctx.roundRect(0, 0, W, H, 64); ctx.fill()

  const code = document.createElement('canvas')
  await QRCode.toCanvas(code, url, { width: qr, margin: 0, errorCorrectionLevel: 'H', color: { dark: INK, light: '#FCFAF8' } })
  ctx.drawImage(code, pad, pad, qr, qr)

  // Logo in the middle, on a paper-coloured pad so the modules around it stay clean.
  const logo = Math.round(qr * 0.2), lx = (W - logo) / 2, ly = pad + (qr - logo) / 2
  ctx.fillStyle = '#FCFAF8'
  ctx.beginPath(); ctx.roundRect(lx - 18, ly - 18, logo + 36, logo + 36, 36); ctx.fill()
  drawLogo(ctx, lx, ly, logo)

  // Wordmark "linqsafe." with the cobalt full stop, then the username, low-key.
  const base = pad + qr + 120
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  ctx.font = '800 76px "DM Sans", system-ui, sans-serif'
  const word = SITE.name, dotW = ctx.measureText('.').width, wordW = ctx.measureText(word).width
  const startX = (W - wordW - dotW) / 2
  ctx.fillStyle = INK; ctx.fillText(word, startX, base)
  ctx.fillStyle = COBALT; ctx.fillText('.', startX + wordW, base)
  ctx.textAlign = 'center'
  ctx.font = '500 34px "IBM Plex Mono", ui-monospace, monospace'
  ctx.fillStyle = 'rgba(38,31,28,.45)'
  ctx.fillText(`@${username}`, W / 2, base + 64)

  return canvas.toDataURL('image/png')
}

// "Scan to connect" code for flyers, business cards and story posts.
export default function QrCard({ url, username }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    // ?src=qr lets analytics count scans separately from other visits.
    renderCard(`${url}?src=qr`, username).then(setSrc).catch(() => setSrc(''))
  }, [url, username])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><QrCode className="size-5" aria-hidden="true" /> QR code</CardTitle>
        <CardDescription>Print it or post it so people can scan straight to your page.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-5">
        {src && <img src={src} alt={`QR code linking to ${url}`} className="w-40 rounded-2xl border shadow-sm" />}
        <Button asChild variant="outline" disabled={!src}>
          <a href={src} download={`${username}-qr.png`}><Download /> Download PNG</a>
        </Button>
      </CardContent>
    </Card>
  )
}
