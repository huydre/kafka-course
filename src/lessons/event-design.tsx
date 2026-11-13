import type { CSSProperties, ReactNode } from 'react'
import { cameraAt, clamp, ease, lerp, move, sp, span, vis } from '../player/motion-kit'
import { ConsumerUnit, HERO, Icon3D, Packets, Rise, SOFT, SOFT_PANEL, ServerUnit, SoftScene, SoftTheme, Statement, SummaryList, Wire } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene, SceneSfx } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { eventDesignScript } from './event-design-script'

/** This lesson is drawn in the navy glow style. */
const INK = SOFT
const panel = SOFT_PANEL

/** Time at fraction p of beat k. */
const at = (c: Cue, k: number, p: number) => c.at(k) + (c.end(k) - c.at(k)) * p

/** 1234567 → "1.234.567" */
const num = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/** Time snapped to 6 steps per second so counters never smear under export motion blur. */
const snap = (t: number) => Math.floor(t * 6) / 6

/** Rounded to a clean step, then formatted. */
const numR = (n: number, step: number) => num(Math.round(n / step) * step)

/** Idle pulse 0..1 (starts at `from`) for elements that must keep moving while narrated. */
const beat = (t: number, from: number, period = 1.4) => (t < from ? 0 : 0.5 - 0.5 * Math.cos(((t - from) * Math.PI * 2) / period))

/** Linear mix of two rgb triples, as a css colour. */
const mixRgb = (a: number[], b: number[], k: number) => `rgb(${a.map((v, n) => Math.round(lerp(v, b[n], k))).join(',')})`

const TABULAR: CSSProperties = { fontVariantNumeric: 'tabular-nums' }

/** Gently scales its children around (cx, cy). */
function Pulse({ t, from, cx, cy, amp = 0.07, children }: { t: number; from: number; cx: number; cy: number; amp?: number; children: ReactNode }) {
  return <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: `${cx}px ${cy}px`, transform: `scale(${1 + amp * beat(t, from)})` }}>{children}</div>
}

/** Value that eases from key to key (each key is [time, value]) over `dur` seconds. */
function track(t: number, keys: [number, number][], dur = 0.5) {
  let v = keys[0][1]
  for (let i = 1; i < keys.length; i++) {
    if (t < keys[i][0]) break
    v = lerp(keys[i - 1][1], keys[i][1], move(t, keys[i][0], dur))
  }
  return v
}

/* ------------------------------------------------------------------ shared pieces */

const GLOW: CSSProperties = { background: 'rgba(8,22,82,0.92)', border: '1.5px solid #6ea2ff', boxShadow: '0 0 18px rgba(77,141,255,0.65), inset 0 1px 0 rgba(255,255,255,0.15)', color: '#ffffff' }
const AMBER = 'linear-gradient(160deg, #ffe0a3 0%, #ffb547 55%, #c97a0a 100%)'
const GREEN = 'linear-gradient(160deg, #9ff5cf 0%, #27d391 55%, #0e9a6c 100%)'
const RED = 'linear-gradient(160deg, #ff9aa5 0%, #ff4d60 55%, #b3202f 100%)'
const BLUE = INK.cell.filled as string
const DIM = 'rgba(70,100,190,0.42)'
const RING = '0 0 0 4px #ffffff, 0 0 26px rgba(255,255,255,0.85)'
const LIFT = 'inset 0 2px 0 rgba(255,255,255,0.5), 0 10px 20px rgba(0,8,50,0.45)'

/** Glowing label pill, appearing at `from` and optionally fading out at `to`. `x` is its centre (or its left edge when `left`). */
function Pill({ t, x, y, text, color = '#ffffff', size = 28, from, to, left = false, mono = false, pulse = 0 }: { t: number; x: number; y: number; text: string; color?: string; size?: number; from: number; to?: number; left?: boolean; mono?: boolean; pulse?: number }) {
  const o = vis(t, from, to)
  if (o <= 0) return null
  return (
    <div style={{ ...GLOW, position: 'absolute', left: x, top: y, transform: `translate(${left ? 0 : '-50%'}, ${(1 - o) * 16}px) scale(${1 + 0.05 * pulse})`, opacity: o, padding: '8px 22px', borderRadius: 999, fontSize: size, fontWeight: 800, fontFamily: mono ? MONO : undefined, color, whiteSpace: 'nowrap', border: `1.5px solid ${color === '#ffffff' ? '#6ea2ff' : color}`, ...(pulse > 0 ? { boxShadow: `0 0 ${18 + 24 * pulse}px ${color === '#ffffff' ? 'rgba(77,141,255,0.9)' : color}` } : null) }}>
      {text}
    </div>
  )
}

/** Plain text at a fixed spot. */
function Txt({ x, y, children, size = 28, color = INK.faint, w, align = 'left', weight = 700, mono = false, o = 1, glow = 0 }: { x: number; y: number; children: ReactNode; size?: number; color?: string; w?: number; align?: 'left' | 'center' | 'right'; weight?: number; mono?: boolean; o?: number; glow?: number }) {
  if (o <= 0) return null
  return <div style={{ position: 'absolute', left: x, top: y, width: w, textAlign: align, fontSize: size, fontWeight: weight, fontFamily: mono ? MONO : undefined, color, whiteSpace: 'nowrap', opacity: clamp(o), ...TABULAR, ...(glow > 0 ? { textShadow: `0 0 ${glow * 26}px ${color}` } : null) }}>{children}</div>
}

/** One cell of a tape: pops in at `from`, shrinks away at `out`. `x` is animated by the caller. */
function Cell({ t, from, x, y, w, label, bg = BLUE, size = 28, ring = false, out, h = 70 }: { t: number; from: number; x: number; y: number; w: number; label?: string; bg?: string; size?: number; ring?: boolean; out?: number; h?: number }) {
  const k = sp(t, from, 14, 140)
  if (k <= 0) return null
  const gone = out === undefined ? 0 : move(t, out, 0.45)
  if (gone >= 1) return null
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, padding: '0 3px', boxSizing: 'border-box', opacity: clamp(k * 1.6) * (1 - gone), transform: `scale(${(0.85 + 0.15 * k) * (1 - 0.3 * gone)})` }}>
      <div style={{ height: '100%', borderRadius: 14, boxSizing: 'border-box', background: bg, boxShadow: ring ? `${LIFT}, ${RING}` : bg === DIM ? undefined : LIFT, display: 'grid', placeItems: 'center', fontSize: size, fontWeight: 800, color: '#ffffff', textShadow: '0 1px 4px rgba(0,8,50,0.5)', whiteSpace: 'nowrap' }}>{label}</div>
    </div>
  )
}

/** Empty tape slots (outline only). */
function Slots({ t, from, x, y, n, w, h = 70, tone = 1 }: { t: number; from: number; x: number; y: number; n: number; w: number; h?: number; tone?: number }) {
  const o = vis(t, from, undefined, 0.5)
  if (o <= 0) return null
  return (
    <div style={{ opacity: o * tone }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ position: 'absolute', left: x + i * w, top: y, width: w, height: h, padding: '0 3px', boxSizing: 'border-box' }}>
          <div style={{ height: '100%', borderRadius: 14, boxSizing: 'border-box', background: INK.cell.empty as string, border: '1.5px solid rgba(110,160,255,0.35)' }} />
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ 0. cold open: one event, ten API calls */

const SERVICES = ['Đơn hàng', 'Thanh toán', 'Kho', 'Giao hàng', 'Báo cáo', 'Khuyến mãi', 'Email', 'Tìm kiếm', 'Tích điểm', 'Chống gian lận']
const HK = { sx: 170, sy: 480, cx: 1200, cardY: (i: number) => 85 + i * 92, srv: { x: 455, y: 545 } }

function hook(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const hot = t >= a3 + 3.2
  const count = track(snap(t), [[0, 0], [a3 + 1.0, 10000]], c.end(3) - 0.4 - (a3 + 1.0))
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, { x: 900, y: 540, s: 1.02 }], [a2, { x: 860, y: 540, s: 1.04 }, 1.5], [a3, { x: 840, y: 540, s: 1.07 }, 1.6]])}>
      <Rise t={t} at={a0 + 0.4}>
        <ServerUnit x={HK.sx} y={HK.sy} name="Khách hàng" t={t} accent={hot ? INK.bad : undefined} />
      </Rise>
      <Pill t={t} x={450} y={500} text="12 Lý Thường Kiệt" from={a0 + 1.4} to={a1} left />
      {/* the event, carrying only the id */}
      <Rise t={t} at={a0 + 3.2}>
        <div style={{ ...panel, left: 100, top: 120, width: 530, height: 176, boxSizing: 'border-box', padding: '14px 26px', fontFamily: MONO, fontSize: 28, lineHeight: 1.4 }}>
          <div style={{ color: '#9fd0ff' }}>CustomerAddressChanged</div>
          <div>customerId: c-7</div>
          <div style={{ color: INK.warn, opacity: vis(t, a1 + 1.8), whiteSpace: 'nowrap' }}>(không có địa chỉ mới)</div>
        </div>
      </Rise>
      <Packets t={t} from={{ x: 300, y: HK.sy - 10 }} to={{ x: 300, y: 315 }} start={a0 + 3.8} end={a1 - 0.4} every={0.55} len={0.8} />
      {/* ten services */}
      {SERVICES.map((name, i) => {
        const on = a1 + 0.2 + i * 0.12
        return (
          <div key={name}>
            <Rise t={t} at={on}>
              <div style={{ ...panel, left: HK.cx, top: HK.cardY(i), width: 480, height: 78, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 30, padding: '0 28px' }}>
                <span>{name}</span>
                <span style={{ fontSize: 28, color: INK.warn, opacity: vis(t, a3 + 0.2 + i * 0.1) }}>1.000/h</span>
              </div>
            </Rise>
            <Packets t={t} from={{ x: 475, y: HK.srv.y - 10 }} to={{ x: HK.cx - 20, y: HK.cardY(i) + 39 }} start={a1 + 1.0 + i * 0.1} end={a2 - 0.3} every={0.8} len={1.0} />
            <Packets t={t} from={{ x: HK.cx - 20, y: HK.cardY(i) + 39 }} to={{ x: 475, y: HK.srv.y + 5 }} start={a2 + 0.4 + i * 0.1} end={a3 + 3.0} every={0.6} len={1.0} />
          </div>
        )
      })}
      <Pill t={t} x={820} y={64} text="GET /customers/7" from={a2 + 0.3} mono />
      {/* heat */}
      <Icon3D name="fire" x={300} y={385} size={lerp(100, 150, move(t, a3 + 3.2, 1.2))} t={t} at={a3 + 3.2} />
      <Rise t={t} at={a3 + 0.5}>
        <div style={{ ...panel, left: 70, top: 740, width: 460, height: 150, boxSizing: 'border-box', textAlign: 'center', padding: '10px 16px' }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.1, color: hot ? INK.bad : '#ffffff', ...TABULAR }}>{numR(count, 100)}</div>
          <div style={{ fontSize: 28, color: INK.faint }}>lần gọi API / giờ</div>
        </div>
      </Rise>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 1. notification vs event-carried state transfer */

/** One side of the comparison: event card, consumer, Customer service, call load readout. */
function Side({ t, c, x0, ecst }: { t: number; c: Cue; x0: number; ecst: boolean }) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const start = ecst ? a1 : a0
  const down = t >= a3 + 0.3
  const stuck = !ecst && t >= a3 + 0.9
  const count = track(snap(t), [[0, 0], [a2 + 0.3, 10000]], 2.3)
  const showSrv = ecst ? start + 3.0 : start + 3.2
  return (
    <>
      <Rise t={t} at={start + 0.1}>
        <div style={{ ...GLOW, position: 'absolute', left: x0 + 160, top: 100, width: 480, height: 74, borderRadius: 999, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, fontWeight: 800 }}>{ecst ? 'State transfer' : 'Notification'}</div>
      </Rise>
      <Icon3D name={ecst ? 'mail' : 'bell'} x={x0 + 70} y={137} size={100} t={t} at={start + 0.1} />
      <Rise t={t} at={start + 0.9}>
        <div style={{ ...panel, left: x0 + 20, top: 215, width: 760, height: 176, boxSizing: 'border-box', padding: '14px 28px', fontFamily: MONO, fontSize: 32, lineHeight: 1.4 }}>
          <div style={{ color: '#9fd0ff' }}>CustomerAddressChanged</div>
          <div>customerId: c-7</div>
          <div style={{ color: ecst ? INK.good : INK.warn }}>{ecst ? 'address: 12 Lý Thường Kiệt' : '(không có địa chỉ)'}</div>
        </div>
      </Rise>
      <Wire from={{ x: x0 + 200, y: 395 }} to={{ x: x0 + 200, y: 488 }} p={vis(t, start + 2.0)} flow={t} />
      <Packets t={t} from={{ x: x0 + 200, y: 400 }} to={{ x: x0 + 200, y: 470 }} start={start + 2.3} every={0.7} len={0.7} />
      <Rise t={t} at={start + 2.1}>
        <ConsumerUnit x={x0 + 20} y={500} name="Service Báo cáo" t={t} w={400} busy={down && stuck ? undefined : ((t * 0.4) % 1)} down={stuck} note={stuck ? 'kẹt' : undefined} accent={INK.good} />
      </Rise>
      <Rise t={t} at={showSrv}>
        <ServerUnit x={x0 + 500} y={480} name="Khách hàng" t={t} down={down} />
      </Rise>
      {!ecst && (
        <>
          <Wire from={{ x: x0 + 428, y: 559 }} to={{ x: x0 + 492, y: 545 }} p={vis(t, start + 4.3, a3 + 0.3)} flow={t} dashed />
          <Packets t={t} from={{ x: x0 + 428, y: 552 }} to={{ x: x0 + 492, y: 540 }} start={start + 4.4} end={a3 + 0.1} every={0.5} len={0.7} />
        </>
      )}
      {ecst && <Pill t={t} x={x0 + 220} y={650} text="bản sao cục bộ: 12 Lý Thường Kiệt" size={28} color={INK.good} from={start + 3.8} />}
      {ecst && <Pill t={t} x={x0 + 400} y={915} text="cái giá: sự kiện to hơn, dữ liệu nhân bản" size={28} color={INK.warn} from={a3 + 4.6} pulse={beat(t, a3 + 5.4)} />}
      {!ecst && <Pill t={t} x={x0 + 220} y={650} text="gọi API để hỏi địa chỉ" size={28} color={INK.warn} from={start + 4.2} to={a3 + 0.3} />}
      {!ecst && <Pill t={t} x={x0 + 220} y={650} text="không lấy được địa chỉ" size={28} color={INK.bad} from={a3 + 1.2} pulse={beat(t, a3 + 2.0)} />}
      {ecst && <Pill t={t} x={x0 + 400} y={845} text="vẫn chạy khi Khách hàng sập" size={30} color={INK.good} from={a3 + 2.2} pulse={beat(t, a3 + 3.0)} />}
      {!ecst && (
        <Rise t={t} at={a2 + 0.2}>
          <div style={{ ...panel, left: x0 + 20, top: 720, width: 760, height: 100, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <span style={{ fontSize: 56, fontWeight: 800, color: INK.bad, ...TABULAR }}>{numR(count, 100)}</span>
            <span style={{ fontSize: 28, color: INK.faint }}>lần gọi / giờ</span>
          </div>
        </Rise>
      )}
      {ecst && (
        <Rise t={t} at={a2 + 1.6}>
          <div style={{ ...panel, left: x0 + 20, top: 720, width: 760, height: 100, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <span style={{ fontSize: 56, fontWeight: 800, color: INK.good }}>0</span>
            <span style={{ fontSize: 28, color: INK.faint }}>lần gọi / giờ</span>
          </div>
        </Rise>
      )}
    </>
  )
}

function ecst(t: number, c: Cue) {
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, { x: 760, y: 380, s: 1.12 }], [c.at(1) - 0.4, { x: 960, y: 520, s: 1.0 }, 1.4], [c.at(3), { x: 960, y: 520, s: 1.03 }, 1.6]])}>
      <Side t={t} c={c} x0={110} ecst={false} />
      {[{ x: 1030, y: 215, w: 760, h: 176 }, { x: 1030, y: 500, w: 400, h: 118 }, { x: 1510, y: 480, w: 260, h: 130 }].map((b) => (
        <div key={b.y} style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, borderRadius: 22, border: '3px dashed rgba(140,185,255,0.85)', background: 'rgba(60,100,220,0.12)', boxSizing: 'border-box', opacity: vis(t, c.at(0) + 0.8, c.at(1) + 0.9) }} />
      ))}
      <Side t={t} c={c} x0={1010} ecst />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 2. the envelope */

const FIELDS: { key: string; value: string; notes: { text: string; color?: string; dx: number }[] }[] = [
  { key: 'eventId', value: '9f1c2e7a-…', notes: [{ text: 'chống xử lý trùng', dx: 0 }] },
  { key: 'type', value: 'OrderPlaced', notes: [{ text: '✓ OrderPlaced', color: INK.good, dx: 0 }, { text: '✗ PlaceOrder', color: INK.bad, dx: 275 }] },
  { key: 'version', value: '2', notes: [{ text: 'phiên bản schema', dx: 0 }] },
  { key: 'occurredAt', value: '2026-11-02T09:15:00Z', notes: [{ text: 'lúc việc xảy ra', dx: 0 }, { text: '≠ lúc gửi', color: INK.warn, dx: 330 }] },
  { key: 'source', value: 'order-service', notes: [{ text: 'service nào phát', dx: 0 }] },
  { key: 'data', value: '{ orderId, total }', notes: [{ text: 'phần nghiệp vụ', dx: 0 }] },
]

function envelope(t: number, c: Cue) {
  const row = [at(c, 0, 0.42), at(c, 1, 0.08), at(c, 2, 0.05), at(c, 3, 0.05), at(c, 4, 0.04), at(c, 4, 0.5)]
  const noteAt = [at(c, 0, 0.7), at(c, 1, 0.45), at(c, 2, 0.5), at(c, 3, 0.3), at(c, 4, 0.25), at(c, 4, 0.8)]
  const secondAt = [0, at(c, 1, 0.75), 0, at(c, 3, 0.75), 0, 0]
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, { x: 960, y: 540, s: 1.0 }], [c.at(3), { x: 900, y: 550, s: 1.05 }, 1.6]])}>
      <Rise t={t} at={0.4}>
        <div style={{ ...panel, left: 110, top: 120, width: 1380, height: 850, boxSizing: 'border-box' }} />
      </Rise>
      <Txt x={150} y={140} size={30} color={INK.faint} o={vis(t, 0.8)}>
        phong bì sự kiện
      </Txt>
      <Pulse t={t} from={at(c, 0, 0.5)} cx={1680} cy={540} amp={0.06}>
        <Icon3D name="mail" x={1680} y={540} size={250} t={t} at={0.5} />
      </Pulse>
      {FIELDS.map((f, i) => {
        const last = i === FIELDS.length - 1
        // 0..1 highlight factor: eases in over 0.3s when the row is read, out over 0.3s when the next row takes over
        const h = ease(span(t, row[i], row[i] + 0.3)) * (last ? 1 : 1 - ease(span(t, row[i + 1], row[i + 1] + 0.3)))
        const shown = ease(span(t, row[i], row[i] + 0.3))
        const y = 195 + i * 125
        return (
          <div key={f.key}>
            <Rise t={t} at={0.9 + i * 0.18}>
              <div style={{ position: 'absolute', left: 140, top: y, width: 1320, height: 100, borderRadius: 18, background: 'rgba(40,70,170,0.22)' }} />
              <div style={{ position: 'absolute', left: 140, top: y, width: 1320, height: 100, borderRadius: 18, background: HERO, opacity: h, boxShadow: h > 0 ? `0 0 ${20 + 22 * beat(t, row[i])}px rgba(77,141,255,0.65), inset 0 2px 0 rgba(255,255,255,0.4)` : undefined }} />
            </Rise>
            <Rise t={t} at={row[i]}>
              <div style={{ opacity: shown }}>
                <div style={{ position: 'absolute', left: 175, top: y, height: 100, display: 'flex', alignItems: 'center', fontFamily: MONO, fontSize: 36, fontWeight: 800 }}>{f.key}</div>
                <div style={{ position: 'absolute', left: 470, top: y, height: 100, display: 'flex', alignItems: 'center', fontFamily: MONO, fontSize: 32, fontWeight: 700, color: mixRgb([159, 208, 255], [255, 255, 255], h), whiteSpace: 'nowrap' }}>{f.value}</div>
              </div>
            </Rise>
            {f.notes.map((n, j) => {
              const from = j === 0 ? noteAt[i] : secondAt[i]
              return <Pill key={n.text} t={t} x={905 + n.dx} y={y + 20} text={n.text} color={n.color} size={30} from={from} left />
            })}
          </div>
        )
      })}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 3. choosing the key */

const KEY = { x0: 360, w: 110, rows: [360, 560, 760] }
type KeyCell = { row: number; col: number; label: string; who: 'A' | 'B' | 'C' }
const KEY_A: KeyCell[] = [
  { row: 0, col: 0, label: '+500', who: 'A' }, { row: 0, col: 1, label: '−120', who: 'A' }, { row: 0, col: 2, label: '+30', who: 'A' },
  { row: 1, col: 0, label: 'B', who: 'B' }, { row: 1, col: 1, label: 'B', who: 'B' }, { row: 1, col: 2, label: 'B', who: 'B' },
  { row: 2, col: 0, label: 'C', who: 'C' }, { row: 2, col: 1, label: 'C', who: 'C' },
]
const KEY_B: KeyCell[] = [
  { row: 0, col: 0, label: '+500', who: 'A' }, { row: 1, col: 0, label: '−120', who: 'A' }, { row: 2, col: 0, label: '+30', who: 'A' },
  { row: 0, col: 1, label: 'B', who: 'B' }, { row: 1, col: 1, label: 'B', who: 'B' }, { row: 1, col: 2, label: 'B', who: 'B' },
  { row: 0, col: 2, label: 'C', who: 'C' }, { row: 2, col: 1, label: 'C', who: 'C' },
]

function keyScene(t: number, c: Cue) {
  const [a1, a2, a3] = [c.at(1), c.at(2), c.at(3)]
  // reading order of account A's three events: [row, col] per step, and the moment each step is read
  const readA = [at(c, 1, 0.2), at(c, 1, 0.4), at(c, 1, 0.6)]
  const readB = [at(c, 3, 0.15), at(c, 3, 0.95), at(c, 3, 1.2)]
  const phaseB = t >= a2
  const step = (r: number[]) => r.filter((x) => t >= x).length - 1
  const ts = snap(t)
  const balance = phaseB
    ? track(ts, [[0, 0], [readB[0] + 0.2, -120], [readB[1] + 0.2, 380], [readB[2] + 0.2, 410]], 0.4)
    : track(ts, [[0, 0], [readA[0] + 0.2, 500], [readA[1] + 0.2, 380], [readA[2] + 0.2, 410]], 0.4)
  const ringIdx = (r: number[], on: boolean) => {
    const s = on ? step(r) : -1
    if (s < 0) return -1
    // the A cell read at step s (in the order of its position in `readOrder`)
    return s
  }
  const orderA = [0, 1, 2]
  const orderB = [1, 0, 2]
  const sA = ringIdx(readA, t >= a1 && t < a2)
  const sB = ringIdx(readB, t >= a3)
  const bg = (w: 'A' | 'B' | 'C') => (w === 'A' ? BLUE : DIM)
  const neg = balance < 0
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, { x: 1000, y: 540, s: 1.0 }], [a1, { x: 1000, y: 540, s: 1.04 }, 1.6], [a2, { x: 1000, y: 540, s: 1.0 }, 1.6]])}>
      <Icon3D name="key" x={290} y={225} size={130} t={t} at={0.4} />
      <div style={{ position: 'absolute', left: 400, top: 0 }}>
        {t < a2 + 0.2 ? <Statement key="a" x={0} y={190} text="key = accountId" color={INK.good} size={56} o={sp(t, 1.0)} /> : <Statement key="b" x={0} y={190} text="key = paymentId" color={INK.bad} size={56} o={sp(t, a2 + 0.2)} />}
      </div>
      {KEY.rows.map((y, r) => (
        <div key={r}>
          <Txt x={250} y={y + 16} size={32} color={INK.faint} o={vis(t, 0.6)}>
            P{r}
          </Txt>
          <Slots t={t} from={0.6} x={KEY.x0} y={y} n={8} w={KEY.w} />
        </div>
      ))}
      {KEY_A.map((k, i) => (
        <Cell key={`a${i}`} t={t} from={2.0 + (k.who === 'A' ? i * 0.2 : 1.0 + i * 0.1)} out={a2} x={KEY.x0 + k.col * KEY.w} y={KEY.rows[k.row]} w={KEY.w} label={k.label} bg={bg(k.who)} ring={sA >= 0 && k.who === 'A' && orderA[sA] === k.col} />
      ))}
      {KEY_B.map((k, i) => (
        <Cell key={`b${i}`} t={t} from={a2 + 0.7 + i * 0.22} x={KEY.x0 + k.col * KEY.w} y={KEY.rows[k.row]} w={KEY.w} label={k.label} bg={bg(k.who)} ring={sB >= 0 && k.who === 'A' && KEY_B.filter((q) => q.who === 'A')[orderB[sB]] === k} />
      ))}
      <Rise t={t} at={a1 + 0.1}>
        <div style={{ ...panel, left: 1310, top: 380, width: 540, height: 300, boxSizing: 'border-box', textAlign: 'center', padding: '20px', ...(neg && t >= readB[2] ? { boxShadow: `0 0 ${14 + 30 * beat(t, readB[2])}px rgba(255,77,96,0.8)` } : null) }}>
          <div style={{ fontSize: 30, color: INK.faint }}>Số dư acc-A</div>
          <div style={{ fontSize: 118, fontWeight: 800, lineHeight: 1.2, color: neg ? INK.bad : '#ffffff', ...TABULAR }}>{numR(balance, 10).replace(/^-/, '−')}</div>
          <div style={{ fontSize: 34, fontWeight: 700, color: neg ? INK.bad : INK.good }}>{phaseB ? (t < readB[0] ? 'chưa đọc' : neg ? 'rút trước nạp → số dư âm' : 'nạp tới mới bù lại') : 'thứ tự đúng'}</div>
        </div>
      </Rise>
      <div style={{ opacity: vis(t, readA[2] + 0.5, a2) }}>
        <Icon3D name="thumb-up" x={1580} y={830} size={150} t={t} at={readA[2] + 0.5} />
      </div>
      <div style={{ opacity: vis(t, readB[0] + 0.4) }}>
        <Pulse t={t} from={readB[0] + 1.0} cx={1580} cy={830} amp={0.1}>
          <Icon3D name="thumb-down" x={1580} y={830} size={150} t={t} at={readB[0] + 0.4} />
        </Pulse>
      </div>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 4. event sourcing: the log is the truth */

const ES = { x0: 190, w: 170, y: 470 }
type Ev = { label: string; bg: string; balance: string; after?: number }
const ES_CELLS: Ev[] = [
  { label: 'Opened', bg: BLUE, balance: '0' },
  { label: '+500', bg: GREEN, balance: '500' },
  { label: 'B', bg: DIM, balance: '—' },
  { label: '−120', bg: AMBER, balance: '380' },
  { label: 'B', bg: DIM, balance: '—' },
  { label: '+30', bg: GREEN, balance: '410' },
]

function eventlog(t: number, c: Cue) {
  const [a0, a1, a2, a3, a4] = [c.at(0), c.at(1), c.at(2), c.at(3), c.at(4)]
  const cellAt = [at(c, 1, 0.24), at(c, 1, 0.33), at(c, 1, 0.4), at(c, 1, 0.47), at(c, 1, 0.53), at(c, 1, 0.6)]
  const readAt = [at(c, 2, 0.14), at(c, 2, 0.36), at(c, 2, 0.4), at(c, 2, 0.62), at(c, 2, 0.7), at(c, 2, 0.85)]
  const sweepFrom = at(c, 3, 0.55)
  const sweepTo = at(c, 3, 0.92)
  const sweeping = t >= sweepFrom && t < sweepTo + 0.2
  const sweepIdx = Math.min(5, Math.floor(span(t, sweepFrom, sweepTo) * 6))
  const cancelAt = at(c, 4, 0.45)
  const balance = track(snap(t), [[0, 0], [readAt[1], 500], [readAt[3], 380], [readAt[5], 410], [a3 + 0.2, 380], [sweepFrom, 0], [sweepTo, 410], [cancelAt + 0.5, 530]], 0.45)
  const ringed = (i: number) => {
    if (sweeping) return i === sweepIdx
    if (t >= a3 && t < sweepFrom - 0.05) return i === 3
    if (t >= a2 && t < a3) return readAt.filter((x) => t >= x).length - 1 === i
    return false
  }
  const dock = move(t, a1 + 0.1, 0.9)
  // each caption eases out over ~0.3s around the moment the next one takes over
  const statements = [
    { text: 'chỉ lưu sự kiện, không lưu trạng thái', from: a1 + 0.3, to: a3, color: '#ffffff' },
    { text: 'sửa code → replay cả log', from: sweepFrom - 0.2, to: a4, color: '#ffffff' },
    { text: 'ghi thêm một sự kiện, không sửa cũ', from: a4 + 0.1, to: Infinity, color: INK.warn },
  ]
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, { x: 960, y: 540, s: 1.0 }], [a2, { x: 960, y: 540, s: 1.03 }, 1.6]])}>
      <Rise t={t} at={a0 + 0.3}>
        <div style={{ ...panel, left: 190, top: lerp(400, 160, dock), width: lerp(1300, 940, dock), height: lerp(190, 130, dock), boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 30, fontFamily: MONO, fontSize: lerp(54, 34, dock), opacity: lerp(1, 0.45, dock) }}>
          <span style={{ color: INK.faint }}>accounts</span>
          <span>acc-A</span>
          <span>
            balance = <b style={{ color: '#9fd0ff' }}>410</b>
          </span>
        </div>
      </Rise>
      <Pill t={t} x={190} y={640} text="vì sao 410?" color={INK.warn} size={40} from={a0 + 3.2} to={a1} left />
      <Pill t={t} x={520} y={640} text="quá khứ đã bị ghi đè" color={INK.bad} size={40} from={a0 + 4.8} to={a1} left />
      <Slots t={t} from={a1 + 0.6} x={ES.x0} y={ES.y} n={6} w={ES.w} />
      <Txt x={30} y={ES.y + 78} size={28} o={vis(t, a1 + 0.8)}>
        offset
      </Txt>
      {ES_CELLS.map((e, i) => (
        <div key={i}>
          <Cell t={t} from={cellAt[i]} x={ES.x0 + i * ES.w} y={ES.y} w={ES.w} label={e.label} bg={e.bg} ring={ringed(i)} />
          <Txt x={ES.x0 + i * ES.w} y={ES.y + 84} w={ES.w} align="center" size={28} o={vis(t, cellAt[i] + 0.2)}>
            {i}
          </Txt>
          <Txt x={ES.x0 + i * ES.w} y={ES.y + 128} w={ES.w} align="center" size={44} weight={800} color={e.bg === DIM ? INK.dim : '#ffffff'} mono o={vis(t, readAt[i] - 0.05)}>
            {e.balance}
          </Txt>
        </div>
      ))}
      <Txt x={30} y={ES.y + 142} size={28} o={vis(t, readAt[0])}>
        số dư
      </Txt>
      <Cell t={t} from={cancelAt} x={ES.x0 + 6 * ES.w} y={ES.y} w={ES.w} label="Huỷ" bg={RED} ring={t >= cancelAt && t < cancelAt + 1.4} />
      <Txt x={ES.x0 + 6 * ES.w} y={ES.y + 84} w={ES.w} align="center" size={28} o={vis(t, cancelAt + 0.2)}>
        6
      </Txt>
      <Txt x={ES.x0 + 6 * ES.w} y={ES.y + 128} w={ES.w} align="center" size={44} weight={800} mono o={vis(t, cancelAt + 0.6)}>
        530
      </Txt>
      {/* legend */}
      <Pill t={t} x={190} y={680} text="AccountOpened" size={28} color="#9fd0ff" from={cellAt[0]} left />
      <Pill t={t} x={490} y={680} text="MoneyDeposited" size={28} color={INK.good} from={cellAt[1]} left />
      <Pill t={t} x={810} y={680} text="MoneyWithdrawn" size={28} color={INK.warn} from={cellAt[3]} left />
      <Pill t={t} x={1150} y={680} text="B = tài khoản khác" size={28} color={INK.faint} from={cellAt[2]} left />
      {statements.map((st) => (
        <div key={st.text} style={{ opacity: 1 - ease(span(t, st.to - 0.2, st.to + 0.1)) }}>
          <Statement x={190} y={800} text={st.text} color={st.color} size={50} o={sp(t, st.from)} />
        </div>
      ))}
      <div style={{ opacity: vis(t, 0, a4 + 0.1, 0.4) }}>
        <Icon3D name="tools" x={1560} y={830} size={150} t={t} at={sweepFrom - 0.2} />
      </div>
      <Rise t={t} at={a2 + 0.05}>
        <div style={{ ...panel, left: 1450, top: 360, width: 400, height: 250, boxSizing: 'border-box', textAlign: 'center', padding: '18px' }}>
          <div style={{ fontSize: 30, color: INK.faint }}>Số dư</div>
          <div style={{ fontSize: 112, fontWeight: 800, lineHeight: 1.25, ...TABULAR }}>{numR(balance, 10)}</div>
        </div>
      </Rise>
      <Pill t={t} x={ES.x0 + 3 * ES.w + ES.w / 2} y={ES.y - 76} text="tại offset 3: 380" size={28} color="#ffffff" from={a3 + 0.05} to={sweepFrom - 0.55} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 5. snapshot */

const SN = { x0: 240, w: 72, n: 20, ya: 410, yb: 760 }

function SnapRow({ t, y, from, cursor, covered = 0, label, counter, counterColor, delay = 0, glow = 0 }: { t: number; y: number; from: number; cursor: number; covered?: number; label: string; counter: string; counterColor: string; delay?: number; glow?: number }) {
  const o = vis(t, from, undefined, 0.5)
  if (o <= 0) return null
  const cx = SN.x0 + cursor * SN.w
  return (
    <div style={{ opacity: o }}>
      <Txt x={SN.x0} y={y - 62} size={32} color="#ffffff">
        {label}
      </Txt>
      {Array.from({ length: SN.n }, (_, i) => {
        const swept = i < cursor - 0.001 && i >= covered
        const isCovered = i < covered
        return (
          <div key={i} style={{ position: 'absolute', left: SN.x0 + i * SN.w, top: y, width: SN.w, height: 70, padding: '0 3px', boxSizing: 'border-box' }}>
            <div style={{ height: '100%', borderRadius: 14, background: isCovered ? 'rgba(110,160,255,0.22)' : swept ? (INK.cell.new as string) : BLUE, border: isCovered ? '1.5px solid rgba(110,160,255,0.5)' : 'none', boxShadow: isCovered ? undefined : LIFT }} />
          </div>
        )
      })}
      {cursor > covered && cursor < SN.n && delay === 0 && <div style={{ position: 'absolute', left: cx - 2, top: y - 14, width: 5, height: 98, borderRadius: 3, background: '#ffffff', boxShadow: '0 0 16px #ffffff' }} />}
      {[0, 10, 20].map((k) => (
        <Txt key={k} x={SN.x0 + k * SN.w - 100} y={y + 80} w={200} align="center" size={28} mono>
          {k === 0 ? '0' : k === 10 ? '500.000' : '1.000.000'}
        </Txt>
      ))}
      <Txt x={SN.x0} y={y + 122} size={46} weight={800} color={counterColor} glow={glow}>
        {counter}
      </Txt>
    </div>
  )
}

function snapshot(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const ts = snap(t)
  const sweepA = span(t, a0 + 0.4, c.end(0) - 0.3)
  const sweepAq = span(ts, a0 + 0.4, c.end(0) - 0.3)
  const curA = sweepA * SN.n
  const sweepBEnd = a2 + 0.4 + (c.end(2) - a2) * 0.55
  const sweepB = span(t, a2 + 0.4, sweepBEnd)
  const sweepBq = span(ts, a2 + 0.4, sweepBEnd)
  const curB = 18 + sweepB * 2
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, { x: 960, y: 540, s: 1.0 }], [a2, { x: 1020, y: 620, s: 1.06 }, 1.8]])}>
      <Statement x={SN.x0} y={200} text="một tài khoản · 1.000.000 sự kiện" color="#9fd0ff" size={48} o={sp(t, a0 + 0.3)} />
      <SnapRow t={t} y={SN.ya} from={a0 + 0.2} cursor={curA} label="Replay từ đầu" counter={`đã cộng ${numR(sweepAq * 1000000, 10000)} dòng`} counterColor={sweepA >= 1 ? INK.bad : INK.warn} glow={beat(t, c.end(0), 1.2)} />
      <SnapRow t={t} y={SN.yb} from={a1 + 0.1} cursor={t >= a2 + 0.4 ? curB : 18} covered={18} label="Snapshot + phần còn lại" counter={t >= a2 + 0.4 ? `chỉ cộng ${numR(sweepBq * 100000, 1000)} dòng` : 'đã gói vào snapshot'} counterColor={t >= a2 + 0.4 ? INK.good : INK.faint} delay={t >= a2 + 0.4 ? 0 : 1} glow={beat(t, sweepBEnd, 1.2)} />
      <Pulse t={t} from={at(c, 1, 0.35) + 1} cx={SN.x0 + 18 * SN.w} cy={SN.yb - 5} amp={0.08}>
        <Icon3D name="flag" x={SN.x0 + 18 * SN.w} y={SN.yb - 70} size={130} t={t} at={at(c, 1, 0.35)} />
      </Pulse>
      <Pill t={t} x={SN.x0 + 18 * SN.w - 90} y={SN.yb - 160} text="snapshot @900.000" size={30} color={INK.warn} from={at(c, 1, 0.65)} pulse={beat(t, at(c, 1, 0.65) + 1)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 6. compacted topic */

const CP = { x0: 300, w: 220, yc: 600, ye: 340, h: 96 }
type Rec = { key: 'A' | 'B' | 'C'; label: string; bg: string }
const RECS: Rec[] = [
  { key: 'A', label: 'A · 410', bg: BLUE },
  { key: 'B', label: 'B · 90', bg: AMBER },
  { key: 'A', label: 'A · 600', bg: BLUE },
  { key: 'C', label: 'C · 35', bg: GREEN },
  { key: 'B', label: 'B · 120', bg: AMBER },
]
const TOMB: Rec = { key: 'C', label: 'C · null', bg: RED }

function compact(t: number, c: Cue) {
  const [a0, a1, a2, a4] = [c.at(0), c.at(1), c.at(2), c.at(4)]
  const recAt = [at(c, 1, 0.05), at(c, 1, 0.22), at(c, 1, 0.42), at(c, 1, 0.58), at(c, 1, 0.75)]
  const outA = at(c, 2, 0.3)
  const outB = at(c, 2, 0.5)
  const slide = at(c, 2, 0.72)
  const newIdx = [-1, -1, 0, 1, 2]
  const posX = (i: number) => {
    const from = CP.x0 + i * CP.w
    const to = CP.x0 + newIdx[i] * CP.w
    return newIdx[i] < 0 ? from : lerp(from, to, move(t, slide, 0.7))
  }
  const ringA = t >= at(c, 1, 0.45) && t < a2
  const tombAt = at(c, 3, 0.2)
  const sOut = 1 - span(t, a4, a4 + 0.4)
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, { x: 960, y: 480, s: 1.0 }], [a1, { x: 960, y: 490, s: 1.03 }, 1.6], [a4, { x: 960, y: 480, s: 1.0 }, 1.8]])}>
      <Txt x={CP.x0} y={CP.ye + 14} size={60} color="#9fd0ff" weight={800} mono o={vis(t, a0 + 0.3) * sOut}>
        cleanup.policy=compact
      </Txt>
      <Txt x={CP.x0} y={CP.yc - 66} size={34} color="#ffffff" o={vis(t, a0 + 0.9)}>
        topic compact
      </Txt>
      <Slots t={t} from={a0 + 1.2} x={CP.x0} y={CP.yc} n={6} w={CP.w} h={CP.h} />
      {RECS.map((r, i) => (
        <Cell key={i} t={t} h={CP.h} size={32} from={recAt[i]} x={posX(i)} y={CP.yc} w={CP.w} label={r.label} bg={r.bg} out={i === 0 ? outA : i === 1 ? outB : undefined} ring={ringA && r.key === 'A'} />
      ))}
      <Cell t={t} h={CP.h} size={32} from={tombAt} x={CP.x0 + 3 * CP.w} y={CP.yc} w={CP.w} label={TOMB.label} bg={TOMB.bg} ring={t >= tombAt && t < a4} />
      <Icon3D name="trash-can" x={CP.x0 + 6 * CP.w + 120} y={CP.yc + 48} size={170} t={t} at={tombAt + 0.3} />
      <Pill t={t} x={CP.x0 + 2.5 * CP.w - 100} y={CP.yc + 150} text="mỗi khoá giữ một bản mới nhất" size={34} color={INK.good} from={at(c, 2, 0.78)} to={at(c, 3, 0)} />
      {/* event log kept whole, for comparison */}
      <Txt x={CP.x0} y={CP.ye - 66} size={34} color="#ffffff" o={vis(t, a4 + 0.45)}>
        event log: giữ mọi sự kiện
      </Txt>
      <Slots t={t} from={a4 + 0.45} x={CP.x0} y={CP.ye} n={6} w={CP.w} h={CP.h} />
      {[...RECS, TOMB].map((r, i) => (
        <Cell key={i} t={t} h={CP.h} size={32} from={a4 + 0.7 + i * 0.12} x={CP.x0 + i * CP.w} y={CP.ye} w={CP.w} label={r.label} bg={r.bg} />
      ))}
      <Pill t={t} x={CP.x0 + 2.5 * CP.w - 100} y={CP.yc + 150} text="đã mất: A · 410 và B · 90" size={34} color={INK.bad} from={a4 + 1.2} pulse={beat(t, a4 + 2.0)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 7. CQRS */

type Model = { title: string; sub: string; before: string; after: string; y: number; updateAt: (c: Cue) => number }
const MODELS: Model[] = [
  { title: 'Bảng số dư', sub: 'API xem số dư', before: 'acc-A: 410', after: 'acc-A: 290', y: 270, updateAt: (c) => at(c, 3, 0.78) },
  { title: 'Chỉ mục tìm kiếm', sub: 'Elasticsearch', before: '3 giao dịch', after: '4 giao dịch', y: 520, updateAt: (c) => at(c, 2, 0.9) },
  { title: 'Báo cáo tháng', sub: 'dashboard kế toán', before: 'rút: 120', after: 'rút: 240', y: 770, updateAt: (c) => at(c, 2, 0.96) },
]
const CQ_TAPE = { x: 520, y: 500, w: 100 }

function cqrs(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const newCell = at(c, 1, 0.5)
  const cardAt = [at(c, 2, 0.2), at(c, 2, 0.45), at(c, 2, 0.68)]
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, { x: 960, y: 540, s: 1.0 }], [a2, { x: 960, y: 540, s: 1.02 }, 1.6]])}>
      <Rise t={t} at={a0 + 0.2}>
        <ServerUnit x={140} y={470} name="Tài khoản" t={t} />
      </Rise>
      <Pill t={t} x={270} y={330} text="Lệnh: rút 120" size={32} from={a0 + 0.6} />
      <Packets t={t} from={{ x: 270, y: 385 }} to={{ x: 270, y: 450 }} start={a0 + 1.6} end={a1 - 0.3} every={0.6} len={0.8} />
      <Pill t={t} x={530} y={190} text="bên ghi" size={34} color="#9fd0ff" from={a0 + 3.0} />
      <Txt x={CQ_TAPE.x} y={CQ_TAPE.y - 62} size={30} color="#ffffff" o={vis(t, a1 + 0.1)}>
        account-events
      </Txt>
      <Slots t={t} from={a1 + 0.1} x={CQ_TAPE.x} y={CQ_TAPE.y} n={4} w={CQ_TAPE.w} />
      {['+500', '−120', '+30'].map((l, i) => (
        <Cell key={l} t={t} from={a1 + 0.2 + i * 0.15} x={CQ_TAPE.x + i * CQ_TAPE.w} y={CQ_TAPE.y} w={CQ_TAPE.w} label={l} bg={i === 1 ? AMBER : i === 2 ? GREEN : GREEN} />
      ))}
      <Cell t={t} from={newCell} x={CQ_TAPE.x + 3 * CQ_TAPE.w} y={CQ_TAPE.y} w={CQ_TAPE.w} label="−120" bg={AMBER} ring={t >= newCell && t < newCell + 1.2} />
      <Packets t={t} from={{ x: 410, y: 530 }} to={{ x: 505, y: 535 }} start={a1 + 1.0} end={newCell} every={0.5} len={0.6} />
      <Pill t={t} x={1500} y={170} text="bên đọc" size={34} color="#9fd0ff" from={a0 + 3.4} />
      {MODELS.map((m) => (
        <div key={m.title} style={{ position: 'absolute', left: 1180, top: m.y, width: 640, height: 190, borderRadius: 22, border: '3px dashed rgba(140,185,255,0.85)', background: 'rgba(60,100,220,0.12)', boxSizing: 'border-box', opacity: vis(t, a0 + 3.4) }} />
      ))}
      {MODELS.map((m, i) => {
        const updated = t >= m.updateAt(c)
        const fresh = updated && t < m.updateAt(c) + 1.4
        const stale = i === 0 && t >= a3 + 0.4 && !updated
        return (
          <div key={m.title}>
            <Wire from={{ x: CQ_TAPE.x + 4 * CQ_TAPE.w + 10, y: CQ_TAPE.y + 35 }} to={{ x: 1170, y: m.y + 95 }} p={vis(t, cardAt[i] + 0.3)} flow={t} dashed />
            <Packets t={t} from={{ x: CQ_TAPE.x + 4 * CQ_TAPE.w + 20, y: CQ_TAPE.y + 35 }} to={{ x: 1150, y: m.y + 95 }} start={Math.max(cardAt[i] + 0.8, newCell + 0.4)} end={i === 0 ? a3 + 3.2 : at(c, 2, 0.9)} every={i === 0 ? 1.1 : 0.9} len={i === 0 ? 1.6 : 1.1} />
            <Rise t={t} at={cardAt[i]}>
              <div style={{ ...panel, left: 1180, top: m.y, width: 640, height: 190, boxSizing: 'border-box', padding: '18px 30px', boxShadow: fresh ? '0 0 40px rgba(255,255,255,0.8), 0 0 26px rgba(61,123,255,0.5)' : updated ? `0 0 ${10 + 24 * beat(t, m.updateAt(c) + 1.4)}px rgba(39,211,145,0.7)` : panel.boxShadow, border: fresh ? '2px solid #ffffff' : (panel.border as string) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 34 }}>{m.title}</span>
                  <span style={{ fontSize: 28, color: INK.faint }}>{m.sub}</span>
                </div>
                <div style={{ marginTop: 26, fontFamily: MONO, fontSize: 52, fontWeight: 800, ...TABULAR, color: updated ? INK.good : stale ? INK.warn : '#ffffff' }}>{updated ? m.after : m.before}</div>
              </div>
            </Rise>
          </div>
        )
      })}
      <Icon3D name="clock" x={1040} y={315} size={120} t={t} at={a3 + 0.2} />
      <Pill t={t} x={1100} y={96} text="trễ vài trăm mili giây" size={30} color={INK.warn} from={a3 + 0.6} to={MODELS[0].updateAt(c)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 8. summary */

function summary(t: number, c: Cue) {
  return (
    <SoftTheme>
      <SummaryList t={t} cue={c} items={['Sự kiện mang dữ liệu, bớt gọi API', 'Phong bì: eventId, type, version, occurredAt', 'Key = id của thứ cần giữ thứ tự', 'Log là sự thật; snapshot, compact, CQRS']} />
    </SoftTheme>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { hook, ecst, envelope, key: keyScene, eventlog, snapshot, compact, cqrs, summary }

/** Key-moment sounds, timed to the same cue offsets the scenes animate on. */
const SFX: Record<string, SceneSfx[]> = {
  hook: [{ kind: 'error', at: (c) => at(c, 3, 0) + 3.3 }],
  ecst: [{ kind: 'error', at: (c) => at(c, 3, 0) + 0.4 }, { kind: 'ding', at: (c) => at(c, 3, 0) + 2.3 }],
  envelope: [{ kind: 'ding', at: (c) => at(c, 4, 0.5) + 0.3 }],
  key: [{ kind: 'ding', at: (c) => at(c, 1, 0.6) + 0.4 }, { kind: 'error', at: (c) => at(c, 3, 0.1) + 0.3 }],
  eventlog: [{ kind: 'tick', at: (c) => at(c, 2, 0.85) + 0.2 }, { kind: 'ding', at: (c) => at(c, 3, 0.92) + 0.2 }],
  snapshot: [{ kind: 'ding', at: (c) => at(c, 1, 0.35) + 0.3 }, { kind: 'ding', at: (c) => at(c, 2, 0.55) + 0.4 }],
  compact: [{ kind: 'tick', at: (c) => at(c, 2, 0.3) }, { kind: 'ding', at: (c) => at(c, 2, 0.72) + 0.7 }, { kind: 'error', at: (c) => at(c, 4, 0) + 1.3 }],
  cqrs: [{ kind: 'ding', at: (c) => at(c, 2, 0.9) + 0.3 }, { kind: 'ding', at: (c) => at(c, 3, 0.78) + 0.3 }],
}

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const eventDesignLesson: Lesson = {
  ...eventDesignScript,
  scenes: eventDesignScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id], sfx: SFX[s.id] })),
  intro: [
    { kind: 'video', scenes: ['hook'] },
    {
      kind: 'quiz',
      title: 'Quick Quiz',
      questions: [q('Đoán trước khi học: 10 service cùng nghe sự kiện CustomerAddressChanged chỉ có customerId. Mỗi service nhận 1.000 sự kiện mỗi giờ và cần địa chỉ mới. Service Khách hàng chịu bao nhiêu lần gọi API mỗi giờ?', ['0', '1.000', '10.000', '100.000'], 2, '10 service × 1.000 sự kiện, mỗi sự kiện một lần gọi lại. Nếu sự kiện mang sẵn địa chỉ thì là 0.')],
    },
  ],
  roadmap: [
    'Chặng 1: Sự kiện nên mang bao nhiêu dữ liệu (notification hay state transfer), phong bì chung và cách chọn key.',
    'Chặng 2: Event sourcing: log là nguồn sự thật, trạng thái là kết quả replay; snapshot cắt ngắn replay.',
    'Chặng 3: Compacted topic giữ trạng thái mới nhất, và CQRS dựng nhiều read model từ cùng một luồng sự kiện.',
  ],
  sections: [
    {
      id: 'thiet-ke-su-kien',
      title: 'Thiết kế sự kiện: dữ liệu, phong bì, key',
      blocks: [
        { kind: 'video', scenes: ['ecst'] },
        {
          kind: 'table',
          head: ['', 'Event notification', 'Event-carried state transfer (ECST)'],
          rows: [
            ['Nội dung', '`{"type":"CustomerAddressChanged","customerId":"c-7"}`', 'thêm `"address":"12 Lý Thường Kiệt, Hà Nội"`'],
            ['Consumer cần địa chỉ mới', 'phải **gọi API** service Khách hàng', 'có sẵn trong sự kiện'],
            ['10 service × 1.000 sự kiện/giờ', '**10.000 lần gọi API/giờ**', '0 lần gọi'],
            ['Service Khách hàng sập', 'consumer cũng kẹt', 'consumer vẫn chạy bằng bản sao cục bộ'],
            ['Nhược điểm', 'phụ thuộc lúc chạy', 'sự kiện to hơn, dữ liệu bị nhân bản'],
          ],
        },
        { kind: 'callout', tone: 'tip', title: 'Hình ảnh', text: 'Notification giống tin nhắn "Có bưu phẩm, ra bưu cục lấy": nhẹ, nhưng ai cũng phải chạy ra bưu cục. ECST giống shipper giao **tận tay**: nặng hơn, không ai phải đi đâu.' },
        { kind: 'callout', tone: 'info', title: 'Nhìn từ phía consumer (stream-table join)', text: 'Gọi DB ngoài cho **mỗi** sự kiện thêm độ trễ cho từng tin, và DB thường chịu được ít hơn nhiều so với tốc độ stream. Lời giải của sách: dùng **CDC** đẩy bảng sang Kafka, consumer giữ **bản sao riêng** và cập nhật theo từng sự kiện. Đó chính là tinh thần ECST. (📘 sách, ch.14)' },
        { kind: 'video', scenes: ['envelope'] },
        {
          kind: 'code',
          code: `{
  "eventId":    "9f1c2e7a-…",          // chống trùng (10.3)
  "type":       "OrderPlaced",          // loại sự kiện, thì quá khứ
  "version":    2,                      // phiên bản schema của loại này
  "occurredAt": "2026-11-02T09:15:00Z", // lúc việc xảy ra (không phải lúc gửi)
  "source":     "order-service",
  "data":       { "orderId": "order-42", "total": 250000 }
}`,
        },
        { kind: 'p', text: '**Ba loại thời gian** (📘 sách, ch.14): **event time** (lúc việc xảy ra), **log append time** (lúc tin tới broker), **processing time** (lúc consumer đọc). Nếu bản ghi Kafka được tạo **sau** từ một dòng DB (đúng như outbox), timestamp của nó không còn là event time, nên hãy đặt event time thành **một trường trong sự kiện**. Processing time thì không đáng tin, và cả pipeline nên thống nhất **một múi giờ** (ví dụ UTC, chữ `Z`).' },
        { kind: 'callout', tone: 'info', title: 'Đặt tên', text: 'Sự kiện là **sự thật đã xảy ra**, nên dùng **thì quá khứ**: `OrderPlaced`, `PaymentFailed`. Tên mệnh lệnh như `PlaceOrder`, `SendEmail` là **command** (yêu cầu ai đó làm gì), không phải event.' },
        { kind: 'video', scenes: ['key'] },
        {
          kind: 'list',
          items: [
            { title: 'Key = id của aggregate cần giữ thứ tự', text: '`orderId` cho sự kiện đơn hàng, `accountId` cho sự kiện tài khoản. Cùng key → cùng partition → đúng thứ tự (Module 2).' },
            { title: 'Không phải id sự kiện, không phải ngẫu nhiên', text: 'Đổi key thành `paymentId` "cho phân bố đều" thì các giao dịch của cùng một user rải ra nhiều partition: có thể trừ tiền trước khi nạp, số dư âm tạm thời.' },
            { title: 'Schema thay đổi', text: 'Dùng Schema Registry với chế độ tương thích (ví dụ `BACKWARD`): thêm trường **có giá trị mặc định** thì an toàn; đổi tên hay xoá trường bắt buộc thì làm vỡ consumer cũ. Thay đổi phá vỡ thật sự → loại sự kiện mới hoặc topic mới, tăng `version`.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Service Báo cáo cần tổng tiền của mỗi đơn, sự kiện chỉ có orderId. Giờ cao điểm 5.000 sự kiện/phút. Điều gì xảy ra với service Đơn hàng?', ['Không sao, Kafka đệm hết', 'Phải chịu thêm khoảng 5.000 lần gọi API/phút từ riêng consumer này', 'Tự động có cache', 'Consumer tự suy ra tổng tiền'], 1, 'Notification buộc consumer hỏi lại nguồn. ECST giải quyết bằng cách đưa sẵn dữ liệu vào sự kiện.'),
            q('Vì sao occurredAt nên là lúc nghiệp vụ xảy ra chứ không phải lúc gửi lên Kafka?', ['Vì Kafka không có timestamp', 'Vì outbox/CDC có thể gửi trễ, thời điểm gửi không phản ánh thời điểm thật', 'Vì processing time đáng tin hơn', 'Vì múi giờ không quan trọng'], 1, 'Publisher chết 10 phút rồi gửi bù thì timestamp bản ghi Kafka sai lệch; tính doanh thu theo giờ phải dựa vào lúc việc xảy ra.'),
            q('Topic payments dùng key = userId. Có người đổi sang key = paymentId. Hỏng gì?', ['Không hỏng gì', 'Giao dịch của cùng một user rơi vào nhiều partition, mất thứ tự', 'Topic không còn partition', 'Producer bị chặn'], 1, 'Key khác thì hash khác, nên không còn đảm bảo thứ tự cho từng user.'),
          ],
        },
      ],
    },
    {
      id: 'event-sourcing',
      title: 'Event sourcing, snapshot, compacted topic, CQRS',
      blocks: [
        { kind: 'video', scenes: ['eventlog'] },
        {
          kind: 'table',
          head: ['Offset', 'Sự kiện (key `acc-A`)', 'Số dư sau sự kiện'],
          rows: [
            ['0', 'AccountOpened', '0'],
            ['1', 'MoneyDeposited 500', '500'],
            ['3', 'MoneyWithdrawn 120', '380'],
            ['5', 'MoneyDeposited 30', '**410**'],
          ],
        },
        { kind: 'p', text: 'Log là **nguồn sự thật**. Muốn số dư lúc offset 3? Cộng đến offset 3 → 380. Muốn sửa bug tính phí? Sửa code rồi **replay** toàn bộ log. Giống sổ tiết kiệm ngày xưa: không ghi đè "số dư hiện tại" mà ghi từng dòng, số dư là phép cộng các dòng.' },
        { kind: 'p', text: '**Sự kiện không bao giờ bị sửa.** Giao dịch bị huỷ thì **ghi thêm** một sự kiện huỷ. Thứ tự cũng mang nghĩa: nạp rồi tiêu khác hẳn tiêu rồi mới nạp. **Stream và table là hai mặt của một đồng xu** (stream-table duality): table → stream là CDC; stream → table là áp lần lượt các sự kiện, gọi là **materialize**. Event sourcing đi chiều stream → table. (📘 sách, ch.14)' },
        { kind: 'video', scenes: ['snapshot'] },
        { kind: 'callout', tone: 'tip', title: 'Snapshot', text: 'Tài khoản có 1.000.000 sự kiện thì mỗi lần cần số dư phải cộng 1.000.000 dòng. Định kỳ lưu "tại offset 900.000, số dư = X": lần sau lấy snapshot + cộng **100.000** sự kiện còn lại. Giống dòng **"chuyển trang: số dư mang sang"** trong sổ tiết kiệm.' },
        { kind: 'video', scenes: ['compact'] },
        {
          kind: 'list',
          items: [
            { title: 'Compacted topic', text: '`cleanup.policy=compact` giữ lại **ít nhất bản mới nhất của mỗi key**. Ghi `acc-A → 410` rồi `acc-A → 600`: sau compaction chỉ còn 600. Hợp để lưu "trạng thái hiện tại của từng thực thể".' },
            { title: 'Xoá một key', text: 'Gửi **tombstone** (value = null). Tombstone chỉ được giữ một khoảng thời gian cấu hình được; consumer tắt lâu hơn khoảng đó sẽ không thấy tombstone, nên không biết key đã bị xoá. (📘 sách, ch.6)' },
            { title: 'Active segment', text: 'Compaction **không bao giờ** đụng segment đang ghi, nên consumer vẫn có thể đọc thấy bản cũ trong một thời gian.' },
            { title: 'Không thay được event log', text: 'Compaction **xoá các bản cũ của cùng key**: mất lịch sử từng bước. Event log cần giữ mọi sự kiện (retention dài hoặc vô hạn, không compact).' },
          ],
        },
        { kind: 'video', scenes: ['cqrs'] },
        {
          kind: 'code',
          code: `Lệnh "rút 120"  →  [Service Tài khoản]  →  topic account-events
                                               │
                     ┌─────────────────────────┼─────────────────────────┐
                     ▼                         ▼                         ▼
           consumer → bảng số dư      consumer → Elasticsearch   consumer → bảng báo cáo tháng
           (API "xem số dư")          (tìm kiếm giao dịch)       (dashboard kế toán)`,
        },
        { kind: 'callout', tone: 'warn', title: 'Cái giá của CQRS', text: 'Read model **trễ** so với lệnh (eventual consistency): người dùng vừa rút tiền, mở app ngay, có thể thấy số dư cũ trong vài trăm mili giây.' },
        {
          kind: 'callout',
          tone: 'info',
          title: 'Kafka có phải event store tốt?',
          text: 'Kafka phân phối sự kiện rất tốt, nhưng làm event store có hai điểm yếu: **không có ghi có điều kiện theo aggregate** (không thể "chỉ append nếu acc-A đang ở version 7"), và **không đọc nhanh được sự kiện của một aggregate** (phải quét cả partition). Nhiều hệ thống lưu sự kiện trong DB rồi dùng outbox/CDC đẩy sang Kafka. Sửa bug rồi tính lại an toàn: chạy bản mới như **consumer group mới** đọc từ đầu, ghi ra **topic kết quả mới**, đuổi kịp thì chuyển sang. (📘 sách, ch.14)',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Snapshot ở offset 5 ghi acc-B = 1000. Offset 6 là MoneyWithdrawn 400. Số dư hiện tại là bao nhiêu?', ['400', '600', '1000', '1400'], 1, '1000 − 400 = 600. Snapshot đã chứa sẵn kết quả cộng dồn offset 0 → 5, nên không cần đọc lại.'),
            q('Vì sao event sourcing cho phép sửa bug rồi tính lại?', ['Vì Kafka tự sửa dữ liệu', 'Vì sự kiện gốc còn nguyên, trạng thái chỉ là hàm của chúng', 'Vì có snapshot', 'Vì compacted topic giữ mọi bản'], 1, 'Mô hình chỉ lưu trạng thái đã ghi đè quá khứ, không còn đầu vào để tính lại.'),
            q('Vì sao compacted topic không thay được event log trong event sourcing?', ['Vì nó chậm hơn', 'Vì nó xoá các bản cũ của cùng key, mất lịch sử từng bước', 'Vì nó không có key', 'Vì nó không có offset'], 1, 'Event log cần giữ mọi sự kiện; compaction chỉ giữ trạng thái cuối.'),
          ],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: tải gọi API và replay log',
      blocks: [
        { kind: 'p', text: 'So notification với state transfer theo số service và tốc độ sự kiện, thử "sập" service Khách hàng. Sau đó replay log tài khoản với và không có snapshot để thấy số sự kiện phải cộng.' },
        { kind: 'widget', name: 'event-lab' },
      ],
    },
    {
      id: 'tom-tat-video',
      title: 'Nhìn lại cả bài',
      blocks: [{ kind: 'video', scenes: ['summary'] }],
    },
  ],
  finalQuiz: [
    q('10 service, mỗi service 1.000 sự kiện/giờ, kiểu notification. Số lần gọi API/giờ?', ['1.000', '10.000', '100', '0'], 1, 'Mỗi sự kiện kéo theo một lần gọi lại; ECST làm con số này về 0.'),
    q('Envelope tối thiểu gồm những trường nào?', ['key, value, offset', 'eventId, type, occurredAt, version', 'topic, partition, offset', 'userId, password'], 1, 'eventId chống trùng, type ở thì quá khứ, occurredAt là event time, version cho schema.'),
    q('Snapshot tại offset 900.000, log có 1.000.000 sự kiện. Cần cộng bao nhiêu sự kiện để ra số dư hiện tại?', ['1.000.000', '900.000', '100.000', '0'], 2, 'Lấy snapshot rồi cộng phần sau nó.'),
    q('Điểm yếu chính khi dùng Kafka làm event store?', ['Không lưu được lâu', 'Không có ghi có điều kiện theo aggregate (optimistic concurrency)', 'Không có thứ tự', 'Không có consumer'], 1, 'Hai lệnh rút song song có thể cùng thấy số dư 410 và cùng rút.'),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao đổi key của topic payments từ userId sang paymentId làm số dư có thể bị âm tạm thời?',
      keywords: ['partition', 'thứ tự', 'song song', 'key'],
      modelAnswer: 'Vì key khác thì hash khác, nên các giao dịch của cùng một user rơi vào nhiều partition. Consumer đọc các partition song song nên có thể xử lý lệnh rút trước lệnh nạp, dẫn đến số dư âm tạm thời và kiểm tra hạn mức sai. Giữ key = userId thì mọi giao dịch của user nằm cùng một partition, đúng thứ tự.',
    },
  ],
  recap: {
    journey:
      'Một sự kiện chỉ có id khiến 10 service gọi lại API → ECST đưa sẵn dữ liệu vào sự kiện → phong bì thống nhất eventId, type, version, occurredAt → key là id của thực thể cần giữ thứ tự → event sourcing lưu chuỗi sự kiện, trạng thái là kết quả replay → snapshot cắt ngắn replay → compacted topic giữ trạng thái mới nhất → CQRS dựng nhiều read model, chấp nhận trễ.',
    points: [
      { title: 'ECST vs notification', text: 'ECST giảm phụ thuộc lúc chạy, đổi lại dữ liệu to và nhân bản; notification thì ngược lại.' },
      { title: 'Envelope & key', text: 'eventId, type (thì quá khứ), occurredAt, version. Key = id của aggregate cần giữ thứ tự.' },
      { title: 'Event sourcing', text: 'Log là sự thật, trạng thái là kết quả replay. Snapshot cắt ngắn replay; compacted topic giữ trạng thái mới nhất nhưng không thay được log.' },
      { title: 'CQRS', text: 'Nhiều read model xây từ cùng một luồng sự kiện, chấp nhận trễ (eventual consistency).' },
    ],
    next: 'Retry, DLQ, Saga & khi nào không dùng Kafka',
  },
}
