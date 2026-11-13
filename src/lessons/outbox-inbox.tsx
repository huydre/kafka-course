import { cameraAt, clamp, move, sp, vis } from '../player/motion-kit'
import { ConsumerUnit, Envelope, Icon3D, Packets, Rise, SOFT, SOFT_PANEL, ServerUnit, SoftScene, SoftTheme, SummaryList, Wire } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene, SceneSfx } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { outboxInboxScript } from './outbox-inbox-script'

/** This lesson is drawn in the navy glow style. */
const INK = SOFT
const panel = SOFT_PANEL
const WIDE = { x: 960, y: 540, s: 1 }
/** Same wide shot nudged up so a one-row diagram sits lower in the frame. */
const LOW = { x: 960, y: 500, s: 1 }

/** Time at fraction p of beat k. */
const at = (c: Cue, k: number, p: number) => c.at(k) + (c.end(k) - c.at(k)) * p

const GREEN = 'linear-gradient(160deg, #9ff5cf 0%, #27d391 55%, #0e9a6c 100%)'
const RED = 'linear-gradient(160deg, #ff9aa5 0%, #ff4d60 55%, #b3202f 100%)'

/* ------------------------------------------------------------------ shared: Kafka tape */

const CH = 70
type Spec = { kind: 'data' | 'dup' | 'lost'; label?: string; at: number; ring?: boolean }

function Slot({ t, x, y, w, spec }: { t: number; x: number; y: number; w: number; spec: Spec }) {
  const k = sp(t, spec.at, 14, 140)
  if (k <= 0) return null
  const { kind } = spec
  const bg = kind === 'dup' ? RED : kind === 'lost' ? 'transparent' : INK.cell.filled
  const border = kind === 'lost' ? `3px dashed ${INK.bad}` : 'none'
  const shadow = kind === 'data' ? 'inset 0 2px 0 rgba(255,255,255,0.5), 0 0 14px rgba(77,141,255,0.35), 0 10px 20px rgba(0,8,50,0.45)' : kind === 'dup' ? 'inset 0 2px 0 rgba(255,255,255,0.6), 0 0 20px rgba(255,90,106,0.5)' : undefined
  const ring = spec.ring ? '0 0 0 4px #ffffff, 0 0 26px rgba(255,255,255,0.8)' : undefined
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: CH, padding: '0 3px', boxSizing: 'border-box', opacity: clamp(k * 1.6), transform: `scale(${0.85 + 0.15 * k})` }}>
      <div style={{ height: '100%', borderRadius: 14, boxSizing: 'border-box', background: bg, border, boxShadow: [shadow, ring].filter(Boolean).join(', ') || undefined, display: 'grid', placeItems: 'center', fontSize: 26, fontWeight: 800, color: kind === 'lost' ? INK.bad : '#fff' }}>{spec.label}</div>
    </div>
  )
}

/** A tape of `n` equal slots with optional cell specs, a title above and offset numbers below. */
function Tape({ t, x, y, cw, n, cells, title, base = 0, ticks = true }: { t: number; x: number; y: number; cw: number; n: number; cells: Record<number, Spec>; title?: string; base?: number; ticks?: boolean }) {
  return (
    <div>
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

/* ------------------------------------------------------------------ shared: database table card */

type DbCell = string | { t: string; c?: string }
type DbRow = { cells: DbCell[]; at: number; tone?: 'ok' | 'new' | 'bad' | 'good' | 'dead' }
const DH = 58
const DR = 66
const DHEAD = 40
const dbH = (slots: number, head: boolean) => DH + (head ? DHEAD : 0) + slots * DR + 14

function rowStyle(tone: DbRow['tone']) {
  if (tone === 'new') return { background: 'linear-gradient(160deg, #e6f0ff 0%, #9cc2ff 100%)', color: '#0a1f6b', border: '2px solid #ffffff', boxShadow: '0 0 22px rgba(255,255,255,0.7)' }
  if (tone === 'bad') return { background: RED, color: '#fff', border: '2px solid transparent', boxShadow: '0 0 20px rgba(255,90,106,0.5)' }
  if (tone === 'good') return { background: GREEN, color: '#04301f', border: '2px solid transparent', boxShadow: '0 0 20px rgba(62,230,160,0.45)' }
  if (tone === 'dead') return { background: 'transparent', color: INK.bad, border: `2px dashed ${INK.bad}`, boxShadow: 'none', textDecoration: 'line-through' }
  return { background: INK.cell.filled, color: '#fff', border: '2px solid transparent', boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.4), 0 8px 16px rgba(0,8,50,0.4)' }
}

/** A table as a glass card: title, optional column labels, `slots` row slots filled as rows appear. */
function Db({ t, x, y, w, title, slots, rows, cols, head, border }: { t: number; x: number; y: number; w: number; title: string; slots: number; rows: DbRow[]; cols: number[]; head?: string[]; border?: string }) {
  const top = DH + (head ? DHEAD : 0)
  const cell = (cl: DbCell) => (typeof cl === 'string' ? { t: cl, c: undefined } : cl)
  return (
    <div style={{ ...panel, left: x, top: y, width: w, height: dbH(slots, !!head), padding: 0, boxSizing: 'border-box', border: border ? `3px solid ${border}` : (panel.border as string), boxShadow: border ? `0 0 30px ${border}88, 0 24px 50px rgba(0,4,30,0.55)` : (panel.boxShadow as string) }}>
      <div style={{ height: DH, display: 'flex', alignItems: 'center', padding: '0 24px', fontSize: 28, fontWeight: 800, whiteSpace: 'nowrap' }}>{title}</div>
      {head && (
        <div style={{ position: 'absolute', left: 14, right: 14, top: DH, height: DHEAD, display: 'flex', alignItems: 'center', fontFamily: MONO, fontSize: 24, color: INK.faint }}>
          {head.map((h, i) => (
            <div key={i} style={{ flex: cols[i], padding: '0 12px', whiteSpace: 'nowrap' }}>
              {h}
            </div>
          ))}
        </div>
      )}
      {Array.from({ length: slots }, (_, i) => (
        <div key={i} style={{ position: 'absolute', left: 14, right: 14, top: top + i * DR, height: DR - 8, borderRadius: 12, background: INK.cell.empty, border: '1.5px solid rgba(110,160,255,0.3)' }} />
      ))}
      {rows.map((r, i) => {
        const k = sp(t, r.at, 14, 140)
        if (k <= 0) return null
        const st = rowStyle(r.tone)
        return (
          <div key={i} style={{ position: 'absolute', left: 14, right: 14, top: top + i * DR, height: DR - 8, boxSizing: 'border-box', borderRadius: 12, display: 'flex', alignItems: 'center', opacity: clamp(k * 1.6) * (r.tone === 'dead' ? 0.9 : 1), transform: `scale(${0.94 + 0.06 * k})`, fontFamily: MONO, fontSize: 24, fontWeight: 700, ...st }}>
            {r.cells.map((cl, j) => {
              const c = cell(cl)
              return (
                <div key={j} style={{ flex: cols[j], padding: '0 12px', whiteSpace: 'nowrap', color: c.c ?? st.color }}>
                  {c.t}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ shared: small pieces */

/** Small glowing pill. */
function Pill({ x, y, text, color = '#ffffff', o = 1, mono = false, size = 30, center = false }: { x: number; y: number; text: string; color?: string; o?: number; mono?: boolean; size?: number; center?: boolean }) {
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

const Glyph = ({ ok, color = '#fff' }: { ok: boolean; color?: string }) => (
  <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round">
    {ok ? <polyline points="5 13 10 18 19 7" /> : <path d="M6 6l12 12M18 6L6 18" />}
  </svg>
)

type StepState = 'active' | 'done' | 'fail'
/** One numbered step under a service: lights up while running, green when done, red when it fails. */
function Step({ x, y, text, state }: { x: number; y: number; text: string; state: StepState }) {
  const col = state === 'done' ? INK.good : state === 'fail' ? INK.bad : INK.warn
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: 310, height: 56, boxSizing: 'border-box', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 12, borderRadius: 999, background: 'rgba(8,22,82,0.92)', border: `1.5px solid ${col}`, boxShadow: `0 0 18px ${col}88`, fontSize: 26, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>
      {state === 'active' ? <span style={{ width: 14, height: 14, borderRadius: 7, background: col, boxShadow: `0 0 12px ${col}` }} /> : <Glyph ok={state === 'done'} color={col} />}
      {text}
    </div>
  )
}

/** A mono SQL line that appears at `from`; `bad` paints it red. */
const SqlLine = ({ t, from, text, color }: { t: number; from: number; text: string; color?: string }) => (
  <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, color: color ?? '#ffffff', whiteSpace: 'nowrap', opacity: vis(t, from, Infinity, 0.3), transform: `translateX(${(1 - vis(t, from, Infinity, 0.3)) * -16}px)`, height: 48, display: 'flex', alignItems: 'center' }}>{text}</div>
)

/* ------------------------------------------------------------------ 0. cold open: two writes, one crash */

function hook(t: number, c: Cue) {
  const [a2, a3] = [c.at(2), c.at(3)]
  const T = (k: number, p: number) => at(c, k, p)
  const dieAt = T(2, 0.15)
  const down = t >= dieAt
  const rowAt = T(1, 0.38)
  const rows: DbRow[] = [
    { cells: ['order-40', '180.000'], at: 0.7 },
    { cells: ['order-41', '250.000'], at: 0.9 },
    { cells: ['order-42', '320.000'], at: rowAt, tone: t >= T(3, 0.72) ? 'bad' : t >= rowAt + 1.2 ? 'ok' : 'new' },
  ]
  const tape: Record<number, Spec> = {
    0: { kind: 'data', label: '40', at: 1.0 },
    1: { kind: 'data', label: '41', at: 1.15 },
    2: { kind: 'lost', label: '42', at: T(3, 0.1) },
  }
  const S = { x: 110, y: 430 }
  const step1: StepState = t < rowAt + 0.2 ? 'active' : 'done'
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a2, { x: 940, y: 520, s: 1.06 }, 1.3], [a3 + 0.4, WIDE, 1.3]])}>
      <Rise t={t} at={0.2}>
        <ServerUnit x={S.x} y={S.y} name="order-service" t={t} down={down} />
      </Rise>
      <Rise t={t} at={0.5}>
        <Db t={t} x={620} y={230} w={560} title="database · orders" slots={3} rows={rows} cols={[1.2, 1]} />
      </Rise>
      <Rise t={t} at={0.8}>
        <Tape t={t} x={700} y={770} cw={90} n={6} cells={tape} title="Kafka · orders" base={40} />
      </Rise>
      <Rise t={t} at={1.1}>
        <ConsumerUnit x={1360} y={741} w={420} name="kho-service" t={t} busy={t >= T(3, 0.32) ? undefined : (t * 1.1) % 1} accent={t >= T(3, 0.32) ? INK.warn : undefined} note={t >= T(3, 0.32) ? 'chờ mãi' : undefined} />
      </Rise>
      <Wire from={{ x: 372, y: 480 }} to={{ x: 606, y: 380 }} color={INK.line} p={move(t, 1.2, 0.5)} flow={t} />
      <Wire from={{ x: 372, y: 520 }} to={{ x: 686, y: 805 }} color={INK.line} p={move(t, 1.4, 0.5)} flow={t} />
      <Wire from={{ x: 1244, y: 805 }} to={{ x: 1346, y: 800 }} color={INK.line} p={move(t, 1.5, 0.4)} flow={t} />
      <Packets t={t} from={{ x: 1244, y: 805 }} to={{ x: 1346, y: 800 }} start={1.8} end={T(3, 0.3)} every={0.7} len={0.6} size={18} />
      <Envelope t={t} at={T(0, 0.5)} from={{ x: 110, y: 330 }} to={{ x: 240, y: 430 }} label="đơn mới" color={INK.accent} len={0.9} arc={20} />
      <Rise t={t} at={T(1, 0.04)}>
        <Step x={110} y={620} text="ghi database" state={step1} />
      </Rise>
      <Packets t={t} from={{ x: 372, y: 480 }} to={{ x: 606, y: 380 }} start={T(1, 0.1)} end={rowAt - 0.4} every={0.3} len={0.7} size={18} />
      <Rise t={t} at={T(1, 0.58)}>
        <Step x={110} y={696} text="gửi Kafka" state={down ? 'fail' : 'active'} />
      </Rise>
      <Envelope t={t} at={T(1, 0.8)} from={{ x: 372, y: 530 }} to={{ x: 520, y: 670 }} label="OrderPlaced" color={INK.warn} len={1.0} arc={0} />
      {down && <Icon3D name="fire" x={240} y={340} size={160} t={t} at={dieAt} />}
      {t >= T(2, 0.55) && t < a3 && <Caption y={950} text="chết giữa hai việc" color={INK.bad} o={sp(t, T(2, 0.55))} />}
      {t >= T(3, 0.55) && <Caption y={950} text="database có đơn · Kafka không có" color={INK.bad} o={sp(t, T(3, 0.55))} />}
      {t >= T(3, 0.74) && <Pill x={1210} y={418} text="đơn ma" color={INK.bad} o={sp(t, T(3, 0.74))} />}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 1. the dual-write problem */

function dualwrite(t: number, c: Cue) {
  const [a1, a2, a3] = [c.at(1), c.at(2), c.at(3)]
  const T = (k: number, p: number) => at(c, k, p)
  const YA = 270
  const YB = 500
  // lane A: database first, Kafka second, crash between
  const aRow = T(1, 0.12)
  const aFire = T(1, 0.62)
  const aLost = T(1, 0.76)
  const aRes = T(1, 0.88)
  // lane B: Kafka first, database second, rollback
  const bCell = T(2, 0.14)
  const offA = (1 - move(t, a2 - 0.35, 0.9)) * 150
  const bRow = T(2, 0.38)
  const bDead = T(2, 0.62)
  const bRes = T(2, 0.82)
  const laneA: Record<number, Spec> = { 0: { kind: 'lost', label: '42', at: aLost } }
  const laneB: Record<number, Spec> = { 0: { kind: 'data', label: '42', at: bCell } }
  const chip = (x: number, w: number, text: string, from: number, color?: string) => (
    <Rise t={t} at={from}>
      <div style={{ ...panel, left: x, top: 730, width: w, height: 84, boxSizing: 'border-box', display: 'grid', placeItems: 'center', fontSize: 34, fontWeight: 800, color: color ?? '#fff', whiteSpace: 'nowrap', borderColor: color }}>{text}</div>
    </Rise>
  )
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 440, s: 1.06 }, 1.3], [a3, WIDE, 1.3]])} title={{ kicker: 'GHI KÉP', text: 'Hai hệ thống, một khe hở', until: a1 + 1 }}>
      {/* lane A */}
      <div style={{ transform: `translateY(${offA}px)` }}>
      <Rise t={t} at={T(0, 0.4)}>
        <Db t={t} x={110} y={YA} w={400} title="bước 1 · database" slots={1} rows={[{ cells: ['order-42'], at: aRow, tone: t >= aRes ? 'good' : 'ok' }]} cols={[1]} />
      </Rise>
      <Rise t={t} at={T(0, 0.5)}>
        <Tape t={t} x={1040} y={YA + 35} cw={90} n={4} cells={laneA} title="bước 2 · Kafka" ticks={false} />
      </Rise>
      <Wire from={{ x: 524, y: YA + 70 }} to={{ x: 1026, y: YA + 70 }} color={INK.line} p={move(t, T(0, 0.6), 0.5)} dashed />
      <Rise t={t} at={T(0, 0.66)}>
        <Pill x={775} y={YA + 4} text="không có giao dịch chung" color={INK.warn} center o={vis(t, T(0, 0.66), T(1, 0.14), 0.3)} />
      </Rise>
      <Packets t={t} from={{ x: 524, y: YA + 70 }} to={{ x: 775, y: YA + 70 }} start={T(1, 0.42)} end={aFire - 0.5} every={0.35} len={0.7} size={18} />
      {t >= aFire && <Icon3D name="fire" x={775} y={YA + 66} size={120} t={t} at={aFire} />}
      {t >= aRes && <Pill x={1480} y={YA + 48} text="đơn ma" color={INK.bad} size={34} o={sp(t, aRes)} />}
      </div>
      {/* lane B */}
      <Rise t={t} at={a2 + 0.5}>
        <Tape t={t} x={110} y={YB + 35} cw={90} n={4} cells={laneB} title="bước 1 · Kafka" ticks={false} />
      </Rise>
      <Rise t={t} at={T(2, 0.26)}>
        <Db t={t} x={1040} y={YB} w={400} title="bước 2 · database" slots={1} rows={[{ cells: ['order-42'], at: bRow, tone: t >= bDead ? 'dead' : 'ok' }]} cols={[1]} />
      </Rise>
      <Wire from={{ x: 484, y: YB + 70 }} to={{ x: 1026, y: YB + 70 }} color={INK.line} p={move(t, T(2, 0.2), 0.5)} dashed />
      <Packets t={t} from={{ x: 484, y: YB + 70 }} to={{ x: 1026, y: YB + 70 }} start={T(2, 0.28)} end={bRow - 0.4} every={0.35} len={0.7} size={18} />
      {t >= bDead && <Icon3D name="trash-can" x={775} y={YB + 66} size={120} t={t} at={bDead} />}
      {t >= bRes && <Pill x={1480} y={YB + 48} text="sự kiện ma" color={INK.bad} size={34} o={sp(t, bRes)} />}
      {/* the numbers */}
      {chip(220, 400, '1.000 đơn / ngày', T(3, 0.04))}
      {chip(680, 400, '× 1% gặp sự cố', T(3, 0.34))}
      {chip(1140, 560, '≈ 10 đơn sai mỗi ngày', T(3, 0.64), INK.bad)}
      {/* the gap */}
      {[YA, YB].map((y, i) => (
        <div key={y} style={{ opacity: vis(t, T(4, 0.05 + i * 0.12)) }}>
          <div style={{ position: 'absolute', left: 546, top: y - 30, width: 460, height: 200, boxSizing: 'border-box', borderRadius: 26, border: `3px dashed ${INK.bad}`, background: 'rgba(255,90,106,0.07)' }} />
          <Pill x={776} y={y - 55} text="khe hở" color={INK.bad} center />
        </div>
      ))}
      {t >= T(4, 0.45) && <Pill x={260} y={860} text="đổi thứ tự: không chữa được" color={INK.warn} size={30} o={sp(t, T(4, 0.45))} />}
      {t >= T(4, 0.72) && <Pill x={1010} y={860} text="thử lại: tiến trình đã chết" color={INK.warn} size={30} o={sp(t, T(4, 0.72))} />}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 2. transactional outbox */

function outbox(t: number, c: Cue) {
  const [a1, a2, a3, a4] = [c.at(1), c.at(2), c.at(3), c.at(4)]
  const T = (k: number, p: number) => at(c, k, p)
  const wireO = vis(t, T(0, 0.4), T(0, 0.97), 0.35)
  const txAt = a2 + 0.1
  const commitAt = T(3, 0.05)
  const rbAt = T(3, 0.5)
  const rbEnd = T(3, 0.92)
  const rollback = t >= rbAt && t < rbEnd
  const committed = t >= commitAt && !rollback && t < a4
  const frameCol = rollback ? INK.bad : committed ? INK.good : t >= txAt ? INK.accent : '#6ea2ff'
  const frameText = t >= a4 ? '1 lần ghi nguyên tử' : rollback ? 'ROLLBACK' : committed ? 'COMMIT' : t >= txAt ? 'BEGIN … COMMIT' : 'PostgreSQL'
  const rowTone = (base: DbRow['tone']): DbRow['tone'] => (rollback ? 'dead' : base)
  const ordersRows: DbRow[] = [
    { cells: ['order-41', '250.000'], at: T(1, 0.2) },
    { cells: ['order-42', '320.000'], at: T(2, 0.38), tone: rowTone(t >= T(3, 0.1) ? 'ok' : 'new') },
  ]
  const outRows: DbRow[] = [{ cells: ['9f1c', 'OrderPlaced', 'order-42'], at: T(2, 0.72), tone: rowTone(t >= T(3, 0.1) ? 'ok' : 'new') }]
  const tape: Record<number, Spec> = { 0: { kind: 'data', label: '42', at: T(4, 0.5) } }
  const chipFade = vis(t, a3, T(3, 0.95), 0.4)
  const verdict = (y: number, name: 'tick' | 'trash-can', title: string, sub: string, col: string, from: number) => (
    <Rise t={t} at={from}>
      <div style={{ ...panel, left: 1290, top: y, width: 500, height: 130, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 20, padding: '0 26px', borderColor: col, opacity: chipFade }}>
        <div style={{ width: 100, height: 100, flex: 'none', position: 'relative' }}>
          <Icon3D name={name} x={50} y={50} size={100} t={t} at={from} />
        </div>
        <div>
          <div style={{ fontSize: 36, fontWeight: 800, color: col }}>{title}</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#dbe6ff' }}>{sub}</div>
        </div>
      </div>
    </Rise>
  )
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a2, { x: 950, y: 500, s: 1.05 }, 1.3], [a4, WIDE, 1.3]])} title={{ kicker: 'OUTBOX', text: 'Ghi một lần, chép sau', until: a1 + 1 }}>
      <Rise t={t} at={0.3}>
        <ServerUnit x={110} y={480} name="order-service" t={t} />
      </Rise>
      <Rise t={t} at={0.6}>
        <Tape t={t} x={1290} y={330} cw={100} n={5} cells={tape} title="Kafka · orders" ticks={false} />
      </Rise>
      <Envelope t={t} at={T(0, 0.4)} from={{ x: 110, y: 380 }} to={{ x: 240, y: 480 }} label="đơn mới" color={INK.accent} len={0.9} arc={20} />
      <div style={{ opacity: wireO }}>
        <Wire from={{ x: 372, y: 520 }} to={{ x: 1276, y: 366 }} color={INK.bad} p={move(t, T(0, 0.4), 0.5)} dashed />
        <Rise t={t} at={T(0, 0.62)}>
          <Pill x={824} y={418} text="không gửi ở đây" color={INK.bad} center />
        </Rise>
      </div>
      {/* the database frame */}
      <div style={{ opacity: vis(t, a1 + 0.1) }}>
        <div style={{ position: 'absolute', left: 490, top: 220, width: 730, height: 600, boxSizing: 'border-box', borderRadius: 36, border: `3px ${t >= txAt ? 'dashed' : 'solid'} ${frameCol}`, background: 'rgba(30,70,190,0.10)', boxShadow: `0 0 34px ${frameCol}55, inset 0 0 40px ${frameCol}18` }} />
        <Pill x={520} y={236} text={frameText} color={frameCol} />
      </div>
      <Rise t={t} at={a1 + 0.35}>
        <Db t={t} x={530} y={310} w={650} title="orders" slots={2} rows={ordersRows} cols={[1, 1]} head={['id', 'total']} />
      </Rise>
      <Rise t={t} at={a1 + 0.95}>
        <Db t={t} x={530} y={590} w={650} title="outbox" slots={1} rows={outRows} cols={[0.7, 1.5, 1.2]} head={['id', 'type', 'aggregateid']} border={t >= a1 + 1.1 && t < a2 ? INK.accent : undefined} />
      </Rise>
      <Packets t={t} from={{ x: 372, y: 520 }} to={{ x: 516, y: 650 }} start={T(1, 0.62)} end={T(1, 0.95)} every={0.4} len={0.7} size={18} />
      <Packets t={t} from={{ x: 372, y: 500 }} to={{ x: 516, y: 400 }} start={T(2, 0.2)} end={T(2, 0.34)} every={0.3} len={0.7} size={18} />
      <Packets t={t} from={{ x: 372, y: 520 }} to={{ x: 516, y: 650 }} start={T(2, 0.54)} end={T(2, 0.68)} every={0.3} len={0.7} size={18} />
      {t >= commitAt && t < T(3, 0.95) && verdict(545, 'tick', 'COMMIT', 'cả hai cùng có', INK.good, commitAt)}
      {t >= rbAt && t < T(3, 0.95) && verdict(690, 'trash-can', 'ROLLBACK', 'cả hai cùng không có', INK.bad, rbAt)}
      {/* the relay copies the outbox row to Kafka later */}
      <Wire from={{ x: 1196, y: 650 }} to={{ x: 1336, y: 424 }} color={INK.line} p={move(t, T(4, 0.1), 0.5)} dashed />
      <Packets t={t} from={{ x: 1196, y: 650 }} to={{ x: 1336, y: 426 }} start={T(4, 0.2)} end={T(4, 0.62)} every={0.45} len={0.9} size={18} />
      {t >= T(4, 0.7) && <Pill x={1540} y={560} text="chép lại · làm lại được" color={INK.good} center o={sp(t, T(4, 0.7))} />}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 3. polling publisher */

function polling(t: number, c: Cue) {
  const [a0, a1, a2, a3, a4] = [c.at(0), c.at(1), c.at(2), c.at(3), c.at(4)]
  const T = (k: number, p: number) => at(c, k, p)
  const readA = T(0, 0.78)
  const sendBase = T(1, 0.1)
  const sent1 = T(2, 0.1)
  const sent2 = T(2, 0.4)
  const sent3 = T(2, 0.7)
  const r4 = T(3, 0.0)
  const crashAt = T(3, 0.25)
  const upAt = T(3, 0.62)
  const down = t >= crashAt && t < upAt
  const reading = t >= readA - 1.0 && t < a1
  const sentCell = (at1: number): DbCell => (t >= at1 ? { t: 'true', c: '#04301f' } : 'false')
  const tone = (at1: number): DbRow['tone'] => (t >= at1 ? 'good' : reading ? 'new' : 'ok')
  const rows: DbRow[] = [
    { cells: ['9f1c', 'OrderPlaced', 'order-42', sentCell(sent1)], at: 0.7, tone: tone(sent1) },
    { cells: ['a02e', 'OrderPlaced', 'order-43', sentCell(sent2)], at: 0.9, tone: tone(sent2) },
    { cells: ['b77d', 'OrderPlaced', 'order-44', sentCell(sent3)], at: 1.1, tone: tone(sent3) },
    { cells: ['c4a9', 'OrderPlaced', 'order-45', 'false'], at: r4, tone: t >= r4 + 1.2 ? 'ok' : 'new' },
  ]
  const tape: Record<number, Spec> = {
    0: { kind: 'data', label: '42', at: T(1, 0.2) },
    1: { kind: 'data', label: '43', at: T(1, 0.46) },
    2: { kind: 'data', label: '44', at: T(1, 0.72) },
    3: { kind: 'data', label: '45', at: T(3, 0.2) },
    4: { kind: 'dup', label: '45', at: T(3, 0.82), ring: t >= T(4, 0.1) },
  }
  const P1 = { x: 722, y: 480 }
  const P2 = { x: 806, y: 480 }
  const P3 = { x: 1204, y: 480 }
  const P4 = { x: 1276, y: 480 }
  const pollerUp = t >= upAt ? INK.warn : undefined
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, LOW], [a3, { x: 980, y: 560, s: 1.06 }, 1.3], [a4, LOW, 1.3]])} title={{ kicker: 'POLLING', text: 'Người chép thư', until: a0 + 1 }}>
      <Rise t={t} at={0.4}>
        <Db t={t} x={110} y={292} w={610} title="outbox" slots={4} rows={rows} cols={[0.7, 1.5, 1.25, 0.85]} head={['id', 'type', 'aggregateid', 'sent']} />
      </Rise>
      <Rise t={t} at={T(0, 0.28)}>
        <ConsumerUnit x={820} y={421} w={380} name="polling publisher" t={t} down={down} accent={pollerUp} busy={down ? undefined : (t * 0.9) % 1} />
      </Rise>
      <Rise t={t} at={T(1, 0.0) - 0.8}>
        <Tape t={t} x={1290} y={445} cw={85} n={6} cells={tape} title="Kafka · orders" />
      </Rise>
      <Wire from={P1} to={P2} color={INK.line} p={move(t, T(0, 0.5), 0.4)} flow={t} />
      <Wire from={P3} to={P4} color={INK.line} p={move(t, T(0, 0.6), 0.4)} flow={t} />
      {/* timer and query */}
      {t < a2 && (
        <div style={{ opacity: vis(t, 0, a2 - 0.8, 0.35) }}>
          <Icon3D name="clock" x={940} y={330} size={110} t={t} at={T(0, 0.32)} />
        </div>
      )}
      {t < a2 && <Pill x={1010} y={306} text="mỗi 1 giây" color={INK.accent} o={vis(t, T(0, 0.4), a2 - 0.8, 0.3)} />}
      <div style={{ opacity: vis(t, T(0, 0.55), T(3, 0.86), 0.35) }}>
        <div style={{ ...panel, left: 330, top: 770, width: 1260, height: 184, boxSizing: 'border-box', padding: '12px 32px' }}>
          <SqlLine t={t} from={T(0, 0.55)} text="rows = SELECT … WHERE sent = false LIMIT 100" />
          <SqlLine t={t} from={T(1, 0.05)} text="for r in rows: send(Kafka, key = r.aggregateid, r)" />
          <SqlLine t={t} from={T(2, 0.05)} text="UPDATE outbox SET sent = true WHERE id = r.id" color={t >= crashAt && t < upAt ? INK.bad : undefined} />
        </div>
      </div>
      {/* reading, sending */}
      <Packets t={t} from={P1} to={P2} start={readA} end={a1 - 0.4} every={0.4} len={0.6} size={18} />
      <Packets t={t} from={P3} to={P4} start={sendBase} end={T(1, 0.82)} every={0.55} len={0.6} size={18} />
      <Packets t={t} from={P1} to={P2} start={r4 + 0.1} end={r4 + 0.5} every={0.4} len={0.6} size={18} color={INK.warn} />
      <Packets t={t} from={P3} to={P4} start={T(3, 0.1)} end={T(3, 0.19)} every={0.4} len={0.6} size={18} color={INK.warn} />
      {t >= upAt && (
        <>
          <Packets t={t} from={P1} to={P2} start={upAt + 0.2} end={upAt + 0.7} every={0.4} len={0.6} size={18} color={INK.warn} />
          <Packets t={t} from={P3} to={P4} start={upAt + 0.9} end={upAt + 1.3} every={0.4} len={0.6} size={18} color={INK.warn} />
        </>
      )}
      {t >= T(1, 0.4) && t < a2 && <Pill x={1545} y={582} text="key = aggregateid" color={INK.accent} center o={vis(t, T(1, 0.4), a2 - 0.8, 0.3)} />}
      {down && <Icon3D name="fire" x={1010} y={330} size={140} t={t} at={crashAt} />}
      {t >= T(3, 0.3) && t < upAt + 0.8 && <Pill x={110} y={692} text="chưa kịp đánh dấu sent" color="#ff8a96" size={32} o={sp(t, T(3, 0.3))} />}
      {t >= upAt && <Pill x={1010} y={640} text="khởi động lại · gửi lại" color={INK.warn} center o={sp(t, upAt)} />}
      {t >= T(3, 0.86) && <Pill x={1290 + 4.5 * 85} y={560} text="trùng" color={INK.bad} center o={sp(t, T(3, 0.86))} />}
      {t >= T(4, 0.08) && <Caption y={800} text="at-least-once, không phải exactly-once" color={INK.warn} o={sp(t, T(4, 0.08))} />}
      {t >= T(4, 0.56) && <Pill x={960} y={900} text="consumer phải tự chống trùng" color={INK.good} size={30} center o={sp(t, T(4, 0.56))} />}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 4. CDC with Debezium */

function cdc(t: number, c: Cue) {
  const [a1, a2, a3] = [c.at(1), c.at(2), c.at(3)]
  const T = (k: number, p: number) => at(c, k, p)
  const Y = 437
  const rows: DbRow[] = [
    { cells: ['orders', 'order-41'], at: 0.8 },
    { cells: ['orders', 'order-42'], at: T(1, 0.28), tone: t >= T(1, 0.6) ? 'ok' : 'new' },
    { cells: ['outbox', '9f1c'], at: T(1, 0.52), tone: t >= T(1, 0.9) ? 'ok' : 'new' },
  ]
  const wal: Record<number, Spec> = {
    0: { kind: 'data', label: '+1', at: T(1, 0.4) },
    1: { kind: 'data', label: '+2', at: T(1, 0.64), ring: t >= T(2, 0.08) && t < T(2, 0.5) },
  }
  const kafka: Record<number, Spec> = {
    0: { kind: 'data', label: '42', at: T(2, 0.78) },
    1: { kind: 'dup', label: '42', at: T(4, 0.62) },
  }
  const replay = t >= T(4, 0.1) && t < T(4, 0.7)
  const dbRows = rows.slice(0, 3)
  const poll = clamp(0.62 + 0.28 * Math.abs(Math.sin(t * 4.2)))
  const cdcBar = 0.07 + 0.015 * Math.sin(t * 3)
  const barAt = T(3, 0.04)
  const bar = (y: number, label: string, v: number, col: string, from: number) => (
    <div style={{ opacity: vis(t, from) }}>
      <div style={{ position: 'absolute', left: 420, top: y, width: 330, fontSize: 28, fontWeight: 700, color: col, whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ position: 'absolute', left: 770, top: y + 2, width: 680, height: 36, borderRadius: 18, background: 'rgba(12,30,96,0.7)', border: '1.5px solid rgba(110,160,255,0.35)' }} />
      <div style={{ position: 'absolute', left: 770, top: y + 2, width: 680 * clamp(v), height: 36, borderRadius: 18, background: col, boxShadow: `0 0 18px ${col}` }} />
    </div>
  )
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, LOW], [a2, { x: 960, y: 560, s: 1.05 }, 1.3], [a3, LOW, 1.3]])} title={{ kicker: 'CDC', text: 'Đọc nhật ký của database', until: a1 + 1 }}>
      <Rise t={t} at={0.4}>
        <Db t={t} x={110} y={370} w={360} title="PostgreSQL" slots={3} rows={dbRows} cols={[1, 1.3]} />
      </Rise>
      <Rise t={t} at={T(0, 0.45)}>
        <ConsumerUnit x={940} y={413} w={320} name="Debezium" t={t} busy={t >= T(2, 0.1) ? (t * 0.9) % 1 : undefined} accent={replay || (t >= T(4, 0.1) && t < T(4, 0.9)) ? INK.warn : undefined} />
      </Rise>
      <Rise t={t} at={T(0, 0.7)}>
        <Tape t={t} x={1340} y={Y} cw={100} n={4} cells={kafka} title="Kafka · orders" ticks={false} />
      </Rise>
      <Wire from={{ x: 1264, y: 472 }} to={{ x: 1326, y: 472 }} color={INK.line} p={move(t, T(0, 0.8), 0.4)} flow={t} />
      <Rise t={t} at={T(0, 0.9)}>
        <Pill x={1100} y={560} text="Kafka Connect" color={INK.accent} center />
      </Rise>
      <Rise t={t} at={a1 + 0.15}>
        <Tape t={t} x={540} y={Y} cw={80} n={4} cells={wal} title="WAL · binlog" ticks={false} />
      </Rise>
      <Wire from={{ x: 474, y: 472 }} to={{ x: 536, y: 472 }} color={INK.line} p={move(t, a1 + 0.4, 0.4)} flow={t} />
      <Wire from={{ x: 864, y: 472 }} to={{ x: 926, y: 472 }} color={INK.line} p={move(t, T(2, 0.0), 0.4)} flow={t} />
      <Packets t={t} from={{ x: 474, y: 472 }} to={{ x: 536, y: 472 }} start={T(1, 0.3)} end={T(1, 0.38)} every={0.3} len={0.5} size={18} />
      <Packets t={t} from={{ x: 474, y: 472 }} to={{ x: 536, y: 472 }} start={T(1, 0.54)} end={T(1, 0.62)} every={0.3} len={0.5} size={18} />
      <Packets t={t} from={{ x: 864, y: 472 }} to={{ x: 926, y: 472 }} start={T(2, 0.12)} end={T(2, 0.45)} every={0.4} len={0.5} size={18} />
      <Packets t={t} from={{ x: 1264, y: 472 }} to={{ x: 1326, y: 472 }} start={T(2, 0.5)} end={T(2, 0.74)} every={0.35} len={0.5} size={18} />
      {t >= T(4, 0.1) && (
        <>
          <Packets t={t} from={{ x: 864, y: 472 }} to={{ x: 926, y: 472 }} start={T(4, 0.1)} end={T(4, 0.98)} every={0.6} len={0.5} size={18} color={INK.warn} />
          <Packets t={t} from={{ x: 1264, y: 472 }} to={{ x: 1326, y: 472 }} start={T(4, 0.2)} end={T(4, 0.98)} every={0.6} len={0.5} size={18} color={INK.warn} />
        </>
      )}
      {/* what the log and the router carry */}
      {t >= T(1, 0.78) && t < T(2, 0.92) && <Pill x={700} y={790} text="INSERT outbox (id=9f1c, key=order-42)" mono size={24} center o={vis(t, T(1, 0.78), T(2, 0.9), 0.35)} />}
      {t >= T(2, 0.62) && t < T(2, 0.96) + 0.3 && <Pill x={1500} y={790} text="topic outbox.event.order · key order-42" size={26} center o={vis(t, T(2, 0.62), T(2, 0.92), 0.35)} />}
      {/* load comparison */}
      <Rise t={t} at={barAt}>
        <div style={{ ...panel, left: 380, top: 745, width: 1140, height: 190, boxSizing: 'border-box' }} />
      </Rise>
      {bar(770, 'polling · SELECT lặp lại', poll, INK.warn, T(3, 0.12))}
      {bar(850, 'CDC · đọc nhật ký', cdcBar, INK.good, T(3, 0.4))}
      {t >= T(3, 0.72) && t < T(4, 0.0) && <Pill x={1330} y={660} text="gần như không tải" color={INK.good} center o={vis(t, T(3, 0.72), T(3, 0.97), 0.3)} />}
      {t >= T(4, 0.12) && t < T(4, 0.95) && <Pill x={1100} y={655} text="khởi động lại · đọc lại log" color={INK.warn} center o={vis(t, T(4, 0.12), T(4, 0.96), 0.3)} />}
      {t >= T(4, 0.66) && <Pill x={1340 + 1.5 * 100} y={523} text="tin trùng" color={INK.bad} center o={sp(t, T(4, 0.66))} />}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 5. inbox */

function inbox(t: number, c: Cue) {
  const [a2, a3, a4] = [c.at(2), c.at(3), c.at(4)]
  const T = (k: number, p: number) => at(c, k, p)
  const TY = 400
  const TX = 110
  const CW = 80
  // naive deliveries of p3
  const d1 = T(1, 0.08)
  const d2 = T(1, 0.5)
  const bal1 = t >= d2 + 0.9 ? '700.000' : t >= d1 + 0.9 ? '600.000' : '500.000'
  const bal1Tone: DbRow['tone'] = t >= d2 + 0.9 ? 'bad' : t >= d1 + 0.9 ? 'new' : 'ok'
  // inbox deliveries of p4
  const e1 = T(2, 0.32)
  const e2 = a3 + 0.05
  const insertAt = T(2, 0.6)
  const updateAt = T(2, 0.78)
  const commitAt = T(2, 0.94)
  const dupAt = T(3, 0.2)
  const rollbackAt = T(3, 0.36)
  const second = t >= a3
  const bal2 = t >= updateAt + 0.4 ? '600.000' : '500.000'
  const tape: Record<number, Spec> = {
    0: { kind: 'data', label: 'p1', at: 0.9 },
    1: { kind: 'data', label: 'p2', at: 1.1 },
    2: { kind: 'data', label: 'p3', at: T(0, 0.38) },
    3: { kind: 'dup', label: 'p3', at: T(0, 0.72) },
    4: { kind: 'data', label: 'p4', at: e1 - 0.5, ring: t >= T(4, 0.1) },
    5: { kind: 'dup', label: 'p4', at: e2 - 0.5, ring: t >= T(4, 0.44) },
  }
  const walletRows: DbRow[] = [
    { cells: [t >= a2 + 0.3 ? 'user-1 · sai' : 'user-1', { t: bal1, c: t >= a2 + 0.3 ? INK.bad : bal1Tone === 'bad' ? '#ffffff' : undefined }], at: 1.5, tone: t >= a2 + 0.3 ? 'dead' : bal1Tone },
    { cells: ['user-2', bal2], at: T(2, 0.1), tone: t >= updateAt + 0.4 && t < commitAt + 1.2 ? 'new' : 'ok' },
  ]
  const inboxRows: DbRow[] = [
    { cells: ['p3'], at: T(2, 0.2) },
    { cells: ['p4'], at: insertAt, tone: t >= dupAt ? (t >= rollbackAt ? 'good' : 'bad') : t >= commitAt + 0.8 ? 'ok' : 'new' },
  ]
  const txCol = t >= rollbackAt ? INK.bad : t >= commitAt && !second ? INK.good : INK.accent
  const frameOn = t >= a2 + 0.2
  const sqlBad = t >= dupAt
  const inChip = (x: number, w: number, text: string, from: number, col?: string) => (
    <div style={{ opacity: vis(t, from, a2 + 0.05, 0.4) }}>
      <div style={{ ...panel, left: x, top: 700, width: w, height: 84, boxSizing: 'border-box', display: 'grid', placeItems: 'center', fontSize: 32, fontWeight: 800, color: col ?? '#fff', whiteSpace: 'nowrap', borderColor: col }}>{text}</div>
    </div>
  )
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a3, { x: 960, y: 560, s: 1.05 }, 1.3], [a4, WIDE, 1.3]])} title={{ kicker: 'INBOX', text: 'Sổ ký nhận', until: c.at(0) + 1 }}>
      <Rise t={t} at={0.4}>
        <Tape t={t} x={TX} y={TY} cw={CW} n={6} cells={tape} title="wallet-events" />
      </Rise>
      <Rise t={t} at={0.9}>
        <ConsumerUnit x={660} y={376} w={400} name="wallet-service" t={t} busy={(t * 1.1) % 1} />
      </Rise>
      <Rise t={t} at={1.3}>
        <Db t={t} x={1160} y={295} w={620} title="wallets" slots={2} rows={walletRows} cols={[1, 1]} head={['user', 'balance']} />
      </Rise>
      <Wire from={{ x: 596, y: 435 }} to={{ x: 646, y: 435 }} color={INK.line} p={move(t, 1.2, 0.4)} flow={t} />
      <Wire from={{ x: 1064, y: 435 }} to={{ x: 1146, y: 400 }} color={INK.line} p={move(t, 1.5, 0.4)} flow={t} />
      <Packets t={t} from={{ x: 596, y: 435 }} to={{ x: 646, y: 435 }} start={T(0, 0.5)} end={T(0, 0.95)} every={0.5} len={0.5} size={18} />
      <Packets t={t} from={{ x: 1064, y: 435 }} to={{ x: 1146, y: 400 }} start={d1 + 0.5} end={d1 + 0.8} every={0.3} len={0.5} size={18} />
      <Packets t={t} from={{ x: 1064, y: 435 }} to={{ x: 1146, y: 400 }} start={d2 + 0.5} end={d2 + 0.8} every={0.3} len={0.5} size={18} />
      <Envelope t={t} at={d1} from={{ x: TX + 2.5 * CW, y: 372 }} to={{ x: 860, y: 318 }} label="p3 · +100.000" color={INK.warn} len={0.8} arc={20} />
      <Envelope t={t} at={d2} from={{ x: TX + 3.5 * CW, y: 372 }} to={{ x: 860, y: 318 }} label="p3 · +100.000" color={INK.bad} len={0.8} arc={20} />
      <div style={{ opacity: vis(t, T(0, 0.34), T(0, 0.97), 0.4) }}>
        <div style={{ ...panel, left: 110, top: 690, width: 930, height: 150, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 24, padding: '0 30px' }}>
          <div style={{ width: 110, height: 110, flex: 'none', position: 'relative' }}>
            <Icon3D name="money-bag" x={55} y={55} size={110} t={t} at={T(0, 0.34)} />
          </div>
          <div>
            <div style={{ fontSize: 36, fontWeight: 800 }}>sự kiện p3: nạp 100.000</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: t >= T(0, 0.72) ? INK.bad : INK.faint }}>{t >= T(0, 0.72) ? 'giao lần hai: cùng mã p3' : 'giao lần một'}</div>
          </div>
        </div>
      </div>
      {/* naive arithmetic */}
      {inChip(110, 280, '+100.000', d1 + 0.5)}
      {inChip(420, 280, '+100.000', d2 + 0.4)}
      {inChip(730, 480, '= +200.000 · sai 100.000', T(1, 0.82), INK.bad)}
      {/* inbox, same transaction */}
      {frameOn && (
        <div style={{ opacity: vis(t, a2 + 0.2) }}>
          <div style={{ position: 'absolute', left: 1130, top: 225, width: 680, height: 640, boxSizing: 'border-box', borderRadius: 36, border: `3px dashed ${txCol}`, background: 'rgba(30,70,190,0.10)', boxShadow: `0 0 34px ${txCol}55, inset 0 0 40px ${txCol}18` }} />
          <Pill x={1160} y={231} text={t >= rollbackAt ? 'ROLLBACK' : t >= commitAt && !second ? 'COMMIT' : 'một giao dịch'} color={txCol} />
        </div>
      )}
      <Rise t={t} at={T(2, 0.2) - 0.1}>
        <Db t={t} x={1160} y={595} w={620} title="processed_events" slots={2} rows={inboxRows} cols={[1]} head={['event_id']} border={t >= dupAt && t < rollbackAt + 0.8 ? INK.bad : undefined} />
      </Rise>
      <Envelope t={t} at={e1} from={{ x: TX + 4.5 * CW, y: 372 }} to={{ x: 860, y: 318 }} label="p4 · +100.000" color={INK.accent} len={0.8} arc={20} />
      <Envelope t={t} at={e2} from={{ x: TX + 5.5 * CW, y: 372 }} to={{ x: 860, y: 318 }} label="p4 · +100.000" color={INK.bad} len={0.8} arc={20} />
      <Rise t={t} at={T(2, 0.42)}>
        <div style={{ ...panel, left: 110, top: 690, width: 930, height: 200, boxSizing: 'border-box', padding: '12px 30px' }}>
          <SqlLine t={t} from={second ? a3 + 0.4 : insertAt - 0.3} text="INSERT INTO processed_events VALUES ('p4')" color={sqlBad ? INK.bad : undefined} />
          <SqlLine t={t} from={second ? dupAt + 0.1 : updateAt - 0.3} text="UPDATE wallets SET balance = balance + 100000" color={sqlBad ? INK.faint : undefined} />
          <SqlLine t={t} from={second ? rollbackAt - 0.1 : commitAt - 0.3} text={sqlBad ? 'ROLLBACK' : 'COMMIT'} color={sqlBad ? INK.bad : INK.good} />
        </div>
      </Rise>
      {t >= dupAt && t < T(3, 0.82) && <Pill x={1470} y={890} text="vi phạm khoá chính" color={INK.bad} center o={sp(t, dupAt)} />}
      {t >= T(3, 0.82) && <Pill x={1470} y={890} text="bỏ qua · commit offset" color={INK.good} center o={sp(t, T(3, 0.82))} />}
      {t >= rollbackAt && t < T(4, 0.62) && <Icon3D name="shield" x={880} y={590} size={110} t={t} at={rollbackAt} />}
      {/* offsets differ, event ids match */}
      {t >= T(4, 0.08) && <Pill x={TX + 4.5 * CW} y={535} text="offset 4 · id p4" mono size={28} center o={sp(t, T(4, 0.08))} />}
      {t >= T(4, 0.42) && <Pill x={TX + 5.5 * CW} y={604} text="offset 5 · id p4" mono size={28} center color={INK.bad} o={sp(t, T(4, 0.42))} />}
      {t >= T(4, 0.7) && <Icon3D name="key" x={880} y={590} size={110} t={t} at={T(4, 0.7)} />}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 6. summary */

function summary(t: number, c: Cue) {
  return (
    <SoftTheme>
      <SummaryList t={t} cue={c} items={['Ghi DB rồi gửi Kafka: luôn có khe hở', 'Outbox: ghi sự kiện cùng giao dịch', 'Chép sang Kafka là at-least-once', 'Inbox + event_id: xử lý trùng vẫn đúng']} />
    </SoftTheme>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { hook, dualwrite, outbox, polling, cdc, inbox, summary }

/** Key-moment sounds, timed to the same cue offsets the scenes animate on. */
const SFX: Record<string, SceneSfx[]> = {
  hook: [{ kind: 'error', at: (c) => at(c, 2, 0.15) }],
  dualwrite: [{ kind: 'error', at: (c) => at(c, 1, 0.62) }, { kind: 'error', at: (c) => at(c, 2, 0.62) }],
  outbox: [{ kind: 'ding', at: (c) => at(c, 3, 0.05) }, { kind: 'error', at: (c) => at(c, 3, 0.5) }],
  polling: [{ kind: 'error', at: (c) => at(c, 3, 0.4) }, { kind: 'tick', at: (c) => at(c, 2, 0.1) }],
  cdc: [{ kind: 'ding', at: (c) => at(c, 2, 0.78) }],
  inbox: [{ kind: 'ding', at: (c) => at(c, 2, 0.94) }, { kind: 'error', at: (c) => at(c, 3, 0.55) }],
}

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const outboxInboxLesson: Lesson = {
  ...outboxInboxScript,
  scenes: outboxInboxScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id], sfx: SFX[s.id] })),
  intro: [
    { kind: 'video', scenes: ['hook'] },
    {
      kind: 'quiz',
      title: 'Quick Quiz',
      questions: [q('Đoán trước khi học: service ghi đơn vào database xong, chết trước khi gửi sự kiện lên Kafka. Điều gì xảy ra?', ['Kafka tự có sự kiện', 'Database có đơn nhưng Kafka không có sự kiện, kho không biết', 'Database tự rollback', 'Service Kho tự đọc database'], 1, 'Hai hệ thống không có giao dịch chung nên một bên thành công, bên kia thất bại. Phần 1 mổ xẻ khe hở này.')],
    },
  ],
  roadmap: [
    'Chặng 1: vì sao ghi database rồi gửi Kafka luôn có khe hở, đổi thứ tự hay thử lại đều không chữa được.',
    'Chặng 2: Transactional Outbox biến hai lần ghi thành một, polling publisher và Debezium chép sang Kafka.',
    'Chặng 3: tin trùng là bình thường, bảng inbox với mã sự kiện giúp consumer xử lý trùng mà vẫn đúng.',
  ],
  sections: [
    {
      id: 'ghi-kep',
      title: 'Bài toán ghi kép (dual-write)',
      blocks: [
        { kind: 'p', text: 'Service Đơn hàng phải làm **hai việc**: (1) `INSERT` đơn vào PostgreSQL, (2) gửi sự kiện `OrderPlaced` lên Kafka để service Kho và Email biết. Hai việc nằm ở **hai hệ thống khác nhau**, không có giao dịch chung.' },
        { kind: 'video', scenes: ['dualwrite'] },
        {
          kind: 'table',
          head: ['Thứ tự', 'Sự cố', 'Hậu quả với 1.000 đơn (1% lỗi)'],
          rows: [
            ['DB trước, Kafka sau', 'Ghi DB xong, chết trước khi gửi Kafka', 'khoảng **10 đơn "ma"**: có trong DB, Kho không bao giờ biết để xuất hàng'],
            ['Kafka trước, DB sau', 'Gửi Kafka xong, DB rollback (vi phạm ràng buộc)', 'khoảng **10 sự kiện "ma"**: Kho xuất hàng cho đơn **không tồn tại**'],
          ],
        },
        {
          kind: 'list',
          items: [
            { title: 'Ghi kép', text: 'ghi vào hai hệ thống không có giao dịch chung → luôn có một khe hở mà ở đó một bên thành công, bên kia thất bại.' },
            { title: 'Đổi thứ tự không chữa được', text: 'chỉ đổi loại lỗi: từ đơn ma sang sự kiện ma.' },
            { title: 'Thử lại không chữa được', text: 'nếu process chết thì không còn ai để thử lại.' },
            { title: 'Kafka transaction (Module 6) không cứu được', text: 'nó chỉ gói được các lần ghi vào Kafka (và offset); nó không biết gì về giao dịch của PostgreSQL.' },
          ],
        },
        { kind: 'callout', tone: 'info', title: 'Hình ảnh: chuyển khoản rồi nhắn Zalo', text: 'Bạn chuyển 500.000 đồng cho chủ nhà rồi nhắn "em chuyển rồi nhé". Điện thoại sập nguồn giữa hai bước: tiền đã đi nhưng chủ nhà không biết (đơn ma), hoặc tin đã đi nhưng ngân hàng huỷ giao dịch (sự kiện ma).' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Vì sao "gửi Kafka trước, ghi DB sau" cũng sai, dù tránh được đơn ma?', ['Vì Kafka chậm hơn DB', 'Vì sự kiện đã nằm trên Kafka trong khi DB có thể rollback sau đó: sự kiện ma', 'Vì Kafka không nhận sự kiện trước DB', 'Vì DB không cho rollback'], 1, 'Thế giới bên ngoài đã tin vào một sự thật không tồn tại. Đổi thứ tự chỉ đổi loại lỗi.'),
            q('Đồng nghiệp nói: "Bật enable.idempotence=true cho producer là hết lỗi ghi kép." Đúng hay sai?', ['Đúng, idempotence bao luôn DB', 'Sai, nó chỉ chống trùng do retry giữa producer và broker, không biết gì về DB', 'Đúng nếu acks=all', 'Sai, vì idempotence làm chậm DB'], 1, 'Nếu process chết sau khi commit DB mà chưa gửi, sẽ không có lần gửi nào để mà chống trùng.'),
          ],
        },
      ],
    },
    {
      id: 'transactional-outbox',
      title: 'Transactional Outbox và polling publisher',
      blocks: [
        { kind: 'p', text: 'Đừng gửi Kafka trong lúc xử lý yêu cầu. Ghi sự kiện vào **bảng `outbox` ngay trong cùng database, cùng giao dịch** với dữ liệu nghiệp vụ. Một tiến trình **khác** sẽ đọc bảng `outbox` và đẩy lên Kafka.' },
        { kind: 'video', scenes: ['outbox'] },
        {
          kind: 'code',
          code: `BEGIN;
  INSERT INTO orders (id, customer_id, total) VALUES ('order-42', 'c-7', 250000);
  INSERT INTO outbox (id, aggregatetype, aggregateid, type, payload)
  VALUES ('9f1c…', 'order', 'order-42', 'OrderPlaced',
          '{"orderId":"order-42","total":250000}');
COMMIT;   -- cả hai dòng cùng có, hoặc cùng không`,
        },
        {
          kind: 'table',
          head: ['Cột outbox', 'Ví dụ', 'Dùng để'],
          rows: [
            ['`id`', '`9f1c…` (UUID)', '**mã sự kiện**, consumer dùng để chống trùng (phần 3)'],
            ['`aggregatetype`', '`order`', 'chọn topic'],
            ['`aggregateid`', '`order-42`', '**làm key của tin Kafka** → giữ thứ tự theo từng đơn'],
            ['`type`', '`OrderPlaced`', 'loại sự kiện'],
            ['`payload`', 'JSON', 'nội dung'],
          ],
        },
        { kind: 'callout', tone: 'info', title: 'Hình ảnh: khay "thư đi"', text: 'Kế toán lưu hoá đơn **và** bỏ bản sao vào khay "thư đi" trong **cùng một động tác**. Anh shipper định kỳ lấy thư trong khay đi gửi. Shipper ốm một hôm thì thư vẫn nằm trong khay, mai gửi tiếp, không mất.' },
        { kind: 'video', scenes: ['polling'] },
        {
          kind: 'list',
          items: [
            { title: 'Polling publisher', text: 'một job chạy mỗi N giây: `SELECT … FROM outbox WHERE sent = false ORDER BY seq LIMIT 100`, gửi Kafka, rồi đánh dấu đã gửi.' },
            { title: 'Dùng `aggregateid` làm key', text: 'cùng key thì cùng partition, nên mọi sự kiện của `order-42` giữ đúng thứ tự (Module 2).' },
            { title: 'At-least-once, không phải exactly-once', text: 'người chép chết sau khi gửi mà chưa kịp đánh dấu → gửi lại → tin trùng. Consumer phải chống trùng.' },
          ],
        },
        { kind: 'callout', tone: 'warn', title: 'Bẫy của polling theo `seq`', text: 'Giao dịch A lấy `seq=10`, giao dịch B lấy `seq=11` nhưng B commit trước. Publisher đọc thấy 11, gửi, nhớ "đã tới 11", rồi bỏ sót 10. Tránh bằng cách đánh dấu từng dòng (`sent=true`) thay vì nhớ "đã tới đâu", hoặc dùng CDC.' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Vì sao outbox phải nằm trong cùng database với bảng orders?', ['Cho dễ backup', 'Chỉ khi cùng database thì hai INSERT mới nằm trong một giao dịch và commit nguyên tử', 'Vì Kafka yêu cầu', 'Để tăng tốc truy vấn'], 1, 'Database riêng thì lại quay về ghi kép.'),
            q('Nếu dùng UUID ngẫu nhiên của sự kiện làm key Kafka thay cho aggregateid, điều gì hỏng?', ['Không hỏng gì', 'Thứ tự theo từng đơn bị phá, vì các sự kiện của order-42 rải ra nhiều partition', 'Kafka từ chối tin', 'Outbox không commit được'], 1, 'Consumer ở partition khác nhau chạy song song, nên OrderPaid có thể được xử lý trước OrderPlaced.'),
          ],
        },
      ],
    },
    {
      id: 'cdc-debezium',
      title: 'CDC với Debezium',
      blocks: [
        { kind: 'video', scenes: ['cdc'] },
        {
          kind: 'table',
          head: ['', 'Polling publisher', 'CDC (Debezium)'],
          rows: [
            ['Cách làm', 'truy vấn bảng `outbox` định kỳ, gửi rồi đánh dấu', 'đọc **nhật ký giao dịch** (WAL của PostgreSQL, binlog của MySQL), thấy dòng mới thì đẩy lên Kafka'],
            ['Độ trễ', 'bằng chu kỳ poll (ví dụ 1 giây)', 'thường dưới 1 giây'],
            ['Tải lên DB', 'truy vấn liên tục', 'gần như không (đọc log)'],
            ['Vận hành', 'đơn giản, chỉ cần code', 'phải chạy Kafka Connect + Debezium (Module 8)'],
            ['Thứ tự', 'theo cột `seq`, cẩn thận với commit lệch thứ tự', 'theo **thứ tự commit** trong log của DB'],
          ],
        },
        {
          kind: 'list',
          items: [
            { title: 'Topic đích', text: '`outbox.event.<aggregatetype>`, ví dụ `outbox.event.order` (Outbox Event Router, cấu hình mặc định).' },
            { title: 'Key', text: 'giá trị cột `aggregateid`.' },
            { title: 'Mã sự kiện', text: '`id` được đặt vào **header** tên `id`.' },
            { title: 'Mẹo', text: '`INSERT` vào outbox rồi `DELETE` ngay trong cùng giao dịch: bảng không phình ra, nhưng log của DB vẫn ghi lệnh `INSERT` nên Debezium vẫn thấy sự kiện.' },
          ],
        },
        { kind: 'callout', tone: 'tip', title: 'Sách cũng khuyên đọc log', text: 'Quét bảng bằng cột timestamp hoặc khoá tăng dần là cách **kém hiệu quả và đôi khi không chính xác**, vì nó chỉ thấy những gì câu `SELECT` thấy ở lúc quét. Đọc nhật ký giao dịch thì chính xác hơn, nên sách khuyên dùng connector của Debezium. (📘 sách, ch.9)' },
        { kind: 'callout', tone: 'warn', title: 'Debezium mặc định là at-least-once', text: 'Sau sự cố, nó có thể đọc lại một đoạn log và gửi lại. Dù chọn polling hay CDC, consumer vẫn phải chống trùng.' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Vì sao CDC tạo ít tải lên DB hơn polling?', ['Vì CDC nén dữ liệu', 'Vì CDC đọc nhật ký giao dịch mà DB vốn phải ghi, không chạy thêm SELECT lặp lại trên bảng', 'Vì CDC bỏ qua một số sự kiện', 'Vì CDC chạy trong DB'], 1, 'Nhật ký giao dịch có sẵn để phục hồi và replication.'),
            q('Debezium đọc lại một đoạn log sau khi restart. Điều gì có thể xảy ra ở Kafka?', ['Mất tin', 'Tin trùng', 'Topic bị xoá', 'Không gì cả'], 1, 'Nó là at-least-once: có thể gửi lại tin đã gửi.'),
          ],
        },
      ],
    },
    {
      id: 'inbox',
      title: 'Idempotent consumer và bảng inbox',
      blocks: [
        { kind: 'p', text: 'Tin **sẽ** bị trùng: outbox gửi lại, consumer chết trước khi commit offset, rebalance… Service Ví nhận sự kiện "nạp 100.000 đồng" (`eventId = p3`) hai lần mà xử lý ngây thơ thì số dư tăng **200.000 đồng**. Với 1.000.000 sự kiện/ngày và tỉ lệ trùng 0,1%: **1.000 lần cộng tiền sai mỗi ngày**.' },
        { kind: 'video', scenes: ['inbox'] },
        {
          kind: 'code',
          code: `BEGIN;
  INSERT INTO processed_events (event_id) VALUES ('p3');   -- event_id là PRIMARY KEY
  UPDATE wallets SET balance = balance + 100000 WHERE user_id = 'user-1';
COMMIT;
-- Lần 2 nhận p3: INSERT vi phạm khoá chính → rollback cả giao dịch → bỏ qua, rồi commit offset`,
        },
        {
          kind: 'list',
          items: [
            { title: 'Cách 1: thao tác tự nhiên idempotent', text: '"Đặt trạng thái đơn = SHIPPED" làm hai lần vẫn là SHIPPED. "Cộng 100.000 đồng" thì **không**.' },
            { title: 'Cách 2: bảng inbox', text: 'ghi mã sự kiện đã xử lý **trong cùng giao dịch** với thay đổi nghiệp vụ.' },
            { title: 'Khoá bằng `eventId`, không bằng offset', text: 'cùng một sự kiện gửi lại sẽ có offset **mới**; `eventId` đi theo sự kiện từ lúc sinh ra.' },
            { title: 'Cùng giao dịch', text: 'tách hai giao dịch thì lại có khe hở như ghi kép: ghi "đã xử lý" rồi chết → tiền không được cộng; cộng tiền rồi chết → lần sau cộng nữa.' },
          ],
        },
        { kind: 'callout', tone: 'info', title: 'Hình ảnh: sổ ký nhận ở chung cư', text: 'Bảo vệ ghi mã vận đơn đã nhận. Shipper giao lại kiện `VD-123`? Bảo vệ lật sổ, thấy đã ký rồi, từ chối nhận. Không bao giờ nhận trùng, dù shipper giao lại bao nhiêu lần.' },
        { kind: 'callout', tone: 'tip', title: 'Exactly-once về mặt nghiệp vụ', text: '**At-least-once** (rẻ) + **consumer idempotent**. Kafka EOS (Module 6) chỉ trọn vẹn trong vòng Kafka → Kafka; ghi ra DB bên ngoài vẫn cần inbox hoặc thao tác idempotent. (📘 sách, ch.8)' },
        { kind: 'callout', tone: 'info', title: 'Bảng inbox lớn dần', text: 'Có thể xoá mã cũ hơn khoảng thời gian tối đa một tin trùng có thể đến (ví dụ 7 ngày, gắn với retention của topic).' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Vì sao không dùng (partition, offset) làm khoá chống trùng?', ['Vì offset quá dài', 'Vì trùng thường sinh ra trước Kafka: bản sao được ghi thành tin mới với offset mới, khoá theo offset không bắt được', 'Vì partition đổi liên tục', 'Vì Kafka cấm'], 1, 'Khoá theo offset chỉ bắt được trùng do đọc lại, không bắt được trùng do ghi lại.'),
            q('Vì sao INSERT processed_events và UPDATE wallets phải nằm trong cùng giao dịch?', ['Cho code ngắn hơn', 'Vì tách ra thì chết giữa chừng sẽ hoặc mất việc cộng tiền, hoặc cộng tiền lần nữa', 'Vì DB bắt buộc', 'Vì Kafka yêu cầu'], 1, 'Cùng giao dịch thì hai việc cùng có hoặc cùng không.'),
          ],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: chọn điểm chết và cách làm',
      blocks: [
        { kind: 'p', text: 'Chọn cách làm (ghi kép, outbox polling, outbox CDC) và điểm process chết. Quan sát DB, Kafka và consumer: sự kiện bị mất, bị ma, hay bị trùng; rồi bật inbox để xem tin trùng bị chặn.' },
        { kind: 'widget', name: 'outbox-lab' },
      ],
    },
    {
      id: 'tom-tat-video',
      title: 'Nhìn lại cả bài',
      blocks: [{ kind: 'video', scenes: ['summary'] }],
    },
  ],
  finalQuiz: [
    q('Vì sao ghi database rồi gửi Kafka không thể an toàn bằng cách thử lại?', ['Kafka từ chối thử lại', 'Vì process có thể chết đúng giữa hai việc, không còn ai để thử lại', 'Vì database không cho ghi hai lần', 'Vì retry làm mất offset'], 1, 'Khe hở nằm giữa hai hệ thống không có giao dịch chung.'),
    q('Điều gì làm Transactional Outbox giải được bài toán ghi kép?', ['Gửi Kafka hai lần', 'Dòng dữ liệu và dòng outbox cùng một giao dịch DB, việc đưa lên Kafka trở thành chép lại', 'Dùng Kafka transaction cho cả DB', 'Tắt acks'], 1, 'Chỉ còn một lần ghi nguyên tử, phần chép sang Kafka làm lại được.'),
    q('Outbox cho đảm bảo giao hàng nào?', ['At-most-once', 'At-least-once, nên consumer phải chống trùng', 'Exactly-once tuyệt đối', 'Không đảm bảo gì'], 1, 'Người chép có thể chết sau khi gửi mà chưa đánh dấu nên gửi lại.'),
    q('Khoá chống trùng đúng của bảng inbox là gì?', ['(partition, offset)', 'Mã sự kiện eventId do người tạo sự kiện sinh ra', 'Thời gian nhận', 'Tên consumer'], 1, 'Tin gửi lại có offset mới nhưng eventId không đổi.'),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao outbox vẫn cần consumer idempotent?',
      keywords: ['at-least-once', 'trùng', 'gửi lại', 'inbox'],
      modelAnswer: 'Vì người chép (polling publisher hoặc Debezium) có thể chết sau khi đã gửi lên Kafka mà chưa kịp đánh dấu hay lưu vị trí, nên lần sau gửi lại: outbox chỉ cho at-least-once. Bản gửi lại là tin mới với offset mới, nên consumer phải dùng bảng inbox với mã sự kiện, ghi cùng giao dịch với thay đổi nghiệp vụ, để bỏ qua tin trùng.',
    },
  ],
  recap: {
    journey:
      'Ghi database rồi gửi Kafka là hai hệ thống nên luôn có khe hở → đổi thứ tự hay thử lại không chữa được → outbox ghi sự kiện cùng giao dịch với dữ liệu → polling publisher hoặc Debezium chép sang Kafka, at-least-once → tin trùng là bình thường → bảng inbox với eventId, ghi cùng giao dịch, để xử lý trùng mà kết quả vẫn đúng.',
    points: [
      { title: 'Ghi kép', text: 'DB và Kafka không cùng giao dịch: đơn ma hoặc sự kiện ma, đổi thứ tự không chữa được.' },
      { title: 'Outbox', text: 'Ghi sự kiện vào bảng outbox cùng giao dịch với dữ liệu; aggregateid làm key để giữ thứ tự.' },
      { title: 'Polling và CDC', text: 'Polling truy vấn định kỳ; Debezium đọc WAL/binlog theo thứ tự commit, ít tải hơn. Cả hai là at-least-once.' },
      { title: 'Inbox', text: 'INSERT eventId và thay đổi nghiệp vụ trong cùng giao dịch; trùng thì vi phạm khoá chính và bị bỏ qua.' },
    ],
    next: 'Bài tiếp theo: Thiết kế sự kiện & event sourcing (Module 10).',
  },
}
