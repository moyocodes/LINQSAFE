# Site media

Drop these files here (exact names). Anything missing falls back to a brand gradient.

| File | Used on | Size / format |
|---|---|---|
| `contact.jpg` | Contact page, photo beside the form | 1200×1500 (4:5) JPG, under 300 KB |
| `dashboard-loop.mp4` (made from ribbon_loop_slow.gif) | Dashboard background, plays muted on loop at 40% under a wash | 1920×1080, 6–10 s seamless loop, H.264, no audio, under 4 MB |
| `dashboard-poster.jpg` | First frame of the video; shown while it loads and to people with reduced motion | 1920×1080 JPG, under 250 KB |

Compress the video: `ffmpeg -i in.mp4 -an -vf scale=1920:-2 -c:v libx264 -crf 28 -preset slow -movflags +faststart dashboard-loop.mp4`
Poster from the video: `ffmpeg -i dashboard-loop.mp4 -frames:v 1 -q:v 4 dashboard-poster.jpg`

Palette to keep in prompts: paper #F6F3EE, espresso #261F1C, cobalt #2B4FAF, coral #F2A07E, teal #6CC3BA, sand #E5D2BD, saffron #D99A2B.
