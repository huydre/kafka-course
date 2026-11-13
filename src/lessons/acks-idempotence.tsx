import { cameraAt, clamp, lerp, move, sp, span, vis } from '../player/motion-kit'
import { HERO, Icon3D, LogTape, Packets, Envelope, ProducerBox, Rise, SOFT, SOFT_PANEL, ServerUnit, SoftScene, SoftTheme, SummaryList, Note, Wire, type CellState } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene, SceneSfx } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { acksIdempotenceScript } from './acks-idempotence-script'

/** This lesson is drawn in the navy glow style. */
const INK = SOFT
const panel = SOFT_PANEL
const WIDE = { x: 960, y: 540, s: 1 }
const BAD_GRADIENT = 'linear-gradient(160deg, #ff8a96 0%, #ff5a6a 50%, #c02a3c 100%)'

/** Wrapper that only sets opacity, so two states can cross-fade instead of swapping. */
function O({ o, children }: { o: number; children: React.ReactNode }) {
  const q = clamp(o)
  if (q <= 0) return null
  return <div style={{ opacity: q }}>{children}</div>
}

/** Glowing label pill centred on (x, y); fades and rises in with `o`. */
function Pill({ x, y, text, color = INK.accent, o = 1, size = 28 }: { x: number; y: number; text: string; color?: string; o?: number; size?: number }) {
  const q = clamp(o)
  if (q <= 0) return null
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) translateY(${(1 - q) * 14}px)`, opacity: q, padding: '10px 26px', borderRadius: 999, background: 'rgba(8,22,82,0.92)', border: `1.5px solid ${color}`, boxShadow: `0 0 18px ${color}aa, inset 0 1px 0 rgba(255,255,255,0.15)`, fontSize: size, fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap' }}>
      {text}
    </div>
  )
}

/** Big centred statement; words blur-rise one after another as `o` goes 0 → 1. */
function Say({ y, text, color = INK.text, size = 52, o = 1, x = 960 }: { y: number; text: string; color?: string; size?: number; o?: number; x?: number }) {
  const q = clamp(o)
  if (q <= 0) return null
  const words = text.split(' ')
  return (
    <div style={{ position: 'absolute', left: x - 900, width: 1800, top: y, display: 'flex', justifyContent: 'center', fontSize: size, fontWeight: 800, letterSpacing: -0.5, color, whiteSpace: 'nowrap', textShadow: `0 0 30px ${color}66` }}>
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

/** One message / batch cell in the HERO blue; `tint` (0..1) cross-fades it to the tint colour. */
function Block({ x, y, w = 200, h = 70, label, k = 1, tint = 0, tintGradient = BAD_GRADIENT, size = 32, mono = false }: { x: number; y: number; w?: number; h?: number; label: string; k?: number; tint?: number; tintGradient?: string; size?: number; mono?: boolean }) {
  if (k <= 0) return null
  const q = clamp(k)
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 16, overflow: 'hidden', opacity: clamp(q * 1.6), transform: `translateY(${(1 - k) * 16}px) scale(${0.9 + 0.1 * k})`, boxShadow: '0 0 20px rgba(77,141,255,0.5), 0 10px 20px rgba(0,8,50,0.45), inset 0 2px 0 rgba(255,255,255,0.5)' }}>
      <div style={{ position: 'absolute', inset: 0, background: HERO }} />
      <div style={{ position: 'absolute', inset: 0, background: tintGradient, opacity: clamp(tint) }} />
      <div style={{ position: 'relative', height: '100%', display: 'grid', placeItems: 'center', fontSize: size, fontWeight: 800, color: '#ffffff', fontFamily: mono ? MONO : undefined, whiteSpace: 'nowrap' }}>{label}</div>
    </div>
  )
}

/** Dashed red slots drawn over empty tape cells: data that never arrived. */
function MissingCells({ x, y, cw, from, to, o }: { x: number; y: number; cw: number; from: number; to: number; o: number }) {
  if (o <= 0) return null
  return (
    <div style={{ opacity: clamp(o) }}>
      {Array.from({ length: to - from }, (_, j) => (
        <div key={j} style={{ position: 'absolute', left: x + (from + j) * cw + 3, top: y, width: cw - 6, height: 70, boxSizing: 'border-box', borderRadius: 14, border: `2px dashed ${INK.bad}`, background: 'rgba(255,90,106,0.12)' }} />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ 0. cold open */

/** Producer → leader → follower layout shared by the hook. */
const HK = { P: { x: 90, y: 425 }, L: { x: 640, y: 410 }, F: { x: 1320, y: 410 }, CW: 50, TY: 640 }

function hook(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const { P, L, F, CW, TY } = HK
  const sentStep = Math.floor(span(t, a0 + 0.2, a0 + 1.8) * 12) / 12
  const sent = Math.round(100 * sentStep)
  const cells = Math.floor(span(t, a0 + 0.3, a0 + 1.9) * 10)
  const dead = span(t, a1 + 0.8, a1 + 1.2)
  const prom = span(t, a1 + 2.2, a1 + 2.6)
  const miss = span(t, a1 + 3.0, a1 + 3.4)
  const pulse = miss * (0.8 + 0.2 * Math.sin((t - a1) * 5))
  const liveTape = (i: number): CellState => (i < cells ? 'new' : 'empty')
  const deadTape = (i: number): CellState => (i < 10 ? 'dead' : 'empty')
  const emptyTape = (): CellState => 'empty'
  const yc = L.y + 65
  return (
    <SoftScene
      t={t}
      camera={cameraAt(t, [
        [0, { x: 960, y: 560, s: 1.0 }],
        [a1, { x: 980, y: 570, s: 1.04 }, 1.3],
        [a2, { x: 1000, y: 590, s: 1.04 }, 1.3],
      ])}
    >
      <Rise t={t} at={0.2}>
        <ProducerBox x={P.x} y={P.y} w={340} title="producer · acks" line={`gửi ${sent} tin`} />
      </Rise>
      <Rise t={t} at={0.4}>
        <O o={1 - dead}>
          <ServerUnit x={L.x} y={L.y} name="broker-1 · leader" t={t} />
          <LogTape x={L.x} y={TY} cells={10} cellW={CW} state={liveTape} offsetOf={(i) => i * 10} />
        </O>
        <O o={dead}>
          <ServerUnit x={L.x} y={L.y} name="broker-1 ✕" down t={t} />
          <LogTape x={L.x} y={TY} cells={10} cellW={CW} state={deadTape} offsetOf={(i) => i * 10} />
        </O>
      </Rise>
      <Rise t={t} at={0.6}>
        <O o={1 - prom}>
          <ServerUnit x={F.x} y={F.y} name="broker-2 · follower" t={t} />
        </O>
        <O o={prom}>
          <ServerUnit x={F.x} y={F.y} name="broker-2 · leader mới" accent={INK.warn} t={t} />
        </O>
        <LogTape x={F.x} y={TY} cells={10} cellW={CW} state={emptyTape} offsetOf={(i) => i * 10} />
        <MissingCells x={F.x} y={TY} cw={CW} from={0} to={10} o={pulse} />
      </Rise>
      <Wire from={{ x: P.x + 340 + 10, y: yc }} to={{ x: L.x - 10, y: yc }} color={INK.line} p={move(t, a0, 0.5)} flow={t} />
      <Wire from={{ x: L.x + 270, y: yc }} to={{ x: F.x - 10, y: yc }} color={INK.line} p={move(t, a0 + 0.2, 0.6)} dashed />
      <Packets t={t} from={{ x: P.x + 350, y: yc }} to={{ x: L.x - 10, y: yc }} start={a0 + 0.2} end={a0 + 1.8} every={0.14} len={0.6} size={20} />
      <Envelope t={t} at={a0 + 1.9} from={{ x: L.x - 10, y: yc }} to={{ x: P.x + 350, y: yc }} label="OK" color={INK.good} len={0.8} arc={-60} />
      <div style={{ opacity: vis(t, a0 + 2.7) }}>
        <Icon3D name="thumb-up" x={P.x + 170} y={P.y - 90} size={120} t={t} at={a0 + 2.7} />
      </div>
      <Icon3D name="fire" x={L.x + 130} y={L.y - 80} size={120} t={t} at={a1 + 0.9} />
      <Say y={830} text="OK rồi… mà tin đi đâu?" color={INK.warn} size={64} o={sp(t, a2 + 0.2)} />
      <Rise t={t} at={a2 + 2.4}>
        <div style={{ ...panel, left: 760, top: 940, fontFamily: MONO, borderColor: INK.accent }}>acks = ?</div>
      </Rise>
      <Icon3D name="setting" x={700} y={975} size={110} t={t} at={a2 + 2.5} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 1. three levels */

const LV = { cols: [560, 1000, 1440], laneY: [560, 720, 880], laneX: 110, laneW: 1700, laneH: 130, T: 3.4 }

function levels(t: number, c: Cue) {
  const [a1, a2, a3] = [c.at(1), c.at(2), c.at(3)]
  const { cols, laneY, laneX, laneW, laneH, T } = LV
  const lanes = [
    { label: 'acks = 0', sub: 'không chờ', wait: 0, start: a1, color: INK.bad, arrive: 0.1 },
    { label: 'acks = 1', sub: 'chờ leader', wait: 1, start: a2, color: INK.warn, arrive: 0.9 },
    { label: 'acks = all', sub: 'chờ cả ISR', wait: 2, start: a3, color: INK.good, arrive: 1.8 },
  ]
  const nextStart = [a2, a3, Infinity]
  const cycles = Array.from({ length: 6 }, (_, k) => k)
  return (
    <SoftScene
      t={t}
      camera={cameraAt(t, [
        [0, { x: 960, y: 540, s: 1.0 }],
        [a1, { x: 960, y: 555, s: 1.03 }, 1.3],
        [a2, { x: 960, y: 560, s: 1.03 }, 1.3],
        [a3, { x: 960, y: 570, s: 1.04 }, 1.3],
        [a3 + 4.2, WIDE, 1.2],
      ])}
      title={{ kicker: 'ACKS', text: 'Thế nào là gửi xong?' }}
    >
      <Rise t={t} at={1.9}>
        <ProducerBox x={cols[0] - 150} y={255} w={300} title="producer" line="gửi tin" />
      </Rise>
      <Rise t={t} at={2.3}>
        <ServerUnit x={cols[1] - 130} y={240} name="leader" t={t} />
      </Rise>
      <Rise t={t} at={2.7}>
        <ServerUnit x={cols[2] - 130} y={240} name="follower (ISR)" t={t} />
      </Rise>
      {lanes.map((ln, i) => {
        const cy = laneY[i]
        const dim = lerp(1, 0.6, span(t, nextStart[i], nextStart[i] + 0.4))
        return (
          <div key={ln.label} style={{ opacity: dim }}>
            <Rise t={t} at={ln.start}>
              <div style={{ ...INK.card, position: 'absolute', left: laneX, top: cy - laneH / 2, width: laneW, height: laneH, boxSizing: 'border-box' }} />
              <div style={{ position: 'absolute', left: laneX + 40, top: cy - 44, fontSize: 46, fontWeight: 800, letterSpacing: -0.5, color: '#ffffff', whiteSpace: 'nowrap' }}>{ln.label}</div>
              <div style={{ position: 'absolute', left: laneX + 40, top: cy + 10, fontSize: 28, fontWeight: 700, color: ln.color }}>{ln.sub}</div>
              <Wire from={{ x: cols[0] + 30, y: cy }} to={{ x: cols[1] - 30, y: cy }} color={INK.line} p={move(t, ln.start + 0.2, 0.5)} />
              <Wire from={{ x: cols[1] + 30, y: cy }} to={{ x: cols[2] - 30, y: cy }} color={INK.line} p={move(t, ln.start + 0.35, 0.5)} />
              {cols.map((cx) => (
                <div key={cx} style={{ position: 'absolute', left: cx - 20, top: cy - 20, width: 40, height: 40, borderRadius: 20, background: HERO, boxShadow: '0 0 16px rgba(77,141,255,0.7), inset 0 2px 0 rgba(255,255,255,0.5)' }} />
              ))}
            </Rise>
            {cycles.map((k) => {
              const s = ln.start + 0.6 + k * T
              if (t < s || t > s + T) return null
              const out = 1 - span(t, s + T - 0.5, s + T - 0.15)
              return (
                <div key={k}>
                  <Packets t={t} from={{ x: cols[0], y: cy }} to={{ x: cols[1], y: cy }} start={s} end={s} len={0.9} size={26} />
                  {ln.wait === 2 && <Packets t={t} from={{ x: cols[1], y: cy }} to={{ x: cols[2], y: cy }} start={s + 0.9} end={s + 0.9} len={0.9} size={26} />}
                  <div style={{ opacity: out }}>
                    <Icon3D name="tick" x={cols[ln.wait]} y={cy} size={92} t={t} at={s + ln.arrive} float={false} />
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
      <Pill x={(cols[1] + cols[2]) / 2} y={laneY[0]} text="không biết có tới?" color={INK.bad} size={28} o={sp(t, a1 + 2.6)} />
      <Pill x={1655} y={laneY[2]} text="mặc định ≥ 3.0" color={INK.good} size={28} o={sp(t, a3 + 3.6)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 2. how acks=1 loses data */

const LS = { TX: 440, CW: 66, CELLS: 20, LY: 430, FY: 720, PX: 950, PY: 225 }

function lossScene(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const { TX, CW, CELLS, LY, FY, PX, PY } = LS
  const cx = (i: number) => TX + i * CW
  const rew = span(t, a3 - 0.1, a3 + 0.4)
  const written = 10 + Math.floor(10 * span(t, a0 + 0.3, a0 + 2.1))
  const copied = Math.floor(10 + 3 * span(t, a1 + 0.2, a1 + 1.6) + 7 * span(t, a3 + 0.6, a3 + 2.6))
  const kDead = span(t, a1 + 1.8, a1 + 2.2) * (1 - rew)
  const kProm = span(t, a2 + 0.4, a2 + 0.8) * (1 - rew)
  const kMiss = span(t, a2 + 0.6, a2 + 1.0) * (1 - rew)
  const kAll = span(t, a3 - 0.1, a3 + 0.4)
  const leader = (i: number): CellState => (i < 10 ? 'filled' : i < written ? 'new' : 'empty')
  const leaderDead = (i: number): CellState => (i < written ? 'dead' : 'empty')
  const follower = (i: number): CellState => (i < 10 ? 'filled' : i < copied ? 'new' : 'empty')
  const gx = cx(10) + 33
  const down = { x: gx, y: PY + 108 }
  return (
    <SoftScene
      t={t}
      camera={cameraAt(t, [
        [0, { x: 960, y: 560, s: 1.0 }],
        [a1, { x: 980, y: 580, s: 1.03 }, 1.3],
        [a2, { x: 1000, y: 590, s: 1.03 }, 1.3],
        [a3, WIDE, 1.3],
      ])}
      title={{ kicker: 'ACKS = 1', text: 'Mất tin đã báo OK' }}
    >
      <Rise t={t} at={0.2}>
        <O o={1 - kAll}>
          <ProducerBox x={PX} y={PY} w={380} title="producer · acks=1" line="offset 100–199" />
        </O>
        <O o={kAll}>
          <ProducerBox x={PX} y={PY} w={380} title="producer · acks=all" line="offset 100–199" />
        </O>
      </Rise>
      <Rise t={t} at={0.4}>
        <O o={1 - kDead}>
          <ServerUnit x={120} y={LY - 30} name="broker-1 · leader" t={t} />
          <LogTape x={TX} y={LY} cells={CELLS} cellW={CW} state={leader} offsetOf={(i) => i * 10} />
        </O>
        <O o={kDead}>
          <ServerUnit x={120} y={LY - 30} name="broker-1 ✕" down t={t} />
          <LogTape x={TX} y={LY} cells={CELLS} cellW={CW} state={leaderDead} offsetOf={(i) => i * 10} />
        </O>
      </Rise>
      <Rise t={t} at={0.6}>
        <O o={1 - kProm}>
          <ServerUnit x={120} y={FY - 30} name="broker-2 · follower" t={t} />
        </O>
        <O o={kProm}>
          <ServerUnit x={120} y={FY - 30} name="broker-2 · leader mới" accent={INK.warn} t={t} />
        </O>
        <LogTape x={TX} y={FY} cells={CELLS} cellW={CW} state={follower} offsetOf={(i) => i * 10} />
        <MissingCells x={TX} y={FY} cw={CW} from={13} to={20} o={kMiss} />
      </Rise>
      {/* producer writes to the leader */}
      <Wire from={down} to={{ x: gx, y: LY - 8 }} color={INK.line} p={move(t, a0 + 0.1, 0.4)} />
      <Packets t={t} from={down} to={{ x: gx, y: LY - 8 }} start={a0 + 0.3} end={a0 + 2.0} every={0.2} len={0.5} size={20} />
      <Envelope t={t} at={a0 + 2.2} from={{ x: gx + 160, y: LY - 8 }} to={{ x: gx + 160, y: PY + 108 }} label="OK" color={INK.good} len={0.8} arc={0} />
      <Icon3D name="thumb-up" x={1480} y={PY + 55} size={110} t={t} at={a0 + 3.0} />
      {/* leader → follower copy */}
      <Wire from={{ x: cx(11.5), y: LY + 100 }} to={{ x: cx(11.5), y: FY - 12 }} color={INK.line} p={move(t, a1 - 0.2, 0.4)} flow={t} />
      <Packets t={t} from={{ x: cx(11.5), y: LY + 100 }} to={{ x: cx(11.5), y: FY - 12 }} start={a1 + 0.1} end={a1 + 1.7} every={0.5} len={0.8} size={20} />
      <Packets t={t} from={{ x: cx(11.5), y: LY + 100 }} to={{ x: cx(11.5), y: FY - 12 }} start={a3 + 0.6} end={a3 + 2.5} every={0.28} len={0.7} size={20} />
      <O o={1 - rew}>
        <Icon3D name="fire" x={250} y={LY - 85} size={110} t={t} at={a1 + 1.9} />
      </O>
      <Note x={cx(13)} y={FY + 72} dx={-60} dy={90} text="follower mới chép tới offset ~130" color={INK.warn} o={vis(t, a1 + 1.7, a2 + 0.2)} />
      <Note x={cx(16.5)} y={FY + 72} dx={-60} dy={90} text="offset 130–199 mất — dù đã báo OK" color={INK.bad} o={vis(t, a2 + 1.0, a3 - 0.2)} />
      {/* replay with acks=all: OK comes back only after the copy */}
      <O o={vis(t, a3 + 3.0, Infinity)}>
        <Envelope t={t} at={a3 + 3.0} from={{ x: gx + 160, y: LY - 8 }} to={{ x: gx + 160, y: PY + 108 }} label="OK" color={INK.good} len={0.8} arc={0} />
      </O>
      <Icon3D name="shield" x={1480} y={PY + 55} size={110} t={t} at={a3 + 3.8} />
      <Say y={945} text="acks=all → OK chỉ khi follower đã chép" color={INK.good} size={46} o={sp(t, a3 + 1.2)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 3. retry creates duplicates */

const DP = { P: { x: 130, y: 420, w: 420 }, B: { x: 1400, y: 390 }, TX: 1040, TY: 700, CW: 130 }

function duplicate(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const { P, B, TX, TY, CW } = DP
  const fwd = 445
  const back = 500
  const midX = (P.x + P.w + B.x) / 2
  const wait = span(t, a0 + 1.5, a2)
  const resend = sp(t, a2)
  const tint = span(t, a2 + 1.5, a2 + 2.0)
  const cellX = (i: number) => TX + i * CW + 3
  const sendPacket = (i: number, at: number) => <Packets t={t} from={{ x: B.x + 130, y: B.y + 185 }} to={{ x: cellX(i) + 52, y: TY }} start={at} end={at} len={0.5} size={22} />
  return (
    <SoftScene
      t={t}
      camera={cameraAt(t, [
        [0, { x: 960, y: 560, s: 1.0 }],
        [a1, { x: 1000, y: 570, s: 1.03 }, 1.3],
        [a2 + 0.6, { x: 1040, y: 580, s: 1.04 }, 1.3],
      ])}
      title={{ kicker: 'RETRY', text: 'Một tin thành hai' }}
    >
      <Rise t={t} at={0.2}>
        <ProducerBox x={P.x} y={P.y} w={P.w} title="app · producer" line="đơn B (#2)" />
      </Rise>
      <Rise t={t} at={0.4}>
        <ServerUnit x={B.x} y={B.y} name="broker-1" t={t} />
        <LogTape x={TX} y={TY} cells={6} cellW={CW} state={() => 'empty'} tick={1} />
      </Rise>
      <Block x={cellX(0)} y={TY} w={CW - 6} label="A" k={sp(t, 0.8)} />
      <Block x={cellX(1)} y={TY} w={CW - 6} label="B" k={sp(t, a1 + 0.3)} />
      <Block x={cellX(2)} y={TY} w={CW - 6} label="B" k={sp(t, a2 + 1.3)} tint={tint} />
      {sendPacket(1, a1 + 0.3)}
      {sendPacket(2, a2 + 1.3)}
      <Wire from={{ x: P.x + P.w + 10, y: fwd }} to={{ x: B.x - 10, y: fwd }} color={INK.line} p={move(t, a0, 0.5)} />
      <Wire from={{ x: B.x - 10, y: back }} to={{ x: P.x + P.w + 10, y: back }} color={INK.line} p={move(t, a1 + 0.5, 0.4)} dashed />
      <Envelope t={t} at={a0 + 0.4} from={{ x: P.x + P.w + 60, y: fwd }} to={{ x: B.x - 60, y: fwd }} label="đơn B" len={1.0} arc={0} />
      <Envelope t={t} at={a1 + 0.9} from={{ x: B.x - 60, y: back }} to={{ x: midX, y: back }} label="OK" color={INK.good} len={0.8} arc={0} />
      <Icon3D name="wifi" x={midX} y={back} size={110} t={t} at={a1 + 1.7} />
      <Pill x={midX} y={back + 100} text="câu trả lời bị mất" color={INK.bad} o={sp(t, a1 + 1.9)} />
      <Envelope t={t} at={a2 + 0.2} from={{ x: P.x + P.w + 60, y: fwd }} to={{ x: B.x - 60, y: fwd }} label="đơn B (gửi lại)" color={INK.warn} len={1.0} arc={0} />
      {/* retry timer under the producer */}
      <Icon3D name="clock" x={P.x + 60} y={P.y + 190} size={96} t={t} at={a0 + 1.5} />
      <div style={{ opacity: clamp(wait * 8) }}>
        <div style={{ position: 'absolute', left: P.x + 130, top: P.y + 170, fontSize: 28, fontWeight: 700, color: INK.faint, whiteSpace: 'nowrap' }}>
          <span style={{ opacity: 1 - resend }}>chờ OK…</span>
          <span style={{ position: 'absolute', left: 0, opacity: resend, color: INK.warn }}>không thấy OK → gửi lại</span>
        </div>
        <div style={{ position: 'absolute', left: P.x + 130, top: P.y + 220, width: 290, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.18)' }}>
          <div style={{ width: `${wait * 100}%`, height: '100%', borderRadius: 4, background: HERO, boxShadow: '0 0 10px rgba(110,160,255,0.9)' }} />
        </div>
      </div>
      <Icon3D name="copy" x={TX + 2 * CW} y={TY - 90} size={110} t={t} at={a2 + 1.7} />
      <Say y={900} text="không thấy trả lời → gửi lại" color={INK.warn} size={58} o={sp(t, a0 + 1.6) * (1 - span(t, a2 - 0.3, a2 + 0.1))} />
      <Say y={900} text="đơn B bị ghi 2 lần" color={INK.bad} size={66} o={sp(t, a2 + 2.1)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 4. sequence numbers */

const SQ = { LX: 120, LW: 440, rowY: (i: number) => 420 + i * 125, PXL: 1050, PYT: 250, PW: 760 }

function sequence(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const { LX, LW, rowY, PXL, PYT, PW } = SQ
  const ranges = ['0–119', '120–317', '318–515', '516–694']
  const arrive1 = a1 + 1.6
  const arrive2 = a1 + 3.2
  // memory counter rolls in at most 4 steps
  const roll = (from: number, to: number, a: number) => Math.round(lerp(from, to, Math.floor(span(t, a, a + 0.5) * 4) / 4))
  const seq = t < arrive1 ? null : t < arrive2 ? roll(0, 119, arrive1) : roll(119, 317, arrive2)
  const verdictDup = span(t, a2 + 1.0, a2 + 1.3) * (1 - span(t, a3 + 0.7, a3 + 1.1))
  const verdictRej = span(t, a3 + 1.0, a3 + 1.4)
  const ring = (i: number, color: string, k: number) => k > 0 && <div style={{ position: 'absolute', left: LX, top: rowY(i), width: LW, height: 92, boxSizing: 'border-box', borderRadius: 22, border: `3px solid ${color}`, boxShadow: `0 0 22px ${color}`, opacity: k }} />
  const from = (i: number) => ({ x: LX + LW + 6, y: rowY(i) + 38 })
  const to = { x: PXL - 10, y: PYT + 190 }
  return (
    <SoftScene
      t={t}
      camera={cameraAt(t, [
        [0, { x: 960, y: 540, s: 1.0 }],
        [a1, { x: 1000, y: 550, s: 1.03 }, 1.3],
        [a2, { x: 990, y: 560, s: 1.03 }, 1.3],
        [a3 + 2, WIDE, 1.3],
      ])}
      title={{ kicker: 'IDEMPOTENCE', text: 'Đánh số thùng' }}
    >
      <O o={vis(t, a0 + 0.3, a0 + 2.0)}>
        <Icon3D name="hash" x={810} y={500} size={190} t={t} at={a0 + 0.3} />
      </O>
      <Rise t={t} at={a0 + 1.5}>
        <ProducerBox x={LX} y={PYT} w={LW} title="producer" line="producerId 16" />
      </Rise>
      {ranges.map((r, i) => (
        <div key={r}>
          <Rise t={t} at={a0 + 3.0 + i * 0.5}>
            <div style={{ ...INK.card, position: 'absolute', left: LX, top: rowY(i), width: LW, height: 92, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 18, padding: '0 26px', opacity: i === 2 ? 0.7 : 1 }}>
              <span style={{ width: 46, height: 46, borderRadius: 23, display: 'grid', placeItems: 'center', fontSize: 26, fontWeight: 800, background: HERO, color: '#fff' }}>{i + 1}</span>
              <span style={{ fontFamily: MONO, fontSize: 40, fontWeight: 700, color: '#fff' }}>seq {r}</span>
            </div>
          </Rise>
        </div>
      ))}
      {ring(0, INK.good, span(t, arrive1, arrive1 + 0.4))}
      {ring(1, INK.good, span(t, arrive2, arrive2 + 0.4))}
      {ring(3, INK.bad, span(t, a3 + 1.0, a3 + 1.4))}
      {/* broker memory */}
      <Rise t={t} at={a1 + 0.2}>
        <div style={{ ...INK.card, position: 'absolute', left: PXL, top: PYT, width: PW, height: 380, boxSizing: 'border-box' }} />
        <div style={{ position: 'absolute', left: PXL + 40, top: PYT + 24, fontSize: 28, fontWeight: 700, color: INK.faint }}>broker nhớ · producer 16 · P0</div>
        <div style={{ position: 'absolute', left: PXL + 40, top: PYT + 76, fontSize: 30, fontWeight: 700, color: INK.faint }}>seq cuối đã ghi</div>
        <div style={{ position: 'absolute', left: PXL + 40, top: PYT + 110, fontFamily: MONO, fontSize: 92, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 30px rgba(91,151,255,0.7)' }}>{seq === null ? '—' : seq}</div>
        <LogTape x={PXL + 40} y={PYT + 270} cells={2} cellW={340} state={() => 'empty'} tick={1} offsetOf={(i) => [0, 120][i]} />
      </Rise>
      <Block x={PXL + 43} y={PYT + 270} w={334} label="0–119" k={sp(t, arrive1)} mono />
      <Block x={PXL + 383} y={PYT + 270} w={334} label="120–317" k={sp(t, arrive2)} mono />
      {/* flights */}
      <Envelope t={t} at={a1 + 0.8} from={from(0)} to={to} label="0–119" len={0.8} />
      <Envelope t={t} at={a1 + 2.4} from={from(1)} to={to} label="120–317" len={0.8} />
      <Envelope t={t} at={a2 + 0.2} from={from(1)} to={to} label="120–317 (gửi lại)" color={INK.warn} len={0.8} />
      <Envelope t={t} at={a3 + 0.2} from={from(3)} to={to} label="516–694" color={INK.bad} len={0.8} />
      {/* verdict */}
      <Rise t={t} at={a2 + 1.0}>
        <div style={{ ...INK.card, position: 'absolute', left: PXL, top: 710, width: PW, height: 190, boxSizing: 'border-box' }} />
      </Rise>
      <O o={verdictDup}>
        <Icon3D name="tick" x={PXL + 100} y={805} size={130} t={t} at={a2 + 1.0} />
        <div style={{ position: 'absolute', left: PXL + 190, top: 748, fontSize: 46, fontWeight: 800, color: INK.good, whiteSpace: 'nowrap' }}>đã có → bỏ qua</div>
        <div style={{ position: 'absolute', left: PXL + 190, top: 810, fontFamily: MONO, fontSize: 32, fontWeight: 700, color: INK.faint, whiteSpace: 'nowrap' }}>120–317 ≤ 317</div>
      </O>
      <O o={verdictRej}>
        <Icon3D name="thumb-down" x={PXL + 100} y={805} size={130} t={t} at={a3 + 1.0} />
        <div style={{ position: 'absolute', left: PXL + 190, top: 748, fontSize: 46, fontWeight: 800, color: INK.bad, whiteSpace: 'nowrap' }}>nhảy cóc → từ chối</div>
        <div style={{ position: 'absolute', left: PXL + 190, top: 810, fontFamily: MONO, fontSize: 32, fontWeight: 700, color: INK.faint, whiteSpace: 'nowrap' }}>516 ≠ 318 (đang chờ)</div>
      </O>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 5. limits */

const LM = { xs: [130, 700, 1270], w: 520, cy: 370, h: 430 }

function limits(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const d2 = c.end(2) - a2
  const { xs, w, cy, h } = LM
  const shrink = move(t, a1 - 0.3, 0.9)
  const tileY = lerp(400, 225, shrink)
  const tileH = lerp(250, 100, shrink)
  const iconS = lerp(130, 74, shrink)
  const tiles = [
    { icon: 'toggle' as const, l1: 'enable.idempotence', l2: '= true', at: a0 + 0.4 },
    { icon: 'flag' as const, l1: 'mặc định', l2: 'từ Kafka 3.0', at: a0 + 1.8 },
    { icon: 'shield' as const, l1: 'cần', l2: 'acks = all', at: a0 + 3.0 },
  ]
  const retryAt = a1 + 1.3
  const t2 = { b1: a2 + 0.4, b2: a2 + d2 * 0.3, c: a2 + d2 * 0.4, c1: a2 + d2 * 0.4 + 0.4, c2: a2 + d2 * 0.6 }
  const cards = [
    { x: xs[0], head: 'retry · 1 producer', badge: 'CHỐNG ĐƯỢC', ok: true, at: a1, f1: 'pid 16 gửi đơn B', f2: 'bản gửi lại bị bỏ qua ✓', fAt: retryAt + 0.9 },
    { x: xs[1], head: 'restart app', badge: 'KHÔNG CHỐNG', ok: false, at: a2, f1: 'trước khi restart', f2: 'pid mới → coi là khác', fAt: t2.b2 },
    { x: xs[2], head: '2 producer', badge: 'KHÔNG CHỐNG', ok: false, at: t2.c, f1: 'instance A và B', f2: 'mỗi bên một pid', fAt: t2.c2 },
  ]
  const row = (i: number) => cy + 240 + i * 90
  return (
    <SoftScene
      t={t}
      camera={cameraAt(t, [
        [0, { x: 960, y: 560, s: 1.0 }],
        [a1 - 0.2, { x: 930, y: 580, s: 1.04 }, 1.2],
        [a2 - 0.2, WIDE, 1.2],
      ])}
      title={{ kicker: 'GIỚI HẠN', text: 'Idempotence chống được gì?' }}
    >
      {tiles.map((tl, i) => (
        <div key={tl.l1}>
          <Rise t={t} at={tl.at}>
            <div style={{ ...INK.card, position: 'absolute', left: xs[i], top: tileY, width: w, height: tileH, boxSizing: 'border-box' }} />
            <div style={{ position: 'absolute', left: xs[i] + iconS + 36, top: tileY + tileH / 2 - 40, fontFamily: MONO, fontSize: 30, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
              {tl.l1}
              <br />
              <span style={{ color: INK.accent }}>{tl.l2}</span>
            </div>
          </Rise>
          <Icon3D name={tl.icon} x={xs[i] + 20 + iconS / 2} y={tileY + tileH / 2} size={iconS} t={t} at={tl.at + 0.15} />
        </div>
      ))}
      {cards.map((cd) => {
        const swap = span(t, cd.fAt, cd.fAt + 0.35)
        return (
          <div key={cd.head}>
            <Rise t={t} at={cd.at}>
              <div style={{ ...INK.card, position: 'absolute', left: cd.x, top: cy, width: w, height: h, boxSizing: 'border-box', borderColor: cd.ok ? INK.good : INK.bad }} />
              <div style={{ position: 'absolute', left: cd.x + 30, top: cy + 28, fontSize: 36, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>{cd.head}</div>
              <div style={{ position: 'absolute', left: cd.x + 30, top: cy + 90, padding: '6px 20px', borderRadius: 999, fontSize: 28, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', background: 'rgba(8,22,82,0.92)', border: `1.5px solid ${cd.ok ? INK.good : INK.bad}`, boxShadow: `0 0 16px ${cd.ok ? INK.good : INK.bad}aa` }}>{cd.badge}</div>
              <div style={{ position: 'absolute', left: cd.x + 30, top: cy + 160, fontSize: 28, fontWeight: 700, whiteSpace: 'nowrap' }}>
                <span style={{ color: INK.faint, opacity: 1 - swap }}>{cd.f1}</span>
                <span style={{ position: 'absolute', left: 0, color: cd.ok ? INK.good : INK.bad, opacity: swap }}>{cd.f2}</span>
              </div>
              {Array.from({ length: 2 }, (_, r) => (
                <div key={r} style={{ position: 'absolute', left: cd.x + 30, top: row(r), width: w - 60, height: 70, boxSizing: 'border-box', borderRadius: 16, border: '1.5px solid rgba(110,160,255,0.35)', background: 'rgba(12,30,96,0.55)' }} />
              ))}
            </Rise>
            <Icon3D name={cd.ok ? 'shield' : 'thumb-down'} x={cd.x + w - 85} y={cy + 85} size={112} t={t} at={cd.at + (cd.ok ? 0.5 : 2.2)} />
          </div>
        )
      })}
      {/* card 1: original, then the retry is dropped */}
      <Block x={xs[0] + 30} y={row(0)} w={w - 60} label="đơn B · pid 16" k={sp(t, a1 + 0.5)} size={30} />
      <Envelope t={t} at={retryAt} from={{ x: xs[0] + w / 2, y: cy + h + 40 }} to={{ x: xs[0] + w / 2, y: row(1) + 35 }} label="pid 16 · lại" color={INK.warn} len={0.9} arc={0} />
      <O o={sp(t, retryAt + 0.9)}>
        <div style={{ position: 'absolute', left: xs[0] + 30, top: row(1), width: w - 60, height: 70, boxSizing: 'border-box', borderRadius: 16, border: `2px dashed ${INK.good}`, display: 'grid', placeItems: 'center', fontSize: 30, fontWeight: 800, color: INK.good }}>bỏ qua ✓</div>
      </O>
      {/* card 2 */}
      <Block x={xs[1] + 30} y={row(0)} w={w - 60} label="đơn B · pid 16" k={sp(t, t2.b1)} size={30} />
      <Block x={xs[1] + 30} y={row(1)} w={w - 60} label="đơn B · pid 17" k={sp(t, t2.b2)} tint={span(t, t2.b2 + 0.2, t2.b2 + 0.6)} size={30} />
      {/* card 3 */}
      <Block x={xs[2] + 30} y={row(0)} w={w - 60} label="đơn B · pid 16" k={sp(t, t2.c1)} size={30} />
      <Block x={xs[2] + 30} y={row(1)} w={w - 60} label="đơn B · pid 22" k={sp(t, t2.c2)} tint={span(t, t2.c2 + 0.2, t2.c2 + 0.6)} size={30} />
      <Say y={905} text="muốn hơn → transaction (Module 6)" color="#bfd6ff" size={52} o={sp(t, c.end(2) - 1.6)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 6. summary */

function summary(t: number, c: Cue) {
  return (
    <SoftTheme>
      <SummaryList t={t} cue={c} items={['acks: khi nào là gửi xong', 'acks=1 có thể mất tin đã báo OK', 'producerId + seq: bỏ trùng, giữ thứ tự', 'Idempotence chỉ trong một phiên producer']} />
    </SoftTheme>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { hook, levels, loss: lossScene, duplicate, sequence, limits, summary }

/** Key-moment sounds, timed to the same cue offsets the scenes animate on. */
const SFX: Record<string, SceneSfx[]> = {
  hook: [
    { kind: 'ding', at: (c) => c.at(0) + 2.7 },
    { kind: 'error', at: (c) => c.at(1) + 0.9 },
    { kind: 'error', at: (c) => c.at(1) + 3.0 },
  ],
  levels: [
    { kind: 'tick', at: (c) => c.at(1) + 0.7 },
    { kind: 'tick', at: (c) => c.at(2) + 1.5 },
    { kind: 'ding', at: (c) => c.at(3) + 2.4 },
  ],
  loss: [
    { kind: 'error', at: (c) => c.at(1) + 1.8 },
    { kind: 'error', at: (c) => c.at(2) + 0.6 },
    { kind: 'ding', at: (c) => c.at(3) + 3.8 },
  ],
  duplicate: [
    { kind: 'error', at: (c) => c.at(1) + 1.7 },
    { kind: 'error', at: (c) => c.at(2) + 1.5 },
  ],
  sequence: [
    { kind: 'ding', at: (c) => c.at(2) + 1.0 },
    { kind: 'error', at: (c) => c.at(3) + 1.0 },
  ],
  limits: [
    { kind: 'ding', at: (c) => c.at(1) + 2.2 },
    { kind: 'error', at: (c) => c.at(2) + (c.end(2) - c.at(2)) * 0.3 + 0.2 },
    { kind: 'error', at: (c) => c.at(2) + (c.end(2) - c.at(2)) * 0.6 + 0.2 },
  ],
}

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const acksIdempotenceLesson: Lesson = {
  ...acksIdempotenceScript,
  scenes: acksIdempotenceScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id], sfx: SFX[s.id] })),
  intro: [
    { kind: 'video', scenes: ['hook'] },
    {
      kind: 'quiz',
      title: 'Quick Quiz',
      questions: [
        q('Đoán trước khi học: broker đã trả OK, vì sao tin vẫn có thể mất?', ['Vì consumer xoá tin', 'Vì OK chỉ có nghĩa leader đã ghi, bản sao chưa kịp chép', 'Vì tin bị nén', 'Vì retention quá ngắn'], 1, 'Đúng hướng. Phần 1–2 giải thích "OK" nghĩa là gì với từng mức acks.'),
      ],
    },
  ],
  roadmap: [
    'Chặng 1: Ba mức acks, và vì sao acks=1 có thể mất tin đã báo OK.',
    'Chặng 2: Retry để không mất — nhưng retry lại sinh trùng.',
    'Chặng 3: Idempotence đánh số thùng để retry an toàn, và giới hạn của nó.',
  ],
  sections: [
    {
      id: 'ba-muc-acks',
      title: 'Ba mức acks',
      blocks: [
        { kind: 'video', scenes: ['levels'] },
        {
          kind: 'table',
          head: ['`acks`', 'Producer coi là thành công khi', 'Hình ảnh bưu điện'],
          rows: [
            ['`0`', '**Không chờ gì**, gửi đi là xong', 'bỏ thư vào thùng thư ven đường'],
            ['`1`', '**Leader** đã ghi', 'gửi thường, nhân viên quầy nhận'],
            ['`all` (= `-1`)', 'Leader **và mọi bản sao đồng bộ** (ISR) đã có', 'thư bảo đảm, ký nhận đủ các bên'],
          ],
        },
        {
          kind: 'callout',
          tone: 'info',
          text: 'Mặc định là `acks=all` **từ Kafka 3.0** (trước đó là `1`). Trên cụm 1 broker như lab, `1` và `all` gần như giống nhau vì không có bản sao nào để chờ.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Với acks=0, producer có retry được không?', ['Có, như bình thường', 'Retry vô nghĩa vì producer không biết tin có tới hay không', 'Chỉ retry khi leader chết', 'Chỉ retry 1 lần'], 1, 'Không chờ trả lời thì không có gì để biết là phải gửi lại.')],
        },
      ],
    },
    {
      id: 'acks-1-mat-tin',
      title: 'acks=1 mất tin thế nào',
      blocks: [
        { kind: 'video', scenes: ['loss'] },
        {
          kind: 'code',
          code: 't=0  Leader (broker 1) ghi offset 100–199 → trả "OK"\nt=1  Producer nhận OK, coi như xong, không giữ lại\nt=2  Broker 1 chết TRƯỚC KHI follower (broker 2) kịp chép\nt=3  Broker 2 lên làm leader: không có offset 100–199\n     → 100 tin MẤT, dù producer đã nhận "OK"',
        },
        {
          kind: 'callout',
          tone: 'tip',
          text: '`acks` thấp chỉ làm **producer** nhanh hơn, không làm consumer thấy tin sớm hơn: consumer chỉ đọc được tin đã chép đủ sang ISR (high watermark, Module 4). Cái giá của `acks=all` chỉ là thêm một vòng chép sang follower.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Vì sao acks=all tránh được kịch bản trên?', ['Vì nó nén dữ liệu', 'Vì leader chỉ trả OK khi các bản sao đồng bộ đã chép xong', 'Vì nó ghi xuống đĩa ngay', 'Vì nó dùng nhiều partition'], 1, 'Leader mới chắc chắn có tin vì nó đã chép trước khi producer nhận OK.')],
        },
      ],
    },
    {
      id: 'retry-trung',
      title: 'Retry để không mất — nhưng sinh trùng',
      blocks: [
        { kind: 'video', scenes: ['duplicate'] },
        {
          kind: 'p',
          text: 'Producer tự gửi lại khi gặp lỗi tạm thời hoặc hết thời gian chờ. Nhưng "không nhận được trả lời" có hai khả năng: thùng **chưa tới**, hoặc thùng **đã ghi** mà câu trả lời bị mất. Trường hợp sau, gửi lại sẽ tạo **bản ghi thứ hai**. Retry còn có thể **đảo thứ tự** khi nhiều thùng đang bay cùng lúc.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Thùng đã được broker ghi, nhưng câu trả lời OK bị mất trên mạng. Không có idempotence, retry sẽ…', ['Không làm gì', 'Ghi thêm một bản → trùng', 'Xoá bản cũ', 'Báo lỗi cho consumer'], 1, 'Broker không biết đây là bản gửi lại.')],
        },
      ],
    },
    {
      id: 'idempotence',
      title: 'Idempotence: đánh số thùng',
      blocks: [
        {
          kind: 'quiz',
          title: 'Dự đoán trước khi xem',
          questions: [q('Làm sao broker nhận ra một thùng là bản gửi lại?', ['So nội dung từng byte', 'Mỗi thùng mang mã producer và số thứ tự', 'Dựa vào timestamp', 'Không thể nhận ra'], 1, 'Xem video để thấy broker dùng "trí nhớ" số thứ tự thế nào.')],
        },
        { kind: 'video', scenes: ['sequence'] },
        {
          kind: 'code',
          code: 'Thùng 1: producerId 16, seq 0–119    → ghi, nhớ "16 đã đến 119"\nThùng 2: producerId 16, seq 120–317  → ghi, nhớ "đến 317"\n         phản hồi bị MẤT, producer gửi lại thùng 2\nThùng 2 (lần 2): seq 120–317         → "đã có rồi" → không ghi lại ✅\nThùng 4: seq 516–694 trước thùng 3   → "đang chờ 318" → từ chối ✅',
        },
        {
          kind: 'table',
          head: ['Điều kiện', 'Vì sao'],
          rows: [
            ['`acks=all`', 'Chỉ leader ghi rồi chết thì leader mới mất luôn "trí nhớ" số thứ tự'],
            ['`retries > 0`', 'Không retry thì chẳng có gì để chống trùng'],
            ['`max.in.flight.requests.per.connection ≤ 5`', 'Broker chỉ nhớ 5 thùng gần nhất của mỗi producer cho mỗi partition'],
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Bẫy (Kafka 3.2+)',
          text: 'Đặt `acks=1` mà **không** ghi gì về `enable.idempotence` → Kafka **lặng lẽ tắt** idempotence (`producerId: -1`). Ghi rõ `enable.idempotence=true` cùng `acks=1` → producer từ chối khởi động với `ConfigException`.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Broker đang chờ seq 318 mà nhận thùng seq 516–694. Nó làm gì?', ['Ghi luôn', 'Từ chối; producer gửi lại theo đúng thứ tự', 'Xoá thùng 318', 'Bỏ qua lặng lẽ'], 1, 'Nhờ vậy vừa retry thoải mái vừa giữ thứ tự.')],
        },
      ],
    },
    {
      id: 'gioi-han',
      title: 'Idempotence chống được gì, không chống được gì',
      blocks: [
        { kind: 'video', scenes: ['limits'] },
        {
          kind: 'list',
          items: [
            { title: 'Chống được', text: 'Trùng và đảo thứ tự do **retry nội bộ** của **một phiên producer**.' },
            { title: 'Không chống', text: 'App khởi động lại → `producerId` mới. App tự gọi `send()` hai lần cùng nội dung → hai tin.' },
            { title: 'Không chống', text: 'Hai producer (hai instance) cùng gửi một dữ liệu → mỗi bên một `producerId`, mọi tin bị nhân đôi.' },
            { title: 'Giá rất rẻ', text: 'Thêm một lần xin `producerId` lúc khởi động và 96 bit mỗi thùng; với `acks=all` gần như không đổi hiệu năng.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Chạy nhầm hai instance cùng đọc một file rồi đẩy vào Kafka (idempotence bật). Kết quả?', ['Không trùng', 'Mọi tin bị nhân đôi, vì hai producer có producerId khác nhau', 'Chỉ trùng tin đầu', 'Producer báo lỗi'], 1, 'Idempotence chỉ lọc trùng trong cùng một producerId.')],
        },
      ],
    },
    {
      id: 'tom-tat-video',
      title: 'Nhìn lại cả bài',
      blocks: [{ kind: 'video', scenes: ['summary'] }],
    },
  ],
  finalQuiz: [
    q('Trên cluster 3 broker, acks=1. Leader ghi xong, trả OK, rồi chết trước khi follower chép. Điều gì xảy ra?', ['Không mất gì', 'Tin đã báo OK bị mất khi follower lên làm leader', 'Producer tự gửi lại', 'Consumer đọc trùng'], 1, 'Đây là lý do mặc định đổi sang acks=all từ 3.0.'),
    q('Cấu hình nào cần cho idempotence?', ['acks=0', 'acks=all, retries > 0, max.in.flight ≤ 5', 'linger.ms > 0', 'compression=gzip'], 1, 'Mặc định của Kafka 3.0+ đã thoả cả ba.'),
    q('Đặt acks=1 và không ghi gì về enable.idempotence (Kafka 3.9). Kết quả?', ['ConfigException', 'Idempotence bị tắt lặng lẽ', 'acks tự đổi về all', 'Không ảnh hưởng gì'], 1, 'Chỉ khi ghi rõ enable.idempotence=true mới bị từ chối khởi động.'),
    q('App bị restart giữa chừng, gửi lại một lô đã gửi trước đó. Idempotence có lọc được không?', ['Có', 'Không: producerId mới, broker coi là khách khác', 'Chỉ khi acks=all', 'Chỉ lọc 5 thùng gần nhất'], 1, 'Cần transaction / xử lý trùng ở phía consumer.'),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao idempotence cho phép retry mà không trùng tin?',
      keywords: ['producerId', 'số thứ tự', 'broker', 'nhớ'],
      modelAnswer:
        'Vì mỗi producer có một producerId và đánh số thứ tự cho từng tin theo partition. Broker nhớ số cuối cùng đã ghi cho mỗi cặp producerId–partition, nên khi thùng gửi lại mang số đã có, broker nhận ra trùng và không ghi lại; thùng nhảy cóc thì bị từ chối để producer gửi lại đúng thứ tự.',
    },
  ],
  recap: {
    journey:
      'Broker báo OK mà tin vẫn mất → acks quyết định "gửi xong" là khi nào → acks=1 mất tin khi leader chết trước khi chép → acks=all + retry để không mất → retry sinh trùng → idempotence đánh số thùng để bỏ trùng và giữ thứ tự → nhưng chỉ trong một phiên producer.',
    points: [
      { title: 'acks', text: '0 không chờ · 1 leader · all leader + ISR (mặc định từ 3.0).' },
      { title: 'acks=1', text: 'Có thể mất tin đã báo OK khi leader chết.' },
      { title: 'Idempotence', text: 'producerId + seq: bỏ thùng trùng, chặn thùng nhảy cóc.' },
      { title: 'Giới hạn', text: 'Restart hay 2 producer vẫn trùng → transaction (Module 6).' },
    ],
    next: 'Bài tiếp theo (Module 4): Leader, ISR & High Watermark — bản sao thật sự hoạt động thế nào.',
  },
}
