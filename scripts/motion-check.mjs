/**
 * Motion smoothness check for one lesson. Renders every video of the lesson as a small silent MP4 (subtitle band
 * excluded from the measurement), measures how much each frame differs from the previous one, and flags "pops": a frame whose
 * change is far larger than the frames around it (an element jumping, a layout snapping, a hard cut mid-scene).
 * Smooth animation spreads change over many frames, so it never spikes. Cross-fades between scenes are spread over
 * 15 frames and are not flagged.
 *
 * Output: out/motion/<slug>/report.json, out/motion/<slug>/report.txt and, per pop, a before/after strip PNG.
 * Usage: node scripts/motion-check.mjs <slug>
 */
import { bundle } from '@remotion/bundler'
import { getCompositions, renderMedia } from '@remotion/renderer'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

const ANALYSE = `
import sys, json, subprocess, numpy as np
from PIL import Image
mp4, outdir, cid = sys.argv[1], sys.argv[2], sys.argv[3]
W, H = 192, 108
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', mp4, '-vf', f'scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
frames = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32)
# the bottom band holds the burned-in subtitle, which legitimately switches text instantly: measure the picture only
frames = frames[:, : int(H * 0.84)]
d = np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2, 3))  # d[i] = change from frame i to i+1
pops = []
for i in range(len(d)):
    lo, hi = max(0, i - 6), min(len(d), i + 7)
    around = np.concatenate([d[lo:i], d[i + 1:hi]])
    base = float(np.median(around)) if len(around) else 0.0
    # x264 inserts a keyframe every 250 frames; the quality step there is an encoding artefact, not animation
    if (i + 1) % 250 == 0:
        continue
    if d[i] > 2.0 and d[i] > 5 * base + 0.8:
        pops.append({'frame': i + 1, 'time': round((i + 1) / 30, 2), 'change': round(float(d[i]), 2), 'typical': round(base, 2)})
# merge pops closer than 3 frames
merged = []
for p in pops:
    if merged and p['frame'] - merged[-1]['frame'] < 3:
        if p['change'] > merged[-1]['change']:
            merged[-1] = p
    else:
        merged.append(p)
for p in merged:
    i = p['frame']
    a = Image.fromarray(np.asarray(frames[i - 1], np.uint8)).resize((480, 270))
    b = Image.fromarray(np.asarray(frames[i], np.uint8)).resize((480, 270))
    s = Image.new('RGB', (960, 270)); s.paste(a, (0, 0)); s.paste(b, (480, 0))
    s.save(f"{outdir}/{cid}-pop-{i:05d}.png")
print(json.dumps({'id': cid, 'frames': int(len(frames)), 'meanChange': round(float(d.mean()), 3), 'pops': merged}))
`

const [, , slug] = process.argv
if (!slug) {
  console.error('Usage: node scripts/motion-check.mjs <slug>')
  process.exit(1)
}
const dir = `out/motion/${slug}`
mkdirSync(dir, { recursive: true })
const serveUrl = await bundle({ entryPoint: 'src/remotion/index.ts' })
const comps = (await getCompositions(serveUrl)).filter((c) => c.id.startsWith(`${slug}--`))
const results = []
for (const c of comps) {
  const mp4 = `${dir}/${c.id}.mp4`
  await renderMedia({ serveUrl, composition: c, codec: 'h264', outputLocation: mp4, inputProps: c.defaultProps, scale: 0.25, muted: true, crf: 28 })
  const r = JSON.parse(execFileSync('python3', ['-c', ANALYSE, mp4, dir, c.id]).toString())
  results.push(r)
  console.log(`${c.id}: ${r.frames} frames, ${r.pops.length} pop(s)${r.pops.length ? ' at ' + r.pops.map((p) => p.time + 's').join(', ') : ''}`)
}
writeFileSync(`${dir}/report.json`, JSON.stringify(results, null, 2))
writeFileSync(
  `${dir}/report.txt`,
  results.map((r) => `${r.id}  frames=${r.frames}  mean=${r.meanChange}  pops=${r.pops.map((p) => `${p.time}s(${p.change} vs ${p.typical})`).join(' ') || 'none'}`).join('\n') + '\n',
)
