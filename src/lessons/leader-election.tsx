import type { ReactNode } from 'react'
import { cameraAt, clamp, lerp, move, sp, span, vis } from '../player/motion-kit'
import { Envelope, Icon3D, LogTape, Note, Packets, Rise, SOFT, SOFT_PANEL, ServerUnit, SoftScene, SoftTheme, Statement, SummaryList, Wire, type CellState } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene, SceneSfx } from '../player/types'
import { leaderElectionScript } from './leader-election-script'

/** This lesson is drawn in the navy glow style. */
const INK = SOFT
const panel = SOFT_PANEL
const WIDE = { x: 960, y: 540, s: 1 }

/** Replica rows: server on the left, its copy of the log as a tape on the right, readouts in the right column. */
const CW = 66
const CELLS = 14
const TX = 420
const ROWS = [290, 510, 730]
const cellX = (i: number) => TX + i * CW
const FADE = 0.35

/* ---------------------------------------------------------------- cross-fade helpers (no boolean flips) */

/** A cell that fades from state `a` to state `b`; the third value is the weight of `b`. */
type Blend = [CellState, CellState, number]
const still = (s: CellState): Blend => [s, s, 0]

/** Cell state over time: moves through `states` one step at each of `times`, cross-fading over FADE seconds. */
function chain(t: number, times: number[], states: CellState[]): Blend {
  for (let j = 0; j < times.length; j++) if (t < times[j] + FADE) return [states[j], states[j + 1], span(t, times[j], times[j] + FADE)]
  return still(states[states.length - 1])
}

/** Weight of state k when a value steps through states at `times`. */
const xf = (t: number, times: number[], k: number) => (k > 0 ? span(t, times[k - 1], times[k - 1] + FADE) : 1) - (k < times.length ? span(t, times[k], times[k] + FADE) : 0)

/** Stack alternatives in one grid cell and cross-fade between them. */
function Swap({ t, times, items }: { t: number; times: number[]; items: ReactNode[] }) {
  return (
    <div style={{ display: 'grid', justifyItems: 'center' }}>
      {items.map((it, k) => (
        <div key={k} style={{ gridArea: '1 / 1', opacity: clamp(xf(t, times, k)) }}>
          {it}
        </div>
      ))}
    </div>
  )
}

/** A log tape whose cells cross-fade between states instead of flipping. */
function FadeTape({ x, y, cells = CELLS, cellW = CW, state }: { x: number; y: number; cells?: number; cellW?: number; state: (i: number) => Blend }) {
  const bl = Array.from({ length: cells }, (_, i) => state(i))
  const mid = (b: Blend) => b[2] > 0.002 && b[2] < 0.998
  return (
    <>
      <LogTape x={x} y={y} cells={cells} cellW={cellW} state={(i) => (mid(bl[i]) ? 'empty' : bl[i][2] >= 0.998 ? bl[i][1] : bl[i][0])} />
      {bl.map((b, i) =>
        mid(b) ? (
          <div key={i}>
            <div style={{ opacity: 1 - b[2] }}>
              <LogTape x={x + i * cellW} y={y} cells={1} cellW={cellW} tick={0} state={() => b[0]} />
            </div>
            <div style={{ opacity: b[2] }}>
              <LogTape x={x + i * cellW} y={y} cells={1} cellW={cellW} tick={0} state={() => b[1]} />
            </div>
          </div>
        ) : null,
      )}
    </>
  )
}

type Mark = { at: number; label: string; color?: string; o?: number }
type Role = { text: string; color: string; o: number }

function RolePill({ x, y, text, color, o }: { x: number; y: number } & Role) {
  if (o <= 0.002) return null
  return <div style={{ position: 'absolute', left: x, top: y, padding: '6px 18px', borderRadius: 999, background: 'rgba(8,22,82,0.92)', border: `1.5px solid ${color}`, boxShadow: `0 0 16px ${color}88`, fontSize: 24, fontWeight: 800, color, whiteSpace: 'nowrap', opacity: clamp(o) }}>{text}</div>
}

/**
 * One replica: server + tape. `d` cross-fades server and tape to the dead look, `ring` draws a glowing outline
 * (the new leader), `dim` fades the whole row back, `roles` are pills beside the server name.
 */
function BrokerRow({ t, y, name, nameDown, d = 0, dim = 0, ring = 0, pulse = false, roles = [], state, marks = [], tapeDies = true }: { t: number; y: number; name: string; nameDown?: string; d?: number; dim?: number; ring?: number; pulse?: boolean; roles?: Role[]; state: (i: number) => Blend; marks?: Mark[]; tapeDies?: boolean }) {
  const ringO = ring * (pulse ? 0.7 + 0.3 * Math.sin(t * 3) : 1)
  const st = (i: number): Blend => {
    const b = state(i)
    if (!tapeDies || d <= 0.002) return b
    const cur = b[2] < 0.5 ? b[0] : b[1]
    return cur === 'empty' || cur === 'missing' ? b : [cur, 'dead', d]
  }
  return (
    <div style={{ opacity: 1 - 0.65 * clamp(dim) }}>
      {ringO > 0.002 && <div style={{ position: 'absolute', left: 90, top: y - 40, width: 280, height: 150, borderRadius: 36, border: `4px solid ${INK.warn}`, boxShadow: `0 0 28px ${INK.warn}aa`, opacity: clamp(ringO) }} />}
      {d < 0.998 && (
        <div style={{ opacity: 1 - d }}>
          <ServerUnit x={100} y={y - 30} name={name} t={t} />
        </div>
      )}
      {d > 0.002 && (
        <div style={{ opacity: d }}>
          <ServerUnit x={100} y={y - 30} name={nameDown ?? `${name} ✕`} down t={t} />
        </div>
      )}
      {roles.map((r) => (
        <RolePill key={r.text} x={300} y={y + 112} {...r} />
      ))}
      <FadeTape x={TX} y={y} state={st} />
      {marks.map((m) => (
        <div key={m.label.replace(/\d+/g, '')} style={{ opacity: clamp(m.o ?? 1) }}>
          <LogTape x={TX} y={y} cells={0} cellW={CW} state={() => 'empty'} marks={[{ at: m.at, label: m.label, color: m.color }]} />
        </div>
      ))}
    </div>
  )
}

/** Bracket over a run of cells with a label above. */
function Bracket({ x1, x2, y, text, color, o = 1, below = false }: { x1: number; x2: number; y: number; text: string; color: string; o?: number; below?: boolean }) {
  const edge = `3px solid ${color}`
  return (
    <div style={{ opacity: clamp(o) }}>
      <div style={{ position: 'absolute', left: x1, top: y, width: x2 - x1, height: 14, ...(below ? { borderBottom: edge } : { borderTop: edge }), borderLeft: edge, borderRight: edge }} />
      <div style={{ position: 'absolute', left: x1 - 200, width: x2 - x1 + 400, top: below ? y + 24 : y - 46, textAlign: 'center', fontSize: 28, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{text}</div>
    </div>
  )
}

/** Readout card in the right column. */
const readout = (top: number, w = 340) => ({ ...panel, left: 1480, top, width: w, boxSizing: 'border-box' as const, textAlign: 'center' as const })
const num = { fontVariantNumeric: 'tabular-nums' as const }

/* ------------------------------------------------------------------ 0. cold open: ISR empties out */

function hook(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const d0 = c.end(0) - a0
  const d1 = c.end(1) - a1
  const T3 = a0 + d0 * 0.55
  const T2 = a1 + 0.2
  const T1 = a1 + d1 * 0.55
  const times = [T3, T2, T1]
  const slow = span(t, T3, T3 + 0.4)
  const focus = span(t, a2, a2 + 0.4)
  const clocks = ['10:00', '10:01', '10:02', '10:03']
  const isrs: [string, string][] = [['{1, 2, 3}', INK.good], ['{1, 2}', INK.warn], ['{1}', INK.warn], ['{ }', INK.bad]]
  const bus = (x: number, row: number) => ({ from: { x, y: ROWS[0] + 35 }, to: { x, y: ROWS[row] + 35 } })
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a2, { x: 960, y: 600, s: 1.05 }, 1.4], [a2 + 3, { x: 960, y: 620, s: 1.09 }, 4]])}>
      <Rise t={t} at={0.3}>
        <div style={readout(250)}>
          <div style={{ ...num, fontSize: 64, fontWeight: 800, letterSpacing: -1 }}>
            <Swap t={t} times={times} items={clocks.map((s) => s)} />
          </div>
          <div style={{ ...num, fontSize: 34, marginTop: 6, fontFamily: undefined }}>
            <Swap t={t} times={times} items={isrs.map(([s, col]) => <span style={{ color: col }}>ISR = {s}</span>)} />
          </div>
        </div>
      </Rise>
      {[1, 2].map((r) => (
        <div key={r}>
          <Wire {...bus(1372 + (r - 1) * 48, r)} color={INK.line} p={move(t, 0.8, 0.5)} flow={t} />
          <Packets t={t} {...bus(1372 + (r - 1) * 48, r)} start={1.2 + r * 0.1} end={r === 1 ? T2 : T3} every={0.4} len={0.8} size={18} />
        </div>
      ))}
      <Rise t={t} at={0.2}>
        <BrokerRow t={t} y={ROWS[0]} name="broker-1" d={span(t, T1, T1 + 0.4)} roles={[{ text: 'leader', color: INK.accent, o: 1 - span(t, T1, T1 + 0.4) }]} state={(i) => still(i < 13 ? 'filled' : 'empty')} />
      </Rise>
      <Rise t={t} at={0.4}>
        <BrokerRow t={t} y={ROWS[1]} name="broker-2" d={span(t, T2, T2 + 0.4)} state={(i) => still(i < 13 ? 'filled' : 'empty')} />
      </Rise>
      <Rise t={t} at={0.6}>
        <BrokerRow
          t={t}
          y={ROWS[2]}
          name="broker-3"
          dim={slow - focus}
          ring={focus}
          pulse
          roles={[{ text: 'ngoài ISR', color: INK.warn, o: slow }]}
          state={(i) => (i < 9 ? still('filled') : i < 13 ? chain(t, [T3, a2], ['filled', 'empty', 'missing']) : still('empty'))}
        />
      </Rise>
      <Note x={cellX(11)} y={ROWS[2] + 35} dx={-60} dy={130} text="còn sống, nhưng thiếu offset 9–12" color={INK.bad} o={vis(t, a2 + 0.6)} />
      <Icon3D name="flag" x={490} y={990} size={96} t={t} at={a2 + 2.2} />
      <Statement x={560} y={955} text="Cho broker-3 làm leader?" color={INK.warn} size={52} o={sp(t, a2 + 2.2)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 1. clean election from the ISR */

function clean(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const DEAD = a0 + 2.3
  const PROMO = a0 + 3.4
  const dead = span(t, DEAD, DEAD + 0.4)
  const promo = span(t, PROMO, PROMO + 0.4)
  const read = lerp(5, 9, span(t, a2 + 0.6, a2 + 4))
  const full = (i: number) => still(i < 12 ? 'filled' : 'empty')
  const rowY = (k: number) => ROWS[k]
  const at = 2.0
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 560, s: 1.06 }, 1.3], [a2, { x: 1000, y: 570, s: 1.06 }, 1.3]])} title={{ kicker: 'BẦU LEADER', text: 'Chọn từ ISR' }}>
      <Rise t={t} at={at}>
        <div style={readout(250)}>
          <Swap t={t} times={[DEAD]} items={['{1, 2, 3}', '{2, 3}'].map((s) => <span style={{ color: INK.good }}>ISR = {s}</span>)} />
        </div>
      </Rise>
      <Rise t={t} at={at}>
        <BrokerRow t={t} y={rowY(0)} name="broker-1" d={dead} roles={[{ text: 'leader', color: INK.accent, o: 1 - dead }]} state={full} />
      </Rise>
      <Rise t={t} at={at + 0.15}>
        <BrokerRow
          t={t}
          y={rowY(1)}
          name="broker-2"
          ring={promo}
          roles={[{ text: 'follower', color: INK.faint, o: 1 - promo }, { text: 'leader mới', color: INK.warn, o: promo }]}
          state={full}
          marks={[{ at: 12, label: 'HW 12', color: INK.good, o: span(t, a1, a1 + 0.4) }, { at: read, label: `đọc ${Math.floor(read)}`, color: INK.accent, o: span(t, a2, a2 + 0.4) }]}
        />
      </Rise>
      <Rise t={t} at={at + 0.3}>
        <BrokerRow t={t} y={rowY(2)} name="broker-3" roles={[{ text: 'follower', color: INK.faint, o: 1 }]} state={full} />
      </Rise>
      <Note x={cellX(5)} y={ROWS[1] + 35} dx={80} dy={115} text="bản trong ISR có đủ mọi tin tới HW" color={INK.good} o={vis(t, a1 + 0.4)} />
      <Packets t={t} from={{ x: cellX(12) + 20, y: ROWS[1] + 35 }} to={{ x: 1470, y: ROWS[1] + 35 }} start={a2 + 0.6} end={a2 + 4} every={0.45} len={0.7} size={18} />
      <Rise t={t} at={a2}>
        <ConsumerBadge y={ROWS[1] - 24} />
      </Rise>
      <Icon3D name="shield" x={500} y={945} size={96} t={t} at={a2 + 1.4} />
      <Statement x={570} y={910} text="không mất tin nào đã báo OK" color={INK.good} size={50} o={sp(t, a2 + 1.4)} />
    </SoftScene>
  )
}

function ConsumerBadge({ y }: { y: number }) {
  return (
    <div style={{ ...INK.card, position: 'absolute', left: 1480, top: y, width: 340, height: 118, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 28px', whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: 34, fontWeight: 800 }}>consumer</span>
      <span style={{ fontSize: 26, fontWeight: 600, color: INK.good }}>đọc tiếp, như chưa có gì</span>
    </div>
  )
}

/* ------------------------------------------------------------------ 2. unclean election: two choices */

function unclean(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const CWU = 54
  const L = 110
  const R = 1010
  const out = 1 - span(t, a3, a3 + 0.4)
  const dots = (k: number) => 0.25 + 0.75 * Math.max(0, Math.sin(t * 4 - k * 1.1))
  const rState = (i: number): Blend => (i < 9 ? still('filled') : i < 13 ? chain(t, [a2 + 1.0, a2 + 2.6 + (i - 9) * 0.7], ['empty', 'missing', 'new']) : still('empty'))
  const header = (x: number, icon: 'pause' | 'play', at: number, l1: string, l2: string) => (
    <>
      <Icon3D name={icon} x={x + 60} y={300} size={112} t={t} at={at} />
      <Rise t={t} at={at + 0.1}>
        <div style={{ position: 'absolute', left: x + 140, top: 256, whiteSpace: 'nowrap' }}>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{l1}</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: INK.faint }}>{l2}</div>
        </div>
      </Rise>
    </>
  )
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 930, y: 570, s: 1.05 }, 2.4], [a2, { x: 1010, y: 570, s: 1.05 }, 1.6], [a3, WIDE, 1.2], [a3 + 1.6, { x: 960, y: 570, s: 1.06 }, 4]])} title={{ kicker: 'ISR TRỐNG', text: 'Chờ hay chạy tiếp?' }}>
      <div style={{ opacity: out }}>
        <div style={{ position: 'absolute', left: 958, top: 240, width: 3, height: 690, borderRadius: 2, background: INK.line, opacity: vis(t, a0 + 2) }} />
        {header(L, 'pause', a0 + 1.9, 'unclean = false', 'mặc định · chờ')}
        {header(R, 'play', a0 + 2.3, 'unclean = true', 'chạy ngay')}
        {/* left: wait */}
        <Rise t={t} at={a1 - 0.2}>
          <ServerUnit x={L} y={390} name="broker ISR" down t={t} />
          <div style={{ position: 'absolute', left: L + 300, top: 418, fontSize: 32, fontWeight: 700, color: INK.warn, whiteSpace: 'nowrap' }}>
            chờ nó sống lại
            {[0, 1, 2].map((k) => (
              <span key={k} style={{ opacity: dots(k) }}>
                .
              </span>
            ))}
          </div>
          <LogTape x={L} y={620} cells={14} cellW={CWU} state={(i) => (i < 13 ? 'dead' : 'empty')} />
        </Rise>
        <Icon3D name="lock" x={820} y={812} size={80} t={t} at={a1 + 1.2} />
        <Icon3D name="shield" x={820} y={888} size={80} t={t} at={a1 + 2.2} />
        <Statement x={L} y={785} text="đứng yên: không đọc, không ghi" color={INK.warn} size={38} o={sp(t, a1 + 1.2)} />
        <Statement x={L} y={860} text="nhưng không mất tin" color={INK.good} size={38} o={sp(t, a1 + 2.2)} />
        {/* right: run on */}
        <Rise t={t} at={a2 - 0.2}>
          <ServerUnit x={R} y={390} name="broker-3" t={t} />
          <div style={{ position: 'absolute', left: R + 300, top: 418, fontSize: 32, fontWeight: 700, color: INK.warn, whiteSpace: 'nowrap' }}>lên làm leader ngay</div>
          <FadeTape x={R} y={620} cells={14} cellW={CWU} state={rState} />
        </Rise>
        <Icon3D name="flash" x={1530} y={812} size={80} t={t} at={a2 + 1.0} />
        <Icon3D name="trash-can" x={1530} y={888} size={80} t={t} at={a2 + 1.8} />
        <Statement x={R} y={785} text="chạy lại ngay" color={INK.good} size={38} o={sp(t, a2 + 1.0)} />
        <Statement x={R} y={860} text="offset 9–12 cũ: mất" color={INK.bad} size={38} o={sp(t, a2 + 1.8)} />
      </div>
      {/* two truths */}
      {[
        { y: 300, title: 'consumer đọc TRƯỚC khi đổi leader', letters: 'ABCD', st: 'filled' as CellState, text: 'offset 9–12 = đơn A, B, C, D', color: INK.accent, icon: 'backward' as const, at: a3 + 0.4 },
        { y: 580, title: 'consumer đọc SAU khi đổi leader', letters: 'XYZW', st: 'new' as CellState, text: 'offset 9–12 = đơn X, Y, Z, W', color: INK.bad, icon: 'forward' as const, at: a3 + 1.2 },
      ].map((r) => {
        const x0 = 500
        return (
          <div key={r.y}>
            <Icon3D name={r.icon} x={330} y={r.y + 40} size={110} t={t} at={r.at} />
            <Rise t={t} at={r.at}>
              <div style={{ position: 'absolute', left: x0, top: r.y - 46, fontSize: 28, fontWeight: 700, color: INK.faint, whiteSpace: 'nowrap' }}>{r.title}</div>
              <LogTape x={x0} y={r.y} cells={14} cellW={66} state={(i) => (i < 9 ? 'filled' : i < 13 ? r.st : 'empty')} />
              {r.letters.split('').map((ch, k) => (
                <div key={k} style={{ position: 'absolute', left: x0 + (9 + k) * 66, top: r.y, width: 66, height: 70, display: 'grid', placeItems: 'center', fontSize: 34, fontWeight: 800, color: r.st === 'new' ? '#13307f' : '#ffffff' }}>
                  {ch}
                </div>
              ))}
            </Rise>
            <div style={{ position: 'absolute', left: x0 + 9 * 66 - 6, top: r.y - 8, width: 4 * 66 + 12, height: 86, borderRadius: 18, border: `3px solid ${r.color}`, boxShadow: `0 0 22px ${r.color}`, opacity: vis(t, r.at + 0.3) * (0.55 + 0.45 * Math.sin(t * 4)) }} />
            <Bracket x1={x0 + 9 * 66} x2={x0 + 13 * 66} y={r.y + 112} text={r.text} color={r.color} o={vis(t, r.at + 0.3)} below />
          </div>
        )
      })}
      <Statement x={500} y={860} text="cùng offset, hai nội dung khác nhau" color={INK.bad} size={50} o={sp(t, a3 + 2.4)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 3. leader epoch */

function epoch(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const S = 2.0
  const EP2 = a0 + 2.4
  const M1 = a0 + 4.3
  const TR = a2 + 1.4
  const RS = span(t, a1 - 0.2, a1 + 0.15) - span(t, a1 + 0.8, a1 + 1.15)
  const Y = [380, 700]
  const leader = (i: number): Blend => (i < 6 ? still('filled') : i < 10 ? chain(t, [EP2 + (i - 6) * 0.12], ['empty', 'new']) : still('empty'))
  const follower = (i: number): Blend =>
    i < 6 ? still('filled') : i < 8 ? chain(t, [M1, TR, a2 + 2.4 + (i - 6) * 0.5], ['filled', 'missing', 'empty', 'new']) : i < 10 ? chain(t, [a2 + 2.4 + (i - 6) * 0.5], ['empty', 'new']) : still('empty')
  const cut = vis(t, a2 + 0.2, a2 + 3.2)
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 560, s: 1.05 }, 1.3], [a2, { x: 960, y: 590, s: 1.07 }, 1.3]])} title={{ kicker: 'LEADER EPOCH', text: 'Chỉ cắt đúng phần sai' }}>
      <Rise t={t} at={S}>
        <div style={readout(250)}>
          <div style={{ ...num, fontSize: 40 }}>
            <Swap t={t} times={[EP2]} items={[1, 2].map((e) => <span>epoch = {e}</span>)} />
          </div>
        </div>
      </Rise>
      <Rise t={t} at={S}>
        <BrokerRow t={t} y={Y[0]} name="broker-2" ring={1} roles={[{ text: 'leader', color: INK.warn, o: 1 }]} state={leader} marks={[]} />
      </Rise>
      <Rise t={t} at={S + 0.2}>
        <BrokerRow t={t} y={Y[1]} name="broker-1" nameDown="broker-1 ↻" d={RS} tapeDies={false} roles={[{ text: 'follower', color: INK.faint, o: 1 - RS }, { text: 'khởi động lại', color: INK.warn, o: RS }]} state={follower} />
      </Rise>
      <Bracket x1={cellX(0)} x2={cellX(6)} y={Y[0] - 56} text="epoch 1: offset 0–5" color={INK.faint} o={vis(t, a0 + 2.9)} />
      <Bracket x1={cellX(6)} x2={cellX(10)} y={Y[0] - 56} text="epoch 2: từ offset 6" color={INK.warn} o={vis(t, EP2 + 0.8)} />
      <Wire from={{ x: cellX(8), y: Y[1] - 12 }} to={{ x: cellX(8), y: Y[0] + 108 }} color={INK.accent} p={move(t, a1 + 0.5, 0.5)} flow={t} />
      <Envelope t={t} at={a1 + 0.9} from={{ x: cellX(8), y: Y[1] - 50 }} to={{ x: cellX(8), y: Y[0] + 130 }} label="epoch cuối của tôi kết thúc ở đâu?" len={1.1} arc={0} />
      <Envelope t={t} at={a1 + 2.4} from={{ x: cellX(8), y: Y[0] + 130 }} to={{ x: cellX(8), y: Y[1] - 50 }} label="ở offset 6" color={INK.good} len={0.9} arc={0} />
      <div style={{ position: 'absolute', left: cellX(6) - 3, top: Y[1] - 18, width: 6, height: 106, borderRadius: 3, background: INK.warn, boxShadow: `0 0 18px ${INK.warn}`, opacity: cut }} />
      <Note x={cellX(7)} y={Y[1] + 35} dx={80} dy={150} text="offset 6–7 ghi ở epoch cũ, leader mới không có" color={INK.bad} o={Math.min(vis(t, M1), 1 - span(t, TR, TR + FADE))} />
      <Note x={cellX(7)} y={Y[1] + 35} dx={80} dy={150} text="cắt offset 6–7, chép lại từ leader" color={INK.good} o={vis(t, TR + 0.1)} />
      <Icon3D name="tick" x={cellX(10) + 70} y={Y[1] + 35} size={90} t={t} at={a2 + 4.4} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 4. KRaft controller quorum */

function quorum(t: number, c: Cue) {
  const [a1, a2] = [c.at(1), c.at(2)]
  const d2 = c.end(2) - a2
  const D3 = a2 + 0.3
  const D2 = a2 + d2 * 0.55
  const dead = [0, span(t, D2, D2 + 0.4), span(t, D3, D3 + 0.4)]
  const pos = [
    { x: 830, y: 270, name: 'controller-1' },
    { x: 400, y: 600, name: 'controller-2' },
    { x: 1260, y: 600, name: 'controller-3' },
  ]
  // wire anchors on the facing edges of the servers
  const anchor = [
    [{ x: 830, y: 335 }, { x: 1090, y: 335 }],
    [{ x: 530, y: 590 }, { x: 660, y: 665 }],
    [{ x: 1390, y: 590 }, { x: 1260, y: 665 }],
  ]
  const links: [{ x: number; y: number }, { x: number; y: number }, number, number][] = [
    [anchor[0][0], anchor[1][0], 0, 1],
    [anchor[0][1], anchor[2][0], 0, 2],
    [anchor[1][1], anchor[2][1], 1, 2],
  ]
  const S = 2.0
  const cycle = 2.8
  const sync = [0, 1].map((k) => a1 + 0.5 + k * cycle)
  const counts = ['3/3 ✓', '2/3 ✓', '1/3 ✗']
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 560, s: 1.05 }, 1.4], [D3, { x: 960, y: 580, s: 1.05 }, 1.2]])} title={{ kicker: 'KRAFT', text: 'Ai quyết định leader?' }}>
      {links.map(([f, to, i, j]) => (
        <div key={`${i}${j}`} style={{ opacity: 1 - 0.7 * Math.max(dead[i], dead[j]) }}>
          <Wire from={f} to={to} color={INK.line} p={move(t, a1, 0.6)} flow={t} />
          <Packets t={t} from={f} to={to} start={a1 + 0.7 + i * 0.2 + j * 0.15} end={D3} every={0.9} len={0.9} size={16} />
        </div>
      ))}
      {pos.map((p, k) => (
        <Rise key={p.name} t={t} at={S + k * 0.2}>
          <div style={{ opacity: 1 - dead[k] }}>
            <ServerUnit x={p.x} y={p.y} name={p.name} t={t} />
          </div>
          {dead[k] > 0.002 && (
            <div style={{ opacity: dead[k] }}>
              <ServerUnit x={p.x} y={p.y} name={`${p.name} ✕`} down t={t} />
            </div>
          )}
        </Rise>
      ))}
      <RolePill x={830} y={202} text="active" color={INK.good} o={vis(t, S + 0.6)} />
      {sync.map((s, k) => (
        <div key={k}>
          <Envelope t={t} at={s} from={anchor[0][0]} to={anchor[1][0]} label="đề xuất" len={0.8} />
          <Envelope t={t} at={s} from={anchor[0][1]} to={anchor[2][0]} label="đề xuất" len={0.8} />
          <Envelope t={t} at={s + 1.1} from={anchor[1][0]} to={anchor[0][0]} label="đồng ý" color={INK.good} len={0.8} />
          <Envelope t={t} at={s + 1.1} from={anchor[2][0]} to={anchor[0][1]} label="đồng ý" color={INK.good} len={0.8} />
        </div>
      ))}
      <div style={{ opacity: 1 - span(t, D2 + 0.2, D2 + 0.6) }}>
        <Icon3D name="notebook" x={960} y={525} size={110} t={t} at={a1 + 0.2} />
      </div>
      <Icon3D name="pause" x={960} y={525} size={110} t={t} at={D2 + 0.5} />
      <Rise t={t} at={a1 + 0.8}>
        <div style={readout(250, 360)}>
          <div style={{ fontSize: 26, fontWeight: 600, color: INK.faint }}>đa số đồng ý</div>
          <div style={{ ...num, fontSize: 52, fontWeight: 800 }}>
            <Swap t={t} times={[D3, D2]} items={counts.map((s, k) => <span style={{ color: k < 2 ? INK.good : INK.bad }}>{s}</span>)} />
          </div>
        </div>
      </Rise>
      <div style={{ opacity: 1 - span(t, D2, D2 + FADE) }}>
        <Statement x={380} y={900} text="__cluster_metadata · mọi thay đổi cần 2/3 đồng ý" color={INK.text} size={44} o={sp(t, a1 + 1.2)} />
      </div>
      <Statement x={300} y={900} text="đóng băng: vẫn đọc/ghi, nhưng không bầu được leader mới" color={INK.bad} size={42} o={sp(t, D2 + 0.4)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 5. summary */

function summary(t: number, c: Cue) {
  return (
    <SoftTheme>
      <SummaryList t={t} cue={c} items={['Leader mới luôn chọn từ ISR', 'ISR trống: mặc định chờ · unclean thì mất tin', 'Leader epoch: chỉ cắt đúng phần sai', 'Controller cần đa số (2/3)']} />
    </SoftTheme>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { hook, clean, unclean, epoch, quorum, summary }

/** Key-moment sounds, timed to the same cue offsets the scenes animate on. */
const SFX: Record<string, SceneSfx[]> = {
  hook: [
    { kind: 'tick', at: (c) => c.at(0) + (c.end(0) - c.at(0)) * 0.55 },
    { kind: 'error', at: (c) => c.at(1) + 0.2 },
    { kind: 'error', at: (c) => c.at(1) + (c.end(1) - c.at(1)) * 0.55 },
  ],
  clean: [
    { kind: 'error', at: (c) => c.at(0) + 2.3 },
    { kind: 'ding', at: (c) => c.at(0) + 3.4 },
  ],
  unclean: [{ kind: 'error', at: (c) => c.at(2) + 1.0 }],
  epoch: [
    { kind: 'tick', at: (c) => c.at(0) + 2.4 },
    { kind: 'tick', at: (c) => c.at(2) + 1.4 },
    { kind: 'ding', at: (c) => c.at(2) + 4.4 },
  ],
  quorum: [
    { kind: 'error', at: (c) => c.at(2) + 0.3 },
    { kind: 'error', at: (c) => c.at(2) + (c.end(2) - c.at(2)) * 0.55 },
  ],
}

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const leaderElectionLesson: Lesson = {
  ...leaderElectionScript,
  scenes: leaderElectionScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id], sfx: SFX[s.id] })),
  intro: [
    { kind: 'video', scenes: ['hook'] },
    {
      kind: 'quiz',
      title: 'Quick Quiz',
      questions: [q('Đoán trước khi học: mặc định Kafka có cho broker-3 (thiếu dữ liệu) làm leader không?', ['Có, để partition chạy tiếp', 'Không, partition đứng chờ một bản trong ISR sống lại', 'Có, nhưng chỉ cho đọc', 'Tuỳ consumer'], 1, 'Mặc định unclean.leader.election.enable = false từ Kafka 0.11. Phần 2 giải thích đánh đổi.')],
    },
  ],
  roadmap: [
    'Chặng 1: Leader chết bình thường — bầu từ ISR, không mất tin.',
    'Chặng 2: ISR trống — chờ hay unclean election, và cái giá "hai sự thật".',
    'Chặng 3: Leader epoch sửa lỗi cắt log, và controller KRaft cần đa số.',
  ],
  sections: [
    {
      id: 'bau-tu-isr',
      title: 'Bầu leader mới từ ISR',
      blocks: [
        { kind: 'video', scenes: ['clean'] },
        { kind: 'p', text: 'Khi leader chết, **controller** chọn một bản trong **ISR** lên thay. Bản ISR có đủ mọi tin tới HW, nên **mọi tin đã báo OK với `acks=all` vẫn còn**. Producer và consumer chỉ cần hỏi lại metadata để biết leader mới.' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Vì sao leader mới luôn được chọn từ ISR?', ['Vì ISR có broker mạnh nhất', 'Vì bản trong ISR có đủ mọi tin tới High Watermark', 'Vì ISR gần controller nhất', 'Ngẫu nhiên'], 1, 'Chọn ngoài ISR có thể mất tin đã commit.')],
        },
      ],
    },
    {
      id: 'unclean',
      title: 'ISR trống: chờ hay unclean election',
      blocks: [
        {
          kind: 'quiz',
          title: 'Dự đoán trước khi xem',
          questions: [q('Bật unclean election thì cái giá lớn nhất là gì?', ['Chậm hơn', 'Mất tin và có thể có hai nội dung cho cùng offset', 'Tốn đĩa', 'Không có giá'], 1, 'Xem video để thấy "hai sự thật".')],
        },
        { kind: 'video', scenes: ['unclean'] },
        {
          kind: 'table',
          head: ['Lựa chọn', 'Cấu hình', 'Hậu quả'],
          rows: [
            ['**Chờ** bản ISR sống lại', '`unclean.leader.election.enable=false` (mặc định từ 0.11)', 'Partition đứng, không đọc/ghi; **không mất tin**'],
            ['Cho bản ngoài ISR lên luôn', '`unclean.leader.election.enable=true`', 'Chạy lại ngay; **mất** các tin bản đó chưa có'],
          ],
        },
        {
          kind: 'list',
          items: [
            { title: 'Hợp với', text: 'Dữ liệu "mất vài tin cũng được" như log, metric. Không hợp với đơn hàng, thanh toán.' },
            { title: 'Bật tạm để cứu hộ', text: 'Partition đứng nhiều giờ và chấp nhận mất tin → bật `true`, cụm ổn rồi **nhớ tắt đi**.' },
            { title: 'minISR = 2 giảm cái giá', text: 'Khi ISR còn 1, partition đã ngừng nhận ghi từ trước, nên ít tin "đã OK rồi biến mất".' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Topic thanh toán, ISR trống. Nên làm gì?', ['Bật unclean ngay', 'Giữ mặc định (chờ), khôi phục broker ISR', 'Xoá topic', 'Tăng partition'], 1, 'Dữ liệu thanh toán không chấp nhận mất tin.')],
        },
      ],
    },
    {
      id: 'leader-epoch',
      title: 'Leader epoch: chỉ cắt đúng phần sai',
      blocks: [
        { kind: 'video', scenes: ['epoch'] },
        {
          kind: 'p',
          text: 'Ngày xưa follower khởi động lại thì **cắt log về HW nó đang nhớ** — mà HW của follower luôn **chậm một nhịp**, nên có lúc cắt mất tin đã commit (KIP-101). Giờ mỗi lần đổi leader, **epoch** tăng 1 và log ghi "epoch N bắt đầu từ offset X". Follower hỏi leader "epoch cuối của tôi kết thúc ở đâu?" rồi chỉ cắt phần thực sự sai.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Follower dùng gì để biết phải cắt log tới đâu?', ['High Watermark nó đang nhớ', 'Hỏi leader epoch cuối của nó kết thúc ở offset nào', 'Timestamp', 'Không cắt gì'], 1, 'Cắt theo HW cũ từng gây mất tin; leader epoch chính xác hơn.')],
        },
      ],
    },
    {
      id: 'kraft',
      title: 'Controller KRaft',
      blocks: [
        { kind: 'video', scenes: ['quorum'] },
        {
          kind: 'table',
          head: ['Số controller', 'Đa số', 'Chịu được mất'],
          rows: [
            ['3', '2', '1'],
            ['5', '3', '2'],
            ['4', '3', '1 (không hơn 3 → không ai dùng số chẵn)'],
          ],
        },
        {
          kind: 'list',
          items: [
            { title: 'KRaft', text: 'Metadata (topic, leader, ISR) nằm trong log nội bộ `__cluster_metadata`; production từ Kafka 3.3, Kafka 4.0 bỏ hẳn ZooKeeper.' },
            { title: 'Preferred leader', text: 'Broker sống lại **không tự lấy lại** vai leader; `auto.leader.rebalance.enable` (mặc định bật) trả leader về bản ưu tiên mỗi 300 giây khi lệch quá 10%.' },
            { title: 'Controller epoch', text: 'Controller cũ "ngủ quên" (GC dài) tỉnh dậy gửi lệnh mang epoch cũ → broker bỏ qua.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Cụm 3 controller mất 2. Điều gì xảy ra?', ['Mất hết dữ liệu', 'Cụm đóng băng metadata: vẫn đọc/ghi qua leader hiện tại, nhưng không bầu leader mới, không tạo topic', 'Mọi thứ bình thường', 'Broker tự làm controller'], 1, 'Không đủ đa số thì không ra được quyết định mới.')],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: chọn leader khi broker chết',
      blocks: [
        { kind: 'p', text: 'Tắt bật từng broker và chọn `unclean.leader.election.enable`. **Đoán trước**: tắt broker-1 và broker-2 khi broker-3 đang ngoài ISR thì partition ra sao?' },
        { kind: 'widget', name: 'election-lab' },
      ],
    },
    {
      id: 'tom-tat-video',
      title: 'Nhìn lại cả bài',
      blocks: [{ kind: 'video', scenes: ['summary'] }],
    },
  ],
  finalQuiz: [
    q('Leader chết, ISR = {2, 3}. Ai có thể lên làm leader?', ['Chỉ broker 1', 'Broker 2 hoặc 3', 'Bất kỳ broker nào', 'Không ai'], 1, 'Leader mới chọn từ ISR.'),
    q('unclean.leader.election.enable mặc định là gì (từ 0.11)?', ['true', 'false', 'tuỳ topic', 'không có'], 1, 'Kafka mặc định ưu tiên không mất dữ liệu.'),
    q('Vì sao unclean election có thể làm consumer thấy "hai sự thật"?', ['Vì nén', 'Vì leader mới đánh số lại offset cũ cho tin mới', 'Vì consumer lỗi', 'Vì có hai topic'], 1, 'Offset 9–12 cũ và mới có nội dung khác nhau.'),
    q('Cụm 5 controller chịu được mất tối đa bao nhiêu?', ['1', '2', '3', '4'], 1, 'Đa số 3/5, mất 2 vẫn còn 3.'),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao bật unclean election thì partition chạy lại được nhưng có thể mất tin?',
      keywords: ['ISR', 'thiếu', 'leader', 'mất'],
      modelAnswer:
        'Vì khi ISR trống, bản còn sống nằm ngoài ISR nên thiếu các tin gần nhất. Bật unclean thì Kafka cho bản đó làm leader để partition hoạt động lại ngay, nhưng những tin nó chưa có coi như mất, và các broker cũ khi quay lại phải cắt bỏ phần dư cho khớp leader mới.',
    },
  ],
  recap: {
    journey:
      'ISR co dần tới trống, chỉ còn bản thiếu dữ liệu → bình thường leader mới chọn từ ISR nên không mất tin → ISR trống thì chờ (mặc định) hoặc unclean (chạy ngay, mất tin, hai sự thật) → leader epoch giúp follower cắt đúng phần sai → mọi quyết định do controller KRaft với đa số.',
    points: [
      { title: 'Bầu từ ISR', text: 'Không mất tin đã báo OK với acks=all.' },
      { title: 'Unclean', text: 'Mặc định tắt: chờ thay vì mất tin; chỉ bật tạm để cứu hộ.' },
      { title: 'Leader epoch', text: 'Follower hỏi leader để cắt đúng phần sai, không cắt theo HW cũ.' },
      { title: 'KRaft', text: 'Controller cần đa số; mất đa số → metadata đóng băng.' },
    ],
    next: 'Bài tiếp theo (Module 5): Consumer group & rebalance.',
  },
}
