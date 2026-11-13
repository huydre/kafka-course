import { cameraAt, clamp, lerp, move, sp, span, vis } from '../player/motion-kit'
import { ConsumerUnit, Envelope, HERO, Icon3D, Packets, Rise, SOFT, SOFT_PANEL, ServerUnit, SoftScene, SoftTheme, SummaryList, Wire } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene, SceneSfx } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { transactionsScript } from './transactions-script'

/** This lesson is drawn in the navy glow style. */
const INK = SOFT
const panel = SOFT_PANEL
const WIDE = { x: 960, y: 540, s: 1 }

/** Time at fraction p of beat k. */
const at = (c: Cue, k: number, p: number) => c.at(k) + (c.end(k) - c.at(k)) * p

/* ------------------------------------------------------------------ shared: tape with labelled cells */

const CH = 70
const GREEN = 'linear-gradient(160deg, #9ff5cf 0%, #27d391 55%, #0e9a6c 100%)'
const RED = 'linear-gradient(160deg, #ff9aa5 0%, #ff4d60 55%, #b3202f 100%)'

type Kind = 'data' | 'open' | 'commit' | 'abort' | 'dead' | 'dup' | 'lost'
type Spec = { kind: Kind; label?: string; at: number; ring?: boolean }

const Glyph = ({ ok }: { ok: boolean }) => (
  <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
    {ok ? <polyline points="5 13 10 18 19 7" /> : <path d="M6 6l12 12M18 6L6 18" />}
  </svg>
)

function Slot({ t, x, y, w, spec }: { t: number; x: number; y: number; w: number; spec: Spec }) {
  const k = sp(t, spec.at, 14, 140)
  if (k <= 0) return null
  const { kind } = spec
  const bg = kind === 'commit' ? GREEN : kind === 'abort' || kind === 'dup' ? RED : kind === 'dead' ? INK.cell.dead : kind === 'lost' ? 'transparent' : INK.cell.filled
  const border = kind === 'open' ? `3px dashed ${INK.warn}` : kind === 'dead' ? `2px dashed ${INK.bad}` : kind === 'lost' ? `3px dashed ${INK.bad}` : 'none'
  const shadow = kind === 'data' || kind === 'open' ? 'inset 0 2px 0 rgba(255,255,255,0.5), 0 0 14px rgba(77,141,255,0.35), 0 10px 20px rgba(0,8,50,0.45)' : kind === 'commit' || kind === 'abort' || kind === 'dup' ? 'inset 0 2px 0 rgba(255,255,255,0.6), 0 0 20px rgba(255,255,255,0.25)' : undefined
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: CH, padding: '0 3px', boxSizing: 'border-box', opacity: clamp(k * 1.6), transform: `scale(${0.85 + 0.15 * k})` }}>
      <div style={{ height: '100%', borderRadius: 14, boxSizing: 'border-box', background: bg, border, boxShadow: spec.ring ? `${shadow ?? ''}${shadow ? ', ' : ''}0 0 0 4px #ffffff, 0 0 26px rgba(255,255,255,0.8)` : shadow, display: 'grid', placeItems: 'center', fontSize: 26, fontWeight: 800, color: kind === 'lost' ? INK.bad : kind === 'dead' ? INK.faint : '#fff', opacity: kind === 'dead' ? 0.8 : 1 }}>
        {kind === 'commit' ? <Glyph ok /> : kind === 'abort' ? <Glyph ok={false} /> : spec.label}
      </div>
    </div>
  )
}

/** A tape of `n` equal slots with optional cell specs, a title above and offset numbers below. */
function Tape({ t, x, y, cw, n, cells, title, base = 0, ticks = true, o = 1 }: { t: number; x: number; y: number; cw: number; n: number; cells: Record<number, Spec>; title?: string; base?: number; ticks?: boolean; o?: number }) {
  return (
    <div style={{ opacity: clamp(o) }}>
      {title && <div style={{ position: 'absolute', left: x, top: y - 50, fontSize: 26, fontWeight: 700, color: INK.faint, whiteSpace: 'nowrap' }}>{title}</div>}
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ position: 'absolute', left: x + i * cw, top: y, width: cw, height: CH, padding: '0 3px', boxSizing: 'border-box' }}>
          <div style={{ height: '100%', borderRadius: 14, boxSizing: 'border-box', background: INK.cell.empty, border: '1.5px solid rgba(110,160,255,0.35)' }} />
        </div>
      ))}
      {Object.entries(cells).map(([i, spec]) => (
        <Slot key={i} t={t} x={x + Number(i) * cw} y={y} w={cw} spec={spec} />
      ))}
      {ticks &&
        Array.from({ length: n }, (_, i) => (
          <span key={i} style={{ position: 'absolute', left: x + i * cw, width: cw, textAlign: 'center', top: y + CH + 8, fontFamily: MONO, fontSize: 24, color: INK.faint }}>
            {base + i}
          </span>
        ))}
    </div>
  )
}

/** Small glowing pill. */
function Pill({ x, y, text, color = '#ffffff', o = 1, mono = false, size = 26, center = false }: { x: number; y: number; text: string; color?: string; o?: number; mono?: boolean; size?: number; center?: boolean }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: center ? 'translateX(-50%)' : undefined, padding: '8px 20px', borderRadius: 999, background: 'rgba(8,22,82,0.92)', border: `1.5px solid ${color === '#ffffff' ? '#6ea2ff' : color}`, boxShadow: `0 0 18px ${color === '#ffffff' ? 'rgba(77,141,255,0.65)' : `${color}88`}`, fontFamily: mono ? MONO : undefined, fontSize: size, fontWeight: 800, color, whiteSpace: 'nowrap', opacity: clamp(o) }}>
      {text}
    </div>
  )
}

/** Centred one-line caption under a diagram. */
const Caption = ({ y, text, color, o }: { y: number; text: string; color: string; o: number }) => (
  <div style={{ position: 'absolute', left: 0, top: y, width: 1920, textAlign: 'center', fontSize: 44, fontWeight: 800, letterSpacing: -0.5, color, whiteSpace: 'nowrap', opacity: clamp(o), transform: `translateY(${(1 - clamp(o)) * 20}px)` }}>{text}</div>
)

/* ------------------------------------------------------------------ 0. cold open: two writes, one crash */

function hook(t: number, c: Cue) {
  const [a2, a3] = [c.at(2), c.at(3)]
  const dieAt = at(c, 2, 0.55)
  const upAt = at(c, 3, 0.15)
  const down = t >= dieAt && t < upAt
  const O = { x: 110, y: 505, cw: 64 }
  const I = { x: 1330, y: 265, cw: 64 }
  const F = { x: 1330, y: 775, cw: 64 }
  const orders: Record<number, Spec> = {}
  'abcdef'.split('').forEach((ch, i) => (orders[i] = { kind: 'data', label: ch, at: 0.3 + i * 0.08 }))
  const inv: Record<number, Spec> = {
    0: { kind: 'data', label: 'A', at: 0.6 },
    1: { kind: 'data', label: 'B', at: 0.7 },
    2: { kind: 'data', label: 'C', at: 0.8 },
    3: { kind: 'data', label: 'D', at: at(c, 1, 0.4) },
    4: { kind: 'data', label: 'E', at: at(c, 2, 0.3) },
    5: { kind: 'dup', label: 'E', at: at(c, 3, 0.55) },
  }
  const off: Record<number, Spec> = {
    0: { kind: 'data', label: '111', at: 0.9 },
    1: { kind: 'data', label: '112', at: at(c, 1, 0.85) },
    2: { kind: 'lost', label: '113', at: dieAt + 0.15 },
  }
  const appFrom = { x: 1074, y: 520 }
  const appRaw = { x: 1074, y: 560 }
  const toInv = { x: 1316, y: 300 }
  const toOff = { x: 1316, y: 810 }
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a2, { x: 1000, y: 540, s: 1.05 }, 1.3], [a3, WIDE, 1.3]])}>
      <Rise t={t} at={0.2}>
        <Tape t={t} x={O.x} y={O.y} cw={O.cw} n={6} cells={orders} title="orders · P0" base={108} />
      </Rise>
      <Rise t={t} at={0.5}>
        <Tape t={t} x={I.x} y={I.y} cw={I.cw} n={6} cells={inv} title="invoices · P0" base={200} />
      </Rise>
      <Rise t={t} at={0.8}>
        <Tape t={t} x={F.x} y={F.y} cw={F.cw} n={6} cells={off} title="__consumer_offsets · orders-P0" ticks={false} />
      </Rise>
      <Rise t={t} at={0.4}>
        <ConsumerUnit x={620} y={481} w={440} name="billing-app" t={t} down={down} note={down ? 'chết!' : t >= upAt ? 'khởi động lại' : undefined} busy={down ? undefined : (t * 1.1) % 1} accent={t >= upAt ? INK.warn : undefined} />
      </Rise>
      <Wire from={{ x: 494, y: 540 }} to={{ x: 606, y: 540 }} color={INK.line} p={move(t, 0.7, 0.4)} flow={t} />
      <Wire from={appFrom} to={toInv} color={INK.line} p={move(t, 0.9, 0.5)} flow={t} />
      <Wire from={appRaw} to={toOff} color={INK.line} p={move(t, 1.0, 0.5)} flow={t} />
      {/* normal flow before the crash: read, write the result, write the offset */}
      <Packets t={t} from={{ x: 494, y: 540 }} to={{ x: 606, y: 540 }} start={0.9} end={at(c, 0, 0.8)} every={0.5} len={0.7} size={18} />
      <Packets t={t} from={appFrom} to={toInv} start={at(c, 1, 0.1)} end={at(c, 1, 0.3)} every={0.3} len={0.7} size={18} />
      <Packets t={t} from={appRaw} to={toOff} start={at(c, 1, 0.55)} end={at(c, 1, 0.7)} every={0.3} len={0.7} size={18} />
      <Packets t={t} from={appFrom} to={toInv} start={at(c, 2, 0.05)} end={at(c, 2, 0.2)} every={0.3} len={0.7} size={18} />
      {/* after restart: the stale committed offset is read again, then the result is written again */}
      <Envelope t={t} at={upAt + 0.2} from={{ x: 1330, y: 810 }} to={{ x: 1000, y: 665 }} label="đọc lại từ 112" color={INK.warn} len={0.9} />
      <Packets t={t} from={{ x: 494, y: 540 }} to={{ x: 606, y: 540 }} start={at(c, 3, 0.35)} end={at(c, 3, 0.5)} every={0.3} len={0.6} size={18} color={INK.warn} />
      <Packets t={t} from={appFrom} to={toInv} start={at(c, 3, 0.55)} end={at(c, 3, 0.7)} every={0.3} len={0.7} size={18} color={INK.warn} />
      {t >= dieAt && t < a3 && <Caption y={950} text="chết giữa hai việc: invoices có tin, offset chưa dời" color={INK.bad} o={sp(t, dieAt + 0.5)} />}
      {t >= at(c, 3, 0.65) && <Pill x={I.x + 5.5 * I.cw} y={I.y + CH + 44} text="trùng" color={INK.bad} center o={sp(t, at(c, 3, 0.65))} />}
      {t >= a3 && <Caption y={950} text="đọc lại tin E → invoices có tin trùng" color={INK.warn} o={sp(t, at(c, 3, 0.7))} />}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 1. one atomic block */

function atomic(t: number, c: Cue) {
  const [a1, a3] = [c.at(1), c.at(3)]
  const frameAt = at(c, 0, 0.55)
  const commitAt = at(c, 2, 0.1)
  const abortAt = at(c, 2, 0.62)
  const phase = t < commitAt ? 'open' : t < abortAt ? 'commit' : 'abort'
  const col = phase === 'open' || t >= a3 ? INK.accent : phase === 'commit' ? INK.good : INK.bad
  const writeAt = at(c, 1, 0.38)
  const offAt = at(c, 1, 0.72)
  const kind: Kind = t < commitAt ? 'open' : phase === 'commit' ? 'data' : 'dead'
  const inv: Record<number, Spec> = { 0: { kind, label: 'D', at: writeAt }, 1: { kind, label: 'E', at: writeAt + 0.4 } }
  const off: Record<number, Spec> = { 0: { kind, label: '113', at: offAt } }
  const steps = [
    { text: 'beginTransaction()', at: a1 + 0.2 },
    { text: 'send(invoices)', at: writeAt - 0.4 },
    { text: 'sendOffsetsToTransaction()', at: offAt - 0.4 },
    { text: 'commitTransaction()', at: commitAt - 0.2 },
  ]
  const activeStep = steps.reduce((acc, s, i) => (t >= s.at ? i : acc), -1)
  const FX = { x: 700, y: 230, w: 1120, h: 580 }
  const shown = t < a3
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 1000, y: 560, s: 1.05 }, 1.3], [a3, WIDE, 1.3]])} title={{ kicker: 'TRANSACTION', text: 'Gói thành một khối' }}>
      <Rise t={t} at={0.3}>
        <ConsumerUnit x={110} y={480} w={420} name="billing-app" t={t} busy={(t * 1.1) % 1} />
      </Rise>
      <Rise t={t} at={0.7}>
        <Tape t={t} x={800} y={390} cw={80} n={5} cells={inv} title="invoices · P0" base={200} />
      </Rise>
      <Rise t={t} at={1.0}>
        <Tape t={t} x={800} y={650} cw={80} n={5} cells={off} title="__consumer_offsets" ticks={false} />
      </Rise>
      <Wire from={{ x: 544, y: 520 }} to={{ x: 786, y: 425 }} color={INK.line} p={move(t, 1.2, 0.5)} flow={t} />
      <Wire from={{ x: 544, y: 560 }} to={{ x: 786, y: 685 }} color={INK.line} p={move(t, 1.4, 0.5)} flow={t} />
      <Packets t={t} from={{ x: 544, y: 520 }} to={{ x: 786, y: 425 }} start={writeAt - 0.6} end={writeAt - 0.1} every={0.3} len={0.7} size={18} />
      <Packets t={t} from={{ x: 544, y: 560 }} to={{ x: 786, y: 685 }} start={offAt - 0.6} end={offAt - 0.1} every={0.3} len={0.7} size={18} />
      {/* the transaction boundary */}
      <div style={{ position: 'absolute', left: FX.x, top: FX.y, width: FX.w, height: FX.h, boxSizing: 'border-box', borderRadius: 36, border: `3px dashed ${col}`, background: 'rgba(30,70,190,0.10)', boxShadow: `0 0 34px ${col}55, inset 0 0 40px ${col}18`, opacity: vis(t, frameAt, Infinity, 0.5) }} />
      <Pill x={FX.x + 30} y={FX.y + 20} text={phase === 'open' || !shown ? 'transaction' : phase === 'commit' ? 'COMMIT' : 'ABORT'} color={col} o={vis(t, frameAt + 0.2)} />
      {phase !== 'open' && shown && (
        <Icon3D name={phase === 'commit' ? 'tick' : 'trash-can'} x={1530} y={520} size={230} t={t} at={phase === 'commit' ? commitAt : abortAt} />
      )}
      {phase !== 'open' && shown && <Pill x={1530} y={690} text={phase === 'commit' ? 'cả hai hợp lệ' : 'cả hai bị huỷ'} color={col} center o={vis(t, phase === 'commit' ? commitAt + 0.4 : abortAt + 0.4)} />}
      {/* API steps */}
      {steps.map((s, i) => (
        <Rise key={s.text} t={t} at={s.at - 0.7}>
          <div style={{ position: 'absolute', left: 110, top: 650 + i * 78, width: 440, height: 56, boxSizing: 'border-box', padding: '0 22px', display: 'flex', alignItems: 'center', borderRadius: 999, fontFamily: MONO, fontSize: 24, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', background: i === activeStep ? HERO : 'rgba(8,22,82,0.92)', border: '1.5px solid #6ea2ff', boxShadow: i === activeStep ? '0 0 26px rgba(77,141,255,0.75)' : '0 0 12px rgba(77,141,255,0.35)', opacity: i === activeStep ? 1 : 0.6 }}>
            {s.text}
          </div>
        </Rise>
      ))}
      {/* bank transfer analogy */}
      <div style={{ opacity: vis(t, a3 + 0.2) }}>
        <div style={{ ...panel, left: 700, top: 860, fontSize: 32, color: INK.bad }}>A · trừ 1 triệu</div>
        <Wire from={{ x: 1000, y: 898 }} to={{ x: 1120, y: 898 }} color={INK.text} p={move(t, a3 + 0.8, 0.4)} flow={t} />
        <Packets t={t} from={{ x: 1000, y: 898 }} to={{ x: 1120, y: 898 }} start={a3 + 1.3} every={0.5} len={0.6} size={22} />
        <div style={{ ...panel, left: 1130, top: 860, fontSize: 32, color: INK.good }}>B · cộng 1 triệu</div>
        <Icon3D name="money-bag" x={1560} y={885} size={170} t={t} at={a3 + 0.5} />
      </div>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 2. markers */

function marker(t: number, c: Cue) {
  const [a1, a2, a3] = [c.at(1), c.at(2), c.at(3)]
  const TX = 640
  const CW = 90
  const Y1 = 300
  const Y2 = 560
  const commitAt = at(c, 1, 0.45)
  const abortAt = at(c, 2, 0.6)
  const sent = (k: number, p0: number, step: number) => at(c, k, p0 + step)
  const k1: Kind = t >= commitAt ? 'data' : 'open'
  const k2: Kind = t >= abortAt ? 'dead' : 'open'
  const ring = t >= a3 + 0.4
  const inv: Record<number, Spec> = {
    0: { kind: k1, label: 'A', at: sent(0, 0.12, 0) },
    1: { kind: k1, label: 'B', at: sent(0, 0.12, 0.2) },
    2: { kind: k1, label: 'C', at: sent(0, 0.12, 0.4) },
    3: { kind: 'commit', at: commitAt + 0.7, ring },
    4: { kind: k2, label: 'D', at: a2 + 0.5 },
    5: { kind: k2, label: 'E', at: a2 + 1.1 },
    6: { kind: 'abort', at: abortAt + 0.7, ring },
  }
  const off: Record<number, Spec> = {
    0: { kind: k1, label: '112', at: sent(0, 0.12, 0.62) },
    1: { kind: 'commit', at: commitAt + 0.7 },
    2: { kind: k2, label: '113', at: a2 + 1.5 },
    3: { kind: 'abort', at: abortAt + 0.7 },
  }
  const cx = (i: number) => TX + i * CW + CW / 2
  const state = t < commitAt ? 'T1 · đang mở' : t < a2 + 0.5 ? 'T1 · COMMIT → xong' : t < abortAt ? 'T2 · đang mở' : 'T2 · ABORT → xong'
  const stateCol = state.includes('COMMIT') ? INK.good : state.includes('ABORT') ? INK.bad : INK.warn
  const CO = { x: 380, y: 430 }
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 1000, y: 520, s: 1.05 }, 1.3], [a3, WIDE, 1.3]])} title={{ kicker: 'MARKER', text: 'Dấu COMMIT và ABORT' }}>
      <Rise t={t} at={0.3}>
        <ServerUnit x={110} y={400} name="coordinator" t={t} />
      </Rise>
      <Rise t={t} at={0.5}>
        <div style={{ ...panel, left: 110, top: 590, width: 380, boxSizing: 'border-box', fontSize: 24, color: INK.faint, padding: '14px 22px' }}>
          <div>__transaction_state</div>
          <div style={{ marginTop: 6, fontSize: 30, color: stateCol }}>{state}</div>
        </div>
      </Rise>
      <Rise t={t} at={0.4}>
        <Tape t={t} x={TX} y={Y1} cw={CW} n={9} cells={inv} title="invoices · P0" base={200} />
      </Rise>
      <Rise t={t} at={0.6}>
        <Tape t={t} x={TX} y={Y2} cw={CW} n={9} cells={off} title="__consumer_offsets" ticks={false} />
      </Rise>
      <Wire from={{ x: CO.x, y: 465 }} to={{ x: TX - 16, y: Y1 + 35 }} color={INK.line} p={move(t, 0.9, 0.5)} dashed />
      <Wire from={{ x: CO.x, y: 465 }} to={{ x: TX - 16, y: Y2 + 35 }} color={INK.line} p={move(t, 1.0, 0.5)} dashed />
      <Envelope t={t} at={commitAt - 0.1} from={{ x: CO.x, y: 465 }} to={{ x: TX - 90, y: Y1 + 35 }} label="COMMIT" color={INK.good} len={0.8} />
      <Envelope t={t} at={commitAt - 0.1} from={{ x: CO.x, y: 465 }} to={{ x: TX - 90, y: Y2 + 35 }} label="COMMIT" color={INK.good} len={0.8} />
      <Envelope t={t} at={abortAt - 0.1} from={{ x: CO.x, y: 465 }} to={{ x: TX - 90, y: Y1 + 35 }} label="ABORT" color={INK.bad} len={0.8} />
      <Envelope t={t} at={abortAt - 0.1} from={{ x: CO.x, y: 465 }} to={{ x: TX - 90, y: Y2 + 35 }} label="ABORT" color={INK.bad} len={0.8} />
      {t >= a3 + 0.6 && (
        <>
          <Pill x={cx(3)} y={Y1 + 120} text="marker 203" color={INK.good} center o={sp(t, a3 + 0.8)} />
          <Pill x={cx(6)} y={Y1 + 120} text="marker 206" color={INK.bad} center o={sp(t, a3 + 1.1)} />
        </>
      )}
      <Caption y={900} text="tin bị huỷ không bị xoá: chỉ bị đánh dấu" color={INK.warn} o={sp(t, at(c, 2, 0.85))} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 3. zombie fencing */

function zombie(t: number, c: Cue) {
  const [a2, a3] = [c.at(2), c.at(3)]
  const hungAt = at(c, 0, 0.5)
  const initAt = at(c, 1, 0.35)
  const epochUp = initAt + 0.8
  const wakeAt = at(c, 2, 0.05)
  const tryAt = wakeAt + 0.6
  const fencedAt = tryAt + 0.8
  const epoch = t >= epochUp ? 6 : 5
  const aState = t >= fencedAt ? 'dead' : t >= wakeAt ? 'wake' : t >= hungAt ? 'hung' : 'ok'
  const BR = { x: 800, y: 470 }
  const TP = { x: 1280, y: 505, cw: 68 }
  const bAlive = t >= initAt + 1.2
  const cells: Record<number, Spec> = {
    0: { kind: 'data', label: 'a', at: 0.9 },
    1: { kind: 'data', label: 'b', at: 1.3 },
    2: { kind: 'data', label: 'c', at: bAlive ? initAt + 1.6 : 99 },
    3: { kind: 'data', label: 'd', at: bAlive ? initAt + 2.1 : 99 },
  }
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a2, { x: 900, y: 560, s: 1.05 }, 1.3], [a3, WIDE, 1.3]])} title={{ kicker: 'EPOCH', text: 'Chống instance xác sống' }}>
      <Rise t={t} at={0.3}>
        <ConsumerUnit x={110} y={330} w={440} name="A · invoice-app-1" t={t} down={aState === 'dead'} idle={aState === 'hung' || aState === 'wake'} busy={aState === 'ok' ? (t * 1.1) % 1 : undefined} />
      </Rise>
      <Pill x={110} y={262} text={aState === 'dead' ? 'bị rào · epoch 5' : aState === 'wake' ? 'tỉnh dậy · epoch 5' : aState === 'hung' ? 'treo GC · epoch 5' : 'epoch 5'} color={aState === 'dead' ? INK.bad : aState === 'ok' ? INK.good : INK.warn} o={vis(t, 0.6)} />
      <Pill x={110} y={622} text={t >= epochUp ? 'mới · epoch 6' : 'mới khởi động'} color={INK.warn} o={vis(t, initAt - 0.2)} />
      {aState === 'hung' && <Icon3D name="pause" x={640} y={389} size={110} t={t} at={hungAt} />}
      <Rise t={t} at={initAt - 0.4}>
        <ConsumerUnit x={110} y={690} w={440} name="B · invoice-app-1" t={t} accent={INK.warn} busy={bAlive ? (t * 1.1) % 1 : undefined} />
      </Rise>
      <Rise t={t} at={0.5}>
        <ServerUnit x={BR.x} y={BR.y} name="coordinator" t={t} />
      </Rise>
      <Rise t={t} at={0.7}>
        <div style={{ ...panel, left: 790, top: 250, width: 560, boxSizing: 'border-box', padding: '14px 22px', borderColor: t >= epochUp && t < epochUp + 1 ? INK.warn : undefined }}>
          <div style={{ fontFamily: MONO, fontSize: 24, color: INK.faint, whiteSpace: 'nowrap' }}>transactional.id = invoice-app-1</div>
          <div style={{ marginTop: 4, fontSize: 48, fontWeight: 800, color: t >= epochUp ? INK.warn : '#fff' }}>epoch {epoch}</div>
        </div>
      </Rise>
      <Rise t={t} at={0.8}>
        <Tape t={t} x={TP.x} y={TP.y} cw={TP.cw} n={6} cells={cells} title="invoices · P0" base={300} />
      </Rise>
      <Wire from={{ x: 566, y: 389 }} to={{ x: 786, y: 520 }} color={INK.line} p={move(t, 0.9, 0.5)} flow={aState === 'ok' ? t : undefined} />
      <Wire from={{ x: 566, y: 749 }} to={{ x: 786, y: 560 }} color={INK.line} p={move(t, initAt, 0.5)} flow={bAlive ? t : undefined} />
      <Wire from={{ x: 1074, y: 540 }} to={{ x: 1266, y: 540 }} color={INK.line} p={move(t, 1.0, 0.5)} flow={t} />
      <Packets t={t} from={{ x: 566, y: 389 }} to={{ x: 786, y: 520 }} start={1.0} end={hungAt} every={0.5} len={0.8} size={18} />
      <Packets t={t} from={{ x: 566, y: 749 }} to={{ x: 786, y: 560 }} start={initAt + 1.2} every={0.6} len={0.8} size={18} color={INK.warn} />
      <Envelope t={t} at={initAt} from={{ x: 566, y: 749 }} to={{ x: 860, y: 540 }} label="initTransactions" color={INK.warn} len={1.0} />
      <Envelope t={t} at={tryAt} from={{ x: 600, y: 389 }} to={{ x: 860, y: 520 }} label="ghi · epoch 5" color={INK.accent} len={0.8} />
      <Envelope t={t} at={fencedAt} from={{ x: 860, y: 520 }} to={{ x: 620, y: 389 }} label="FENCED" color={INK.bad} len={0.8} />
      {t >= fencedAt + 0.7 && <Pill x={930} y={396} text="FENCED" color={INK.bad} size={44} center o={sp(t, fencedAt + 0.7)} />}
      {aState === 'dead' && <Icon3D name="shield" x={1500} y={700} size={130} t={t} at={fencedAt + 0.2} />}
      <Caption y={920} text="ID cố định qua restart · khác nhau giữa các instance đang sống" color={INK.good} o={sp(t, at(c, 3, 0.2))} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 4. read_committed and Last Stable Offset */

function Mark({ x, y, label, color, side, o = 1 }: { x: number; y: number; label: string; color: string; side: 'top' | 'bottom'; o?: number }) {
  const top = side === 'top' ? y - 70 : y - 12
  const h = side === 'top' ? CH + 78 : CH + 76
  return (
    <div style={{ opacity: clamp(o) }}>
      <div style={{ position: 'absolute', left: x - 2, top, width: 4, height: h, borderRadius: 2, background: color, boxShadow: `0 0 12px ${color}` }} />
      <Pill x={x} y={side === 'top' ? y - 118 : y + CH + 64} text={label} color={color} center />
    </div>
  )
}

function Lane({ x, y, cw, n, pos, label, color, o }: { x: number; y: number; cw: number; n: number; pos: number; label: string; color: string; o: number }) {
  return (
    <div style={{ opacity: clamp(o) }}>
      <div style={{ position: 'absolute', left: x, top: y - 62, fontFamily: MONO, fontSize: 28, fontWeight: 700, color }}>{label}</div>
      <div style={{ position: 'absolute', left: x, top: y - 2, width: cw * n, height: 4, borderRadius: 2, background: 'rgba(110,160,255,0.25)' }} />
      <div style={{ position: 'absolute', left: x, top: y - 8, width: cw * pos, height: 16, borderRadius: 8, background: HERO, boxShadow: '0 0 16px rgba(77,141,255,0.7)' }} />
      <div style={{ position: 'absolute', left: x + cw * pos - 15, top: y - 15, width: 30, height: 30, borderRadius: 15, background: '#fff', boxShadow: `0 0 18px ${color}` }} />
    </div>
  )
}

function isolation(t: number, c: Cue) {
  const [a1, a2, a3, a4] = [c.at(1), c.at(2), c.at(3), c.at(4)]
  const X = 240
  const CW = 120
  const N = 11
  const Y = 440
  const closeAt = at(c, 4, 0.2)
  const open = t < closeAt
  const kOpen: Kind = open ? 'open' : 'data'
  const ringTail = t >= a3 + 0.3 && t < closeAt
  const cells: Record<number, Spec> = {
    0: { kind: 'data', at: 0.4 },
    1: { kind: kOpen, label: 'T1', at: 0.5 },
    2: { kind: kOpen, label: 'T1', at: 0.6 },
    3: { kind: kOpen, label: 'T1', at: 0.7 },
    4: { kind: 'data', at: 0.8, ring: ringTail },
    5: { kind: 'data', at: 0.9, ring: ringTail },
    6: { kind: 'commit', at: closeAt + 0.3 },
  }
  const jump = move(t, closeAt + 0.9, 1.2)
  const hwPos = lerp(6, 7, move(t, closeAt + 0.3, 0.4))
  const lsoPos = lerp(1, 7, jump)
  const u = move(t, a1 + 0.6, at(c, 1, 0.8) - a1 - 0.6)
  const uPos = t < closeAt + 0.9 ? lerp(0, 6, u) : lerp(6, 7, move(t, closeAt + 0.9, 1.2))
  const cStep = move(t, a2 + 0.9, 1.3)
  const cPos = t < closeAt + 0.9 ? lerp(0, 1, cStep) : lsoPos
  const stuck = t >= a2 + 2.3 && t < closeAt + 0.9
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a2, { x: 860, y: 580, s: 1.05 }, 1.3], [a4, WIDE, 1.3]])} title={{ kicker: 'ISOLATION', text: 'read_committed' }}>
      <Rise t={t} at={0.2}>
        <Tape t={t} x={X} y={Y} cw={CW} n={N} cells={cells} title="invoices · P0" />
      </Rise>
      {t < closeAt && <Pill x={X + 2.5 * CW} y={Y - 134} text="T1 đang mở" color={INK.warn} center o={vis(t, 0.9)} />}
      {t < a1 && (
        <div style={{ position: 'absolute', left: X + CW, top: Y, width: 3 * CW, height: CH, overflow: 'hidden', borderRadius: 14, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: lerp(-120, 3 * CW, ((t * 0.5) % 1)), width: 120, background: 'linear-gradient(100deg, transparent, rgba(255,181,71,0.55), transparent)' }} />
        </div>
      )}
      <Mark x={X + hwPos * CW} y={Y} label={hwPos >= 7 ? 'High Watermark = 7' : 'High Watermark = 6'} color={INK.accent} side="top" o={vis(t, a1 + 0.2)} />
      <Mark x={X + lsoPos * CW} y={Y} label={lsoPos >= 7 ? 'Last Stable Offset = 7' : 'Last Stable Offset = 1'} color={INK.warn} side="bottom" o={vis(t, a2 + 0.3)} />
      <Lane x={X} y={720} cw={CW} n={N} pos={uPos} label="read_uncommitted" color={INK.accent} o={vis(t, a1 + 0.3)} />
      <Lane x={X} y={900} cw={CW} n={N} pos={cPos} label="read_committed" color={INK.good} o={vis(t, a2 + 0.5)} />
      {t >= at(c, 1, 0.82) && t < closeAt && <Pill x={X + 6 * CW + 24} y={705} text="thấy cả tin sắp bị huỷ" color={INK.bad} o={sp(t, at(c, 1, 0.85))} size={24} />}
      {stuck && <Pill x={X + 1 * CW + 24} y={885} text="chờ T1 chốt" color={INK.warn} o={sp(t, a2 + 2.3)} size={24} />}
      {t >= a3 + 0.6 && t < closeAt && <Pill x={X + 4.5 * CW} y={Y + CH + 64} text="bị giữ lại" color={INK.warn} center o={sp(t, a3 + 0.6)} />}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 5. limits: Kafka to Kafka only */

function limits(t: number, c: Cue) {
  const [a0, a1, a3] = [c.at(0), c.at(1), c.at(3)]
  const sendAt = at(c, 1, 0.4)
  const abortAt = at(c, 1, 0.7)
  const retryAt = at(c, 2, 0.3)
  const chipAt = a3 + 0.3
  const fixes: { icon: 'key' | 'folder' | 'link'; text: string; sub: string; at: number }[] = [
    { icon: 'key', text: 'consumer idempotent', sub: 'nhớ event_id đã xử lý', at: at(c, 3, 0.3) },
    { icon: 'folder', text: 'offset lưu trong DB', sub: 'cùng transaction với dữ liệu', at: at(c, 3, 0.52) },
    { icon: 'link', text: 'outbox', sub: 'DB → Kafka, Module 10', at: at(c, 3, 0.78) },
  ]
  const inv: Record<number, Spec> = {
    0: { kind: t >= abortAt ? 'dead' : 'open', label: 'X', at: sendAt - 0.2 },
    1: { kind: 'data', label: 'X', at: retryAt + 0.9 },
  }
  const orders: Record<number, Spec> = {}
  'abcde'.split('').forEach((ch, i) => (orders[i] = { kind: 'data', label: ch, at: 0.4 + i * 0.08 }))
  const sent = t >= retryAt + 0.8 ? 2 : t >= sendAt + 0.8 ? 1 : 0
  const mailOn = 1 - span(t, a3, a3 + 0.5)
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 580, s: 1.05 }, 1.3], [a3, WIDE, 1.3]])} title={{ kicker: 'GIỚI HẠN', text: 'Chỉ trọn vẹn trong Kafka' }}>
      <div style={{ position: 'absolute', left: 90, top: 230, width: 1740, height: 390, boxSizing: 'border-box', borderRadius: 36, border: `3px dashed ${INK.accent}`, background: 'rgba(30,70,190,0.10)', boxShadow: '0 0 34px rgba(91,151,255,0.35)', opacity: vis(t, a0 + 0.1, Infinity, 0.5) }} />
      <Pill x={120} y={246} text="Trong Kafka: transaction bao được" color={INK.accent} o={vis(t, a0 + 0.5)} />
      <Rise t={t} at={a0 + 0.3}>
        <Tape t={t} x={150} y={375} cw={70} n={5} cells={orders} title="orders" base={108} />
      </Rise>
      <Rise t={t} at={a0 + 0.5}>
        <ConsumerUnit x={700} y={351} w={420} name="billing-app" t={t} busy={(t * 1.1) % 1} />
      </Rise>
      <Rise t={t} at={a0 + 0.7}>
        <Tape t={t} x={1360} y={375} cw={70} n={5} cells={inv} title="invoices" base={200} />
      </Rise>
      <Wire from={{ x: 510, y: 410 }} to={{ x: 686, y: 410 }} color={INK.line} p={move(t, a0 + 0.9, 0.4)} flow={t} />
      <Wire from={{ x: 1134, y: 410 }} to={{ x: 1346, y: 410 }} color={INK.line} p={move(t, a0 + 1.0, 0.4)} flow={t} />
      <Packets t={t} from={{ x: 510, y: 410 }} to={{ x: 686, y: 410 }} start={sendAt - 1.0} end={sendAt - 0.3} every={0.4} len={0.7} size={18} />
      <Packets t={t} from={{ x: 1134, y: 410 }} to={{ x: 1346, y: 410 }} start={sendAt - 0.5} end={sendAt} every={0.3} len={0.7} size={18} />
      <Packets t={t} from={{ x: 510, y: 410 }} to={{ x: 686, y: 410 }} start={retryAt - 0.2} end={retryAt + 0.3} every={0.3} len={0.7} size={18} color={INK.warn} />
      <Packets t={t} from={{ x: 1134, y: 410 }} to={{ x: 1346, y: 410 }} start={retryAt + 0.4} end={retryAt + 0.8} every={0.3} len={0.7} size={18} color={INK.warn} />
      {/* outside the zone: the email */}
      <div style={{ opacity: mailOn }}>
        <Pill x={120} y={650} text="Ngoài Kafka: transaction không với tới" color={INK.bad} o={vis(t, a1 + 0.2)} />
        <Wire from={{ x: 910, y: 475 }} to={{ x: 910, y: 700 }} color={INK.line} p={move(t, a1 + 0.2, 0.5)} flow={t} />
        <Icon3D name="mail" x={910} y={800} size={190} t={t} at={a1 + 0.3} />
        <Envelope t={t} at={sendAt} from={{ x: 910, y: 475 }} to={{ x: 910, y: 740 }} label="gửi email" color={INK.warn} len={0.9} arc={0} />
        <Envelope t={t} at={retryAt + 0.5} from={{ x: 910, y: 475 }} to={{ x: 910, y: 740 }} label="gửi lần 2" color={INK.bad} len={0.9} arc={0} />
        {sent > 0 && (
          <div style={{ ...panel, left: 1060, top: 770, fontSize: 32, color: sent > 1 ? INK.bad : INK.good }}>
            email đã gửi: {sent}
          </div>
        )}
        {t >= abortAt && t < retryAt && <Pill x={1060} y={690} text="abort: email không rút lại được" color={INK.bad} o={sp(t, abortAt + 0.2)} />}
      </div>
      {t >= abortAt && t < chipAt && <Pill x={1530} y={290} text="ABORT" color={INK.bad} />}
      {/* the three correct ways with an external system */}
      {fixes.map((f, i) => (
        <Rise key={f.text} t={t} at={f.at}>
          <div style={{ ...panel, left: 110 + i * 580, top: 690, width: 540, height: 190, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 24, padding: '0 30px', ...(t >= f.at && t < (fixes[i + 1]?.at ?? Infinity) ? { background: HERO, border: 'none' } : {}) }}>
            <div style={{ width: 120, height: 120, flex: 'none', position: 'relative' }}>
              <Icon3D name={f.icon} x={60} y={60} size={120} t={t} at={f.at} />
            </div>
            <div>
              <div style={{ fontSize: 36, fontWeight: 800 }}>{f.text}</div>
              <div style={{ marginTop: 6, fontSize: 28, fontWeight: 600, color: '#dbe6ff' }}>{f.sub}</div>
            </div>
          </div>
        </Rise>
      ))}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 6. summary */

function summary(t: number, c: Cue) {
  return (
    <SoftTheme>
      <SummaryList t={t} cue={c} items={['Tin kết quả + offset: một transaction', 'Marker COMMIT/ABORT chiếm một offset', 'transactional.id cố định + epoch rào zombie', 'read_committed dừng ở Last Stable Offset']} />
    </SoftTheme>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { hook, atomic, marker, zombie, isolation, limits, summary }

/** Key-moment sounds, timed to the same cue offsets the scenes animate on. */
const SFX: Record<string, SceneSfx[]> = {
  hook: [{ kind: 'error', at: (c) => at(c, 2, 0.55) }],
  atomic: [{ kind: 'ding', at: (c) => at(c, 2, 0.1) }, { kind: 'error', at: (c) => at(c, 2, 0.62) }],
  marker: [{ kind: 'ding', at: (c) => at(c, 1, 0.45) + 0.7 }, { kind: 'error', at: (c) => at(c, 2, 0.6) + 0.7 }],
  zombie: [{ kind: 'error', at: (c) => at(c, 2, 0.05) + 1.4 }],
  isolation: [{ kind: 'ding', at: (c) => at(c, 4, 0.2) + 0.3 }],
  limits: [{ kind: 'error', at: (c) => at(c, 1, 0.7) }, { kind: 'error', at: (c) => at(c, 2, 0.3) + 1.4 }],
}

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const transactionsLesson: Lesson = {
  ...transactionsScript,
  scenes: transactionsScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id], sfx: SFX[s.id] })),
  intro: [
    { kind: 'video', scenes: ['hook'] },
    {
      kind: 'quiz',
      title: 'Quick Quiz',
      questions: [q('Đoán trước khi học: app ghi tin vào invoices rồi mới commit offset. Chết đúng giữa hai việc, khởi động lại. Điều gì xảy ra?', ['Mất tin', 'invoices có tin trùng', 'Không sao, Kafka tự khôi phục', 'Offset tự dời'], 1, 'Offset chưa dời nên đọc lại tin cũ, và tin kết quả đã nằm trong invoices rồi. Phần 1 giải quyết bằng transaction.')],
    },
  ],
  roadmap: [
    'Chặng 1: Gói ghi tin kết quả và commit offset vào một transaction; marker COMMIT/ABORT đóng dấu ra sao.',
    'Chặng 2: transactional.id và epoch rào instance xác sống.',
    'Chặng 3: read_committed, Last Stable Offset, và vì sao exactly-once không vượt ra ngoài Kafka.',
  ],
  sections: [
    {
      id: 'transaction-nguyen-khoi',
      title: 'Đọc → xử lý → ghi thành một khối',
      blocks: [
        { kind: 'p', text: 'Ứng dụng đọc `orders`, tính toán, ghi `invoices`. Nó ghi hai thứ vào Kafka: (1) tin kết quả vào `invoices`, (2) offset vào `__consumer_offsets`. Chết giữa hai việc → offset chưa dời → đọc lại → `invoices` có **tin trùng**.' },
        { kind: 'video', scenes: ['atomic'] },
        { kind: 'p', text: 'Cả hai việc đều là **ghi vào topic Kafka**, nên Kafka gói chúng vào **một transaction**: hoặc cả hai được công nhận, hoặc cả hai bị huỷ.' },
        {
          kind: 'code',
          code: `producer.initTransactions()               // 1 lần lúc khởi động
loop:
  records = consumer.poll()
  producer.beginTransaction()
  for r in records:
      producer.send(invoices, tính_toán(r))
  producer.sendOffsetsToTransaction(        // offset đi CÙNG transaction
      offsets_tiếp_theo, consumer.groupMetadata())
  producer.commitTransaction()              // tất cả hoặc không gì cả
  (lỗi → producer.abortTransaction())`,
        },
        { kind: 'callout', tone: 'info', title: 'Consumer phải tắt auto commit', text: 'Đặt `enable.auto.commit=false`: offset giờ do **producer** commit bên trong transaction.' },
        { kind: 'video', scenes: ['marker'] },
        {
          kind: 'list',
          items: [
            { title: 'Coordinator', text: 'một broker ghi trạng thái transaction vào topic nội bộ `__transaction_state`.' },
            { title: 'Marker', text: 'khi commit, coordinator ghi **control record** `COMMIT` vào **mọi partition** transaction đã chạm tới. Abort thì ghi `ABORT`.' },
            { title: 'Tin nằm trên đĩa ngay lúc send', text: 'marker chỉ "đóng dấu" hợp lệ hay bị huỷ. Log append-only nên Kafka **không xoá** tin bị huỷ; consumer `read_committed` bỏ qua chúng.' },
            { title: 'Marker chiếm một offset', text: 'dù không phải tin dữ liệu → offset có "lỗ". (📘 sách, ch.8)' },
          ],
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Coordinator chết giữa lúc ghi marker thì sao?',
          text: 'Kafka dùng **commit hai pha** với `__transaction_state` làm sổ nhật ký: (1) ghi sổ transaction đang mở và các partition liên quan; (2) ghi **ý định** commit/abort, từ đây kết quả đã chốt; (3) ghi marker vào mọi partition; (4) ghi sổ đã hoàn tất. Chết sau bước 2 → coordinator mới đọc sổ và làm nốt bước 3–4, nên không có chuyện marker chỉ tới một nửa số partition. (📘 sách, ch.8)',
        },
        { kind: 'p', text: '`sendOffsetsToTransaction` gửi offset kèm group id cho transaction coordinator; nó tìm group coordinator và commit offset như một group bình thường, nhưng nằm trong transaction.' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Vì sao offset phải đi qua sendOffsetsToTransaction thay vì để consumer tự commit sau commitTransaction()?', ['Cho nhanh hơn', 'Để không có khe hở: transaction đã commit mà chết trước khi commit offset thì ghi invoices lần hai', 'Vì consumer không commit được', 'Để giảm số partition'], 1, 'Offset phải là một phần của khối nguyên tử.'),
            q('Transaction bị abort. Các tin đã ghi trong invoices xảy ra chuyện gì?', ['Bị xoá khỏi log', 'Vẫn nằm trên đĩa, có marker ABORT; read_committed bỏ qua', 'Chuyển sang topic khác', 'Tự ghi lại'], 1, 'Log chỉ ghi nối đuôi, không xoá tin ở giữa. Kafka lưu danh sách transaction bị huỷ (.txnindex) để lọc.'),
          ],
        },
      ],
    },
    {
      id: 'transactional-id',
      title: 'transactional.id và instance xác sống',
      blocks: [
        { kind: 'video', scenes: ['zombie'] },
        {
          kind: 'code',
          code: `Instance A (transactional.id = "invoice-app-1") bị treo GC 2 phút.
Hệ thống tưởng A chết, khởi động instance B cùng transactional.id.
B gọi initTransactions() → coordinator tăng "epoch" từ 5 lên 6.
A tỉnh lại, gửi tiếp với epoch 5 → broker từ chối (ProducerFencedException).`,
        },
        {
          kind: 'list',
          items: [
            { title: 'Cố định qua restart', text: 'cùng một "vai trò" luôn dùng lại đúng `transactional.id`, để instance mới **rào** (fence) được instance cũ. Broker còn trả lại đúng PID cũ.' },
            { title: 'Khác nhau giữa instance đang sống', text: 'hai instance sống mà trùng ID thì cái khởi động sau rào cái kia như zombie → ứng dụng gặp lỗi.' },
            { title: '`initTransactions()`', text: 'vừa tăng epoch, vừa **abort** transaction dở dang của ID đó.' },
          ],
        },
        { kind: 'callout', tone: 'info', title: 'Zombie là gì?', text: 'Ứng dụng **đã bị coi là chết mà không biết mình đã chết**: treo hoặc mất kết nối, group đã giao partition cho người khác, rồi tỉnh lại và xử lý tiếp mẻ cũ. Không có rào thì nó ghi kết quả trùng. (📘 sách, ch.8)' },
        { kind: 'callout', tone: 'tip', title: 'Từ Kafka 2.5 (KIP-447)', text: '`consumer.groupMetadata()` mang theo **thế hệ** (generation) của group; sau rebalance, transaction của producer cũ mang thế hệ cũ nên bị từ chối. Nhờ đó các instance dùng `transactional.id` khác nhau vẫn ghi vào cùng partition mà zombie vẫn bị rào. (📘 sách, ch.8)' },
        { kind: 'callout', tone: 'warn', title: 'transaction.timeout.ms', text: 'Mặc định 60.000 ms (đo trên 3.9.1; sách bản 2021 ghi 15 phút). Transaction mở quá lâu không commit thì coordinator **tự abort**. Kafka Streams bật tất cả cơ chế này bằng `processing.guarantee=exactly_once_v2`, cách sách khuyên dùng nhất.' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Vì sao mỗi lần khởi động phải dùng lại đúng transactional.id cũ thay vì sinh ngẫu nhiên?', ['Để tiết kiệm bộ nhớ', 'Vì cơ chế rào dựa trên cùng ID: coordinator tăng epoch và huỷ transaction dở của bản cũ khi hai bên trùng', 'Vì broker yêu cầu độ dài cố định', 'Không cần, ID ngẫu nhiên vẫn rào được'], 1, 'ID ngẫu nhiên → hai instance cùng sống, cùng ghi → trùng lặp.'),
            q('Instance A epoch 5 tỉnh dậy sau khi B đã initTransactions (epoch 6). A gửi tiếp. Kết quả?', ['Ghi bình thường', 'Broker từ chối với ProducerFencedException', 'B bị rào', 'Epoch hạ về 5'], 1, 'Epoch cao hơn thắng; A là zombie bị rào.'),
          ],
        },
      ],
    },
    {
      id: 'read-committed',
      title: 'read_committed và Last Stable Offset',
      blocks: [
        { kind: 'video', scenes: ['isolation'] },
        {
          kind: 'table',
          head: ['`isolation.level`', 'Mặc định?', 'Đọc được gì'],
          rows: [
            ['`read_uncommitted`', 'Có', 'mọi tin đến High Watermark, **kể cả** tin của transaction chưa chốt hoặc đã huỷ'],
            ['`read_committed`', 'Không', 'tin **không thuộc transaction** và tin của transaction **đã COMMIT**; chỉ đọc đến **Last Stable Offset**'],
          ],
        },
        { kind: 'callout', tone: 'warn', title: 'Trùng tên viết tắt LSO', text: 'Module 1: **Log Start Offset** (tin cũ nhất còn tồn tại). Ở đây **LSO = Last Stable Offset**, khái niệm khác hẳn. Khoá học này viết đầy đủ để khỏi nhầm.' },
        { kind: 'p', text: '**Last Stable Offset** là offset của tin **đầu tiên thuộc transaction còn đang mở** sớm nhất. Không có transaction mở thì bằng High Watermark. Ba mốc lồng nhau: Log Start Offset ≤ Last Stable Offset ≤ High Watermark ≤ Log End Offset.' },
        {
          kind: 'code',
          code: `offset:  0     1..32                 33          34
         [tin] [tx T1 đang MỞ ...  ] [tin thường]
                ▲ Last Stable Offset = 1            HW = 34

read_uncommitted: thấy 0, 1..32, 33
read_committed:   chỉ thấy 0, rồi ĐỨNG CHỜ (kể cả tin 33 dù không thuộc transaction)`,
        },
        { kind: 'callout', tone: 'info', title: 'Vì sao tin 33 cũng bị chặn?', text: 'Consumer đọc **theo thứ tự**, chưa biết 1..32 sẽ commit hay abort nên không được nhảy qua. Chính **broker** không trả tin sau Last Stable Offset, nên consumer không phải giữ hàng đợi trong RAM. Cái giá chính là **độ trễ**: transaction mở càng lâu, hạ nguồn thấy dữ liệu càng muộn. Giống hàng chờ ở quầy công chứng; đó là lý do có `transaction.timeout.ms`. (📘 sách, ch.8)' },
        { kind: 'callout', tone: 'tip', title: 'Marker và lag (nối lại Module 1)', text: 'Partition có 10 transaction, mỗi cái 3 tin + 1 marker: offset 0–39, HW = 40, consumer chưa đọc gì → lag = 40. Số tin thật chỉ 30; nếu 2 transaction bị abort, `read_committed` chỉ nhận 24 tin. Lag là **khoảng cách offset**, không phải số tin.' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Producer dùng transaction, nhưng consumer hạ nguồn để mặc định. Consumer có thể xử lý tin của transaction bị abort không?', ['Không bao giờ', 'Có, vì read_uncommitted đọc mọi tin đến HW mà không nhìn marker', 'Chỉ khi restart', 'Chỉ với tin đầu tiên'], 1, 'Muốn exactly-once ở hạ nguồn phải đặt read_committed.'),
            q('Một producer treo, mở transaction 50 giây không commit. Consumer read_committed của topic có lag tăng vọt dù producer khác vẫn ghi. Vì sao?', ['Mạng chậm', 'Last Stable Offset bị ghim ở tin đầu tiên của transaction mở, mọi tin phía sau bị giữ lại', 'Broker hết RAM', 'Consumer tự pause'], 1, 'Giữ đến khi transaction commit/abort hoặc hết transaction.timeout.ms.'),
          ],
        },
      ],
    },
    {
      id: 'gioi-han',
      title: 'Giới hạn: exactly-once chỉ trong Kafka',
      blocks: [
        { kind: 'video', scenes: ['limits'] },
        {
          kind: 'list',
          items: [
            { title: 'Kafka → DB', text: 'at-least-once + consumer idempotent (6.5), hoặc lưu offset **trong chính DB** cùng transaction với dữ liệu; khi được giao partition thì đọc offset từ DB rồi `consumer.seek()`.' },
            { title: 'DB → Kafka', text: 'pattern **Transactional Outbox**: ghi dữ liệu và "tin cần gửi" vào cùng một transaction DB, tiến trình khác đẩy sang Kafka. Học ở Module 10.' },
          ],
        },
        {
          kind: 'list',
          items: [
            { title: 'Ghi nguyên tử, không phải đọc nguyên tử', text: '`read_committed` không chắc thấy đủ mọi tin của một transaction (có thể chỉ subscribe một phần topic, hoặc lag ở topic này mà không ở topic kia) và không biết transaction bắt đầu/kết thúc ở đâu. (📘 sách, ch.8)' },
            { title: 'Pub/sub thường', text: '`read_committed` chỉ bảo đảm không thấy tin bị abort; consumer vẫn có thể xử lý lặp tuỳ cách commit offset. Chưa phải exactly-once.' },
            { title: 'Bẫy deadlock', text: 'trong một transaction, gửi request rồi **chờ ứng dụng khác trả lời** mới commit; bên kia đọc `read_committed` chỉ thấy request **sau khi** commit → hai bên chờ nhau đến hết `transaction.timeout.ms`. Sửa: commit yêu cầu trước, rồi mới chờ. (📘 sách, ch.8)' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Vì sao không thể nói "app dùng Kafka transaction nên email gửi khách là exactly-once"?', ['Email chậm', 'Gửi email là tác động ngoài Kafka: abort chỉ đánh dấu tin Kafka là huỷ, không rút lại được email; xử lý lại sẽ gửi lần hai', 'Kafka không hỗ trợ email', 'Do read_committed'], 1, 'Cần chống trùng ở phía gửi email, ví dụ lưu event_id đã gửi.'),
            q('Service A mở transaction, gửi "yêu cầu báo giá" vào quote-req rồi chờ service B (read_committed) trả lời mới commit. Chuyện gì xảy ra?', ['Chạy bình thường', 'Kẹt đến khi transaction.timeout.ms abort, vì B chỉ thấy yêu cầu sau khi A commit', 'B nhận ngay', 'A bị rào'], 1, 'Sửa bằng cách commit transaction chứa yêu cầu trước khi chờ trả lời.'),
          ],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: commit, abort và read_committed',
      blocks: [
        { kind: 'p', text: 'Đặt trạng thái cho ba transaction và chọn `isolation.level`. Quan sát marker chiếm offset, Last Stable Offset bị ghim, và tin nào lọt tới consumer.' },
        { kind: 'widget', name: 'txn-lab' },
      ],
    },
    {
      id: 'tom-tat-video',
      title: 'Nhìn lại cả bài',
      blocks: [{ kind: 'video', scenes: ['summary'] }],
    },
  ],
  finalQuiz: [
    q('Exactly-once trong Kafka (đọc → xử lý → ghi) dựa trên điều gì?', ['Consumer commit trước khi xử lý', 'Tin kết quả và offset được commit trong cùng một transaction', 'Tăng acks lên all', 'Tăng số partition'], 1, 'Hoặc cả hai được công nhận, hoặc cả hai bị huỷ.'),
    q('Transaction commit xong, tin của nó nằm ở offset 200–202. Marker COMMIT nằm ở đâu?', ['Không có marker', 'Chiếm offset 203, một offset thật', 'Ở file khác', 'Ghi đè offset 202'], 1, 'Marker là control record chiếm một offset, nên offset có lỗ.'),
    q('Consumer read_committed dừng ở đâu khi có transaction mở?', ['High Watermark', 'Last Stable Offset', 'Log End Offset', 'Log Start Offset'], 1, 'Offset của tin đầu tiên thuộc transaction mở sớm nhất; các tin phía sau phải chờ.'),
    q('Instance cũ tỉnh dậy sau khi instance mới initTransactions với cùng transactional.id. Điều gì rào nó?', ['Số partition', 'Epoch cao hơn của instance mới', 'Offset commit', 'Số replica'], 1, 'Gửi với epoch cũ bị broker từ chối (ProducerFencedException).'),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao Kafka transaction không làm cho việc gửi email thành exactly-once?',
      keywords: ['ngoài', 'abort', 'email', 'rút lại'],
      modelAnswer: 'Vì transaction chỉ bao được những gì ghi vào Kafka. Gửi email là tác động bên ngoài: khi transaction bị abort, Kafka đánh dấu tin là huỷ nhưng không rút lại được email đã gửi, và khi tin được xử lý lại thì email đi lần hai. Phải chống trùng ở phía gửi (consumer idempotent) hoặc dùng outbox.',
    },
  ],
  recap: {
    journey:
      'Ghi tin kết quả rồi chết trước khi commit offset → tin trùng → gói cả hai vào một transaction → marker COMMIT/ABORT đóng dấu, chiếm một offset → transactional.id cố định cùng epoch rào instance xác sống → read_committed dừng ở Last Stable Offset → exactly-once chỉ trọn vẹn trong Kafka, hệ thống ngoài cần idempotent hoặc outbox.',
    points: [
      { title: 'Một khối', text: 'Tin kết quả và offset commit trong cùng một transaction qua sendOffsetsToTransaction.' },
      { title: 'Marker', text: 'COMMIT/ABORT quyết định tin có được nhìn thấy; tin bị huỷ không bị xoá; marker chiếm một offset.' },
      { title: 'Chống zombie', text: 'transactional.id cố định qua restart, khác nhau giữa instance sống; epoch cao hơn rào instance cũ.' },
      { title: 'read_committed', text: 'Đọc đến Last Stable Offset; transaction mở lâu chặn mọi tin phía sau. Exactly-once không vượt ra ngoài Kafka.' },
    ],
    next: 'Bài tiếp theo: Log compaction & tombstone (Module 7).',
  },
}
