import type { CSSProperties } from 'react'
import {
  At,
  Burst,
  CodeWindow,
  GearIcon,
  Kinetic,
  NEON,
  Panel,
  Pill,
  PlaneIcon,
  Scene,
  Stamp,
  TitleCard,
  cameraAt,
  clamp,
  glow,
  lerp,
  move,
  sp,
  span,
  vis,
  type Neon,
  type Shot,
} from '../player/motion-kit'
import type { Cue, Lesson, Scene as LessonScene } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { keyPartitionScript } from './key-partition-script'

/* Toy hash values chosen so the arithmetic is easy to follow on screen. */
const HASH: Record<string, number> = { A: 7, B: 9, C: 14 }
const KEY_TONE: Record<string, Neon> = { A: 'cyan', B: 'violet', C: 'amber' }
const KEY_GRAD: Record<string, [string, string]> = { A: ['#0891b2', '#155e75'], B: ['#7c3aed', '#4c1d95'], C: ['#d97706', '#78350f'] }

/* World layout (1920×1080 world; consumers live off-screen to the right so the camera can travel to them). */
const PRODUCER = { x: 250, y: 560 }
const MACHINE = { x: 720, y: 560 }
const LANE_X = 1080
const LANE_W = 840
const CONSUMER_X = 2110
const laneY = (i: number, q: number) => lerp(340 + i * 220, 290 + i * 170, q)
const laneH = (q: number) => lerp(140, 118, q)
const slotX = (slot: number) => LANE_X + 90 + slot * 122

const WIDE: Shot = { x: 1000, y: 560, s: 0.86 }

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

/** Spot on top of the partitioner where a message waits (fully visible) while its partition is computed. */
const WAIT = { x: MACHINE.x, y: MACHINE.y - 168 }

/** Where a message is at time t: producer → hops onto the partitioner → arcs into its lane slot. */
function flight(m: Placed, t: number, q: number) {
  const a = move(t, m.start, 0.5)
  const b = move(t, m.start + 1.1, 0.65)
  const tx = slotX(m.slot)
  const ty = laneY(m.p, q)
  const x = b > 0 ? lerp(WAIT.x, tx, b) : lerp(PRODUCER.x + 150, WAIT.x, a)
  const y = b > 0 ? lerp(WAIT.y, ty, b) - Math.sin(Math.PI * b) * 120 : lerp(PRODUCER.y, WAIT.y, a) - Math.sin(Math.PI * a) * 60
  return { x, y, visible: t >= m.start, inMachine: t >= m.start + 0.45 && t < m.start + 1.2, flying: t < m.start + 1.75 }
}

function Chip({ x, y, label, glowOn, tone }: { x: number; y: number; label: string; glowOn?: boolean; tone?: Neon }) {
  const key = label[0]
  const [from, to] = KEY_GRAD[key] ?? ['#334155', '#1e293b']
  const c = NEON[tone ?? KEY_TONE[key] ?? 'white']
  return (
    <div
      style={{
        position: 'absolute',
        left: x - 48,
        top: y - 36,
        width: 96,
        height: 72,
        borderRadius: 16,
        background: tone === 'red' ? 'linear-gradient(180deg,#dc2626,#7f1d1d)' : tone === 'green' ? 'linear-gradient(180deg,#16a34a,#14532d)' : `linear-gradient(180deg, ${from}, ${to})`,
        border: `3px solid ${c}`,
        boxShadow: `${glowOn ? glow(c, 0.9) + ', ' : ''}inset 0 3px 0 rgba(255,255,255,0.25), 0 12px 20px rgba(0,0,0,0.5)`,
        display: 'grid',
        placeItems: 'center',
        fontSize: 32,
        fontWeight: 900,
        color: '#fff',
      }}
    >
      {label}
    </div>
  )
}

/** Partition lanes as moving conveyor belts; P3 appears as the 4-lane layout blends in (q: 0 → 1). */
function Lanes({ t, q, n, enter, offsets = 0, hot = [] }: { t: number; q: number; n: number; enter?: number; offsets?: number; hot?: number[] }) {
  const h = laneH(q)
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const p = i === 3 ? clamp(sp(t, -1) * q) : enter === undefined ? 1 : clamp(sp(t, enter + i * 0.22, 14, 110), 0, 1.1)
        const y = laneY(i, q)
        const isNew = i === 3
        const isHot = hot.includes(i)
        const border = isHot ? NEON.red : isNew ? NEON.green : '#2c3b5e'
        const lane: CSSProperties = {
          position: 'absolute',
          left: LANE_X,
          top: y - h / 2,
          width: LANE_W,
          height: h,
          borderRadius: 22,
          border: `3px ${isNew ? 'dashed' : 'solid'} ${border}`,
          background: `repeating-linear-gradient(90deg, rgba(96,165,250,0.06) 0 40px, transparent 40px 80px), linear-gradient(180deg, #111a33, #0a1124)`,
          backgroundPosition: `${t * 70}px 0, 0 0`,
          boxShadow: isHot || isNew ? glow(border, 0.5) : 'inset 0 2px 0 rgba(255,255,255,0.05), 0 18px 30px rgba(0,0,0,0.45)',
          opacity: clamp(p),
          transform: `translateX(${(1 - clamp(p)) * 260}px)`,
        }
        return (
          <div key={i}>
            <div style={lane}>
              {offsets > 0 &&
                [0, 1, 2, 3, 4, 5].map((o) => (
                  <span
                    key={o}
                    style={{
                      position: 'absolute',
                      left: slotX(o) - LANE_X - 14,
                      top: h / 2 - 20,
                      fontFamily: MONO,
                      fontSize: 32,
                      fontWeight: 700,
                      color: '#7dd3fc',
                      opacity: clamp(sp(t, offsets + i * 0.2 + o * 0.12)) * 0.8,
                    }}
                  >
                    {o === 5 ? '…' : o}
                  </span>
                ))}
            </div>
            <div
              style={{
                position: 'absolute',
                left: LANE_X - 112,
                top: y - 34,
                width: 88,
                height: 68,
                borderRadius: 16,
                display: 'grid',
                placeItems: 'center',
                fontSize: 34,
                fontWeight: 900,
                color: isNew ? '#bbf7d0' : NEON.white,
                background: '#161c2c',
                border: `2px solid ${isNew ? NEON.green : '#334155'}`,
                opacity: clamp(p),
              }}
            >
              P{i}
            </div>
          </div>
        )
      })}
    </>
  )
}

/** Consumers parked at the end of each lane, with data particles streaming into them. */
function Consumers({ t, q, n, at, hot = [] }: { t: number; q: number; n: number; at: number; hot?: number[] }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const y = laneY(i, q)
        const p = clamp(sp(t, at + i * 0.15))
        const c = hot.includes(i) ? NEON.red : NEON.blue
        return (
          <div key={i} style={{ opacity: p }}>
            {[0, 1, 2].map((k) => {
              const x = LANE_X + LANE_W - 10 + (((t - at) * 120 + k * 45) % 130)
              return <div key={k} style={{ position: 'absolute', left: x, top: y - 7, width: 14, height: 14, borderRadius: 7, background: NEON.cyan, boxShadow: glow(NEON.cyan, 0.5) }} />
            })}
            <div
              style={{
                position: 'absolute',
                left: CONSUMER_X - 120,
                top: y - 50,
                width: 250,
                height: 100,
                borderRadius: 22,
                border: `3px solid ${c}`,
                background: 'linear-gradient(160deg,#2d313d,#171a22)',
                boxShadow: glow(c, hot.includes(i) ? 1 : 0.5),
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '0 22px',
                transform: `translateX(${(1 - p) * 120}px)`,
              }}
            >
              <GearIcon size={52} t={t} color={c} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 3, color: NEON.muted }}>CONSUMER</div>
                <div style={{ fontSize: 38, fontWeight: 900 }}>C{i}</div>
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}

function Producer({ t, at = -1 }: { t: number; at?: number }) {
  return (
    <At x={PRODUCER.x} y={PRODUCER.y}>
      <Panel t={t} at={at} w={300} h={230} tone="blue">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 34, gap: 14 }}>
          <PlaneIcon size={96} />
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 4 }}>PRODUCER</div>
        </div>
      </Panel>
    </At>
  )
}

function Machine({ t, mod, active, display, at = -1, flip = -1 }: { t: number; mod: number; active: boolean; display?: string; at?: number; flip?: number }) {
  const bump = flip > 0 ? Math.sin(Math.PI * span(t, flip, flip + 0.5)) : 0
  return (
    <>
      <At x={MACHINE.x} y={MACHINE.y} style={{ transform: `translate(-50%, -50%) scale(${1 + 0.15 * bump})` }}>
        <Panel t={t} at={at} w={340} h={250} tone={active ? 'cyan' : 'violet'} strong={active}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 30, gap: 10 }}>
            <GearIcon size={70} t={active ? t * 3 : t * 0.4} color={active ? NEON.cyan : NEON.violet} />
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 4, color: NEON.muted }}>PARTITIONER</div>
            <div style={{ fontFamily: MONO, fontSize: 44, fontWeight: 800, color: bump > 0.1 ? NEON.green : NEON.white }}>hash % {mod}</div>
          </div>
        </Panel>
      </At>
      <At x={MACHINE.x - 50} y={MACHINE.y - 262}>
        {display && <Pill text={display} tone="cyan" size={34} style={{ fontFamily: MONO }} />}
      </At>
    </>
  )
}

const formula = (m: Placed) => `hash(${m.key}) = ${HASH[m.key]} → ${HASH[m.key]} % ${m.mod} = ${m.p}`

function lanes(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const cam = cameraAt(t, [
    [0, { x: 1500, y: 560, s: 1.35, rx: 28, ry: -18 }],
    [a0 + 0.6, { x: 1450, y: 560, s: 1.0, rx: 6, ry: -6 }, 2.2],
    [a1, { x: 1380, y: 340, s: 1.35 }, 1.2],
    [a1 + 1.4, { x: 1680, y: 340, s: 1.35 }, 2.2],
    [a2, WIDE, 1.3],
  ])
  return (
    <Scene t={t} camera={cam} overlay={<div style={{ opacity: vis(t, -1, a1) }}><TitleCard t={t} at={a0 + 0.2} kicker="PARTITION" title="Topic = nhiều làn đường" dock={a0 + 1.5} /></div>}>
      <Lanes t={t} q={0} n={3} enter={a0 + 0.3} offsets={a1 + 0.3} />
      <At x={1500} y={170}>
        <Pill text="mỗi làn = 1 log riêng · offset từ 0" tone="sky" size={34} o={Math.min(sp(t, a1 + 0.5), vis(t, 0, a2))} />
      </At>
      <Producer t={t} at={a2 + 0.2} />
      <At x={PRODUCER.x + 60} y={PRODUCER.y - 190 + Math.sin(t * 5) * 10} style={{ opacity: clamp(sp(t, a2 + 0.7)) }}>
        <div style={{ width: 96, height: 72, borderRadius: 16, border: `3px solid ${NEON.white}`, background: '#334155', display: 'grid', placeItems: 'center', fontSize: 44, fontWeight: 900, boxShadow: glow(NEON.white, 0.4) }}>?</div>
      </At>
      <svg width={1200} height={1100} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        {[0, 1, 2].map((p) => (
          <path
            key={p}
            d={`M${PRODUCER.x + 160} ${PRODUCER.y} C 700 ${PRODUCER.y}, 820 ${laneY(p, 0)}, ${LANE_X - 130} ${laneY(p, 0)}`}
            fill="none"
            stroke="#64748b"
            strokeWidth={5}
            strokeDasharray="14 14"
            strokeDashoffset={-t * 60}
            opacity={vis(t, a2 + 1.1 + p * 0.2)}
          />
        ))}
      </svg>
    </Scene>
  )
}

function hash(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const wave = firstWave(c)
  const inside = wave.find((m) => flight(m, t, 0).inMachine)
  const A1 = wave[0]
  const cam = cameraAt(t, [
    [0, { ...WIDE, s: 0.8 }],
    [a0 + 0.3, { x: 760, y: 560, s: 1.15, ry: 6 }, 1.4],
    [A1.start + 0.2, { x: 760, y: 520, s: 1.45 }, 0.9],
    [A1.start + 1.2, { x: 1250, y: 560, s: 1.2, ry: -6 }, 1.0],
    [a2, WIDE, 1.2],
    [a3 + 0.4, { x: 1420, y: 560, s: 1.25, rx: 8 }, 1.8],
  ])
  return (
    <Scene t={t} camera={cam} overlay={<div style={{ opacity: vis(t, -1, a1) }}><TitleCard t={t} at={a0} kicker="CHỌN LÀN" title="hash(key) % N" dock={a0 + 1.3} /></div>}>
      <Lanes t={t} q={0} n={3} />
      <Producer t={t} />
      <Machine t={t} mod={3} active={!!inside} display={inside && formula(inside)} at={a0 + 0.4} />
      <At x={MACHINE.x} y={MACHINE.y + 220}>
        <Pill text="partition = hash(key) % 3" tone="violet" size={32} o={Math.min(sp(t, a0 + 1.4), vis(t, 0, a1))} style={{ fontFamily: MONO }} />
      </At>
      {wave.map((m) => {
        const f = flight(m, t, 0)
        return f.visible && <Chip key={m.label} x={f.x} y={f.y} label={m.label} glowOn={f.flying} />
      })}
      {wave.map((m) => (
        <At key={m.label} x={slotX(m.slot)} y={laneY(m.p, 0)}>
          <Burst t={t} at={m.start + 1.75} tone={KEY_TONE[m.key]} r={60} />
        </At>
      ))}
      <At x={1420} y={950}>
        <Kinetic t={t} at={a3 + 2.6} text="A → luôn P1" size={84} color="#a5f3fc" glowColor={NEON.cyan} />
      </At>
    </Scene>
  )
}

function order(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const As = FIRST.filter((m) => m.key === 'A')
  const y1 = laneY(1, 0)
  const cam = cameraAt(t, [
    [0, { x: 1330, y: 560, s: 1.6, ry: -14, rx: 6 }],
    [a0 + 0.4, { x: 1330, y: 540, s: 1.45, ry: 4 }, 2.6],
    [a1, { x: 1700, y: 560, s: 0.95, ry: -4 }, 1.5],
    [a2, { x: 1250, y: 640, s: 0.78, r: -1.5 }, 1.4],
  ])
  return (
    <Scene t={t} camera={cam} overlay={<div style={{ opacity: vis(t, -1, a1) }}><TitleCard t={t} at={a0} kicker="THỨ TỰ" title="Chỉ có TRONG một làn" dock={a0 + 1.2} /></div>}>
      <Lanes t={t} q={0} n={3} />
      <Producer t={t} />
      <Machine t={t} mod={3} active={false} />
      {FIRST.map((m) => (
        <Chip key={m.label} x={slotX(m.slot)} y={laneY(m.p, 0)} label={m.label} tone={t >= a0 + 0.6 && m.key === 'A' ? 'green' : undefined} glowOn={t >= a0 + 0.6 && m.key === 'A'} />
      ))}
      <svg width={2400} height={1200} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        {As.slice(1).map((m, i) => {
          const x1 = slotX(As[i].slot)
          const x2 = slotX(m.slot)
          return (
            <path
              key={m.label}
              d={`M${x1} ${y1 - 40} Q ${(x1 + x2) / 2} ${y1 - 120}, ${x2} ${y1 - 42}`}
              fill="none"
              stroke={NEON.green}
              strokeWidth={7}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1 - move(t, a0 + 1.0 + i * 0.6, 0.5)}
              style={{ filter: `drop-shadow(0 0 8px ${NEON.green})` }}
            />
          )
        })}
      </svg>
      <At x={slotX(1)} y={y1 - 150}>
        <Pill text="A1 → A2 → A3 ✓" tone="green" size={34} o={Math.min(sp(t, a0 + 2.2), vis(t, 0, a1))} />
      </At>
      <Consumers t={t} q={0} n={3} at={a1 + 0.3} />
      <At x={1700} y={150}>
        <Pill text="mỗi consumer đọc 1 làn · chạy song song" tone="sky" size={34} o={Math.min(sp(t, a1 + 1.0), vis(t, 0, a2))} />
      </At>
      <At x={760} y={980}>
        <CodeWindow
          t={t}
          at={a2 + 0.6}
          w={1000}
          size={30}
          lines={[
            [['// key = thứ cần giữ thứ tự', '#6b7a99']],
            [
              ['producer', '#e2e8f0'],
              ['.', '#94a3b8'],
              ['send', '#60a5fa'],
              ['("payments", ', '#e2e8f0'],
              ['walletId', '#4ade80'],
              [', event);', '#e2e8f0'],
            ],
          ]}
        />
      </At>
      <At x={1580} y={950} style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'flex-start' }}>
        <Pill text="key = wallet_id ✓" tone="green" size={38} o={sp(t, a2 + 3.0)} />
        <Pill text="key = order_id ✗" tone="red" size={38} o={sp(t, a2 + 3.6)} />
      </At>
    </Scene>
  )
}

function resize(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const q = move(t, a0 + 1.4, 1.2)
  const flipAt = a0 + 1.8
  const wave = secondWave(c)
  const inside = wave.find((m) => flight(m, t, 1).inMachine)
  const warn = t >= a3 + 0.2
  const A3 = FIRST.find((m) => m.label === 'A3')!
  const A4 = wave[0]
  const linkAt = A4.start + 1.9
  const raceA = a3 + 1.6
  const race = (speed: number) => clamp(((t - raceA) * speed) / 2.2)
  const cam = cameraAt(t, [
    [0, WIDE],
    [a0 + 0.9, { x: 760, y: 540, s: 1.45, ry: 8 }, 0.9],
    [a0 + 2.6, { ...WIDE, y: 540 }, 1.2],
    [A4.start + 1.0, { x: 1300, y: 620, s: 1.05, rx: 6 }, 1.0],
    [a2, WIDE, 1.2],
    [a3, { x: 1720, y: 560, s: 0.92, ry: -6 }, 1.4],
  ])
  return (
    <Scene
      t={t}
      camera={cam}
      overlay={
        <>
          <div style={{ opacity: vis(t, -1, a1) }}>
            <TitleCard t={t} at={a0} kicker="THÊM PARTITION" title="Key đổi nhà" tone="red" dock={a0 + 1.1} />
          </div>
          <At x={960} y={960}>
            <Stamp t={t} at={raceA + 1.6} text="SAI THỨ TỰ" size={84} />
          </At>
        </>
      }
    >
      <Lanes t={t} q={q} n={4} hot={warn ? [1, 3] : []} />
      <Producer t={t} />
      <Machine t={t} mod={q > 0.5 ? 4 : 3} active={!!inside} display={inside && formula(inside)} flip={flipAt} />
      {FIRST.map((m) => (
        <Chip key={m.label} x={slotX(m.slot)} y={laneY(m.p, q)} label={m.label} tone={warn && m.label === 'A3' ? 'red' : undefined} glowOn={warn && m.label === 'A3'} />
      ))}
      {wave.map((m) => {
        const f = flight(m, t, 1)
        const red = warn && m.label === 'A4'
        return f.visible && <Chip key={m.label} x={f.x} y={f.y} label={m.label} tone={red ? 'red' : undefined} glowOn={f.flying || red} />
      })}
      <svg width={2400} height={1200} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <path
          d={`M${slotX(A3.slot)} ${laneY(1, 1) + 40} C ${slotX(A3.slot) + 60} ${laneY(2, 1) + 40}, ${slotX(0) + 80} ${laneY(3, 1) - 90}, ${slotX(0) + 10} ${laneY(3, 1) - 40}`}
          fill="none"
          stroke={NEON.red}
          strokeWidth={6}
          strokeDasharray="16 12"
          strokeDashoffset={-t * 40}
          opacity={vis(t, linkAt)}
          style={{ filter: `drop-shadow(0 0 8px ${NEON.red})` }}
        />
      </svg>
      <At x={520} y={MACHINE.y + 330}>
        <Pill text="7 % 3 = 1   →   7 % 4 = 3" tone="amber" size={36} o={Math.min(sp(t, a1 + 0.4), vis(t, 0, a3))} style={{ fontFamily: MONO }} />
      </At>
      <Consumers t={t} q={q} n={4} at={a3 + 0.3} hot={warn ? [1, 3] : []} />
      {[
        { lane: 1, label: 'A3', speed: 0.45 },
        { lane: 3, label: 'A4', speed: 1.2 },
      ].map(({ lane, label, speed }) => (
        <div key={label} style={{ position: 'absolute', left: CONSUMER_X + 160, top: laneY(lane, 1) - 34, width: 280, opacity: vis(t, raceA) }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: NEON.white, marginBottom: 8 }}>
            xử lý {label} {race(speed) >= 1 ? '✓ xong' : '…'}
          </div>
          <div style={{ height: 20, borderRadius: 10, background: '#1e2433', overflow: 'hidden' }}>
            <div style={{ width: `${race(speed) * 100}%`, height: '100%', background: race(speed) >= 1 ? NEON.green : NEON.amber }} />
          </div>
        </div>
      ))}
    </Scene>
  )
}

function summary(t: number, c: Cue) {
  const cards: { title: string; body: string; tone: Neon }[] = [
    { title: 'Cùng key → cùng partition', body: 'vì hash(key) không đổi', tone: 'cyan' },
    { title: 'Thứ tự chỉ trong 1 partition', body: 'mỗi partition là 1 log riêng', tone: 'green' },
    { title: 'Key = thứ cần giữ thứ tự', body: 'wallet_id, user_id…', tone: 'amber' },
    { title: 'Thêm partition → key đổi nhà', body: 'vì % N đổi · làm lúc thấp điểm', tone: 'red' },
  ]
  const pos = (i: number) => ({ x: 560 + (i % 2) * 800, y: 400 + Math.floor(i / 2) * 380 })
  const keys: [number, Shot, number?][] = [[0, { x: 960, y: 580, s: 0.8, rx: 18 }]]
  cards.forEach((_, i) => keys.push([c.at(i) - 0.2, { ...pos(i), s: 1.3, ry: i % 2 ? -8 : 8 }, 1.0]))
  keys.push([c.end(3) + 0.3, { x: 960, y: 580, s: 0.82 }, 1.4])
  const cam = cameraAt(t, keys)
  return (
    <Scene t={t} camera={cam}>
      {cards.map((card, i) => {
        const { x, y } = pos(i)
        const active = t >= c.at(i) && t < c.at(i + 1)
        return (
          <At key={card.title} x={x} y={y}>
            <Panel t={t} at={c.at(i) + 0.1} w={700} h={300} tone={card.tone} strong={active}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 36, height: '100%', padding: '0 46px' }}>
                <div
                  style={{
                    width: 110,
                    height: 110,
                    flexShrink: 0,
                    borderRadius: 55,
                    border: `5px solid ${NEON[card.tone]}`,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 62,
                    fontWeight: 900,
                    color: NEON[card.tone],
                    boxShadow: glow(NEON[card.tone], 0.6),
                  }}
                >
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1.2 }}>{card.title}</div>
                  <div style={{ fontSize: 32, fontWeight: 600, color: '#cbd5e1', marginTop: 12 }}>{card.body}</div>
                </div>
              </div>
            </Panel>
          </At>
        )
      })}
    </Scene>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { lanes, hash, order, resize, summary }

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const keyPartitionLesson: Lesson = {
  ...keyPartitionScript,
  scenes: keyPartitionScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id] })),
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
