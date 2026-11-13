import type { CSSProperties, ReactNode } from 'react'
import { cameraAt, clamp, lerp, move, sp, span, vis } from '../player/motion-kit'
import { HERO, Icon3D, Packets, Rise, SOFT, SoftScene, SoftTheme, SummaryList, Wire } from '../player/schematic'
import type { Icon3DName } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene, SceneSfx } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { kafkaConnectScript } from './kafka-connect-script'

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

/** A solid rounded block with centred text (task, step, status). `ghost` = empty slot. */
function Chip({ x, y, w, h = 60, label, tone = 'blue', size = 30, o = 1, ghost = false, mono = false, glow = true }: { x: number; y: number; w: number; h?: number; label: string; tone?: Tone; size?: number; o?: number; ghost?: boolean; mono?: boolean; glow?: boolean }) {
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
        color: ghost ? INK.faint : TONE_INK[tone],
        background: ghost ? 'rgba(12,30,96,0.45)' : TONE_BG[tone],
        border: ghost ? '2px dashed rgba(110,160,255,0.5)' : 'none',
        boxShadow: ghost ? undefined : glow ? `inset 0 2px 0 rgba(255,255,255,0.5), 0 0 22px ${TONE_LINE[tone]}77, 0 10px 20px rgba(0,8,50,0.45)` : 'inset 0 2px 0 rgba(255,255,255,0.5)',
      }}
    >
      {label}
    </div>
  )
}

/** Dark glowing pill centred on (x, y): configuration values, captions, verdicts. */
function Tag({ x, y, text, color = INK.accent, size = 28, o = 1, mono = false }: { x: number; y: number; text: string; color?: string; size?: number; o?: number; mono?: boolean }) {
  const k = clamp(o)
  if (k <= 0) return null
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${0.94 + 0.06 * k})`, padding: '10px 24px', borderRadius: 999, background: 'rgba(8,22,82,0.92)', border: `1.5px solid ${color}`, boxShadow: `0 0 20px ${color}99, inset 0 1px 0 rgba(255,255,255,0.15)`, fontFamily: mono ? MONO : undefined, fontSize: Math.max(size, 30), fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap', opacity: k }}>
      {text}
    </div>
  )
}

/** Big centred statement line. */
function Say({ y, text, color = INK.text, size = 48, o = 1 }: { y: number; text: string; color?: string; size?: number; o?: number }) {
  const k = clamp(o)
  if (k <= 0) return null
  return (
    <div style={{ position: 'absolute', left: 0, width: 1920, top: y - size * 0.6, textAlign: 'center', fontSize: size, fontWeight: 800, letterSpacing: -0.5, color, whiteSpace: 'nowrap', opacity: k, filter: k < 0.98 ? `blur(${(1 - k) * 2}px)` : undefined, transform: `translateY(${(1 - k) * 10}px)` }}>
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

/** Small text anchored at the top-left of a card (absolute inside the card). */
const Cap = ({ x, y, text, size = 28, color = INK.faint, bold = true, mono = false }: { x: number; y: number; text: string; size?: number; color?: string; bold?: boolean; mono?: boolean }) => (
  <div style={{ position: 'absolute', left: x, top: y, fontSize: Math.max(size, 28), fontWeight: bold ? 800 : 600, color, whiteSpace: 'nowrap', fontFamily: mono ? MONO : undefined }}>{text}</div>
)

/** 3D icon with a caption underneath. */
function Node({ t, when, x, y, icon, label, size = 150, dim = false }: { t: number; when: number; x: number; y: number; icon: Icon3DName; label: string; size?: number; dim?: boolean }) {
  return (
    <>
      <Icon3D name={icon} x={x} y={y} size={size} t={t} at={when} dim={dim} />
      <div style={{ position: 'absolute', left: x - 170, width: 340, textAlign: 'center', top: y + size / 2 + 22, fontSize: 32, fontWeight: 800, color: dim ? INK.faint : INK.text, opacity: vis(t, when + 0.2) }}>{label}</div>
    </>
  )
}

type Cell = { label?: string; tone?: Tone; at: number; gone?: number }

/** A tape of equal cells. Cells pop in at `at` and leave (become empty) at `gone`. */
function Cells({ t, x, y, cw, n, cells, title, o = 1 }: { t: number; x: number; y: number; cw: number; n: number; cells: Record<number, Cell>; title?: string; o?: number }) {
  return (
    <div style={{ opacity: clamp(o) }}>
      {title && <div style={{ position: 'absolute', left: x, top: y - 52, fontSize: 28, fontWeight: 800, color: INK.faint, whiteSpace: 'nowrap' }}>{title}</div>}
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ position: 'absolute', left: x + i * cw, top: y, width: cw, height: 70, padding: '0 3px', boxSizing: 'border-box' }}>
          <div style={{ height: '100%', borderRadius: 14, background: INK.cell.empty, border: '1.5px solid rgba(110,160,255,0.35)' }} />
        </div>
      ))}
      {Object.entries(cells).map(([i, s]) => {
        const k = sp(t, s.at, 14, 140)
        if (k <= 0 || (s.gone !== undefined && t >= s.gone)) return null
        const tone = s.tone ?? 'blue'
        return (
          <div key={i} style={{ position: 'absolute', left: x + Number(i) * cw, top: y, width: cw, height: 70, padding: '0 3px', boxSizing: 'border-box', opacity: clamp(k * 1.6), transform: `scale(${0.85 + 0.15 * k})` }}>
            <div style={{ height: '100%', borderRadius: 14, background: TONE_BG[tone], display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 800, color: TONE_INK[tone], boxShadow: `inset 0 2px 0 rgba(255,255,255,0.5), 0 0 16px ${TONE_LINE[tone]}66, 0 10px 20px rgba(0,8,50,0.45)` }}>{s.label}</div>
          </div>
        )
      })}
    </div>
  )
}

/** One cell flying from → to; fades in at the start and out at the end so it never rests on a card. */
function Flyer({ t, from, to, start, len = 0.7, label, tone = 'blue', size = 60, lift = 0 }: { t: number; from: { x: number; y: number }; to: { x: number; y: number }; start: number; len?: number; label?: string; tone?: Tone; size?: number; lift?: number }) {
  const p = (t - start) / len
  if (p < 0 || p >= 1) return null
  const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2
  return (
    <div style={{ position: 'absolute', left: lerp(from.x, to.x, e) - size / 2, top: lerp(from.y, to.y, e) - size / 2 - lift * clamp(Math.sin(Math.PI * e) * 1.6), width: size, height: size, borderRadius: 14, background: TONE_BG[tone], display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 800, color: TONE_INK[tone], opacity: Math.min(1, p * 8, (1 - p) * 6), boxShadow: `0 0 20px ${TONE_LINE[tone]}, inset 0 2px 0 rgba(255,255,255,0.5)` }}>
      {label}
    </div>
  )
}

/** A worker process: card with a name, LED and room for task chips (drawn by the caller). */
function WorkerBox({ x, y, w, h, name, down = false, o = 1, note }: { x: number; y: number; w: number; h: number; name: string; down?: boolean; o?: number; note?: string }) {
  return (
    <Card x={x} y={y} w={w} h={h} o={o} border={down ? `2px solid ${INK.bad}` : '2px solid rgba(110,160,255,0.85)'}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 22, background: down ? 'rgba(60,10,30,0.4)' : undefined }} />
      <div style={{ position: 'absolute', left: 26, top: 22, display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ width: 16, height: 16, borderRadius: 8, background: down ? INK.bad : INK.good, boxShadow: down ? undefined : `0 0 12px ${INK.good}` }} />
        <span style={{ fontSize: 34, fontWeight: 800, color: down ? INK.bad : '#ffffff', whiteSpace: 'nowrap' }}>{name}</span>
        {note && <span style={{ fontSize: 28, fontWeight: 700, color: down ? INK.bad : INK.faint, whiteSpace: 'nowrap' }}>{note}</span>}
      </div>
    </Card>
  )
}

/** Dashed glowing frame (a system boundary) with a title tab. */
function Frame({ x, y, w, h, label, o }: { x: number; y: number; w: number; h: number; label: string; o: number }) {
  if (o <= 0) return null
  return (
    <div style={{ opacity: clamp(o) }}>
      <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, boxSizing: 'border-box', borderRadius: 40, border: '3px dashed rgba(120,170,255,0.75)', background: 'rgba(28,58,160,0.12)', boxShadow: '0 0 40px rgba(61,123,255,0.35), inset 0 0 60px rgba(61,123,255,0.12)' }} />
      <Chip x={x + 40} y={y - 34} w={340} h={68} label={label} size={36} />
    </div>
  )
}

/* ------------------------------------------------------------------ 0. cold open: three programs, three rewrites */

function hook(t: number, c: Cue) {
  const [a1, a3] = [c.at(1), c.at(3)]
  const T = { db: 0.3, tape: at(c, 0, 0.3), es: at(c, 0, 0.68), s3: at(c, 0, 0.86) }
  const ON = { tape: 0.6, es: 0.45, s3: 0.6 }
  const chipAt = at(c, 1, 0.05)
  const pillAt = [at(c, 1, 0.45), at(c, 1, 0.65), at(c, 1, 0.85)]
  const badAt = at(c, 2, 0.15)
  const sayAt = at(c, 2, 0.5)
  const frameAt = at(c, 3, 0.1)
  const cy = 520
  const tapeX = 640
  const es = { x: 1680, y: 360 }
  const s3 = { x: 1680, y: 680 }
  const wires = [
    { from: { x: 330, y: cy }, to: { x: tapeX - 10, y: cy }, at: T.tape - 0.2, mid: { x: 480, y: cy } },
    { from: { x: tapeX + 510, y: cy }, to: { x: es.x - 100, y: es.y + 20 }, at: T.es - 0.1, mid: { x: 1330, y: 425 } },
    { from: { x: tapeX + 510, y: cy }, to: { x: s3.x - 100, y: s3.y - 20 }, at: T.s3 - 0.1, mid: { x: 1330, y: 620 } },
  ]
  const gone = 1 - span(t, a3, a3 + 0.4)
  const bad = t >= badAt
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 560, s: 1.05 }, 1.2], [a3, WIDE, 1.2]])}>
      <Node t={t} when={T.db} x={230} y={cy} icon="notebook" label="PostgreSQL" size={190} />
      <Cells t={t} x={tapeX} y={cy - 35} cw={85} n={6} title="topic orders" o={vis(t, ON.tape)} cells={Object.fromEntries(Array.from({ length: 6 }, (_, i) => [i, { label: String(i + 1), at: T.tape + 0.5 + i * 0.7 }]))} />
      <Node t={t} when={ON.es} x={es.x} y={es.y} icon="zoom" label="Elasticsearch" size={170} dim={t < T.es} />
      <Node t={t} when={ON.s3} x={s3.x} y={s3.y} icon="folder" label="S3" size={170} dim={t < T.s3} />
      {wires.map((w, i) => (
        <div key={i}>
          <Wire from={w.from} to={w.to} color={INK.line} p={move(t, w.at, 0.5)} flow={t} />
          <Packets t={t} from={w.from} to={w.to} start={w.at + 0.7} every={0.7} len={1.0} size={20} />
        </div>
      ))}
      {wires.map((w, i) => (
        <Rise key={i} t={t} at={chipAt + i * 0.14}>
          <div style={{ opacity: gone }}>
            <Chip x={w.mid.x - 120} y={w.mid.y - 36} w={240} h={72} label="code tự viết" size={32} tone={bad ? 'bad' : 'blue'} />
          </div>
        </Rise>
      ))}
      {['offset', 'retry', 'chạy song song'].map((label, i) => (
        <div key={label} style={{ opacity: gone }}>
          <Tag x={[640, 960, 1330][i]} y={830} text={label} size={34} color={bad ? INK.bad : INK.warn} o={vis(t, pillAt[i])} />
        </div>
      ))}
      <Say y={200} text="3 hệ thống → viết lại 3 lần" color={INK.bad} size={54} o={Math.min(sp(t, sayAt), gone)} />
      <Frame x={70} y={270} w={1780} h={610} label="Kafka Connect" o={vis(t, frameAt, Infinity, 0.5)} />
      <Tag x={700} y={810} text="connector.class = JdbcSource" mono size={32} color={INK.good} o={vis(t, at(c, 3, 0.3), Infinity, 0.25)} />
      <Tag x={1250} y={810} text="tasks.max = 3" mono size={32} color={INK.good} o={vis(t, at(c, 3, 0.45), Infinity, 0.25)} />
      <Say y={200} text="chỉ viết cấu hình, khung lo phần còn lại" color={INK.good} size={50} o={sp(t, at(c, 3, 0.55))} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 1. source and sink */

function sourceSink(t: number, c: Cue) {
  const [a1, a3] = [c.at(1), c.at(3)]
  const LANE = 590
  const T = { db: 1.9, src: 2.2, tape: 2.5, pk: 2.9 }
  const SRC = { x: 380, y: 440, w: 240, h: 300 }
  const SNK = { x: 1260, y: 440, w: 240, h: 300 }
  const tapeX = 700
  const sink = { block: at(c, 1, 0.08), es: at(c, 1, 0.3), s3: at(c, 1, 0.5) }
  const es = { x: 1710, y: 470 }
  const s3 = { x: 1710, y: 720 }
  const block = (b: typeof SRC, label: string, when: number, names: string[]) => (
    <Rise t={t} at={when}>
      <Card x={b.x} y={b.y} w={b.w} h={b.h}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 14, textAlign: 'center', fontSize: 30, fontWeight: 800, color: '#fff' }}>{label}</div>
      </Card>
      {names.map((n, i) => (
        <Chip key={n} x={b.x + 45} y={i === 0 ? b.y + 60 : b.y + b.h - 110} w={150} h={60} label={n} />
      ))}
    </Rise>
  )
  const cells = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [i, { label: String(i + 1), at: T.pk + 0.5 + i * 0.7 }]))
  const plug = [at(c, 2, 0.05), at(c, 2, 0.25)]
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 1000, y: 560, s: 1.05 }, 1.2], [a3, WIDE, 1.2]])} title={{ kicker: 'KAFKA CONNECT', text: 'Source và sink' }}>
      <Node t={t} when={T.db} x={225} y={LANE} icon="notebook" label="PostgreSQL" />
      <Wire from={{ x: 300, y: LANE }} to={{ x: SRC.x - 6, y: LANE }} color={INK.line} p={move(t, T.src, 0.4)} flow={t} />
      <Packets t={t} from={{ x: 300, y: LANE }} to={{ x: SRC.x + 30, y: LANE }} start={T.pk} every={0.7} len={0.8} size={20} />
      {block(SRC, 'source', T.src, ['task 0', 'task 1'])}
      <Wire from={{ x: SRC.x + SRC.w + 4, y: LANE }} to={{ x: tapeX - 8, y: LANE }} color={INK.line} p={move(t, T.tape, 0.4)} flow={t} />
      <Packets t={t} from={{ x: SRC.x + SRC.w - 30, y: LANE }} to={{ x: tapeX + 30, y: LANE }} start={T.pk + 0.2} every={0.7} len={0.8} size={20} />
      <Cells t={t} x={tapeX} y={LANE - 35} cw={85} n={6} title="topic orders" o={vis(t, T.tape)} cells={cells} />
      <Wire from={{ x: tapeX + 514, y: LANE }} to={{ x: SNK.x - 6, y: LANE }} color={INK.line} p={move(t, sink.block, 0.4)} flow={t} />
      <Packets t={t} from={{ x: tapeX + 514, y: LANE }} to={{ x: SNK.x + 30, y: LANE }} start={sink.block + 0.5} every={0.7} len={0.8} size={20} />
      {block(SNK, 'sink', sink.block, ['task 0', 'task 1'])}
      {[
        { n: es, icon: 'zoom' as const, label: 'Elasticsearch', when: sink.es, y0: es.y + 10 },
        { n: s3, icon: 'folder' as const, label: 'S3', when: sink.s3, y0: s3.y - 10 },
      ].map((e) => (
        <div key={e.label}>
          <Wire from={{ x: SNK.x + SNK.w + 4, y: LANE }} to={{ x: e.n.x - 90, y: e.y0 }} color={INK.line} p={move(t, e.when - 0.2, 0.4)} flow={t} />
          <Packets t={t} from={{ x: SNK.x + SNK.w - 30, y: LANE }} to={{ x: e.n.x - 95, y: e.y0 }} start={e.when + 0.4} every={0.9} len={0.9} size={20} />
          <Node t={t} when={e.when} x={e.n.x} y={e.n.y} icon={e.icon} label={e.label} size={140} />
        </div>
      ))}
      {[SRC, SNK].map((b, i) => (
        <div key={i}>
          <Icon3D name="puzzle" x={b.x + b.w / 2 - 40} y={b.y - 70} size={96} t={t} at={plug[i]} />
          <Tag x={b.x + b.w / 2 + 70} y={b.y - 70} text="plugin" size={28} o={vis(t, plug[i] + 0.2)} />
          <Tag x={b.x + b.w / 2} y={b.y + b.h + 52} text="tasks.max = 2" mono size={32} color={INK.good} o={vis(t, at(c, 2, 0.5 + i * 0.2))} />
        </div>
      ))}
      <Say y={905} text="Connect = ống nước để di chuyển dữ liệu" size={48} o={sp(t, at(c, 3, 0.08))} />
      <Tag x={960} y={990} text="✕  logic nghiệp vụ" size={32} color={INK.bad} o={vis(t, at(c, 3, 0.5))} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 2. worker, connector, task */

function roles(t: number, c: Cue) {
  const [a2, a3] = [c.at(2), c.at(3)]
  const SX = (i: number) => 200 + i * 190
  const pill = [at(c, 0, 0.6), at(c, 0, 0.76), at(c, 0, 0.9)]
  const box = { x: 160, y: 450, w: 1600, h: 300 }
  const conn = at(c, 1, 0.1)
  const slots = at(c, 2, 0.05)
  const taskAt = [at(c, 2, 0.3), at(c, 2, 0.5), at(c, 2, 0.7)]
  const tables = ['orders', 'users', 'items']
  const tb = at(c, 3, 0.4)
  const hot = t > tb + 1.4 ? Math.floor((t - tb - 1.4) / 0.6) % 3 : -1
  const beat = (i: number) => (hot === i ? 1.1 : 1)
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, { x: 960, y: 560, s: 1.03 }], [a2, { x: 960, y: 580, s: 1.06 }, 1.2], [a3, { x: 960, y: 570, s: 1.03 }, 1.2]])} title={{ kicker: 'KAFKA CONNECT', text: 'Worker, connector, task' }}>
      <Rise t={t} at={c.at(0) + 1.9}>
        <WorkerBox x={box.x} y={box.y} w={box.w} h={box.h} name="worker-1" note="· tiến trình Java" />
      </Rise>
      {['REST API', 'lưu cấu hình', 'khởi động task'].map((l, i) => (
        <Tag key={l} x={[790, 1090, 1420][i]} y={492} text={l} size={30} o={vis(t, pill[i])} />
      ))}
      <Rise t={t} at={conn}>
        <Card x={540} y={290} w={840} h={100} border={`2px solid ${INK.accent}`}>
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 38, fontWeight: 800, color: '#fff' }}>connector · đồng bộ bảng orders</div>
        </Card>
      </Rise>
      <Wire from={{ x: 960, y: 392 }} to={{ x: 960, y: box.y - 4 }} color={INK.accent} p={move(t, conn + 0.4, 0.4)} flow={t} />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} style={{ opacity: vis(t, slots, Infinity, 0.5) }}>
          <Chip x={SX(i)} y={590} w={170} h={80} label={t >= at(c, 3, 0.72) && i >= 3 ? 'trống' : `slot ${i}`} ghost size={30} />
        </div>
      ))}
      {tables.map((_, i) => (
        <Rise key={i} t={t} at={taskAt[i]}>
          <div style={{ transform: `scale(${beat(i)})`, transformOrigin: `${SX(i) + 85}px 630px`, transition: 'none' }}>
            <Chip x={SX(i)} y={590} w={170} h={80} label={`task ${i}`} />
          </div>
          <div style={{ position: 'absolute', left: SX(i) + 14, top: 656, width: 142, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.3)' }}>
            <div style={{ width: `${((t * 0.9 + i * 0.3) % 1) * 100}%`, height: '100%', borderRadius: 3, background: '#fff' }} />
          </div>
        </Rise>
      ))}
      <Icon3D name="notebook" x={115} y={862} size={100} t={t} at={tb - 0.2} />
      {tables.map((nm, i) => (
        <div key={nm}>
          <Rise t={t} at={tb + i * 0.18}>
            <div style={{ transform: `scale(${beat(i)})`, transformOrigin: `${SX(i) + 85}px 862px` }}>
              <Chip x={SX(i)} y={830} w={170} h={64} label={nm} tone="warn" />
            </div>
          </Rise>
          <Packets t={t} from={{ x: SX(i) + 85, y: 825 }} to={{ x: SX(i) + 85, y: 692 }} start={tb + 0.9 + i * 0.1} every={0.8} len={0.8} size={20} />
        </div>
      ))}
      <Tag x={1300} y={850} text="min( tasks.max , số bảng )" mono size={32} o={vis(t, at(c, 3, 0.08))} />
      <Tag x={1300} y={960} text="min(8, 3) = 3 task" size={40} color={INK.good} o={vis(t, at(c, 3, 0.84))} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 3. standalone vs distributed */

function modes(t: number, c: Cue) {
  const [a1, a2, a3] = [c.at(1), c.at(2), c.at(3)]
  // --- standalone (beat 0)
  const dieAt = at(c, 0, 0.84)
  const s0 = 1 - span(t, a1 - 0.1, a1 + 0.3)
  const dead0 = t >= dieAt
  // --- distributed
  const WX = [130, 700, 1270]
  const WY = 380
  const W = 520
  const wk = [a1 + 0.35, a1 + 1.0, a1 + 1.65]
  const killAt = at(c, 3, 0.25)
  const moveAt = at(c, 3, 0.68)
  const tasks = [
    { w: 0, i: 0, to: null as null | { w: number; i: number } },
    { w: 0, i: 1, to: null },
    { w: 1, i: 0, to: { w: 0, i: 2 } },
    { w: 1, i: 1, to: { w: 2, i: 2 } },
    { w: 2, i: 0, to: null },
    { w: 2, i: 1, to: null },
  ]
  const pos = (w: number, i: number) => ({ x: WX[w] + 30 + i * 160, y: WY + 150 })
  const topics = ['config.storage.topic', 'offset.storage.topic', 'status.storage.topic']
  const topAt = [at(c, 2, 0.08), at(c, 2, 0.22), at(c, 2, 0.36)]
  const pk = at(c, 2, 0.5)
  const hbDown = t >= killAt
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 560, s: 1.04 }, 1.4], [a3, WIDE, 1.2]])} title={{ kicker: 'KAFKA CONNECT', text: 'Standalone và distributed' }}>
      {/* standalone */}
      <div style={{ opacity: s0 }}>
        <Rise t={t} at={at(c, 0, 0.3)}>
          <WorkerBox x={560} y={430} w={800} h={290} name="worker" note="· standalone" down={dead0} />
        </Rise>
        {[0, 1, 2].map((i) => (
          <Rise key={i} t={t} at={at(c, 0, 0.4 + i * 0.07)}>
            <Chip x={620 + i * 210} y={580} w={180} h={64} label={`task ${i}`} tone="blue" o={dead0 ? 0.35 : 1} />
          </Rise>
        ))}
        <Node t={t} when={at(c, 0, 0.5)} x={270} y={530} icon="file" label="cấu hình .properties" size={130} />
        <Wire from={{ x: 360, y: 530 }} to={{ x: 548, y: 530 }} color={INK.line} p={move(t, at(c, 0, 0.5), 0.4)} flow={dead0 ? undefined : t} />
        <Node t={t} when={at(c, 0, 0.64)} x={1650} y={530} icon="file-text" label="offset trong file" size={130} />
        <Wire from={{ x: 1372, y: 530 }} to={{ x: 1570, y: 530 }} color={INK.line} p={move(t, at(c, 0, 0.64), 0.4)} flow={dead0 ? undefined : t} />
        <Say y={870} text="worker chết → mọi thứ dừng" color={INK.bad} size={50} o={sp(t, dieAt + 0.2)} />
      </div>
      {/* distributed */}
      {WX.map((x, w) => (
        <Rise key={w} t={t} at={wk[w]}>
          <WorkerBox x={x} y={WY} w={W} h={250} name={`worker-${w + 1}`} down={w === 1 && hbDown} />
        </Rise>
      ))}
      {tasks.map((tk, n) => {
        const a = pos(tk.w, tk.i)
        const b = tk.to ? pos(tk.to.w, tk.to.i) : a
        const m = tk.to ? move(t, moveAt, 0.9) : 0
        const orphan = tk.w === 1 && hbDown && t < moveAt
        return (
          <Rise key={n} t={t} at={wk[tk.w] + 0.4 + tk.i * 0.15}>
            <Chip x={lerp(a.x, b.x, m)} y={lerp(a.y, b.y, m)} w={140} h={64} label={`task ${n}`} tone={orphan ? 'bad' : 'blue'} />
          </Rise>
        )
      })}
      <Tag x={1580} y={295} text="group.id = connect" mono size={30} o={vis(t, a1 + 2.4)} color={INK.accent} />
      <Tag x={420} y={295} text="REST API · cổng 8083" size={30} o={vis(t, at(c, 1, 0.6))} />
      <Packets t={t} from={{ x: 420, y: 325 }} to={{ x: 400, y: WY - 6 }} start={at(c, 1, 0.68)} end={a2} every={0.45} len={0.6} size={22} />
      {/* internal topics */}
      {topics.map((nm, k) => (
        <div key={nm}>
          <Cells t={t} x={WX[k] + 80} y={830} cw={72} n={5} o={vis(t, topAt[k])} cells={Object.fromEntries(Array.from({ length: 5 }, (_, i) => [i, { label: ['a', 'b', 'a', 'c', 'b'][i], at: topAt[k] + 0.3 + i * 0.25 }]))} />
          <div style={{ position: 'absolute', left: WX[k], width: W, textAlign: 'center', top: 912, fontSize: 28, fontWeight: 800, color: INK.faint, whiteSpace: 'nowrap', opacity: vis(t, topAt[k]) }}>{nm}</div>
          <Packets t={t} from={{ x: WX[k] + 260, y: WY + 256 }} to={{ x: WX[k] + 260, y: 822 }} start={pk + k * 0.1} end={a3 - 0.2} every={0.7} len={0.9} size={20} color={INK.accent} />
        </div>
      ))}
      <Tag x={960} y={992} text="compacted: chỉ giữ giá trị mới nhất của mỗi key" size={30} color={INK.good} o={vis(t, at(c, 2, 0.74))} />
      <Say y={700} text="worker nào cũng thay được worker nào" color={INK.good} size={44} o={Math.min(sp(t, at(c, 2, 0.84)), 1 - span(t, a3, a3 + 0.3))} />
      <Icon3D name="heart" x={940} y={285} size={80} t={t} at={a3} dim={hbDown} />
      <Tag x={1210} y={285} text="mất heartbeat" size={30} color={INK.bad} o={vis(t, killAt + 0.3)} />
      <Say y={700} text="task được chia lại · không ai mất việc" color={INK.good} size={44} o={sp(t, at(c, 3, 0.8))} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 4. SMT then converter */

function pipeline(t: number, c: Cue) {
  const [a1, a2, a3] = [c.at(1), c.at(2), c.at(3)]
  const X = [150, 570, 990, 1410]
  const SW = 360
  const st = [
    { kicker: 'connector', name: 'đọc dòng', when: 2.0 },
    { kicker: 'SMT', name: 'HoistField', when: 3.5 },
    { kicker: 'SMT', name: 'InsertField', when: 3.95 },
    { kicker: 'converter', name: 'JsonConverter', when: 5.0 },
  ]
  const hop = [a1 + 0.1, at(c, 1, 0.5), a2 + 0.05]
  const cardAt = [2.4, hop[0] + 0.75, hop[1] + 0.75, hop[2] + 0.75]
  const dim = 1 - 0.4 * span(t, a3, a3 + 0.5)
  const hex = ['7B', '22', '6C', '69', '6E', '65', '22', '3A']
  const row = (k: string, v: string, hot = false, o = 1) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 64, opacity: o }}>
      <span style={{ minWidth: 112, height: 48, padding: '0 12px', boxSizing: 'border-box', borderRadius: 12, display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 28, fontWeight: 800, color: '#13307f', background: hot ? GREEN : '#fff', boxShadow: hot ? `0 0 20px ${INK.good}` : undefined }}>{k}</span>
      <span style={{ fontFamily: MONO, fontSize: 28, fontWeight: 700, color: '#fff' }}>{v}</span>
    </div>
  )
  const cardBody = [
    <div key="0" style={{ display: 'grid', placeItems: 'center', height: 64, fontFamily: MONO, fontSize: 36, fontWeight: 800, color: '#fff' }}>&quot;dong 1&quot;</div>,
    row('line', '"dong 1"'),
    <div key="2">
      {row('line', '"dong 1"')}
      {row('source', '"file-lab"', true, vis(t, hop[1] + 0.9))}
    </div>,
    <div key="3" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, width: 330 }}>
      {hex.map((h, i) => (
        <span key={i} style={{ width: 76, height: 50, borderRadius: 10, display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 30, fontWeight: 800, color: '#fff', background: HERO, opacity: vis(t, cardAt[3] + 0.15 + i * 0.12, Infinity, 0.2) }}>
          {h}
        </span>
      ))}
    </div>,
  ]
  const tokenY = 468
  const mism = { w: at(c, 3, 0.08), conv: at(c, 3, 0.26), pk: at(c, 3, 0.42), bad: at(c, 3, 0.72) }
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, { x: 960, y: 560, s: 1.02 }], [a3, { x: 960, y: 600, s: 1.05 }, 1.4]])} title={{ kicker: 'KAFKA CONNECT', text: 'SMT và converter' }}>
      <div style={{ opacity: dim }}>
        {st.map((s, i) => (
          <div key={i}>
            <Rise t={t} at={s.when}>
              <Card x={X[i]} y={320} w={SW} h={124} border={i === 3 ? `2px solid ${INK.warn}` : undefined}>
                <Cap x={26} y={12} text={s.kicker} size={28} color={i === 3 ? INK.warn : INK.faint} />
                <Cap x={26} y={52} text={s.name} size={38} color="#fff" mono={i > 0 && i < 3} />
              </Card>
            </Rise>
            {i < 3 && <Wire from={{ x: X[i] + SW + 4, y: 382 }} to={{ x: X[i + 1] - 4, y: 382 }} color={INK.line} p={move(t, st[i + 1].when, 0.4)} flow={t} />}
          </div>
        ))}
        {X.map((x, i) => (
          <Rise key={i} t={t} at={cardAt[i]}>
            <Card x={x} y={490} w={SW} h={i === 3 ? 210 : i === 2 ? 190 : 150} border={i === 3 ? `2px solid ${INK.warn}` : undefined}>
              <div style={{ position: 'absolute', left: 14, top: 14, right: 10 }}>{cardBody[i]}</div>
              {i === 3 && <Cap x={16} y={152} text="byte gửi vào topic" size={28} color={INK.faint} />}
            </Card>
          </Rise>
        ))}
        {[0, 1, 2].map((i) => (
          <Packets key={i} t={t} from={{ x: X[i] + SW / 2, y: tokenY }} to={{ x: X[i + 1] + SW / 2, y: tokenY }} start={hop[i]} end={hop[i] + 0.1} every={5} len={0.7} size={34} />
        ))}
        {/* what SMT cannot do */}
        {['join', 'đếm', 'gộp'].map((l, i) => (
          <Tag key={l} x={[560, 960, 1360][i]} y={820} text={`✕  ${l}`} size={36} color={INK.bad} o={Math.min(vis(t, at(c, 2, 0.4 + i * 0.15)), 1 - span(t, a3, a3 + 0.3))} />
        ))}
        <Tag x={960} y={925} text="→ việc đó để cho Kafka Streams" size={36} color={INK.good} o={Math.min(vis(t, at(c, 2, 0.88)), 1 - span(t, a3, a3 + 0.3))} />
      </div>
      {/* converter mismatch */}
      <Tag x={360} y={770} text="đầu ghi: schemas.enable=false" size={30} color={INK.line} o={vis(t, mism.w)} mono />
      <Rise t={t} at={mism.w}>
        <Chip x={150} y={825} w={280} h={90} label={'"dong 1"'} mono size={34} />
      </Rise>
      <Tag x={1030} y={770} text="đầu đọc: schemas.enable=true" size={30} color={INK.warn} o={vis(t, mism.conv)} mono />
      <Rise t={t} at={mism.conv}>
        <Card x={680} y={815} w={720} h={120} border={`2px solid ${INK.warn}`}>
          <Cap x={26} y={12} text="JsonConverter" size={34} color="#fff" />
          <Cap x={26} y={64} text="đòi vỏ { schema, payload }" size={30} color={INK.warn} mono />
        </Card>
      </Rise>
      <Wire from={{ x: 438, y: 870 }} to={{ x: 672, y: 870 }} color={INK.line} p={move(t, mism.conv, 0.4)} flow={t} />
      <Packets t={t} from={{ x: 438, y: 870 }} to={{ x: 668, y: 870 }} start={mism.pk} end={mism.bad} every={0.6} len={0.8} size={22} color={INK.bad} />
      <Rise t={t} at={mism.bad}>
        <Chip x={1450} y={825} w={300} h={90} label="mọi tin đều lỗi" tone="bad" size={32} />
      </Rise>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 5. two kinds of offset */

function offsets(t: number, c: Cue) {
  const [a1, a2, a3] = [c.at(1), c.at(2), c.at(3)]
  const LANE = 580
  const tapeX = 700
  const CW = 96
  const FILE = { x: 130, y: 385, w: 420, h: 360 }
  const ROW = (i: number) => FILE.y + 78 + i * 66
  const sendAt = (k: number) => at(c, 0, 0.42 + 0.14 * k)
  const storeAt = (k: number) => sendAt(k) + 0.9
  const crash = at(c, 2, 0.08)
  const rewind = at(c, 2, 0.36)
  const resend = at(c, 2, 0.52)
  const restore = resend + 0.9
  // value shown in the offset store
  let stored = 0
  for (let k = 0; k < 4; k++) if (t >= storeAt(k)) stored = 7 * (k + 1)
  if (t >= crash) stored = 21
  if (t >= restore) stored = 28
  // line the read head sits on (0..3), -1 = nothing read yet
  let head = -1
  for (let k = 0; k < 4; k++) if (t >= sendAt(k)) head = k
  if (t >= rewind) head = 3
  const left = 1 - span(t, a3 - 0.1, a3 + 0.3)
  const steps = [
    { label: '① gửi vào Kafka', at: at(c, 1, 0.2) },
    { label: '② broker xác nhận', at: at(c, 1, 0.5) },
    { label: '③ lưu offset', at: at(c, 1, 0.8) },
  ]
  const stepsOut = 1 - span(t, a2 - 0.7, a2 - 0.3)
  const active = steps.reduce((acc, s, i) => (t >= s.at ? i : acc), -1)
  const cells: Record<number, Cell> = Object.fromEntries(Array.from({ length: 4 }, (_, k) => [k, { label: String(k + 1), at: sendAt(k) + 0.55 }]))
  cells[4] = { label: '4', tone: 'warn', at: resend + 0.55 }
  // sink side
  const sk = { block: at(c, 3, 0.06), es: at(c, 3, 0.18), grp: at(c, 3, 0.3) }
  const commitAt = (k: number) => at(c, 3, 0.42 + 0.12 * k)
  let committed = 0
  for (let k = 0; k < 5; k++) if (t >= commitAt(k)) committed = k + 1
  const SNK = { x: 1260, y: 485, w: 240, h: 190 }
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, { x: 960, y: 560, s: 1.05 }], [a1, { x: 960, y: 580, s: 1.09 }, 1.2], [a3, { x: 1000, y: 580, s: 1.05 }, 1.2]])} title={{ kicker: 'KAFKA CONNECT', text: 'Hai loại offset' }}>
      <div style={{ opacity: left }}>
        <Rise t={t} at={at(c, 0, 0.28)}>
          <Card x={FILE.x} y={FILE.y} w={FILE.w} h={FILE.h}>
            <Cap x={26} y={16} text="file nguồn" size={30} color="#fff" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ position: 'absolute', left: 26, top: 62 + i * 66, width: 368, height: 56, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px', boxSizing: 'border-box', background: head === i ? HERO : 'rgba(12,30,96,0.5)', boxShadow: head === i ? '0 0 22px rgba(77,141,255,0.8)' : undefined }}>
                <span style={{ fontFamily: MONO, fontSize: 32, fontWeight: 800, color: '#fff' }}>dong {i + 1}</span>
                <span style={{ fontSize: 28, fontWeight: 700, color: head === i ? '#fff' : INK.faint }}>
                  {i * 7}–{i * 7 + 7}
                </span>
              </div>
            ))}
          </Card>
        </Rise>
        <Wire from={{ x: FILE.x + FILE.w + 4, y: LANE }} to={{ x: tapeX - 8, y: LANE }} color={INK.line} p={move(t, at(c, 0, 0.36), 0.4)} flow={t} />
        {[0, 1, 2, 3].map((k) => (
          <Flyer key={k} t={t} from={{ x: FILE.x + FILE.w - 20, y: ROW(k) }} to={{ x: tapeX - 10, y: LANE }} start={sendAt(k)} len={0.55} label={String(k + 1)} />
        ))}
        <Flyer t={t} from={{ x: FILE.x + FILE.w - 20, y: ROW(3) }} to={{ x: tapeX - 10, y: LANE }} start={resend} len={0.55} label="4" tone="warn" />
        <Rise t={t} at={at(c, 0, 0.5)}>
          <Card x={1310} y={465} w={480} h={230} border={t >= crash && t < restore ? `2px solid ${INK.bad}` : undefined}>
            <Cap x={26} y={16} text="offset đã lưu" size={30} color="#fff" />
            <Cap x={26} y={80} text={`{"position": ${stored}}`} size={44} color={t >= crash && t < restore ? INK.bad : INK.good} mono />
            <Cap x={26} y={152} text="trong hệ thống nguồn" size={26} color={INK.faint} />
          </Card>
        </Rise>
        <Wire from={{ x: tapeX + 5 * CW + 6, y: LANE }} to={{ x: 1302, y: LANE }} color={INK.line} p={move(t, at(c, 0, 0.5), 0.4)} flow={t} />
        {/* the three steps */}
        <div style={{ opacity: stepsOut }}>
          {steps.map((s, i) => (
            <Rise key={s.label} t={t} at={at(c, 1, 0.02 + i * 0.05)}>
              <Chip x={[270, 770, 1290][i]} y={870} w={380} h={74} label={s.label} size={32} o={active === i ? 1 : 0.5} />
            </Rise>
          ))}
          {[0, 1].map((i) => (
            <Wire key={i} from={{ x: [654, 1154][i], y: 907 }} to={{ x: [766, 1266][i], y: 907 }} color={INK.line} p={move(t, steps[i + 1].at - 0.3, 0.3)} />
          ))}
        </div>
        <Tag x={1245} y={525} text="ack ✓" size={30} color={INK.good} o={Math.min(vis(t, steps[1].at, steps[1].at + 1.4), stepsOut)} />
        <Icon3D name="fire" x={1245} y={705} size={110} t={t} at={crash} />
        <Tag x={1550} y={755} text="chết trước khi lưu 28" size={30} color={INK.bad} o={vis(t, crash + 0.3, restore)} />
        <Tag x={tapeX + 4 * CW + CW / 2} y={LANE - 80} text="trùng" size={30} color={INK.warn} o={vis(t, resend + 0.7)} />
        <Tag x={960} y={730} text="đọc lại từ vị trí 21" size={30} color={INK.warn} o={vis(t, rewind, restore)} />
        <Say y={900} text="trùng một đoạn, nhưng không mất tin nào" color={INK.warn} size={46} o={sp(t, at(c, 2, 0.8))} />
      </div>
      <Cells t={t} x={tapeX} y={LANE - 35} cw={CW} n={5} title="topic" o={vis(t, at(c, 0, 0.36))} cells={cells} />
      {/* sink side */}
      <Rise t={t} at={sk.block}>
        <Card x={SNK.x} y={SNK.y} w={SNK.w} h={SNK.h}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 14, textAlign: 'center', fontSize: 30, fontWeight: 800, color: '#fff' }}>sink</div>
        </Card>
        <Chip x={SNK.x + 45} y={SNK.y + 80} w={150} h={64} label="task 0" />
      </Rise>
      <Wire from={{ x: tapeX + 5 * CW + 6, y: LANE }} to={{ x: SNK.x - 6, y: LANE }} color={INK.line} p={move(t, sk.block, 0.4) * (1 - left)} flow={t} />
      <Packets t={t} from={{ x: tapeX + 5 * CW + 6, y: LANE }} to={{ x: SNK.x + 30, y: LANE }} start={sk.es} every={0.75} len={0.8} size={20} />
      <Wire from={{ x: SNK.x + SNK.w + 4, y: LANE }} to={{ x: 1630, y: LANE }} color={INK.line} p={move(t, sk.es, 0.4)} flow={t} />
      <Packets t={t} from={{ x: SNK.x + SNK.w - 30, y: LANE }} to={{ x: 1625, y: LANE }} start={sk.es + 0.5} every={0.75} len={0.8} size={20} />
      <Node t={t} when={sk.es} x={1730} y={LANE} icon="zoom" label="Elasticsearch" size={130} />
      <Rise t={t} at={sk.grp}>
        <Card x={1100} y={800} w={640} h={190} border={`2px solid ${INK.accent}`}>
          <Cap x={26} y={14} text="consumer group" size={26} color={INK.faint} />
          <Cap x={26} y={52} text="connect-es-sink" size={36} color="#fff" mono />
          <Cap x={26} y={110} text={`offset Kafka đã commit: ${committed}`} size={34} color={INK.good} />
        </Card>
      </Rise>
      {[0, 1, 2, 3, 4].map((k) => (
        <Tag key={k} x={1380} y={738} text="put() ✓ → commit" size={30} color={INK.good} o={vis(t, commitAt(k) - 0.25, commitAt(k) + 0.25, 0.15) * (committed === k + 1 || (committed === k && t >= commitAt(k) - 0.25) ? 1 : 0)} />
      ))}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 6. bad records: tolerance and the DLQ */

function dlq(t: number, c: Cue) {
  const [a1, a2, a3] = [c.at(1), c.at(2), c.at(3)]
  const starts = [2.4, a1 + 0.2, a2 + 0.2]
  const phase = t < a1 ? 0 : t < a2 ? 1 : 2
  const s = starts[phase]
  const GAP = 0.55
  const fly = (k: number) => s + 0.1 + k * GAP
  const LEN = 0.7
  const tapeX = 100
  const CW = 100
  const TY = 470
  const mid = TY + 35
  const TASK = { x: 860, y: mid - 50, w: 280, h: 100 }
  const es = { x: 1640, y: mid }
  const BAD = 2
  const arrive = (k: number) => fly(k) + LEN
  const failed = phase === 0 && t >= arrive(BAD)
  // delivered counter
  let delivered = 0
  for (let k = 0; k < 6; k++) {
    if (k === BAD) continue
    if (phase === 0 && k > 1) continue
    if (t >= arrive(k)) delivered++
  }
  const cells: Record<number, Cell> = Object.fromEntries(Array.from({ length: 6 }, (_, k) => [k, { label: k === BAD ? '?' : String(k + 1), tone: (k === BAD ? 'bad' : 'blue') as Tone, at: s + k * 0.05, gone: phase === 0 && k > BAD ? undefined : fly(k) }]))
  const flights = Array.from({ length: 6 }, (_, k) => k).filter((k) => !(phase === 0 && k > BAD))
  const drop = arrive(BAD) + 0.1
  const trash = { x: 1000, y: 770 }
  const dq = { x: 700, y: 850 }
  const landed = phase === 2 && t >= arrive(BAD) + 0.8
  const hdr = [at(c, 3, 0.15), at(c, 3, 0.4), at(c, 3, 0.65)]
  const cfg = ['errors.tolerance = none', 'errors.tolerance = all', 'errors.tolerance = all']
  const fresh = vis(t, starts[phase] - 0.1, Infinity, 0.3)
  // phase-specific content fades out just before the next phase starts, then the new phase eases in
  const out = (1 - move(t, a1 - 0.45, 0.45)) * (1 - move(t, a2 - 0.45, 0.45))
  const lead = (opacity: number): CSSProperties => ({ opacity })
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, { x: 960, y: 560, s: 1.03 }], [a2, { x: 960, y: 580, s: 1.06 }, 1.2], [a3, { x: 1000, y: 580, s: 1.03 }, 1.2]])} title={{ kicker: 'KAFKA CONNECT', text: 'Tin hỏng và DLQ' }}>
      <Tag x={960} y={255} text={cfg[phase]} mono size={32} color={phase === 0 ? INK.warn : INK.accent} o={Math.min(fresh, vis(t, 2.0)) * out} />
      <Tag x={960} y={335} text="errors.deadletterqueue.topic.name = dlq-orders" mono size={30} color={INK.good} o={vis(t, a2 - 0.1, Infinity, 0.25)} />
      <div key={phase} style={lead(out)}>
        <Cells t={t} x={tapeX} y={TY} cw={CW} n={6} title="topic orders" o={vis(t, s - 0.1)} cells={cells} />
        {flights.map((k) => (
          <Flyer key={k} t={t} from={{ x: tapeX + k * CW + CW / 2, y: mid }} to={{ x: TASK.x - 24, y: mid }} start={fly(k)} len={LEN} lift={110} label={k === BAD ? '?' : String(k + 1)} tone={k === BAD ? 'bad' : 'blue'} />
        ))}
      </div>
      <Wire from={{ x: tapeX + 6 * CW + 8, y: mid }} to={{ x: TASK.x - 8, y: mid }} color={INK.line} p={move(t, 2.2, 0.5)} flow={failed ? undefined : t} />
      <Rise t={t} at={2.3}>
        <Card x={TASK.x} y={TASK.y} w={TASK.w} h={TASK.h} border={`2px solid ${INK.accent}`}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 22, background: 'rgba(120,10,30,0.55)', border: `2px solid ${INK.bad}`, opacity: failed ? out : 0 }} />
          <Cap x={26} y={14} text="sink task" size={34} color="#fff" />
          <div style={lead(out * (failed ? 1 : fresh))}><Cap x={26} y={56} text={failed ? 'FAILED' : 'RUNNING'} size={28} color={failed ? INK.bad : INK.good} /></div>
        </Card>
      </Rise>
      <Wire from={{ x: TASK.x + TASK.w + 6, y: mid }} to={{ x: es.x - 95, y: mid }} color={INK.line} p={move(t, 2.6, 0.5)} flow={failed ? undefined : t} />
      <Node t={t} when={2.6} x={es.x} y={es.y} icon="zoom" label="Elasticsearch" size={140} dim={failed && out > 0.5} />
      <Tag x={es.x} y={mid + 175} text={`đã ghi: ${delivered}`} size={32} color={delivered ? INK.good : INK.line} o={vis(t, 3.0) * out * fresh} />
      <div style={lead(out)}><Packets t={t} from={{ x: TASK.x + TASK.w + 6, y: mid }} to={{ x: es.x - 100, y: mid }} start={s + 1.0} end={failed ? t - 0.01 : Infinity} every={0.8} len={0.9} size={20} /></div>
      {/* none: the pipeline stops */}
      {failed && (
        <div style={lead(out)}>
          <Icon3D name="fire" x={1340} y={mid - 4} size={120} t={t} at={arrive(BAD)} />
          <Tag x={400} y={625} text="3 tin còn lại kẹt phía sau" size={30} color={INK.bad} o={vis(t, arrive(BAD) + 0.4)} />
          <Say y={810} text="một tin hỏng → cả đường ống đứng" color={INK.bad} size={56} o={sp(t, arrive(BAD) + 0.7)} />
        </div>
      )}
      {/* all, no DLQ: the bad record is lost */}
      {phase === 1 && (
        <div style={lead(out)}>
          <Icon3D name="trash-can" x={trash.x} y={trash.y} size={140} t={t} at={arrive(BAD) - 0.5} />
          <Flyer t={t} from={{ x: TASK.x + 140, y: TASK.y + TASK.h + 10 }} to={{ x: trash.x, y: trash.y - 40 }} start={drop} len={0.6} label="?" tone="bad" />
          <Tag x={trash.x} y={890} text="mất lặng lẽ, không dấu vết" size={30} color={INK.bad} o={vis(t, drop + 0.7)} />
        </div>
      )}
      {/* all + DLQ: parked for later */}
      {phase === 2 && (
        <>
          <Cells t={t} x={dq.x} y={dq.y} cw={CW} n={4} title="topic dlq-orders" o={vis(t, a2 + 0.5)} cells={landed ? { 0: { label: '?', tone: 'bad' as Tone, at: arrive(BAD) + 0.8 } } : {}} />
          <Flyer t={t} from={{ x: TASK.x + 140, y: TASK.y + TASK.h + 10 }} to={{ x: dq.x + CW / 2, y: dq.y + 35 }} start={arrive(BAD) + 0.1} len={0.7} label="?" tone="bad" />
          <Card x={1190} y={790} w={620} h={210} o={vis(t, a3 + 0.05)} border={`2px solid ${INK.warn}`}>
            <Cap x={24} y={12} text="header của tin trong DLQ" size={26} color={INK.faint} />
            <div style={{ opacity: vis(t, hdr[0]) }}><Cap x={24} y={58} text="topic gốc: orders" size={30} color="#fff" /></div>
            <div style={{ opacity: vis(t, hdr[1]) }}><Cap x={24} y={102} text="partition 0 · offset 2" size={30} color="#fff" /></div>
            <div style={{ opacity: vis(t, hdr[2]) }}><Cap x={24} y={146} text="lý do: DataException" size={30} color={INK.warn} /></div>
          </Card>
          <Wire from={{ x: dq.x + 4 * CW + 8, y: dq.y + 35 }} to={{ x: 1184, y: dq.y + 35 }} color={INK.warn} p={move(t, a3 + 0.05, 0.4)} flow={t} />
          <Packets t={t} from={{ x: dq.x + 4 * CW + 8, y: dq.y + 35 }} to={{ x: 1180, y: dq.y + 35 }} start={a3 + 0.5} every={0.6} len={0.5} size={20} color={INK.warn} />
          <Say y={725} text="biết lý do → sửa → chạy lại" color={INK.good} size={46} o={sp(t, at(c, 3, 0.78))} />
        </>
      )}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 7. summary */

function summary(t: number, c: Cue) {
  return (
    <SoftTheme>
      <SummaryList t={t} cue={c} items={['Worker · connector · task: ai làm gì', 'Distributed: worker nào cũng thay được', 'SMT sửa từng tin · converter phải khớp', 'errors.tolerance = all phải đi kèm DLQ']} />
    </SoftTheme>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { hook, 'source-sink': sourceSink, roles, modes, pipeline, offsets, dlq, summary }

/** Key-moment sounds, timed to the same cue offsets the scenes animate on. */
const SFX: Record<string, SceneSfx[]> = {
  hook: [
    { kind: 'error', at: (c) => at(c, 2, 0.15) },
    { kind: 'ding', at: (c) => at(c, 3, 0.1) },
  ],
  roles: [{ kind: 'ding', at: (c) => at(c, 3, 0.84) }],
  modes: [
    { kind: 'error', at: (c) => at(c, 0, 0.84) },
    { kind: 'error', at: (c) => at(c, 3, 0.25) },
    { kind: 'ding', at: (c) => at(c, 3, 0.68) + 0.9 },
  ],
  pipeline: [{ kind: 'error', at: (c) => at(c, 3, 0.72) }],
  offsets: [
    { kind: 'error', at: (c) => at(c, 2, 0.08) },
    { kind: 'ding', at: (c) => at(c, 2, 0.52) + 0.9 },
  ],
  dlq: [
    { kind: 'error', at: () => 2.4 + 0.1 + 2 * 0.55 + 0.7 },
    { kind: 'tick', at: (c) => c.at(1) + 0.2 + 0.1 + 2 * 0.55 + 0.8 },
    { kind: 'ding', at: (c) => c.at(2) + 0.2 + 0.1 + 2 * 0.55 + 0.7 + 0.8 },
  ],
}

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const kafkaConnectLesson: Lesson = {
  ...kafkaConnectScript,
  scenes: kafkaConnectScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id], sfx: SFX[s.id] })),
  intro: [
    { kind: 'video', scenes: ['hook'] },
    {
      kind: 'quiz',
      title: 'Quick Quiz',
      questions: [q('Đoán trước khi học: sink connector đọc topic có 4 partition, bạn đặt tasks.max = 10. Bao nhiêu task thật sự có việc?', ['1', '4', '10', 'Không task nào'], 1, 'Sink task là consumer trong cùng một group, mỗi partition chỉ giao cho một consumer. Task thứ 5 trở đi không có partition nào để đọc.')],
    },
  ],
  roadmap: [
    'Chặng 1: Connect nối Kafka với hệ thống ngoài thế nào: source, sink, và ai làm gì giữa worker, connector, task.',
    'Chặng 2: Standalone khác distributed ở đâu, và vì sao production chọn distributed.',
    'Chặng 3: Đường đi của một tin qua SMT và converter, hai loại offset, và cách errors.tolerance cùng DLQ xử lý tin hỏng.',
  ],
  sections: [
    {
      id: 'source-sink-task',
      title: 'Source, sink, worker, connector, task',
      blocks: [
        { kind: 'video', scenes: ['source-sink'] },
        { kind: 'p', text: 'Tự viết chương trình nối Kafka với từng hệ thống thì mỗi chương trình phải tự lo offset, retry khi đích sập, chạy song song, chuyển đổi định dạng, giám sát. **Kafka Connect** là khung chạy sẵn (nằm trong Apache Kafka) lo phần "ống nước" đó. Bạn viết **cấu hình**; logic đọc/ghi từng hệ thống nằm trong **connector** (plugin).' },
        { kind: 'code', code: ' PostgreSQL ──[source connector]──▶  Kafka topic  ──[sink connector]──▶ Elasticsearch\n file.txt   ──[FileStreamSource]──▶  connect-lab  ──[FileStreamSink]──▶ output.txt   (lab)' },
        {
          kind: 'list',
          items: [
            { title: 'Source connector', text: 'hệ thống ngoài → Kafka.' },
            { title: 'Sink connector', text: 'Kafka → hệ thống ngoài.' },
          ],
        },
        { kind: 'video', scenes: ['roles'] },
        {
          kind: 'table',
          head: ['Khái niệm', 'Là gì', 'Ví dụ'],
          rows: [
            ['**Worker**', 'một tiến trình JVM chạy Connect: REST API, lưu cấu hình, khởi động task, commit offset, retry khi task lỗi', '1 container `connect-1`'],
            ['**Connector**', 'cấu hình + logic chia việc', '"đồng bộ bảng orders"'],
            ['**Task**', 'đơn vị thực sự sao chép dữ liệu, chạy trong worker', '`tasks.max=4` → tối đa 4 task song song'],
          ],
        },
        { kind: 'callout', tone: 'info', title: 'Task chạy song song được bao nhiêu?', text: 'Connector quyết định số task và giao phần nào cho task nào. JDBC source lấy **số nhỏ hơn** giữa `tasks.max` và số bảng: 3 bảng mà `tasks.max=8` thì chỉ có 3 task. Sink task là consumer trong cùng một consumer group nên bị giới hạn bởi số partition (Module 5). (📘 sách, ch.9)' },
        { kind: 'callout', tone: 'tip', title: 'Khi nào dùng Connect, khi nào tự viết?', text: 'Tự viết producer/consumer khi bạn **sửa được code** của ứng dụng cần nối với Kafka. Nối Kafka với kho dữ liệu bạn không viết ra (DB, S3, Elasticsearch) thì dùng Connect, vì cấu hình, offset, chạy song song, xử lý lỗi và REST API đã có sẵn. Connect để **di chuyển** dữ liệu, không để xử lý logic nghiệp vụ. (📘 sách, ch.9)' },
        { kind: 'callout', tone: 'warn', title: 'Đưa dữ liệu DB vào Kafka', text: 'Connector JDBC **hỏi bảng định kỳ** (theo cột timestamp hoặc khoá tăng dần): tốn tải và có thể sót thay đổi. Tốt hơn là **CDC** (đọc nhật ký giao dịch như binlog, WAL), ví dụ connector của Debezium. Module 10 đi sâu phần này. (📘 sách, ch.9)' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('JDBC source đọc 3 bảng, bạn đặt tasks.max = 8. Có bao nhiêu task?', ['8', '3', '1', '5'], 1, 'Lấy số nhỏ hơn giữa tasks.max và số bảng: min(8, 3) = 3.'),
            q('Ai lo REST API, lưu cấu hình, khởi động task và commit offset?', ['Connector', 'Task', 'Worker', 'Broker'], 2, 'Worker lo phần ống nước. Connector chỉ chia việc, task mới sao chép dữ liệu.'),
          ],
        },
      ],
    },
    {
      id: 'standalone-distributed',
      title: 'Standalone và distributed',
      blocks: [
        { kind: 'video', scenes: ['modes'] },
        {
          kind: 'table',
          head: ['', 'Standalone', 'Distributed'],
          rows: [
            ['Số worker', '1', 'nhiều worker cùng `group.id`'],
            ['Cấu hình connector', 'file `.properties` khi khởi động', 'gửi qua REST API (cổng 8083)'],
            ['Offset của source', 'file cục bộ (`offset.storage.file.filename`)', 'topic Kafka (compacted)'],
            ['Worker chết', 'mọi thứ dừng', 'task được chia lại cho worker còn sống'],
            ['Dùng khi', 'lab, dev, một máy đơn lẻ', 'production'],
          ],
        },
        { kind: 'p', text: 'Distributed dùng 3 topic nội bộ: `config.storage.topic`, `offset.storage.topic`, `status.storage.topic`. Cả ba là **compacted**, vì chỉ cần giá trị mới nhất cho mỗi key (cấu hình mới nhất của connector X, offset mới nhất của file Y). Các worker cùng `group.id` phát hiện worker chết nhờ **heartbeat của giao thức consumer group** (Module 5), rồi chia lại task của nó. (📘 sách, ch.9)' },
        { kind: 'callout', tone: 'info', title: 'Standalone vẫn có chỗ dùng thật', text: 'Khi connector **bắt buộc** chạy trên một máy cụ thể, ví dụ connector syslog mở cổng nghe log, bạn phải biết chắc nó nằm ở máy nào. (📘 sách, ch.9)' },
        { kind: 'callout', tone: 'tip', title: 'Hình ảnh: công ty chuyển phát', text: 'Bạn ký hợp đồng với công ty chuyển phát (worker), chọn tuyến (connector), công ty tự điều bao nhiêu shipper (task). Shipper nghỉ ốm thì công ty điều người khác chạy tuyến đó (distributed). Thuê một shipper tự do (standalone) thì họ ốm là hàng nằm im.' },
        {
          kind: 'list',
          items: [
            { text: '`plugin.path` trỏ đến **thư mục**, mỗi connector một thư mục con chứa jar và thư viện phụ thuộc. Không ném connector vào classpath chung vì có thể lệch phiên bản thư viện với Kafka.' },
            { text: '`FileStreamSource`/`FileStreamSink` chỉ là ví dụ để học, không có bảo đảm độ tin cậy, không dùng cho production. Production nên chạy worker trên **máy riêng**, tách khỏi broker. (📘 sách, ch.9)' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Vì sao production nên dùng distributed mode dù chỉ có 1 connector?', ['Vì nhanh hơn standalone', 'Vì offset, cấu hình và trạng thái nằm trong topic Kafka có replication, một worker chết thì worker khác đọc được và chạy tiếp', 'Vì không cần plugin.path', 'Vì không cần converter'], 1, 'Standalone lưu offset vào file trên đúng một máy: máy đó chết là mất cả tiến trình lẫn trạng thái.')],
        },
      ],
    },
    {
      id: 'smt-converter',
      title: 'SMT và converter',
      blocks: [
        { kind: 'p', text: 'Đường đi của một tin trong source connector: `dòng trong file → Connector (đọc) → [SMT: sửa từng tin] → [Converter: thành byte] → Kafka`. Sink thì đi ngược lại: byte từ Kafka → Converter → SMT → Connector ghi ra đích.' },
        { kind: 'video', scenes: ['pipeline'] },
        {
          kind: 'table',
          head: ['Converter', 'Byte trên Kafka trông thế nào', 'Có sẵn ở'],
          rows: [
            ['`StringConverter`', '`dong 1`', 'Apache Kafka'],
            ['`JsonConverter` `schemas.enable=true`', '`{"schema":{"type":"string",...},"payload":"dong 1"}`', 'Apache Kafka'],
            ['`JsonConverter` `schemas.enable=false`', '`"dong 1"`', 'Apache Kafka'],
            ['`AvroConverter`', '`[0][schema id][Avro]` (Schema Registry)', 'Confluent'],
          ],
        },
        { kind: 'code', code: '"dong 1"  ──HoistField(line)──▶  {"line":"dong 1"}  ──InsertField(source)──▶  {"line":"dong 1","source":"file-lab"}' },
        { kind: 'callout', tone: 'warn', title: 'Lỗi kinh điển', text: 'Sink dùng `JsonConverter` + `schemas.enable=true` để đọc topic chứa JSON trơn (không có vỏ `schema`/`payload`) → mọi tin đều lỗi. **Converter ở đầu đọc phải khớp với cách đầu ghi đã mã hoá.**' },
        { kind: 'p', text: 'SMT có sẵn: `InsertField`, `ReplaceField`, `MaskField`, `HoistField`, `RegexRouter` (đổi tên topic), `Filter` (kèm predicate). Thêm vài tên đáng biết: `Cast`, `Flatten`, `TimestampConverter`, `TimestampRouter`, `InsertHeader`, `HeaderFrom`. SMT **chỉ nhìn một tin mỗi lần**, nên không join, không đếm, không gộp được: cần những việc đó thì dùng Kafka Streams.' },
        { kind: 'callout', tone: 'tip', title: 'Giữ SMT nhẹ', text: 'Một topic thường có nhiều nơi đọc. Nếu đường ống lọc bỏ trường hay bỏ tin ngay lúc nạp, mọi nơi đọc phía sau chỉ còn dữ liệu thiếu, muốn lấy lại phải dựng lại đường ống. Chỉ nên làm việc có lợi cho **mọi** nơi đọc: chuẩn hoá kiểu và timestamp, thêm nguồn gốc (lineage), che dữ liệu cá nhân. Kiểu "nạp gần nguyên bản, biến đổi ở đích" gọi là **ELT**, ngược với **ETL**. (📘 sách, ch.9)' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Sink đọc topic do producer Java viết bằng StringSerializer (JSON trơn), cấu hình JsonConverter với schemas.enable=true. Chuyện gì xảy ra?', ['Chạy bình thường', 'Mọi tin lỗi chuyển đổi, vì thiếu vỏ schema/payload', 'Chỉ tin đầu tiên lỗi', 'Connect tự sửa converter'], 1, 'schemas.enable=true bắt mỗi tin phải có vỏ {"schema":...,"payload":...}. Sửa: schemas.enable=false.'),
            q('Việc nào SMT không làm được?', ['Thêm một trường vào tin', 'Che một trường chứa dữ liệu cá nhân', 'Đếm số tin theo từng khách hàng', 'Đổi tên topic đích'], 2, 'SMT chỉ nhìn một tin mỗi lần. Đếm, join, gộp là việc của Kafka Streams.'),
          ],
        },
      ],
    },
    {
      id: 'offset-dlq',
      title: 'Offset của connector và tin hỏng',
      blocks: [
        { kind: 'video', scenes: ['offsets'] },
        {
          kind: 'table',
          head: ['Loại', 'Lưu cái gì', 'Lưu ở đâu'],
          rows: [
            ['Source', 'vị trí **trong hệ thống nguồn**: byte thứ mấy của file, vị trí binlog của DB…', 'file (standalone) hoặc topic offset (distributed)'],
            ['Sink', 'offset Kafka như mọi consumer', 'consumer group `connect-<tên connector>`'],
          ],
        },
        { kind: 'p', text: 'Ví dụ từ lab: file có 4 dòng `dong 1` … `dong 4`, mỗi dòng 7 byte (kể cả ký tự xuống dòng) → source offset lưu `{"position":28}`. Worker khởi động lại thì đọc tiếp từ byte 28, không gửi trùng. Source offset là cặp **(partition nguồn, offset nguồn)** theo nghĩa của hệ thống nguồn: với file là (tên file, vị trí), với JDBC là (bảng, id hoặc timestamp). Cách chia "partition nguồn" quyết định connector chạy song song được bao nhiêu. (📘 sách, ch.9)' },
        {
          kind: 'list',
          items: [
            { title: 'Source', text: 'worker gửi bản ghi vào Kafka, broker **xác nhận xong** mới lưu source offset. Chết giữa hai bước → đọc lại từ offset cũ → gửi lại một đoạn: **trùng, không mất**.' },
            { title: 'Sink', text: 'connector ghi ra đích (`put()`) báo thành công thì worker mới commit offset Kafka. Cùng logic: chết giữa hai bước → ghi lại vào đích.' },
          ],
        },
        { kind: 'callout', tone: 'info', title: '🎓 Nâng cao: exactly-once', text: 'Sink có thể đạt exactly-once **không cần** transaction Kafka: lưu offset Kafka ngay trong hệ thống đích, cùng một giao dịch với dữ liệu, rồi khi khởi động đọc offset từ đích. Từ Kafka 3.3, source connector hỗ trợ exactly-once ở distributed mode (KIP-618) nếu connector hỗ trợ. (📘 sách, ch.9)' },
        { kind: 'video', scenes: ['dlq'] },
        {
          kind: 'table',
          head: ['Cấu hình', 'Khi một tin lỗi (converter/SMT không xử lý được)'],
          rows: [
            ['`errors.tolerance=none` (mặc định)', 'Task **dừng** ngay (FAILED). Không mất tin, nhưng cả đường ống đứng'],
            ['`errors.tolerance=all`', 'Bỏ qua tin lỗi, chạy tiếp'],
            ['`all` + `errors.deadletterqueue.topic.name=dlq-orders`', 'Bỏ qua **và** chép tin lỗi sang topic DLQ để xem lại (chỉ cho sink connector)'],
          ],
        },
        { kind: 'p', text: 'Thêm `errors.deadletterqueue.context.headers.enable=true` để tin trong DLQ mang header ghi lý do lỗi. Hình ảnh: bưu cục gặp phong bì không đọc được. `none`: cả bưu cục ngừng chờ xử lý; `all`: vứt thư đi; DLQ: bỏ vào **thùng "thư không phát được"** để người khác xử lý sau, dây chuyền vẫn chạy.' },
        { kind: 'callout', tone: 'warn', title: '`errors.tolerance=all` mà không có DLQ', text: 'Là **lặng lẽ mất dữ liệu**: tin lỗi bị bỏ qua mà không để lại dấu vết (chỉ có thể có dòng log), không ai biết để sửa và chạy lại. Ngoài ra DLQ chỉ hứng lỗi ở giai đoạn converter và SMT; lỗi bên trong connector khi ghi ra đích do connector tự quyết (connector hiện đại có thể dùng "errant record reporter", KIP-610). Đừng ghi mật khẩu DB thẳng vào cấu hình: dùng config provider.' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Vì sao FileStreamSource lưu offset là position (byte) chứ không phải offset Kafka?', ['Vì Kafka không có offset', 'Vì source phải nhớ đã đọc đến đâu trong nguồn (file) để lần sau đọc tiếp', 'Vì byte nhỏ hơn số', 'Vì sink cần như vậy'], 1, 'Offset Kafka chỉ cho biết tin nằm đâu trong topic, không cho biết dòng tiếp theo nằm ở byte nào của file.'),
            q('Vì sao errors.tolerance=all mà không bật DLQ là cấu hình nguy hiểm?', ['Vì task chạy chậm hơn', 'Vì tin lỗi bị bỏ qua mà không để lại dấu vết nào, dữ liệu mất mà không ai biết', 'Vì broker từ chối', 'Vì Connect tự dừng'], 1, 'DLQ giữ lại tin lỗi để điều tra và xử lý lại.'),
          ],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: chia task và tin hỏng',
      blocks: [
        { kind: 'p', text: 'Chọn chế độ, số worker và tasks.max để xem ai chạy task nào, rồi cho một worker chết. Sau đó chọn kiểu lỗi, errors.tolerance và DLQ để xem bao nhiêu tin được ghi, bao nhiêu nằm trong DLQ và bao nhiêu mất lặng lẽ.' },
        { kind: 'widget', name: 'connect-lab' },
      ],
    },
    {
      id: 'tom-tat-video',
      title: 'Nhìn lại cả bài',
      blocks: [{ kind: 'video', scenes: ['summary'] }],
    },
  ],
  finalQuiz: [
    q('Trong Connect, "đơn vị thực sự sao chép dữ liệu" là gì?', ['Worker', 'Connector', 'Task', 'Converter'], 2, 'Worker là tiến trình, connector là cấu hình + chia việc, task mới làm việc sao chép.'),
    q('Distributed mode lưu cấu hình, offset và trạng thái ở đâu?', ['File cục bộ', 'Ba topic nội bộ compacted trong Kafka', 'Zookeeper', 'Trong bộ nhớ worker'], 1, 'Nhờ vậy worker nào cũng thay được worker nào.'),
    q('Source connector lưu offset khi nào để không mất tin?', ['Trước khi gửi vào Kafka', 'Sau khi broker xác nhận đã nhận', 'Mỗi giây một lần', 'Không cần lưu'], 1, 'Chết giữa hai bước chỉ gây gửi trùng, không gây mất tin (at-least-once).'),
    q('Tin hỏng, errors.tolerance=none (mặc định). Chuyện gì xảy ra?', ['Tin bị bỏ qua', 'Tin vào DLQ', 'Task dừng (FAILED), không mất tin nhưng đường ống đứng', 'Connect tự sửa tin'], 2, 'Muốn chạy tiếp mà vẫn giữ tin lỗi: tolerance=all kèm DLQ.'),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao errors.tolerance=all mà không bật DLQ là cấu hình nguy hiểm?',
      keywords: ['bỏ qua', 'mất', 'dấu vết', 'DLQ'],
      modelAnswer: 'Vì tolerance=all khiến tin lỗi bị bỏ qua và đường ống chạy tiếp, nhưng nếu không có DLQ thì tin đó không được lưu ở đâu cả (chỉ có thể có một dòng log). Dữ liệu mất mà không ai biết để sửa và chạy lại. Có DLQ thì tin lỗi được chép sang topic riêng cùng header ghi lý do, nên vẫn điều tra và xử lý lại được.',
    },
  ],
  recap: {
    journey:
      'Tự viết chương trình cho từng hệ thống thì lặp lại phần ống nước → Connect lo sẵn: source đưa vào Kafka, sink đưa ra → worker chạy, connector chia việc, task sao chép → distributed lưu trạng thái trong Kafka nên worker nào cũng thay được → tin đi qua SMT rồi converter, đầu đọc phải khớp đầu ghi → source offset nằm ở nguồn, sink offset là offset Kafka → tin hỏng thì tolerance và DLQ quyết định dừng, mất hay giữ lại.',
    points: [
      { title: 'Ai làm gì', text: 'Worker lo ống nước, connector chia việc, task sao chép. Số task = min(tasks.max, số bảng hoặc partition).' },
      { title: 'Distributed', text: 'Cấu hình, offset, trạng thái nằm trong 3 topic compacted; một worker chết thì task chia lại.' },
      { title: 'SMT & converter', text: 'SMT sửa từng tin; converter đầu đọc phải khớp đầu ghi. Source offset ở nguồn, sink offset ở Kafka.' },
      { title: 'Tin hỏng', text: 'none dừng task; all bỏ qua; all + DLQ giữ lại tin lỗi để xem sau.' },
    ],
    next: 'Bài tiếp theo: Kafka Streams — thư viện xử lý luồng, KStream và KTable.',
  },
}
