import type { ReactNode } from 'react'
import { cameraAt, clamp, lerp, move, sp, span, vis } from '../player/motion-kit'
import { ConsumerUnit, Envelope, HERO, Icon3D, LogTape, Packets, Rise, SOFT, Sheen, SoftScene, SoftTheme, Statement, SummaryList, Wire, type CellState } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene, SceneSfx } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { segmentRetentionScript } from './segment-retention-script'

/** This lesson is drawn in the navy glow style. */
const INK = SOFT
/** Snap time so counters change at most 6 times per second. */
const q6 = (t: number) => Math.floor(t * 6) / 6
const HERO_GLOW = '0 0 34px rgba(77,141,255,0.6), 0 24px 50px rgba(0,4,30,0.6), inset 0 2px 0 rgba(255,255,255,0.5), inset 0 -8px 16px rgba(0,10,60,0.35)'

/** Dark pill with a luminous outline, centred on (x, y): labels, thresholds and verdicts. */
function Tag({ x, y, text, color = INK.accent, o = 1, size = 30 }: { x: number; y: number; text: string; color?: string; o?: number; size?: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        padding: '10px 26px',
        borderRadius: 999,
        background: 'rgba(8,22,82,0.92)',
        border: `1.5px solid ${color}`,
        boxShadow: `0 0 20px ${color}99, inset 0 1px 0 rgba(255,255,255,0.15)`,
        color: '#ffffff',
        fontSize: size,
        fontWeight: 800,
        whiteSpace: 'nowrap',
        opacity: clamp(o),
      }}
    >
      {text}
    </div>
  )
}

/** A layer that cross-fades a state colour over a card (opacity only, so state changes never snap). */
const stateLayer = (background: string, boxShadow: string, o: number) => <div style={{ position: 'absolute', inset: 0, borderRadius: 22, background, boxShadow, opacity: clamp(o) }} />
const HOT = [HERO, '0 0 34px rgba(77,141,255,0.6), inset 0 2px 0 rgba(255,255,255,0.5)'] as const
const BAD = ['linear-gradient(160deg, rgba(255,90,106,0.5), rgba(90,10,40,0.88))', `0 0 30px ${INK.bad}aa, inset 0 0 0 3px ${INK.bad}`] as const
const GOOD = ['linear-gradient(160deg, rgba(62,230,160,0.38), rgba(6,60,70,0.88))', `0 0 30px ${INK.good}aa, inset 0 0 0 3px ${INK.good}`] as const
const AMBER = ['linear-gradient(160deg, rgba(255,181,71,0.45), rgba(80,50,10,0.85))', `0 0 30px ${INK.warn}aa, inset 0 0 0 3px ${INK.warn}`] as const

/** One segment as a glowing file card: base offset, its three files, a state badge. State weights are 0..1 cross-fades. */
function SegCard({
  x,
  y,
  w = 440,
  h = 330,
  base,
  baseSize = 84,
  chips = true,
  range,
  hot = 0,
  bad = 0,
  good = 0,
  amber = 0,
  lock = 0,
  write = 0,
  badge = 'ĐANG GHI',
  t,
  at,
  tx = 0,
  ty = 0,
  sc = 1,
  o = 1,
  children,
}: {
  x: number
  y: number
  w?: number
  h?: number
  base: number
  baseSize?: number
  chips?: boolean
  range?: string
  hot?: number
  bad?: number
  good?: number
  amber?: number
  lock?: number
  write?: number
  badge?: string
  t: number
  at: number
  tx?: number
  ty?: number
  sc?: number
  o?: number
  children?: ReactNode
}) {
  const baseH = baseSize * 1.05
  return (
    <div style={{ ...INK.card, position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, boxSizing: 'border-box', opacity: clamp(o), transform: `translate(${tx}px, ${ty}px) scale(${sc})` }}>
      {stateLayer(HOT[0], HOT[1], hot)}
      {stateLayer(GOOD[0], GOOD[1], good)}
      {stateLayer(AMBER[0], AMBER[1], amber)}
      {stateLayer(BAD[0], BAD[1], bad)}
      <div style={{ position: 'absolute', left: 26, top: 16, fontSize: baseSize, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, color: '#ffffff' }}>{base}</div>
      {chips && (
        <div style={{ position: 'absolute', left: 26, top: 16 + baseH + 6, display: 'flex', gap: 8 }}>
          {['.log', '.index', '.timeindex'].map((e) => (
            <span key={e} style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, padding: '2px 6px', borderRadius: 8, background: 'rgba(255,255,255,0.14)', color: '#dbe7ff' }}>
              {e}
            </span>
          ))}
        </div>
      )}
      {range && <div style={{ position: 'absolute', left: 26, top: 16 + baseH + (chips ? 56 : 10), fontSize: 30, fontWeight: 700, color: '#e6eeff', whiteSpace: 'nowrap' }}>{range}</div>}
      {children}
      <div style={{ position: 'absolute', right: 20, top: 22, opacity: clamp(write), display: write > 0.01 ? 'flex' : 'none', alignItems: 'center', gap: 8, padding: '4px 14px', borderRadius: 999, background: 'rgba(0,10,60,0.55)', border: '1.5px solid rgba(255,255,255,0.7)', fontSize: 24, fontWeight: 800, color: '#ffffff' }}>
        <span style={{ width: 12, height: 12, borderRadius: 6, background: '#ffffff', boxShadow: '0 0 12px #ffffff', opacity: 0.65 + 0.35 * Math.sin(t * 6) }} />
        {badge}
      </div>
      <div style={{ position: 'absolute', inset: 0, opacity: clamp(lock) }}>
        <Icon3D name="lock" x={w - 64} y={64} size={92} t={t} at={at} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ 0. cold open: two puzzling cases, one culprit */

function hook(t: number, c: Cue) {
  const [a1, a2] = [c.at(1), c.at(2)]
  const PY = 170
  const PW = 760
  const PH = 450
  const emptyP = span(t, a1 + 2.2, a1 + 2.7)
  const tape = (i: number): CellState => (i === 10 ? 'new' : 'filled')
  const CULPRIT = { x: 960, y: 865, w: 1000, h: 250 }
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, { x: 560, y: 430, s: 1.12 }], [a1 - 0.3, { x: 1360, y: 430, s: 1.12 }, 1.3], [a2 - 0.7, { x: 960, y: 540, s: 1 }, 1.4]])}>
      <Rise t={t} at={0.2}>
        <div style={{ ...INK.card, position: 'absolute', left: 140, top: PY, width: PW, height: PH }} />
      </Rise>
      <div style={{ position: 'absolute', left: 140, top: PY, width: PW, height: PH }}>
        <Rise t={t} at={0.5}>
          <div style={{ position: 'absolute', left: 36, top: 22, fontSize: 26, fontWeight: 700, letterSpacing: 2, color: INK.faint }}>HỒ SƠ #1 · RETENTION</div>
          <div style={{ position: 'absolute', left: 36, top: 62, fontSize: 48, fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap' }}>retention.ms = 7 ngày</div>
          <Icon3D name="calender" x={PW - 100} y={90} size={128} t={t} at={0.6} />
        </Rise>
        <Rise t={t} at={2.0}>
          <LogTape x={36} y={250} cells={11} cellW={62} state={tape} marks={[{ at: 2.5, label: '10 ngày tuổi', color: INK.warn }]} />
        </Rise>
        <Rise t={t} at={3.0}>
          <div style={{ position: 'absolute', left: 36, top: 366, fontSize: 56, fontWeight: 800, color: INK.warn, whiteSpace: 'nowrap', textShadow: `0 0 ${14 + 10 * Math.sin(t * 5)}px ${INK.warn}99` }}>VẪN CÒN?</div>
        </Rise>
      </div>
      <Rise t={t} at={a1 - 0.2}>
        <div style={{ ...INK.card, position: 'absolute', left: 1020, top: PY, width: PW, height: PH }} />
      </Rise>
      <div style={{ position: 'absolute', left: 1020, top: PY, width: PW, height: PH }}>
        <Rise t={t} at={a1 + 0.1}>
          <div style={{ position: 'absolute', left: 36, top: 22, fontSize: 26, fontWeight: 700, letterSpacing: 2, color: INK.faint }}>HỒ SƠ #2 · TOPIC IM LẶNG</div>
          <div style={{ position: 'absolute', left: 36, top: 62, fontSize: 48, fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap' }}>Nghỉ Tết quay lại…</div>
          <Icon3D name="clock" x={PW - 100} y={90} size={128} t={t} at={a1 + 0.2} />
        </Rise>
        <Rise t={t} at={a1 + 0.9}>
          <div style={{ opacity: 1 - emptyP }}>
            <LogTape x={36} y={250} cells={11} cellW={62} state={tape} />
          </div>
          <div style={{ opacity: emptyP }}>
            <LogTape x={36} y={250} cells={11} cellW={62} state={() => 'empty'} marks={[{ at: 2.5, label: '0 tin', color: INK.bad }]} />
          </div>
        </Rise>
        <div style={{ position: 'absolute', left: 36, top: 366, fontSize: 56, fontWeight: 800, color: INK.bad, whiteSpace: 'nowrap', opacity: vis(t, a1 + 2.8), textShadow: `0 0 ${14 + 10 * Math.sin(t * 5)}px ${INK.bad}99` }}>TRỐNG TRƠN?</div>
      </div>
      {[520, 1400].map((x, i) => (
        <div key={x}>
          <Wire from={{ x, y: PY + PH + 6 }} to={{ x, y: CULPRIT.y - CULPRIT.h / 2 - 6 }} color={INK.line} p={move(t, a2 + 0.1 + i * 0.15, 0.5)} flow={t} />
          <Packets t={t} from={{ x, y: PY + PH + 6 }} to={{ x, y: CULPRIT.y - CULPRIT.h / 2 - 6 }} start={a2 + 0.5 + i * 0.1} every={0.45} len={0.7} color={INK.warn} size={22} />
        </div>
      ))}
      <Rise t={t} at={a2 + 0.5}>
        <div style={{ position: 'absolute', left: CULPRIT.x - CULPRIT.w / 2, top: CULPRIT.y - CULPRIT.h / 2, width: CULPRIT.w, height: CULPRIT.h, borderRadius: 26, background: HERO, boxShadow: HERO_GLOW, overflow: 'hidden', textAlign: 'center' }}>
          <Sheen t={t} every={3.5} />
          <div style={{ marginTop: 18, fontSize: 28, fontWeight: 700, letterSpacing: 4, color: 'rgba(255,255,255,0.8)' }}>THỦ PHẠM</div>
          <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05, color: '#ffffff' }}>SEGMENT</div>
          <div style={{ marginTop: 6, fontSize: 32, fontWeight: 700, color: '#e6eeff', opacity: vis(t, a2 + 2.0) }}>cách Kafka cắt log thành file</div>
        </div>
      </Rise>
      <div style={{ position: 'absolute', left: 0, top: CULPRIT.y + 74, width: 1920, display: 'flex', justifyContent: 'center', gap: 12 }}>
        {['.log', '.index', '.timeindex'].map((e, k) => (
          <span key={e} style={{ fontFamily: MONO, fontSize: 28, fontWeight: 700, padding: '4px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.18)', color: '#ffffff', opacity: vis(t, a2 + 3.4 + k * 0.25) }}>
            {e}
          </span>
        ))}
      </div>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 1. why segments */

function split(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const CELL = 44
  const PER = 9
  const X0 = 93
  const TY = 430
  const grow = span(q6(t), a0 + 0.5, a1 + 0.2)
  const n = Math.floor(lerp(4, 36, grow))
  const cut = a2 + 0.5
  const gap = lerp(0, 50, move(t, cut + 0.4, 0.7))
  const toss = move(t, a2 + 2.6, 1.0)
  const px = (i: number) => X0 + i * PER * CELL + i * gap
  const headBad = span(t, a1 + 0.7, a1 + 1.1) * (1 - span(t, cut, cut + 0.4))
  const state = (i: number): CellState => (i === n - 1 ? 'new' : i < n ? 'filled' : 'empty')
  const xn = X0 + (n - 0.5) * CELL
  return (
    <SoftScene
      t={t}
      camera={cameraAt(t, [[0, { x: 960, y: 520, s: 1 }], [a1, { x: 900, y: 520, s: 1.04 }, 1.2], [a2, { x: 960, y: 560, s: 1 }, 1.2]])}
      title={{ kicker: 'VÌ SAO', text: 'Cắt log thành segment' }}
    >
      {[0, 1, 2, 3].map((i) => {
        const tossed = i === 0
        const cx = px(i) + (PER * CELL) / 2
        const dy = tossed ? 270 * toss : 0
        const sc = tossed ? lerp(1, 0.3, toss) : 1
        return (
          <div key={i} style={{ transform: `translate(0px, ${dy}px) scale(${sc})`, transformOrigin: `${cx}px ${TY + 35}px`, opacity: tossed ? 1 - span(t, a2 + 3.3, a2 + 3.7) : 1 }}>
            <LogTape x={px(i)} y={TY} cells={PER} cellW={CELL} state={(j) => state(i * PER + j)} tick={PER} offsetOf={(j) => i * PER + j} />
            <div style={{ position: 'absolute', left: cx - 130, width: 260, top: TY + 112, textAlign: 'center', fontSize: 30, fontWeight: 800, color: '#ffffff', opacity: vis(t, cut + 0.8 + i * 0.12) }}>segment {i + 1}</div>
          </div>
        )
      })}
      <div style={{ position: 'absolute', left: X0 + 3, top: TY, width: 6 * CELL - 6, height: 70, borderRadius: 14, background: 'rgba(255,90,106,0.5)', border: `3px dashed ${INK.bad}`, boxSizing: 'border-box', opacity: headBad }} />
      <Packets t={t} from={{ x: xn, y: TY - 130 }} to={{ x: xn, y: TY + 25 }} start={a0 + 0.9} end={a1 - 0.1} every={0.3} len={0.55} size={22} />
      <Packets t={t} from={{ x: X0 + 36 * CELL - 20, y: TY + 35 }} to={{ x: X0 + 6 * CELL, y: TY + 35 }} start={a1 + 1.1} end={cut} every={0.3} len={0.9} color={INK.warn} size={20} />
      {[1, 2, 3].map((i) => {
        const p = move(t, cut + (i - 1) * 0.15, 0.35)
        const xc = X0 + i * PER * CELL + (i - 0.5) * gap
        return <div key={i} style={{ position: 'absolute', left: xc - 3, top: TY - 50, width: 6, height: 190 * p, borderRadius: 3, background: INK.bad, boxShadow: `0 0 16px ${INK.bad}`, opacity: 1 - span(t, cut + 1.0, cut + 1.4) }} />
      })}
      <Tag x={440} y={300} text="1 file .log duy nhất" o={vis(t, a0 + 0.3, a1 - 0.1)} />
      <Tag x={1560} y={300} text={`1 file · ${Math.round(grow * 1000)} GB`} color={INK.warn} size={36} o={vis(t, a0 + 0.8, cut - 0.1)} />
      <Tag x={960} y={300} text="xoá phần đầu = viết lại cả file" color={INK.bad} o={vis(t, a1 + 0.4, cut - 0.1)} />
      <div style={{ opacity: vis(t, a1 + 1.6) * (1 - span(t, cut - 0.2, cut + 0.3)) }}>
        <Icon3D name="money-bag" x={1660} y={710} size={190} t={t} at={a1 + 1.6} />
        <Tag x={1660} y={850} text="tốn kém" color={INK.bad} size={34} />
      </div>
      <Rise t={t} at={a2 + 2.2}>
        <Icon3D name="trash-can" x={px(0) + (PER * CELL) / 2} y={830} size={210} t={t} at={a2 + 2.2} />
      </Rise>
      <Statement x={640} y={780} text="xoá dữ liệu cũ = xoá 1 file" color={INK.good} size={58} o={sp(t, a2 + 3.4)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 2. base offset naming */

const FILES = [
  { base: 0, range: 'offset 0 → 99', x: 400 },
  { base: 100, range: 'offset 100 → 199', x: 960 },
  { base: 200, range: 'offset 200 → …', x: 1520 },
]

function naming(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const ask = a1 + 2.4
  const checkAt = (k: number) => a2 + 0.4 + k * 0.7
  const CY = 640
  const activeP = span(t, a3 + 0.3, a3 + 0.7)
  const pickP = span(t, a2 + 2.6, a2 + 3.0) * (1 - span(t, a3, a3 + 0.4))
  return (
    <SoftScene
      t={t}
      camera={cameraAt(t, [[0, { x: 960, y: 600, s: 1 }], [a1, { x: 960, y: 600, s: 1.06 }, 1.2], [a2 + 2.4, { x: 960, y: 620, s: 1.1 }, 1.0], [a3, { x: 1000, y: 600, s: 1.04 }, 1.1], [a3 + 3.6, { x: 960, y: 580, s: 1 }, 1.4]])}
      title={{ kicker: 'TÊN FILE', text: 'Base offset' }}
    >
      {FILES.map((f, k) => {
        const appear = a0 + 0.5 + k * 0.25
        return (
          <Rise key={f.base} t={t} at={appear}>
            <SegCard x={f.x} y={CY} w={480} h={330} base={f.base} range={f.range} lock={k === 2 ? 1 - activeP : 1} hot={k === 2 ? activeP : 0} write={k === 2 ? activeP : 0} amber={k === 1 ? pickP : 0} t={t} at={appear + 0.2} />
          </Rise>
        )
      })}
      {FILES.map((f, k) => (
        <Tag key={`first${f.base}`} x={f.x} y={CY - 205} text={`tin đầu tiên = offset ${f.base}`} size={28} o={vis(t, a0 + 1.4 + k * 0.5, a1 + 2.2)} />
      ))}
      {FILES.map((f, k) => {
        const ok = f.base <= 150
        const color = ok ? INK.good : INK.bad
        return (
          <div key={`chk${f.base}`} style={{ position: 'absolute', left: f.x - 240, width: 480, top: CY + 200, textAlign: 'center', fontSize: 48, fontWeight: 800, color, textShadow: `0 0 18px ${color}88`, opacity: clamp(sp(t, checkAt(k))) * (1 - span(t, a3, a3 + 0.4)) }}>
            {f.base} {ok ? '≤' : '>'} 150 {ok ? '✓' : '✗'}
          </div>
        )
      })}
      <Tag x={960} y={290} text="đọc offset 150?" size={42} o={vis(t, ask, a2 + 2.3)} />
      <Icon3D name="tick" x={960} y={285} size={150} t={t} at={a2 + 2.7} />
      <Tag x={960} y={965} text="chỉ cần nhìn tên file · không mở file" color={INK.warn} size={34} o={vis(t, a2 + 3.2, a3 - 0.1)} />
      <Rise t={t} at={a3 + 0.6}>
        <Icon3D name="message" x={1520} y={270} size={140} t={t} at={a3 + 0.6} />
      </Rise>
      <Packets t={t} from={{ x: 1520, y: 345 }} to={{ x: 1520, y: CY - 160 }} start={a3 + 0.9} every={0.45} len={0.6} size={22} />
      <Tag x={1520} y={880} text="chỉ file này được ghi thêm" color={INK.good} size={32} o={vis(t, a3 + 1.0)} />
      <Tag x={680} y={880} text="đã đóng · chỉ đọc" color={INK.accent} size={32} o={vis(t, a3 + 2.4)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 3. roll */

const rollTimes = (c: Cue) => [c.at(0) + 3.0, c.end(1) - 0.2, c.at(2) + 3.6, c.at(3) + 2.4]

function roll(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const rolls = rollTimes(c)
  const shift = move(t, rolls[3], 0.8)
  const X = (k: number) => 300 + 450 * k - 450 * shift
  const appear = (k: number) => (k === 0 ? a0 + 0.5 : rolls[k - 1])
  const closedP = (k: number) => (k < 4 ? span(t, rolls[k], rolls[k] + 0.4) : 0)
  const tq = q6(t)
  const sizeOf = (k: number) => (k === 0 ? span(tq, a0 + 0.8, rolls[0]) : k === 1 ? span(tq, rolls[0] + 0.3, rolls[1]) : k === 2 ? 0.3 * span(tq, rolls[1] + 0.3, rolls[2]) : k === 3 ? 0.05 : 0.02)
  const daysOf = (k: number) => (k === 0 ? 0.4 * span(tq, a0 + 0.8, rolls[0]) : k === 1 ? 1.5 * span(tq, rolls[0] + 0.3, rolls[1]) : k === 2 ? 7 * span(tq, a2 + 0.3, rolls[2]) : k === 3 ? 8 * span(tq, rolls[2] + 0.8, a3 + 1.0) : 0)
  const CY = 620
  const meter = (top: number, label: string, value: string, frac: number, color: string) => (
    <>
      <div style={{ position: 'absolute', left: 24, top, fontSize: 24, fontWeight: 700, color: INK.faint }}>{label}</div>
      <div style={{ position: 'absolute', right: 24, top: top - 2, fontSize: 26, fontWeight: 800, color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ position: 'absolute', left: 24, right: 24, top: top + 40, height: 18, borderRadius: 9, background: 'rgba(0,10,60,0.6)', overflow: 'hidden' }}>
        <div style={{ width: `${clamp(frac) * 100}%`, height: '100%', background: color }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: `${clamp(frac) * 100}%`, height: '100%', background: INK.bad, opacity: span(frac, 0.9, 1) }} />
      </div>
    </>
  )
  return (
    <SoftScene
      t={t}
      camera={cameraAt(t, [[0, { x: 700, y: 600, s: 1 }], [a1, { x: 850, y: 600, s: 1 }, 1.2], [a2, { x: 1000, y: 600, s: 1 }, 1.2], [a3, { x: 1000, y: 600, s: 1 }, 1.2], [rolls[3] + 0.2, { x: 960, y: 600, s: 1 }, 1.4]])}
      title={{ kicker: 'ROLL', text: 'Đóng file cũ, mở file mới' }}
    >
      {[0, 1, 2, 3, 4].map((k) => {
        const cp = closedP(k)
        const days = daysOf(k)
        return (
          <Rise key={k} t={t} at={appear(k)}>
            <SegCard x={X(k)} y={CY} w={400} h={430} base={k * 100} hot={1 - cp} write={1 - cp} lock={cp} t={t} at={appear(k) + 0.2}>
              <div style={{ opacity: lerp(1, 0.7, cp) }}>
                {meter(206, 'kích thước', `${(sizeOf(k) * 1).toFixed(1)} / 1 GB`, sizeOf(k), '#d9e6ff')}
                {meter(300, 'tuổi', `${days.toFixed(1)} / 7 ngày`, days / 7, INK.warn)}
              </div>
            </SegCard>
          </Rise>
        )
      })}
      {[0, 1, 2, 3, 4].map((k) => (
        <Packets key={k} t={t} from={{ x: X(k), y: 320 }} to={{ x: X(k), y: CY - 220 }} start={appear(k) + 0.4} end={k < 4 ? rolls[k] : Infinity} every={0.35} len={0.6} size={22} />
      ))}
      {[0, 1, 2].map((k) => (
        <Envelope key={k} t={t} at={rolls[k] - 0.7} from={{ x: X(k), y: 370 }} to={{ x: X(k + 1), y: 370 }} label="roll" color={INK.good} len={0.7} arc={70} />
      ))}
      <Envelope t={t} at={a3 + 1.5} from={{ x: X(3) + 200, y: 270 }} to={{ x: X(3), y: 400 }} label="tin mới" len={0.7} arc={30} />
      <Tag x={X(1)} y={910} text="segment.bytes = 1 GB" size={30} o={vis(t, a1 + 0.3, a2)} />
      <Tag x={X(2)} y={910} text="segment.ms = 7 ngày" color={INK.warn} size={30} o={vis(t, a2 + 0.2, a3)} />
      <Tag x={1100} y={275} text="ngưỡng nào tới trước → roll trước" color={INK.warn} size={32} o={vis(t, a2 + 1.4, a3)} />
      <Tag x={X(3)} y={910} text="không có tin mới → chưa roll" color={INK.bad} size={28} o={vis(t, a3 + 0.3, a3 + 1.7)} />
      <Tag x={X(3)} y={910} text="có tin mới → kiểm tra → roll" color={INK.good} size={28} o={vis(t, a3 + 1.9, rolls[3] + 1.0)} />
    </SoftScene>
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
const retentionDrop = (c: Cue) => c.at(1) + 3.4
const retentionJudge = (c: Cue, k: number) => c.at(1) + 1.0 + k * 0.5

function retention(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const dropAt = retentionDrop(c)
  const TRASH = { x: 330, y: 965 }
  const CY = 505
  const sweep = ((t - (a3 + 0.3)) % 2.4) / 2.4
  return (
    <SoftScene
      t={t}
      camera={cameraAt(t, [[0, { x: 1000, y: 600, s: 1 }], [a1 + 0.2, { x: 900, y: 600, s: 1.03 }, 1.1], [a2, { x: 1100, y: 600, s: 1.03 }, 1.0], [a3, { x: 1000, y: 620, s: 1 }, 1.3]])}
      title={{ kicker: 'RETENTION', text: 'Giữ dữ liệu bao lâu?' }}
    >
      <div style={{ position: 'absolute', left: dayX(20.5), top: 770, width: 21 * DAY + 40, height: 6, borderRadius: 3, background: INK.line, transformOrigin: 'left', transform: `scaleX(${move(t, a0 + 0.4, 1.2)})` }} />
      {[20, 15, 10, 5, 0].map((d) => (
        <div key={d} style={{ position: 'absolute', left: dayX(d) - 120, width: 240, top: 792, textAlign: 'center', fontSize: 26, fontWeight: 700, color: INK.faint, opacity: vis(t, a0 + 1.0) }}>
          {d === 0 ? 'hôm nay' : `${d} ngày trước`}
        </div>
      ))}
      {SEGS.map((s, k) => {
        const dead = s.newest > RETENTION
        const judgeAt = retentionJudge(c, k)
        const p = span(t, judgeAt, judgeAt + 0.35)
        const fall = dead ? move(t, dropAt, 0.9) : 0
        const cx = dayX(s.oldest) + 6 + ((s.oldest - s.newest) * DAY - 12) / 2
        const w = (s.oldest - s.newest) * DAY - 12
        const appear = a0 + 0.8 + k * 0.2
        const shown = dead ? 1 - span(t, dropAt + 0.6, dropAt + 1.0) : 1
        return (
          <div key={s.base}>
            <Rise t={t} at={appear}>
              <SegCard x={cx} y={CY} w={w} h={350} base={s.base} baseSize={72} chips={false} good={dead ? 0 : p} bad={dead ? p : 0} write={k === 3 ? 1 : 0} t={t} at={appear} tx={fall * (TRASH.x - cx)} ty={fall * (TRASH.y - CY)} sc={lerp(1, 0.25, fall)} o={shown}>
                {k === 2 && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: (3 / 5) * w, borderRadius: '22px 0 0 22px', background: 'rgba(255,181,71,0.3)', borderRight: `3px dashed ${INK.warn}`, opacity: vis(t, a2 + 0.4, a3) }} />}
                <div style={{ position: 'absolute', left: 26, top: 130, fontSize: 26, fontWeight: 700, color: '#e6eeff' }}>tin mới nhất:</div>
                <div style={{ position: 'absolute', left: 26, top: 164, fontSize: 48, fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap' }}>{s.newest === 0 ? 'vừa ghi' : `${s.newest} ngày`}</div>
                <div style={{ position: 'absolute', right: 20, bottom: 18, opacity: p * (1 - fall) }}>
                  <Icon3D name={dead ? 'trash-can' : 'tick'} x={-50} y={-50} size={100} t={t} at={judgeAt} />
                </div>
              </SegCard>
            </Rise>
            <div style={{ position: 'absolute', left: cx - w / 2, width: w, top: CY + 190, textAlign: 'center', fontSize: 34, fontWeight: 800, color: dead ? INK.bad : INK.good, opacity: p * (1 - span(t, dropAt - 0.2, dropAt + 0.2)) }}>{dead ? 'xoá cả file' : 'giữ'}</div>
          </div>
        )
      })}
      <Packets t={t} from={{ x: 1900, y: CY }} to={{ x: 1770, y: CY }} start={a0 + 1.5} every={0.4} len={0.6} size={22} />
      <div style={{ position: 'absolute', left: dayX(RETENTION) - 4, top: 290, width: 8, height: 480 * move(t, a0 + 2.0, 0.6), borderRadius: 4, background: INK.bad, boxShadow: `0 0 18px ${INK.bad}` }} />
      <Tag x={dayX(RETENTION)} y={255} text="mốc retention: 7 ngày" color={INK.bad} o={vis(t, a0 + 2.4, a2)} />
      <Tag x={dayX(9.5)} y={255} text="10 ngày tuổi vẫn còn" color={INK.warn} o={vis(t, a2 + 0.6, a2 + 2.3)} />
      <Tag x={1100} y={255} text="tin mới nhất mới 5 ngày → giữ cả file" color={INK.good} o={vis(t, a2 + 2.5, a3)} />
      <Icon3D name="trash-can" x={TRASH.x} y={TRASH.y} size={150} t={t} at={dropAt - 0.4} />
      <div style={{ position: 'absolute', left: dayX(20) + sweep * 20 * DAY - 2, top: 290, width: 4, height: 480, borderRadius: 2, background: INK.accent, boxShadow: `0 0 18px ${INK.accent}`, opacity: vis(t, a3 + 0.3) * 0.8 }} />
      <Rise t={t} at={a3 + 0.3}>
        <Icon3D name="setting" x={880} y={925} size={130} t={t} at={a3 + 0.3} />
      </Rise>
      <Tag x={1290} y={925} text="dọn dẹp ~5 phút / lần" color={INK.accent} size={34} o={sp(t, a3 + 0.5)} />
      <Statement x={560} y={985} text="retention = thời gian giữ TỐI THIỂU" color={INK.warn} size={52} o={sp(t, a3 + 2.6)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 5. idle topic trap */

const idleRoll = (c: Cue) => c.at(1) + 3.0

function idle(t: number, c: Cue) {
  const [a1, a2] = [c.at(1), c.at(2)]
  const rollAt = idleRoll(c)
  const silent = Math.floor(lerp(0, 8, span(q6(t), a1 + 0.2, a1 + 3.0)))
  const over = span(t, rollAt - 1.0, rollAt - 0.6)
  const toss = move(t, rollAt + 0.8, 1.0)
  const CY = 620
  const A = { x: 470, w: 520 }
  const B = { x: 1090, w: 520 }
  const emptyP = span(t, a2 + 4.8, a2 + 5.2)
  return (
    <SoftScene
      t={t}
      camera={cameraAt(t, [[0, { x: 960, y: 560, s: 1 }], [a1, { x: 800, y: 580, s: 1.06 }, 1.0], [rollAt, { x: 900, y: 600, s: 1.04 }, 1.0], [a2 + 2.2, { x: 1060, y: 600, s: 1.04 }, 1.2]])}
      title={{ kicker: 'CÂU HỎI BẪY', text: 'Active segment có bị xoá?', until: a1 + 0.1 }}
    >
      <div style={{ opacity: vis(t, 1.6, a1) }}>
        <Icon3D name="message" x={A.x} y={290} size={120} t={t} at={1.6} />
      </div>
      <Packets t={t} from={{ x: A.x, y: 350 }} to={{ x: A.x, y: CY - 175 }} start={2.0} end={a1 + 0.1} every={0.4} len={0.6} size={22} />
      <Rise t={t} at={1.8}>
        <SegCard
          x={A.x}
          y={CY}
          w={A.w}
          h={380}
          base={500}
          range={`tin cuối: ${silent} ngày trước`}
          hot={1 - span(t, rollAt, rollAt + 0.4)}
          write={1 - span(t, rollAt, rollAt + 0.4)}
          bad={span(t, rollAt, rollAt + 0.4)}
          t={t}
          at={2.0}
          ty={330 * toss}
          sc={lerp(1, 0.25, toss)}
          o={1 - span(t, rollAt + 1.6, rollAt + 1.9)}
        />
      </Rise>
      <div style={{ opacity: vis(t, a1 + 0.1, a2 + 0.2) }}>
        <Icon3D name="clock" x={650} y={300} size={110} t={t} at={a1 + 0.1} />
        <div style={{ position: 'absolute', left: 730, top: 262, fontSize: 64, fontWeight: 800, color: INK.warn, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>im lặng {silent} ngày</div>
        <div style={{ position: 'absolute', left: 730, top: 262, fontSize: 64, fontWeight: 800, color: INK.bad, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', opacity: over, textShadow: `0 0 20px ${INK.bad}88` }}>im lặng {silent} ngày</div>
      </div>
      <Envelope t={t} at={rollAt - 0.7} from={{ x: A.x, y: 410 }} to={{ x: B.x, y: 410 }} label="roll" color={INK.good} len={0.7} arc={70} />
      <Rise t={t} at={rollAt}>
        <SegCard x={B.x} y={CY} w={B.w} h={380} base={517} range="0 tin" hot={1 - emptyP} bad={emptyP} write={1 - emptyP} badge="MỚI · RỖNG" t={t} at={rollAt} />
      </Rise>
      <Icon3D name="trash-can" x={A.x} y={940} size={190} t={t} at={2.3} />
      <Tag x={800} y={940} text="xoá được không?" size={34} o={vis(t, 2.4, a1 + 0.3)} />
      <Tag x={800} y={940} text="dữ liệu cũ đã mất hết" color={INK.bad} size={34} o={vis(t, a2 + 1.5)} />
      <Tag x={B.x} y={305} text="topic vẫn còn" color={INK.good} size={36} o={vis(t, a2 + 0.7, a2 + 3.8)} />
      <Tag x={B.x} y={305} text="partition trống trơn?!" color={INK.bad} size={38} o={vis(t, a2 + 4.2)} />
      <Rise t={t} at={a2 + 2.4}>
        <ConsumerUnit x={1480} y={561} w={380} name="consumer" note="sau Tết" parts={['P0']} t={t} busy={(t * 0.9) % 1} />
      </Rise>
      <Envelope t={t} at={a2 + 3.3} from={{ x: 1480, y: 540 }} to={{ x: B.x + B.w / 2 + 10, y: 540 }} label="poll()" len={0.8} arc={50} />
      <Envelope t={t} at={a2 + 4.1} from={{ x: B.x + B.w / 2 + 10, y: 720 }} to={{ x: 1480, y: 720 }} label="0 tin" color={INK.bad} len={0.8} arc={-40} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 6. summary */

function summary(t: number, c: Cue) {
  return (
    <SoftTheme>
      <SummaryList t={t} cue={c} items={['Log cắt thành segment: xoá cũ = xoá file', 'Tên file = base offset · lớn nhất là active', 'Roll khi đủ 1 GB hoặc 7 ngày, cái nào trước', 'Retention xoá cả segment, kể cả active']} />
    </SoftTheme>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { hook, split, naming, roll, retention, idle, summary }

/** Key-moment sounds, timed to the same cue offsets the scenes animate on. */
const SFX: Record<string, SceneSfx[]> = {
  split: [
    { kind: 'error', at: (c) => c.at(1) + 0.7 },
    { kind: 'tick', at: (c) => c.at(2) + 0.5 },
    { kind: 'ding', at: (c) => c.at(2) + 3.4 },
  ],
  naming: [
    { kind: 'ding', at: (c) => c.at(2) + 2.7 },
    { kind: 'tick', at: (c) => c.at(3) + 0.3 },
  ],
  roll: [
    { kind: 'tick', at: (c) => rollTimes(c)[0] },
    { kind: 'tick', at: (c) => rollTimes(c)[1] },
    { kind: 'tick', at: (c) => rollTimes(c)[2] },
    { kind: 'tick', at: (c) => rollTimes(c)[3] },
  ],
  retention: [
    { kind: 'tick', at: (c) => retentionJudge(c, 1) },
    { kind: 'error', at: (c) => retentionDrop(c) + 0.5 },
  ],
  idle: [
    { kind: 'error', at: (c) => idleRoll(c) },
    { kind: 'error', at: (c) => c.at(2) + 4.8 },
  ],
}

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const segmentRetentionLesson: Lesson = {
  ...segmentRetentionScript,
  scenes: segmentRetentionScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id], sfx: SFX[s.id] })),
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
