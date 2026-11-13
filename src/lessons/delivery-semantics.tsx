import { cameraAt, clamp, move, sp, span, vis } from '../player/motion-kit'
import { ConsumerUnit, Envelope, HERO, Icon3D, LogTape, Packets, Rise, SOFT, SOFT_PANEL, SoftScene, SoftTheme, SummaryList, Wire } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene, SceneSfx } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { deliverySemanticsScript } from './delivery-semantics-script'

/** This lesson is drawn in the navy glow style. */
const INK = SOFT
const panel = SOFT_PANEL
const WIDE = { x: 960, y: 540, s: 1 }
const GLOW = { background: 'rgba(8,22,82,0.92)', border: '1.5px solid #6ea2ff', boxShadow: '0 0 18px rgba(77,141,255,0.65), inset 0 1px 0 rgba(255,255,255,0.15)', color: '#ffffff' }

/* ------------------------------------------------------------------ shared pieces */

/** One batch tape: 10 cells, offsets 100..109, all same size. Used by the hook and the two ordering scenes. */
const T = { X: 310, Y: 450, CW: 130, N: 10, FIRST: 100 }
const cellX = (i: number) => T.X + i * T.CW + T.CW / 2

/** Centred one-line caption that rises word by word. */
function Say({ t, at, text, y, color = INK.text, size = 56, off = Infinity }: { t: number; at: number; text: string; y: number; color?: string; size?: number; off?: number }) {
  const q = clamp(sp(t, at))
  const words = text.split(' ')
  return (
    <div style={{ position: 'absolute', left: 0, width: 1920, top: y, textAlign: 'center', fontSize: size, fontWeight: 800, letterSpacing: -0.5, color, whiteSpace: 'nowrap', opacity: Number.isFinite(off) ? 1 - span(t, off, off + 0.4) : 1 }}>
      {words.map((w, k) => {
        const p = clamp(q * (1 + words.length * 0.12) - k * 0.12)
        return (
          <span key={k} style={{ display: 'inline-block', marginRight: size * 0.26, opacity: p, filter: p < 0.98 ? `blur(${(1 - p) * 8}px)` : undefined, transform: `translateY(${(1 - p) * 24}px)` }}>
            {w}
          </span>
        )
      })}
    </div>
  )
}

/**
 * A tape of numbered cells with large (>= 26px) offset numbers and an optional marker (committed / read-from).
 * The kit's LogTape draws the cells; its own small labels are switched off.
 */
/** LogTape prints `offsetOf(0)` as text; an empty string (typed as number by the kit) prints nothing. */
const blank = (() => '') as unknown as (i: number) => number
function Tape({ x, y, cells, cw, first, state, mark }: { x: number; y: number; cells: number; cw: number; first: number; state: (i: number) => 'filled' | 'new' | 'empty' | 'missing' | 'dead'; mark?: { at: number; label: string; color: string } }) {
  return (
    <>
      <LogTape x={x} y={y} cells={cells} cellW={cw} tick={100000} offsetOf={blank} state={state} />
      {Array.from({ length: cells }, (_, i) => (
        <div key={i} style={{ position: 'absolute', left: x + i * cw, width: cw, top: y + 76, textAlign: 'center', fontFamily: MONO, fontSize: 26, color: INK.faint }}>
          {first + i}
        </div>
      ))}
      {mark && (
        <>
          <div style={{ position: 'absolute', left: x + mark.at * cw - 1.5, top: y - 44, width: 3, height: 122, borderRadius: 2, background: mark.color }} />
          <div style={{ position: 'absolute', left: x + mark.at * cw, top: y - 98, transform: 'translateX(-50%)', padding: '6px 18px', borderRadius: 999, fontSize: 26, fontWeight: 800, whiteSpace: 'nowrap', ...GLOW, color: mark.color }}>{mark.label}</div>
        </>
      )}
    </>
  )
}

/** Round status badge under a tape cell: ok / twice (processed again) / lost. `pulse` = start of a repeating soft pulse. */
type Kind = 'ok' | 'twice' | 'lost'
function Badge({ t, x, y, kind, at, pulse }: { t: number; x: number; y: number; kind: Kind; at: number; pulse?: number }) {
  const k = sp(t, at, 12, 160)
  if (k <= 0) return null
  const ph = pulse !== undefined && t > pulse ? ((t - pulse) % 2.4) / 0.5 : 2
  const m = ph < 1 ? 1 + 0.22 * Math.sin(Math.PI * ph) : 1
  const col = kind === 'ok' ? INK.good : kind === 'twice' ? INK.warn : INK.bad
  return (
    <div style={{ position: 'absolute', left: x - 28, top: y, width: 56, height: 56, borderRadius: 28, display: 'grid', placeItems: 'center', fontSize: kind === 'twice' ? 26 : 32, fontWeight: 900, color: '#06122e', background: col, boxShadow: `0 0 18px ${col}`, opacity: clamp(k * 1.6), transform: `scale(${(0.6 + 0.4 * k) * m})` }}>
      {kind === 'ok' ? '✓' : kind === 'twice' ? '×2' : '✗'}
    </div>
  )
}

/** The two steps of the consumer loop as pills: "① a → ② b". `crash` puts a red tag under the pill (1) or the arrow (0). */
function OrderPills({ t, labels, at, crashAt, under }: { t: number; labels: [string, string]; at: [number, number]; crashAt?: number; under: 'second' | 'gap' }) {
  const pill = (left: number, text: string, n: number) => (
    <div style={{ position: 'absolute', left, top: 240, width: 250, boxSizing: 'border-box', textAlign: 'center', padding: '10px 0', borderRadius: 999, fontSize: 32, fontWeight: 800, ...GLOW, opacity: vis(t, at[n], Infinity, 0.3) }}>
      {n + 1}. {text}
    </div>
  )
  const cx = T.X + (under === 'second' ? 465 : 295)
  return (
    <>
      {pill(T.X, labels[0], 0)}
      <div style={{ position: 'absolute', left: T.X + 250, top: 238, width: 90, textAlign: 'center', fontSize: 48, fontWeight: 800, color: INK.faint, opacity: vis(t, at[1], Infinity, 0.3) }}>→</div>
      {pill(T.X + 340, labels[1], 1)}
      {crashAt !== undefined && (
        <div style={{ position: 'absolute', left: cx - 110, top: 322, width: 220, boxSizing: 'border-box', textAlign: 'center', padding: '6px 0', borderRadius: 999, fontSize: 28, fontWeight: 800, color: INK.bad, border: `1.5px solid ${INK.bad}`, background: 'rgba(60,10,30,0.6)', boxShadow: `0 0 16px ${INK.bad}88`, opacity: vis(t, crashAt, Infinity, 0.25) }}>
          chết ở đây
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ 0. hook: two jobs, one order */

function hook(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const swap = a2 + 0.9
  // a light runs along the batch again and again: the consumer is holding these 10 messages
  const sweepStep = Math.floor((t - (a0 + 0.8)) / 0.12)
  const sweep = t < a0 + 0.8 ? -1 : sweepStep % 22
  const num = (n: number) => (t < swap ? n : 3 - n)
  const pulse = 1 + 0.3 * Math.sin(Math.PI * span(t, swap, swap + 0.45))
  const badge = (x: number, n: number) => (
    <div style={{ position: 'absolute', left: x - 30, top: 520, width: 60, height: 60, borderRadius: 30, display: 'grid', placeItems: 'center', fontSize: 34, fontWeight: 800, color: '#fff', background: HERO, boxShadow: '0 0 22px rgba(77,141,255,0.8)', opacity: vis(t, a1 + 1.2, Infinity, 0.3), transform: `scale(${pulse})` }}>{num(n)}</div>
  )
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 580, s: 1.06 }, 1.3], [a2, WIDE, 1.3]])}>
      <div style={{ position: 'absolute', left: T.X, top: 242, fontSize: 40, fontWeight: 800, color: INK.text, opacity: vis(t, 0.3) }}>poll() vừa trả về 10 tin của P0</div>
      <Rise t={t} at={0.3}>
        <div style={{ position: 'absolute', left: T.X - 80, top: 330 + 16, fontSize: 30, fontWeight: 700, color: INK.text }}>P0</div>
        <Tape x={T.X} y={330} cells={T.N} cw={T.CW} first={T.FIRST} state={(i) => (sweep === i ? 'new' : 'filled')} />
      </Rise>
      <Icon3D name="tools" x={700} y={690} size={190} t={t} at={a1 + 0.2} />
      <Icon3D name="flag" x={1220} y={690} size={190} t={t} at={a1 + 0.7} />
      <div style={{ position: 'absolute', left: 550, width: 300, top: 810, textAlign: 'center', fontSize: 38, fontWeight: 800, color: INK.text, opacity: vis(t, a1 + 0.4, Infinity, 0.3) }}>xử lý</div>
      <div style={{ position: 'absolute', left: 1070, width: 300, top: 810, textAlign: 'center', fontSize: 38, fontWeight: 800, color: INK.text, opacity: vis(t, a1 + 0.9, Infinity, 0.3) }}>commit offset</div>
      {badge(700, 1)}
      {badge(1220, 2)}
      <Say t={t} at={a2 + 1.5} text="đổi thứ tự, kết quả khác hẳn" y={930} color={INK.warn} size={50} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 1+2. the two orderings (same layout, side-by-side comparable) */

/**
 * `amo`: commit first, then process; crash after 5 → 5 messages lost.
 * `alo`: process everything, crash just before the commit → the whole batch is processed twice.
 */
function ordering(kind: 'amo' | 'alo') {
  return function render(t: number, c: Cue) {
    const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
    const amo = kind === 'amo'
    const doneN = amo ? 5 : T.N

    // when message k finishes its first pass
    const p0 = amo ? a1 + 1.7 : a1 + 1.0
    const step = amo ? 0.5 : clamp((c.end(1) - p0) / T.N, 0.2, 0.42)
    const p = (k: number) => p0 + (k + 1) * step
    const crash = amo ? Math.max(a2 + 0.9, p(doneN - 1) + 0.4) : a2 + 0.7
    const restart = a3 + 0.3
    const q = (k: number) => restart + 0.9 + k * 0.17 // second pass (alo) / verdict badges (amo)

    const crashed = t >= crash && t < restart
    const reading = t >= restart
    const commitAt = amo ? move(t, a1 + 0.3, 0.9) * T.N : 0
    const mark = Math.round(T.FIRST + commitAt)

    // which cell is being processed right now (highlight) and the first-pass progress
    const firstPassCount = Array.from({ length: doneN }, (_, k) => (t >= p(k) ? 1 : 0)).reduce<number>((a, b) => a + b, 0)
    const cur = Math.floor((t - p0) / step) // the one cell being processed right now
    const active = (i: number) => i === cur && i < doneN && t < crash && t >= p0
    const lostCell = (i: number) => amo && i >= doneN && t >= q(i - doneN) - 0.2
    const secondDone = !amo ? Array.from({ length: T.N }, (_, k) => (t >= q(k) ? 1 : 0)).reduce<number>((a, b) => a + b, 0) : 0
    const busy = reading && !amo ? secondDone / T.N : !crashed && !reading && t >= p0 - step ? Math.min(1, firstPassCount / doneN) : undefined

    const markLabel = reading ? `đọc từ ${mark}` : `committed ${mark}`
    const markColor = reading ? INK.good : INK.warn
    const note = crashed ? 'đã chết' : reading ? 'khởi động lại' : undefined

    return (
      <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 570, s: 1.05 }, 1.4], [a3, { x: 1020, y: 590, s: 1.06 }, 1.4]])}>
        <OrderPills t={t} labels={amo ? ['commit', 'xử lý'] : ['xử lý', 'commit']} at={[a0 + 0.3, a0 + 1.2]} crashAt={crash} under={amo ? 'second' : 'gap'} />
        <Rise t={t} at={0.3}>
          <div style={{ position: 'absolute', left: T.X - 80, top: T.Y + 16, fontSize: 30, fontWeight: 700, color: INK.text }}>P0</div>
          <Tape
            x={T.X}
            y={T.Y}
            cells={T.N}
            cw={T.CW}
            first={T.FIRST}
            mark={{ at: commitAt, label: markLabel, color: markColor }}
            state={(i) => (lostCell(i) ? 'missing' : active(i) || (!amo && reading && i === Math.floor((t - q(0)) / 0.17) && t < q(T.N - 1)) ? 'new' : 'filled')}
          />
        </Rise>
        <div style={{ position: 'absolute', left: T.X - 150, top: T.Y + 128, fontSize: 28, fontWeight: 700, color: INK.faint, opacity: vis(t, p0 - step) }}>xử lý</div>
        {Array.from({ length: T.N }, (_, i) => {
          if (amo) {
            if (i < doneN) return <Badge key={i} t={t} x={cellX(i)} y={T.Y + 108} kind="ok" at={p(i)} />
            return <Badge key={i} t={t} x={cellX(i)} y={T.Y + 108} kind="lost" at={q(i - doneN)} pulse={q(4) + 0.6 + (i - doneN) * 0.12} />
          }
          return <Badge key={i} t={t} x={cellX(i)} y={T.Y + 108} kind={t >= q(i) ? 'twice' : 'ok'} at={t >= q(i) ? q(i) : p(i)} pulse={q(T.N - 1) + 0.4 + i * 0.12} />
        })}
        <Rise t={t} at={0.5}>
          <ConsumerUnit x={T.X} y={700} w={460} name="consumer" parts={['P0']} note={note} down={crashed} t={t} busy={crashed ? undefined : busy} />
        </Rise>
        <div style={{ opacity: vis(t, crash, restart - 0.1, 0.25) }}>
          <Icon3D name="fire" x={T.X + 560} y={760} size={150} t={t} at={crash} />
        </div>
        {amo ? (
          <>
            <div style={{ ...panel, left: 1010, top: 716, fontSize: 40, color: INK.bad, opacity: vis(t, q(4) + 0.4) }}>mất 5 tin</div>
            <Icon3D name="thumb-down" x={1700} y={760} size={150} t={t} at={q(4) + 0.5} />
          </>
        ) : (
          <>
            <div style={{ ...panel, left: 1010, top: 716, fontSize: 40, color: INK.warn, opacity: vis(t, q(T.N - 1) + 0.4) }}>lặp 10 tin · không mất tin</div>
            <Icon3D name="copy" x={1700} y={760} size={150} t={t} at={q(T.N - 1) + 0.5} />
          </>
        )}
      </SoftScene>
    )
  }
}

/* ------------------------------------------------------------------ 3. exactly-once: one unit */

const X = { TY: 414, CW: 64, OX: 120, CONS: 480, INV: 1190, FX: 1120, FY: 290, FW: 540, FH: 500 }

/** Right-angled arrow: down from (x, y0) to y1, then right to x1. */
function Elbow({ x, y0, y1, x1, color, p = 1 }: { x: number; y0: number; y1: number; x1: number; color: string; p?: number }) {
  const len1 = y1 - y0
  const len2 = x1 - x
  const shown = clamp(p) * (len1 + len2)
  const a = Math.min(shown, len1)
  const b = Math.max(0, shown - len1)
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
      <polyline points={`${x},${y0} ${x},${y0 + a} ${x + b},${y0 + a}`} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      {p >= 1 && <path d={`M${x1} ${y1} l-14 -9 M${x1} ${y1} l-14 9`} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" />}
    </svg>
  )
}

function exactly(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const d1 = c.end(1) - a1
  const good = a1 + 0.8
  const bad = a1 + Math.max(d1 * 0.55, 2.2)
  const cy = X.TY - 25 + 59 // vertical centre of the 118-tall consumer unit
  const bottom = X.TY - 25 + 118
  const committed = t >= good + 0.8
  const offsetNow = t >= good + 0.8 ? 104 : 103
  const trying = t >= bad + 0.8 && t < bad + 2.0
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 1000, y: 560, s: 1.04 }, 1.4], [a3, { x: 920, y: 600, s: 1.03 }, 1.4]])}>
      {/* source and consumer */}
      <Rise t={t} at={0.3}>
        <div style={{ position: 'absolute', left: X.OX, top: X.TY - 50, fontSize: 26, fontWeight: 700, color: INK.faint }}>orders</div>
        <Tape x={X.OX} y={X.TY} cells={4} cw={X.CW} first={100} state={() => 'filled'} />
      </Rise>
      <Rise t={t} at={0.5}>
        <ConsumerUnit x={X.CONS} y={X.TY - 25} w={420} name="consumer" parts={['P0']} t={t} busy={(t * 0.9) % 1} />
      </Rise>
      <Wire from={{ x: X.OX + 4 * X.CW + 14, y: cy }} to={{ x: X.CONS - 14, y: cy }} color={INK.line} p={move(t, 0.8, 0.5)} flow={t} />
      <Packets t={t} from={{ x: X.OX + 4 * X.CW + 14, y: cy }} to={{ x: X.CONS - 14, y: cy }} start={1.2} every={0.55} len={0.8} size={18} />

      {/* the two writes that must be one unit */}
      <Rise t={t} at={a0 + 0.8}>
        <div style={{ position: 'absolute', left: X.INV, top: X.TY - 50, fontSize: 26, fontWeight: 700, color: INK.faint }}>invoices</div>
        <div>
          <Tape x={X.INV} y={X.TY} cells={6} cw={X.CW} first={200} state={(i) => (i < 3 ? 'filled' : i === 3 ? (committed ? 'new' : 'empty') : i === 4 && t >= bad + 0.8 ? 'dead' : 'empty')} />
        </div>
      </Rise>
      <Wire from={{ x: X.CONS + 420 + 10, y: cy }} to={{ x: X.INV - 14, y: cy }} color={INK.line} p={move(t, a0 + 1.0, 0.5)} flow={t} />
      <Rise t={t} at={a0 + 1.2}>
        <div style={{ ...panel, left: X.FX + 40, top: 620, width: 460, boxSizing: 'border-box', padding: '16px 26px', border: `1.5px solid ${trying ? INK.bad : 'rgba(110,160,255,0.65)'}` }}>
          <div style={{ fontFamily: MONO, fontSize: 26, color: INK.faint }}>__consumer_offsets</div>
          <div style={{ marginTop: 6, fontSize: 36, fontWeight: 800, color: trying ? INK.bad : committed ? INK.good : INK.text }}>orders P0 → {trying ? 105 : offsetNow}</div>
        </div>
      </Rise>
      <Elbow x={860} y0={bottom} y1={675} x1={X.FX + 36} color={INK.line} p={move(t, a0 + 1.4, 0.7)} />

      {/* one transaction frame */}
      <div style={{ position: 'absolute', left: X.FX, top: X.FY, width: X.FW, height: X.FH, boxSizing: 'border-box', borderRadius: 30, border: `3px dashed ${trying ? INK.bad : committed ? INK.good : INK.accent}`, boxShadow: `0 0 28px ${trying ? INK.bad : committed ? INK.good : INK.accent}66`, opacity: vis(t, a1, Infinity, 0.5) }} />
      <div style={{ position: 'absolute', left: X.FX + 30, top: X.FY - 28, padding: '8px 22px', borderRadius: 999, fontSize: 28, fontWeight: 800, ...GLOW, opacity: vis(t, a1 + 0.2, Infinity, 0.4) }}>một transaction</div>
      <Envelope t={t} at={good} from={{ x: 990, y: cy }} to={{ x: 1030, y: cy }} label="COMMIT" color={INK.good} arc={0} />
      <Envelope t={t} at={bad} from={{ x: 990, y: cy }} to={{ x: 1030, y: cy }} label="ABORT" color={INK.bad} arc={0} />

      {/* Kafka → Kafka verdict */}
      <div style={{ position: 'absolute', left: 1200, top: 840, padding: '10px 26px', borderRadius: 999, fontSize: 30, fontWeight: 800, color: INK.good, border: `1.5px solid ${INK.good}`, background: 'rgba(6,50,40,0.6)', boxShadow: `0 0 18px ${INK.good}77`, opacity: vis(t, a2 + 0.6, Infinity, 0.4) }}>Kafka → Kafka: exactly-once</div>
      <Icon3D name="trophy" x={1810} y={880} size={120} t={t} at={a2 + 1.0} />

      {/* external DB: out of reach */}
      <Wire from={{ x: 600, y: bottom }} to={{ x: 600, y: 720 }} color={INK.bad} p={move(t, a3 + 0.4, 0.6)} dashed />
      <Packets t={t} from={{ x: 600, y: bottom + 6 }} to={{ x: 600, y: 580 }} start={a3 + 1.2} every={0.7} len={0.9} color={INK.bad} size={22} />
      <div style={{ position: 'absolute', left: 600 - 26, top: 590, width: 52, height: 52, borderRadius: 26, display: 'grid', placeItems: 'center', fontSize: 30, fontWeight: 900, color: '#06122e', background: INK.bad, boxShadow: `0 0 16px ${INK.bad}`, opacity: vis(t, a3 + 1.0, Infinity, 0.3), transform: `scale(${1 + 0.12 * Math.sin(t * 5)})` }}>✗</div>
      <Icon3D name="cube" x={600} y={810} size={150} t={t} at={a3 + 0.8} />
      <div style={{ position: 'absolute', left: 700, top: 770, fontSize: 34, fontWeight: 800, color: INK.text, opacity: vis(t, a3 + 1.0, Infinity, 0.3) }}>database ngoài</div>
      <div style={{ position: 'absolute', left: 700, top: 835, padding: '10px 26px', borderRadius: 999, fontSize: 30, fontWeight: 800, color: INK.warn, border: `1.5px solid ${INK.warn}`, background: 'rgba(60,40,10,0.6)', boxShadow: `0 0 18px ${INK.warn}77`, opacity: vis(t, a3 + 3.6, Infinity, 0.4) }}>at-least-once + idempotent</div>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 4. idempotent operations */

function idem(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  // row A starts centred on its own and slides up when row B joins, so the frame is never lopsided
  const yA = 560 + (430 - 560) * move(t, a3, 0.9)
  const yB = 700
  const row = (y: number, at: number, formula: string, add: boolean) => {
    const first = at + 0.3
    const again = at + 1.9
    const value = t < first + 0.8 ? 500 : t < again + 0.8 ? 600 : add ? 700 : 600
    const wrong = add && t >= again + 0.8
    return (
      <>
        <Rise t={t} at={at}>
          <div style={{ position: 'absolute', left: 100, top: y - 32, width: 520, boxSizing: 'border-box', textAlign: 'center', padding: '14px 0', borderRadius: 999, fontFamily: MONO, fontSize: 32, fontWeight: 700, ...GLOW }}>{formula}</div>
          <div style={{ ...INK.card, position: 'absolute', left: 1150, top: y - 70, width: 400, height: 140, boxSizing: 'border-box', display: 'grid', placeItems: 'center', border: wrong ? `2px solid ${INK.bad}` : (INK.card.border as string) }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: INK.faint, position: 'absolute', left: 24, top: 12 }}>số dư</div>
            <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -2, color: wrong ? INK.bad : value === 600 ? INK.good : INK.text, marginTop: 14 }}>{value}</div>
          </div>
        </Rise>
        <Wire from={{ x: 640, y }} to={{ x: 1130, y }} color={INK.line} p={move(t, at + 0.2, 0.4)} />
        <Envelope t={t} at={first} from={{ x: 790, y }} to={{ x: 990, y }} label="evt-9f2" arc={0} />
        <Envelope t={t} at={again} from={{ x: 790, y }} to={{ x: 990, y }} label="evt-9f2 (lặp)" color={INK.warn} arc={0} len={0.9} />
        <Icon3D name={add ? 'thumb-down' : 'thumb-up'} x={1730} y={y} size={140} t={t} at={again + 0.9} />
        <div style={{ position: 'absolute', left: 100, top: y + 60, fontSize: 30, fontWeight: 800, color: add ? INK.bad : INK.good, opacity: vis(t, again + 0.9, Infinity, 0.3) }}>{add ? 'không idempotent' : 'idempotent'}</div>
      </>
    )
  }
  // beats 0-1: the same event arrives again and again, and every run ends on the same 600
  const CHIPS = 5
  const chipX = (k: number) => 425 + k * 220
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a2, { x: 960, y: 560, s: 1.04 }, 1.4], [a3, { x: 960, y: 580, s: 1.04 }, 1.4]])}>
      <div style={{ opacity: vis(t, a0 + 0.3, a2 - 0.3, 0.4) }}>
        <Icon3D name="copy" x={960} y={450} size={200} t={t} at={a0 + 0.3} />
        {Array.from({ length: CHIPS }, (_, k) => (
          <Rise key={k} t={t} at={a0 + 1.4 + k * 0.5}>
            <div style={{ position: 'absolute', left: chipX(k), top: 600, width: 190, height: 64, boxSizing: 'border-box', display: 'grid', placeItems: 'center', borderRadius: 999, fontFamily: MONO, fontSize: 28, fontWeight: 700, ...GLOW, border: `1.5px solid ${k ? INK.warn : '#6ea2ff'}` }}>evt-9f2</div>
          </Rise>
        ))}
        <div style={{ position: 'absolute', left: chipX(0), top: 790, width: 4 * 220 + 190, height: 110, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, borderRadius: 28, ...INK.card, opacity: vis(t, a1 + 0.6, Infinity, 0.4) }}>
          <span style={{ fontSize: 34, fontWeight: 700, color: INK.faint }}>mọi lần chạy →</span>
          <span style={{ fontSize: 76, fontWeight: 800, letterSpacing: -2, color: INK.good }}>600</span>
        </div>
        {Array.from({ length: CHIPS }, (_, k) => (
          <div key={k} style={{ opacity: vis(t, a1 + 0.9, Infinity, 0.3) }}>
            <Wire from={{ x: chipX(k) + 95, y: 670 }} to={{ x: chipX(k) + 95, y: 782 }} color={INK.line} p={move(t, a1 + 0.9 + k * 0.1, 0.4)} />
            <Packets t={t} from={{ x: chipX(k) + 95, y: 672 }} to={{ x: chipX(k) + 95, y: 780 }} start={a1 + 1.6 + k * 0.18} every={0.9} len={0.7} size={18} />
          </div>
        ))}
      </div>
      <Say t={t} at={a0 + 0.8} text="không cấm lặp, làm cho lặp vô hại" y={262} off={a1 - 0.1} />
      <Say t={t} at={a1 + 0.3} text="chạy 1 lần = chạy 10 lần" y={262} color={INK.good} off={a2 - 0.3} />
      {row(yA, a2, 'balance = balance + 100', true)}
      {row(yB, a3, 'balance = 600', false)}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 5. dedupe table */

const D = { FX: 1000, FY: 320, FW: 820, FH: 440, CY: 400, CW: 360, CH: 300, P: 1030, A: 1430 }

function dedupe(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const mid = 545
  const first = a1 + 0.3
  const stored = first + 1.9
  const again = a2 + 0.2
  const clash = again + 1.7
  const isStored = t >= stored
  const isClash = t >= clash && t < clash + 1.8
  const balance = isStored ? 600 : 500
  const cardBorder = (hot: string | null) => (hot ? `2px solid ${hot}` : (INK.card.border as string))
  const hot = isClash ? INK.bad : t >= stored && t < stored + 0.9 ? INK.good : null
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 1000, y: 560, s: 1.04 }, 1.4], [a3, WIDE, 1.4]])}>
      <Icon3D name="mail" x={230} y={mid} size={150} t={t} at={0.3} />
      <div style={{ position: 'absolute', left: 130, width: 200, top: 640, textAlign: 'center', fontSize: 28, fontWeight: 700, color: INK.faint, opacity: vis(t, 0.5) }}>topic</div>
      <div style={{ position: 'absolute', left: 130, width: 200, boxSizing: 'border-box', textAlign: 'center', top: 330, padding: '8px 0', borderRadius: 999, fontFamily: MONO, fontSize: 28, fontWeight: 700, ...GLOW, opacity: vis(t, a0 + 0.5, Infinity, 0.3) }}>evt-9f2</div>
      <Rise t={t} at={0.6}>
        <ConsumerUnit x={520} y={mid - 59} w={380} name="consumer" parts={['P0']} t={t} busy={(t * 0.9) % 1} />
      </Rise>
      <Wire from={{ x: 310, y: mid }} to={{ x: 506, y: mid }} color={INK.line} p={move(t, 0.9, 0.5)} flow={t} />
      <Wire from={{ x: 914, y: mid }} to={{ x: D.FX - 6, y: mid }} color={INK.line} p={move(t, a0 + 1.2, 0.5)} flow={t} />

      {/* database: one transaction around two tables */}
      <div style={{ position: 'absolute', left: D.FX, top: D.FY, width: D.FW, height: D.FH, boxSizing: 'border-box', borderRadius: 30, border: `3px dashed ${isClash ? INK.bad : INK.accent}`, boxShadow: `0 0 28px ${isClash ? INK.bad : INK.accent}66`, opacity: vis(t, a0 + 1.0, Infinity, 0.5) }} />
      <div style={{ position: 'absolute', left: D.FX + 30, top: D.FY - 28, padding: '8px 22px', borderRadius: 999, fontSize: 28, fontWeight: 800, ...GLOW, opacity: vis(t, a0 + 1.2, Infinity, 0.4) }}>1 transaction DB</div>
      <Rise t={t} at={a0 + 1.4}>
        <div style={{ ...INK.card, position: 'absolute', left: D.P, top: D.CY, width: D.CW, height: D.CH, boxSizing: 'border-box', padding: '18px 24px', border: cardBorder(hot) }}>
          <div style={{ fontFamily: MONO, fontSize: 28, color: INK.faint }}>processed_events</div>
          {isStored && (
            <Rise t={t} at={stored}>
              <div style={{ marginTop: 22, height: 64, borderRadius: 16, display: 'flex', alignItems: 'center', padding: '0 20px', fontFamily: MONO, fontSize: 30, fontWeight: 700, color: '#fff', background: HERO }}>evt-9f2</div>
            </Rise>
          )}
          {isClash && (
            <div style={{ marginTop: 14, height: 64, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', whiteSpace: 'nowrap', fontFamily: MONO, fontSize: 24, fontWeight: 700, color: INK.bad, border: `2px solid ${INK.bad}`, background: 'rgba(60,10,30,0.6)' }}>
              <span>evt-9f2</span>
              <span>trùng khoá</span>
            </div>
          )}
        </div>
        <div style={{ ...INK.card, position: 'absolute', left: D.A, top: D.CY, width: D.CW, height: D.CH, boxSizing: 'border-box', padding: '18px 24px', border: cardBorder(hot) }}>
          <div style={{ fontFamily: MONO, fontSize: 28, color: INK.faint }}>accounts · id 42</div>
          <div style={{ marginTop: 40, fontSize: 30, fontWeight: 700, color: INK.faint }}>số dư</div>
          <div style={{ fontSize: 100, fontWeight: 800, letterSpacing: -3, color: isStored ? INK.good : INK.text }}>{balance}</div>
        </div>
      </Rise>
      {/* chips travel above the consumer card (top edge at mid - 59) and stop before the database box */}
      <Envelope t={t} at={first} from={{ x: 340, y: mid - 105 }} to={{ x: 700, y: mid - 105 }} label="evt-9f2" arc={0} len={0.8} />
      <Envelope t={t} at={first + 0.9} from={{ x: 760, y: mid - 105 }} to={{ x: 920, y: mid - 105 }} label="+100" arc={0} len={0.7} />
      <Envelope t={t} at={again} from={{ x: 340, y: mid - 105 }} to={{ x: 700, y: mid - 105 }} label="evt-9f2 (lặp)" color={INK.warn} arc={0} len={0.9} />
      <Envelope t={t} at={again + 0.9} from={{ x: 760, y: mid - 105 }} to={{ x: 920, y: mid - 105 }} label="+100" color={INK.warn} arc={0} len={0.7} />

      <div style={{ position: 'absolute', left: D.FX, top: 800, padding: '10px 26px', borderRadius: 999, fontSize: 30, fontWeight: 800, color: INK.good, border: `1.5px solid ${INK.good}`, background: 'rgba(6,50,40,0.6)', boxShadow: `0 0 18px ${INK.good}77`, opacity: vis(t, clash + 0.6, Infinity, 0.4) }}>rollback: số dư vẫn 600</div>
      <Icon3D name="shield" x={1750} y={870} size={130} t={t} at={clash + 0.8} />

      {/* two transactions: the gap comes back */}
      <div style={{ position: 'absolute', left: (D.P + D.CW + D.A) / 2 - 2, top: D.CY - 10, width: 4, height: D.CH + 20, borderRadius: 2, background: INK.bad, boxShadow: `0 0 14px ${INK.bad}`, opacity: vis(t, a3 + 0.5, Infinity, 0.3) }} />
      <div style={{ position: 'absolute', left: D.FX, top: 890, padding: '10px 26px', borderRadius: 999, fontSize: 30, fontWeight: 800, color: INK.bad, border: `1.5px solid ${INK.bad}`, background: 'rgba(60,10,30,0.6)', boxShadow: `0 0 18px ${INK.bad}77`, opacity: vis(t, a3 + 0.9, Infinity, 0.4) }}>tách 2 transaction: khe hở quay lại</div>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 6. summary */

function summary(t: number, c: Cue) {
  return (
    <SoftTheme>
      <SummaryList t={t} cue={c} items={['Mức đảm bảo = thứ tự xử lý và commit', 'Commit trước: mất · xử lý trước: lặp', 'Lặp sửa được, mất thì không', 'Consumer idempotent + bảng dedupe']} />
    </SoftTheme>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { hook, atmost: ordering('amo'), atleast: ordering('alo'), exactly, idem, dedupe, summary }

/** Key-moment sounds, timed to the same cue offsets the scenes animate on. */
const SFX: Record<string, SceneSfx[]> = {
  atmost: [
    { kind: 'error', at: (c) => Math.max(c.at(2) + 0.9, c.at(1) + 1.7 + 5 * 0.5 + 0.4) },
    { kind: 'error', at: (c) => c.at(3) + 0.3 + 0.9 },
  ],
  atleast: [
    { kind: 'error', at: (c) => c.at(2) + 0.7 },
    { kind: 'tick', at: (c) => c.at(3) + 0.3 + 0.9 },
  ],
  exactly: [
    { kind: 'ding', at: (c) => c.at(1) + 0.8 + 0.8 },
    { kind: 'error', at: (c) => c.at(1) + Math.max((c.end(1) - c.at(1)) * 0.55, 2.2) + 0.8 },
  ],
  idem: [{ kind: 'error', at: (c) => c.at(2) + 1.9 + 0.8 }],
  dedupe: [
    { kind: 'ding', at: (c) => c.at(1) + 0.3 + 1.9 },
    { kind: 'error', at: (c) => c.at(2) + 0.2 + 1.7 },
  ],
}

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const deliverySemanticsLesson: Lesson = {
  ...deliverySemanticsScript,
  scenes: deliverySemanticsScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id], sfx: SFX[s.id] })),
  intro: [
    { kind: 'video', scenes: ['hook'] },
    {
      kind: 'quiz',
      title: 'Quick Quiz',
      questions: [q('Đoán trước khi học: consumer nhận 10 tin, commit offset rồi mới xử lý, và chết sau khi xử lý được 5 tin. Khởi động lại thì chuyện gì xảy ra?', ['Cả 10 tin được xử lý lại', '5 tin còn lại bị mất', 'Đúng 5 tin còn lại được xử lý tiếp', 'Kafka tự đọc lại từ đầu'], 1, 'Kẹp đã nhảy tới cuối mẻ trước khi xử lý, nên consumer mới đọc từ sau mẻ đó. Phần 1 giải thích.')],
    },
  ],
  roadmap: [
    'Chặng 1: Thứ tự giữa xử lý và commit quyết định mất, lặp hay đúng một lần: at-most-once, at-least-once, exactly-once.',
    'Chặng 2: Vì sao Kafka chỉ làm trọn exactly-once trong Kafka → Kafka, và việc ghi ra hệ thống ngoài phải dựa vào at-least-once.',
    'Chặng 3: Consumer idempotent: thao tác chạy lại vô hại, bảng dedupe nằm cùng transaction với dữ liệu.',
  ],
  sections: [
    {
      id: 'ba-muc',
      title: 'Ba mức đảm bảo',
      blocks: [
        { kind: 'p', text: 'Mọi consumer đều làm hai việc: **xử lý** và **commit**. Thứ tự của hai việc này quyết định điều gì xảy ra khi chết giữa chừng. Tình huống chung: `poll()` trả về tin 100..109. (📘 sách, ch.4, ch.7)' },
        { kind: 'video', scenes: ['atmost'] },
        { kind: 'video', scenes: ['atleast'] },
        {
          kind: 'table',
          head: ['Mức', 'Thứ tự', 'Chết giữa chừng thì', 'Dùng khi'],
          rows: [
            ['At-most-once', 'commit → xử lý', '**Mất** tin', 'Mất vài tin không sao: metric, log debug'],
            ['At-least-once', 'xử lý → commit', '**Lặp** tin', 'Mặc định của hầu hết hệ thống'],
            ['Exactly-once', 'xử lý + commit nguyên khối', 'Không mất, không lặp', 'Kafka → Kafka (stream processing)'],
          ],
        },
        { kind: 'video', scenes: ['exactly'] },
        {
          kind: 'list',
          items: [
            { title: 'Không phải một cấu hình', text: 'Mức đảm bảo là **thứ tự** giữa xử lý và commit trong code của bạn.' },
            { title: 'Luôn có khe hở', text: 'Không dời kẹp **và** xử lý trong một bước được nếu hai việc nằm ở hai hệ thống khác nhau (Kafka và DB), nên phải chọn mất hay lặp.' },
            { title: 'Chọn lặp còn hơn mất', text: 'Lặp **sửa được** bằng idempotent; mất thì không lấy lại được. Vì vậy at-least-once là mặc định.' },
          ],
        },
        { kind: 'callout', tone: 'warn', title: 'Auto commit không làm hệ thống exactly-once', text: 'Auto commit vẫn tách rời "xử lý" và "commit" (commit nằm trong `poll()` sau đó), nên vẫn có khe hở: chết trước lần commit kế tiếp thì lặp, xử lý bất đồng bộ thì có thể mất. Commit sau **mỗi tin** chỉ thu nhỏ khe hở xuống một tin, không đưa nó về 0. (📘 sách, ch.4, ch.7)' },
        { kind: 'callout', tone: 'info', title: '🎓 Một tin xử lý lỗi thì sao?', text: 'Ghi DB cho tin #30 lỗi, #31 thành công: **không** commit 32, vì commit là một con số "mọi tin trước đó đã xong". Cách 1: chỉ commit tới tin liên tiếp cuối đã xong, `pause()` rồi thử lại tại chỗ. Cách 2: đẩy tin lỗi sang retry topic và đi tiếp (đổi lại mất thứ tự). (📘 sách, ch.7)' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Hệ thống gửi SMS OTP dùng at-least-once. Sự cố xảy ra giữa "gửi SMS" và "commit". Người dùng thấy gì?', ['Không nhận SMS nào', 'Nhận 2 SMS', 'Nhận đúng 1 SMS', 'Kafka tự thu hồi SMS'], 1, 'SMS đã gửi (tác động ra ngoài) nhưng kẹp chưa dời; consumer mới đọc lại tin đó và gửi lần nữa.'),
            q('Vì sao người ta hay nói "chọn lặp còn hơn chọn mất"?', ['Vì lặp nhanh hơn', 'Vì lặp phát hiện và bỏ qua được bằng ID, còn mất thì không ai biết để bù', 'Vì Kafka cấm mất tin', 'Vì commit trước rẻ hơn'], 1, 'Tin lặp có thể dedupe ở phía nhận; tin mất thì không còn dấu vết.'),
          ],
        },
      ],
    },
    {
      id: 'idempotent',
      title: 'Consumer idempotent',
      blocks: [
        { kind: 'video', scenes: ['idem'] },
        {
          kind: 'table',
          head: ['Thao tác', 'Lần 1', 'Lần 2 (lặp)', 'Idempotent?'],
          rows: [
            ['`balance = balance + 100`', '500 → 600', '600 → **700**', '❌'],
            ['`balance = 600`', '500 → 600', '600 → 600', '✅'],
            ['`INSERT` đơn hàng mới', '1 dòng', '**2 dòng**', '❌'],
            ['`UPSERT` theo `order_id`', '1 dòng', 'vẫn 1 dòng', '✅'],
          ],
        },
        { kind: 'video', scenes: ['dedupe'] },
        {
          kind: 'code',
          code: "BEGIN;\nINSERT INTO processed_events(event_id) VALUES ('evt-9f2');  -- khoá chính: trùng là lỗi\nUPDATE accounts SET balance = balance + 100 WHERE id = 42;\nCOMMIT;",
        },
        {
          kind: 'list',
          ordered: true,
          items: [
            { title: 'Bảng dedupe', text: 'ghi `event_id` và cập nhật nghiệp vụ trong **cùng một transaction DB**; lặp thì `INSERT` báo trùng khoá và cả khối bị rollback.' },
            { title: 'Upsert theo khoá tự nhiên', text: 'ghi "trạng thái" thay vì "thay đổi": `INSERT … ON CONFLICT (order_id) DO UPDATE …`.' },
            { title: 'Kiểm tra phiên bản', text: '`UPDATE … WHERE id = 42 AND version < 7`: vừa chống lặp vừa chống tin đến lộn thứ tự.' },
          ],
        },
        { kind: 'callout', tone: 'tip', title: 'Dedupe key lấy từ đâu?', text: 'Tốt nhất là ID nghiệp vụ do producer tạo (`event_id`, `order_id` + loại sự kiện). `(topic, partition, offset)` chỉ chống được **lặp do consumer đọc lại**, không chống được producer **gửi trùng** (hai bản có hai offset khác nhau, ví dụ 500 và 501).' },
        { kind: 'callout', tone: 'info', title: 'Nhắc lại: producer idempotent (Module 3)', text: '`enable.idempotence=true` chống trùng do **retry nội bộ của một phiên producer** (PID + số thứ tự). Ứng dụng restart rồi gửi lại cùng sự kiện thì PID mới, broker không nhận ra. Producer idempotent chống trùng giữa producer và broker; consumer idempotent chống trùng giữa Kafka và hệ thống của bạn: hai thứ bổ sung cho nhau. Đừng tự retry `send()` trong code, hãy để cơ chế retry có sẵn lo. (📘 sách, ch.8)' },
        { kind: 'callout', tone: 'warn', title: 'Bẫy hai transaction', text: 'Ghi `event_id` rồi commit DB, sau đó mới cập nhật số dư trong transaction khác: chết giữa hai bước thì lần đọc lại thấy `event_id` đã có → bỏ qua, nhưng số dư **chưa từng được cộng**. Khe hở giống at-most-once.' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Vì sao `balance = balance + 100` không idempotent còn `balance = 600` thì có?', ['Vì phép cộng chậm hơn', 'Vì phép cộng phụ thuộc giá trị hiện tại, mỗi lần chạy lại giá trị đã đổi', 'Vì phép gán dùng khoá', 'Cả hai đều idempotent'], 1, 'Phép gán đặt về giá trị cố định; chạy lại vẫn ra 600.'),
            q('Vì sao dùng (topic, partition, offset) làm dedupe key không chống được producer gửi trùng?', ['Vì offset không duy nhất', 'Vì hai bản trùng là hai tin riêng biệt với hai offset khác nhau', 'Vì partition đổi liên tục', 'Vì offset bị nén'], 1, 'Cần ID nghiệp vụ nằm trong nội dung tin.'),
          ],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: mất, lặp, đúng một lần',
      blocks: [
        { kind: 'p', text: 'Chọn thứ tự xử lý và commit, cho consumer chết sau n tin, rồi bật consumer idempotent. Xem tin nào mất, tin nào bị xử lý lặp và số dư cuối cùng.' },
        { kind: 'widget', name: 'delivery-lab' },
      ],
    },
    {
      id: 'tom-tat-video',
      title: 'Nhìn lại cả bài',
      blocks: [{ kind: 'video', scenes: ['summary'] }],
    },
  ],
  finalQuiz: [
    q('At-most-once nghĩa là gì?', ['Commit trước, xử lý sau: chết giữa chừng thì mất tin', 'Xử lý trước, commit sau: chết giữa chừng thì lặp', 'Xử lý và commit nguyên khối', 'Commit sau mỗi tin'], 0, 'Kẹp đã vượt qua những tin chưa xử lý nên chúng không được đọc lại.'),
    q('Consumer xử lý xong cả mẻ nhưng chết trước khi commit. Khởi động lại thì?', ['Mất mẻ đó', 'Mẻ đó được xử lý lần hai', 'Kafka tự commit hộ', 'Consumer đọc từ cuối'], 1, 'Kẹp vẫn ở committed offset cũ nên mẻ đó bị đọc lại: at-least-once.'),
    q('Exactly-once của Kafka trọn vẹn khi nào?', ['Khi xử lý là ghi vào PostgreSQL', 'Khi xử lý là ghi sang một topic Kafka khác, cùng transaction với offset', 'Khi bật auto commit', 'Khi đặt acks=1'], 1, 'Transaction chỉ bao được những gì ghi vào Kafka.'),
    q('Bảng dedupe chống trùng đúng khi nào?', ['Ghi event_id và cập nhật dữ liệu trong cùng một transaction DB', 'Ghi event_id ở transaction riêng cho nhanh', 'Dùng offset làm khoá', 'Chỉ cần bật idempotence ở producer'], 0, 'Tách hai bước thì lại có khe hở.'),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao at-least-once là lựa chọn mặc định, chứ không phải at-most-once?',
      keywords: ['lặp', 'mất', 'idempotent', 'dedupe'],
      modelAnswer: 'Vì tin bị lặp thì sửa được: consumer idempotent hoặc bảng dedupe theo event id sẽ bỏ qua lần hai, còn tin bị mất thì không ai biết nó từng tồn tại để xử lý bù. Nên chọn lặp còn hơn chọn mất.',
    },
  ],
  recap: {
    journey:
      'Một mẻ tin, hai việc xử lý và commit → commit trước thì chết giữa chừng làm mất tin → xử lý trước thì chết trước commit làm lặp tin → exactly-once cần cả hai thành một khối, chỉ trọn trong Kafka → Kafka → ra hệ thống ngoài thì dùng at-least-once cộng consumer idempotent → bảng dedupe cùng transaction với dữ liệu làm cho lặp vô hại.',
    points: [
      { title: 'Thứ tự quyết định', text: 'Commit trước → at-most-once (mất). Xử lý trước → at-least-once (lặp). Không phải một cấu hình.' },
      { title: 'Khe hở', text: 'Kafka và DB là hai hệ thống nên luôn có khe hở; lặp sửa được, mất thì không → at-least-once là mặc định.' },
      { title: 'Exactly-once', text: 'Xử lý và commit nguyên khối, trọn vẹn khi Kafka → Kafka. Ra ngoài: at-least-once + idempotent.' },
      { title: 'Idempotent', text: 'Ghi trạng thái thay vì cộng dồn; bảng dedupe cùng transaction DB; upsert; kiểm tra phiên bản.' },
    ],
    next: 'Bài tiếp theo: Transaction & read_committed — gói ghi kết quả và offset vào một transaction, và Last Stable Offset.',
  },
}
