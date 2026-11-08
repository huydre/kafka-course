/**
 * Render a few frames of one video to PNG (half size) to eyeball layout and camera moves.
 * Usage: node scripts/render-stills.mjs <composition-id> <frame> [frame...]
 *   e.g. node scripts/render-stills.mjs key-partition--hash-key 138 276
 * Output: out/frames/<id>-<frame>.png  (the bundle is built once for all frames)
 */
import { bundle } from '@remotion/bundler'
import { renderStill, selectComposition } from '@remotion/renderer'

const [, , id, ...frames] = process.argv
if (!id || !frames.length) {
  console.error('Usage: node scripts/render-stills.mjs <composition-id> <frame> [frame...]')
  process.exit(1)
}
const serveUrl = await bundle({ entryPoint: 'src/remotion/index.ts' })
const composition = await selectComposition({ serveUrl, id })
for (const f of frames) {
  const output = `out/frames/${id}-${f}.png`
  await renderStill({ serveUrl, composition, frame: Number(f), output, inputProps: composition.defaultProps, scale: 0.5 })
  console.log(output)
}
