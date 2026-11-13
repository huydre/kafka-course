import type { CSSProperties } from 'react'
import { cameraAt, clamp, lerp, move, sp, span, vis, type Shot } from '../player/motion-kit'
import { ConsumerUnit, HERO, Icon3D, LogTape, Packets, ProducerBox, Rise, SOFT, SOFT_PANEL, Sheen, SoftScene, SoftTheme, Statement, SummaryList, Wire } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene, SceneSfx } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { keyPartitionScript } from './key-partition-script'

/** This lesson is drawn in the navy glow style. */
const INK = SOFT
const HERO_SHADOW = '0 0 34px rgba(77,141,255,0.6), 0 24px 50px rgba(0,4,30,0.6), inset 0 2px 0 rgba(255,255,255,0.5), inset 0 -8px 16px rgba(0,10,60,0.35)'
const WIDE: Shot = { x: 960, y: 540, s: 1 }

/* Toy hash values chosen so the arithmetic is easy to follow on screen. */
const HASH: Record<string, number> = { A: 7, B: 9, C: 14 }
const KEY_LOOK: Record<string, { grad: string; glow: string }> = {
  A: { grad: 'linear-gradient(160deg,#9cc4ff 0%,#3f78f5 55%,#1c3fc4 100%)', glow: '#5b97ff' },
  B: { grad: 'linear-gradient(160deg,#8ff5cb 0%,#22c488 55%,#0e7a52 100%)', glow: '#3ee6a0' },
  C: { grad: 'linear-gradient(160deg,#ffd98a 0%,#f0a43a 55%,#b36a10 100%)', glow: '#ffb547' },
}
const RED_GRAD = 'linear-gradient(160deg,#ff9aa5 0%,#ff5a6a 55%,#b81f33 100%)'

/* World layout (1920×1080): producer → partitioner → partition tapes → consumers, all on one horizontal axis. */
const PROD = { x: 90, y: 490, w: 300 }
const MACH = { cx: 640, cy: 540, w: 320, h: 250 }
const TX = 1000
const CW = 80
const CELLS = 6
const LANE_END = TX + CELLS * CW
const CONS_X = 1580
const WAIT = { x: MACH.cx, y: MACH.cy - 170 }
const laneTop = (i: number, q: number) => lerp(320 + i * 200, 270 + i * 165, q)
const laneY = (i: number, q: number) => laneTop(i, q) + 35
/* LogTape prints offsetOf(i) as text; an empty string hides the tick label (these tapes show chips, not offsets). */
const NO_OFFSET = (() => '') as unknown as (i: number) => number
const slotX = (slot: number) => TX + slot * CW + CW / 2

interface Msg {
  label: string
  start: number
  mod: number
}
type Placed = Msg & { key: string; p: number; slot: number }

/** Give each message its partition and slot, in send order, continuing from earlier fills. */
function place(msgs: Msg[], prior: Record<number, number> = {}): Placed[] {
  const fill = { ...prior }
  return msgs.map((m) => {
    const key = m.label[0]
    const p = HASH[key] % m.mod
    const slot = fill[p] ?? 0
    fill[p] = slot + 1
    return { ...m, key, p, slot }
  })
}

const FIRST_ORDER = ['A1', 'B1', 'C1', 'A2', 'A3', 'B2']
const firstWave = (c: Cue) => {
  const d2 = c.end(2) - c.at(2)
  const starts = [c.at(1) + 0.6, c.at(2) + 0.4, c.at(2) + d2 * 0.55, c.at(3) + 0.2, c.at(3) + 1.2, c.at(3) + 2.2]
  return place(FIRST_ORDER.map((label, i) => ({ label, start: starts[i], mod: 3 })))
}
/** Final layout of the first wave (time does not matter for slots). */
const FIRST = place(FIRST_ORDER.map((label) => ({ label, start: 0, mod: 3 })))
const PRIOR = FIRST.reduce<Record<number, number>>((acc, m) => ({ ...acc, [m.p]: Math.max(acc[m.p] ?? 0, m.slot + 1) }), {})
const secondWave = (c: Cue) => {
  const d2 = c.end(2) - c.at(2)
  return place(
    [
      { label: 'A4', start: c.at(1) + 0.5, mod: 4 },
      { label: 'B3', start: c.at(2) + 0.2, mod: 4 },
      { label: 'C2', start: c.at(2) + d2 * 0.45, mod: 4 },
    ],
    PRIOR,
  )
}

/** Where a message is at time t: producer → hops onto the partitioner → arcs into its lane slot. `land` = 0..1 of the last hop. */
function flight(m: Placed, t: number, q: number) {
  const a = move(t, m.start, 0.5)
  const land = move(t, m.start + 1.1, 0.65)
  const tx = slotX(m.slot)
  const ty = laneY(m.p, q)
  const x = land > 0 ? lerp(WAIT.x, tx, land) : lerp(PROD.x + 330, WAIT.x, a)
  const y = land > 0 ? lerp(WAIT.y, ty, land) - Math.sin(Math.PI * land) * 110 : lerp(PROD.y + 50, WAIT.y, a) - Math.sin(Math.PI * a) * 50
  return { x, y, land }
}

/** Pill with a luminous outline (labels, formulas, verdicts). Centred on (x, y). */
function GlowPill({ x, y, text, o = 1, color = '#6ea2ff', size = 30, mono = false }: { x: number; y: number; text: string; o?: number; color?: string; size?: number; mono?: boolean }) {
  const k = clamp(o)
  if (k <= 0) return null
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, calc(-50% + ${(1 - k) * 14}px))`,
        padding: '10px 26px',
        borderRadius: 999,
        background: 'rgba(8,22,82,0.92)',
        border: `1.5px solid ${color}`,
        boxShadow: `0 0 18px ${color}aa, inset 0 1px 0 rgba(255,255,255,0.15)`,
        color: '#ffffff',
        fontSize: size,
        fontWeight: 800,
        fontFamily: mono ? MONO : undefined,
        whiteSpace: 'nowrap',
        opacity: k,
      }}
    >
      {text}
    </div>
  )
}

/** One message as a glossy tile exactly the size of a tape cell. `lit` adds a white rim, `red` cross-fades to the error colour. */
function Chip({ x, y, label, o = 1, lit = 0, red = 0 }: { x: number; y: number; label: string; o?: number; lit?: number; red?: number }) {
  const look = KEY_LOOK[label[0]] ?? KEY_LOOK.A
  const w = CW - 6
  return (
    <div
      style={{
        position: 'absolute',
        left: x - w / 2,
        top: y - 35,
        width: w,
        height: 70,
        boxSizing: 'border-box',
        borderRadius: 14,
        overflow: 'hidden',
        background: look.grad,
        border: `2px solid rgba(255,255,255,${0.35 + 0.6 * lit})`,
        boxShadow: `inset 0 2px 0 rgba(255,255,255,0.55), 0 0 ${12 + 26 * lit}px ${look.glow}, 0 0 ${28 * red}px ${INK.bad}, 0 8px 16px rgba(0,8,50,0.5)`,
        display: 'grid',
        placeItems: 'center',
        opacity: clamp(o),
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: RED_GRAD, opacity: red }} />
      <span style={{ position: 'relative', fontSize: 32, fontWeight: 800, color: '#ffffff', textShadow: '0 2px 6px rgba(0,0,40,0.55)' }}>{label}</span>
    </div>
  )
}

/** A message in the air or landed in its slot: one element, so landing never swaps anything. */
function MsgChip({ m, t, q, red = 0, lit = 0 }: { m: Placed; t: number; q: number; red?: number; lit?: number }) {
  if (t < m.start) return null
  const f = flight(m, t, q)
  return <Chip x={f.x} y={f.y} label={m.label} o={span(t, m.start, m.start + 0.2)} lit={Math.max(lit, 1 - f.land)} red={red} />
}

/** Expanding ring where a message lands. */
function Ring({ x, y, t, at, color }: { x: number; y: number; t: number; at: number; color: string }) {
  const p = span(t, at, at + 0.7)
  if (p <= 0 || p >= 1) return null
  const w = (CW - 6) * (1 + 0.6 * p)
  const h = 70 * (1 + 0.6 * p)
  return <div style={{ position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, borderRadius: 18, border: `3px solid ${color}`, opacity: 1 - p, boxSizing: 'border-box' }} />
}

/** A partition: P-label pill + empty tape. `hot` cross-fades the label to red; `fresh` marks a newly added partition. */
function Lane({ x, y, cw, cells = CELLS, label, o = 1, fresh = false, hot = 0 }: { x: number; y: number; cw: number; cells?: number; label: string; o?: number; fresh?: boolean; hot?: number }) {
  const pill: CSSProperties = { position: 'absolute', left: x - 96, top: y + 9, width: 76, height: 52, borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: 30, fontWeight: 800, color: '#ffffff', boxSizing: 'border-box' }
  const edge = fresh ? INK.good : '#6ea2ff'
  return (
    <div style={{ opacity: clamp(o) }}>
      <div style={{ ...pill, background: 'rgba(8,22,82,0.92)', border: `1.5px solid ${edge}`, boxShadow: `0 0 16px ${edge}aa` }}>{label}</div>
      <div style={{ ...pill, background: 'rgba(80,12,30,0.92)', border: `1.5px solid ${INK.bad}`, boxShadow: `0 0 18px ${INK.bad}`, opacity: hot }}>{label}</div>
      <LogTape x={x} y={y} cells={cells} cellW={cw} state={() => 'empty'} tick={1000} offsetOf={NO_OFFSET} />
    </div>
  )
}

function Producer({ t, at }: { t: number; at: number }) {
  return (
    <Rise t={t} at={at}>
      <ProducerBox x={PROD.x} y={PROD.y} w={PROD.w} title="producer" line="send(key, tin)" />
    </Rise>
  )
}

/** The partitioner: a glossy block with the formula. `f` cross-fades "% 3" into "% 4"; `bump` is a gentle pulse per message. */
function Machine({ t, at, f = 0, bump = 0 }: { t: number; at: number; f?: number; bump?: number }) {
  return (
    <>
      <Rise t={t} at={at}>
        <div style={{ position: 'absolute', left: MACH.cx - MACH.w / 2, top: MACH.cy - MACH.h / 2, width: MACH.w, height: MACH.h, boxSizing: 'border-box', borderRadius: 28, background: HERO, boxShadow: HERO_SHADOW, overflow: 'hidden', transform: `scale(${1 + 0.04 * bump})` }}>
          <Sheen t={t} phase={1} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: 128, textAlign: 'center', fontSize: 26, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>partitioner</div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 168, textAlign: 'center', fontFamily: MONO, fontSize: 38, fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap' }}>
            hash(key) %{' '}
            <span style={{ display: 'inline-block', position: 'relative', width: '0.65em' }}>
              <span style={{ opacity: 1 - f }}>3</span>
              <span style={{ position: 'absolute', left: 0, top: 0, opacity: f }}>4</span>
            </span>
          </div>
        </div>
      </Rise>
      <Icon3D name="hash" x={MACH.cx} y={MACH.cy - 55} size={100} t={t} at={at + 0.15} />
    </>
  )
}

/** Wires with flowing packets: producer → partitioner → every partition. */
function Flows({ t, at, q, n }: { t: number; at: number; q: number; n: number }) {
  const out = { x: MACH.cx + MACH.w / 2 + 4, y: MACH.cy }
  return (
    <>
      <Wire from={{ x: PROD.x + PROD.w + 4, y: MACH.cy }} to={{ x: MACH.cx - MACH.w / 2 - 6, y: MACH.cy }} color={INK.line} p={move(t, at, 0.5)} flow={t} />
      <Packets t={t} from={{ x: PROD.x + PROD.w + 4, y: MACH.cy }} to={{ x: MACH.cx - MACH.w / 2 - 6, y: MACH.cy }} start={at + 0.5} every={0.5} len={0.6} size={18} />
      {Array.from({ length: n }, (_, i) => {
        const to = { x: TX - 104, y: laneY(i, q) }
        const k = i === 3 ? q : 1
        return (
          <div key={i} style={{ opacity: k }}>
            <Wire from={out} to={to} color={INK.line} p={i === 3 ? 1 : move(t, at + 0.3 + i * 0.1, 0.5)} flow={t} />
            <Packets t={t} from={out} to={to} start={at + 0.9 + i * 0.12} every={0.6} len={0.6} size={18} />
          </div>
        )
      })}
    </>
  )
}

/** Consumers parked after the lanes; `busy(i)` drives each progress bar. Non-hot ones dim once any lane is hot. */
function Consumers({ t, q, n, at, hot = [], busy }: { t: number; q: number; n: number; at: number; hot?: number[]; busy: (i: number) => number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const y = laneY(i, q)
        const isHot = hot.includes(i)
        const dim = hot.length > 0 && !isHot
        const from = { x: LANE_END + 14, y }
        const to = { x: CONS_X - 8, y }
        return (
          <div key={i} style={{ opacity: dim ? 0.4 : 1 }}>
            <Wire from={from} to={to} color={isHot ? INK.bad : INK.line} p={move(t, at + i * 0.15 - 0.2, 0.4)} flow={t} />
            <Packets t={t} from={from} to={to} start={at + 0.7 + i * 0.1} every={0.5} len={0.6} size={18} color={isHot ? INK.bad : undefined} />
            <Rise t={t} at={at + i * 0.15}>
              <ConsumerUnit x={CONS_X} y={y - 59} w={300} name={`C${i}`} parts={[`P${i}`]} t={t} busy={busy(i)} accent={isHot ? INK.bad : undefined} />
            </Rise>
          </div>
        )
      })}
    </>
  )
}

const formula = (m: Placed) => `hash(${m.key}) = ${HASH[m.key]} → ${HASH[m.key]} % ${m.mod} = ${m.p}`

/** Formula pills over the partitioner: each message's pill cross-fades into the next one's, never a hard swap. */
function Formulas({ t, wave, until = Infinity }: { t: number; wave: Placed[]; until?: number }) {
  return (
    <>
      {wave.map((m, i) => {
        const next = wave[i + 1]
        const o = span(t, m.start + 0.45, m.start + 0.8) * (1 - (next ? span(t, next.start + 0.45, next.start + 0.8) : 0)) * (Number.isFinite(until) ? 1 - span(t, until, until + 0.4) : 1)
        return <GlowPill key={m.label} x={MACH.cx} y={MACH.cy - 262} text={formula(m)} o={o} color={KEY_LOOK[m.key].glow} size={30} mono />
      })}
    </>
  )
}

const bumpOf = (t: number, wave: Placed[]) => wave.reduce((acc, m) => Math.max(acc, Math.sin(Math.PI * span(t, m.start + 0.45, m.start + 1.0))), 0)

/* ------------------------------------------------------------------ 1. lanes */

function lanes(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const LX = 730
  const LW = 150
  const top = (i: number) => 320 + i * 200
  const yc = (i: number) => top(i) + 35
  return (
    <SoftScene
      t={t}
      camera={cameraAt(t, [
        [0, WIDE],
        [a1, { x: 1000, y: 560, s: 1.1 }, 1.4],
        [a2, WIDE, 1.3],
      ])}
      title={{ kicker: 'PARTITION', text: 'Topic = nhiều làn', until: a1 }}
    >
      <div style={{ position: 'absolute', left: 560, top: 262, width: 1100, height: 590, border: `2px dashed ${INK.line}`, borderRadius: 36, background: 'rgba(20,44,130,0.28)', opacity: vis(t, a0 + 1.0) }}>
        <div style={{ position: 'absolute', left: 28, top: -26, padding: '6px 20px', borderRadius: 999, background: 'rgba(8,22,82,0.95)', border: '1.5px solid #6ea2ff', boxShadow: '0 0 16px rgba(77,141,255,0.6)', fontFamily: MONO, fontSize: 26, color: '#ffffff' }}>topic payments</div>
      </div>
      {[0, 1, 2].map((i) => (
        <Rise key={i} t={t} at={a0 + 1.3 + i * 0.35}>
          <Lane x={LX} y={top(i)} cw={LW} cells={6} label={`P${i}`} />
        </Rise>
      ))}
      {[0, 1, 2].map((i) =>
        [0, 1, 2, 3, 4, 5].map((o) => (
          <div key={`${i}-${o}`} style={{ position: 'absolute', left: LX + o * LW, top: top(i), width: LW, height: 70, display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 34, fontWeight: 800, color: '#cfe0ff', opacity: vis(t, a1 + 0.3 + i * 0.3 + o * 0.12, Infinity, 0.3) }}>
            {o === 5 ? '…' : o}
          </div>
        )),
      )}
      {/* a soft light travels along every log: "ghi nối đuôi" */}
      {[0, 1, 2].map((i) => {
        const frac = (t * 0.3 + i * 0.33) % 1
        return <div key={i} style={{ position: 'absolute', left: LX + frac * (6 * LW - LW), top: top(i), width: LW, height: 70, borderRadius: 14, background: 'radial-gradient(ellipse at center, rgba(180,210,255,0.5), transparent 70%)', opacity: Math.sin(Math.PI * frac) * vis(t, a1 + 2.0) }} />
      })}
      <div style={{ opacity: 1 - span(t, a2 - 0.2, a2 + 0.3) }}>
        <Statement x={420} y={895} text="mỗi partition = 1 log riêng · offset đếm từ 0" color={INK.faint} size={42} o={sp(t, a1 + 1.9)} />
      </div>
      {/* beat 3: a message arrives and has to pick a lane */}
      <Producer t={t} at={a2 + 0.1} />
      <div style={{ position: 'absolute', left: 220, top: 380 + Math.sin(t * 2.4) * 8, width: 80, height: 80, borderRadius: 22, background: HERO, boxShadow: HERO_SHADOW, display: 'grid', placeItems: 'center', fontSize: 52, fontWeight: 800, color: '#ffffff', opacity: vis(t, a2 + 0.6) }}>?</div>
      {[0, 1, 2].map((i) => {
        const from = { x: PROD.x + PROD.w + 6, y: 540 }
        const to = { x: LX - 106, y: yc(i) }
        return (
          <div key={i}>
            <Wire from={from} to={to} color={INK.line} p={move(t, a2 + 0.8 + i * 0.15, 0.5)} flow={t} />
            <Packets t={t} from={from} to={to} start={a2 + 1.4 + i * 0.12} every={0.5} len={0.7} size={18} />
          </div>
        )
      })}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 2. hash(key) % N */

function hash(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const d2 = c.end(2) - a2
  const wave = firstWave(c)
  const keyRows: { key: string; at: number }[] = [
    { key: 'A', at: a1 + 0.3 },
    { key: 'B', at: a2 + 0.3 },
    { key: 'C', at: a2 + d2 * 0.55 + 0.2 },
  ]
  return (
    <SoftScene
      t={t}
      camera={cameraAt(t, [
        [0, { x: 880, y: 540, s: 1.06 }],
        [a1 + 0.2, { x: 880, y: 520, s: 1.12 }, 1.3],
        [a2 + 0.2, { x: 880, y: 540, s: 1.06 }, 1.4],
        [a3 + 0.3, { x: 900, y: 560, s: 1.1 }, 1.6],
      ])}
      title={{ kicker: 'CHỌN LÀN', text: 'hash(key) % N', until: a1 }}
    >
      <Producer t={t} at={a0 + 0.9} />
      <Machine t={t} at={a0 + 1.3} bump={bumpOf(t, wave)} />
      {[0, 1, 2].map((i) => (
        <Rise key={i} t={t} at={a0 + 1.7 + i * 0.2}>
          <Lane x={TX} y={laneTop(i, 0)} cw={CW} label={`P${i}`} />
        </Rise>
      ))}
      <Flows t={t} at={a0 + 2.0} q={0} n={3} />
      <GlowPill x={MACH.cx} y={MACH.cy + 190} text="partition = hash(key) % 3" o={Math.min(sp(t, a0 + 2.5), 1 - span(t, a1, a1 + 0.4))} color={INK.accent} size={28} mono />
      {/* hash table of the keys, filled as each key is introduced */}
      <Rise t={t} at={a1 + 0.1}>
        <div style={{ ...SOFT_PANEL, left: 90, top: 690, width: 300, boxSizing: 'border-box', padding: '16px 24px' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: INK.faint, height: 36 }}>hash của key</div>
          {keyRows.map((r) => (
            <div key={r.key} style={{ height: 64, display: 'flex', alignItems: 'center' }}>
              <Rise t={t} at={r.at}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                  <div style={{ width: 64, height: 52, borderRadius: 12, background: KEY_LOOK[r.key].grad, display: 'grid', placeItems: 'center', fontSize: 30, fontWeight: 800, boxShadow: `0 0 14px ${KEY_LOOK[r.key].glow}` }}>{r.key}</div>
                  <div style={{ fontFamily: MONO, fontSize: 32, fontWeight: 800 }}>→ {HASH[r.key]}</div>
                </div>
              </Rise>
            </div>
          ))}
        </div>
      </Rise>
      <Formulas t={t} wave={wave} />
      {wave.map((m) => (
        <MsgChip key={m.label} m={m} t={t} q={0} />
      ))}
      {wave.map((m) => (
        <Ring key={m.label} x={slotX(m.slot)} y={laneY(m.p, 0)} t={t} at={m.start + 1.75} color={KEY_LOOK[m.key].glow} />
      ))}
      <Statement x={1000} y={850} text="A luôn vào P1" color="#9cc4ff" size={64} o={sp(t, a3 + 2.0)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 3. order inside a lane */

function order(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const As = FIRST.filter((m) => m.key === 'A')
  const litA = span(t, a0 + 1.4, a0 + 1.75)
  const topY = laneTop(1, 0)
  return (
    <SoftScene
      t={t}
      camera={cameraAt(t, [
        [0, WIDE],
        [a0 + 1.0, { x: 960, y: 540, s: 1.04 }, 1.8],
        [a1, WIDE, 1.4],
      ])}
      title={{ kicker: 'THỨ TỰ', text: 'Chỉ có TRONG một làn', until: a1 }}
    >
      <Producer t={t} at={0.6} />
      <Machine t={t} at={0.8} />
      <Flows t={t} at={1.2} q={0} n={3} />
      {[0, 1, 2].map((i) => (
        <Rise key={i} t={t} at={0.6 + i * 0.2}>
          <Lane x={TX} y={laneTop(i, 0)} cw={CW} label={`P${i}`} />
        </Rise>
      ))}
      {FIRST.map((m, k) => (
        <Rise key={m.label} t={t} at={1.3 + k * 0.12}>
          <Chip x={slotX(m.slot)} y={laneY(m.p, 0)} label={m.label} lit={m.key === 'A' ? litA : 0} />
        </Rise>
      ))}
      <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
        {As.slice(1).map((m, i) => {
          const x1 = slotX(As[i].slot)
          const x2 = slotX(m.slot)
          return (
            <path
              key={m.label}
              d={`M${x1} ${topY - 2} Q ${(x1 + x2) / 2} ${topY - 70}, ${x2} ${topY - 2}`}
              fill="none"
              stroke={INK.good}
              strokeWidth={7}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1 - move(t, a0 + 1.7 + i * 0.6, 0.5)}
              style={{ filter: `drop-shadow(0 0 8px ${INK.good})` }}
            />
          )
        })}
      </svg>
      <GlowPill x={TX + (CELLS * CW) / 2} y={laneY(1, 0) + 85} text="A1 → A2 → A3 ✓" o={Math.min(sp(t, a0 + 2.8), 1 - span(t, a1, a1 + 0.4))} color={INK.good} size={32} />
      <Consumers t={t} q={0} n={3} at={a1 + 0.3} busy={(i) => 0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7)} />
      <GlowPill x={1500} y={190} text="mỗi consumer đọc 1 làn · chạy song song" o={Math.min(sp(t, a1 + 1.1), 1 - span(t, a2, a2 + 0.4))} size={30} />
      {/* beat 3: no order between lanes, so the thing that needs order becomes the key */}
      <div style={{ opacity: 1 - span(t, a2 + 2.5, a2 + 2.9) }}>
        <Statement x={430} y={885} text="giữa các partition: không có thứ tự chung" color={INK.warn} size={44} o={sp(t, a2 + 0.2)} />
      </div>
      <Rise t={t} at={a2 + 2.8}>
        <div style={{ ...SOFT_PANEL, left: 120, top: 880, fontFamily: MONO, fontSize: 32, fontWeight: 700, whiteSpace: 'pre' }}>
          <span>producer.send(</span>
          <span>"payments", </span>
          <span style={{ color: INK.good }}>walletId</span>
          <span>, event);</span>
        </div>
      </Rise>
      <GlowPill x={1330} y={910} text="key = wallet_id ✓" o={sp(t, a2 + 3.8)} color={INK.good} size={32} />
      <GlowPill x={1700} y={910} text="key = order_id ✗" o={sp(t, a2 + 4.5)} color={INK.bad} size={32} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 4. adding a partition */

function resize(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const q = move(t, a0 + 2.0, 1.2)
  const flipAt = a0 + 2.6
  const f = span(t, flipAt, flipAt + 0.4)
  const wave = secondWave(c)
  const A3 = FIRST.find((m) => m.label === 'A3')!
  const A4 = wave[0]
  const linkAt = A4.start + 1.9
  const warn = span(t, a3 + 0.2, a3 + 0.55)
  const raceA = a3 + 1.6
  const prog3 = span(t, raceA + 0.9, raceA + 4.5)
  const prog4 = span(t, raceA + 0.9, raceA + 2.3)
  const c1y = laneY(1, 1)
  const c3y = laneY(3, 1)
  const linkFrom = { x: slotX(A3.slot), y: c1y + 35 }
  const linkTo = { x: slotX(A4.slot) + 38, y: c3y }
  const flyChip = (label: string, start: number, y: number, o = 1) => {
    const p = move(t, start, 0.9)
    return <Chip x={lerp(LANE_END - 36, CONS_X + 250, p)} y={y} label={label} o={span(t, start, start + 0.2) * o} />
  }
  return (
    <SoftScene
      t={t}
      camera={cameraAt(t, [
        [0, WIDE],
        [a0 + 1.6, { x: 880, y: 540, s: 1.06 }, 1.4],
        [a1 + 0.2, { x: 900, y: 580, s: 1.1 }, 1.3],
        [a2, { x: 880, y: 560, s: 1.04 }, 1.3],
        [a3 + 0.3, { x: 960, y: 560, s: 1.03 }, 1.5],
      ])}
      title={{ kicker: 'THÊM PARTITION', text: 'Key đổi nhà', until: a1 }}
    >
      <Producer t={t} at={0.9} />
      <Machine t={t} at={1.2} f={f} bump={Math.max(bumpOf(t, wave), Math.sin(Math.PI * span(t, flipAt, flipAt + 0.6)))} />
      {[0, 1, 2].map((i) => (
        <Rise key={i} t={t} at={1.5 + i * 0.2}>
          <Lane x={TX} y={laneTop(i, q)} cw={CW} label={`P${i}`} hot={i === 1 ? warn : 0} />
        </Rise>
      ))}
      <Lane x={TX} y={laneTop(3, q)} cw={CW} label="P3" fresh o={q} hot={warn} />
      <Flows t={t} at={1.9} q={q} n={4} />
      {FIRST.map((m, k) => (
        <Rise key={m.label} t={t} at={2.0 + k * 0.1}>
          <Chip x={slotX(m.slot)} y={laneY(m.p, q)} label={m.label} red={m.label === 'A3' ? warn : 0} lit={m.label === 'A3' ? warn : 0} />
        </Rise>
      ))}
      <Formulas t={t} wave={wave} until={a3} />
      {wave.map((m) => (
        <MsgChip key={m.label} m={m} t={t} q={1} red={m.label === 'A4' ? warn : 0} lit={m.label === 'A4' ? warn : 0} />
      ))}
      {wave.map((m) => (
        <Ring key={m.label} x={slotX(m.slot)} y={laneY(m.p, 1)} t={t} at={m.start + 1.75} color={KEY_LOOK[m.key].glow} />
      ))}
      <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
        <path
          d={`M${linkFrom.x} ${linkFrom.y} C ${linkFrom.x + 140} ${linkFrom.y + 55}, ${linkFrom.x + 140} ${linkTo.y - 40}, ${linkTo.x} ${linkTo.y}`}
          fill="none"
          stroke={INK.bad}
          strokeWidth={6}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="0.035 0.03"
          strokeDashoffset={-t * 0.4}
          opacity={move(t, linkAt, 0.5)}
          style={{ filter: `drop-shadow(0 0 8px ${INK.bad})` }}
        />
      </svg>
      <GlowPill x={MACH.cx} y={MACH.cy + 190} text="7 % 3 = 1   →   7 % 4 = 3" o={Math.min(sp(t, a1 + 0.4), 1 - span(t, a3, a3 + 0.4))} color={INK.warn} size={32} mono />
      <Consumers t={t} q={1} n={4} at={a3 + 0.3} hot={[1, 3]} busy={(i) => (i === 1 ? prog3 : i === 3 ? prog4 : 0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7))} />
      {flyChip('A3', raceA, c1y, 1 - span(t, raceA + 4.5, raceA + 4.8))}
      {flyChip('A4', raceA, c3y, 1 - span(t, raceA + 2.3, raceA + 2.6))}
      <Icon3D name="tick" x={CONS_X + 205} y={c3y} size={70} t={t} at={raceA + 2.3} />
      <Icon3D name="tick" x={CONS_X + 205} y={c1y} size={70} t={t} at={raceA + 4.5} />
      <Icon3D name="thumb-down" x={440} y={915} size={110} t={t} at={raceA + 2.4} />
      <Statement x={540} y={880} text="SAI THỨ TỰ: A4 xong trước A3" color={INK.bad} size={56} o={sp(t, raceA + 2.5)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 5. summary */

function summary(t: number, c: Cue) {
  return (
    <SoftTheme>
      <SummaryList t={t} cue={c} items={['Cùng key → cùng partition', 'Thứ tự chỉ trong 1 partition', 'Key = thứ cần giữ thứ tự', 'Thêm partition → key đổi nhà']} />
    </SoftTheme>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { lanes, hash, order, resize, summary }

/** Key-moment sounds, timed to the same cue offsets the scenes animate on. */
const SFX: Record<string, SceneSfx[]> = {
  hash: [{ kind: 'ding', at: (c) => firstWave(c)[0].start + 1.75 }],
  order: [{ kind: 'ding', at: (c) => c.at(0) + 2.8 }],
  resize: [
    { kind: 'tick', at: (c) => c.at(0) + 2.6 },
    { kind: 'error', at: (c) => c.at(3) + 1.6 + 2.4 },
  ],
}

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const keyPartitionLesson: Lesson = {
  ...keyPartitionScript,
  scenes: keyPartitionScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id], sfx: SFX[s.id] })),
  roadmap: [
    'Chặng 1: Partition là gì — vì sao một topic phải chia làn.',
    'Chặng 2: Key chọn làn bằng hash(key) % N, và thứ tự chỉ có trong một làn.',
    'Chặng 3: Cái bẫy khi thêm partition — key "đổi nhà", và tự tay thử trên mô phỏng.',
  ],
  sections: [
    {
      id: 'partition-la-gi',
      title: 'Partition: các làn đường của một topic',
      blocks: [
        { kind: 'video', scenes: ['lanes'] },
        {
          kind: 'p',
          text: 'Một topic được chia thành nhiều **partition**. Mỗi partition là **một log riêng**: ghi nối đuôi, offset đếm riêng từ 0. Partition là **đơn vị song song** của Kafka: mỗi partition có thể nằm trên broker khác nhau và được consumer khác nhau đọc cùng lúc.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          text: 'Offset chỉ có nghĩa **trong một partition**. "Offset 5" của P0 và "offset 5" của P1 là hai tin hoàn toàn khác nhau.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q(
              'Topic `payments` có 3 partition. Câu nào đúng?',
              ['Cả topic có một dãy offset chung', 'Mỗi partition có dãy offset riêng, bắt đầu từ 0', 'Offset do consumer tự đặt', 'Partition 0 luôn chứa tin cũ nhất của topic'],
              1,
              'Mỗi partition là một log độc lập nên có dãy offset riêng.',
            ),
          ],
        },
      ],
    },
    {
      id: 'hash-key',
      title: 'Có key: hash(key) % số partition',
      blocks: [
        { kind: 'video', scenes: ['hash'] },
        {
          kind: 'p',
          text: 'Khi tin có key, producer tính `partition = hash(key) % N` (Kafka dùng hàm **murmur2**). Cùng một key thì luôn ra cùng một hash, nên **luôn vào cùng một partition**, miễn là N không đổi.',
        },
        {
          kind: 'list',
          items: [
            { title: 'Có key', text: 'Partition được quyết định bởi hash của key → cùng key, cùng làn.' },
            { title: 'Không có key', text: 'Producer dùng **sticky partitioner**: dồn tin vào một partition cho tới khi **đầy batch**, rồi mới chuyển sang partition khác.' },
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Hot partition',
          text: 'Nếu một key chiếm phần lớn traffic (ví dụ một merchant cực lớn), cả lượng tin đó dồn vào **một** partition. Thêm consumer cũng không đỡ được làn đó.',
        },
        {
          kind: 'list',
          items: [
            { title: 'Custom partitioner', text: 'Tự viết partitioner, ví dụ dành riêng một partition cho khách hàng lớn nhất, các key còn lại hash vào những partition kia.' },
            { title: 'Không cần thứ tự theo key?', text: 'Dùng `RoundRobinPartitioner` hoặc `UniformStickyPartitioner`: chia đều bất kể key, key vẫn được gửi kèm tin cho phía đọc dùng.' },
            { title: 'Partition đích đang hỏng', text: 'Có key thì Kafka tính trên **mọi** partition, kể cả partition tạm không có leader → producer báo lỗi, **không** tự chuyển sang làn khác, vì lời hứa "cùng key, cùng làn".' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Topic có 3 partition. hash(B) = 9. Tin có key B vào partition nào?', ['P0', 'P1', 'P2', 'Ngẫu nhiên'], 0, '9 % 3 = 0 → P0, và lần nào cũng vậy vì hash của B không đổi.'),
          ],
        },
      ],
    },
    {
      id: 'thu-tu',
      title: 'Thứ tự chỉ có TRONG một partition',
      blocks: [
        { kind: 'video', scenes: ['order'] },
        {
          kind: 'p',
          text: 'Trong một partition, tin nằm đúng thứ tự ghi. Nhưng các partition được **các consumer khác nhau đọc song song**, không ai chờ ai, nên giữa các partition **không có thứ tự chung**.',
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Quy tắc vàng chọn key',
          text: 'Key = **đơn vị cần giữ thứ tự**. App ví điện tử cần nạp/rút của cùng một ví theo đúng thứ tự → key là `wallet_id`, không phải `order_id`. Key cũng nên có **nhiều giá trị khác nhau** để tải chia đều.',
        },
        {
          kind: 'table',
          head: ['Bài toán', 'Key nên chọn', 'Vì sao'],
          rows: [
            ['Số dư ví', '`wallet_id`', 'nạp/rút của cùng ví phải đúng thứ tự'],
            ['Trạng thái đơn hàng', '`order_id`', 'tạo → thanh toán → giao của cùng đơn'],
            ['Log truy cập', 'không cần key', 'không cần thứ tự, chỉ cần chia đều'],
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q(
              'App ví điện tử: giao dịch của CÙNG một ví phải xử lý đúng thứ tự. Chọn key nào?',
              ['order_id', 'wallet_id', 'timestamp', 'Không cần key'],
              1,
              'Thứ tự cần giữ là trong một ví, nên key là wallet_id. order_id làm giao dịch của cùng ví rải ra nhiều partition.',
            ),
          ],
        },
      ],
    },
    {
      id: 'them-partition',
      title: 'Cái bẫy: thêm partition làm key đổi nhà',
      blocks: [
        {
          kind: 'quiz',
          title: 'Dự đoán trước khi xem',
          questions: [
            q(
              'Topic đang có 3 partition, key A (hash 7) ở P1. Tăng lên 4 partition, bạn đoán tin MỚI của A đi đâu?',
              ['Vẫn P1', 'P3', 'Kafka tự chuyển cả tin cũ lẫn mới sang làn mới', 'Không gửi được nữa'],
              1,
              '7 % 4 = 3. Xem video để thấy hậu quả với thứ tự.',
            ),
          ],
        },
        { kind: 'video', scenes: ['resize'] },
        {
          kind: 'p',
          text: 'Khi N đổi, `hash(key) % N` đổi theo với hầu hết các key. Kafka **không di chuyển tin cũ**: tin cũ của A vẫn ở P1, tin mới sang P3. Hai consumer khác nhau xử lý song song → tin mới có thể xong **trước** tin cũ.',
        },
        {
          kind: 'list',
          items: [
            { title: 'Không giảm được', text: 'Kafka chỉ cho **tăng** số partition, không cho giảm.' },
            { title: 'Chọn dư từ đầu', text: 'Số partition ≈ max(throughput ÷ tốc độ 1 consumer, throughput ÷ tốc độ 1 partition) + dư địa tăng trưởng.' },
            { title: 'Kinh nghiệm từ sách', text: 'Ví dụ: cần 1 GB/giây, mỗi consumer 50 MB/giây → ít nhất **20 partition**. Chưa có số đo thì giữ mỗi partition **dưới ~6 GB cho mỗi ngày retention**, đặt số partition bằng hoặc bội số số broker, và đừng ước quá cao (mỗi partition tốn RAM broker, làm chậm chuyển leader).' },
            { title: 'Nếu buộc phải tăng', text: 'Làm lúc thấp điểm, chờ consumer xử lý hết tin cũ trước khi gửi tin mới, hoặc tạo topic mới rồi chuyển dần.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q(
              'Sau khi tăng từ 3 lên 4 partition, chuyện gì xảy ra với các tin CŨ của key A?',
              ['Kafka tự chuyển sang P3', 'Vẫn nằm ở P1', 'Bị xoá', 'Được nhân bản sang mọi partition'],
              1,
              'Kafka không bao giờ di chuyển dữ liệu cũ khi thêm partition, chỉ tin mới đi theo công thức mới.',
            ),
          ],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: key nào vào làn nào?',
      blocks: [
        {
          kind: 'p',
          text: 'Gõ một key và đổi số partition. **Đoán trước** rồi mới kéo: khi tăng thêm 1 partition, khoảng bao nhiêu phần key mẫu sẽ đổi nhà?',
        },
        { kind: 'widget', name: 'partition-lab' },
      ],
    },
    {
      id: 'tom-tat-video',
      title: 'Nhìn lại cả bài',
      blocks: [{ kind: 'video', scenes: ['summary'] }],
    },
  ],
  finalQuiz: [
    q(
      'Tăng từ 3 lên 4 partition. Điều gì xảy ra với key A (hash = 7)?',
      ['Vẫn vào P1 như cũ', 'Tin mới vào P3, tin cũ vẫn ở P1 → có thể xử lý lệch thứ tự', 'Kafka tự chuyển các tin cũ sang P3', 'Producer báo lỗi'],
      1,
      'Kafka không di chuyển dữ liệu cũ. 7 % 4 = 3 nên tin mới sang P3, tin cũ ở P1 do consumer khác đọc.',
    ),
    q(
      'Topic có 6 partition, nhóm consumer có 10 consumer. Lag tăng mãi. Thêm consumer thứ 11 có giúp không?',
      ['Có, càng nhiều consumer càng nhanh', 'Không, vì mỗi partition chỉ một consumer trong nhóm đọc; 4 consumer đã ngồi chơi', 'Có, nếu consumer mới ở broker khác', 'Không, vì Kafka giới hạn 10 consumer'],
      1,
      'Một partition chỉ giao cho một consumer trong nhóm (để giữ thứ tự), nên số consumer làm việc tối đa = số partition.',
    ),
    q(
      'Không gửi key, producer chuyển sang partition khác khi nào (sticky partitioner)?',
      ['Sau mỗi tin', 'Khi batch hiện tại đầy (hoặc được gửi đi)', 'Khi partition đầy', 'Mỗi 1 giây'],
      1,
      'Sticky partitioner dồn tin vào một partition cho đầy batch rồi mới đổi, để batch to hơn và ít request hơn.',
    ),
    q(
      'Một merchant chiếm 70% traffic và được dùng làm key. Triệu chứng nào dễ xảy ra?',
      ['Mọi partition đều quá tải', 'Một partition quá tải (hot partition), thêm consumer không đỡ', 'Tin bị mất', 'Topic tự tăng partition'],
      1,
      'Cùng key luôn vào một partition, nên 70% traffic dồn vào một làn duy nhất.',
    ),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao Kafka chỉ đảm bảo thứ tự trong một partition?',
      keywords: ['partition', 'log', 'consumer', 'song song'],
      modelAnswer:
        'Vì mỗi partition là một log riêng, chỉ ghi nối đuôi nên tin trong đó có thứ tự tự nhiên. Các partition được nhiều consumer đọc song song, không ai chờ ai, nên giữa các partition không có thứ tự chung. Muốn giữ thứ tự cho cái gì thì dùng nó làm key để chúng vào cùng một partition.',
    },
  ],
  recap: {
    journey:
      'Topic chia thành nhiều partition để chạy song song → tin có key vào partition hash(key) % N → cùng key cùng làn nên giữ được thứ tự → thêm partition làm % N đổi, key đổi nhà và thứ tự bị phá.',
    points: [
      { title: 'Partition', text: 'Mỗi partition là một log riêng, offset riêng, là đơn vị song song.' },
      { title: 'Key → partition', text: 'hash(key) % N: cùng key luôn cùng partition khi N không đổi.' },
      { title: 'Chọn key', text: 'Key = đơn vị cần giữ thứ tự, và có nhiều giá trị để tải chia đều.' },
      { title: 'Thêm partition', text: 'Chỉ tăng được, không giảm; tăng thì key đổi nhà → làm lúc thấp điểm.' },
    ],
  },
}
