import { cameraAt, clamp, lerp, move, sp, span, vis } from '../player/motion-kit'
import { ConsumerUnit, Envelope, LogTape, Note, Packets, PartitionTapes, ProducerBox, Rise, SOFT, SOFT_PANEL, ServerUnit, SoftScene, SoftTheme, Statement, SummaryList, Wire, type CellState } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene, SceneSfx } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { consumerGroupScript } from './consumer-group-script'

/** This lesson is drawn in the soft light style. */
const INK = SOFT
const panel = SOFT_PANEL
const WIDE = { x: 960, y: 540, s: 1 }
const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN')
const easeIO = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2)

/** Bracket under a run of cells, with a label: used for "one batch" and "lag". */
function Bracket({ x1, x2, y, text, color, o = 1 }: { x1: number; x2: number; y: number; text: string; color: string; o?: number }) {
  const edge = `3px solid ${color}`
  return (
    <div style={{ opacity: clamp(o) }}>
      <div style={{ position: 'absolute', left: x1, top: y, width: x2 - x1, height: 14, borderLeft: edge, borderRight: edge, borderBottom: edge }} />
      <div style={{ position: 'absolute', left: x1 - 200, width: x2 - x1 + 400, top: y + 22, textAlign: 'center', fontSize: 28, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{text}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ 0. cold open: one consumer falls behind */

function hook(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const TX = 640
  const CW = 60
  const CELLS = 12
  const rowY = (p: number) => 250 + p * 160
  const written = (p: number) => Math.min(CELLS, Math.floor(lerp(3, 12.4, span(t, 0.8, c.duration - 0.6)) + (p % 2 ? 0.5 : 0)))
  const read = Math.floor(lerp(0, 2.6, span(t, a1 + 0.6, c.duration)))
  const lag = Math.max(0, (t - a1 - 0.6) * 700)
  const state = (p: number, i: number): CellState => (i < read ? 'dead' : i < written(p) - 1 ? 'filled' : i < written(p) ? 'new' : 'empty')
  const IN = { x: 1480, y: 526 }
  return (
    <SoftScene t={t} camera={cameraAt(t, [
        [0, { x: 620, y: 520, s: 1.3 }],
        [a0 + 1.4, WIDE, 1.6],
        [a1, { x: 1300, y: 500, s: 1.18 }, 1.2],
        [a2, { x: 980, y: 560, s: 1.0 }, 1.3],
      ])}
    >
      <Rise t={t} at={0.2}>
        <ProducerBox x={150} y={470} title="producer" line="1.000 tin/giây" w={330} />
      </Rise>
      <PartitionTapes x={TX} y={250} partitions={4} cells={CELLS} cellW={CW} gap={160} state={state} />
      <div style={{ position: 'absolute', left: TX, top: 180, fontSize: 26, fontWeight: 600, color: INK.faint }}>TOPIC CLICKS</div>
      {[0, 1, 2, 3].map((p) => (
        <div key={`in${p}`}>
          <Wire from={{ x: 490, y: 526 }} to={{ x: TX - 120, y: rowY(p) + 35 }} color={INK.line} p={move(t, 0.5 + p * 0.08, 0.5)} flow={t} />
          <Packets t={t} from={{ x: 490, y: 526 }} to={{ x: TX - 120, y: rowY(p) + 35 }} start={0.9 + p * 0.07} every={0.32} len={0.7} />
        </div>
      ))}
      {[0, 1, 2, 3].map((p) => (
        <div key={`w${p}`}>
          <Wire from={{ x: TX + CELLS * CW + 16, y: rowY(p) + 35 }} to={{ x: IN.x - 14, y: IN.y }} color={INK.line} p={move(t, a1 - 0.3 + p * 0.08, 0.5)} />
          <Packets t={t} from={{ x: TX + CELLS * CW + 16, y: rowY(p) + 35 }} to={{ x: IN.x - 14, y: IN.y }} start={a1 + 0.6 + p * 0.45} every={1.8} len={1.0} color={INK.good} size={18} />
        </div>
      ))}
      <Rise t={t} at={a1 - 0.3}>
        <ConsumerUnit x={IN.x} y={IN.y - 56} name="consumer-1" note="300 tin/s" parts={['P0', 'P1', 'P2', 'P3']} t={t} busy={(t * 1.3) % 1} />
      </Rise>
      <div style={{ ...panel, left: IN.x, top: 330, fontSize: 34, color: lag > 0 ? INK.bad : INK.text, opacity: vis(t, a1 + 0.6) }}>chưa đọc: +{fmt(lag)}</div>
      <Statement x={TX - 90} y={930} text="ghi 1.000/giây · đọc 300/giây → tụt 700 tin mỗi giây" color={INK.warn} size={42} o={sp(t, a2 + 0.8)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 1. the poll loop */

function poll(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const TX = 260
  const CW = 70
  const CELLS = 16
  const BATCH = 4
  const cycle = 2.2
  const run = Math.max(0, t - a1)
  const k = Math.min(2, Math.floor(run / cycle))
  const phase = run - k * cycle
  const active = t >= a1 && run < 3 * cycle
  const polling = active && phase < 0.6
  const batchStart = k * BATCH
  const taken = !active ? (t >= a1 ? 3 * BATCH : 0) : batchStart + (phase >= 0.5 ? BATCH : 0)
  const progress = active ? span(phase, 0.6, cycle) : 0
  const state = (i: number): CellState => (i < taken ? 'dead' : active && i < batchStart + BATCH ? 'new' : 'filled')
  const INTAKE = { x: TX + 10, y: 530 }
  // Timeline: seconds between two polls, 2px per second, limit at 300 s.
  const AX = 260
  const PX = 2
  const okBar = 5 * vis(t, a2 + 3.2)
  const slow = 500 * span(t, a3 + 0.6, a3 + 5.2)
  const kicked = slow > 300
  const codeLine = (on: boolean, text: string) => <div style={{ color: on ? INK.accent : INK.text, fontWeight: on ? 700 : 400 }}>{text}</div>
  return (
    <SoftScene t={t} camera={cameraAt(t, [
        [0, { x: 960, y: 470, s: 1.0 }],
        [a0 + 1.6, { x: 1000, y: 520, s: 1.08 }, 1.4],
        [a1, { x: 800, y: 430, s: 1.15 }, 1.2],
        [a2, { x: 960, y: 640, s: 1.04 }, 1.4],
        [a3 + 4.6, { x: 960, y: 620, s: 0.98 }, 1.4],
      ])} title={{ kicker: 'CONSUMER', text: 'Vòng lặp poll', until: a0 + 1.4 }}>
      <LogTape x={TX} y={200} cells={CELLS} cellW={CW} state={state} title="partition P0 · tin chờ đọc" />
      <Bracket x1={TX + batchStart * CW} x2={TX + (batchStart + BATCH) * CW} y={345} text="1 mẻ · tối đa 500 tin" color={INK.accent} o={active ? vis(t, a1 + 0.1) : 0} />
      {/* the batch flies from the tape into the consumer */}
      {active &&
        Array.from({ length: BATCH }, (_, j) => {
          const p = span(phase, j * 0.06, 0.45 + j * 0.06)
          if (p <= 0 || p >= 1) return null
          const e = easeIO(p)
          const sx = TX + (batchStart + j + 0.5) * CW
          return <div key={j} style={{ position: 'absolute', left: lerp(sx, INTAKE.x, e) - 14, top: lerp(275, INTAKE.y, e) - 14 - Math.sin(Math.PI * e) * 60, width: 28, height: 28, borderRadius: 4, background: INK.accent, boxShadow: `0 0 14px ${INK.accent}aa` }} />
        })}
      <Rise t={t} at={0.6}>
        <ConsumerUnit x={TX} y={474} w={560} name="consumer-1" t={t} down={kicked} note={kicked ? 'bị loại khỏi group' : polling ? 'poll() → lấy mẻ mới' : active ? `xử lý mẻ ${k + 1}…` : 'poll()'} busy={kicked ? undefined : progress} />
      </Rise>
      <Rise t={t} at={a0 + 1.2}>
        <div style={{ ...panel, left: 1000, top: 450, fontSize: 28, fontWeight: 400, lineHeight: 1.6, whiteSpace: 'pre', fontFamily: MONO }}>
          {codeLine(false, 'while (true) {')}
          {codeLine(polling || (t > a0 + 1.6 && t < a1), '  records = consumer.poll(…)')}
          {codeLine(active && !polling, '  for (r : records) process(r)')}
          {codeLine(false, '}')}
        </div>
      </Rise>
      {/* timeline: time between two poll() calls */}
      <div style={{ opacity: vis(t, a2 + 0.4) }}>
        <div style={{ position: 'absolute', left: AX, top: 660, fontWeight: 600, fontSize: 28, color: INK.faint }}>thời gian giữa hai lần poll()</div>
        <div style={{ position: 'absolute', left: AX, top: 790, width: 600 * PX, height: 2, background: INK.line }} />
        {[0, 100, 200, 300, 400, 500, 600].map((s) => (
          <div key={s} style={{ position: 'absolute', left: AX + s * PX - 40, width: 80, top: 890, textAlign: 'center', fontFamily: MONO, fontSize: 28, color: INK.faint }}>
            {s}s
          </div>
        ))}
        <div style={{ position: 'absolute', left: AX + 300 * PX - 1, top: 710, width: 3, height: 180, background: INK.bad }} />
        <div style={{ position: 'absolute', left: AX + 300 * PX + 12, top: 700, fontFamily: MONO, fontSize: 28, color: INK.bad }}>max.poll.interval.ms = 300s</div>
        <div style={{ position: 'absolute', left: AX, top: 752, width: Math.max(6, okBar * PX), height: 24, background: INK.good, opacity: vis(t, a2 + 3.2) }} />
        <div style={{ position: 'absolute', left: AX + 26, top: 746, fontFamily: MONO, fontSize: 28, color: INK.good, opacity: vis(t, a2 + 3.4) }}>500 × 10ms = 5s ✓</div>
        <div style={{ position: 'absolute', left: AX, top: 810, width: slow * PX, height: 24, background: kicked ? INK.bad : INK.warn, opacity: vis(t, a3 + 0.5), boxShadow: kicked ? `0 0 18px ${INK.bad}66` : undefined }} />
        <div style={{ position: 'absolute', left: AX + slow * PX + 16, top: 804, fontFamily: MONO, fontSize: 28, color: kicked ? INK.bad : INK.warn, opacity: vis(t, a3 + 0.6), whiteSpace: 'nowrap' }}>500 × 1s = {Math.round(slow)}s{kicked ? ' ✕' : ''}</div>
      </div>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 2. one partition, one consumer per group */

function group(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const half = a2 + (c.end(2) - a2) * 0.5
  const TX = 300
  const CW = 64
  const END = TX + 9 * CW + 16
  const n = t < a2 ? 1 : t < half ? 2 : t < a3 ? 4 : 5
  const owner = (p: number) => (n === 1 ? 0 : n === 2 ? (p < 2 ? 0 : 1) : p)
  const since = t < a2 ? a0 + 0.8 : t < half ? a2 : t < a3 ? half : a3
  const rowY = (p: number) => 240 + p * 170 + 35
  const unitY = (k: number) => 200 + k * 150
  const joinAt = [a0 + 0.4, a2, half, half + 0.15, a3]
  return (
    <SoftScene t={t} camera={cameraAt(t, [
        [0, WIDE],
        [a1, { x: 960, y: 470, s: 1.08 }, 1.3],
        [a2, WIDE, 1.2],
        [a3, { x: 1000, y: 600, s: 1.05 }, 1.3],
      ])} title={{ kicker: 'CONSUMER GROUP', text: 'Mỗi partition: đúng một người', until: a1 }}>
      <div style={{ position: 'absolute', left: 120, top: 190, fontSize: 26, fontWeight: 600, color: INK.faint }}>TOPIC CLICKS</div>
      <PartitionTapes x={TX} y={240} partitions={4} cells={9} cellW={CW} gap={170} state={(_, i) => (i < 7 ? 'filled' : 'empty')} />
      <div style={{ position: 'absolute', left: 1250, top: 160, width: 470, height: 800, border: `2px dashed ${INK.line}`, borderRadius: 36, background: 'rgba(20,44,130,0.28)', opacity: vis(t, a0 + 0.4) }}>
        <div style={{ position: 'absolute', left: 28, top: -24, padding: '6px 18px', borderRadius: 999, background: 'rgba(8,22,82,0.95)', border: '1.5px solid #6ea2ff', boxShadow: '0 0 16px rgba(77,141,255,0.6)', fontFamily: MONO, fontSize: 22, color: '#ffffff' }}>group.id = g-clicks</div>
      </div>
      {[0, 1, 2, 3].map((p) => {
        const from = { x: END, y: rowY(p) }
        const to = { x: 1292, y: unitY(owner(p)) + 56 }
        const focus = t < a1 || t >= a2 || p === 0
        return (
          <div key={`${p}-${n}`} style={{ opacity: focus ? 1 : 0.25 }}>
            <Wire from={from} to={to} color={INK.accent} p={move(t, since + p * 0.08, 0.5)} flow={t} />
            <Packets t={t} from={from} to={to} start={since + 0.6 + p * 0.11} every={0.55} len={0.9} size={18} />
          </div>
        )
      })}
      {[0, 1, 2, 3, 4].map((k) => {
        if (k >= n) return null
        const parts = [0, 1, 2, 3].filter((p) => owner(p) === k).map((p) => `P${p}`)
        return (
          <Rise key={k} t={t} at={joinAt[k]}>
            <ConsumerUnit x={1300} y={unitY(k)} w={380} name={`C${k + 1}`} parts={parts} idle={!parts.length} t={t} />
          </Rise>
        )
      })}
      <Note x={(END + 1292) / 2} y={rowY(0) + 2} dx={-40} dy={-70} text="P0 → chỉ một người đọc" color={INK.accent} o={vis(t, a1 + 0.8, a2 - 0.4)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 3. two groups read independently */

function groups(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const TX = 260
  const CW = 70
  const CELLS = 20
  const stop = a1 + 1.2
  const written = Math.floor(lerp(13, 19.5, span(t, 0, c.duration)))
  const billing = lerp(5, 8, span(t, 0, stop))
  const analytics = lerp(0, 17, span(t, a0 + 0.8, c.duration - 0.5))
  const stopped = t >= stop
  const B = { x: 260, y: 720, w: 440 }
  const A = { x: 1080, y: 720, w: 460 }
  return (
    <SoftScene t={t} camera={cameraAt(t, [
        [0, { x: 960, y: 520, s: 1.0 }],
        [a1, { x: 800, y: 560, s: 1.08 }, 1.3],
        [a2, { x: 1120, y: 560, s: 1.08 }, 1.3],
        [a2 + 1.6, { x: 960, y: 580, s: 1.0 }, 1.3],
      ])} title={{ kicker: 'NHIỀU GROUP', text: 'Mỗi group đọc riêng', until: a1 }}>
      <LogTape x={TX} y={370} cells={CELLS} cellW={CW} state={(i) => (i < written ? 'filled' : 'empty')} title="topic orders · P0" marks={[{ at: billing, label: 'billing', color: stopped ? INK.bad : INK.good }]} />
      <div style={{ opacity: vis(t, a0 + 0.6) }}>
        <div style={{ position: 'absolute', left: TX + analytics * CW - 1, top: 400, width: 3, height: 140, background: INK.accent, boxShadow: `0 0 10px ${INK.accent}` }} />
        <div style={{ position: 'absolute', left: TX + analytics * CW - 80, width: 160, top: 540, textAlign: 'center', fontSize: 24, fontWeight: 700, color: INK.accent }}>analytics</div>
      </div>
      <Packets t={t} from={{ x: TX + billing * CW, y: 450 }} to={{ x: B.x + B.w / 2, y: B.y - 6 }} start={0.4} end={stop - 0.6} every={0.5} len={0.8} color={INK.good} size={18} />
      <Packets t={t} from={{ x: TX + analytics * CW, y: 560 }} to={{ x: A.x + A.w / 2, y: A.y - 6 }} start={a0 + 0.9} every={0.4} len={0.7} size={18} />
      <Rise t={t} at={0.3}>
        <ConsumerUnit x={B.x} y={B.y} w={B.w} name="billing" note={stopped ? '✕ dừng 1 giờ' : `offset ${Math.floor(billing)}`} down={stopped} t={t} parts={[`lag ${Math.max(0, written - Math.floor(billing))}`]} />
      </Rise>
      <Rise t={t} at={a0 + 0.6}>
        <ConsumerUnit x={A.x} y={A.y} w={A.w} name="analytics" note={`offset ${Math.floor(analytics)} · từ đầu`} accent={INK.accent} t={t} busy={(t * 1.6) % 1} parts={['đọc bình thường']} />
      </Rise>
      <Statement x={TX} y={930} text="mỗi group một vị trí đọc riêng · không ảnh hưởng nhau" color={INK.good} size={42} o={sp(t, a2 + 1.9)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 4. JoinGroup / SyncGroup */

function join(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const d1 = c.end(1) - a1
  const COORD = { x: 960, y: 380 }
  const xs = [260, 780, 1300]
  const UY = 680
  const top = (k: number) => ({ x: xs[k] + 180, y: UY - 8 })
  const leaderAt = a1 + 2.0
  const listAt = a1 + d1 * 0.55
  const syncAt = a2 + 1.4
  const arrive = (k: number) => syncAt + 0.9 + k * 0.25 + 0.8
  const parts = [['P0', 'P1'], ['P2'], ['P3']]
  return (
    <SoftScene t={t} camera={cameraAt(t, [
        [0, { x: 960, y: 520, s: 1.0 }],
        [a0 + 0.6, { x: 960, y: 460, s: 1.15 }, 1.3],
        [a1, WIDE, 1.2],
        [a2, { x: 960, y: 620, s: 1.04 }, 1.2],
        [syncAt + 0.4, WIDE, 1.3],
      ])} title={{ kicker: 'AI CHIA?', text: 'JoinGroup → SyncGroup', until: a2 }}>
      <Rise t={t} at={a0 + 0.3}>
        <ServerUnit x={830} y={220} name="coordinator" t={t} />
      </Rise>
      {xs.map((_, k) => (
        <Wire key={k} from={top(k)} to={{ x: COORD.x + (k - 1) * 70, y: COORD.y }} color={INK.line} p={move(t, a1, 0.6)} />
      ))}
      {xs.map((_, k) => (
        <Envelope key={`j${k}`} t={t} at={a1 + 0.3 + k * 0.4} from={top(k)} to={{ x: COORD.x + (k - 1) * 70, y: COORD.y }} label="JoinGroup" />
      ))}
      <Envelope t={t} at={listAt} from={COORD} to={top(0)} label="thành viên: C1, C2, C3" color={INK.warn} len={1.0} />
      <Envelope t={t} at={syncAt} from={top(0)} to={COORD} label="SyncGroup" color={INK.good} len={0.9} />
      {xs.map((_, k) => (
        <Envelope key={`s${k}`} t={t} at={syncAt + 0.9 + k * 0.25} from={COORD} to={top(k)} label={parts[k].join(' ')} color={INK.good} len={0.8} />
      ))}
      {xs.map((x, k) => (
        <Rise key={x} t={t} at={a0 + 0.9 + k * 0.2}>
          <ConsumerUnit x={x} y={UY} w={360} name={`C${k + 1}`} note={k === 0 && t >= leaderAt ? '★ trưởng nhóm' : undefined} accent={k === 0 && t >= leaderAt ? INK.warn : INK.good} parts={t >= arrive(k) ? parts[k] : undefined} t={t} />
        </Rise>
      ))}
      <Rise t={t} at={a2 + 0.4}>
        <div style={{ ...panel, left: 260, top: 830, fontSize: 30, fontWeight: 400, lineHeight: 1.5, whiteSpace: 'pre', borderColor: INK.warn }}>
          <div style={{ color: INK.warn, fontWeight: 700 }}>bảng chia · chỉ C1 thấy</div>
          {'C1 → P0 P1   C2 → P2   C3 → P3'}
        </div>
      </Rise>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 5. lag */

function lagScene(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const TX = 260
  const CW = 70
  const off = (i: number) => 90 + i * 2
  const committed = lerp(3, 5, span(t, a0, a1))
  const hw = lerp(15, 17.5, span(t, a0, a1))
  const lag = Math.round((off(hw) - off(committed)) * 1)
  const chart = (x: number, title: string, color: string, pts: number[], p: number, o: number) => {
    const W = 600
    const H = 230
    const n = Math.max(2, Math.ceil(pts.length * clamp(p)))
    const xy = (i: number) => [(i / (pts.length - 1)) * W, H - pts[i] * H]
    const d = pts.slice(0, n).map((_, i) => xy(i).join(',')).join(' ')
    const [hx, hy] = xy(n - 1)
    return (
      <div style={{ position: 'absolute', left: x, top: 600, opacity: clamp(o) }}>
        <div style={{ fontSize: 28, fontWeight: 700, color, marginBottom: 14 }}>{title}</div>
        <svg width={W + 10} height={H + 10} style={{ overflow: 'visible' }}>
          <line x1={0} y1={H} x2={W} y2={H} stroke={INK.line} strokeWidth={2} />
          <line x1={0} y1={0} x2={0} y2={H} stroke={INK.line} strokeWidth={2} />
          <polyline points={`0,${H} ${d} ${hx},${H}`} fill={`${color}18`} stroke="none" />
          <polyline points={d} fill="none" stroke={color} strokeWidth={4} strokeLinejoin="round" />
          <circle cx={hx} cy={hy} r={8} fill={color} style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
        </svg>
        <div style={{ fontWeight: 600, fontSize: 26, color: INK.faint, marginTop: 6 }}>lag theo thời gian →</div>
      </div>
    )
  }
  const rising = Array.from({ length: 24 }, (_, i) => 0.08 + (i / 23) * 0.82 + Math.sin(i * 1.7) * 0.03)
  const falling = Array.from({ length: 24 }, (_, i) => Math.max(0, 0.85 * (1 - i / 18)) + Math.sin(i * 1.3) * 0.02)
  return (
    <SoftScene t={t} camera={cameraAt(t, [
        [0, { x: 960, y: 520, s: 1.0 }],
        [a1, { x: 960, y: 420, s: 1.12 }, 1.2],
        [a2, { x: 960, y: 600, s: 1.04 }, 1.3],
      ])} title={{ kicker: 'LAG', text: 'Đội có đọc kịp không?', until: a2 }}>
      <div style={{ position: 'absolute', left: TX, top: 200, fontSize: 26, fontWeight: 600, color: INK.faint }}>P0 · GROUP G-REPORT</div>
      <LogTape x={TX} y={320} cells={20} cellW={CW} state={(i) => (i < Math.floor(committed) ? 'dead' : i < hw ? 'filled' : 'empty')} offsetOf={off} marks={[{ at: committed, label: `đọc ${Math.round(off(committed))}`, color: INK.accent }, { at: hw, label: `HW ${Math.round(off(hw))}`, color: INK.good }]} />
      <Packets t={t} from={{ x: TX + 20 * CW + 80, y: 355 }} to={{ x: TX + hw * CW, y: 355 }} start={0.6} end={a1} every={0.3} len={0.6} size={18} />
      <Bracket x1={TX + committed * CW} x2={TX + hw * CW} y={430} text={`lag = HW − đã đọc = ${lag}`} color={INK.warn} o={vis(t, a0 + 0.8)} />
      {chart(260, 'lag tăng đều → đọc chậm hơn ghi', INK.bad, rising, span(t, a2 + 1.0, a2 + 4.0), vis(t, a2 + 0.4) * (t >= a3 ? 0.45 : 1))}
      {chart(1060, 'lag giảm về 0 → đang theo kịp', INK.good, falling, span(t, a3 + 0.2, a3 + 2.2), vis(t, a3))}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 6. summary */

function summary(t: number, c: Cue) {
  return (
    <SoftTheme>
      <SummaryList t={t} cue={c} items={['Consumer tự kéo bằng poll(), poll đều đặn', 'Trong group: mỗi partition đúng 1 consumer', 'Thừa consumer: phần dư ngồi chơi', 'Group đọc độc lập · nhìn xu hướng lag']} />
    </SoftTheme>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { hook, poll, group, groups, join, lag: lagScene, summary }

/** Key-moment sounds, timed to the same cue offsets the scenes animate on. */
const SFX: Record<string, SceneSfx[]> = {
  hook: [{ kind: 'error', at: (c) => c.at(2) + 0.4 }],
  poll: [
    { kind: 'ding', at: (c) => c.at(2) + 3.2 },
    // the slow bar crosses the 300 s limit at 60% of its 4.6 s growth
    { kind: 'error', at: (c) => c.at(3) + 0.6 + 4.6 * 0.6 },
  ],
  group: [{ kind: 'tick', at: (c) => c.at(2) + (c.end(2) - c.at(2)) * 0.5 }],
  groups: [{ kind: 'error', at: (c) => c.at(1) + 1.2 }],
  join: [
    { kind: 'tick', at: (c) => c.at(1) + (c.end(1) - c.at(1)) * 0.55 },
    { kind: 'ding', at: (c) => c.at(2) + 1.4 + 0.9 + 0.8 },
  ],
}

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const consumerGroupLesson: Lesson = {
  ...consumerGroupScript,
  scenes: consumerGroupScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id], sfx: SFX[s.id] })),
  intro: [
    { kind: 'video', scenes: ['hook'] },
    {
      kind: 'quiz',
      title: 'Quick Quiz',
      questions: [q('Đoán trước khi học: topic 4 partition, muốn đọc nhanh hơn thì thêm tối đa bao nhiêu consumer cùng group là còn có ích?', ['2', '4', '8', 'Không giới hạn'], 1, 'Mỗi partition chỉ giao cho một consumer trong group, nên quá 4 thì phần dư ngồi chơi. Phần 2 giải thích.')],
    },
  ],
  roadmap: [
    'Chặng 1: Consumer kéo tin thế nào — vòng lặp poll và vì sao phải poll đều đặn.',
    'Chặng 2: Consumer group chia partition — mỗi partition một người, thừa thì ngồi chơi, group khác đọc độc lập.',
    'Chặng 3: Ai chia (coordinator, trưởng nhóm, thuật toán chia) và đọc lag để biết đội có theo kịp không.',
  ],
  sections: [
    {
      id: 'vong-lap-poll',
      title: 'Vòng lặp poll: consumer tự kéo tin',
      blocks: [
        { kind: 'video', scenes: ['poll'] },
        { kind: 'p', text: 'Kafka **không đẩy** tin đến consumer. Consumer tự hỏi, giống follower ở Module 4. Vì thế consumer tự quyết định tốc độ đọc, và broker không phải giữ hàng đợi cho consumer chậm.' },
        { kind: 'code', code: 'consumer.subscribe(List.of("orders"));\nwhile (true) {\n    var records = consumer.poll(Duration.ofMillis(100)); // 1. lấy một mẻ tin\n    for (var r : records) {\n        process(r);                                      // 2. xử lý từng tin\n    }\n    // 3. ghi lại đã xử lý đến đâu: Module 6\n}' },
        {
          kind: 'list',
          items: [
            { title: 'Lần đầu', text: '`poll()` tìm coordinator, tham gia group, nhận partition được giao.' },
            { title: 'Mỗi lần', text: 'trả về **tối đa** `max.poll.records` tin (mặc định **500**), lấy từ bộ đệm consumer đã tải sẵn.' },
            { title: 'Tín hiệu sống', text: 'quá `max.poll.interval.ms` (mặc định **300 giây**) không gọi `poll()` thì consumer bị coi là treo và bị loại khỏi group.' },
          ],
        },
        { kind: 'callout', tone: 'info', title: 'Duration trong poll() không phải chu kỳ đọc', text: 'Đó là thời gian **chờ tối đa** khi bộ đệm chưa có tin. Có tin sẵn thì `poll()` trả về ngay; không có thì chờ tối đa chừng đó rồi trả về mẻ rỗng. (📘 sách, ch.4)' },
        {
          kind: 'table',
          head: ['Mỗi tin xử lý', 'Một mẻ 500 tin', 'Kết quả'],
          rows: [
            ['10 ms', '5 giây giữa hai lần poll', 'ổn'],
            ['1 giây', '500 giây', 'vượt 300 giây → bị loại khỏi group'],
            ['1 giây, `max.poll.records=100`', '100 giây', 'ổn trở lại'],
          ],
        },
        { kind: 'callout', tone: 'warn', title: 'Một consumer, một luồng', text: '`KafkaConsumer` không an toàn đa luồng. Muốn 3 consumer thì chạy 3 luồng, mỗi luồng một consumer. Phương thức **duy nhất** được gọi từ luồng khác là `wakeup()`: nó làm `poll()` ném `WakeupException` để luồng chính thoát vòng lặp và tự gọi `close()`. (📘 sách, ch.4)' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Mỗi tin gọi API ngoài mất 2 giây, max.poll.records = 500. Điều gì xảy ra?', ['Ổn, vì poll chạy nền', '1.000 giây giữa hai lần poll, vượt 300 giây nên consumer bị loại khỏi group', 'Broker tự giảm số tin', 'Consumer đọc trùng nhưng không bị loại'], 1, 'Sửa bằng cách giảm max.poll.records (100 × 2 = 200 giây) hoặc tăng max.poll.interval.ms.'),
            q('Ctrl+C: shutdown hook chạy ở luồng khác trong lúc luồng chính đang chờ trong poll(). Hook nên gọi gì?', ['consumer.close()', 'consumer.wakeup()', 'System.exit()', 'consumer.poll(0)'], 1, 'wakeup() là phương thức duy nhất an toàn từ luồng khác; luồng chính bắt WakeupException rồi tự close().'),
          ],
        },
      ],
    },
    {
      id: 'chia-partition',
      title: 'Consumer group: mỗi partition đúng một người',
      blocks: [
        {
          kind: 'quiz',
          title: 'Dự đoán trước khi xem',
          questions: [q('Topic 4 partition, group có 5 consumer. Consumer thứ 5 làm gì?', ['Đọc chung P0 với C1', 'Ngồi chơi, chờ thay người khác', 'Đọc lại từ đầu', 'Bị từ chối vào group'], 1, 'Mỗi partition chỉ giao cho một consumer trong group.')],
        },
        { kind: 'video', scenes: ['group'] },
        { kind: 'p', text: 'Các consumer cùng `group.id` là **một đội**. Mỗi partition được giao cho **đúng một** consumer trong đội, nên thứ tự trong partition được giữ (Module 2) và không ai xử lý trùng. Một consumer có thể nhận nhiều partition.' },
        {
          kind: 'table',
          head: ['Số consumer', 'Cách chia (4 partition)', 'Ghi chú'],
          rows: [
            ['1', 'C1: P0 P1 P2 P3', 'một người làm hết'],
            ['2', 'C1: P0 P1 · C2: P2 P3', 'chia đôi'],
            ['4', 'mỗi người 1 partition', 'tối đa song song'],
            ['5', '4 người 1 partition · C5: không có gì', 'C5 ngồi chơi'],
          ],
        },
        { kind: 'callout', tone: 'tip', title: 'Số consumer làm việc ≤ số partition', text: 'Muốn thêm song song phải **thêm partition** (Module 2), không phải thêm consumer. Consumer dư vẫn có ích: ai chết thì nó vào thay.' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Topic 6 partition, group 8 consumer. Bao nhiêu consumer thực sự đọc?', ['8', '6', '4', '2'], 1, '6 người làm, 2 người ngồi chơi.')],
        },
      ],
    },
    {
      id: 'group-doc-lap',
      title: 'Hai group đọc độc lập',
      blocks: [
        { kind: 'video', scenes: ['groups'] },
        { kind: 'p', text: 'Group khác (`group.id` khác) đọc cùng topic sẽ nhận **toàn bộ** partition, từ đầu đến cuối, không ảnh hưởng group kia. Lý do: vị trí đã đọc được lưu **theo từng group**. Đây là cách một topic phục vụ cùng lúc billing, analytics, search…' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Group billing chết 1 giờ. Group analytics cùng đọc topic orders có bị chậm lại không?', ['Có, vì phải chờ billing', 'Không, mỗi group có vị trí đọc riêng; billing chỉ bị lag', 'Có, vì dùng chung partition', 'Analytics phải đọc thay billing'], 1, 'Hai group hoàn toàn độc lập.')],
        },
      ],
    },
    {
      id: 'ai-chia',
      title: 'Ai chia: coordinator, trưởng nhóm, thuật toán chia',
      blocks: [
        { kind: 'video', scenes: ['join'] },
        {
          kind: 'list',
          ordered: true,
          items: [
            { text: 'Mọi consumer gửi `JoinGroup` đến **group coordinator** (một broker).' },
            { text: 'Coordinator chọn một consumer làm **trưởng nhóm**, thường là người vào đầu tiên, và gửi cho nó danh sách thành viên. (📘 sách, ch.4)' },
            { text: 'Trưởng nhóm (chạy trong **ứng dụng của bạn**) tính bảng chia theo `partition.assignment.strategy`.' },
            { text: 'Trưởng nhóm gửi kết quả qua `SyncGroup`; coordinator chuyển cho từng người. Mỗi người chỉ thấy **phần của mình**.' },
          ],
        },
        { kind: 'callout', tone: 'info', title: 'Coordinator là broker nào?', text: 'Broker đang làm leader của partition `hash(group.id) % 50` trong topic nội bộ `__consumer_offsets` (50 partition mặc định).' },
        {
          kind: 'table',
          head: ['Thuật toán', 'Cách chia', 'Điểm cần nhớ'],
          rows: [
            ['`RangeAssignor`', 'Với **từng topic riêng**, chia các partition liền nhau', 'Lệch tải: người đầu danh sách nhận phần dư của **mỗi** topic'],
            ['`RoundRobinAssignor`', 'Gom mọi partition của mọi topic, chia lần lượt', 'Chênh nhau tối đa 1 partition'],
            ['`StickyAssignor`', 'Chia đều, khi chia lại thì giữ nguyên được bao nhiêu giữ bấy nhiêu', 'Ít di chuyển partition nhất'],
            ['`CooperativeStickyAssignor`', 'Như sticky, theo kiểu cooperative', 'Partition không bị chuyển thì vẫn đọc trong lúc chia lại (bài sau)'],
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Vì sao Kafka (giao thức classic) để consumer trưởng nhóm tính bảng chia thay vì broker?', ['Vì broker quá bận', 'Vì đổi hoặc tự viết thuật toán chia chỉ cần nâng cấp ứng dụng, không cần nâng cấp broker', 'Vì consumer có nhiều RAM hơn', 'Để bảo mật'], 1, 'Thuật toán nằm trong thư viện client.'),
            q('2 consumer đọc 3 topic, mỗi topic 5 partition, dùng RangeAssignor. Mỗi người nhận bao nhiêu?', ['8 và 7', '9 và 6', '10 và 5', '15 và 0'], 1, 'Range chia riêng từng topic 3 + 2, phần dư dồn vào cùng người: 9 và 6. RoundRobin cho 8 và 7.'),
          ],
        },
      ],
    },
    {
      id: 'lag',
      title: 'Consumer lag',
      blocks: [
        { kind: 'video', scenes: ['lag'] },
        { kind: 'p', text: '**Lag** = consumer còn tụt sau bao xa trên mỗi partition: `lag = HW − vị trí group đã ghi nhận (committed offset)`. Lag tính theo **từng partition và từng group**.' },
        {
          kind: 'table',
          head: ['PARTITION', 'CURRENT-OFFSET', 'LOG-END-OFFSET', 'LAG'],
          rows: [
            ['0', '100', '125', '25'],
            ['1', '60', '75', '15'],
          ],
        },
        { kind: 'callout', tone: 'tip', title: 'Xu hướng quan trọng hơn con số', text: 'Lag 10.000 mà đang giảm thì ổn; lag 100 mà tăng đều thì sắp có chuyện. (Cột `LOG-END-OFFSET` của `kafka-consumer-groups.sh` thực ra là HW.) Committed offset chi tiết ở Module 6.' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Group có 1 consumer bị treo. Sau khoảng 5 phút điều gì xảy ra với lag các partition của nó?', ['Tăng mãi', 'Consumer bị loại, partition được chia cho người khác, lag bắt đầu giảm', 'Về 0 ngay', 'Không đổi'], 1, 'Sau max.poll.interval.ms, rebalance giao partition cho người còn lại.')],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: tự chia partition',
      blocks: [
        { kind: 'p', text: 'Đổi số partition, số consumer, số topic và thuật toán chia. Xem ai nhận gì, ai ngồi chơi, và cả đội có đọc kịp tốc độ ghi không.' },
        { kind: 'widget', name: 'group-lab' },
      ],
    },
    {
      id: 'tom-tat-video',
      title: 'Nhìn lại cả bài',
      blocks: [{ kind: 'video', scenes: ['summary'] }],
    },
  ],
  finalQuiz: [
    q('Kafka đưa tin đến consumer thế nào?', ['Broker đẩy liên tục', 'Consumer tự kéo bằng poll()', 'Qua coordinator', 'Qua producer'], 1, 'Consumer kéo, tự điều tốc.'),
    q('Quá max.poll.interval.ms không gọi poll() thì sao?', ['Không sao', 'Consumer bị coi là treo và bị loại khỏi group', 'Broker xoá tin', 'Producer dừng ghi'], 1, 'poll() đều đặn là tín hiệu "tôi vẫn làm việc".'),
    q('Topic 4 partition, group 2 consumer với RoundRobin. Chia thế nào?', ['C1: 4, C2: 0', 'Mỗi người 2 partition', 'C1: 3, C2: 1', 'Cả hai đọc cả 4'], 1, 'Chia đều.'),
    q('Ai tính bảng chia partition trong giao thức classic?', ['Controller', 'Group coordinator', 'Consumer trưởng nhóm', 'Producer'], 2, 'Coordinator chỉ điều phối; trưởng nhóm tính.'),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao thêm consumer vượt quá số partition không làm group đọc nhanh hơn?',
      keywords: ['partition', 'một', 'consumer', 'ngồi'],
      modelAnswer: 'Vì trong một group mỗi partition chỉ giao cho đúng một consumer để giữ thứ tự và không đọc trùng. Hết partition để chia thì consumer dư không nhận gì, chỉ ngồi chơi làm dự bị. Muốn song song hơn phải thêm partition.',
    },
  ],
  recap: {
    journey:
      'Một consumer không đọc kịp 1.000 tin/giây → consumer kéo bằng poll và phải poll đều đặn → consumer group chia partition, mỗi partition một người, thừa thì ngồi chơi → group khác đọc độc lập → coordinator và trưởng nhóm chia qua JoinGroup/SyncGroup → nhìn xu hướng lag để biết đội có theo kịp.',
    points: [
      { title: 'Poll', text: 'Consumer tự kéo, mỗi mẻ tối đa 500 tin; quá 300 giây không poll thì bị loại.' },
      { title: 'Group', text: 'Mỗi partition đúng một consumer; số consumer làm việc ≤ số partition.' },
      { title: 'Độc lập', text: 'Mỗi group có vị trí đọc riêng.' },
      { title: 'Lag', text: 'HW − committed; nhìn xu hướng, không nhìn một con số.' },
    ],
    next: 'Bài tiếp theo: Rebalance — khi nào chia lại, eager và cooperative, static membership.',
  },
}
