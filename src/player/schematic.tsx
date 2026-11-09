/**
 * Schematic visual language: flat, thin strokes, almost no glow. Each Kafka concept has ONE recognisable shape
 * reused across lessons — a log is a tape of numbered cells, a broker is a server unit, replication is a cursor
 * copying cells from one tape to another.
 */
import type { CSSProperties, ReactNode } from 'react'
import { MONO } from '../remotion/video-fonts'
import { HOME, Scene, TitleCard, clamp, lerp, sp } from './motion-kit'

export const INK = {
  bg: '#0b0f17',
  line: '#3a4458',
  dim: '#5b6578',
  text: '#d6dbe4',
  faint: '#8a93a6',
  accent: '#4f8cff',
  warn: '#f0a43a',
  bad: '#ef5350',
  good: '#3ecf8e',
}

const label: CSSProperties = { fontFamily: MONO, fontSize: 26, letterSpacing: 2, color: INK.faint, textTransform: 'uppercase' }

/** A server unit: a 2U box with two drive bays and status LED. `down` draws it unpowered with a strike line. */
export function ServerUnit({ x, y, name, down = false, accent = INK.accent, t = 0 }: { x: number; y: number; name: string; down?: boolean; accent?: string; t?: number }) {
  const led = down ? INK.bad : Math.sin(t * 6) > 0 ? accent : INK.dim
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: 260 }}>
      <svg width={260} height={130} viewBox="0 0 220 110">
        <rect x="2" y="2" width="216" height="106" rx="6" fill={INK.bg} stroke={down ? INK.bad : INK.line} strokeWidth="2" />
        <line x1="2" y1="55" x2="218" y2="55" stroke={INK.line} strokeWidth="2" />
        {[0, 1].map((r) => (
          <g key={r}>
            {[0, 1, 2, 3].map((k) => (
              <rect key={k} x={16 + k * 30} y={16 + r * 53} width="22" height="24" rx="2" fill="none" stroke={down ? INK.dim : INK.line} strokeWidth="2" />
            ))}
            <circle cx={186} cy={28 + r * 53} r="6" fill={r === 0 ? led : INK.dim} />
          </g>
        ))}
        {down && <line x1="10" y1="100" x2="210" y2="10" stroke={INK.bad} strokeWidth="3" />}
      </svg>
      <div style={{ ...label, marginTop: 8, color: down ? INK.bad : INK.text }}>{name}</div>
    </div>
  )
}

export type CellState = 'empty' | 'filled' | 'new' | 'missing' | 'dead'

/**
 * The log as a tape of cells. `state(i)` decides each cell; offsets are printed under every `tick`-th cell.
 * `cursor` (cell index, fractional) draws a thin write head.
 */
export function LogTape({
  x,
  y,
  cells,
  cellW = 46,
  state,
  offsetOf = (i) => i,
  tick = 5,
  cursor,
  cursorLabel,
  title,
  marks = [],
}: {
  /** Vertical markers at a cell boundary, e.g. HW / LEO / committed offset. */
  marks?: { at: number; label: string; color?: string }[]
  x: number
  y: number
  cells: number
  cellW?: number
  state: (i: number) => CellState
  offsetOf?: (i: number) => number
  tick?: number
  cursor?: number
  cursorLabel?: string
  title?: ReactNode
}) {
  const h = 70
  const fill: Record<CellState, string> = { empty: 'transparent', filled: '#2a3a5c', new: INK.accent, missing: 'transparent', dead: '#1d2230' }
  return (
    <div style={{ position: 'absolute', left: x, top: y }}>
      {title && <div style={{ ...label, marginBottom: 10 }}>{title}</div>}
      <div style={{ position: 'relative', display: 'flex' }}>
        {Array.from({ length: cells }, (_, i) => {
          const st = state(i)
          return (
            <div
              key={i}
              style={{
                width: cellW,
                height: h,
                boxSizing: 'border-box',
                borderTop: `2px solid ${st === 'missing' ? INK.bad : INK.line}`,
                borderBottom: `2px solid ${st === 'missing' ? INK.bad : INK.line}`,
                borderLeft: `2px ${st === 'missing' ? 'dashed' : 'solid'} ${st === 'missing' ? INK.bad : INK.line}`,
                borderRight: i === cells - 1 ? `2px solid ${INK.line}` : undefined,
                background: fill[st],
              }}
            />
          )
        })}
        {marks.map((m) => (
          <div key={m.label} style={{ position: 'absolute', left: m.at * cellW - 1, top: -44, width: 3, height: h + 44, background: m.color ?? INK.text }}>
            <div style={{ position: 'absolute', left: -60, width: 120, top: -34, textAlign: 'center', fontFamily: MONO, fontSize: 24, fontWeight: 700, color: m.color ?? INK.text }}>{m.label}</div>
          </div>
        ))}
        {cursor !== undefined && (
          <div style={{ position: 'absolute', left: clamp(cursor, 0, cells) * cellW - 1, top: -16, width: 3, height: h + 32, background: INK.warn }}>
            {cursorLabel && <div style={{ position: 'absolute', left: 8, top: -6, fontFamily: MONO, fontSize: 24, color: INK.warn, whiteSpace: 'nowrap' }}>{cursorLabel}</div>}
          </div>
        )}
      </div>
      <div style={{ position: 'relative', height: 30 }}>
        {Array.from({ length: cells }, (_, i) =>
          i % tick === 0 ? (
            <span key={i} style={{ position: 'absolute', left: i * cellW, top: 6, fontFamily: MONO, fontSize: 22, color: INK.faint }}>
              {offsetOf(i)}
            </span>
          ) : null,
        )}
      </div>
    </div>
  )
}

/** Thin arrow between two points with an optional label at the middle. */
export function Wire({ from, to, label: text, color = INK.line, p = 1, dashed = false }: { from: { x: number; y: number }; to: { x: number; y: number }; label?: string; color?: string; p?: number; dashed?: boolean }) {
  const ex = lerp(from.x, to.x, clamp(p))
  const ey = lerp(from.y, to.y, clamp(p))
  const ang = Math.atan2(to.y - from.y, to.x - from.x)
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
      <line x1={from.x} y1={from.y} x2={ex} y2={ey} stroke={color} strokeWidth={2.5} strokeDasharray={dashed ? '8 8' : undefined} />
      {p >= 1 && <path d={`M${to.x} ${to.y} l${-14 * Math.cos(ang - 0.4)} ${-14 * Math.sin(ang - 0.4)} M${to.x} ${to.y} l${-14 * Math.cos(ang + 0.4)} ${-14 * Math.sin(ang + 0.4)}`} stroke={color} strokeWidth={2.5} fill="none" />}
      {text && p >= 1 && (
        <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 12} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="24" fill={color}>
          {text}
        </text>
      )}
    </svg>
  )
}

/** A short annotation: a hairline from a point to a label, like a callout on a technical drawing. */
export function Note({ x, y, dx = 60, dy = -60, text, color = INK.text, o = 1 }: { x: number; y: number; dx?: number; dy?: number; text: string; color?: string; o?: number }) {
  return (
    <div style={{ opacity: clamp(o) }}>
      <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
        <circle cx={x} cy={y} r={4} fill={color} />
        <polyline points={`${x},${y} ${x + dx},${y + dy} ${x + dx + (dx >= 0 ? 30 : -30)},${y + dy}`} fill="none" stroke={color} strokeWidth={1.5} />
      </svg>
      <div style={{ position: 'absolute', left: dx >= 0 ? x + dx + 38 : undefined, right: dx < 0 ? 1920 - (x + dx - 38) : undefined, top: y + dy - 20, fontSize: 34, fontWeight: 600, color, whiteSpace: 'nowrap' }}>{text}</div>
    </div>
  )
}

/** Producer: a small terminal window with a prompt line. */
export function ProducerBox({ x, y, title = 'producer', line, w = 300 }: { x: number; y: number; title?: string; line?: string; w?: number }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, border: `2px solid ${INK.line}`, borderRadius: 8, background: INK.bg, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: `2px solid ${INK.line}` }}>
        {[0, 1, 2].map((k) => (
          <span key={k} style={{ width: 10, height: 10, borderRadius: 5, border: `2px solid ${INK.dim}` }} />
        ))}
        <span style={{ marginLeft: 8, fontFamily: MONO, fontSize: 20, color: INK.faint }}>{title}</span>
      </div>
      <div style={{ padding: '12px 14px', fontFamily: MONO, fontSize: 24, color: INK.text, minHeight: 40 }}>
        <span style={{ color: INK.accent }}>$ </span>
        {line}
      </div>
    </div>
  )
}

/** A single message as a flat cell (same look as a tape cell), for things in flight. */
export function MessageCell({ x, y, label, color = INK.accent, w = 66 }: { x: number; y: number; label?: string; color?: string; w?: number }) {
  return (
    <div style={{ position: 'absolute', left: x - w / 2, top: y - 35, width: w, height: 70, boxSizing: 'border-box', border: `2px solid ${color}`, background: `${color}33`, display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 22, fontWeight: 700, color: INK.text, whiteSpace: 'nowrap' }}>
      {label}
    </div>
  )
}

/** Consumer reading a tape: a caret under the tape at cell `at`, with its name and current offset. */
export function ConsumerCaret({ tapeX, tapeY, cellW = 66, at, name, offset, color = INK.good }: { tapeX: number; tapeY: number; cellW?: number; at: number; name: string; offset?: number; color?: string }) {
  const x = tapeX + at * cellW
  return (
    <div style={{ position: 'absolute', left: x - 90, top: tapeY + 110, width: 180, textAlign: 'center' }}>
      <svg width={180} height={26} viewBox="0 0 180 26">
        <path d="M90 2 L104 24 L76 24 Z" fill={color} />
      </svg>
      <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, color }}>{name}</div>
      {offset !== undefined && <div style={{ fontFamily: MONO, fontSize: 20, color: INK.faint }}>offset {offset}</div>}
    </div>
  )
}

/** A topic: several partition tapes stacked, each labelled P0, P1, … */
export function PartitionTapes({ x, y, partitions, cells, cellW = 66, gap = 150, state, offsetOf }: { x: number; y: number; partitions: number; cells: number; cellW?: number; gap?: number; state: (p: number, i: number) => CellState; offsetOf?: (i: number) => number }) {
  return (
    <>
      {Array.from({ length: partitions }, (_, p) => (
        <div key={p}>
          <div style={{ position: 'absolute', left: x - 90, top: y + p * gap + 16, fontFamily: MONO, fontSize: 30, fontWeight: 700, color: INK.text }}>P{p}</div>
          <LogTape x={x} y={y + p * gap} cells={cells} cellW={cellW} state={(i) => state(p, i)} offsetOf={offsetOf} />
        </div>
      ))}
    </>
  )
}

/** Big plain statement for the "aha" line: no glow, accent colour only. */
export function Statement({ x, y, text, color = INK.text, size = 48, o = 1 }: { x: number; y: number; text: string; color?: string; size?: number; o?: number }) {
  return <div style={{ position: 'absolute', left: x, top: y, fontSize: size, fontWeight: 700, color, opacity: clamp(o), transform: `translateY(${(1 - clamp(o)) * 16}px)`, whiteSpace: 'nowrap' }}>{text}</div>
}

/* ---------------------------------------------------------------- replica rows */

/** Shared layout for "one row per replica": server on the left, its copy of the log as a tape on the right. */
export const REPLICA = {
  CW: 66,
  CELLS: 16,
  TX: 440,
  ROWS: [300, 530, 760],
  cellX: (i: number) => 440 + i * 66,
  panel: { position: 'absolute' as const, fontFamily: MONO, fontSize: 30, fontWeight: 700, color: INK.text, padding: '10px 18px', border: `2px solid ${INK.line}`, borderRadius: 6, background: INK.bg },
}

export function Replica({ row, name, leo, down = false, dim = false, state, marks, cursor, cursorLabel, t, accent }: { row: number; name: string; leo: number; down?: boolean; dim?: boolean; state?: (i: number) => CellState; marks?: { at: number; label: string; color?: string }[]; cursor?: number; cursorLabel?: string; t: number; accent?: string }) {
  const y = REPLICA.ROWS[row]
  return (
    <div style={{ opacity: dim ? 0.35 : 1 }}>
      <ServerUnit x={120} y={y - 30} name={name} down={down} t={t} accent={accent} />
      <LogTape x={REPLICA.TX} y={y} cells={REPLICA.CELLS} cellW={REPLICA.CW} state={state ?? ((i) => (down ? (i < leo ? 'dead' : 'empty') : i < leo ? 'filled' : 'empty'))} marks={marks} cursor={cursor} cursorLabel={cursorLabel} />
    </div>
  )
}

/** Closing scene: numbered lines; the line being narrated is highlighted (beat k = item k). */
export function SummaryList({ t, cue, items }: { t: number; cue: { at: (k: number) => number; end: (k: number) => number }; items: string[] }) {
  const last = items.length - 1
  return (
    <Scene t={t} camera={{ ...HOME, s: 1 }} backdrop="plain" overlay={<TitleCard t={t} at={0.1} kicker="TÓM TẮT" title="Bốn ý cần nhớ" dock={0.9} />}>
      {items.map((text, i) => {
        const active = t >= cue.at(i) && t < cue.at(i + 1)
        return (
          <div key={text} style={{ position: 'absolute', left: 260, top: 260 + i * 160, display: 'flex', alignItems: 'center', gap: 40, opacity: clamp(sp(t, cue.at(i))) * (active || t >= cue.end(last) ? 1 : 0.55) }}>
            <div style={{ width: 84, height: 84, border: `3px solid ${active ? INK.accent : INK.line}`, display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 40, fontWeight: 700, color: active ? INK.accent : INK.text }}>{i + 1}</div>
            <div style={{ fontSize: 48, fontWeight: 600, color: INK.text }}>{text}</div>
          </div>
        )
      })}
    </Scene>
  )
}
