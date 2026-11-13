/**
 * QA contact sheets for one lesson: renders every video of the lesson, sampling a frame every `step` seconds plus the
 * last frame, then tiles them (with the timestamp) into out/qa/<slug>/<composition>.png for review.
 * Usage: node scripts/qa-stills.mjs <slug> [stepSeconds=2.5]
 */
import { bundle } from '@remotion/bundler'
import { getCompositions, renderStill } from '@remotion/renderer'
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

// Tiles the frames 3 per row, each labelled with its time, at 640×360.
const SHEET = `
import sys, glob, os
from PIL import Image, ImageDraw
d, out, fps = sys.argv[1], sys.argv[2], int(sys.argv[3])
fs = sorted(glob.glob(d + '/*.png'))
W, H = 640, 360
S = Image.new('RGB', (W * 3, (H + 26) * ((len(fs) + 2) // 3)), (0, 0, 0))
dr = ImageDraw.Draw(S)
for i, f in enumerate(fs):
    x, y = (i % 3) * W, (i // 3) * (H + 26)
    S.paste(Image.open(f).convert('RGB').resize((W, H)), (x, y + 26))
    dr.text((x + 6, y + 6), 't=%.1fs  frame %s' % (int(os.path.basename(f)[:-4]) / fps, os.path.basename(f)[:-4]), fill=(255, 255, 0))
S.save(out)
`

const [, , slug, stepArg] = process.argv
if (!slug) {
  console.error('Usage: node scripts/qa-stills.mjs <slug> [stepSeconds]')
  process.exit(1)
}
const step = Number(stepArg ?? 2.5)
const serveUrl = await bundle({ entryPoint: 'src/remotion/index.ts' })
const comps = (await getCompositions(serveUrl)).filter((c) => c.id.startsWith(`${slug}--`))
if (!comps.length) {
  console.error(`No compositions for ${slug}`)
  process.exit(1)
}
for (const c of comps) {
  const dir = `out/qa/${slug}/${c.id}`
  mkdirSync(dir, { recursive: true })
  const frames = []
  for (let f = Math.round(step * c.fps * 0.6); f < c.durationInFrames - 1; f += Math.round(step * c.fps)) frames.push(f)
  frames.push(c.durationInFrames - 1)
  for (const f of frames) await renderStill({ serveUrl, composition: c, frame: f, output: `${dir}/${String(f).padStart(5, '0')}.png`, inputProps: c.defaultProps, scale: 0.5 })
  execFileSync('python3', ['-c', SHEET, dir, `out/qa/${slug}/${c.id}.png`, String(c.fps)])
  console.log(`out/qa/${slug}/${c.id}.png (${frames.length} frames)`)
}
