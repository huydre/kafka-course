import type { ReactNode } from 'react'
import { cameraAt, clamp, lerp, move, sp, span, vis } from '../player/motion-kit'
import { ConsumerUnit, HERO, Icon3D, Packets, Rise, SOFT, ServerUnit, SoftScene, SoftTheme, SummaryList, Wire } from '../player/schematic'
import type { Icon3DName } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene, SceneSfx } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { kafkaStreamsScript } from './kafka-streams-script'

/** This lesson is drawn in the navy glow style. */
const INK = SOFT
const WIDE = { x: 960, y: 540, s: 1 }

/** Time at fraction p of beat k. */
const at = (c: Cue, k: number, p: number) => c.at(k) + (c.end(k) - c.at(k)) * p

/* ------------------------------------------------------------------ shared building blocks */

const GREEN = 'linear-gradient(160deg, #9ff5cf 0%, #27d391 55%, #0e9a6c 100%)'
const RED = 'linear-gradient(160deg, #ff9aa5 0%, #ff4d60 55%, #b3202f 100%)'
const AMBER = 'linear-gradient(160deg, #ffe2a8 0%, #ffb547 55%, #d9861f 100%)'

type Tone = 'blue' | 'good' | 'bad' | 'warn'
const TONE_BG: Record<Tone, string> = { blue: HERO, good: GREEN, bad: RED, warn: AMBER }
const TONE_INK: Record<Tone, string> = { blue: '#ffffff', good: '#ffffff', bad: '#ffffff', warn: '#2a1800' }
const TONE_LINE: Record<Tone, string> = { blue: INK.accent, good: INK.good, bad: INK.bad, warn: INK.warn }

/** Word colours used to follow one word through the repartition scene. */
const WORD = { kafka: '#ff6fa8', streams: INK.warn, log: INK.good } as const
type Word = keyof typeof WORD

/** A solid rounded block with centred text. `ghost` = empty slot. */
function Chip({ x, y, w, h = 60, label, tone = 'blue', size = 28, o = 1, ghost = false, mono = false, scale = 1 }: { x: number; y: number; w: number; h?: number; label: string; tone?: Tone; size?: number; o?: number; ghost?: boolean; mono?: boolean; scale?: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        boxSizing: 'border-box',
        borderRadius: 18,
        display: 'grid',
        placeItems: 'center',
        fontFamily: mono ? MONO : undefined,
        fontSize: size,
        fontWeight: 800,
        whiteSpace: 'nowrap',
        opacity: clamp(o),
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        color: ghost ? INK.faint : TONE_INK[tone],
        background: ghost ? 'rgba(12,30,96,0.45)' : TONE_BG[tone],
        border: ghost ? '2px dashed rgba(110,160,255,0.5)' : 'none',
        boxShadow: ghost ? undefined : `inset 0 2px 0 rgba(255,255,255,0.5), 0 0 22px ${TONE_LINE[tone]}77, 0 10px 20px rgba(0,8,50,0.45)`,
      }}
    >
      {label}
    </div>
  )
}

/** Dark glowing pill centred on (x, y). */
function Tag({ x, y, text, color = INK.accent, size = 28, o = 1, mono = false }: { x: number; y: number; text: string; color?: string; size?: number; o?: number; mono?: boolean }) {
  const k = clamp(o)
  if (k <= 0) return null
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${0.94 + 0.06 * k})`, padding: '10px 24px', borderRadius: 999, background: 'rgba(8,22,82,0.92)', border: `1.5px solid ${color}`, boxShadow: `0 0 20px ${color}99, inset 0 1px 0 rgba(255,255,255,0.15)`, fontFamily: mono ? MONO : undefined, fontSize: size, fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap', opacity: k }}>
      {text}
    </div>
  )
}

/** A translucent navy card. */
function Card({ x, y, w, h, o = 1, border, children }: { x: number; y: number; w: number; h: number; o?: number; border?: string; children?: ReactNode }) {
  return (
    <div style={{ ...INK.card, position: 'absolute', left: x, top: y, width: w, height: h, boxSizing: 'border-box', opacity: clamp(o), border: border ?? (INK.card.border as string) }}>
      {children}
    </div>
  )
}

/** Small text at an absolute position. */
const Cap = ({ x, y, text, size = 28, color = INK.faint, mono = false, o = 1 }: { x: number; y: number; text: string; size?: number; color?: string; mono?: boolean; o?: number }) => (
  <div style={{ position: 'absolute', left: x, top: y, fontSize: size, fontWeight: 800, color, whiteSpace: 'nowrap', fontFamily: mono ? MONO : undefined, opacity: clamp(o) }}>{text}</div>
)

/** 3D icon with a caption underneath. */
function Node({ t, when, x, y, icon, label, size = 150, dim = false }: { t: number; when: number; x: number; y: number; icon: Icon3DName; label: string; size?: number; dim?: boolean }) {
  return (
    <>
      <Icon3D name={icon} x={x} y={y} size={size} t={t} at={when} dim={dim} />
      <div style={{ position: 'absolute', left: x - 170, width: 340, textAlign: 'center', top: y + size / 2 + 22, fontSize: 30, fontWeight: 800, color: dim ? INK.faint : INK.text, opacity: vis(t, when + 0.2) }}>{label}</div>
    </>
  )
}

type Cell = { label?: string; tone?: Tone; at: number; gone?: number; /** drawn dashed until this time (an uncommitted write) */ solid?: number }

/** A tape of equal cells. Cells pop in at `at`, fade at `gone`; `xOf` lets a cell slide to another slot. */
function Cells({ t, x, y, cw, n, cells, title, o = 1, fs = 28, xOf }: { t: number; x: number; y: number; cw: number; n: number; cells: Record<number, Cell>; title?: string; o?: number; fs?: number; xOf?: (i: number) => number }) {
  return (
    <div style={{ opacity: clamp(o) }}>
      {title && <div style={{ position: 'absolute', left: x, top: y - 52, fontSize: 28, fontWeight: 800, color: INK.faint, whiteSpace: 'nowrap' }}>{title}</div>}
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ position: 'absolute', left: x + i * cw, top: y, width: cw, height: 70, padding: '0 3px', boxSizing: 'border-box' }}>
          <div style={{ height: '100%', borderRadius: 14, background: INK.cell.empty, border: '1.5px solid rgba(110,160,255,0.35)' }} />
        </div>
      ))}
      {Object.entries(cells).map(([key, s]) => {
        const k = sp(t, s.at, 14, 140)
        const fade = s.gone !== undefined ? 1 - span(t, s.gone, s.gone + 0.4) : 1
        if (k <= 0 || fade <= 0) return null
        const tone = s.tone ?? 'blue'
        const pending = s.solid !== undefined && t < s.solid
        const left = xOf ? xOf(Number(key)) : x + Number(key) * cw
        return (
          <div key={key} style={{ position: 'absolute', left, top: y, width: cw, height: 70, padding: '0 3px', boxSizing: 'border-box', opacity: clamp(k * 1.6) * fade, transform: `scale(${0.85 + 0.15 * k})` }}>
            <div
              style={{
                height: '100%',
                borderRadius: 14,
                display: 'grid',
                placeItems: 'center',
                fontSize: fs,
                fontWeight: 800,
                whiteSpace: 'nowrap',
                color: pending ? '#d6e5ff' : TONE_INK[tone],
                background: pending ? 'rgba(77,141,255,0.16)' : TONE_BG[tone],
                border: pending ? '2.5px dashed #9fc2ff' : 'none',
                boxSizing: 'border-box',
                boxShadow: pending ? undefined : `inset 0 2px 0 rgba(255,255,255,0.5), 0 0 16px ${TONE_LINE[tone]}66, 0 10px 20px rgba(0,8,50,0.45)`,
              }}
            >
              {s.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** One labelled pill flying from → to; it fades in at the start and out at the end so it never rests on a card. */
function Flyer({ t, from, to, via, start, len = 0.8, label, tone = 'blue', w = 110, arc = 0 }: { t: number; from: { x: number; y: number }; to: { x: number; y: number }; /** optional corner: the pill travels from → via → to in straight legs */ via?: { x: number; y: number }; start: number; len?: number; label?: string; tone?: Tone; w?: number; arc?: number }) {
  const p = (t - start) / len
  if (p < 0 || p >= 1) return null
  const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2
  let px = lerp(from.x, to.x, e)
  let py = lerp(from.y, to.y, e)
  if (via) {
    const d1 = Math.hypot(via.x - from.x, via.y - from.y)
    const d2 = Math.hypot(to.x - via.x, to.y - via.y)
    const s = e * (d1 + d2)
    const leg = s <= d1 ? { a: from, b: via, k: s / d1 } : { a: via, b: to, k: (s - d1) / d2 }
    px = lerp(leg.a.x, leg.b.x, leg.k)
    py = lerp(leg.a.y, leg.b.y, leg.k)
  }
  return (
    <div style={{ position: 'absolute', left: px - w / 2, top: py - 28 - Math.sin(Math.PI * e) * arc, width: w, height: 56, borderRadius: 16, background: TONE_BG[tone], display: 'grid', placeItems: 'center', fontSize: 26, fontWeight: 800, whiteSpace: 'nowrap', color: TONE_INK[tone], opacity: Math.min(1, p * 8, (1 - p) * 6), boxShadow: `0 0 20px ${TONE_LINE[tone]}, inset 0 2px 0 rgba(255,255,255,0.5)` }}>
      {label}
    </div>
  )
}

/** Rows of "word | value" inside a card (a state store). Values are a timeline; the chip pops when it changes. */
type Row = { word: string; at: number; values: { t: number; v: string; tone?: Tone }[] }
function StoreCard({ t, x, y, w, h, rows, top = 22, gap = 76, border, dim = 1, from = 0 }: { t: number; x: number; y: number; w: number; h: number; rows: Row[]; top?: number; gap?: number; border?: string; dim?: number; from?: number }) {
  return (
    <div style={{ opacity: dim }}>
      <Card x={x} y={y} w={w} h={h} border={border} o={vis(t, from)} />
      {rows.map((r, i) => {
        const cur = [...r.values].reverse().find((v) => t >= v.t)
        const since = cur ? t - cur.t : 9
        const pop = 1 + 0.14 * Math.exp(-since * 7)
        const ry = y + top + i * gap
        return (
          <Rise key={r.word} t={t} at={r.at}>
            <Chip x={x + 24} y={ry} w={Math.round(w * 0.5) - 30} h={60} label={r.word} mono size={28} />
            <Cap x={x + Math.round(w * 0.5) - 2} y={ry + 8} text="=" size={34} color={INK.faint} />
            <Chip x={x + Math.round(w * 0.5) + 36} y={ry} w={Math.round(w * 0.5) - 60} h={60} label={cur?.v ?? '–'} tone={cur?.tone ?? 'good'} size={34} scale={pop} />
          </Rise>
        )
      })}
    </div>
  )
}

/** Task instance with badges big enough to read (the kit unit draws its badges at 20px). */
function Unit({ x, y, w, name, tasks, t, busy }: { x: number; y: number; w: number; name: string; tasks: string[]; t: number; busy?: number }) {
  if (tasks.length === 0)
    return (
      <div style={{ ...INK.card, position: 'absolute', left: x, top: y, width: w, height: 118, boxSizing: 'border-box' }}>
        <div style={{ position: 'absolute', left: 26, top: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 14, height: 14, borderRadius: 7, background: INK.dim }} />
          <span style={{ fontSize: 32, fontWeight: 800, whiteSpace: 'nowrap', color: INK.faint }}>{name}</span>
        </div>
        <div style={{ position: 'absolute', left: 24, top: 62, fontSize: 30, fontWeight: 700, whiteSpace: 'nowrap', color: INK.warn }}>rảnh · chờ thay người</div>
      </div>
    )
  return (
    <>
      <ConsumerUnit x={x} y={y} w={w} name={name} t={t} busy={busy} />
      <div style={{ position: 'absolute', left: x + 24, top: y + 58, display: 'flex', gap: 8 }}>
        {tasks.map((p) => (
          <span key={p} style={{ minWidth: 66, height: 40, padding: '0 14px', boxSizing: 'border-box', borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 800, color: '#13307f', background: '#ffffff', boxShadow: '0 0 12px rgba(255,255,255,0.45), 0 6px 14px rgba(0,8,50,0.4)' }}>
            {p}
          </span>
        ))}
      </div>
    </>
  )
}

/** Dashed glowing frame (a boundary) with a title tab at `tab` from the left. */
function Frame({ x, y, w, h, label, o, tab = 40 }: { x: number; y: number; w: number; h: number; label: string; o: number; tab?: number }) {
  if (o <= 0) return null
  return (
    <div style={{ opacity: clamp(o) }}>
      <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, boxSizing: 'border-box', borderRadius: 40, border: '3px dashed rgba(120,170,255,0.75)', background: 'rgba(28,58,160,0.12)', boxShadow: '0 0 40px rgba(61,123,255,0.35), inset 0 0 60px rgba(61,123,255,0.12)' }} />
      <Chip x={x + tab} y={y - 34} w={340} h={68} label={label} size={36} />
    </div>
  )
}

/** Value that steps through a timeline: last entry whose time has passed. */
function stepAt<T>(t: number, steps: { t: number; v: T }[], fallback: T): T {
  const hit = [...steps].reverse().find((s) => t >= s.t)
  return hit ? hit.v : fallback
}

/* ------------------------------------------------------------------ 0. library, not a cluster */

function library(t: number, c: Cue) {
  const ev = ['A', 'B', 'A', 'C'].map((l, i) => ({ l, at: at(c, 0, 0.18 + i * 0.17) }))
  const count = (l: string) => ev.filter((e) => e.l === l && t >= e.at + 0.9).length
  const board = vis(t, at(c, 0, 0.1), at(c, 3, 0.05))
  const qAt = [at(c, 1, 0.12), at(c, 1, 0.4), at(c, 1, 0.68)]
  const okAt = [at(c, 2, 0.08), at(c, 2, 0.2), at(c, 2, 0.32)]
  const qs = ['bộ đếm lưu ở đâu?', 'crash có mất không?', 'chia việc thế nào?']
  const ghost = at(c, 2, 0.6)
  const appAt = at(c, 3, 0.05)
  const jar = at(c, 3, 0.3)
  const topo = [0.1, 0.3, 0.5, 0.7].map((p) => at(c, 4, p))
  const NX = (i: number) => 450 + i * 300
  const pz = move(t, c.at(4), 0.9)
  const tags = ['source', 'filter', 'count', 'sink']
  const caps = ['đọc topic orders', 'lọc đơn hợp lệ', 'đếm theo sản phẩm', 'ghi topic counts']
  const resultAt = [at(c, 4, 0.82), at(c, 4, 0.92)]
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [c.at(3), { x: 960, y: 540, s: 1.04 }, 1.4]])}>
      <Cells t={t} x={70} y={505} cw={84} n={4} title="orders" o={vis(t, at(c, 0, 0.04))} cells={Object.fromEntries(ev.map((e, i) => [i, { label: e.l, at: e.at }]))} fs={34} />
      {ev.map((e, i) => (
        <Packets key={i} t={t} from={{ x: 412, y: 540 }} to={{ x: 494, y: 540 }} start={e.at + 0.1} end={e.at + 0.15} every={1} len={0.6} size={22} />
      ))}
      {/* beat 0: counting board, scaled 1.3x about its centre */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity: board, transform: 'scale(1.3)', transformOrigin: '920px 540px' }}>
        <Card x={600} y={290} w={640} h={500} />
        <Cap x={636} y={316} text="đếm theo sản phẩm" size={32} />
        {['A', 'B', 'C'].map((l, i) => (
          <div key={l}>
            <Chip x={640} y={390 + i * 128} w={84} h={84} label={l} size={44} />
            <div style={{ position: 'absolute', left: 750, top: 398 + i * 128, height: 68, width: Math.max(0, count(l)) * 180, borderRadius: 18, background: TONE_BG.blue, boxShadow: '0 0 18px rgba(77,141,255,0.6), inset 0 2px 0 rgba(255,255,255,0.5)' }} />
            <Cap x={1130} y={400 + i * 128} text={String(count(l))} size={54} color="#fff" />
          </div>
        ))}
      </div>
      {/* beat 1-2: the three chores, then Streams takes them over */}
      {qs.map((q, i) => (
        <Tag key={q} x={1628} y={240 + i * 110} text={t >= okAt[i] ? `✓ ${q.replace('?', '')}` : `? ${q}`} size={32} color={t >= okAt[i] ? INK.good : INK.warn} o={vis(t, qAt[i], at(c, 3, 0.05))} />
      ))}
      <div style={{ opacity: vis(t, ghost, at(c, 3, 0.2)) }}>
        <div style={{ position: 'absolute', left: 0, top: 0, transform: 'scale(1.6)', transformOrigin: '0 0' }}>
          <ServerUnit x={1420 / 1.6} y={610 / 1.6} name="cluster Streams" down t={t} />
        </div>
        <Tag x={1628} y={565} text="✕ không có" color={INK.bad} size={34} o={vis(t, ghost + 0.3)} />
      </div>
      {/* beat 3: the app embeds the library */}
      <Rise t={t} at={appAt}>
        <Card x={430} y={270} w={1160} h={540} border="2px solid rgba(110,160,255,0.85)">
          <Cap x={36} y={26} text="ứng dụng của bạn" size={36} color="#fff" />
          <Cap x={420} y={34} text="application.id = shop-count" size={26} mono />
        </Card>
      </Rise>
      <Icon3D name="puzzle" x={lerp(1010, 1500, pz)} y={lerp(560, 350, pz)} size={lerp(240, 110, pz)} t={t} at={jar} />
      <Tag x={1010} y={730} text="kafka-streams.jar" mono size={30} color={INK.accent} o={vis(t, jar + 0.3, c.at(4))} />
      {/* beat 4: topology */}
      {tags.map((l, i) => (
        <div key={l}>
          <Rise t={t} at={topo[i]}>
            <Chip x={NX(i)} y={500} w={210} h={84} label={l} tone={i === 0 ? 'good' : i === 3 ? 'warn' : 'blue'} size={32} mono />
            <div style={{ position: 'absolute', left: NX(i) - 40, top: 610, width: 290, textAlign: 'center', fontSize: 29, fontWeight: 800, color: INK.faint, whiteSpace: 'nowrap' }}>{caps[i]}</div>
          </Rise>
          {i < 3 && (
            <>
              <Wire from={{ x: NX(i) + 214, y: 542 }} to={{ x: NX(i + 1) - 6, y: 542 }} color={INK.line} p={move(t, topo[i + 1] - 0.3, 0.3)} />
              <Packets t={t} from={{ x: NX(i) + 214, y: 542 }} to={{ x: NX(i + 1) - 6, y: 542 }} start={topo[3] + 0.4 + i * 0.15} every={0.9} len={0.6} size={20} />
            </>
          )}
        </div>
      ))}
      <Wire from={{ x: 352, y: 542 }} to={{ x: NX(0) - 6, y: 542 }} color={INK.line} p={move(t, topo[0] - 0.3, 0.3)} />
      <Wire from={{ x: NX(3) + 214, y: 542 }} to={{ x: 1636, y: 542 }} color={INK.line} p={move(t, topo[3] - 0.1, 0.3)} />
      <Cells t={t} x={1640} y={505} cw={70} n={3} title="counts" o={vis(t, topo[3])} fs={26} cells={{ 0: { label: 'A:2', tone: 'good', at: resultAt[0] }, 1: { label: 'B:1', tone: 'good', at: resultAt[1] } }} />
      <Cap x={470} y={700} text="topology: đồ thị các processor" size={38} color="#fff" o={vis(t, topo[1])} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 1. scale: tasks over instances */

function scale(t: number, c: Cue) {
  const sched = [
    { t: 0.3, n: 1 },
    { t: at(c, 0, 0.5), n: 2 },
    { t: at(c, 1, 0.25), n: 3 },
    { t: at(c, 2, 0.5), n: 6 },
    { t: at(c, 3, 0.25), n: 8 },
  ]
  const n = stepAt(t, sched.map((s) => ({ t: s.t, v: s.n })), 1)
  const birth = (k: number) => (sched.find((s) => s.n >= k + 1) as { t: number }).t
  const active = Math.min(n, 6)
  const layout: number[][] = Array.from({ length: active }, () => [])
  for (let p = 0; p < 6; p++) layout[p % active].push(p)
  const chipAt = (p: number) => at(c, 1, 0.42 + p * 0.09)
  const tasksNamed = t >= chipAt(0)
  const GX = 800
  // the block of instances stays vertically centred while rows are added
  let off = 0
  let prevOff = 0
  for (const sc of sched) {
    const target = (4 - Math.ceil(sc.n / 2)) * 85
    if (t >= sc.t) {
      off = lerp(prevOff, target, move(t, sc.t, 0.6))
      prevOff = target
    }
  }
  const slot = (k: number) => ({ x: GX + (k % 2) * 530, y: 190 + off + Math.floor(k / 2) * 170 })
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE]])} title={{ kicker: 'KAFKA STREAMS', text: 'Scale bằng instance' }}>
      <Cap x={110} y={150 + 0} text="topic orders · 6 partition" size={28} o={vis(t, 0.6)} />
      {Array.from({ length: 6 }, (_, p) => {
        const y = 215 + p * 118
        return (
          <div key={p}>
            <Cap x={90} y={y + 18} text={`P${p}`} size={30} color="#fff" o={vis(t, 0.6 + p * 0.08)} />
            <Cells t={t} x={170} y={y} cw={60} n={5} cells={{ 0: { at: 0.8 + p * 0.08 }, 1: { at: 0.9 + p * 0.08 }, 2: { at: 1.0 + p * 0.08 }, 3: { at: 1.1 + p * 0.08 } }} o={vis(t, 0.6 + p * 0.08)} />
            <Chip x={500} y={y + 11} w={88} h={48} label={`T${p}`} size={28} tone="good" o={vis(t, chipAt(p))} />
          </div>
        )
      })}
      <Packets t={t} from={{ x: 596, y: 540 }} to={{ x: GX - 10, y: 540 }} start={1.6} every={0.4} len={0.9} size={22} />
      {Array.from({ length: n }, (_, k) => {
        const mine = k < active ? layout[k] : []
        const s = slot(k)
        return (
          <Rise key={k} t={t} at={birth(k)}>
            <Unit x={s.x} y={s.y} w={500} name={`instance ${k + 1}`} tasks={mine.map((p) => `${tasksNamed ? 'T' : 'P'}${p}`)} t={t} busy={mine.length ? (t * 0.9 + k * 0.23) % 1 : undefined} />
          </Rise>
        )
      })}
      <Tag x={1300} y={935} text="6 partition = 6 task" size={34} color={INK.accent} o={vis(t, at(c, 2, 0.08), at(c, 3, 0.3))} />
      <Tag x={1300} y={935} text="6 task · 8 instance → 2 ngồi không" size={34} color={INK.warn} o={vis(t, at(c, 3, 0.4))} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 2. KStream vs KTable */

function streamTable(t: number, c: Cue) {
  const a2 = c.at(2)
  const tapeY = lerp(470, 255, move(t, a2 - 0.1, 0.9))
  const TX = 440
  const CW = 170
  const evs = [
    { l: 'A +100', tone: 'blue' as Tone, at: at(c, 1, 0.2) },
    { l: 'A +50', tone: 'blue' as Tone, at: at(c, 1, 0.45) },
    { l: 'A −30', tone: 'warn' as Tone, at: at(c, 1, 0.7) },
  ]
  const L2 = [at(c, 2, 0.34), at(c, 2, 0.58), at(c, 2, 0.82)]
  const L3 = [at(c, 3, 0.3), at(c, 3, 0.55), at(c, 3, 0.8)]
  const lands = [
    { t: L2[0], v: '100', tone: 'blue' as Tone },
    { t: L2[1], v: '50', tone: 'blue' as Tone },
    { t: L2[2], v: '−30', tone: 'bad' as Tone },
    { t: at(c, 3, 0.04), v: '–', tone: 'blue' as Tone },
    { t: L3[0], v: '100', tone: 'blue' as Tone },
    { t: L3[1], v: '150', tone: 'blue' as Tone },
    { t: L3[2], v: '120', tone: 'good' as Tone },
  ]
  const cur = stepAt(t, lands.map((l) => ({ t: l.t, v: l })), { t: 0, v: '–', tone: 'blue' as Tone })
  const pop = 1 + 0.12 * Math.exp(-(t - cur.t) * 7)
  const cellCx = (i: number) => TX + i * CW + CW / 2
  const cellY = 255 + 35
  const target = { x: TX + 400, y: 545 }
  const ring = (i: number, start: number) => {
    const k = 1 - span(t, start, start + 0.7)
    return k > 0 && t >= start ? <div key={start} style={{ position: 'absolute', left: TX + i * CW + 2, top: cellY - 38, width: CW - 4, height: 76, borderRadius: 16, border: '3px solid #fff', boxShadow: '0 0 22px #fff', opacity: k }} /> : null
  }
  const wrong = vis(t, L2[2] + 0.25, at(c, 3, 0.04))
  const right = vis(t, L3[2] + 0.25)
  const tableAt = a2 + 0.2
  const mode = t < at(c, 3, 0.04) ? 'đọc thẳng topic thành KTable' : 'gom theo key thành KTable'
  const cellsMap = Object.fromEntries(evs.map((e, i) => [i, { label: e.l, tone: e.tone, at: e.at }]))
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE]])} title={{ kicker: 'KSTREAM · KTABLE', text: 'Sự kiện hay giá trị?' }}>
      <Node t={t} when={at(c, 0, 0.25)} x={225} y={tapeY + 20} icon="notebook" label="KStream" size={140} />
      <Cells t={t} x={TX} y={tapeY} cw={CW} n={5} title="topic transactions · key A" o={vis(t, at(c, 0, 0.08))} cells={cellsMap} />
      {t < a2 && <Tag x={TX + 425} y={tapeY + 150} text="mỗi tin = một sự kiện, không tin nào thay tin nào" size={30} color={INK.accent} o={vis(t, at(c, 0, 0.6))} />}
      {/* table */}
      <Node t={t} when={tableAt} x={225} y={715} icon="money-bag" label="KTable" size={140} />
      <Rise t={t} at={tableAt}>
        <Card x={TX} y={585} w={700} h={270}>
          <Cap x={36} y={22} text="key" size={28} />
          <Cap x={250} y={22} text="value" size={28} />
        </Card>
        <Chip x={TX + 36} y={585 + 96} w={110} h={110} label="A" size={52} />
        <Chip x={TX + 200} y={585 + 96} w={440} h={110} label={cur.v} tone={cur.tone} size={64} scale={pop} />
        <Cap x={TX + 36} y={585 + 220} text={mode} size={26} color={INK.accent} />
      </Rise>
      {[0, 1, 2].map((i) => (
        <div key={i}>
          <Flyer t={t} from={{ x: cellCx(i), y: cellY + 80 }} to={target} start={L2[i] - 0.8} len={0.8} label={evs[i].l.replace('A ', '')} tone={evs[i].tone} />
          <Flyer t={t} from={{ x: cellCx(i), y: cellY + 80 }} to={target} start={L3[i] - 0.8} len={0.8} label={evs[i].l.replace('A ', '')} tone={evs[i].tone} />
          {ring(i, L2[i] - 0.8)}
          {ring(i, L3[i] - 0.8)}
        </div>
      ))}
      <Tag x={1480} y={700} text="✕ sai: chỉ còn −30" color={INK.bad} size={34} o={wrong} />
      <Tag x={1480} y={700} text="✓ đúng: tổng = 120" color={INK.good} size={34} o={right} />
      {/* beat 4: both directions */}
      <Wire from={{ x: 520, y: 350 }} to={{ x: 520, y: 580 }} color={INK.accent} p={move(t, at(c, 4, 0.1), 0.5)} flow={t} />
      <Packets t={t} from={{ x: 520, y: 350 }} to={{ x: 520, y: 580 }} start={at(c, 4, 0.3)} every={0.6} len={0.8} size={20} />
      <Tag x={770} y={465} text="aggregate" mono size={30} o={vis(t, at(c, 4, 0.2))} />
      <Wire from={{ x: 1020, y: 580 }} to={{ x: 1020, y: 350 }} color={INK.good} p={move(t, at(c, 4, 0.5), 0.5)} flow={t} />
      <Packets t={t} from={{ x: 1020, y: 580 }} to={{ x: 1020, y: 350 }} start={at(c, 4, 0.7)} every={0.6} len={0.8} size={20} color={INK.good} />
      <Tag x={1400} y={465} text="mọi thay đổi → sự kiện" color={INK.good} size={30} o={vis(t, at(c, 4, 0.6))} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 3. state store + changelog */

function state(t: number, c: Cue) {
  const words = ['kafka', 'kafka', 'kafka', 'streams', 'streams']
  const ev = [at(c, 0, 0.78), at(c, 2, 0.08), at(c, 2, 0.32), at(c, 2, 0.56), at(c, 2, 0.8)]
  const land = ev.map((e) => e + 0.95)
  const mirror = ev.map((e, i) => (i === 0 ? at(c, 1, 0.45) : e + 1.05))
  const mland = mirror.map((m) => m + 1)
  const IX = 720
  const ICW = 130
  const CX = 720
  const CCW = 170
  const IY = 320
  const CY = 680
  const rowY = (w: string) => (w === 'kafka' ? 585 : 685)
  const tc = at(c, 3, 0.25)
  const target = [0, 1, 0, 3, 1]
  const labels = ['kafka:1', 'kafka:2', 'kafka:3', 'streams:1', 'streams:2']
  const keep = [false, false, true, false, true]
  const mv = move(t, tc + 0.5, 0.9)
  const compacted = t >= tc
  const rows: Row[] = [
    { word: 'kafka', at: land[0] - 0.2, values: [1, 2, 3].map((v, i) => ({ t: land[i], v: String(v) })) },
    { word: 'streams', at: land[3] - 0.2, values: [1, 2].map((v, i) => ({ t: land[3 + i], v: String(v) })) },
  ]
  const wordsCells = Object.fromEntries(words.map((w, i) => [i, { label: w, at: ev[i], tone: (w === 'kafka' ? 'blue' : 'warn') as Tone }]))
  const clog = Object.fromEntries(
    labels.map((l, i) => [i, { label: l, at: mland[i], tone: (i < 3 ? 'blue' : 'warn') as Tone, gone: keep[i] ? undefined : tc + 0.05 + i * 0.12 }]),
  )
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE]])} title={{ kicker: 'STATE STORE', text: 'Bộ đếm và changelog' }}>
      <Card x={70} y={170} w={560} h={700} border="2px solid rgba(110,160,255,0.55)" />
      <Cap x={100} y={186} text="máy chạy ứng dụng" size={30} color="#fff" />
      <Card x={660} y={170} w={1190} h={700} border="2px solid rgba(110,160,255,0.55)" />
      <Cap x={690} y={186} text="Kafka cluster" size={30} color="#fff" />
      <Rise t={t} at={0.6}>
        <ConsumerUnit x={100} y={240} w={500} name="instance A" parts={['T0']} t={t} busy={(t * 0.9) % 1} />
      </Rise>
      <Rise t={t} at={at(c, 0, 0.08)}>
        <Card x={100} y={400} w={500} h={440} />
        <Icon3D name="cube" x={185} y={475} size={110} t={t} at={at(c, 0, 0.12)} />
        <Cap x={260} y={445} text="state store" size={36} color="#fff" />
        <Cap x={260} y={492} text="RocksDB · trên đĩa" size={26} />
      </Rise>
      <StoreCard t={t} x={124} y={555} w={452} h={270} rows={rows} top={30} gap={100} border="1.5px solid rgba(110,160,255,0.35)" />
      <Cells t={t} x={IX} y={IY} cw={ICW} n={5} title="topic input (các từ)" o={vis(t, at(c, 0, 0.5))} cells={wordsCells} fs={26} />
      <Cells t={t} x={CX} y={CY} cw={CCW} n={6} title="changelog topic · compact" o={vis(t, at(c, 1, 0.05))} fs={26} cells={clog} xOf={(i) => CX + lerp(i, target[i], mv) * CCW} />
      {words.map((w, i) => (
        <div key={i}>
          <Flyer t={t} from={{ x: IX + i * ICW + ICW / 2, y: IY + 35 }} to={{ x: 640, y: rowY(w) + 30 }} start={ev[i] + 0.15} len={0.8} label={w} tone={w === 'kafka' ? 'blue' : 'warn'} w={150} />
          <Flyer t={t} from={{ x: 640, y: rowY(w) + 30 }} via={{ x: 640, y: CY + 110 }} to={{ x: CX + i * CCW + 85, y: CY + 110 }} start={mirror[i]} len={0.9} label={`${w}:${[1, 2, 3, 1, 2][i]}`} tone={w === 'kafka' ? 'blue' : 'warn'} w={160} />
        </div>
      ))}
      <Tag x={1290} y={520} text="mỗi lần đổi → ghi thêm 1 tin" size={30} color={INK.accent} o={vis(t, at(c, 1, 0.3), tc)} />
      <Tag x={1290} y={520} text={`compaction: 5 tin → 2 tin`} size={30} color={INK.good} o={vis(t, tc + 0.9)} />
      {compacted && <Cap x={CX} y={CY + 90} text="mỗi key giữ giá trị mới nhất" size={26} color={INK.good} o={vis(t, tc + 1.4)} />}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 4. restore from the changelog */

function restore(t: number, c: Cue) {
  const die = at(c, 0, 0.45)
  const alive = t < die
  const flights = [at(c, 2, 0.3), at(c, 2, 0.62)]
  const landB = flights.map((f) => f + 0.9)
  const TX = 720
  const CW = 150
  const TY = 600
  const aRows: Row[] = [
    { word: 'kafka', at: 0.6, values: [{ t: 0.6, v: '3' }] },
    { word: 'streams', at: 0.7, values: [{ t: 0.7, v: '2' }] },
  ]
  const bRows: Row[] = [
    { word: 'kafka', at: landB[0] - 0.2, values: [{ t: landB[0], v: '3' }] },
    { word: 'streams', at: landB[1] - 0.2, values: [{ t: landB[1], v: '2' }] },
  ]
  const cRows: Row[] = [
    { word: 'kafka', at: at(c, 4, 0.3), values: [{ t: at(c, 4, 0.3), v: '3', tone: 'warn' }] },
    { word: 'streams', at: at(c, 4, 0.4), values: [{ t: at(c, 4, 0.4), v: '2', tone: 'warn' }] },
  ]
  const read = landB.filter((l) => t >= l).length
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE]])} title={{ kicker: 'KHÔI PHỤC', text: 'Instance chết' }}>
      {/* A: dies */}
      <Rise t={t} at={0.4}>
        <ConsumerUnit x={100} y={190} w={460} name="instance A" parts={['T0']} down={!alive} note={alive ? undefined : 'đã chết'} t={t} busy={alive ? (t * 0.9) % 1 : undefined} />
      </Rise>
      <Cap x={100} y={322} text="state store" size={28} />
      <StoreCard t={t} x={100} y={365} w={460} h={170} rows={aRows} border={alive ? undefined : `2px solid ${INK.bad}`} dim={alive ? 1 : 0.35} />
      <Tag x={330} y={575} text="✕ mất theo máy" color={INK.bad} size={30} o={vis(t, die + 0.3, at(c, 2, 0.1))} />
      <Wire from={{ x: 566, y: 450 }} to={{ x: TX - 6, y: TY + 35 }} color={alive ? INK.line : INK.bad} dashed={!alive} flow={alive ? t : undefined} p={move(t, 0.9, 0.5)} />
      {/* changelog */}
      <Cells t={t} x={TX} y={TY} cw={CW} n={6} title="changelog topic · compact" o={vis(t, 0.5)} fs={26} cells={{ 0: { label: 'kafka:3', at: 0.8 }, 1: { label: 'streams:2', tone: 'warn', at: 0.95 } }} />
      <div style={{ opacity: 1 - span(t, at(c, 4, 0.02), at(c, 4, 0.12)) }}>
        <Icon3D name="shield" x={1730} y={TY + 35} size={130} t={t} at={at(c, 1, 0.25)} />
        <Tag x={1730} y={TY + 150} text="an toàn trong Kafka" color={INK.good} size={28} o={vis(t, at(c, 1, 0.5), at(c, 4, 0.02), 0.1)} />
      </div>
      {/* B: takes over */}
      <Rise t={t} at={at(c, 2, 0.02)}>
        <ConsumerUnit x={100} y={620} w={460} name="instance B" parts={t >= landB[1] + 0.3 ? ['T0'] : undefined} idle={false} note={t >= at(c, 3, 0.1) ? 'đang chạy' : 'nhận task T0'} accent={t >= at(c, 3, 0.1) ? undefined : INK.warn} t={t} busy={t >= at(c, 3, 0.1) ? (t * 0.9) % 1 : undefined} />
      </Rise>
      <Rise t={t} at={at(c, 2, 0.1)}>
        <Cap x={100} y={752} text="state store (trống)" size={28} o={t >= landB[0] ? 0 : 1} />
        <Cap x={100} y={752} text="state store" size={28} o={t >= landB[0] ? 1 : 0} />
      </Rise>
      <StoreCard t={t} x={100} y={795} w={460} h={170} from={at(c, 2, 0.1)} rows={bRows} border={t >= landB[1] ? `2px solid ${INK.good}` : undefined} />
      {flights.map((f, i) => (
        <Flyer key={i} t={t} from={{ x: TX + i * CW + CW / 2, y: TY + 70 }} to={{ x: 566, y: 880 }} start={f} len={0.9} label={i ? 'streams:2' : 'kafka:3'} tone={i ? 'warn' : 'blue'} w={160} />
      ))}
      <div style={{ position: 'absolute', left: TX + 40, top: TY + 200, opacity: vis(t, at(c, 2, 0.05), at(c, 4, 0.1)) }}>
        <Tag x={170} y={0} text={`đọc lại changelog: ${read}/2`} color={read === 2 ? INK.good : INK.warn} size={32} />
      </div>
      <Tag x={330} y={578} text="= đúng giá trị cũ" color={INK.good} size={28} o={vis(t, landB[1] + 0.6, at(c, 4, 0.1))} />
      {/* C: standby */}
      <Rise t={t} at={at(c, 4, 0.08)}>
        <ConsumerUnit x={1260} y={175} w={520} name="instance C" note="standby" accent={INK.warn} t={t} />
      </Rise>
      <StoreCard t={t} x={1260} y={345} w={520} h={170} from={at(c, 4, 0.2)} rows={cRows} border={`2px solid ${INK.warn}`} />
      <Cap x={1260} y={305} text="state store (bản sao nóng)" size={28} o={vis(t, at(c, 4, 0.2))} />
      <Packets t={t} from={{ x: TX + 3.5 * CW, y: TY - 8 }} to={{ x: TX + 3.5 * CW + 150, y: 525 }} start={at(c, 4, 0.35)} every={0.5} len={0.9} size={20} color={INK.warn} />
      <Tag x={1400} y={800} text="num.standby.replicas = 1" mono size={30} color={INK.warn} o={vis(t, at(c, 4, 0.55))} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 5. repartition */

const INPUT: Word[][][] = [
  [['kafka', 'streams'], ['log', 'kafka'], ['streams', 'log'], ['kafka', 'kafka']],
  [['streams', 'kafka'], ['kafka', 'log'], ['kafka', 'streams'], ['log', 'log']],
  [['log', 'kafka'], ['streams', 'streams'], ['kafka', 'log'], ['kafka', 'streams']],
]
const WORDS: Word[] = ['kafka', 'streams', 'log']
const TOTAL = Object.fromEntries(WORDS.map((w) => [w, INPUT.flat(2).filter((x) => x === w).length])) as Record<Word, number>

/** A tape cell holding coloured dots (one per word in the sentence). */
function DotCell({ t, x, y, words, at: when, w = 72, pulse = false }: { t: number; x: number; y: number; words: Word[]; at: number; w?: number; pulse?: boolean }) {
  const k = sp(t, when, 14, 140)
  if (k <= 0) return null
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: 70, padding: '0 3px', boxSizing: 'border-box', opacity: clamp(k * 1.6), transform: `scale(${0.85 + 0.15 * k})` }}>
      <div style={{ height: '100%', borderRadius: 14, background: INK.cell.filled, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.5), 0 0 14px rgba(77,141,255,0.35), 0 10px 20px rgba(0,8,50,0.45)' }}>
        {words.map((wd, i) => {
          const s = pulse && wd === 'kafka' ? 1 + 0.35 * Math.abs(Math.sin(t * 5)) : 1
          return <span key={i} style={{ width: 22, height: 22, borderRadius: 11, background: WORD[wd], border: '2px solid #fff', boxSizing: 'border-box', transform: `scale(${s})`, boxShadow: `0 0 10px ${WORD[wd]}` }} />
        })}
      </div>
    </div>
  )
}

function repartition(t: number, c: Cue) {
  const ROWS = [300, 520, 740]
  const IX = 100
  const RX = 780
  const taskX = lerp(720, 1340, move(t, c.at(1), 1.0))
  const inAt = (r: number) => at(c, 1, 0.08 + r * 0.1)
  const split = at(c, 2, 0.12)
  const repAt = (r: number) => at(c, 2, 0.3 + r * 0.12)
  const flow3 = at(c, 3, 0.1)
  const progress = span(t, at(c, 3, 0.2), at(c, 3, 0.92))
  const noteOf = (w: Word) => (t >= flow3 ? `${w} = ${Math.round(TOTAL[w] * progress)}` : `đếm ${w}`)
  const pinned = vis(t, at(c, 1, 0.55), split)
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE]])} title={{ kicker: 'REPARTITION', text: 'Đổi key, chia lại' }}>
      <Cap x={IX} y={190} text="topic câu" size={28} o={vis(t, inAt(0))} />
      <Cap x={RX} y={190} text="repartition topic" size={28} o={vis(t, repAt(0))} />
      <Cap x={taskX} y={190} text="task đếm" size={28} o={vis(t, 0.8)} />
      {ROWS.map((ry, r) => (
        <div key={r}>
          <Cap x={IX - 8} y={ry - 38} text={`P${r}`} size={26} color={INK.faint} o={vis(t, inAt(r))} />
          {INPUT[r].map((words, j) => (
            <DotCell key={j} t={t} x={IX + j * 72} y={ry} words={words} at={inAt(r) + j * 0.1} pulse={pinned > 0.5} />
          ))}
          <Cap x={RX - 8} y={ry - 38} text={`P${r}`} size={26} color={INK.faint} o={vis(t, repAt(r))} />
          {[0, 1, 2, 3].map((j) => (
            <DotCell key={j} t={t} x={RX + j * 72} y={ry} words={[WORDS[r]]} at={repAt(r) + 0.2 + j * 0.25} />
          ))}
          <Rise t={t} at={0.8 + r * 0.15}>
            <ConsumerUnit x={taskX} y={ry - 24} w={460} name={`task ${r}`} note={noteOf(WORDS[r])} accent={WORD[WORDS[r]]} parts={[`T${r}`]} t={t} busy={t >= flow3 ? (t * 0.9 + r * 0.3) % 1 : undefined} />
          </Rise>
          <Packets t={t} from={{ x: IX + 292, y: ry + 35 }} to={{ x: 500, y: 540 }} start={split + 0.1} end={split + 1.6} every={0.45} len={0.7} size={20} />
          <Packets t={t} from={{ x: 664, y: 540 }} to={{ x: RX - 6, y: ry + 35 }} start={repAt(r)} end={flow3} every={0.4} len={0.7} size={22} color={WORD[WORDS[r]]} />
          <Packets t={t} from={{ x: RX + 295, y: ry + 35 }} to={{ x: 1330, y: ry + 35 }} start={flow3} every={0.4} len={0.9} size={22} color={WORD[WORDS[r]]} />
        </div>
      ))}
      <Rise t={t} at={split}>
        <Chip x={500} y={498} w={164} h={84} label="đổi key" tone="warn" size={32} />
        <Cap x={470} y={598} text="key = từ" size={28} color={INK.warn} />
      </Rise>
      <Tag x={960} y={900} text="kafka nằm ở cả 3 partition" color={WORD.kafka} size={32} o={pinned} />
      <Tag x={960} y={900} text="+1 lượt ghi và đọc qua Kafka = có chi phí" color={INK.warn} size={32} o={vis(t, at(c, 3, 0.55))} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 6. exactly_once_v2 */

function eos(t: number, c: Cue) {
  const LY = [330, 530, 730]
  const LX = 900
  const CW = 140
  const flightFrom = { x: 540, y: 565 }
  const flightTo = (lane: number, idx: number) => ({ x: LX + idx * CW + CW / 2, y: LY[lane] + 35 })
  const T = {
    ev: at(c, 0, 0.08),
    r0: [at(c, 0, 0.3), at(c, 0, 0.55), at(c, 0, 0.8)],
    clear1: c.at(1),
    r1: [at(c, 1, 0.08), at(c, 1, 0.2)],
    crash: at(c, 1, 0.36),
    back: at(c, 1, 0.5),
    retry: [at(c, 1, 0.54), at(c, 1, 0.68)],
    clear2: c.at(2),
    frame: at(c, 2, 0.05),
    r2: [at(c, 2, 0.3), at(c, 2, 0.5), at(c, 2, 0.68)],
    commit: at(c, 3, 0.02),
    r3: at(c, 3, 0.25),
    abort: at(c, 3, 0.62),
    sms: [at(c, 4, 0.22), at(c, 4, 0.62)],
    crash2: at(c, 4, 0.42),
    back2: at(c, 4, 0.55),
  }
  const len = 0.8
  const down = (t >= T.crash && t < T.back) || (t >= T.crash2 && t < T.back2)
  const note = t >= T.crash2 && t < T.back2 ? 'crash!' : t >= T.crash && t < T.back ? 'crash!' : t >= T.back && t < T.clear2 ? 'chạy lại' : undefined
  // lane cells
  const out: Record<number, Cell> = {
    0: { label: 'A=1', at: T.r0[0] + len, gone: T.clear1 },
    1: { label: 'A=1', at: T.r1[0] + len, gone: T.clear2 },
    2: { label: 'A=2', tone: 'bad', at: T.retry[0] + len, gone: T.clear2 },
    3: { label: 'A=1', at: T.r2[0] + len, solid: T.commit },
    4: { label: 'B=1', tone: 'warn', at: T.r3 + 0.3, solid: T.abort + 5, gone: T.abort },
  }
  const log: Record<number, Cell> = {
    0: { label: 'A=1', at: T.r0[1] + len, gone: T.clear1 },
    1: { label: 'A=1', at: T.r1[1] + len, gone: T.clear2 },
    2: { label: 'A=2', tone: 'bad', at: T.retry[1] + len, gone: T.clear2 },
    3: { label: 'A=1', at: T.r2[1] + len, solid: T.commit },
    4: { label: 'B=1', tone: 'warn', at: T.r3 + 0.3, solid: T.abort + 5, gone: T.abort },
  }
  const com: Record<number, Cell> = {
    0: { label: 'off 8', at: T.r0[2] + len, gone: T.clear1 },
    3: { label: 'off 8', at: T.r2[2] + len, solid: T.commit },
    4: { label: 'off 9', tone: 'warn', at: T.r3 + 0.3, solid: T.abort + 5, gone: T.abort },
  }
  // slot of each cell key inside its lane (slots are re-used after a clear)
  const slotOf: Record<number, number> = { 0: 0, 1: 0, 2: 1, 3: 0, 4: 1 }
  const xOf = (i: number) => LX + slotOf[i] * CW
  const frameO = vis(t, T.frame, Infinity, 0.5)
  const flights: ReactNode[] = [
    ...T.r0.map((s, l) => <Flyer key={`a${l}`} t={t} from={flightFrom} to={flightTo(l, 0)} start={s} len={len} label={l === 2 ? 'off 8' : 'A=1'} w={110} />),
    ...[0, 1].map((l) => <Flyer key={`b${l}`} t={t} from={flightFrom} to={flightTo(l, 0)} start={T.r1[l]} len={len} label="A=1" w={110} />),
    ...[0, 1].map((l) => <Flyer key={`c${l}`} t={t} from={flightFrom} to={flightTo(l, 1)} start={T.retry[l]} len={len} label="A=2" tone="bad" w={110} />),
    ...T.r2.map((s, l) => <Flyer key={`d${l}`} t={t} from={flightFrom} to={flightTo(l, 0)} start={s} len={len} label={l === 2 ? 'off 8' : 'A=1'} w={110} />),
  ]
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE]])} title={{ kicker: 'EXACTLY ONCE', text: 'Một vòng, ba việc' }}>
      <Cells t={t} x={100} y={280} cw={90} n={3} title="input" fs={30} cells={{ 0: { label: 'A', at: T.ev } }} o={vis(t, 0.6)} />
      <Packets t={t} from={{ x: 145, y: 360 }} to={{ x: 145, y: 492 }} start={T.ev + 0.3} end={T.ev + 0.4} every={1} len={0.7} size={22} />
      <Rise t={t} at={0.9}>
        <ConsumerUnit x={100} y={506} w={440} name="task" parts={['T0']} down={down} note={note} t={t} busy={down ? undefined : (t * 0.9) % 1} />
      </Rise>
      {['① ghi output', '② ghi changelog', '③ commit offset'].map((l, i) => (
        <Cap key={l} x={LX} y={LY[i] - 50} text={l} size={30} color="#fff" o={vis(t, T.r0[i] - 0.5)} />
      ))}
      {[0, 1, 2].map((l) => (
        <Cells key={l} t={t} x={LX} y={LY[l]} cw={CW} n={5} o={vis(t, T.r0[l] - 0.5)} fs={28} cells={l === 0 ? out : l === 1 ? log : com} xOf={xOf} />
      ))}
      {flights}
      <Tag x={1250} y={LY[2] + 105} text="✕ chưa kịp commit" color={INK.bad} size={30} o={vis(t, T.crash + 0.1, T.back)} />
      <Tag x={1250} y={910} text="chạy lại → đếm lặp: A = 2" color={INK.bad} size={34} o={vis(t, T.retry[1] + 0.5, T.clear2)} />
      <Frame x={860} y={255} w={800} h={600} label="transaction" o={frameO} tab={440} />
      <Icon3D name="lock" x={1790} y={555} size={150} t={t} at={T.frame + 0.3} />
      <Tag x={1250} y={910} text="✕ huỷ cả ba, read_committed không thấy" color={INK.bad} size={32} o={vis(t, T.abort + 0.2, at(c, 4, 0.0))} />
      <Tag x={1250} y={910} text="✓ cả ba cùng hiện ra" color={INK.good} size={34} o={vis(t, T.commit + 0.2, T.r3 + 0.3)} />
      {/* beat 4: external side effect */}
      <Icon3D name="mail" x={1050} y={925} size={100} t={t} at={at(c, 4, 0.1)} />
      {T.sms.map((s, i) => (
        <Flyer key={i} t={t} from={{ x: 330, y: 665 }} via={{ x: 330, y: 925 }} to={{ x: 905, y: 925 }} start={s} len={1.1} label={i ? 'SMS lần 2' : 'SMS'} tone={i ? 'bad' : 'blue'} w={i ? 170 : 110} />
      ))}
      <Tag x={1370} y={925} text={`SMS đã gửi: ${T.sms.filter((x) => t >= x + 1.1).length}`} color={t >= T.sms[1] + 1.1 ? INK.bad : INK.accent} size={32} o={vis(t, at(c, 4, 0.1) + 0.3)} />
      <Tag x={1260} y={1015} text="nằm ngoài transaction → vẫn có thể lặp" color={INK.warn} size={30} o={vis(t, at(c, 4, 0.7))} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 7. which tool */

function choose(t: number, c: Cue) {
  const qAt = [at(c, 0, 0.35), at(c, 0, 0.6), at(c, 0, 0.85)]
  const qOut = c.at(1) + 0.4
  const conn = at(c, 1, 0.1)
  const reg = at(c, 2, 0.1)
  const str = at(c, 3, 0.1)
  const plain = at(c, 4, 0.1)
  const K = { x: 960, y: 520 }
  const bigCard = (x: number, y: number, w: number, h: number, icon: Icon3DName, title: string, sub: string, when: number, hot: boolean) => (
    <Rise t={t} at={when}>
      <Card x={x} y={y} w={w} h={h} border={hot ? '2px solid #9fc2ff' : undefined} />
      <Icon3D name={icon} x={x + 100} y={y + h / 2} size={130} t={t} at={when + 0.15} />
      <Cap x={x + 190} y={y + h / 2 - 62} text={title} size={40} color="#fff" />
      <Cap x={x + 190} y={y + h / 2 + 2} text={sub} size={30} />
    </Rise>
  )
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE]])} title={{ kicker: 'CHỌN CÔNG CỤ', text: 'Khi nào dùng cái nào' }}>
      <Node t={t} when={at(c, 0, 0.1)} x={K.x} y={K.y} icon="cube" label="Kafka" size={190} />
      {['di chuyển?', 'kiểm tra hình dạng?', 'biến đổi?'].map((q, i) => (
        <Tag key={q} x={[560, 960, 1380][i]} y={810} text={q} size={32} color={INK.warn} o={vis(t, qAt[i], qOut)} />
      ))}
      {/* Connect */}
      {bigCard(100, 395, 640, 250, 'link', 'Kafka Connect', 'xe chở hàng: vào / ra Kafka', conn, t >= conn && t < at(c, 2, 0))}
      <Wire from={{ x: 744, y: 500 }} to={{ x: 855, y: 500 }} color={INK.good} p={move(t, conn + 0.3, 0.4)} flow={t} />
      <Wire from={{ x: 855, y: 560 }} to={{ x: 744, y: 560 }} color={INK.accent} p={move(t, conn + 0.5, 0.4)} flow={t} />
      <Packets t={t} from={{ x: 744, y: 500 }} to={{ x: 855, y: 500 }} start={conn + 0.9} every={0.45} len={0.7} size={20} color={INK.good} />
      <Packets t={t} from={{ x: 855, y: 560 }} to={{ x: 744, y: 560 }} start={conn + 1.1} every={0.45} len={0.7} size={20} />
      <Cap x={140} y={668} text="DB · file · SaaS ⇄ Kafka" size={32} o={vis(t, conn + 0.8)} />
      {/* Schema Registry */}
      <Rise t={t} at={reg}>
        <Card x={1010} y={165} w={760} h={150} border={t >= reg && t < str ? '2px solid #9fc2ff' : undefined} />
        <Cap x={1160} y={196} text="Schema Registry" size={38} color="#fff" />
        <Cap x={1160} y={248} text="tiêu chuẩn đóng gói" size={32} />
      </Rise>
      {t >= reg + 0.6 && t < str && (
        <div style={{ position: 'absolute', left: 1010, top: 165, width: 760, height: 150, boxSizing: 'border-box', borderRadius: 28, border: '3px solid #9fc2ff', opacity: 0.25 + 0.6 * Math.abs(Math.sin((t - reg) * 3)), boxShadow: '0 0 36px #9fc2ff' }} />
      )}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '1090px 240px', transform: `scale(${t >= reg + 0.6 && t < str ? 1 + 0.1 * Math.abs(Math.sin((t - reg) * 3)) : 1})` }}>
        <Icon3D name="shield" x={1090} y={240} size={120} t={t} at={reg + 0.15} />
      </div>
      <Wire from={{ x: 1010, y: 240 }} to={{ x: 975, y: 400 }} color={INK.accent} p={move(t, reg + 0.4, 0.4)} flow={t} />
      <Packets t={t} from={{ x: 1010, y: 240 }} to={{ x: 975, y: 400 }} start={reg + 1.0} every={0.6} len={0.7} size={20} />
      {/* Streams */}
      {bigCard(1180, 395, 640, 250, 'puzzle', 'Kafka Streams', 'đầu bếp: gom · đếm · join', str, t >= str && t < plain)}
      <Wire from={{ x: 1065, y: 500 }} to={{ x: 1176, y: 500 }} color={INK.good} p={move(t, str + 0.3, 0.4)} flow={t} />
      <Wire from={{ x: 1176, y: 560 }} to={{ x: 1065, y: 560 }} color={INK.accent} p={move(t, str + 0.5, 0.4)} flow={t} />
      <Packets t={t} from={{ x: 1065, y: 500 }} to={{ x: 1176, y: 500 }} start={str + 0.9} every={0.45} len={0.7} size={20} color={INK.good} />
      <Packets t={t} from={{ x: 1176, y: 560 }} to={{ x: 1065, y: 560 }} start={str + 1.1} every={0.45} len={0.7} size={20} />
      <Cap x={1200} y={668} text="state · changelog · exactly-once" size={32} o={vis(t, str + 0.8)} />
      {/* plain clients */}
      {bigCard(430, 770, 760, 200, 'tools', 'consumer + producer', 'logic đơn giản, gọi hệ thống ngoài', plain, t >= plain)}
      <Wire from={{ x: 960, y: 690 }} to={{ x: 960, y: 764 }} color={INK.accent} p={move(t, plain + 0.3, 0.4)} flow={t} />
      <Packets t={t} from={{ x: 960, y: 690 }} to={{ x: 960, y: 764 }} start={plain + 0.9} every={0.5} len={0.6} size={20} />
      <Wire from={{ x: 1194, y: 870 }} to={{ x: 1400, y: 870 }} color={INK.good} p={move(t, plain + 0.5, 0.4)} flow={t} />
      <Packets t={t} from={{ x: 1194, y: 870 }} to={{ x: 1400, y: 870 }} start={plain + 1.1} every={0.5} len={0.8} size={20} color={INK.good} />
      <Node t={t} when={plain + 0.5} x={1480} y={850} icon="mail" label="SMS · API" size={110} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 8. summary */

function summary(t: number, c: Cue) {
  return (
    <SoftTheme>
      <SummaryList t={t} cue={c} items={['Streams là thư viện trong app, không là cluster', 'KStream là sự kiện · KTable là giá trị mới nhất', 'State có changelog · đổi key thì repartition', 'exactly_once_v2 gói ba việc vào một transaction']} />
    </SoftTheme>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { library, scale, 'stream-table': streamTable, state, restore, repartition, eos, choose, summary }

/** Key-moment sounds, timed to the same cue offsets the scenes animate on. */
const SFX: Record<string, SceneSfx[]> = {
  library: [{ kind: 'error', at: (c) => at(c, 2, 0.6) }],
  scale: [{ kind: 'tick', at: (c) => at(c, 3, 0.25) }],
  'stream-table': [
    { kind: 'error', at: (c) => at(c, 2, 0.82) + 0.25 },
    { kind: 'ding', at: (c) => at(c, 3, 0.8) + 0.25 },
  ],
  state: [{ kind: 'ding', at: (c) => at(c, 3, 0.25) + 0.9 }],
  restore: [
    { kind: 'error', at: (c) => at(c, 0, 0.45) },
    { kind: 'ding', at: (c) => at(c, 2, 0.62) + 1.2 },
  ],
  repartition: [{ kind: 'tick', at: (c) => at(c, 2, 0.12) }],
  eos: [
    { kind: 'error', at: (c) => at(c, 1, 0.36) },
    { kind: 'ding', at: (c) => at(c, 3, 0.02) },
    { kind: 'error', at: (c) => at(c, 3, 0.62) },
  ],
  choose: [{ kind: 'tick', at: (c) => at(c, 3, 0.1) }],
}

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const kafkaStreamsLesson: Lesson = {
  ...kafkaStreamsScript,
  scenes: kafkaStreamsScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id], sfx: SFX[s.id] })),
  intro: [
    { kind: 'video', scenes: ['library'] },
    {
      kind: 'quiz',
      title: 'Quick Quiz',
      questions: [q('Đoán trước khi học: để chạy một ứng dụng Kafka Streams, bạn cần cài thêm gì ngoài cluster Kafka đã có?', ['Một cluster Streams riêng', 'Một server Streams gồm 3 node', 'Không cần cài gì, chỉ cần ứng dụng có thư viện Streams', 'Một database ngoài để lưu bộ đếm'], 2, 'Streams là một file .jar nằm trong ứng dụng của bạn. Trạng thái được lưu cục bộ và sao lưu vào topic Kafka.')],
    },
  ],
  roadmap: [
    'Chặng 1: Streams là thư viện trong ứng dụng, scale bằng instance, và hai cách nhìn dữ liệu: KStream và KTable.',
    'Chặng 2: Bộ đếm sống trong state store, changelog sao lưu nó, và instance mới dựng lại state khi instance cũ chết.',
    'Chặng 3: Đổi key thì repartition, exactly_once_v2 bọc ba việc vào một transaction, và khi nào chọn Connect, Streams hay client thường.',
  ],
  sections: [
    {
      id: 'thu-vien',
      title: 'Thư viện, task, KStream và KTable',
      blocks: [
        { kind: 'p', text: '**Vấn đề:** muốn đếm "mỗi sản phẩm đã bán bao nhiêu" theo thời gian thực từ topic `orders`. Tự viết consumer thì phải tự lo: lưu bộ đếm ở đâu, crash thì bộ đếm có mất không, nhiều instance chia bộ đếm thế nào, ghi kết quả và commit offset sao cho không đếm hai lần.' },
        { kind: 'callout', tone: 'warn', title: 'Điểm dễ nhầm nhất', text: 'Kafka Streams **không phải** một cluster riêng. Không có "server Streams" nào để cài. Nó là một file `.jar` nằm **bên trong ứng dụng của bạn**. (📘 sách, ch.14)' },
        {
          kind: 'list',
          items: [
            { title: 'Topology', text: 'chuỗi phép biến đổi khai báo bằng `StreamsBuilder` (`stream()`, `filter`, `map`, `groupByKey`, `count`, `to`…): một đồ thị có hướng không vòng. Mỗi nút là một **processor**; luôn bắt đầu bằng **source processor** (đọc topic) và kết thúc bằng **sink processor** (ghi topic).' },
            { title: 'Chạy thật', text: '`builder.build()` biến topology logic thành topology vật lý (chỗ Streams có thể tối ưu), rồi `new KafkaStreams(topology, props).start()` mới thật sự bắt đầu đọc, xử lý, ghi.' },
            { title: 'DSL và Processor API', text: 'DSL là API cấp cao. Muốn tự viết phép biến đổi riêng hoặc tự điều khiển timestamp thì dùng Processor API (cấp thấp).' },
            { title: 'application.id', text: 'bắt buộc, phải **duy nhất** cho mỗi app trên cùng cluster: vừa là tên consumer group để các instance phối hợp, vừa là tiền tố đặt tên state store và topic nội bộ.' },
          ],
        },
        { kind: 'video', scenes: ['scale'] },
        {
          kind: 'list',
          items: [
            { text: 'Muốn chạy nhanh hơn: chạy thêm instance với cùng `application.id`. Các instance tự chia partition như một consumer group.' },
            { text: 'Song song tối đa = **số partition của topic đầu vào** (mỗi partition thành một **task**).' },
            { text: 'Trong **một** instance cũng chạy được nhiều thread (`num.stream.threads`). Thứ tự hợp lý: thêm thread trước, hết tài nguyên máy thì thêm instance. Tổng số task vẫn do số partition quyết định. (📘 sách, ch.14)' },
          ],
        },
        { kind: 'video', scenes: ['stream-table'] },
        {
          kind: 'table',
          head: ['', 'KStream', 'KTable'],
          rows: [
            ['Mỗi tin nghĩa là', 'một **sự kiện** mới (thêm vào)', '**giá trị mới nhất** của key (ghi đè)'],
            ['Ví dụ', 'giao dịch: "A chuyển 100k", "A chuyển 50k"', 'số dư: "A có 850k"'],
            ['Hai tin cùng key', 'cả hai đều có nghĩa', 'tin sau thay tin trước'],
          ],
        },
        { kind: 'p', text: 'Ví dụ số: 3 tin key `A`: `+100`, `+50`, `-30`. Xem là KStream: 3 giao dịch. Gom (aggregate) theo key thành KTable: `A = 120`. Đọc nhầm topic giao dịch thành KTable: chỉ còn `A = -30`, sai hoàn toàn. (📘 sách, ch.14)' },
        {
          kind: 'list',
          items: [
            { text: 'Đổi qua lại được: aggregate biến stream thành table (còn gọi là **materialize**); mọi thay đổi của table lại là một stream, chính là **CDC**.' },
            { text: 'Topic nguồn của KTable hợp với **compaction** (Module 7), vì chỉ cần giá trị cuối của mỗi key.' },
            { text: 'Test topology bằng **`TopologyTestDriver`** (không cần broker thật), nhưng nó không mô phỏng cache của Streams nên vẫn cần integration test với broker thật, ví dụ Testcontainers. (📘 sách, ch.14)' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Topic user-profile (mỗi lần user sửa hồ sơ ghi một tin, key = user id). Nên đọc thành KStream hay KTable?', ['KStream, vì mỗi lần sửa là một sự kiện cần giữ', 'KTable, vì câu hỏi thường là "hồ sơ hiện tại thế nào", tin mới ghi đè tin cũ', 'Cả hai đều như nhau', 'Không đọc được'], 1, 'Mỗi tin là trạng thái mới nhất của hồ sơ một user.'),
            q('App Streams đọc topic 6 partition. Chạy 10 instance thì sao?', ['Cả 10 cùng xử lý, nhanh gấp 10', 'Chỉ 6 instance có task, 4 instance ngồi không (hoặc làm standby)', 'Streams tự thêm 4 partition', 'Lỗi khi khởi động'], 1, 'Mỗi partition là một task và một task chỉ chạy ở một instance, giống luật một partition một consumer trong group.'),
          ],
        },
      ],
    },
    {
      id: 'state-store',
      title: 'State store, changelog và khôi phục',
      blocks: [
        { kind: 'p', text: 'Đếm từ (WordCount) cần nhớ "kafka đã xuất hiện 4 lần". Streams lưu bộ nhớ đó trong **state store** cục bộ (mặc định **RocksDB**, một database nhúng trên đĩa của máy chạy app).' },
        { kind: 'video', scenes: ['state'] },
        {
          kind: 'code',
          code: `state store (RocksDB, cục bộ)            changelog topic (Kafka, compacted)
kafka = 1   ─────── ghi kèm ───────▶     [kafka:1]
kafka = 2   ───────────────────────▶     [kafka:1][kafka:2]
kafka = 3   ───────────────────────▶     [kafka:1][kafka:2][kafka:3]
                                          sau compaction: [kafka:3]`,
        },
        { kind: 'callout', tone: 'info', title: 'Vì sao changelog phải compact?', text: 'Changelog được tạo với `cleanup.policy=compact` **vì** khôi phục chỉ cần giá trị cuối của mỗi key: 1 triệu lần cập nhật cho 1.000 từ, sau compaction chỉ còn khoảng 1.000 tin phải đọc lại. Xoá theo thời gian thì từ không cập nhật 7 ngày sẽ mất khỏi changelog. Đây chính là compaction của Module 7 được dùng đúng chỗ.' },
        { kind: 'video', scenes: ['restore'] },
        {
          kind: 'list',
          items: [
            { text: 'Instance khác nhận task thì **đọc lại changelog** để dựng lại state store. Trong lúc đó phần dữ liệu của task **đứng yên**, kết quả bị cũ.' },
            { text: '`num.standby.replicas=1` giữ sẵn bản sao "nóng" ở instance khác để chuyển đổi nhanh.' },
            { text: 'Sách gợi ý compact "gắt" hơn cho topic nội bộ: giảm `min.compaction.lag.ms` và kích thước segment (ví dụ 100 MB thay vì 1 GB), vì segment active không bao giờ được compact. (📘 sách, ch.14)' },
          ],
        },
        { kind: 'callout', tone: 'tip', title: '🎓 Nâng cao', text: '**Interactive queries**: ứng dụng khác có thể hỏi thẳng state store của app Streams (ví dụ "top 10 sách bán chạy" nằm sẵn trong KTable) thay vì đọc topic kết quả. **Sửa logic rồi xử lý lại từ đầu**: ưu tiên chạy bản mới như một app mới (`application.id` mới) đọc từ offset đầu, chạy song song bản cũ, bắt kịp thì chuyển nơi đọc. (📘 sách, ch.14)' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Vì sao changelog topic phải là compacted thay vì retention 7 ngày?', ['Để tiết kiệm đĩa hơn', 'Vì xoá theo thời gian sẽ làm mất giá trị của key lâu không cập nhật, khôi phục xong bộ đếm của nó về 0', 'Vì broker yêu cầu', 'Vì compaction nhanh hơn'], 1, 'Compaction giữ giá trị cuối của mọi key mãi mãi mà vẫn bỏ các bản cũ.'),
            q('Instance giữ task chết, không có standby. Chuyện gì xảy ra với task đó?', ['Mất bộ đếm vĩnh viễn', 'Instance khác đọc lại changelog dựng state, trong lúc đó task đứng yên', 'Bộ đếm về 0 và đếm lại', 'Cả app dừng'], 1, 'Changelog nằm trong Kafka nên không mất; thời gian đứng yên tỉ lệ với số tin phải đọc lại.'),
          ],
        },
      ],
    },
    {
      id: 'repartition-eos',
      title: 'Repartition và exactly_once_v2',
      blocks: [
        { kind: 'video', scenes: ['repartition'] },
        {
          kind: 'code',
          code: `input (theo câu) ──split──▶ key = từ ──▶ [repartition topic] ──▶ đếm (state store) ──▶ output`,
        },
        {
          kind: 'list',
          items: [
            { text: 'Muốn đếm theo **từ** thì mọi lần xuất hiện của `kafka` phải về **cùng một task**, nhưng câu chứa `kafka` nằm rải rác khắp các partition. Streams ghi lại với key mới vào **repartition topic** nội bộ để `hash(key)` đưa cùng một từ vào cùng partition (Module 2).' },
            { text: 'Tên topic nội bộ bắt đầu bằng `application.id`, ví dụ `streams-wordcount-KSTREAM-AGGREGATE-STATE-STORE-0000000003-repartition` và `...-changelog`.' },
            { text: 'Repartition topic **cắt topology thành hai sub-topology**, mỗi nửa có bộ task riêng, tính theo partition của topic mà nửa đó đọc. (📘 sách, ch.14)' },
            { text: 'Streams chủ động xoá dữ liệu đã xử lý khỏi repartition topic, nên thường gần như rỗng dù `retention.ms=-1`.' },
          ],
        },
        { kind: 'callout', tone: 'info', title: 'Join cần co-partitioned', text: 'Join theo key đòi hai topic **cùng số partition** và **cùng chia theo key join**, để partition N của hai bên về cùng một task. `clicks` 6 partition, `user-profile` 4 partition thì phải repartition một bên trước. Join stream–stream luôn cần cửa sổ thời gian. (📘 sách, ch.14)' },
        { kind: 'video', scenes: ['eos'] },
        {
          kind: 'table',
          head: ['', 'at_least_once (mặc định)', 'exactly_once_v2'],
          rows: [
            ['Ba việc: output, changelog, commit', 'ghi rời nhau', 'gói trong **một transaction** (Module 6)'],
            ['Crash ở giữa rồi chạy lại', 'có thể đếm lặp', 'huỷ cả ba, chạy lại sạch'],
            ['Consumer `read_committed`', 'có thể thấy kết quả lặp', 'không thấy kết quả của lần chạy dở'],
          ],
        },
        { kind: 'callout', tone: 'warn', title: 'Chỉ trong phạm vi Kafka → Kafka', text: 'Gửi SMS hay gọi API ngoài trong hàm xử lý vẫn có thể lặp, vì chúng không thuộc transaction. Muốn chống trùng phải làm idempotent phía ngoài (Module 10). `exactly_once_v2` cần broker 2.5 trở lên; giá trị cũ `exactly_once` deprecated từ 3.0 và bị loại ở 4.0.' },
        {
          kind: 'list',
          items: [
            { title: 'Event time', text: 'lúc sự việc xảy ra; thường là thời gian đúng để tính. Nên dùng cho cửa sổ.' },
            { title: 'Processing time', text: 'lúc app đọc tin; mỗi lần đọc ra một giá trị khác, nên tránh.' },
            { title: 'Cửa sổ', text: '**tumbling** (cố định, không chồng), **hopping** (cố định, chồng lên nhau), **session** (đóng khi lặng quá "gap"). **Grace period** là khoảng cửa sổ còn nhận tin muộn; tin muộn trong grace làm Streams ghi kết quả mới thay kết quả cũ. (📘 sách, ch.14)' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('WordCount đọc topic câu văn không có key. Vì sao bắt buộc có repartition topic trước khi đếm?', ['Để nén dữ liệu', 'Vì cùng một từ nằm ở nhiều partition, mỗi task chỉ đếm được một phần nếu không gom về cùng partition theo key = từ', 'Vì state store cần topic riêng', 'Vì exactly_once_v2 yêu cầu'], 1, 'Không gom theo key thì kết quả bị chia mảnh giữa các task.'),
            q('Bật exactly_once_v2, hàm xử lý gọi API gửi SMS. Có thể gửi trùng không?', ['Không, vì đã exactly-once', 'Có, vì transaction chỉ bao các lần ghi vào Kafka và commit offset', 'Chỉ khi broker lỗi', 'Chỉ khi có nhiều instance'], 1, 'Crash sau khi gửi SMS mà trước khi commit thì lần chạy lại gửi lần nữa.'),
          ],
        },
      ],
    },
    {
      id: 'khi-nao-dung',
      title: 'Khi nào dùng cái nào',
      blocks: [
        { kind: 'video', scenes: ['choose'] },
        {
          kind: 'table',
          head: ['Nhu cầu', 'Công cụ', 'Lý do'],
          rows: [
            ['Đưa dữ liệu DB/file/SaaS vào Kafka, hoặc Kafka ra kho dữ liệu', '**Kafka Connect**', 'có sẵn connector, offset, retry, scale; không viết code'],
            ['Producer và consumer hiểu nhau khi schema đổi', '**Schema Registry** (+ Avro/Protobuf)', 'chặn breaking change trước khi vào topic'],
            ['Lọc, đổi tên trường, che dữ liệu nhạy cảm từng tin', '**SMT** trong Connect', 'nhẹ, không cần app riêng'],
            ['Gom nhóm, đếm, join, cửa sổ, trạng thái', '**Kafka Streams**', 'state store + changelog + exactly-once có sẵn'],
            ['Logic đơn giản, gọi nhiều hệ thống ngoài', '**Consumer/producer thường**', 'Streams không giúp được side effect bên ngoài'],
          ],
        },
        {
          kind: 'list',
          items: [
            { text: 'Cần **trả lời ngay trong vài mili giây** cho người đang chờ: thường hợp với request-response (REST, gRPC) hơn là xử lý luồng. (📘 sách, ch.14)' },
            { text: 'Chỉ là **chép dữ liệu** giữa hai hệ thống: nghĩ đến Kafka Connect trước khi nghĩ đến framework xử lý luồng. (📘 sách, ch.14)' },
            { text: 'Ngoài Apache Kafka nên biết tên: **Apache Flink** (cluster xử lý luồng, mạnh khi state rất lớn hoặc nhiều nguồn ngoài Kafka) và **ksqlDB** (truy vấn kiểu SQL trên Kafka Streams, Confluent Community License).' },
          ],
        },
        { kind: 'callout', tone: 'tip', title: 'Hình ảnh nhà hàng', text: 'Connect là **xe chở hàng** từ chợ về bếp và từ bếp đi giao. Schema Registry là **tiêu chuẩn đóng gói**. Streams là **đầu bếp**. Đừng bắt xe chở hàng nấu ăn (SMT làm join), cũng đừng bắt đầu bếp đi chợ (Streams tự viết code đọc database).' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Nhóm định viết app Kafka Streams chỉ để đọc bảng MySQL rồi ghi vào Kafka. Góp ý?', ['Làm đúng rồi', 'Dùng Kafka Connect (source connector), vì chỉ là chép dữ liệu, có sẵn offset và retry', 'Dùng Flink', 'Dùng SMT'], 1, 'Streams không phải công cụ ingest.'),
            q('Cần "doanh thu mỗi cửa hàng trong 5 phút gần nhất" từ topic orders. Dùng SMT được không?', ['Được, SMT gom nhóm', 'Không, SMT chỉ xử lý từng tin độc lập; gom theo key và cửa sổ cần state, tức Kafka Streams', 'Được nếu bật DLQ', 'Không cần công cụ nào'], 1, 'SMT là biến đổi từng tin, không có trạng thái.'),
          ],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: task, khôi phục, crash và co-partitioning',
      blocks: [
        { kind: 'p', text: 'Chỉnh số partition và instance để xem task được chia ra sao, bật standby và compaction để xem thời gian khôi phục state, chọn điểm crash để so at_least_once với exactly_once_v2, và thử join hai topic khác số partition.' },
        { kind: 'widget', name: 'streams-lab' },
      ],
    },
    {
      id: 'tom-tat-video',
      title: 'Nhìn lại cả bài',
      blocks: [{ kind: 'video', scenes: ['summary'] }],
    },
  ],
  finalQuiz: [
    q('Cần cài gì để chạy Kafka Streams?', ['Một cluster Streams', 'Chỉ thư viện trong ứng dụng, cùng cluster Kafka có sẵn', 'Một database RocksDB riêng', 'ZooKeeper'], 1, 'Streams là thư viện, không có server riêng.'),
    q('Ba tin key A: +100, +50, -30. Gom theo key thành KTable cho kết quả?', ['A = -30', 'A = 120', 'A = 150', 'Ba dòng'], 1, 'Đọc thẳng thành KTable mới ra -30; gom (aggregate) mới ra 120.'),
    q('Đổi key trước khi đếm thì Streams làm gì?', ['Không làm gì', 'Ghi lại vào repartition topic để cùng key về cùng partition', 'Xoá state store', 'Tạo thêm cluster'], 1, 'Cái giá là thêm một lượt ghi và đọc qua Kafka.'),
    q('exactly_once_v2 bao những việc nào trong một transaction?', ['Chỉ ghi output', 'Ghi output, ghi changelog và commit offset đầu vào', 'Cả gọi API ngoài', 'Chỉ commit offset'], 1, 'Việc gọi ra ngoài (SMS, API) không thuộc transaction.'),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao instance mới có thể dựng lại bộ đếm khi instance cũ chết, và vì sao changelog phải compact?',
      keywords: ['changelog', 'compact', 'đọc lại', 'giá trị'],
      modelAnswer: 'Vì mỗi lần state store đổi, Streams ghi thêm một tin vào changelog topic trong Kafka, nên bản sao của state vẫn còn dù máy chết. Instance mới đọc lại changelog và áp từng tin để dựng lại state store. Changelog phải compact vì khôi phục chỉ cần giá trị cuối của mỗi key; compact giữ giá trị cuối mãi mãi mà bỏ các bản cũ, nên vừa đủ vừa ít tin phải đọc lại.',
    },
  ],
  recap: {
    journey:
      'Đếm theo thời gian thực từ topic → Kafka Streams là thư viện trong ứng dụng, không phải cluster → scale bằng instance, giới hạn bởi số partition → KStream là sự kiện, KTable là giá trị mới nhất → bộ đếm nằm trong state store, sao lưu vào changelog compacted → instance khác đọc lại changelog để dựng lại state → đổi key thì repartition → exactly_once_v2 bọc ghi, changelog, commit vào một transaction → chọn Connect để di chuyển, Streams để biến đổi, client thường cho logic đơn giản.',
    points: [
      { title: 'Thư viện', text: 'Streams nằm trong ứng dụng; song song tối đa bằng số partition đầu vào.' },
      { title: 'Stream và table', text: 'KStream = chuyện gì đã xảy ra; KTable = hiện giờ là gì; aggregate đổi stream thành table.' },
      { title: 'State', text: 'State store cục bộ + changelog compacted để khôi phục; đổi key thì repartition; standby để chuyển nhanh.' },
      { title: 'Exactly-once', text: 'exactly_once_v2 chỉ trong phạm vi Kafka → Kafka; gọi ra ngoài vẫn phải idempotent.' },
    ],
    next: 'Bài tiếp theo: Giám sát: lag, sức khoẻ cluster, độ trễ (Module 9).',
  },
}
