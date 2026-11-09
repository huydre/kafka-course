import {
  At,
  Burst,
  CashierIcon,
  CheckoutCounter,
  CodeWindow,
  Kinetic,
  NEON,
  Panel,
  PersonIcon,
  Pill,
  Scene,
  ShopperIcon,
  Stamp,
  SummaryGrid,
  TitleCard,
  cameraAt,
  clamp,
  glow,
  lerp,
  sp,
  span,
  vis,
  type Neon,
} from '../player/motion-kit'
import type { Cue, Lesson, Scene as LessonScene } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { partitionCountScript } from './partition-count-script'

const label = { fontSize: 24, fontWeight: 800, letterSpacing: 3, color: NEON.muted } as const

/** Stat tile used on the monitoring dashboard. */
function Stat({ x, y, w = 400, title, value, tone, o = 1 }: { x: number; y: number; w?: number; title: string; value: string; tone: Neon; o?: number }) {
  return (
    <At x={x} y={y} style={{ opacity: clamp(o) }}>
      <div style={{ width: w, padding: '22px 28px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: `2px solid ${NEON[tone]}55` }}>
        <div style={label}>{title}</div>
        <div style={{ fontSize: 64, fontWeight: 900, color: NEON[tone], textShadow: glow(NEON[tone], 0.45), fontFamily: MONO, whiteSpace: 'nowrap' }}>{value}</div>
      </div>
    </At>
  )
}

/* ------------------------------------------------------------------ 0. cold open: 2am incident */

function hook(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const scaleAt = a1 + 1.0
  const consumers = t >= scaleAt ? 10 : 6
  // Lag keeps climbing; after scaling out it only bends slightly, it never comes down.
  const lagAt = (x: number) => 1_750_000 + x * 160_000 - (x > scaleAt ? (x - scaleAt) * 25_000 : 0)
  const lag = Math.round(lagAt(t) / 1000) * 1000
  const chart = Array.from({ length: 60 }, (_, i) => {
    const x = (i / 59) * Math.min(t, c.duration)
    return `${80 + (i / 59) * 1400 * span(t, 0, c.duration)},${700 - (lagAt(x) - 1_600_000) / 6500}`
  }).join(' ')
  const cam = cameraAt(t, [
    [0, { x: 420, y: 320, s: 1.5, rx: 14, r: -2 }],
    [a0 + 0.4, { x: 960, y: 560, s: 0.95 }, 2.4],
    [a1 + 0.6, { x: 860, y: 700, s: 1.12, ry: 5 }, 1.2],
    [a2 + 0.4, { x: 1330, y: 320, s: 1.55, ry: -6 }, 1.3],
  ])
  return (
    <Scene
      t={t}
      camera={cam}
      backdrop="servers"
      overlay={
        <>
          <At x={1560} y={110}>
            <Pill text="⚠  Consumer lag > 2.000.000" tone="red" size={36} o={Math.min(sp(t, a0 + 1.2), vis(t, 0, a2))} />
          </At>
          <At x={560} y={960} style={{ opacity: vis(t, a1, a2 + 0.2) }}>
            <CodeWindow t={t} at={a1 + 0.1} w={900} size={28} lines={[[['$ ', '#64748b'], ['kubectl scale deploy consumer ', '#e2e8f0'], ['--replicas=10', '#fbbf24']]]} />
          </At>
          <At x={960} y={900} style={{ opacity: vis(t, a2 + 1.7), padding: '18px 48px', borderRadius: 28, background: 'rgba(5,7,15,0.88)', border: `3px solid ${NEON.amber}66` }}>
            <Kinetic t={t} at={a2 + 1.8} text="thủ phạm: SỐ PARTITION" size={92} color="#fde68a" glowColor={NEON.amber} />
          </At>
        </>
      }
    >
      <At x={960} y={560}>
        <Panel t={t} at={0} w={1560} h={840} tone={t >= a0 + 1.2 ? 'red' : 'blue'}>
          {/* Coordinates below are relative to the panel's top-left corner (world 180, 140). */}
          <div style={{ ...label, position: 'absolute', left: 48, top: 30 }}>MONITORING · payments-consumer · 02:07</div>
          <Stat x={290} y={150} w={480} title="CONSUMER LAG" value={lag.toLocaleString('vi-VN')} tone="red" />
          <Stat x={780} y={150} title="CONSUMERS" value={String(consumers)} tone={t >= scaleAt ? 'amber' : 'sky'} o={vis(t, a0 + 0.5)} />
          <Stat x={1220} y={150} title="PARTITIONS" value="6" tone={t >= a2 + 0.6 ? 'amber' : 'sky'} o={vis(t, a0 + 0.7)} />
          <At x={1220} y={150}>
            <Burst t={t} at={a2 + 0.8} tone="amber" r={230} />
          </At>
          <svg width={1560} height={840} style={{ position: 'absolute', left: 0, top: 0 }}>
            <line x1={80} y1={706} x2={1480} y2={706} stroke="#334155" strokeWidth={3} />
            <polyline points={chart} fill="none" stroke={NEON.red} strokeWidth={6} style={{ filter: `drop-shadow(0 0 8px ${NEON.red})` }} />
          </svg>
          {Array.from({ length: 10 }, (_, i) => {
            const shown = i < 6 || t >= scaleAt + i * 0.08
            return (
              <At key={i} x={380 + i * 90} y={770} style={{ opacity: shown ? clamp(sp(t, i < 6 ? a0 + 0.8 : scaleAt + (i - 6) * 0.12)) : 0 }}>
                <PersonIcon size={52} idle={i >= 6 && t >= scaleAt + 1.2} t={t} />
              </At>
            )
          })}
          <At x={1300} y={770}>
            <Pill text="4 consumer mới… ngồi chơi" tone="amber" size={28} o={Math.min(sp(t, scaleAt + 1.4), vis(t, 0, a2 + 0.3))} />
          </At>
        </Panel>
      </At>
    </Scene>
  )
}

/* ------------------------------------------------------------------ 1. partitions = the ceiling on parallelism */

/* Shared row layout for the side-by-side analogy: row i of the supermarket mirrors partition i. Coordinates are
   relative to each 860×860 panel. */
const ROW_Y = (i: number) => 175 + i * 140
const IDLE_Y = 770

/** Message chips flowing along a lane (or shoppers along a queue), looping; `start` = when the flow begins. */
const flowX = (t: number, start: number, k: number, from: number, to: number, speed = 95) => from + (((t - start) * speed + k * 150) % (to - from))

function parallel(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const kafkaRow = (i: number) => a0 + 0.6 + i * 0.35
  const shopRow = (i: number) => a1 - 0.2 + i * 0.25
  const cam = cameraAt(t, [
    [0, { x: 1440, y: 560, s: 1.16, ry: -8 }],
    [a0 + 0.3, { x: 1440, y: 560, s: 1.08 }, 1.6],
    [a1 - 0.3, { x: 480, y: 560, s: 1.08, ry: 6 }, 1.3],
    [a2 - 0.2, { x: 960, y: 560, s: 0.86 }, 1.4],
  ])
  const legend: [string, string][] = [
    ['khách hàng', 'tin nhắn'],
    ['quầy thu ngân', 'partition'],
    ['thu ngân', 'consumer'],
  ]
  return (
    <Scene
      t={t}
      camera={cam}
      overlay={
        <>
          <At x={960} y={92} style={{ display: 'flex', gap: 22 }}>
            {legend.map(([a, b], k) => (
              <div key={a} style={{ opacity: clamp(sp(t, a2 - 0.2 + k * 0.3)), display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px', borderRadius: 999, background: 'rgba(5,7,15,0.92)', border: '2px solid #334155', fontSize: 30, fontWeight: 800, whiteSpace: 'nowrap' }}>
                <span style={{ color: '#fcd34d' }}>{a}</span>
                <span style={{ color: '#64748b' }}>=</span>
                <span style={{ color: NEON.sky }}>{b}</span>
              </div>
            ))}
          </At>
          <At x={960} y={985} style={{ opacity: vis(t, a2 + 0.5), padding: '14px 40px', borderRadius: 26, background: 'rgba(5,7,15,0.9)' }}>
            <Kinetic t={t} at={a2 + 0.6} text="số partition = TRẦN SONG SONG" size={76} color="#bfdbfe" glowColor={NEON.blue} stagger={0.02} />
          </At>
        </>
      }
    >
      {/* ---------------- left: supermarket */}
      <At x={480} y={560}>
        <Panel t={t} at={a1 - 0.6} w={860} h={860} tone="amber" still>
          <div style={{ ...label, position: 'absolute', left: 40, top: 30, color: '#fcd34d' }}>SIÊU THỊ · 4 QUẦY · 6 THU NGÂN</div>
          {[0, 1, 2, 3].map((i) => {
            const on = t >= shopRow(i)
            return (
              <div key={i} style={{ opacity: clamp(sp(t, shopRow(i))) }}>
                <div style={{ position: 'absolute', left: 40, right: 360, top: ROW_Y(i) + 30, height: 6, borderRadius: 3, background: 'repeating-linear-gradient(90deg,#3f3f46 0 18px,transparent 18px 30px)' }} />
                {on &&
                  [0, 1].map((k) => {
                    const x = flowX(t, shopRow(i), k + i * 0.4, 10, 330, 70)
                    return (
                      <div key={k} style={{ position: 'absolute', left: x, top: ROW_Y(i) - 66, opacity: Math.min(span(x, 20, 60), 1 - span(x, 280, 330)) }}>
                        <ShopperIcon size={82} t={t + k} />
                      </div>
                    )
                  })}
                <div style={{ position: 'absolute', left: 440, top: ROW_Y(i) - 76 }}>
                  <CheckoutCounter w={250} t={t + i} active={on} />
                  <div style={{ position: 'absolute', left: 8, top: -6, fontSize: 20, fontWeight: 800, color: '#94a3b8' }}>Quầy {i + 1}</div>
                </div>
                <div style={{ position: 'absolute', left: 712, top: ROW_Y(i) - 84 }}>
                  <CashierIcon size={96} t={t + i} />
                </div>
              </div>
            )
          })}
          <div style={{ position: 'absolute', left: 40, right: 40, top: IDLE_Y - 70, borderTop: '2px dashed #57534e' }} />
          <div style={{ position: 'absolute', left: 560, top: IDLE_Y - 40, opacity: clamp(sp(t, a1 + 1.4)), display: 'flex', gap: 40 }}>
            <CashierIcon size={96} idle t={t} />
            <CashierIcon size={96} idle t={t + 1} />
          </div>
          <div style={{ position: 'absolute', left: 540, top: IDLE_Y + 58, width: 260, height: 16, borderRadius: 6, background: '#57534e', opacity: clamp(sp(t, a1 + 1.4)) }} />
          <div style={{ position: 'absolute', left: 60, top: IDLE_Y - 20 }}>
            <Pill text="không còn quầy → ngồi chơi" tone="amber" size={30} o={sp(t, a1 + 1.9)} />
          </div>
        </Panel>
      </At>

      {/* ---------------- right: Kafka, same rows */}
      <At x={1440} y={560}>
        <Panel t={t} at={0} w={860} h={860} tone="blue" still>
          <div style={{ ...label, position: 'absolute', left: 40, top: 30 }}>KAFKA · 4 PARTITION · 6 CONSUMER</div>
          {[0, 1, 2, 3].map((i) => {
            const on = t >= kafkaRow(i)
            return (
              <div key={i} style={{ opacity: clamp(sp(t, i * 0.12)) }}>
                <div style={{ position: 'absolute', left: 40, top: ROW_Y(i) - 40, width: 560, height: 80, borderRadius: 18, border: `3px solid ${NEON.sky}`, background: 'repeating-linear-gradient(90deg, rgba(96,165,250,0.08) 0 40px, transparent 40px 80px), linear-gradient(180deg,#132a5c,#0b1630)', backgroundPosition: `${t * 70}px 0, 0 0` }}>
                  <span style={{ position: 'absolute', left: 16, top: 18, fontSize: 32, fontWeight: 900 }}>P{i}</span>
                </div>
                {on &&
                  [0, 1, 2].map((k) => {
                    const x = flowX(t, kafkaRow(i), k, 110, 560, 120)
                    return (
                      <div key={k} style={{ position: 'absolute', left: x, top: ROW_Y(i) - 20, width: 60, height: 40, borderRadius: 10, background: 'linear-gradient(180deg,#2563eb,#1e3a8a)', border: `2px solid ${NEON.sky}`, opacity: Math.min(span(x, 110, 140), 1 - span(x, 520, 560)) }} />
                    )
                  })}
                <svg width={80} height={20} style={{ position: 'absolute', left: 602, top: ROW_Y(i) - 10, opacity: vis(t, kafkaRow(i)) }}>
                  <path d="M0 10 H70 M60 2 L72 10 L60 18" fill="none" stroke="#475569" strokeWidth={4} />
                </svg>
                <div style={{ position: 'absolute', left: 680, top: ROW_Y(i) - 56, opacity: clamp(sp(t, kafkaRow(i))), display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <PersonIcon size={70} color={NEON.sky} t={t} />
                  <span style={{ fontSize: 22, fontWeight: 900, color: '#cbd5e1' }}>C{i}</span>
                </div>
              </div>
            )
          })}
          <div style={{ position: 'absolute', left: 40, right: 40, top: IDLE_Y - 70, borderTop: '2px dashed #334155' }} />
          <div style={{ position: 'absolute', left: 600, top: IDLE_Y - 30, display: 'flex', gap: 50, opacity: clamp(sp(t, a0 + 2.4)) }}>
            {[4, 5].map((j) => (
              <div key={j} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <PersonIcon size={70} idle t={t + j} />
                <span style={{ fontSize: 22, fontWeight: 900, color: '#94a3b8' }}>C{j}</span>
              </div>
            ))}
          </div>
          <div style={{ position: 'absolute', left: 60, top: IDLE_Y - 10 }}>
            <Pill text="không còn partition → rảnh" tone="sky" size={30} o={sp(t, a0 + 2.8)} />
          </div>
        </Panel>
      </At>

    </Scene>
  )
}

/* ------------------------------------------------------------------ 2. formula */

function formula(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const piece = (k: number) => a1 + 0.6 + k * 0.9
  const gridAt = a1 + 4.2
  const cam = cameraAt(t, [
    [0, { x: 960, y: 520, s: 1.0, rx: 14 }],
    [a1 - 0.1, { x: 960, y: 380, s: 1.2 }, 1.2],
    [gridAt - 0.2, { x: 960, y: 560, s: 0.92, ry: 4 }, 1.3],
    [a2 + 0.2, { x: 960, y: 760, s: 1.1, ry: -4 }, 1.3],
  ])
  const parts: [string, string][] = [
    ['1000 MB/s', '#e2e8f0'],
    ['÷', '#94a3b8'],
    ['50 MB/s', NEON.cyan],
    ['=', '#94a3b8'],
    ['20', NEON.green],
  ]
  return (
    <Scene t={t} camera={cam} backdrop="blueprint" overlay={<div style={{ opacity: vis(t, -1, a1 - 0.2) }}><TitleCard t={t} at={a0} kicker="CÔNG THỨC" title="Cần bao nhiêu partition?" dock={a0 + 1.6} /></div>}>
      <At x={960} y={250}>
        <Pill text="partition ≥ throughput ÷ tốc độ 1 consumer" tone="sky" size={38} o={Math.min(sp(t, a0 + 1.9), vis(t, 0, a1 + 0.2))} style={{ fontFamily: MONO }} />
      </At>
      <At x={960} y={380} style={{ display: 'flex', alignItems: 'baseline', gap: 36 }}>
        {parts.map(([txt, col], k) => {
          const p = clamp(sp(t, piece(k), 12, 140), 0, 1.15)
          return (
            <span key={k} style={{ fontSize: k === 4 ? 150 : 96, fontWeight: 900, color: col, opacity: clamp(p * 1.4), transform: `translateY(${(1 - clamp(p)) * 50}px) scale(${lerp(0.7, 1, p)})`, display: 'inline-block', whiteSpace: 'nowrap', textShadow: k === 4 ? glow(NEON.green, 0.8) : undefined }}>
              {txt}
            </span>
          )
        })}
      </At>
      <At x={960} y={490} style={{ opacity: vis(t, piece(2), gridAt) }}>
        <div style={{ fontSize: 30, fontWeight: 700, color: NEON.muted }}>mục tiêu · tốc độ một consumer xử lý (gồm cả ghi DB)</div>
      </At>
      {Array.from({ length: 20 }, (_, i) => {
        const p = clamp(sp(t, gridAt + i * 0.05, 13, 150), 0, 1.1)
        return (
          <At key={i} x={420 + (i % 10) * 120} y={580 + Math.floor(i / 10) * 160} style={{ opacity: clamp(p * 1.4), transform: `translate(-50%,-50%) scale(${lerp(0.4, 1, p)})` }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 90, height: 54, borderRadius: 12, border: `3px solid ${NEON.sky}`, background: 'linear-gradient(180deg,#1d4ed8,#172554)', display: 'grid', placeItems: 'center', fontSize: 22, fontWeight: 900 }}>P{i}</div>
              <PersonIcon size={42} t={t} />
            </div>
          </At>
        )
      })}
      <At x={960} y={900}>
        <Panel t={t} at={a2 + 0.3} w={1300} h={230} tone="green" strong>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10 }}>
            <div style={{ fontFamily: MONO, fontSize: 40, fontWeight: 800, color: '#cbd5e1' }}>
              ghi: 1000 ÷ 100 MB/s = 10 · đọc: <span style={{ color: NEON.green }}>20</span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 58, fontWeight: 900 }}>
              max(20, 10) × 1,5 = <span style={{ color: NEON.green, textShadow: glow(NEON.green, 0.6) }}>30 partition</span>
            </div>
          </div>
        </Panel>
      </At>
    </Scene>
  )
}

/* ------------------------------------------------------------------ 3. the cost of too many */

function Meter({ x, y, title, value, fill, at, t }: { x: number; y: number; title: string; value: string; fill: number; at: number; t: number }) {
  const bad = fill >= 1
  return (
    <At x={x} y={y}>
      <Panel t={t} at={at} w={760} h={250} tone={bad ? 'red' : 'blue'} strong={bad}>
        <div style={{ padding: '30px 40px' }}>
          <div style={label}>{title}</div>
          <div style={{ fontSize: 58, fontWeight: 900, marginTop: 8, color: bad ? '#fecaca' : '#fff' }}>{value}</div>
          <div style={{ height: 22, borderRadius: 11, background: '#0f1525', marginTop: 16, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(1, fill) * 100}%`, height: '100%', background: bad ? NEON.red : NEON.sky, boxShadow: glow(bad ? NEON.red : NEON.sky, 0.4) }} />
          </div>
        </div>
      </Panel>
    </At>
  )
}

function cost(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const n = Math.round(10 ** lerp(1, 4, span(t, a0 + 0.3, a0 + 2.2)))
  const d1 = c.end(1) - a1
  const mAt = (k: number) => a1 + d1 * (0.12 + k * 0.28)
  const grow = (k: number) => span(t, mAt(k) + 0.3, mAt(k) + 1.6)
  const election = Math.round(lerp(0, 10000, span(t, a2 + 1.0, c.duration)))
  const cam = cameraAt(t, [
    [0, { x: 960, y: 420, s: 1.2, rx: 10 }],
    [a1 - 0.2, { x: 560, y: 560, s: 1.1, ry: 6 }, 1.1],
    [mAt(1) - 0.2, { x: 1360, y: 560, s: 1.1, ry: -6 }, 1.1],
    [mAt(2) - 0.2, { x: 960, y: 800, s: 1.05 }, 1.1],
    [a2 - 0.1, { x: 960, y: 560, s: 0.82 }, 1.3],
  ])
  return (
    <Scene
      t={t}
      camera={cam}
      backdrop="servers"
      overlay={
        <>
          <At x={960} y={130} style={{ opacity: vis(t, -1, a1 - 0.1) }}>
            <Kinetic t={t} at={a0 + 0.1} text={`${n.toLocaleString('vi-VN')} partition?`} size={110} color="#fde68a" glowColor={NEON.amber} />
          </At>
          <At x={960} y={960}>
            <Stamp t={t} at={c.end(2) - 0.6} text="HỒI PHỤC CHẬM" size={76} />
          </At>
        </>
      }
    >
      <Meter x={560} y={420} title="FILE TRÊN ĐĨA" value={`${(n * 3).toLocaleString('vi-VN')}+ file`} fill={grow(0)} at={mAt(0)} t={t} />
      <Meter x={1360} y={420} title="RAM PRODUCER (16KB × partition)" value={`${Math.round((n * 16) / 1024)} MB > 32 MB`} fill={grow(1) * 1.1} at={mAt(1)} t={t} />
      <Meter x={960} y={720} title="MỖI LÔ TIN" value="nhỏ dần → nén kém" fill={grow(2)} at={mAt(2)} t={t} />
      <At x={960} y={560} style={{ opacity: vis(t, a2, Infinity) }}>
        <div style={{ position: 'relative', width: 1500, height: 820 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,7,15,0.95)', borderRadius: 30 }} />
          <div style={{ position: 'absolute', left: 120, top: 200 }}>
            <Panel t={t} at={a2 + 0.1} w={420} h={300} tone="red" strong>
              <div style={{ padding: 36 }}>
                <div style={label}>BROKER 2</div>
                <div style={{ fontSize: 120, fontWeight: 900, color: NEON.red, textAlign: 'center', textShadow: glow(NEON.red) }}>✗</div>
              </div>
            </Panel>
          </div>
          <div style={{ position: 'absolute', left: 640, top: 250, width: 760 }}>
            <div style={{ ...label, color: '#fecaca' }}>BẦU LEADER MỚI</div>
            <div style={{ fontSize: 76, fontWeight: 900, fontFamily: MONO, marginTop: 10 }}>{election.toLocaleString('vi-VN')} / 10.000</div>
            <div style={{ height: 26, borderRadius: 13, background: '#1e2433', marginTop: 20, overflow: 'hidden' }}>
              <div style={{ width: `${(election / 10000) * 100}%`, height: '100%', background: NEON.amber }} />
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: NEON.muted, marginTop: 18 }}>từng partition một…</div>
          </div>
        </div>
      </At>
    </Scene>
  )
}

/* ------------------------------------------------------------------ 4. divisible counts */

/** Two shades of the primary blue, alternating per consumer, so groups are visible without a rainbow. */
const CONSUMER_TONES = ['#60a5fa', '#1d4ed8']

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

function divisible(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const d1 = c.end(1) - a1
  const cycleEnd = a1 + d1 * 0.5
  const ks = [1, 2, 3, 4, 6]
  const kIdx = Math.min(ks.length - 1, Math.floor(span(t, a1 + 0.2, cycleEnd) * ks.length))
  const uneven = t >= cycleEnd
  const n = uneven ? 10 : 12
  const k = uneven ? 4 : t >= a1 + 0.2 ? ks[kIdx] : 1
  const loads = Array.from({ length: k }, (_, j) => Array.from({ length: n }, (_, i) => owner(i, n, k)).filter((o) => o === j).length)
  const cam = cameraAt(t, [
    [0, { x: 960, y: 480, s: 1.1, rx: 16 }],
    [a0 + 0.3, { x: 960, y: 500, s: 1.0 }, 1.6],
    [cycleEnd - 0.2, { x: 960, y: 620, s: 1.06, ry: -4 }, 1.0],
    [a2 - 0.1, { x: 960, y: 560, s: 0.86 }, 1.2],
  ])
  return (
    <Scene
      t={t}
      camera={cam}
      backdrop="studio"
      overlay={
        <>
          <At x={960} y={985}>
            <Pill text="mẹo: chọn số chia hết cho nhiều số consumer" tone="sky" size={38} o={Math.min(sp(t, a0 + 0.2), vis(t, 0, a1))} />
          </At>
          <At x={960} y={980} style={{ display: 'flex', gap: 30, opacity: vis(t, a2 + 0.2) }}>
            <Pill text="tăng partition ✓" tone="green" size={40} />
            <Pill text="giảm partition ✗" tone="red" size={40} />
            <Pill text="topic có key → tạo đủ từ đầu" tone="amber" size={40} />
          </At>
        </>
      }
    >
      <At x={960} y={250}>
        <div style={{ fontSize: 64, fontWeight: 900 }}>
          {n} partition · {k} consumer → <span style={{ color: uneven ? NEON.red : NEON.green }}>{uneven ? 'lệch 3-3-2-2' : `mỗi người ${n / k}`}</span>
        </div>
      </At>
      {Array.from({ length: n }, (_, i) => {
        const o = owner(i, n, k)
        const col = CONSUMER_TONES[o % CONSUMER_TONES.length]
        const w = 1440 / n
        return (
          <div
            key={`${n}-${i}`}
            style={{
              position: 'absolute',
              left: 240 + i * w + 6,
              top: 360,
              width: w - 12,
              height: 120,
              borderRadius: 16,
              border: `4px solid ${col}`,
              background: `linear-gradient(180deg, ${col}55, ${col}18)`,
              boxShadow: glow(col, 0.35),
              display: 'grid',
              placeItems: 'center',
              fontSize: 34,
              fontWeight: 900,
              opacity: clamp(sp(t, (uneven ? cycleEnd : 0.2) + i * 0.04)),
            }}
          >
            P{i}
          </div>
        )
      })}
      {loads.map((ld, j) => {
        const col = CONSUMER_TONES[j % CONSUMER_TONES.length]
        const heavy = uneven && ld === Math.max(...loads)
        const w = 1440 / k
        return (
          <div key={`${k}-${j}`} style={{ position: 'absolute', left: 240 + j * w + w / 2 - 70, top: 540, width: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: clamp(sp(t, (uneven ? cycleEnd : a1) + j * 0.06)) }}>
            <PersonIcon size={70} color={col} t={t} />
            <div style={{ width: 70, height: ld * 70, borderRadius: 10, background: heavy ? NEON.red : col, boxShadow: glow(heavy ? NEON.red : col, 0.5) }} />
            <div style={{ fontSize: 34, fontWeight: 900, color: heavy ? NEON.red : '#e2e8f0' }}>{ld}</div>
          </div>
        )
      })}
      <At x={960} y={900}>
        <Pill text="2 consumer gánh nặng hơn → thành nút cổ chai" tone="red" size={34} o={Math.min(sp(t, cycleEnd + 1.6), vis(t, 0, a2))} />
      </At>
    </Scene>
  )
}

/* ------------------------------------------------------------------ 5. summary */

function summary(t: number, c: Cue) {
  return (
    <SummaryGrid
      t={t}
      cue={c}
      cards={[
        { title: 'Trần song song', body: 'consumer làm việc ≤ số partition', tone: 'blue' },
        { title: 'Throughput ÷ 1 consumer', body: 'lấy max với phía ghi, cộng phần dư', tone: 'green' },
        { title: 'Nhiều quá cũng hại', body: 'file, RAM producer, lô nhỏ, hồi phục chậm', tone: 'red' },
        { title: 'Chọn số chia đều', body: '12, 24, 60… · tạo đủ từ đầu', tone: 'amber' },
      ]}
    />
  )
}

const RENDERS: Record<string, LessonScene['render']> = { hook, parallel, formula, cost, divisible, summary }

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const partitionCountLesson: Lesson = {
  ...partitionCountScript,
  scenes: partitionCountScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id] })),
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
