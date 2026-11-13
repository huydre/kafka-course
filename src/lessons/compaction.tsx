import { cameraAt, clamp, lerp, move, sp, span, vis } from '../player/motion-kit'
import { ConsumerUnit, Envelope, HERO, Icon3D, Packets, Rise, SOFT, SOFT_PANEL, SoftScene, SoftTheme, Statement, SummaryList, Wire } from '../player/schematic'
import type { Icon3DName } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene, SceneSfx } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { compactionScript } from './compaction-script'

/** This lesson is drawn in the navy glow style. */
const INK = SOFT
const panel = SOFT_PANEL
const WIDE = { x: 960, y: 540, s: 1 }

/** Time at fraction p of beat k. */
const at = (c: Cue, k: number, p: number) => c.at(k) + (c.end(k) - c.at(k)) * p

/* ------------------------------------------------------------------ shared: key-labelled tape */

const KH = 88
const KEYBG: Record<string, string> = {
  u1: 'linear-gradient(160deg, #78b0ff 0%, #2f66f2 55%, #1c3fc4 100%)',
  u2: 'linear-gradient(160deg, #cdb8ff 0%, #8a5cf5 55%, #5230c2 100%)',
  u3: 'linear-gradient(160deg, #8ff0e8 0%, #1bbfb0 55%, #0b7f78 100%)',
  u4: 'linear-gradient(160deg, #ffd68a 0%, #f5a02b 55%, #b86a0a 100%)',
}

/** A record on a tape. `dieAt` collapses it into a hole; `tomb` is a delete marker (value null). */
type KSpec = { key: string; ver?: number; at: number; dieAt?: number; tomb?: boolean; ring?: boolean }

function KSlot({ t, x, y, w, spec }: { t: number; x: number; y: number; w: number; spec: KSpec }) {
  const k = sp(t, spec.at, 14, 140)
  if (k <= 0) return null
  const dead = spec.dieAt === undefined ? 0 : span(t, spec.dieAt, spec.dieAt + 0.5)
  const hole = <div style={{ position: 'absolute', inset: '0 3px', borderRadius: 14, boxSizing: 'border-box', border: '2px dashed rgba(110,160,255,0.5)', opacity: dead }} />
  const shadow = 'inset 0 2px 0 rgba(255,255,255,0.5), 0 0 14px rgba(77,141,255,0.35), 0 10px 20px rgba(0,8,50,0.45)'
  const ring = spec.ring ? `, 0 0 0 4px #ffffff, 0 0 26px rgba(255,255,255,0.8)` : ''
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: KH }}>
      {hole}
      {dead < 1 && (
        <div style={{ position: 'absolute', inset: '0 3px', opacity: clamp(k * 1.6) * (1 - dead), transform: `scale(${(0.85 + 0.15 * k) * (1 - 0.15 * dead)})` }}>
          <div
            style={{
              height: '100%',
              borderRadius: 14,
              boxSizing: 'border-box',
              background: spec.tomb ? INK.cell.dead : KEYBG[spec.key],
              border: spec.tomb ? `3px dashed ${INK.bad}` : 'none',
              boxShadow: spec.tomb ? `0 0 16px ${INK.bad}66${ring}` : `${shadow}${ring}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}
          >
            <span style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>{spec.key}</span>
            <span style={{ fontFamily: MONO, fontSize: 28, fontWeight: 700, lineHeight: 1.15, color: spec.tomb ? INK.bad : 'rgba(255,255,255,0.9)' }}>{spec.tomb ? 'null' : `v${spec.ver}`}</span>
          </div>
        </div>
      )}
    </div>
  )
}

/** A tape of `n` equal slots; `cells` maps offset index to a record. Offsets are printed below. */
function KTape({ t, x, y, cw, n, cells, title, base = 0, ticks = true, o = 1 }: { t: number; x: number; y: number; cw: number; n: number; cells: Record<number, KSpec>; title?: string; base?: number; ticks?: boolean; o?: number }) {
  return (
    <div style={{ opacity: clamp(o) }}>
      {title && <div style={{ position: 'absolute', left: x, top: y - 50, fontSize: 30, fontWeight: 700, color: INK.faint, whiteSpace: 'nowrap' }}>{title}</div>}
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ position: 'absolute', left: x + i * cw, top: y, width: cw, height: KH, padding: '0 3px', boxSizing: 'border-box' }}>
          <div style={{ height: '100%', borderRadius: 14, boxSizing: 'border-box', background: INK.cell.empty, border: '1.5px solid rgba(110,160,255,0.35)' }} />
        </div>
      ))}
      {Object.entries(cells).map(([i, spec]) => (
        <KSlot key={i} t={t} x={x + Number(i) * cw} y={y} w={cw} spec={spec} />
      ))}
      {ticks &&
        Array.from({ length: n }, (_, i) => (
          <span key={i} style={{ position: 'absolute', left: x + i * cw, width: cw, textAlign: 'center', top: y + KH + 8, fontFamily: MONO, fontSize: 28, color: INK.faint }}>
            {base + i}
          </span>
        ))}
    </div>
  )
}

/** Small glowing pill. */
function Pill({ x, y, text, color = '#ffffff', o = 1, mono = false, size = 28, center = false }: { x: number; y: number; text: string; color?: string; o?: number; mono?: boolean; size?: number; center?: boolean }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: center ? 'translateX(-50%)' : undefined, padding: '8px 20px', borderRadius: 999, background: 'rgba(8,22,82,0.92)', border: `1.5px solid ${color === '#ffffff' ? '#6ea2ff' : color}`, boxShadow: `0 0 18px ${color === '#ffffff' ? 'rgba(77,141,255,0.65)' : `${color}88`}`, fontFamily: mono ? MONO : undefined, fontSize: size, fontWeight: 800, color, whiteSpace: 'nowrap', opacity: clamp(o) }}>
      {text}
    </div>
  )
}

/** Vertical scan beam used by the log cleaner. */
function Beam({ x, y, h, o }: { x: number; y: number; h: number; o: number }) {
  if (o <= 0) return null
  return <div style={{ position: 'absolute', left: x - 4, top: y, width: 8, height: h, borderRadius: 4, background: `linear-gradient(180deg, #ffffff, ${INK.warn})`, boxShadow: `0 0 18px ${INK.warn}, 0 0 40px ${INK.warn}88`, opacity: clamp(o) }} />
}

/** Horizontal bracket line with a label centred under it. */
function Bracket({ x, w, y, color, o = 1 }: { x: number; w: number; y: number; color: string; o?: number }) {
  return <div style={{ position: 'absolute', left: x + 6, top: y, width: w - 12, height: 6, borderRadius: 3, background: color, boxShadow: `0 0 12px ${color}`, opacity: clamp(o) }} />
}

/* ------------------------------------------------------------------ 0. cold open: state, not events */

function hook(t: number, c: Cue) {
  const [a1, a2, a3] = [c.at(1), c.at(2), c.at(3)]
  const T = { x: 150, y: 400, cw: 150 }
  const cx = (i: number) => T.x + i * T.cw + T.cw / 2
  const agedAt = at(c, 2, 0.45)
  const lostAt = at(c, 2, 0.62)
  const data: [string, number][] = [['u1', 1], ['u2', 1], ['u1', 2], ['u3', 1], ['u1', 3], ['u3', 2], ['u1', 4]]
  const cells: Record<number, KSpec> = {}
  data.forEach(([key, ver], i) => (cells[i] = { key, ver, at: at(c, 0, 0.12 + i * 0.1), dieAt: i === 1 ? agedAt : undefined }))
  const seen = [at(c, 1, 0.3), at(c, 1, 0.5), at(c, 1, 0.7)]
  const parts = ['u1', 'u2', 'u3'].filter((_, i) => t >= seen[i] && !(i === 1 && t >= lostAt))
  const legend = ['u1 · An', 'u2 · Bình', 'u3 · Chi']
  const FILL = 1200
  const barP = move(t, a3 + 0.4, at(c, 3, 0.8) - a3 - 0.4)
  const pulse = barP >= 1 ? 0.5 + 0.5 * Math.sin((t - at(c, 3, 0.8)) * 5) : 0
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, { x: 920, y: 500, s: 1.06 }], [a1, { x: 975, y: 510, s: 1.1 }, 2], [a2, { x: 960, y: 580, s: 1.06 }, 1.3], [a3, WIDE, 1.3]])}>
      <Rise t={t} at={0.2}>
        <KTape t={t} x={T.x} y={T.y} cw={T.cw} n={8} cells={cells} title="user-profile · P0" />
      </Rise>
      {legend.map((l, i) => (
        <Pill key={l} x={T.x + i * 230} y={590} text={l} o={vis(t, at(c, 0, 0.5 + i * 0.12))} />
      ))}
      <Rise t={t} at={at(c, 1, 0.05)}>
        <ConsumerUnit x={1430} y={385} w={390} name="service mới" note="bảng hồ sơ" t={t} parts={parts} busy={t >= a1 && t < a2 ? (t * 1.1) % 1 : undefined} />
      </Rise>
      <Wire from={{ x: T.x + 8 * T.cw + 10, y: 444 }} to={{ x: 1416, y: 444 }} color={INK.line} p={move(t, a1 + 0.1, 0.5)} flow={t} />
      <Packets t={t} from={{ x: T.x + 8 * T.cw + 10, y: 444 }} to={{ x: 1416, y: 444 }} start={a1 + 0.5} end={a2} every={0.4} len={0.7} size={18} />
      {/* age-based deletion */}
      <div style={{ opacity: vis(t, a2, a3 - 0.2, 0.4) }}>
        <Icon3D name="clock" x={cx(1)} y={730} size={130} t={t} at={a2 + 0.05} />
        <Pill x={cx(1)} y={820} text="8 ngày không sửa" color={INK.warn} center o={sp(t, a2 + 0.3)} />
      </div>
      {t >= lostAt && t < a3 && <Pill x={1625} y={530} text="mất Bình" color={INK.bad} center o={sp(t, lostAt)} />}
      {t >= agedAt && t < a3 && <Statement x={110} y={950} text="xoá theo tuổi: Bình biến mất khỏi topic" color={INK.bad} size={42} o={sp(t, agedAt + 0.3)} />}
      {/* keep forever */}
      {t >= a3 && (
        <>
          <div style={{ position: 'absolute', left: T.x, top: 728, fontSize: 30, fontWeight: 700, color: INK.faint, opacity: vis(t, a3 + 0.1) }}>dung lượng topic</div>
          <div style={{ position: 'absolute', left: T.x, top: 780, width: FILL, height: 56, boxSizing: 'border-box', borderRadius: 16, border: '1.5px solid rgba(110,160,255,0.55)', background: INK.cell.empty, opacity: vis(t, a3 + 0.1), overflow: 'hidden' }}>
            <div style={{ width: `${barP * 100}%`, height: '100%', background: `linear-gradient(90deg, ${INK.accent}, ${INK.warn} 70%, ${INK.bad})`, boxShadow: `0 0 ${20 + pulse * 40}px ${INK.warn}` }} />
          </div>
          <Pill x={T.x + FILL + 24} y={783} text={`${Math.round(200 * barP)} triệu tin`} color={INK.bad} o={vis(t, a3 + 0.4)} />
          <div style={{ transform: `scale(${1 + pulse * 0.03})`, transformOrigin: '110px 950px' }}>
            <Statement x={110} y={950} text="giữ mãi mãi: topic phình vô tận" color={INK.warn} size={42} o={sp(t, at(c, 3, 0.3))} />
          </div>
        </>
      )}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 1. retention recap */

function Meter({ x, y, w, label, fill, color, end, o }: { x: number; y: number; w: number; label: string; fill: number; color: string; end: string; o: number }) {
  return (
    <div style={{ opacity: clamp(o) }}>
      <div style={{ position: 'absolute', left: 110, top: y + 8, fontFamily: MONO, fontSize: 28, fontWeight: 700, color }}>{label}</div>
      <div style={{ position: 'absolute', left: x, top: y, width: w, height: 56, boxSizing: 'border-box', borderRadius: 16, border: '1.5px solid rgba(110,160,255,0.55)', background: INK.cell.empty, overflow: 'hidden' }}>
        <div style={{ width: `${clamp(fill) * 100}%`, height: '100%', background: `linear-gradient(90deg, ${INK.accent}, ${color})`, boxShadow: `0 0 18px ${color}` }} />
      </div>
      <div style={{ position: 'absolute', left: x + w + 24, top: y + 8, fontSize: 28, fontWeight: 800, color }}>{end}</div>
    </div>
  )
}

function retention(t: number, c: Cue) {
  const [a1, a2, a3] = [c.at(1), c.at(2), c.at(3)]
  const killAt = at(c, 0, 0.7)
  // stage A: five segments with the age of their newest record
  const segs = [{ age: '9 ngày', bad: true }, { age: '6 ngày' }, { age: '4 ngày' }, { age: '2 ngày' }, { age: 'đang ghi' }]
  const SW = 300
  const SX = 150
  // stage C: 6 partitions x 3 replicas
  const G = { x: 350, y: 400, w: 150, h: 96, gx: 16, gy: 24 }
  const total = (r: number, k: number) => at(c, 2, 0.05 + (r * 6 + k) * 0.032)
  let count = 0
  for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) if (t >= total(r, k)) count++
  // stage D: two independent meters
  const hitAt = at(c, 3, 0.4)
  const msFill = lerp(0, 0.62, span(t, a3 + 0.3, hitAt))
  const bytesFill = span(t, a3 + 0.3, hitAt)
  const D0 = 420
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 560, s: 1.05 }, 1.3], [a3, WIDE, 1.3]])} title={{ kicker: 'RETENTION', text: 'Xoá theo tuổi và dung lượng' }}>
      {/* A: segments */}
      <div style={{ opacity: vis(t, 0.2, a1 - 0.1, 0.4) }}>
        <Pill x={SX} y={290} text="retention.ms = 7 ngày" mono color={INK.accent} />
        {segs.map((s, i) => {
          const dead = i === 0 ? span(t, killAt, killAt + 0.5) : 0
          return (
            <Rise key={i} t={t} at={0.5 + i * 0.12}>
              <div style={{ position: 'absolute', left: SX + i * (SW + 20), top: 380, width: SW, height: 170, boxSizing: 'border-box', borderRadius: 22, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 6, background: i === 4 ? HERO : (INK.card.background as string), border: dead >= 1 ? '2px dashed rgba(110,160,255,0.5)' : s.bad && t >= at(c, 0, 0.45) ? `2px solid ${INK.bad}` : (INK.card.border as string), opacity: 1 - dead * 0.85, boxShadow: i === 4 ? '0 0 34px rgba(77,141,255,0.6)' : (INK.card.boxShadow as string) }}>
                <span style={{ fontSize: 30, fontWeight: 800 }}>segment {i}</span>
                <span style={{ fontSize: 28, fontWeight: 600, color: s.bad && t >= at(c, 0, 0.45) ? INK.bad : i === 4 ? '#ffffff' : INK.faint }}>{i === 4 ? 'đang ghi' : `tin mới nhất ${s.age}`}</span>
              </div>
            </Rise>
          )
        })}
        {t >= killAt && <Icon3D name="trash-can" x={SX + SW / 2} y={680} size={150} t={t} at={killAt} />}
        <Statement x={SX} y={800} text="xoá nguyên segment, không xoá từng tin" color={INK.warn} size={42} o={sp(t, at(c, 0, 0.8))} />
      </div>
      {/* B: one partition up to 10GB */}
      <div style={{ opacity: vis(t, a1 + 0.1, a2 - 0.1, 0.4) }}>
        <Icon3D name="folder" x={190} y={520} size={150} t={t} at={a1 + 0.1} />
        <div style={{ position: 'absolute', left: 330, top: 400, fontSize: 28, fontWeight: 700, color: INK.faint }}>một partition</div>
        {Array.from({ length: 10 }, (_, i) => {
          const k = sp(t, a1 + 0.5 + i * 0.12, 14, 140)
          return <div key={i} style={{ position: 'absolute', left: 330 + i * 124, top: 460, width: 116, height: 110, boxSizing: 'border-box', borderRadius: 16, background: HERO, boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.5), 0 10px 20px rgba(0,8,50,0.45)', opacity: clamp(k * 1.5), transform: `scale(${0.85 + 0.15 * k})`, display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 800 }}>1GB</div>
        })}
        <div style={{ position: 'absolute', left: 330 + 10 * 124 + 4, top: 440, width: 6, height: 150, borderRadius: 3, background: INK.bad, boxShadow: `0 0 14px ${INK.bad}`, opacity: vis(t, a1 + 1.8) }} />
        <Pill x={330 + 10 * 124 - 220} y={630} text="retention.bytes = 10GB" mono color={INK.bad} o={vis(t, a1 + 2.0)} />
        <Statement x={330} y={800} text="mỗi partition, không phải cả topic" color={INK.warn} size={42} o={sp(t, at(c, 1, 0.55))} />
      </div>
      {/* C: 6 partitions x 3 replicas */}
      <div style={{ opacity: vis(t, a2 + 0.1, a3 - 0.1, 0.4) }}>
        {[0, 1, 2].map((r) => (
          <div key={r} style={{ position: 'absolute', left: 230, top: G.y + r * (G.h + G.gy) + 28, fontSize: 30, fontWeight: 700, color: INK.faint, opacity: vis(t, total(r, 0)) }}>
            bản {r + 1}
          </div>
        ))}
        {Array.from({ length: 6 }, (_, k) => (
          <div key={k} style={{ position: 'absolute', left: G.x + k * (G.w + G.gx), top: G.y - 52, width: G.w, textAlign: 'center', fontFamily: MONO, fontSize: 30, fontWeight: 700, color: INK.faint, opacity: vis(t, a2 + 0.2) }}>
            P{k}
          </div>
        ))}
        {[0, 1, 2].flatMap((r) =>
          Array.from({ length: 6 }, (_, k) => (
            <Rise key={`${r}-${k}`} t={t} at={total(r, k)}>
              <div style={{ position: 'absolute', left: G.x + k * (G.w + G.gx), top: G.y + r * (G.h + G.gy), width: G.w, height: G.h, boxSizing: 'border-box', borderRadius: 18, background: HERO, boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.5), 0 10px 20px rgba(0,8,50,0.45)', display: 'grid', placeItems: 'center', fontSize: 32, fontWeight: 800 }}>10GB</div>
            </Rise>
          )),
        )}
        <div style={{ ...panel, left: 1410, top: G.y + 60, width: 290, boxSizing: 'border-box', textAlign: 'center', opacity: vis(t, a2 + 0.3) }}>
          <div style={{ fontSize: 28, fontWeight: 600, color: INK.faint }}>đĩa thật</div>
          <div style={{ fontSize: 64, fontWeight: 800, color: count >= 18 ? INK.warn : '#ffffff' }}>{count * 10}GB</div>
        </div>
        <Pill x={G.x} y={G.y + 3 * (G.h + G.gy) + 20} text="6 partition × 3 bản × 10GB = 180GB" mono color={INK.warn} o={vis(t, at(c, 2, 0.8))} />
      </div>
      {/* D: two independent limits */}
      <div style={{ opacity: vis(t, a3 + 0.1, Infinity, 0.4) }}>
        <Meter x={D0 + 40} y={380} w={900} label="retention.ms" fill={msFill} color={INK.accent} end="7 ngày" o={vis(t, a3 + 0.15)} />
        <Meter x={D0 + 40} y={540} w={900} label="retention.bytes" fill={bytesFill} color={t >= hitAt ? INK.bad : INK.warn} end="10GB" o={vis(t, a3 + 0.3)} />
        {t >= hitAt && <Icon3D name="trash-can" x={1700} y={500} size={150} t={t} at={hitAt} />}
        {t >= hitAt && <Pill x={1700} y={600} text="chạm trước → xoá" color={INK.bad} center o={sp(t, hitAt + 0.2)} />}
        <Statement x={110} y={800} text="độc lập nhau: cái nào đến trước thì xoá trước" color={INK.warn} size={42} o={sp(t, at(c, 3, 0.6))} />
      </div>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 2. compact by key + cleanup.policy */

function PolicyCard({ x, y, icon, name, sub, h, o, t, atT, pulse = 0 }: { x: number; y: number; icon: Icon3DName; name: string; sub: string; h: number; o: number; t: number; atT: number; pulse?: number }) {
  return (
    <div style={{ opacity: clamp(o), transform: `scale(${1 + pulse * 0.03 + 0.02 * h})`, transformOrigin: `${x + 260}px ${y + 95}px` }}>
      <div style={{ ...panel, left: x, top: y, width: 520, height: 190, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 22, padding: '0 28px', background: INK.card.background as string, border: INK.card.border as string, boxShadow: INK.card.boxShadow as string }}>
        {/* highlight layer: fill, border and glow all ride the same 0..1 factor */}
        <div style={{ ...panel, left: 0, top: 0, width: 520, height: 190, boxSizing: 'border-box', background: HERO, border: 'none', opacity: h, boxShadow: '0 0 34px rgba(77,141,255,0.6), inset 0 2px 0 rgba(255,255,255,0.5)' }} />
        <div style={{ width: 104, height: 104, flex: 'none', position: 'relative' }}>
          <Icon3D name={icon} x={52} y={52} size={104} t={t} at={atT} />
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ fontFamily: MONO, fontSize: 30, fontWeight: 800 }}>{name}</div>
          <div style={{ marginTop: 6, fontSize: 28, fontWeight: 600, color: `rgb(${[159, 182, 238].map((v) => Math.round(lerp(v, 255, h))).join(',')})` }}>{sub}</div>
        </div>
      </div>
    </div>
  )
}

function policy(t: number, c: Cue) {
  const [a1, a2, a3, a4] = [c.at(1), c.at(2), c.at(3), c.at(4)]
  const T = { x: 360, y: 330, cw: 150 }
  const cx = (i: number) => T.x + i * T.cw + T.cw / 2
  const data: [string, number][] = [['u1', 1], ['u2', 1], ['u1', 2], ['u3', 1], ['u1', 3], ['u2', 2], ['u3', 2], ['u1', 4]]
  const collapse0 = at(c, 0, 0.5)
  const agedAt = at(c, 4, 0.5)
  const cells: Record<number, KSpec> = {}
  data.forEach(([key, ver], i) => {
    const dieAt = i < 5 ? collapse0 + i * 0.42 : i === 5 ? agedAt : undefined
    cells[i] = { key, ver, at: 0.4 + i * 0.16, dieAt, ring: i >= 6 && t >= a1 + 0.4 && t < a2 }
  })
  // 0..1 highlight per card; smoothstep over 0.5s at each hand-over (gentler peak slope than a cubic ease)
  const soft = (a: number) => {
    const k = span(t, a, a + 0.5)
    return k * k * (3 - 2 * k)
  }
  const cardGlow = (i: number) => (i < 2 ? soft(a3) * (1 - soft(a4)) : soft(a4))
  const cards: { icon: Icon3DName; name: string; sub: string; tag: string }[] = [
    { icon: 'clock', name: 'delete', sub: 'mặc định · theo tuổi', tag: 'dòng sự kiện: click, đơn hàng' },
    { icon: 'key', name: 'compact', sub: 'theo key · giữ bản mới', tag: 'trạng thái: hồ sơ, giá' },
    { icon: 'toggle', name: 'compact,delete', sub: 'cả hai điều kiện', tag: 'trạng thái, key cũ tự mất' },
  ]
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a2, { x: 960, y: 590, s: 1.06 }, 1.3], [a4 + 1.5, WIDE, 1.3]])} title={{ kicker: 'CLEANUP POLICY', text: 'Xoá theo key' }}>
      <Rise t={t} at={0.2}>
        <KTape t={t} x={T.x} y={T.y} cw={T.cw} n={8} cells={cells} title="user-profile · P0" />
      </Rise>
      {/* holes keep their offsets */}
      {t >= a1 + 0.2 && (
        <div style={{ opacity: vis(t, a1 + 0.2, a2 - 0.2, 0.4) }}>
          <Bracket x={T.x} w={5 * T.cw} y={T.y + KH + 50} color={INK.warn} />
          <Pill x={T.x + 2.5 * T.cw} y={T.y + KH + 64} text="5 lỗ: offset 0 đến 4" color={INK.warn} center />
          <Bracket x={T.x + 5 * T.cw} w={3 * T.cw} y={T.y + KH + 50} color="#ffffff" />
          <Pill x={T.x + 6.5 * T.cw} y={T.y + KH + 64} text="offset 5, 6, 7 giữ nguyên" center />
        </div>
      )}
      {/* three policies */}
      {cards.map((cd, i) => (
        <div key={cd.name}>
          <div style={{ position: 'absolute', left: 140 + i * 560, top: 620, width: 520, height: 190, boxSizing: 'border-box', borderRadius: 28, border: '2px dashed rgba(110,160,255,0.35)', opacity: vis(t, a2 - 0.8) }} />
          <PolicyCard x={140 + i * 560} y={620} icon={cd.icon} name={cd.name} sub={cd.sub} h={cardGlow(i)} o={vis(t, a2 - 0.6 + i * 0.7, Infinity, 0.5)} t={t} atT={a2 - 0.6 + i * 0.7} pulse={t >= a4 && i === 2 ? 0.5 + 0.5 * Math.sin((t - a4) * 4) : 0} />
          {t >= (i < 2 ? a3 + 0.3 + i * 0.5 : 99) && i < 2 && <Pill x={140 + i * 560 + 260} y={840} text={cd.tag} center color={i === 0 ? INK.accent : INK.good} o={sp(t, a3 + 0.3 + i * 0.5)} />}
        </div>
      ))}
      {/* compact,delete: the newest version still dies when it is too old */}
      {t >= a4 && (
        <>
          <Pill x={cx(5)} y={T.y + KH + 64} text={t >= agedAt ? 'bị xoá dù là bản mới nhất' : 'tuổi 10 ngày > retention.ms 7 ngày'} color={INK.bad} center o={sp(t, a4 + 0.2)} />
        </>
      )}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 3. the log cleaner */

/** Records of the partition: key, version; offsets 1 and 3 are holes from an earlier compaction. */
const LOG: { off: number; key: string; ver: number }[] = [
  { off: 0, key: 'u2', ver: 1 },
  { off: 2, key: 'u3', ver: 1 },
  { off: 4, key: 'u1', ver: 2 },
  { off: 5, key: 'u1', ver: 3 },
  { off: 6, key: 'u4', ver: 1 },
  { off: 7, key: 'u2', ver: 2 },
  { off: 8, key: 'u1', ver: 4 },
  { off: 9, key: 'u3', ver: 2 },
  { off: 10, key: 'u4', ver: 2 },
  { off: 11, key: 'u1', ver: 5 },
  { off: 12, key: 'u2', ver: 3 },
  { off: 13, key: 'u3', ver: 3 },
  { off: 14, key: 'u1', ver: 6 },
]
/** Latest offset of each key within the sealed part (offset < 11). */
const LATEST: Record<string, number> = { u1: 8, u2: 7, u3: 9, u4: 10 }

function cleaner(t: number, c: Cue) {
  const [a2, a3, a4] = [c.at(2), c.at(3), c.at(4)]
  const T = { x: 160, y: 470, cw: 100 }
  const X = (i: number) => T.x + i * T.cw
  // beam 1 scans the dirty part (cells 5..11), beam 2 sweeps clean + dirty (cells 0..11)
  const s1 = at(c, 2, 0.2)
  const e1 = at(c, 2, 0.85)
  const s2 = at(c, 3, 0.1)
  const e2 = at(c, 3, 0.9)
  const pos1 = lerp(5, 11, span(t, s1, e1))
  const pos2 = lerp(0, 11, span(t, s2, e2))
  const beam1 = t >= s1 && t < a3 ? 1 : 0
  const beam2 = t >= s2 && t < e2 + 0.3 ? 1 - span(t, e2, e2 + 0.3) : 0
  const dieOf = (off: number) => s2 + ((off + 1) / 11) * (e2 - s2)
  const cells: Record<number, KSpec> = {}
  LOG.forEach((r) => {
    const stale = r.off < 11 && LATEST[r.key] > r.off
    cells[r.off] = { key: r.key, ver: r.ver, at: 0.3 + r.off * 0.07, dieAt: stale ? dieOf(r.off) : undefined }
  })
  // zones: the clean part grows over the dirty one once the sweep is done
  const grown = span(t, e2, e2 + 0.8)
  const cleanEnd = lerp(5, 11, grown)
  // key -> offset table, filled while beam 1 passes
  const scanned = (key: string) => {
    const seen = LOG.filter((r) => r.off >= 5 && r.off < 11 && r.key === key && r.off + 1 <= pos1 && t >= s1)
    return seen.length ? Math.max(...seen.map((r) => r.off)) : -1
  }
  const keys = ['u1', 'u2', 'u3', 'u4']
  const ZY = 330
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a2, { x: 960, y: 580, s: 1.06 }, 1.3], [a4, { x: 960, y: 560, s: 1.02 }, 1.6]])} title={{ kicker: 'LOG CLEANER', text: 'Sạch, bẩn, active' }}>
      <Rise t={t} at={0.2}>
        <KTape t={t} x={T.x} y={T.y} cw={T.cw} n={16} cells={cells} title="topic compacted · P0" />
      </Rise>
      <Rise t={t} at={at(c, 0, 0.4)}>
        <ConsumerUnit x={160} y={700} w={420} name="log cleaner" note="luồng nền" t={t} accent={INK.warn} busy={t >= s1 && t < e2 ? (t * 1.3) % 1 : undefined} />
      </Rise>
      <Icon3D name="setting" x={655} y={760} size={110} t={t} at={at(c, 0, 0.55)} />
      {/* zones */}
      <div style={{ opacity: vis(t, at(c, 1, 0.1)) }}>
        <Bracket x={X(0)} w={(cleanEnd - 0) * T.cw} y={ZY + 56} color={INK.good} />
        <Pill x={X(0) + (cleanEnd * T.cw) / 2} y={ZY} text="phần sạch" color={INK.good} center />
      </div>
      <div style={{ opacity: vis(t, at(c, 1, 0.4)) * (1 - grown) }}>
        <Bracket x={X(5)} w={6 * T.cw} y={ZY + 56} color={INK.warn} />
        <Pill x={X(8)} y={ZY} text="phần bẩn" color={INK.warn} center />
      </div>
      <div style={{ opacity: vis(t, at(c, 1, 0.7)) }}>
        <Bracket x={X(11)} w={5 * T.cw} y={ZY + 56} color="#ffffff" />
        <Pill x={X(13.5)} y={ZY} text="active segment" center />
      </div>
      <Beam x={X(pos1)} y={T.y - 22} h={KH + 44} o={beam1 * vis(t, s1, a3 - 0.1, 0.3)} />
      <Beam x={X(pos2)} y={T.y - 22} h={KH + 44} o={beam2} />
      {/* key -> latest offset table */}
      <div style={{ opacity: vis(t, a2 + 0.1) }}>
        <Pill x={780} y={660} text="bảng key → offset mới nhất" color={INK.warn} />
        {keys.map((k, i) => {
          const v = scanned(k)
          return (
            <div key={k} style={{ position: 'absolute', left: 780 + i * 190, top: 730, width: 170, height: 70, boxSizing: 'border-box', borderRadius: 18, border: '2px dashed rgba(110,160,255,0.6)' }}>
              {v >= 0 && (
                <div style={{ ...panel, left: -2, top: -2, width: 170, height: 70, boxSizing: 'border-box', padding: 0, display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 30, background: KEYBG[k], border: 'none' }}>
                  {k} → {v}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {/* active segment is never compacted */}
      {t >= a4 && (
        <>
          <Icon3D name="lock" x={1640} y={905} size={130} t={t} at={a4 + 0.05} />
          <Pill x={X(13.5)} y={T.y + KH + 64} text="bản cũ vẫn còn" color={INK.warn} center o={sp(t, a4 + 0.3)} />
          <Statement x={110} y={930} text="active segment: không bao giờ bị compact" color={INK.warn} size={42} o={sp(t, a4 + 0.5)} />
        </>
      )}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 4. dirty ratio */

function ratio(t: number, c: Cue) {
  const [a1, a2, a3, a4] = [c.at(1), c.at(2), c.at(3), c.at(4)]
  const BX = 300
  const BY = 340
  const fill0 = move(t, 0.9, a1 - 1.3)
  const grow = move(t, a3 + 0.3, 1.2)
  const dirty = t < a2 ? lerp(0, 400, fill0) : lerp(400, 700, grow)
  const r = dirty / (600 + dirty)
  const over = r >= 0.5
  const GX = 300
  const GW = 1000
  const GY = 700
  const fmt = (v: number) => v.toFixed(2).replace('.', ',')
  const formula = t < a2 ? 'dirty ratio = bẩn ÷ (sạch + bẩn)' : over && t >= a3 + 0.4 ? `${Math.round(dirty)} ÷ (600 + ${Math.round(dirty)}) ≈ ${fmt(r)}` : `400 ÷ (600 + 400) = ${fmt(0.4)}`
  const block = (w: number, left: number, bg: string, label: string, o: number, dashed = false) => (
    <div style={{ position: 'absolute', left, top: BY, width: w, height: 100, boxSizing: 'border-box', borderRadius: 18, background: bg, border: dashed ? '3px dashed rgba(255,255,255,0.7)' : 'none', display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 800, opacity: o, boxShadow: dashed ? undefined : 'inset 0 2px 0 rgba(255,255,255,0.5), 0 10px 20px rgba(0,8,50,0.45)', whiteSpace: 'nowrap' }}>{label}</div>
  )
  const act = { cells: 10, cw: 120, x: 420, y: 440 }
  const cells: Record<number, KSpec> = {}
  for (let i = 0; i < 9; i++) cells[i] = { key: 'u1', ver: i + 1, at: a4 + 0.5 + i * 0.28 }
  const ph = t < a4 - 0.1
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a2, { x: 900, y: 560, s: 1.06 }, 1.3], [a4, WIDE, 1.3], [a4 + 0.9, { x: 960, y: 540, s: 1.28 }, 1.6]])} title={{ kicker: 'DIRTY RATIO', text: 'Khi nào cleaner dọn' }}>
      {ph && (
        <div style={{ opacity: 1 - span(t, a4 - 0.4, a4 - 0.1), transform: 'translateY(60px)' }}>
          {/* partition bar */}
          <Rise t={t} at={0.4}>
            <div>
              {block(600, BX, HERO, t >= a2 ? 'sạch 600MB' : t >= a1 ? 'sạch' : '', 1)}
              {block(dirty, BX + 600, 'linear-gradient(160deg, #ffd68a 0%, #f5a02b 55%, #b86a0a 100%)', t >= a2 ? `bẩn ${Math.round(dirty)}MB` : t >= a1 ? 'bẩn' : '', 1)}
              {block(160, BX + 600 + dirty, 'rgba(40,62,140,0.5)', t >= a1 ? 'active' : '', 1, true)}
            </div>
          </Rise>
          <Pill x={BX + 600 + dirty + 80} y={456} text="không tính" color={INK.faint} center o={vis(t, a1 + 0.9)} />
          {/* formula */}
          <div style={{ ...panel, left: BX, top: 540, fontFamily: MONO, fontSize: 30, opacity: vis(t, a1 + 0.4) }}>{formula}</div>
          {/* gauge with the threshold */}
          <div style={{ opacity: vis(t, 0.3) }}>
            <div style={{ position: 'absolute', left: GX, width: GW, textAlign: 'center', top: GY + 128, fontFamily: MONO, fontSize: 28, fontWeight: 700, color: INK.faint }}>min.cleanable.dirty.ratio</div>
            <div style={{ position: 'absolute', left: GX, top: GY, width: GW, height: 40, boxSizing: 'border-box', borderRadius: 20, border: '1.5px solid rgba(110,160,255,0.55)', background: INK.cell.empty, overflow: 'hidden' }}>
              <div style={{ width: `${r * 100}%`, height: '100%', background: over ? `linear-gradient(90deg, ${INK.accent}, ${INK.good})` : `linear-gradient(90deg, ${INK.accent}, ${INK.warn})`, boxShadow: `0 0 16px ${over ? INK.good : INK.warn}` }} />
            </div>
            <div style={{ position: 'absolute', left: GX + GW / 2 - 3, top: GY - 14, width: 6, height: 68, borderRadius: 3, background: INK.bad, boxShadow: `0 0 12px ${INK.bad}` }} />
            <Pill x={GX + GW / 2} y={GY + 66} text="ngưỡng 0,5" color={INK.bad} center o={vis(t, 0.8)} />
            {t >= 1.6 && <Pill x={GX + Math.min(GW - 60, Math.max(60, r * GW))} y={GY - 66} text={fmt(r)} mono color={over ? INK.good : INK.warn} center />}
          </div>
          {/* verdict */}
          {t >= a2 && !over && <Icon3D name="pause" x={1560} y={760} size={140} t={t} at={a2 + 0.8} />}
          {t >= a2 && !over && <Pill x={1560} y={850} text="chưa dọn" color={INK.warn} center o={sp(t, a2 + 1.0)} />}
          {over && t >= a3 + 0.6 && <Icon3D name="play" x={1560} y={760} size={140} t={t} at={a3 + 0.6} />}
          {over && t >= a3 + 0.6 && <Pill x={1560} y={850} text="cleaner dọn!" color={INK.good} center o={sp(t, a3 + 0.8)} />}
        </div>
      )}
      {!ph && (
        <>
          <Icon3D name="clock" x={320} y={484} size={130} t={t} at={a4 + 0.05} />
          <div style={{ position: 'absolute', left: act.x, top: act.y - 100, fontSize: 30, fontWeight: 700, color: INK.faint, opacity: vis(t, a4 + 0.1) }}>active segment · segment.ms = 7 ngày</div>
          <div style={{ position: 'absolute', left: act.x - 12, top: act.y - 16, width: act.cells * act.cw + 24, height: KH + 32, boxSizing: 'border-box', borderRadius: 22, border: '3px dashed rgba(255,255,255,0.7)', opacity: vis(t, a4 + 0.1) }} />
          <KTape t={t} x={act.x} y={act.y} cw={act.cw} n={act.cells} cells={cells} ticks={false} o={vis(t, a4 + 0.1)} />
          <Pill x={act.x + 5 * act.cw} y={act.y + KH + 50} text="u1 có chín bản: chưa được compact" color={INK.bad} center o={vis(t, a4 + 3.2)} />
          <Pill x={act.x + 5 * act.cw} y={act.y + KH + 150} text="muốn dọn sớm: giảm segment.ms" color={INK.good} center o={vis(t, at(c, 4, 0.75))} />
        </>
      )}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 5. tombstone */

function tombstone(t: number, c: Cue) {
  const [a1, a2, a3, a4] = [c.at(1), c.at(2), c.at(3), c.at(4)]
  const T = { x: 240, y: 340, cw: 150 }
  const cx = (i: number) => T.x + i * T.cw + T.cw / 2
  const tombAt = at(c, 0, 0.62)
  const s = at(c, 2, 0.15)
  const e = at(c, 2, 0.85)
  const pos = lerp(0, 6, span(t, s, e))
  const dieOf = (i: number) => s + ((i + 1) / 6) * (e - s)
  const diesAt = at(c, 4, 0.35)
  const readAt = at(c, 3, 0.4)
  const gone = readAt + 0.9
  const data: [string, number][] = [['u1', 1], ['u2', 1], ['u3', 1], ['u1', 2], ['u2', 2], ['u3', 2]]
  const cells: Record<number, KSpec> = {}
  data.forEach(([key, ver], i) => (cells[i] = { key, ver, at: at(c, 0, 0.05 + i * 0.1), dieAt: key === 'u2' ? dieOf(i) : undefined }))
  cells[6] = { key: 'u2', tomb: true, at: tombAt, dieAt: diesAt, ring: t >= a2 + 0.2 && t < diesAt }
  const parts = ['u1', 'u2', 'u3'].filter((p) => !(p === 'u2' && t >= gone))
  // retention bar under the tombstone
  const left = 1 - span(t, a3 + 0.2, diesAt)
  const steps = [
    { x: 380, label: 't = 0 · ghi tombstone', at: tombAt },
    { x: 960, label: '+5 phút · xoá bản cũ', at: s },
    { x: 1540, label: '+1 ngày 5 phút · tombstone hết hạn', at: diesAt },
  ]
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a3, { x: 940, y: 560, s: 1.06 }, 1.3], [a4 + 1.5, WIDE, 1.3]])} title={{ kicker: 'TOMBSTONE', text: 'Xoá một key' }}>
      <Rise t={t} at={0.2}>
        <KTape t={t} x={T.x} y={T.y} cw={T.cw} n={8} cells={cells} title="user-profile · P0" />
      </Rise>
      <Pill x={cx(6)} y={256} text="key = u2 · value = null" mono color={INK.bad} center o={vis(t, tombAt + 0.3, a2 - 0.2)} />
      {/* b1: the name */}
      {t >= a1 && t < a2 && (
        <>
          <Icon3D name="trash-can" x={1590} y={400} size={150} t={t} at={a1 + 0.1} />
          <Pill x={1590} y={500} text="tombstone = bia mộ" color={INK.bad} center o={sp(t, a1 + 0.5)} />
        </>
      )}
      <Beam x={T.x + pos * T.cw} y={T.y - 22} h={KH + 44} o={t >= s && t < e + 0.4 ? 1 - span(t, e, e + 0.4) : 0} />
      {t >= s && t < e + 0.4 && <Pill x={T.x + pos * T.cw} y={T.y - 96} text="log cleaner" color={INK.warn} center />}
      {/* tombstone countdown */}
      {t >= a3 && t < diesAt + 0.5 && (
        <div style={{ opacity: vis(t, a3 + 0.1, diesAt, 0.4) }}>
          <div style={{ position: 'absolute', left: T.x + 6 * T.cw + 6, top: T.y + KH + 48, width: T.cw - 12, height: 14, borderRadius: 7, background: INK.cell.empty, border: '1px solid rgba(110,160,255,0.55)', overflow: 'hidden' }}>
            <div style={{ width: `${left * 100}%`, height: '100%', background: INK.warn, boxShadow: `0 0 12px ${INK.warn}` }} />
          </div>
          <Pill x={cx(6)} y={T.y + KH + 72} text="delete.retention.ms = 1 ngày" mono color={INK.warn} center />
        </div>
      )}
      {/* consumer holding a copy of the state */}
      <Rise t={t} at={at(c, 0, 0.2)}>
        <ConsumerUnit x={240} y={640} w={460} name="service · cache" t={t} parts={parts} note={t >= gone && t < a4 ? 'đã xoá u2' : undefined} busy={t >= readAt && t < gone ? (t * 1.4) % 1 : undefined} />
      </Rise>
      <Envelope t={t} at={readAt} from={{ x: cx(6), y: T.y + KH + 150 }} to={{ x: 700, y: 690 }} label="đọc thấy tombstone" color={INK.bad} len={0.9} arc={0} />
      {t >= gone && t < a4 && <Pill x={1180} y={668} text="consumer chậm vẫn kịp xoá u2" color={INK.good} center o={sp(t, gone)} />}
      {t >= diesAt && <Statement x={760} y={662} text="key u2 biến mất hoàn toàn" color={INK.good} size={40} o={sp(t, diesAt + 0.4)} />}
      {/* timeline */}
      <div style={{ position: 'absolute', left: 380, top: 888, width: 1160, height: 4, borderRadius: 2, background: 'rgba(110,160,255,0.35)', opacity: vis(t, tombAt) }} />
      <div style={{ position: 'absolute', left: 380, top: 886, width: 1160 * clamp((t >= diesAt ? 1 : t >= s ? 0.5 : t >= tombAt ? 0 : 0) + (t >= s && t < diesAt ? span(t, s, diesAt) * 0.5 : 0)), height: 8, borderRadius: 4, background: HERO, boxShadow: '0 0 14px rgba(77,141,255,0.8)' }} />
      {steps.map((st) => (
        <div key={st.label} style={{ opacity: vis(t, st.at) }}>
          <div style={{ position: 'absolute', left: st.x - 18, top: 872, width: 36, height: 36, borderRadius: 18, background: t >= st.at ? '#ffffff' : INK.cell.empty, boxShadow: '0 0 18px rgba(110,160,255,0.9)' }} />
          <div style={{ position: 'absolute', left: st.x - 260, width: 520, textAlign: 'center', top: 920, fontSize: 30, fontWeight: 700, color: INK.text, whiteSpace: 'nowrap' }}>{st.label}</div>
        </div>
      ))}
      {t >= a3 && t < a4 && <Icon3D name="clock" x={1590} y={400} size={150} t={t} at={a3 + 0.1} />}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 6. summary */

function summary(t: number, c: Cue) {
  return (
    <SoftTheme>
      <SummaryList t={t} cue={c} items={['delete theo tuổi · compact theo key', 'Compaction giữ offset, chỉ để lại lỗ', 'Đủ dirty ratio mới dọn · bỏ qua active', 'Tombstone: value null, giữ thêm 1 ngày']} />
    </SoftTheme>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { hook, retention, policy, cleaner, ratio, tombstone, summary }

/** Key-moment sounds, timed to the same cue offsets the scenes animate on. */
const SFX: Record<string, SceneSfx[]> = {
  hook: [{ kind: 'error', at: (c) => at(c, 2, 0.45) }],
  retention: [{ kind: 'tick', at: (c) => at(c, 0, 0.7) }, { kind: 'tick', at: (c) => at(c, 3, 0.4) }],
  policy: [{ kind: 'tick', at: (c) => at(c, 0, 0.35) }, { kind: 'error', at: (c) => at(c, 4, 0.5) }],
  cleaner: [{ kind: 'tick', at: (c) => at(c, 3, 0.1) }, { kind: 'ding', at: (c) => at(c, 3, 0.9) }],
  ratio: [{ kind: 'ding', at: (c) => at(c, 3, 0.3) + 1.2 }],
  tombstone: [{ kind: 'tick', at: (c) => at(c, 0, 0.6) }, { kind: 'ding', at: (c) => at(c, 3, 0.4) + 0.9 }, { kind: 'tick', at: (c) => at(c, 4, 0.35) }],
}

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const compactionLesson: Lesson = {
  ...compactionScript,
  scenes: compactionScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id], sfx: SFX[s.id] })),
  intro: [
    { kind: 'video', scenes: ['hook'] },
    {
      kind: 'quiz',
      title: 'Quick Quiz',
      questions: [q('Đoán trước khi học: topic lưu hồ sơ theo user_id, service mới cần hồ sơ hiện tại của mọi người. Cách xoá nào đúng nhất?', ['Xoá theo tuổi, 7 ngày', 'Giữ mãi mãi', 'Với mỗi key chỉ giữ bản mới nhất', 'Xoá khi consumer đọc xong'], 2, 'Xoá theo tuổi làm mất người ít sửa hồ sơ; giữ mãi thì phình vô tận. Compaction xoá theo key.')],
    },
  ],
  roadmap: [
    'Chặng 1: Ôn retention.ms và retention.bytes, rồi vì sao dữ liệu trạng thái cần cleanup.policy=compact.',
    'Chặng 2: Log cleaner chia partition thành phần sạch, phần bẩn, active segment; dirty ratio quyết định khi nào dọn.',
    'Chặng 3: Tombstone xoá một key, và delete.retention.ms cho consumer chậm kịp thấy.',
  ],
  sections: [
    {
      id: 'retention-nhanh',
      title: 'Ôn nhanh retention.ms và retention.bytes',
      blocks: [
        { kind: 'video', scenes: ['retention'] },
        {
          kind: 'list',
          items: [
            { title: '`retention.ms`', text: 'Kafka xoá **nguyên segment**, chỉ khi **tin mới nhất** trong segment đã quá hạn. Là **mức sàn**: dữ liệu sống ít nhất chừng đó, thường lâu hơn. Retention **không chờ consumer đọc xong**. (📘 sách, ch.6)' },
            { title: '`retention.bytes`', text: 'mặc định `-1` (không giới hạn); đặt trần dung lượng **cho mỗi partition**, không phải cho cả topic. (📘 sách, ch.2)' },
            { title: 'Đặt cả hai', text: 'hai điều kiện **độc lập**: cái nào vi phạm trước thì xoá trước. Sách khuyên chỉ chọn một loại giới hạn, trừ khi có lý do. (📘 sách, ch.2)' },
          ],
        },
        {
          kind: 'code',
          code: `Topic "clicks": 6 partition, replication factor 3, retention.bytes = 10GB
Một partition tối đa khoảng 10GB (cộng thêm tối đa 1 segment)
Cả topic, một bản:  6 × 10GB = 60GB
Trên toàn cluster:  60GB × 3 bản sao = 180GB đĩa`,
        },
        { kind: 'callout', tone: 'warn', title: 'Tăng partition là tăng tổng dung lượng', text: 'Từ 6 lên 12 partition thì trần một bản thành 12 × 10GB = 120GB, vì mỗi partition mới mang theo trần 10GB của riêng nó. Và vì xoá theo cả segment, `segment.bytes = 1GB` có thể để partition phình đến gần 11GB. (📘 sách, ch.2)' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Topic 12 partition, RF = 3, retention.bytes = 5GB, retention.ms = 7 ngày, dữ liệu vào rất ít. Giới hạn nào đang làm việc?', ['retention.bytes', 'retention.ms', 'Cả hai như nhau', 'Không giới hạn nào'], 1, 'Mỗi partition chỉ nhận khoảng 8MB/ngày, không bao giờ chạm 5GB; dữ liệu bị xoá vì già trước khi kịp to.'),
            q('Vì sao partition đặt retention.bytes = 1GB có thể chiếm gần 2GB trên đĩa?', ['Do replication', 'Kafka chỉ xoá nguyên segment, và chỉ khi xoá xong partition vẫn còn ≥ 1GB', 'Do index', 'Do page cache'], 1, 'Với segment.bytes = 1GB, partition có thể ở mức 1GB cộng gần trọn một segment nữa.'),
          ],
        },
      ],
    },
    {
      id: 'cleanup-policy',
      title: 'cleanup.policy: delete, compact, hay cả hai',
      blocks: [
        { kind: 'p', text: 'Topic `user-profile` lưu hồ sơ, mỗi lần sửa ghi một tin với **key = user_id**. Service mới cần **hồ sơ hiện tại** của mọi người. `retention.ms` = 7 ngày làm mất người ít sửa hồ sơ; giữ mãi thì phình vô tận. Compaction xoá theo **key**: mỗi key chỉ giữ **bản mới nhất**.' },
        { kind: 'video', scenes: ['policy'] },
        {
          kind: 'table',
          head: ['`cleanup.policy`', 'Tin bị xoá khi', 'Dùng cho'],
          rows: [
            ['`delete` (mặc định)', 'Quá tuổi / quá dung lượng', 'Dòng sự kiện: click, log, đơn hàng'],
            ['`compact`', 'Có bản **mới hơn cùng key**', 'Trạng thái mới nhất theo key: hồ sơ, giá, cấu hình'],
            ['`compact,delete`', 'Cả hai điều kiện', 'Trạng thái theo key nhưng không giữ key "chết" quá lâu'],
          ],
        },
        {
          kind: 'code',
          code: `offset  key      value                      sau compaction
0       user-1   {city: "Huế"}              (bị bỏ)
1       user-2   {city: "Đà Nẵng"}          giữ nguyên offset 1
2       user-1   {city: "Hà Nội"}           (bị bỏ)
3       user-1   {city: "Sài Gòn"}          giữ nguyên offset 3`,
        },
        {
          kind: 'list',
          items: [
            { title: 'Offset không đổi, thứ tự giữ nguyên', text: 'chỉ có **lỗ**: offset 0 và 2 biến mất. Đây là lỗ offset thứ hai (lỗ thứ nhất là transaction marker). Không đánh số lại vì offset là **địa chỉ** mọi consumer group đã commit.' },
            { title: 'Mọi tin phải có key', text: 'không key thì không biết "bản mới hơn" là của ai; broker từ chối tin không key ngay lúc producer gửi.' },
            { title: '`compact,delete`', text: 'tin quá `retention.ms` bị xoá **kể cả khi là bản mới nhất** của key. (Sách gọi là "delete.and.compact"; giá trị thật trên 3.9.1 là `compact,delete`.) (📘 sách, ch.6)' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Vì sao topic orders (sự kiện created, paid, shipped theo order_id) không nên dùng compact nếu hạ nguồn cần đếm số lần thanh toán?', ['Compact quá chậm', 'Compaction chỉ giữ tin cuối của mỗi key: created và paid biến mất, chỉ còn shipped', 'Orders không có key', 'Compact không hỗ trợ'], 1, 'Topic sự kiện nên dùng delete.'),
            q('Sau compaction, consumer có committed offset = 2 (tin offset 2 đã bị compact mất). Chuyện gì xảy ra?', ['Báo lỗi offset out of range', 'Đọc tiếp từ tin còn tồn tại có offset nhỏ nhất ≥ 2', 'Quay về đầu topic', 'Mất committed offset'], 1, 'Offset 2 vẫn nằm trong [Log Start Offset, HW); chỉ offset nhỏ hơn Log Start Offset mới rơi vào auto.offset.reset.'),
          ],
        },
      ],
    },
    {
      id: 'log-cleaner',
      title: 'Log cleaner: sạch, bẩn, active',
      blocks: [
        { kind: 'p', text: 'Compaction không xảy ra ngay khi có tin mới. Nhóm luồng nền **log cleaner** (`log.cleaner.threads`, mặc định 1) làm việc đó định kỳ, chỉ trên các segment **đã đóng**.' },
        { kind: 'video', scenes: ['cleaner'] },
        {
          kind: 'list',
          items: [
            { title: 'Phần sạch (clean)', text: 'đã compact ở lần trước: mỗi key một bản.' },
            { title: 'Phần bẩn (dirty)', text: 'ghi sau lần compact trước, có thể chứa nhiều bản của cùng key.' },
            { title: 'Active segment', text: '**không bao giờ bị compact**; cleaner chỉ đụng vào segment đã đóng.' },
          ],
        },
        {
          kind: 'code',
          code: `Phần bẩn: [user-1 v4][user-3 v1][user-1 v5]
Bước 1: đọc phần bẩn, lập bảng "key → offset mới nhất":
        user-1 → offset 12, user-3 → offset 10
Bước 2: chép từng segment (sạch lẫn bẩn) sang file mới,
        tin nào có offset < offset mới nhất của key thì BỎ.
Bước 3: thay segment cũ bằng segment mới (.cleaned → .swap → .log).`,
        },
        { kind: 'video', scenes: ['ratio'] },
        {
          kind: 'code',
          code: `dirty ratio = phần bẩn / (phần sạch + phần bẩn)     (không tính active)

Sạch 600MB, bẩn 400MB → 400 / 1.000 = 0,4
min.cleanable.dirty.ratio = 0,5 (mặc định) → 0,4 < 0,5 → CHƯA dọn
Bẩn lên 700MB → 700 / 1.300 ≈ 0,54 → ĐỦ điều kiện dọn`,
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'Vì sao segment.ms quan trọng với compaction',
          text: 'Active segment không bao giờ được compact. Topic hồ sơ ít dữ liệu, `segment.ms` = 7 ngày → mọi bản cập nhật trong 7 ngày nằm trong active segment, **không được compact**; consumer mới đọc từ đầu vẫn thấy đủ bản cũ. Muốn compact sớm hơn: giảm `segment.ms` (chỉ được kiểm tra khi có tin mới ghi vào). (📘 sách, ch.6)',
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Nâng cao',
          text: '`min.compaction.lag.ms` (mặc định 0): tin phải đủ "già" mới được compact. `max.compaction.lag.ms`: ép compact kể cả khi dirty ratio thấp, hữu ích cho yêu cầu kiểu "dữ liệu xoá phải biến mất trong 30 ngày" (GDPR). Mỗi mục trong offset map chỉ **16 byte băm key + 8 byte offset = 24 byte**: segment 1GB, tin 1KB (khoảng 1 triệu tin) tốn tối đa khoảng 24MB, value to hay nhỏ không ảnh hưởng. (📘 sách, ch.6)',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Topic compacted, mỗi key cập nhật 1.000 lần trong 1 giờ, segment.ms mặc định 7 ngày. Consumer mới đọc từ đầu sau 1 giờ thấy khoảng bao nhiêu bản mỗi key?', ['1 bản', 'Khoảng 1.000 bản, vì tất cả nằm trong active segment chưa được compact', '500 bản', '0 bản'], 1, 'Chưa đủ 7 ngày, chưa đầy 1GB nên chưa roll; active segment không bao giờ được compact.'),
            q('Vì sao không thể nói "topic compacted chỉ chứa đúng một tin cho mỗi key"?', ['Vì mỗi key có hai partition', 'Cleaner chạy định kỳ; phần bẩn và active segment vẫn có thể chứa bản cũ. Chỉ bảo đảm bản mới nhất không bao giờ mất', 'Vì offset đánh số lại', 'Vì tombstone'], 1, 'Consumer phải chịu được việc thấy nhiều bản cùng key (bản sau đè bản trước).'),
            q('Vì sao hạ min.cleanable.dirty.ratio xuống 0,01 không miễn phí?', ['Tốn RAM broker cố định', 'Cleaner chạy gần như liên tục, mỗi lần đọc và chép lại cả phần sạch: tốn I/O và CPU', 'Làm mất tin', 'Làm tăng offset'], 1, 'Mặc định 0,5 cân bằng giữa dung lượng thừa và chi phí dọn.'),
          ],
        },
      ],
    },
    {
      id: 'tombstone',
      title: 'Tombstone: xoá một key',
      blocks: [
        { kind: 'p', text: 'Người dùng `user-2` xoá tài khoản, nhưng trong topic compacted bản mới nhất của họ được giữ **mãi mãi**. Giải pháp: ghi tin **key = `user-2`, value = `null`**, gọi là **tombstone** (bia mộ).' },
        { kind: 'video', scenes: ['tombstone'] },
        {
          kind: 'code',
          code: `t=0            Ghi tombstone: [user-2 → null]
t=+5'          Cleaner chạy: xoá MỌI bản cũ của user-2. Tombstone ĐƯỢC GIỮ LẠI.
               Đánh dấu: "được xoá sau t=+5' + 1 ngày".
t=+1 ngày 5'   Cleaner chạy lần sau: tombstone hết hạn → bị xoá.
               Key user-2 biến mất hoàn toàn khỏi topic.`,
        },
        { kind: 'callout', tone: 'info', title: 'Vì sao không xoá tombstone ngay?', text: 'Consumer giữ **bản sao trạng thái** (cache, bảng DB) cần **đọc thấy** tombstone để xoá `user-2` ở phía mình. `delete.retention.ms` (mặc định 1 ngày) là thời gian cho consumer chậm nhất kịp thấy bia mộ. Consumer tụt lại lâu hơn có thể giữ mãi người dùng đã xoá: khi đó dựng lại cache từ đầu topic, hoặc tăng `delete.retention.ms`.' },
        {
          kind: 'list',
          items: [
            { title: 'Tombstone cần key', text: 'cleaner dựa vào key để biết bỏ những bản cũ nào.' },
            { title: 'Consumer phải hiểu `null`', text: 'value `null` nghĩa là "**xoá key này**", không phải "dữ liệu rỗng".' },
            { title: '`deleteRecords` là cách khác', text: 'AdminClient dời **Log Start Offset** lên offset chỉ định: xoá **mọi tin trước một offset**, không chọn theo key được. Giống xé cả xấp trang đầu sổ, còn tombstone là gạch tên một người. (📘 sách, ch.6)' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Consumer dựng cache từ topic hồ sơ, tắt 3 ngày rồi đọc tiếp từ committed offset (delete.retention.ms mặc định). Cache có thể sai thế nào?', ['Thiếu user mới', 'Giữ mãi người dùng đã xoá, vì tombstone đã bị dọn trước khi nó kịp đọc', 'Trùng user', 'Không sai'], 1, 'Cách sửa: dựng lại cache từ đầu topic, hoặc tăng delete.retention.ms hơn thời gian ngừng tối đa.'),
            q('Muốn xoá dữ liệu user-2 rải rác ở offset 5, 900, 40.000. Vì sao deleteRecords không phù hợp?', ['Quá chậm', 'Nó xoá mọi tin trước một offset, không chọn theo key được', 'Cần tắt cleaner', 'Chỉ chạy trên topic delete'], 1, 'Đúng công cụ là tombstone user-2 → null.'),
          ],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: cleaner, active segment và tombstone',
      blocks: [
        { kind: 'p', text: 'Ghi thêm bản cập nhật, roll segment, ghi tombstone, cho thời gian trôi rồi bấm chạy cleaner. Quan sát dirty ratio, bản cũ nằm lại trong active segment, offset có lỗ, và tombstone bị dọn sau `delete.retention.ms`.' },
        { kind: 'widget', name: 'compaction-lab' },
      ],
    },
    {
      id: 'tom-tat-video',
      title: 'Nhìn lại cả bài',
      blocks: [{ kind: 'video', scenes: ['summary'] }],
    },
  ],
  finalQuiz: [
    q('Khác biệt cốt lõi giữa cleanup.policy=delete và compact?', ['delete nhanh hơn', 'delete xoá theo tuổi/dung lượng, compact xoá khi có bản mới hơn cùng key', 'compact xoá theo consumer', 'Không khác'], 1, 'delete trả lời "đã xảy ra gì gần đây"; compact trả lời "trạng thái hiện tại của mỗi key".'),
    q('Sau compaction, offset của các tin còn lại thay đổi thế nào?', ['Đánh số lại liền mạch', 'Giữ nguyên, chỉ có lỗ', 'Giảm đi một nửa', 'Đảo thứ tự'], 1, 'Offset là địa chỉ mà mọi consumer group đã commit nên không được đổi.'),
    q('Cleaner chọn dọn một partition khi nào?', ['Mỗi khi có tin mới', 'Khi dirty ratio vượt min.cleanable.dirty.ratio', 'Khi consumer đọc xong', 'Khi active segment đầy'], 1, 'Dirty ratio = bẩn / (sạch + bẩn), không tính active segment.'),
    q('Vì sao tombstone không bị xoá ngay sau lần dọn đầu?', ['Quên', 'Consumer chậm cần đọc thấy nó trong delete.retention.ms để xoá key ở phía mình', 'Vì nó nhỏ', 'Vì có index'], 1, 'Nếu bị dọn quá sớm, consumer tụt lại sẽ giữ mãi dữ liệu đã xoá.'),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao một bản cập nhật cũ có thể vẫn còn trong topic compacted dù đã có bản mới hơn? Nêu ít nhất hai lý do.',
      keywords: ['active', 'dirty ratio', 'cleaner', 'min.compaction.lag'],
      modelAnswer: 'Vì compaction chỉ đảm bảo bản mới nhất còn, không đảm bảo bản cũ mất. (a) Bản cũ nằm trong active segment, nơi không bao giờ được compact. (b) Phần bẩn chưa đủ min.cleanable.dirty.ratio nên cleaner chưa chọn partition này. (c) min.compaction.lag.ms chưa hết.',
    },
  ],
  recap: {
    journey:
      'Xoá theo tuổi làm mất người ít sửa hồ sơ, giữ mãi thì phình vô tận → cleanup.policy=compact giữ bản mới nhất của mỗi key, offset không đổi chỉ để lại lỗ → log cleaner chạy nền khi dirty ratio đủ lớn, chia partition thành phần sạch, phần bẩn, và không bao giờ đụng active segment → tombstone (value null) xoá một key và sống thêm delete.retention.ms cho consumer chậm kịp thấy.',
    points: [
      { title: 'delete vs compact', text: 'delete xoá theo tuổi/dung lượng; compact xoá khi có bản mới hơn cùng key; compact,delete áp dụng cả hai.' },
      { title: 'Offset có lỗ', text: 'Compaction không đổi offset hay thứ tự, chỉ bỏ bản cũ.' },
      { title: 'Log cleaner', text: 'Chạy nền khi dirty ratio vượt ngưỡng; active segment không bao giờ được compact, nên segment.ms quyết định bản cũ nằm chờ bao lâu.' },
      { title: 'Tombstone', text: 'Tin key + value null; giữ thêm delete.retention.ms để consumer chậm kịp xoá key ở phía mình.' },
    ],
    next: 'Bài tiếp theo: Khi nào compact & tiered storage (Module 7).',
  },
}
