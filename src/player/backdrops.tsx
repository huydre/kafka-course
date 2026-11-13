/**
 * Cinematic scene backgrounds. Built procedurally (SVG perspective projection, volumetric gradients, fractal-noise
 * materials) so they render identically on every frame and stay sharp at 1080p. All are dark and desaturated so the
 * content keeps the attention; each reacts to the camera (parallax / perspective shift) so camera moves read as depth.
 */
import { useId, type ReactNode } from 'react'
import { AbsoluteFill, getRemotionEnvironment } from 'remotion'

type Cam = { x: number; y: number }
export type BackdropName = 'soft' | 'plain' | 'grid' | 'board' | 'blueprint' | 'servers' | 'terminal' | 'desk' | 'studio'

const W = 1920
const H = 1080
const rand = (i: number) => {
  const x = Math.sin(i * 91.7 + 17.3) * 43758.5453
  return x - Math.floor(x)
}
const wrap = (v: number, m: number) => ((v % m) + m) % m

/* ------------------------------------------------------------------ shared pieces */

/** Fractal-noise material layer (paper, cork, plaster, wood). `matrix` recolours the grey noise. */
function Material({ freq, octaves = 3, matrix, opacity = 1, blend, stretch }: { freq: string; octaves?: number; matrix: string; opacity?: number; blend?: React.CSSProperties['mixBlendMode']; stretch?: boolean }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0, opacity, mixBlendMode: blend }} preserveAspectRatio="none">
      <filter id={`m${id}`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type={stretch ? 'turbulence' : 'fractalNoise'} baseFrequency={freq} numOctaves={octaves} seed={3} stitchTiles="stitch" />
        <feColorMatrix type="matrix" values={matrix} />
      </filter>
      <rect width={W} height={H} filter={`url(#m${id})`} />
    </svg>
  )
}

/** Animated film grain over the whole frame (changes 12× per second, like real film). */
export function FilmGrain({ t, amount = 0.07 }: { t: number; amount?: number }) {
  const id = useId().replace(/:/g, '')
  // Re-generating full-screen noise every frame is costly in the browser; grain is only baked into exported MP4s.
  if (!getRemotionEnvironment().isRendering) return null
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: amount, mixBlendMode: 'overlay' }}>
      <filter id={`g${id}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={Math.floor(t * 12) % 97} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width={W} height={H} filter={`url(#g${id})`} />
    </svg>
  )
}

/** Perspective projection from a simple 3D space (x right, y down, z into the screen) to screen pixels. */
const project = (vx: number, vy: number, f = 900) => (x: number, y: number, z: number) => [vx + (f * x) / z, vy + (f * y) / z] as const

function Haze({ x = 50, y = 48, color = '120,160,255', a = 0.18, size = '70% 45%' }: { x?: number; y?: number; color?: string; a?: number; size?: string }) {
  return <AbsoluteFill style={{ background: `radial-gradient(${size} at ${x}% ${y}%, rgba(${color},${a}), transparent 70%)` }} />
}

/* ------------------------------------------------------------------ grid: infinite perspective floor */

function Grid({ t, camera }: { t: number; camera: Cam }) {
  return (
    <>
      <AbsoluteFill style={{ background: '#05070f' }} />
      <AbsoluteFill
        style={{
          backgroundImage: 'linear-gradient(rgba(96,165,250,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,0.07) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          backgroundPosition: `${-camera.x * 0.15}px ${-camera.y * 0.15}px`,
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(900px 600px at ${50 + 8 * Math.sin(t * 0.25)}% ${42 + 6 * Math.cos(t * 0.2)}%, rgba(37,99,235,0.22), transparent 70%)` }} />
    </>
  )
}

/* ------------------------------------------------------------------ servers: data-centre aisle in perspective */

function Servers({ t, camera }: { t: number; camera: Cam }) {
  // Depth-of-field blur only in exported MP4s; the browser player stays light.
  const rendering = getRemotionEnvironment().isRendering
  const vx = 960 - (camera.x - 960) * 0.08
  const vy = 520 - (camera.y - 540) * 0.05
  const P = project(vx, vy, 760)
  const dolly = 0.4
  const racks = Array.from({ length: 11 }, (_, k) => 1.2 + k * 1.2 - dolly)
  const quad = (pts: (readonly [number, number])[]) => pts.map((p) => p.join(',')).join(' ')
  const side = (X: number, z: number, k: number) => {
    const z2 = z + 1.0
    const face = quad([P(X, -1.3, z), P(X, -1.3, z2), P(X, 1.3, z2), P(X, 1.3, z)])
    const fog = Math.min(1, 2.2 / z)
    return (
      <g key={`${X}-${k}`} opacity={0.35 + 0.65 * fog}>
        <polygon points={face} fill="#111a2e" stroke="#26344f" strokeWidth={1.2} />
        {Array.from({ length: 12 }, (_, u) => {
          const y = -1.15 + u * 0.2
          const [ax, ay] = P(X, y, z + 0.08)
          const [bx, by] = P(X, y, z2 - 0.08)
          return <line key={u} x1={ax} y1={ay} x2={bx} y2={by} stroke="#1f2d48" strokeWidth={Math.max(0.6, 6 / z)} />
        })}
        {Array.from({ length: 12 }, (_, u) => {
          const seed = Math.round((z + dolly) * 10) * 31 + u + (X > 0 ? 500 : 0)
          const on = Math.sin(t * (0.4 + rand(seed) * 0.6) + seed) > 0.3
          const [lx, ly] = P(X, -1.1 + u * 0.2, z + 0.15)
          const amber = rand(seed + 3) > 0.86
          const r = Math.max(0.8, 7 / z)
          const col = amber ? '#fbbf24' : '#60a5fa'
          // Halo is a second, larger translucent circle: much cheaper than a per-LED blur filter.
          return (
            <g key={u} opacity={on ? 1 : 0.12}>
              {on && <circle cx={lx} cy={ly} r={r * 3.2} fill={col} opacity={0.18} />}
              <circle cx={lx} cy={ly} r={r} fill={col} />
            </g>
          )
        })}
      </g>
    )
  }
  const floor = quad([P(-1.6, 1.3, 1), P(1.6, 1.3, 1), P(1.6, 1.3, 40), P(-1.6, 1.3, 40)])
  const ceil = quad([P(-1.6, -1.3, 1), P(1.6, -1.3, 1), P(1.6, -1.3, 40), P(-1.6, -1.3, 40)])
  const strip = (X: number) => quad([P(X - 0.06, -1.3, 0.8), P(X + 0.06, -1.3, 0.8), P(X + 0.06, -1.3, 40), P(X - 0.06, -1.3, 40)])
  return (
    <>
      <AbsoluteFill style={{ background: '#03050a' }} />
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, filter: rendering ? 'blur(1.6px)' : undefined }}>
        <defs>
          <linearGradient id="srvFloor" x1="0" y1={H} x2="0" y2={vy} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#0f172a" />
            <stop offset="1" stopColor="#3b5bb5" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <polygon points={ceil} fill="#05080f" />
        <polygon points={strip(-0.5)} fill="#dbeafe" opacity={0.28} />
        <polygon points={strip(0.5)} fill="#dbeafe" opacity={0.28} />
        <polygon points={floor} fill="url(#srvFloor)" />
        {racks.map((z) => {
          const [ax, ay] = P(-1.6, 1.3, z)
          const [bx] = P(1.6, 1.3, z)
          return <line key={z} x1={ax} y1={ay} x2={bx} y2={ay} stroke="#1e293b" strokeWidth={Math.max(0.5, 3 / z)} />
        })}
        {[...racks].reverse().map((z, k) => [side(-1.6, z, k), side(1.6, z, k)])}
      </svg>
      <Haze x={(vx / W) * 100} y={(vy / H) * 100} a={0.5} size="26% 32%" color="150,190,255" />
      <Haze x={(vx / W) * 100} y={(vy / H) * 100 + 30} a={0.12} size="60% 30%" color="90,140,255" />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(3,5,10,0.45) 0%, rgba(3,5,10,0.05) 35%, rgba(3,5,10,0.05) 60%, rgba(3,5,10,0.5) 100%)' }} />
    </>
  )
}

/* ------------------------------------------------------------------ blueprint: engineering drawing */

function Blueprint({ camera }: { t: number; camera: Cam }) {
  const ox = -camera.x * 0.1
  const oy = -camera.y * 0.1
  const ink = '#9cc3ff'
  return (
    <>
      <AbsoluteFill style={{ background: 'radial-gradient(120% 100% at 50% 40%, #0f2a52 0%, #0a1d3b 55%, #061127 100%)' }} />
      <Material freq="0.9" octaves={2} matrix="0 0 0 0 0.6  0 0 0 0 0.75  0 0 0 0 1  0 0 0 0.07 0" />
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(156,195,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(156,195,255,0.08) 1px, transparent 1px), linear-gradient(rgba(156,195,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(156,195,255,0.03) 1px, transparent 1px)',
          backgroundSize: '160px 160px, 160px 160px, 32px 32px, 32px 32px',
          backgroundPosition: `${ox}px ${oy}px`,
        }}
      />
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, opacity: 0.5 }}>
        <g stroke={ink} strokeWidth={2.5} fill="none" opacity={0.8}>
          <path d="M40 100 V40 H100 M1880 100 V40 H1820 M40 980 V1040 H100 M1880 980 V1040 H1820" />
        </g>
      </svg>
      <Haze y={40} a={0.14} color="140,190,255" size="60% 50%" />
    </>
  )
}

/* ------------------------------------------------------------------ terminal: depth layers of log text */

const LOG = [
  '[Partition payments-3] Rolled new log segment at offset 5367851',
  'INFO  ISR updated: [1,2,3]  leaderEpoch=17',
  'fetch partition=3 offset=48211 maxBytes=1048576',
  'commit group=billing offset=9132 lag=0',
  'producerId=4001 epoch=0 seq=88 → appended',
  'HW=7710 LEO=7712 follower=2 caughtUp=true',
  'Deleting segment 00000000000000000000.log (retention)',
  'Rebalance complete: generation 42, 6 members',
]

function TermLayer({ t, camera, size, speed, blur, opacity, depth, seed }: { t: number; camera: Cam; size: number; speed: number; blur: number; opacity: number; depth: number; seed: number }) {
  const lh = size * 1.7
  const lines = Math.ceil(H / lh) + 4
  const off = wrap(t * speed, lh * LOG.length)
  return (
    <div style={{ position: 'absolute', inset: 0, filter: `blur(${blur}px)`, opacity, fontFamily: 'JetBrains Mono, monospace', fontSize: size, color: '#8ee6c0', whiteSpace: 'pre' }}>
      {Array.from({ length: 3 }, (_, col) => (
        <div key={col} style={{ position: 'absolute', left: col * 760 + 40 - camera.x * depth + rand(seed + col) * 200, top: -off - camera.y * depth, lineHeight: `${lh}px` }}>
          {Array.from({ length: lines + LOG.length }, (_, k) => (
            <div key={k} style={{ opacity: 0.4 + 0.6 * rand(seed * 7 + k + col) }}>
              {LOG[(k + col * 3 + seed) % LOG.length]}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function Terminal({ t, camera }: { t: number; camera: Cam }) {
  return (
    <>
      <AbsoluteFill style={{ background: 'radial-gradient(110% 90% at 50% 45%, #07140f 0%, #030806 70%)' }} />
      <div style={{ position: 'absolute', inset: 0, maskImage: 'radial-gradient(70% 60% at 50% 50%, rgba(0,0,0,0.25), black 85%)', WebkitMaskImage: 'radial-gradient(70% 60% at 50% 50%, rgba(0,0,0,0.25), black 85%)' }}>
        <TermLayer t={t} camera={camera} size={15} speed={6} blur={1.5} opacity={0.07} depth={0.04} seed={1} />
      </div>
      <AbsoluteFill style={{ backgroundImage: 'repeating-linear-gradient(180deg, rgba(0,0,0,0.22) 0 2px, transparent 2px 4px)' }} />
      <Haze y={50} a={0.1} color="60,220,160" size="55% 45%" />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)' }} />
    </>
  )
}

/* ------------------------------------------------------------------ desk: night office, window-blind light */

function Desk({ t, camera }: { t: number; camera: Cam }) {
  return (
    <>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, #17120d 0%, #1d1711 60%, #120e0a 100%)' }} />
      <Material freq="0.35" octaves={3} matrix="0 0 0 0 0.4  0 0 0 0 0.32  0 0 0 0 0.24  0 0 0 0.09 0" />
      <Haze x={24} y={20} a={0.12} color="255,190,120" size="45% 45%" />
      {/* Desk top with wood grain, seen slightly from above. */}
      <div style={{ position: 'absolute', left: -120, right: -120, top: 845 - camera.y * 0.05, height: 400, transform: `translateX(${-camera.x * 0.05}px)`, overflow: 'hidden', boxShadow: '0 -30px 70px rgba(0,0,0,0.7)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #5a3d24 0%, #3a2616 60%, #24170d 100%)' }} />
        <svg width={2200} height={400} style={{ position: 'absolute', inset: 0, opacity: 0.55, mixBlendMode: 'multiply' }}>
          <filter id="woodGrain">
            <feTurbulence type="fractalNoise" baseFrequency="0.0025 0.09" numOctaves={4} seed={7} />
            <feColorMatrix type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.15  0 0 0 0 0.08  0 0 0 1 0" />
          </filter>
          <rect width={2200} height={400} filter="url(#woodGrain)" />
        </svg>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 4, background: 'rgba(255,214,160,0.35)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(40% 70% at 22% 0%, rgba(255,200,140,0.22), transparent 70%)' }} />
      </div>
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} style={{ position: 'absolute', left: rand(i + 3) * W - camera.x * 0.12, top: 120 + rand(i + 30) * 520, width: 60 + rand(i) * 120, height: 60 + rand(i) * 120, borderRadius: '50%', background: '#ffcf99', opacity: 0.035 + 0.03 * Math.sin(t * 0.5 + i), filter: 'blur(14px)' }} />
      ))}
    </>
  )
}

/* ------------------------------------------------------------------ studio: cyclorama with softbox */

function Studio({ t, camera }: { t: number; camera: Cam }) {
  const sx = -camera.x * 0.03
  return (
    <>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, #0b0e15 0%, #121723 58%, #171c28 70%, #0c0f16 100%)' }} />
      {/* The curved wall-to-floor sweep of a cyclorama. */}
      <AbsoluteFill style={{ background: 'radial-gradient(140% 40% at 50% 66%, rgba(180,195,225,0.09), transparent 60%)' }} />
      {/* Softbox above, and its long reflection on the glossy floor. */}
      <div style={{ position: 'absolute', left: 560 + sx, top: -140, width: 800, height: 260, borderRadius: 40, background: 'rgba(220,230,255,0.10)', filter: 'blur(60px)' }} />
      <div style={{ position: 'absolute', left: 660 + sx * 1.6, top: 790, width: 600, height: 120, borderRadius: '50%', background: 'rgba(200,215,245,0.06)', filter: 'blur(40px)' }} />
      <AbsoluteFill style={{ background: `conic-gradient(from 168deg at ${50 + sx / 30}% -20%, transparent 0deg, rgba(210,225,255,0.06) 12deg, transparent 24deg)`, filter: 'blur(20px)' }} />
      <Material freq="0.7" octaves={2} matrix="0 0 0 0 0.7  0 0 0 0 0.75  0 0 0 0 0.85  0 0 0 0.035 0" />
      <Haze y={45} a={0.05 + 0.01 * Math.sin(t * 0.5)} color="200,215,255" size="60% 40%" />
    </>
  )
}

/* ------------------------------------------------------------------ board: cork under a spotlight */

function Board({ t, camera }: { t: number; camera: Cam }) {
  return (
    <>
      <AbsoluteFill style={{ background: '#2a1d12' }} />
      <Material freq="0.9" octaves={3} matrix="0 0 0 0 0.55  0 0 0 0 0.38  0 0 0 0 0.22  0 0 0 0.45 0" />
      <Material freq="0.03" octaves={3} matrix="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.45 0" blend="multiply" />
      <AbsoluteFill
        style={{
          background: `radial-gradient(42% 52% at ${50 + Math.sin(t * 0.3) * 3 - (camera.x - 960) * 0.004}% ${44 + Math.cos(t * 0.25) * 2}%, rgba(255,222,170,0.32), rgba(255,200,140,0.06) 55%, transparent 75%)`,
        }}
      />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(8,5,2,0.85) 100%)' }} />
    </>
  )
}

/* ------------------------------------------------------------------ plain: flat drafting surface */

function Plain({ camera }: { camera: Cam }) {
  return (
    <>
      <AbsoluteFill style={{ background: '#0b0f17' }} />
      <AbsoluteFill
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1.2px, transparent 1.4px)',
          backgroundSize: '40px 40px',
          backgroundPosition: `${-camera.x * 0.1}px ${-camera.y * 0.1}px`,
        }}
      />
    </>
  )
}

/**
 * Deep navy glow: royal-blue light in the centre falling off to near-black corners, a few thin light streaks
 * drifting horizontally, faint specks of dust. Calm enough for diagrams, rich enough to feel premium.
 */
function Soft({ t, camera }: { t: number; camera: Cam }) {
  const px = -(camera.x - W / 2) * 0.05
  const py = -(camera.y - H / 2) * 0.05
  const streaks = [
    { y: 300, w: 420, s: 60, o: 0.35 },
    { y: 760, w: 300, s: 44, o: 0.25 },
    { y: 980, w: 520, s: 70, o: 0.2 },
  ]
  return (
    <>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 75% 70% at 50% 42%, #1840b8 0%, #0c2276 38%, #061245 70%, #020722 100%)' }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 40% 30% at 50% 0%, rgba(120,170,255,0.25), transparent 70%)', transform: `translate(${px}px, ${py}px)` }} />
      {streaks.map((k, i) => {
        const x = wrap(t * k.s + i * 700 + px * 2, W + k.w * 2) - k.w
        return <div key={i} style={{ position: 'absolute', left: x, top: k.y + py, width: k.w, height: 2, borderRadius: 1, background: 'linear-gradient(90deg, transparent, rgba(150,190,255,0.9), transparent)', opacity: k.o, boxShadow: '0 0 12px rgba(120,170,255,0.8)' }} />
      })}
      {Array.from({ length: 26 }, (_, i) => (
        <div key={`d${i}`} style={{ position: 'absolute', left: rand(i) * W + px * (0.5 + rand(i + 9)), top: wrap(rand(i + 3) * H - t * (6 + rand(i + 5) * 10), H) + py, width: 3, height: 3, borderRadius: 2, background: '#9cc0ff', opacity: 0.15 + rand(i + 7) * 0.35 }} />
      ))}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 85% 80% at 50% 50%, transparent 55%, rgba(1,4,20,0.75) 100%)' }} />
    </>
  )
}

/* ------------------------------------------------------------------ registry */

export const BACKDROPS: Record<BackdropName, { label: string; use: string; warm: boolean }> = {
  soft: { label: 'Navy phát sáng', use: 'chuẩn mới: nền navy, thẻ viền sáng, khối 3D xanh bóng', warm: false },
  plain: { label: 'Bản vẽ phẳng', use: 'phong cách sơ đồ kỹ thuật (tối)', warm: false },
  grid: { label: 'Lưới kỹ thuật', use: 'mặc định — phong cách chuẩn của khoá học', warm: false },
  board: { label: 'Bảng điều tra', use: 'mở đầu kiểu "hồ sơ vụ việc"', warm: true },
  blueprint: { label: 'Bản vẽ kỹ thuật', use: 'công thức, kiến trúc, cấu trúc file', warm: false },
  servers: { label: 'Phòng máy chủ', use: 'sự cố vận hành, broker, cluster', warm: false },
  terminal: { label: 'Terminal', use: 'log, lệnh CLI, debug', warm: false },
  desk: { label: 'Bàn làm việc đêm', use: 'ví dụ đời thường, câu chuyện', warm: true },
  studio: { label: 'Studio', use: 'tóm tắt, chữ lớn, khoảnh khắc "à ra thế"', warm: false },
}

/** Pushes every backdrop back: darker, calmer centre (where content lives), details survive only near the edges. */
function Calm() {
  return <AbsoluteFill style={{ background: 'radial-gradient(ellipse 62% 58% at 50% 50%, rgba(5,7,15,0.72) 0%, rgba(5,7,15,0.5) 60%, rgba(5,7,15,0.32) 100%)' }} />
}

export function Backdrop({ name, t, camera }: { name: BackdropName; t: number; camera: Cam }): ReactNode {
  return (
    <>
      <BackdropBase name={name} t={t} camera={camera} />
      {(name === 'servers' || name === 'terminal' || name === 'desk' || name === 'blueprint') && <Calm />}
    </>
  )
}

function BackdropBase({ name, t, camera }: { name: BackdropName; t: number; camera: Cam }): ReactNode {
  switch (name) {
    case 'soft':
      return <Soft t={t} camera={camera} />
    case 'plain':
      return <Plain camera={camera} />
    case 'board':
      return <Board t={t} camera={camera} />
    case 'blueprint':
      return <Blueprint t={t} camera={camera} />
    case 'servers':
      return <Servers t={t} camera={camera} />
    case 'terminal':
      return <Terminal t={t} camera={camera} />
    case 'desk':
      return <Desk t={t} camera={camera} />
    case 'studio':
      return <Studio t={t} camera={camera} />
    default:
      return <Grid t={t} camera={camera} />
  }
}
