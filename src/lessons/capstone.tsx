import type { ReactNode } from 'react'
import { cameraAt, clamp, lerp, move, sp, span, vis } from '../player/motion-kit'
import { ConsumerUnit, HERO, Icon3D, Packets, Rise, SOFT, SOFT_PANEL, SoftScene, SoftTheme, SummaryList, Wire } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene, SceneSfx } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { capstoneScript } from './capstone-script'

/** This lesson is drawn in the navy glow style. */
const INK = SOFT
const panel = SOFT_PANEL
const WIDE = { x: 960, y: 540, s: 1 }
const HERO_SHADOW = '0 0 34px rgba(77,141,255,0.6), 0 24px 50px rgba(0,4,30,0.6), inset 0 2px 0 rgba(255,255,255,0.5)'
/** Content may appear once the centred title has docked. */
const T0 = 1.9

/** Glossy HERO fill that eases in/out with `k` (0..1) instead of switching background. */
const HeroFill = ({ k, inset = -2 }: { k: number; inset?: number }) => (
  <div style={{ position: 'absolute', inset, borderRadius: 'inherit', background: HERO, boxShadow: HERO_SHADOW, opacity: k, zIndex: -1, pointerEvents: 'none' }} />
)

/** Time at fraction f of beat k. */
const fr = (c: Cue, k: number, f: number) => c.at(k) + (c.end(k) - c.at(k)) * f
const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN')

/* ------------------------------------------------------------------ shared building blocks */

/** A service: a card (or glossy HERO block) with a name and a one-line role. */
function Svc({ x, y, w, h, name, sub, hero = false, size = 28, tone }: { x: number; y: number; w: number; h: number; name: string; sub?: string; hero?: boolean; size?: number; tone?: string }) {
  return (
    <div style={{ ...INK.card, position: 'absolute', left: x, top: y, width: w, height: h, boxSizing: 'border-box', padding: '0 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: hero ? HERO : (INK.card.background as string), border: hero ? 'none' : tone ? `2px solid ${tone}` : (INK.card.border as string), boxShadow: hero ? HERO_SHADOW : (INK.card.boxShadow as string) }}>
      <div style={{ fontSize: size, fontWeight: 800, letterSpacing: -0.5, color: '#fff', whiteSpace: 'nowrap' }}>{name}</div>
      {sub && <div style={{ fontSize: 28, fontWeight: 600, color: hero ? 'rgba(255,255,255,0.88)' : tone ?? INK.faint, whiteSpace: 'nowrap', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

/** A topic tape: optional labelled head cell, then equal cells. `flash` is the cell currently being read/written. */
function Tape({ x, y, w, h = 46, n, head, filled, flash, color }: { x: number; y: number; w: number; h?: number; n: number; head?: string; filled: number; flash?: number; color?: string }) {
  const hw = head ? 64 : 0
  const cw = (w - hw) / (head ? n - 1 : n)
  const cells = Array.from({ length: n }, (_, j) => {
    const isHead = !!head && j === 0
    const idx = head ? j - 1 : j
    const st = isHead ? 'filled' : flash === idx ? 'new' : idx < filled ? 'filled' : 'empty'
    return (
      <div key={j} style={{ width: isHead ? hw : cw, height: h, padding: '0 2px', boxSizing: 'border-box' }}>
        <div style={{ height: '100%', borderRadius: 12, boxSizing: 'border-box', display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 800, color: '#fff', background: st === 'filled' ? (color ?? INK.cell.filled) : st === 'new' ? INK.cell.new : INK.cell.empty, border: st === 'empty' ? '1.5px solid rgba(110,160,255,0.35)' : st === 'new' ? '2px solid #fff' : 'none', boxShadow: st === 'new' ? '0 0 20px rgba(140,185,255,0.95)' : st === 'filled' ? 'inset 0 2px 0 rgba(255,255,255,0.45), 0 8px 16px rgba(0,8,50,0.4)' : undefined }}>
          {isHead ? head : ''}
        </div>
      </div>
    )
  })
  return <div style={{ position: 'absolute', left: x, top: y, display: 'flex' }}>{cells}</div>
}

const Label = ({ x, y, text, sub, w }: { x: number; y: number; text: string; sub?: string; w?: number }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, whiteSpace: 'nowrap' }}>
    <span style={{ fontSize: 30, fontWeight: 800, color: INK.text }}>{text}</span>
    {sub && <span style={{ fontSize: 28, fontWeight: 600, color: INK.faint, marginLeft: 14 }}>{sub}</span>}
  </div>
)

/** Glowing rounded label (HERO = solid blue). */
const Chip = ({ x, y, text, hero = false, color, size = 28, o = 1, w }: { x: number; y: number; text: string; hero?: boolean; color?: string; size?: number; o?: number; w?: number }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, boxSizing: 'border-box', textAlign: 'center', padding: '8px 22px', borderRadius: 999, whiteSpace: 'nowrap', fontSize: size, fontWeight: 800, color: hero ? '#fff' : color ?? '#fff', background: hero ? HERO : 'rgba(8,22,82,0.92)', border: hero ? 'none' : `1.5px solid ${color ?? '#6ea2ff'}`, boxShadow: hero ? '0 0 26px rgba(77,141,255,0.7)' : `0 0 16px ${color ?? 'rgba(77,141,255,0.6)'}`, opacity: clamp(o) }}>
      {text}
    </div>
)

/** Dim dashed placeholder for a slot that has not been revealed yet; fades out as the real element enters. */
const Ghost = ({ x, y, w, h, o }: { x: number; y: number; w: number; h: number; o: number }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, boxSizing: 'border-box', borderRadius: 22, border: '2px dashed rgba(140,185,255,0.8)', background: 'rgba(40,80,190,0.22)', opacity: clamp(o) }} />
)

/* ------------------------------------------------------------------ the whole system diagram (used by two scenes) */

type Part = 'gen' | 'orders' | 'procs' | 'inbox' | 'status' | 'query' | 'retry' | 'dlq' | 'lag' | 'brokers'

const G = {
  gen: { x: 40, y: 310, w: 280, h: 130 },
  tapeX: 360,
  tapeW: 300,
  tapeY: 225,
  tapePitch: 62,
  procX: 750,
  procW: 330,
  procY: (k: number) => 225 + k * 130,
  inbox: { x: 790, y: 640, w: 290, h: 76 },
  status: { x: 1250, y: 340, w: 300 },
  query: { x: 1650, y: 320, w: 230, h: 110 },
  retry: { x: 360, y: 790, w: 300 },
  dlq: { x: 750, y: 790, w: 330 },
  lag: { x: 1250, y: 770, w: 300, h: 110 },
}
const rowY = (p: number) => G.tapeY + p * G.tapePitch + 23

/**
 * The order pipeline. `at[part]` = when a part enters (missing = hidden); `lit(part)` in 0..1 brightens the part
 * being talked about and dims the rest. Wires and packets start once both ends exist.
 */
function Arch({ t, at, lit, ghostFrom }: { t: number; at: Partial<Record<Part, number>>; lit?: (p: Part) => number; ghostFrom?: number }) {
  const T = (p: Part) => at[p] ?? Infinity
  const wrap = (p: Part, node: ReactNode) => {
    const g = lit ? lit(p) : 1
    return (
      <Rise t={t} at={T(p)}>
        <div style={{ opacity: lit ? 0.32 + 0.68 * g : 1, filter: lit && g > 0.05 ? `drop-shadow(0 0 ${Math.round(20 * g)}px rgba(120,180,255,${(0.9 * g).toFixed(2)}))` : undefined }}>{node}</div>
      </Rise>
    )
  }
  const both = (a: Part, b: Part) => Math.max(T(a), T(b)) + 0.25
  const dim = (a: Part, b: Part) => (lit ? 0.3 + 0.7 * Math.max(lit(a), lit(b)) : 1)
  const edge = (key: string, a: Part, b: Part, from: { x: number; y: number }, to: { x: number; y: number }, every: number, off: number, color?: string, len = 0.7) => {
    const s = both(a, b)
    if (!Number.isFinite(s) || t < s) return null
    return (
      <div key={key} style={{ opacity: dim(a, b) }}>
        <Wire from={from} to={to} color={color ?? INK.line} p={move(t, s, 0.5)} flow={t} />
        <Packets t={t} from={from} to={to} start={s + 0.4 + off} every={every} len={len} size={18} color={color} />
      </div>
    )
  }
  const flashAt = (p: number) => 1 + (Math.floor(t * 2 + p * 1.4) % 6)
  const orderN = clamp(Math.floor((t - T('gen') - 0.3) * 140), 0, 1000)
  const BOX: Partial<Record<Part, { x: number; y: number; w: number; h: number }>> = {
    gen: G.gen,
    orders: { x: G.tapeX, y: 170, w: G.tapeW, h: 411 },
    procs: { x: G.procX, y: 170, w: G.procW, h: 425 },
    inbox: G.inbox,
    status: { x: G.status.x, y: 285, w: G.status.w, h: 190 },
    query: G.query,
    retry: { x: G.retry.x, y: 735, w: G.retry.w, h: 185 },
    dlq: { x: G.dlq.x, y: 735, w: G.dlq.w, h: 185 },
    lag: G.lag,
  }
  return (
    <>
      {ghostFrom !== undefined &&
        (Object.keys(BOX) as Part[]).map((p) => {
          const b = BOX[p]!
          const gone = Number.isFinite(T(p)) ? clamp((t - T(p)) / 0.3) : 0
          return <Ghost key={`gh${p}`} x={b.x} y={b.y} w={b.w} h={b.h} o={0.6 * span(t, ghostFrom, ghostFrom + 0.4) * (1 - gone)} />
        })}
      {/* wires first so units sit on top */}
      {[0, 1, 2, 3, 4, 5].map((p) => edge(`g${p}`, 'gen', 'orders', { x: G.gen.x + G.gen.w, y: G.gen.y + 65 }, { x: G.tapeX, y: rowY(p) }, 1.2, p * 0.19))}
      {[0, 1, 2, 3, 4, 5].map((p) => edge(`u${p}`, 'orders', 'procs', { x: G.tapeX + G.tapeW, y: rowY(p) }, { x: G.procX - 2, y: G.procY(Math.floor(p / 2)) + 59 }, 1.0, p * 0.15, undefined, 0.6))}
      {edge('st', 'procs', 'status', { x: G.procX + G.procW, y: 414 }, { x: G.status.x, y: 375 }, 0.8, 0)}
      {edge('qu', 'status', 'query', { x: G.status.x + G.status.w, y: 375 }, { x: G.query.x, y: 375 }, 1.4, 0.3, INK.good, 0.6)}
      {edge('rt', 'procs', 'retry', { x: G.procX + 20, y: 606 }, { x: G.retry.x + G.retry.w, y: G.retry.y + 30 }, 1.8, 0.2, INK.warn, 0.9)}
      {edge('dq', 'retry', 'dlq', { x: G.retry.x + G.retry.w, y: G.retry.y + 30 }, { x: G.dlq.x, y: G.dlq.y + 30 }, 1.6, 0.5, INK.bad, 0.6)}
      {edge('ib', 'procs', 'inbox', { x: G.procX + G.procW / 2, y: 606 }, { x: G.procX + G.procW / 2 + 45, y: G.inbox.y }, 1.3, 0, undefined, 0.5)}
      {T('lag') < Infinity && t >= both('lag', 'procs') && (
        <div style={{ opacity: dim('lag', 'procs') }}>
          <Wire from={{ x: G.lag.x, y: G.lag.y + 30 }} to={{ x: G.procX + G.procW + 6, y: 590 }} color={INK.warn} p={move(t, both('lag', 'procs'), 0.6)} dashed />
        </div>
      )}

      {wrap('gen', <Svc x={G.gen.x} y={G.gen.y} w={G.gen.w} h={G.gen.h} name="order-generator" sub={`đơn #${orderN}`} hero size={26} />)}
      {wrap(
        'orders',
        <>
          <Label x={G.tapeX} y={170} text="orders" sub="6 partition" />
          {[0, 1, 2, 3, 4, 5].map((p) => (
            <Tape key={p} x={G.tapeX} y={G.tapeY + p * G.tapePitch} w={G.tapeW} n={8} head={`P${p}`} filled={6} flash={flashAt(p)} />
          ))}
        </>,
      )}
      {wrap(
        'procs',
        <>
          <Label x={G.procX} y={170} text="order-processor" />
          {[0, 1, 2].map((k) => (
            <ConsumerUnit key={k} x={G.procX} y={G.procY(k)} w={G.procW} name={`processor-${k + 1}`} parts={[`P${2 * k}`, `P${2 * k + 1}`]} t={t} busy={(t * 1.1 + k * 0.3) % 1} />
          ))}
        </>,
      )}
      {wrap('inbox', <Svc x={G.inbox.x} y={G.inbox.y} w={G.inbox.w} h={G.inbox.h} name="inbox · SQLite" size={28} />)}
      {wrap(
        'status',
        <>
          <Label x={G.status.x} y={285} text="order-status" />
          <Tape x={G.status.x} y={G.status.y} w={G.status.w} h={70} n={5} filled={4} flash={(Math.floor(t * 1.5) % 4)} />
          <div style={{ position: 'absolute', left: G.status.x, top: 422, fontSize: 28, fontWeight: 600, color: INK.faint, whiteSpace: 'nowrap' }}>nén · key = orderId</div>
        </>,
      )}
      {wrap('query', <Svc x={G.query.x} y={G.query.y} w={G.query.w} h={G.query.h} name="status-query" sub="CLI" size={26} />)}
      {wrap(
        'retry',
        <>
          <Label x={G.retry.x} y={735} text="orders.retry.1" />
          <Tape x={G.retry.x} y={G.retry.y} w={G.retry.w} h={60} n={5} filled={2} flash={2 + (Math.floor(t * 1.2) % 3)} color={`linear-gradient(160deg, ${INK.warn}, #b87408)`} />
          <div style={{ position: 'absolute', left: G.retry.x, top: 856, fontSize: 28, fontWeight: 600, color: INK.warn, whiteSpace: 'nowrap' }}>chờ ≥ 10 giây</div>
        </>,
      )}
      {wrap(
        'dlq',
        <>
          <Label x={G.dlq.x} y={735} text="orders.dlq" />
          <Tape x={G.dlq.x} y={G.dlq.y} w={G.dlq.w} h={60} n={5} filled={2} color={`linear-gradient(160deg, ${INK.bad}, #a8202e)`} />
          <div style={{ position: 'absolute', left: G.dlq.x, top: 856, fontSize: 28, fontWeight: 600, color: INK.bad, whiteSpace: 'nowrap' }}>giữ ≥ 14 ngày</div>
        </>,
      )}
      {wrap('lag', <Svc x={G.lag.x} y={G.lag.y} w={G.lag.w} h={G.lag.h} name="lag-monitor" sub="đo mỗi 10 giây" size={28} tone={INK.warn} />)}
      {T('lag') < Infinity && (
        <div style={{ opacity: lit ? 0.32 + 0.68 * lit('lag') : 1 }}>
          <Icon3D name="bell" x={1700} y={825} size={120} t={t} at={T('lag') + 0.7} />
        </div>
      )}
      {T('brokers') < Infinity && wrap(
        'brokers',
        <>
          {[0, 1, 2].map((k) => (
            <div key={k} style={{ ...INK.card, position: 'absolute', left: G.tapeX + k * 104, top: 614, width: 92, height: 56, boxSizing: 'border-box', display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 800, color: '#fff' }}>
              B{k + 1}
            </div>
          ))}
        </>,
      )}
    </>
  )
}

/* ------------------------------------------------------------------ 0. cold open: three bans */

function hook(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const nodes = [
    { name: 'order-generator', sub: 'producer', at: a0 + 0.3, hero: true },
    { name: 'orders', sub: 'topic · 6 partition', at: a0 + 1.1 },
    { name: 'order-processor', sub: 'consumer group', at: a0 + 1.9 },
    { name: 'order-status', sub: 'topic nén', at: a0 + 2.7 },
  ]
  const NX = (k: number) => 100 + k * 460
  const cards = [
    { icon: 'trash-can' as const, ban: 'Không mất sự kiện', proof: 'khớp 100% expected.json', at: fr(c, 1, 0.16) },
    { icon: 'copy' as const, ban: 'Không cộng trùng', proof: 'eventId duy nhất = số sự kiện', at: fr(c, 1, 0.45) },
    { icon: 'pause' as const, ban: 'Không kẹt vì tin hỏng', proof: 'đúng 10 tin vào DLQ', at: fr(c, 1, 0.72) },
  ]
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, { x: 960, y: 520, s: 1 }], [a1 + 1, { x: 960, y: 600, s: 1.05 }, 1.4], [a2 + 3, WIDE, 1.4]])}>
      {nodes.map((n, k) => (
        <Ghost key={`gn${n.name}`} x={NX(k)} y={260} w={340} h={130} o={0.6 * span(t, 0.1, 0.5) * (1 - clamp((t - n.at) / 0.3))} />
      ))}
      {cards.map((cd, k) => (
        <Ghost key={`gc${cd.ban}`} x={150 + k * 550} y={520} w={520} h={330} o={0.6 * span(t, 0.1, 0.5) * (1 - clamp((t - cd.at) / 0.3))} />
      ))}
      {nodes.map((n, k) => (
        <div key={n.name}>
          {k > 0 && t >= n.at && (
            <>
              <Wire from={{ x: NX(k - 1) + 340, y: 325 }} to={{ x: NX(k) - 4, y: 325 }} color={INK.line} p={move(t, n.at, 0.4)} flow={t} />
              <Packets t={t} from={{ x: NX(k - 1) + 340, y: 325 }} to={{ x: NX(k) - 4, y: 325 }} start={n.at + 0.5} every={0.5} len={0.7} size={20} />
            </>
          )}
          <Rise t={t} at={n.at}>
            <Svc x={NX(k)} y={260} w={340} h={130} name={n.name} sub={n.sub} hero={n.hero} size={30} />
          </Rise>
        </div>
      ))}
      {cards.map((cd, k) => {
        const proofAt = fr(c, 2, 0.12 + k * 0.28)
        const ok = t >= proofAt
        return (
          <Rise key={cd.ban} t={t} at={cd.at - 0.05}>
            <div style={{ ...INK.card, position: 'absolute', left: 150 + k * 550, top: 520, width: 520, height: 330, boxSizing: 'border-box', border: ok ? `2px solid ${INK.good}` : `2px solid ${INK.bad}`, boxShadow: ok ? `0 0 30px ${INK.good}66` : `0 0 30px ${INK.bad}55` }}>
              <Icon3D name={cd.icon} x={260} y={110} size={140} t={t} at={cd.at} />
              <div style={{ position: 'absolute', left: 0, right: 0, top: 190, textAlign: 'center', fontSize: 34, fontWeight: 800, color: INK.text }}>{cd.ban}</div>
              <div style={{ position: 'absolute', left: 0, right: 0, top: 250, textAlign: 'center', fontSize: 26, fontWeight: 700, color: ok ? INK.good : INK.bad, opacity: ok ? vis(t, proofAt, Infinity, 0.3) : 1 }}>{ok ? `✓ ${cd.proof}` : '✕ cấm'}</div>
            </div>
          </Rise>
        )
      })}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 1. the system, piece by piece */

function system(t: number, c: Cue) {
  const [a1, a2, a3] = [c.at(1), c.at(2), c.at(3)]
  const at: Partial<Record<Part, number>> = {
    gen: T0,
    orders: a1 + 0.2,
    procs: fr(c, 1, 0.38),
    inbox: fr(c, 1, 0.82),
    status: a2 + 0.2,
    query: fr(c, 2, 0.5),
    retry: a3 + 0.2,
    dlq: fr(c, 3, 0.4),
    lag: fr(c, 3, 0.7),
  }
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE]])} title={{ kicker: 'KIẾN TRÚC', text: 'Bức tranh tổng thể' }}>
      <Arch t={t} at={at} ghostFrom={T0} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 2. milestones light up their part */

const MILES: { id: string; name: string; modules: string; spec: string; parts: Part[] }[] = [
  { id: 'M1', name: 'Cluster + topic', modules: 'Module 1 · 2 · 4 · 7', spec: 'RF 3 · minISR 2', parts: ['orders', 'brokers', 'retry', 'dlq', 'status'] },
  { id: 'M2', name: 'Producer', modules: 'Module 2 · 3 · 10', spec: 'acks=all · idempotent', parts: ['gen', 'orders'] },
  { id: 'M3', name: 'Consumer + inbox', modules: 'Module 5 · 6 · 10', spec: '1 giao dịch SQLite', parts: ['procs', 'inbox'] },
  { id: 'M4', name: 'Read model', modules: 'Module 7 · 10', spec: 'compact · status-query', parts: ['status', 'query'] },
  { id: 'M5', name: 'Retry + DLQ', modules: 'Module 10', spec: '3 lần rồi DLQ', parts: ['retry', 'dlq', 'procs'] },
  { id: 'M6', name: 'Giám sát + sự cố', modules: 'Module 4 · 9', spec: 'lag > 500 × 3 lần', parts: ['lag', 'procs'] },
]

function requirements(t: number, c: Cue) {
  const starts = MILES.map((_, k) => c.at(k))
  const allAt = fr(c, 5, 0.58)
  const at: Partial<Record<Part, number>> = { gen: T0, orders: T0 + 0.25, brokers: T0 + 0.5, procs: T0 + 0.6, inbox: T0 + 0.8, status: T0 + 0.95, query: T0 + 1.1, retry: T0 + 1.2, dlq: T0 + 1.35, lag: T0 + 1.5 }
  const lit = (p: Part) => {
    if (t < c.at(0)) return 0.5
    const all = span(t, allAt, allAt + 0.4)
    let g = 0
    MILES.forEach((m, k) => {
      if (m.parts.includes(p)) g = Math.max(g, vis(t, starts[k] - 0.1, k < 5 ? starts[k + 1] - 0.1 : allAt, 0.4))
    })
    return Math.max(g, all)
  }
  const intro = t < c.at(0)
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE]])} title={{ kicker: 'YÊU CẦU', text: 'Sáu mốc, sáu module' }}>
      <Arch t={t} at={at} lit={intro ? undefined : lit} />
      {MILES.map((m, k) => {
        const on = k < 5 ? starts[k + 1] - 0.1 : allAt
        const o = vis(t, Math.max(starts[k] + 0.1, T0 - 0.2), on, 0.3)
        const specAt = fr(c, k, 0.45)
        return (
          <div key={m.id} style={{ opacity: o }}>
            <Chip x={90} y={936} text={`${m.id} · ${m.name}`} size={30} />
            <Chip x={760} y={936} text={m.modules} hero size={30} />
            <Chip x={1250} y={936} text={m.spec} color={INK.good} size={28} o={vis(t, specAt, Infinity, 0.3)} />
          </div>
        )
      })}
      <div style={{ opacity: vis(t, Math.max(allAt + 0.2, T0), Infinity, 0.4) }}>
        <Chip x={90} y={936} text="6 mốc ↔ Module 1 → 10" hero size={32} />
      </div>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 3. acceptance criteria */

const ACS = [
  { n: 'AC1', title: 'Chạy sạch', sub: '1.000 đơn · khớp 100%' },
  { n: 'AC2', title: 'Gửi trùng 5%', sub: 'inbox loại trùng' },
  { n: 'AC3', title: 'kill -9 consumer', sub: 'tin đọc lại bị bỏ qua' },
  { n: 'AC4', title: 'Dừng 1 broker', sub: 'không mất tin' },
  { n: 'AC5', title: 'Dừng 2 broker', sub: 'từ chối ghi, có lỗi' },
  { n: 'AC6', title: '10 tin hỏng', sub: 'đúng 10 tin vào DLQ' },
  { n: 'AC7', title: 'Lỗi tạm thời 2%', sub: 'retry rồi xử lý xong' },
  { n: 'AC8', title: 'Dừng processor', sub: 'lag báo động rồi về 0' },
  { n: 'AC9', title: 'Replay từ đầu', sub: 'khớp bản đang chạy' },
]

function acceptance(t: number, c: Cue) {
  const a2 = c.at(2)
  const cardAt = (k: number) => T0 + k * 0.33
  // AC1 / AC9 light up as they are named; the rest tick off when verify.py reports (beat 2)
  const lightAt = (k: number) => (k === 0 ? fr(c, 1, 0.05) : k === 8 ? fr(c, 1, 0.3) : Infinity)
  const tickAt = (k: number) => (k === 0 ? fr(c, 1, 0.5) : k === 8 ? fr(c, 1, 0.62) : fr(c, 2, 0.35 + (k - 1) * 0.07))
  const vStart = T0 + 1
  const matched = lerp(0, 1000, move(t, fr(c, 2, 0.3), 3.4))
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a2 + 0.4, { x: 960, y: 560, s: 1.03 }, 1.4]])} title={{ kicker: 'TIÊU CHÍ', text: 'Chín tiêu chí đo được' }}>
      {ACS.map((a, k) => {
        const lit = vis(t, lightAt(k), tickAt(k) + 1.2, 0.3)
        const ok = t >= tickAt(k)
        const okK = span(t, tickAt(k), tickAt(k) + 0.3)
        return (
          <Rise key={a.n} t={t} at={cardAt(k)}>
            <div style={{ ...INK.card, position: 'absolute', left: 120 + (k % 3) * 570, top: 205 + Math.floor(k / 3) * 215, width: 540, height: 190, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 18, padding: '0 24px', isolation: 'isolate', border: ok ? `2px solid color-mix(in srgb, ${INK.good} ${Math.round(okK * 100)}%, #6ea2ff)` : (INK.card.border as string), boxShadow: ok ? `0 0 ${Math.round(24 * okK)}px ${INK.good}55` : (INK.card.boxShadow as string), transform: lit > 0 ? `scale(${1 + 0.03 * lit})` : undefined }}>
              <HeroFill k={lit} inset={ok ? 0 : -2} />
              <div style={{ width: 92, height: 92, flex: 'none', borderRadius: 26, display: 'grid', placeItems: 'center', fontSize: 32, fontWeight: 800, color: `rgb(${Math.round(lerp(255, 26, lit))},${Math.round(lerp(255, 60, lit))},${Math.round(lerp(255, 192, lit))})`, background: `linear-gradient(rgba(255,255,255,${lit.toFixed(2)}), rgba(255,255,255,${lit.toFixed(2)})), ${HERO}`, boxShadow: '0 0 16px rgba(91,151,255,0.6)' }}>{a.n}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 34, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>{a.title}</div>
                <div style={{ fontSize: 28, fontWeight: 600, color: `color-mix(in srgb, rgba(255,255,255,0.92) ${Math.round(lit * 100)}%, ${INK.faint})`, whiteSpace: 'nowrap', marginTop: 4 }}>{a.sub}</div>
              </div>
              <div style={{ width: 52, height: 52, flex: 'none', borderRadius: 26, display: 'grid', placeItems: 'center', fontSize: 34, fontWeight: 800, color: '#06251a', background: INK.good, boxShadow: `0 0 18px ${INK.good}`, opacity: vis(t, tickAt(k), Infinity, 0.25), transform: `scale(${0.6 + 0.4 * sp(t, tickAt(k))})` }}>✓</div>
            </div>
          </Rise>
        )
      })}
      <Rise t={t} at={vStart}>
        <div style={{ ...panel, left: 120, top: 860, width: 1680, height: 130, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 60, padding: '0 40px' }}>
          <div style={{ fontFamily: MONO, fontSize: 36, fontWeight: 700, color: '#fff' }}>$ python verify.py</div>
          <div style={{ fontSize: 40, fontWeight: 800, color: matched >= 1000 ? INK.good : INK.text }}>khớp {fmt(matched)} / 1.000</div>
          <div style={{ fontSize: 40, fontWeight: 800, color: matched >= 1000 ? INK.good : INK.warn }}>lệch {fmt(1000 - matched)}</div>
        </div>
      </Rise>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 4. failure drills */

function drills(t: number, c: Cue) {
  const [a1, a2, a3, a4] = [1, 2, 3, 4].map((k) => c.at(k))
  const beat = [a1, a2, a3, a4]
  const nextBeat = [a2, a3, a4, c.end(4) + 3]
  const rowAt = (i: number) => T0 + i * 0.5
  const verdictAt = [fr(c, 1, 0.8), fr(c, 2, 0.9), fr(c, 3, 0.88), fr(c, 4, 0.92)]
  const Y = (i: number) => 215 + i * 180
  const head = [
    { chip: 'AC3', title: 'Kill một consumer', sub: 'kill -9 giữa lúc xử lý', done: 'khớp 100%' },
    { chip: 'AC4 · AC5', title: 'Dừng broker', sub: 'một rồi hai broker', done: 'từ chối = đúng' },
    { chip: 'AC2', title: 'Gửi trùng 5%', sub: 'cùng một eventId', done: '3.000 = 3.000' },
    { chip: 'AC6', title: '10 tin hỏng', sub: 'JSON sai, type lạ', done: '10 / 10 vào DLQ' },
  ]
  /* row 0: consumer killed and restarted */
  const kill = fr(c, 1, 0.05)
  const back = fr(c, 1, 0.3)
  const skip = fr(c, 1, 0.52)
  const dead0 = t >= kill && t < back
  const row0 = (
    <>
      <Tape x={0} y={52} w={448} h={56} n={8} filled={t >= fr(c, 1, 0.62) ? 8 : 6} />
      {[4, 5].map((j) => (
        <div key={j} style={{ position: 'absolute', left: j * 56 + 4, top: 52, width: 48, height: 56, borderRadius: 12, border: `3px solid ${INK.warn}`, boxSizing: 'border-box', opacity: vis(t, back, skip + 1.2, 0.2), boxShadow: `0 0 16px ${INK.warn}` }} />
      ))}
      <div style={{ position: 'absolute', left: 224, top: 6, width: 112, textAlign: 'center', fontSize: 28, fontWeight: 800, color: INK.warn, opacity: vis(t, back, Infinity, 0.2) }}>{t < skip ? 'đọc lại' : 'bỏ qua'}</div>
      <div style={{ position: 'absolute', left: 520, top: 40, width: 250, height: 80, boxSizing: 'border-box', borderRadius: 20, display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 800, color: dead0 ? INK.bad : '#fff', background: dead0 ? 'rgba(60,10,30,0.7)' : HERO, border: dead0 ? `2px solid ${INK.bad}` : 'none', boxShadow: dead0 ? `0 0 20px ${INK.bad}` : HERO_SHADOW }}>
        {dead0 ? '✕ kill -9' : t >= back ? 'C2 · chạy lại' : 'C2 · đang chạy'}
      </div>
      {!dead0 && <Packets t={t} from={{ x: 452, y: 80 }} to={{ x: 516, y: 80 }} start={0.5} every={0.5} len={0.5} size={18} />}
    </>
  )
  /* row 1: one broker down is fine, two is refused */
  const k3 = fr(c, 2, 0.08)
  const k2 = fr(c, 2, 0.52)
  const isr = t >= k2 ? 1 : t >= k3 ? 2 : 3
  const bro = [0, 1, 2].map((b) => (b === 2 ? t >= k3 : b === 1 ? t >= k2 : false))
  const row1 = (
    <>
      <div style={{ position: 'absolute', left: 0, top: 40, width: 150, height: 70, boxSizing: 'border-box', borderRadius: 18, display: 'grid', placeItems: 'center', fontSize: 26, fontWeight: 800, color: '#fff', background: HERO, boxShadow: HERO_SHADOW }}>producer</div>
      <Packets t={t} from={{ x: 156, y: 75 }} to={{ x: 286, y: 75 }} start={0.5} end={t >= k2 ? k2 : Infinity} every={0.4} len={0.6} size={18} />
      {bro.map((d, b) => (
        <div key={b} style={{ position: 'absolute', left: 290 + b * 122, top: 40, width: 102, height: 70, boxSizing: 'border-box', borderRadius: 18, display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 800, color: d ? INK.bad : '#fff', background: d ? 'rgba(60,10,30,0.7)' : (INK.card.background as string), border: d ? `2px solid ${INK.bad}` : (INK.card.border as string), boxShadow: d ? `0 0 16px ${INK.bad}77` : (INK.card.boxShadow as string) }}>
          {d ? '✕' : `B${b + 1}`}
        </div>
      ))}
      <div style={{ ...INK.card, position: 'absolute', left: 664, top: 26, width: 136, height: 96, boxSizing: 'border-box', display: 'grid', placeItems: 'center', textAlign: 'center', lineHeight: 1.25, fontSize: 28, fontWeight: 800, color: isr >= 2 ? INK.good : INK.bad, border: `2px solid ${isr >= 2 ? INK.good : INK.bad}` }}>
        <div>
          ISR {isr}/3
          <div style={{ fontSize: 28, fontWeight: 600, color: INK.faint, marginTop: 4 }}>cần ≥ 2</div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 150, top: 124, fontSize: 28, fontWeight: 800, color: t >= k2 ? INK.bad : INK.good, whiteSpace: 'nowrap', opacity: vis(t, fr(c, 2, 0.28), Infinity, 0.2) }}>{t >= k2 ? '✕ lỗi: không đủ replica → từ chối ghi' : '✓ vẫn ghi được · không mất tin'}</div>
    </>
  )
  /* row 2: duplicates dropped by the inbox */
  const ids = ['e1', 'e2', 'e2', 'e3', 'e3', 'e4']
  const dupAt = (k: number) => fr(c, 3, 0.04 + k * 0.1)
  const seen = ids.filter((_, k) => t >= dupAt(k)).length
  const uniq = new Set(ids.slice(0, seen)).size
  const finalAt = fr(c, 3, 0.62)
  const row2 = (
    <>
      {ids.map((id, k) => {
        const dup = ids.indexOf(id) !== k
        const shown = t >= dupAt(k)
        return (
          <div key={k} style={{ position: 'absolute', left: k * 112, top: 10, width: 100, height: 56, opacity: shown ? 1 : 0.35 }}>
            <div style={{ height: '100%', boxSizing: 'border-box', borderRadius: 14, display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 800, color: '#fff', background: dup && shown ? 'rgba(80,50,10,0.8)' : INK.cell.filled, border: dup && shown ? `2.5px dashed ${INK.warn}` : 'none', boxShadow: dup && shown ? `0 0 14px ${INK.warn}` : 'inset 0 2px 0 rgba(255,255,255,0.45)' }}>{id}</div>
            {dup && shown && <div style={{ position: 'absolute', left: 0, right: 0, top: 70, textAlign: 'center', fontSize: 28, lineHeight: 1, fontWeight: 800, color: INK.warn }}>trùng</div>}
          </div>
        )
      })}
      <div style={{ position: 'absolute', left: 0, top: 126, fontSize: 28, lineHeight: 1, fontWeight: 800, whiteSpace: 'nowrap', color: t >= finalAt ? INK.good : INK.text }}>
        {t >= finalAt ? '✓ eventId duy nhất = 3.000 = số sự kiện' : `nhận ${seen} · inbox giữ ${uniq}`}
      </div>
    </>
  )
  /* row 3: ten poison messages go straight to the DLQ */
  const p0 = fr(c, 4, 0.05)
  const every = (c.end(4) - c.at(4)) * 0.72 / 10
  const arrived = clamp(Math.floor((t - p0 - 0.8) / every) + 1, 0, 10)
  const sinceHit = arrived > 0 ? t - (p0 + 0.8 + (arrived - 1) * every) : Infinity
  const pulse = arrived > 0 ? Math.max(0, 1 - sinceHit / (arrived >= 10 ? 0.8 : 0.3)) : 0
  const row3 = (
    <>
      <Packets t={t} from={{ x: 0, y: 70 }} to={{ x: 520, y: 70 }} start={p0} end={p0 + 9.5 * every} every={every} len={0.8} color={INK.bad} size={26} />
      <div style={{ position: 'absolute', left: 540, top: 30, width: 250, height: 80, boxSizing: 'border-box', ...INK.card, display: 'grid', placeItems: 'center', fontSize: 30, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: arrived >= 10 ? INK.good : '#fff', border: `2px solid ${arrived >= 10 ? INK.good : INK.bad}`, transform: `scale(${1 + 0.12 * pulse})`, boxShadow: pulse > 0 ? `0 0 ${Math.round(34 * pulse)}px ${arrived >= 10 ? INK.good : INK.bad}` : (INK.card.boxShadow as string) }}>DLQ {arrived} / 10</div>
      <div style={{ position: 'absolute', left: 0, top: 116, display: 'flex', alignItems: 'center', gap: 16, opacity: vis(t, fr(c, 4, 0.62), Infinity, 0.3) }}>
        <span style={{ width: 16, height: 16, borderRadius: 8, background: INK.good, boxShadow: `0 0 12px ${INK.good}` }} />
        <span style={{ fontSize: 28, fontWeight: 800, color: INK.good }}>consumer chính vẫn chạy</span>
        <div style={{ width: 220, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.18)' }}>
          <div style={{ width: `${((t * 0.9) % 1) * 100}%`, height: '100%', borderRadius: 4, background: INK.good }} />
        </div>
      </div>
    </>
  )
  const rows = [row0, row1, row2, row3]
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE]])} title={{ kicker: 'DIỄN TẬP', text: 'Bốn bài diễn tập sự cố' }}>
      {head.map((h, i) => {
        const passed = t >= verdictAt[i]
        const running = t >= beat[i] && !passed
        const active = t >= beat[i] && t < nextBeat[i]
        return (
          <Rise key={h.chip} t={t} at={rowAt(i)}>
            <div style={{ position: 'absolute', left: 100, top: Y(i), width: 1720, height: 160 }}>
              <div style={{ ...INK.card, position: 'absolute', inset: 0, border: passed ? `2px solid ${INK.good}` : active ? '2px solid #9cc2ff' : (INK.card.border as string), boxShadow: passed ? `0 0 28px ${INK.good}55` : active ? '0 0 30px rgba(120,180,255,0.6)' : (INK.card.boxShadow as string) }} />
              <Chip x={30} y={16} text={h.chip} hero size={26} />
              <div style={{ position: 'absolute', left: 30, top: 70, fontSize: 32, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>{h.title}</div>
              <div style={{ position: 'absolute', left: 30, top: 112, fontSize: 28, fontWeight: 600, color: INK.faint, whiteSpace: 'nowrap' }}>{h.sub}</div>
              <div style={{ position: 'absolute', left: 470, top: 0, width: 800, height: 160 }}>{rows[i]}</div>
              <div style={{ position: 'absolute', left: 1330, top: 0, width: 380, height: 160 }}>
                {passed ? (
                  <>
                    <Icon3D name="tick" x={60} y={80} size={100} t={t} at={verdictAt[i]} />
                    <div style={{ position: 'absolute', left: 130, top: 40, fontSize: 38, fontWeight: 800, color: INK.good, opacity: vis(t, verdictAt[i], Infinity, 0.3) }}>đạt</div>
                    <div style={{ position: 'absolute', left: 130, top: 88, fontSize: 28, fontWeight: 700, color: INK.text, whiteSpace: 'nowrap', opacity: vis(t, verdictAt[i] + 0.2, Infinity, 0.3) }}>{h.done}</div>
                  </>
                ) : (
                  <div style={{ position: 'absolute', left: 20, top: 56, fontSize: 30, fontWeight: 700, color: running ? INK.warn : INK.faint }}>{running ? '… đang kiểm' : 'chưa chạy'}</div>
                )}
              </div>
            </div>
          </Rise>
        )
      })}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 5. scoring table fills to 100 */

function scoring(t: number, c: Cue) {
  const a4 = c.at(4)
  const rows = [
    { name: 'Cluster + topic', pts: 10, at: fr(c, 1, 0.06) },
    { name: 'Producer', pts: 10, at: fr(c, 1, 0.3) },
    { name: 'Consumer + inbox', pts: 20, at: fr(c, 1, 0.52) },
    { name: 'Read model', pts: 10, at: fr(c, 2, 0.03) },
    { name: 'Retry + DLQ', pts: 15, at: fr(c, 2, 0.26) },
    { name: 'Durability', pts: 10, at: fr(c, 2, 0.54) },
    { name: 'Giám sát', pts: 10, at: fr(c, 2, 0.76) },
    { name: 'REPORT.md', pts: 15, at: fr(c, 3, 0.04) },
    { name: 'Thưởng: outbox', pts: 10, at: fr(c, 3, 0.66), bonus: true },
  ]
  const prog = rows.map((r) => move(t, r.at, 0.9))
  const base = rows.reduce((s, r, i) => (r.bonus ? s : s + r.pts * prog[i]), 0)
  const bonus = 10 * prog[8]
  const hardAt = fr(c, 1, 0.76)
  const trophyAt = a4 + 0.3
  const Y = (i: number) => 205 + i * 78
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a4 + 0.6, { x: 960, y: 560, s: 1.03 }, 1.4]])} title={{ kicker: 'TỰ CHẤM', text: 'Bảng tự chấm 100 điểm' }}>
      {rows.map((r, i) => {
        const hard = i === 2 ? vis(t, hardAt, a4, 0.3) : 0
        return (
          <Rise key={r.name} t={t} at={T0 + i * 0.18}>
            <div style={{ ...INK.card, position: 'absolute', left: 110, top: Y(i), width: 1130, height: 66, boxSizing: 'border-box', isolation: 'isolate' }}>
              {hard > 0 && <HeroFill k={hard} />}
              <div style={{ position: 'absolute', left: 26, top: 0, height: 66, display: 'flex', alignItems: 'center', fontSize: 30, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>{r.name}</div>
              <div style={{ position: 'absolute', left: 440, top: 24, width: 480, height: 18, borderRadius: 9, background: 'rgba(255,255,255,0.14)' }}>
                <div style={{ width: `${(r.pts / 20) * prog[i] * 100}%`, height: '100%', borderRadius: 9, background: r.bonus ? `linear-gradient(90deg, ${INK.warn}aa, ${INK.warn})` : 'linear-gradient(90deg, #78b0ff, #ffffff)', boxShadow: `0 0 14px ${r.bonus ? INK.warn : '#8fb8ff'}` }} />
              </div>
              <div style={{ position: 'absolute', right: 26, top: 0, height: 66, display: 'flex', alignItems: 'center', fontSize: 30, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: r.bonus ? INK.warn : prog[i] >= 1 ? INK.good : INK.faint }}>
                {r.bonus ? '+' : ''}
                {Math.round(r.pts * prog[i])} / {r.pts}
              </div>
            </div>
          </Rise>
        )
      })}
      <div style={{ position: 'absolute', left: 1300, top: 195, width: 520, textAlign: 'center', opacity: vis(t, T0 + 0.3) }}>
        <span style={{ fontSize: 190, fontWeight: 800, letterSpacing: -4, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: base >= 99.5 ? INK.good : '#fff', textShadow: '0 0 40px rgba(91,151,255,0.55)' }}>{Math.round(base)}</span>
        <span style={{ fontSize: 56, fontWeight: 800, color: INK.faint, marginLeft: 10 }}>/ 100</span>
        {bonus > 0.5 && <div style={{ fontSize: 40, fontWeight: 800, color: INK.warn }}>thưởng +{Math.round(bonus)}</div>}
      </div>
      <div style={{ position: 'absolute', left: 1330, top: 460, width: 460, height: 22, borderRadius: 11, background: 'rgba(255,255,255,0.14)', opacity: vis(t, T0 + 0.3) }}>
        <div style={{ width: `${clamp(base / 100) * 100}%`, height: '100%', borderRadius: 11, background: HERO, boxShadow: '0 0 16px rgba(77,141,255,0.8)' }} />
        <div style={{ position: 'absolute', left: '85%', top: -8, width: 3, height: 38, background: '#fff', opacity: 0.8 }} />
      </div>
      {t < trophyAt ? <Icon3D name="trophy" x={1560} y={635} size={270} t={t} at={T0 + 0.6} dim /> : <Icon3D name="trophy" x={1560} y={635} size={290} t={t} at={trophyAt} />}
      <div style={{ position: 'absolute', left: 1310, top: 826, width: 540, fontSize: 32, fontWeight: 700, lineHeight: 1.3, color: INK.text, opacity: vis(t, a4 + 0.2) }}>
        {[
          { txt: '85+ vững · production nhỏ', color: INK.good },
          { txt: '70–84 hiểu đúng · luyện sự cố', color: INK.text },
          { txt: 'dưới 70 quay lại module', color: INK.bad },
        ].map((r, k) => {
          const hot = vis(t, fr(c, 4, 0.12 + k * 0.2), k < 2 ? fr(c, 4, 0.12 + (k + 1) * 0.2) : Infinity, 0.25)
          return (
            <div key={r.txt} style={{ width: 'fit-content', padding: '0 14px', borderRadius: 14, whiteSpace: 'nowrap', color: r.color, fontWeight: k === 0 ? 800 : 700, background: `rgba(77,141,255,${(0.28 * hot).toFixed(2)})`, boxShadow: hot > 0.05 ? `0 0 ${Math.round(20 * hot)}px rgba(120,180,255,${(0.6 * hot).toFixed(2)})` : undefined }}>
              {r.txt}
            </div>
          )
        })}
      </div>
      <Chip x={1330} y={982} text="chỉ tính khi có output thật" hero size={28} o={vis(t, fr(c, 4, 0.5), Infinity, 0.3)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 6. REPORT.md and submission */

const QS = [
  { q: 'Vì sao 6 partition? Tối đa mấy processor có ích?', pill: 'Module 2', topic: 'Topic, Partition, Key' },
  { q: 'Vì sao key là orderId?', pill: 'Module 2', topic: 'Topic, Partition, Key' },
  { q: 'Vì sao AC4 không mất, AC5 từ chối ghi?', pill: 'Module 3 · 4', topic: 'Producer, Replication' },
  { q: 'Vì sao commit sau khi ghi SQLite?', pill: 'Module 6', topic: 'Offset & Delivery' },
  { q: 'Vì sao order-status nén, orders thì không?', pill: 'Module 7', topic: 'Retention & Compaction' },
  { q: 'Retry làm mất thứ tự: xử lý thế nào?', pill: 'Module 10', topic: 'Design patterns' },
  { q: 'Giới hạn đã biết, sửa gì khi lên production?', pill: 'Module 9', topic: 'Vận hành' },
]
/** Which questions are narrated in beats 1..4. */
const QBEAT = [[0, 1], [2], [3, 4], [5, 6]]

function report(t: number, c: Cue) {
  const [a1, a2, a3, a4, a5] = [1, 2, 3, 4, 5].map((k) => c.at(k))
  const starts = [a1, a2, a3, a4]
  const qAt = (i: number) => T0 + i * 0.4
  const turned = (i: number) => {
    const b = QBEAT.findIndex((g) => g.includes(i))
    return starts[b]
  }
  const viAt = fr(c, 0, 0.62)
  const chips = ['repo / thư mục', 'điểm tự chấm', 'log AC1 – AC9', 'REPORT.md']
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE]])} title={{ kicker: 'REPORT.md', text: 'Bảy câu hỏi, mỗi câu có chữ vì' }}>
      {QS.map((it, i) => {
        const b = QBEAT.findIndex((g) => g.includes(i))
        const on = vis(t, starts[b], b < 3 ? starts[b + 1] : a5, 0.3)
        const said = t >= turned(i)
        return (
          <Rise key={it.q} t={t} at={qAt(i)}>
            <div style={{ ...INK.card, position: 'absolute', left: 100, top: 205 + i * 96, width: 1720, height: 80, boxSizing: 'border-box', isolation: 'isolate', transform: on > 0 ? `scale(${1 + 0.015 * on})` : undefined }}>
              <HeroFill k={on} />
              <div style={{ position: 'absolute', left: 24, top: 10, width: 60, height: 60, borderRadius: 30, display: 'grid', placeItems: 'center', fontSize: 32, fontWeight: 800, color: `rgb(${Math.round(lerp(255, 26, on))},${Math.round(lerp(255, 60, on))},${Math.round(lerp(255, 192, on))})`, background: `linear-gradient(rgba(255,255,255,${on.toFixed(2)}), rgba(255,255,255,${on.toFixed(2)})), ${HERO}` }}>{i + 1}</div>
              <div style={{ position: 'absolute', left: 112, top: 0, height: 80, display: 'flex', alignItems: 'center', fontSize: 31, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>{it.q}</div>
              <div style={{ position: 'absolute', left: 1020, top: 16, width: 62, height: 48, borderRadius: 24, display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 800, color: '#3a2500', background: INK.warn, boxShadow: `0 0 16px ${INK.warn}`, opacity: vis(t, viAt + i * 0.12, Infinity, 0.25) }}>vì</div>
              <div style={{ position: 'absolute', left: 1110, top: 16, opacity: said ? vis(t, turned(i) + 0.15, Infinity, 0.3) : 0, display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ padding: '6px 20px', borderRadius: 999, fontSize: 28, fontWeight: 800, whiteSpace: 'nowrap', color: `color-mix(in srgb, #13307f ${Math.round(on * 100)}%, #fff)`, background: `color-mix(in srgb, #fff ${Math.round(on * 100)}%, rgba(8,22,82,0.92))`, border: `1.5px solid color-mix(in srgb, #fff ${Math.round(on * 100)}%, #6ea2ff)` }}>{it.pill}</span>
                <span style={{ fontSize: 28, fontWeight: 600, whiteSpace: 'nowrap', color: `color-mix(in srgb, rgba(255,255,255,0.92) ${Math.round(on * 100)}%, ${INK.faint})` }}>{it.topic}</span>
              </div>
            </div>
          </Rise>
        )
      })}
      <Icon3D name="folder" x={180} y={940} size={120} t={t} at={a5 + 0.1} />
      {chips.map((text, k) => (
        <Rise key={text} t={t} at={fr(c, 5, 0.18 + k * 0.17)}>
          <Chip x={290 + k * 380} y={900} w={340} text={text} hero={k === 3} size={30} />
        </Rise>
      ))}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 7. summary */

function summary(t: number, c: Cue) {
  return (
    <SoftTheme>
      <SummaryList t={t} cue={c} items={['Pipeline: producer → orders → processor → status', 'Chín tiêu chí đo được, verify.py trước', 'Mất, trùng, kẹt: bốn bài diễn tập chứng minh', '100 điểm cần output thật · REPORT.md có “vì”']} />
    </SoftTheme>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { hook, system, requirements, acceptance, drills, scoring, report, summary }

/** Key-moment sounds, timed to the same cue offsets the scenes animate on. */
const SFX: Record<string, SceneSfx[]> = {
  hook: [{ kind: 'ding', at: (c) => fr(c, 2, 0.12) }, { kind: 'ding', at: (c) => fr(c, 2, 0.68) }],
  acceptance: [{ kind: 'ding', at: (c) => fr(c, 1, 0.5) }, { kind: 'tick', at: (c) => fr(c, 2, 0.3) }],
  drills: [
    { kind: 'error', at: (c) => fr(c, 1, 0.05) },
    { kind: 'error', at: (c) => fr(c, 2, 0.52) },
    { kind: 'ding', at: (c) => fr(c, 4, 0.92) },
  ],
  scoring: [{ kind: 'ding', at: (c) => c.at(4) + 0.3 }],
  report: [{ kind: 'ding', at: (c) => fr(c, 5, 0.18 + 3 * 0.17) }],
}

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const capstoneLesson: Lesson = {
  ...capstoneScript,
  scenes: capstoneScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id], sfx: SFX[s.id] })),
  intro: [
    { kind: 'video', scenes: ['hook'] },
    {
      kind: 'quiz',
      title: 'Quick Quiz',
      questions: [q('Đoán trước khi học: làm sao chứng minh pipeline "không mất sự kiện" cho người khác tin?', ['Nói rằng đã test thủ công', 'So read model với expected.json và nộp output thật', 'Chụp màn hình Kafka UI', 'Chạy một lần, thấy không lỗi'], 1, 'Mọi hạng mục chỉ được điểm khi có output thật (log, số đếm). verify.py so order-status với expected.json cho ra con số khớp/lệch.')],
    },
  ],
  roadmap: [
    'Chặng 1: Bức tranh tổng thể: các dịch vụ, topic, luồng sự kiện, chọn công nghệ.',
    'Chặng 2: Sáu mốc yêu cầu, chín tiêu chí đo được và bốn bài diễn tập sự cố.',
    'Chặng 3: Bảng tự chấm một trăm điểm, REPORT.md bảy câu hỏi, gợi ý và cách nộp bài.',
  ],
  sections: [
    {
      id: 'buc-tranh',
      title: 'Bức tranh tổng thể và chọn công nghệ',
      blocks: [
        { kind: 'video', scenes: ['system'] },
        {
          kind: 'table',
          head: ['Thành phần', 'Vai trò'],
          rows: [
            ['`order-generator`', 'producer, sinh 1.000 đơn, key = `orderId`'],
            ['`orders`', '6 partition, RF=3, minISR=2'],
            ['`order-processor`', 'consumer group 2–3 instance, inbox `processed_events` (SQLite)'],
            ['`order-status`', 'topic compact, key = `orderId`, là read model'],
            ['`orders.retry.1` → `orders.dlq`', 'lỗi tạm thời thử lại (≥ 10 giây, tối đa 3 lần); tin hỏng đi thẳng DLQ'],
            ['`lag-monitor`', 'mỗi 10 giây đọc lag của `order-processor`, cảnh báo khi vượt ngưỡng'],
          ],
        },
        { kind: 'p', text: '**Vòng đời một đơn:** `PLACED` → `PAID` → `SHIPPED`; từ `PLACED` có thể sang `CANCELLED` (chỉ huỷ được khi chưa `SHIPPED`). Sự kiện: `OrderPlaced`, `OrderPaid`, `OrderShipped`, `OrderCancelled`, đều dùng **envelope** `eventId`, `type`, `version`, `occurredAt`, `data` (mục 10.4).' },
        {
          kind: 'table',
          head: ['Ngôn ngữ', 'Client nên dùng', 'Ghi chú'],
          rows: [
            ['**Python** (gợi ý số 1)', '`confluent-kafka` (2.16.x)', 'Confluent duy trì, chạy trên librdkafka, ít code nhất'],
            ['Node.js', '`@confluentinc/kafka-javascript` (1.x)', '`kafkajs` bản cuối 2.2.4 (2/2023): không nên chọn cho dự án mới'],
            ['Java/Kotlin', '`org.apache.kafka:kafka-clients`', 'client chính thức, đầy đủ tính năng nhất'],
            ['Go', '`confluent-kafka-go` hoặc `franz-go`', ''],
          ],
        },
        { kind: 'callout', tone: 'warn', title: 'Đặt tường minh mọi cấu hình quan trọng', text: 'Client trên librdkafka có mặc định **khác** client Java ở vài chỗ (ví dụ `enable.idempotence` mặc định là `false`). Inbox chỉ cần **SQLite**: một file, có giao dịch.' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Vì sao `order-status` là topic compact còn `orders` thì không?', ['Để tiết kiệm đĩa cho cả hai', 'order-status chỉ cần trạng thái mới nhất của mỗi orderId; orders là lịch sử sự kiện cần giữ để replay', 'Vì compaction nhanh hơn', 'Vì orders có nhiều partition'], 1, 'Read model là "bản mới nhất theo key" nên compact hợp lý; orders là nguồn sự thật để dựng lại read model nên không được nén mất.')],
        },
      ],
    },
    {
      id: 'yeu-cau',
      title: 'Sáu mốc yêu cầu, nối về module',
      blocks: [
        { kind: 'video', scenes: ['requirements'] },
        {
          kind: 'table',
          head: ['Mốc', 'Nội dung', 'Module dùng đến'],
          rows: [
            ['M1', 'Cluster 3 broker + topic', '1, 2, 4, 7'],
            ['M2', 'Producer có key, idempotent', '2, 3, 10.4'],
            ['M3', 'Consumer group at-least-once + inbox', '5, 6, 10.3'],
            ['M4', 'Read model trên compacted topic', '7, 10.5'],
            ['M5', 'Retry topic + DLQ', '10.6'],
            ['M6', 'Giám sát lag + diễn tập sự cố', '4, 9'],
            ['M7 (thêm)', 'Outbox với SQLite/PostgreSQL', '10.1, 10.2'],
          ],
        },
        {
          kind: 'list',
          items: [
            { title: 'M1', text: 'Cluster 3 broker KRaft bằng `docker compose` (`apache/kafka:3.9.1`); `orders` 6 partition, RF=3, minISR=2; `orders.dlq` retention ≥ 14 ngày; `order-status` `cleanup.policy=compact`; `create-topics.sh` chạy lại không lỗi.' },
            { title: 'M2', text: 'Sinh 1.000 đơn (2–4 sự kiện mỗi đơn), key = `orderId`, `acks=all`, `enable.idempotence=true`; `--duplicate-rate 0.05`, `--poison 10`; in `expected.json`.' },
            { title: 'M3', text: '2–3 instance cùng `group.id`; tắt auto commit, commit **sau khi** ghi xong; `processed_events(event_id PRIMARY KEY)` ghi cùng giao dịch với đổi trạng thái; chuyển trạng thái sai là lỗi nghiệp vụ, không làm sập consumer.' },
            { title: 'M4', text: 'Mỗi lần đổi trạng thái ghi `orderId → {status, updatedAt, lastEventId}` vào `order-status`; CLI `status-query` chỉ đọc topic này; có lệnh replay dựng lại read model bằng consumer group mới (📘 sách, ch.14).' },
            { title: 'M5', text: 'Lỗi tạm thời (2%) → `orders.retry.1` kèm header `retry-count`, `original-topic`, `original-partition`, `original-offset`, `error`; chỉ xử lý khi đã quá 10 giây; tối đa 3 lần rồi DLQ; poison đi thẳng DLQ; `REPORT.md` nêu cách xử lý mất thứ tự.' },
            { title: 'M6', text: '`lag-monitor` in lag mỗi 10 giây, cảnh báo khi lag > 500 trong 3 lần đo liên tiếp, vì lag luôn dao động, điều cần theo dõi là consumer có đuổi kịp hay tụt dần (📘 sách, ch.7); script diễn tập 4 kịch bản và lưu output.' },
            { title: 'M7 (không bắt buộc)', text: '`order-api` ghi đơn và sự kiện vào bảng `outbox` cùng giao dịch, publisher riêng poll rồi gửi Kafka; kill publisher giữa chừng không mất sự kiện, trùng thì inbox loại.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Mốc nào ứng với "ghi inbox và đổi trạng thái trong cùng một giao dịch SQLite"?', ['M1', 'M3', 'M5', 'M6'], 1, 'M3: consumer at-least-once + inbox, dùng kiến thức Module 5, 6 và mục 10.3.')],
        },
      ],
    },
    {
      id: 'tieu-chi',
      title: 'Chín tiêu chí chấp nhận và bốn bài diễn tập',
      blocks: [
        { kind: 'video', scenes: ['acceptance'] },
        {
          kind: 'table',
          head: ['#', 'Kịch bản', 'Điều kiện đạt'],
          rows: [
            ['AC1', 'Chạy sạch: 1.000 đơn, không trùng, không lỗi', '`order-status` khớp 100% `expected.json`; lag về 0'],
            ['AC2', '`--duplicate-rate 0.05`', 'số `eventId` trong `processed_events` = số sự kiện **duy nhất**; read model vẫn khớp 100%'],
            ['AC3', 'Kill **1 consumer** (`kill -9`) giữa lúc xử lý, rồi bật lại', 'read model khớp 100%; log cho thấy có tin đọc lại nhưng bị **bỏ qua** nhờ inbox'],
            ['AC4', '`docker stop` **1 broker** lúc producer chạy', 'producer **không** báo lỗi gửi; không mất sự kiện nào'],
            ['AC5', '`docker stop` **2 broker**', 'producer nhận `NOT_ENOUGH_REPLICAS` (hoặc timeout) thay vì "gửi thành công" giả; giải thích **vì sao** đúng'],
            ['AC6', '`--poison 10`', '`orders.dlq` có **đúng 10** tin, mỗi tin đủ header; consumer chính không dừng'],
            ['AC7', 'Lỗi tạm thời 2%', 'mọi tin lỗi cuối cùng được xử lý (qua retry), trừ khi quá 3 lần; read model khớp'],
            ['AC8', 'Dừng processor 2 phút lúc producer chạy', '`lag-monitor` cảnh báo; bật lại thì lag về 0'],
            ['AC9', 'Replay read model từ đầu', 'khớp kết quả đang chạy'],
          ],
        },
        { kind: 'callout', tone: 'tip', title: 'Viết verify.py trước tiên', text: 'Đọc `order-status` từ đầu đến hết (dict theo key, bản sau đè bản trước), so với `expected.json`, in số đơn khớp/lệch và liệt kê đơn lệch. Mọi AC đều chạy `verify.py` ở cuối.' },
        { kind: 'video', scenes: ['drills'] },
        {
          kind: 'callout',
          tone: 'info',
          title: 'Vì sao AC5 producer "treo" thay vì báo lỗi ngay?',
          text: 'Với `acks=all`, khi ISR < `min.insync.replicas` broker trả `NOT_ENOUGH_REPLICAS`, nhưng đây là lỗi **có thể thử lại**: producer tự retry đến hết `delivery.timeout.ms` (mặc định 120 giây) mới báo lỗi cho callback. Muốn thấy nhanh, đặt `delivery.timeout.ms` nhỏ (ví dụ 15000) và in lỗi trong delivery callback.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('AC3: kill -9 consumer rồi bật lại, log có tin được đọc lại. Điều gì làm read model vẫn đúng?', ['Kafka tự xoá tin đọc lại', 'Inbox thấy eventId đã có nên bỏ qua', 'Producer gửi lại từ đầu', 'Offset được commit trước khi xử lý'], 1, 'At-least-once cho phép đọc lại; tính idempotent đến từ bảng processed_events ghi cùng giao dịch.')],
        },
      ],
    },
    {
      id: 'cham-diem',
      title: 'Bảng tự chấm, REPORT.md và nộp bài',
      blocks: [
        { kind: 'video', scenes: ['scoring'] },
        {
          kind: 'table',
          head: ['Hạng mục', 'Điểm', 'Đạt trọn điểm khi'],
          rows: [
            ['Cluster + topic (M1)', '10', '3 broker, cấu hình đúng R1.1–R1.5, script chạy lại được'],
            ['Producer (M2)', '10', 'key đúng, idempotence bật tường minh, có `expected.json`'],
            ['At-least-once + inbox (M3)', '20', 'AC2, AC3 đạt; inbox và cập nhật trạng thái cùng giao dịch'],
            ['Read model (M4)', '10', 'AC1, AC9 đạt; CLI chỉ đọc từ `order-status`'],
            ['Retry + DLQ (M5)', '15', 'AC6, AC7 đạt; header đầy đủ; poison đi thẳng DLQ'],
            ['Durability (AC4, AC5)', '10', 'cả hai đạt và giải thích đúng cơ chế'],
            ['Giám sát (M6)', '10', 'AC8 đạt, có output lưu lại'],
            ['`REPORT.md`', '15', '7 câu, mỗi câu có "vì" nối đến **cơ chế**, không chỉ mô tả'],
            ['**Thưởng** M7 outbox', '+10', 'R7.1, R7.2 đạt'],
          ],
        },
        { kind: 'callout', tone: 'warn', title: 'Thang điểm', text: '**85+** = vững để làm production nhỏ; **70–84** = hiểu đúng, cần luyện thêm sự cố; **dưới 70** = quay lại các module ứng với hạng mục mất điểm. Một hạng mục chỉ được điểm khi có **output thật** (log, số đếm).' },
        { kind: 'video', scenes: ['report'] },
        {
          kind: 'list',
          ordered: true,
          items: [
            { text: 'Vì sao bạn chọn 6 partition cho `orders`? Tối đa bao nhiêu instance processor có ích?' },
            { text: 'Vì sao key là `orderId` mà không phải `customerId` hay `eventId`?' },
            { text: 'Vì sao AC4 không mất dữ liệu nhưng AC5 lại từ chối ghi? Liên hệ `acks=all` và `min.insync.replicas`.' },
            { text: 'Vì sao commit offset **sau** khi ghi SQLite, và chuyện gì xảy ra ở AC3 nếu đảo thứ tự?' },
            { text: 'Vì sao `order-status` dùng compaction mà `orders` thì không?' },
            { text: 'Bạn xử lý mất thứ tự do retry thế nào, và đánh đổi gì?' },
            { text: 'Giới hạn đã biết của hệ thống (ít nhất 3 điểm), và bạn sẽ sửa gì nếu đưa lên production.' },
          ],
        },
        {
          kind: 'list',
          items: [
            { title: 'Gợi ý 1', text: 'Compose 3 broker KRaft cần **hai listener**: client trong mạng Docker gọi `kafka-N:19092`, máy bạn gọi `localhost:2909x`. Broker trả địa chỉ trong `advertised.listeners` nên mỗi phía phải nhận địa chỉ nó với tới được.' },
            { title: 'Gợi ý 2', text: 'Commit đồng bộ từng tin (`consumer.commit(message=msg, asynchronous=False)`) chậm nhưng dễ đúng; tối ưu theo lô sau khi qua AC3, inbox lo phần trùng (📘 sách, ch.7).' },
            { title: 'Gợi ý 3', text: 'Inbox: `INSERT` vào `processed_events` rồi `UPDATE` trạng thái trong cùng `with db:`; `IntegrityError` → `DUPLICATE`, bỏ qua nhưng **vẫn commit offset**. Gửi lên `order-status` **sau** khi SQLite commit; ở nhánh `DUPLICATE` vẫn gửi lại trạng thái hiện tại để vá khe hở chết giữa chừng (📘 sách, ch.8).' },
            { title: 'Gợi ý 4', text: 'Retry chờ 10 giây: `msg.timestamp()` + 10000, `sleep` (chấp nhận được vì `retry-processor` là consumer riêng, giữ `max.poll.interval.ms` lớn hơn) hoặc chuẩn hơn `pause` / `seek` / `resume` và vẫn gọi `poll()` đều.' },
            { title: 'Gợi ý 5', text: '`lag-monitor` có thể là vòng `while` bash gọi `kafka-consumer-groups.sh --describe`, cộng cột `LAG`, `sleep 10`; giữ một biến đếm cho ngưỡng 3 lần.' },
          ],
        },
        { kind: 'code', code: 'Capstone\n- Link repo / thư mục:\n- Điểm tự chấm: __/100 (+ thưởng __)\n- Output AC1–AC9: (dán hoặc link file log)\n- REPORT.md: 7 câu, mỗi câu có "vì"\n- Chỗ tôi bí lâu nhất và đã gỡ thế nào:' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Bạn tự chấm 90 điểm nhưng không có log cho AC4 và AC5 (durability 10 điểm). Điểm trung thực?', ['Vẫn 90', 'Trừ 10 điểm durability vì không có output thật', 'Cộng thêm thưởng', 'Không thể chấm'], 1, 'Một hạng mục chỉ được điểm khi có output thật chứng minh, không phải "chắc là chạy".')],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: tự chấm capstone của bạn',
      blocks: [
        { kind: 'p', text: 'Tick từng mục bạn đã **chứng minh bằng output thật**. Điểm từng hạng mục, tổng điểm, hạng mục mất điểm nhiều nhất và thang đánh giá cập nhật ngay.' },
        { kind: 'widget', name: 'capstone-lab' },
      ],
    },
    {
      id: 'tom-tat-video',
      title: 'Nhìn lại cả bài',
      blocks: [{ kind: 'video', scenes: ['summary'] }],
    },
  ],
  finalQuiz: [
    q('Bao nhiêu instance order-processor có ích với topic orders 6 partition?', ['Không giới hạn', 'Tối đa 6; instance thứ 7 ngồi chơi', 'Đúng 3', 'Bằng số broker'], 1, 'Một partition chỉ một consumer trong group đọc tại một thời điểm.'),
    q('AC5 dừng 2 trong 3 broker. Hành vi đúng của producer (acks=all, minISR=2)?', ['Báo gửi thành công', 'Nhận lỗi không đủ replica (hoặc timeout), từ chối ghi', 'Tự chuyển sang acks=0', 'Gửi vào DLQ'], 1, 'ISR còn 1 < min.insync.replicas = 2 nên broker không chấp nhận ghi để tránh mất dữ liệu giả.'),
    q('Tin hỏng (JSON sai) nên đi đâu?', ['Retry 3 lần rồi DLQ', 'Thẳng vào DLQ, không qua retry', 'Bỏ qua im lặng', 'Dừng consumer'], 1, 'Thử lại bao nhiêu lần cũng lỗi, chỉ làm chậm; đưa thẳng vào DLQ kèm header.'),
    q('Chuyện gì sai nếu commit offset TRƯỚC khi ghi SQLite rồi process chết?', ['Không sao', 'Tin đó bị mất vĩnh viễn (at-most-once)', 'Tin bị xử lý hai lần', 'Consumer tự khôi phục'], 1, 'Offset đã qua tin chưa được xử lý nên khởi động lại sẽ bỏ qua nó.'),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao AC4 (dừng 1 broker) không mất dữ liệu nhưng AC5 (dừng 2 broker) producer lại bị từ chối ghi?',
      keywords: ['acks', 'isr', 'min.insync', 'replica', 'mất'],
      modelAnswer: 'Vì topic có RF=3 và min.insync.replicas=2. Dừng 1 broker, ISR còn 2 nên vẫn đủ ISR tối thiểu, leader nhận ghi và đã sao chép sang ít nhất một follower với acks=all. Dừng 2 broker, ISR còn 1 nhỏ hơn 2 nên broker trả NOT_ENOUGH_REPLICAS thay vì xác nhận một bản ghi chỉ nằm trên một máy. Từ chối ghi là hành vi đúng vì nó tránh báo thành công giả rồi mất tin.',
    },
  ],
  recap: {
    journey:
      'Ba điều cấm: không mất, không trùng, không kẹt → pipeline gồm generator, orders, processor có inbox, order-status, retry, DLQ và lag-monitor → sáu mốc nối về các module → chín tiêu chí đo được, verify.py trước → bốn bài diễn tập sự cố → bảng tự chấm một trăm điểm và REPORT.md bảy câu có chữ vì.',
    points: [
      { title: 'Kiến trúc', text: 'generator → orders (6 partition, key=orderId) → processor + inbox SQLite → order-status (compact); retry và DLQ cho lỗi.' },
      { title: 'Tiêu chí', text: '9 kịch bản AC1–AC9 đo bằng số; viết verify.py so order-status với expected.json trước tiên.' },
      { title: 'Diễn tập', text: 'kill consumer, dừng 1 và 2 broker, gửi trùng, tin hỏng: mỗi bài có điều kiện đạt rõ ràng.' },
      { title: 'Chấm điểm', text: '100 điểm (+10 outbox), 85+ là vững; chỉ tính khi có output thật; REPORT.md 7 câu, mỗi câu có "vì".' },
    ],
    next: 'Hoàn thành khoá học — bắt tay vào làm capstone.',
  },
}
