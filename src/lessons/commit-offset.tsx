import { cameraAt, clamp, lerp, move, sp, span, vis } from '../player/motion-kit'
import { ConsumerUnit, Envelope, Icon3D, LogTape, Note, Packets, Rise, SOFT, SOFT_PANEL, ServerUnit, SoftScene, SoftTheme, Statement, SummaryList, Wire, HERO, type CellState } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene, SceneSfx } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import type { ReactNode } from 'react'
import { commitOffsetScript } from './commit-offset-script'

/** This lesson is drawn in the navy glow style. */
const INK = SOFT
const panel = SOFT_PANEL
const WIDE = { x: 960, y: 540, s: 1 }
const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN')
const PILL = { background: 'rgba(8,22,82,0.92)', border: '1.5px solid #6ea2ff', boxShadow: '0 0 18px rgba(77,141,255,0.55)', borderRadius: 999, color: '#ffffff' } as const

/** Small glowing label that fades in at `at` (and optionally out at `until`). */
const Tag = ({ t, at, until = Infinity, x, y, text, color = '#ffffff', size = 26, mono = false }: { t: number; at: number; until?: number; x: number; y: number; text: string; color?: string; size?: number; mono?: boolean }) => (
  <div style={{ position: 'absolute', left: x, top: y, padding: '8px 22px', ...PILL, border: `1.5px solid ${color === '#ffffff' ? '#6ea2ff' : color}`, fontSize: size, fontWeight: 800, fontFamily: mono ? MONO : undefined, color, whiteSpace: 'nowrap', opacity: vis(t, at, until, 0.3) }}>{text}</div>
)

/** Bracket under a run of cells, with a label. */
function Bracket({ x1, x2, y, text, color, o = 1, glow = 0 }: { x1: number; x2: number; y: number; text: string; color: string; o?: number; glow?: number }) {
  const edge = `3px solid ${color}`
  return (
    <div style={{ opacity: clamp(o), filter: glow ? `drop-shadow(0 0 ${6 + 14 * glow}px ${color})` : undefined }}>
      <div style={{ position: 'absolute', left: x1, top: y, width: x2 - x1, height: 14, borderLeft: edge, borderRight: edge, borderBottom: edge }} />
      <div style={{ position: 'absolute', left: x1 - 200, width: x2 - x1 + 400, top: y + 22, textAlign: 'center', fontSize: 36, fontWeight: 800, color, whiteSpace: 'nowrap' }}>{text}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ shared helpers */

/** Tape without its built-in offset row (too small); `TapeNums` draws the same numbers larger. */
// The cast is deliberate: an empty label hides the kit's offset row (typed number, but only rendered as text).
const NOTICK = { tick: 1000, offsetOf: (() => '') as unknown as (i: number) => number } as const

/** Offset numbers under a LogTape, 26px, centred on each cell. */
function TapeNums({ x, y, cells, cw, of, size = 26 }: { x: number; y: number; cells: number; cw: number; of: (i: number) => number; size?: number }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y + 78 }}>
      {Array.from({ length: cells }, (_, i) => (
        <span key={i} style={{ position: 'absolute', left: i * cw, width: cw, textAlign: 'center', fontFamily: MONO, fontSize: size, fontWeight: 700, color: INK.faint }}>
          {of(i)}
        </span>
      ))}
    </div>
  )
}

/** Server with a 30px label (the kit label is smaller). */
function Srv({ x, y, name, t, down = false }: { x: number; y: number; name: string; t: number; down?: boolean }) {
  return (
    <>
      <ServerUnit x={x} y={y} name="" t={t} down={down} />
      <div style={{ position: 'absolute', left: x, top: y + 142, width: 260, fontSize: 30, fontWeight: 800, color: down ? INK.bad : INK.text, whiteSpace: 'nowrap' }}>{name}</div>
    </>
  )
}

/** One-shot labelled message flight, like Envelope but with a 30px label. */
function Flight({ t, at, from, to, label, color, len = 0.9 }: { t: number; at: number; from: { x: number; y: number }; to: { x: number; y: number }; label: string; color: string; len?: number }) {
  const p = (t - at) / len
  if (p < 0 || p >= 1) return null
  const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2
  return (
    <div style={{ position: 'absolute', left: lerp(from.x, to.x, e), top: lerp(from.y, to.y, e), transform: 'translate(-50%, -50%)', padding: '10px 26px', ...PILL, border: `1.5px solid ${color}`, boxShadow: `0 0 22px ${color}`, fontSize: 30, fontWeight: 800, whiteSpace: 'nowrap', opacity: Math.min(1, p * 8, (1 - p) * 8) }}>
      {label}
    </div>
  )
}

/** Fixed-width tabular number so digits never shift or smear while counting. */
const Num = ({ n, color }: { n: number; color?: string }) => (
  <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', color }}>{fmt(n)}</span>
)

/** Large line centred on the 1920 stage. */
function CenterLine({ t, at, y, text, color, size = 60, pulse = 0 }: { t: number; at: number; y: number; text: string; color: string; size?: number; pulse?: number }) {
  const k = sp(t, at)
  if (k <= 0) return null
  return (
    <div style={{ position: 'absolute', left: 0, width: 1920, top: y, display: 'flex', justifyContent: 'center', opacity: clamp(k * 1.6), transform: `translateY(${(1 - k) * 24}px) scale(${1 + pulse * 0.03})` }}>
      <span style={{ fontSize: size, fontWeight: 800, letterSpacing: -0.5, color, whiteSpace: 'nowrap', textShadow: `0 0 24px ${color}66` }}>{text}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ 0. cold open: where to resume? */

function hook(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const TX = 300
  const CW = 96
  const TY = 500
  const readN = Math.round(6 * span(t, 0.8, a0 + (c.end(0) - a0) * 0.85))
  const state = (i: number): CellState => (i < readN ? 'dead' : 'filled')
  const crashed = t >= a1 + 0.8
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, { x: 960, y: 560, s: 1.04 }], [a1, { x: 920, y: 520, s: 1.1 }, 1.6], [a2, { x: 960, y: 560, s: 1.0 }, 1.6]])}>
      <div style={{ position: 'absolute', left: TX - 90, top: TY + 16, fontSize: 32, fontWeight: 700, color: INK.text }}>P0</div>
      <Rise t={t} at={0.3}>
        <LogTape x={TX} y={TY} cells={14} cellW={CW} {...NOTICK} state={state} marks={readN >= 6 ? [{ at: 6, label: 'đã đọc đến 29', color: INK.good }] : []} />
        <TapeNums x={TX} y={TY} cells={14} cw={CW} of={(i) => i + 24} />
      </Rise>
      <Rise t={t} at={0.5}>
        <ConsumerUnit x={TX} y={260} w={440} name="consumer-1" parts={['P0']} t={t} down={crashed} note={crashed ? 'khởi động lại' : undefined} busy={crashed ? undefined : (t * 1.2) % 1} />
      </Rise>
      <div style={{ opacity: 1 - span(t, a2, a2 + 0.4) }}>
        <Statement x={TX} y={720} text="đọc tiếp từ đâu?" color={INK.warn} size={76} o={sp(t, a1 + 1.4)} />
      </div>
      <Note x={TX + 45} y={TY + 125} dx={30} dy={85} text="đọc lại từ đầu → xử lý trùng" color={INK.warn} o={vis(t, a2 + 0.3)} />
      <Note x={TX + 13.5 * CW} y={TY + 125} dx={-30} dy={85} text="nhảy tới cuối → bỏ sót" color={INK.bad} o={vis(t, a2 + 1.3)} />
      <Rise t={t} at={a2 + 2.4}>
        <Icon3D name="notebook" x={TX + 80} y={880} size={160} t={t} at={a2 + 2.4} />
      </Rise>
      <Statement x={TX + 220} y={850} text="cần một chỗ ghi nhớ bền vững" color={INK.good} size={56} o={sp(t, a2 + 2.6)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 1. committed offset + __consumer_offsets */

const LOG = { x: 1000, y: 470, w: 700 }

/** One record of the __consumer_offsets log: key on the left, value on the right. */
function OffsetRow({ i, value, hot, old }: { i: number; value: number; hot: number; old: number }) {
  // hot / old are 0..1 so the highlight and the strike-out cross-fade instead of snapping
  return (
    <div style={{ position: 'absolute', left: 24, top: 64 + i * 92, width: LOG.w - 48, height: 82, boxSizing: 'border-box', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: 'rgba(12,30,96,0.55)', border: '1.5px solid rgba(110,160,255,0.45)', opacity: 1 - 0.72 * old }}>
      <div style={{ position: 'absolute', inset: -1.5, borderRadius: 16, background: HERO, boxShadow: '0 0 26px rgba(77,141,255,0.6), inset 0 2px 0 rgba(255,255,255,0.45)', opacity: hot }} />
      <span style={{ position: 'relative', fontFamily: MONO, fontSize: 26, fontWeight: 700, color: '#ffffff', textDecoration: old > 0.5 ? 'line-through' : undefined }}>g-billing · orders · P0</span>
      <span style={{ position: 'relative', fontFamily: MONO, fontSize: 30, fontWeight: 800, color: '#ffffff', textDecoration: old > 0.5 ? 'line-through' : undefined }}>{value}</span>
    </div>
  )
}

function offsets(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const d1 = c.end(1) - a1
  const d3 = c.end(3) - a3
  const TX = 300
  const CW = 90
  const TY = 290
  const send = a1 + d1 * 0.45
  const land = send + 0.9
  const compact = a3 + 0.3
  const read2 = a3 + d3 * 0.55
  const state = (i: number): CellState => (i < 6 ? 'dead' : i === 6 && t >= a1 ? 'new' : 'filled')
  const rows = [
    { v: 12, at: a1 + 0.2 },
    { v: 24, at: a1 + 0.2 },
    { v: 30, at: land },
  ]
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, { x: 960, y: 500, s: 1.02 }], [a1, { x: 900, y: 500, s: 1.08 }, 1.5], [a2, { x: 1000, y: 560, s: 1.1 }, 1.5], [a3, { x: 1000, y: 580, s: 1.04 }, 1.5]])} title={{ kicker: 'COMMIT', text: 'Committed offset', until: a1 }}>
      <div style={{ position: 'absolute', left: TX - 90, top: TY + 16, fontSize: 32, fontWeight: 700, color: INK.text }}>P0</div>
      <LogTape x={TX} y={TY} cells={14} cellW={CW} {...NOTICK} state={state} marks={t >= a0 + 1.0 ? [{ at: 6, label: t >= a1 ? 'committed = 30' : 'committed', color: INK.accent }] : []} />
      <TapeNums x={TX} y={TY} cells={14} cw={CW} of={(i) => i + 24} />
      <Rise t={t} at={0.4}>
        <ConsumerUnit x={300} y={500} w={420} name="consumer-1" parts={['P0']} t={t} down={t >= a3 + 0.2} note={t >= a3 + 0.2 ? 'đã chết' : undefined} busy={t >= a3 + 0.2 ? undefined : (t * 1.1) % 1} />
      </Rise>
      {/* the commit request and the log it is appended to */}
      <Wire from={{ x: 722, y: 559 }} to={{ x: LOG.x - 10, y: 559 }} color={INK.line} p={move(t, a1 + 0.3, 0.5)} flow={t} />
      <Envelope t={t} at={send} from={{ x: 722, y: 559 }} to={{ x: LOG.x + 40, y: 559 }} label="commit 30" color={INK.good} len={0.9} arc={0} />
      {t >= a1 + 0.2 && (
        <Rise t={t} at={a1 + 0.2}>
          <div style={{ position: 'absolute', left: LOG.x, top: LOG.y - 56, ...PILL, padding: '6px 20px', fontFamily: MONO, fontSize: 28, fontWeight: 700 }}>__consumer_offsets</div>
          <div style={{ ...panel, left: LOG.x, top: LOG.y, width: LOG.w, height: 356, boxSizing: 'border-box', padding: 0 }}>
            <div style={{ position: 'absolute', left: 48, top: 18, fontSize: 24, fontWeight: 700, color: t >= a2 + 1.5 && t < a2 + 4 ? INK.accent : INK.faint, opacity: vis(t, a2 + 0.2) }}>key = group · topic · partition</div>
            <div style={{ position: 'absolute', right: 48, top: 18, fontSize: 24, fontWeight: 700, color: t >= a2 + 4 && t < a3 ? INK.accent : INK.faint, opacity: vis(t, a2 + 0.2) }}>value = offset</div>
          </div>
        </Rise>
      )}
      {rows.map((r, i) =>
        t >= r.at ? (
          <div key={i} style={{ position: 'absolute', left: LOG.x, top: LOG.y }}>
            <Rise t={t} at={r.at}>
              <OffsetRow i={i} value={r.v} hot={i === 2 ? span(t, land, land + 0.35) * (1 - span(t, compact + 2.5, compact + 2.9)) : 0} old={i < 2 ? span(t, compact, compact + 0.4) : 0} />
            </Rise>
          </div>
        ) : null,
      )}
      <Tag t={t} at={compact} x={LOG.x} y={LOG.y + 380} text="compaction: giữ bản mới nhất mỗi key" color={INK.good} size={28} />
      <Rise t={t} at={a3 + 0.8}>
        <ConsumerUnit x={300} y={680} w={420} name="consumer-2" parts={['P0']} t={t} note="mới nhận P0" accent={INK.warn} />
      </Rise>
      <Envelope t={t} at={read2} from={{ x: LOG.x - 10, y: 739 }} to={{ x: 730, y: 739 }} label="committed = 30" color={INK.good} len={1.0} arc={0} />
      <Tag t={t} at={read2 + 0.45} x={300} y={820} text="đọc tiếp từ offset 30" color={INK.good} size={32} />
    </SoftScene>
  )
}

/** Cross-fades a unit from its alive look to its dead look (f: 0 → 1). */
function Fade({ f, alive, dead }: { f: number; alive: ReactNode; dead: ReactNode }) {
  return (
    <>
      {f < 1 && <div style={{ opacity: 1 - f }}>{alive}</div>}
      {f > 0 && <div style={{ opacity: f }}>{dead}</div>}
    </>
  )
}

/* ------------------------------------------------------------------ 2. the bookmark: too far (lost) vs too short (repeat) */

function bookmark(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const TX = 440
  const CW = 90
  const YA = 280
  const YB = 620
  const move1 = a1 + 0.3
  const crash1 = a1 + 2.2
  const crash2 = a2 + 1.8
  const commitA = lerp(4, 8, move(t, move1, 1.2))
  const stateA = (i: number): CellState => (i < 4 ? 'dead' : i < 8 && t >= crash1 ? 'missing' : 'filled')
  const stateB = (i: number): CellState => (i < 9 && t < crash2 ? 'dead' : i < 4 ? 'dead' : i < 9 ? 'new' : 'filled')
  const marksA = [{ at: 4, label: 'xử lý xong', color: INK.good }]
  const marksB = [{ at: 9, label: 'xử lý xong', color: INK.good }]
  /** The commit marker hangs below the tape so it never collides with the "xử lý xong" marker above. */
  const commitMark = (y: number, at: number, o: number) => (
    <div style={{ position: 'absolute', left: TX + at * CW - 1.5, top: y - 6, width: 3, height: 126, borderRadius: 2, background: INK.accent, opacity: o }}>
      <div style={{ position: 'absolute', left: '50%', top: 118, transform: 'translateX(-50%)', ...PILL, padding: '6px 18px', fontSize: 28, fontWeight: 800, color: INK.accent, border: `1.5px solid ${INK.accent}`, whiteSpace: 'nowrap' }}>commit</div>
    </div>
  )
  const rowLabel = (y: number, line1: string, line2: string, o: number) => (
    <div style={{ position: 'absolute', left: 100, top: y - 6, width: 290, fontSize: 30, fontWeight: 800, lineHeight: 1.2, color: INK.text, opacity: o }}>
      {line1}
      <br />
      <span style={{ color: INK.faint, fontSize: 26, fontWeight: 700, whiteSpace: 'nowrap' }}>{line2}</span>
    </div>
  )
  const pulse = (ph: number) => (t >= crash2 + 0.8 ? 0.5 + 0.5 * Math.sin((t - crash2) * 5 + ph) : 0)
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, { x: 960, y: 520, s: 1.0 }], [a1 - 0.2, { x: 940, y: 440, s: 1.06 }, 1.6], [a2 - 0.2, { x: 940, y: 620, s: 1.06 }, 1.6], [a3, WIDE, 1.6]])} title={{ kicker: 'COMMIT', text: 'Kẹp sách nằm ở đâu?', until: a1 - 0.3 }}>
      <div style={{ position: 'absolute', left: TX - 54, top: YA + 16, fontSize: 32, fontWeight: 700, color: INK.text, opacity: vis(t, a0 + 0.5) }}>P0</div>
      <div style={{ opacity: vis(t, a0 + 0.5) }}>
        <LogTape x={TX} y={YA} cells={12} cellW={CW} {...NOTICK} state={stateA} marks={t >= a0 + 1.4 ? marksA : []} />
        <TapeNums x={TX} y={YA} cells={12} cw={CW} of={(i) => i + 30} />
      </div>
      {commitMark(YA, commitA, vis(t, a1, Infinity, 0.3))}
      {rowLabel(YA, 'Commit quá xa', 'bỏ qua tin chưa làm', vis(t, a1))}
      <div style={{ position: 'absolute', left: TX + 12 * CW + 40, top: YA + 4, opacity: vis(t, crash1), transform: `scale(${1 + 0.06 * pulse(0)})`, transformOrigin: 'left center' }}>
        <div style={{ ...PILL, border: `1.5px solid ${INK.bad}`, boxShadow: `0 0 20px ${INK.bad}88`, padding: '10px 26px', fontSize: 34, fontWeight: 800, color: INK.bad }}>MẤT 4 tin</div>
      </div>

      <div style={{ position: 'absolute', left: TX - 54, top: YB + 16, fontSize: 32, fontWeight: 700, color: INK.text, opacity: vis(t, a0 + 0.9) }}>P0</div>
      <div style={{ opacity: vis(t, a0 + 0.9) }}>
        <LogTape x={TX} y={YB} cells={12} cellW={CW} {...NOTICK} state={stateB} marks={t >= a0 + 1.4 ? marksB : []} />
        <TapeNums x={TX} y={YB} cells={12} cw={CW} of={(i) => i + 30} />
      </div>
      {commitMark(YB, 4, vis(t, a2, Infinity, 0.3))}
      {rowLabel(YB, 'Commit quá chậm', 'đọc lại tin đã làm', vis(t, a2))}
      <div style={{ position: 'absolute', left: TX + 12 * CW + 40, top: YB + 4, opacity: vis(t, crash2), transform: `scale(${1 + 0.06 * pulse(Math.PI)})`, transformOrigin: 'left center' }}>
        <div style={{ ...PILL, border: `1.5px solid ${INK.warn}`, boxShadow: `0 0 20px ${INK.warn}88`, padding: '10px 26px', fontSize: 34, fontWeight: 800, color: INK.warn }}>LẶP 5 tin</div>
      </div>
      <CenterLine t={t} at={a3 + 0.4} y={900} text="dời kẹp vào lúc nào?" color={INK.accent} size={64} pulse={0.5 + 0.5 * Math.sin((t - a3) * 4)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 3. auto commit trap 1: repeat */

const AX = { x0: 250, px: 220 }
const sx = (s: number) => AX.x0 + s * AX.px

function auto(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const s0 = a1 + 0.4
  const s1 = a2 - 0.3
  const crashT = a2 + 1.5
  const s = lerp(0, 4, span(t, s0, s1)) + 0.5 * span(t, a2 + 0.3, crashT)
  const crashed = t >= crashT
  const pollAt = (k: number) => s0 + ((2 * k) / 4) * (s1 - s0)
  const polled = [0, 1, 2].map((k) => (k === 2 ? s >= 4 : s >= 2 * k))
  const ghostAt = pollAt(2) + 0.6
  // counters change in whole batches so the digits never cross-fade
  const processed = [0, 1, 2].filter((k) => s >= 2 * k + 0.5).length * 100
  const replayAt = (k: number) => a3 + 0.9 + k * 0.5
  const replayed = [0, 1, 2].filter((k) => t >= replayAt(k)).length * 100
  const hot = t >= crashT + 0.3 && t < a3 + 2 ? 0.5 + 0.5 * Math.sin((t - crashT) * 5) : 0
  const active = t >= a3 + 2.4 ? Math.floor((t - (a3 + 2.4)) / 0.5) % 3 : -1
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 470, s: 1.08 }, 1.6], [a2 - 0.2, { x: 1000, y: 520, s: 1.1 }, 1.6], [a3, { x: 960, y: 640, s: 1.04 }, 1.6]])} title={{ kicker: 'AUTO COMMIT', text: 'Bẫy thứ nhất: xử lý lặp', until: a0 + 2.5 }}>
      <Rise t={t} at={a0 + 0.3}>
        <div style={{ ...panel, left: 250, top: 170, fontSize: 34, color: INK.good, transform: `scale(${1 + 0.06 * hot})`, boxShadow: hot ? `0 0 ${14 + 20 * hot}px ${INK.warn}` : undefined }}>đã commit: 0</div>
      </Rise>
      <Rise t={t} at={a0 + 0.6}>
        <div style={{ ...panel, left: 640, top: 170, fontSize: 34 }}>
          đã xử lý: <Num n={processed} /> tin
        </div>
      </Rise>
      {t >= replayAt(0) - 0.1 && (
        <Rise t={t} at={replayAt(0) - 0.1}>
          <div style={{ ...panel, left: 1150, top: 170, fontSize: 34, color: INK.warn }}>
            xử lý lần 2: <Num n={replayed} /> tin
          </div>
        </Rise>
      )}
      {/* the default interval, shown before any poll happens */}
      <div style={{ opacity: vis(t, a0 + 1.8, a2 - 0.2, 0.4) }}>
        <div style={{ position: 'absolute', left: sx(0), top: 332, width: 5 * AX.px, height: 14, borderLeft: `3px solid ${INK.accent}`, borderRight: `3px solid ${INK.accent}`, borderTop: `3px solid ${INK.accent}` }} />
        <div style={{ position: 'absolute', left: sx(0), width: 5 * AX.px, top: 268, display: 'flex', justifyContent: 'center' }}>
          <div style={{ ...PILL, padding: '8px 28px', fontSize: 30, fontWeight: 800, color: INK.accent, border: `1.5px solid ${INK.accent}`, whiteSpace: 'nowrap' }}>mặc định: cứ 5 giây tự commit</div>
        </div>
      </div>
      {t >= a0 + 1.8 && t < a1 + 0.3 && <Icon3D name="clock" x={sx(5.8)} y={440} size={170} t={t} at={a0 + 1.8} />}
      {/* time axis in seconds */}
      <Rise t={t} at={a0 + 0.5}>
        <div style={{ position: 'absolute', left: AX.x0, top: 560, width: 6.5 * AX.px, height: 3, borderRadius: 2, background: INK.line }} />
        {[0, 1, 2, 3, 4, 5, 6].map((k) => (
          <div key={k} style={{ position: 'absolute', left: sx(k) - 30, width: 60, top: 574, textAlign: 'center', fontFamily: MONO, fontSize: 28, fontWeight: 700, color: INK.faint }}>
            {k}s
          </div>
        ))}
      </Rise>
      {/* needle */}
      {t >= s0 && <div style={{ position: 'absolute', left: sx(s) - 1.5, top: 350, width: 3, height: 214, borderRadius: 2, background: crashed ? INK.bad : INK.faint, opacity: 0.75 }} />}
      {/* poll() calls and the batches they return */}
      {[0, 1, 2].map((k) =>
        polled[k] ? (
          <div key={k}>
            <Rise t={t} at={pollAt(k)}>
              <div style={{ position: 'absolute', left: sx(2 * k) - 65, top: 372, width: 130, height: 64, boxSizing: 'border-box', ...PILL, display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 30, fontWeight: 700 }}>poll</div>
            </Rise>
            {t >= pollAt(k) && <div style={{ position: 'absolute', left: sx(2 * k), top: 466, width: Math.max(8, Math.min(0.5, s - 2 * k) * AX.px), height: 76, boxSizing: 'border-box', borderRadius: 14, background: HERO, boxShadow: '0 0 18px rgba(77,141,255,0.55), inset 0 2px 0 rgba(255,255,255,0.45)', display: 'grid', placeItems: 'center', overflow: 'hidden', fontSize: 30, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>{s - 2 * k >= 0.5 ? '100' : ''}</div>}
          </div>
        ) : null,
      )}
      {/* the next poll, anchored to its second on the axis */}
      <div style={{ opacity: vis(t, ghostAt, crashT, 0.3) }}>
        <div style={{ position: 'absolute', left: sx(6) - 1.5, top: 436, height: 124, borderLeft: `3px dashed ${INK.faint}` }} />
        <div style={{ position: 'absolute', left: sx(6) - 9, top: 552, width: 18, height: 18, borderRadius: 9, background: INK.faint }} />
        <div style={{ position: 'absolute', left: sx(6) - 215, top: 372, width: 430, height: 64, boxSizing: 'border-box', borderRadius: 999, border: `2px dashed ${INK.faint}`, background: 'rgba(8,22,82,0.85)', display: 'grid', placeItems: 'center', fontSize: 30, fontWeight: 700, color: INK.text, whiteSpace: 'nowrap' }}>poll giây 6 → mới commit</div>
      </div>
      {/* time since the last commit */}
      <Rise t={t} at={a0 + 1.2}>
        <div style={{ position: 'absolute', left: 250, top: 650, fontSize: 32, fontWeight: 700, color: INK.faint }}>
          từ lần commit trước: <span style={{ color: INK.text, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>{s.toFixed(1).replace('.', ',')}s</span>
        </div>
        <div style={{ position: 'absolute', left: 250, top: 710, width: 5 * AX.px, height: 26, borderRadius: 13, background: 'rgba(110,160,255,0.18)' }} />
        <div style={{ position: 'absolute', left: 250, top: 710, width: Math.min(5, s) * AX.px, height: 26, borderRadius: 13, background: HERO, boxShadow: '0 0 14px rgba(77,141,255,0.7)' }} />
        <div style={{ position: 'absolute', left: 250 + 5 * AX.px - 2, top: 696, width: 4, height: 54, borderRadius: 2, background: INK.bad }} />
        <div style={{ position: 'absolute', left: 250 + 5 * AX.px + 24, top: 708, fontSize: 30, fontWeight: 700, color: INK.bad, whiteSpace: 'nowrap' }}>5s: đủ để commit</div>
      </Rise>
      <Tag t={t} at={crashT + 0.5} until={a3} x={250} y={790} text="4,5s chưa đủ 5s → chưa commit lần nào" color={INK.bad} size={30} />
      {crashed && <Icon3D name="fire" x={sx(4.5)} y={312} size={110} t={t} at={crashT} />}
      {/* after the restart */}
      <Tag t={t} at={a3 + 0.2} x={250} y={790} text="khởi động lại → đọc từ 0 → xử lý lần 2" color={INK.warn} size={30} />
      {[0, 1, 2].map((k) => (
        <Rise key={k} t={t} at={replayAt(k)}>
          <div style={{ position: 'absolute', left: sx(2 * k), top: 876, width: 0.5 * AX.px, height: 76, boxSizing: 'border-box', borderRadius: 14, background: `linear-gradient(160deg, ${INK.warn}cc, ${INK.warn})`, boxShadow: active === k ? `0 0 34px ${INK.warn}` : `0 0 18px ${INK.warn}88`, transform: `scale(${active === k ? 1.14 : 1})`, display: 'grid', placeItems: 'center', fontSize: 30, fontWeight: 800, color: '#1a1200', whiteSpace: 'nowrap' }}>100</div>
        </Rise>
      ))}
      <Statement x={250} y={975} text="300 tin bị xử lý hai lần" color={INK.warn} size={48} o={sp(t, a3 + 2.4)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 4. auto commit trap 2: lost */

function autolost(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const d1 = c.end(1) - a1
  const TX = 360
  const CW = 120
  const TY = 300
  const doneN = Math.max(0, Math.min(4, Math.floor((t - (a1 + 0.4)) / 0.4)))
  const send = a1 + d1 * 0.62
  const land = send + 0.9
  const dieT = a2 + 0.5
  const dead = t >= dieT
  const df = span(t, dieT, dieT + 0.4)
  const state = (i: number): CellState => (dead && i >= doneN ? 'missing' : i < doneN ? 'dead' : 'filled')
  const marks = t >= land ? [{ at: 10, label: 'committed = 100', color: INK.accent }] : []
  const glow = 0.5 + 0.5 * Math.sin((t - a3) * 5)
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, { x: 960, y: 520, s: 1.0 }], [a1, { x: 1000, y: 520, s: 1.08 }, 1.6], [a2, { x: 1000, y: 540, s: 1.06 }, 1.6], [a3, { x: 940, y: 560, s: 1.0 }, 1.6]])} title={{ kicker: 'AUTO COMMIT', text: 'Bẫy thứ hai: mất tin', until: a0 + 2.3 }}>
      <Tag t={t} at={a0 + 0.4} x={TX} y={215} text="mẻ vừa poll · offset 0 → 99" color={INK.faint} size={30} />
      <Rise t={t} at={a0 + 0.3}>
        <LogTape x={TX} y={TY} cells={10} cellW={CW} {...NOTICK} state={state} marks={marks} />
        <TapeNums x={TX} y={TY} cells={10} cw={CW} of={(i) => i * 10} />
      </Rise>
      <Rise t={t} at={a0 + 0.9}>
        <Fade f={df} alive={<ConsumerUnit x={360} y={560} w={520} name="thread pool" t={t} note="đang xử lý" busy={doneN / 10} />} dead={<ConsumerUnit x={360} y={560} w={520} name="thread pool" t={t} down note="đã chết" />} />
      </Rise>
      <Rise t={t} at={a0 + 1.2}>
        <Fade f={df} alive={<ConsumerUnit x={1040} y={560} w={520} name="luồng chính" t={t} note="poll() tiếp ngay" accent={INK.accent} busy={(t * 1.4) % 1} />} dead={<ConsumerUnit x={1040} y={560} w={520} name="luồng chính" t={t} down note="đã chết" accent={INK.accent} />} />
      </Rise>
      <Packets t={t} from={{ x: 620, y: 395 }} to={{ x: 620, y: 552 }} start={a0 + 1.6} end={dead ? dieT : Infinity} every={0.5} len={0.8} size={18} color={INK.accent} />
      <div style={{ opacity: vis(t, a1 + 1.4, a2 + 0.3, 0.3) }}>
        <Icon3D name="clock" x={1690} y={600} size={120} t={t} at={a1 + 1.4} />
        <div style={{ position: 'absolute', left: 1570, top: 676, width: 240, textAlign: 'center', fontSize: 34, fontWeight: 800, color: INK.text }}>giây thứ 5</div>
      </div>
      <Rise t={t} at={send - 0.4}>
        <Srv x={1300} y={760} name="coordinator" t={t} />
      </Rise>
      <Flight t={t} at={send} from={{ x: 1300, y: 690 }} to={{ x: 1430, y: 762 }} label="commit 100" color={INK.good} len={0.9} />
      {dead && <Icon3D name="fire" x={1690} y={600} size={140} t={t} at={dieT} />}
      {t >= a3 + 0.5 && (
        <div style={{ position: 'absolute', left: TX + 4 * CW, top: TY, width: 6 * CW, height: 70, boxSizing: 'border-box', borderRadius: 14, border: `3px solid ${INK.bad}`, boxShadow: `0 0 ${10 + 22 * glow}px ${INK.bad}`, opacity: vis(t, a3 + 0.5) * (0.45 + 0.55 * glow) }} />
      )}
      <Bracket x1={TX + 4 * CW} x2={TX + 10 * CW} y={436} text="60 tin không bao giờ được xử lý" color={INK.bad} o={vis(t, a3 + 0.5)} glow={glow} />
      <Rise t={t} at={a3 + 2.4}>
        <Icon3D name="shield" x={200} y={960} size={100} t={t} at={a3 + 2.4} />
      </Rise>
      <Statement x={310} y={945} text="an toàn: tắt auto commit, commit bằng tay" color={INK.good} size={42} o={sp(t, a3 + 2.6)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 5. commitSync vs commitAsync */

function syncScene(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const d1 = c.end(1) - a1
  const d2 = c.end(2) - a2
  const d3 = c.end(3) - a3
  const A = { y: 220 }
  const B = { y: 540 }
  const U = { x: 250, w: 420 }
  const SRV = 1250
  const wireFrom = (y: number) => ({ x: U.x + U.w + 2, y: y + 59 })
  const wireTo = (y: number) => ({ x: SRV - 14, y: y + 59 })
  const envFrom = (y: number) => ({ x: U.x + U.w + 120, y: y + 59 })
  const envTo = (y: number) => ({ x: SRV - 120, y: y + 59 })
  const mid = (y: number) => ({ x: (U.x + U.w + SRV) / 2, y: y + 59 })
  /** wide labels stop here so the pill never touches the coordinator box */
  const nearTo = (y: number) => ({ x: SRV - 200, y: y + 59 })
  const nearFrom = (y: number) => ({ x: SRV - 190, y: y + 59 })
  // first beat: both kinds of commit shown once, normal case
  const dA = a0 + 2.4
  const dAck = dA + 1.0
  const dB = a0 + 3.2
  // lane A (sync): lost, retried, acknowledged
  const e1 = a1 + d1 * 0.12
  const x1 = a1 + d1 * 0.32
  const e2 = a1 + d1 * 0.42
  const rep = a1 + d1 * 0.7
  const waitEnd = rep + Math.max(0.8, d1 * 0.2)
  const waiting = (t >= dA && t < dAck + 0.9) || (t >= e1 && t < waitEnd)
  // lane B (async): sent, consumer keeps working, second request lost
  const f1 = a2 + d2 * 0.1
  const f2 = a2 + d2 * 0.42
  const fx = f2 + 0.9
  const chips = 4
  const chipW = 240
  const rowX = 220
  const syncChip = a3 + d3 * 0.55
  const syncOn = t >= syncChip
  const pulse = syncOn ? 0.5 + 0.5 * Math.sin((t - syncChip) * 6) : 0
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 440, s: 1.08 }, 1.8], [a2, { x: 960, y: 580, s: 1.08 }, 1.8], [a3, { x: 960, y: 560, s: 1.0 }, 1.8]])}>
      {[{ y: A.y, name: 'commitSync()', icon: 'lock' as const, tag: 'thư bảo đảm · chờ giấy báo nhận', tagColor: INK.warn }, { y: B.y, name: 'commitAsync()', icon: 'mail' as const, tag: 'thư thường · thả rồi làm tiếp', tagColor: INK.accent }].map((lane, i) => (
        <Rise key={lane.name} t={t} at={a0 + 0.3 + i * 0.5}>
          <Icon3D name={lane.icon} x={300} y={lane.y - 40} size={112} t={t} at={a0 + 0.3 + i * 0.5} />
          <div style={{ position: 'absolute', left: 380, top: lane.y - 78, fontFamily: MONO, fontSize: 44, fontWeight: 800, color: INK.text }}>{lane.name}</div>
          <ConsumerUnit x={U.x} y={lane.y} w={U.w} name="consumer-1" parts={['P0']} t={t} idle={i === 0 && waiting} note={i === 0 && waiting ? 'chờ…' : undefined} busy={i === 0 ? (waiting ? undefined : (t * 1.1) % 1) : (t * 1.1) % 1} />
          <Srv x={SRV} y={lane.y - 15} name="coordinator" t={t} />
          <Wire from={wireFrom(lane.y)} to={wireTo(lane.y)} color={INK.line} p={move(t, a0 + 0.6 + i * 0.5, 0.6)} flow={t} />
        </Rise>
      ))}
      <Tag t={t} at={a0 + 1.0} x={800} y={A.y - 86} text="thư bảo đảm · chờ giấy báo nhận" color={INK.warn} size={30} />
      <Tag t={t} at={a0 + 1.5} x={800} y={B.y - 86} text="thư thường · thả rồi làm tiếp" color={INK.accent} size={30} />
      {/* first beat: normal round trip for each kind */}
      <Flight t={t} at={dA} from={envFrom(A.y)} to={envTo(A.y)} label="commit" color={INK.accent} len={0.9} />
      <Flight t={t} at={dAck} from={nearFrom(A.y)} to={envFrom(A.y)} label="đã nhận ✓" color={INK.good} len={0.9} />
      <Flight t={t} at={dB} from={envFrom(B.y)} to={envTo(B.y)} label="commit" color={INK.accent} len={0.9} />
      {/* lane A */}
      <Flight t={t} at={e1} from={envFrom(A.y)} to={mid(A.y)} label="commit" color={INK.bad} len={Math.max(0.7, d1 * 0.14)} />
      <Tag t={t} at={x1} until={e2} x={mid(A.y).x - 60} y={mid(A.y).y - 100} text="✕ lạc" color={INK.bad} size={30} />
      <Flight t={t} at={e2} from={envFrom(A.y)} to={nearTo(A.y)} label="commit (thử lại)" color={INK.warn} len={Math.max(0.9, d1 * 0.18)} />
      <Flight t={t} at={rep} from={nearFrom(A.y)} to={envFrom(A.y)} label="đã nhận ✓" color={INK.good} len={Math.max(0.9, d1 * 0.18)} />
      {/* lane B */}
      <Flight t={t} at={f1} from={envFrom(B.y)} to={envTo(B.y)} label="commit" color={INK.accent} len={0.9} />
      <Flight t={t} at={f2} from={envFrom(B.y)} to={mid(B.y)} label="commit" color={INK.bad} len={0.9} />
      <Flight t={t} at={fx + 1.0} from={envFrom(B.y)} to={envTo(B.y)} label="commit" color={INK.accent} len={0.9} />
      <Flight t={t} at={fx + 2.2} from={envFrom(B.y)} to={envTo(B.y)} label="commit" color={INK.accent} len={0.9} />
      <Tag t={t} at={fx} x={mid(B.y).x - 320} y={mid(B.y).y + 50} text="✕ lạc · chỉ báo qua callback" color={INK.bad} size={30} />
      {/* the usual pattern */}
      <Rise t={t} at={a3 + 0.2}>
        <div style={{ position: 'absolute', left: rowX, top: 800, fontSize: 32, fontWeight: 800, color: INK.faint }}>trong vòng lặp</div>
      </Rise>
      {Array.from({ length: chips }, (_, k) => (
        <Rise key={k} t={t} at={a3 + 0.4 + k * Math.min(0.45, (d3 * 0.4) / chips)}>
          <div style={{ position: 'absolute', left: rowX + k * (chipW + 14), top: 860, width: chipW, height: 68, boxSizing: 'border-box', borderRadius: 999, background: HERO, boxShadow: '0 0 18px rgba(77,141,255,0.55)', display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 30, fontWeight: 800, color: '#fff', opacity: syncOn ? 0.5 : 1 }}>commitAsync</div>
        </Rise>
      ))}
      <Rise t={t} at={syncChip}>
        <div style={{ position: 'absolute', left: rowX + chips * (chipW + 14) + 30, top: 860, width: 500, height: 68, boxSizing: 'border-box', borderRadius: 999, background: `linear-gradient(160deg, ${INK.good}, #14a874)`, boxShadow: `0 0 ${20 + 26 * pulse}px ${INK.good}`, transform: `scale(${1 + 0.05 * pulse})`, display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 30, fontWeight: 800, color: '#06281c', whiteSpace: 'nowrap' }}>commitSync · rồi close()</div>
      </Rise>
      <Rise t={t} at={syncChip}>
        <div style={{ position: 'absolute', left: rowX + chips * (chipW + 14) + 30, top: 800, fontSize: 32, fontWeight: 800, color: INK.good }}>một lần cuối</div>
      </Rise>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 6. why commitAsync does not retry */

function asyncorder(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const d1 = c.end(1) - a1
  const U = { x: 200, y: 480, w: 420 }
  const SRV = { x: 1350, y: 440 }
  const lane100 = 470
  const lane200 = 580
  const from = (y: number) => ({ x: U.x + U.w + 110, y })
  const to = (y: number) => ({ x: SRV.x - 210, y })
  const mid = (y: number) => ({ x: (from(y).x + to(y).x) / 2, y })
  const c100 = a1 + d1 * 0.1
  const lost = c100 + 1.2
  const c200 = a1 + d1 * 0.42
  const arrive200 = c200 + 1.0
  const retry = a2 + 0.5
  const arriveRetry = retry + 1.2
  const fixed = t >= a3 + 0.2
  const value = fixed ? 200 : t >= arriveRetry ? 100 : t >= arrive200 ? 200 : 0
  const col = value === 200 ? INK.good : value === 100 ? INK.bad : INK.faint
  const skipAt = a3 + 2.6
  const pulse = t >= skipAt + 1 ? 0.5 + 0.5 * Math.sin((t - skipAt) * 6) : 0
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 920, y: 560, s: 1.14 }, 1.8], [a2, { x: 940, y: 560, s: 1.14 }, 1.8], [a3, { x: 960, y: 580, s: 1.0 }, 1.8]])} title={{ kicker: 'COMMIT', text: 'Vì sao không tự thử lại?', until: a0 + 2.5 }}>
      {/* the whole picture sits 100px lower so the frame is filled while the sequence chips are still hidden */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: 'translateY(100px)' }}>
      <Rise t={t} at={a0 + 0.3}>
        <ConsumerUnit x={U.x} y={U.y} w={U.w} name="consumer-1" parts={['P0']} t={t} busy={(t * 1.2) % 1} />
      </Rise>
      <Rise t={t} at={a0 + 0.6}>
        <Srv x={SRV.x} y={SRV.y} name="coordinator" t={t} />
      </Rise>
      <Wire from={{ x: U.x + U.w + 2, y: 520 }} to={{ x: SRV.x - 14, y: 520 }} color={INK.line} p={move(t, a0 + 0.8, 0.6)} flow={t} />
      <Rise t={t} at={a0 + 1.0}>
        <div style={{ ...panel, left: 1130, top: 250, width: 400, boxSizing: 'border-box', textAlign: 'center', fontSize: 36, color: col }}>
          committed: <b style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>{value}</b>
        </div>
      </Rise>
      <Flight t={t} at={c100} from={from(lane100)} to={mid(lane100)} label="commit 100" color={INK.bad} len={1.2} />
      <Tag t={t} at={lost} until={lost + 3.5} x={mid(lane100).x - 60} y={lane100 - 110} text="✕ lạc" color={INK.bad} size={30} />
      <Flight t={t} at={c200} from={from(lane200)} to={to(lane200)} label="commit 200" color={INK.good} len={1.0} />
      <Flight t={t} at={retry} from={from(lane100)} to={to(lane100)} label="thử lại: commit 100" color={INK.warn} len={1.2} />
      {t >= arriveRetry && t < a3 && <Icon3D name="backward" x={1650} y={290} size={110} t={t} at={arriveRetry} />}
      <Tag t={t} at={arriveRetry + 0.3} until={a3} x={1000} y={690} text="kẹp lùi → đọc lại 100 tin" color={INK.bad} size={32} />
      {/* with a sequence number the stale retry is dropped */}
      <Flight t={t} at={skipAt} from={from(lane100)} to={mid(lane100)} label="thử lại #1" color={INK.warn} len={1.0} />
      <Tag t={t} at={skipAt + 1.0} x={mid(lane100).x - 60} y={lane100 - 110} text="bỏ qua: đã có #2" color={INK.warn} size={30} />
      </div>
      {/* sequence numbers */}
      <div style={{ position: 'absolute', left: 222, top: 860, display: 'flex', gap: 24 }}>
        {[
          { at: a3 + 0.3, text: '#1 · commit 100 · lạc', color: INK.bad, pulse: 0 },
          { at: a3 + 1.3, text: '#2 · commit 200 · xong', color: INK.good, pulse: 0 },
          { at: skipAt + 0.6, text: '#1 thử lại? #2 mới hơn → bỏ qua', color: INK.warn, pulse },
        ].map((p) => (
          <Rise key={p.text} t={t} at={p.at}>
            <div style={{ ...PILL, border: `1.5px solid ${p.color}`, boxShadow: `0 0 ${18 + 22 * p.pulse}px ${p.color}`, transform: `scale(${1 + 0.05 * p.pulse})`, padding: '12px 28px', fontSize: 30, fontWeight: 800, color: p.color, whiteSpace: 'nowrap' }}>{p.text}</div>
          </Rise>
        ))}
      </div>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 7. summary */

function summary(t: number, c: Cue) {
  return (
    <SoftTheme>
      <SummaryList t={t} cue={c} items={['Committed offset = tin tiếp theo cần đọc', 'Auto commit tính theo poll, chưa chắc xong', 'Luồng khác + auto commit có thể mất tin', 'Async không thử lại · Sync dùng lần cuối']} />
    </SoftTheme>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { hook, offsets, bookmark, auto, autolost, sync: syncScene, asyncorder, summary }

/** Key-moment sounds, timed to the same cue offsets the scenes animate on. */
const SFX: Record<string, SceneSfx[]> = {
  offsets: [{ kind: 'ding', at: (c) => c.at(1) + (c.end(1) - c.at(1)) * 0.45 + 0.9 }],
  bookmark: [
    { kind: 'error', at: (c) => c.at(1) + 2.2 },
    { kind: 'error', at: (c) => c.at(2) + 1.8 },
  ],
  auto: [{ kind: 'error', at: (c) => c.at(2) + 1.5 }],
  autolost: [{ kind: 'error', at: (c) => c.at(2) + 0.5 }],
  sync: [
    { kind: 'error', at: (c) => c.at(1) + (c.end(1) - c.at(1)) * 0.32 },
    { kind: 'ding', at: (c) => c.at(1) + (c.end(1) - c.at(1)) * 0.7 },
  ],
  asyncorder: [
    { kind: 'ding', at: (c) => c.at(1) + (c.end(1) - c.at(1)) * 0.42 + 1.0 },
    { kind: 'error', at: (c) => c.at(2) + 0.5 + 1.2 },
  ],
}

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const commitOffsetLesson: Lesson = {
  ...commitOffsetScript,
  scenes: commitOffsetScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id], sfx: SFX[s.id] })),
  intro: [
    { kind: 'video', scenes: ['hook'] },
    {
      kind: 'quiz',
      title: 'Quick Quiz',
      questions: [q('Đoán trước khi học: consumer vừa đọc xong tin offset 41 của P0. Con số nào nên được commit?', ['41', '42', '40', '0'], 1, 'Committed offset là tin TIẾP THEO cần đọc, nên là 42. Phần 1 giải thích.')],
    },
  ],
  roadmap: [
    'Chặng 1: Committed offset là gì, được lưu ở đâu, và vì sao chỗ đặt "kẹp sách" quyết định mất hay lặp.',
    'Chặng 2: Auto commit tiện nhưng có hai cái bẫy: xử lý lặp và mất tin.',
    'Chặng 3: Commit bằng tay với commitSync và commitAsync, và vì sao commitAsync không tự thử lại.',
  ],
  sections: [
    {
      id: 'committed-offset',
      title: 'Committed offset và __consumer_offsets',
      blocks: [
        { kind: 'video', scenes: ['offsets'] },
        {
          kind: 'list',
          items: [
            { title: 'Committed offset', text: 'số thứ tự của tin **tiếp theo** cần đọc. Đọc xong tin 29 thì commit **30**. (📘 sách, ch.4, ch.7)' },
            { title: 'Lưu ở đâu', text: 'trong topic nội bộ `__consumer_offsets`: mặc định **50 partition**, mỗi lần commit là **một tin nhắn** với key = `(group, topic, partition)`, value = `offset`.' },
            { title: 'Ai quản lý', text: 'group ghi vào partition `hash(group.id) % 50`; broker làm leader của partition đó chính là **group coordinator** (Module 5).' },
            { title: 'Vì sao compaction', text: 'chỉ giá trị **mới nhất** của mỗi key có ý nghĩa. Compaction giữ đúng bản mới nhất, bất kể cũ bao lâu (Module 7).' },
          ],
        },
        { kind: 'callout', tone: 'warn', title: 'Hai chữ "committed" khác nhau', text: '**Tin đã committed** (Module 4) = đã ghi đủ vào mọi bản trong ISR, consumer được phép đọc, do broker quyết định. **Offset đã committed** (module này) = con số consumer gửi về để báo "group đã xử lý đến đây", do consumer quyết định. (📘 sách, ch.7)' },
        { kind: 'video', scenes: ['bookmark'] },
        {
          kind: 'p',
          text: 'Kafka **không xác nhận từng tin** như hàng đợi JMS. Consumer chỉ commit **một con số** cho mỗi partition, ngầm nói "mọi tin trước nó đã xong". Con số đó là **lời hứa**, không phải sự thật về việc xử lý. Kẹp dời quá xa thì **mất** tin, kẹp ở lại phía sau thì **lặp** tin. (📘 sách, ch.4, ch.7)',
        },
        { kind: 'callout', tone: 'info', title: 'Offset không sống mãi', text: 'Group không còn thành viên nào quá `offsets.retention.minutes` (mặc định 10.080 phút = **7 ngày**) thì offset bị xoá, group quay lại như group mới và rơi vào `auto.offset.reset`: `earliest` (đọc lại từ đầu, ít mất), `latest` (mặc định, gần như chắc chắn bỏ sót), `none` (ném exception). (📘 sách, ch.4)' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Consumer xử lý xong tin offset 41 và commit. Con số được ghi là bao nhiêu?', ['41', '42', '40', '1'], 1, 'Committed offset là tin tiếp theo cần đọc. Ghi 41 thì lần sau tin 41 bị xử lý lại.'),
            q('Vì sao Kafka lưu committed offset trong một topic chứ không trong bộ nhớ consumer?', ['Để tiết kiệm RAM', 'Vì consumer có thể chết bất cứ lúc nào, và consumer khác trong group phải đọc được sau rebalance', 'Vì topic nhanh hơn RAM', 'Vì broker không có RAM'], 1, 'Topic được ghi đĩa, sao lưu như mọi dữ liệu Kafka, và thuộc về group chứ không thuộc về một consumer.'),
            q('Vì sao `__consumer_offsets` dùng compaction chứ không xoá theo thời gian?', ['Để đọc nhanh hơn', 'Vì chỉ bản mới nhất của mỗi key có ý nghĩa, và retention theo thời gian có thể xoá mất offset của group ít commit', 'Vì topic nhỏ', 'Vì bắt buộc bởi giao thức'], 1, 'Compaction giữ đúng bản mới nhất của mỗi (group, topic, partition), bất kể cũ bao lâu.'),
          ],
        },
      ],
    },
    {
      id: 'auto-commit',
      title: 'Auto commit: tiện nhưng có bẫy',
      blocks: [
        {
          kind: 'table',
          head: ['Cấu hình', 'Mặc định', 'Ý nghĩa'],
          rows: [
            ['`enable.auto.commit`', '`true`', 'bật tự commit'],
            ['`auto.commit.interval.ms`', '`5000` (5 giây)', 'tối thiểu bao lâu commit một lần'],
          ],
        },
        { kind: 'video', scenes: ['auto'] },
        { kind: 'p', text: 'Không có luồng nền nào đếm giờ. Việc commit diễn ra **bên trong `poll()`**: nếu đã qua 5 giây kể từ lần commit trước, consumer commit **vị trí của những tin mà các lần `poll()` trước đã trả về**. Ngoài ra còn commit khi `close()` và khi bị thu hồi partition lúc rebalance. Tối đa khoảng 5 giây dữ liệu bị xử lý lại sau mỗi lần chết.' },
        { kind: 'video', scenes: ['autolost'] },
        {
          kind: 'code',
          code: `t=0s    poll -> nhận 0..99, đẩy vào thread pool
t=5s    poll -> đủ 5 giây -> commit 100
        nhưng thread pool mới xử lý xong 0..39
t=5,1s  chết. Khởi động lại -> đọc từ 100
        tin 40..99 KHÔNG BAO GIỜ được xử lý`,
        },
        {
          kind: 'list',
          items: [
            { text: 'Auto commit commit **những gì `poll()` đã trả về**, không phải những gì bạn **đã xử lý xong**. Kafka không biết bạn xử lý đến đâu.' },
            { text: 'Xử lý **xong trong cùng vòng lặp** rồi mới `poll()` tiếp → **at-least-once** (có thể lặp, không mất).' },
            { text: 'Xử lý **bất đồng bộ ở luồng khác** + auto commit → có thể **mất tin**. Phải tắt auto commit và commit thủ công.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Vì sao tăng `auto.commit.interval.ms` từ 5 lên 60 giây làm số tin bị xử lý lại sau sự cố tăng lên?', ['Vì broker chậm hơn', 'Vì khoảng "đã xử lý nhưng chưa commit" dài hơn, tối đa 60 giây dữ liệu bị đọc lại', 'Vì consumer chết nhiều hơn', 'Vì offset bị xoá'], 1, 'Khi chết, mọi thứ sau lần commit cuối đều bị đọc lại từ committed offset cũ.'),
            q('Consumer xử lý xong mỗi batch rồi mới `poll()` tiếp, dùng auto commit. Nó có thể mất tin không?', ['Có, thường xuyên', 'Không (khi chạy bình thường), vì commit chỉ vượt qua các tin đã xử lý xong ở vòng trước', 'Có, nếu interval nhỏ', 'Có, nếu có nhiều partition'], 1, 'Kẹp không bao giờ vượt qua trang chưa đọc, vì tới lúc poll() tiếp thì batch trước đã xử lý xong.'),
            q('Vì sao "tự commit mỗi 5 giây" không có nghĩa là có đồng hồ nền commit đúng mỗi 5 giây?', ['Vì Kafka quên', 'Vì việc commit được kiểm tra bên trong `poll()`; không ai gọi `poll()` thì không có commit', 'Vì broker quyết định', 'Vì commit chạy theo batch.size'], 1, 'Nếu một batch xử lý mất 30 giây, lần commit kế tiếp chỉ xảy ra khi poll() được gọi lại sau 30 giây đó.'),
          ],
        },
      ],
    },
    {
      id: 'commit-thu-cong',
      title: 'Commit thủ công: commitSync và commitAsync',
      blocks: [
        { kind: 'p', text: 'Muốn tự quyết **lúc nào** dời kẹp (ví dụ chỉ sau khi ghi DB thành công), đặt `enable.auto.commit=false` và gọi commit bằng tay.' },
        { kind: 'video', scenes: ['sync'] },
        {
          kind: 'table',
          head: ['', '`commitSync()`', '`commitAsync()`'],
          rows: [
            ['Chờ broker trả lời?', 'Có, **chặn** đến khi xong', 'Không, gửi rồi làm tiếp'],
            ['Lỗi tạm thời', '**Tự thử lại** đến khi thành công hoặc hết thời gian chờ', '**Không thử lại**, chỉ báo qua callback'],
            ['Tốc độ', 'Chậm hơn (mỗi lần một vòng mạng)', 'Nhanh'],
          ],
        },
        { kind: 'video', scenes: ['asyncorder'] },
        { kind: 'p', text: 'Nếu vẫn muốn thử lại trong callback, sách gợi ý dùng một **số thứ tự tăng dần**: mỗi lần commit tăng số lên và gửi kèm vào callback. Chỉ thử lại nếu số của lệnh hỏng vẫn bằng số hiện tại; nếu số hiện tại đã lớn hơn thì đã có lệnh mới hơn, bỏ qua. (📘 sách, ch.4)' },
        { kind: 'callout', tone: 'tip', title: 'Mẫu dùng phổ biến', text: '`commitAsync()` trong vòng lặp cho nhanh (lỡ một lần thất bại thì lần sau bù), và `commitSync()` **một lần cuối** trước `close()` hoặc trong `onPartitionsRevoked` (Module 5.4), vì đó là cơ hội cuối, không còn "lần sau" để bù.' },
        { kind: 'p', text: '`commitSync()` / `commitAsync()` **không tham số** commit vị trí **sau tin cuối cùng mà `poll()` vừa trả về**. Gọi chúng **giữa chừng** một mẻ chưa xử lý xong là dời kẹp qua những tin chưa làm → chết lúc đó thì mất. Muốn commit giữa mẻ, truyền map offset do mình theo dõi: (📘 sách, ch.4)' },
        {
          kind: 'code',
          code: `// sau khi xử lý xong record r
current.put(new TopicPartition(r.topic(), r.partition()),
            new OffsetAndMetadata(r.offset() + 1));   // +1: tin TIẾP THEO
if (++count % 1000 == 0) consumer.commitAsync(current, null);`,
        },
        { kind: 'callout', tone: 'warn', title: 'Commit không rẻ', text: 'Mỗi lần commit giống một lần ghi `acks=all`, và mọi commit của một group đều dồn về **cùng một broker** (group coordinator). Commit quá dày có thể làm quá tải broker đó. Lỗi hay gặp: commit `r.offset()` thay vì `r.offset() + 1`, hoặc commit offset của tin **đã đọc** thay vì **đã xử lý**. (📘 sách, ch.7)' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('`commitAsync` không tự thử lại vì sao?', ['Vì chậm', 'Vì lệnh cũ thử lại có thể ghi đè lệnh mới hơn, làm offset lùi', 'Vì không có mạng', 'Vì chỉ dùng cho auto commit'], 1, 'Ví dụ commit(100) lạc, commit(200) thành công, thử lại commit(100) thì kẹp lùi về 100.'),
            q('Vì sao trong `onPartitionsRevoked` nên dùng `commitSync`?', ['Vì nhanh hơn', 'Vì ngay sau đó partition giao cho người khác, commit async bị lạc thì không còn "lần sau" để bù', 'Vì commitAsync bị cấm', 'Vì rebalance huỷ callback'], 1, 'commitSync chờ đến khi chắc chắn đã ghi.'),
            q('`poll()` trả P0 offset 1000..1499. Xử lý xong tin 1200 thì gọi `commitSync()` không tham số rồi chết. Lần sau đọc từ đâu?', ['1201', '1200', '1500, mất tin 1201..1499', '1000'], 2, 'Commit không tham số ghi vị trí sau tin cuối `poll()` trả về. Sửa: commit map {P0: 1201}, hoặc commit sau khi xử lý hết mẻ.'),
          ],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: chọn cách commit rồi cho consumer chết',
      blocks: [
        { kind: 'p', text: 'Chọn cách commit, nơi xử lý tin và thời điểm consumer chết. Xem committed offset dừng ở đâu, bao nhiêu tin bị lặp hoặc mất.' },
        { kind: 'widget', name: 'commit-lab' },
      ],
    },
    {
      id: 'tom-tat-video',
      title: 'Nhìn lại cả bài',
      blocks: [{ kind: 'video', scenes: ['summary'] }],
    },
  ],
  finalQuiz: [
    q('Committed offset của một partition có ý nghĩa gì?', ['Offset của tin cuối cùng đã xử lý', 'Offset của tin tiếp theo group cần đọc', 'Số tin trong partition', 'Offset của tin đã replicate đủ'], 1, 'Đọc xong tin 29 thì commit 30.'),
    q('Consumer dùng auto commit, xử lý cùng luồng, chết ở giây 4,5 khi chưa commit lần nào. Chuyện gì xảy ra?', ['Mất tin', 'Các tin đã xử lý bị xử lý lại', 'Không sao cả', 'Group bị xoá'], 1, 'Chưa commit nên khởi động lại đọc từ offset cũ: xử lý lặp, không mất.'),
    q('Cấu hình nào dễ khiến auto commit làm MẤT tin?', ['Interval 60 giây', 'Đẩy tin sang luồng khác xử lý rồi poll tiếp ngay', 'Tăng số partition', 'Dùng acks=all'], 1, 'Poll commit vị trí đã trả về, trong khi luồng kia chưa xử lý xong.'),
    q('Mẫu commit nào hay dùng trong thực tế?', ['Chỉ commitAsync, không bao giờ commitSync', 'commitAsync trong vòng lặp, commitSync một lần cuối trước khi đóng', 'commitSync sau mỗi tin', 'Không commit'], 1, 'Async cho nhanh, sync lần cuối để chắc chắn.'),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao commitAsync không tự thử lại khi thất bại?',
      keywords: ['thử lại', 'ghi đè', 'lùi', 'mới hơn'],
      modelAnswer: 'Vì lệnh commit cũ thử lại có thể đến sau lệnh commit mới hơn và ghi đè lên, làm committed offset lùi về giá trị cũ. Lần sau consumer sẽ đọc lại những tin đã xử lý. Nên Kafka để bạn tự quyết trong callback, chỉ thử lại khi chưa có lệnh commit nào mới hơn.',
    },
  ],
  recap: {
    journey:
      'Consumer chết phải biết đọc tiếp từ đâu → committed offset là tin tiếp theo, lưu trong __consumer_offsets → chỗ kẹp quyết định mất hay lặp → auto commit commit cái poll trả về nên có thể lặp, và mất nếu xử lý ở luồng khác → commit bằng tay: commitAsync nhanh nhưng không thử lại vì sợ offset lùi, commitSync dùng lần cuối.',
    points: [
      { title: 'Committed offset', text: 'Tin tiếp theo cần đọc, ghi như một tin nhắn vào __consumer_offsets (compaction).' },
      { title: 'Auto commit', text: 'Commit trong poll(), theo những gì poll đã trả về. Cùng luồng: lặp. Luồng khác: có thể mất.' },
      { title: 'commitSync / commitAsync', text: 'Sync chặn và tự thử lại; async nhanh, không thử lại vì có thể làm offset lùi.' },
      { title: 'Mẫu hay dùng', text: 'commitAsync trong vòng lặp, commitSync một lần cuối; offset thủ công luôn là offset + 1.' },
    ],
    next: 'Bài tiếp theo: Ba mức đảm bảo giao nhận — at-most-once, at-least-once, exactly-once.',
  },
}
