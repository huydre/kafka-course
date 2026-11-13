import type { ReactNode } from 'react'
import { cameraAt, clamp, lerp, move, sp, span, vis } from '../player/motion-kit'
import { ConsumerUnit, HERO, Icon3D, LogTape, Note, Packets, Rise, SOFT, SOFT_PANEL, ServerUnit, SoftScene, SoftTheme, Statement, SummaryList, Wire, type Icon3DName } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene, SceneSfx } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { partitionCountScript } from './partition-count-script'

/** This lesson is drawn in the navy glow style. */
const INK = SOFT
const panel = SOFT_PANEL
const WIDE = { x: 960, y: 540, s: 1 }
const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN')
/** Counters change at most 6 times per second so the motion-blurred export stays readable. */
const snap = (t: number) => Math.floor(t * 6) / 6
const TABULAR = { fontVariantNumeric: 'tabular-nums' } as const
const HERO_SHADOW = '0 0 34px rgba(77,141,255,0.6), 0 24px 50px rgba(0,4,30,0.6), inset 0 2px 0 rgba(255,255,255,0.5), inset 0 -8px 16px rgba(0,10,60,0.35)'

/** Blend two #rrggbb colours (k = 0 gives a, 1 gives b): state changes glide instead of snapping. */
const rgb = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
const mix = (a: string, b: string, k: number) => {
  const x = rgb(a)
  const y = rgb(b)
  return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], clamp(k)))).join(',')})`
}

/** Two values stacked in one slot; `m` 0 to 1 cross-fades from a to b (text that changes at a narrated moment). */
function Cross({ a, b, m, w, align = 'center' }: { a: ReactNode; b: ReactNode; m: number; w: number; align?: 'left' | 'center' | 'right' }) {
  const layer = { position: 'absolute', left: 0, right: 0, top: 0, textAlign: align, whiteSpace: 'nowrap' } as const
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: w, height: '1.2em', lineHeight: 1.2, verticalAlign: 'middle' }}>
      <span style={{ ...layer, opacity: 1 - clamp(m) }}>{a}</span>
      <span style={{ ...layer, opacity: clamp(m) }}>{b}</span>
    </span>
  )
}

/** Offset ticks are under 24px in the kit, so the tapes here print none (the kit only renders the returned value as text). */
const NO_OFFSET = (() => '') as unknown as (i: number) => number

/** One partition: label P{p} and a tape of equal cells, the newest message glowing at the end. */
function Tape({ x, y, p, cells, cellW }: { x: number; y: number; p: number; cells: number; cellW: number }) {
  return (
    <div>
      <div style={{ position: 'absolute', left: x - 62, top: y + 16, fontSize: 30, fontWeight: 700, color: INK.text }}>P{p}</div>
      <LogTape x={x} y={y} cells={cells} cellW={cellW} state={(i) => (i < cells - 1 ? 'filled' : 'new')} offsetOf={NO_OFFSET} />
    </div>
  )
}

/** A label + value card in the soft style; `hot` (0..1) glides its outline and value to the warning colour. */
function Stat({ x, y, w, h, title, hot = 0, children }: { x: number; y: number; w: number; h: number; title: string; hot?: number; children: ReactNode }) {
  return (
    <div style={{ ...INK.card, position: 'absolute', left: x, top: y, width: w, height: h, boxSizing: 'border-box', padding: '18px 28px', border: `1.5px solid ${mix('#6ea0ff', INK.bad, hot)}`, boxShadow: `0 0 ${12 + 30 * hot}px rgba(${hot > 0 ? '255,90,106' : '61,123,255'},${0.35 + 0.35 * hot}), 0 24px 50px rgba(0,4,30,0.55), inset 0 1px 0 rgba(255,255,255,0.18)` }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: INK.faint, whiteSpace: 'nowrap' }}>{title}</div>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ 0. cold open: 2am incident */

const HOOK_ROW = (p: number) => 170 + p * 135

function hook(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const scaleAt = a1 + 1.0
  // Lag keeps climbing; after scaling out it only bends slightly, it never comes down.
  const lagAt = (x: number) => 1_750_000 + x * 160_000 - (x > scaleAt ? (x - scaleAt) * 25_000 : 0)
  const lag = Math.round(lagAt(snap(t)) / 1000) * 1000
  const hot = span(lagAt(t), 1_900_000, 2_050_000)
  const swap = span(t, scaleAt, scaleAt + 0.4)
  const W = 720
  const H = 330
  const shown = Math.min(t, c.duration)
  const pts = Array.from({ length: 60 }, (_, i) => {
    const x = (i / 59) * shown
    return [(x / c.duration) * W, H - clamp((lagAt(x) - 1_600_000) / 8000, 0, H)] as const
  })
  const head = pts[pts.length - 1]
  const focus = span(t, a2 + 0.2, a2 + 0.6)
  const TX = 1000
  const UX = 1290
  const rowT = (p: number) => a0 + 1.6 + p * 0.15
  return (
    <SoftScene
      t={t}
      camera={cameraAt(t, [
        [0, { x: 740, y: 420, s: 1.3 }],
        [a0 + 1.2, WIDE, 1.6],
        [a2, { x: 1000, y: 540, s: 1.04 }, 1.3],
      ])}
    >
      <Rise t={t} at={0.3}>
        <Stat x={100} y={130} w={520} h={250} title="CONSUMER LAG" hot={hot}>
          <div style={{ marginTop: 14, fontSize: 76, fontWeight: 800, letterSpacing: -1, whiteSpace: 'nowrap', color: mix('#ffffff', INK.bad, hot), ...TABULAR }}>{fmt(lag)}</div>
          <div style={{ marginTop: 6, fontSize: 26, fontWeight: 600, color: INK.faint }}>tin chưa đọc</div>
        </Stat>
      </Rise>
      <Icon3D name="bell" x={560} y={168} size={104} t={t} at={1.5} />
      <Rise t={t} at={a0 + 0.8}>
        <Stat x={640} y={130} w={260} h={250} title="CONSUMER">
          <div style={{ marginTop: 14, fontSize: 110, fontWeight: 800, color: INK.text, ...TABULAR, textAlign: 'center' }}>
            <Cross a="6" b={<span style={{ color: INK.warn }}>10</span>} m={swap} w={150} />
          </div>
        </Stat>
      </Rise>
      <Rise t={t} at={1.0}>
        <div style={{ ...INK.card, position: 'absolute', left: 100, top: 410, width: 800, height: 480 }}>
          <div style={{ position: 'absolute', left: 28, top: 20, fontSize: 26, fontWeight: 700, color: INK.faint }}>lag theo thời gian</div>
          <svg width={W + 20} height={H + 20} style={{ position: 'absolute', left: 40, top: 100, overflow: 'visible' }}>
            <line x1={0} y1={H} x2={W} y2={H} stroke={INK.line} strokeWidth={2} />
            <line x1={0} y1={H - 50} x2={W} y2={H - 50} stroke={INK.warn} strokeWidth={2} strokeDasharray="10 10" opacity={0.8} />
            <text x={W} y={H - 62} textAnchor="end" fontFamily="Be Vietnam Pro, sans-serif" fontWeight={700} fontSize={26} fill={INK.warn}>
              2.000.000
            </text>
            <line x1={(scaleAt / c.duration) * W} y1={0} x2={(scaleAt / c.duration) * W} y2={H} stroke={INK.accent} strokeWidth={2} strokeDasharray="6 8" opacity={vis(t, scaleAt)} />
            <text x={(scaleAt / c.duration) * W - 12} y={30} textAnchor="end" fontFamily="Be Vietnam Pro, sans-serif" fontWeight={700} fontSize={26} fill={INK.accent} opacity={vis(t, scaleAt)}>
              thêm consumer
            </text>
            <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={INK.bad} strokeWidth={5} strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 8px ${INK.bad})` }} />
            <circle cx={head[0]} cy={head[1]} r={9} fill={INK.bad} style={{ filter: `drop-shadow(0 0 8px ${INK.bad})` }} />
          </svg>
        </div>
      </Rise>
      <div style={{ ...panel, left: 100, top: 925, fontFamily: MONO, fontSize: 28, fontWeight: 600, whiteSpace: 'nowrap', opacity: vis(t, a1 + 0.1) }}>
        <span style={{ color: INK.faint }}>$ </span>kubectl scale --replicas=<span style={{ color: INK.warn }}>10</span>
      </div>

      <div style={{ position: 'absolute', left: 940, top: 96, fontSize: 30, fontWeight: 800, whiteSpace: 'nowrap', color: mix(INK.faint, INK.warn, focus), opacity: vis(t, a0 + 1.4) }}>topic payments · 6 partition</div>
      <div style={{ position: 'absolute', left: 925, top: 150, width: 255, height: 810, borderRadius: 28, border: `3px solid ${INK.warn}`, boxShadow: `0 0 26px ${INK.warn}88`, opacity: focus }} />
      {[0, 1, 2, 3, 4, 5].map((p) => (
        <div key={p}>
          <Rise t={t} at={rowT(p)}>
            <Tape x={TX} y={HOOK_ROW(p)} p={p} cells={3} cellW={50} />
          </Rise>
          <Wire from={{ x: TX + 160, y: HOOK_ROW(p) + 35 }} to={{ x: UX - 14, y: HOOK_ROW(p) + 35 }} color={INK.line} p={move(t, rowT(p) + 0.3, 0.45)} flow={t} />
          <Packets t={t} from={{ x: TX + 160, y: HOOK_ROW(p) + 35 }} to={{ x: UX - 14, y: HOOK_ROW(p) + 35 }} start={rowT(p) + 0.7} every={0.5} len={0.8} size={18} />
          <Rise t={t} at={rowT(p) + 0.2}>
            <ConsumerUnit x={UX} y={HOOK_ROW(p) - 24} w={270} name={`C${p + 1}`} parts={[`P${p}`]} t={t} busy={(t * 1.3 + p * 0.17) % 1} />
          </Rise>
        </div>
      ))}
      {[0, 1, 2, 3].map((k) => (
        <Rise key={k} t={t} at={scaleAt + 0.2 + k * 0.25}>
          <ConsumerUnit x={1580} y={HOOK_ROW(k) - 24} w={310} name={`C${k + 7}`} idle t={t} />
        </Rise>
      ))}
      <Statement x={940} y={966} text="thủ phạm: số partition = 6" color={INK.warn} size={42} o={sp(t, a2 + 0.8)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 1. partitions = the ceiling on parallelism */

function parallel(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const TX = 260
  const CW = 60
  const CELLS = 7
  const END = TX + CELLS * CW + 16
  const UX = 1000
  const row = (p: number) => 190 + p * 135
  const uy = (k: number) => 166 + k * 135
  const wireAt = (p: number) => a0 + 1.3 + p * 0.15
  const idleAt = (k: number) => a1 + 2.2 + (k - 4) * 0.4
  return (
    <SoftScene
      t={t}
      camera={cameraAt(t, [
        [0, { x: 960, y: 520, s: 1.04 }],
        [a0 + 1.2, { x: 1000, y: 450, s: 1.1 }, 1.3],
        [a1, { x: 960, y: 640, s: 1.07 }, 1.3],
        [a2, WIDE, 1.3],
      ])}
    >
      <div style={{ position: 'absolute', left: TX, top: 134, fontSize: 26, fontWeight: 700, color: INK.faint, opacity: vis(t, a0) }}>topic · 4 partition</div>
      <div style={{ position: 'absolute', left: UX, top: 110, fontSize: 26, fontWeight: 700, color: INK.faint, opacity: vis(t, a0 + 0.8) }}>nhóm consumer</div>
      {[0, 1, 2, 3].map((p) => (
        <div key={p}>
          <Rise t={t} at={a0 + 0.1 + p * 0.15}>
            <Tape x={TX} y={row(p)} p={p} cells={CELLS} cellW={CW} />
          </Rise>
          <Wire from={{ x: END, y: row(p) + 35 }} to={{ x: UX - 14, y: row(p) + 35 }} color={INK.line} p={move(t, wireAt(p), 0.5)} flow={t} />
          <Packets t={t} from={{ x: END, y: row(p) + 35 }} to={{ x: UX - 14, y: row(p) + 35 }} start={wireAt(p) + 0.4} every={0.5} len={0.8} size={18} />
          <Rise t={t} at={a0 + 0.9 + p * 0.2}>
            <ConsumerUnit x={UX} y={uy(p)} w={380} name={`C${p + 1}`} parts={[`P${p}`]} t={t} busy={(t * 1.2 + p * 0.21) % 1} />
          </Rise>
        </div>
      ))}
      <Note x={(END + UX) / 2} y={row(0) + 35} dx={-40} dy={-80} text="mỗi partition → đúng một consumer" color={INK.accent} o={vis(t, a0 + 2.4, a1 - 0.3)} />
      <div style={{ position: 'absolute', left: 0, top: 0, opacity: vis(t, a0 + 3.4, a1 - 0.3) }}>
        <Icon3D name="lock" x={1620} y={260} size={150} t={t} at={a0 + 3.4} />
        <div style={{ ...panel, left: 1420, top: 370, fontSize: 28, whiteSpace: 'nowrap' }}>giữ thứ tự trong partition</div>
      </div>

      {[4, 5].map((k) => (
        <div key={k}>
          <Rise t={t} at={idleAt(k)}>
            <ConsumerUnit x={UX} y={uy(k)} w={380} name={`C${k + 1}`} idle t={t} />
          </Rise>
          <Icon3D name="pause" x={1460} y={uy(k) + 59} size={96} t={t} at={idleAt(k) + 1.2} />
        </div>
      ))}
      <Rise t={t} at={a1 + 0.3}>
        <div style={{ ...panel, left: 100, top: 740, whiteSpace: 'nowrap' }}>
          quầy thu ngân <span style={{ color: INK.faint }}>=</span> <span style={{ color: INK.accent }}>partition</span>
        </div>
      </Rise>
      <Rise t={t} at={a1 + 1.4}>
        <div style={{ ...panel, left: 100, top: 818, whiteSpace: 'nowrap' }}>
          thu ngân <span style={{ color: INK.faint }}>=</span> <span style={{ color: INK.good }}>consumer</span>
        </div>
      </Rise>

      <div style={{ position: 'absolute', left: 1400, top: uy(0), width: 24, height: 3 * 135 + 118, borderTop: `3px solid ${INK.accent}`, borderRight: `3px solid ${INK.accent}`, borderBottom: `3px solid ${INK.accent}`, borderRadius: '0 10px 10px 0', opacity: vis(t, a2 + 0.2) }} />
      <div style={{ position: 'absolute', left: 1456, top: 300, fontSize: 68, fontWeight: 800, letterSpacing: -1, color: INK.warn, whiteSpace: 'nowrap', opacity: vis(t, a2 + 1.2) }}>trần = 4</div>
      <div style={{ ...panel, left: 1456, top: 420, fontSize: 28, whiteSpace: 'nowrap', opacity: vis(t, a2 + 3.2) }}>làm việc ≤ số partition</div>
      <Statement x={100} y={910} text="số partition = TRẦN song song" size={46} o={sp(t, a2 + 0.7)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 2. formula */

const CHIP = (i: number) => ({ x: 140 + (i % 10) * 166, y: 520 + Math.floor(i / 10) * 72 })

function formula(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const mA = span(t, a1 + 1.3, a1 + 1.7)
  const mB = span(t, a1 + 3.1, a1 + 3.5)
  const op = { position: 'absolute', fontSize: 96, fontWeight: 800, color: INK.faint, transform: 'translate(-50%, -50%)', top: 375 } as const
  const wrapped = (v: ReactNode) => <div style={{ marginTop: 14, fontSize: 66, fontWeight: 800, letterSpacing: -1, textAlign: 'center', whiteSpace: 'nowrap', ...TABULAR }}>{v}</div>
  return (
    <SoftScene
      t={t}
      camera={cameraAt(t, [
        [0, WIDE],
        [a1 + 0.2, { x: 960, y: 470, s: 1.08 }, 1.3],
        [a2, { x: 960, y: 610, s: 1.06 }, 1.3],
      ])}
      title={{ kicker: 'CÔNG THỨC', text: 'Cần bao nhiêu partition?', until: a1 - 0.1 }}
    >
      <Rise t={t} at={a0 + 1.9}>
        <div style={{ ...panel, left: 330, top: 165, width: 1260, textAlign: 'center', fontFamily: MONO, fontSize: 38, whiteSpace: 'nowrap', boxSizing: 'border-box' }}>
          partition <span style={{ color: INK.good }}>≥</span> throughput ÷ tốc độ 1 consumer
        </div>
      </Rise>
      <Rise t={t} at={a0 + 2.6}>
        <Stat x={120} y={270} w={500} h={210} title="throughput mục tiêu">
          {wrapped(<Cross a={<span style={{ color: INK.faint }}>?</span>} b="1000 MB/s" m={mA} w={440} />)}
        </Stat>
      </Rise>
      <Rise t={t} at={a0 + 2.9}>
        <div style={{ ...op, left: 690 }}>÷</div>
      </Rise>
      <Rise t={t} at={a0 + 3.3}>
        <Stat x={760} y={270} w={500} h={210} title="1 consumer xử lý được">
          {wrapped(<Cross a={<span style={{ color: INK.faint }}>?</span>} b={<span style={{ color: INK.accent }}>50 MB/s</span>} m={mB} w={440} />)}
        </Stat>
      </Rise>
      <Rise t={t} at={a1 + 5.0}>
        <div style={{ ...op, left: 1330 }}>=</div>
      </Rise>
      <Rise t={t} at={a1 + 5.3}>
        <div style={{ ...INK.card, position: 'absolute', left: 1400, top: 270, width: 400, height: 210, boxSizing: 'border-box', border: 'none', background: HERO, boxShadow: HERO_SHADOW, textAlign: 'center', padding: '18px 28px' }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>số partition</div>
          <div style={{ fontSize: 120, fontWeight: 800, lineHeight: 1.05, marginTop: 6, color: '#ffffff', ...TABULAR }}>20</div>
        </div>
      </Rise>

      <div style={{ position: 'absolute', left: 0, top: 0, opacity: vis(t, a0 + 2.9, a1 + 5.4) }}>
        <Icon3D name="rocket" x={370} y={640} size={170} t={t} at={a0 + 2.9} />
        <Icon3D name="computer" x={1010} y={640} size={170} t={t} at={a0 + 3.7} />
        <Packets t={t} from={{ x: 480, y: 640 }} to={{ x: 900, y: 640 }} start={a0 + 4.0} end={a1 + 5.4} every={0.3} len={0.8} size={22} />
      </div>
      {Array.from({ length: 30 }, (_, i) => {
        const extra = i >= 20
        const at = extra ? a2 + 4.4 + (i - 20) * 0.05 : a1 + 5.8 + i * 0.05
        const { x, y } = CHIP(i)
        return (
          <Rise key={i} t={t} at={at} dy={16}>
            <div style={{ position: 'absolute', left: x, top: y, width: 150, height: 58, borderRadius: 16, display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 800, color: extra ? '#3a2200' : '#ffffff', background: extra ? 'linear-gradient(160deg, #ffe3a3 0%, #ffb547 100%)' : 'linear-gradient(160deg, #78b0ff 0%, #2f66f2 55%, #1c3fc4 100%)', boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.5), 0 0 14px rgba(77,141,255,0.35), 0 8px 16px rgba(0,8,50,0.45)' }}>
              P{i}
            </div>
          </Rise>
        )
      })}

      <Rise t={t} at={a2 + 0.2}>
        <div style={{ ...INK.card, position: 'absolute', left: 210, top: 770, width: 1500, height: 230, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <div style={{ fontSize: 38, fontWeight: 700, color: '#d6e2ff', whiteSpace: 'nowrap' }}>
            <span style={{ opacity: vis(t, a2 + 0.3) }}>ghi: 1000 ÷ 100 MB/s</span>
            <span style={{ opacity: vis(t, a2 + 1.6) }}> = </span>
            <span style={{ opacity: vis(t, a2 + 1.6), color: INK.accent }}>10</span>
            <span style={{ opacity: vis(t, a2 + 3.0) }}> · đọc: </span>
            <span style={{ opacity: vis(t, a2 + 3.0), color: INK.accent }}>20</span>
          </div>
          <div style={{ fontSize: 56, fontWeight: 800, whiteSpace: 'nowrap', opacity: vis(t, a2 + 4.0), letterSpacing: -1 }}>
            max(20, 10) × 1,5 = <span style={{ color: INK.good, textShadow: `0 0 26px ${INK.good}` }}>30 partition</span>
          </div>
        </div>
      </Rise>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 3. the cost of too many */

type Meter = { x: number; icon: Icon3DName; title: string; value: string; caption: string; bar: number; hot: number; limit?: number; at: number }

function MeterCard({ t, m }: { t: number; m: Meter }) {
  const { hot } = m
  return (
    <Rise t={t} at={m.at}>
      <div style={{ ...INK.card, position: 'absolute', left: m.x, top: 300, width: 520, height: 540, boxSizing: 'border-box', padding: '0 40px', border: `1.5px solid ${mix('#6ea0ff', INK.bad, hot)}`, boxShadow: `0 0 ${14 + 34 * hot}px rgba(${hot > 0 ? '255,90,106' : '61,123,255'},${0.35 + 0.35 * hot}), 0 24px 50px rgba(0,4,30,0.55), inset 0 1px 0 rgba(255,255,255,0.18)` }}>
        <Icon3D name={m.icon} x={260} y={110} size={150} t={t} at={m.at} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 205, textAlign: 'center', fontSize: 26, fontWeight: 700, color: INK.faint }}>{m.title}</div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 250, textAlign: 'center', fontSize: 56, fontWeight: 800, letterSpacing: -1, whiteSpace: 'nowrap', color: mix('#ffffff', INK.bad, hot), ...TABULAR }}>{m.value}</div>
        <div style={{ position: 'absolute', left: 40, right: 40, top: 335, textAlign: 'center', fontSize: 26, fontWeight: 600, lineHeight: 1.35, color: '#d6e2ff' }}>{m.caption}</div>
        <div style={{ position: 'absolute', left: 40, right: 40, top: 460, height: 26, borderRadius: 13, background: 'rgba(255,255,255,0.14)' }}>
          <div style={{ width: `${clamp(m.bar) * 100}%`, height: '100%', borderRadius: 13, background: mix(INK.accent, INK.bad, hot), boxShadow: `0 0 14px ${mix(INK.accent, INK.bad, hot)}` }} />
          {m.limit !== undefined && (
            <>
              <div style={{ position: 'absolute', left: `${m.limit * 100}%`, top: -10, width: 3, height: 46, background: INK.warn }} />
              <div style={{ position: 'absolute', left: `${m.limit * 100}%`, top: -44, transform: 'translateX(-50%)', fontSize: 24, fontWeight: 800, color: INK.warn, whiteSpace: 'nowrap' }}>32 MB</div>
            </>
          )}
        </div>
      </div>
    </Rise>
  )
}

function cost(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const n = Math.round(10 ** lerp(1, 4, span(snap(t), a0 + 0.3, a0 + 2.2)))
  const d1 = c.end(1) - a1
  const mAt = (k: number) => a1 + d1 * (0.12 + k * 0.28)
  const grow = (k: number, x = t) => span(x, mAt(k) + 0.3, mAt(k) + 1.6)
  const g = [0, 1, 2].map((k) => grow(k, snap(t)))
  const batch = Math.round(500 * (5 / 500) ** g[2])
  const meters: Meter[] = [
    { x: 100, icon: 'folder', title: 'FILE TRÊN ĐĨA', value: `${fmt(30000 * g[0])}+ file`, caption: 'mỗi partition là một thư mục, mỗi segment 3 file', bar: grow(0), hot: span(grow(0), 0.7, 1), at: mAt(0) },
    { x: 700, icon: 'battery', title: 'RAM PRODUCER', value: `${Math.round(156 * g[1])} MB`, caption: 'một lô 16 KB cho mỗi partition, buffer.memory chỉ 32 MB', bar: grow(1), hot: span(grow(1), 0.2, 0.4), limit: 32 / 156, at: mAt(1) },
    { x: 1300, icon: 'cube', title: 'MỖI LÔ TIN', value: `${batch} tin/lô`, caption: 'chia cho nhiều partition: lô nhỏ dần, nén kém', bar: 1 - 0.93 * grow(2), hot: span(grow(2), 0.4, 0.9), at: mAt(2) },
  ]
  const election = Math.round(lerp(0, 10000, span(snap(t), a2 + 1.6, c.duration - 0.4)))
  const dead = span(t, a2 + 1.2, a2 + 1.6)
  const cardsOut = 1 - span(t, a2 - 0.1, a2 + 0.3)
  return (
    <SoftScene
      t={t}
      camera={cameraAt(t, [
        [0, { x: 960, y: 330, s: 1.25 }],
        [a0 + 2.4, WIDE, 1.4],
        [mAt(0) - 0.2, { x: 900, y: 540, s: 1.05 }, 1.1],
        [mAt(1) - 0.2, { x: 960, y: 540, s: 1.05 }, 1.1],
        [mAt(2) - 0.2, { x: 1020, y: 540, s: 1.05 }, 1.1],
        [a2 - 0.1, WIDE, 1.3],
      ])}
    >
      <Rise t={t} at={0.2}>
        <div style={{ position: 'absolute', left: 0, top: 84, width: 1920, textAlign: 'center', fontSize: 112, fontWeight: 800, letterSpacing: -2, color: '#ffffff', textShadow: '0 0 40px rgba(91,151,255,0.55)', ...TABULAR }}>
          {fmt(n)} <span style={{ color: INK.warn }}>partition?</span>
        </div>
      </Rise>
      <div style={{ position: 'absolute', left: 0, top: 0, opacity: vis(t, a0 + 0.3, a1 + 0.1) }}>
        {Array.from({ length: 600 }, (_, q) => {
          const lit = q < Math.round(600 * span(snap(t), a0 + 0.3, a0 + 2.2))
          return <div key={q} style={{ position: 'absolute', left: 160 + (q % 50) * 32, top: 340 + Math.floor(q / 50) * 40, width: 24, height: 30, borderRadius: 8, background: lit ? 'linear-gradient(160deg, #78b0ff 0%, #2f66f2 100%)' : 'rgba(12,30,96,0.55)', border: lit ? 'none' : '1.5px solid rgba(110,160,255,0.35)', boxShadow: lit ? '0 0 10px rgba(77,141,255,0.5)' : undefined }} />
        })}
      </div>
      <div style={{ opacity: cardsOut }}>
        {meters.map((m) => (
          <MeterCard key={m.icon} t={t} m={m} />
        ))}
      </div>

      <div style={{ opacity: vis(t, a2 + 0.1) }}>
        <div style={{ position: 'absolute', left: 150, top: 420, transform: 'scale(1.6)', transformOrigin: '0 0' }}>
          <div style={{ opacity: 1 - dead }}>
            <ServerUnit x={0} y={0} name="broker 2" t={t} />
          </div>
          <div style={{ position: 'absolute', left: 0, top: 0, opacity: dead }}>
            <ServerUnit x={0} y={0} name="broker 2" down t={t} />
          </div>
        </div>
        <Icon3D name="fire" x={360} y={370} size={120} t={t} at={a2 + 1.4} />
        <Wire from={{ x: 620, y: 560 }} to={{ x: 890, y: 560 }} color={INK.bad} p={move(t, a2 + 1.8, 0.5)} flow={t} />
        <Packets t={t} from={{ x: 620, y: 560 }} to={{ x: 890, y: 560 }} start={a2 + 2.2} every={0.35} len={0.7} color={INK.bad} size={20} />
        <div style={{ ...INK.card, position: 'absolute', left: 900, top: 370, width: 900, height: 420, boxSizing: 'border-box', padding: '34px 44px' }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: INK.faint }}>bầu leader mới cho từng partition</div>
          <div style={{ marginTop: 22, fontSize: 104, fontWeight: 800, letterSpacing: -2, whiteSpace: 'nowrap', ...TABULAR }}>
            {fmt(election)} <span style={{ color: INK.faint, fontSize: 60 }}>/ 10.000</span>
          </div>
          <div style={{ height: 28, borderRadius: 14, background: 'rgba(255,255,255,0.14)', marginTop: 28 }}>
            <div style={{ width: `${(election / 10000) * 100}%`, height: '100%', borderRadius: 14, background: INK.warn, boxShadow: `0 0 16px ${INK.warn}` }} />
          </div>
          <div style={{ marginTop: 24, fontSize: 30, fontWeight: 600, color: '#d6e2ff' }}>từng partition một…</div>
        </div>
      </div>
      <Icon3D name="clock" x={340} y={915} size={110} t={t} at={a2 + 3.0} />
      <Statement x={420} y={881} text="càng nhiều partition → hồi phục càng lâu" color={INK.warn} size={52} o={sp(t, a2 + 3.0)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 4. divisible counts */

/** Range assignment: consumer j gets a contiguous run; the first (n % k) consumers take one extra. */
function owner(i: number, n: number, k: number) {
  const per = Math.floor(n / k)
  const extra = n % k
  let start = 0
  for (let j = 0; j < k; j++) {
    const cnt = per + (j < extra ? 1 : 0)
    if (i < start + cnt) return j
    start += cnt
  }
  return k - 1
}

const loadsOf = (n: number, k: number) => Array.from({ length: k }, (_, j) => Array.from({ length: n }, (_, i) => owner(i, n, k)).filter((o) => o === j).length)
const BOARD = { X0: 180, W: 1560, GAP: 24, Y: 310, H: 320, CHIP_W: 100, CHIP_G: 10 }
const slotW = (k: number) => (BOARD.W - (k - 1) * BOARD.GAP) / k
const slotX = (j: number, k: number) => BOARD.X0 + j * (slotW(k) + BOARD.GAP)
/** Two shades of blue alternate between consumers so groups read without a rainbow. */
const SHADE = ['#4d8dff', '#2447c9']

/** Top-left of chip i when n partitions are shared by k consumers. */
function chipPos(i: number, n: number, k: number) {
  const o = owner(i, n, k)
  const mine = Array.from({ length: n }, (_, q) => q).filter((q) => owner(q, n, k) === o)
  const rowW = mine.length * BOARD.CHIP_W + (mine.length - 1) * BOARD.CHIP_G
  return { x: slotX(o, k) + (slotW(k) - rowW) / 2 + mine.indexOf(i) * (BOARD.CHIP_W + BOARD.CHIP_G), y: BOARD.Y + 112 }
}

function divisible(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const d1 = c.end(1) - a1
  const cycleEnd = a1 + d1 * 0.5
  const stages = [
    { at: -1, n: 12, k: 1 },
    { at: a1 + 0.9, n: 12, k: 2 },
    { at: a1 + 1.7, n: 12, k: 3 },
    { at: a1 + 2.4, n: 12, k: 4 },
    { at: a1 + 3.2, n: 12, k: 6 },
    { at: cycleEnd, n: 10, k: 4 },
  ]
  const s = stages.reduce((acc, st, idx) => (t >= st.at ? idx : acc), 0)
  const cur = stages[s]
  const prev = s > 0 ? stages[s - 1] : cur
  const m = s > 0 ? move(t, cur.at, 0.45) : 1
  const heavyOn = span(t, cycleEnd + 0.9, cycleEnd + 1.4)
  const pulse = 0.5 + 0.5 * Math.sin(t * 4)
  const loadCur = loadsOf(cur.n, cur.k)
  const loadPrev = loadsOf(prev.n, prev.k)
  const perCur = Math.ceil(cur.n / cur.k)
  const perPrev = Math.ceil(prev.n / prev.k)
  const uneven = cur.n === 10
  const resultOf = (st: { n: number; k: number }): ReactNode => (st.n === 10 ? <span style={{ color: INK.bad }}>lệch 3-3-2-2</span> : <span style={{ color: INK.good }}>mỗi người {st.n / st.k}</span>)
  const colOf = (st: { n: number; k: number }, i: number) => SHADE[owner(i, st.n, st.k) % 2]
  const heavyChip = (i: number) => (uneven && loadCur[owner(i, cur.n, cur.k)] === Math.max(...loadCur) ? heavyOn : 0)
  return (
    <SoftScene
      t={t}
      camera={cameraAt(t, [
        [0, { x: 960, y: 430, s: 1.08 }],
        [a0 + 1.2, WIDE, 1.4],
        [cycleEnd - 0.2, { x: 960, y: 480, s: 1.05 }, 1.0],
        [a2 - 0.1, WIDE, 1.2],
      ])}
    >
      <div style={{ position: 'absolute', left: 0, top: 160, width: 1920, textAlign: 'center', fontSize: 62, fontWeight: 800, letterSpacing: -1, whiteSpace: 'nowrap', opacity: vis(t, a0 + 1.0), ...TABULAR }}>
        <Cross a={prev.n} b={cur.n} m={m} w={84} /> partition · <Cross a={prev.k} b={cur.k} m={m} w={40} /> consumer → <Cross a={resultOf(prev)} b={resultOf(cur)} m={m} w={440} align="left" />
      </div>

      {Array.from({ length: 6 }, (_, j) => {
        const kp = prev.k
        const kc = cur.k
        const from = j < kp ? { x: slotX(j, kp), w: slotW(kp) } : { x: BOARD.X0 + BOARD.W, w: 0 }
        const to = j < kc ? { x: slotX(j, kc), w: slotW(kc) } : { x: BOARD.X0 + BOARD.W, w: 0 }
        if (j >= Math.max(kp, kc)) return null
        const o = (j < kp ? 1 : m) * (j < kc ? 1 : 1 - m) * (j === 0 ? vis(t, a0 + 2.3) : 1)
        const countCur = loadCur[j] ?? 0
        const countPrev = j < kp ? loadPrev[j] : countCur
        const heavy = uneven && countCur === Math.max(...loadCur) ? heavyOn : 0
        const fill = lerp(countPrev / perPrev, countCur / perCur, m)
        return (
          <div key={j} style={{ ...INK.card, position: 'absolute', left: lerp(from.x, to.x, m), top: BOARD.Y, width: lerp(from.w, to.w, m), height: BOARD.H, boxSizing: 'border-box', overflow: 'hidden', opacity: o, borderColor: mix('#6ea0ff', INK.bad, heavy), boxShadow: heavy > 0 ? `0 0 ${20 + 24 * pulse * heavy}px rgba(255,90,106,${0.55 * heavy}), 0 24px 50px rgba(0,4,30,0.55)` : (INK.card.boxShadow as string) }}>
            <div style={{ position: 'absolute', left: 22, top: 20, fontSize: 40, fontWeight: 800 }}>C{j + 1}</div>
            <div style={{ position: 'absolute', right: 22, top: 20, fontSize: 44, fontWeight: 800, color: mix('#ffffff', INK.bad, heavy), ...TABULAR }}>
              <Cross a={countPrev} b={countCur} m={m} w={54} align="right" />
            </div>
            <div style={{ position: 'absolute', left: 22, right: 22, top: 262, height: 24, borderRadius: 12, background: 'rgba(255,255,255,0.14)' }}>
              <div style={{ width: `${clamp(fill) * 100}%`, height: '100%', borderRadius: 10, background: mix(INK.accent, INK.bad, heavy), boxShadow: `0 0 12px ${mix(INK.accent, INK.bad, heavy)}` }} />
            </div>
          </div>
        )
      })}

      {Array.from({ length: 12 }, (_, i) => {
        const inPrev = i < prev.n
        const inCur = i < cur.n
        const p0 = inPrev ? chipPos(i, prev.n, prev.k) : chipPos(i, cur.n, cur.k)
        const p1 = inCur ? chipPos(i, cur.n, cur.k) : p0
        const base = inCur ? mix(colOf(prev, i), colOf(cur, i), m) : colOf(prev, i)
        const hv = inCur ? heavyChip(i) : 0
        // the chip colour is an rgb() string, so the gradient is built from the blended colour and white
        const col = hv > 0 ? mix(INK.accent, INK.bad, hv) : base
        const o = vis(t, a0 + 1.6 + i * 0.05, Infinity, 0.3) * (inCur ? 1 : 1 - m)
        return (
          <div key={i} style={{ position: 'absolute', left: lerp(p0.x, p1.x, m), top: lerp(p0.y, p1.y, m), width: BOARD.CHIP_W, height: 84, borderRadius: 18, display: 'grid', placeItems: 'center', fontSize: 32, fontWeight: 800, color: '#ffffff', opacity: o, background: col, boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.45), 0 8px 16px rgba(0,8,50,0.45)' }}>
            P{i}
          </div>
        )
      })}

      <Rise t={t} at={a0 + 0.3}>
        <div style={{ ...panel, left: 480, top: 730, width: 960, height: 140, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 24, opacity: 1 - span(t, a1, a1 + 0.4), whiteSpace: 'nowrap' }}>
          <span style={{ width: 110 }} />
          <span style={{ fontSize: 38 }}>mẹo: chọn số chia hết cho nhiều số consumer</span>
        </div>
      </Rise>
      <div style={{ opacity: 1 - span(t, a1, a1 + 0.4) }}>
        <Icon3D name="calculator" x={560} y={800} size={110} t={t} at={a0 + 0.5} />
      </div>
      <div style={{ opacity: vis(t, cycleEnd + 1.2, a2 - 0.1) }}>
        <Rise t={t} at={cycleEnd + 1.2}>
          <div style={{ ...panel, left: 410, top: 730, width: 1100, height: 140, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 24, whiteSpace: 'nowrap' }}>
            <span style={{ width: 110 }} />
            <span style={{ fontSize: 38, color: INK.bad }}>2 consumer gánh nặng hơn → nút cổ chai</span>
          </div>
        </Rise>
        <Icon3D name="fire" x={490} y={800} size={110} t={t} at={cycleEnd + 1.4} />
      </div>

      {[
        { x: 180, icon: 'thumb-up' as Icon3DName, title: 'tăng partition', sub: '✓ được phép', color: INK.good, at: a2 + 0.5 },
        { x: 710, icon: 'thumb-down' as Icon3DName, title: 'giảm partition', sub: '✗ không được', color: INK.bad, at: a2 + 1.9 },
        { x: 1240, icon: 'key' as Icon3DName, title: 'topic có key', sub: 'tạo đủ từ đầu', color: INK.warn, at: a2 + 3.2 },
      ].map((v) => (
        <div key={v.title}>
          <Rise t={t} at={v.at}>
            <div style={{ ...INK.card, position: 'absolute', left: v.x, top: 720, width: 500, height: 250, boxSizing: 'border-box' }}>
              <div style={{ position: 'absolute', left: 190, top: 60, fontSize: 38, fontWeight: 800, whiteSpace: 'nowrap' }}>{v.title}</div>
              <div style={{ position: 'absolute', left: 190, top: 126, fontSize: 32, fontWeight: 700, color: v.color, whiteSpace: 'nowrap' }}>{v.sub}</div>
            </div>
          </Rise>
          <Icon3D name={v.icon} x={v.x + 100} y={845} size={130} t={t} at={v.at} />
        </div>
      ))}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 5. summary */

function summary(t: number, c: Cue) {
  return (
    <SoftTheme>
      <SummaryList t={t} cue={c} items={['Số partition là trần song song', 'Throughput ÷ tốc độ 1 consumer, cộng dư', 'Nhiều quá hại: tốn tài nguyên, hồi phục chậm', 'Chọn số chia đều, tạo đủ từ đầu']} />
    </SoftTheme>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { hook, parallel, formula, cost, divisible, summary }

/** Key-moment sounds, timed to the same cue offsets the scenes animate on. */
const SFX: Record<string, SceneSfx[]> = {
  // the alert bell lands when the lag counter passes 2.000.000 (1.75M + 160k/s)
  hook: [
    { kind: 'error', at: () => 1.55 },
    { kind: 'tick', at: (c) => c.at(1) + 1.0 },
  ],
  parallel: [
    { kind: 'tick', at: (c) => c.at(1) + 2.2 },
    { kind: 'ding', at: (c) => c.at(2) + 0.7 },
  ],
  formula: [
    { kind: 'ding', at: (c) => c.at(1) + 5.3 },
    { kind: 'ding', at: (c) => c.at(2) + 4.0 },
  ],
  cost: [
    { kind: 'error', at: (c) => c.at(2) + 1.2 },
    { kind: 'tick', at: (c) => c.at(2) + 3.0 },
  ],
  divisible: [
    { kind: 'tick', at: (c) => c.at(1) + (c.end(1) - c.at(1)) * 0.5 },
    { kind: 'error', at: (c) => c.at(1) + (c.end(1) - c.at(1)) * 0.5 + 0.9 },
  ],
}

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const partitionCountLesson: Lesson = {
  ...partitionCountScript,
  scenes: partitionCountScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id], sfx: SFX[s.id] })),
  intro: [
    { kind: 'video', scenes: ['hook'] },
    {
      kind: 'quiz',
      title: 'Quick Quiz',
      questions: [
        q(
          'Đoán trước khi học: topic có 6 partition, tăng consumer từ 6 lên 10. Lag giảm không?',
          ['Giảm gần một nửa', 'Không giảm, vì 4 consumer mới không được giao partition nào', 'Giảm một chút', 'Lag về 0 ngay'],
          1,
          'Đúng hướng. Phần 1 sẽ giải thích vì sao số partition là trần song song.',
        ),
      ],
    },
  ],
  roadmap: [
    'Chặng 1: Vì sao số partition là trần song song của consumer.',
    'Chặng 2: Tính số partition từ throughput — và vì sao nhiều quá cũng hại.',
    'Chặng 3: Mẹo chọn con số chia đều, và tự tay thử trên máy tính partition.',
  ],
  sections: [
    {
      id: 'tran-song-song',
      title: 'Số partition là trần song song',
      blocks: [
        { kind: 'video', scenes: ['parallel'] },
        {
          kind: 'p',
          text: 'Trong một **consumer group**, mỗi partition chỉ được giao cho **đúng một** consumer, vì cần giữ thứ tự trong partition. Ngược lại, một consumer có thể nhận **nhiều** partition.',
        },
        {
          kind: 'table',
          head: ['Partition', 'Consumer trong nhóm', 'Kết quả'],
          rows: [
            ['6', '3', 'mỗi consumer đọc 2 partition'],
            ['6', '6', 'mỗi consumer đọc 1 partition — song song tối đa'],
            ['6', '10', '**4 consumer ngồi chơi**, lag không giảm'],
          ],
        },
        {
          kind: 'callout',
          tone: 'tip',
          text: 'Lag tăng mãi mà đã đủ consumer? Trước khi thêm partition, hãy (a) tăng tốc từng consumer (xử lý theo lô, tối ưu ghi DB), và (b) kiểm tra có **hot partition** không — khi đó thêm gì cũng không đỡ.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Topic 4 partition, nhóm có 6 consumer. Bao nhiêu consumer thực sự làm việc?', ['6', '4', '2', '1'], 1, 'Mỗi partition một consumer, nên tối đa 4 người làm việc, 2 người rảnh.'),
          ],
        },
      ],
    },
    {
      id: 'cong-thuc',
      title: 'Tính số partition từ throughput',
      blocks: [
        {
          kind: 'quiz',
          title: 'Dự đoán trước khi xem',
          questions: [
            q('Cần xử lý 1 GB/giây, mỗi consumer xử lý được 50 MB/giây. Cần ít nhất bao nhiêu partition?', ['5', '20', '50', '1000'], 1, '1000 ÷ 50 = 20. Xem video để biết vì sao còn phải cộng thêm.'),
          ],
        },
        { kind: 'video', scenes: ['formula'] },
        {
          kind: 'p',
          text: 'Công thức: **số partition ≈ max(mục tiêu ÷ tốc độ 1 consumer, mục tiêu ÷ tốc độ ghi 1 partition) + dư phòng**. Tốc độ consumer phải tính **cả phần xử lý** (ghi DB, gọi API), thường là phần chậm nhất.',
        },
        {
          kind: 'list',
          items: [
            { title: 'Tính theo tương lai', text: 'Với topic có key, thêm partition sau này rất khó, nên tính theo throughput **dự kiến**, không theo hiện tại.' },
            { title: 'Chưa có số đo', text: 'Kinh nghiệm từ sách: giữ mỗi partition **dưới ~6 GB cho mỗi ngày retention**.' },
            { title: 'Chia đều cho broker', text: 'Số partition bằng hoặc là **bội số của số broker** để leader chia đều.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q(
              'Mục tiêu 300 MB/s. Một consumer xử lý 20 MB/s, một partition ghi được 60 MB/s. Số tối thiểu (chưa cộng dư) là?',
              ['5', '15', '20', '300'],
              1,
              'Đọc: 300 ÷ 20 = 15; ghi: 300 ÷ 60 = 5; lấy max = 15, rồi cộng dư.',
            ),
          ],
        },
      ],
    },
    {
      id: 'cai-gia',
      title: 'Nhiều partition không miễn phí',
      blocks: [
        { kind: 'video', scenes: ['cost'] },
        {
          kind: 'table',
          head: ['Chi phí', 'Vì sao'],
          rows: [
            ['File trên đĩa', 'Mỗi partition là một thư mục, mỗi segment 3 file → rất nhiều file mở cùng lúc'],
            ['RAM producer', 'Producer giữ một lô riêng cho mỗi partition: 1.000 × 16 KB = 16 MB, gần nửa `buffer.memory` 32 MB'],
            ['Lô nhỏ đi', 'Cùng lượng dữ liệu chia cho nhiều partition → mỗi lô ít tin → nén kém, nhiều request'],
            ['Hồi phục chậm', 'Broker chết → **từng** partition phải bầu leader mới'],
          ],
        },
        {
          kind: 'callout',
          tone: 'info',
          text: 'Sách *Kafka: The Definitive Guide* nhắc thêm: mỗi partition tốn RAM trên broker, làm chậm cập nhật metadata, và trên cloud có thể chạm giới hạn IOPS của đĩa. "Bắt đầu nhỏ rồi tăng dần dễ hơn bắt đầu quá lớn" — trừ khi topic dùng key.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Vì sao 10.000 partition làm producer dễ hết `buffer.memory`?', ['Vì mỗi tin to hơn', 'Vì producer giữ một lô riêng cho mỗi partition', 'Vì broker gửi lại nhiều hơn', 'Vì nén mạnh hơn'], 1, '10.000 × 16 KB ≈ 156 MB, vượt xa 32 MB mặc định.'),
          ],
        },
      ],
    },
    {
      id: 'chia-deu',
      title: 'Chọn con số chia đều',
      blocks: [
        { kind: 'video', scenes: ['divisible'] },
        {
          kind: 'p',
          text: 'Con số như **12, 24, 36, 60** chia đều cho nhiều số consumer (12 chia hết cho 1, 2, 3, 4, 6). Con số lệch (10 partition, 4 consumer) khiến vài consumer gánh nhiều hơn và trở thành **nút cổ chai**.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Chỉ tăng, không giảm',
          text: 'Kafka cho **tăng** số partition nhưng **không cho giảm**. Với topic có key, tăng partition làm `hash % N` đổi và key "đổi nhà" (bài Key → Partition). Lời khuyên của sách: tạo đủ partition ngay từ đầu và đừng bao giờ thêm.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Bạn dự kiến chạy 2, 3 hoặc 4 consumer tuỳ mùa cao điểm. Con số nào chia đều cho cả ba?', ['10', '12', '14', '9'], 1, '12 chia hết cho 2, 3 và 4.'),
          ],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: máy tính partition',
      blocks: [
        { kind: 'p', text: 'Nhập throughput và tốc độ consumer, rồi kéo số consumer. **Đoán trước**: với 10 partition và 4 consumer, người gánh nặng nhất nhận mấy partition?' },
        { kind: 'widget', name: 'partition-calculator' },
      ],
    },
    {
      id: 'tom-tat-video',
      title: 'Nhìn lại cả bài',
      blocks: [{ kind: 'video', scenes: ['summary'] }],
    },
  ],
  finalQuiz: [
    q('Topic 6 partition, nhóm 10 consumer, lag tăng mãi. Bước nào KHÔNG giúp?', ['Tăng tốc xử lý của từng consumer', 'Thêm consumer thứ 11', 'Tăng partition lúc thấp điểm (cẩn thận thứ tự)', 'Kiểm tra hot partition'], 1, 'Đã có 4 consumer ngồi chơi; thêm người nữa chỉ thêm một người rảnh.'),
    q('Vì sao không chọn luôn 10.000 partition cho chắc?', ['Kafka giới hạn 1.000 partition', 'Tốn file, RAM producer, lô nhỏ nén kém, hồi phục chậm', 'Consumer không đọc được nhiều partition', 'Key sẽ bị mất'], 1, 'Mỗi partition có chi phí thật ở producer, broker và lúc sự cố.'),
    q('Cluster 3 broker, cần khoảng 16 partition. Con số nào hợp lý nhất?', ['16', '18', '17', '13'], 1, '18 là bội số của 3 broker và chia đều cho 1, 2, 3, 6, 9 consumer.'),
    q('Topic có key, đang 12 partition, cần gấp đôi throughput. Rủi ro lớn nhất khi tăng lên 24?', ['Mất dữ liệu cũ', 'Key đổi partition → mất thứ tự giữa tin cũ và tin mới của cùng key', 'Không tăng được', 'Consumer bị khoá'], 1, 'hash % N đổi theo N, nên tin mới của một key có thể sang partition khác.'),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao số partition là "trần song song" của consumer?',
      keywords: ['partition', 'một consumer', 'thứ tự', 'ngồi chơi'],
      modelAnswer:
        'Vì trong một nhóm, mỗi partition chỉ được giao cho một consumer để giữ thứ tự trong partition. Nên số consumer làm việc cùng lúc tối đa bằng số partition; thêm consumer vượt quá số đó thì người thừa ngồi chơi.',
    },
  ],
  recap: {
    journey:
      'Lag tăng mà thêm consumer không đỡ → mỗi partition chỉ một consumer nên số partition là trần song song → tính số partition từ throughput ÷ tốc độ một consumer, cộng dư → nhưng nhiều quá thì tốn tài nguyên và hồi phục chậm → chọn số chia đều, và tạo đủ từ đầu.',
    points: [
      { title: 'Trần song song', text: 'Consumer làm việc ≤ số partition; người thừa ngồi chơi.' },
      { title: 'Công thức', text: 'max(mục tiêu ÷ 1 consumer, mục tiêu ÷ 1 partition) × hệ số dư.' },
      { title: 'Cái giá', text: 'File, RAM producer, lô nhỏ, bầu leader lâu khi sự cố.' },
      { title: 'Chia đều', text: '12, 24, 60…; bội số số broker; chỉ tăng, không giảm.' },
    ],
    next: 'Bài tiếp theo (Module 3): Hành trình một tin trong producer — từ send() tới broker.',
  },
}
