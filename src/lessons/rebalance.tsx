import type { ReactNode } from 'react'
import { cameraAt, clamp, lerp, move, sp, span, vis } from '../player/motion-kit'
import { ConsumerUnit, Envelope, HERO, Icon3D, Note, Packets, PartitionTapes, Rise, SOFT, SOFT_PANEL, ServerUnit, SoftScene, SoftTheme, Statement, SummaryList, Wire } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene, SceneSfx } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { rebalanceScript } from './rebalance-script'

/** This lesson is drawn in the navy glow style. */
const INK = SOFT
const panel = SOFT_PANEL
const WIDE = { x: 960, y: 540, s: 1 }

/* ------------------------------------------------------------------ shared: partitions → consumers board */

const B = { TX: 320, CW: 64, CELLS: 8, rowY: (p: number) => 250 + p * 170 + 35, unitX: 1280, unitY: (k: number) => 200 + k * 240 }
const END = B.TX + B.CELLS * B.CW + 16

/**
 * Four partitions on the left, consumers on the right. `owner(p)` is who reads partition p right now (undefined =
 * nobody, the partition is paused). Reading partitions get a live wire with flowing messages; paused ones a red pill.
 */
function Board({ t, owner, since, units, skip = [], prev }: { t: number; owner: (p: number) => number | undefined; since: number; skip?: number[]; prev?: (p: number) => number | undefined; units: { name: string; at: number; note?: string; idle?: boolean; accent?: string }[] }) {
  return (
    <>
      <div style={{ position: 'absolute', left: B.TX - 90, top: 190, fontSize: 26, fontWeight: 700, color: INK.faint }}>topic clicks</div>
      <PartitionTapes x={B.TX} y={250} partitions={4} cells={B.CELLS} cellW={B.CW} gap={170} state={(_, i) => (i < 6 ? 'filled' : 'empty')} />
      {[0, 1, 2, 3].map((p) => {
        if (skip.includes(p)) return null
        const k = owner(p)
        const was = prev?.(p)
        if (k === undefined)
          return (
            <div key={`${p}-x`}>
              {/* the old reading wire fades out instead of vanishing in one frame */}
              {was !== undefined && (
                <div style={{ opacity: 1 - span(t, since, since + 0.35) }}>
                  <Wire from={{ x: END, y: B.rowY(p) }} to={{ x: B.unitX - 14, y: B.unitY(was) + 59 }} color={INK.line} flow={t} />
                </div>
              )}
            <div style={{ position: 'absolute', left: END + 20, top: B.rowY(p) - 22, padding: '6px 16px', borderRadius: 999, border: `1.5px solid ${INK.bad}`, background: 'rgba(60,10,30,0.55)', boxShadow: `0 0 16px ${INK.bad}88`, fontSize: 26, fontWeight: 800, color: INK.bad, opacity: vis(t, since, Infinity, 0.25) }}>
              ⏸ ngừng đọc
            </div>
            </div>
          )
        const from = { x: END, y: B.rowY(p) }
        const to = { x: B.unitX - 14, y: B.unitY(k) + 59 }
        return (
          <div key={`${p}-${k}`}>
            {/* coming back from a pause: the "⏸ ngừng đọc" pill fades out instead of vanishing */}
            {prev && was === undefined && (
              <div style={{ position: 'absolute', left: END + 20, top: B.rowY(p) - 22, padding: '6px 16px', borderRadius: 999, border: `1.5px solid ${INK.bad}`, background: 'rgba(60,10,30,0.55)', fontSize: 26, fontWeight: 800, color: INK.bad, opacity: 1 - span(t, since, since + 0.3) }}>⏸ ngừng đọc</div>
            )}
            <Wire from={from} to={to} color={INK.line} p={move(t, since + p * 0.06, 0.45)} flow={t} />
            <Packets t={t} from={from} to={to} start={since + 0.4 + p * 0.13} every={0.5} len={0.8} size={18} />
          </div>
        )
      })}
      {units.map((u, k) => {
        const parts = [0, 1, 2, 3].filter((p) => owner(p) === k).map((p) => `P${p}`)
        // the partitions this unit held before `since`; the reading and idle looks cross-fade instead of swapping
        const before = prev ? [0, 1, 2, 3].filter((p) => prev(p) === k).map((p) => `P${p}`) : parts
        const f = span(t, since, since + 0.35)
        const active = parts.length ? (before.length ? 1 : f) : before.length ? 1 - f : 0
        const shown = parts.length ? parts : before
        const unit = (on: boolean) => (
          <ConsumerUnit x={B.unitX} y={B.unitY(k)} w={420} name={u.name} parts={on ? shown : undefined} idle={on ? false : u.idle ?? true} note={u.note} accent={u.accent} t={t} busy={on ? (t * 1.2 + k * 0.3) % 1 : undefined} />
        )
        return (
          <Rise key={u.name} t={t} at={u.at}>
            {active < 1 && <div style={{ opacity: 1 - active }}>{unit(false)}</div>}
            {active > 0 && <div style={{ opacity: active }}>{unit(true)}</div>}
          </Rise>
        )
      })}
    </>
  )
}

/** "Paused partitions: n/4" readout. */
const PausedPanel = ({ n, o = 1 }: { n: number; o?: number }) => (
  <div style={{ ...panel, left: 760, top: 940, fontSize: 30, color: n ? INK.bad : INK.good, opacity: clamp(o) }}>ngừng đọc: {n}/4 partition</div>
)

/* ------------------------------------------------------------------ 0. cold open: one join pauses everything */

function hook(t: number, c: Cue) {
  const [a1, a2] = [c.at(1), c.at(2)]
  const resume = a2 + (c.end(2) - a2) * 0.85
  const before = [0, 0, 1, 1]
  const after = [0, 0, 1, 2]
  const owner = (p: number) => (t < a2 + 0.4 ? before[p] : t < resume ? undefined : after[p])
  const since = t < a2 + 0.4 ? 0.6 : t < resume ? a2 + 0.4 : resume
  const paused = t >= a2 + 0.4 && t < resume
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, { x: 900, y: 540, s: 1.06 }], [a1, { x: 1180, y: 600, s: 1.08 }, 1.2], [a2, WIDE, 1.2]])}>
      <Board t={t} owner={owner} since={since} prev={(p) => (t < resume ? before[p] : undefined)} units={[{ name: 'C1', at: 0.3 }, { name: 'C2', at: 0.5 }, { name: 'C3', at: a1 + 0.3, note: 'vừa vào', accent: INK.warn }]} />
      <PausedPanel n={paused ? 4 : 0} o={vis(t, a2 + 0.4)} />
      <Statement x={B.TX - 90} y={60} text="chuyển 1 partition → dừng cả 4" color={INK.bad} size={46} o={sp(t, a2 + 1.4)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 1. what triggers a rebalance */

/** Simple white line glyphs for the trigger tiles (24×24 grid). */
const GLYPH: Record<string, ReactNode> = {
  join: <path d="M12 5v14M5 12h14" />,
  leave: <path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" />,
  kill: <path d="M6 6l12 12M18 6L6 18" />,
  stuck: <path d="M7 4h10M7 20h10M8 4c0 5 8 6 8 8s-8 3-8 8M16 4c0 5-8 6-8 8" />,
  parts: <path d="M4 6h16M4 12h16M4 18h10M18 16v6M15 19h6" />,
  regex: <path d="M12 4v9M8 6l8 5M16 6l-8 5M6 19h2" />,
}

function triggers(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const d1 = c.end(1) - a1
  const tiles = [
    { g: 'join', label: 'consumer mới vào', at: a1 + 0.1 },
    { g: 'leave', label: 'tắt gọn (LeaveGroup)', at: a1 + d1 * 0.27 },
    { g: 'kill', label: 'chết im lặng', at: a1 + d1 * 0.52 },
    { g: 'stuck', label: 'treo, không poll', at: a1 + d1 * 0.78 },
    { g: 'parts', label: 'topic thêm partition', at: a2 + 0.3 },
    { g: 'regex', label: 'topic mới khớp regex', at: a2 + 1.4 },
  ]
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE]])} title={{ kicker: 'REBALANCE', text: 'Khi nào chia lại?' }}>
      <Statement x={560} y={250} text="thành viên thay đổi → chia lại" size={56} o={sp(t, a0 + 1.6)} />
      {tiles.map((tl, i) => (
        <Rise key={tl.g} t={t} at={tl.at}>
          <div style={{ position: 'absolute', left: 300 + (i % 3) * 470, top: 400 + Math.floor(i / 3) * 290, width: 380, display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ width: 120, height: 120, flex: 'none', borderRadius: 30, background: HERO, display: 'grid', placeItems: 'center', boxShadow: '0 0 34px rgba(77,141,255,0.6), 0 20px 40px rgba(0,4,30,0.6), inset 0 2px 0 rgba(255,255,255,0.5)' }}>
              <svg width={64} height={64} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 6px #fff)' }}>
                {GLYPH[tl.g]}
              </svg>
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: INK.text, lineHeight: 1.2 }}>{tl.label}</div>
          </div>
        </Rise>
      ))}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 2. heartbeat vs poll clocks */

function clocks(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const L = 260
  const R = 1300
  const kill = a1 + 1.6
  const dead = kill + 3.2
  const revive = a2
  const beating = t < kill || t >= revive
  const silent = t >= kill && t < revive ? Math.min(45, (45 * (t - kill)) / 3.2) : 0
  const stuckAt = a2 + 0.8
  const pollGap = t >= a3 + 0.3 ? Math.min(5, (5 * (t - a3 - 0.3)) / 4) : 0
  const hung = pollGap >= 5
  const unitState = t >= dead && t < revive ? 'dead' : hung ? 'hung' : 'ok'
  const track = (y: number, label: string, o: number) => (
    <div style={{ opacity: clamp(o) }}>
      <div style={{ position: 'absolute', left: L, top: y - 64, fontSize: 28, fontWeight: 800, color: INK.faint }}>{label}</div>
      <div style={{ position: 'absolute', left: L, top: y - 2, width: R - L, height: 4, borderRadius: 2, background: 'linear-gradient(90deg, rgba(110,160,255,0.15), rgba(110,160,255,0.6))', boxShadow: '0 0 12px rgba(91,151,255,0.5)' }} />
    </div>
  )
  // poll() ticks on the main thread, then one process() that never returns
  const pollTicks = [0, 1, 2].map((k) => a2 - 3 + k * 1.1).filter((x) => x > 0)
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 1000, y: 440, s: 1.08 }, 1.2], [a2, { x: 1000, y: 560, s: 1.1 }, 1.2]])} title={{ kicker: 'PHÁT HIỆN', text: 'Hai đồng hồ', until: a1 }}>
      {track(360, 'luồng nền · nhịp tim mỗi 3 giây', vis(t, a0 + 1.0))}
      {beating && <Packets t={t} from={{ x: L, y: 360 }} to={{ x: R, y: 360 }} start={a0 + 1.0} end={t < kill ? kill : Infinity} every={0.5} len={1.6} color={INK.good} size={26} />}
      <div style={{ ...panel, left: L, top: 410, fontSize: 28, color: silent ? (silent >= 45 ? INK.bad : INK.warn) : INK.good, opacity: vis(t, a1 + 0.6) }}>
        không nghe nhịp tim: {Math.floor(silent)}s / 45s {silent >= 45 ? '→ CHẾT' : ''}
      </div>
      <div style={{ ...panel, left: 860, top: 410, fontSize: 26, color: INK.bad, opacity: vis(t, kill, revive - 0.3, 0.2) }}>kill -9</div>
      {track(720, 'luồng chính · gọi poll()', vis(t, a2 - 3.2))}
      {pollTicks.map((x, k) => (
        <div key={k} style={{ position: 'absolute', left: L + 40 + k * 150, top: 696, padding: '4px 14px', borderRadius: 999, background: 'rgba(8,22,82,0.92)', border: '1.5px solid #6ea2ff', boxShadow: '0 0 14px rgba(77,141,255,0.6)', fontFamily: MONO, fontSize: 20, fontWeight: 700, color: '#fff', opacity: vis(t, x, Infinity, 0.2) }}>
          poll
        </div>
      ))}
      <div style={{ position: 'absolute', left: L + 500, top: 700, height: 40, width: lerp(0, R - L - 520, span(t, stuckAt, a3 + 4.3)), borderRadius: 12, background: `linear-gradient(90deg, ${INK.warn}55, ${INK.warn})`, boxShadow: `0 0 18px ${INK.warn}88`, opacity: vis(t, stuckAt) }} />
      <div style={{ position: 'absolute', left: L + 516, top: 704, fontFamily: MONO, fontSize: 22, fontWeight: 700, color: '#1a1200', opacity: vis(t, stuckAt + 0.4) }}>process() … kẹt</div>
      <div style={{ ...panel, left: L, top: 780, fontSize: 28, color: hung ? INK.bad : INK.warn, opacity: vis(t, a3 + 0.3) }}>
        không gọi poll: {pollGap.toFixed(1).replace('.', ',')} / 5 phút {hung ? '→ TREO' : ''}
      </div>
      <Note x={L + 700} y={360} dx={40} dy={-60} text="nhịp tim vẫn đều" color={INK.good} o={vis(t, a2 + 1.4, a3)} />
      <Rise t={t} at={a0 + 0.4}>
        <ConsumerUnit x={1340} y={480} w={480} name="consumer-1" note={unitState === 'dead' ? 'chết → chia lại' : unitState === 'hung' ? 'treo → rời group' : 'đang chạy'} down={unitState !== 'ok'} t={t} parts={['P0', 'P1']} />
      </Rise>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 3. eager: stop the world */

function eager(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const revoke = a0 + 2.0
  const resume = a1 + (c.end(1) - a1) * 0.9
  const before = [0, 0, 1, 1]
  const after = [0, 0, 1, 2]
  const owner = (p: number) => (t < revoke ? before[p] : t < resume ? undefined : after[p])
  const since = t < revoke ? 0.6 : t < resume ? revoke : resume
  const stopped = t >= revoke && t < resume
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a2, { x: 960, y: 600, s: 0.98 }, 1.2]])} title={{ kicker: 'EAGER', text: 'Dừng cả thế giới', until: a0 + 1.4 }}>
      <Board t={t} owner={owner} since={since} prev={(p) => (t < resume ? before[p] : undefined)} units={[{ name: 'C1', at: 0.2 }, { name: 'C2', at: 0.35 }, { name: 'C3', at: a0 + 0.8, note: 'vừa vào', accent: INK.warn }]} />
      {[0, 1].map((k) => (
        <Envelope key={k} t={t} at={revoke - 0.2 + k * 0.15} from={{ x: B.unitX, y: B.unitY(k) + 59 }} to={{ x: END + 120, y: B.rowY(k * 2) + 40 }} label={k ? 'trả P2 P3' : 'trả P0 P1'} color={INK.bad} />
      ))}
      <PausedPanel n={stopped ? 4 : 0} o={vis(t, revoke)} />
      <Statement x={B.TX - 90} y={70} text="100 consumer · 1.000 partition → khựng vài chục giây" color={INK.warn} size={40} o={sp(t, a2 + 0.6)} />
      <Icon3D name="clock" x={1250} y={968} size={120} t={t} at={a2 + 1.0} />
      <div style={{ ...panel, left: 1330, top: 940, fontSize: 30, color: INK.warn, opacity: vis(t, a2 + 1.4) }}>mỗi lần scale: ⏸ ~30 giây</div>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 4. cooperative: only what must move */

function coop(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const d1 = c.end(1) - a1
  const round1 = a1 + 0.5
  const round2 = a1 + d1 * 0.62
  const owner = (p: number) => (p < 3 ? [0, 0, 1][p] : t < round1 ? 1 : t < round2 + 0.6 ? undefined : 2)
  const since = (p: number) => (p === 3 && t >= round2 + 0.6 ? round2 + 0.6 : 0.6)
  const pill = (text: string, on: number, off: number, left = 860, top = 100) => (
    <div style={{ position: 'absolute', left, top, padding: '10px 24px', borderRadius: 999, background: HERO, boxShadow: '0 0 26px rgba(77,141,255,0.7)', fontSize: 28, fontWeight: 800, color: '#fff', opacity: vis(t, on, off, 0.3) }}>{text}</div>
  )
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 1000, y: 560, s: 1.06 }, 1.2], [a2, WIDE, 1.2]])} title={{ kicker: 'COOPERATIVE', text: 'Chỉ trả phần phải chuyển', until: a0 + 1.4 }}>
      <Board t={t} owner={owner} since={0.6} skip={[3]} units={[{ name: 'C1', at: 0.2 }, { name: 'C2', at: 0.35 }, { name: 'C3', at: 0.5, note: t < round2 + 0.6 ? 'vừa vào' : undefined, accent: INK.warn }]} />
      {owner(3) !== undefined ? (
        <div style={{ position: 'absolute', inset: 0 }}>
          <Wire from={{ x: END, y: B.rowY(3) }} to={{ x: B.unitX - 14, y: B.unitY(owner(3) as number) + 59 }} color={INK.line} p={move(t, since(3), 0.45)} flow={t} />
          <Packets t={t} from={{ x: END, y: B.rowY(3) }} to={{ x: B.unitX - 14, y: B.unitY(owner(3) as number) + 59 }} start={since(3) + 0.4} every={0.5} len={0.8} size={18} />
        </div>
      ) : null}
      {/* P3 is drawn here (not by the board) so only it re-wires when it moves */}
      {owner(3) === undefined && (
        <div style={{ position: 'absolute', left: END + 20, top: B.rowY(3) - 22, padding: '6px 16px', borderRadius: 999, border: `1.5px solid ${INK.warn}`, background: 'rgba(60,40,10,0.55)', boxShadow: `0 0 16px ${INK.warn}88`, fontSize: 22, fontWeight: 800, color: INK.warn }}>⏸ đang chuyển</div>
      )}
      <Envelope t={t} at={round1 - 0.3} from={{ x: B.unitX, y: B.unitY(1) + 59 }} to={{ x: END + 140, y: B.rowY(3) }} label="trả P3" color={INK.warn} />
      <Envelope t={t} at={round2} from={{ x: END + 140, y: B.rowY(3) }} to={{ x: B.unitX, y: B.unitY(2) + 59 }} label="nhận P3" color={INK.good} />
      {pill('Vòng 1', round1 - 0.2, round2 - 0.2)}
      {pill('Vòng 2', round2, a2)}
      {pill('2 vòng · không ai đứng chờ', a2 + 1.6, Infinity, 1290, 70)}
      <PausedPanel n={owner(3) === undefined ? 1 : 0} o={vis(t, a1)} />
      <Statement x={B.TX - 90} y={70} text="P0 P1 P2 không ngừng giây nào" color={INK.good} size={46} o={sp(t, a2 + 0.4)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 5. static membership */

function staticScene(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const d0 = c.end(0) - a0
  // rolling restart without static ids: pod k blinks off/on, 2 rebalances each
  const step = (d0 - 1) / 10
  const podAt = (k: number) => a0 + 0.8 + k * step
  const done = Math.max(0, Math.min(10, Math.floor((t - a0 - 0.8) / step + 0.5)))
  const restartAt = a1 + 1.8
  const backAt = a2 + 1.0
  const away = t >= restartAt && t < backAt
  const elapsed = away ? lerp(0, 40, span(t, restartAt, backAt)) : t >= backAt ? 40 : 0
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, { x: 960, y: 400, s: 1.12 }], [a1, { x: 960, y: 520, s: 1.12 }, 1.3]])} title={{ kicker: 'ROLLING RESTART', text: 'Static membership', until: a0 + 1.2 }}>
      <div style={{ position: 'absolute', left: 220, top: 200, fontSize: 26, fontWeight: 700, color: INK.faint }}>không có group.instance.id</div>
      {Array.from({ length: 10 }, (_, k) => {
        const off = t >= podAt(k) && t < podAt(k) + step * 0.8
        return (
          <div key={k} style={{ position: 'absolute', left: 200 + k * 118, top: 250, width: 108, height: 84, borderRadius: 20, display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 800, color: '#fff', background: off ? 'rgba(40,50,90,0.6)' : HERO, border: off ? `1.5px solid ${INK.bad}` : 'none', boxShadow: off ? undefined : '0 0 18px rgba(77,141,255,0.5)', opacity: vis(t, a0 + 0.3 + k * 0.04) }}>
            pod-{k + 1}
          </div>
        )
      })}
      <div style={{ ...panel, left: 1420, top: 256, fontSize: 32, color: INK.bad, opacity: vis(t, a0 + 0.8) }}>rebalance: {done * 2}</div>
      <div style={{ position: 'absolute', left: 220, top: 520, fontFamily: MONO, fontSize: 26, color: INK.faint, opacity: vis(t, a1) }}>group.instance.id = pod-1</div>
      <Rise t={t} at={a1 + 0.3}>
        <ConsumerUnit x={220} y={570} w={480} name="pod-1" note={away ? 'khởi động lại · giữ chỗ' : t >= backAt ? 'đã về · phần cũ' : 'đang chạy'} idle={away} parts={['P0', 'P1']} t={t} busy={away ? undefined : (t * 1.2) % 1} />
      </Rise>
      <div style={{ opacity: vis(t, restartAt) }}>
        <div style={{ position: 'absolute', left: 820, top: 570, fontSize: 26, fontWeight: 700, color: INK.faint }}>vắng mặt {Math.round(elapsed)}s / session.timeout 120s</div>
        <div style={{ position: 'absolute', left: 820, top: 620, width: 840, height: 18, borderRadius: 9, background: 'rgba(110,160,255,0.15)' }} />
        <div style={{ position: 'absolute', left: 820, top: 620, width: (840 * elapsed) / 120, height: 18, borderRadius: 9, background: HERO, boxShadow: '0 0 14px rgba(77,141,255,0.7)' }} />
        <div style={{ position: 'absolute', left: 820 + 840 - 2, top: 600, width: 3, height: 58, background: INK.bad }} />
      </div>
      <div style={{ ...panel, left: 820, top: 700, fontSize: 32, color: INK.good, opacity: vis(t, backAt + 0.2) }}>rebalance: 0</div>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 6. KIP-848: the broker assigns */

function kip848(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const COORD = { x: 960, y: 380 }
  const xs = [200, 600, 1000, 1400]
  const UY = 700
  const top = (k: number) => ({ x: xs[k] + 160, y: UY - 8 })
  const slowArrive = a0 + 2.8
  const classic = t < a1
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a2, { x: 960, y: 600, s: 1.02 }, 1.2]])} title={{ kicker: 'KIP-848', text: 'Giao thức mới', until: a0 + 1.2 }}>
      <Rise t={t} at={0.3}>
        <ServerUnit x={830} y={220} name="coordinator" t={t} />
      </Rise>
      {classic &&
        xs.map((_, k) => <Envelope key={k} t={t} at={k === 3 ? slowArrive : a0 + 1.6 + k * 0.2} from={top(k)} to={{ x: COORD.x + (k - 1.5) * 60, y: COORD.y }} label="JoinGroup" len={k === 3 ? 1.2 : 0.8} />)}
      {classic &&
        xs.map((_, k) => <Envelope key={`s${k}`} t={t} at={slowArrive + 1.3 + k * 0.12} from={{ x: COORD.x + (k - 1.5) * 60, y: COORD.y }} to={top(k)} label="SyncGroup" color={INK.good} len={0.8} />)}
      <Rise t={t} at={a1 + 0.2}>
        <div style={{ position: 'absolute', left: 1180, top: 250, padding: '10px 24px', borderRadius: 999, background: 'rgba(8,22,82,0.92)', border: '1.5px solid #6ea2ff', boxShadow: '0 0 18px rgba(77,141,255,0.65)', fontFamily: MONO, fontSize: 24, color: '#fff' }}>group.protocol = consumer · Kafka 4.0</div>
      </Rise>
      <Envelope t={t} at={a2 + 0.4} from={{ x: COORD.x, y: COORD.y + 50 }} to={top(1)} label="thả P3" color={INK.warn} len={1.0} />
      <Envelope t={t} at={a2 + 1.8} from={{ x: COORD.x, y: COORD.y + 50 }} to={top(2)} label="nhận P3" color={INK.good} len={1.0} />
      {xs.map((x, k) => {
        const waiting = classic && t > a0 + 1.6 && t < slowArrive + 0.8 && k < 3
        const parts = [['P0'], t < a2 + 1.4 ? ['P1', 'P3'] : ['P1'], t < a2 + 2.8 ? ['P2'] : ['P2', 'P3'], ['P4']][k]
        return (
          <Rise key={x} t={t} at={0.5 + k * 0.15}>
            <ConsumerUnit x={x} y={UY} w={320} name={`C${k + 1}`} note={waiting ? '⏳ chờ cả group' : k === 3 && classic ? 'khởi động chậm…' : undefined} idle={waiting} accent={k === 3 && classic ? INK.warn : undefined} parts={parts} t={t} busy={waiting ? undefined : (t * 1.1 + k * 0.25) % 1} />
          </Rise>
        )
      })}
      <Statement x={420} y={900} text="classic: một người chậm → cả group chờ" color={INK.warn} size={40} o={sp(t, a0 + 2.2) * (1 - span(t, a1 - 0.4, a1))} />
      <Statement x={360} y={900} text="mới: từng người tự điều chỉnh, không ai chờ ai" color={INK.good} size={40} o={sp(t, a2 + 3.0)} />
      <div style={{ position: 'absolute', left: 440, top: 255, padding: '8px 20px', borderRadius: 999, background: HERO, boxShadow: '0 0 20px rgba(77,141,255,0.6)', fontSize: 26, fontWeight: 800, color: '#fff', opacity: vis(t, a1 + 0.3) }}>broker tự tính bảng chia</div>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 7. summary */

function summary(t: number, c: Cue) {
  return (
    <SoftTheme>
      <SummaryList t={t} cue={c} items={['Thành viên đổi → group chia lại', 'Nhịp tim bắt chết · đồng hồ poll bắt treo', 'Eager dừng hết · cooperative chỉ dừng phần chuyển', 'Static membership: restart ngắn không rebalance']} />
    </SoftTheme>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { hook, triggers, clocks, eager, coop, static: staticScene, kip848, summary }

/** Key-moment sounds, timed to the same cue offsets the scenes animate on. */
const SFX: Record<string, SceneSfx[]> = {
  hook: [{ kind: 'error', at: (c) => c.at(2) + 0.4 }],
  clocks: [
    { kind: 'error', at: (c) => c.at(1) + 1.6 + 3.2 },
    { kind: 'error', at: (c) => c.at(3) + 4.3 },
  ],
  eager: [{ kind: 'error', at: (c) => c.at(0) + 2.0 }],
  coop: [{ kind: 'ding', at: (c) => c.at(1) + (c.end(1) - c.at(1)) * 0.62 + 0.6 }],
  static: [{ kind: 'ding', at: (c) => c.at(2) + 1.0 }],
}

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const rebalanceLesson: Lesson = {
  ...rebalanceScript,
  scenes: rebalanceScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id], sfx: SFX[s.id] })),
  intro: [
    { kind: 'video', scenes: ['hook'] },
    {
      kind: 'quiz',
      title: 'Quick Quiz',
      questions: [q('Đoán trước khi học: group 2 consumer, 4 partition, thêm consumer thứ 3 với cấu hình mặc định. Trong lúc chia lại, bao nhiêu partition ngừng đọc?', ['0', '1', '2', 'Cả 4'], 3, 'Mặc định vẫn là eager (RangeAssignor): mọi người trả hết rồi chia lại. Phần 2 giải thích.')],
    },
  ],
  roadmap: [
    'Chặng 1: Khi nào group chia lại, và hai đồng hồ phát hiện consumer chết hay treo.',
    'Chặng 2: Eager dừng cả group; cooperative chỉ trả phần phải chuyển.',
    'Chặng 3: Static membership cho rolling restart, và giao thức mới KIP-848 chuyển việc chia về broker.',
  ],
  sections: [
    {
      id: 'khi-nao',
      title: 'Khi nào chia lại, và hai đồng hồ',
      blocks: [
        { kind: 'video', scenes: ['triggers'] },
        {
          kind: 'table',
          head: ['Nguyên nhân', 'Ví dụ'],
          rows: [
            ['Consumer **mới vào**', 'scale từ 2 lên 3 pod'],
            ['Consumer **rời đi gọn**', 'tắt app, Ctrl+C (gửi `LeaveGroup`)'],
            ['Consumer **chết im lặng**', '`kill -9`, mất mạng: ngừng gửi nhịp tim'],
            ['Consumer **treo**', 'xử lý một mẻ quá lâu, không gọi `poll()`'],
            ['Topic **thêm partition**', '4 lên 6 partition'],
            ['**Topic mới khớp** regex đang subscribe', 'subscribe `test.*`, ai đó tạo `test-2` (📘 sách, ch.4)'],
          ],
        },
        { kind: 'video', scenes: ['clocks'] },
        {
          kind: 'table',
          head: ['Cấu hình', 'Mặc định', 'Đo cái gì', 'Vượt quá thì'],
          rows: [
            ['`heartbeat.interval.ms`', '3.000 ms', 'khoảng cách giữa hai nhịp tim', '(chỉ là nhịp)'],
            ['`session.timeout.ms`', '**45.000 ms** (từ 3.0; trước là 10.000)', 'bao lâu không nghe nhịp tim', 'coi là **chết**, chia lại'],
            ['`max.poll.interval.ms`', '**300.000 ms**', 'bao lâu luồng chính không gọi `poll()`', 'coi là **treo**, tự rời group'],
          ],
        },
        { kind: 'callout', tone: 'info', title: 'Vì sao cần hai đồng hồ?', text: 'Nhịp tim chạy ở **luồng nền**, chỉ chứng minh tiến trình còn sống. App có thể kẹt vô hạn trong `process()` mà nhịp tim vẫn đều. `max.poll.interval.ms` bắt đúng trường hợp đó: luồng nền gửi `LeaveGroup` rồi ngừng nhịp tim, group chia lại ngay. (📘 sách, ch.4)' },
        {
          kind: 'list',
          items: [
            { title: 'kill -9 lúc 10:00:00', text: 'hết nhịp tim → coordinator phát hiện khoảng **10:00:45** → rebalance.' },
            { title: 'Tắt gọn lúc 10:00:00', text: 'gửi `LeaveGroup` → rebalance **ngay**.' },
            { title: 'Kẹt trong process() lúc 10:00:00', text: 'nhịp tim vẫn đều → **10:05:00** tự rời group. Khi tỉnh lại, commit bị từ chối (`CommitFailedException`), mẻ đó bị **người khác xử lý lại**.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Mạng của một consumer đứt hẳn. Sau khoảng bao lâu partition của nó được giao cho người khác?', ['3 giây', '45 giây', '5 phút', 'Không bao giờ'], 1, 'Mất mạng thì mất nhịp tim; session.timeout.ms = 45 giây. 5 phút là đồng hồ của poll().'),
            q('Consumer kẹt vòng lặp vô hạn trong process(). Cái gì phát hiện?', ['session.timeout.ms', 'max.poll.interval.ms', 'heartbeat.interval.ms', 'Không gì cả'], 1, 'Luồng nhịp tim vẫn gửi đều, chỉ đồng hồ poll thấy luồng chính không quay lại.'),
          ],
        },
      ],
    },
    {
      id: 'eager-cooperative',
      title: 'Eager và cooperative-sticky',
      blocks: [
        {
          kind: 'quiz',
          title: 'Dự đoán trước khi xem',
          questions: [q('Chỉ cần chuyển P3 sang C3. Có cách nào để P0, P1, P2 không phải dừng không?', ['Không, rebalance luôn dừng hết', 'Có: chỉ trả đúng phần phải chuyển', 'Có: tắt group', 'Có: thêm partition'], 1, 'Đó là cooperative rebalancing.')],
        },
        { kind: 'video', scenes: ['eager'] },
        { kind: 'video', scenes: ['coop'] },
        {
          kind: 'table',
          head: ['', 'Eager (cũ)', 'Cooperative (mới)'],
          rows: [
            ['Lúc chia lại', 'mọi người trả **hết** partition', 'chỉ trả **phần phải chuyển**'],
            ['Partition ngừng đọc', 'tất cả', 'chỉ phần đang chuyển'],
            ['Số vòng', '1', 'ít nhất 2 (trả rồi mới giao)'],
            ['Assignor', '`RangeAssignor`, `RoundRobinAssignor`, `StickyAssignor`', '`CooperativeStickyAssignor`'],
          ],
        },
        { kind: 'callout', tone: 'warn', title: 'Mặc định vẫn là eager', text: 'Từ Kafka 3.0, mặc định là `[RangeAssignor, CooperativeStickyAssignor]`: group **vẫn dùng range (eager)**. Muốn cooperative phải tự cấu hình, bỏ `RangeAssignor` qua một lượt khởi động lại an toàn.' },
        { kind: 'callout', tone: 'tip', title: 'Vì sao cooperative cần hai vòng?', text: 'Phải chắc người cũ **đã thôi đọc** partition (vòng 1: trả) trước khi người mới **bắt đầu đọc** (vòng 2: giao). Giao ngay thì có lúc hai người cùng đọc một partition.' },
        {
          kind: 'table',
          head: ['Rebalance listener', 'Khi nào', 'Thường làm gì'],
          rows: [
            ['`onPartitionsRevoked`', 'sắp mất partition (eager: mọi partition; cooperative: chỉ phần phải trả)', '`commitSync` offset đã xử lý'],
            ['`onPartitionsAssigned`', 'sau khi được giao, trước khi đọc', 'nạp trạng thái, `seek()`'],
            ['`onPartitionsLost`', 'cooperative, partition đã về tay người khác', 'chỉ dọn tài nguyên, **không** commit'],
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Group 4 consumer, 8 partition, eager. Thêm consumer thứ 5. Bao nhiêu partition ngừng đọc trong lúc chia?', ['0', 'khoảng 1–2', '4', 'cả 8'], 3, 'Eager trả hết. Cooperative-sticky chỉ dừng khoảng 1–2 partition phải chuyển.')],
        },
      ],
    },
    {
      id: 'static-membership',
      title: 'Static membership (group.instance.id)',
      blocks: [
        { kind: 'video', scenes: ['static'] },
        { kind: 'p', text: 'Mỗi lần consumer khởi động, coordinator coi nó là **người lạ** nên phải chia lại. Đặt `group.instance.id=pod-1` để consumer có **tên cố định**:' },
        {
          kind: 'list',
          items: [
            { text: 'Tắt: **không** gửi `LeaveGroup`; coordinator giữ chỗ, partition tạm không ai đọc.' },
            { text: 'Quay lại **trước khi hết** `session.timeout.ms`: nhận lại đúng phần cũ, **không rebalance**.' },
            { text: 'Quá hạn mà chưa về: coordinator loại và chia lại. Hai consumer trùng tên: người sau đá người trước.' },
          ],
        },
        { kind: 'callout', tone: 'warn', title: 'Cái giá', text: 'Consumer chết thật thì partition của nó **không ai đọc** cho đến hết `session.timeout.ms`, lag tăng trong khoảng đó. Thường đi kèm tăng session timeout lên vài phút. Đáng dùng nhất khi consumer giữ **cache hoặc trạng thái cục bộ** tốn công dựng lại. (📘 sách, ch.4)' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Static membership, session.timeout.ms = 120 giây, pod restart mất 40 giây. Có rebalance không?', ['Có, 2 lần', 'Có, 1 lần', 'Không, pod về kịp và nhận lại phần cũ', 'Không, vì group bị khoá'], 2, '40 < 120. Nếu pod chết hẳn thì partition bỏ trống 120 giây.')],
        },
      ],
    },
    {
      id: 'giao-thuc-moi',
      title: 'Giao thức rebalance mới (KIP-848)',
      blocks: [
        { kind: 'video', scenes: ['kip848'] },
        {
          kind: 'table',
          head: ['', 'Cổ điển (`classic`)', 'Mới (`consumer`)'],
          rows: [
            ['Ai tính cách chia', 'trưởng nhóm (client)', '**broker** (group coordinator)'],
            ['Rebalance', 'cả group cùng họp', '**từng consumer tự điều chỉnh** qua heartbeat'],
            ['Nhịp tim, session', 'cấu hình ở client', 'ở **broker** (`group.consumer.session.timeout.ms`…)'],
            ['Chọn thuật toán', '`partition.assignment.strategy`', 'broker `group.consumer.assignors`; client `group.remote.assignor`'],
          ],
        },
        { kind: 'callout', tone: 'info', title: 'Bật thế nào?', text: 'Client đặt `group.protocol=consumer` (mặc định vẫn `classic`). GA từ **Kafka 4.0**. Trên 3.9.1 thử dùng sẽ gặp `UNSUPPORTED_VERSION`. Với giao thức mới, client **không được** đặt `session.timeout.ms`, `heartbeat.interval.ms`, `partition.assignment.strategy`; `max.poll.interval.ms` vẫn ở client.' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Dùng giao thức mới mà vẫn đặt session.timeout.ms=60000 ở consumer. Chuyện gì xảy ra?', ['Chạy bình thường', 'Lỗi cấu hình khi tạo consumer, vì session timeout giờ do broker quyết định', 'Broker bỏ qua', 'Rebalance liên tục'], 1, 'Cấu hình nhịp tim/session chuyển về broker.')],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: thử các tình huống rebalance',
      blocks: [
        { kind: 'p', text: 'Chọn sự kiện, kiểu chia và cấu hình. Xem khi nào group chia lại, bao nhiêu partition phải dừng, và một lần deploy gây bao nhiêu rebalance.' },
        { kind: 'widget', name: 'rebalance-lab' },
      ],
    },
    {
      id: 'tom-tat-video',
      title: 'Nhìn lại cả bài',
      blocks: [{ kind: 'video', scenes: ['summary'] }],
    },
  ],
  finalQuiz: [
    q('App tắt gọn (Ctrl+C). Group chia lại khi nào?', ['Ngay, nhờ LeaveGroup', 'Sau 45 giây', 'Sau 5 phút', 'Không chia lại'], 0, 'Chỉ tắt gọn mới kịp báo LeaveGroup.'),
    q('Vì sao heartbeat.interval.ms nên nhỏ hơn nhiều so với session.timeout.ms?', ['Để tiết kiệm mạng', 'Để lỡ vài nhịp do mạng chập chờn vẫn chưa bị coi là chết', 'Vì broker yêu cầu', 'Để poll nhanh hơn'], 1, '3 giây trong 45 giây cho phép lỡ hơn chục nhịp.'),
    q('Cooperative-sticky khác eager ở điểm nào?', ['Chia nhanh hơn trong 1 vòng', 'Chỉ trả phần phải chuyển, phần còn lại đọc liên tục', 'Không cần coordinator', 'Không bao giờ rebalance'], 1, 'Cái giá là ít nhất hai vòng.'),
    q('Rolling restart 10 pod không có static membership gây khoảng bao nhiêu rebalance?', ['0', '10', '20', '1'], 2, 'Mỗi pod tắt và bật: 2 lần.'),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao session.timeout.ms không phát hiện được consumer kẹt trong process()?',
      keywords: ['nhịp tim', 'luồng', 'poll', 'treo'],
      modelAnswer: 'Vì nhịp tim được gửi từ một luồng nền riêng, luồng đó vẫn chạy và gửi đều dù luồng xử lý chính đang kẹt. Coordinator vẫn nghe nhịp tim nên không coi là chết. Phải nhờ max.poll.interval.ms: luồng chính không quay lại gọi poll() quá 5 phút thì consumer bị coi là treo và rời group.',
    },
  ],
  recap: {
    journey:
      'Thêm một consumer mà cả 4 partition ngừng đọc → rebalance xảy ra khi thành viên thay đổi → nhịp tim bắt chết, đồng hồ poll bắt treo → eager trả hết nên dừng cả group → cooperative chỉ trả phần phải chuyển qua hai vòng → static membership giữ chỗ khi restart → giao thức mới để broker tự chia, không ai chờ ai.',
    points: [
      { title: 'Khi nào', text: 'Vào, ra, chết, treo, thêm partition, topic mới khớp regex.' },
      { title: 'Hai đồng hồ', text: 'session.timeout.ms (45 giây) bắt chết; max.poll.interval.ms (5 phút) bắt treo.' },
      { title: 'Eager / cooperative', text: 'Eager dừng hết; cooperative chỉ dừng phần chuyển, cần 2 vòng. Mặc định vẫn eager.' },
      { title: 'Static & KIP-848', text: 'group.instance.id giữ chỗ khi restart; group.protocol=consumer để broker chia.' },
    ],
    next: 'Module tiếp theo: Offset & delivery semantics — commit, at-least-once, exactly-once.',
  },
}
