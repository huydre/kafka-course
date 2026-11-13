import type { ReactNode } from 'react'
import { cameraAt, clamp, lerp, move, sp, span, vis } from '../player/motion-kit'
import { ConsumerUnit, Envelope, HERO, Icon3D, Packets, Rise, SOFT, SOFT_PANEL, ServerUnit, SoftScene, SoftTheme, Statement, SummaryList, Wire, type Icon3DName } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene, SceneSfx } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { incidentsOpsScript } from './incidents-ops-script'

/** This lesson is drawn in the navy glow style. */
const INK = SOFT
const panel = SOFT_PANEL
const WIDE = { x: 960, y: 540, s: 1 }

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN')
const BAD_BG = 'linear-gradient(160deg, #ff8a95 0%, #ff5a6a 55%, #c4283a 100%)'
const WARN_BG = 'linear-gradient(160deg, #ffd27a 0%, #ffb547 55%, #d98410 100%)'
const GOOD_BG = 'linear-gradient(160deg, #7af0c0 0%, #3ee6a0 55%, #14a56c 100%)'
const GLOW = '0 0 26px rgba(77,141,255,0.65), 0 14px 30px rgba(0,4,30,0.55), inset 0 2px 0 rgba(255,255,255,0.45)'

/** A labelled rounded chip. `bg` defaults to the glossy blue; pass `outline` for a quiet dark pill. */
function Chip({ x, y, w, h = 64, text, bg = HERO, color = '#ffffff', size = 28, mono = false, o = 1, outline, glow }: { x: number; y: number; w: number; h?: number; text: ReactNode; bg?: string; color?: string; size?: number; mono?: boolean; o?: number; outline?: string; glow?: string }) {
  if (o <= 0) return null
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, boxSizing: 'border-box', borderRadius: Math.min(26, h / 2), display: 'grid', placeItems: 'center', padding: '0 12px', whiteSpace: 'nowrap', fontFamily: mono ? MONO : undefined, fontSize: size, fontWeight: mono ? 700 : 800, color, opacity: clamp(o), background: outline ? 'rgba(8,22,82,0.92)' : bg, border: outline ? `2px solid ${outline}` : 'none', boxShadow: glow ?? (outline ? `0 0 18px ${outline}88` : GLOW) }}>
      {text}
    </div>
  )
}

/** Problem tile used by the cold open: 3D icon + name. */
const ISSUES: { icon: Icon3DName; name: string }[] = [
  { icon: 'clock', name: 'Lag tăng đều' },
  { icon: 'flash', name: 'Rebalance storm' },
  { icon: 'battery', name: 'Đĩa đầy' },
  { icon: 'pause', name: 'Broker chết' },
  { icon: 'fire', name: 'Hot partition' },
  { icon: 'trash-can', name: 'Poison message' },
]

/* ------------------------------------------------------------------ 0. cold open: the 3am alert */

function hook(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const d2 = c.end(2) - a2
  const p = move(t, a1, 0.9)
  const shake = t < a2 ? Math.sin(t * 22) * 7 * (1 - p * 0.6) * clamp(Math.sin(t * 2.4) * 3 + 0.8) : 0
  const bx = lerp(780, 620, p)
  const by = lerp(470, 285, p)
  const fx = lerp(1140, 1300, p)
  const iconsO = 1 - span(t, a2 - 0.2, a2 + 0.3)
  const chainX = [600, 960, 1320]
  const chain: { icon: Icon3DName; label: string; at: number }[] = [
    { icon: 'fire', label: 'dấu hiệu', at: a2 + 0.2 },
    { icon: 'zoom', label: 'kiểm tra', at: a2 + d2 * 0.36 },
    { icon: 'tools', label: 'xử lý', at: a2 + d2 * 0.68 },
  ]
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, { x: 960, y: 500, s: 1.06 }], [a1, WIDE, 1.2]])}>
      <div style={{ position: 'absolute', inset: 0, opacity: iconsO }}>
        <div style={{ position: 'absolute', inset: 0, transform: `rotate(${shake}deg)`, transformOrigin: `${bx}px ${by - 100}px` }}>
          <Icon3D name="bell" x={bx} y={by} size={lerp(330, 210, p)} t={t} at={0.4} />
        </div>
        <Icon3D name="fire" x={fx} y={by} size={lerp(330, 210, p)} t={t} at={a0 + (c.end(0) - a0) * 0.55} />
      </div>
      {ISSUES.map((it, i) => (
        <Rise key={it.name} t={t} at={a1 + 0.3 + i * 0.3}>
          <div style={{ ...INK.card, position: 'absolute', left: 140 + (i % 3) * 560, top: 540 + Math.floor(i / 3) * 210, width: 520, height: 170, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 20, padding: '0 24px' }}>
            <div style={{ position: 'relative', width: 110, height: 110, flex: 'none' }}>
              <Icon3D name={it.icon} x={55} y={55} size={110} t={t} at={a1 + 0.3 + i * 0.3} />
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: INK.text, lineHeight: 1.15 }}>{it.name}</div>
          </div>
        </Rise>
      ))}
      {chain.map((s, i) => (
        <div key={s.label}>
          <Icon3D name={s.icon} x={chainX[i]} y={285} size={190} t={t} at={s.at} />
          <Chip x={chainX[i] - 100} y={400} w={200} h={56} text={s.label} o={vis(t, s.at + 0.2)} size={30} />
          {i > 0 && <Wire from={{ x: chainX[i] - 250, y: 285 }} to={{ x: chainX[i] - 110, y: 285 }} color={INK.accent} p={move(t, s.at - 0.1, 0.4)} />}
        </div>
      ))}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 1. three shapes of lag */

const CH = { X0: 190, BW: 120, PITCH: 170, BASE: 830 }
const LOW = 60
const bx = (i: number) => CH.X0 + i * CH.PITCH

/** Verdict card: symptom → cause → fix rows, each with a 3D icon. Re-enters when the phase changes. */
function Verdict({ t, x, y, head, rows, headColor = INK.text, o = 1 }: { t: number; x: number; y: number; head: string; headColor?: string; o?: number; rows: { icon: Icon3DName; label: string; text: string; at: number; color?: string }[] }) {
  return (
    <Rise t={t} at={rows[0].at - 0.15}>
      <div style={{ ...INK.card, position: 'absolute', left: x, top: y, width: 620, height: 520, boxSizing: 'border-box', opacity: o }}>
        <div style={{ position: 'absolute', left: 32, top: 22, fontSize: 40, fontWeight: 800, color: headColor, whiteSpace: 'nowrap' }}>{head}</div>
        {rows.map((r, i) => (
          <div key={r.label} style={{ position: 'absolute', left: 0, top: 104 + i * 138, width: 620, height: 126, opacity: vis(t, r.at, Infinity, 0.3) }}>
            <Icon3D name={r.icon} x={78} y={60} size={96} t={t} at={r.at} />
            <div style={{ position: 'absolute', left: 150, top: 4, fontSize: 28, fontWeight: 700, color: INK.faint }}>{r.label}</div>
            <div style={{ position: 'absolute', left: 150, top: 40, width: 450, fontSize: 30, fontWeight: 800, lineHeight: 1.18, color: r.color ?? INK.text }}>{r.text}</div>
          </div>
        ))}
      </div>
    </Rise>
  )
}

function lagShapes(t: number, c: Cue) {
  const [a0, a1, a2, a3, a4] = [c.at(0), c.at(1), c.at(2), c.at(3), c.at(4)]
  const [d1, d2, d3, d4] = [c.end(1) - a1, c.end(2) - a2, c.end(3) - a3, c.end(4) - a4]
  const jitter = (i: number) => 5 * Math.sin(t * 3 + i * 1.7)
  const growA = (i: number, tt: number) => lerp(230, 340 + (i % 3) * 20, span(tt, a1, a2 + 0.6))
  const h = (i: number) => {
    const appear = clamp(sp(t, 0.3 + i * 0.1))
    if (t < a1) return appear * (230 + jitter(i) * 3)
    if (t < a2) return growA(i, t)
    if (t < a3) {
      if (i === 4) return lerp(growA(4, a2), 380, move(t, a2, 0.7)) + 90 * span(t, a2 + 0.7, a3) + jitter(i) * 0.3
      return lerp(growA(i, a2), LOW, move(t, a2, 0.7)) + jitter(i) * 0.5
    }
    if (i === 4) return lerp(470, LOW, move(t, a3, 0.7))
    if (i === 2) return lerp(LOW, 420, move(t, a3 + 0.2, 1.0))
    return LOW + jitter(i) * 0.5
  }
  // bar tints cross-fade (layered over the blue base) in step with the verdict card swaps
  const toHot = span(t, a2 - 0.45, a2 + 0.05)
  const toPoison = span(t, a3 - 0.45, a3 + 0.05)
  const warnOf = (i: number) => span(t, a1, a1 + 0.27) * (i === 4 ? 1 - toPoison : 1 - toHot)
  const badOf = (i: number) => (i === 2 ? toPoison : 0)
  const verdicts = [
    { head: 'Consumer chậm', rows: [{ icon: 'bell' as const, label: 'dấu hiệu', text: 'lag tăng đều ở mọi partition', at: a1 + 0.2, color: INK.bad }, { icon: 'zoom' as const, label: 'kiểm tra', text: 'DB phía sau chậm? ít consumer hơn partition?', at: a1 + d1 * 0.4 }, { icon: 'tools' as const, label: 'xử lý', text: 'thêm consumer · gom batch ghi DB', at: a1 + d1 * 0.72, color: INK.good }] },
    { head: 'Hot partition', rows: [{ icon: 'bell' as const, label: 'dấu hiệu', text: 'một cột cao vút, offset còn nhích', at: a2 - 0.3, color: INK.bad }, { icon: 'zoom' as const, label: 'kiểm tra', text: 'một key chiếm phần lớn tin?', at: a2 + d2 * 0.4 }, { icon: 'tools' as const, label: 'xử lý', text: 'rắc muối key: shop-1#0 … #9', at: a2 + d2 * 0.72, color: INK.good }] },
    { head: 'Poison message', rows: [{ icon: 'bell' as const, label: 'dấu hiệu', text: 'một cột đứng yên, offset đứng', at: a3 - 0.3, color: INK.bad }, { icon: 'zoom' as const, label: 'kiểm tra', text: 'đọc đúng tin ở offset đó', at: a3 + d3 * 0.4 }, { icon: 'tools' as const, label: 'xử lý', text: 'bỏ qua 1 tin · lâu dài: DLQ', at: a4 - 0.2, color: INK.good }] },
  ]
  const verdictO = [1 - toHot, toHot * (1 - toPoison), toPoison]
  // beat 4 tape: the consumer sits on the bad cell, hops over it, and the bad tin goes to the DLQ
  const CELL = 64
  const TX = 330
  const hop = a4 + d4 * 0.42
  const sent = hop + 1.2
  const caretX = TX + 6 * CELL + 32 + CELL * move(t, hop, 0.6)
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a2, { x: 980, y: 520, s: 1.04 }, 1.4]])} title={{ kicker: 'LAG', text: 'Ba hình dạng của lag' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${-70 * move(t, a4, 0.8)}px)` }}>
      <div style={{ position: 'absolute', left: CH.X0 - 20, top: CH.BASE - 3, width: 5 * CH.PITCH + CH.BW + 40, height: 4, borderRadius: 2, background: 'rgba(110,160,255,0.55)', opacity: vis(t, 0.3) }} />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i}>
          <div style={{ position: 'absolute', left: bx(i), top: CH.BASE - h(i) - 3, width: CH.BW, height: h(i), borderRadius: '16px 16px 4px 4px', background: HERO, boxShadow: i === 2 && t >= a3 + 1 ? `0 0 ${24 + 14 * Math.sin(t * 6)}px ${INK.bad}` : '0 0 20px rgba(77,141,255,0.45), inset 0 2px 0 rgba(255,255,255,0.4)' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', background: WARN_BG, opacity: warnOf(i) }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', background: BAD_BG, opacity: badOf(i) }} />
          </div>
          <div style={{ position: 'absolute', left: bx(i), top: CH.BASE + 14, width: CH.BW, textAlign: 'center', fontSize: 28, fontWeight: 800, color: INK.faint, opacity: vis(t, 0.3 + i * 0.1) }}>P{i}</div>
        </div>
      ))}
      {t >= a2 + 0.5 && t < a3 && (
        <Chip x={bx(4) + 60 - 170} y={CH.BASE - h(4) - 82} w={340} h={56} text={`offset ${fmt(8412 + (t - a2) * 37)} ↑`} outline={INK.warn} color={INK.warn} size={28} mono o={vis(t, a2 + 0.5, a3 - 0.3, 0.3)} />
      )}
      {t >= a3 + 1.0 && (
        <Chip x={bx(2) + 60 - 230} y={CH.BASE - h(2) - 82} w={460} h={56} text="offset 41.207 · đứng yên" outline={INK.bad} color={INK.bad} size={28} mono o={vis(t, a3 + 1.0)} />
      )}
      {t < a1 + 0.3 &&
        [
          { label: 'đều ở mọi partition', bars: [60, 64, 70, 58, 66, 62], hot: -1 },
          { label: 'một cột cao vút', bars: [16, 16, 16, 16, 90, 16], hot: 4 },
          { label: 'một cột đứng yên', bars: [16, 16, 90, 16, 16, 16], hot: 2 },
        ].map((m, i) => (
          <Rise key={m.label} t={t} at={a0 + 0.5 + i * 0.9}>
            <div style={{ ...INK.card, position: 'absolute', left: 1210, top: 300 + i * 180, width: 620, height: 160, boxSizing: 'border-box', opacity: 1 - span(t, a1, a1 + 0.3) }}>
              {m.bars.map((hh, k) => (
                <div key={k} style={{ position: 'absolute', left: 30 + k * 36, top: 130 - hh, width: 26, height: hh, borderRadius: '8px 8px 2px 2px', background: k === m.hot ? (i === 2 ? BAD_BG : WARN_BG) : HERO }} />
              ))}
              <div style={{ position: 'absolute', left: 268, top: 0, width: 330, height: 160, display: 'flex', alignItems: 'center', fontSize: 30, fontWeight: 800, lineHeight: 1.2, color: INK.text }}>{m.label}</div>
            </div>
          </Rise>
        ))}
      {verdicts.map((v, k) =>
        verdictO[k] > 0 ? <Verdict key={v.head} t={t} x={1210} y={300} head={v.head} headColor={k === 2 ? INK.bad : INK.warn} rows={v.rows} o={verdictO[k]} /> : null,
      )}
      </div>
      {/* beat 4: skip the poison cell */}
      {t >= a4 - 0.1 && (
        <div style={{ opacity: vis(t, a4) }}>
          <Chip x={TX} y={816} w={230} h={52} text="dừng group" outline={INK.warn} color={INK.warn} size={28} o={vis(t, a4 + 0.2)} />
          <Chip x={TX + 260} y={816} w={300} h={52} text="--shift-by 1" outline={INK.good} color={INK.good} size={28} mono o={vis(t, hop - 0.3)} />
          {Array.from({ length: 12 }, (_, i) => {
            const bad = i === 6
            const gone = bad && t >= hop + 0.9
            const filled = i < 6 || (i > 6 && t >= hop + 0.6 + (i - 7) * 0.35)
            return (
              <div key={i} style={{ position: 'absolute', left: TX + i * CELL + 3, top: 905, width: CELL - 6, height: 60, borderRadius: 14, boxSizing: 'border-box', display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 800, color: '#fff', background: gone ? 'rgba(12,30,96,0.55)' : bad ? BAD_BG : filled ? HERO : 'rgba(12,30,96,0.55)', border: filled || bad ? 'none' : '1.5px solid rgba(110,160,255,0.35)', boxShadow: bad && !gone ? `0 0 20px ${INK.bad}` : filled ? '0 0 14px rgba(77,141,255,0.4)' : undefined }}>
                {bad && !gone ? '✕' : ''}
              </div>
            )
          })}
          <div style={{ position: 'absolute', left: caretX - 2, top: 888, width: 4, height: 96, borderRadius: 2, background: INK.warn, boxShadow: `0 0 12px ${INK.warn}` }} />
          <div style={{ ...INK.card, position: 'absolute', left: 1210, top: 888, width: 620, height: 96, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 20, padding: '0 28px', opacity: vis(t, a4 + d4 * 0.55) }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: INK.text }}>DLQ</span>
          </div>
          {t >= hop + 0.9 && t < sent + 0.9 && (
            <div style={{ position: 'absolute', left: lerp(TX + 6 * CELL + 3, 1700, move(t, sent - 0.2, 0.9)), top: lerp(905, 900, move(t, sent - 0.2, 0.9)), width: CELL - 6, height: 60, borderRadius: 14, background: BAD_BG, display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 800, color: '#fff' }}>✕</div>
          )}
          {t >= sent + 0.7 && <div style={{ position: 'absolute', left: 1700, top: 900, width: CELL - 6, height: 60, borderRadius: 14, background: BAD_BG, display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 800, color: '#fff' }}>✕</div>}
        </div>
      )}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 2. three more incidents: rebalance storm, disk, dead broker */

const TRIAGE = [
  { name: 'Rebalance storm', icon: 'flash' as Icon3DName, sym: 'consumer bị đá khỏi group liên tục', cause: 'một lô xử lý > 5 phút, vượt max.poll.interval', fix: 'giảm max.poll.records · static membership' },
  { name: 'Đĩa đầy', icon: 'fire' as Icon3DName, sym: 'đĩa broker sắp 100%', cause: 'log tăng nhanh hơn retention dọn', fix: 'giảm retention · thêm đĩa · không rm file' },
  { name: 'Broker chết', icon: 'bell' as Icon3DName, sym: 'URP > 0, một broker rời ISR', cause: 'xem log: hết RAM, đĩa hay mạng', fix: 'khởi động lại · không dừng thêm broker' },
]
const TRI = { X: (k: number) => 110 + k * 590, W: 540, Y: 240, H: 740 }
const triTimes = (c: Cue, k: number) => {
  const base = c.at(k + 1)
  const d = c.end(k + 1) - base
  return { base, s1: base + d * 0.38, s2: base + d * 0.7, done: base + d * 0.7 + 1.0 }
}

function triage(t: number, c: Cue) {
  const T = [0, 1, 2].map((k) => triTimes(c, k))
  // soft focus on the card being narrated: rises as its beat starts, falls when the next one starts
  const win = (a: number, b: number) => span(t, a - 0.1, a + 0.3) * (1 - span(t, b - 0.1, b + 0.3))
  const focusAny = win(c.at(1), T[2].s1)
  const focusOf = (k: number) => win(c.at(k + 1), k < 2 ? c.at(k + 2) : T[2].s1)
  return (
    <SoftScene t={t} camera={WIDE} title={{ kicker: 'SỔ TAY', text: 'Ba sự cố nữa', until: c.at(1) - 0.3 }}>
      {TRIAGE.map((card, k) => {
        const { s1, s2, done } = T[k]
        // stage layers cross-fade around s1 / s2 instead of swapping in one frame
        const x1 = span(t, s1 - 0.1, s1 + 0.3)
        const x2 = span(t, s2 - 0.1, s2 + 0.3)
        const layers = [
          { icon: card.icon, stage: 'dấu hiệu', bg: BAD_BG, text: card.sym, color: INK.bad, start: 0, w: 1 - x1 },
          { icon: 'zoom' as Icon3DName, stage: 'kiểm tra', bg: WARN_BG, text: card.cause, color: INK.warn, start: s1 - 0.1, w: x1 * (1 - x2) },
          { icon: 'tools' as Icon3DName, stage: 'xử lý', bg: GOOD_BG, text: card.fix, color: INK.good, start: s2 - 0.1, w: x2 },
        ]
        const focus = focusOf(k)
        const dim = 1 - 0.5 * focusAny * (1 - focus)
        const pulse = `${INK.card.boxShadow}, 0 0 ${(18 + 14 * Math.sin(t * 6)) * (1 - x2)}px ${INK.bad}`
        let metric: ReactNode
        if (k === 0) {
          const n = t < s2 + 0.6 ? Math.floor(Math.max(0, t - T[0].base) * 2.2) : 0
          metric = <div style={{ ...panel, boxShadow: pulse, left: 40, top: 590, width: 460, height: 100, boxSizing: 'border-box', display: 'grid', placeItems: 'center', fontSize: 36, color: n ? INK.bad : INK.good }}>rebalance: {n}</div>
        } else if (k === 1) {
          const fill = t < s2 + 0.4 ? lerp(0.6, 1, span(t, T[1].base + 0.3, s1)) : lerp(1, 0.55, move(t, s2 + 0.4, 1.0))
          const col = fill > 0.9 ? INK.bad : fill > 0.75 ? INK.warn : INK.good
          metric = (
            <div style={{ ...panel, boxShadow: pulse, left: 40, top: 590, width: 460, height: 120, boxSizing: 'border-box', padding: '12px 24px' }}>
              <div style={{ fontSize: 34, color: col, textAlign: 'center' }}>đĩa: {Math.round(fill * 100)}%</div>
              <div style={{ marginTop: 10, height: 18, borderRadius: 9, background: 'rgba(110,160,255,0.2)' }}>
                <div style={{ width: `${fill * 100}%`, height: '100%', borderRadius: 9, background: col, boxShadow: `0 0 14px ${col}` }} />
              </div>
            </div>
          )
        } else {
          const urp = t < s2 + 0.3 ? Math.round(12 * span(t, T[2].base + 0.3, T[2].base + 2.0)) : Math.round(12 * (1 - span(t, s2 + 0.3, s2 + 1.3)))
          metric = <div style={{ ...panel, boxShadow: pulse, left: 40, top: 590, width: 460, height: 100, boxSizing: 'border-box', display: 'grid', placeItems: 'center', fontSize: 36, color: urp ? INK.bad : INK.good }}>URP: {urp}</div>
        }
        return (
          <Rise key={card.name} t={t} at={0.3 + k * 0.3}>
            <div style={{ ...INK.card, position: 'absolute', left: TRI.X(k), top: TRI.Y, width: TRI.W, height: TRI.H, boxSizing: 'border-box', opacity: dim, transform: `scale(${1 + 0.03 * focus})`, boxShadow: `${INK.card.boxShadow}, 0 0 ${40 * focus}px rgba(110,160,255,${0.55 * focus})` }}>
              <div style={{ position: 'absolute', left: 32, top: 24, fontSize: 38, fontWeight: 800, color: INK.text, whiteSpace: 'nowrap' }}>{card.name}</div>
              {layers.map((l) =>
                l.w > 0 ? (
                  <div key={l.stage} style={{ position: 'absolute', inset: 0, opacity: l.w }}>
                    <Chip x={TRI.W - 190} y={80} w={160} h={46} size={26} text={l.stage} bg={l.bg} color="#10182f" o={vis(t, l.start)} />
                    <Icon3D name={l.icon} x={TRI.W / 2} y={255} size={210} t={t} at={l.start} />
                    <div style={{ position: 'absolute', left: 40, top: 390, width: 460, height: 170, fontSize: 34, fontWeight: 800, lineHeight: 1.22, color: l.color, opacity: vis(t, l.start + 0.1, Infinity, 0.3) }}>{l.text}</div>
                  </div>
                ) : null,
              )}
              {t >= done && <Icon3D name="tick" x={TRI.W - 80} y={220} size={100} t={t} at={done} float={false} />}
              {metric}
            </div>
          </Rise>
        )
      })}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 3. moving a partition with a throttle */

const RA = { SX: [130, 600, 1070, 1540], SY: 340, CX: (b: number) => [130, 600, 1070, 1540][b] + 10, CY: (r: number) => 570 + r * 80, CW: 240 }
/** Replica chips per broker: [partition, row, label]. The 500 GB P3 sits on its own top row so the copy path is clear. */
const RA_CHIPS: { p: string; b: number; row: number }[] = [
  { p: 'P3', b: 0, row: 0 },
  { p: 'P0', b: 0, row: 1 },
  { p: 'P6', b: 0, row: 2 },
  { p: 'P1', b: 1, row: 1 },
  { p: 'P4', b: 1, row: 2 },
  { p: 'P2', b: 2, row: 1 },
  { p: 'P5', b: 2, row: 2 },
]

function reassign(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const d2 = c.end(2) - a2
  const copyStart = a1 + 0.9
  const capAt = a2 + d2 * 0.5
  // old replica goes only after the new one has caught up (end of the throttled copy)
  const copyEnd = a3 + 0.6
  const prog = 0.3 * span(t, copyStart, a2) + 0.3 * span(t, a2 + 0.9, a2 + 1.8) + 0.25 * span(t, capAt, a3) + 0.15 * span(t, a3, copyEnd)
  const oldGone = t >= copyEnd + 0.3
  const rowY = RA.CY(0) + 32
  const from = { x: RA.CX(0) + RA.CW, y: rowY }
  const to = { x: RA.CX(3) - 14, y: rowY }
  const gaugeO = vis(t, a2 + 0.2, a3 + 0.3, 0.4)
  const GX = 420
  const GW = 1090
  const burst = t >= a2 + 0.9 && t < capAt
  const gaugeFill = t < a2 + 0.9 ? 0.22 : burst ? lerp(0.22, 1, span(t, a2 + 0.9, a2 + 1.8)) : lerp(1, 0.25, move(t, capAt, 0.5))
  const hotGauge = clamp((gaugeFill - 0.7) / 0.25)
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 560, s: 1.04 }, 1.3]])} title={{ kicker: 'REASSIGN', text: 'Dời partition' }}>
      {[0, 1, 2, 3].map((b) => (
        <Rise key={b} t={t} at={b === 3 ? a0 + 0.9 : 0.4 + b * 0.18}>
          <ServerUnit x={RA.SX[b]} y={RA.SY} name={`broker ${b + 1}`} t={t} accent={b === 3 ? INK.warn : undefined} />
        </Rise>
      ))}
      {RA_CHIPS.map((ch, i) => {
        const o = ch.p === 'P3' && oldGone ? 1 - span(t, copyEnd + 0.3, copyEnd + 0.8) : 1
        return (
          <Rise key={ch.p} t={t} at={0.9 + i * 0.1}>
            <div style={{ opacity: o }}>
              <Chip x={RA.CX(ch.b)} y={RA.CY(ch.row)} w={RA.CW} text={ch.p === 'P3' ? 'P3 · 500 GB' : ch.p} size={30} />
            </div>
          </Rise>
        )
      })}
      <Chip x={RA.CX(3)} y={RA.CY(1)} w={RA.CW} text="trống trơn" outline={INK.warn} color={INK.warn} size={28} o={vis(t, a0 + 2.2, copyStart - 0.2, 0.3)} glow={`0 0 ${14 + 12 * Math.sin(t * 5)}px ${INK.warn}`} />
      <Envelope t={t} at={a0 + (c.end(0) - a0) * 0.55} from={{ x: RA.CX(0) + 300, y: 288 }} to={{ x: RA.CX(3) - 80, y: 288 }} label="✕ không tự dời" color={INK.bad} len={1.6} arc={0} />
      {t >= copyStart && (
        <>
          <Wire from={from} to={to} color={INK.line} p={move(t, copyStart - 0.3, 0.5)} flow={t} />
          <div style={{ position: 'absolute', left: RA.CX(3), top: RA.CY(0), width: RA.CW, height: 64, boxSizing: 'border-box', borderRadius: 26, border: prog < 1 ? `2px dashed ${INK.accent}` : 'none', background: 'rgba(8,22,82,0.92)', overflow: 'hidden', boxShadow: prog < 1 ? undefined : GLOW }}>
            <div style={{ position: 'absolute', inset: 0, width: `${prog * 100}%`, background: HERO }} />
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 30, fontWeight: 800, color: '#fff' }}>{prog >= 1 ? 'P3 · 500 GB' : `P3 · ${Math.round(prog * 100)}%`}</div>
          </div>
          <Packets t={t} from={from} to={to} start={copyStart} end={a2 + 0.9} every={0.4} len={0.9} size={22} />
          <Packets t={t} from={from} to={to} start={a2 + 0.9} end={capAt} every={0.09} len={0.7} color={INK.bad} size={20} />
          {t >= capAt && prog < 1 && <Packets t={t} from={from} to={to} start={capAt} end={Infinity} every={0.4} len={0.9} color={INK.good} size={22} />}
        </>
      )}
      <Chip x={620} y={818} w={680} h={52} text={oldGone ? 'bản sao P3 chỉ còn ở broker 4' : '2 bản P3 cùng tồn tại · không lúc nào thiếu'} outline={oldGone ? INK.good : INK.accent} color={oldGone ? INK.good : '#fff'} size={28} o={vis(t, a1 + 1.4)} />
      {/* throttle gauge */}
      <div style={{ opacity: gaugeO }}>
        <div style={{ position: 'absolute', left: GX - 280, top: 906, width: 260, fontSize: 28, fontWeight: 800, color: INK.faint, textAlign: 'right' }}>băng thông</div>
        <div style={{ position: 'absolute', left: GX, top: 896, width: GW, height: 58, borderRadius: 29, background: 'rgba(110,160,255,0.18)', border: '1.5px solid rgba(110,160,255,0.5)' }} />
        <div style={{ position: 'absolute', left: GX, top: 896, width: GW * gaugeFill, height: 58, borderRadius: 29, background: GOOD_BG, overflow: 'hidden', boxShadow: `0 0 ${20 * (1 - hotGauge)}px ${INK.good}, 0 0 ${(20 + 14 * Math.sin(t * 9)) * hotGauge}px ${INK.bad}` }}>
          <div style={{ position: 'absolute', inset: 0, background: BAD_BG, opacity: hotGauge }} />
        </div>
        {t >= capAt && (
          <>
            <div style={{ position: 'absolute', left: GX + GW * 0.25 - 2, top: 878, width: 5, height: 94, borderRadius: 3, background: '#fff', boxShadow: '0 0 12px #fff' }} />
            <Chip x={GX + GW * 0.25 - 150} y={972} w={300} h={56} text="throttle 50 MB/s" bg={GOOD_BG} color="#0b2a1e" size={30} o={vis(t, capAt + 0.2)} />
          </>
        )}
        {t >= a2 + 1.8 && t < capAt + 0.4 && <Chip x={GX + GW - 380} y={972} w={380} h={56} text="100% mạng · traffic thật chậm" outline={INK.bad} color={INK.bad} size={28} o={vis(t, a2 + 1.8, capAt - 0.1, 0.3)} />}
      </div>
      {t >= a3 + 0.4 && (
        <div style={{ opacity: vis(t, a3 + 0.4) }}>
          <Chip x={500} y={915} w={560} h={64} text="kafka-reassign-partitions --verify" outline={INK.accent} color="#fff" size={28} mono />
          <Icon3D name="tick" x={1170} y={947} size={110} t={t} at={copyEnd + 0.4} />
          <Chip x={1250} y={917} w={330} h={60} text="xong · gỡ throttle" bg={GOOD_BG} color="#0b2a1e" size={30} o={vis(t, copyEnd + 0.4)} />
        </div>
      )}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 4. preferred leader */

const PL = { SX: [240, 830, 1420], SY: 330 }
/** Leader chips: home broker + slot. P1/P4 (home broker 2) move to broker 3 while broker 2 restarts. */
const PL_CHIPS = [
  { p: 'P0', home: 0, slot: 0 },
  { p: 'P3', home: 0, slot: 1 },
  { p: 'P1', home: 1, slot: 0, alt: 2 },
  { p: 'P4', home: 1, slot: 1, alt: 3 },
  { p: 'P2', home: 2, slot: 0 },
  { p: 'P5', home: 2, slot: 1 },
]
const plPos = (b: number, s: number) => ({ x: PL.SX[b] + (s % 2) * 135, y: 540 + Math.floor(s / 2) * 85 })

function preferred(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const down = a1 + 0.3
  const fly = a1 + 1.0
  const up = a2 + 0.3
  const back = a3 + 0.9
  const f = move(t, fly, 0.9) - move(t, back, 0.9)
  const b2down = t >= down && t < up
  const onB2 = f < 0.5 ? 2 : 0
  const counts = [2, onB2, 2 + (f >= 0.5 ? 2 : 0)]
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 1000, y: 560, s: 1.04 }, 1.3], [a3, WIDE, 1.3]])} title={{ kicker: 'LEADER', text: 'Preferred leader' }}>
      {[0, 1, 2].map((b) => (
        <Rise key={b} t={t} at={0.4 + b * 0.2}>
          <ServerUnit x={PL.SX[b]} y={PL.SY} name={`broker ${b + 1}`} down={b === 1 && b2down} t={t} />
        </Rise>
      ))}
      <Rise t={t} at={a0 + 0.6}>
        <div style={{ ...panel, left: 560, top: 200, width: 800, height: 80, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: MONO, fontSize: 36 }}>
          <span>P1 replicas: [</span>
          <span style={{ padding: '2px 18px', borderRadius: 14, background: HERO, boxShadow: GLOW }}>2 ★</span>
          <span>, 3, 1 ]</span>
        </div>
      </Rise>
      {PL_CHIPS.map((ch, i) => {
        const home = plPos(ch.home, ch.slot)
        const alt = ch.alt !== undefined ? plPos(2, ch.alt) : home
        const k = ch.alt !== undefined ? f : 0
        const x = lerp(home.x, alt.x, k)
        const y = lerp(home.y, alt.y, k)
        const pulse = ch.p === 'P1' && t >= a0 + 0.8 && t < a1 ? 0.5 + 0.5 * Math.sin(t * 7) : 0
        return (
          <Rise key={ch.p} t={t} at={0.9 + i * 0.1}>
            <Chip x={x} y={y} w={125} text={ch.p} size={30} glow={pulse ? `0 0 ${20 + 24 * pulse}px #ffffff, inset 0 2px 0 rgba(255,255,255,0.45)` : undefined} />
          </Rise>
        )
      })}
      {[0, 1, 2].map((b) => {
        const n = counts[b]
        const heavy = n >= 4
        return (
          <Rise key={b} t={t} at={1.4 + b * 0.1}>
            <div style={{ ...panel, left: PL.SX[b] - 40, top: 760, width: 340, height: 92, boxSizing: 'border-box', padding: '10px 20px', fontSize: 30, color: heavy ? INK.bad : b === 1 && n === 0 ? INK.warn : INK.good, boxShadow: heavy ? `${INK.card.boxShadow}, 0 0 ${16 + 14 * Math.sin(t * 6)}px ${INK.bad}` : (INK.card.boxShadow as string) }}>
              <div style={{ textAlign: 'center' }}>
                leader: {n}
                {heavy ? ' · gấp đôi' : ''}
              </div>
              <div style={{ marginTop: 8, height: 14, borderRadius: 7, background: 'rgba(110,160,255,0.2)' }}>
                <div style={{ width: `${(n / 4) * 100}%`, height: '100%', borderRadius: 7, background: heavy ? INK.bad : INK.good, boxShadow: `0 0 12px ${heavy ? INK.bad : INK.good}` }} />
              </div>
            </div>
          </Rise>
        )
      })}
      {t >= a2 + 0.5 && t < a3 && <Chip x={PL.SX[1] - 20} y={880} w={320} h={56} text="chỉ còn là follower" outline={INK.warn} color={INK.warn} size={28} o={vis(t, a2 + 0.5, a3 + 0.3)} />}
      {t >= a3 + 0.2 && (
        <div style={{ opacity: vis(t, a3 + 0.2) }}>
          <Chip x={230} y={905} w={1000} h={64} text="kafka-leader-election.sh --election-type preferred" outline={INK.accent} size={28} mono />
          <Icon3D name="clock" x={1340} y={937} size={100} t={t} at={a3 + 0.9} />
        </div>
      )}
      <Chip x={1410} y={909} w={420} h={56} text="tự động mỗi 300 giây" bg={GOOD_BG} color="#0b2a1e" size={28} o={vis(t, a3 + 1.2)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 5. rolling restart */

/** One restart: broker is down for `downLen`, comes back, then URP decays to 0 over `heal`. */
const cycle = (t: number, start: number, downLen = 1.3, heal = 1.4) => {
  const up = start + downLen
  const zero = up + heal
  return { start, up, zero, isDown: t >= start && t < up, urp: t < start ? 0 : t < up ? 12 : Math.round(12 * (1 - span(t, up, zero))) }
}

function rolling(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const c1 = cycle(t, a1 + 0.5)
  const c2 = cycle(t, Math.max(c1.zero + 0.6, a2 + 1.3))
  const c3 = cycle(t, c2.zero + 0.6)
  const cyc = [c1, c2, c3]
  const urp = Math.max(c1.urp, c2.urp, c3.urp)
  const both = t >= a0 + 1.8 && t < a0 + 3.3
  const SX = [240, 830, 1420]
  // stepper: broker 1 · wait · broker 2 · wait · broker 3
  const nodes = [
    { label: 'broker 1', cyc: 0, kind: 'b' },
    { label: 'URP = 0 ?', cyc: 0, kind: 'w' },
    { label: 'broker 2', cyc: 1, kind: 'b' },
    { label: 'URP = 0 ?', cyc: 1, kind: 'w' },
    { label: 'broker 3', cyc: 2, kind: 'b' },
  ]
  const stateOf = (n: (typeof nodes)[number]) => {
    const cy = cyc[n.cyc]
    const [from, to] = n.kind === 'b' ? [cy.start, cy.up] : [cy.up, cy.zero]
    return t >= to ? 'done' : t >= from ? 'active' : 'todo'
  }
  const dot = (alive: boolean, x: number, y: number, key: number) => (
    <div key={key} style={{ position: 'absolute', left: x, top: y, width: 54, height: 54, borderRadius: 27, background: alive ? GOOD_BG : 'rgba(80,100,160,0.35)', border: alive ? 'none' : '2px dashed rgba(255,90,106,0.8)', boxShadow: alive ? `0 0 16px ${INK.good}` : undefined }} />
  )
  const d3 = c.end(3) - a3
  const cmp = [
    { x: 150, slide: true, title: 'RF 3 · min ISR 2', alive: [true, true, true], ok: true, text: 'ISR 2/3 → ghi được', at: a3 + 0.3, kill: a3 + 1.4 },
    { x: 1010, slide: false, title: 'RF 2 · min ISR 2', alive: [true, true], ok: false, text: 'ISR 1/2 → acks=all lỗi', at: a3 + d3 * 0.48, kill: a3 + d3 * 0.48 + 1.0 },
  ]
  const rf2At = cmp[1].at
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a3, { x: 960, y: 580, s: 1.04 }, 1.3]])} title={{ kicker: 'NÂNG CẤP', text: 'Rolling restart' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${-90 * move(t, a3, 0.8)}px)` }}>
      {[0, 1, 2].map((b) => (
        <Rise key={b} t={t} at={0.4 + b * 0.2}>
          <ServerUnit x={SX[b]} y={300} name={`broker ${b + 1}`} down={cyc[b].isDown || (both && b > 0)} t={t} />
        </Rise>
      ))}
      <Rise t={t} at={a0 + 1.0}>
        <div style={{ ...panel, left: 710, top: 520, width: 500, height: 90, boxSizing: 'border-box', display: 'grid', placeItems: 'center', fontSize: both ? 36 : 44, color: urp || both ? INK.bad : INK.good, boxShadow: urp || both ? `${INK.card.boxShadow}, 0 0 30px ${INK.bad}77` : (INK.card.boxShadow as string) }}>{both ? '✕ hai broker cùng lúc' : `URP: ${urp}`}</div>
      </Rise>
      {nodes.map((n, i) => {
        const st = stateOf(n)
        const x = 170 + i * 330
        return (
          <div key={i}>
            <Rise t={t} at={a0 + 1.5 + i * 0.12}>
              <Chip x={x} y={690} w={260} h={76} text={st === 'done' ? `✓ ${n.label}` : n.label} size={30} bg={st === 'done' ? GOOD_BG : HERO} color={st === 'done' ? '#0b2a1e' : '#fff'} outline={st === 'todo' ? INK.dim : undefined} glow={st === 'active' ? `0 0 ${30 + 14 * Math.sin(t * 8)}px #ffffff` : undefined} />
            </Rise>
            {i > 0 && <Wire from={{ x: x - 70, y: 728 }} to={{ x: x - 12, y: 728 }} color={INK.accent} p={move(t, a0 + 1.7 + i * 0.12, 0.3)} />}
          </div>
        )
      })}
      </div>
      {cmp.map((cm) => (
        <Rise key={cm.title} t={t} at={cm.at}>
          <div style={{ ...INK.card, position: 'absolute', left: cm.slide ? lerp(580, cm.x, move(t, rf2At - 0.5, 0.7)) : cm.x, top: 760, width: 760, height: 250, boxSizing: 'border-box' }}>
            <div style={{ position: 'absolute', left: 32, top: 22, fontSize: 36, fontWeight: 800, color: INK.text, whiteSpace: 'nowrap' }}>{cm.title}</div>
            {cm.alive.map((a, j) => dot(a && !(j === cm.alive.length - 1 && t >= cm.kill), 40 + j * 80, 100, j))}
            <div style={{ position: 'absolute', left: 40 + cm.alive.length * 80 + 10, top: 112, fontSize: 26, fontWeight: 700, color: INK.faint }}>tắt 1 broker</div>
            <Chip x={30} y={176} w={700} h={56} text={`${cm.ok ? '✓' : '✕'} ${cm.text}`} bg={cm.ok ? GOOD_BG : BAD_BG} color={cm.ok ? '#0b2a1e' : '#fff'} size={30} o={vis(t, cm.kill + 0.6)} />
          </div>
        </Rise>
      ))}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 6. TLS, SASL, ACL */

const SC = { CX: 130, SX: 1530, Y: 480 }
const SCRAMBLE = '▒▓░█#@%&*'
const scr = (t: number, n: number, seed: number) => Array.from({ length: n }, (_, i) => SCRAMBLE[(Math.floor(t * 9) + i * 3 + seed) % SCRAMBLE.length]).join('')

function security(t: number, c: Cue) {
  const [a0, a1, a2, a3, a4] = [c.at(0), c.at(1), c.at(2), c.at(3), c.at(4)]
  const d3 = c.end(3) - a3
  const plain = ['đơn #8812', 'an@mail.vn', 'giá 2,4tr', 'địa chỉ …']
  const encrypted = t >= a1 + 0.7
  const flowing = t < a2 + 0.2
  const gates: { icon: Icon3DName; label: string; x: number; at: number }[] = [
    { icon: 'lock', label: 'TLS', x: 700, at: a1 + 0.3 },
    { icon: 'key', label: 'SASL', x: 960, at: a2 + 0.2 },
    { icon: 'shield', label: 'ACL', x: 1220, at: a3 + 0.2 },
  ]
  const rule = [
    { op: 'WRITE · orders', ok: true, at: a3 + 1.6 },
    { op: 'DELETE · orders', ok: false, at: a3 + d3 * 0.45 + 1.9 },
    { op: 'READ · payments', ok: false, at: a3 + d3 * 0.45 + 3.0 },
  ]
  const readT = Math.floor(t * 1.4)
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 520, s: 1.04 }, 1.3], [a3, { x: 960, y: 560, s: 1.02 }, 1.3]])} title={{ kicker: 'BẢO MẬT', text: 'Ba lớp bảo vệ' }}>
      <div style={{ position: 'absolute', inset: 0, transform: 'translateY(80px)' }}>
      <Rise t={t} at={0.4}>
        <ConsumerUnit x={SC.CX} y={SC.Y - 59} w={440} name="order-service" parts={['orders']} t={t} busy={(t * 0.9) % 1} accent={t < a2 ? INK.warn : INK.good} note={t < a2 ? 'ẩn danh' : undefined} />
      </Rise>
      <Rise t={t} at={0.6}>
        <ServerUnit x={SC.SX} y={SC.Y - 65} name="broker" t={t} />
      </Rise>
      <Wire from={{ x: SC.CX + 680, y: SC.Y }} to={{ x: SC.SX - 170, y: SC.Y }} color={INK.line} p={move(t, 0.8, 0.6)} flow={t} />
      {/* messages in flight: readable until TLS scrambles them */}
      {flowing &&
        t > 1.2 &&
        [0, 1, 2, 3].map((k) => {
          const p = (t * 0.4 + k / 4) % 1
          const x = lerp(SC.CX + 560, SC.SX - 140, p)
          const txt = encrypted ? scr(t, 8, k * 2) : plain[k]
          return (
            <div key={k} style={{ position: 'absolute', left: x - 90, top: SC.Y - 28, width: 180, height: 56, boxSizing: 'border-box', display: 'grid', placeItems: 'center', borderRadius: 999, background: 'rgba(8,22,82,0.92)', border: `1.5px solid ${encrypted ? INK.good : INK.warn}`, boxShadow: `0 0 16px ${encrypted ? INK.good : INK.warn}88`, fontFamily: MONO, fontSize: 24, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', opacity: Math.min(1, p * 8, (1 - p) * 8) }}>
              {txt}
            </div>
          )
        })}
      </div>
      <div style={{ position: 'absolute', inset: 0, transform: 'translateY(50px)' }}>
        <Chip x={760} y={310} w={400} h={56} text="PLAINTEXT :9092" outline={INK.bad} color={INK.bad} size={30} mono o={vis(t, a0 + 1.6, a1 + 0.2)} />
        {gates.map((g) => (
          <div key={g.label}>
            <Icon3D name={g.icon} x={g.x} y={310} size={140} t={t} at={g.at} />
            <Chip x={g.x - 70} y={380} w={140} h={46} text={g.label} size={28} o={vis(t, g.at + 0.2)} />
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', inset: 0, transform: 'translateY(80px)' }}>
      {/* eavesdropper */}
      <div style={{ opacity: vis(t, a0 + 2.2, a3 - 0.1, 0.4) }}>
        <Wire from={{ x: 960, y: 690 }} to={{ x: 960, y: SC.Y + 40 }} color={INK.bad} dashed p={move(t, a0 + 2.4, 0.5)} />
        <Icon3D name="zoom" x={960} y={760} size={170} t={t} at={a0 + 2.2} />
        <Chip x={660} y={870} w={600} h={56} text={encrypted ? `chỉ thấy: ${scr(t, 7, 1)}` : `đọc được: ${plain[readT % 4]}`} outline={encrypted ? INK.good : INK.bad} color={encrypted ? INK.good : INK.bad} size={28} mono />
      </div>
      {/* SASL handshake */}
      <Envelope t={t} at={a2 + 0.5} from={{ x: SC.CX + 680, y: SC.Y }} to={{ x: SC.SX - 170, y: SC.Y }} label="tôi là order-service" len={1.2} arc={-40} />
      <Envelope t={t} at={a2 + 2.0} from={{ x: SC.SX - 170, y: SC.Y }} to={{ x: SC.CX + 680, y: SC.Y }} label="xác thực OK ✓" color={INK.good} len={1.2} arc={-40} />
      {t > a2 + 3.1 && t < a3 && <Chip x={SC.CX + 30} y={640} w={380} h={56} text="principal: order-service" outline={INK.good} color={INK.good} size={28} o={vis(t, a2 + 3.1)} />}
      </div>
      {/* ACL */}
      <Rise t={t} at={a3 + 0.4}>
        <div style={{ ...INK.card, position: 'absolute', left: 520, top: 650, width: 880, height: 300, boxSizing: 'border-box' }}>
          <Chip x={28} y={16} w={420} h={52} text="User:order-service" size={28} mono />
          {rule.map((r, i) => (
            <div key={r.op} style={{ position: 'absolute', left: 28, top: 86 + i * 68, width: 824, height: 58, display: 'flex', alignItems: 'center', gap: 20, opacity: vis(t, a3 + 0.8 + i * 0.2, Infinity, 0.3) }}>
              <span style={{ fontFamily: MONO, fontSize: 30, fontWeight: 700, color: INK.text, width: 400 }}>{r.op}</span>
              <span style={{ fontSize: 30, fontWeight: 800, color: r.ok ? INK.good : INK.bad, opacity: vis(t, r.at, Infinity, 0.2) }}>{r.ok ? '✓ cho phép' : '✕ từ chối'}</span>
            </div>
          ))}
        </div>
      </Rise>
      <div style={{ position: 'absolute', inset: 0, transform: 'translateY(80px)' }}>
      <Envelope t={t} at={a3 + 0.6} from={{ x: SC.CX + 680, y: SC.Y }} to={{ x: SC.SX - 170, y: SC.Y }} label="WRITE orders" len={1.0} arc={-40} />
      <Envelope t={t} at={a3 + d3 * 0.45} from={{ x: SC.CX + 680, y: SC.Y }} to={{ x: SC.SX - 170, y: SC.Y }} label="DELETE orders" len={1.0} arc={-40} />
      <Envelope t={t} at={a3 + d3 * 0.45 + 1.1} from={{ x: SC.SX - 170, y: SC.Y }} to={{ x: SC.CX + 680, y: SC.Y }} label="✕ từ chối" color={INK.bad} len={0.9} arc={-40} />
      </div>
      <Statement x={430} y={985} text="SASL_SSL · mỗi service một principal" color={INK.good} size={46} o={sp(t, a4 + 0.3)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 7. summary */

function summary(t: number, c: Cue) {
  return (
    <SoftTheme>
      <SummaryList t={t} cue={c} items={['Lag đều · một cột cao · một cột đứng yên', 'Dấu hiệu → kiểm tra → xử lý', 'Dời partition có throttle · restart chờ URP = 0', 'TLS mã hoá · SASL xác thực · ACL phân quyền']} />
    </SoftTheme>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { hook, 'lag-shapes': lagShapes, triage, reassign, preferred, rolling, security, summary }

/** Key-moment sounds, timed to the same cue offsets the scenes animate on. */
const SFX: Record<string, SceneSfx[]> = {
  hook: [{ kind: 'error', at: () => 0.5 }],
  'lag-shapes': [
    { kind: 'error', at: (c) => c.at(3) + 1.0 },
    { kind: 'ding', at: (c) => c.at(4) + (c.end(4) - c.at(4)) * 0.42 + 0.6 },
  ],
  triage: [0, 1, 2].map((k) => ({ kind: 'ding' as const, at: (c: Cue) => triTimes(c, k).done })),
  reassign: [{ kind: 'error', at: (c) => c.at(2) + 1.8 }, { kind: 'ding', at: (c) => c.at(3) + 1.0 }],
  preferred: [{ kind: 'error', at: (c) => c.at(1) + 0.3 }, { kind: 'ding', at: (c) => c.at(3) + 1.8 }],
  rolling: [{ kind: 'error', at: (c) => c.at(0) + 1.8 }, { kind: 'error', at: (c) => c.at(1) + 0.5 }, { kind: 'ding', at: (c) => c.at(1) + 0.5 + 2.7 }, { kind: 'error', at: (c) => c.at(3) + (c.end(3) - c.at(3)) * 0.48 + 1.6 }],
  security: [{ kind: 'ding', at: (c) => c.at(1) + 0.7 }, { kind: 'ding', at: (c) => c.at(2) + 2.0 + 1.2 }, { kind: 'error', at: (c) => c.at(3) + (c.end(3) - c.at(3)) * 0.45 + 1.1 }],
}

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const incidentsOpsLesson: Lesson = {
  ...incidentsOpsScript,
  scenes: incidentsOpsScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id], sfx: SFX[s.id] })),
  intro: [
    { kind: 'video', scenes: ['hook'] },
    {
      kind: 'quiz',
      title: 'Quick Quiz',
      questions: [q('Đoán trước khi học: một partition có lag 80.000, các partition khác dưới 100, và `CURRENT-OFFSET` của partition đó vẫn nhích dần. Đây là sự cố gì?', ['Poison message', 'Hot partition', 'Broker chết', 'Đĩa đầy'], 1, 'Offset vẫn nhích nghĩa là consumer vẫn xử lý, chỉ không kịp vì một key dồn tải. Poison message thì offset đứng yên.')],
    },
  ],
  roadmap: [
    'Chặng 1: Sổ tay sáu sự cố theo khung dấu hiệu → kiểm tra → xử lý, bắt đầu từ hình dạng của lag.',
    'Chặng 2: Bảo trì an toàn: dời partition có throttle, trả leader về preferred, rolling restart chờ URP về không.',
    'Chặng 3: Bảo mật cơ bản với ba lớp TLS, SASL và ACL.',
  ],
  sections: [
    {
      id: 'lag-su-co',
      title: 'Ba sự cố nhìn ra từ hình dạng của lag',
      blocks: [
        { kind: 'video', scenes: ['lag-shapes'] },
        { kind: 'p', text: 'Mỗi kịch bản theo một khung: **dấu hiệu → kiểm tra → xử lý**. Ba sự cố đầu đều hiện ra là lag, nên hãy nhìn **hình dạng** của lag theo từng partition.' },
        {
          kind: 'table',
          head: ['Sự cố', 'Dấu hiệu', 'Kiểm tra', 'Xử lý'],
          rows: [
            ['**Lag tăng đều**', 'lag tăng ở mọi partition của một group', 'tốc độ ghi, DB phía sau, số consumer so với số partition', 'thêm consumer (tối đa = số partition), gom batch ghi DB; đã bằng số partition thì tăng partition (cẩn thận thứ tự key)'],
            ['**Hot partition**', 'một partition lag rất cao nhưng offset vẫn nhích; một broker tải cao hơn hẳn', 'phân bố key; so dung lượng các partition (`kafka-log-dirs.sh`) (📘 sách, ch.13)', 'đổi key, rắc muối key nóng (`shop-1#0` … `shop-1#9`) nếu chấp nhận mất thứ tự giữa các mảnh'],
            ['**Poison message**', 'lag của **một** partition đứng yên, `CURRENT-OFFSET` không nhích, crash/retry lặp ở một offset', '`kafka-console-consumer.sh --partition N --offset X --max-messages 1`', 'khẩn cấp: dừng group, bỏ qua đúng 1 tin; lâu dài: bắt lỗi, đẩy sang DLQ'],
          ],
        },
        { kind: 'callout', tone: 'warn', title: 'Thêm partition không cứu được hot partition', text: 'Partition = hash(key) % số_partition: mọi tin của cùng một key luôn vào **một** partition. Thêm partition chỉ chia lại các key **khác nhau**.' },
        { kind: 'p', text: 'Bỏ qua đúng một tin (poison message), **sau khi dừng group**:' },
        { kind: 'code', code: `./kafka-consumer-groups.sh --bootstrap-server $BS --group my-group \\\n  --topic orders:3 --reset-offsets --shift-by 1 --execute` },
        {
          kind: 'list',
          items: [
            { title: 'Lưu đường lui trước khi sửa offset', text: 'chạy `--reset-offsets --to-current --dry-run --export` ra file CSV; sửa sai thì nạp lại bằng `--from-file <file> --execute`. (📘 sách, ch.12)' },
            { title: 'Group phải dừng hẳn', text: '`--reset-offsets` chỉ chạy được khi không có member nào đang chạy, vì consumer đang chạy sẽ commit đè offset bạn vừa đặt.' },
            { title: 'Tin hỏng đến mức console consumer cũng không giải mã được', text: '`kafka-dump-log.sh --files <file .log> --print-data-log` đọc thẳng segment trên đĩa broker.' },
          ],
        },
        { kind: 'callout', tone: 'tip', title: 'Hình ảnh: dây chuyền đóng gói', text: 'Một hộp méo kẹt máy (poison message): cả dây chuyền **của làn đó** đứng, làn khác vẫn chạy. Gỡ hộp ra để riêng (DLQ) rồi chạy tiếp, chứ không tháo cả máy.' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Topic 6 partition. Partition 4 lag 80.000 và vẫn tăng, `CURRENT-OFFSET` vẫn nhích dần; 5 partition còn lại lag dưới 100. Đây là gì?', ['Poison message', 'Hot partition', 'Consumer chậm toàn group', 'Đĩa đầy'], 1, 'Offset còn nhích: consumer vẫn xử lý được nhưng không kịp, và chỉ một partition bị dồn tải.'),
            q('Vì sao thêm partition không cứu được hot partition gây bởi một key?', ['Vì Kafka giới hạn số partition', 'Vì cùng key luôn băm vào cùng một partition', 'Vì partition mới luôn trống', 'Vì phải restart broker'], 1, 'partition = hash(key) % số_partition, nên một key nóng vẫn dồn vào một partition.'),
          ],
        },
      ],
    },
    {
      id: 'su-co-ha-tang',
      title: 'Rebalance storm, đĩa đầy, broker chết',
      blocks: [
        { kind: 'video', scenes: ['triage'] },
        {
          kind: 'table',
          head: ['Sự cố', 'Dấu hiệu', 'Kiểm tra', 'Xử lý'],
          rows: [
            ['**Rebalance storm**', 'log consumer đầy "rebalance", lag tăng dù consumer không chết, xử lý lặp', 'một lô xử lý có vượt `max.poll.interval.ms` không? consumer có bị deploy liên tục không? `session.timeout.ms` có ngắn hơn GC pause không?', 'giảm `max.poll.records`; static membership (`group.instance.id`); cooperative rebalancing'],
            ['**Đĩa đầy**', 'đĩa broker gần 100%; đầy hẳn thì thư mục log offline → URP/offline tăng', '`kafka-log-dirs.sh --describe`; theo dõi cả inode (📘 sách, ch.13)', 'giảm tạm `retention.ms`/`retention.bytes` bằng `kafka-configs.sh`; mở rộng ổ đĩa; dời partition sang broker khác'],
            ['**Broker chết / URP > 0**', 'URP > 0, một broker không còn trong ISR của partition nào', '`--under-replicated-partitions`; log của broker đó (RAM, đĩa, mạng)', 'khởi động lại broker, nó tự đuổi kịp vào lại ISR; trong lúc URP > 0, **không** dừng thêm broker nào'],
          ],
        },
        { kind: 'callout', tone: 'warn', title: 'Đĩa đầy không báo trước', text: 'Broker **không** chậm dần để bạn kịp thấy: nó chạy bình thường cho đến khi đĩa đầy rồi hỏng đột ngột. Phải cảnh báo theo phần trăm đĩa từ sớm (ví dụ 70–75%). **Không** `rm` file segment bằng tay khi broker đang chạy, vì broker vẫn giữ index và offset của chúng; giảm retention để chính broker dọn. (📘 sách, ch.13)' },
        { kind: 'callout', tone: 'tip', title: 'Nếu mọi broker vẫn sống mà URP > 0', text: 'Tìm broker **xuất hiện chung** trong cột Replicas của mọi dòng URP: đó thường là broker có vấn đề (đĩa sắp hỏng, card mạng lỗi, cấu hình lệch). (📘 sách, ch.13)' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Đĩa một broker đầy 95%. Đồng nghiệp đề nghị `rm` mấy file `.log` cũ nhất. Cách đúng là gì?', ['Làm theo, nhanh nhất', 'Giảm `retention.ms`/`retention.bytes` để broker tự xoá segment', 'Restart broker', 'Tắt producer'], 1, 'Broker đang giữ index, log start offset và file mở của các segment đó; xoá sau lưng broker gây lỗi đọc hoặc trạng thái không nhất quán.'),
            q('URP đang bằng 4. Bạn có nên restart một broker khác để nâng cấp không?', ['Có, tranh thủ', 'Không, chờ URP về 0', 'Có, nếu RF = 3', 'Chỉ khi ngoài giờ cao điểm'], 1, 'Khi URP > 0 một số partition chỉ còn ít replica trong ISR; dừng thêm broker có thể kéo ISR xuống dưới min.insync.replicas.'),
          ],
        },
      ],
    },
    {
      id: 'di-chuyen-partition',
      title: 'Di chuyển partition (reassignment)',
      blocks: [
        { kind: 'video', scenes: ['reassign'] },
        { kind: 'p', text: 'Thêm broker 4 vào cluster 3 broker: broker mới **trống trơn**, vì Kafka không tự dời partition cũ sang. Dùng `kafka-reassign-partitions.sh` theo 3 bước:' },
        {
          kind: 'code',
          code: `# 1. Sinh đề xuất: dời các partition của topic trong topics.json sang broker 1,2,3,4
./kafka-reassign-partitions.sh --bootstrap-server $BS --generate \\
  --topics-to-move-json-file topics.json --broker-list "1,2,3,4"
# 2. Thực hiện, GIỚI HẠN băng thông sao chép 50 MB/giây
./kafka-reassign-partitions.sh --bootstrap-server $BS --execute \\
  --reassignment-json-file plan.json --throttle 50000000
# 3. Kiểm tra xong chưa (lệnh này cũng gỡ throttle khi đã xong)
./kafka-reassign-partitions.sh --bootstrap-server $BS --verify \\
  --reassignment-json-file plan.json`,
        },
        { kind: 'callout', tone: 'info', title: 'Vì sao phải throttle?', text: 'Dời một partition 500 GB = sao chép 500 GB qua mạng. Không giới hạn thì việc sao chép chiếm hết băng thông, producer và consumer thật bị chậm, follower có thể tụt khỏi ISR.' },
        {
          kind: 'list',
          items: [
            { title: 'Thêm trước, bỏ sau', text: 'controller **thêm** replica mới vào danh sách trước nên RF **tạm tăng** (ví dụ `[1,2,3]` → `[1,2,3,4,5,6]`); đuổi kịp xong mới bỏ replica cũ. Partition không lúc nào thiếu bản sao. (📘 sách, ch.12)' },
            { title: 'Lưu phân bổ hiện tại', text: '`--generate` và `--execute` in ra phân bổ hiện tại: lưu vào file làm kế hoạch quay lại.' },
            { title: '`--cancel` / `--additional`', text: '`--cancel` dừng các lần dời đang chạy và trả danh sách replica về như trước; `--additional` thêm đợt dời mới khi đợt cũ chưa xong.' },
            { title: 'Đổi RF của topic có sẵn', text: 'viết JSON thêm hoặc bớt broker trong danh sách replica rồi `--execute`. Đổi `default.replication.factor` của broker **không** sửa topic đã tạo.' },
          ],
        },
        { kind: 'callout', tone: 'tip', title: 'Kafka không tự cân bằng theo tải', text: 'Cluster lớn thường dùng công cụ ngoài như **Cruise Control** để theo dõi tải và tự sinh kế hoạch reassign. (📘 sách, ch.12, ch.13)' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Thêm 3 broker mới, chạy reassign không có `--throttle` lúc 10 giờ sáng. Chuyện gì có thể xảy ra?', ['Không gì cả', 'Sao chép chiếm hết băng thông và đĩa, request thật chậm, follower tụt ISR → URP tăng', 'Reassign tự huỷ', 'Broker mới từ chối dữ liệu'], 1, 'Không giới hạn thì việc sao chép tranh tài nguyên với Produce/Fetch thật ngay giờ cao điểm.'),
            q('Giữa lúc dời `[1,2,3]` sang `[4,5,6]`, `kafka-topics.sh --describe` cho thấy cột Replicas có 6 broker. Có phải lỗi không?', ['Có, phải cancel', 'Không, controller thêm replica mới trước rồi mới bỏ replica cũ', 'Có, RF bị cấu hình sai', 'Không, do cache của describe'], 1, 'Thêm trước, bỏ sau để partition không lúc nào thiếu bản sao; RF tạm thời là 6.'),
          ],
        },
      ],
    },
    {
      id: 'leader-restart',
      title: 'Preferred leader và rolling restart',
      blocks: [
        { kind: 'video', scenes: ['preferred'] },
        { kind: 'p', text: 'Mỗi partition có danh sách replica, ví dụ `[2, 3, 1]`; replica **đầu tiên** (broker 2) là **preferred leader**. Broker 2 restart → leader chuyển sang broker 3. Broker 2 quay lại chỉ làm follower → broker 3 gánh gấp đôi số leader.' },
        {
          kind: 'list',
          items: [
            { title: 'Tự động', text: '`auto.leader.rebalance.enable=true` (mặc định) kiểm tra mỗi 300 giây (`leader.imbalance.check.interval.seconds`), trả leader về khi mất cân bằng vượt 10% (`leader.imbalance.per.broker.percentage`). (📘 sách, ch.2)' },
            { title: 'Thủ công', text: '`./kafka-leader-election.sh --bootstrap-server $BS --election-type preferred --all-topic-partitions`' },
          ],
        },
        { kind: 'callout', tone: 'tip', title: 'Thao tác nhẹ và an toàn', text: 'Client tự theo leader mới, nên sách khuyên làm preferred election **đầu tiên** khi một broker có vẻ quá tải, trước khi chẩn đoán sâu hơn. (📘 sách, ch.12, ch.13)' },
        { kind: 'video', scenes: ['rolling'] },
        {
          kind: 'list',
          ordered: true,
          items: [
            { text: 'Restart broker 1 (tắt có kiểm soát: nó chuyển leader của mình đi trước khi tắt).' },
            { text: '**Chờ URP về 0** (broker 1 đã đuổi kịp, vào lại ISR).' },
            { text: 'Mới sang broker 2. Lặp lại.' },
          ],
        },
        { kind: 'p', text: 'Với RF = 3, `min.insync.replicas` = 2: tắt 1 broker, ISR còn 2, vẫn ghi được. Với RF = 2, `min.insync.replicas` = 2: tắt 1 broker là ISR còn 1 → producer `acks=all` **không ghi được** trong lúc restart. Quy tắc của sách: RF ít nhất lớn hơn `min.insync.replicas` **1** đơn vị; nếu đủ phần cứng, lớn hơn **2** đơn vị để chịu cùng lúc một lần tắt có kế hoạch **và** một sự cố bất ngờ. (📘 sách, ch.2)' },
        { kind: 'callout', tone: 'tip', title: 'Hình ảnh: sửa cầu nhiều làn xe', text: 'Đóng từng làn để sửa, chờ làn đó thông xe trở lại mới đóng làn khác. Đóng hai làn cùng lúc trên cầu 3 làn là kẹt xe.' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Vì sao phải chờ URP về 0 trước khi restart broker tiếp theo?', ['Cho đẹp log', 'Vì URP > 0 nghĩa là một số partition ít replica trong ISR; dừng thêm broker có thể kéo ISR dưới min.insync.replicas', 'Vì Kafka bắt buộc', 'Để controller đổi'], 1, 'Nếu không, producer acks=all không ghi được, hoặc tệ hơn là partition offline.'),
            q('RF = 2, min.insync.replicas = 2, rolling restart. Chuyện gì xảy ra với producer acks=all khi một broker tắt?', ['Vẫn ghi bình thường', 'Lỗi NotEnoughReplicas trong lúc broker tắt', 'Tự giảm min ISR', 'Mất dữ liệu cũ'], 1, 'ISR còn 1 < 2. Đây là lý do RF = 3 là chuẩn.'),
          ],
        },
      ],
    },
    {
      id: 'bao-mat',
      title: 'Bảo mật cơ bản: TLS, SASL, ACL',
      blocks: [
        { kind: 'video', scenes: ['security'] },
        { kind: 'p', text: 'Kafka mặc định (listener `PLAINTEXT`) **không mã hoá, không hỏi danh tính, không phân quyền**. Ai kết nối được tới cổng 9092 đều đọc và ghi được mọi topic, thậm chí xoá topic.' },
        {
          kind: 'table',
          head: ['Lớp', 'Câu hỏi', 'Cơ chế trong Kafka'],
          rows: [
            ['**Mã hoá**', 'Người nghe lén trên mạng có đọc được không?', '**TLS** (listener `SSL`, `SASL_SSL`)'],
            ['**Xác thực**', 'Bạn là ai?', '**SASL**: `PLAIN`, `SCRAM-SHA-256/512`, `GSSAPI` (Kerberos), `OAUTHBEARER`; hoặc mTLS'],
            ['**Phân quyền**', 'Bạn được làm gì?', '**ACL**: (principal, thao tác, tài nguyên), ví dụ `User:order-service` được `WRITE` topic `orders`'],
          ],
        },
        { kind: 'code', code: `# Cluster phải bật authorizer thì ACL mới có tác dụng\n./kafka-acls.sh --bootstrap-server $BS --add \\\n  --allow-principal User:order-service --operation Write --topic orders` },
        { kind: 'callout', tone: 'tip', title: 'Hình ảnh: toà nhà văn phòng', text: 'TLS là **xe chở tiền có vách kín** (người ngoài không nhìn vào được). SASL là **thẻ nhân viên ở cổng** (bạn là ai). ACL là **danh sách phòng thẻ được mở** (kế toán vào phòng kế toán, không vào phòng server).' },
        {
          kind: 'list',
          items: [
            { title: 'Đừng dùng SASL_PLAINTEXT + PLAIN', text: 'mật khẩu đi **trần** qua mạng. Production nên dùng `SASL_SSL`; SCRAM cũng phải đi cùng TLS vì kẻ nghe lén có thể dò mật khẩu từ giá trị băm lúc bắt tay. (📘 sách, ch.11)' },
            { title: 'Luật quyết định của ACL', text: 'Deny khớp thì từ chối (Deny thắng Allow); không có Deny thì cần ít nhất một Allow khớp. Tài nguyên chưa có ACL nào mặc định **bị từ chối** (trừ khi bật `allow.everyone.if.no.acl.found=true`, không hợp production). `super.users` được làm mọi thứ. (📘 sách, ch.11)' },
            { title: 'User:ANONYMOUS', text: 'kết nối không xác thực được gán principal này; thấy nó trong log là biết có client chưa xác thực. (📘 sách, ch.11)' },
            { title: 'Quyền tối thiểu', text: 'mỗi service một principal, chỉ quyền trên đúng topic và consumer group nó cần.' },
          ],
        },
        { kind: 'callout', tone: 'info', title: 'KRaft và AclAuthorizer', text: 'Sách (bản 2021, Kafka ~2.8–3.0) mô tả `AclAuthorizer` lưu ACL trong ZooKeeper. Cluster KRaft trên 3.9.1 dùng `StandardAuthorizer`, lưu ACL trong metadata của KRaft; cách cấp ACL bằng `kafka-acls.sh` vẫn như nhau.' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Cluster bật SASL/SCRAM nhưng listener là `SASL_PLAINTEXT`. Còn rủi ro gì?', ['Không còn', 'Nội dung tin đi trần trên mạng, và kẻ nghe lén có thể dò mật khẩu từ giá trị băm lúc bắt tay', 'Broker không khởi động được', 'ACL ngừng hoạt động'], 1, 'SASL chỉ xác thực, không mã hoá. Cần TLS (`SASL_SSL`).'),
            q('Vì sao mỗi service nên có principal riêng thay vì dùng chung user `app`?', ['Cho dễ nhớ', 'Để cấp quyền tối thiểu, hạn chế thiệt hại khi lộ mật khẩu và biết service nào đã làm gì', 'Vì Kafka bắt buộc', 'Để nhanh hơn'], 1, 'ACL gắn với principal: dùng chung thì service nào cũng có quyền của mọi service.'),
          ],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: chẩn đoán sự cố',
      blocks: [
        { kind: 'p', text: 'Chọn các dấu hiệu bạn đang thấy để xem chẩn đoán và cách xử lý. Sau đó thử tính thời gian dời partition theo throttle, và kiểm tra rolling restart với RF và min ISR khác nhau.' },
        { kind: 'widget', name: 'incident-lab' },
      ],
    },
    {
      id: 'tom-tat-video',
      title: 'Nhìn lại cả bài',
      blocks: [{ kind: 'video', scenes: ['summary'] }],
    },
  ],
  finalQuiz: [
    q('Lag của một partition đứng yên, `CURRENT-OFFSET` không nhích. Nghi ngờ đầu tiên là gì?', ['Hot partition', 'Poison message', 'Đĩa đầy', 'Rebalance storm'], 1, 'Offset không nhích cho thấy consumer kẹt ở cùng một tin.'),
    q('Dời partition giữa giờ làm việc, cách an toàn là gì?', ['Chạy reassign không giới hạn cho nhanh', 'Đặt `--throttle` để sao chép không chiếm hết băng thông', 'Tắt producer', 'Xoá topic rồi tạo lại'], 1, 'Throttle giữ chỗ cho traffic thật.'),
    q('Sau rolling restart, một broker gánh gấp đôi leader. Sửa thế nào?', ['Restart lại toàn cluster', 'Chạy preferred leader election', 'Tăng partition', 'Xoá broker'], 1, 'Election trả leader về replica đầu tiên trong danh sách, là thao tác nhẹ và an toàn.'),
    q('Lớp nào trả lời câu hỏi "bạn được làm gì"?', ['TLS', 'SASL', 'ACL', 'mTLS'], 2, 'TLS mã hoá, SASL xác thực, ACL phân quyền.'),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao rolling restart phải chờ URP về 0 trước khi sang broker tiếp theo?',
      keywords: ['URP', 'ISR', 'min', 'replica'],
      modelAnswer: 'Vì URP lớn hơn 0 nghĩa là một số partition đang thiếu replica trong ISR. Nếu tắt thêm một broker lúc đó, ISR của chúng có thể tụt xuống dưới min.insync.replicas, producer acks=all không ghi được, hoặc partition thành offline. Chờ URP về 0 là chờ broker vừa restart đuổi kịp và vào lại ISR.',
    },
  ],
  recap: {
    journey:
      'Điện thoại reo lúc ba giờ sáng → nhìn hình dạng của lag để phân biệt consumer chậm, hot partition, poison message → thêm rebalance storm, đĩa đầy, broker chết, mỗi cái một khung dấu hiệu, kiểm tra, xử lý → dời partition luôn có throttle → preferred leader election trả leader về chỗ → rolling restart một broker mỗi lần, chờ URP về không → TLS mã hoá, SASL xác thực, ACL phân quyền.',
    points: [
      { title: 'Sáu sự cố', text: 'Lag đều, hot partition, poison message, rebalance storm, đĩa đầy, broker chết: mỗi cái đi theo dấu hiệu → kiểm tra → xử lý.' },
      { title: 'Dời partition', text: 'Thêm trước bỏ sau, luôn đặt --throttle, kết thúc bằng --verify.' },
      { title: 'Leader & restart', text: 'Preferred election cân bằng lại leader; rolling restart từng broker, chờ URP = 0.' },
      { title: 'Bảo mật', text: 'TLS mã hoá, SASL xác thực, ACL phân quyền; production dùng SASL_SSL, mỗi service một principal.' },
    ],
    next: 'Module tiếp theo: Dual-write, Outbox & Inbox — làm cho "ghi database rồi gửi Kafka" không bao giờ lệch nhau.',
  },
}
