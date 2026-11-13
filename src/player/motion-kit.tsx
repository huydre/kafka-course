/**
 * Motion kit (HTML/CSS layer, 1920×1080 world): kinetic type, 3D neon panels, code windows,
 * a moving camera and illustrated icons. Every helper is a pure function of scene time `t`,
 * so Remotion can render any frame and the web player can seek freely.
 */
import type { CSSProperties, ReactNode } from 'react'
import { AbsoluteFill, spring } from 'remotion'
import { MONO, SANS } from '../remotion/video-fonts'
import { BACKDROPS, Backdrop, FilmGrain, type BackdropName } from './backdrops'
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
export const lerp = (a: number, b: number, x: number) => a + (b - a) * x
/** Progress 0..1 of t inside [a, b]. */
export const span = (t: number, a: number, b: number) => clamp((t - a) / Math.max(0.0001, b - a))
/** Cubic ease in-out. */
export const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)
/** Eased progress of a move that starts at `at` and lasts `len` seconds. */
export const move = (t: number, at: number, len: number) => ease(span(t, at, at + len))

export const VW = 1920
export const VH = 1080

export const NEON = {
  blue: '#3b82f6',
  sky: '#60a5fa',
  cyan: '#22d3ee',
  green: '#22c55e',
  red: '#ef4444',
  amber: '#f59e0b',
  violet: '#8b5cf6',
  white: '#e2e8f0',
  muted: '#8b9bbd',
}
export type Neon = keyof typeof NEON

/** Springy 0 → 1 (slight overshoot) starting at `at` seconds. */
export const sp = (t: number, at: number, damping = 14, stiffness = 120) =>
  t <= at ? 0 : spring({ frame: (t - at) * 30, fps: 30, config: { damping, mass: 0.7, stiffness } })
/** Fade in at a, optional fade out at b. */
export const vis = (t: number, a: number, b = Infinity, len = 0.4) =>
  Math.min(span(t, a, a + len), Number.isFinite(b) ? 1 - span(t, b, b + len) : 1)
export const glow = (color: string, k = 1) => `0 0 ${18 * k}px ${color}, 0 0 ${46 * k}px ${color}66`

/* ---------------------------------------------------------------- camera */

/** Camera: look at world point (x, y) with zoom s; optional roll r and 3D tilt rx / ry (degrees). */
export type Shot = { x: number; y: number; s: number; r?: number; rx?: number; ry?: number }
export const HOME: Shot = { x: VW / 2, y: VH / 2, s: 1 }
type CamKey = [at: number, shot: Shot, len?: number]

/** Smootherstep: starts and stops with zero velocity and acceleration, so camera moves feel like a real dolly. */
const smoother = (x: number) => x * x * x * (x * (x * 6 - 15) + 10)

type Cam = Required<Shot>
const PARAMS = ['x', 'y', 's', 'r', 'rx', 'ry'] as const

/**
 * Target path through the keys. Each move eases (smootherstep) along a gentle arc rather than a straight line,
 * and zoom is interpolated in log space so it feels uniform.
 */
function cameraTarget(t: number, keys: CamKey[]): Cam {
  let cam: Cam = { r: 0, rx: 0, ry: 0, ...keys[0][1] }
  keys.slice(1).forEach(([at, shot, len = 1.1], k) => {
    const p = smoother(span(t, at, at + len))
    if (p <= 0) return
    const to: Cam = { r: 0, rx: 0, ry: 0, ...shot }
    // Quadratic bezier: control point pushed sideways by 14% of the travel distance (alternating side per move).
    const dx = to.x - cam.x
    const dy = to.y - cam.y
    const side = k % 2 ? 1 : -1
    const cx = (cam.x + to.x) / 2 - dy * 0.14 * side
    const cy = (cam.y + to.y) / 2 + dx * 0.14 * side
    const u = 1 - p
    cam = {
      x: u * u * cam.x + 2 * u * p * cx + p * p * to.x,
      y: u * u * cam.y + 2 * u * p * cy + p * p * to.y,
      s: Math.exp(lerp(Math.log(cam.s), Math.log(to.s), p)),
      r: lerp(cam.r, to.r, p),
      rx: lerp(cam.rx, to.rx, p),
      ry: lerp(cam.ry, to.ry, p),
    }
  })
  return cam
}

/** How long the camera takes to "catch up" with its target, and how far ahead it looks to keep shots on time. */
const SMOOTH_TIME = 0.32
const LOOKAHEAD = 0.24
const STEP = 1 / 60

/**
 * Camera as a gimbal operator would move it: a critically damped follower chasing the target path
 * (Unity-style SmoothDamp, integrated from t = 0 so every frame is deterministic). Corners between chained moves
 * become curves, and speed never jumps. Zoom is smoothed in log space. Returns the smoothed camera and its velocity.
 */
function cameraSmoothed(t: number, keys: CamKey[]): { cam: Cam; vel: Cam } {
  const start = cameraTarget(0, keys)
  const cur: Cam = { ...start, s: Math.log(start.s) }
  const vel: Cam = { x: 0, y: 0, s: 0, r: 0, rx: 0, ry: 0 }
  const omega = 2 / SMOOTH_TIME
  const steps = Math.max(0, Math.round(t / STEP))
  for (let i = 1; i <= steps; i++) {
    const tg = cameraTarget(i * STEP + LOOKAHEAD, keys)
    const target: Cam = { ...tg, s: Math.log(tg.s) }
    const x = omega * STEP
    const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
    for (const k of PARAMS) {
      const change = cur[k] - target[k]
      const temp = (vel[k] + omega * change) * STEP
      vel[k] = (vel[k] - omega * temp) * decay
      cur[k] = target[k] + (change + temp) * decay
    }
  }
  return { cam: { ...cur, s: Math.exp(cur.s) }, vel }
}

/**
 * Camera for scene time t from [time, shot, glide seconds] keys. On top of the smoothed path it adds what a camera
 * operator would: it banks (rolls) into fast sideways moves and pulls back slightly while travelling fast.
 */
export function cameraAt(t: number, keys: CamKey[]): Shot {
  const { cam, vel } = cameraSmoothed(t, keys)
  // Screen-space speed in px per frame (30 fps).
  const vx = (vel.x * cam.s) / 30
  const vy = (vel.y * cam.s) / 30
  const speed = Math.hypot(vx, vy)
  const bank = clamp(vx * 0.09, -3.2, 3.2)
  const pullBack = 1 - Math.min(0.06, speed * 0.0016)
  return { ...cam, r: cam.r + bank, s: cam.s * pullBack, rx: cam.rx + clamp(vy * 0.05, -2, 2) }
}

/** Dark grid backdrop + camera-driven world + vignette + watermark. */
export function Scene({
  t,
  camera = HOME,
  children,
  overlay,
  backdrop = 'grid',
}: {
  t: number
  camera?: Shot
  children: ReactNode
  overlay?: ReactNode
  /** 'grid' = dark tech grid (default); 'board' = investigation corkboard under a spotlight, for cold opens. */
  /** Background world; see BACKDROPS in backdrops.tsx (grid, board, blueprint, servers, terminal, desk, studio). */
  backdrop?: BackdropName
}) {
  // "Breathing" camera: a slow drift so the frame never sits perfectly still.
  const dx = Math.sin(t * 0.35) * 10
  const dy = Math.cos(t * 0.27) * 7
  const ds = 1 + Math.sin(t * 0.22) * 0.008
  const world: CSSProperties = {
    transformOrigin: '0 0',
    transform:
      `translate(${VW / 2}px, ${VH / 2}px) rotateX(${camera.rx ?? 0}deg) rotateY(${camera.ry ?? 0}deg) rotateZ(${camera.r ?? 0}deg) ` +
      `scale(${camera.s * ds}) translate(${-camera.x - dx}px, ${-camera.y - dy}px)`,
  }
  return (
    <AbsoluteFill style={{ background: '#05070f', overflow: 'hidden', fontFamily: SANS, color: NEON.white }}>
      <Backdrop name={backdrop} t={t} camera={camera} />
      {backdrop !== 'plain' && backdrop !== 'soft' && <Bokeh t={t} camera={camera} layer="back" warm={BACKDROPS[backdrop].warm} />}
      <AbsoluteFill
        style={{
          perspective: 2200,
          perspectiveOrigin: '50% 50%',
          // Focus pull at the start of every video: soft and slightly zoomed in, then sharp.
          filter: t < 0.9 ? `blur(${(1 - smoother(span(t, 0, 0.9))) * 14}px)` : undefined,
          transform: `scale(${1 + 0.05 * (1 - smoother(span(t, 0, 1.2)))})`,
        }}
      >
        <AbsoluteFill style={world}>{children}</AbsoluteFill>
      </AbsoluteFill>
      {backdrop !== 'plain' && backdrop !== 'soft' && <Bokeh t={t} camera={camera} layer="front" warm={BACKDROPS[backdrop].warm} />}
      {overlay}
      {backdrop !== 'plain' && backdrop !== 'soft' && <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.65) 100%)', pointerEvents: 'none' }} />}
      {backdrop !== 'soft' && <FilmGrain t={t} />}
      <div style={{ position: 'absolute', right: 44, top: 30, fontSize: 30, fontWeight: 800, opacity: 0.85, letterSpacing: 0.5 }}>
        kafka<span style={{ color: NEON.blue }}>·</span>lab
      </div>
    </AbsoluteFill>
  )
}

/** Place a child centred on world point (x, y). */
export function At({ x, y, children, style }: { x: number; y: number; children: ReactNode; style?: CSSProperties }) {
  return <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)', ...style }}>{children}</div>
}

/* ---------------------------------------------------------------- type */

/** Characters fade in one by one from a blur, like a title being "printed" into place. */
export function Kinetic({
  t,
  at,
  text,
  size = 96,
  color = NEON.white,
  weight = 900,
  stagger = 0.03,
  glowColor,
  style,
}: {
  t: number
  at: number
  text: string
  size?: number
  color?: string
  weight?: number
  stagger?: number
  glowColor?: string
  style?: CSSProperties
}) {
  return (
    <div style={{ fontSize: size, fontWeight: weight, color, whiteSpace: 'pre', lineHeight: 1.1, letterSpacing: size > 70 ? 1 : 0, ...style }}>
      {[...text].map((ch, i) => {
        const p = clamp(sp(t, at + i * stagger, 18, 140))
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: p,
              filter: `blur(${(1 - p) * 10}px)`,
              transform: `translateY(${(1 - p) * 26}px)`,
              textShadow: glowColor ? glow(glowColor, 0.8) : undefined,
            }}
          >
            {ch}
          </span>
        )
      })}
    </div>
  )
}

/** Section title that appears big in the middle, then shrinks to the top to make room. */
/** `until`: fade the docked title out (use when the camera later pushes in and the title would cover the subject). */
export function TitleCard({ t, at, kicker, title, tone = 'sky', dock = at + 1.8, until = Infinity }: { t: number; at: number; kicker: string; title: string; tone?: Neon; dock?: number; until?: number }) {
  const d = move(t, dock, 0.9)
  // While the title is big, a dark scrim hides whatever the scene has already placed behind it.
  const scrim = Math.min(clamp(sp(t, at - 0.1)), 1 - d) * 0.82
  return (
    <>
    <div style={{ position: 'absolute', inset: 0, background: `rgba(5,7,15,${scrim})`, backdropFilter: scrim > 0.05 ? `blur(${scrim * 8}px)` : undefined }} />
    <div
      style={{
        position: 'absolute',
        left: VW / 2,
        top: lerp(470, 108, d),
        transform: `translate(-50%, -50%) scale(${lerp(1, 0.52, d)})`,
        textAlign: 'center',
        opacity: (Number.isFinite(until) ? 1 - span(t, until, until + 0.6) : 1),
      }}
    >
      <Kinetic t={t} at={at} text={kicker} size={40} weight={800} color={NEON[tone]} stagger={0.02} style={{ letterSpacing: 8, marginBottom: 14 }} />
      <Kinetic t={t} at={at + 0.25} text={title} size={104} />
    </div>
    </>
  )
}

/* ---------------------------------------------------------------- surfaces */

/** Gray card with a neon border that flips in in 3D and keeps a gentle idle tilt. */
export function Panel({
  t,
  at,
  w,
  h,
  tone = 'blue',
  tilt = 0,
  children,
  out = Infinity,
  strong = false,
  still = false,
}: {
  t: number
  at: number
  w: number
  h: number
  tone?: Neon
  tilt?: number
  children?: ReactNode
  out?: number
  strong?: boolean
  /**
   * No 3D flip-in and no idle wobble. Use it when other elements are laid on top of the panel instead of inside it,
   * otherwise the panel moves under them and they look misaligned.
   */
  still?: boolean
}) {
  const p = sp(t, at, 13, 90)
  const o = Math.min(clamp(p * 1.4), vis(t, -1, out))
  const wobble = still ? 0 : Math.sin(t * 0.9 + at) * 2.2
  const flip = still ? 0 : 1
  const c = NEON[tone]
  return (
    <div style={{ perspective: 1800, opacity: o }}>
      <div
        style={{
          width: w,
          height: h,
          borderRadius: 26,
          border: `4px solid ${c}`,
          background: 'linear-gradient(160deg, #2d313d 0%, #1b1e27 60%, #15171e 100%)',
          boxShadow: `${glow(c, strong ? 1.3 : 0.7)}, inset 0 0 40px ${c}22, 0 30px 60px rgba(0,0,0,0.6)`,
          transform: `rotateY(${(1 - p) * -70 * flip + tilt + wobble}deg) rotateX(${(1 - p) * 20 * flip + wobble * 0.4}deg) scale(${lerp(still ? 0.92 : 0.6, 1, clamp(p, 0, 1.1))})`,
          transformStyle: 'preserve-3d',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {children}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.16) 48%, rgba(255,255,255,0.04) 55%, transparent 65%)',
            transform: `translateX(${lerp(-120, 120, smoother(span(t, at + 0.35, at + 1.25)))}%)`,
            opacity: t > at + 0.3 && t < at + 1.3 ? 1 : 0,
          }}
        />
      </div>
    </div>
  )
}

export type Token = [string, string]
/** macOS-style code window; code is typed out character by character. */
export function CodeWindow({ t, at, lines, w = 820, cps = 30, size = 30 }: { t: number; at: number; lines: Token[][]; w?: number; cps?: number; size?: number }) {
  const p = sp(t, at, 15, 110)
  let budget = Math.floor(Math.max(0, t - at - 0.35) * cps)
  const caretOn = Math.floor(t * 2.4) % 2 === 0
  return (
    <div
      style={{
        width: w,
        borderRadius: 18,
        background: '#1c1f28',
        border: '2px solid #2d3344',
        boxShadow: '0 30px 70px rgba(0,0,0,0.6)',
        opacity: clamp(p * 1.3),
        transform: `translateY(${(1 - clamp(p)) * 60}px) scale(${lerp(0.9, 1, clamp(p))})`,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', gap: 12, padding: '16px 20px', background: '#262a35' }}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
          <span key={c} style={{ width: 18, height: 18, borderRadius: 9, background: c }} />
        ))}
      </div>
      <div style={{ padding: '22px 28px 26px', fontFamily: MONO, fontSize: size, lineHeight: 1.55, fontWeight: 700 }}>
        {lines.map((line, i) => (
          <div key={i} style={{ minHeight: size * 1.55, whiteSpace: 'pre' }}>
            {line.map(([text, color], j) => {
              const shown = text.slice(0, Math.max(0, budget))
              budget -= text.length
              return (
                <span key={j} style={{ color }}>
                  {shown}
                </span>
              )
            })}
            {i === lines.length - 1 && caretOn && <span style={{ color: NEON.sky }}>▍</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Rubber-stamp verdict ("SAI", "OK") that slams in with a rotation. */
export function Stamp({ t, at, text, tone = 'red', rotate = -12, size = 120 }: { t: number; at: number; text: string; tone?: Neon; rotate?: number; size?: number }) {
  const p = sp(t, at, 9, 180)
  const c = NEON[tone]
  return (
    <div
      style={{
        opacity: clamp(p * 2),
        transform: `rotate(${rotate}deg) scale(${lerp(2.6, 1, clamp(p, 0, 1.2))})`,
        border: `8px solid ${c}`,
        color: c,
        borderRadius: 18,
        padding: '6px 34px',
        fontSize: size,
        fontWeight: 900,
        letterSpacing: 6,
        whiteSpace: 'nowrap',
        textShadow: glow(c, 0.6),
        boxShadow: glow(c, 0.5),
        background: 'rgba(5,7,15,0.7)',
      }}
    >
      {text}
    </div>
  )
}

/** Three chevrons pulsing one after another, pointing left or right. */
export function Chevrons({ t, at, tone = 'red', dir = 'left', size = 120 }: { t: number; at: number; tone?: Neon; dir?: 'left' | 'right'; size?: number }) {
  const c = NEON[tone]
  return (
    <svg width={size * 1.6} height={size * 1.8} viewBox="0 0 160 180" style={{ opacity: vis(t, at), transform: dir === 'right' ? 'scaleX(-1)' : undefined, overflow: 'visible' }}>
      {[0, 1, 2].map((i) => {
        const pulse = 0.35 + 0.65 * Math.max(0, Math.sin((t - at) * 4 - i * 0.9))
        return <path key={i} d={`M${70 + i * 32} 20 L${20 + i * 32} 90 L${70 + i * 32} 160`} fill="none" stroke={c} strokeWidth={9} strokeLinecap="round" opacity={pulse} style={{ filter: `drop-shadow(0 0 8px ${c})` }} />
      })}
    </svg>
  )
}

/** Expanding rings around a point (in px, relative to its parent). */
export function Burst({ t, at, tone = 'green', r = 90 }: { t: number; at: number; tone?: Neon; r?: number }) {
  if (t < at) return null
  return (
    <>
      {[0, 0.35, 0.7].map((d) => {
        const p = span(t, at + d, at + d + 1.1)
        if (p <= 0 || p >= 1) return null
        return (
          <div
            key={d}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: r * 2 * (0.4 + p),
              height: r * 2 * (0.4 + p),
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              border: `${5 * (1 - p)}px solid ${NEON[tone]}`,
              opacity: 1 - p,
              boxShadow: glow(NEON[tone], 0.5),
            }}
          />
        )
      })}
    </>
  )
}

/** Small pill label. */
export function Pill({ text, tone = 'sky', size = 30, o = 1, style }: { text: string; tone?: Neon; size?: number; o?: number; style?: CSSProperties }) {
  const c = NEON[tone]
  return (
    <div
      style={{
        opacity: clamp(o),
        transform: `translateY(${(1 - clamp(o)) * 20}px)`,
        padding: `${size * 0.35}px ${size * 0.8}px`,
        borderRadius: 999,
        border: `3px solid ${c}`,
        background: 'rgba(8,12,24,0.92)',
        color: NEON.white,
        fontSize: size,
        fontWeight: 800,
        whiteSpace: 'nowrap',
        boxShadow: glow(c, 0.45),
        ...style,
      }}
    >
      {text}
    </div>
  )
}

/* ---------------------------------------------------------------- icons */

export function HddIcon({ size = 150 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <rect x="14" y="8" width="92" height="104" rx="10" fill="#3b5068" stroke="#567190" strokeWidth="3" />
      <circle cx="60" cy="50" r="30" fill="#e9eef5" />
      <circle cx="60" cy="50" r="9" fill="#9fb0c4" />
      <circle cx="60" cy="50" r="3.5" fill="#3b5068" />
      <path d="M86 84 L66 54" stroke="#334155" strokeWidth="6" strokeLinecap="round" />
      <text x="60" y="104" textAnchor="middle" fontSize="18" fontWeight="900" fill="#fff" fontFamily="sans-serif">
        HDD
      </text>
      {[22, 98].map((x) => [18, 102].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="2.5" fill="#8aa0b8" />))}
    </svg>
  )
}

export function RamIcon({ size = 220, tone = '#22c55e' }: { size?: number; tone?: string }) {
  return (
    <svg width={size} height={size * 0.42} viewBox="0 0 200 84">
      <rect x="4" y="10" width="192" height="54" rx="5" fill={tone} stroke="#0f3d22" strokeWidth="4" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={20 + i * 44} y="20" width="32" height="32" rx="3" fill="#1f2937" />
      ))}
      {Array.from({ length: 22 }, (_, i) => (
        <rect key={i} x={10 + i * 8.4} y="66" width="5" height="12" fill="#f5b623" />
      ))}
      <rect x="96" y="64" width="8" height="16" fill="#05070f" />
    </svg>
  )
}

export function LogFileIcon({ size = 150 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <path d="M24 6 h52 l22 22 v86 a6 6 0 0 1 -6 6 h-68 a6 6 0 0 1 -6 -6 v-102 a6 6 0 0 1 6 -6z" fill="#e8eef8" />
      <path d="M76 6 v22 h22" fill="#b9c6da" />
      {[42, 56, 70, 84].map((y, i) => (
        <rect key={y} x="30" y={y} width={[56, 44, 60, 36][i]} height="7" rx="3.5" fill={['#3b82f6', '#60a5fa', '#3b82f6', '#93c5fd'][i]} />
      ))}
      <rect x="18" y="94" width="58" height="22" rx="6" fill="#2563eb" />
      <text x="47" y="110" textAnchor="middle" fontSize="15" fontWeight="900" fill="#fff" fontFamily="monospace">
        .log
      </text>
    </svg>
  )
}

export function BookIcon({ size = 170 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 160 120">
      <path d="M80 20 C60 6, 26 6, 8 14 v92 c18 -8 52 -8 72 6z" fill="#3b82f6" />
      <path d="M80 20 C100 6, 134 6, 152 14 v92 c-18 -8 -52 -8 -72 6z" fill="#2563eb" />
      <path d="M80 20 v92" stroke="#1e3a8a" strokeWidth="3" />
      {[34, 50, 66].map((y) => (
        <g key={y}>
          <rect x="22" y={y} width="44" height="6" rx="3" fill="#bfdbfe" />
          <rect x="94" y={y} width="44" height="6" rx="3" fill="#bfdbfe" />
        </g>
      ))}
    </svg>
  )
}

export function ClockIcon({ size = 110, t }: { size?: number; t: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="42" fill="#fef3c7" stroke="#f59e0b" strokeWidth="7" />
      <line x1="50" y1="50" x2="50" y2="24" stroke="#1f2937" strokeWidth="6" strokeLinecap="round" transform={`rotate(${t * 40} 50 50)`} />
      <line x1="50" y1="50" x2="68" y2="50" stroke="#1f2937" strokeWidth="6" strokeLinecap="round" transform={`rotate(${t * 4} 50 50)`} />
      <circle cx="50" cy="50" r="5" fill="#1f2937" />
    </svg>
  )
}

export function FlagIcon({ size = 60, color = NEON.amber }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size * 1.4} viewBox="0 0 50 70">
      <line x1="6" y1="4" x2="6" y2="68" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
      <path d="M8 6 h36 l-9 11 9 11 h-36z" fill={color} style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
    </svg>
  )
}

export function PlaneIcon({ size = 110, color = NEON.sky }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <path d="M8 46 L92 10 L66 90 L48 58 Z" fill={color} />
      <path d="M48 58 L92 10 L40 52 Z" fill="#1e3a8a" opacity="0.55" />
      <path d="M48 58 L44 80 L56 66 Z" fill="#93c5fd" />
    </svg>
  )
}

export function GearIcon({ size = 60, color = NEON.sky, t = 0 }: { size?: number; color?: string; t?: number }) {
  const teeth = Array.from({ length: 8 }, (_, i) => i * 45)
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: `rotate(${t * 60}deg)` }}>
      {teeth.map((a) => (
        <rect key={a} x="43" y="4" width="14" height="22" rx="3" fill={color} transform={`rotate(${a} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="30" fill={color} />
      <circle cx="50" cy="50" r="12" fill="#0b1020" />
    </svg>
  )
}

export function TrashIcon({ size = 130, color = '#94a3b8', open = 0 }: { size?: number; color?: string; open?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
      <g transform={`rotate(${-35 * open} 14 22)`}>
        <rect x="12" y="16" width="76" height="10" rx="4" fill={color} />
        <rect x="38" y="8" width="24" height="10" rx="3" fill={color} />
      </g>
      <path d="M18 30 h64 l-6 62 a6 6 0 0 1 -6 5 h-40 a6 6 0 0 1 -6 -5z" fill={color} />
      {[36, 50, 64].map((x) => (
        <rect key={x} x={x - 3} y="40" width="6" height="46" rx="3" fill="#0b1020" opacity="0.45" />
      ))}
    </svg>
  )
}

export function LockIcon({ size = 54, color = NEON.sky }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <path d="M30 44 V32 a20 20 0 0 1 40 0 V44" fill="none" stroke={color} strokeWidth="10" />
      <rect x="18" y="42" width="64" height="50" rx="10" fill={color} />
      <circle cx="50" cy="64" r="7" fill="#0b1020" />
    </svg>
  )
}

export function ScissorsIcon({ size = 90, color = '#e2e8f0', open = 0 }: { size?: number; color?: string; open?: number }) {
  const a = 10 + 18 * open
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
      <g transform={`rotate(${-a} 50 50)`}>
        <path d="M50 50 L96 44 L96 52 Z" fill={color} />
        <circle cx="26" cy="40" r="12" fill="none" stroke={NEON.red} strokeWidth="7" />
        <path d="M36 44 L50 50" stroke={NEON.red} strokeWidth="7" />
      </g>
      <g transform={`rotate(${a} 50 50)`}>
        <path d="M50 50 L96 56 L96 48 Z" fill={color} />
        <circle cx="26" cy="60" r="12" fill="none" stroke={NEON.red} strokeWidth="7" />
        <path d="M36 56 L50 50" stroke={NEON.red} strokeWidth="7" />
      </g>
    </svg>
  )
}

/**
 * Closing "four things to remember" scene: 2×2 neon cards, the camera visits each card while its beat is spoken
 * and pulls back at the end. Beat k of the cue must narrate card k.
 */
export function SummaryGrid({ t, cue, cards }: { t: number; cue: { at: (k: number) => number; end: (k: number) => number }; cards: { title: string; body: string; tone: Neon }[] }) {
  const pos = (i: number) => ({ x: 560 + (i % 2) * 800, y: 400 + Math.floor(i / 2) * 380 })
  const keys: [number, Shot, number?][] = [[0, { x: 960, y: 580, s: 0.8, rx: 18 }]]
  cards.forEach((_, i) => keys.push([cue.at(i) - 0.2, { ...pos(i), s: 1.3, ry: i % 2 ? -8 : 8 }, 1.0]))
  // Pull back to show all cards as the last sentence ends (must finish before the scene's tail runs out).
  keys.push([cue.end(cards.length - 1) - 0.2, { x: 960, y: 580, s: 0.82 }, 1.1])
  const cam = cameraAt(t, keys)
  return (
    <Scene t={t} camera={cam}>
      {cards.map((card, i) => {
        const { x, y } = pos(i)
        const active = t >= cue.at(i) && t < cue.at(i + 1)
        return (
          <At key={card.title} x={x} y={y}>
            <Panel t={t} at={cue.at(i) + 0.1} w={700} h={300} tone={card.tone} strong={active}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 36, height: '100%', padding: '0 46px' }}>
                <div
                  style={{
                    width: 110,
                    height: 110,
                    flexShrink: 0,
                    borderRadius: 55,
                    border: `5px solid ${NEON[card.tone]}`,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 62,
                    fontWeight: 900,
                    color: NEON[card.tone],
                    boxShadow: glow(NEON[card.tone], 0.6),
                  }}
                >
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1.2 }}>{card.title}</div>
                  <div style={{ fontSize: 32, fontWeight: 600, color: '#cbd5e1', marginTop: 12 }}>{card.body}</div>
                </div>
              </div>
            </Panel>
          </At>
        )
      })}
    </Scene>
  )
}

/* ---------------------------------------------------------------- investigation board (cold open) */

/** A pinned sheet of paper for the corkboard cold open. Text inside should use dark ink colours. */
export function Paper({ w, h, rotate = 0, o = 1, children, pin = true }: { w: number; h: number; rotate?: number; o?: number; children?: ReactNode; pin?: boolean }) {
  const p = clamp(o, 0, 1.2)
  return (
    <div
      style={{
        position: 'relative',
        width: w,
        height: h,
        padding: '44px 52px',
        background: 'linear-gradient(170deg, #f6e8c8 0%, #ead7ad 70%, #dcc596 100%)',
        boxShadow: '0 30px 60px rgba(0,0,0,0.6), inset 0 0 60px rgba(120,90,40,0.25)',
        color: '#3a2c1c',
        transform: `rotate(${rotate}deg) translateY(${(1 - p) * 60}px) scale(${lerp(0.92, 1, p)})`,
        opacity: clamp(o * 1.4),
      }}
    >
      {pin && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: -14,
            width: 34,
            height: 34,
            marginLeft: -17,
            borderRadius: 17,
            background: 'radial-gradient(circle at 35% 35%, #ff8a80, #c62828 60%, #7f1010)',
            boxShadow: '0 6px 10px rgba(0,0,0,0.5)',
          }}
        />
      )}
      {children}
    </div>
  )
}

/** Small uppercase case-file label printed on a paper. */
export function CaseLabel({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 3, color: '#8a6d45', textTransform: 'uppercase' }}>{children}</div>
}

/** Hand-drawn red ellipse that "draws itself" around something (p: 0 → 1). Place it over the target, absolutely. */
export function HandCircle({ w, h, p, color = '#d32f2f' }: { w: number; h: number; p: number; color?: string }) {
  if (p <= 0) return null
  const rx = w / 2
  const ry = h / 2
  // Slightly more than one turn with a small offset, like a quick pen stroke.
  const d = `M ${rx * 2 - 6} ${ry} A ${rx - 6} ${ry - 4} 0 1 1 ${rx} ${4} A ${rx - 2} ${ry - 8} 0 0 1 ${rx * 2 - 2} ${ry + 10}`
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
      <path d={d} fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - clamp(p)} opacity={0.9} />
    </svg>
  )
}

/** Red string between two pins on the board, sagging a little; draws in as p goes 0 → 1. */
export function RedString({ from, to, p }: { from: { x: number; y: number }; to: { x: number; y: number }; p: number }) {
  if (p <= 0) return null
  const mx = (from.x + to.x) / 2
  const my = (from.y + to.y) / 2 + 60
  return (
    <svg width={4000} height={2400} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
      <path d={`M${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`} fill="none" stroke="#c62828" strokeWidth={5} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - clamp(p)} style={{ filter: 'drop-shadow(0 3px 3px rgba(0,0,0,0.5))' }} />
    </svg>
  )
}

/* ---------------------------------------------------------------- depth */

/** Deterministic pseudo-random in [0, 1) so every render of a frame is identical. */
const rand = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Out-of-focus light particles. The back layer drifts slower than the camera and the front layer faster,
 * so any camera move reads as real depth (parallax).
 */
function Bokeh({ t, camera, layer, warm }: { t: number; camera: Shot; layer: 'back' | 'front'; warm: boolean }) {
  const back = layer === 'back'
  const n = back ? 26 : 7
  const depth = back ? 0.35 : 1.55
  const cx = (camera.x - VW / 2) * depth
  const cy = (camera.y - VH / 2) * depth
  const palette = warm ? ['#ffcc80', '#ffe0b2', '#ffab91'] : ['#60a5fa', '#22d3ee', '#818cf8']
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      {Array.from({ length: n }, (_, i) => {
        const seed = i + (back ? 0 : 100)
        const size = back ? 6 + rand(seed) * 26 : 90 + rand(seed) * 160
        const span2 = VW + 600
        const x = ((((rand(seed + 1) * span2 - cx + Math.sin(t * 0.2 + seed) * 40) % span2) + span2) % span2) - 300
        const y = ((((rand(seed + 2) * (VH + 400) - cy + t * (back ? 6 : -10)) % (VH + 400)) + VH + 400) % (VH + 400)) - 200
        const tw = 0.6 + 0.4 * Math.sin(t * (0.6 + rand(seed + 3)) + seed)
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: '50%',
              background: palette[i % palette.length],
              opacity: (back ? 0.16 : 0.06) * tw,
              filter: `blur(${back ? 2 + size * 0.12 : 26}px)`,
            }}
          />
        )
      })}
    </AbsoluteFill>
  )
}

/** Simple person (cashier / consumer worker). Idle people are grey and snore "z z". */
export function PersonIcon({ size = 90, color = NEON.sky, idle = false, t = 0 }: { size?: number; color?: string; idle?: boolean; t?: number }) {
  const c = idle ? '#475569' : color
  return (
    <div style={{ position: 'relative', width: size, height: size * 1.15 }}>
      <svg width={size} height={size * 1.15} viewBox="0 0 100 115">
        {/* Shoulders start right under the chin and the head overlaps them: no floating head. */}
        <path d="M12 115 C12 66, 30 56, 50 56 C70 56, 88 66, 88 115 Z" fill={c} />
        <circle cx="50" cy="34" r="21" fill={c} />
        {!idle && <circle cx="50" cy="34" r="21" fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="3" />}
        <path d="M36 58 Q50 70 64 58" fill="none" stroke="#0f172a" strokeOpacity="0.35" strokeWidth="3" />
      </svg>
      {idle && (
        <div style={{ position: 'absolute', right: -size * 0.35, top: -size * 0.25, fontSize: size * 0.32, fontWeight: 900, color: '#94a3b8', transform: `translateY(${Math.sin(t * 2) * 6}px)` }}>
          z<span style={{ fontSize: size * 0.24 }}>z</span>
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- everyday-analogy illustrations */

/** Shopper pushing a cart (side view, facing right). */
export function ShopperIcon({ size = 80, color = '#64748b', accent = '#f59e0b', t = 0 }: { size?: number; color?: string; accent?: string; t?: number }) {
  const step = Math.sin(t * 10) * 3
  return (
    <svg width={size * 1.5} height={size} viewBox="0 0 150 100">
      <circle cx="30" cy="20" r="13" fill="#cbd5e1" />
      <rect x="18" y="34" width="24" height="34" rx="8" fill={color} />
      <path d={`M24 66 l${-4 + step} 26 M36 66 l${4 - step} 26`} stroke="#334155" strokeWidth="7" strokeLinecap="round" />
      <path d="M40 44 L62 50" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" />
      <path d="M60 40 L70 40 L78 74 L134 74 L142 46 L74 46" fill="none" stroke="#94a3b8" strokeWidth="5" strokeLinejoin="round" />
      <rect x="84" y="52" width="16" height="16" rx="3" fill={accent} />
      <rect x="104" y="48" width="14" height="20" rx="3" fill={accent} opacity="0.7" />
      <rect x="121" y="54" width="14" height="14" rx="3" fill={accent} opacity="0.45" />
      <circle cx="86" cy="86" r="7" fill="#64748b" />
      <circle cx="128" cy="86" r="7" fill="#64748b" />
    </svg>
  )
}

/** Cashier with cap and apron. Idle cashiers sit slumped in grey with "z z". */
export function CashierIcon({ size = 100, color = '#f59e0b', idle = false, t = 0 }: { size?: number; color?: string; idle?: boolean; t?: number }) {
  const apron = idle ? '#475569' : color
  const nod = idle ? 0 : Math.sin(t * 6) * 3
  return (
    <div style={{ position: 'relative', width: size, height: size * 1.2 }}>
      <svg width={size} height={size * 1.2} viewBox="0 0 100 120" style={{ transform: idle ? 'rotate(-6deg)' : undefined }}>
        {/* Body first so the head overlaps it: shoulders start right under the chin, no floating head. */}
        <path d="M14 120 C14 74, 30 62, 50 62 C70 62, 86 74, 86 120 Z" fill={idle ? '#334155' : '#64748b'} />
        <rect x="43" y="50" width="14" height="16" rx="5" fill={idle ? '#475569' : '#cbd5e1'} />
        <path d="M34 72 C40 68, 60 68, 66 72 L66 120 L34 120 Z" fill={apron} />
        <rect x="39" y="82" width="12" height="8" rx="2" fill="#fff" opacity={idle ? 0.25 : 0.85} />
        <g transform={`rotate(${nod} 50 50)`}>
          <circle cx="50" cy="38" r="18" fill={idle ? '#475569' : '#cbd5e1'} />
          <path d="M31 34 C31 18, 69 18, 69 34 Z" fill={apron} />
          <rect x="44" y="30" width="34" height="6" rx="3" fill={apron} />
          {idle ? (
            <path d="M42 41 h6 M54 41 h6" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
          ) : (
            <>
              <circle cx="44" cy="41" r="2.5" fill="#1f2937" />
              <circle cx="56" cy="41" r="2.5" fill="#1f2937" />
            </>
          )}
        </g>
      </svg>
      {idle && (
        <div style={{ position: 'absolute', right: -size * 0.25, top: -size * 0.15, fontSize: size * 0.3, fontWeight: 900, color: '#94a3b8', transform: `translateY(${Math.sin(t * 2) * 6}px)` }}>
          z<span style={{ fontSize: size * 0.22 }}>z</span>
        </div>
      )}
    </div>
  )
}

/** Checkout counter: moving conveyor with items, register with a scanner light. */
export function CheckoutCounter({ w = 220, t = 0, active = true, accent = '#f59e0b' }: { w?: number; t?: number; active?: boolean; accent?: string }) {
  const h = w * 0.55
  const items = [0, 1, 2]
  return (
    <svg width={w} height={h} viewBox="0 0 220 121">
      <rect x="4" y="54" width="212" height="62" rx="10" fill="#1e293b" stroke="#334155" strokeWidth="3" />
      <rect x="4" y="54" width="212" height="10" rx="5" fill="#334155" />
      <rect x="10" y="40" width="140" height="16" rx="6" fill="#1f2937" />
      {Array.from({ length: 9 }, (_, i) => {
        const x = 12 + ((i * 16 + (active ? t * 40 : 0)) % 136)
        return <rect key={i} x={x} y="44" width="3" height="8" fill="#475569" />
      })}
      {active &&
        items.map((k) => {
          const x = 14 + ((t * 40 + k * 46) % 130)
          return <rect key={k} x={x} y="24" width="18" height="18" rx="3" fill={accent} opacity={(x > 128 ? 0.3 : 1) * (1 - k * 0.2)} />
        })}
      <rect x="156" y="8" width="56" height="46" rx="6" fill="#334155" stroke="#64748b" strokeWidth="2" />
      <rect x="162" y="14" width="44" height="20" rx="3" fill="#0f172a" />
      {active && (
        <text x="184" y="29" textAnchor="middle" fontSize="12" fontWeight="900" fill={accent} fontFamily="monospace">
          {Math.floor(t * 3) % 2 ? 'BEEP' : '✓'}
        </text>
      )}
      <rect x="150" y="48" width="8" height="8" fill={active && Math.floor(t * 3) % 2 ? accent : '#334155'} />
    </svg>
  )
}

export function LetterIcon({ size = 70, accent = '#f59e0b' }: { size?: number; accent?: string }) {
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 100 70">
      <rect x="3" y="3" width="94" height="64" rx="6" fill="#cbd5e1" />
      <path d="M3 8 L50 40 L97 8" fill="none" stroke="#94a3b8" strokeWidth="4" />
      <rect x="70" y="44" width="18" height="16" rx="2" fill={accent} />
    </svg>
  )
}

/** Mail sack; `fill` 0..1 shows how full it is. */
export function MailBagIcon({ size = 110, fill = 0.6, accent = '#f59e0b', label }: { size?: number; fill?: number; accent?: string; label?: string }) {
  const top = 92 - 70 * Math.min(1, fill)
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <defs>
          <clipPath id={`bag${Math.round(fill * 100)}${label ?? ''}`}>
            <path d="M22 26 C10 50, 10 92, 50 96 C90 92, 90 50, 78 26 Z" />
          </clipPath>
        </defs>
        <path d="M22 26 C10 50, 10 92, 50 96 C90 92, 90 50, 78 26 Z" fill="#334155" stroke="#64748b" strokeWidth="3" />
        <rect x="0" y={top} width="100" height="100" fill={accent} opacity="0.85" clipPath={`url(#bag${Math.round(fill * 100)}${label ?? ''})`} />
        <path d="M30 24 Q50 12 70 24" fill="none" stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" />
      </svg>
      {label && <div style={{ position: 'absolute', left: 0, right: 0, top: size * 0.5, textAlign: 'center', fontSize: size * 0.17, fontWeight: 900, color: '#0f172a' }}>{label}</div>}
    </div>
  )
}

export function TruckIcon({ size = 180, accent = '#f59e0b', t = 0, moving = false }: { size?: number; accent?: string; t?: number; moving?: boolean }) {
  const bump = moving ? Math.abs(Math.sin(t * 14)) * 2 : 0
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 150 90">
      <g transform={`translate(0 ${-bump})`}>
        <rect x="4" y="12" width="92" height="52" rx="6" fill="#475569" />
        <rect x="4" y="12" width="92" height="12" rx="6" fill={accent} />
        <path d="M96 30 h26 l20 18 v16 h-46z" fill="#64748b" />
        <path d="M102 34 h16 l12 12 h-28z" fill="#cbd5e1" opacity="0.7" />
      </g>
      {[30, 76, 122].map((x) => (
        <g key={x}>
          <circle cx={x} cy="72" r="11" fill="#1e293b" />
          <circle cx={x} cy="72" r="4" fill="#94a3b8" />
        </g>
      ))}
    </svg>
  )
}

/**
 * Side-view person for illustrated sets (facing right). `reach` 0..1 raises the front arm forward (handing something
 * over); `walk` swings the legs. Neutral skin and one clothing colour, to stay inside the restrained palette.
 */
export function Figure({ h = 260, shirt = '#64748b', pants = '#334155', reach = 0, walk = 0, flip = false }: { h?: number; shirt?: string; pants?: string; reach?: number; walk?: number; flip?: boolean }) {
  const skin = '#d4c4b0'
  const swing = Math.sin(walk * Math.PI * 2) * 14
  const arm = -20 - 70 * clamp(reach)
  return (
    <svg width={h * 0.5} height={h} viewBox="0 0 100 200" style={{ overflow: 'visible', transform: flip ? 'scaleX(-1)' : undefined }}>
      <g stroke={pants} strokeWidth="15" strokeLinecap="round">
        <line x1="44" y1="130" x2={44 - swing * 0.5} y2="192" />
        <line x1="56" y1="130" x2={56 + swing * 0.5} y2="192" />
      </g>
      <rect x="32" y="64" width="36" height="74" rx="16" fill={shirt} />
      <rect x="44" y="50" width="12" height="18" rx="5" fill={skin} />
      <circle cx="51" cy="34" r="19" fill={skin} />
      <path d="M33 32 C33 12, 70 10, 70 30 C64 22, 44 22, 33 32 Z" fill="#3f3a36" />
      <circle cx="62" cy="34" r="2.4" fill="#1f2937" />
      <g transform={`rotate(${arm} 50 72)`}>
        <rect x="44" y="68" width="12" height="52" rx="6" fill={shirt} />
        <circle cx="50" cy="122" r="6" fill={skin} />
      </g>
    </svg>
  )
}

/** Neon card in the Segment-lesson style: kicker, big title, optional sub line and fill bar. */
export function NeonCard({ x, y, w, h, kicker, title, sub, tone = 'blue', strong = false, fill, o = 1, titleSize = 64, children }: { x: number; y: number; w: number; h: number; kicker: string; title: string; sub?: string; tone?: Neon; strong?: boolean; fill?: number; o?: number; titleSize?: number; children?: ReactNode }) {
  const c = NEON[tone]
  return (
    <div
      style={{
        position: 'absolute',
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
        borderRadius: 24,
        border: `4px solid ${c}`,
        background: 'linear-gradient(160deg, #2d313d 0%, #1b1e27 60%, #15171e 100%)',
        boxShadow: `${glow(c, strong ? 1 : 0.45)}, 0 30px 50px rgba(0,0,0,0.55)`,
        padding: '20px 26px',
        opacity: clamp(o),
        transform: `translateY(${(1 - clamp(o)) * 60}px)`,
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 3, color: '#93c5fd' }}>{kicker}</div>
      <div style={{ fontSize: titleSize, fontWeight: 900, lineHeight: 1.1, color: '#fff', marginTop: 4, whiteSpace: 'nowrap' }}>{title}</div>
      {sub && <div style={{ fontSize: 26, fontWeight: 700, color: '#cbd5e1', marginTop: 6 }}>{sub}</div>}
      {fill !== undefined && (
        <div style={{ height: 18, borderRadius: 9, background: '#0f1525', marginTop: 14, overflow: 'hidden' }}>
          <div style={{ width: `${clamp(fill) * 100}%`, height: '100%', background: c, boxShadow: glow(c, 0.4) }} />
        </div>
      )}
      {children}
    </div>
  )
}

export function MsgChip({ x, y, tone = 'sky', label }: { x: number; y: number; tone?: Neon; label?: string }) {
  const w = label ? Math.max(44, label.length * 15 + 24) : 44
  return <div style={{ position: 'absolute', left: x - w / 2, top: y - (label ? 22 : 15), width: w, height: label ? 44 : 30, display: 'grid', placeItems: 'center', fontSize: 22, fontWeight: 900, fontFamily: MONO, whiteSpace: 'nowrap', color: '#fff', borderRadius: 8, background: tone === 'red' ? 'linear-gradient(180deg,#dc2626,#7f1d1d)' : tone === 'green' ? 'linear-gradient(180deg,#16a34a,#14532d)' : 'linear-gradient(180deg,#3b82f6,#1e40af)', border: `2px solid ${NEON[tone]}`, boxShadow: glow(NEON[tone], 0.6) }}>{label}</div>
}


/* ---------------------------------------------------------------- broker card (Segment-lesson language) */

export type Role = 'leader' | 'follower' | 'offline' | 'new-leader' | 'producer' | 'error' | 'ok'
const ROLE: Record<Role, { tone: Neon; badge: string }> = {
  leader: { tone: 'blue', badge: 'LEADER' },
  follower: { tone: 'blue', badge: 'FOLLOWER' },
  offline: { tone: 'red', badge: 'OFFLINE' },
  'new-leader': { tone: 'amber', badge: 'LEADER MỚI' },
  producer: { tone: 'sky', badge: 'PRODUCER' },
  error: { tone: 'red', badge: 'LỖI' },
  ok: { tone: 'green', badge: 'OK' },
}
export type LogBlock = { tone?: Neon; label?: string }

/**
 * Data card like the Segment lesson's file card: mono header, big number, status badge (pulsing when live),
 * a strip of log blocks and an optional meter. Content always inside the card.
 */
export function DataCard({
  x,
  y,
  t,
  header,
  value,
  unit,
  role,
  blocks = [],
  meter,
  meterLabel,
  footer,
  w = 500,
  h = 340,
  o = 1,
  strong,
  badge,
}: {
  badge?: string
  x: number
  y: number
  t: number
  header: string
  value: string
  unit?: string
  role: Role
  blocks?: LogBlock[]
  meter?: number
  meterLabel?: string
  footer?: string
  w?: number
  h?: number
  o?: number
  strong?: boolean
}) {
  const r = ROLE[role]
  const c = NEON[r.tone]
  const live = role === 'leader' || role === 'new-leader'
  return (
    <div
      style={{
        position: 'absolute',
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
        borderRadius: 24,
        border: `4px solid ${c}`,
        background: 'linear-gradient(160deg, #2d313d 0%, #1b1e27 60%, #15171e 100%)',
        boxShadow: `${glow(c, strong ?? role !== 'follower' ? 0.9 : 0.45)}, 0 30px 50px rgba(0,0,0,0.55)`,
        opacity: clamp(o),
        transform: `translateY(${(1 - clamp(o)) * 120}px)`,
        padding: '22px 26px',
        overflow: 'hidden',
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 18, color: NEON.muted, fontWeight: 700, paddingRight: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{header}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 4, opacity: role === 'offline' ? 0.35 : 1 }}>
        <span style={{ fontSize: 80, fontWeight: 900, lineHeight: 1.05, color: '#fff', fontFamily: MONO }}>{value}</span>
        {unit && <span style={{ fontSize: 28, fontWeight: 800, color: '#cbd5e1' }}>{unit}</span>}
      </div>
      {blocks.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, opacity: role === 'offline' ? 0.35 : 1 }}>
          {blocks.map((b, i) => (
            <div
              key={i}
              style={{
                width: b.label ? undefined : 36,
                minWidth: 36,
                padding: b.label ? '0 10px' : undefined,
                height: 32,
                borderRadius: 7,
                display: 'grid',
                placeItems: 'center',
                fontFamily: MONO,
                fontSize: 19,
                fontWeight: 800,
                color: '#fff',
                background: b.tone === 'red' ? 'linear-gradient(180deg,#dc2626,#7f1d1d)' : b.tone === 'green' ? 'linear-gradient(180deg,#16a34a,#14532d)' : b.tone === 'amber' ? 'linear-gradient(180deg,#d97706,#78350f)' : 'linear-gradient(180deg,#3b82f6,#1e40af)',
                border: `2px solid ${b.tone ? NEON[b.tone] : '#60a5fa'}`,
              }}
            >
              {b.label}
            </div>
          ))}
        </div>
      )}
      {meter !== undefined && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 800, color: NEON.muted }}>
            <span>{meterLabel}</span>
            <span>{Math.round(clamp(meter) * 100)}%</span>
          </div>
          <div style={{ height: 16, borderRadius: 8, background: '#0f1525', marginTop: 6, overflow: 'hidden' }}>
            <div style={{ width: `${clamp(meter) * 100}%`, height: '100%', background: c }} />
          </div>
        </div>
      )}
      {footer && <div style={{ position: 'absolute', left: 26, right: 26, bottom: 18, fontSize: 24, fontWeight: 800, color: role === 'offline' ? '#fecaca' : '#cbd5e1', whiteSpace: 'nowrap' }}>{footer}</div>}
      <div style={{ position: 'absolute', right: 20, top: 18 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 99, background: `${c}2e`, border: `2px solid ${c}`, fontSize: 17, fontWeight: 900, color: '#fff' }}>
          <span style={{ width: 10, height: 10, borderRadius: 5, background: c, opacity: live ? (Math.sin(t * 8) > 0 ? 1 : 0.3) : 1 }} />
          {badge ?? r.badge}
        </span>
      </div>
    </div>
  )
}

/** Continuous stream of message chips flowing from a to b between `start` and `end` (one every `every` seconds). */
export function Stream({ t, from, to, start, end, every = 0.18, len = 0.7, tone = 'sky', arc = 50 }: { t: number; from: { x: number; y: number }; to: { x: number; y: number }; start: number; end: number; every?: number; len?: number; tone?: Neon; arc?: number }) {
  if (t < start) return null
  const n = Math.floor((Math.min(t, end) - start) / every) + 1
  const chips = []
  for (let k = Math.max(0, n - Math.ceil(len / every) - 1); k < n; k++) {
    const at = start + k * every
    const p = (t - at) / len
    if (p < 0 || p >= 1) continue
    chips.push(<MsgChip key={k} x={lerp(from.x, to.x, p)} y={lerp(from.y, to.y, p) - Math.sin(Math.PI * p) * arc} tone={tone} />)
  }
  return <>{chips}</>
}
