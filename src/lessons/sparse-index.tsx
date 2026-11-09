import type { CSSProperties, ReactNode } from 'react'
import {
  At,
  BookIcon,
  Burst,
  Chevrons,
  ClockIcon,
  CodeWindow,
  FlagIcon,
  HOME,
  HddIcon,
  Kinetic,
  LogFileIcon,
  NEON,
  Panel,
  Pill,
  RamIcon,
  Scene,
  Stamp,
  TitleCard,
  cameraAt,
  clamp,
  ease,
  glow,
  lerp,
  move,
  sp,
  span,
  vis,
  type Neon,
} from '../player/motion-kit'
import type { Cue, Lesson, Scene as LessonScene } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { sparseIndexScript } from './sparse-index-script'

import { POS, SIZES, TOTAL } from './sparse-index-data'
const SX0 = 160
const SC = 1600 / TOTAL
const bx = (i: number) => SX0 + POS[i] * SC
const bw = (i: number) => SIZES[i] * SC
const cx = (i: number) => bx(i) + bw(i) / 2
const SPARSE = [0, 4, 8]

type BlockState = 'idle' | 'read' | 'ask' | 'hit' | 'jump'
const BLOCK_LOOK: Record<BlockState, { from: string; to: string; border: string; glow?: string }> = {
  idle: { from: '#3b82f6', to: '#1e40af', border: '#60a5fa' },
  read: { from: '#334155', to: '#1e293b', border: '#475569' },
  ask: { from: '#0891b2', to: '#155e75', border: '#22d3ee', glow: NEON.cyan },
  hit: { from: '#16a34a', to: '#14532d', border: '#4ade80', glow: NEON.green },
  jump: { from: '#d97706', to: '#78350f', border: '#fbbf24', glow: NEON.amber },
}

/** The segment file as a row of 3D-ish blocks; block width = message size in bytes. */
function Strip({ t, y, h = 130, appear, state = () => 'idle', o = 1 }: { t: number; y: number; h?: number; appear?: number; state?: (i: number) => BlockState; o?: number }) {
  return (
    <div style={{ opacity: o }}>
      {SIZES.map((_, i) => {
        const p = appear === undefined ? 1 : clamp(sp(t, appear + i * 0.07, 13, 130), 0, 1.15)
        const look = BLOCK_LOOK[state(i)]
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: bx(i) + 5,
              top: y,
              width: bw(i) - 10,
              height: h,
              borderRadius: 14,
              background: `linear-gradient(180deg, ${look.from}, ${look.to})`,
              border: `3px solid ${look.border}`,
              boxShadow: `${look.glow ? glow(look.glow, 0.9) + ', ' : ''}inset 0 3px 0 rgba(255,255,255,0.25), 0 14px 24px rgba(0,0,0,0.5)`,
              opacity: clamp(p * 1.5),
              transform: `translateY(${(1 - clamp(p)) * 90}px) scale(${lerp(0.7, 1, clamp(p, 0, 1.1))})`,
              display: 'grid',
              placeItems: 'center',
              fontSize: h * 0.36,
              fontWeight: 900,
              color: '#fff',
              textShadow: '0 2px 6px rgba(0,0,0,0.5)',
            }}
          >
            {i}
          </div>
        )
      })}
    </div>
  )
}

/** Byte-size brackets under each block. */
function Sizes({ t, at, y }: { t: number; at: number; y: number }) {
  return (
    <>
      {SIZES.map((s, i) => {
        const o = clamp(sp(t, at + i * 0.13))
        return (
          <div key={i} style={{ position: 'absolute', left: bx(i) + 8, top: y, width: bw(i) - 16, opacity: o, transform: `translateY(${(1 - o) * 20}px)` }}>
            <div style={{ height: 14, borderLeft: `4px solid ${NEON.amber}`, borderRight: `4px solid ${NEON.amber}`, borderBottom: `4px solid ${NEON.amber}`, borderRadius: '0 0 6px 6px' }} />
            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 30, fontWeight: 900, color: '#fcd34d' }}>{s}B</div>
          </div>
        )
      })}
    </>
  )
}

/** Glowing read head (beam + marker) hovering over the strip. */
function ReadHead({ x, y, h, tone = 'cyan', o = 1 }: { x: number; y: number; h: number; tone?: Neon; o?: number }) {
  const c = NEON[tone]
  return (
    <div style={{ position: 'absolute', left: x, top: y - 46, opacity: o }}>
      <div style={{ width: 0, height: 0, borderLeft: '20px solid transparent', borderRight: '20px solid transparent', borderTop: `26px solid ${c}`, transform: 'translateX(-20px)', filter: `drop-shadow(0 0 10px ${c})` }} />
      <div style={{ position: 'absolute', left: -3, top: 30, width: 6, height: h + 30, background: `linear-gradient(${c}, ${c}00)`, boxShadow: glow(c, 0.6) }} />
    </div>
  )
}

/** Read head hopping block to block between [a, b]; pauses a moment on each block. */
function hop(t: number, from: number, to: number, a: number, b: number) {
  const prog = span(t, a, b) * (to - from)
  const i = Math.min(to - from, Math.floor(prog))
  const x = i >= to - from ? bx(to) : lerp(bx(from + i), bx(from + i + 1), ease(clamp((prog - i) * 1.5)))
  return { x: x + 20, passed: from + i }
}

/** World-space SVG layer for beams and arcs. */
function Lines({ children }: { children: ReactNode }) {
  return (
    <svg width={4000} height={2400} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
      {children}
    </svg>
  )
}
function Beam({ d, p, color }: { d: string; p: number; color: string }) {
  if (p <= 0) return null
  return <path d={d} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - clamp(p)} style={{ filter: `drop-shadow(0 0 10px ${color})` }} />
}

const label: CSSProperties = { fontSize: 26, fontWeight: 800, letterSpacing: 4, color: NEON.muted }

function problem(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const strike = lerp(a3, c.end(3), 0.5)
  const cam = cameraAt(t, [
    [0, { x: 960, y: 560, s: 1.25, rx: 30, ry: 12 }],
    [a0 + 1.4, { x: 960, y: 540, s: 1, rx: 4, ry: -3 }, 2.4],
    [a1, { x: 900, y: 600, s: 1.12 }, 2.2],
    [a2, { x: 1080, y: 640, s: 1.08, ry: -4 }],
    [a3, { x: 960, y: 640, s: 1, rx: 6 }],
  ])
  return (
    <Scene t={t} camera={cam} overlay={<TitleCard t={t} at={a0} kicker="VẤN ĐỀ" title="Segment file" dock={a0 + 1.4} />}>
      <At x={250} y={395} style={{ opacity: vis(t, a0 + 1.5), display: 'flex', alignItems: 'center', gap: 18 }}>
        <LogFileIcon size={90} />
        <span style={{ fontFamily: MONO, fontSize: 30, color: NEON.muted, fontWeight: 700 }}>00000000.log</span>
      </At>
      <Strip t={t} y={470} appear={a0 + 1.6} state={(i) => (t >= a2 + 0.3 && i === 6 ? 'ask' : 'idle')} />
      <Sizes t={t} at={a1 + 0.2} y={612} />
      <At x={cx(6)} y={400 + Math.sin(t * 4) * 8} style={{ opacity: clamp(sp(t, a2 + 0.5)), fontSize: 96, fontWeight: 900, color: NEON.cyan, textShadow: glow(NEON.cyan) }}>
        ?
      </At>
      <At x={1290} y={870} style={{ opacity: vis(t, a2, a3) }}>
        <CodeWindow
          t={t}
          at={a2 + 0.1}
          w={860}
          lines={[
            [['// consumer muốn đọc tiếp từ offset 6', '#6b7a99']],
            [
              ['consumer', '#e2e8f0'],
              ['.', '#94a3b8'],
              ['seek', '#60a5fa'],
              ['(partition, ', '#e2e8f0'],
              ['6', '#f59e0b'],
              [');', '#e2e8f0'],
            ],
          ]}
        />
      </At>
      <At x={760} y={860}>
        <div style={{ position: 'relative' }}>
          <Kinetic t={t} at={a3 + 0.2} text="6 × 100 = 600" size={120} />
          <div
            style={{
              position: 'absolute',
              left: -20,
              right: -20,
              top: '50%',
              height: 14,
              borderRadius: 7,
              background: NEON.red,
              boxShadow: glow(NEON.red),
              transformOrigin: 'left',
              transform: `scaleX(${move(t, strike, 0.35)})`,
            }}
          />
        </div>
      </At>
      <At x={1440} y={850}>
        <Stamp t={t} at={strike + 0.25} text="SAI" />
      </At>
      <At x={960} y={1000}>
        <Kinetic t={t} at={strike + 0.6} text="vì mỗi tin dài ngắn khác nhau" size={46} weight={700} color="#fcd34d" stagger={0.015} />
      </At>
    </Scene>
  )
}

function scan(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const head = hop(t, 0, 6, a1, a2 - 0.1)
  const found = t >= a2
  const stepAt = (k: number) => lerp(a1, a2 - 0.1, (k + 1) / 6) - 0.3
  // Track the read head while it scans, then pull back for the "10 million" reveal.
  const follow = Math.min(move(t, a1 - 0.3, 0.8), 1 - move(t, a3, 1))
  const base = cameraAt(t, [
    [0, { x: 960, y: 540, s: 1, rx: 10 }],
    [a0 + 1.2, HOME, 1.4],
    [a3, { x: 960, y: 560, s: 0.94, rx: 8 }, 1.4],
  ])
  const cam = { ...base, x: lerp(base.x, head.x + 160, follow), y: lerp(base.y, 640, follow), s: lerp(base.s, 1.2, follow), ry: lerp(0, -6, follow) }
  return (
    <Scene t={t} camera={cam} overlay={<TitleCard t={t} at={a0} kicker="CÁCH 1" title="Đọc từ đầu file" tone="amber" dock={a0 + 1.2} />}>
      <Strip t={t} y={470} appear={a0 + 1.0} state={(i) => (found && i === 6 ? 'hit' : i < head.passed ? 'read' : 'idle')} o={lerp(1, 0.12, move(t, a3, 0.6))} />
      <div
        style={{
          position: 'absolute',
          left: SX0,
          top: 452,
          width: Math.max(0, head.x - SX0),
          height: 8,
          borderRadius: 4,
          background: `linear-gradient(90deg, ${NEON.cyan}00, ${NEON.cyan})`,
          opacity: vis(t, a1, a2 + 0.3),
        }}
      />
      <ReadHead x={head.x} y={470} h={130} o={vis(t, a0 + 1.6, found ? a2 + 0.3 : Infinity)} />
      {SIZES.slice(0, 6).map((s, k) => (
        <At key={k} x={cx(k)} y={420 - 50 * span(t, stepAt(k), stepAt(k) + 0.9)} style={{ opacity: vis(t, stepAt(k), stepAt(k) + 0.6, 0.2), fontSize: 34, fontWeight: 900, color: '#fcd34d' }}>
          +{s}B
        </At>
      ))}
      <At x={cx(6)} y={535}>
        <Burst t={t} at={a2} tone="green" r={110} />
      </At>
      <At x={cx(6)} y={390}>
        <Pill text="byte 1390 ✓" tone="green" size={34} o={Math.min(sp(t, a2 + 0.2), vis(t, 0, a3))} />
      </At>
      <At x={960} y={850} style={{ opacity: vis(t, a1 - 0.2, a3) }}>
        <Panel t={t} at={a1 - 0.2} w={920} h={240} tone="amber">
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'space-around' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={label}>ĐÃ ĐỌC</div>
              <div style={{ fontSize: 96, fontWeight: 900, color: NEON.amber, textShadow: glow(NEON.amber, 0.5) }}>{head.passed} tin</div>
            </div>
            <div style={{ width: 3, height: 140, background: '#3a3f4f' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={label}>VỊ TRÍ BYTE</div>
              <div style={{ fontSize: 96, fontWeight: 900, color: NEON.cyan, textShadow: glow(NEON.cyan, 0.5) }}>{POS[head.passed]}</div>
            </div>
          </div>
        </Panel>
      </At>
      <At x={960} y={330}>
        <Kinetic t={t} at={a3 + 0.2} text="10 TRIỆU TIN" size={170} color="#fecaca" glowColor={NEON.red} stagger={0.05} />
      </At>
      <At x={960} y={800} style={{ opacity: vis(t, a3 + 0.9), display: 'flex', alignItems: 'center', gap: 50 }}>
        <HddIcon size={150} />
        <div>
          <div style={{ width: 760, height: 28, borderRadius: 14, background: '#1e2433', border: '2px solid #2f3850', overflow: 'hidden' }}>
            <div style={{ width: 8 + 14 * span(t, a3 + 0.9, c.duration), height: '100%', background: NEON.red, boxShadow: glow(NEON.red, 0.5) }} />
          </div>
          <div style={{ marginTop: 16, fontSize: 34, fontWeight: 700, color: NEON.muted }}>đọc tuần tự… 0,00006%</div>
        </div>
        <ClockIcon size={130} t={t} />
      </At>
    </Scene>
  )
}

/* Dense index table geometry (inside a panel centred at 960,770). */
const TABLE = { x: 960, y: 770, w: 1200, h: 420 }
const rowPos = (i: number) => ({ x: TABLE.x - TABLE.w / 2 + 330 + (i >= 5 ? 560 : 0), y: TABLE.y - TABLE.h / 2 + 118 + (i % 5) * 60 })

function dense(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const lit = t >= a1 + 0.2
  const arrive = a1 + 1.1
  const count = Math.round(10 ** lerp(1, 7, ease(span(t, a2 + 0.5, a2 + 2.2))))
  const cam = cameraAt(t, [
    [0, { x: 960, y: 620, s: 1.1, rx: 18 }],
    [a0 + 1.0, { x: 960, y: 600, s: 1, ry: 5 }, 1.6],
    [a1, { x: 1150, y: 560, s: 1.12, ry: -4 }, 1.0],
    [a2 + 0.2, { x: 1330, y: 680, s: 0.6, ry: -8 }, 1.4],
  ])
  const r6 = rowPos(6)
  return (
    <Scene t={t} camera={cam} overlay={<div style={{ opacity: vis(t, -1, a2) }}><TitleCard t={t} at={a0} kicker="CÁCH 2" title="Index dày" tone="cyan" dock={a0 + 1.2} /></div>}>
      <Strip t={t} y={300} h={110} appear={a0 + 0.9} state={(i) => (t >= arrive && i === 6 ? 'hit' : 'idle')} />
      <At x={cx(6)} y={355}>
        <Burst t={t} at={arrive} tone="green" r={100} />
      </At>
      <At x={TABLE.x} y={TABLE.y}>
        <Panel t={t} at={a0 + 1.3} w={TABLE.w} h={TABLE.h} tone="blue">
          <div style={{ ...label, position: 'absolute', left: 50, top: 28 }}>BẢNG INDEX · OFFSET → BYTE</div>
          {SIZES.map((_, i) => {
            const o = clamp(sp(t, a0 + 1.7 + i * 0.1))
            const on = lit && i === 6
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 50 + (i >= 5 ? 560 : 0),
                  top: 88 + (i % 5) * 60,
                  width: 520,
                  height: 52,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: MONO,
                  fontSize: 32,
                  fontWeight: 700,
                  color: on ? '#ecfeff' : '#cbd5e1',
                  background: on ? 'rgba(34,211,238,0.25)' : 'rgba(255,255,255,0.04)',
                  border: `2px solid ${on ? NEON.cyan : 'transparent'}`,
                  boxShadow: on ? glow(NEON.cyan, 0.5) : undefined,
                  opacity: o,
                  transform: `translateX(${(1 - o) * -30}px)`,
                }}
              >
                {i} → {POS[i]}
              </div>
            )
          })}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120, background: 'linear-gradient(transparent, rgba(239,68,68,0.35))', opacity: vis(t, a2 + 0.4) }} />
        </Panel>
      </At>
      <At x={TABLE.x} y={TABLE.y + TABLE.h / 2 + 70}>
        <Pill text={`${count.toLocaleString('vi-VN')} dòng`} tone="red" size={54} o={sp(t, a2 + 0.4)} />
      </At>
      <Lines>
        <Beam d={`M${r6.x + 262} ${r6.y} H1640 V560 C1640 470, ${cx(6)} 500, ${cx(6)} 418`} p={move(t, a1 + 0.3, 0.8)} color={NEON.cyan} />
      </Lines>
      <At x={1820} y={760}>
        <Chevrons t={t} at={a2 + 1.0} tone="red" dir="right" />
      </At>
      <At x={2420} y={740}>
        <Panel t={t} at={a2 + 0.9} w={760} h={560} tone="red" tilt={-8} strong>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 26, padding: '60px 60px 0', justifyItems: 'center' }}>
            {[0, 1, 2, 3].map((k) => (
              <div key={k} style={{ opacity: clamp(sp(t, a2 + 1.3 + k * 0.15)) }}>
                <RamIcon size={270} />
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <Kinetic t={t} at={a2 + 1.8} text="80 MB RAM" size={110} color="#fecaca" glowColor={NEON.red} />
          </div>
        </Panel>
      </At>
      <At x={1330} y={1250}>
        <Kinetic t={t} at={a2 + 2.4} text="cho chỉ MỘT segment" size={96} weight={800} color="#fcd34d" stagger={0.02} />
      </At>
    </Scene>
  )
}

/* Sparse index panel geometry. */
const SP = { x: 1060, y: 780, w: 760, h: 330 }
const spRow = (k: number) => ({ x: SP.x, y: SP.y - SP.h / 2 + 116 + k * 72 })

function sparse(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const scanAt = (k: number) => a1 + 1.0 + k * 0.8
  const picked = t >= a1 + 3.6
  const arc = move(t, a2 + 0.1, 0.8)
  const scanA = a2 + 1.5
  const scanB = Math.min(c.end(2) + 0.2, scanA + 2.2)
  const head = hop(t, 4, 6, scanA, scanB)
  const found = t >= scanB
  const out = a3 + 0.1
  const cam = cameraAt(t, [
    [0, HOME],
    [a2 + 0.8, { x: cx(5), y: 400, s: 1.45 }],
    [a3, HOME],
  ])
  return (
    <Scene t={t} camera={cam} overlay={<div style={{ opacity: vis(t, -1, a2 + 0.6) }}><TitleCard t={t} at={a0} kicker="CÁCH CỦA KAFKA" title="Sparse index" tone="amber" dock={a0 + 1.2} /></div>}>
      <div style={{ opacity: vis(t, -1, out) }}>
        <Strip
          t={t}
          y={300}
          h={110}
          appear={a0 + 0.9}
          state={(i) => (found && i === 6 ? 'hit' : t >= scanA && i >= 4 && i < head.passed ? 'read' : arc >= 1 && i === 4 ? 'jump' : 'idle')}
        />
        {SPARSE.map((o, k) => {
          const p = clamp(sp(t, a0 + 1.5 + k * 0.35, 10, 160), 0, 1.2)
          return (
            <div key={o} style={{ position: 'absolute', left: bx(o) + 4, top: 196 - (1 - clamp(p)) * 160, opacity: clamp(p * 2) }}>
              <FlagIcon size={66} />
            </div>
          )
        })}
        {[0, 1].map((k) => (
          <div key={k} style={{ position: 'absolute', left: bx(SPARSE[k]) + 10, top: 424, width: bx(SPARSE[k + 1]) - bx(SPARSE[k]) - 20, opacity: vis(t, a0 + 2.4 + k * 0.3, a1 + 0.5) }}>
            <div style={{ height: 14, border: `4px solid ${NEON.amber}`, borderTop: 'none', borderRadius: '0 0 6px 6px' }} />
            <div style={{ textAlign: 'center', marginTop: 6, fontSize: 32, fontWeight: 900, color: '#fcd34d' }}>≈ 4KB</div>
          </div>
        ))}
        <At x={SP.x} y={SP.y}>
          <Panel t={t} at={a0 + 1.9} w={SP.w} h={SP.h} tone="amber" strong={picked}>
            <div style={{ ...label, position: 'absolute', left: 44, top: 26 }}>SPARSE INDEX · 3 DÒNG</div>
            {SPARSE.map((o, k) => {
              const scanning = t >= scanAt(k) && t < scanAt(k) + 0.8
              const on = picked && o === 4
              return (
                <div
                  key={o}
                  style={{
                    position: 'absolute',
                    left: 44,
                    right: 44,
                    top: 82 + k * 72,
                    height: 60,
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 28px',
                    fontFamily: MONO,
                    fontSize: 36,
                    fontWeight: 700,
                    color: '#fef3c7',
                    background: on ? 'rgba(245,158,11,0.3)' : scanning ? 'rgba(96,165,250,0.18)' : 'rgba(255,255,255,0.04)',
                    border: `2px solid ${on ? NEON.amber : scanning ? NEON.sky : 'transparent'}`,
                    boxShadow: on ? glow(NEON.amber, 0.5) : undefined,
                    opacity: clamp(sp(t, a0 + 2.2 + k * 0.15)),
                  }}
                >
                  <span style={{ flex: 1 }}>
                    {o} → {POS[o]}
                  </span>
                  <span style={{ opacity: vis(t, scanAt(k) + 0.3), color: o <= 6 ? NEON.green : NEON.red, fontFamily: 'inherit' }}>
                    {o <= 6 ? `${o} ≤ 6 ✓` : `${o} > 6 ✗`}
                  </span>
                </div>
              )
            })}
          </Panel>
        </At>
        <At x={420} y={SP.y}>
          <Pill text="tìm offset 6" tone="cyan" size={40} o={Math.min(sp(t, a1 + 0.1), vis(t, 0, a2 + 0.4))} />
        </At>
        <At x={spRow(1).x} y={spRow(1).y}>
          <Burst t={t} at={a1 + 3.6} tone="amber" r={140} />
        </At>
        <Lines>
          <Beam d={`M${spRow(1).x} ${spRow(1).y - 30} C ${spRow(1).x} 560, ${cx(4)} 540, ${cx(4)} 418`} p={arc} color={NEON.amber} />
        </Lines>
        <ReadHead x={head.x} y={300} h={110} tone="amber" o={vis(t, scanA - 0.2, scanB + 0.3)} />
        <At x={cx(6)} y={355}>
          <Burst t={t} at={scanB} tone="green" r={90} />
        </At>
        <At x={cx(6)} y={232}>
          <Pill text="offset 6 ✓" tone="green" size={30} o={sp(t, scanB + 0.1)} />
        </At>
      </div>
      <At x={560} y={600}>
        <Panel t={t} at={a3 + 0.3} w={640} h={470} tone="red" tilt={10}>
          <div style={{ textAlign: 'center', paddingTop: 36 }}>
            <div style={label}>INDEX DÀY</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, justifyItems: 'center', margin: '30px 40px' }}>
              {[0, 1, 2, 3].map((k) => (
                <RamIcon key={k} size={220} />
              ))}
            </div>
            <div style={{ fontSize: 96, fontWeight: 900, color: '#fecaca', textShadow: glow(NEON.red, 0.6) }}>80 MB</div>
          </div>
        </Panel>
      </At>
      <At x={960} y={600}>
        <Chevrons t={t} at={a3 + 1.3} tone="green" dir="right" size={100} />
      </At>
      <At x={1360} y={600}>
        <Panel t={t} at={a3 + 0.8} w={640} h={470} tone="green" tilt={-10} strong>
          <div style={{ textAlign: 'center', paddingTop: 36 }}>
            <div style={label}>SPARSE INDEX</div>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '62px 0 66px' }}>
              <RamIcon size={220} />
            </div>
            <div style={{ fontSize: 96, fontWeight: 900, color: '#bbf7d0', textShadow: glow(NEON.green, 0.6) }}>≈ 2 MB</div>
          </div>
        </Panel>
      </At>
      <At x={960} y={950}>
        <Kinetic t={t} at={a3 + 1.7} text="nhỏ hơn ~40 lần · nằm gọn trong RAM" size={60} weight={800} color="#bbf7d0" stagger={0.015} />
      </At>
    </Scene>
  )
}

/** Icons for the three summary cards. */
const SUMMARY_ICONS: (() => ReactNode)[] = [
  () => (
    <svg width="220" height="120" viewBox="0 0 220 120">
      {[150, 210, 90].map((w, i) => (
        <rect key={i} x="5" y={8 + i * 38} width={w} height="26" rx="8" fill={NEON.amber} opacity={1 - i * 0.2} />
      ))}
    </svg>
  ),
  () => (
    <div style={{ display: 'flex', gap: 30 }}>
      <FlagIcon size={56} />
      <FlagIcon size={56} />
      <FlagIcon size={56} />
    </div>
  ),
  () => (
    <svg width="220" height="120" viewBox="0 0 220 120">
      <path d="M20 100 C 40 10, 150 10, 180 80" fill="none" stroke={NEON.green} strokeWidth="10" strokeLinecap="round" />
      <path d="M160 70 l22 14 l6 -26" fill="none" stroke={NEON.green} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
]

function summary(t: number, c: Cue) {
  const cam = cameraAt(t, [
    [0, { x: 960, y: 560, s: 0.9, rx: 16 }],
    [c.at(0) - 0.1, { x: 420, y: 520, s: 1.25, ry: 10 }],
    [c.at(1) - 0.1, { x: 960, y: 520, s: 1.25 }],
    [c.at(2) - 0.1, { x: 1500, y: 520, s: 1.25, ry: -10 }],
    [c.at(3) - 0.2, { x: 960, y: 640, s: 0.95 }, 1.3],
  ])
  const cards: { title: string; body: string; tone: Neon; tilt: number }[] = [
    { title: 'Vì tin dài ngắn khác nhau', body: 'nên không tính được byte từ offset', tone: 'amber', tilt: 12 },
    { title: 'Chỉ cắm vài cột mốc', body: 'index nhỏ, nằm gọn trong RAM', tone: 'blue', tilt: 0 },
    { title: 'Nhảy rồi lướt', body: 'tới mốc gần nhất ≤ offset, lướt một đoạn ngắn', tone: 'green', tilt: -12 },
  ]
  return (
    <Scene t={t} camera={cam}>
      <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0 }}>
        <line x1={420} y1={500} x2={1500} y2={500} stroke="#334155" strokeWidth={4} strokeDasharray="14 12" opacity={vis(t, c.at(1))} />
      </svg>
      {cards.map((card, i) => {
        const active = t >= c.at(i) && t < c.at(i + 1)
        return (
          <At key={i} x={420 + i * 540} y={500} style={{ transform: `translate(-50%, -50%) scale(${active ? 1.05 : 1})`, transition: 'none' }}>
            <Panel t={t} at={c.at(i) + 0.1} w={470} h={520} tone={card.tone} tilt={card.tilt} strong={active}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '70px 36px 0', textAlign: 'center', gap: 34 }}>
                <div style={{ height: 130, display: 'grid', placeItems: 'center' }}>{SUMMARY_ICONS[i]()}</div>
                <div style={{ fontSize: 44, fontWeight: 900, color: NEON[card.tone], lineHeight: 1.2 }}>{card.title}</div>
                <div style={{ fontSize: 32, fontWeight: 600, color: '#cbd5e1', lineHeight: 1.4 }}>{card.body}</div>
              </div>
            </Panel>
          </At>
        )
      })}
      <At x={960} y={935} style={{ display: 'flex', alignItems: 'center', gap: 36, opacity: vis(t, c.at(3)) }}>
        <div style={{ transform: `scale(${clamp(sp(t, c.at(3)), 0, 1.2)})` }}>
          <BookIcon size={150} />
        </div>
        <Kinetic t={t} at={c.at(3) + 0.2} text="Như mục lục sách: ghi theo chương, không ghi từng dòng." size={50} weight={800} stagger={0.012} />
      </At>
    </Scene>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { problem, scan, dense, sparse, summary }

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const sparseIndexLesson: Lesson = {
  ...sparseIndexScript,
  scenes: sparseIndexScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id] })),
  roadmap: [
    'Chặng 1: Bài toán — vì sao từ offset không suy ra được vị trí byte.',
    'Chặng 2: Hai cách ngây thơ — đọc tuần tự và index dày, mỗi cách hỏng ở đâu.',
    'Chặng 3: Sparse index — cách Kafka thật sự làm, và tự tay thử trên mô phỏng.',
  ],
  sections: [
    {
      id: 'bai-toan',
      title: 'Bài toán: tin số 6 nằm ở byte nào?',
      blocks: [
        { kind: 'video', scenes: ['problem'] },
        {
          kind: 'p',
          text: 'Mỗi partition là một **log chỉ ghi nối đuôi**, được cắt thành nhiều **segment**. Mỗi segment là một file `.log` trên đĩa, các tin nằm sát nhau, tin sau bắt đầu ngay chỗ tin trước kết thúc.',
        },
        {
          kind: 'p',
          text: 'Consumer không hỏi "cho tôi byte thứ 1390". Nó hỏi theo **offset**, tức số thứ tự của tin: "đọc tiếp từ offset 6". Offset là số đếm, **không phải địa chỉ byte**. Kafka phải tự đổi offset sang vị trí byte trong file.',
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Hỏi "vì sao" hai lần',
          text: 'Vì sao cần index? Vì không tính được byte từ offset. Vì sao không tính được? Vì **mỗi tin (mỗi batch) dài ngắn khác nhau**. Nếu tin nào cũng đúng 100 byte thì byte = offset × 100 và chẳng cần index nào cả.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q(
              'Consumer gửi yêu cầu "đọc từ offset 6". Offset 6 là gì?',
              ['Byte thứ 6 trong file', 'Số thứ tự của tin trong partition', 'Số thứ tự của segment', 'Số giây kể từ khi tin được ghi'],
              1,
              'Offset là số thứ tự tin trong partition. Muốn đọc file thì Kafka phải đổi nó sang vị trí byte, và đó là việc của index.',
            ),
          ],
        },
      ],
    },
    {
      id: 'doc-tuan-tu',
      title: 'Cách 1: Đọc tuần tự từ đầu file',
      blocks: [
        { kind: 'video', scenes: ['scan'] },
        {
          kind: 'p',
          text: 'Cách đơn giản nhất là bắt đầu từ byte 0, đọc phần đầu của mỗi tin để biết nó dài bao nhiêu, rồi nhảy qua. Lặp lại cho tới khi gặp offset cần tìm.',
        },
        {
          kind: 'table',
          head: ['Kích thước segment', 'Tin ~100 byte', 'Số lần nhảy để tới cuối'],
          rows: [
            ['1 MB', '~10.000 tin', '~10.000'],
            ['1 GB (mặc định `segment.bytes`)', '~10.000.000 tin', '~10.000.000'],
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          text: 'Đúng nhưng chậm: chi phí tăng **tuyến tính** theo vị trí cần tìm. Consumer đọc lại từ giữa segment (sau khi restart, sau rebalance) sẽ phải bò qua hàng triệu tin.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q(
              'Vì sao khi đọc tuần tự, Kafka phải "đọc độ dài" của từng tin trước khi nhảy?',
              ['Để kiểm tra tin có bị lỗi không', 'Vì không biết trước tin đó dài bao nhiêu byte', 'Vì đĩa chỉ đọc được từng byte', 'Để nén tin lại'],
              1,
              'Các tin dài ngắn khác nhau, nên chỉ có cách đọc trường độ dài trong header để biết tin kế tiếp bắt đầu ở đâu.',
            ),
          ],
        },
      ],
    },
    {
      id: 'index-day',
      title: 'Cách 2: Index dày, mỗi tin một dòng',
      blocks: [
        {
          kind: 'quiz',
          title: 'Dự đoán trước khi xem',
          questions: [
            q(
              'Nếu lập sẵn bảng "offset → byte" cho MỌI tin, bạn đoán vấn đề lớn nhất là gì?',
              ['Tra cứu chậm', 'Bảng quá to, tốn RAM', 'Không tìm được offset lớn', 'Mất dữ liệu khi restart'],
              1,
              'Tra cứu thì cực nhanh, nhưng bảng to bằng số tin. Xem video để thấy nó to cỡ nào.',
            ),
          ],
        },
        { kind: 'video', scenes: ['dense'] },
        {
          kind: 'p',
          text: 'Một dòng index chỉ cần khoảng **8 byte**: 4 byte cho offset (tính tương đối so với đầu segment) và 4 byte cho vị trí. Nghe nhỏ, nhưng nhân lên thì không nhỏ chút nào:',
        },
        {
          kind: 'list',
          items: [
            { title: 'Một segment', text: '1 GB ÷ 100 byte ≈ 10 triệu tin → 10 triệu × 8 byte ≈ **80 MB** index.' },
            { title: 'Cả broker', text: 'Một broker giữ hàng nghìn segment → hàng chục GB index, không thể nằm trong RAM.' },
            { title: 'Hậu quả', text: 'Index phải đọc từ đĩa → mất luôn lợi thế "tra 1 phát là ra".' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q(
              'Index dày nhanh như vậy, vì sao Kafka không dùng?',
              ['Vì nó chậm hơn đọc tuần tự', 'Vì bảng to bằng số tin, không vừa RAM', 'Vì không sắp xếp được', 'Vì Kafka không có RAM'],
              1,
              'Kích thước index tỉ lệ với số tin. Với hàng nghìn segment, nó không vừa RAM nên mất luôn tốc độ.',
            ),
          ],
        },
      ],
    },
    {
      id: 'sparse-index',
      title: 'Sparse index: cách Kafka thật sự làm',
      blocks: [
        { kind: 'video', scenes: ['sparse'] },
        {
          kind: 'p',
          text: 'Bên cạnh mỗi file `.log` có một file `.index`. Kafka chỉ ghi **một dòng index sau mỗi khoảng dữ liệu** (cấu hình `index.interval.bytes`, mặc định 4096 byte), chứ không ghi cho từng tin.',
        },
        {
          kind: 'list',
          ordered: true,
          items: [
            { title: 'Tìm mốc', text: 'Tìm nhị phân trong `.index` lấy **mốc lớn nhất ≤ offset** cần đọc.' },
            { title: 'Nhảy', text: 'Nhảy thẳng tới vị trí byte của mốc đó trong `.log`.' },
            { title: 'Lướt', text: 'Đọc tuần tự một đoạn ngắn (vài KB) cho tới đúng offset.' },
          ],
        },
        {
          kind: 'table',
          head: ['', 'Đọc tuần tự', 'Index dày', 'Sparse index'],
          rows: [
            ['Kích thước index (1 GB)', '0', '~80 MB', '**~2 MB**'],
            ['Tra một offset', 'lướt cả GB', 'nhảy thẳng', '**nhảy + lướt vài KB**'],
            ['Nằm trong RAM?', '—', 'không', '**có** (file được mmap)'],
          ],
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'Chi tiết thật trên đĩa',
          text: 'Mỗi dòng index thật trỏ tới **đầu một record batch** (thường ~16 KB nhờ batching), ghi offset cuối của batch đó. Nên khoảng cách giữa các mốc trên đĩa thường theo kích thước batch, với 4 KB là mức tối thiểu.',
        },
        {
          kind: 'p',
          text: 'Anh em của `.index` là `.timeindex`: ánh xạ **thời điểm → offset**, dùng khi tìm tin theo thời gian (ví dụ reset consumer về "9 giờ sáng hôm qua"; Kafka Streams cũng dùng nhiều). Kafka **không lưu checksum cho index**: hỏng thì dựng lại từ `.log`, xoá đi cũng an toàn, chỉ là broker khởi động lâu hơn.',
        },
        { kind: 'p', text: 'Bạn có thể tự xem các dòng index bằng công cụ đi kèm Kafka:' },
        {
          kind: 'code',
          code: 'kafka-dump-log.sh --files 00000000000000000000.index\n\nDumping 00000000000000000000.index\noffset: 197 position: 16330\noffset: 395 position: 32741\n...',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q(
              'Index có mốc 0→0, 4→810, 8→1760. Đọc offset 7 thì sao?',
              ['Nhảy tới mốc 8 rồi lùi 1 tin', 'Nhảy tới mốc 4 rồi lướt qua 4, 5, 6', 'Nhảy tới mốc 0 rồi lướt 7 tin', 'Tính 7 × 217'],
              1,
              'Luôn chọn mốc lớn nhất ≤ offset, vì log chỉ lướt về phía trước được: không biết tin trước dài bao nhiêu để lùi lại.',
            ),
          ],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: tự tay tra cứu',
      blocks: [
        {
          kind: 'p',
          text: 'Kéo hai thanh trượt. Trước khi kéo, hãy **đoán trước**: cắm mốc mỗi 1 tin thì bảng có mấy dòng và phải lướt mấy tin? Còn mỗi 5 tin thì sao?',
        },
        { kind: 'widget', name: 'sparse-lab' },
        {
          kind: 'p',
          text: 'Bạn vừa tự thấy đánh đổi cốt lõi: **mốc dày** → bảng to, lướt ít; **mốc thưa** → bảng nhỏ, lướt nhiều. Kafka chọn khoảng 4 KB một mốc vì lướt 4 KB trên đĩa gần như miễn phí, còn bảng thì đủ nhỏ để nằm trong RAM.',
        },
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
      'Vì sao Kafka không tính vị trí byte bằng công thức offset × kích thước tin?',
      [
        'Vì index giúp nén dữ liệu nhỏ hơn',
        'Vì các tin (và batch) dài ngắn khác nhau, nên không có kích thước cố định để nhân',
        'Vì offset được sinh ngẫu nhiên',
        'Vì file log chỉ đọc được từ cuối lên',
      ],
      1,
      'Đây là gốc rễ của index. Nếu tin nào cũng đúng 100B thì byte = offset × 100 và chẳng cần index.',
    ),
    q(
      'Tăng `index.interval.bytes` từ 4KB lên 1MB thì sao?',
      ['Index nhỏ hơn, nhưng mỗi lần tìm phải lướt nhiều dữ liệu hơn', 'Index to hơn và tìm nhanh hơn', 'Không có gì thay đổi', 'Kafka sẽ mất dữ liệu'],
      0,
      'Đánh đổi kinh điển: ít mốc → tiết kiệm RAM, nhưng khoảng cách tới mốc gần nhất xa hơn nên lướt lâu hơn.',
    ),
    q(
      'File `.index` của một segment bị xoá mất. Điều gì xảy ra?',
      ['Mất toàn bộ tin trong segment', 'Kafka dựng lại index bằng cách đọc tuần tự file .log', 'Consumer không đọc được nữa', 'Partition bị xoá'],
      1,
      'Index chỉ là "mục lục" dựng từ dữ liệu. Dữ liệu thật nằm trong .log, nên Kafka có thể quét lại để dựng index.',
    ),
    q(
      'Một topic có tin cỡ 50 byte nhưng producer gom batch ~16KB. Khoảng cách giữa các dòng index trên đĩa gần với số nào nhất?',
      ['50 byte', '4 KB', '~16 KB', '1 GB'],
      2,
      'Mỗi dòng index trỏ tới đầu một batch, nên khoảng cách theo kích thước batch; 4 KB chỉ là mức tối thiểu.',
    ),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao index "thưa" mà vẫn tìm nhanh?',
      keywords: ['mốc', 'lướt', 'ram', 'nhảy'],
      modelAnswer:
        'Vì tin dài ngắn khác nhau nên phải có index. Nhưng ghi mọi tin thì index quá to, không vừa RAM. Sparse index chỉ ghi một mốc mỗi ~4KB, nên nhỏ và nằm trong RAM. Khi tìm, Kafka nhảy tới mốc lớn nhất ≤ offset, rồi chỉ lướt một đoạn ngắn (vài KB) để tới đúng tin.',
    },
  ],
  recap: {
    journey:
      'Từ câu hỏi "tin số 6 nằm ở byte nào?" → tin dài ngắn khác nhau nên không tính được → đọc tuần tự thì quá chậm → index dày thì quá to → sparse index: vài cột mốc trong RAM + lướt một đoạn ngắn.',
    points: [
      { title: 'Vì sao cần index', text: 'Vì offset là số thứ tự, còn tin dài ngắn khác nhau nên không suy ra được vị trí byte.' },
      { title: 'Sparse index', text: 'Một mốc mỗi ~4 KB (thực tế là mỗi batch): bảng nhỏ, nằm gọn trong RAM.' },
      { title: 'Cách tra', text: 'Mốc lớn nhất ≤ offset → nhảy tới byte đó → lướt vài KB.' },
      { title: 'Đánh đổi', text: 'Mốc dày: to mà lướt ít. Mốc thưa: nhỏ mà lướt nhiều.' },
    ],
    next: 'Bài tiếp theo: Key quyết định Partition — tin có key đi vào partition nào, và vì sao thứ tự chỉ được giữ trong một partition.',
  },
}
