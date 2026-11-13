import type { ReactNode } from 'react'
import { cameraAt, clamp, lerp, move, sp, span, vis } from '../player/motion-kit'
import { Icon3D, Rise, SOFT, SOFT_PANEL, ServerUnit, SoftScene, SoftTheme, Statement, SummaryList } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene, SceneSfx } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { monitoringScript } from './monitoring-script'

/** This lesson is drawn in the navy glow style. */
const INK = SOFT
const panel = SOFT_PANEL
const WIDE = { x: 960, y: 540, s: 1 }
const VIOLET = '#b07bff'
const ORANGE = '#ff8a4d'

/* ------------------------------------------------------------------ shared drawing helpers */

/** Full-frame SVG in scene coordinates (overflow visible) for lines, arcs and axes. */
const Abs = ({ children }: { children: ReactNode }) => (
  <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
    {children}
  </svg>
)

/** Glowing label pill. `cx` centres it on x instead of left-aligning. */
function Tag({ x, y, text, color = INK.accent, size = 30, o = 1, cx = false, fill }: { x: number; y: number; text: string; color?: string; size?: number; o?: number; cx?: boolean; fill?: string }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: cx ? 'translateX(-50%)' : undefined, padding: '8px 24px', borderRadius: 999, background: fill ?? 'rgba(8,22,82,0.92)', border: `1.5px solid ${color}`, boxShadow: `0 0 18px ${color}88`, color: fill ? '#fff' : color === INK.accent ? '#fff' : color, fontSize: size, fontWeight: 800, whiteSpace: 'nowrap', opacity: clamp(o) }}>
      {text}
    </div>
  )
}

/** Frosted card with a title; children are positioned relative to the card's top-left. */
function Card({ x, y, w, h, title, color, o = 1, children }: { x: number; y: number; w: number; h: number; title?: string; color?: string; o?: number; children?: ReactNode }) {
  return (
    <div style={{ ...panel, left: x, top: y, width: w, height: h, boxSizing: 'border-box', padding: 0, opacity: clamp(o), border: color ? `2px solid ${color}` : (panel.border as string), boxShadow: color ? `0 0 30px ${color}77, 0 24px 50px rgba(0,4,30,0.55)` : (panel.boxShadow as string) }}>
      {title && <div style={{ position: 'absolute', left: 28, top: 18, fontSize: 30, fontWeight: 800, color: INK.faint, whiteSpace: 'nowrap' }}>{title}</div>}
      {children}
    </div>
  )
}

/** Polyline drawn from its start up to fraction `p`, with a glowing head. */
function Line({ pts, p, color, width = 7, head = true }: { pts: [number, number][]; p: number; color: string; width?: number; head?: boolean }) {
  const n = pts.length - 1
  const f = clamp(p) * n
  const i = Math.min(n, Math.floor(f))
  const out = pts.slice(0, i + 1)
  if (i < n) out.push([lerp(pts[i][0], pts[i + 1][0], f - i), lerp(pts[i][1], pts[i + 1][1], f - i)])
  const end = out[out.length - 1]
  return (
    <g style={{ filter: `drop-shadow(0 0 8px ${color})` }}>
      {out.length > 1 && <polyline points={out.map((q) => q.join(',')).join(' ')} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />}
      {head && p > 0 && <circle cx={end[0]} cy={end[1]} r={width * 1.5} fill="#fff" />}
    </g>
  )
}

/** Piecewise-linear value over time: [[time, value], ...] sorted by time. */
function track(t: number, keys: [number, number][]): number {
  if (t <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const u = span(t, keys[i - 1][0], keys[i][0])
      return lerp(keys[i - 1][1], keys[i][1], u * u * (3 - 2 * u))
    }
  }
  return keys[keys.length - 1][1]
}

/** Blend two colours given as #rrggbb or rgb(r,g,b) (p = 0 gives a, p = 1 gives b). */
function mix(a: string, b: string, p: number): string {
  const k = clamp(p)
  const rgb = (c: string) => (c.startsWith('#') ? [0, 1, 2].map((i) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16)) : (c.match(/\d+/g) ?? []).map(Number))
  const [ca, cb] = [rgb(a), rgb(b)]
  return `rgb(${[0, 1, 2].map((i) => Math.round(lerp(ca[i], cb[i], k))).join(',')})`
}

/** Average of a 0..1 state function over the last ~0.42 s: turns a hard switch into a short linear ramp. */
const soften = (t: number, f: (x: number) => number) => {
  let sum = 0
  for (let j = 0; j < 8; j++) sum += f(t - j * 0.06)
  return sum / 8
}

/** Glowing border drawn over a Card; fade it with `p` instead of switching the card's border colour. */
const AlertRim = ({ color, p }: { color: string; p: number }) => (
  <div style={{ position: 'absolute', inset: -2, borderRadius: 22, border: `2px solid ${color}`, boxShadow: `0 0 30px ${color}77`, opacity: clamp(p), pointerEvents: 'none' }} />
)

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN')

/** Segmented horizontal bar: widths in px, each segment grows with its own progress. */
function SegBar({ x, y, h = 76, segs, glowColor }: { x: number; y: number; h?: number; segs: { w: number; color: string; p: number; text?: string }[]; glowColor?: string }) {
  let cursor = x
  return (
    <>
      {segs.map((s, i) => {
        const left = cursor
        const w = s.w * clamp(s.p)
        cursor += w
        return (
          <div key={i} style={{ position: 'absolute', left, top: y, width: w, height: h, boxSizing: 'border-box', background: `linear-gradient(180deg, ${s.color}, ${s.color}aa)`, borderRadius: i === 0 ? '18px 0 0 18px' : i === segs.length - 1 ? '0 18px 18px 0' : 0, borderRight: i < segs.length - 1 ? '3px solid #081544' : undefined, boxShadow: glowColor && s.color === glowColor ? `0 0 30px ${glowColor}, inset 0 2px 0 rgba(255,255,255,0.4)` : 'inset 0 2px 0 rgba(255,255,255,0.35)', overflow: 'hidden', display: 'grid', placeItems: 'center', fontSize: 34, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>
            {s.p > 0.9 ? s.text : ''}
          </div>
        )
      })}
    </>
  )
}

/* ------------------------------------------------------------------ 0. cold open: slow notifications, no errors */

function hook(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const early = 1 - span(t, a2 - 0.2, a2 + 0.3)
  const at = (k: number) => a2 + 0.3 + k * 0.9
  const live = (k: number) => 0.5 + 0.5 * Math.sin((t - at(k)) * 4)
  const spark: [number, number][] = Array.from({ length: 24 }, (_, i) => [i * 24, 190 - (i / 23) ** 2 * 140 - Math.sin(i * 1.3) * 8])
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 560, s: 1.04 }, 1.4], [a2, WIDE, 1.2]])} title={{ kicker: 'GIÁM SÁT', text: 'Nhìn vào bên trong' }}>
      <div style={{ opacity: early }}>
        <Icon3D name="bell" x={450} y={520} size={300} t={t} at={0.4} />
        <Statement x={660} y={430} text="thông báo đến chậm 10 phút" size={64} color={INK.warn} o={sp(t, a0 + 0.8)} />
        <Rise t={t} at={a1 + 0.2}>
          <ServerUnit x={680} y={600} name="kafka · đang chạy" t={t} />
        </Rise>
        <Tag x={1010} y={640} text="log: 0 lỗi" color={INK.good} size={44} o={vis(t, a1 + 0.9)} />
      </div>
      <Rise t={t} at={at(0)}>
        <Card x={170} y={230} w={760} h={360} title="Consumer lag">
          <svg width={760} height={360} style={{ position: 'absolute', left: 0, top: 0 }}>
            <Line pts={spark.map(([x, y]) => [x + 90, y + 100] as [number, number])} p={move(t, at(0) + 0.4, 3)} color={INK.warn} />
            {t > at(0) + 3.4 && <circle cx={spark[23][0] + 90} cy={spark[23][1] + 100} r={14 + 10 * live(0)} fill="none" stroke={INK.warn} strokeWidth={4} opacity={1 - live(0) * 0.6} />}
          </svg>
        </Card>
      </Rise>
      <Rise t={t} at={at(1)}>
        <Card x={990} y={230} w={760} h={360} title="Sức khoẻ cluster">
          {['URP  0', 'UnderMinIsr  0', 'Offline  0', 'Controller  1'].map((s, i) => (
            <div key={s} style={{ position: 'absolute', left: 30 + (i % 2) * 360, top: 120 + Math.floor(i / 2) * 110, opacity: 0.8 + 0.2 * live(1) }}>
              <Tag x={0} y={0} text={s} color={INK.good} size={34} />
            </div>
          ))}
        </Card>
      </Rise>
      <Rise t={t} at={at(2)}>
        <Card x={170} y={640} w={760} h={360} title="Độ trễ request">
          <div style={{ position: 'absolute', left: 36, top: 150 }}>
            <SegBar x={0} y={0} h={70} segs={[{ w: 110, color: INK.warn, p: move(t, at(2) + 0.3, 0.6) }, { w: 150, color: INK.accent, p: move(t, at(2) + 0.7, 0.6) }, { w: 260, color: VIOLET, p: move(t, at(2) + 1.1, 0.6) }, { w: 170, color: INK.good, p: move(t, at(2) + 1.5, 0.6) }]} />
          </div>
        </Card>
      </Rise>
      <Rise t={t} at={at(3)}>
        <Card x={990} y={640} w={760} h={360} title="Luồng · đĩa · mạng">
          {[
            ['luồng rảnh', 0.9, INK.good],
            ['đĩa dùng', 0.6, INK.accent],
            ['mạng', 0.4, VIOLET],
          ].map(([label, v, col], i) => (
            <div key={label as string}>
              <div style={{ position: 'absolute', left: 30, top: 96 + i * 82, fontSize: 32, fontWeight: 700, color: INK.text }}>{label as string}</div>
              <div style={{ position: 'absolute', left: 250, top: 106 + i * 82, width: 470, height: 30, borderRadius: 15, background: 'rgba(110,160,255,0.18)' }} />
              <div style={{ position: 'absolute', left: 250, top: 106 + i * 82, width: 470 * clamp((v as number) * move(t, at(3) + 0.3 + i * 0.25, 0.8) + 0.03 * Math.sin(t * 2.4 + i * 2) * move(t, at(3) + 1.5, 0.5)), height: 30, borderRadius: 15, background: col as string, boxShadow: `0 0 14px ${col}` }} />
            </div>
          ))}
        </Card>
      </Rise>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 1. lag = end offset - committed offset */

const TAPE = { X: 260, Y: 530, CELLS: 25, CW: 56, END: 25, COMMIT: 10 }

function lag(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const d0 = c.end(0) - a0
  const endAt = a0 + d0 * 0.55
  const commitAt = a0 + d0 * 0.85
  const lit = Math.floor(15 * move(t, a2 + 0.2, Math.max(1, c.end(2) - a2 - 0.6)))
  const xs = (i: number) => TAPE.X + i * TAPE.CW
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 560, s: 1.05 }, 1.3], [a2, WIDE, 1.2]])} title={{ kicker: 'CONSUMER LAG', text: 'Lag là gì' }}>
      <Statement x={350} y={250} text="lag = log end − committed" size={64} o={sp(t, a0 + 0.8)} />
      {Array.from({ length: TAPE.CELLS }, (_, i) => {
        const pending = i >= TAPE.COMMIT
        const on = pending && i - TAPE.COMMIT < lit
        const rise = sp(t, 0.4 + i * 0.03)
        return (
          <div key={i} style={{ position: 'absolute', left: xs(i), top: TAPE.Y, width: TAPE.CW - 6, height: 84, borderRadius: 12, opacity: clamp(rise), background: INK.cell.filled, boxShadow: on ? `0 0 22px ${INK.warn}` : '0 6px 14px rgba(0,8,50,0.4)', transform: on ? 'translateY(-8px)' : undefined, border: '1.5px solid rgba(255,255,255,0.25)' }}>
            {pending && <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', background: 'linear-gradient(160deg, #ffd27a, #e8901a)', opacity: span(t, commitAt + (i - TAPE.COMMIT) * 0.02, commitAt + (i - TAPE.COMMIT) * 0.02 + 0.25) }} />}
          </div>
        )
      })}
      <Abs>
        <g opacity={vis(t, endAt)}>
          <path d={`M ${xs(TAPE.END) - 3} ${TAPE.Y - 20} v -50`} stroke="#fff" strokeWidth={5} />
        </g>
        <g opacity={vis(t, commitAt)}>
          <path d={`M ${xs(TAPE.COMMIT) - 3} ${TAPE.Y + 104} v 50`} stroke={INK.good} strokeWidth={5} />
        </g>
      </Abs>
      <div style={{ position: 'absolute', left: xs(TAPE.END) - 22, top: TAPE.Y - 130, transform: 'translateX(-100%)', textAlign: 'right', opacity: vis(t, endAt), whiteSpace: 'nowrap' }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: '#fff' }}>log end offset</div>
        <div style={{ fontSize: 44, fontWeight: 800, color: '#fff', fontFamily: MONO, opacity: vis(t, a1 + 0.5) }}>10.000</div>
      </div>
      <div style={{ position: 'absolute', left: xs(TAPE.COMMIT) - 3, top: TAPE.Y + 164, transform: 'translateX(-50%)', textAlign: 'center', opacity: vis(t, commitAt, Infinity, 0.6), whiteSpace: 'nowrap' }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: INK.good }}>consumer đã commit</div>
        <div style={{ fontSize: 44, fontWeight: 800, color: INK.good, fontFamily: MONO, opacity: vis(t, a1 + 1.6) }}>9.400</div>
      </div>
      <Tag x={xs(TAPE.COMMIT) + 7 * TAPE.CW} y={TAPE.Y + 180} text={`đang chờ: ${fmt(lit * 40)} tin`} color={INK.warn} size={36} cx o={vis(t, a2 + 0.2)} />
      <Statement x={470} y={880} text="lag = 600 tin đang nằm chờ" color={INK.warn} size={56} o={sp(t, a2 + 0.9)} />
      <Icon3D name="chart" x={200} y={300} size={170} t={t} at={a0 + 0.6} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 2. trend beats the number */

/** Plot geometry inside a 780 x 620 card. */
const PLOT = { X0: 160, DX: 280, BASE: 540, H: 380 }
const py = (v: number) => PLOT.BASE - (v / 12000) * PLOT.H

function trend(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const d1 = c.end(1) - a1
  const d2 = c.end(2) - a2
  const A = [5000, 5200, 4900]
  const B = [5000, 8000, 11000]
  const aAt = [a0 + 0.6, a1 + d1 * 0.4, a1 + d1 * 0.66]
  const bAt = [a0 + 0.6, a2 + d2 * 0.38, a2 + d2 * 0.62]
  const ptsOf = (vals: number[]): [number, number][] => vals.map((v, i) => [PLOT.X0 + i * PLOT.DX, py(v)])
  const prog = (at: number[]) => (at.map((x, i) => (i === 0 ? 0 : move(t, x - 0.5, 0.7))).reduce((s, v) => s + v, 0)) / 2
  const chart = (x: number, y: number, name: string, vals: number[], at: number[], color: string, appear: number) => {
    const pts = ptsOf(vals)
    return (
      <Rise t={t} at={appear}>
        <Card x={x} y={y} w={780} h={620} title={name} color={undefined}>
          <svg width={780} height={620} style={{ position: 'absolute', left: 0, top: 0 }}>
            {[4000, 8000, 12000].map((g) => (
              <g key={g}>
                <line x1={PLOT.X0 - 20} x2={PLOT.X0 + 2 * PLOT.DX + 60} y1={py(g)} y2={py(g)} stroke="rgba(130,170,255,0.25)" strokeWidth={2} strokeDasharray="8 8" />
                <text x={PLOT.X0 - 30} y={py(g) + 8} textAnchor="end" fontSize={28} fill={INK.faint} fontWeight={700}>
                  {fmt(g)}
                </text>
              </g>
            ))}
            <line x1={PLOT.X0 - 20} x2={PLOT.X0 + 2 * PLOT.DX + 60} y1={PLOT.BASE} y2={PLOT.BASE} stroke={INK.line} strokeWidth={3} />
            {['10:00', '10:01', '10:02'].map((s, i) => (
              <text key={s} x={PLOT.X0 + i * PLOT.DX} y={PLOT.BASE + 44} textAnchor="middle" fontSize={28} fill={INK.faint} fontWeight={700}>
                {s}
              </text>
            ))}
            <Line pts={pts} p={prog(at)} color={color} head={false} />
            {pts.map(([px, pyy], i) => (
              <g key={i} opacity={vis(t, at[i], Infinity, 0.3)}>
                {t > at[i] + 0.3 && (i === 2 || t < at[i + 1]) && <circle cx={px} cy={pyy} r={16 + 12 * (0.5 + 0.5 * Math.sin((t - at[i]) * 4))} fill="none" stroke={color} strokeWidth={4} opacity={0.8} />}
                <circle cx={px} cy={pyy} r={13} fill="#fff" style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
                <text x={px} y={pyy - 28} textAnchor="middle" fontSize={30} fill="#fff" fontWeight={800}>
                  {fmt(vals[i])}
                </text>
              </g>
            ))}
          </svg>
        </Card>
      </Rise>
    )
  }
  // Slow pulse on the Group B alert once its trend is drawn, so the closing statement is never a still frame.
  const alert = span(t, bAt[2] + 0.5, bAt[2] + 1.2) * (0.5 + 0.5 * Math.sin(t * 2.4))
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a2, { x: 1000, y: 540, s: 1.03 }, 1.3], [a3, WIDE, 1.2]])} title={{ kicker: 'XU HƯỚNG', text: 'Hai group, cùng lag' }}>
      {chart(150, 220, 'Group A', A, aAt, INK.good, a0 + 0.2)}
      {chart(990, 220, 'Group B', B, bAt, INK.bad, a0 + 0.2)}
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `scale(${1 + 0.035 * alert})`, transformOrigin: '1300px 310px', filter: `drop-shadow(0 0 ${6 + 16 * alert}px ${INK.bad})` }}>
        <Tag x={990 + 150} y={220 + 75} text="+3.000/phút = 50 tin/giây" color={INK.bad} size={30} o={vis(t, a2 + d2 * 0.8)} />
      </div>
      <Icon3D name="thumb-up" x={150 + 700} y={220 + 70} size={100} t={t} at={a3 + 0.3} />
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `translateY(${Math.sin(t * 2.4) * 6 * span(t, a3 + 1.6, a3 + 2.2)}px)` }}>
        <Icon3D name="fire" x={990 + 700} y={220 + 70} size={100} t={t} at={a3 + 1.0} />
      </div>
      <Statement x={330} y={910} text="cảnh báo theo xu hướng, không chỉ theo ngưỡng" size={48} color={INK.warn} o={sp(t, a3 + 1.8)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 3. delay in seconds and catch-up time */

function catchup(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const d0 = c.end(0) - a0
  const d2 = c.end(2) - a2
  const run0 = a2 + d2 * 0.42
  const run1 = c.end(2) - 0.4
  // The drained bar refills and the texts cross-fade over ~20 frames once the write rate catches up with the read rate.
  const stuckP = move(t, a3, 0.67)
  const drained = 1 - move(t, run0, Math.max(1, run1 - run0))
  const f = lerp(drained, 0.96 + Math.sin(t * 2.2) * 0.03, stuckP)
  const secs = Math.round(180 * drained)
  // The formula is centred and large while it is narrated alone, then docks to the top of its card for the worked example.
  const dock = move(t, a2 - 0.3, 0.9)
  const fs = lerp(1.3, 1, dock)
  const fx = lerp(70, 0, dock)
  const fy = lerp(150, 0, dock)
  // A 30 s timer bar drains under the top formula while the first two beats are spoken.
  const drain = 1 - move(t, a0 + d0 * 0.55, Math.max(2, a2 - a0 - d0 * 0.55 - 0.3))
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a2, { x: 960, y: 620, s: 1.04 }, 1.3], [a3, WIDE, 1.2]])} title={{ kicker: 'THỜI GIAN', text: 'Lag ra giây, bao lâu hết' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `translateY(${lerp(190, 0, move(t, a1, 0.9))}px)` }}>
      <Rise t={t} at={a0 + 0.2}>
        <Card x={260} y={250} w={1400} h={270}>
          <div style={{ position: 'absolute', left: 36, top: 26, whiteSpace: 'nowrap', fontSize: 32, fontWeight: 800, color: INK.faint }}>độ trễ ≈ lag ÷ tốc độ xử lý</div>
          <Tag x={36} y={90} text="6.000 tin" color={INK.warn} size={44} o={vis(t, a0 + d0 * 0.2)} />
          <div style={{ position: 'absolute', left: 330, top: 95, fontSize: 48, fontWeight: 800, color: '#fff', opacity: vis(t, a0 + d0 * 0.4) }}>÷</div>
          <Tag x={395} y={90} text="200 tin/giây" color={INK.accent} size={44} o={vis(t, a0 + d0 * 0.4)} />
          <div style={{ position: 'absolute', left: 760, top: 95, fontSize: 48, fontWeight: 800, color: '#fff', opacity: vis(t, a0 + d0 * 0.6) }}>=</div>
          <Tag x={830} y={90} text="30 giây" color={INK.good} size={44} o={vis(t, a0 + d0 * 0.6)} />
          <Icon3D name="clock" x={1250} y={110} size={150} t={t} at={a0 + d0 * 0.6} />
          <div style={{ position: 'absolute', left: 36, top: 190, width: 1328, height: 34, borderRadius: 17, background: 'rgba(110,160,255,0.18)', opacity: vis(t, a0 + d0 * 0.6) }} />
          <div style={{ position: 'absolute', left: 36, top: 190, width: 1328 * clamp(drain), height: 34, borderRadius: 17, background: `linear-gradient(90deg, ${INK.good}88, ${INK.good})`, boxShadow: `0 0 20px ${INK.good}`, opacity: vis(t, a0 + d0 * 0.6) }} />
        </Card>
      </Rise>
      </div>
      <Rise t={t} at={a1 + 0.2}>
        <Card x={260} y={550} w={1400} h={450}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: 1400, transform: `translate(${fx}px, ${fy}px) scale(${fs})`, transformOrigin: '0 0' }}>
            <div style={{ position: 'absolute', left: 36, top: 36, fontSize: 36, fontWeight: 800, color: '#fff', opacity: vis(t, a1 + 0.3) }}>đuổi kịp =</div>
            <Tag x={250} y={26} text="lag" color={INK.warn} size={36} o={vis(t, a1 + 0.9)} />
            <div style={{ position: 'absolute', left: 372, top: 36, fontSize: 40, fontWeight: 800, color: '#fff', opacity: vis(t, a1 + 1.6) }}>÷ (</div>
            <Tag x={455} y={26} text="tốc độ đọc" color={INK.good} size={36} o={vis(t, a1 + 2.2)} />
            <div style={{ position: 'absolute', left: 715, top: 36, fontSize: 40, fontWeight: 800, color: '#fff', opacity: vis(t, a1 + 2.6) }}>−</div>
            <Tag x={765} y={26} text="tốc độ ghi" color={INK.accent} size={36} o={vis(t, a1 + 3.0)} />
            <div style={{ position: 'absolute', left: 1010, top: 36, fontSize: 40, fontWeight: 800, color: '#fff', opacity: vis(t, a1 + 3.0) }}>)</div>
          </div>
          <div style={{ opacity: vis(t, a2 + 0.2) }}>
            <Tag x={36} y={110} text="lag 90.000" color={INK.warn} size={34} />
            <Tag x={300} y={110} text="đọc 2.000/s" color={INK.good} size={34} />
            <Tag x={590} y={110} text="ghi 1.500/s" color={INK.accent} size={34} o={1 - stuckP} />
            <Tag x={590} y={110} text="ghi 2.000/s" color={INK.accent} size={34} o={stuckP} />
            <div style={{ position: 'absolute', left: 36, top: 195, width: 1328, height: 64, borderRadius: 32, background: 'rgba(110,160,255,0.18)' }} />
            {[{ col: INK.warn, o: 1 - stuckP }, { col: INK.bad, o: stuckP }].map(({ col, o }) => (
              <div key={col} style={{ position: 'absolute', left: 36, top: 195, width: 1328 * clamp(f), height: 64, borderRadius: 32, background: `linear-gradient(90deg, ${col}88, ${col})`, boxShadow: `0 0 24px ${col}`, opacity: o }} />
            ))}
            <div style={{ position: 'absolute', left: 36, top: 272, fontSize: 56, fontWeight: 800, color: INK.warn, fontFamily: MONO, opacity: 1 - stuckP, whiteSpace: 'nowrap' }}>{`lag: ${fmt(90000 * drained)}`}</div>
            <div style={{ position: 'absolute', left: 36, top: 272, fontSize: 56, fontWeight: 800, color: INK.bad, fontFamily: MONO, opacity: stuckP, whiteSpace: 'nowrap' }}>lag: không giảm</div>
          </div>
          <div style={{ position: 'absolute', left: 36, top: 368, opacity: vis(t, a2 + d2 * 0.5) * (1 - stuckP), fontSize: 40, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>{`90.000 ÷ 500 = 180 giây  ·  còn ${secs} giây`}</div>
          <div style={{ position: 'absolute', left: 36, top: 368, opacity: vis(t, a2 + d2 * 0.5) * stuckP, fontSize: 40, fontWeight: 800, color: INK.bad, whiteSpace: 'nowrap' }}>(2.000 − 2.000) = 0  →  ∞ giây</div>
        </Card>
      </Rise>
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `translateY(${Math.sin(t * 5) * 6 * stuckP}px)` }}>
        <Icon3D name="fire" x={1500} y={655} size={110} t={t} at={a3 + 1.2} />
      </div>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 4. cluster health: brokers go down */

function health(t: number, c: Cue) {
  const [a0, a1, a2, a3, a4] = [c.at(0), c.at(1), c.at(2), c.at(3), c.at(4)]
  const d0 = c.end(0) - a0
  const d4 = c.end(4) - a4
  const rec = a4 + 0.1
  const dieAt = [a3 + 0.9, a2 + 0.9, a1 + 0.9] // broker 1, 2, 3
  const settle = 0.5
  // Brokers come back one by one (about a second in total) instead of all at once.
  const recAt = [rec, rec + 0.4, rec + 0.8]
  const shownAt = (x: number) => 3 - [0, 1, 2].filter((k) => x - settle >= dieAt[k] && x < recAt[k]).length
  const shown = shownAt(t)
  const ctrlAt = [a4 + d4 * 0.32, a4 + d4 * 0.62]
  const ctrlOf = (x: number) => (x < ctrlAt[0] ? 1 : x < ctrlAt[1] ? 0 : 2)
  const ctrl = ctrlOf(t)
  // 0..1 "bad" level per card, ramped over ~0.4 s so colours cross-fade instead of switching.
  const badAt = [(x: number) => (shownAt(x) < 3 ? 1 : 0), (x: number) => (shownAt(x) < 2 ? 1 : 0), (x: number) => (shownAt(x) === 0 ? 1 : 0), (x: number) => (ctrlOf(x) !== 1 ? 1 : 0)]
  const offlineNow = shown === 0
  const urp = shown < 3 ? 1 : 0
  const underMin = shown < 2 ? 1 : 0
  const offline = shown === 0 ? 1 : 0
  const pulse = 0.5 + 0.5 * Math.sin(t * 5)
  const cards: { title: string; v: number; ok: number; note: string; at: number; color: string }[] = [
    { title: 'UnderReplicated (URP)', v: urp, ok: 0, note: urp ? 'thiếu bản sao · vẫn ghi được' : 'đủ bản sao', at: a1 + 0.1, color: INK.warn },
    { title: 'UnderMinIsr', v: underMin, ok: 0, note: underMin ? 'ISR < min ISR · không ghi được' : 'ISR ≥ min ISR', at: a2 + 0.1, color: ORANGE },
    { title: 'OfflinePartitions', v: offline, ok: 0, note: offline ? 'không có leader' : 'đều có leader', at: a3 + 0.1, color: INK.bad },
    { title: 'ActiveController', v: ctrl, ok: 1, note: ctrl === 1 ? 'đúng 1 · ổn' : ctrl === 0 ? '0 · không ai điều khiển' : '2 · điều tra ngay', at: a4 + 0.2, color: INK.accent },
  ]
  const verdictAt = (x: number) => {
    const n = shownAt(x)
    return n >= 2 ? { text: 'producer acks=all: ghi được', c: INK.good } : n === 1 ? { text: 'producer: lỗi NotEnoughReplicas', c: INK.bad } : { text: 'producer: lỗi, không có leader', c: INK.bad }
  }
  const verdict = verdictAt(t)
  const verdictPrev = verdictAt(t - 0.42)
  const verdictW = soften(t, (x) => (verdictAt(x).text === verdict.text ? 1 : 0))
  const ctrlTagO = vis(t, a4 + 0.2) * lerp(0.25, 1, clamp(1 - move(t, ctrlAt[0], 0.4) + move(t, ctrlAt[1], 0.4)))
  const isrN = Math.max(shown, 0)
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 560, s: 1.03 }, 1.4], [a4, WIDE, 1.2]])} title={{ kicker: 'SỨC KHOẺ', text: 'Bốn con số cluster' }}>
      {[0, 1, 2].map((k) => (
        <Rise key={k} t={t} at={a0 + 0.3 + k * 0.5}>
          {(() => {
            // Dead and revived looks cross-fade while a broker comes back.
            const back = t >= dieAt[k] ? move(t, recAt[k], 0.5) : 1
            const dead = t >= dieAt[k]
            return (
              <>
                {back < 1 && <div style={{ opacity: 1 - back }}><ServerUnit x={130 + k * 360} y={240} name={`broker ${k + 1}${dead ? ' · chết' : ''}`} down={dead} t={t} /></div>}
                {back > 0 && <div style={{ opacity: back }}><ServerUnit x={130 + k * 360} y={240} name={`broker ${k + 1}`} t={t} /></div>}
              </>
            )
          })()}
        </Rise>
      ))}
      <Rise t={t} at={a0 + d0 * 0.5}>
        <Card x={1260} y={230} w={560} h={200}>
          <div style={{ position: 'absolute', left: 30, top: 20, fontSize: 30, fontWeight: 800, color: INK.faint }}>ISR của partition</div>
          <div style={{ position: 'absolute', left: 30, top: 70, fontSize: 84, fontWeight: 800, color: isrN === 3 ? INK.good : isrN >= 2 ? INK.warn : INK.bad, fontFamily: MONO, lineHeight: 1 }}>{isrN}/3</div>
          <div style={{ position: 'absolute', left: 230, top: 78, fontSize: 34, fontWeight: 700, color: INK.text, lineHeight: 1.3 }}>
            RF = 3<br />min ISR = 2
          </div>
        </Card>
      </Rise>
      {cards.map((cd, k) => {
        const badP = soften(t, badAt[k])
        const carried = offlineNow && k < 2
        const carriedP = k < 2 ? soften(t, (x) => (shownAt(x) === 0 ? 1 : 0)) : 0
        return (
          <Rise key={cd.title} t={t} at={cd.at}>
            <Card x={60 + k * 465} y={525} w={435} h={310} title={cd.title} o={lerp(1, 0.75, carriedP)}>
              <AlertRim color={INK.bad} p={badP} />
              <div style={{ position: 'absolute', left: 0, right: 0, top: 62, textAlign: 'center', fontSize: 120, fontWeight: 800, fontFamily: MONO, lineHeight: 1.1, color: mix(INK.good, INK.bad, badP), textShadow: `0 0 ${lerp(28, 22 + 16 * pulse, badP)}px ${mix(INK.good, INK.bad, badP)}` }}>{cd.v}</div>
              <div style={{ position: 'absolute', left: 20, right: 20, top: 205, textAlign: 'center', fontSize: 30, fontWeight: 700, lineHeight: 1.25, color: mix(INK.faint, INK.bad, badP) }}>{carried ? 'số cuối cùng, không còn broker báo' : cd.note}</div>
            </Card>
          </Rise>
        )
      })}
      <Rise t={t} at={a0 + d0 * 0.8}>
        {verdictW < 1 && verdictPrev.text !== verdict.text && <Tag x={960} y={875} text={verdictPrev.text} color={verdictPrev.c} size={40} cx o={1 - verdictW} />}
        <Tag x={960} y={875} text={verdict.text} color={verdict.c} size={40} cx o={verdictPrev.text !== verdict.text ? verdictW : 1} />
      </Rise>
      <Tag x={260} y={432} text="controller" color={INK.accent} size={30} cx o={ctrlTagO} />
      <Tag x={620} y={432} text="controller" color={INK.bad} size={30} cx o={move(t, ctrlAt[1], 0.4) * vis(t, a4 + 0.2) * (0.6 + 0.4 * pulse)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 5. request latency by stage */

function latency(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const d1 = c.end(1) - a1
  const early = 1 - span(t, a1 - 0.2, a1 + 0.3)
  const X = 260
  const W = 1400
  const off = lerp(lerp(230, 70, move(t, a2 - 0.2, 0.9)), 0, move(t, a3 - 0.2, 0.9))
  const stage = (k: number) => a1 + 0.3 + d1 * [0, 0.28, 0.55, 0.8][k]
  const grow = (k: number) => move(t, stage(k), 0.7)
  const w1 = [0.18, 0.3, 0.34, 0.18].map((r) => r * W)
  const ppm = W / 120
  const w2 = [5, 10, 100, 5].map((ms) => ms * ppm)
  const w3 = [90, 10, 10, 10].map((ms) => ms * ppm)
  const colors = [INK.warn, INK.accent, VIOLET, INK.good]
  const names = ['queue', 'local', 'remote', 'response']
  const subs = ['chờ luồng', 'ghi đĩa', 'chờ follower', 'gửi trả']
  let lx = X
  const labelX = w1.map((w) => {
    const x = lx + w / 2
    lx += w
    return x
  })
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a2, { x: 960, y: 620, s: 1.04 }, 1.3], [a3, { x: 960, y: 640, s: 1.04 }, 1.2]])} title={{ kicker: 'ĐỘ TRỄ', text: 'Chậm ở chặng nào', until: a2 - 0.3 }}>
      <div style={{ opacity: early }}>
        <Icon3D name="zoom" x={960} y={500} size={340} t={t} at={0.4} />
        <Tag x={960} y={730} text="producer: gửi chậm" color={INK.warn} size={52} cx o={vis(t, a0 + 0.9)} />
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `translateY(${off}px)` }}>
        <div style={{ opacity: vis(t, a1 + 0.2) }}>
          <div style={{ position: 'absolute', left: X, top: 200, fontSize: 38, fontWeight: 800, color: INK.faint, whiteSpace: 'nowrap' }}>TotalTimeMs của một request</div>
        </div>
        <SegBar x={X} y={260} h={96} segs={w1.map((w, k) => ({ w, color: colors[k], p: grow(k) }))} />
        {names.map((n, k) => (
          <div key={n} style={{ position: 'absolute', left: labelX[k], top: 372, transform: 'translateX(-50%)', textAlign: 'center', opacity: vis(t, stage(k) + 0.3), whiteSpace: 'nowrap', padding: '4px 18px', borderRadius: 14, background: 'rgba(8,22,82,0.9)' }}>
            <div style={{ fontSize: 38, fontWeight: 800, color: colors[k] }}>{n}</div>
            <div style={{ fontSize: 34, fontWeight: 600, color: INK.faint }}>{subs[k]}</div>
          </div>
        ))}
        <div style={{ opacity: vis(t, a2 + 0.2) }}>
          <div style={{ position: 'absolute', left: X, top: 490, fontSize: 38, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>Produce p99 = 120 ms</div>
          <SegBar x={X} y={545} h={96} glowColor={VIOLET} segs={w2.map((w, k) => ({ w, color: colors[k], p: move(t, a2 + 0.4 + k * 0.25, 0.8), text: k === 2 ? 'remote 100 ms' : undefined }))} />
        </div>
        <Statement x={X} y={660} text="follower chậm, không phải leader" color={INK.bad} size={46} o={sp(t, a2 + (c.end(2) - a2) * 0.7)} />
        <div style={{ opacity: vis(t, a3 + 0.2) }}>
          <div style={{ position: 'absolute', left: X, top: 770, fontSize: 38, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>Hàng đợi dài</div>
          <SegBar x={X} y={822} h={96} glowColor={INK.warn} segs={w3.map((w, k) => ({ w, color: colors[k], p: move(t, a3 + 0.4 + k * 0.15, 0.7), text: k === 0 ? 'queue 90 ms' : undefined }))} />
        </div>
        <Statement x={X} y={935} text="broker thiếu luồng xử lý" color={INK.warn} size={46} o={sp(t, a3 + (c.end(3) - a3) * 0.6)} />
      </div>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 6. idle % gauges, disk, network */

const GAUGE = { R: 210, CY: 520 }

function Gauge({ t, cx, v, title, sub, o = 1, marks = 0 }: { t: number; cx: number; v: number; title: string; sub: string; o?: number; marks?: number }) {
  const { R, CY } = GAUGE
  // Colour bands blend across a narrow range so the arc recolours smoothly while the value falls.
  const col = mix(mix(mix(INK.bad, ORANGE, span(v, 0.07, 0.13)), INK.warn, span(v, 0.17, 0.23)), INK.good, span(v, 0.27, 0.33))
  const status = v < 0.1 ? 'sự cố' : v < 0.2 ? 'có vấn đề' : v < 0.3 ? 'để ý' : 'rảnh'
  const arc = `M ${cx - R} ${CY} A ${R} ${R} 0 0 1 ${cx + R} ${CY}`
  const len = Math.PI * R
  const pulse = 0.5 + 0.5 * Math.sin(t * 6)
  const pos = (frac: number, r: number): [number, number] => {
    const th = Math.PI * (1 - frac)
    return [cx + r * Math.cos(th), CY - r * Math.sin(th)]
  }
  return (
    <div style={{ opacity: clamp(o) }}>
      <div style={{ position: 'absolute', left: cx - 260, width: 520, top: 170, textAlign: 'center' }}>
        <div style={{ fontSize: 38, fontWeight: 800, color: '#fff' }}>{title}</div>
        <div style={{ fontSize: 28, fontWeight: 600, color: INK.faint, fontFamily: MONO }}>{sub}</div>
      </div>
      <Abs>
        <path d={arc} fill="none" stroke="rgba(110,160,255,0.2)" strokeWidth={40} strokeLinecap="round" />
        <path d={arc} fill="none" stroke={col} strokeWidth={40} strokeLinecap="round" strokeDasharray={`${len * Math.max(clamp(v), 0.035)} ${len}`} style={{ filter: `drop-shadow(0 0 ${v < 0.1 ? 14 + 10 * pulse : 12}px ${col})` }} />
        {marks > 0 &&
          [0.1, 0.2, 0.3].map((m) => {
            const [x1, y1] = pos(m, R + 26)
            const [x2, y2] = pos(m, R + 46)
            const [lx, ly] = pos(m, R + 82)
            return (
              <g key={m} opacity={marks}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fff" strokeWidth={4} />
                <text x={lx} y={ly + 8} textAnchor="middle" fontSize={30} fontWeight={800} fill="#fff">
                  {Math.round(m * 100)}%
                </text>
              </g>
            )
          })}
      </Abs>
      <div style={{ position: 'absolute', left: cx - 130, width: 260, top: CY - 105, textAlign: 'center', fontSize: 76, fontWeight: 800, fontFamily: MONO, color: col, textShadow: `0 0 24px ${col}` }}>{Math.round(v * 100)}%</div>
      <div style={{ position: 'absolute', left: cx - 130, width: 260, top: CY + 22, textAlign: 'center', fontSize: 32, fontWeight: 800, color: col }}>{status}</div>
    </div>
  )
}

function threads(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const d0 = c.end(0) - a0
  const d1 = c.end(1) - a1
  const d2 = c.end(2) - a2
  const d3 = c.end(3) - a3
  const io = track(t, [
    [0, 0.95],
    [a1 + 0.2, 0.95],
    [a1 + d1 * 0.32, 0.28],
    [a1 + d1 * 0.55, 0.18],
    [a1 + d1 * 0.8, 0.08],
    [a2 + 1, 0.06],
  ])
  const net = 0.86 + Math.sin(t * 1.3) * 0.03
  const queuedRaw = 12 * move(t, a2 + 0.5, Math.max(1.5, d2 - 1.2))
  const queued = Math.floor(queuedRaw)
  const queuedP = clamp(queuedRaw - 7)
  const diskAt = a3 + 0.2
  const dy = 150 * (1 - move(t, a3 - 0.1, 0.9))
  const shift = move(t, a2 - 0.2, 0.9)
  const cxIo = lerp(650, 390, shift)
  const cxNet = lerp(1270, 910, shift)
  const netAt = a3 + d3 * 0.5
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a3, { x: 960, y: 600, s: 1.03 }, 1.3]])} title={{ kicker: 'SỨC CÒN LẠI', text: 'Luồng, đĩa, mạng', until: a3 - 0.4 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `translateY(${dy}px)` }}>
      <Rise t={t} at={a0 + 0.3}>
        <Gauge t={t} cx={cxIo} v={io} title="Luồng I/O rảnh" sub="RequestHandlerAvgIdle" marks={vis(t, a1, Infinity, 0.5)} />
      </Rise>
      <Rise t={t} at={a0 + d0 * 0.55}>
        <Gauge t={t} cx={cxNet} v={net} title="Luồng mạng rảnh" sub="NetworkProcessorAvgIdle" />
      </Rise>
      <Rise t={t} at={a2 + 0.2}>
        <Card x={1250} y={215} w={550} h={380} title="RequestQueue">
          <AlertRim color={INK.bad} p={queuedP} />
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} style={{ position: 'absolute', left: 30 + (i % 4) * 125, top: 85 + Math.floor(i / 4) * 85, width: 105, height: 64, borderRadius: 16, display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 800, color: '#fff', background: i < queued ? `linear-gradient(160deg, ${INK.warn}, #d9780f)` : 'rgba(110,160,255,0.12)', boxShadow: i < queued ? `0 0 16px ${INK.warn}` : undefined }}>
              {i < queued ? 'req' : ''}
            </div>
          ))}
          <div style={{ position: 'absolute', right: 28, top: 16, fontSize: 34, fontWeight: 800, color: mix(INK.warn, INK.bad, queuedP) }}>đang chờ: {queued}</div>
        </Card>
      </Rise>
      </div>
      <Rise t={t} at={diskAt}>
        <Card x={130} y={640} w={780} h={340} title="Đĩa log đã dùng">
          <Icon3D name="battery" x={110} y={200} size={150} t={t} at={diskAt} />
          <div style={{ position: 'absolute', left: 220, top: 120, width: 500, height: 38, borderRadius: 19, background: 'rgba(110,160,255,0.18)' }} />
          <div style={{ position: 'absolute', left: 220, top: 120, width: 500 * 0.75 * move(t, diskAt + 0.3, Math.max(1, d3 * 0.4)), height: 38, borderRadius: 19, background: `linear-gradient(90deg, ${INK.accent}, ${INK.warn})`, boxShadow: `0 0 18px ${INK.warn}` }} />
          <div style={{ position: 'absolute', left: 220 + 375 - 2, top: 106, width: 4, height: 66, background: INK.bad }} />
          <div style={{ position: 'absolute', left: 220, top: 195, fontSize: 56, fontWeight: 800, fontFamily: MONO, color: INK.warn }}>75%</div>
          <div style={{ position: 'absolute', left: 400, top: 212, fontSize: 30, fontWeight: 700, color: INK.faint }}>cảnh báo sớm</div>
        </Card>
      </Rise>
      <Rise t={t} at={netAt}>
        <Card x={960} y={640} w={830} h={340} title="Mạng của broker (MB/s)">
          <Icon3D name="wifi" x={105} y={200} size={140} t={t} at={netAt} />
          <div style={{ position: 'absolute', left: 215, top: 104, fontSize: 30, fontWeight: 800, color: '#fff' }}>vào</div>
          <SegBar x={300} y={96} h={56} segs={[{ w: 170, color: INK.accent, p: move(t, netAt + 0.3, 0.8), text: '10' }]} />
          <div style={{ position: 'absolute', left: 215, top: 190, fontSize: 30, fontWeight: 800, color: '#fff' }}>ra</div>
          <SegBar x={300} y={182} h={56} segs={[{ w: 250, color: INK.good, p: move(t, netAt + 0.8, 0.8), text: '15' }, { w: 250, color: VIOLET, p: move(t, netAt + 1.5, 0.8), text: '15' }]} />
          <div style={{ position: 'absolute', left: 300, top: 258, fontSize: 30, fontWeight: 700, color: INK.good, opacity: vis(t, netAt + 1.2) }}>consumer</div>
          <div style={{ position: 'absolute', left: 550, top: 258, fontSize: 30, fontWeight: 700, color: VIOLET, opacity: vis(t, netAt + 1.9) }}>follower kéo về</div>
        </Card>
      </Rise>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 7. summary */

function summary(t: number, c: Cue) {
  return (
    <SoftTheme>
      <SummaryList t={t} cue={c} items={['Lag: nhìn xu hướng, không chỉ con số', 'URP · UnderMinIsr · offline · đúng 1 controller', 'Độ trễ request chia chặng: queue, local, remote', 'Luồng rảnh dưới 30% · đĩa trên 75%: để ý']} />
    </SoftTheme>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { hook, lag, trend, catchup, health, latency, threads, summary }

/** Key-moment sounds, timed to the same cue offsets the scenes animate on. */
const SFX: Record<string, SceneSfx[]> = {
  hook: [{ kind: 'ding', at: (c) => c.at(2) + 0.5 }],
  lag: [{ kind: 'tick', at: (c) => c.at(2) + 0.2 }],
  trend: [
    { kind: 'tick', at: (c) => c.at(1) + (c.end(1) - c.at(1)) * 0.4 },
    { kind: 'error', at: (c) => c.at(2) + (c.end(2) - c.at(2)) * 0.62 },
  ],
  catchup: [
    { kind: 'ding', at: (c) => c.end(2) - 0.4 },
    { kind: 'error', at: (c) => c.at(3) + 1.2 },
  ],
  health: [
    { kind: 'error', at: (c) => c.at(1) + 0.9 },
    { kind: 'error', at: (c) => c.at(2) + 0.9 },
    { kind: 'error', at: (c) => c.at(3) + 0.9 },
  ],
  latency: [{ kind: 'error', at: (c) => c.at(2) + 1.1 }],
  threads: [
    { kind: 'error', at: (c) => c.at(1) + (c.end(1) - c.at(1)) * 0.8 },
    { kind: 'tick', at: (c) => c.at(3) + 0.2 },
  ],
}

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const monitoringLesson: Lesson = {
  ...monitoringScript,
  scenes: monitoringScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id], sfx: SFX[s.id] })),
  intro: [
    { kind: 'video', scenes: ['hook'] },
    {
      kind: 'quiz',
      title: 'Quick Quiz',
      questions: [q('Đoán trước khi học: người dùng báo thông báo chậm, log không có lỗi nào. Nên bắt đầu đo cái gì?', ['Chỉ cần restart broker', 'Lag của consumer group, rồi sức khoẻ cluster và độ trễ request', 'Xoá topic và tạo lại', 'Tăng retention'], 1, 'Không có lỗi không có nghĩa là không chậm. Phải nhìn lag, cluster và độ trễ, theo xu hướng.')],
    },
  ],
  roadmap: [
    'Chặng 1: Consumer lag là gì, vì sao xu hướng quan trọng hơn con số, và bao lâu thì hết lag.',
    'Chặng 2: Bốn con số sức khoẻ cluster: URP, UnderMinIsr, offline partitions, active controller.',
    'Chặng 3: Độ trễ request chia theo chặng, luồng xử lý rảnh bao nhiêu phần trăm, đĩa và mạng.',
  ],
  sections: [
    {
      id: 'consumer-lag',
      title: 'Consumer lag và xu hướng của lag',
      blocks: [
        { kind: 'p', text: '**Vấn đề:** người dùng phàn nàn "thông báo đến chậm 10 phút". Kafka vẫn chạy, không có lỗi nào trong log. Đo cái gì để biết chậm ở đâu?' },
        { kind: 'video', scenes: ['lag', 'trend'] },
        { kind: 'code', code: 'lag (một partition) = LOG-END-OFFSET − CURRENT-OFFSET (offset consumer đã commit)\n\nVí dụ: end offset 10.000, đã commit 9.400 → lag = 600 tin đang chờ.' },
        {
          kind: 'table',
          head: ['Thời điểm', 'Group A', 'Group B'],
          rows: [
            ['10:00', '5.000', '5.000'],
            ['10:01', '5.200', '8.000'],
            ['10:02', '4.900', '11.000'],
            ['Kết luận', 'Dao động quanh một mức: consumer **theo kịp**, chỉ trễ cố định', 'Tăng đều 3.000/phút = 50 tin/giây: consumer **chậm hơn producer**, sẽ tụt mãi'],
          ],
        },
        { kind: 'video', scenes: ['catchup'] },
        {
          kind: 'code',
          code: 'độ trễ ≈ lag ÷ tốc độ xử lý\nthời gian đuổi kịp = lag ÷ (tốc độ đọc − tốc độ ghi)\n\nVí dụ: lag 90.000, đọc 2.000/s, ghi 1.500/s → 90.000 ÷ 500 = 180 giây.\nĐọc ≤ ghi thì không bao giờ đuổi kịp.',
        },
        {
          kind: 'list',
          items: [
            { text: 'Cảnh báo theo **xu hướng lag** (tăng liên tục trong N phút), không chỉ một ngưỡng tuyệt đối.' },
            { text: 'Đo lag **từ bên ngoài** consumer (`kafka-consumer-groups.sh`, Burrow, exporter Prometheus), vì consumer chết thì nó không tự báo lag được.' },
            { text: 'Xem lag **theo từng partition**: tổng bình thường nhưng một partition rất cao là dấu hiệu hot partition hoặc poison message.' },
            { text: 'Metric `records-lag-max` của consumer chỉ cho **một** partition tụt xa nhất và tắt đúng lúc consumer hỏng. Chỉ dùng khi không có cách đo từ ngoài. (📘 sách, ch.13)' },
            { text: 'Burrow không đặt ngưỡng lag cho từng topic: nó xem offset đã commit **có tiến lên không** rồi xếp group vào ổn, đang tụt dần, hoặc đứng hẳn. (📘 sách, ch.13)' },
            { text: 'Cột `LOG-END-OFFSET` thật ra là **high watermark**: lag đo đúng phần consumer **được phép** đọc mà chưa đọc. (📘 sách, ch.12)' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Group P có lag 50.000 ổn định suốt 1 giờ. Group Q có lag 2.000 nhưng tăng 500 mỗi phút. Group nào cần xử lý trước?', ['Group P, vì lag lớn hơn', 'Group Q, vì lag đang tăng nghĩa là consumer chậm hơn producer', 'Cả hai như nhau', 'Không group nào'], 1, 'Lag cố định là đã theo kịp, chỉ trễ một khoảng không đổi. Lag tăng đều sẽ tụt mãi.'),
            q('Lag 120.000, consumer đọc 3.000 tin/giây, producer ghi 2.000 tin/giây. Bao lâu thì hết lag?', ['40 giây', '60 giây', '120 giây', 'Không bao giờ'], 2, '120.000 ÷ (3.000 − 2.000) = 120 giây, vì producer vẫn ghi thêm trong lúc consumer đọc.'),
          ],
        },
      ],
    },
    {
      id: 'suc-khoe-cluster',
      title: 'Sức khoẻ cluster: URP, UnderMinIsr, offline, controller',
      blocks: [
        { kind: 'p', text: 'Lấy cluster 3 broker, topic có RF = 3, `min.insync.replicas = 2`, producer dùng `acks=all` (Module 4).' },
        { kind: 'video', scenes: ['health'] },
        {
          kind: 'table',
          head: ['Metric', 'Câu hỏi nó trả lời', 'Bình thường', 'Khi bất thường'],
          rows: [
            ['**UnderReplicatedPartitions** (URP)', 'Có partition nào thiếu bản sao đồng bộ?', '0', '1 broker chết → ISR còn 2/3. **Vẫn ghi được**, nhưng hết dự phòng'],
            ['**UnderMinIsr**', 'Có partition nào ISR **dưới** `min.insync.replicas`?', '0', '2 broker chết → ISR còn 1 < 2 → `acks=all` nhận `NotEnoughReplicas`. **Không ghi được**'],
            ['**OfflinePartitionsCount**', 'Có partition nào **không có leader**?', '0', 'Cả 3 replica chết → không đọc, không ghi được'],
            ['**ActiveControllerCount**', 'Có đúng một controller đang điều khiển?', 'Tổng cả cluster = **1**', '0 = không bầu được leader mới; > 1 = nghiêm trọng, điều tra ngay'],
          ],
        },
        { kind: 'code', code: './kafka-topics.sh --bootstrap-server $BS --describe --under-replicated-partitions\n./kafka-topics.sh --bootstrap-server $BS --describe --under-min-isr-partitions\n./kafka-topics.sh --bootstrap-server $BS --describe --unavailable-partitions\n./kafka-metadata-quorum.sh --bootstrap-server $BS describe --status   # KRaft: leader của quorum' },
        { kind: 'p', text: 'Cluster khoẻ thì 3 lệnh đầu **không in ra gì**.' },
        {
          kind: 'list',
          items: [
            { text: 'URP > 0 kéo dài = đang sống nhờ dự phòng. Không phải lúc để rolling restart hay bảo trì thêm broker khác.' },
            { text: 'UnderMinIsr là lúc **độ bền** thắng **tính sẵn sàng**: Kafka thà từ chối ghi còn hơn nhận tin chỉ có 1 bản sao.' },
            { text: '`unclean.leader.election.enable=false` (mặc định): partition offline **chờ** replica trong ISR quay lại, không cho replica tụt hậu lên làm leader vì sẽ mất dữ liệu.' },
            { text: 'Có mức nằm giữa: ISR **vừa đúng bằng** `min.insync.replicas`. `--at-min-isr-partitions` liệt kê nhóm này, là cảnh báo sớm hơn UnderMinIsr. (📘 sách, ch.12)' },
          ],
        },
        { kind: 'callout', tone: 'tip', title: 'Đừng lấy URP làm cảnh báo chính', text: 'URP hay > 0 vì lý do vô hại (rolling restart, reassign), nên báo động giả liên tục. Sách bản 2 khuyên cảnh báo chính theo **SLO** đo từ phía người dùng, và dùng URP để **chẩn đoán**. Thêm một client giả ghi rồi đọc lại (Xinfra Monitor), và đừng chở metric của Kafka qua chính Kafka. (📘 sách, ch.13)' },
        { kind: 'callout', tone: 'info', title: 'URP > 0 dù cả 3 broker đang chạy?', text: 'Có: một follower quá chậm (đĩa, mạng) không theo kịp trong `replica.lag.time.max.ms` (30 giây) nên bị loại khỏi ISR. URP **đứng yên** ở nhiều broker gần như chắc là một broker chết; URP **dao động** là vấn đề hiệu năng. (📘 sách, ch.13)' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('RF = 3, min.insync.replicas = 2. Một broker chết. Producer acks=all còn ghi được không?', ['Không, vì mất một replica', 'Còn, vì ISR còn 2 và 2 ≥ min ISR; URP > 0 nhưng UnderMinIsr = 0', 'Còn, nhưng chỉ khi acks=1', 'Không, vì controller đổi'], 1, 'acks=all chỉ cần mọi replica trong ISR xác nhận và ISR vẫn đủ tối thiểu 2.'),
            q('ActiveControllerCount của cả cluster bằng 0. Nghĩa là gì?', ['Rất tốt', 'Không ai điều khiển, không bầu được leader mới', 'Có hai controller', 'Chỉ là metric bị lỗi'], 1, 'Tổng cả cluster phải đúng bằng 1.'),
          ],
        },
      ],
    },
    {
      id: 'do-tre-request',
      title: 'Độ trễ request, luồng xử lý, đĩa, mạng',
      blocks: [
        { kind: 'p', text: '**Vấn đề:** cluster không có URP, lag ổn, nhưng producer báo "gửi chậm". Chậm ở đâu?' },
        { kind: 'video', scenes: ['latency'] },
        { kind: 'code', code: 'TotalTimeMs = RequestQueue + Local + Remote + ResponseQueue + ResponseSend\n              (chờ đến lượt) (ghi đĩa) (chờ follower,  (chờ trả)      (gửi qua mạng)\n                                       khi acks=all)' },
        { kind: 'callout', tone: 'warn', title: 'Chặng hay bị quên: Throttle', text: 'Broker **cố ý** giữ response lại để làm chậm client vượt quota, và không trả mã lỗi, nên ứng dụng chỉ thấy "chậm". Xem `produce-throttle-time-avg` của producer và `fetch-throttle-time-avg` của consumer. (📘 sách, ch.13)' },
        { kind: 'p', text: 'Ví dụ: Produce p99 = 120 ms, Remote = 100 ms → thủ phạm là **follower chậm**, không phải leader. RequestQueue cao → broker **thiếu luồng xử lý**.' },
        { kind: 'video', scenes: ['threads'] },
        {
          kind: 'table',
          head: ['Chỉ số', 'Đo cái gì', 'Ngưỡng để ý'],
          rows: [
            ['`RequestHandlerAvgIdlePercent`', 'luồng I/O (`num.io.threads`, mặc định 8) rảnh bao nhiêu', 'dưới 30% để ý; dưới 20% có vấn đề; dưới 10% thường là sự cố thật (📘 sách, ch.13)'],
            ['`NetworkProcessorAvgIdlePercent`', 'luồng mạng (`num.network.threads`, mặc định 3) rảnh bao nhiêu', 'dưới khoảng 30%'],
            ['Đĩa log đã dùng', 'phần trăm thư mục log', 'cảnh báo sớm 70–75%'],
            ['Byte vào/ra mỗi giây', 'so với giới hạn card mạng', 'tính cả byte follower kéo về'],
          ],
        },
        {
          kind: 'list',
          items: [
            { text: 'Đừng chỉ nhìn tổng thời gian; nhìn **chặng nào** chiếm phần lớn.' },
            { text: 'Luồng mạng chỉ đọc/ghi byte nên hiếm khi cạn; luồng I/O gánh việc nặng. Không cần số luồng I/O lớn hơn số lõi CPU, vì request chờ lâu được gác sang **purgatory**, không giữ luồng. (📘 sách, ch.13)' },
            { text: '`BytesOutPerSec` **tính cả byte follower kéo về để sao chép**: RF = 2 mà chưa có consumer, bytes out đã bằng bytes in. (📘 sách, ch.13)' },
            { text: '**Một quả trứng hỏng làm hỏng cả rổ**: một ổ đĩa chậm trên một broker có thể kéo chậm cả cluster vì buffer của producer bị đầy. (📘 sách, ch.13)' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Produce p99 tăng từ 10 ms lên 200 ms, chặng Remote chiếm 180 ms. Nghi ngờ ai?', ['Leader, vì nó nhận request', 'Follower, vì Remote là thời gian leader chờ follower lấy dữ liệu', 'Producer', 'Consumer'], 1, 'Leader đã ghi xong phần của mình (Local thấp), cái chậm nằm ở máy khác.'),
            q('Vì sao RequestHandlerAvgIdlePercent thấp lại làm RequestQueue tăng?', ['Hai chỉ số không liên quan', 'Luồng I/O bận hết nên request mới phải nằm chờ trong hàng đợi', 'Vì đĩa đầy', 'Vì follower chậm'], 1, 'Thời gian nằm chờ đó chính là RequestQueue.'),
          ],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: đọc bảng giám sát',
      blocks: [
        { kind: 'p', text: 'Chỉnh tốc độ đọc/ghi để xem lag có hết không, hạ số broker còn sống để xem URP, UnderMinIsr, offline, và kéo từng chặng của request để xem chẩn đoán đổi theo.' },
        { kind: 'widget', name: 'monitor-lab' },
      ],
    },
    {
      id: 'tom-tat-video',
      title: 'Nhìn lại cả bài',
      blocks: [{ kind: 'video', scenes: ['summary'] }],
    },
  ],
  finalQuiz: [
    q('Group có lag 5.000 ổn định, group khác có lag 5.000 nhưng tăng 3.000 mỗi phút. Khác nhau ở đâu?', ['Không khác', 'Group đầu theo kịp, group sau chậm hơn producer và sẽ tụt mãi', 'Group đầu hỏng', 'Group sau nhanh hơn'], 1, 'Xu hướng quan trọng hơn một con số.'),
    q('Nếu tốc độ đọc bằng tốc độ ghi, lag 10.000 sẽ thế nào?', ['Hết sau 10 giây', 'Đứng yên mãi, không bao giờ hết', 'Tăng gấp đôi', 'Tự reset'], 1, 'Thời gian đuổi kịp = lag ÷ (đọc − ghi), mẫu số bằng 0.'),
    q('2 trong 3 broker chết, min.insync.replicas = 2, producer acks=all. Chuyện gì xảy ra?', ['Vẫn ghi bình thường', 'UnderMinIsr > 0, producer nhận NotEnoughReplicas', 'Partition offline', 'Controller bằng 0'], 1, 'ISR còn 1 < 2. Partition vẫn có leader nên chưa offline, nhưng không ghi được.'),
    q('Remote chiếm gần hết thời gian Produce. Nên xem xét gì?', ['Số luồng I/O của leader', 'Follower: đĩa hoặc mạng của broker khác', 'Retention', 'Số consumer'], 1, 'Remote là thời gian leader chờ follower với acks=all.'),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao không nên chỉ dựa vào metric lag do chính consumer báo lên?',
      keywords: ['consumer', 'chết', 'bên ngoài', 'lag'],
      modelAnswer: 'Vì khi consumer chết, treo hoặc bị đá khỏi group thì nó ngừng báo metric đúng lúc lag tăng nhanh nhất. Đo từ bên ngoài, dựa vào offset đã commit và end offset của broker, vẫn thấy lag tăng. Metric của consumer cũng chỉ cho một partition tụt xa nhất.',
    },
  ],
  recap: {
    journey:
      'Thông báo chậm mà không có lỗi → lag = end offset trừ offset đã commit → xu hướng quan trọng hơn con số → thời gian đuổi kịp = lag chia cho hiệu tốc độ đọc và ghi → URP, UnderMinIsr, offline, controller xếp theo mức nghiêm trọng → độ trễ request chia chặng chỉ ra ai chậm → luồng rảnh, đĩa, mạng cho biết broker còn sức không.',
    points: [
      { title: 'Lag', text: 'Cảnh báo theo xu hướng, đo từ bên ngoài, xem theo từng partition.' },
      { title: 'Sức khoẻ cluster', text: 'URP, UnderMinIsr, offline phải bằng 0; active controller của cả cluster đúng bằng 1.' },
      { title: 'Độ trễ request', text: 'Chia thành queue, local, remote, response. Remote cao nhìn follower, queue cao nhìn luồng.' },
      { title: 'Tài nguyên', text: 'Luồng rảnh dưới 30% để ý; đĩa 70–75% cảnh báo sớm; bytes out tính cả follower.' },
    ],
    next: 'Bài tiếp theo: Sizing & tuning — tính dung lượng đĩa, số partition, và các cấu hình cần chỉnh.',
  },
}
