import { Series, useCurrentFrame, useVideoConfig } from 'remotion'
import { BACKDROPS, type BackdropName } from '../player/backdrops'
import { At, HOME, Kinetic, NEON, Panel, Pill, Scene, cameraAt } from '../player/motion-kit'

export const SHOWCASE_SECONDS = 3

/** One backdrop with a sample panel and a slow camera move, so the parallax is visible. */
function Sample({ name }: { name: BackdropName }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = frame / fps
  const cam = cameraAt(t, [
    [0, { ...HOME, s: 1.08, x: 860 }],
    [0.2, { ...HOME, s: 1, x: 1060 }, 2.6],
  ])
  const info = BACKDROPS[name]
  return (
    <Scene t={t} camera={cam} backdrop={name}>
      <At x={960} y={470}>
        <Panel t={t} at={0.1} w={760} h={300} tone="blue">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
            <Kinetic t={t} at={0.3} text={info.label} size={70} />
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 30, color: NEON.muted }}>backdrop="{name}"</span>
          </div>
        </Panel>
      </At>
      <At x={960} y={720}>
        <Pill text={info.use} tone="sky" size={32} o={1} />
      </At>
    </Scene>
  )
}

export function BackdropShowcase() {
  const { fps } = useVideoConfig()
  return (
    <Series>
      {(Object.keys(BACKDROPS) as BackdropName[]).map((name) => (
        <Series.Sequence key={name} durationInFrames={SHOWCASE_SECONDS * fps}>
          <Sample name={name} />
        </Series.Sequence>
      ))}
    </Series>
  )
}
