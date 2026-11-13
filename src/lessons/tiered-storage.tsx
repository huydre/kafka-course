import type { CSSProperties } from 'react'
import { cameraAt, clamp, lerp, move, sp, span, vis } from '../player/motion-kit'
import { Envelope, HERO, Icon3D, Packets, Rise, SOFT, SOFT_PANEL, ServerUnit, SoftScene, SoftTheme, SummaryList, Wire, ConsumerUnit } from '../player/schematic'
import type { Icon3DName } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene, SceneSfx } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { tieredStorageScript } from './tiered-storage-script'

/** This lesson is drawn in the navy glow style. */
const INK = SOFT
const panel = SOFT_PANEL
const WIDE = { x: 960, y: 540, s: 1 }
const REMOTE_FILL = 'linear-gradient(160deg, #a5e0ff 0%, #38a0ff 55%, #1f6fe0 100%)'
const GLOW = '0 0 18px rgba(77,141,255,0.65), inset 0 1px 0 rgba(255,255,255,0.15)'

/* ------------------------------------------------------------------ local helpers */

/** Centered statement line that rises in at `at` (and fades at `until`). Width is the full frame, so it is always centered. */
function Say({ t, at, text, color = INK.text, size = 44, y, until = Infinity }: { t: number; at: number; text: string; color?: string; size?: number; y: number; until?: number }) {
  const p = clamp(sp(t, at))
  if (p <= 0) return null
  const out = Number.isFinite(until) ? 1 - span(t, until, until + 0.4) : 1
  return (
    <div style={{ position: 'absolute', left: 0, width: 1920, top: y, textAlign: 'center', fontSize: size, fontWeight: 800, letterSpacing: -0.5, color, whiteSpace: 'nowrap', opacity: p * out, transform: `translateY(${(1 - p) * 20}px)`, filter: p < 0.98 ? `blur(${(1 - p) * 6}px)` : undefined }}>
      {text}
    </div>
  )
}

/** Dark glowing pill with centered text. */
const pill = (extra: CSSProperties): CSSProperties => ({ position: 'absolute', padding: '8px 22px', borderRadius: 999, background: 'rgba(8,22,82,0.92)', border: '1.5px solid #6ea2ff', boxShadow: GLOW, fontWeight: 800, whiteSpace: 'nowrap', ...extra })

/* ------------------------------------------------------------------ 0. cold open: the bill for ninety days */

function hook(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [0, 1, 2, 3].map((k) => c.at(k))
  const d0 = c.end(0) - a0
  const days = Math.floor(clamp((t - a0 - 0.5) / (d0 * 0.6)) * 90)
  const UX = [270, 690, 1110]
  const UY = 520
  const down = t >= a2 + 0.6
  const newAt = a2 + 1.2
  const copy = clamp((t - (a2 + 1.9)) / Math.max(1, c.end(2) - a2 - 2.2))
  /** The grid starts low (centred while it is alone) and lifts as the brokers arrive. */
  const dy = 220 * (1 - move(t, a1 - 0.3, 0.9))
  /** While the last line is spoken the old days go cold, left to right. */
  const cold = Math.floor(clamp((t - (a3 + 1.3)) / Math.max(1, c.end(3) - a3 - 2.2)) * 87)
  const bar = (x: number, fill: number, label: string, dim = false) => (
    <div style={{ position: 'absolute', left: x, top: 745, width: 260, height: 44, borderRadius: 14, background: 'rgba(12,30,96,0.55)', border: '1.5px solid rgba(110,160,255,0.35)', boxSizing: 'border-box', overflow: 'hidden', opacity: dim ? 0.45 : 1 }}>
      <div style={{ width: `${clamp(fill) * 100}%`, height: '100%', background: `linear-gradient(90deg, ${INK.warn}, ${INK.bad})`, boxShadow: `0 0 16px ${INK.warn}99` }} />
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 800, color: '#fff' }}>{label}</div>
    </div>
  )
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, { x: 960, y: 540, s: 1.0 }], [a1, { x: 1000, y: 580, s: 1.04 }, 1.2], [a3, WIDE, 1.2]])} title={{ kicker: 'CHI PHÍ', text: 'Giữ 90 ngày' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${dy}px)` }}>
        {Array.from({ length: 90 }, (_, i) => {
          const on = i < days
          const hot = t >= a3 + 0.4 && i >= 87
          const isCold = i < cold
          return (
            <div key={i} style={{ position: 'absolute', left: 210 + (i % 30) * 50, top: 250 + Math.floor(i / 30) * 50, width: 36, height: 36, borderRadius: 10, background: on ? (INK.cell.filled as string) : (INK.cell.empty as string), opacity: isCold ? 0.3 : 1, border: hot ? `2px solid ${INK.warn}` : on ? 'none' : '1.5px solid rgba(110,160,255,0.35)', boxShadow: hot ? `0 0 ${14 + 8 * Math.sin(t * 5)}px ${INK.warn}` : on && !isCold ? 'inset 0 2px 0 rgba(255,255,255,0.45)' : undefined }} />
          )
        })}
        <div style={{ ...panel, left: 1330, top: 415, fontSize: 30, padding: '8px 22px', opacity: vis(t, a0 + 0.8, a3) }}>
          {days} ngày × 2 TB = {days * 2} TB
        </div>
      </div>
      {UX.map((x, k) => (
        <div key={x}>
          <Rise t={t} at={a1 + 0.2 + k * 0.2}>
            <ServerUnit x={x} y={UY} name={`broker ${k + 1}`} down={k === 2 && down} t={t} />
          </Rise>
          <Packets t={t} from={{ x: x + 130, y: 408 }} to={{ x: x + 130, y: 508 }} start={a1 + 0.4 + k * 0.2} end={a1 + 2.6} every={0.3} len={0.8} size={20} />
          {t >= a1 + 0.6 + k * 0.2 && bar(x, span(t, a1 + 0.6 + k * 0.2, a1 + 2.4 + k * 0.2), '180 TB', k === 2 && down)}
        </div>
      ))}
      <div style={{ ...panel, left: 820, top: 830, transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: 36, color: INK.warn, opacity: vis(t, a1 + 2.4, a2) }}>3 bản × 180 = 540 TB SSD</div>
      <Icon3D name="money-bag" x={170} y={620} size={130} t={t} at={a1 + 2.4} />
      <Rise t={t} at={newAt}>
        <ServerUnit x={1530} y={UY} name="broker mới" t={t} />
      </Rise>
      {t >= newAt + 0.3 && bar(1530, copy, `${Math.round(copy * 180)} TB`)}
      <Envelope t={t} at={a2 + 1.9} from={{ x: 820, y: UY }} to={{ x: 1660, y: UY }} label="chép 180 TB" color={INK.warn} len={1.2} arc={90} />
      <Packets t={t} from={{ x: 820, y: UY }} to={{ x: 1660, y: UY }} start={a2 + 3.3} end={c.end(2)} every={0.45} len={1.3} size={22} color={INK.warn} arc={90} />
      <Icon3D name="clock" x={1450} y={600} size={80} t={t} at={a2 + 2.6} />
      <div style={pill({ left: 960, top: 410, transform: 'translateX(-50%)', fontSize: 30, color: INK.warn, borderColor: INK.warn, boxShadow: `0 0 ${14 + 8 * Math.sin(t * 4)}px ${INK.warn}88`, opacity: vis(t, a3 + 0.2) })}>99% lượt đọc: vài giờ gần nhất</div>
      <Say t={t} at={a3 + 1.2} text="Trả tiền SSD cho dữ liệu hầu như không ai đọc" color={INK.warn} size={44} y={930} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 1. compact or delete */

const CH = { SX: 440, RX: 1090, CW: 64, rows: [380, 590, 800], VX: 1700 }

type CellKind = 'on' | 'new' | 'dead' | 'lost' | 'expired'

/** One 64px log cell with a label; all cells are the same size. */
function Cell({ x, y, label, kind, o = 1 }: { x: number; y: number; label: string; kind: CellKind; o?: number }) {
  const style: Record<CellKind, CSSProperties> = {
    on: { background: INK.cell.filled as string, color: '#fff', boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.45), 0 6px 14px rgba(0,8,50,0.45)' },
    new: { background: INK.cell.new as string, color: '#13307f', border: '2px solid #fff', boxShadow: '0 0 20px rgba(140,185,255,0.95)' },
    dead: { background: 'transparent', color: INK.faint, border: '1.5px dashed rgba(159,182,238,0.55)' },
    lost: { background: 'rgba(255,90,106,0.08)', color: INK.bad, border: `2px dashed ${INK.bad}` },
    expired: { background: 'rgba(255,181,71,0.08)', color: INK.warn, border: `2px dashed ${INK.warn}` },
  }
  return (
    <div style={{ position: 'absolute', left: x + 3, top: y, width: CH.CW - 6, height: 66, boxSizing: 'border-box', borderRadius: 14, display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 800, opacity: o, transform: `translateY(${(1 - o) * 14}px)`, ...style[kind] }}>
      {label}
    </div>
  )
}

interface PolicyRow {
  name: string
  sub: string
  keys: string[]
  keep: number[]
  expire?: number[]
  loss: 'dead' | 'lost'
  icon: Icon3DName
  verdict: string
  color: string
  foot: string
}

const POLICY_ROWS: PolicyRow[] = [
  { name: 'user-profile', sub: 'key = user_id', keys: ['A', 'B', 'A', 'A', 'B', 'C', 'A', 'B'], keep: [5, 6, 7], loss: 'dead', icon: 'tick', verdict: 'compact', color: INK.good, foot: 'không mất gì: A, B, C còn đủ' },
  { name: 'payments', sub: 'mỗi tin = 1 giao dịch', keys: ['1', '2', '3', '4', '5', '6', '7', '8'], keep: [7], loss: 'lost', icon: 'trash-can', verdict: 'delete', color: INK.bad, foot: 'mất 7 trên 8 giao dịch' },
  { name: 'sessions', sub: 'quá 30 ngày thì bỏ', keys: ['A', 'B', 'A', 'C', 'B', 'D', 'A', 'C'], keep: [4, 5, 6, 7], expire: [4], loss: 'dead', icon: 'clock', verdict: 'compact,delete', color: INK.accent, foot: 'key B quá hạn: biến mất' },
]

function choose(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [0, 1, 2, 3].map((k) => c.at(k))
  const [d0, d2, d3] = [0, 2, 3].map((k) => c.end(k) - c.at(k))
  const tapeAt = [a0 + 1.0, a2 - 0.6, a3 - 0.6]
  /** Row 1 is alone at first, so the group starts low and lifts as the next rows arrive. */
  const dy = 150 * (1 - move(t, a2 - 0.6, 0.9))
  const resultAt = [a0 + d0 * 0.55, a2 + 0.9, a3 + 0.9]
  const verdictAt = [a1 + 0.3, a2 + d2 * 0.5, a3 + d3 * 0.45]
  const expireAt = a3 + d3 * 0.72
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 500, s: 1.05 }, 1.2], [a2, { x: 960, y: 540, s: 1.05 }, 1.2], [a3, { x: 960, y: 580, s: 1.05 }, 1.2]])} title={{ kicker: 'POLICY', text: 'Compact hay delete?' }}>
      <Say t={t} at={a0 + 0.3} text="Chỉ giữ bản mới nhất, hạ nguồn có mất gì không?" size={42} y={205} until={a2} />
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${dy}px)` }}>
      {[
        ['log gốc', CH.SX + 256],
        ['chỉ giữ bản mới nhất', CH.RX + 256],
        ['chọn', CH.VX],
      ].map(([text, cx]) => (
        <div key={text} style={{ position: 'absolute', left: (cx as number) - 200, width: 400, top: 316, textAlign: 'center', fontSize: 28, fontWeight: 700, color: INK.faint, opacity: vis(t, a0 + 0.6) }}>
          {text}
        </div>
      ))}
      {POLICY_ROWS.map((r, i) => {
        const y = CH.rows[i]
        const final = (k: number): CellKind => {
          if (t < resultAt[i] + 0.9) return 'on'
          if (!r.keep.includes(k)) return r.loss
          return r.expire?.includes(k) && t >= expireAt ? 'expired' : 'new'
        }
        return (
          <div key={r.name}>
            <div style={{ position: 'absolute', left: 80, top: y - 6, opacity: vis(t, tapeAt[i], Infinity, 0.3) }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: INK.text }}>{r.name}</div>
              <div style={{ fontSize: 28, fontWeight: 600, color: INK.faint, marginTop: 4 }}>{r.sub}</div>
            </div>
            {r.keys.map((k, j) => (
              <Cell key={`s${j}`} x={CH.SX + j * CH.CW} y={y} label={k} kind="on" o={vis(t, tapeAt[i] + j * 0.08, Infinity, 0.25)} />
            ))}
            <Wire from={{ x: CH.SX + 8 * CH.CW + 24, y: y + 33 }} to={{ x: CH.RX - 24, y: y + 33 }} color={INK.line} p={move(t, resultAt[i] - 0.6, 0.5)} />
            {r.keys.map((k, j) => (t >= resultAt[i] ? <Cell key={`r${j}`} x={CH.RX + j * CH.CW} y={y} label={k} kind={final(j)} o={vis(t, resultAt[i] + j * 0.05, Infinity, 0.25)} /> : null))}
            <div style={{ position: 'absolute', left: CH.RX, top: y + 82, fontSize: 28, fontWeight: 700, color: r.color, whiteSpace: 'nowrap', opacity: vis(t, verdictAt[i] + 0.3) }}>{r.foot}</div>
            <Icon3D name={r.icon} x={CH.VX} y={y - 8} size={84} t={t} at={verdictAt[i]} />
            <div style={pill({ left: CH.VX - 145, top: y + 74, width: 290, boxSizing: 'border-box', textAlign: 'center', padding: '6px 0', fontFamily: MONO, fontSize: 28, color: r.color, borderColor: r.color, opacity: vis(t, verdictAt[i] + 0.2) })}>{r.verdict}</div>
          </div>
        )
      })}
      </div>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 2. two tiers: local and remote */

const TS = { x0: 340, dx: 210, w: 185, h: 130, top: 300, bot: 740 }
const segX = (k: number) => TS.x0 + k * TS.dx

type SegKind = 'full' | 'active' | 'remote' | 'gone'

/** A segment tile (same size everywhere): closed, active (still written), uploaded copy, or deleted. */
function Seg({ k, y, kind, t, o = 1 }: { k: number; y: number; kind: SegKind; t: number; o?: number }) {
  const base: CSSProperties = { position: 'absolute', left: segX(k), top: y, width: TS.w, height: TS.h, boxSizing: 'border-box', borderRadius: 22, display: 'grid', placeItems: 'center', alignContent: 'center', color: '#fff', opacity: o }
  const style: Record<SegKind, CSSProperties> = {
    full: { background: HERO, boxShadow: '0 0 24px rgba(77,141,255,0.55), inset 0 2px 0 rgba(255,255,255,0.5), 0 14px 28px rgba(0,8,50,0.5)' },
    active: { background: 'linear-gradient(160deg, #e6f0ff 0%, #8fbaff 100%)', color: '#13307f', border: '2px solid #fff', boxShadow: '0 0 28px rgba(140,185,255,0.95)' },
    remote: { background: REMOTE_FILL, boxShadow: '0 0 24px rgba(91,190,255,0.55), inset 0 2px 0 rgba(255,255,255,0.5), 0 14px 28px rgba(0,8,50,0.5)' },
    gone: { background: 'rgba(255,90,106,0.07)', border: `2px dashed ${INK.bad}`, color: INK.bad },
  }
  const sub = kind === 'full' ? 'đã đóng' : kind === 'active' ? 'đang ghi' : kind === 'remote' ? 'remote' : 'đã xoá'
  return (
    <div style={{ ...base, ...style[kind] }}>
      <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.15 }}>seg {k + 1}</div>
      <div style={{ fontSize: 28, fontWeight: 700, opacity: 0.95, display: 'flex', alignItems: 'center', gap: 8 }}>
        {kind === 'active' && <span style={{ width: 12, height: 12, borderRadius: 6, background: '#d6283c', opacity: Math.sin(t * 7) > 0 ? 1 : 0.25 }} />}
        {sub}
      </div>
    </div>
  )
}

const SlotRow = ({ y }: { y: number }) => (
  <>
    {Array.from({ length: 6 }, (_, k) => (
      <div key={k} style={{ position: 'absolute', left: segX(k), top: y, width: TS.w, height: TS.h, boxSizing: 'border-box', borderRadius: 22, border: '1.5px solid rgba(110,160,255,0.35)', background: 'rgba(12,30,96,0.4)' }} />
    ))}
  </>
)

function tiers(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [0, 1, 2, 3].map((k) => c.at(k))
  const d1 = c.end(1) - a1
  const step = Math.max(0.3, (d1 * 0.55) / 4)
  const up = (k: number) => a1 + 0.5 + k * step
  const arrive = (k: number) => up(k) + 0.9
  const delLocal = (k: number) => a2 + 0.9 + k * 0.45
  const delRemote = (k: number) => a3 + 1.0 + k * 0.5
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 540, s: 1.04 }, 1.2], [a2, { x: 960, y: 560, s: 1.04 }, 1.2], [a3, { x: 960, y: 540, s: 1.04 }, 1.2]])} title={{ kicker: 'TIERED STORAGE', text: 'Hai tầng: local và remote' }}>
      {/* remote tier (object storage) on top */}
      <Rise t={t} at={a0 + 0.2}>
        <div style={{ ...panel, left: 300, top: 200, width: 1400, height: 270, padding: 0, boxSizing: 'border-box' }} />
      </Rise>
      {t >= a0 + 0.4 && (
        <>
          <div style={{ position: 'absolute', left: 330, top: 220, fontSize: 28, fontWeight: 800, color: INK.faint }}>REMOTE · object storage</div>
          <SlotRow y={TS.top} />
          <Icon3D name="folder" x={170} y={335} size={120} t={t} at={a0 + 0.5} />
        </>
      )}
      {/* local tier (broker disk) below */}
      <Rise t={t} at={a0 + 0.8}>
        <div style={{ ...panel, left: 300, top: 640, width: 1400, height: 270, padding: 0, boxSizing: 'border-box' }} />
      </Rise>
      {t >= a0 + 1.0 && (
        <>
          <div style={{ position: 'absolute', left: 330, top: 660, fontSize: 28, fontWeight: 800, color: INK.faint }}>LOCAL · đĩa broker</div>
          <SlotRow y={TS.bot} />
          <Icon3D name="computer" x={170} y={775} size={120} t={t} at={a0 + 1.1} />
        </>
      )}
      {Array.from({ length: 6 }, (_, k) => {
        const at = a0 + 1.4 + k * 0.18
        if (t < at) return null
        const gone = k < 3 && t >= delLocal(k)
        return <Seg key={`l${k}`} k={k} y={TS.bot} kind={k === 5 ? 'active' : gone ? 'gone' : 'full'} t={t} o={vis(t, at, Infinity, 0.3)} />
      })}
      {Array.from({ length: 5 }, (_, k) => {
        if (t < arrive(k)) return null
        return <Seg key={`r${k}`} k={k} y={TS.top} kind={t >= delRemote(k) ? 'gone' : 'remote'} t={t} />
      })}
      {Array.from({ length: 5 }, (_, k) =>
        t >= up(k) && t < arrive(k) ? <Seg key={`g${k}`} k={k} y={lerp(TS.bot, TS.top, move(t, up(k), 0.9))} kind="remote" t={t} /> : null,
      )}
      <div style={pill({ left: 1340, top: 212, fontFamily: MONO, fontSize: 28, color: '#fff', opacity: vis(t, a1) })}>RemoteLogManager</div>
      <Icon3D name="lock" x={segX(5) + TS.w / 2} y={695} size={80} t={t} at={a1 + d1 * 0.7} />
      <div style={{ position: 'absolute', right: 1920 - (segX(5) + TS.w / 2 - 50), top: 676, fontSize: 28, fontWeight: 700, color: '#9cc2ff', whiteSpace: 'nowrap', opacity: vis(t, a1 + d1 * 0.7 + 0.2) }}>không upload</div>
      <div style={pill({ left: 650, top: 654, fontFamily: MONO, fontSize: 28, color: INK.warn, borderColor: INK.warn, opacity: vis(t, a2 + 0.2) })}>local.retention.ms = 1 ngày</div>
      <div style={pill({ left: 740, top: 212, fontFamily: MONO, fontSize: 28, color: INK.accent, opacity: vis(t, a3 + 0.2) })}>retention.ms = 90 ngày</div>
      <Say t={t} at={a2 + 2.2} text="Xoá ở local, bản remote vẫn còn" color={INK.warn} size={40} y={935} until={a3} />
      <Say t={t} at={a3 + 1.8} text="Hết retention: xoá cả remote" color={INK.bad} size={40} y={935} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 3. numbers after enabling */

const NB = { x: 240, w: 1440 }

function numbers(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [0, 1, 2, 3].map((k) => c.at(k))
  const grow = (a: number, len = 1.0) => move(t, a, len)
  const label = (y: number, text: string, at: number) => (
    <div style={{ position: 'absolute', left: NB.x, top: y - 4, fontSize: 30, fontWeight: 700, color: INK.faint, opacity: vis(t, at) }}>{text}</div>
  )
  const track = (y: number): CSSProperties => ({ position: 'absolute', left: NB.x, top: y, width: NB.w, height: 44, borderRadius: 14, background: 'rgba(12,30,96,0.45)', border: '1.5px solid rgba(110,160,255,0.3)', boxSizing: 'border-box' })
  const fill = (y: number, w: number, bg: string, glow: string): CSSProperties => ({ position: 'absolute', left: NB.x, top: y, width: w, height: 44, borderRadius: 14, background: bg, boxShadow: `0 0 18px ${glow}` })
  const perDay = NB.w / 90
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 1000, y: 540, s: 1.04 }, 1.2], [a3, WIDE, 1.2]])} title={{ kicker: 'CON SỐ', text: 'Sau khi bật' }}>
      {label(250, 'dòng thời gian của dữ liệu · retention.ms = 90 ngày', a0 + 0.3)}
      <div style={{ ...track(300), opacity: vis(t, a0 + 0.3) }} />
      <div style={fill(300, (NB.w - perDay) * grow(a0 + 0.6, 1.6), REMOTE_FILL, 'rgba(91,190,255,0.6)')} />
      <div style={{ ...fill(300, perDay, HERO, 'rgba(77,141,255,0.9)'), left: NB.x + NB.w - perDay, opacity: vis(t, a0 + 2.2) }} />
      <div style={{ position: 'absolute', left: NB.x, top: 352, fontSize: 30, fontWeight: 700, color: '#7fd0ff', opacity: vis(t, a0 + 2.0) }}>remote · 89 ngày cũ</div>
      <div style={{ position: 'absolute', right: 1920 - NB.x - NB.w, top: 352, fontSize: 30, fontWeight: 700, color: '#9cc2ff', opacity: vis(t, a0 + 2.4) }}>local · 1 ngày mới nhất</div>

      {label(430, 'SSD broker · không tiered storage', a1)}
      <div style={{ ...track(480), opacity: vis(t, a1) }} />
      <div style={fill(480, NB.w * grow(a1 + 0.2, 1.0), `linear-gradient(90deg, ${INK.warn}, ${INK.bad})`, `${INK.warn}88`)} />
      <div style={{ position: 'absolute', right: 1920 - NB.x - NB.w + 24, top: 484, fontSize: 32, fontWeight: 800, color: '#fff', opacity: vis(t, a1 + 1.2) }}>90 × 2 × 3 = 540 TB</div>

      {label(570, 'SSD broker · có tiered storage (1 ngày × 2 TB × 3 bản)', a1 + 1.6)}
      <div style={{ ...track(620), opacity: vis(t, a1 + 1.6) }} />
      <div style={{ ...fill(620, perDay, HERO, 'rgba(77,141,255,0.9)'), opacity: vis(t, a1 + 2.0) }} />
      <div style={{ position: 'absolute', left: NB.x + perDay + 24, top: 622, fontSize: 36, fontWeight: 800, color: INK.good, opacity: vis(t, a1 + 2.4) }}>6 TB</div>

      {label(710, 'object storage · remote (90 ngày × 2 TB)', a2)}
      <div style={{ ...track(760), opacity: vis(t, a2) }} />
      <div style={fill(760, (NB.w / 3) * grow(a2 + 0.2, 1.2), REMOTE_FILL, 'rgba(91,190,255,0.6)')} />
      <div style={{ position: 'absolute', left: NB.x + NB.w / 3 + 24, top: 764, fontSize: 36, fontWeight: 800, color: '#7fd0ff', opacity: vis(t, a2 + 1.4) }}>180 TB</div>

      <Say t={t} at={a3 + 0.3} text="540 TB SSD  →  6 TB SSD" color={INK.good} size={50} y={880} />
      <Icon3D name="money-bag" x={1420} y={915} size={110} t={t} at={a3 + 0.8} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 4. reading old data */

const RD = { cx: 100, cw: 360, bx: 680, bw: 390, chipX: 700, chipW: 350, rx: 1380, rw: 460, lane1: 310, lane2: 720 }

function reading(t: number, c: Cue) {
  const [a0, a1, a2] = [0, 1, 2].map((k) => c.at(k))
  const e1 = a1 + 1.0
  const e2 = e1 + 0.9
  const e3 = e2 + 1.6
  const e4 = e3 + 0.9
  /** Lane 1 is alone in the first beat, so it starts low and the broker panel grows to hold lane 2. */
  const g = move(t, a1 - 0.2, 0.8)
  const dy = 200 * (1 - g)
  const panelTop = lerp(390, 190, g)
  const chip = (y: number, text: string, mono: boolean, at: number, border?: string) => (
    <Rise t={t} at={at}>
      <div style={{ position: 'absolute', left: RD.chipX, top: y - 50, width: RD.chipW, height: 100, boxSizing: 'border-box', borderRadius: 22, display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 800, fontFamily: mono ? MONO : undefined, color: '#fff', background: 'rgba(12,30,96,0.7)', border: `2px solid ${border ?? 'rgba(110,160,255,0.65)'}`, boxShadow: GLOW }}>{text}</div>
    </Rise>
  )
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 540, s: 1.04 }, 1.2], [a2, WIDE, 1.2]])} title={{ kicker: 'ĐỌC DỮ LIỆU CŨ', text: 'Consumer thấy gì?' }}>
      <Rise t={t} at={a0 + 0.2}>
        <div style={{ ...panel, left: RD.bx, top: panelTop, width: RD.bw, height: lerp(250, 670, g), padding: 0, boxSizing: 'border-box' }} />
      </Rise>
      <div style={{ position: 'absolute', left: RD.bx + 30, top: panelTop + 14, fontSize: 30, fontWeight: 800, color: INK.faint, opacity: vis(t, a0 + 0.5) }}>broker</div>
      {/* lane 1: new data, from local disk / page cache */}
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${dy}px)` }}>
      <Rise t={t} at={a0 + 0.4}>
        <ConsumerUnit x={RD.cx} y={RD.lane1 - 59} w={RD.cw} name="consumer" note="đọc mới" parts={['P0']} t={t} busy={(t * 1.3) % 1} />
      </Rise>
      {chip(RD.lane1, 'đĩa · page cache', false, a0 + 0.8)}
      <Wire from={{ x: RD.cx + RD.cw, y: RD.lane1 - 14 }} to={{ x: RD.chipX - 8, y: RD.lane1 - 14 }} color={INK.line} p={move(t, a0 + 1.0, 0.4)} />
      <Packets t={t} from={{ x: RD.chipX, y: RD.lane1 + 16 }} to={{ x: RD.cx + RD.cw + 8, y: RD.lane1 + 16 }} start={a0 + 1.4} every={0.45} len={0.7} size={20} color={INK.good} />
      <Envelope t={t} at={a0 + 1.2} from={{ x: RD.cx + RD.cw + 60, y: RD.lane1 - 14 }} to={{ x: RD.chipX - 60, y: RD.lane1 - 14 }} label="fetch" len={0.6} arc={0} />
      {[0, 1, 2].map((k) => (
        <Envelope key={k} t={t} at={a2 + 0.6 + k * 1.2} from={{ x: RD.cx + RD.cw + 60, y: RD.lane1 - 14 }} to={{ x: RD.chipX - 60, y: RD.lane1 - 14 }} label="fetch" len={0.5} arc={0} />
      ))}
      </div>
      {/* lane 2: sixty-day-old data, fetched back from remote */}
      <Rise t={t} at={a1 + 0.2}>
        <ConsumerUnit x={RD.cx} y={RD.lane2 - 59} w={RD.cw} name="job phân tích" idle={t >= e1 && t < e4 + 0.2} parts={['P0']} t={t} busy={t >= e4 + 0.2 ? (t * 0.5) % 1 : undefined} />
      </Rise>
      <div style={{ position: 'absolute', left: RD.cx, top: RD.lane2 + 68, fontSize: 28, fontWeight: 700, color: INK.warn, opacity: vis(t, e1, e4 + 0.2) }}>chờ segment từ remote…</div>
      {chip(RD.lane2, 'RemoteLogManager', true, a1 + 0.5)}
      <Rise t={t} at={a1 + 0.5}>
        <div style={{ ...panel, left: RD.rx, top: RD.lane2 - 80, width: RD.rw, height: 160, padding: 0, boxSizing: 'border-box' }} />
      </Rise>
      <Icon3D name="folder" x={RD.rx + 90} y={RD.lane2} size={110} t={t} at={a1 + 0.7} />
      <div style={{ position: 'absolute', left: RD.rx + 170, top: RD.lane2 - 22, fontSize: 30, fontWeight: 800, color: '#fff', opacity: vis(t, a1 + 0.9) }}>object storage</div>
      <Wire from={{ x: RD.cx + RD.cw, y: RD.lane2 }} to={{ x: RD.chipX - 8, y: RD.lane2 }} color={INK.line} p={move(t, a1 + 0.6, 0.4)} />
      <Wire from={{ x: RD.chipX + RD.chipW, y: RD.lane2 }} to={{ x: RD.rx - 8, y: RD.lane2 }} color={INK.line} p={move(t, a1 + 0.8, 0.4)} />
      <Envelope t={t} at={e1} from={{ x: RD.cx + RD.cw + 60, y: RD.lane2 }} to={{ x: RD.chipX - 60, y: RD.lane2 }} label="fetch" len={0.8} arc={0} />
      <Envelope t={t} at={e2} from={{ x: RD.chipX + RD.chipW + 100, y: RD.lane2 }} to={{ x: RD.rx - 100, y: RD.lane2 }} label="lấy segment" color={INK.warn} len={0.9} arc={0} />
      <Envelope t={t} at={e3} from={{ x: RD.rx - 90, y: RD.lane2 }} to={{ x: RD.chipX + RD.chipW + 90, y: RD.lane2 }} label="segment" color={INK.good} len={0.9} arc={0} />
      <Envelope t={t} at={e4} from={{ x: RD.chipX - 80, y: RD.lane2 }} to={{ x: RD.cx + RD.cw + 80, y: RD.lane2 }} label="dữ liệu" color={INK.good} len={0.8} arc={0} />
      <Packets t={t} from={{ x: RD.chipX, y: RD.lane2 + 30 }} to={{ x: RD.cx + RD.cw + 8, y: RD.lane2 + 30 }} start={e4 + 1.2} every={1.3} len={1.2} size={20} color={INK.good} />
      {[0, 1, 2].map((k) => (
        <Envelope key={k} t={t} at={a2 + 0.6 + k * 1.9} from={{ x: RD.cx + RD.cw + 60, y: RD.lane2 }} to={{ x: RD.chipX - 60, y: RD.lane2 }} label="fetch" len={1.0} arc={0} />
      ))}
      <div style={pill({ left: RD.chipX + RD.chipW + 20, top: RD.lane2 - 120, fontSize: 30, color: INK.warn, borderColor: INK.warn, opacity: vis(t, e2 + 0.6) })}>qua mạng</div>
      <Say t={t} at={a2 + 0.4} text="Lệnh fetch y hệt, chỉ chậm hơn một chút" color={INK.text} size={44} y={930} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 5. p99 isolation */

function isolate(t: number, c: Cue) {
  const [a0, a1, a2] = [0, 1, 2].map((k) => c.at(k))
  const BASE = 800
  const K = 7
  const BW = 180
  const bars = [
    { x: 415, ms: 21, at: a0 + 1.4, color: '#6ea2ff' },
    { x: 1095, ms: 25, at: a0 + 2.2, color: '#6ea2ff' },
    { x: 645, ms: 60, at: a1 + 0.5, color: INK.bad },
    { x: 1325, ms: 42, at: a2 + 0.5, color: INK.warn },
  ]
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 560, s: 1.04 }, 1.2], [a2, { x: 960, y: 560, s: 1.04 }, 1.2]])} title={{ kicker: 'p99', text: 'Cách ly đọc cũ với đọc mới' }}>
      <div style={{ position: 'absolute', left: 330, top: 250, fontSize: 28, fontWeight: 700, color: INK.faint, opacity: vis(t, a0 + 0.5) }}>độ trễ p99 (mili giây)</div>
      <div style={{ position: 'absolute', left: 360, top: BASE, width: 1200, height: 4, borderRadius: 2, background: INK.line, opacity: vis(t, a0 + 0.5) }} />
      {bars.map((b) => {
        const h = b.ms * K * move(t, b.at, 0.9)
        const live = b.color === '#6ea2ff' ? t >= b.at + 1.0 : t >= b.at + 1.2
        const glow = live ? 22 + 12 * Math.sin(t * 4 + b.x) : 22
        const shown = Math.round(b.ms * move(t, b.at, 0.9))
        return (
          <div key={b.x}>
            {t >= b.at && (
              <>
                <div style={{ position: 'absolute', left: b.x, top: BASE - h, width: BW, height: h, borderRadius: '18px 18px 0 0', background: b.color === '#6ea2ff' ? HERO : `linear-gradient(180deg, ${b.color}, ${b.color}aa)`, boxShadow: `0 0 ${glow}px ${b.color}99` }} />
                <div style={{ position: 'absolute', left: b.x, width: BW, textAlign: 'center', top: BASE - h - 54, fontSize: 38, fontWeight: 800, color: b.color === '#6ea2ff' ? '#fff' : b.color, opacity: vis(t, b.at + 0.1) }}>{shown} ms</div>
              </>
            )}
          </div>
        )
      })}
      {[
        ['Không tiered storage', 640],
        ['Có tiered storage', 1320],
      ].map(([text, cx]) => (
        <div key={text} style={{ position: 'absolute', left: (cx as number) - 250, width: 500, top: 826, textAlign: 'center', fontSize: 30, fontWeight: 800, color: INK.text, opacity: vis(t, a0 + 0.8) }}>
          {text}
        </div>
      ))}
      <div style={{ position: 'absolute', left: 415, top: 920, display: 'flex', gap: 40, fontSize: 28, fontWeight: 700, color: INK.faint, opacity: vis(t, a0 + 0.8) }}>
        <span><span style={{ display: 'inline-block', width: 22, height: 22, borderRadius: 6, background: '#6ea2ff', marginRight: 12, verticalAlign: -3 }} />đọc bình thường</span>
        <span><span style={{ display: 'inline-block', width: 22, height: 22, borderRadius: 6, background: INK.bad, marginRight: 12, verticalAlign: -3 }} />có consumer đọc dữ liệu cũ</span>
      </div>
      <Icon3D name="folder" x={1740} y={440} size={110} t={t} at={a0 + 2.6} />
      <Packets t={t} from={{ x: 1545, y: 700 }} to={{ x: 1700, y: 500 }} start={a0 + 3.0} end={a1 - 0.2} every={0.5} len={1.1} size={24} color="#7fd0ff" arc={30} />
      <Packets t={t} from={{ x: 1680, y: 450 }} to={{ x: 1545, y: 640 }} start={a2 + 1.4} end={c.end(2)} every={0.5} len={1.1} size={24} color={INK.good} arc={30} />
      <div style={{ position: 'absolute', left: 1640, width: 200, top: 506, textAlign: 'center', fontSize: 30, fontWeight: 700, color: '#7fd0ff', opacity: vis(t, a0 + 3.0) }}>remote</div>
      <Icon3D name="shield" x={1740} y={650} size={120} t={t} at={a2 + 1.4} />
      <div style={{ position: 'absolute', left: 1640, width: 200, top: 726, textAlign: 'center', fontSize: 30, fontWeight: 700, color: INK.good, opacity: vis(t, a2 + 1.8) }}>cách ly</div>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 6. limits */

const LM = { xs: [110, 700, 1290], ys: [230, 480, 730], w: 520, h: 210 }

function LimitCard({ t, at, col, row, icon, title, sub, color }: { t: number; at: number; col: number; row: number; icon: Icon3DName; title: string; sub: string; color?: string }) {
  const x = LM.xs[col]
  const y = LM.ys[row]
  return (
    <>
      <Rise t={t} at={at}>
        <div style={{ ...panel, left: x, top: y, width: LM.w, height: LM.h, padding: 0, boxSizing: 'border-box', borderColor: color ?? undefined, borderWidth: color ? 2 : undefined, borderStyle: color ? 'solid' : undefined }} />
      </Rise>
      <Icon3D name={icon} x={x + 90} y={y + LM.h / 2} size={110} t={t} at={at + 0.15} />
      <div style={{ position: 'absolute', left: x + 170, top: y + 34, width: 334, opacity: vis(t, at + 0.2) }}>
        <div style={{ fontSize: 34, fontWeight: 800, color: color ?? INK.text }}>{title}</div>
        <div style={{ fontSize: 28, fontWeight: 600, color: INK.faint, marginTop: 6, lineHeight: 1.25 }}>{sub}</div>
      </div>
    </>
  )
}

function limits(t: number, c: Cue) {
  const [a0, a1, a2] = [0, 1, 2].map((k) => c.at(k))
  const d = (k: number) => c.end(k) - c.at(k)
  /** Rows arrive one beat at a time; the group starts low and rises so it stays centred. */
  const dy = 250 - 125 * move(t, a1 - 0.2, 0.8) - 125 * move(t, a2 - 0.2, 0.8)
  const arrow = (row: number, col: number, at: number) => <Wire from={{ x: LM.xs[col] + LM.w + 8, y: LM.ys[row] + LM.h / 2 }} to={{ x: LM.xs[col + 1] - 8, y: LM.ys[row] + LM.h / 2 }} color={INK.accent} p={move(t, at, 0.5)} />
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a2, { x: 960, y: 540, s: 1.03 }, 1.2]])} title={{ kicker: 'GIỚI HẠN', text: 'Cần biết trước khi bật' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${dy}px)` }}>
      <LimitCard t={t} at={a0 + 0.3} col={0} row={0} icon="setting" title="Kafka broker" sub="chỉ có giao diện RemoteStorageManager" />
      {arrow(0, 0, a0 + d(0) * 0.35)}
      <LimitCard t={t} at={a0 + d(0) * 0.4} col={1} row={0} icon="puzzle" title="Plugin" sub="cho từng kho, thường từ bên thứ ba" />
      {arrow(0, 1, a0 + d(0) * 0.65)}
      <LimitCard t={t} at={a0 + d(0) * 0.7} col={2} row={0} icon="folder" title="S3 · GCS …" sub="object storage thật" />

      <LimitCard t={t} at={a1 + 0.3} col={0} row={1} icon="tick" title="Topic delete" sub="dùng được tiered storage" color={INK.good} />
      <LimitCard t={t} at={a1 + d(1) * 0.3} col={1} row={1} icon="thumb-down" title="Topic compact" sub="không hỗ trợ tiered storage" color={INK.bad} />
      <LimitCard t={t} at={a1 + d(1) * 0.65} col={2} row={1} icon="computer" title="Ở lại đĩa broker" sub="topic compacted nằm hết trên SSD" />

      <LimitCard t={t} at={a2 + 0.3} col={0} row={2} icon="lab" title="Kafka 3.6" sub="early access, chưa nên cho production" color={INK.warn} />
      {arrow(2, 0, a2 + d(2) * 0.3)}
      <LimitCard t={t} at={a2 + d(2) * 0.35} col={1} row={2} icon="trophy" title="Kafka 3.9" sub="production-ready" color={INK.good} />
      {arrow(2, 1, a2 + d(2) * 0.6)}
      <LimitCard t={t} at={a2 + d(2) * 0.65} col={2} row={2} icon="rocket" title="Kafka 4.x" sub="tiếp tục hỗ trợ" />
      </div>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 7. summary */

function summary(t: number, c: Cue) {
  return (
    <SoftTheme>
      <SummaryList t={t} cue={c} items={['Compact cho trạng thái · delete cho sự kiện', 'Segment đã đóng lên object storage', 'local retention ≠ retention (tổng)', 'Cần plugin · Kafka 3.9+ · không cho compacted']} />
    </SoftTheme>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { hook, choose, tiers, numbers, reading, isolate, limits, summary }

/** Key-moment sounds, timed to the same cue offsets the scenes animate on. */
const SFX: Record<string, SceneSfx[]> = {
  hook: [{ kind: 'error', at: (c) => c.at(2) + 0.6 }],
  choose: [
    { kind: 'ding', at: (c) => c.at(1) + 0.3 },
    { kind: 'error', at: (c) => c.at(2) + 0.9 + 0.9 },
    { kind: 'tick', at: (c) => c.at(3) + (c.end(3) - c.at(3)) * 0.72 },
  ],
  tiers: [
    { kind: 'ding', at: (c) => c.at(1) + 0.5 + 4 * Math.max(0.3, ((c.end(1) - c.at(1)) * 0.55) / 4) + 0.9 },
    { kind: 'tick', at: (c) => c.at(2) + 0.9 },
    { kind: 'error', at: (c) => c.at(3) + 1.0 },
  ],
  numbers: [{ kind: 'ding', at: (c) => c.at(3) + 0.8 }],
  reading: [{ kind: 'tick', at: (c) => c.at(1) + 1.0 + 0.9 }],
  isolate: [
    { kind: 'error', at: (c) => c.at(1) + 0.5 + 0.5 },
    { kind: 'ding', at: (c) => c.at(2) + 1.4 },
  ],
  limits: [{ kind: 'error', at: (c) => c.at(1) + (c.end(1) - c.at(1)) * 0.3 + 0.3 }],
}

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const tieredStorageLesson: Lesson = {
  ...tieredStorageScript,
  scenes: tieredStorageScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id], sfx: SFX[s.id] })),
  intro: [
    { kind: 'video', scenes: ['hook'] },
    {
      kind: 'quiz',
      title: 'Quick Quiz',
      questions: [q('Đoán trước khi học: giữ clicks 90 ngày, 2 TB mỗi ngày, RF 3. Bật tiered storage với local retention 1 ngày. SSD trên broker cần khoảng bao nhiêu?', ['540 TB', '180 TB', '6 TB', '2 TB'], 2, '1 ngày × 2 TB × 3 bản = 6 TB. Phần còn lại nằm ở object storage. Phần 2 giải thích.')],
    },
  ],
  roadmap: [
    'Chặng 1: Chọn compact hay delete bằng một câu hỏi: nếu chỉ còn bản mới nhất thì có mất gì không?',
    'Chặng 2: Tiered storage đẩy segment đã đóng lên object storage; local retention và retention khác nhau thế nào.',
    'Chặng 3: Consumer đọc dữ liệu cũ thấy gì, và những giới hạn: plugin, phiên bản, topic compacted.',
  ],
  sections: [
    {
      id: 'chon-policy',
      title: 'Khi nào compact, khi nào không',
      blocks: [
        { kind: 'video', scenes: ['choose'] },
        { kind: 'p', text: '**Câu hỏi để chọn:** "Nếu chỉ còn **bản mới nhất** của mỗi key, hạ nguồn có mất thông tin gì không?"' },
        {
          kind: 'table',
          head: ['Topic', 'Câu trả lời', 'Policy'],
          rows: [
            ['`user-profile` (key = user_id)', 'Không, chỉ cần hồ sơ hiện tại', '`compact`'],
            ['`product-price` (key = sku)', 'Không, chỉ cần giá hiện tại', '`compact`'],
            ['`__consumer_offsets` (Module 6)', 'Không, chỉ cần kẹp sách hiện tại', '`compact` (Kafka tự đặt)'],
            ['Changelog của Kafka Streams (state store)', 'Không, để khôi phục chỉ cần giá trị cuối', '`compact` (Module 8)'],
            ['`payments` (mỗi lần thanh toán)', '**Có**, mất lịch sử giao dịch', '`delete`'],
            ['`page-views`', '**Có**, mất số lượt xem', '`delete`'],
            ['Phiên đăng nhập theo key, không giữ quá 30 ngày', 'Không, nhưng key cũ cũng nên tự biến mất', '`compact,delete` + `retention.ms` = 30 ngày'],
          ],
        },
        { kind: 'callout', tone: 'tip', title: 'Lợi ích lớn nhất của compaction: dựng lại trạng thái', text: 'Service mới khởi động, đọc topic compacted từ offset 0 đến cuối là có ngay bảng trạng thái đầy đủ. Kích thước tỉ lệ với **số key**, không tỉ lệ với **số lần cập nhật**: 1 triệu user sửa hồ sơ 200 lần/năm là 200 triệu tin nếu `delete` giữ mãi, nhưng chỉ khoảng 1 triệu tin nếu `compact`.' },
        { kind: 'callout', tone: 'info', title: 'Sổ hộ khẩu và sổ nhật ký', text: 'Sổ hộ khẩu chỉ cần ghi **hiện tại** ai ở nhà nào (compact). Sổ nhật ký thì giá trị nằm ở **từng ngày đã qua** (delete): xoá bớt trang cũ được, nhưng gộp thành "trạng thái cuối" thì mất hết ý nghĩa.' },
        {
          kind: 'list',
          items: [
            { text: 'Compact khi dữ liệu là **trạng thái** (thực thể có key, bản mới thay bản cũ); delete khi dữ liệu là **sự kiện** (mỗi tin có giá trị riêng).' },
            { text: '`compact,delete` khi vừa muốn trạng thái mới nhất, vừa muốn key lâu không cập nhật tự biến mất.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Một team dùng topic compacted `account-balance` và gửi tin dạng "+100", "−30". Vì sao thiết kế này hỏng?', ['Vì topic compacted không nhận số âm', 'Vì compaction chỉ giữ tin cuối của mỗi key; "−30" là phép thay đổi, không tính ra được số dư', 'Vì key bị trùng', 'Vì tin quá nhỏ'], 1, 'Topic compacted phải chứa trạng thái đầy đủ ("balance = 570"), không phải phép cộng.'),
            q('Changelog của Kafka Streams dùng compact chứ không dùng delete 7 ngày vì sao?', ['Vì compact nhanh hơn', 'Vì khôi phục state cần giá trị cuối của mọi key, kể cả key không đổi suốt nhiều tháng', 'Vì delete không dùng được với Streams', 'Vì tiết kiệm RAM'], 1, 'Với delete 7 ngày, key nào im lặng quá 7 ngày sẽ mất khỏi changelog.'),
          ],
        },
      ],
    },
    {
      id: 'hai-tang',
      title: 'Tiered storage: đẩy segment cũ lên kho từ xa',
      blocks: [
        {
          kind: 'p',
          text: '**Vấn đề:** giữ `clicks` 90 ngày, mỗi ngày 2 TB, RF 3 nghĩa là **540 TB** SSD gắn trên broker. Đắt, thay broker phải chép lại hàng chục TB, trong khi 99% lượt đọc chỉ nhắm vào vài giờ gần nhất.',
        },
        {
          kind: 'list',
          items: [
            { title: 'Đắt', text: 'SSD trên broker đắt hơn nhiều so với object storage (S3, GCS…).' },
            { title: 'Chậm vận hành', text: 'Thêm broker hay thay broker hỏng phải **chép lại** hàng chục TB qua mạng.' },
            { title: 'Trần cứng', text: 'Một partition replica phải nằm **trọn trên một mount point** (một ổ đĩa, hoặc một cụm RAID). Retention tối đa của partition bị giới hạn bởi **một ổ đĩa**, không phải bởi nhu cầu nghiệp vụ. (📘 sách, ch.6)' },
            { title: 'Bẫy khi tính dung lượng', text: 'Kafka đặt partition mới vào thư mục (`log.dirs`) đang có **ít partition nhất**, chỉ đếm số lượng, không xem dung lượng. Partition to bất thường hoặc ổ không đều nhau có thể làm một ổ đầy trước. (📘 sách, ch.6)' },
          ],
        },
        { kind: 'video', scenes: ['tiers'] },
        {
          kind: 'p',
          text: '**Tiered storage (KIP-405)** chia dữ liệu thành hai tầng: **local** (đĩa broker, đọc nhanh) và **remote** (object storage, đọc chậm hơn vì qua mạng). Thành phần `RemoteLogManager` chép segment đã đóng lên remote. (📘 sách, ch.6)',
        },
        {
          kind: 'list',
          items: [
            { text: 'Chỉ **segment đã đóng** mới được upload; active segment luôn ở local.' },
            { text: '`local.retention.ms` (mặc định `-2` = bằng `retention.ms`): segment ở lại đĩa broker bao lâu. `retention.ms` là tổng thời gian sống.' },
            { text: 'Bật theo topic: `remote.storage.enable=true` (broker cần `remote.log.storage.system.enable=true`).' },
          ],
        },
        { kind: 'video', scenes: ['numbers'] },
        {
          kind: 'code',
          code: 'Local:  1 ngày × 2TB × 3 bản = 6TB SSD\nRemote: 90 ngày × 2TB = 180TB object storage (bản sao do dịch vụ lưu trữ lo)',
        },
        { kind: 'callout', tone: 'info', title: 'Kho hàng của cửa hàng tạp hoá', text: 'Hàng bán chạy để **trên kệ** (local, lấy ngay). Hàng ít người hỏi chuyển ra **kho thuê ở ngoại ô** (remote, rẻ, rộng). Khách hỏi món ở kho thì chủ vẫn lấy được, chỉ phải chờ chở về. Cửa hàng không cần thuê mặt bằng phố to gấp 90 lần.' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Vì sao tiered storage giúp thay broker hỏng nhanh hơn rất nhiều?', ['Vì remote nhanh hơn SSD', 'Vì broker mới chỉ cần chép phần local (ví dụ 1 ngày), phần cũ đã nằm sẵn ở remote', 'Vì không cần replica nữa', 'Vì Kafka tự nén dữ liệu'], 1, 'Không có tiered storage thì phải chép toàn bộ 90 ngày.'),
            q('Vì sao chỉ upload segment đã đóng, không upload active segment theo thời gian thực?', ['Vì active segment quá lớn', 'Vì segment đã đóng là bất biến: upload một lần là xong; active segment thay đổi liên tục, còn object storage không ghi nối đuôi hiệu quả', 'Vì remote không nhận file nhỏ', 'Vì để tiết kiệm băng thông'], 1, 'Đây cũng là lý do roll segment quyết định dữ liệu lên remote sớm hay muộn.'),
          ],
        },
      ],
    },
    {
      id: 'doc-du-lieu-cu',
      title: 'Đọc dữ liệu cũ thấy gì',
      blocks: [
        { kind: 'video', scenes: ['reading'] },
        { kind: 'p', text: 'Consumer đọc dữ liệu cũ thì broker **tự lấy từ remote** về. Consumer không cần biết dữ liệu nằm ở đâu, chỉ thấy chậm hơn.' },
        { kind: 'video', scenes: ['isolate'] },
        {
          kind: 'table',
          head: ['Độ trễ p99', 'Tải bình thường', 'Có consumer đọc dữ liệu cũ'],
          rows: [
            ['Không tiered storage', '21 ms', '**60 ms**'],
            ['Có tiered storage', '25 ms', '**42 ms**'],
          ],
        },
        { kind: 'callout', tone: 'tip', title: 'Vì sao đọc cũ ít làm hại hơn', text: 'Theo số đo ghi trong KIP-405 (sách trích lại, p99 tức 99% request nhanh hơn mức này): bật tiered storage làm p99 tăng nhẹ vì broker phải đẩy segment lên remote. Nhưng đọc từ remote đi qua mạng, **không tranh I/O đĩa và page cache** với consumer đọc dữ liệu mới. Không có tiered storage, đọc dữ liệu cũ từ đĩa local kéo dữ liệu cũ vào page cache, đẩy dữ liệu nóng ra ngoài. (📘 sách, ch.6)' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Consumer chạy job phân tích đọc lại dữ liệu 60 ngày trước. Điều gì đúng?', ['Phải đổi code consumer để đọc từ remote', 'Chậm hơn consumer đọc dữ liệu mới vì tải qua mạng, nhưng ít làm bẩn page cache', 'Không đọc được vì dữ liệu đã bị xoá', 'Nhanh hơn vì remote có nhiều ổ'], 1, 'Consumer không đổi gì; broker lo việc lấy segment từ remote.')],
        },
      ],
    },
    {
      id: 'gioi-han',
      title: 'Giới hạn và trạng thái phiên bản',
      blocks: [
        { kind: 'video', scenes: ['limits'] },
        {
          kind: 'list',
          items: [
            { title: 'Cần plugin', text: 'Apache Kafka chỉ cung cấp **giao diện** (`RemoteStorageManager`); bạn cần một plugin cho kho cụ thể (S3, GCS…), thường từ bên thứ ba hoặc nhà cung cấp dịch vụ Kafka.' },
            { title: 'Không cho topic compacted', text: 'Tiered storage dành cho topic `delete`; topic `cleanup.policy=compact` không hỗ trợ.' },
          ],
        },
        {
          kind: 'table',
          head: ['Phiên bản', 'Trạng thái'],
          rows: [
            ['Kafka 3.6', 'Early access: thử nghiệm, chưa khuyến nghị cho production'],
            ['Kafka 3.9', '**Production-ready**; thêm khả năng tắt tiered storage theo topic (KIP-950)'],
            ['Kafka 4.x', 'Tiếp tục hỗ trợ (4.0 bỏ ZooKeeper, chỉ chạy KRaft)'],
          ],
        },
        { kind: 'callout', tone: 'warn', title: 'Sách cũ hơn thực tế', text: 'Sách (bản 2, 2021, Kafka ~2.8–3.0) chỉ giới thiệu tiered storage như một dự án **đang làm**, dự kiến có ở bản 3.0. Thực tế nó không vào 3.0. Ý tưởng cốt lõi vẫn đúng: hai tầng local/remote, mỗi tầng có retention riêng, `RemoteLogManager` chép segment đã đóng lên remote. (📘 sách, ch.6)' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Team muốn bật tiered storage cho topic compacted `user-profile` để giảm SSD. Kết quả?', ['Được, tiết kiệm như topic delete', 'Không được: tiered storage không hỗ trợ topic compacted; topic này vẫn nằm hết trên đĩa broker', 'Được nhưng chỉ cho tombstone', 'Được nếu RF = 1'], 1, 'Khi ước lượng dung lượng, topic compacted phải tính riêng.')],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: tính SSD và object storage',
      blocks: [
        { kind: 'p', text: 'Chỉnh dữ liệu mỗi ngày, retention, local retention và RF. Xem SSD trên broker, dung lượng remote, và lượng dữ liệu phải chép khi thay broker hỏng. Thử đổi sang topic compact.' },
        { kind: 'widget', name: 'tiered-lab' },
      ],
    },
    {
      id: 'tom-tat-video',
      title: 'Nhìn lại cả bài',
      blocks: [{ kind: 'video', scenes: ['summary'] }],
    },
  ],
  finalQuiz: [
    q('Topic nào hợp với cleanup.policy=compact?', ['payments (mỗi lần thanh toán)', 'page-views', 'user-profile (key = user_id)', 'access-log'], 2, 'Chỉ cần hồ sơ hiện tại. payments và page-views mất lịch sử nếu gộp.'),
    q('Tiered storage upload loại segment nào lên remote?', ['Mọi segment, kể cả active', 'Chỉ segment đã đóng', 'Chỉ segment cũ nhất', 'Chỉ segment lớn hơn 1GB'], 1, 'Segment đã đóng là bất biến, upload một lần là xong.'),
    q('local.retention.ms = 1 ngày, retention.ms = 90 ngày. Ý nghĩa nào đúng?', ['Dữ liệu bị xoá sau 1 ngày', 'Ở đĩa broker 1 ngày, tổng thời gian sống 90 ngày', 'Remote giữ 1 ngày, local giữ 90 ngày', 'Hai giá trị cộng lại thành 91 ngày'], 1, 'retention.ms là tổng (local + remote).'),
    q('Điều nào đúng về tiered storage ở Kafka 3.9?', ['Vẫn là early access', 'Production-ready, cần plugin kho cụ thể, không dùng cho topic compacted', 'Chỉ dùng được với HDFS', 'Thay thế hoàn toàn đĩa broker'], 1, '3.6 early access; 3.9 production-ready.'),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao tiered storage giúp giữ dữ liệu 90 ngày mà đĩa broker vẫn nhỏ, và vì sao không dùng được cho topic compacted?',
      keywords: ['remote', 'local', 'segment', 'compacted'],
      modelAnswer: 'Vì segment đã đóng được đẩy lên object storage rẻ hơn, đĩa broker chỉ giữ phần local retention (ví dụ 1 ngày) còn retention là tổng thời gian sống. Topic compacted không dùng được vì tiered storage chỉ hỗ trợ topic delete; topic trạng thái vẫn phải nằm hết trên đĩa broker nên phải tính dung lượng riêng.',
    },
  ],
  recap: {
    journey:
      'Giữ 90 ngày trên SSD broker tốn 540 TB → chọn compact cho trạng thái, delete cho sự kiện → tiered storage đẩy segment đã đóng lên object storage → local retention giữ đĩa broker nhỏ, retention là tổng thời gian sống → đọc dữ liệu cũ chậm hơn nhưng không tranh page cache → cần plugin, Kafka 3.9+, không cho topic compacted.',
    points: [
      { title: 'Compact hay delete', text: 'Compact cho trạng thái (bản mới thay bản cũ); delete cho sự kiện; compact,delete khi key cũ cũng nên biến mất.' },
      { title: 'Hai tầng', text: 'Segment đã đóng lên object storage; active segment ở lại local.' },
      { title: 'Hai retention', text: 'local.retention.ms là thời gian ở đĩa broker; retention.ms là tổng thời gian sống.' },
      { title: 'Giới hạn', text: 'Cần plugin kho cụ thể, production-ready từ Kafka 3.9, không dùng cho topic compacted.' },
    ],
    next: 'Bài tiếp theo: Schema Registry & compatibility — hợp đồng dữ liệu giữa producer và consumer (Module 8).',
  },
}
