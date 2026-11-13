import type { CSSProperties } from 'react'
import { cameraAt, clamp, ease, lerp, move, sp, span, vis } from '../player/motion-kit'
import { ConsumerUnit, Envelope, HERO, Icon3D, Packets, Rise, SOFT, SoftScene, SoftTheme, SummaryList } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene, SceneSfx } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { sparseIndexScript } from './sparse-index-script'

import { POS, SIZES, TOTAL } from './sparse-index-data'

/** This lesson is drawn in the navy glow style. */
const INK = SOFT
const WIDE = { x: 960, y: 540, s: 1 }
const SX0 = 160
const SC = 1600 / TOTAL
const bx = (i: number) => SX0 + POS[i] * SC
const bw = (i: number) => SIZES[i] * SC
const cx = (i: number) => bx(i) + bw(i) / 2
const SPARSE = [0, 4, 8]
const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN')
const snap = (t: number) => Math.floor(t * 6) / 6
const GREEN = 'linear-gradient(160deg, #6af5b8 0%, #14b574 55%, #0a7a4c 100%)'
const AMBER = 'linear-gradient(160deg, #ffd48a 0%, #f59e0b 55%, #b86a00 100%)'
const SHADE = 'rgba(12,22,76,0.8)'

/** Glass card with the luminous outline. */
const card = (left: number, top: number, w: number, h: number, extra: CSSProperties = {}): CSSProperties => ({ ...INK.card, position: 'absolute', left, top, width: w, height: h, boxSizing: 'border-box', ...extra })

/** Dark pill with a luminous outline, centred on (x, y). */
function Pill({ x, y, text, color = INK.accent, size = 30, o = 1 }: { x: number; y: number; text: string; color?: string; size?: number; o?: number }) {
  if (o <= 0) return null
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)', padding: '8px 24px', borderRadius: 999, background: 'rgba(8,22,82,0.92)', border: `1.5px solid ${color}`, boxShadow: `0 0 22px ${color}, inset 0 1px 0 rgba(255,255,255,0.2)`, fontSize: size, fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap', opacity: clamp(o) }}>
      {text}
    </div>
  )
}

/** Centred heavy line that reveals word by word. `y` is the vertical centre. */
function Headline({ t, at, y, text, size, color = INK.text, x = 960 }: { t: number; at: number; y: number; text: string; size: number; color?: string; x?: number }) {
  if (t < at) return null
  return (
    <div style={{ position: 'absolute', left: x - 960, top: y, width: 1920, transform: 'translateY(-50%)', textAlign: 'center', fontSize: size, fontWeight: 800, letterSpacing: -0.5, color, whiteSpace: 'nowrap', textShadow: '0 0 30px rgba(91,151,255,0.45)' }}>
      {text.split(' ').map((w, k) => {
        const p = clamp(sp(t, at + k * 0.1))
        return (
          <span key={k} style={{ display: 'inline-block', marginRight: size * 0.26, opacity: p, filter: p < 0.98 ? `blur(${(1 - p) * 8}px)` : undefined, transform: `translateY(${(1 - p) * 24}px)` }}>
            {w}
          </span>
        )
      })}
    </div>
  )
}

/** Per-block overlay strengths (0..1); every change is a cross-fade driven by the caller. */
type Look = { read?: number; hit?: number; jump?: number; ask?: number }

/** The segment file as a row of glossy blocks; block width = message size in bytes. */
function Strip({ t, y, h = 130, appear, look = () => ({}) }: { t: number; y: number; h?: number; appear?: number; look?: (i: number) => Look }) {
  return (
    <>
      {SIZES.map((_, i) => {
        const p = appear === undefined ? 1 : clamp(sp(t, appear + i * 0.07, 13, 130), 0, 1.15)
        const lk = look(i)
        const fill = (bg: string, o: number) => (o > 0.001 ? <div style={{ position: 'absolute', inset: 0, background: bg, opacity: clamp(o) }} /> : null)
        return (
          <div key={i} style={{ position: 'absolute', left: bx(i) + 4, top: y, width: bw(i) - 8, height: h, opacity: clamp(p * 1.5), transform: `translateY(${(1 - clamp(p)) * 60}px) scale(${lerp(0.8, 1, clamp(p, 0, 1.1))})` }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: 16, boxShadow: `0 0 36px 4px ${INK.good}`, opacity: clamp(lk.hit ?? 0) }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: 16, boxShadow: `0 0 36px 4px ${INK.warn}`, opacity: clamp(lk.jump ?? 0) }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: 16, boxShadow: '0 0 40px 6px #ffffff', border: '3px solid #ffffff', opacity: clamp(lk.ask ?? 0) }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: 16, overflow: 'hidden', background: HERO, boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.45), 0 14px 24px rgba(0,4,30,0.5)' }}>
              {fill(SHADE, lk.read ?? 0)}
              {fill(AMBER, lk.jump ?? 0)}
              {fill(GREEN, lk.hit ?? 0)}
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: h * 0.36, fontWeight: 800, color: '#fff', textShadow: '0 2px 6px rgba(0,8,50,0.5)', fontVariantNumeric: 'tabular-nums' }}>{i}</div>
            </div>
          </div>
        )
      })}
    </>
  )
}

/** Byte-size brackets under each block; `at(i)` is when block i's size is narrated. */
function Sizes({ t, at, y }: { t: number; at: (i: number) => number; y: number }) {
  return (
    <>
      {SIZES.map((s, i) => {
        const o = clamp(sp(t, at(i)))
        return (
          <div key={i} style={{ position: 'absolute', left: bx(i) + 8, top: y, width: bw(i) - 16, opacity: o, transform: `translateY(${(1 - o) * 20}px)` }}>
            <div style={{ height: 14, borderLeft: `4px solid ${INK.warn}`, borderRight: `4px solid ${INK.warn}`, borderBottom: `4px solid ${INK.warn}`, borderRadius: '0 0 8px 8px' }} />
            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 26, fontWeight: 800, color: INK.warn, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{s}B</div>
          </div>
        )
      })}
    </>
  )
}

/** Glowing read head hovering over (`above`) or under the strip. `x` is its centre. */
function ReadHead({ x, y, h, above = true, color = INK.accent, o = 1 }: { x: number; y: number; h: number; above?: boolean; color?: string; o?: number }) {
  if (o <= 0) return null
  const tri = { position: 'absolute' as const, left: x - 20, width: 0, height: 0, borderLeft: '20px solid transparent', borderRight: '20px solid transparent', filter: `drop-shadow(0 0 10px ${color})` }
  return (
    <div style={{ opacity: clamp(o) }}>
      <div style={{ position: 'absolute', left: x - 3, top: y - 14, width: 6, height: h + 28, borderRadius: 3, background: color, boxShadow: `0 0 16px ${color}`, opacity: 0.85 }} />
      {above ? <div style={{ ...tri, top: y - 46, borderTop: `28px solid ${color}` }} /> : <div style={{ ...tri, top: y + h + 14, borderBottom: `28px solid ${color}` }} />}
    </div>
  )
}

/** Read head hopping block to block between [a, b]; pauses a moment on each block. */
function hop(t: number, from: number, to: number, a: number, b: number) {
  const prog = span(t, a, b) * (to - from)
  const i = Math.min(to - from, Math.floor(prog))
  const x = i >= to - from ? bx(to) : lerp(bx(from + i), bx(from + i + 1), ease(clamp((prog - i) * 1.5)))
  return { x: x + 20, passed: from + i }
}
/** Block i fades to "already read" as the head passes over it. */
const readBy = (headX: number, i: number) => span(headX, bx(i) + 20, bx(i + 1) + 20)

/* ------------------------------------------------------------------ 1. problem */

function problem(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const strike = a3 + 2.6
  const pinX = lerp(SX0 + 20, SX0 + 600 * SC, move(t, a3 + 0.8, 1.6))
  const SY = 450
  const wrong = span(t, a3 + 2.4, a3 + 2.75)
  const askO = Math.min(span(t, a2 + 1.2, a2 + 1.55), 1 - span(t, a3, a3 + 0.4))
  const pin = Math.min(span(t, a3 + 0.5, a3 + 0.85), 1)
  const cons = { x: 340, y: 310 }
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 520, s: 1.06 }, 1.5], [a3, WIDE, 1.4]])} title={{ kicker: 'VẤN ĐỀ', text: 'Segment file' }}>
      <Rise t={t} at={a0 + 1.5}>
        <div style={{ position: 'absolute', left: 1400, top: 250, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 110, height: 110 }} />
          <span style={{ fontFamily: MONO, fontSize: 30, fontWeight: 700, color: INK.faint, whiteSpace: 'nowrap' }}>00000000.log</span>
        </div>
      </Rise>
      <Icon3D name="file" x={1455} y={305} size={110} t={t} at={a0 + 1.5} />
      <Strip t={t} y={SY} h={150} appear={a0 + 1.6} look={(i) => ({ ask: i === 6 ? askO * (0.7 + 0.3 * Math.sin(t * 5)) : 0, jump: i === 3 ? wrong : 0 })} />
      <Sizes t={t} y={SY + 166} at={(i) => (i < 3 ? a1 + 0.3 + i * 0.9 : a1 + 3.1 + (i - 3) * 0.2)} />
      <Rise t={t} at={a2 - 0.1}>
        <ConsumerUnit x={160} y={cons.y - 59} w={360} name="consumer" note="seek(6)" t={t} />
      </Rise>
      <Envelope t={t} at={a2 + 0.3} from={{ x: 540, y: cons.y }} to={{ x: cx(6), y: SY - 70 }} label="đọc từ offset 6" len={0.9} arc={30} />
      <Pill x={cx(6)} y={SY - 70 + Math.sin(t * 4) * 6} text="byte nào?" color={INK.accent} size={34} o={askO} />
      <div style={{ opacity: pin }}>
        <Pill x={pinX} y={SY - 56} text="600" color={INK.warn} size={32} />
        <div style={{ position: 'absolute', left: pinX - 14, top: SY - 30, width: 0, height: 0, borderLeft: '14px solid transparent', borderRight: '14px solid transparent', borderTop: `22px solid ${INK.warn}`, filter: `drop-shadow(0 0 8px ${INK.warn})` }} />
      </div>
      <Rise t={t} at={a3 + 0.2}>
        <div style={card(520, 750, 800, 110, { display: 'grid', placeItems: 'center' })}>
          <div style={{ position: 'relative', fontSize: 64, fontWeight: 800, letterSpacing: -0.5, color: '#fff', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
            6 × 100 = 600
            <div style={{ position: 'absolute', left: -24, right: -24, top: '52%', height: 12, borderRadius: 6, background: INK.bad, boxShadow: `0 0 18px ${INK.bad}`, transformOrigin: 'left', transform: `scaleX(${move(t, strike, 0.4)})` }} />
          </div>
        </div>
      </Rise>
      <Icon3D name="thumb-down" x={1430} y={805} size={130} t={t} at={strike + 0.3} />
      <Pill x={1590} y={805} text="SAI" color={INK.bad} size={42} o={sp(t, strike + 0.4)} />
      <Headline t={t} at={strike + 0.7} y={890} text="vì mỗi tin dài ngắn khác nhau" size={44} color={INK.warn} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 2. read from the start */

function scan(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const SY = 400
  const head = hop(t, 0, 6, a1, a2 - 0.1)
  const found = span(t, a2, a2 + 0.35)
  const stepAt = (k: number) => lerp(a1, a2 - 0.1, (k + 1) / 6) - 0.3
  const gone = 1 - span(t, a3, a3 + 0.5)
  const pulse = 0.75 + 0.25 * Math.sin(t * 5)
  const barW = 8 + 14 * span(t, a3 + 0.9, c.duration)
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 520, s: 1.05 }, 1.6], [a3, WIDE, 1.4]])} title={{ kicker: 'CÁCH 1', text: 'Đọc từ đầu file' }}>
      <div style={{ opacity: gone }}>
        <Rise t={t} at={a0 + 1.5}>
          <div style={{ position: 'absolute', left: 160, top: 240, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 100, height: 100 }} />
            <span style={{ fontFamily: MONO, fontSize: 30, fontWeight: 700, color: INK.faint }}>00000000.log</span>
          </div>
        </Rise>
        <Icon3D name="file" x={210} y={290} size={100} t={t} at={a0 + 1.5} />
        <Strip t={t} y={SY} appear={a0 + 1.6} look={(i) => ({ read: i < 6 ? readBy(head.x, i) : 0, hit: i === 6 ? found : 0 })} />
        <ReadHead x={head.x} y={SY} h={130} o={Math.min(span(t, a0 + 2.2, a0 + 2.5), 1 - span(t, a2 + 0.2, a2 + 0.5))} />
        {SIZES.slice(0, 6).map((s, k) => (
          <div key={k} style={{ position: 'absolute', left: cx(k) - 60, width: 120, textAlign: 'center', top: SY - 60 - 40 * span(t, stepAt(k), stepAt(k) + 0.9), opacity: vis(t, stepAt(k), stepAt(k) + 0.6, 0.2), fontSize: 30, fontWeight: 800, color: INK.warn, fontVariantNumeric: 'tabular-nums' }}>
            +{s}B
          </div>
        ))}
        <Pill x={cx(6)} y={SY - 70} text="byte 1390 ✓" color={INK.good} size={32} o={sp(t, a2 + 0.2)} />
        <div style={{ position: 'absolute', left: bx(0) + 4, top: SY + 150, width: bx(6) - bx(0) - 8, opacity: vis(t, a2 + 1.3), height: 14, borderLeft: `4px solid ${INK.accent}`, borderRight: `4px solid ${INK.accent}`, borderBottom: `4px solid ${INK.accent}`, borderRadius: '0 0 8px 8px' }} />
        <div style={{ position: 'absolute', left: bx(0), top: SY + 176, width: bx(6) - bx(0), textAlign: 'center', fontSize: 30, fontWeight: 800, color: INK.accent, opacity: vis(t, a2 + 1.4) }}>đọc qua 6 tin</div>
        <div style={{ opacity: vis(t, a1 - 0.2) }}>
          <div style={card(480, 660, 960, 220, { display: 'flex', alignItems: 'center', justifyContent: 'space-around', boxShadow: `${INK.card.boxShadow}, 0 0 ${28 * found * pulse}px ${INK.good}` })}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: INK.faint }}>ĐÃ ĐỌC</div>
              <div style={{ fontSize: 88, fontWeight: 800, color: INK.warn, fontVariantNumeric: 'tabular-nums' }}>{head.passed} tin</div>
            </div>
            <div style={{ width: 3, height: 130, background: INK.line }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: INK.faint }}>VỊ TRÍ BYTE</div>
              <div style={{ fontSize: 88, fontWeight: 800, color: INK.accent, fontVariantNumeric: 'tabular-nums' }}>{POS[head.passed]}</div>
            </div>
          </div>
        </div>
      </div>
      <Headline t={t} at={a3 + 0.6} y={330} text="10 TRIỆU TIN" size={140} color={INK.bad} />
      <Icon3D name="folder" x={330} y={610} size={190} t={t} at={a3 + 1.2} />
      <Icon3D name="clock" x={1590} y={610} size={190} t={t} at={a3 + 1.5} />
      <Packets t={t} from={{ x: 470, y: 610 }} to={{ x: 1450, y: 610 }} start={a3 + 1.8} every={0.5} len={1.6} size={22} />
      <div style={{ opacity: vis(t, a3 + 1.2) }}>
        <div style={{ position: 'absolute', left: 280, top: 725, fontSize: 28, fontWeight: 800, color: INK.faint }}>segment 1 GB</div>
        <div style={card(380, 780, 1160, 80, { display: 'flex', alignItems: 'center', padding: '0 24px' })}>
          <div style={{ width: 640, height: 22, borderRadius: 11, background: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}>
            <div style={{ width: barW, height: '100%', borderRadius: 11, background: INK.bad, boxShadow: `0 0 12px ${INK.bad}` }} />
          </div>
          <div style={{ marginLeft: 28, fontSize: 30, fontWeight: 800, color: INK.faint, whiteSpace: 'nowrap' }}>đọc tuần tự… 0,00006%</div>
        </div>
      </div>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 3. dense index */

/** Dense index table: a card of 10 rows in two columns. */
const TBL = { w: 1000, top: 390, h: 430 }
const rowX = (i: number) => 40 + (i >= 5 ? 480 : 0)
const rowY = (i: number) => 74 + (i % 5) * 58

function dense(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const SY = 230
  const arrive = a1 + 1.1
  const lit = span(t, a1 + 0.2, a1 + 0.55)
  const count = Math.round(10 ** lerp(1, 7, ease(span(snap(t), a2 + 0.4, a2 + 2.2))))
  const shift = move(t, a2 + 1.4, 0.8)
  const tcx = lerp(960, 560, shift)
  const left = tcx - TBL.w / 2
  const red = span(t, a2 + 0.4, a2 + 0.9)
  const r6 = { x: left + rowX(6) + 440, y: TBL.top + rowY(6) + 25 }
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 500, s: 1.06 }, 1.5], [a2 + 0.4, WIDE, 1.4]])} title={{ kicker: 'CÁCH 2', text: 'Index dày' }}>
      <Strip t={t} y={SY} h={110} appear={a0 + 1.5} look={(i) => ({ hit: i === 6 ? span(t, arrive, arrive + 0.35) : 0 })} />
      <div style={card(left, TBL.top, TBL.w, TBL.h, { opacity: sp(t, a0 + 1.9) > 0 ? clamp(sp(t, a0 + 1.9) * 1.5) : 0, overflow: 'hidden' })}>
        <div style={{ position: 'absolute', left: 40, top: 20, fontSize: 26, fontWeight: 700, color: INK.faint }}>BẢNG INDEX · OFFSET → BYTE</div>
        {SIZES.map((_, i) => {
          const o = clamp(sp(t, a0 + 2.3 + i * 0.12))
          return (
            <div key={i} style={{ position: 'absolute', left: rowX(i), top: rowY(i), width: 440, height: 50, borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,0.07)', opacity: o, transform: `translateX(${(1 - o) * -30}px)` }}>
              {i === 6 && <div style={{ position: 'absolute', inset: 0, background: HERO, boxShadow: `0 0 24px ${INK.accent}`, opacity: lit }} />}
              <div style={{ position: 'relative', height: '100%', display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 32, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                {i} → {POS[i]}
              </div>
            </div>
          )
        })}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 70, background: 'linear-gradient(transparent, rgba(255,90,106,0.45))', opacity: red }} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 12, textAlign: 'center', fontSize: 34, fontWeight: 800, color: '#ffd6da', opacity: red }}>⋮ còn hàng triệu dòng nữa ⋮</div>
      </div>
      <Envelope t={t} at={a1 + 0.3} from={{ x: r6.x - 10, y: r6.y }} to={{ x: cx(6), y: SY + 120 }} label="byte 1390" len={0.8} arc={0} />
      <Rise t={t} at={a2 + 1.9}>
        <div style={card(1130, TBL.top, 700, TBL.h, { border: `2px solid ${INK.bad}`, boxShadow: `${INK.card.boxShadow}, 0 0 34px rgba(255,90,106,0.45)` })} />
      </Rise>
      <Icon3D name="computer" x={1480} y={TBL.top + 100} size={150} t={t} at={a2 + 2.0} />
      <div style={{ position: 'absolute', left: 1130, width: 700, top: TBL.top + 192, textAlign: 'center', fontSize: 46, fontWeight: 800, color: '#ffd6da', opacity: vis(t, a2 + 2.0), fontVariantNumeric: 'tabular-nums' }}>{fmt(count)} dòng</div>
      <Headline t={t} at={a2 + 2.8} y={TBL.top + 300} text="80 MB RAM" size={96} color="#ffd6da" x={1480} />
      <Headline t={t} at={a2 + 3.6} y={875} text="cho chỉ MỘT segment" size={56} color={INK.warn} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 4. sparse index */

const SP = { x: 1000, y: 500, w: 760, h: 330 }
const spRowY = (k: number) => SP.y + 80 + k * 72 + 30

function sparse(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const SY = 290
  const scanAt = (k: number) => a1 + 1.0 + k * 0.8
  const pickAt = a1 + 3.8
  const scanA = a2 + 1.5
  const scanB = sparseFound(c)
  const head = hop(t, 4, 6, scanA, scanB)
  const hit = span(t, scanB, scanB + 0.35)
  const jump = span(t, a2 + 0.9, a2 + 1.25)
  const picked = span(t, pickAt, pickAt + 0.35)
  const pulse = 0.5 + 0.5 * Math.sin(t * 5)
  const out = 1 - span(t, a3, a3 + 0.45)
  const cmp = (left: number, bad: boolean) => card(left, 290, 700, 470, { border: `2px solid ${bad ? INK.bad : INK.good}`, boxShadow: `${INK.card.boxShadow}, 0 0 34px ${bad ? 'rgba(255,90,106,0.45)' : 'rgba(62,230,160,0.45)'}` })
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a2 + 0.6, { x: 900, y: 520, s: 1.1 }, 1.5], [a3 - 0.2, WIDE, 1.3]])} title={{ kicker: 'CÁCH CỦA KAFKA', text: 'Sparse index' }}>
      {out > 0 && (
        <div style={{ opacity: out }}>
          <Strip t={t} y={SY} h={110} appear={a0 + 1.5} look={(i) => ({ read: i > 4 && i < 6 ? readBy(head.x, i) * span(t, scanA, scanA + 0.3) : 0, jump: i === 4 ? jump : 0, hit: i === 6 ? hit : 0 })} />
          {SPARSE.map((o, k) => (
            <Icon3D key={o} name="flag" x={cx(o)} y={222} size={84} t={t} at={a0 + 1.7 + k * 0.4} />
          ))}
          {[0, 1].map((k) => (
            <div key={k} style={{ position: 'absolute', left: bx(SPARSE[k]) + 10, top: SY + 124, width: bx(SPARSE[k + 1]) - bx(SPARSE[k]) - 20, opacity: vis(t, a0 + 2.6 + k * 0.4, a1 + 0.5) }}>
              <div style={{ height: 14, border: `4px solid ${INK.warn}`, borderTop: 'none', borderRadius: '0 0 8px 8px' }} />
              <div style={{ textAlign: 'center', marginTop: 6, fontSize: 30, fontWeight: 800, color: INK.warn }}>≈ 4KB</div>
            </div>
          ))}
          <Rise t={t} at={a0 + 3.0}>
            <div style={card(SP.x, SP.y, SP.w, SP.h, { boxShadow: `${INK.card.boxShadow}, 0 0 ${30 * picked * (0.6 + 0.4 * pulse)}px ${INK.warn}` })}>
              <div style={{ position: 'absolute', left: 36, top: 22, fontSize: 26, fontWeight: 700, color: INK.faint }}>SPARSE INDEX · 3 DÒNG</div>
            </div>
          </Rise>
          {SPARSE.map((o, k) => {
            const row = clamp(sp(t, a0 + 3.3 + k * 0.2))
            const scanning = Math.min(span(t, scanAt(k) - 0.1, scanAt(k) + 0.2), 1 - span(t, scanAt(k) + 0.6, scanAt(k) + 0.8))
            const on = o === 4 ? picked : 0
            const okay = o <= 6
            return (
              <div key={o} style={{ position: 'absolute', left: SP.x + 36, top: SP.y + 80 + k * 72, width: SP.w - 72, height: 60, borderRadius: 14, overflow: 'hidden', background: 'rgba(255,255,255,0.07)', opacity: row, transform: `translateX(${(1 - row) * 30}px)` }}>
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(110,160,255,0.35)', opacity: scanning }} />
                <div style={{ position: 'absolute', inset: 0, background: AMBER, opacity: on * (0.85 + 0.15 * pulse) }} />
                <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', padding: '0 26px', fontFamily: MONO, fontSize: 34, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ flex: 1 }}>
                    {o} → {POS[o]}
                  </span>
                  <span style={{ opacity: vis(t, scanAt(k) + 0.3, Infinity, 0.35), color: on > 0.5 ? '#fff' : okay ? INK.good : INK.bad }}>{okay ? `${o} ≤ 6 ✓` : `${o} > 6 ✗`}</span>
                </div>
              </div>
            )
          })}
          <Rise t={t} at={a1 - 0.1}>
            <ConsumerUnit x={180} y={600} w={360} name="consumer" note="offset 6" t={t} />
          </Rise>
          <Envelope t={t} at={a1 + 0.1} from={{ x: 550, y: 659 }} to={{ x: SP.x - 20, y: 659 }} label="tìm offset 6" len={0.9} arc={30} />
          <Envelope t={t} at={a2 + 0.1} from={{ x: SP.x - 4, y: spRowY(1) }} to={{ x: cx(4), y: SY + 150 }} label="byte 810" color={INK.warn} len={0.9} arc={20} />
          <ReadHead x={head.x} y={SY} h={110} above={false} color={INK.warn} o={Math.min(span(t, scanA - 0.3, scanA), 1 - span(t, scanB + 0.2, scanB + 0.5))} />
          <Pill x={cx(6)} y={222} text="offset 6 ✓" color={INK.good} size={30} o={sp(t, scanB + 0.1)} />
        </div>
      )}
      <Rise t={t} at={a3 + 0.4}>
        <div style={cmp(180, true)}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 30, textAlign: 'center', fontSize: 30, fontWeight: 800, color: INK.faint }}>INDEX DÀY</div>
        </div>
      </Rise>
      <Icon3D name="computer" x={530} y={510} size={190} t={t} at={a3 + 0.6} />
      <Headline t={t} at={a3 + 0.8} y={680} text="80 MB" size={100} color="#ffd6da" x={530} />
      <Packets t={t} from={{ x: 890, y: 525 }} to={{ x: 1030, y: 525 }} start={a3 + 1.6} every={0.35} len={0.6} size={22} />
      <Rise t={t} at={a3 + 1.4}>
        <div style={cmp(1040, false)}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 30, textAlign: 'center', fontSize: 30, fontWeight: 800, color: INK.faint }}>SPARSE INDEX</div>
        </div>
      </Rise>
      <Icon3D name="computer" x={1390} y={510} size={190} t={t} at={a3 + 1.6} />
      <div style={{ position: 'absolute', left: 1040, width: 700, top: 630, textAlign: 'center', fontSize: 100, fontWeight: 800, color: '#c8ffe6', opacity: clamp(sp(t, a3 + 1.8)), textShadow: `0 0 30px ${INK.good}` }}>≈ 2 MB</div>
      <Headline t={t} at={a3 + 2.4} y={865} text="nhỏ hơn ~40 lần · nằm gọn trong RAM" size={52} color={INK.good} />
    </SoftScene>
  )
}

/** Moment the read head reaches offset 6 in the sparse scene. */
function sparseFound(c: Cue) {
  const scanA = c.at(2) + 1.5
  return Math.min(c.end(2) + 0.2, scanA + 2.2)
}

/* ------------------------------------------------------------------ 5. summary */

function summary(t: number, c: Cue) {
  return (
    <SoftTheme>
      <SummaryList t={t} cue={c} items={['Tin dài ngắn khác nhau → phải có index', 'Sparse index: vài mốc, gọn trong RAM', 'Tìm: nhảy tới mốc gần nhất, lướt ngắn', 'Như mục lục sách: ghi theo chương']} />
    </SoftTheme>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { problem, scan, dense, sparse, summary }

/** Key-moment sounds, timed to the same cue offsets the scenes animate on. */
const SFX: Record<string, SceneSfx[]> = {
  problem: [{ kind: 'error', at: (c) => c.at(3) + 2.6 }],
  scan: [{ kind: 'ding', at: (c) => c.at(2) }],
  dense: [
    { kind: 'ding', at: (c) => c.at(1) + 1.1 },
    { kind: 'error', at: (c) => c.at(2) + 0.6 },
  ],
  sparse: [
    { kind: 'tick', at: (c) => c.at(1) + 3.8 },
    { kind: 'ding', at: (c) => sparseFound(c) },
  ],
}

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const sparseIndexLesson: Lesson = {
  ...sparseIndexScript,
  scenes: sparseIndexScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id], sfx: SFX[s.id] })),
  roadmap: [
    'Chặng 1: Bài toán — vì sao từ offset không suy ra được vị trí byte.',
    'Chặng 2: Hai cách ngây thơ — đọc tuần tự và index dày, mỗi cách hỏng ở đâu.',
    'Chặng 3: Sparse index — cách Kafka thật sự làm, và tự tay thử trên mô phỏng.',
  ],
  sections: [
    {
      id: 'bai-toan',
      title: 'Bài toán: tin số 6 nằm ở byte nào?',
      blocks: [
        { kind: 'video', scenes: ['problem'] },
        {
          kind: 'p',
          text: 'Mỗi partition là một **log chỉ ghi nối đuôi**, được cắt thành nhiều **segment**. Mỗi segment là một file `.log` trên đĩa, các tin nằm sát nhau, tin sau bắt đầu ngay chỗ tin trước kết thúc.',
        },
        {
          kind: 'p',
          text: 'Consumer không hỏi "cho tôi byte thứ 1390". Nó hỏi theo **offset**, tức số thứ tự của tin: "đọc tiếp từ offset 6". Offset là số đếm, **không phải địa chỉ byte**. Kafka phải tự đổi offset sang vị trí byte trong file.',
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Hỏi "vì sao" hai lần',
          text: 'Vì sao cần index? Vì không tính được byte từ offset. Vì sao không tính được? Vì **mỗi tin (mỗi batch) dài ngắn khác nhau**. Nếu tin nào cũng đúng 100 byte thì byte = offset × 100 và chẳng cần index nào cả.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q(
              'Consumer gửi yêu cầu "đọc từ offset 6". Offset 6 là gì?',
              ['Byte thứ 6 trong file', 'Số thứ tự của tin trong partition', 'Số thứ tự của segment', 'Số giây kể từ khi tin được ghi'],
              1,
              'Offset là số thứ tự tin trong partition. Muốn đọc file thì Kafka phải đổi nó sang vị trí byte, và đó là việc của index.',
            ),
          ],
        },
      ],
    },
    {
      id: 'doc-tuan-tu',
      title: 'Cách 1: Đọc tuần tự từ đầu file',
      blocks: [
        { kind: 'video', scenes: ['scan'] },
        {
          kind: 'p',
          text: 'Cách đơn giản nhất là bắt đầu từ byte 0, đọc phần đầu của mỗi tin để biết nó dài bao nhiêu, rồi nhảy qua. Lặp lại cho tới khi gặp offset cần tìm.',
        },
        {
          kind: 'table',
          head: ['Kích thước segment', 'Tin ~100 byte', 'Số lần nhảy để tới cuối'],
          rows: [
            ['1 MB', '~10.000 tin', '~10.000'],
            ['1 GB (mặc định `segment.bytes`)', '~10.000.000 tin', '~10.000.000'],
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          text: 'Đúng nhưng chậm: chi phí tăng **tuyến tính** theo vị trí cần tìm. Consumer đọc lại từ giữa segment (sau khi restart, sau rebalance) sẽ phải bò qua hàng triệu tin.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q(
              'Vì sao khi đọc tuần tự, Kafka phải "đọc độ dài" của từng tin trước khi nhảy?',
              ['Để kiểm tra tin có bị lỗi không', 'Vì không biết trước tin đó dài bao nhiêu byte', 'Vì đĩa chỉ đọc được từng byte', 'Để nén tin lại'],
              1,
              'Các tin dài ngắn khác nhau, nên chỉ có cách đọc trường độ dài trong header để biết tin kế tiếp bắt đầu ở đâu.',
            ),
          ],
        },
      ],
    },
    {
      id: 'index-day',
      title: 'Cách 2: Index dày, mỗi tin một dòng',
      blocks: [
        {
          kind: 'quiz',
          title: 'Dự đoán trước khi xem',
          questions: [
            q(
              'Nếu lập sẵn bảng "offset → byte" cho MỌI tin, bạn đoán vấn đề lớn nhất là gì?',
              ['Tra cứu chậm', 'Bảng quá to, tốn RAM', 'Không tìm được offset lớn', 'Mất dữ liệu khi restart'],
              1,
              'Tra cứu thì cực nhanh, nhưng bảng to bằng số tin. Xem video để thấy nó to cỡ nào.',
            ),
          ],
        },
        { kind: 'video', scenes: ['dense'] },
        {
          kind: 'p',
          text: 'Một dòng index chỉ cần khoảng **8 byte**: 4 byte cho offset (tính tương đối so với đầu segment) và 4 byte cho vị trí. Nghe nhỏ, nhưng nhân lên thì không nhỏ chút nào:',
        },
        {
          kind: 'list',
          items: [
            { title: 'Một segment', text: '1 GB ÷ 100 byte ≈ 10 triệu tin → 10 triệu × 8 byte ≈ **80 MB** index.' },
            { title: 'Cả broker', text: 'Một broker giữ hàng nghìn segment → hàng chục GB index, không thể nằm trong RAM.' },
            { title: 'Hậu quả', text: 'Index phải đọc từ đĩa → mất luôn lợi thế "tra 1 phát là ra".' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q(
              'Index dày nhanh như vậy, vì sao Kafka không dùng?',
              ['Vì nó chậm hơn đọc tuần tự', 'Vì bảng to bằng số tin, không vừa RAM', 'Vì không sắp xếp được', 'Vì Kafka không có RAM'],
              1,
              'Kích thước index tỉ lệ với số tin. Với hàng nghìn segment, nó không vừa RAM nên mất luôn tốc độ.',
            ),
          ],
        },
      ],
    },
    {
      id: 'sparse-index',
      title: 'Sparse index: cách Kafka thật sự làm',
      blocks: [
        { kind: 'video', scenes: ['sparse'] },
        {
          kind: 'p',
          text: 'Bên cạnh mỗi file `.log` có một file `.index`. Kafka chỉ ghi **một dòng index sau mỗi khoảng dữ liệu** (cấu hình `index.interval.bytes`, mặc định 4096 byte), chứ không ghi cho từng tin.',
        },
        {
          kind: 'list',
          ordered: true,
          items: [
            { title: 'Tìm mốc', text: 'Tìm nhị phân trong `.index` lấy **mốc lớn nhất ≤ offset** cần đọc.' },
            { title: 'Nhảy', text: 'Nhảy thẳng tới vị trí byte của mốc đó trong `.log`.' },
            { title: 'Lướt', text: 'Đọc tuần tự một đoạn ngắn (vài KB) cho tới đúng offset.' },
          ],
        },
        {
          kind: 'table',
          head: ['', 'Đọc tuần tự', 'Index dày', 'Sparse index'],
          rows: [
            ['Kích thước index (1 GB)', '0', '~80 MB', '**~2 MB**'],
            ['Tra một offset', 'lướt cả GB', 'nhảy thẳng', '**nhảy + lướt vài KB**'],
            ['Nằm trong RAM?', '—', 'không', '**có** (file được mmap)'],
          ],
        },
        {
          kind: 'callout',
          tone: 'info',
          title: 'Chi tiết thật trên đĩa',
          text: 'Mỗi dòng index thật trỏ tới **đầu một record batch** (thường ~16 KB nhờ batching), ghi offset cuối của batch đó. Nên khoảng cách giữa các mốc trên đĩa thường theo kích thước batch, với 4 KB là mức tối thiểu.',
        },
        {
          kind: 'p',
          text: 'Anh em của `.index` là `.timeindex`: ánh xạ **thời điểm → offset**, dùng khi tìm tin theo thời gian (ví dụ reset consumer về "9 giờ sáng hôm qua"; Kafka Streams cũng dùng nhiều). Kafka **không lưu checksum cho index**: hỏng thì dựng lại từ `.log`, xoá đi cũng an toàn, chỉ là broker khởi động lâu hơn.',
        },
        { kind: 'p', text: 'Bạn có thể tự xem các dòng index bằng công cụ đi kèm Kafka:' },
        {
          kind: 'code',
          code: 'kafka-dump-log.sh --files 00000000000000000000.index\n\nDumping 00000000000000000000.index\noffset: 197 position: 16330\noffset: 395 position: 32741\n...',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q(
              'Index có mốc 0→0, 4→810, 8→1760. Đọc offset 7 thì sao?',
              ['Nhảy tới mốc 8 rồi lùi 1 tin', 'Nhảy tới mốc 4 rồi lướt qua 4, 5, 6', 'Nhảy tới mốc 0 rồi lướt 7 tin', 'Tính 7 × 217'],
              1,
              'Luôn chọn mốc lớn nhất ≤ offset, vì log chỉ lướt về phía trước được: không biết tin trước dài bao nhiêu để lùi lại.',
            ),
          ],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: tự tay tra cứu',
      blocks: [
        {
          kind: 'p',
          text: 'Kéo hai thanh trượt. Trước khi kéo, hãy **đoán trước**: cắm mốc mỗi 1 tin thì bảng có mấy dòng và phải lướt mấy tin? Còn mỗi 5 tin thì sao?',
        },
        { kind: 'widget', name: 'sparse-lab' },
        {
          kind: 'p',
          text: 'Bạn vừa tự thấy đánh đổi cốt lõi: **mốc dày** → bảng to, lướt ít; **mốc thưa** → bảng nhỏ, lướt nhiều. Kafka chọn khoảng 4 KB một mốc vì lướt 4 KB trên đĩa gần như miễn phí, còn bảng thì đủ nhỏ để nằm trong RAM.',
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
    q(
      'Vì sao Kafka không tính vị trí byte bằng công thức offset × kích thước tin?',
      [
        'Vì index giúp nén dữ liệu nhỏ hơn',
        'Vì các tin (và batch) dài ngắn khác nhau, nên không có kích thước cố định để nhân',
        'Vì offset được sinh ngẫu nhiên',
        'Vì file log chỉ đọc được từ cuối lên',
      ],
      1,
      'Đây là gốc rễ của index. Nếu tin nào cũng đúng 100B thì byte = offset × 100 và chẳng cần index.',
    ),
    q(
      'Tăng `index.interval.bytes` từ 4KB lên 1MB thì sao?',
      ['Index nhỏ hơn, nhưng mỗi lần tìm phải lướt nhiều dữ liệu hơn', 'Index to hơn và tìm nhanh hơn', 'Không có gì thay đổi', 'Kafka sẽ mất dữ liệu'],
      0,
      'Đánh đổi kinh điển: ít mốc → tiết kiệm RAM, nhưng khoảng cách tới mốc gần nhất xa hơn nên lướt lâu hơn.',
    ),
    q(
      'File `.index` của một segment bị xoá mất. Điều gì xảy ra?',
      ['Mất toàn bộ tin trong segment', 'Kafka dựng lại index bằng cách đọc tuần tự file .log', 'Consumer không đọc được nữa', 'Partition bị xoá'],
      1,
      'Index chỉ là "mục lục" dựng từ dữ liệu. Dữ liệu thật nằm trong .log, nên Kafka có thể quét lại để dựng index.',
    ),
    q(
      'Một topic có tin cỡ 50 byte nhưng producer gom batch ~16KB. Khoảng cách giữa các dòng index trên đĩa gần với số nào nhất?',
      ['50 byte', '4 KB', '~16 KB', '1 GB'],
      2,
      'Mỗi dòng index trỏ tới đầu một batch, nên khoảng cách theo kích thước batch; 4 KB chỉ là mức tối thiểu.',
    ),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao index "thưa" mà vẫn tìm nhanh?',
      keywords: ['mốc', 'lướt', 'ram', 'nhảy'],
      modelAnswer:
        'Vì tin dài ngắn khác nhau nên phải có index. Nhưng ghi mọi tin thì index quá to, không vừa RAM. Sparse index chỉ ghi một mốc mỗi ~4KB, nên nhỏ và nằm trong RAM. Khi tìm, Kafka nhảy tới mốc lớn nhất ≤ offset, rồi chỉ lướt một đoạn ngắn (vài KB) để tới đúng tin.',
    },
  ],
  recap: {
    journey:
      'Từ câu hỏi "tin số 6 nằm ở byte nào?" → tin dài ngắn khác nhau nên không tính được → đọc tuần tự thì quá chậm → index dày thì quá to → sparse index: vài cột mốc trong RAM + lướt một đoạn ngắn.',
    points: [
      { title: 'Vì sao cần index', text: 'Vì offset là số thứ tự, còn tin dài ngắn khác nhau nên không suy ra được vị trí byte.' },
      { title: 'Sparse index', text: 'Một mốc mỗi ~4 KB (thực tế là mỗi batch): bảng nhỏ, nằm gọn trong RAM.' },
      { title: 'Cách tra', text: 'Mốc lớn nhất ≤ offset → nhảy tới byte đó → lướt vài KB.' },
      { title: 'Đánh đổi', text: 'Mốc dày: to mà lướt ít. Mốc thưa: nhỏ mà lướt nhiều.' },
    ],
    next: 'Bài tiếp theo: Key quyết định Partition — tin có key đi vào partition nào, và vì sao thứ tự chỉ được giữ trong một partition.',
  },
}
