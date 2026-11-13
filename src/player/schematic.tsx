/**
 * Schematic visual language: flat, thin strokes, almost no glow. Each Kafka concept has ONE recognisable shape
 * reused across lessons — a log is a tape of numbered cells, a broker is a server unit, replication is a cursor
 * copying cells from one tape to another.
 */
import { createContext, useContext, type CSSProperties, type ReactNode } from 'react'
import { Img, staticFile } from 'remotion'
import { MONO } from '../remotion/video-fonts'
import { HOME, Scene, TitleCard, clamp, lerp, move, sp, span, type Shot } from './motion-kit'

/** Dark flat palette (lessons made before the soft style). */
const DARK = {
  soft: false,
  bg: '#0b0f17',
  line: '#3a4458',
  dim: '#5b6578',
  text: '#d6dbe4',
  faint: '#8a93a6',
  accent: '#4f8cff',
  warn: '#f0a43a',
  bad: '#ef5350',
  good: '#3ecf8e',
  /** Surface of boxes, panels, units. */
  card: { background: '#0b0f17', border: '2px solid #3a4458', borderRadius: 8 } as CSSProperties,
  cell: { filled: '#2a3a5c', new: '#4f8cff', dead: '#1d2230', empty: 'transparent' },
}
export type Ink = typeof DARK

/**
 * Deep navy glow style (standard from the Consumer group lesson): navy world with vignette, translucent blue
 * cards with luminous outlines, glossy 3D blue objects with white highlights, glowing pills, white heavy type.
 */
export const SOFT: Ink = {
  soft: true,
  bg: '#081544',
  line: '#3a5fc4',
  dim: '#4a5f99',
  text: '#ffffff',
  faint: '#9fb6ee',
  accent: '#5b97ff',
  warn: '#ffb547',
  bad: '#ff5a6a',
  good: '#3ee6a0',
  card: {
    background: 'linear-gradient(160deg, rgba(28,58,160,0.72) 0%, rgba(10,24,86,0.86) 100%)',
    border: '1.5px solid rgba(110,160,255,0.65)',
    borderRadius: 22,
    boxShadow: '0 0 26px rgba(61,123,255,0.35), 0 24px 50px rgba(0,4,30,0.55), inset 0 1px 0 rgba(255,255,255,0.18)',
  },
  cell: { filled: 'linear-gradient(160deg, #78b0ff 0%, #2f66f2 55%, #1c3fc4 100%)', new: 'linear-gradient(160deg, #e6f0ff 0%, #9cc2ff 100%)', dead: 'rgba(40,62,140,0.5)', empty: 'rgba(12,30,96,0.55)' },
}
/** Glossy 3D blue for the subject of a scene (active consumer, coordinator, highlighted row). */
export const HERO = 'linear-gradient(160deg, #6aa8ff 0%, #2f66f2 50%, #1a3cc0 100%)'
const HERO_SHADOW = '0 0 34px rgba(77,141,255,0.6), 0 24px 50px rgba(0,4,30,0.6), inset 0 2px 0 rgba(255,255,255,0.5), inset 0 -8px 16px rgba(0,10,60,0.35)'
/** Dark pill with a luminous outline (search-bar look) for labels and requests. */
const GLOW_PILL: CSSProperties = { background: 'rgba(8,22,82,0.92)', border: '1.5px solid #6ea2ff', boxShadow: '0 0 18px rgba(77,141,255,0.65), inset 0 1px 0 rgba(255,255,255,0.15)', color: '#ffffff' }

/** Old lessons import INK directly and stay dark. Components read the palette from context instead. */
export const INK = DARK
const InkContext = createContext<Ink>(DARK)
export const useInk = () => useContext(InkContext)
/** Wrap a scene (or the summary) to draw every schematic component in the soft light style. */
export const SoftTheme = ({ children }: { children: ReactNode }) => <InkContext.Provider value={SOFT}>{children}</InkContext.Provider>

const labelStyle = (ink: Ink): CSSProperties => ({ fontFamily: ink.soft ? undefined : MONO, fontSize: 26, fontWeight: ink.soft ? 700 : 400, letterSpacing: ink.soft ? 0.5 : 2, color: ink.faint, textTransform: ink.soft ? 'none' : 'uppercase' })

/** A server unit: a 2U box with two drive bays and status LED. `down` draws it unpowered with a strike line. */
export function ServerUnit({ x, y, name, down = false, accent, t = 0 }: { x: number; y: number; name: string; down?: boolean; accent?: string; t?: number }) {
  const INK = useInk()
  accent = accent ?? INK.accent
  const led = down ? INK.bad : Math.sin(t * 6) > 0 ? accent : INK.dim
  if (INK.soft)
    return (
      <div style={{ position: 'absolute', left: x, top: y, width: 260 }}>
        <div style={{ position: 'relative', width: 260, height: 130, boxSizing: 'border-box', padding: '20px 22px', display: 'grid', gap: 14, overflow: 'hidden', borderRadius: 28, background: down ? (INK.card.background as string) : HERO, boxShadow: down ? INK.card.boxShadow : HERO_SHADOW, border: down ? `2px solid ${INK.bad}` : undefined }}>
          {[0, 1].map((r) => (
            <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {[0, 1, 2, 3].map((k) => (
                <span key={k} style={{ width: 26, height: 30, borderRadius: 8, background: down ? 'rgba(80,100,160,0.5)' : 'rgba(255,255,255,0.92)', boxShadow: down ? undefined : '0 4px 10px rgba(0,8,50,0.45)' }} />
              ))}
              <span style={{ marginLeft: 'auto', width: 14, height: 14, borderRadius: 7, background: down ? INK.bad : r === 0 && Math.sin(t * 6) > 0 ? '#ffffff' : 'rgba(255,255,255,0.45)', boxShadow: r === 0 && !down ? '0 0 12px #ffffff' : undefined }} />
            </div>
          ))}
          {down && <div style={{ position: 'absolute', left: 20, right: 20, top: 63, height: 4, borderRadius: 2, background: INK.bad, transform: 'rotate(-24deg)' }} />}
        </div>
        <div style={{ ...labelStyle(INK), marginTop: 14, fontWeight: 800, color: down ? INK.bad : INK.text }}>{name}</div>
      </div>
    )
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
      <div style={{ ...labelStyle(INK), marginTop: 8, color: down ? INK.bad : INK.text }}>{name}</div>
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
  const INK = useInk()
  const h = 70
  const fill: Record<CellState, string> = { ...INK.cell, missing: 'transparent' }
  return (
    <div style={{ position: 'absolute', left: x, top: y }}>
      {title && <div style={{ ...labelStyle(INK), marginBottom: 10 }}>{title}</div>}
      <div style={{ position: 'relative', display: 'flex' }}>
        {Array.from({ length: cells }, (_, i) => {
          const st = state(i)
          if (INK.soft)
            return (
              <div key={i} style={{ width: cellW, height: h, padding: '0 3px', boxSizing: 'border-box' }}>
                <div
                  style={{
                    height: '100%',
                    borderRadius: 14,
                    boxSizing: 'border-box',
                    background: fill[st],
                    border: st === 'missing' ? `2px dashed ${INK.bad}` : st === 'empty' ? '1.5px solid rgba(110,160,255,0.35)' : st === 'new' ? '2px solid #ffffff' : 'none',
                    boxShadow:
                      st === 'new'
                        ? '0 0 22px rgba(140,185,255,0.95), inset 0 2px 0 #ffffff'
                        : st === 'filled'
                          ? 'inset 0 2px 0 rgba(255,255,255,0.5), 0 0 14px rgba(77,141,255,0.35), 0 10px 20px rgba(0,8,50,0.45)'
                          : undefined,
                  }}
                />
              </div>
            )
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
          <div key={m.label} style={{ position: 'absolute', left: m.at * cellW - 1.5, top: -44, width: 3, height: h + 52, borderRadius: 2, background: m.color ?? INK.text }}>
            {INK.soft ? (
              <div style={{ position: 'absolute', left: '50%', top: -44, transform: 'translateX(-50%)', ...GLOW_PILL, padding: '6px 16px', borderRadius: 999, fontSize: 26, fontWeight: 800, color: m.color ?? INK.text, whiteSpace: 'nowrap' }}>{m.label}</div>
            ) : (
              <div style={{ position: 'absolute', left: -60, width: 120, top: -34, textAlign: 'center', fontFamily: MONO, fontSize: 24, fontWeight: 700, color: m.color ?? INK.text }}>{m.label}</div>
            )}
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
            <span key={i} style={{ position: 'absolute', left: i * cellW, width: INK.soft ? cellW : undefined, textAlign: INK.soft ? 'center' : undefined, top: 8, fontFamily: MONO, fontSize: 22, color: INK.faint }}>
              {offsetOf(i)}
            </span>
          ) : null,
        )}
      </div>
    </div>
  )
}

/** Thin arrow between two points with an optional label at the middle. */
/** `flow` (scene time) makes the dashes march from → to, for a live connection. */
export function Wire({ from, to, label: text, color, p = 1, dashed = false, flow }: { from: { x: number; y: number }; to: { x: number; y: number }; label?: string; color?: string; p?: number; dashed?: boolean; flow?: number }) {
  const INK = useInk()
  color = color ?? INK.line
  const ex = lerp(from.x, to.x, clamp(p))
  const ey = lerp(from.y, to.y, clamp(p))
  const ang = Math.atan2(to.y - from.y, to.x - from.x)
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
      <line x1={from.x} y1={from.y} x2={ex} y2={ey} stroke={color} strokeWidth={INK.soft ? 3 : 2.5} strokeLinecap="round" strokeDasharray={dashed || flow !== undefined ? (INK.soft ? '1 12' : '8 8') : undefined} strokeDashoffset={flow !== undefined ? -flow * 40 : undefined} opacity={INK.soft ? 0.85 : 1} />
      {p >= 1 && <path d={`M${to.x} ${to.y} l${-14 * Math.cos(ang - 0.4)} ${-14 * Math.sin(ang - 0.4)} M${to.x} ${to.y} l${-14 * Math.cos(ang + 0.4)} ${-14 * Math.sin(ang + 0.4)}`} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" />}
      {text && p >= 1 && (
        <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 12} textAnchor="middle" fontFamily={INK.soft ? 'Be Vietnam Pro, sans-serif' : 'JetBrains Mono, monospace'} fontWeight={INK.soft ? 600 : 400} fontSize="24" fill={color}>
          {text}
        </text>
      )}
    </svg>
  )
}

/** A short annotation: a hairline from a point to a label, like a callout on a technical drawing. */
export function Note({ x, y, dx = 60, dy = -60, text, color, o = 1 }: { x: number; y: number; dx?: number; dy?: number; text: string; color?: string; o?: number }) {
  const INK = useInk()
  color = color ?? INK.text
  return (
    <div style={{ opacity: clamp(o) }}>
      <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
        <circle cx={x} cy={y} r={4} fill={color} />
        <polyline points={`${x},${y} ${x + dx},${y + dy} ${x + dx + (dx >= 0 ? 30 : -30)},${y + dy}`} fill="none" stroke={color} strokeWidth={1.5} />
      </svg>
      <div style={{ position: 'absolute', left: dx >= 0 ? x + dx + 38 : undefined, right: dx < 0 ? 1920 - (x + dx - 38) : undefined, top: y + dy - (INK.soft ? 26 : 20), fontSize: INK.soft ? 30 : 34, fontWeight: 600, color, whiteSpace: 'nowrap', ...(INK.soft ? { ...GLOW_PILL, color, padding: '8px 20px', borderRadius: 999, fontWeight: 700 } : {}) }}>{text}</div>
    </div>
  )
}

/** Producer: a small terminal window with a prompt line. */
export function ProducerBox({ x, y, title = 'producer', line, w = 300 }: { x: number; y: number; title?: string; line?: string; w?: number }) {
  const INK = useInk()
  if (INK.soft)
    return (
      <div style={{ ...INK.card, position: 'absolute', left: x, top: y, width: w, boxSizing: 'border-box', padding: '16px 22px' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: INK.faint }}>{title}</div>
        <div style={{ marginTop: 4, fontSize: 32, fontWeight: 800, letterSpacing: -0.5, color: INK.text, whiteSpace: 'nowrap' }}>{line}</div>
      </div>
    )
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
export function MessageCell({ x, y, label, color, w = 66 }: { x: number; y: number; label?: string; color?: string; w?: number }) {
  const INK = useInk()
  color = color ?? INK.accent
  return (
    <div style={{ position: 'absolute', left: x - w / 2, top: y - 35, width: w, height: 70, boxSizing: 'border-box', border: `2px solid ${color}`, background: `${color}33`, display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 22, fontWeight: 700, color: INK.text, whiteSpace: 'nowrap' }}>
      {label}
    </div>
  )
}

/** Consumer reading a tape: a caret under the tape at cell `at`, with its name and current offset. */
export function ConsumerCaret({ tapeX, tapeY, cellW = 66, at, name, offset, color }: { tapeX: number; tapeY: number; cellW?: number; at: number; name: string; offset?: number; color?: string }) {
  const INK = useInk()
  color = color ?? INK.good
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
  const INK = useInk()
  return (
    <>
      {Array.from({ length: partitions }, (_, p) => (
        <div key={p}>
          <div style={{ position: 'absolute', left: x - 90, top: y + p * gap + 16, fontFamily: INK.soft ? undefined : MONO, fontSize: 30, fontWeight: 700, color: INK.text }}>P{p}</div>
          <LogTape x={x} y={y + p * gap} cells={cells} cellW={cellW} state={(i) => state(p, i)} offsetOf={offsetOf} />
        </div>
      ))}
    </>
  )
}

/** Big plain statement for the "aha" line: no glow, accent colour only. */
export function Statement({ x, y, text, color, size = 48, o = 1 }: { x: number; y: number; text: string; color?: string; size?: number; o?: number }) {
  const INK = useInk()
  color = color ?? INK.text
  if (INK.soft) {
    const q = clamp(o)
    return (
      <div style={{ position: 'absolute', left: x, top: y, fontSize: size, fontWeight: 800, letterSpacing: -0.5, color, whiteSpace: 'nowrap' }}>
        {text.split(' ').map((w, k, all) => {
          const p = clamp(q * (1 + all.length * 0.12) - k * 0.12)
          return (
            <span key={k} style={{ display: 'inline-block', marginRight: size * 0.26, opacity: p, filter: p < 0.98 ? `blur(${(1 - p) * 8}px)` : undefined, transform: `translateY(${(1 - p) * 24}px)` }}>
              {w}
            </span>
          )
        })}
      </div>
    )
  }
  return <div style={{ position: 'absolute', left: x, top: y, fontSize: size, fontWeight: INK.soft ? 800 : 700, letterSpacing: INK.soft ? -0.5 : 0, color, opacity: clamp(o), transform: `translateY(${(1 - clamp(o)) * 16}px)`, whiteSpace: 'nowrap' }}>{text}</div>
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

/** Frosted glass panel for readouts (counters, code, tables) in the soft style. */
export const SOFT_PANEL: CSSProperties = { ...SOFT.card, position: 'absolute', fontSize: 30, fontWeight: 700, color: SOFT.text, padding: '14px 24px' }

/**
 * Title in the white SaaS style: a pill badge (blue dot + kicker) over a heavy black title. It lands big in the
 * centre with a word-by-word blur-rise, then docks small at the top. `until` fades it out (camera push into the top).
 */
export function SoftTitle({ t, at = 0.1, kicker, title, until = Infinity }: { t: number; at?: number; kicker: string; title: string; until?: number }) {
  const d = move(t, at + 1.3, 0.9)
  const appear = clamp(sp(t, at))
  const scrim = Math.min(appear, 1 - d) * 0.97
  const o = (Number.isFinite(until) ? 1 - span(t, until, until + 0.6) : 1)
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: `rgba(4,10,42,${scrim})` }} />
      <div style={{ position: 'absolute', left: 960, top: lerp(480, 92, d), transform: `translate(-50%, -50%) scale(${lerp(1, 0.46, d)})`, textAlign: 'center', opacity: o, whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, ...GLOW_PILL, padding: '10px 22px 10px 12px', borderRadius: 999, opacity: appear, transform: `translateY(${(1 - appear) * 20}px)` }}>
          <span style={{ width: 34, height: 34, borderRadius: 17, background: HERO, boxShadow: '0 0 14px rgba(110,160,255,0.9)' }} />
          <span style={{ fontSize: 34, fontWeight: 800, color: SOFT.text }}>{kicker}</span>
        </div>
        <div style={{ marginTop: 22, fontSize: 112, fontWeight: 800, letterSpacing: -3, color: SOFT.text, lineHeight: 1.05, textShadow: '0 0 40px rgba(91,151,255,0.55)' }}>
          {title.split(' ').map((w, k) => {
            const q = clamp(sp(t, at + 0.2 + k * 0.07, 16, 140))
            return (
              <span key={k} style={{ display: 'inline-block', marginRight: 26, opacity: q, filter: q < 0.98 ? `blur(${(1 - q) * 10}px)` : undefined, transform: `translateY(${(1 - q) * 40}px)` }}>
                {w}
              </span>
            )
          })}
        </div>
      </div>
    </>
  )
}

/** A scene in the soft light style: soft backdrop, soft palette for every schematic component, corner title. */
export function SoftScene({ t, camera, title, children }: { t: number; camera: Shot; title?: { kicker: string; text: string; until?: number }; children: ReactNode }) {
  return (
    <SoftTheme>
      <Scene t={t} camera={{ ...camera, r: 0, rx: 0, ry: 0 }} backdrop="soft" overlay={title && <SoftTitle t={t} kicker={title.kicker} title={title.text} until={title.until} />}>
        {children}
      </Scene>
    </SoftTheme>
  )
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
  const INK = useInk()
  const last = items.length - 1
  if (INK.soft)
    return (
      <Scene t={t} camera={{ ...HOME, s: 1 }} backdrop="soft" overlay={<SoftTitle t={t} kicker="TÓM TẮT" title="Bốn ý cần nhớ" />}>
        {items.map((text, i) => {
          // the narrated line stays highlighted (the last one until the end, matching its subtitle); during the
          // closing hold every row breathes slightly so the frame never sits still
          const tail = t - cue.end(last) - 0.3
          // 0 → 1 over 0.35 s when the line starts, back to 0 when the next starts, so the highlight glides
          const lit = clamp(Math.min(span(t, cue.at(i), cue.at(i) + 0.35), 1 - span(t, cue.at(i + 1), cue.at(i + 1) + 0.35)))
          const breathe = tail > 0 ? 1 + 0.012 * Math.sin(tail * 3 - i * 0.9) : 1
          // all slots appear (dim) once the centred title has docked, so the layout never jumps; each line
          // lights up when it is narrated
          const p = clamp(sp(t, 1.6 + i * 0.12))
          const said = t >= cue.at(i)
          return (
            <div key={text} style={{ ...INK.card, position: 'absolute', left: 260, top: 250 + i * 170, width: 1400, height: 130, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 36, padding: '0 40px', overflow: 'hidden', opacity: p * lerp(said ? 0.7 : 0.3, 1, lit), transform: `translateY(${(1 - p) * 30}px) scale(${(1 + 0.03 * lit) * breathe})`, boxShadow: lit > 0.5 ? HERO_SHADOW : (INK.card.boxShadow as string) }}>
              {/* the highlight is a HERO layer that fades in/out, so switching lines never snaps */}
              <div style={{ position: 'absolute', inset: 0, background: HERO, opacity: lit }} />
              <div style={{ position: 'relative', width: 72, height: 72, borderRadius: 36, display: 'grid', placeItems: 'center', fontSize: 34, fontWeight: 800, color: lit > 0.5 ? '#1a3cc0' : '#ffffff', background: lit > 0.5 ? '#ffffff' : HERO, boxShadow: '0 0 16px rgba(91,151,255,0.6)' }}>{i + 1}</div>
              <div style={{ position: 'relative', fontSize: 46, fontWeight: 800, letterSpacing: -0.5, color: '#ffffff' }}>{text}</div>
            </div>
          )
        })}
      </Scene>
    )
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

/* ---------------------------------------------------------------- motion helpers (schematic) */

/** Entrance: fade + rise 28px + settle from 96% scale on a spring. Wrap any schematic element. */
export function Rise({ t, at, children, dy = 28 }: { t: number; at: number; children: ReactNode; dy?: number }) {
  // Under-damped spring: overshoots ~6% then settles, like the pop-ins in promo motion design.
  const k = sp(t, at, 12, 150)
  if (k <= 0) return null
  const o = clamp(k * 1.6)
  return <div style={{ opacity: o, filter: o < 0.98 ? `blur(${(1 - o) * 6}px)` : undefined, transform: `translateY(${(1 - k) * dy}px) scale(${0.9 + 0.1 * k})`, transformOrigin: 'center' }}>{children}</div>
}

/** A diagonal light sweep across a surface, repeating every `every` seconds (offset by `phase`). Parent needs overflow hidden. */
export function Sheen({ t, every = 6, phase = 0 }: { t: number; every?: number; phase?: number }) {
  const p = ((t + phase) % every) / 0.9
  if (p > 1) return null
  return <div style={{ position: 'absolute', top: -40, bottom: -40, left: `${lerp(-40, 130, p)}%`, width: '18%', background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.22), transparent)', transform: 'skewX(-18deg)', pointerEvents: 'none' }} />
}


type Pt = { x: number; y: number }

/**
 * Messages in flight: small cells emitted every `every` seconds between `start` and `end`, each travelling
 * from → to in `len` seconds on a gentle arc (ease in-out), fading at both ends. Deterministic in t.
 */
export function Packets({ t, from, to, start, end = Infinity, every = 0.35, len = 0.9, color, arc = 0, size = 22 }: { t: number; from: Pt; to: Pt; start: number; end?: number; every?: number; len?: number; color?: string; arc?: number; size?: number }) {
  const INK = useInk()
  color = color ?? INK.accent
  if (t < start) return null
  const last = Math.floor((Math.min(t, end) - start) / every)
  const first = Math.max(0, Math.floor((t - len - start) / every))
  const out: ReactNode[] = []
  for (let k = first; k <= last; k++) {
    const p = (t - (start + k * every)) / len
    if (p < 0 || p >= 1) continue
    const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2
    const x = lerp(from.x, to.x, e)
    const y = lerp(from.y, to.y, e) - Math.sin(Math.PI * e) * arc
    const o = Math.min(1, p * 6, (1 - p) * 6)
    out.push(
      INK.soft ? (
        <div key={k} style={{ position: 'absolute', left: x - size * 0.4, top: y - size * 0.4, width: size * 0.8, height: size * 0.8, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, #ffffff 0%, #d6e5ff 45%, #7ea9ff 100%)', opacity: o, boxShadow: `0 0 14px ${color}, 0 0 4px #ffffff` }} />
      ) : (
        <div key={k} style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: 3, background: color, opacity: o, boxShadow: `0 0 12px ${color}88` }} />
      ),
    )
  }
  return <>{out}</>
}

/** One-shot flight of a labelled message (request/response) from → to starting at `at`. */
export function Envelope({ t, at, from, to, label, color, len = 0.8, arc = 40 }: { t: number; at: number; from: Pt; to: Pt; label: string; color?: string; len?: number; arc?: number }) {
  const INK = useInk()
  color = color ?? INK.accent
  const p = (t - at) / len
  if (p < 0 || p >= 1) return null
  const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2
  const x = lerp(from.x, to.x, e)
  const y = lerp(from.y, to.y, e) - Math.sin(Math.PI * e) * arc
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)', padding: INK.soft ? '12px 24px' : '6px 12px', ...(INK.soft ? GLOW_PILL : {}), border: INK.soft ? `1.5px solid ${color}` : `2px solid ${color}`, borderRadius: INK.soft ? 999 : 6, background: INK.soft ? 'rgba(8,22,82,0.92)' : INK.bg, fontFamily: INK.soft ? undefined : MONO, fontSize: INK.soft ? 26 : 22, fontWeight: 700, color: INK.soft ? '#ffffff' : color, whiteSpace: 'nowrap', opacity: Math.min(1, p * 8, (1 - p) * 8), boxShadow: INK.soft ? `0 0 22px ${color}, inset 0 1px 0 rgba(255,255,255,0.2)` : `0 0 16px ${color}55` }}>
      {label}
    </div>
  )
}

/**
 * A consumer as a worker unit: intake slot on the left, name, status LED, the partitions it owns as small tape
 * cells, and a progress bar while processing. `idle` = owns nothing; `down` = removed / stopped.
 */
export function ConsumerUnit({ x, y, name, parts, t, busy, idle = false, down = false, note, w = 360, accent }: { x: number; y: number; name: string; parts?: string[]; t: number; busy?: number; idle?: boolean; down?: boolean; note?: string; w?: number; accent?: string }) {
  const INK = useInk()
  accent = accent ?? INK.good
  const color = down ? INK.bad : idle ? INK.dim : accent
  const led = down ? INK.bad : idle ? INK.dim : Math.sin(t * 7) > -0.2 ? accent : INK.dim
  if (INK.soft)
    return (
      <div style={{ ...INK.card, position: 'absolute', left: x, top: y, width: w, height: 118, boxSizing: 'border-box', overflow: 'hidden', border: down ? `2px solid ${INK.bad}` : idle ? (INK.card.border as string) : 'none', background: idle || down ? (INK.card.background as string) : accent === INK.accent || accent === INK.good ? HERO : `linear-gradient(160deg, ${accent}cc, ${accent})`, boxShadow: idle || down ? (INK.card.boxShadow as string) : HERO_SHADOW }}>
        <div style={{ position: 'absolute', left: 26, top: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 14, height: 14, borderRadius: 7, background: down ? INK.bad : idle ? INK.dim : led === accent ? '#ffffff' : 'rgba(255,255,255,0.45)', boxShadow: idle || down ? undefined : '0 0 12px #ffffff' }} />
          <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: -0.5, whiteSpace: 'nowrap', color: down ? INK.bad : idle ? INK.faint : '#ffffff' }}>{name}</span>
          {note && <span style={{ fontSize: 24, whiteSpace: 'nowrap', fontWeight: 600, color: down ? INK.bad : idle ? INK.warn : 'rgba(255,255,255,0.85)' }}>{note}</span>}
        </div>
        <div style={{ position: 'absolute', left: 24, top: 62, display: parts === undefined && !idle ? 'none' : 'flex', gap: 8 }}>
          {parts?.length ? (
            parts.map((p) => (
              <span key={p} style={{ minWidth: 60, height: 38, padding: '0 14px', boxSizing: 'border-box', borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 800, color: down ? INK.bad : '#13307f', background: down ? 'rgba(255,90,106,0.18)' : '#ffffff', boxShadow: down ? undefined : '0 0 12px rgba(255,255,255,0.45), 0 6px 14px rgba(0,8,50,0.4)' }}>
                {p}
              </span>
            ))
          ) : (
            <span style={{ height: 36, display: 'grid', alignItems: 'center', fontSize: 24, fontWeight: 600, color: idle ? INK.warn : INK.faint }}>{idle ? 'rảnh · chờ thay người' : '—'}</span>
          )}
        </div>
        {busy !== undefined && (
          <div style={{ position: 'absolute', left: 26, right: 26, bottom: 10, height: 6, background: 'rgba(255,255,255,0.3)', borderRadius: 3 }}>
            <div style={{ width: `${clamp(busy) * 100}%`, height: '100%', background: '#ffffff', borderRadius: 3, boxShadow: '0 0 10px #ffffff' }} />
          </div>
        )}
      </div>
    )
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: 112, boxSizing: 'border-box', border: `2px solid ${down ? INK.bad : idle ? INK.line : `${accent}aa`}`, borderRadius: 12, background: INK.bg, opacity: idle ? 0.7 : 1, boxShadow: idle || down ? undefined : `0 0 24px ${accent}22` }}>
      <div style={{ position: 'absolute', left: -8, top: 34, width: 14, height: 40, borderRadius: 4, background: INK.bg, border: `2px solid ${color}` }} />
      <div style={{ position: 'absolute', left: 24, top: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 12, height: 12, borderRadius: 6, background: led, boxShadow: idle || down ? undefined : `0 0 10px ${led}` }} />
        <span style={{ fontFamily: MONO, fontSize: 28, fontWeight: 700, color: down ? INK.bad : INK.text }}>{name}</span>
        {note && <span style={{ fontFamily: MONO, fontSize: 20, color: down ? INK.bad : idle ? INK.warn : INK.faint }}>{note}</span>}
      </div>
      <div style={{ position: 'absolute', left: 24, top: 58, display: parts === undefined && !idle ? 'none' : 'flex', gap: 6 }}>
        {parts?.length ? (
          parts.map((p) => (
            <span key={p} style={{ minWidth: 56, height: 34, boxSizing: 'border-box', border: `2px solid ${color}`, background: `${color}22`, display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 20, fontWeight: 700, color: INK.text, padding: '0 6px' }}>
              {p}
            </span>
          ))
        ) : (
          <span style={{ height: 34, display: 'grid', alignItems: 'center', fontFamily: MONO, fontSize: 22, color: idle ? INK.warn : INK.faint }}>{idle ? 'rảnh · chờ thay người' : '—'}</span>
        )}
      </div>
      {busy !== undefined && (
        <div style={{ position: 'absolute', left: 24, right: 24, bottom: 8, height: 4, background: INK.line, borderRadius: 2 }}>
          <div style={{ width: `${clamp(busy) * 100}%`, height: '100%', background: accent, borderRadius: 2 }} />
        </div>
      )}
    </div>
  )
}

/** 3D icons in public/icons3d (3dicons.co, CC0), background removed. */
export type Icon3DName =
  | 'backward' | 'battery' | 'bell' | 'bulb' | 'calculator' | 'calender' | 'chart' | 'chat' | 'clock' | 'computer' | 'copy'
  | 'cube' | 'explorer' | 'file-new' | 'file-text' | 'file' | 'fire' | 'flag' | 'flash' | 'folder-new' | 'folder' | 'forward'
  | 'hash' | 'heart' | 'key' | 'lab' | 'link' | 'lock' | 'mail' | 'megaphone' | 'message' | 'money-bag' | 'notebook'
  | 'pause' | 'pencil' | 'play' | 'plus' | 'puzzle' | 'rocket' | 'setting' | 'shield' | 'sphere' | 'target' | 'thumb-down'
  | 'thumb-up' | 'tick' | 'toggle' | 'tools' | 'trash-can' | 'trophy' | 'umbrella' | 'wifi' | 'zoom'

/**
 * A glossy 3D icon centred on (x, y): pops in at `at` (spring + blur), then floats gently with a soft glow pool
 * underneath. Use for objects and verdicts (lock = durable, fire = incident, trophy = done) instead of drawn SVG.
 */
export function Icon3D({ name, x, y, size = 160, t, at = 0, float = true, dim = false }: { name: Icon3DName; x: number; y: number; size?: number; t: number; at?: number; float?: boolean; dim?: boolean }) {
  const k = sp(t, at, 11, 160)
  if (k <= 0) return null
  const o = clamp(k * 1.6)
  const bob = float ? Math.sin((t - at) * 1.6 + x * 0.01) * size * 0.04 : 0
  return (
    <div style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, opacity: o * (dim ? 0.4 : 1), filter: o < 0.98 ? `blur(${(1 - o) * 8}px)` : dim ? 'grayscale(0.8)' : undefined }}>
      <div style={{ position: 'absolute', left: '10%', right: '10%', bottom: -size * 0.06, height: size * 0.18, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(91,151,255,0.55), transparent 70%)', filter: 'blur(6px)' }} />
      <Img src={staticFile(`icons3d/${name}.png`)} style={{ width: size, height: size, transform: `translateY(${bob}px) scale(${0.7 + 0.3 * k})`, filter: 'drop-shadow(0 14px 24px rgba(0,4,30,0.55))' }} />
    </div>
  )
}
