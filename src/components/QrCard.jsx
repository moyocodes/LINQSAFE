import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Download, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// "Scan to connect" code for flyers, business cards and story posts.
export default function QrCard({ url, username }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    // ?src=qr lets analytics count scans separately from other visits.
    QRCode.toDataURL(`${url}?src=qr`, { width: 640, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#2a201c', light: '#ffffff' } })
      .then(setSrc).catch(() => setSrc(''))
  }, [url])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><QrCode className="size-5" aria-hidden="true" /> QR code</CardTitle>
        <CardDescription>Print it or post it so people can scan straight to your page.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-5">
        {src && <img src={src} alt={`QR code linking to ${url}`} className="size-36 rounded-xl border bg-white p-1" />}
        <Button asChild variant="outline" disabled={!src}>
          <a href={src} download={`${username}-qr.png`}><Download /> Download PNG</a>
        </Button>
      </CardContent>
    </Card>
  )
}
