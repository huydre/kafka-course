import type { ReactNode } from 'react'
import {
  At,
  Burst,
  CaseLabel,
  HandCircle,
  Paper,
  RedString,
  ClockIcon,
  GearIcon,
  Kinetic,
  LockIcon,
  NEON,
  Pill,
  Scene,
  ScissorsIcon,
  Stamp,
  SummaryGrid,
  TitleCard,
  TrashIcon,
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
import { segmentRetentionScript } from './segment-retention-script'

const pad20 = (n: number) => String(n).padStart(20, '0')

type SegState = 'closed' | 'active' | 'doomed' | 'picked' | 'empty'
const SEG_TONE: Record<SegState, Neon> = { closed: 'blue', active: 'green', doomed: 'red', picked: 'amber', empty: 'green' }

/** One segment drawn as a file card: base offset, the three files that make it up, and its state badge. */
function SegmentCard({
  x,
  y,
  base,
  range,
  state,
  t,
  w = 420,
  h = 300,
  o = 1,
  children,
}: {
  x: number
  y: number
  base: number
  range?: string
  state: SegState
  t: number
  w?: number
  h?: number
  o?: number
  children?: ReactNode
}) {
  const c = NEON[SEG_TONE[state]]
  const strong = state !== 'closed'
  return (
    <div
      style={{
        position: 'absolute',
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
        borderRadius: 24,
        border: `4px solid ${c}`,
        background: 'linear-gradient(160deg, #2d313d 0%, #1b1e27 60%, #15171e 100%)',
        boxShadow: `${glow(c, strong ? 1 : 0.45)}, 0 30px 50px rgba(0,0,0,0.55)`,
        opacity: clamp(o),
        padding: '22px 26px',
        overflow: 'hidden',
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 17, color: NEON.muted, fontWeight: 700 }}>{pad20(base)}.log</div>
      <div style={{ fontSize: 78, fontWeight: 900, lineHeight: 1.05, color: '#fff', marginTop: 4 }}>{base}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {['.log', '.index', '.timeindex'].map((e) => (
          <span key={e} style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, padding: '3px 10px', borderRadius: 8, background: 'rgba(96,165,250,0.14)', color: '#bfdbfe' }}>
            {e}
          </span>
        ))}
      </div>
      {range && <div style={{ marginTop: 14, fontSize: 28, fontWeight: 700, color: '#cbd5e1' }}>{range}</div>}
      {children}
      <div style={{ position: 'absolute', right: 20, top: 18 }}>
        {state === 'active' || state === 'empty' ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 99, background: 'rgba(34,197,94,0.18)', border: `2px solid ${NEON.green}`, fontSize: 18, fontWeight: 900, color: '#bbf7d0' }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: NEON.green, opacity: Math.sin(t * 8) > 0 ? 1 : 0.3 }} />
            {state === 'empty' ? 'MỚI · RỖNG' : 'ĐANG GHI'}
          </span>
        ) : (
          <LockIcon size={44} color={state === 'doomed' ? NEON.red : NEON.sky} />
        )}
      </div>
    </div>
  )
}

/** A small message chip flying into a segment. */
function Dot({ x, y, label, o = 1 }: { x: number; y: number; label: string; o?: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x - 34,
        top: y - 24,
        width: 68,
        height: 48,
        borderRadius: 12,
        background: 'linear-gradient(180deg,#3b82f6,#1e40af)',
        border: '3px solid #93c5fd',
        boxShadow: glow(NEON.sky, 0.6),
        display: 'grid',
        placeItems: 'center',
        fontSize: 20,
        fontWeight: 900,
        color: '#fff',
        opacity: clamp(o),
      }}
    >
      {label}
    </div>
  )
}

/* ------------------------------------------------------------------ 0. cold open: case board */

function hook(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const A = { x: 640, y: 500 }
  const B = { x: 1460, y: 430 }
  const CUL = { x: 1060, y: 930 }
  const cam = cameraAt(t, [
    [0, { x: A.x, y: A.y + 40, s: 1.45, rx: 12, r: -2 }],
    [a0 + 0.3, { x: A.x + 40, y: A.y, s: 1.2, r: -1 }, 3.2],
    [a1, { x: B.x, y: B.y + 20, s: 1.3, r: 1.5 }, 1.2],
    [a2, { x: 1060, y: 640, s: 0.72 }, 1.6],
  ])
  const background = [
    { x: 150, y: 170, w: 260, h: 320, r: -8 },
    { x: 1840, y: 980, w: 300, h: 240, r: 6 },
    { x: 1900, y: 120, w: 240, h: 300, r: 9 },
    { x: 130, y: 980, w: 320, h: 220, r: -4 },
  ]
  return (
    <Scene t={t} camera={cam} backdrop="board">
      {background.map((b, i) => (
        <At key={i} x={b.x} y={b.y} style={{ opacity: 0.55, filter: 'blur(1.5px)' }}>
          <Paper w={b.w} h={b.h} rotate={b.r}>
            {[0, 1, 2, 3, 4].map((k) => (
              <div key={k} style={{ height: 10, marginTop: 18, width: `${90 - k * 12}%`, background: 'rgba(90,70,40,0.35)', borderRadius: 4 }} />
            ))}
          </Paper>
        </At>
      ))}
      <At x={A.x} y={A.y}>
        <Paper w={820} h={540} rotate={-2.5} o={sp(t, 0.1, 16, 120)}>
          <CaseLabel>Hồ sơ #1 · retention</CaseLabel>
          <div style={{ fontSize: 46, fontWeight: 800, marginTop: 30 }}>
            retention.ms = <span style={{ fontFamily: MONO }}>7 ngày</span>
          </div>
          <div style={{ position: 'relative', marginTop: 40, fontSize: 64, fontWeight: 900, lineHeight: 1.15, color: '#b71c1c' }}>
            dữ liệu 10 ngày tuổi
            <br />
            VẪN CÒN?
            <div style={{ position: 'absolute', left: -40, top: -36, width: 700, height: 230 }}>
              <HandCircle w={700} h={230} p={move(t, lerp(a0, c.end(0), 0.55), 0.9)} />
            </div>
          </div>
        </Paper>
      </At>
      <At x={B.x} y={B.y}>
        <Paper w={640} h={440} rotate={3} o={sp(t, a1 - 0.2, 16, 120)}>
          <CaseLabel>Hồ sơ #2 · topic im lặng</CaseLabel>
          <div style={{ fontSize: 40, fontWeight: 800, marginTop: 26 }}>Nghỉ Tết quay lại…</div>
          <div style={{ position: 'relative', marginTop: 34, fontSize: 60, fontWeight: 900, lineHeight: 1.15, color: '#b71c1c' }}>
            partition
            <br />
            TRỐNG TRƠN?
            <div style={{ position: 'absolute', left: -36, top: -30, width: 520, height: 210 }}>
              <HandCircle w={520} h={210} p={move(t, lerp(a1, c.end(1), 0.6), 0.9)} />
            </div>
          </div>
        </Paper>
      </At>
      <RedString from={{ x: A.x, y: A.y - 270 }} to={{ x: CUL.x, y: CUL.y - 150 }} p={move(t, a2 + 0.6, 0.9)} />
      <RedString from={{ x: B.x, y: B.y - 220 }} to={{ x: CUL.x, y: CUL.y - 150 }} p={move(t, a2 + 0.9, 0.9)} />
      <At x={CUL.x} y={CUL.y}>
        <Paper w={560} h={300} rotate={-1} o={sp(t, a2 + 1.4, 12, 140)}>
          <CaseLabel>Thủ phạm</CaseLabel>
          <div style={{ fontSize: 76, fontWeight: 900, marginTop: 24, color: '#1a237e' }}>SEGMENT</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>cách Kafka cắt log thành file</div>
        </Paper>
      </At>
    </Scene>
  )
}

/* ------------------------------------------------------------------ 1. why segments */

function split(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const grow = ease(span(t, a0 + 0.6, a1))
  const barW = lerp(320, 2800, grow)
  const cut = a2 + 0.5
  const gap = lerp(0, 70, move(t, cut + 0.6, 0.8))
  const pieceW = (2800 - 3 * 70) / 4
  const toss = move(t, a2 + 2.6, 1.1)
  const cam = cameraAt(t, [
    [0, { x: 960, y: 560, s: 1.15, rx: 24 }],
    [a0 + 0.5, { x: 900, y: 560, s: 1 }, 1.2],
    [a0 + 1.6, { x: 1600, y: 600, s: 0.6 }, 3.2],
    [a1, { x: 820, y: 580, s: 0.85, ry: 8 }, 1.2],
    [a2, { x: 1600, y: 600, s: 0.58 }, 1.3],
    [a2 + 2.4, { x: 1640, y: 700, s: 0.56, ry: -4 }, 1.2],
  ])
  const before = t < cut + 0.6
  return (
    <Scene t={t} camera={cam} overlay={<TitleCard t={t} at={a0} kicker="VÌ SAO" title="Cắt log thành segment" dock={a0 + 1.3} />}>
      {before ? (
        <div
          style={{
            position: 'absolute',
            left: 200,
            top: 470,
            width: barW,
            height: 180,
            borderRadius: 26,
            border: `4px solid ${t >= a1 + 0.4 && t < a2 ? NEON.red : NEON.blue}`,
            background: `repeating-linear-gradient(90deg, rgba(147,197,253,0.35) 0 6px, transparent 6px 44px), linear-gradient(180deg,#1d4ed8,#172554)`,
            boxShadow: glow(t >= a1 + 0.4 && t < a2 ? NEON.red : NEON.blue, 0.7),
          }}
        />
      ) : (
        [0, 1, 2, 3].map((i) => {
          const tossed = i === 0
          const x = 200 + i * (pieceW + gap) + (tossed ? lerp(0, -40, toss) : 0)
          const y = 470 + (tossed ? lerp(0, 520, toss) : 0)
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: pieceW,
                height: 180,
                borderRadius: 22,
                border: `4px solid ${tossed && toss > 0 ? NEON.red : NEON.blue}`,
                background: `repeating-linear-gradient(90deg, rgba(147,197,253,0.35) 0 6px, transparent 6px 44px), linear-gradient(180deg,#1d4ed8,#172554)`,
                boxShadow: glow(tossed && toss > 0 ? NEON.red : NEON.blue, 0.6),
                transform: `scale(${tossed ? lerp(1, 0.25, toss) : 1}) rotate(${tossed ? toss * -18 : 0}deg)`,
                transformOrigin: 'left top',
                opacity: tossed ? 1 - span(t, a2 + 3.3, a2 + 3.7) : 1,
                display: 'grid',
                placeItems: 'center',
                fontSize: 56,
                fontWeight: 900,
                color: '#dbeafe',
              }}
            >
              segment {i + 1}
            </div>
          )
        })
      )}
      <At x={200 + barW + 120} y={560} style={{ opacity: before ? vis(t, a0 + 0.8) : 0 }}>
        <Pill text={`${Math.round(lerp(1, 1000, grow))} GB`} tone="sky" size={64} />
      </At>
      <At x={760} y={360}>
        <Pill text="xoá phần đầu = viết lại cả file" tone="red" size={54} o={Math.min(sp(t, a1 + 0.4), vis(t, 0, a2))} />
      </At>
      <At x={1500} y={330} style={{ opacity: vis(t, -1, a2 - 0.1) }}>
        <Stamp t={t} at={a1 + 2.0} text="TỐN KÉM" size={90} />
      </At>
      {[1, 2, 3].map((i) => {
        const x = 200 + (i * 2800) / 4
        const p = move(t, cut + i * 0.15, 0.35)
        return (
          <div key={i} style={{ opacity: vis(t, cut + i * 0.15, cut + 1.2) }}>
            <div style={{ position: 'absolute', left: x - 3, top: 430, width: 6, height: 260 * p, background: NEON.red, boxShadow: glow(NEON.red, 0.6) }} />
            <div style={{ position: 'absolute', left: x - 55, top: 430 + 230 * p - 50 }}>
              <ScissorsIcon size={110} open={Math.abs(Math.sin(t * 14))} />
            </div>
          </div>
        )
      })}
      <At x={330} y={1120} style={{ opacity: vis(t, a2 + 2.2) }}>
        <TrashIcon size={200} open={move(t, a2 + 2.4, 0.4) - move(t, a2 + 3.6, 0.4)} />
      </At>
      <At x={1500} y={1000}>
        <Kinetic t={t} at={a2 + 3.4} text="xoá dữ liệu cũ = xoá 1 file" size={92} color="#bbf7d0" glowColor={NEON.green} />
      </At>
    </Scene>
  )
}

/* ------------------------------------------------------------------ 2. base offset naming */

const FILES = [
  { base: 0, range: 'offset 0 → 99', x: 480 },
  { base: 100, range: 'offset 100 → 199', x: 960 },
  { base: 200, range: 'offset 200 → …', x: 1440 },
]

function naming(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const ask = a1 + 2.4
  const checkAt = (k: number) => a2 + 0.4 + k * 0.7
  const picked = t >= a2 + 2.6
  const activeOn = t >= a3 + 0.3
  const cam = cameraAt(t, [
    [0, { x: 960, y: 600, s: 0.9, rx: 26, ry: -10 }],
    [a0 + 0.8, { x: 960, y: 580, s: 0.95 }, 2.0],
    [a1 + 0.2, { x: 480, y: 560, s: 1.25, ry: 8 }, 0.9],
    [a1 + 1.1, { x: 960, y: 560, s: 1.25 }, 0.8],
    [a1 + 1.9, { x: 960, y: 520, s: 0.9 }, 0.9],
    [a2 + 2.4, { x: 960, y: 560, s: 1.35, ry: -6 }, 1.0],
    [a3, { x: 1440, y: 560, s: 1.2, ry: -10 }, 1.1],
    [a3 + 3.6, { x: 1100, y: 580, s: 0.9 }, 1.4],
  ])
  return (
    <Scene
      t={t}
      camera={cam}
      overlay={
        <>
          <TitleCard t={t} at={a0} kicker="TÊN FILE" title="Base offset" dock={a0 + 1.4} />
          <At x={960} y={215}>
            <Pill text="đọc offset 150?" tone="cyan" size={46} o={Math.min(sp(t, ask), vis(t, 0, a3))} />
          </At>
        </>
      }
    >
      {FILES.map((f, k) => {
        const p = clamp(sp(t, a0 + 0.5 + k * 0.25, 13, 100), 0, 1.1)
        const state: SegState = k === 2 && activeOn ? 'active' : picked && k === 1 ? 'picked' : 'closed'
        return (
          <div key={f.base} style={{ transform: `translateY(${(1 - p) * 140}px)`, opacity: clamp(p * 1.4) }}>
            <SegmentCard x={f.x} y={560} base={f.base} range={f.range} state={state} t={t} />
          </div>
        )
      })}
      {FILES.map((f, k) => {
        const ok = f.base <= 150
        return (
          <At key={f.base} x={f.x} y={770} style={{ opacity: Math.min(clamp(sp(t, checkAt(k))), vis(t, 0, a3)), fontSize: 46, fontWeight: 900, color: ok ? NEON.green : NEON.red, textShadow: glow(ok ? NEON.green : NEON.red, 0.4) }}>
            {f.base} {ok ? '≤' : '>'} 150 {ok ? '✓' : '✗'}
          </At>
        )
      })}
      <At x={960} y={560}>
        <Burst t={t} at={a2 + 2.6} tone="amber" r={240} />
      </At>
      <At x={960} y={860}>
        <Pill text="chỉ cần nhìn tên file · không mở file" tone="amber" size={36} o={Math.min(sp(t, a2 + 3.2), vis(t, 0, a3))} />
      </At>
      {[0, 1, 2].map((k) => {
        const start = a3 + 1.2 + k * 0.7
        const p = move(t, start, 0.6)
        return <Dot key={k} x={lerp(1900, 1440, p)} y={lerp(380, 520, p) + Math.sin(Math.PI * p) * -60} label={`${201 + k}`} o={vis(t, start, start + 0.6, 0.15)} />
      })}
      <At x={1440} y={780}>
        <Pill text="chỉ file này được ghi thêm" tone="green" size={34} o={sp(t, a3 + 1.0)} />
      </At>
    </Scene>
  )
}

/* ------------------------------------------------------------------ 3. roll */

const ROLL_X = (k: number) => 380 + k * 500

function roll(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  // Roll moments: size-based (beat 0 demo and beat 1), time-based (beat 2), first write after idle (beat 3).
  const rolls = [a0 + 3.0, c.end(1) - 0.2, a2 + 3.6, a3 + 2.4]
  const rolledAt = (k: number) => rolls[k] ?? Infinity
  const cam = cameraAt(t, [
    [0, { x: ROLL_X(0), y: 560, s: 1.1, rx: 20 }],
    [a0 + 0.6, { x: ROLL_X(0) + 120, y: 560, s: 1.05 }, 1.4],
    ...rolls.map((r, k) => [r - 0.1, { x: ROLL_X(k + 1) - 80, y: 560, s: 1.02, ry: k % 2 ? 6 : -6 }, 1.0] as [number, { x: number; y: number; s: number; ry: number }, number]),
    [c.duration - 1.4, { x: 1380, y: 600, s: 0.55 }, 1.3],
  ])
  const sizeFill = (k: number) =>
    k === 0 ? span(t, a0 + 0.8, rolls[0]) : k === 1 ? span(t, rolls[0], rolls[1]) : k === 2 ? 0.3 * span(t, rolls[1], rolls[2]) : k === 3 ? 0.05 : 0
  const days = (k: number) => (k === 2 ? 7 * span(t, a2 + 0.3, rolls[2]) : k === 3 ? lerp(0, 8, span(t, a3 - 1.5, a3 + 1.8)) : 0)
  const stream = (k: number) => k <= 2
  return (
    <Scene t={t} camera={cam} overlay={<TitleCard t={t} at={a0} kicker="ROLL" title="Đóng file cũ, mở file mới" dock={a0 + 1.2} />}>
      {[0, 1, 2, 3, 4].map((k) => {
        const appear = k === 0 ? a0 + 0.5 : rolledAt(k - 1)
        if (t < appear) return null
        const p = clamp(sp(t, appear, 13, 110), 0, 1.1)
        const closed = t >= rolledAt(k)
        const showSize = k <= 2
        return (
          <div key={k} style={{ transform: `translateX(${(1 - clamp(p)) * 300}px)`, opacity: clamp(p * 1.4) }}>
            <SegmentCard x={ROLL_X(k)} y={560} base={k * 100} state={closed ? 'closed' : 'active'} t={t} h={360}>
              <div style={{ marginTop: 18, opacity: closed ? 0.5 : 1 }}>
                {showSize && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 800, color: NEON.muted }}>
                      <span>segment.bytes</span>
                      <span>{(sizeFill(k) * 1).toFixed(1)} / 1 GB</span>
                    </div>
                    <div style={{ height: 18, borderRadius: 9, background: '#0f1525', marginTop: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${sizeFill(k) * 100}%`, height: '100%', background: sizeFill(k) >= 0.99 ? NEON.red : NEON.sky }} />
                    </div>
                  </>
                )}
                {k >= 2 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
                    <ClockIcon size={54} t={days(k) * 4} />
                    <span style={{ fontSize: 30, fontWeight: 900, color: days(k) >= 7 ? NEON.red : NEON.amber }}>{days(k).toFixed(1)} / 7 ngày</span>
                  </div>
                )}
              </div>
            </SegmentCard>
          </div>
        )
      })}
      {[0, 1, 2].map((k) =>
        stream(k) && t < rolledAt(k)
          ? [0, 1, 2, 3].map((j) => {
              const cycle = ((t * 1.6 + j * 0.25) % 1 + 1) % 1
              return <Dot key={`${k}-${j}`} x={lerp(ROLL_X(k) + 520, ROLL_X(k) + 120, cycle)} y={300 - Math.sin(Math.PI * cycle) * 40} label="msg" o={t >= (k === 0 ? a0 + 0.8 : rolledAt(k - 1)) ? 1 - cycle * 0.6 : 0} />
            })
          : null,
      )}
      {rolls.map((r, k) => (
        <At key={k} x={ROLL_X(k + 1)} y={560}>
          <Burst t={t} at={r} tone="green" r={200} />
        </At>
      ))}
      <At x={ROLL_X(1)} y={830}>
        <Pill text="đầy 1 GB → roll" tone="sky" size={36} o={Math.min(sp(t, a1 + 0.3), vis(t, 0, a2))} />
      </At>
      <At x={ROLL_X(2) + 250} y={260}>
        <Pill text="ngưỡng nào tới trước → roll trước" tone="amber" size={36} o={Math.min(sp(t, a2 + 1.4), vis(t, 0, a3))} />
      </At>
      <At x={ROLL_X(3)} y={820}>
        <Pill text={t < rolls[3] ? 'không có tin mới → chưa roll' : 'có tin mới → kiểm tra → roll'} tone={t < rolls[3] ? 'red' : 'green'} size={34} o={sp(t, a3 + 0.3)} />
      </At>
      {t >= a3 + 1.8 && t < rolls[3] + 0.5 && <Dot x={lerp(ROLL_X(3) + 520, ROLL_X(3) + 100, move(t, a3 + 1.8, 0.6))} y={300} label="msg" />}
    </Scene>
  )
}

/* ------------------------------------------------------------------ 4. retention */

const DAY = 76
const NOW_X = 1760
const dayX = (daysAgo: number) => NOW_X - daysAgo * DAY
const SEGS = [
  { base: 0, oldest: 20, newest: 15 },
  { base: 100, oldest: 15, newest: 10 },
  { base: 200, oldest: 10, newest: 5 },
  { base: 300, oldest: 5, newest: 0 },
]
const RETENTION = 7

function retention(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const judgeAt = (k: number) => a1 + 1.0 + k * 0.5
  const dropAt = a1 + 3.4
  const cam = cameraAt(t, [
    [0, { x: 1000, y: 640, s: 0.85, rx: 22 }],
    [a0 + 0.6, { x: 1000, y: 620, s: 0.88 }, 1.8],
    [a1 + 0.2, { x: 700, y: 620, s: 1.0, ry: 6 }, 1.1],
    [a2, { x: dayX(8.5), y: 620, s: 1.3, ry: -6 }, 1.0],
    [a3, { x: 1000, y: 660, s: 0.84 }, 1.3],
  ])
  return (
    <Scene t={t} camera={cam} overlay={<TitleCard t={t} at={a0} kicker="RETENTION" title="Giữ dữ liệu bao lâu?" dock={a0 + 1.2} />}>
      <div style={{ position: 'absolute', left: dayX(20.5), top: 820, width: 21 * DAY + 40, height: 6, borderRadius: 3, background: '#334155', transformOrigin: 'left', transform: `scaleX(${move(t, a0 + 0.4, 1.2)})` }} />
      {[20, 15, 10, 5, 0].map((d) => (
        <At key={d} x={dayX(d)} y={870} style={{ opacity: vis(t, a0 + 1.0), fontSize: 30, fontWeight: 800, color: NEON.muted }}>
          {d === 0 ? 'hôm nay' : `${d} ngày trước`}
        </At>
      ))}
      {SEGS.map((s, k) => {
        const dead = s.newest > RETENTION
        const judged = t >= judgeAt(k)
        const fall = dead ? move(t, dropAt, 0.9) : 0
        const left = dayX(s.oldest) + 6
        const w = (s.oldest - s.newest) * DAY - 12
        return (
          <div key={s.base} style={{ position: 'absolute', left, top: 470 + fall * 440, width: w, opacity: Math.min(clamp(sp(t, a0 + 0.8 + k * 0.2)), dead ? 1 - span(t, dropAt + 0.6, dropAt + 1.0) : 1), transform: `rotate(${fall * (k ? 12 : -14)}deg)` }}>
            <div
              style={{
                height: 300,
                borderRadius: 22,
                border: `4px solid ${judged ? (dead ? NEON.red : NEON.green) : NEON.blue}`,
                background: 'linear-gradient(160deg,#2d313d,#171a22)',
                boxShadow: glow(judged ? (dead ? NEON.red : NEON.green) : NEON.blue, 0.6),
                padding: '20px 22px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {k === 2 && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: (3 / 5) * w, background: 'rgba(245,158,11,0.22)', opacity: vis(t, a2 + 0.4, a3) }} />}
              <div style={{ position: 'relative', fontSize: 64, fontWeight: 900 }}>{s.base}</div>
              <div style={{ position: 'relative', fontSize: 24, fontWeight: 700, color: '#cbd5e1', marginTop: 8 }}>tin mới nhất:</div>
              <div style={{ position: 'relative', fontSize: 34, fontWeight: 900, color: judged ? (dead ? '#fecaca' : '#bbf7d0') : '#fff' }}>{s.newest === 0 ? 'vừa ghi' : `${s.newest} ngày`}</div>
              {k === 3 && <div style={{ position: 'relative', marginTop: 10, fontSize: 20, fontWeight: 900, color: '#bbf7d0' }}>ĐANG GHI</div>}
            </div>
            <div style={{ marginTop: 14, textAlign: 'center', fontSize: 34, fontWeight: 900, color: dead ? NEON.red : NEON.green, opacity: judged && t < dropAt ? 1 : 0 }}>{dead ? 'xoá cả file ✗' : 'giữ ✓'}</div>
          </div>
        )
      })}
      <div style={{ position: 'absolute', left: dayX(RETENTION) - 4, top: 360, width: 8, height: 500 * move(t, a0 + 2.0, 0.6), background: NEON.red, boxShadow: glow(NEON.red, 0.8) }} />
      <At x={dayX(RETENTION)} y={320}>
        <Pill text="mốc retention: 7 ngày" tone="red" size={36} o={Math.min(sp(t, a0 + 2.4), vis(t, 0, a2))} />
      </At>
      <At x={dayX(16)} y={1000} style={{ opacity: vis(t, dropAt - 0.4, dropAt + 1.6) }}>
        <TrashIcon size={170} open={move(t, dropAt, 0.3) - move(t, dropAt + 1.2, 0.3)} />
      </At>
      <At x={dayX(9.5)} y={405}>
        <Pill text="10 ngày tuổi vẫn còn" tone="amber" size={36} o={Math.min(sp(t, a2 + 0.6), vis(t, 0, a3))} />
      </At>
      <At x={1000} y={975} style={{ display: 'flex', alignItems: 'center', gap: 24, opacity: vis(t, a3 + 0.3) }}>
        <GearIcon size={80} t={t} color={NEON.sky} />
        <Pill text="dọn dẹp ~5 phút / lần" tone="sky" size={40} />
      </At>
      <At x={1000} y={1105}>
        <Kinetic t={t} at={a3 + 1.4} text="retention = thời gian giữ TỐI THIỂU" size={76} color="#fde68a" glowColor={NEON.amber} stagger={0.02} />
      </At>
    </Scene>
  )
}

/* ------------------------------------------------------------------ 5. idle topic trap */

function idle(t: number, c: Cue) {
  const [a1, a2] = [c.at(1), c.at(2)]
  const silent = lerp(0, 8, span(t, a1 + 0.2, a1 + 3.0))
  const rollAt = a1 + 3.0
  const toss = move(t, rollAt + 0.8, 1.0)
  const cam = cameraAt(t, [
    [0, { x: 960, y: 540, s: 1, rx: 14 }],
    [a1, { x: 900, y: 580, s: 1.15, ry: 6 }, 1.0],
    [rollAt, { x: 1100, y: 600, s: 0.92, ry: -5 }, 1.0],
    [a2 + 0.2, { x: 860, y: 600, s: 0.86 }, 1.2],
  ])
  return (
    <Scene
      t={t}
      camera={cam}
      overlay={
        <div style={{ opacity: vis(t, -1, a1 + 0.1) }}>
          <TitleCard t={t} at={0.1} kicker="CÂU HỎI BẪY" title="Active segment có bị xoá?" dock={a1 + 0.2} tone="amber" />
        </div>
      }
    >
      <At x={960} y={230} style={{ opacity: vis(t, a1, a2 + 0.2), display: 'flex', alignItems: 'center', gap: 24 }}>
        <ClockIcon size={110} t={silent * 6} />
        <span style={{ fontSize: 64, fontWeight: 900, color: silent > RETENTION ? NEON.red : NEON.amber, textShadow: glow(silent > RETENTION ? NEON.red : NEON.amber, 0.4) }}>
          im lặng {silent.toFixed(0)} ngày
        </span>
      </At>
      <div style={{ transform: `translate(${lerp(0, -260, toss)}px, ${lerp(0, 480, toss)}px) scale(${lerp(1, 0.3, toss)}) rotate(${-14 * toss}deg)`, opacity: 1 - span(t, rollAt + 1.6, rollAt + 1.9) }}>
        <SegmentCard x={820} y={580} base={500} range={`tin cuối: ${silent.toFixed(0)} ngày trước`} state={t >= rollAt ? 'doomed' : 'active'} t={t} w={460} h={320} o={vis(t, a1 - 0.2)} />
      </div>
      <div style={{ opacity: clamp(sp(t, rollAt)), transform: `translateX(${(1 - clamp(sp(t, rollAt))) * 300}px)` }}>
        <SegmentCard x={1340} y={580} base={517} range="0 tin" state="empty" t={t} w={460} h={320} />
      </div>
      <At x={1340} y={580}>
        <Burst t={t} at={rollAt} tone="green" r={230} />
      </At>
      <At x={560} y={1060} style={{ opacity: vis(t, rollAt + 0.6) }}>
        <TrashIcon size={190} open={move(t, rollAt + 0.7, 0.3) - move(t, rollAt + 1.8, 0.3)} />
      </At>
      <At x={250} y={600} style={{ opacity: vis(t, a2 + 0.4) }}>
        <div style={{ padding: '26px 30px', borderRadius: 24, border: `4px solid ${NEON.sky}`, background: 'linear-gradient(160deg,#2d313d,#171a22)', boxShadow: glow(NEON.sky, 0.6), textAlign: 'center' }}>
          <GearIcon size={70} t={t} />
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 3, color: NEON.muted, marginTop: 8 }}>CONSUMER</div>
          <div style={{ fontSize: 30, fontWeight: 900 }}>quay lại sau Tết</div>
        </div>
      </At>
      <At x={1340} y={330}>
        <Pill text="partition trống trơn?!" tone="red" size={40} o={sp(t, a2 + 1.6)} />
      </At>
      <At x={1340} y={640}>
        <Stamp t={t} at={a2 + 2.4} text="TRỐNG" size={96} />
      </At>
    </Scene>
  )
}

/* ------------------------------------------------------------------ 6. summary */

function summary(t: number, c: Cue) {
  return (
    <SummaryGrid
      t={t}
      cue={c}
      cards={[
        { title: 'Log cắt thành segment', body: 'xoá dữ liệu cũ = xoá cả file', tone: 'blue' },
        { title: 'Tên file = base offset', body: 'file lớn nhất là active segment', tone: 'green' },
        { title: 'Roll: 1 GB hoặc 7 ngày', body: 'ngưỡng nào tới trước', tone: 'amber' },
        { title: 'Retention xoá cả segment', body: 'khi tin MỚI NHẤT quá hạn — kể cả active', tone: 'red' },
      ]}
    />
  )
}

const RENDERS: Record<string, LessonScene['render']> = { hook, split, naming, roll, retention, idle, summary }

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const segmentRetentionLesson: Lesson = {
  ...segmentRetentionScript,
  scenes: segmentRetentionScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id] })),
  intro: [
    { kind: 'video', scenes: ['hook'] },
    {
      kind: 'quiz',
      title: 'Quick Quiz',
      questions: [
        q(
          'Đoán trước khi học: vì sao đặt retention 7 ngày mà dữ liệu 10 ngày tuổi vẫn còn?',
          ['Kafka bị lỗi', 'Kafka xoá theo cả file (segment), không xoá từng tin', 'Consumer chưa đọc nên Kafka chưa xoá', 'Retention tính theo tuần làm việc'],
          1,
          'Đúng hướng rồi. Cả bài này sẽ giải thích vì sao xoá theo segment dẫn tới cả hai "vụ án" trong video.',
        ),
      ],
    },
  ],
  roadmap: [
    'Chặng 1: Vì sao log của một partition bị cắt thành nhiều file, và tên file nói lên điều gì.',
    'Chặng 2: Roll — khi nào Kafka đóng file đang ghi để mở file mới.',
    'Chặng 3: Retention — Kafka xoá dữ liệu cũ thế nào, cái bẫy của topic im lặng, và tự tay thử trên mô phỏng.',
  ],
  sections: [
    {
      id: 'chia-segment',
      title: 'Vì sao log bị cắt thành segment?',
      blocks: [
        { kind: 'video', scenes: ['split'] },
        {
          kind: 'p',
          text: 'Mỗi partition là **một thư mục** trên đĩa của broker. Bên trong, log được cắt thành nhiều **segment**, mỗi segment gồm 3 file cùng tên: `.log` (dữ liệu thật), `.index` (offset → vị trí byte) và `.timeindex` (thời gian → offset).',
        },
        {
          kind: 'code',
          code: '/var/kafka-logs/orders-0/            ← topic "orders", partition 0\n├── 00000000000000000000.log\n├── 00000000000000000000.index\n├── 00000000000000000000.timeindex\n├── 00000000000005367851.log          ← segment bắt đầu từ offset 5.367.851\n├── 00000000000005367851.index\n└── 00000000000005367851.timeindex',
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Hình ảnh dễ nhớ',
          text: 'Nhật ký 10 năm viết trong **một cuốn sổ 5.000 trang**: muốn bỏ năm đầu thì không thể xé gọn. Nếu **mỗi tháng một cuốn vở**, bỏ dữ liệu cũ chỉ là **vứt cả cuốn cũ** — nhanh và không đụng các cuốn khác.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q(
              'Vì sao Kafka không ghi cả partition vào một file duy nhất?',
              ['Vì hệ điều hành giới hạn mỗi file 1 GB', 'Vì xoá dữ liệu cũ ở đầu một file khổng lồ rất tốn kém', 'Vì mỗi consumer cần một file riêng', 'Vì file lớn không đọc tuần tự được'],
              1,
              'Chia segment để việc bỏ dữ liệu cũ chỉ là xoá nguyên một file, không phải viết lại file.',
            ),
          ],
        },
      ],
    },
    {
      id: 'base-offset',
      title: 'Tên file = base offset',
      blocks: [
        { kind: 'video', scenes: ['naming'] },
        {
          kind: 'list',
          ordered: true,
          items: [
            { title: 'Tên = base offset', text: 'Tên file là offset của tin đầu tiên trong segment, đệm đủ **20 chữ số** nên sắp theo chữ cũng chính là sắp theo số.' },
            { title: 'Tìm file không cần mở', text: 'Muốn đọc offset X → chọn file có **tên lớn nhất mà ≤ X**.' },
            { title: 'Một active segment', text: 'File có tên lớn nhất là **active segment**, chỉ nó được ghi thêm. Các file cũ đã đóng, **chỉ đọc**, nên an toàn để cache và xoá nguyên file.' },
          ],
        },
        {
          kind: 'callout',
          tone: 'info',
          text: 'Để ý quy tắc "lớn nhất mà ≤" xuất hiện **hai lần**: chọn segment theo tên file, rồi chọn dòng trong sparse index của segment đó. Cùng một ý tưởng, hai tầng.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q(
              'Partition có các file 00…000000000, 00…005367851, 00…009000000. Tin offset 6.000.000 nằm ở file nào, và file nào là active?',
              ['File 0; active là file 0', 'File 5367851; active là file 9000000', 'File 9000000; active là file 9000000', 'File 5367851; active là file 5367851'],
              1,
              '5.367.851 là tên lớn nhất ≤ 6.000.000. File có tên lớn nhất (9.000.000) là active segment.',
            ),
          ],
        },
      ],
    },
    {
      id: 'roll',
      title: 'Roll: đóng file cũ, mở file mới',
      blocks: [
        {
          kind: 'quiz',
          title: 'Dự đoán trước khi xem',
          questions: [
            q(
              'Topic chỉ nhận khoảng 10 MB mỗi ngày, cấu hình mặc định. Bạn đoán bao lâu thì nó roll segment một lần?',
              ['Mỗi giờ', 'Khoảng 100 ngày (mới đầy 1 GB)', 'Khoảng 7 ngày', 'Không bao giờ'],
              2,
              'Không bao giờ đầy 1 GB trong 7 ngày, nên ngưỡng thời gian `segment.ms` (7 ngày) tới trước.',
            ),
          ],
        },
        { kind: 'video', scenes: ['roll'] },
        {
          kind: 'table',
          head: ['Ngưỡng', 'Mặc định', 'Ví dụ'],
          rows: [
            ['Dung lượng `segment.bytes`', '1 GB', 'Topic 10 GB/ngày → roll khoảng mỗi 2,4 giờ'],
            ['Thời gian `segment.ms`', '7 ngày', 'Topic 10 MB/ngày → không bao giờ đạt 1 GB → roll mỗi 7 ngày'],
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          text: '`segment.ms` chỉ được kiểm tra **khi có tin mới ghi vào**. Không ai ghi thì không có roll theo thời gian. `.index` và `.timeindex` roll cùng lúc với `.log`.',
        },
        {
          kind: 'list',
          items: [
            { title: 'Segment quá nhỏ', text: 'Roll liên tục, rất nhiều file. Broker giữ **một file handle mở cho mọi segment** (kể cả segment đã đóng), nên phải nâng giới hạn file của hệ điều hành; ghi đĩa cũng kém hiệu quả hơn.' },
            { title: 'Segment quá to', text: 'Dữ liệu bị giữ lâu hơn retention (xem phần sau) và tra offset theo thời gian kém chính xác.' },
            { title: 'Nhiều partition ít dữ liệu', text: 'Chỉ roll theo thời gian và có thể **cùng roll một lúc**, làm đĩa giật. Kafka có `segment.jitter.ms` để rải lệch thời điểm roll.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q(
              'Topic 10 GB/ngày, cấu hình mặc định. Ngưỡng nào khiến nó roll?',
              ['segment.ms — mỗi 7 ngày', 'segment.bytes — khoảng mỗi 2,4 giờ', 'Cả hai cùng lúc', 'retention.ms'],
              1,
              'Đầy 1 GB sau khoảng 2,4 giờ, sớm hơn nhiều so với 7 ngày.',
            ),
          ],
        },
      ],
    },
    {
      id: 'retention',
      title: 'Retention xoá cả segment, không xoá từng tin',
      blocks: [
        { kind: 'video', scenes: ['retention'] },
        {
          kind: 'list',
          items: [
            { title: 'Đơn vị xoá', text: 'Kafka xoá **nguyên segment**, không xoá từng tin.' },
            { title: 'Điều kiện', text: 'Segment chỉ bị xoá khi **tin mới nhất** trong nó đã quá `retention.ms`.' },
            { title: 'Hệ quả', text: 'Tin cũ hơn retention vẫn có thể còn, vì nằm chung segment với tin mới hơn.' },
            { title: 'Lịch dọn dẹp', text: 'Luồng dọn chạy mỗi `log.retention.check.interval.ms` (mặc định 5 phút).' },
          ],
        },
        {
          kind: 'table',
          head: ['Cấu hình', 'Mặc định', 'Ghi chú'],
          rows: [
            ['`retention.ms`', '7 ngày', 'Mức **sàn**: dữ liệu được giữ ít nhất chừng này'],
            ['`retention.bytes`', '-1 (không giới hạn)', 'Tính **theo từng partition**, không theo cả topic'],
            ['`log.retention.check.interval.ms`', '5 phút', 'Bao lâu luồng dọn dẹp chạy một lần'],
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Đặt cả hai kiểu retention',
          text: 'Có cả `retention.ms` và `retention.bytes` thì **điều kiện nào tới trước sẽ xoá trước**: một ngày ghi quá nhiều thì tin chưa đủ tuổi cũng mất. Sách *Kafka: The Definitive Guide* khuyên chỉ chọn **một** kiểu. Và vì `retention.bytes` tính theo partition, **tăng partition là tăng tổng dung lượng** topic được giữ.',
        },
        {
          kind: 'p',
          text: '**Dữ liệu sống thực tế ≈ thời gian để đóng segment + `retention.ms`.** Ví dụ trong sách: topic chỉ 100 MB/ngày, chỉ roll theo kích thước 1 GB → 10 ngày mới đóng segment, cộng retention 7 ngày → tin cũ nhất sống tới **17 ngày**.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q(
              'segment.ms = 7 ngày, retention.ms = 7 ngày, topic nhận tin đều đặn. Tin cũ nhất có thể còn trên đĩa khoảng bao lâu?',
              ['Đúng 7 ngày', 'Tối đa khoảng 14 ngày (cộng vài phút)', '5 phút', 'Vĩnh viễn'],
              1,
              'Một segment chứa tin trong 7 ngày; nó chỉ bị xoá khi tin mới nhất trong đó quá 7 ngày, tức tin đầu tiên đã gần 14 ngày tuổi.',
            ),
          ],
        },
      ],
    },
    {
      id: 'topic-im-lang',
      title: 'Cái bẫy: topic im lặng',
      blocks: [
        {
          kind: 'quiz',
          title: 'Dự đoán trước khi xem',
          questions: [
            q('Active segment có bao giờ bị xoá không?', ['Không bao giờ, vì nó đang được ghi', 'Có, khi topic im lặng quá retention', 'Chỉ khi broker restart', 'Chỉ khi xoá topic'], 1, 'Quy tắc "tin mới nhất quá hạn" áp dụng cho mọi segment, kể cả active.'),
          ],
        },
        { kind: 'video', scenes: ['idle'] },
        {
          kind: 'p',
          text: 'Topic nhận dữ liệu liên tục thì tin mới nhất trong active segment luôn còn trẻ, nên trên thực tế active segment không bị xoá. Nhưng khi topic **ngừng nhận dữ liệu** lâu hơn retention, mọi segment đều đủ điều kiện xoá. Vì partition luôn cần ít nhất một segment, luồng dọn dẹp **roll sang một segment rỗng** rồi xoá hết segment cũ.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Hệ quả thực tế',
          text: 'Consumer tắt quá lâu (lâu hơn retention) sẽ quay lại thấy offset đã commit **không còn tồn tại**. Lúc đó `auto.offset.reset` quyết định: `earliest` đọc từ đầu phần còn lại, `latest` âm thầm bỏ qua mọi thứ.',
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'Sách nói "active segment không bao giờ bị xoá"?',
          text: 'Sách *The Definitive Guide* (ch.6) viết vậy, và câu đó **đúng khi topic còn nhận dữ liệu**: tin mới nhất trong active segment luôn còn trẻ. Trường hợp topic im lặng quá retention là ngoại lệ ở trên: Kafka roll sang segment rỗng trước, rồi mới xoá segment cũ.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q(
              'Topic dev không ai ghi trong 10 ngày (retention 7 ngày). Điều gì xảy ra?',
              ['Topic bị xoá', 'Mọi segment cũ bị xoá, chỉ còn một segment rỗng mới', 'Active segment được giữ vì đang mở', 'Không có gì vì không có tin mới để kiểm tra'],
              1,
              'Luồng dọn dẹp không cần tin mới: nó roll sang segment rỗng rồi xoá hết segment cũ.',
            ),
          ],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: tự chỉnh roll và retention',
      blocks: [
        {
          kind: 'p',
          text: 'Mỗi ngày topic nhận 1 tin. Chỉnh `segment.ms`, `retention.ms` và số ngày topic im lặng. **Đoán trước**: với segment 7 ngày và retention 7 ngày, tin cũ nhất còn lại bao nhiêu ngày tuổi?',
        },
        { kind: 'widget', name: 'retention-lab' },
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
      'Kafka tìm segment chứa offset X bằng cách nào?',
      ['Mở từng file và đọc thử', 'Chọn file có tên (base offset) lớn nhất mà ≤ X', 'Chọn file mới nhất', 'Tra trong ZooKeeper'],
      1,
      'Tên file chính là base offset, nên chỉ cần so sánh tên.',
    ),
    q(
      'Vì sao chỉ active segment được ghi, còn các segment khác chỉ đọc?',
      ['Để file cũ không bao giờ thay đổi, an toàn để cache và xoá nguyên file', 'Vì đĩa chỉ cho ghi một file mỗi lúc', 'Để tiết kiệm RAM', 'Vì consumer khoá các file cũ'],
      0,
      'Log chỉ ghi nối đuôi, nên chỉ file cuối cần mở để ghi; file đã đóng thì bất biến.',
    ),
    q(
      'Bạn đặt retention.ms = 1 ngày nhưng thấy dữ liệu 5 ngày tuổi vẫn còn. Nguyên nhân khả dĩ nhất?',
      ['Kafka bị lỗi', 'segment.ms vẫn 7 ngày nên segment chứa tin cũ chưa đủ điều kiện xoá', 'retention.ms tính theo tuần', 'Consumer đang đọc nên không xoá'],
      1,
      'Segment chỉ bị xoá khi tin mới nhất quá hạn. Segment 7 ngày chứa cả tin 5 ngày tuổi lẫn tin mới; muốn xoá sát hơn thì giảm segment.ms.',
    ),
    q(
      'retention.bytes = 10 GB cho topic có 6 partition. Topic có thể chiếm tối đa khoảng bao nhiêu?',
      ['10 GB', '60 GB (cộng phần active segment)', '1,6 GB', 'Không giới hạn'],
      1,
      'retention.bytes tính theo từng partition: 6 × 10 GB.',
    ),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao retention.ms là thời gian giữ TỐI THIỂU chứ không phải giờ xoá chính xác?',
      keywords: ['segment', 'mới nhất', 'roll', '5 phút'],
      modelAnswer:
        'Vì Kafka xoá nguyên segment, và chỉ xoá khi tin mới nhất trong segment đã quá hạn, nên các tin cũ hơn trong cùng segment sống lâu hơn retention (có thể tới retention + segment.ms). Thêm nữa, luồng dọn dẹp chỉ chạy khoảng 5 phút một lần. Vì vậy retention chỉ đảm bảo dữ liệu được giữ ít nhất chừng đó.',
    },
  ],
  recap: {
    journey:
      'Một file duy nhất thì không xoá được phần cũ → cắt log thành segment, tên file là base offset → active segment roll khi đủ 1 GB hoặc 7 ngày → retention xoá nguyên segment khi tin mới nhất quá hạn → topic im lặng thì cả active segment cũng bị thay bằng segment rỗng.',
    points: [
      { title: 'Segment', text: 'Mỗi segment = .log + .index + .timeindex; xoá dữ liệu cũ = xoá file.' },
      { title: 'Base offset', text: 'Tên file = offset đầu tiên; tìm file = tên lớn nhất ≤ offset.' },
      { title: 'Roll', text: '`segment.bytes` (1 GB) hoặc `segment.ms` (7 ngày), cái nào tới trước; thời gian chỉ kiểm tra khi có tin mới.' },
      { title: 'Retention', text: 'Mức sàn, xoá theo segment khi tin mới nhất quá hạn — kể cả active segment khi topic im lặng.' },
    ],
    next: 'Bài tiếp theo: Sparse Index — trong một segment, Kafka tìm đúng vị trí byte của một offset thế nào.',
  },
}
