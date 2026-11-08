/**
 * Motion kit (HTML/CSS layer, 1920×1080 world): kinetic type, 3D neon panels, code windows,
 * a moving camera and illustrated icons. Every helper is a pure function of scene time `t`,
 * so Remotion can render any frame and the web player can seek freely.
 */
import type { CSSProperties, ReactNode } from 'react'
import { AbsoluteFill, spring } from 'remotion'
import { MONO, SANS } from '../remotion/video-fonts'
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

/** Camera follows [time, shot, glide seconds] keys, easing (cubic in-out) into each new shot. */
export function cameraAt(t: number, keys: CamKey[]): Shot {
  let cam: Required<Shot> = { r: 0, rx: 0, ry: 0, ...keys[0][1] }
  for (const [at, shot, len = 1.1] of keys.slice(1)) {
    const p = move(t, at, len)
    if (p <= 0) break
    const to: Required<Shot> = { r: 0, rx: 0, ry: 0, ...shot }
    cam = {
      x: lerp(cam.x, to.x, p),
      y: lerp(cam.y, to.y, p),
      s: lerp(cam.s, to.s, p),
      r: lerp(cam.r, to.r, p),
      rx: lerp(cam.rx, to.rx, p),
      ry: lerp(cam.ry, to.ry, p),
    }
  }
  return cam
}

/** Dark grid backdrop + camera-driven world + vignette + watermark. */
export function Scene({ t, camera = HOME, children, overlay }: { t: number; camera?: Shot; children: ReactNode; overlay?: ReactNode }) {
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
  const gx = -camera.x * 0.15
  const gy = -camera.y * 0.15
  return (
    <AbsoluteFill style={{ background: '#05070f', overflow: 'hidden', fontFamily: SANS, color: NEON.white }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(96,165,250,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,0.07) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          backgroundPosition: `${gx}px ${gy}px`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 600px at ${50 + 8 * Math.sin(t * 0.25)}% ${42 + 6 * Math.cos(t * 0.2)}%, rgba(37,99,235,0.22), transparent 70%)`,
        }}
      />
      <AbsoluteFill style={{ perspective: 2200, perspectiveOrigin: '50% 50%' }}>
        <AbsoluteFill style={world}>{children}</AbsoluteFill>
      </AbsoluteFill>
      {overlay}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.65) 100%)', pointerEvents: 'none' }} />
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
export function TitleCard({ t, at, kicker, title, tone = 'sky', dock = at + 1.8 }: { t: number; at: number; kicker: string; title: string; tone?: Neon; dock?: number }) {
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
}) {
  const p = sp(t, at, 13, 90)
  const o = Math.min(clamp(p * 1.4), vis(t, -1, out))
  const wobble = Math.sin(t * 0.9 + at) * 2.2
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
          transform: `rotateY(${(1 - p) * -70 + tilt + wobble}deg) rotateX(${(1 - p) * 20 + wobble * 0.4}deg) scale(${lerp(0.6, 1, clamp(p, 0, 1.1))})`,
          transformStyle: 'preserve-3d',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {children}
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
