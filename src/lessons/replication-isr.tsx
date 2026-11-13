import type { CSSProperties, ReactNode } from 'react'
import { cameraAt, clamp, lerp, move, sp, span, vis } from '../player/motion-kit'
import { Envelope, Icon3D, LogTape, Note, Packets, ProducerBox, Rise, SOFT, SOFT_PANEL, ServerUnit, SoftScene, SoftTheme, Statement, SummaryList, type CellState, ConsumerUnit } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene, SceneSfx } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { replicationIsrScript } from './replication-isr-script'

/** This lesson is drawn in the navy glow style. */
const INK = SOFT
const panel = SOFT_PANEL
const WIDE = { x: 960, y: 540, s: 1 }
const CW = 66
const CELLS = 16
const TX = 440
const ROWS = [300, 530, 760]
const cellX = (i: number) => TX + i * CW
/** Lane x inside a tape (middle of a cell that carries no printed offset). */
const LANE = cellX(3) + CW / 2
const PILL: CSSProperties = { background: 'rgba(8,22,82,0.92)', border: '1.5px solid #6ea2ff', boxShadow: '0 0 18px rgba(77,141,255,0.65), inset 0 1px 0 rgba(255,255,255,0.15)', color: '#ffffff', borderRadius: 999 }
/** Smooth 0 -> 1 over `len` seconds starting at `at`. */
const fade = (t: number, at: number, len = 0.4) => span(t, at, at + len)

/**
 * One replica row: server on the left, its log tape on the right. `down` and `dim` are 0..1 factors, so a broker
 * dying or leaving the ISR cross-fades instead of flipping.
 */
function Rep({ y, name, t, state, deadState, down = 0, dim = 0 }: { y: number; name: string; t: number; state: (i: number) => CellState; deadState?: (i: number) => CellState; down?: number; dim?: number }) {
  const k = clamp(down)
  return (
    <div style={{ opacity: 1 - 0.65 * clamp(dim) }}>
      <div style={{ opacity: 1 - k }}>
        <ServerUnit x={120} y={y - 30} name={name} t={t} />
        <LogTape x={TX} y={y} cells={CELLS} cellW={CW} state={state} />
      </div>
      {k > 0 && (
        <div style={{ opacity: k }}>
          <ServerUnit x={120} y={y - 30} name={name} down t={t} />
          <LogTape x={TX} y={y} cells={CELLS} cellW={CW} state={deadState ?? ((i) => (state(i) === 'empty' ? 'empty' : 'dead'))} />
        </div>
      )}
    </div>
  )
}

/** Small role tag next to a server label. */
function Role({ y, text, hero, t, at }: { y: number; text: string; hero?: boolean; t: number; at: number }) {
  return (
    <Rise t={t} at={at}>
      <div style={{ position: 'absolute', left: 262, top: y + 104, ...(hero ? { ...PILL, background: 'linear-gradient(160deg, #6aa8ff, #2f66f2)' } : PILL), padding: '4px 18px', fontSize: 26, fontWeight: 800, whiteSpace: 'nowrap' }}>{text}</div>
    </Rise>
  )
}

/** ISR membership as three chips; `out[k]` (0..1) fades chip k from in-sync (green) to out (red outline). */
function IsrChips({ x, y, t, at, out }: { x: number; y: number; t: number; at: number; out: number[] }) {
  return (
    <Rise t={t} at={at}>
      <div style={{ ...panel, left: x, top: y, width: 320, boxSizing: 'border-box' }}>
        <div style={{ fontSize: 28, color: INK.faint, marginBottom: 12 }}>ISR</div>
        <div style={{ display: 'flex', gap: 16 }}>
          {out.map((o, k) => (
            <div key={k} style={{ position: 'relative', width: 76, height: 76 }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: 38, background: 'linear-gradient(160deg, #7cf0bd, #1fb87a)', boxShadow: '0 0 18px rgba(62,230,160,0.7), inset 0 2px 0 rgba(255,255,255,0.5)', opacity: 1 - clamp(o) }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: 38, border: `3px dashed ${INK.bad}`, boxSizing: 'border-box', opacity: clamp(o) }} />
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 36, fontWeight: 800, color: '#ffffff', opacity: 1 - 0.45 * clamp(o) }}>{k + 1}</div>
            </div>
          ))}
        </div>
      </div>
    </Rise>
  )
}

const Fx = ({ o, children }: { o: number; children: ReactNode }) => (o > 0 ? <div style={{ opacity: clamp(o) }}>{children}</div> : null)

/** Vertical copy lanes between the leader row (middle) and a follower row above / below. */
const upLane = (x: number) => ({ from: { x, y: ROWS[1] - 10 }, to: { x, y: ROWS[0] + 108 } })
const downLane = (x: number) => ({ from: { x, y: ROWS[1] + 106 }, to: { x, y: ROWS[2] - 8 } })

/* ------------------------------------------------------------------ 0. cold open */

function hook(t: number, c: Cue) {
  const [a1, a2] = [c.at(1), c.at(2)]
  const R = ROWS[1]
  const dead = fade(t, a1 + 0.5) * (1 - fade(t, a2 + 0.3))
  const prog = span(t, 0.9, 2.6)
  const filled = Math.floor(lerp(2, 12, prog))
  const own = (i: number): CellState => (i >= filled ? 'empty' : i === filled - 1 && prog < 1 ? 'new' : 'filled')
  const copies = (k: number) => Math.floor(lerp(0, 12, span(t, a2 + 0.8 + k * 0.3, a2 + 2.4 + k * 0.3)))
  const copy = (k: number) => (i: number): CellState => (i < copies(k) ? 'filled' : 'empty')
  const sources = [LANE, cellX(8) + CW / 2]
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, { x: 960, y: 540, s: 1.06 }], [a2 - 0.2, { x: 960, y: 540, s: 1.06 }], [a2 + 0.6, WIDE, 1.4]])}>
      <Rise t={t} at={0.3}>
        <Rep y={R} name="broker-1" t={t} state={own} deadState={(i) => (i < 12 ? 'missing' : 'empty')} down={dead} />
      </Rise>
      <Rise t={t} at={0.5}>
        <ProducerBox x={1540} y={R - 15} line="send(...)" w={300} />
      </Rise>
      <Packets t={t} from={{ x: 1530, y: R + 35 }} to={{ x: cellX(12), y: R + 35 }} start={0.9} end={a1 + 0.2} every={0.28} len={0.7} size={18} />
      <Fx o={fade(t, a1 + 0.5) * (1 - fade(t, a2 - 0.1))}>
        <Icon3D name="fire" x={cellX(8)} y={R - 85} size={130} t={t} at={a1 + 0.5} />
        <Note x={cellX(6)} y={R + 72} dx={-60} dy={90} text="mất toàn bộ partition" color={INK.bad} />
      </Fx>
      {[0, 2].map((r) => (
        <Rise key={r} t={t} at={a2 + 0.4 + r * 0.15}>
          <Rep y={ROWS[r]} name={`broker-${r === 0 ? 2 : 3}`} t={t} state={copy(r / 2)} />
        </Rise>
      ))}
      {sources.map((x) => (
        <div key={x}>
          <Packets t={t} {...upLane(x)} start={a2 + 0.8} end={a2 + 3.4} every={0.4} len={0.6} size={18} />
          <Packets t={t} {...downLane(x)} start={a2 + 1.1} end={a2 + 3.4} every={0.4} len={0.6} size={18} />
        </div>
      ))}
      <Statement x={TX} y={935} text="giữ nhiều bản sao, trên nhiều broker khác nhau" color={INK.accent} size={46} o={sp(t, a2 + 1.4)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 1. leader & followers */

function replicas(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const R = ROWS[1]
  const leo = Math.floor(lerp(8, 12, span(t, a1 + 0.4, a1 + 2.6)))
  const f = [Math.floor(lerp(8, 12, span(t, a2 + 0.6, a2 + 3.4))), leo, Math.floor(lerp(8, 10, span(t, a2 + 1.0, a2 + 3.8)))]
  const names = ['broker-2', 'broker-1', 'broker-3']
  const copyOn = [a2 + 1.2, a2 + 1.6]
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 1000, y: 540, s: 1.05 }, 1.3], [a2, WIDE, 1.3]])} title={{ kicker: 'REPLICATION FACTOR = 3', text: 'Leader và follower' }}>
      {[0, 1, 2].map((r) => (
        <Rise key={r} t={t} at={a0 + 0.4 + r * 1.3}>
          <Rep y={ROWS[r]} name={names[r]} t={t} state={(i) => (i < 8 ? 'filled' : i < f[r] ? 'new' : 'empty')} />
        </Rise>
      ))}
      <Rise t={t} at={a0 + 3.4}>
        <Icon3D name="copy" x={1700} y={330} size={150} t={t} at={a0 + 3.4} />
        <div style={{ ...PILL, position: 'absolute', left: 1700, top: 430, transform: 'translateX(-50%)', padding: '8px 24px', fontSize: 30, fontWeight: 800, whiteSpace: 'nowrap' }}>3 bản · 3 broker</div>
      </Rise>
      <Role y={R} text="LEADER" hero t={t} at={a1} />
      <Role y={ROWS[0]} text="follower" t={t} at={a2} />
      <Role y={ROWS[2]} text="follower" t={t} at={a2 + 0.2} />
      <Rise t={t} at={a1}>
        <ProducerBox x={1540} y={R - 15} line="send(...)" w={300} />
      </Rise>
      <Packets t={t} from={{ x: 1530, y: R + 35 }} to={{ x: cellX(12), y: R + 35 }} start={a1 + 0.2} end={a1 + 2.8} every={0.4} len={0.7} size={18} />
      <Note x={cellX(10) + CW / 2} y={R - 4} dx={-60} dy={-85} text="chỉ ghi vào leader" color={INK.accent} o={vis(t, a1 + 0.6, a2 - 0.2)} />
      <Envelope t={t} at={a2 + 0.3} from={{ x: LANE, y: ROWS[0] + 108 }} to={{ x: LANE, y: R - 10 }} label="fetch từ 8" color={INK.warn} arc={0} />
      <Envelope t={t} at={a2 + 0.7} from={{ x: LANE, y: ROWS[2] - 8 }} to={{ x: LANE, y: R + 106 }} label="fetch từ 8" color={INK.warn} arc={0} />
      <Packets t={t} {...upLane(LANE)} start={copyOn[0]} every={0.45} len={0.7} size={18} />
      <Packets t={t} {...downLane(LANE)} start={copyOn[1]} every={0.45} len={0.7} size={18} />
      <Note x={cellX(12) + CW / 2} y={ROWS[2] + 72} dx={-60} dy={110} text="follower tự kéo, như một consumer" color={INK.warn} o={vis(t, a2 + 1.0, a3 - 0.1)} />
      <Envelope t={t} at={a3 + 0.3} from={{ x: cellX(9) + CW / 2, y: ROWS[2] - 8 }} to={{ x: cellX(9) + CW / 2, y: R + 106 }} label="xin từ 10" color={INK.warn} arc={0} />
      <Envelope t={t} at={a3 + 1.5} from={{ x: cellX(7) + CW / 2, y: ROWS[0] + 108 }} to={{ x: cellX(7) + CW / 2, y: R - 10 }} label="xin từ 12" color={INK.warn} arc={0} />
      <Note x={cellX(10)} y={R + 72} dx={-40} dy={118} text="broker-3 đã có mọi tin < 10" color={INK.text} o={vis(t, a3 + 1.0)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 2. ISR */

function isr(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const R = ROWS[1]
  const leoAt = (tt: number) => lerp(9, 14, span(tt, a0, c.duration))
  const leo = Math.floor(leoAt(t))
  const stall = leoAt(a1)
  const f3 = Math.floor(t < a1 ? leoAt(t) : t < a2 + 0.1 ? stall : lerp(stall, leoAt(t), span(t, a2 + 0.1, a2 + 1.4)))
  // snap the counter so exported frames do not smear it
  const ts = Math.floor(t * 6) / 6
  const lag = Math.round(ts < a2 + 0.1 ? lerp(0, 35, span(ts, a1 + 0.2, a1 + 3.6)) : lerp(35, 0, span(ts, a2 + 0.1, a2 + 1.4)))
  const out = fade(t, a1 + 3.6) * (1 - fade(t, a2 + 1.0))
  const clockO = fade(t, a1 + 0.1) * (1 - fade(t, a1 + 3.6))
  const downO = fade(t, a1 + 3.6) * (1 - fade(t, a2 + 0.9, 0.3))
  const upO = fade(t, a2 + 1.2)
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1 + 0.2, { x: 980, y: 600, s: 1.05 }, 1.3], [a2 + 0.4, WIDE, 1.3]])} title={{ kicker: 'IN-SYNC REPLICAS', text: 'ISR: ai đang theo kịp?' }}>
      <Rise t={t} at={a0 + 0.2}>
        <Rep y={ROWS[0]} name="broker-2" t={t} state={(i) => (i < 9 ? 'filled' : i < leo ? 'new' : 'empty')} />
      </Rise>
      <Rise t={t} at={a0 + 0.4}>
        <Rep y={R} name="broker-1 · leader" t={t} state={(i) => (i < 9 ? 'filled' : i < leo ? 'new' : 'empty')} />
      </Rise>
      <Rise t={t} at={a0 + 0.6}>
        <Rep y={ROWS[2]} name="broker-3" t={t} dim={out} state={(i) => (i < 9 ? 'filled' : i < f3 ? 'new' : i < leo ? 'missing' : 'empty')} />
      </Rise>
      <Packets t={t} {...upLane(LANE)} start={a0 + 0.9} every={0.5} len={0.7} size={18} />
      <Packets t={t} {...downLane(LANE)} start={a0 + 0.9} end={a1 + 0.1} every={0.5} len={0.7} size={18} />
      <Packets t={t} {...downLane(LANE)} start={a2 + 0.2} every={0.35} len={0.6} size={18} />
      <IsrChips x={1540} y={250} t={t} at={a0 + 0.4} out={[0, 0, out]} />
      <Fx o={clockO}>
        <Icon3D name="clock" x={1700} y={520} size={150} t={t} at={a1 + 0.1} />
      </Fx>
      <Fx o={downO}>
        <Icon3D name="thumb-down" x={1700} y={520} size={150} t={t} at={a1 + 3.6} />
      </Fx>
      <Fx o={upO}>
        <Icon3D name="thumb-up" x={1700} y={520} size={150} t={t} at={a2 + 1.2} />
      </Fx>
      <div style={{ ...panel, left: 1540, top: 660, width: 320, boxSizing: 'border-box', opacity: fade(t, a1 + 0.2), color: INK.warn, fontVariantNumeric: 'tabular-nums' }}>chậm {lag} s</div>
      <Note x={cellX(9) + CW / 2} y={ROWS[2] + 72} dx={-80} dy={120} text="quá 30 giây chưa đuổi kịp → loại khỏi ISR" color={INK.warn} o={vis(t, a1 + 1.0, a2 - 0.1)} />
      <Note x={cellX(13) + CW / 2} y={ROWS[2] + 72} dx={-80} dy={120} text="đuổi kịp → thêm lại vào ISR" color={INK.good} o={vis(t, a2 + 1.2)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 3. high watermark */

function hw(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const RW = [280, 470, 660]
  const f2 = lerp(6, 9, span(t, a3 + 0.3, a3 + 1.8))
  const leos = [8, 10, Math.floor(f2)]
  const hwF = Math.min(8, 10, f2)
  const hwI = Math.floor(hwF)
  const zoneO = fade(t, a1 + 0.4, 0.5)
  const names = ['follower 1', 'leader', 'follower 2']
  const lineX = lerp(cellX(10), cellX(hwF), move(t, a1 + 0.6, 1.8))
  const tok = (at: number) => ({ opacity: fade(t, at, 0.3) })
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a2, { x: 960, y: 590, s: 1.05 }, 1.3], [a3 + 2.0, WIDE, 1.3]])} title={{ kicker: 'HIGH WATERMARK', text: 'Đọc được tới đâu?' }}>
      {RW.map((y, r) => (
        <Rise key={r} t={t} at={a0 + 0.2 + r * 0.45}>
          <ServerUnit x={120} y={y - 30} name={names[r]} t={t} />
          <LogTape x={TX} y={y} cells={CELLS} cellW={CW} state={(i) => (i < leos[r] ? 'filled' : 'empty')} />
          <div style={{ position: 'absolute', left: 1530, top: y + 6, ...PILL, padding: '8px 22px', fontSize: 30, fontWeight: 800, color: INK.accent, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>LEO {leos[r]}</div>
        </Rise>
      ))}
      {/* the uncommitted zone: cells between the HW and each LEO */}
      <div style={{ opacity: zoneO }}>
        {RW.map((y, r) => {
          const w = (r === 1 ? 10 : r === 0 ? 8 : f2) - lineX / CW + TX / CW
          return w > 0.05 ? <div key={r} style={{ position: 'absolute', left: lineX, top: y - 4, width: w * CW, height: 78, boxSizing: 'border-box', borderRadius: 14, border: `2px dashed ${INK.warn}`, background: 'rgba(255,181,71,0.26)' }} /> : null
        })}
        <div style={{ position: 'absolute', left: lineX - 2, top: RW[0] - 18, width: 4, height: RW[2] - RW[0] + 108, borderRadius: 2, background: INK.good, boxShadow: `0 0 18px ${INK.good}` }} />
        <div style={{ position: 'absolute', left: lineX, top: RW[0] - 78, transform: 'translateX(-50%)', ...PILL, padding: '6px 20px', fontSize: 28, fontWeight: 800, color: INK.good, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>HW<span style={tok(a1 + 2.6)}> {hwI}</span></div>
      </div>
      <div style={{ ...panel, left: 120, top: 830, color: INK.good, fontFamily: MONO, fontSize: 32, opacity: fade(t, a1 + 0.3), fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>HW = min(<span style={tok(a1 + 0.8)}>10</span>, <span style={tok(a1 + 1.4)}>8</span>, <span style={tok(a1 + 2.0)}>{leos[2]}</span>)<span style={tok(a1 + 2.8)}> = {hwI}</span></div>
      <Rise t={t} at={a2}>
        <ConsumerUnit x={820} y={800} w={420} name="consumer" note={`đọc tới ${hwI}`} t={t} />
      </Rise>
      <Packets t={t} from={{ x: lineX - CW / 2, y: RW[2] + 108 }} to={{ x: 1030, y: 794 }} start={a2 + 0.5} every={0.4} len={0.7} size={18} />
      <Fx o={fade(t, a2 + 0.6) * (1 - fade(t, a3))}>
        <Icon3D name="lock" x={1420} y={850} size={120} t={t} at={a2 + 0.6} />
      </Fx>
      <Statement x={120} y={970} text="vùng vàng: chưa có ở mọi bản ISR → chưa cho đọc" color={INK.warn} size={36} o={Math.min(sp(t, a2 + 0.6), vis(t, 0, a3))} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 4. min.insync.replicas */

function minisr(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const R = ROWS[1]
  const fd = fade(t, a0 + 2.2)
  const ld = fade(t, a1 + 1.0)
  const wroteX = t >= a0 + 4.0
  const phaseA = 1 - fade(t, a2 - 0.5)
  const rows: [string, string, string][] = [
    ['3 broker sống', 'ISR = 3', 'ghi được ✓'],
    ['2 broker sống', 'ISR = 2', 'ghi được ✓'],
    ['1 broker sống', 'ISR = 1', 'NOT_ENOUGH_REPLICAS ✗'],
  ]
  const follower = (i: number): CellState => (i < 9 ? 'filled' : 'empty')
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1 + 0.4, { x: 960, y: 560, s: 1.05 }, 1.3], [a2 - 0.4, WIDE, 1.3]])} title={{ kicker: 'ACKS = ALL', text: 'Khi ISR chỉ còn một' }}>
      <Fx o={phaseA}>
        <Rise t={t} at={0.3}>
          <Rep y={ROWS[0]} name="broker-2" t={t} state={follower} down={fd} />
        </Rise>
        <Rise t={t} at={0.5}>
          <Rep y={R} name="broker-1 · leader" t={t} down={ld} state={(i) => (i < 9 ? 'filled' : i === 9 && wroteX ? 'new' : 'empty')} deadState={(i) => (i < 9 ? 'dead' : i === 9 && wroteX ? 'missing' : 'empty')} />
        </Rise>
        <Rise t={t} at={0.7}>
          <Rep y={ROWS[2]} name="broker-3" t={t} state={follower} down={fd} />
        </Rise>
        <Rise t={t} at={0.6}>
          <ProducerBox x={1540} y={R - 15} line="send(X)" w={300} />
        </Rise>
        <IsrChips x={1540} y={250} t={t} at={0.5} out={[0, fd, fd]} />
        <Packets t={t} {...upLane(LANE)} start={0.9} end={a0 + 2.4} every={0.5} len={0.7} size={18} />
        <Packets t={t} {...downLane(LANE)} start={0.9} end={a0 + 2.4} every={0.5} len={0.7} size={18} />
        <Envelope t={t} at={a0 + 3.2} from={{ x: 1530, y: R + 35 }} to={{ x: cellX(9) + CW / 2, y: R + 35 }} label="X · acks=all" arc={60} len={0.9} />
        <Envelope t={t} at={a0 + 4.4} from={{ x: cellX(9) + CW / 2, y: R + 35 }} to={{ x: 1530, y: R + 35 }} label="OK ✓" color={INK.good} arc={60} len={0.8} />
        <Note x={cellX(9) + CW / 2} y={R + 72} dx={-60} dy={90} text={'"mọi bản ISR" = 1 bản → OK'} color={INK.warn} o={vis(t, a0 + 4.6, a1 + 0.6)} />
        <Fx o={ld}>
          <Icon3D name="fire" x={cellX(9) + CW / 2} y={R - 85} size={130} t={t} at={a1 + 1.0} />
          <Note x={cellX(9) + CW / 2} y={R + 72} dx={-60} dy={90} text="tin X mất — dù đã báo OK" color={INK.bad} o={fade(t, a1 + 1.2)} />
        </Fx>
      </Fx>
      <Rise t={t} at={a2}>
        <div style={{ ...panel, left: 960, top: 200, transform: 'translateX(-50%)', fontFamily: MONO, fontSize: 32, whiteSpace: 'nowrap' }}>
          {['replication.factor = 3', 'min.insync.replicas = 2', 'acks = all'].map((term, k) => {
            const lit = span(t, a3 + 0.4 + k * 1.5, a3 + 0.8 + k * 1.5)
            return (
              <span key={term}>
                {k > 0 && <span style={{ color: INK.faint }}> · </span>}
                <span style={{ color: lit > 0.5 ? '#ffffff' : INK.faint, textShadow: `0 0 ${lit * 22}px rgba(120,176,255,${lit})` }}>{term}</span>
              </span>
            )
          })}
        </div>
      </Rise>
      {rows.map(([a, b, r], k) => {
        const bad = k === 2
        const at = a2 + 0.8 + k * 0.9
        return (
          <Rise key={a} t={t} at={at}>
            <div style={{ ...panel, left: 210, top: 330 + k * 150, width: 1500, height: 120, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 40, padding: '0 40px', fontSize: 40, ...(bad ? { border: `2px solid ${INK.bad}`, boxShadow: `0 0 ${24 + 14 * Math.sin(t * 4)}px rgba(255,90,106,0.5), 0 24px 50px rgba(0,4,30,0.55)` } : {}) }}>
              <span style={{ width: 360 }}>{a}</span>
              <span style={{ width: 240, fontFamily: MONO, fontSize: 36, color: INK.faint }}>{b}</span>
              <span style={{ fontFamily: MONO, fontSize: 36, color: bad ? INK.bad : INK.good }}>{r}</span>
              <Icon3D name={bad ? 'lock' : 'tick'} x={1410} y={60} size={96} t={t} at={at + 0.2} />
            </div>
          </Rise>
        )
      })}
      <Statement x={300} y={830} text="mọi tin đã OK đều nằm trên ít nhất 2 máy" color={INK.accent} o={sp(t, a3 + 0.4)} />
    </SoftScene>
  )
}

function summary(t: number, c: Cue) {
  return (
    <SoftTheme>
      <SummaryList t={t} cue={c} items={['Một leader nhận ghi · follower tự kéo về', 'ISR = bản đang theo kịp · tụt > 30 s bị loại', 'HW = LEO nhỏ nhất trong ISR · consumer đọc tới HW', 'acks=all + min.insync.replicas=2']} />
    </SoftTheme>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { hook, replicas, isr, hw, minisr, summary }

/** Key-moment sounds, timed to the same cue offsets the scenes animate on. */
const SFX: Record<string, SceneSfx[]> = {
  hook: [{ kind: 'error', at: (c) => c.at(1) + 0.5 }],
  isr: [
    { kind: 'error', at: (c) => c.at(1) + 3.6 },
    { kind: 'ding', at: (c) => c.at(2) + 1.2 },
  ],
  minisr: [
    { kind: 'error', at: (c) => c.at(1) + 1.0 },
    { kind: 'error', at: (c) => c.at(2) + 2.0 },
  ],
}

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const replicationIsrLesson: Lesson = {
  ...replicationIsrScript,
  scenes: replicationIsrScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id], sfx: SFX[s.id] })),
  intro: [
    { kind: 'video', scenes: ['hook'] },
    {
      kind: 'quiz',
      title: 'Quick Quiz',
      questions: [q('Đoán trước khi học: với replication.factor = 3, chịu được mất tối đa bao nhiêu broker mà vẫn còn dữ liệu?', ['0', '1', '2', '3'], 2, 'RF tính cả leader: 3 bản, mất 2 vẫn còn 1. Nhưng còn ghi được không thì phụ thuộc min.insync.replicas (phần 4).')],
    },
  ],
  roadmap: [
    'Chặng 1: Leader và follower — ai nhận ghi, follower chép thế nào.',
    'Chặng 2: ISR và High Watermark — ai đáng tin, consumer được đọc tới đâu.',
    'Chặng 3: acks=all + min.insync.replicas — công thức bền vững, và tự tay thử.',
  ],
  sections: [
    {
      id: 'leader-follower',
      title: 'Leader và follower',
      blocks: [
        { kind: 'video', scenes: ['replicas'] },
        {
          kind: 'code',
          code: '            Broker 1        Broker 2        Broker 3\nP0          follower        follower        LEADER\nP1          LEADER          follower        follower\nP2          follower        LEADER          follower',
        },
        {
          kind: 'list',
          items: [
            { title: 'RF tính cả leader', text: '`replication.factor = 3` = 1 leader + 2 follower; RF không thể lớn hơn số broker.' },
            { title: 'Chỉ leader nhận ghi', text: 'Một người ghi thì thứ tự tự động đúng; nhiều nơi cùng ghi sẽ phải giải quyết xung đột.' },
            { title: 'Follower kéo, leader không đẩy', text: 'Follower gửi fetch "từ offset X" giống consumer; nhờ đó leader biết follower đã có mọi tin trước X.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Leader biết follower đã chép tới đâu bằng cách nào?', ['Follower gửi xác nhận riêng', 'Qua offset follower xin trong mỗi lần fetch', 'ZooKeeper báo', 'Leader tự đoán'], 1, 'Follower xin "từ offset X" nghĩa là đã có mọi tin trước X.')],
        },
      ],
    },
    {
      id: 'isr',
      title: 'ISR: những bản đang theo kịp',
      blocks: [
        { kind: 'video', scenes: ['isr'] },
        {
          kind: 'table',
          head: ['Thời điểm', 'Broker 2', 'Broker 3', 'ISR'],
          rows: [
            ['0 giây', 'đuổi kịp', 'đuổi kịp', '{1, 2, 3}'],
            ['5 giây', 'đuổi kịp', 'mạng chập, ngừng fetch', '{1, 2, 3}'],
            ['35 giây', 'đuổi kịp', 'vẫn chưa đuổi kịp', '**{1, 2}**'],
            ['60 giây', 'đuổi kịp', 'đã đuổi kịp', '**{1, 2, 3}**'],
          ],
        },
        {
          kind: 'callout',
          tone: 'info',
          text: 'Ngưỡng là `replica.lag.time.max.ms` (mặc định **30 giây** từ Kafka 2.5). Đo bằng **thời gian**, không bằng số tin: khi lưu lượng tăng đột biến, đo bằng số tin sẽ đá oan mọi follower.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Vì sao leader không chờ follower chậm?', ['Vì follower chậm vô dụng', 'Vì một máy chậm sẽ làm cả partition chậm theo; follower chậm bị loại khỏi ISR', 'Vì follower tự xoá', 'Vì consumer không đọc follower'], 1, 'Giữ follower chậm trong ISR thì producer acks=all và consumer đều phải chờ nó.')],
        },
      ],
    },
    {
      id: 'high-watermark',
      title: 'High Watermark: consumer đọc được tới đâu',
      blocks: [
        {
          kind: 'quiz',
          title: 'Dự đoán trước khi xem',
          questions: [q('Leader LEO = 10, hai follower trong ISR có LEO 8 và 6. Consumer đọc được tới đâu?', ['10', '8', '6', '0'], 2, 'HW là LEO nhỏ nhất trong ISR. Xem video để thấy vì sao.')],
        },
        { kind: 'video', scenes: ['hw'] },
        {
          kind: 'code',
          code: 'Leader:  [0][1][2][3][4][5][6][7][8][9]     LEO = 10\nF1:      [0][1][2][3][4][5][6][7]           LEO = 8\nF2:      [0][1][2][3][4][5]                 LEO = 6\n                               ▲\n                             HW = min(10, 8, 6) = 6',
        },
        {
          kind: 'list',
          items: [
            { title: 'Đã commit', text: 'Tin dưới HW có trên mọi bản ISR — Kafka hứa không mất chừng nào còn một bản ISR sống.' },
            { title: 'Loại follower chậm', text: 'HW nhảy lên ngay, vì tập để lấy "nhỏ nhất" bớt người chậm.' },
            { title: 'Follower biết HW chậm một nhịp', text: 'HW đi kèm câu trả lời fetch — mầm mống của lỗi ở bài bầu leader.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Follower LEO 6 bị loại khỏi ISR. HW mới là?', ['6', '8', '10', 'không đổi'], 1, 'min(10, 8) = 8.')],
        },
      ],
    },
    {
      id: 'min-isr',
      title: 'acks=all + min.insync.replicas',
      blocks: [
        { kind: 'video', scenes: ['minisr'] },
        {
          kind: 'table',
          head: ['Broker còn sống', 'ISR', 'Ghi acks=all', 'Lời hứa'],
          rows: [
            ['3', '3', '✅ được', 'tin nằm ở ≥ 2 máy'],
            ['2', '2', '✅ được', 'tin nằm ở ≥ 2 máy'],
            ['1', '1', '❌ `NOT_ENOUGH_REPLICAS`', 'không ghi → không có gì để mất'],
          ],
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Ngân hàng cần 2 chữ ký',
          text: '`min.insync.replicas = 2` giống quy định rút tiền cần 2 người duyệt: hôm nay chỉ còn 1 người đi làm thì **thà đóng quầy** còn hơn cho rút với 1 chữ ký. minISR càng cao càng an toàn nhưng càng dễ ngừng nhận ghi (RF 3, minISR 3: mất 1 broker là không ghi được).',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('RF = 3, min.insync.replicas = 2, acks = all. Hai follower chết. Producer gửi tin thì sao?', ['Ghi bình thường', 'Bị từ chối: NOT_ENOUGH_REPLICAS', 'Ghi vào follower', 'Ghi nhưng không báo'], 1, 'ISR = 1 < 2 nên leader từ chối, đổi lại không có tin nào được báo OK mà chỉ nằm trên 1 máy.')],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: tính High Watermark',
      blocks: [
        { kind: 'p', text: 'Kéo LEO của từng bản sao và bật/tắt bản nào nằm trong ISR. **Đoán trước**: loại follower chậm nhất khỏi ISR thì HW tăng hay giảm?' },
        { kind: 'widget', name: 'hw-lab' },
      ],
    },
    {
      id: 'tom-tat-video',
      title: 'Nhìn lại cả bài',
      blocks: [{ kind: 'video', scenes: ['summary'] }],
    },
  ],
  finalQuiz: [
    q('RF = 3 nghĩa là gì?', ['3 leader', '1 leader + 2 follower, trên 3 broker khác nhau', '3 partition', '3 consumer'], 1, 'RF tính cả leader.'),
    q('Follower bị loại khỏi ISR khi nào (mặc định)?', ['Chậm hơn 1.000 tin', 'Không đuổi kịp leader trong 30 giây', 'Khi consumer lag cao', 'Khi đĩa đầy 80%'], 1, 'replica.lag.time.max.ms = 30 s.'),
    q('Vì sao consumer chỉ được đọc tới HW?', ['Để tiết kiệm băng thông', 'Vì tin trên HW chưa có ở mọi bản ISR, có thể biến mất nếu leader chết', 'Vì follower chưa nén', 'Vì offset chưa commit'], 1, 'Kafka không cho đọc tin có thể "biến mất".'),
    q('acks=all mà không đặt min.insync.replicas (mặc định 1). Rủi ro?', ['Không có', 'ISR co còn leader, "all" chỉ là 1 bản → leader chết là mất tin đã OK', 'Không ghi được', 'Trùng tin'], 1, 'Cần minISR = 2 để mọi tin OK nằm trên ít nhất 2 máy.'),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao HW bằng LEO nhỏ nhất trong ISR?',
      keywords: ['ISR', 'leader chết', 'mọi bản', 'mất'],
      modelAnswer:
        'Vì khi leader chết, một bản bất kỳ trong ISR có thể lên thay. Chỉ những tin có ở mọi bản trong ISR mới chắc chắn còn sau khi đổi leader, nên Kafka chỉ cho đọc tới LEO nhỏ nhất trong ISR. Đọc quá đó, consumer có thể thấy tin rồi tin lại biến mất.',
    },
  ],
  recap: {
    journey:
      'Một ổ đĩa hỏng là mất partition → giữ nhiều bản sao, một leader nhận ghi, follower tự kéo → ISR là những bản theo kịp → HW = LEO nhỏ nhất trong ISR, consumer đọc tới đó → acks=all phải đi cùng min.insync.replicas = 2.',
    points: [
      { title: 'Leader / follower', text: 'Chỉ leader nhận ghi; follower fetch như consumer.' },
      { title: 'ISR', text: 'Bản theo kịp; chậm quá 30 s bị loại, đuổi kịp được thêm lại.' },
      { title: 'High Watermark', text: 'LEO nhỏ nhất trong ISR; tin dưới HW là đã commit.' },
      { title: 'Công thức bền vững', text: 'RF 3 · min.insync.replicas 2 · acks all.' },
    ],
    next: 'Bài tiếp theo: Leader chết — bầu leader mới, unclean election và leader epoch.',
  },
}
