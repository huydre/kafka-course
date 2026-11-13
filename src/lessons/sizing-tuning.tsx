import type { CSSProperties, ReactNode } from 'react'
import { cameraAt, clamp, lerp, move, sp, span, vis } from '../player/motion-kit'
import { ConsumerUnit, Envelope, HERO, Icon3D, Packets, ProducerBox, Rise, SOFT, SOFT_PANEL, ServerUnit, SoftScene, SoftTheme, Statement, SummaryList } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene, SceneSfx } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { sizingTuningScript } from './sizing-tuning-script'

/** This lesson is drawn in the navy glow style. */
const INK = SOFT
const panel = SOFT_PANEL
const WIDE = { x: 960, y: 540, s: 1 }
const GLOW: CSSProperties = { background: 'rgba(8,22,82,0.92)', border: '1.5px solid #6ea2ff', boxShadow: '0 0 18px rgba(77,141,255,0.65), inset 0 1px 0 rgba(255,255,255,0.15)', color: '#ffffff' }
const HERO_SHADOW = '0 0 34px rgba(77,141,255,0.6), 0 24px 50px rgba(0,4,30,0.6), inset 0 2px 0 rgba(255,255,255,0.5)'

/** 1234567 -> "1.234.567" (Vietnamese thousands). */
const fmtN = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/** Time held in 1/6 s steps so counters change in whole jumps instead of smearing digits. */
const snap = (t: number) => Math.floor(t * 6) / 6

/** Glowing pill label at (x, y) top-left. */
function Chip({ x, y, text, color = '#ffffff', border, size = 30, o = 1, mono = false }: { x: number; y: number; text: string; color?: string; border?: string; size?: number; o?: number; mono?: boolean }) {
  if (o <= 0) return null
  return (
    <div style={{ position: 'absolute', left: x, top: y, ...GLOW, border: `1.5px solid ${border ?? '#6ea2ff'}`, padding: '8px 22px', borderRadius: 999, fontSize: size, fontWeight: 800, fontFamily: mono ? MONO : undefined, fontVariantNumeric: 'tabular-nums', color, whiteSpace: 'nowrap', opacity: clamp(o) }}>
      {text}
    </div>
  )
}

/** Plain label (no pill). */
function Label({ x, y, text, color = INK.faint, size = 28, o = 1, weight = 700 }: { x: number; y: number; text: string; color?: string; size?: number; o?: number; weight?: number }) {
  if (o <= 0) return null
  return <div style={{ position: 'absolute', left: x, top: y, fontSize: size, fontWeight: weight, fontVariantNumeric: 'tabular-nums', color, whiteSpace: 'nowrap', opacity: clamp(o) }}>{text}</div>
}

/** Horizontal gauge: track + glowing fill (p = 0..1). */
function Bar({ x, y, w, h = 56, p, color, o = 1 }: { x: number; y: number; w: number; h?: number; p: number; color?: string; o?: number }) {
  return (
    <div style={{ opacity: clamp(o) }}>
      <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: h / 2, background: 'rgba(110,160,255,0.16)', border: '1.5px solid rgba(110,160,255,0.5)', boxSizing: 'border-box' }} />
      <div style={{ position: 'absolute', left: x, top: y, width: Math.max(0, w * clamp(p)), height: h, borderRadius: h / 2, background: color ?? HERO, boxShadow: `0 0 20px ${color ?? 'rgba(77,141,255,0.8)'}` }} />
    </div>
  )
}

/** Round "worker thread" dot. */
function Thread({ x, y, size = 84, busy = true, dashed = false, color, label, o = 1 }: { x: number; y: number; size?: number; busy?: boolean; dashed?: boolean; color?: string; label?: string; o?: number }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: size / 2, boxSizing: 'border-box', display: 'grid', placeItems: 'center', fontSize: Math.max(24, Math.round(size * 0.34)), fontWeight: 800, color: busy && !dashed ? '#fff' : INK.faint, background: dashed ? 'transparent' : busy ? (color ? `linear-gradient(160deg, ${color}cc, ${color})` : HERO) : 'rgba(40,62,140,0.5)', border: dashed ? `2.5px dashed ${color ?? INK.warn}` : busy ? 'none' : '1.5px solid rgba(110,160,255,0.5)', boxShadow: busy && !dashed ? `0 0 22px ${color ?? 'rgba(77,141,255,0.7)'}, inset 0 2px 0 rgba(255,255,255,0.5)` : undefined, opacity: clamp(o) }}>
      {label}
    </div>
  )
}

const Group = ({ dy = 0, children }: { dy?: number; children: ReactNode }) => <div style={{ position: 'absolute', inset: 0, transform: `translateY(${dy}px)` }}>{children}</div>

/* ------------------------------------------------------------------ 0. hook: the missing factors */

function hook(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const d0 = c.end(0) - a0
  const d1 = c.end(1) - a1
  const d2 = c.end(2) - a2
  const grid = Array.from({ length: 9 }, (_, i) => ({ x: 1260 + (i % 3) * 200, y: 380 + Math.floor(i / 3) * 190 }))
  const strike = move(t, a2 + 0.3, 0.5)
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, { x: 960, y: 540, s: 1.03 }], [a1, { x: 980, y: 560, s: 1.06 }, 1.2], [a2, WIDE, 1.2]])}>
      <Rise t={t} at={0.3}>
        <div style={{ ...INK.card, position: 'absolute', left: 110, top: 290, width: 620, height: 220, boxSizing: 'border-box', padding: '24px 36px' }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: INK.faint }}>producer · đơn hàng</div>
          <div style={{ fontSize: 92, fontWeight: 800, letterSpacing: -2, color: '#fff', lineHeight: 1.2 }}>10 MB/giây</div>
        </div>
      </Rise>
      <Icon3D name="clock" x={220} y={650} size={170} t={t} at={a0 + d0 * 0.55} />
      <Chip x={340} y={618} text="giữ 7 ngày" size={48} o={vis(t, a0 + d0 * 0.6)} />
      <Packets t={t} from={{ x: 750, y: 400 }} to={{ x: 1240, y: 560 }} start={0.9} every={0.4} len={1.5} size={34} />
      <div style={{ opacity: 1 - span(t, a2 + 0.2, a2 + 0.6) }}>
        <Icon3D name="folder" x={1450} y={560} size={330} t={t} at={0.6} />
      </div>
      {grid.map((g, i) => (
        <Icon3D key={i} name="folder" x={g.x + 40} y={g.y} size={190} t={t} at={a2 + 0.3 + i * 0.12} />
      ))}
      <Icon3D name="calculator" x={230} y={870} size={180} t={t} at={a1 + 0.3} />
      <Chip x={350} y={836} text="10 × 86.400 × 7 ≈ 6 TB" size={46} o={vis(t, a1 + d1 * 0.45)} />
      <Statement x={1250} y={150} text="6 TB?" size={118} color={INK.warn} o={sp(t, a1 + d1 * 0.7) * (1 - span(t, a2 + 0.9, a2 + 1.2))} />
      <div style={{ position: 'absolute', left: 1230, top: 222, width: 360 * strike, height: 9, borderRadius: 5, background: INK.bad, boxShadow: `0 0 16px ${INK.bad}`, opacity: 1 - span(t, a2 + 0.9, a2 + 1.2) }} />
      <div style={{ position: 'absolute', inset: 0, transformOrigin: '1400px 190px', transform: `scale(${1 + 0.05 * Math.sin(Math.max(0, t - (a2 + 2.2)) * 3.2) * span(t, a2 + 2.2, a2 + 2.6)})` }}>
        <Statement x={1190} y={110} text="26 TB" size={150} color={INK.good} o={sp(t, a2 + 1.2)} />
      </div>
      {[
        { x: 110, text: 'bản sao RF', at: 0.45 },
        { x: 480, text: 'khoảng trống dự phòng', at: 0.62 },
        { x: 1090, text: 'đỉnh tải', at: 0.82 },
      ].map((f) => (
        <Rise key={f.text} t={t} at={a2 + d2 * f.at}>
          <Chip x={f.x} y={960} text={f.text} size={40} color={INK.warn} border={INK.warn} />
        </Rise>
      ))}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 1. disk: a chain of multiplications */

function disk(t: number, c: Cue) {
  const A = [0, 1, 2, 3].map((k) => c.at(k))
  const CARDS = [
    { label: '10 MB × 86.400 s', to: 864, unit: 'GB', sub: 'mỗi ngày' },
    { label: '× 7 ngày', to: 6, unit: 'TB', sub: 'giữ 7 ngày' },
    { label: '× RF 3', to: 18, unit: 'TB', sub: 'đủ 3 bản sao' },
    { label: '÷ 0,7 (dùng 70% đĩa)', to: 26, unit: 'TB', sub: 'cả cluster' },
  ]
  const ROWY = [610, 750, 890]
  const fx = (i: number) => 300 + i * 120
  // folders: day 1 (beat 0), days 2-7 (beat 1), copies 2 and 3 (beat 2)
  const d1 = c.end(1) - A[1]
  const d2 = c.end(2) - A[2]
  const folderAt = (r: number, i: number) => (r === 0 ? (i === 0 ? A[0] + 1.2 : A[1] + 0.2 + ((i - 1) * (d1 - 1.2)) / 5) : A[2] + 0.3 + ((r - 1) * 7 + i) * ((d2 - 1.2) / 14))
  const fill = 18 / 26
  const d0 = c.end(0) - A[0]
  const written = 864000 * move(snap(t), A[0] + 1.2, Math.max(1, d0 - 1.4))
  const days = Array.from({ length: 7 }, (_, i) => (t >= folderAt(0, i) ? 1 : 0)).reduce((s: number, x) => s + x, 0)
  const barP = move(t, A[3] + 0.6, 1.4)
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [A[1], { x: 960, y: 560, s: 1.03 }, 1.2]])} title={{ kicker: 'DUNG LƯỢNG', text: 'Đĩa: chuỗi phép nhân' }}>
      {CARDS.map((cd, k) => {
        const active = t >= A[k] && t < (k < 3 ? A[k + 1] : Infinity)
        const v = cd.to * move(t, A[k] + 0.4, 1.3)
        const x = 80 + k * 460
        return (
          <div key={cd.label}>
            <Rise t={t} at={A[k] + 0.05}>
              <div style={{ ...INK.card, position: 'absolute', left: x, top: 230, width: 380, height: 210, boxSizing: 'border-box', padding: '20px 24px', background: active ? HERO : (INK.card.background as string), border: active ? 'none' : (INK.card.border as string), boxShadow: active ? HERO_SHADOW : (INK.card.boxShadow as string) }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: active ? '#ffffff' : INK.faint, whiteSpace: 'nowrap' }}>{cd.label}</div>
                <div style={{ marginTop: 6, fontSize: 80, fontWeight: 800, letterSpacing: -2, color: '#ffffff', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                  {fmtN(v)} <span style={{ fontSize: 48 }}>{cd.unit}</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: active ? '#d6e5ff' : INK.faint }}>{cd.sub}</div>
              </div>
            </Rise>
            {k > 0 && (
              <div style={{ position: 'absolute', left: x - 74, top: 310, opacity: vis(t, A[k] + 0.1) }}>
                <svg width={68} height={50} viewBox="0 0 68 50" fill="none" stroke="#9cc2ff" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 8px #5b97ff)' }}>
                  <path d="M6 25h54M40 8l20 17-20 17" />
                </svg>
              </div>
            )}
          </div>
        )
      })}
      {/* three copies of seven day-folders */}
      {ROWY.map((y, r) => (
        <div key={r}>
          <Label x={100} y={y - 18} text={`bản ${r + 1}`} o={vis(t, folderAt(r, 0) - 0.1)} />
          {Array.from({ length: 7 }, (_, i) => (r === 0 || i >= 0) && <Icon3D key={i} name="folder" x={fx(i)} y={y} size={110} t={t} at={folderAt(r, i)} />)}
        </div>
      ))}
      <Packets t={t} from={{ x: 150, y: ROWY[0] + 55 }} to={{ x: 290, y: ROWY[0] + 55 }} start={0.6} end={A[1]} every={0.22} len={0.5} size={20} />
      <Chip x={300} y={ROWY[1] + 10} size={38} text={t < A[1] ? `ngày 1: ${fmtN(written)} MB` : `${days} ngày × 864 GB = ${fmtN(days * 864)} GB`} o={vis(t, A[0] + 0.8, A[2] - 0.3)} />
      <Label x={1080} y={ROWY[0] - 18} text="7 ngày" color="#ffffff" o={vis(t, A[1] + d1 * 0.85)} />
      {/* the disk to buy */}
      <Icon3D name="battery" x={1330} y={560} size={110} t={t} at={A[3] + 0.2} />
      <Statement x={1410} y={525} text="đĩa phải mua" size={36} color={INK.faint} o={sp(t, A[3] + 0.4)} />
      <Bar x={1250} y={690} w={570} h={96} p={barP * fill} o={vis(t, A[3] + 0.4)} />
      <div style={{ position: 'absolute', left: 1250 + 570 * 0.7 - 2, top: 676, width: 4, height: 124, borderRadius: 2, background: '#ffffff', boxShadow: '0 0 12px #fff', opacity: vis(t, A[3] + 1.2) }} />
      <Label x={1262} y={712} text="18 TB" color="#ffffff" size={40} weight={800} o={vis(t, A[3] + 1.4)} />
      <Label x={1250} y={808} text="70%: chừa 30% cho đỉnh tải" color={INK.warn} o={vis(t, A[3] + 1.8)} />
      <Statement x={1250} y={852} text="= 26 TB" size={64} color={INK.good} o={sp(t, A[3] + 2.2)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 2. network: out is bigger than in */

function network(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const d1 = c.end(1) - a1
  const d2 = c.end(2) - a2
  const TY = [230, 370, 510, 650, 790]
  const NAMES = ['group A', 'group B', 'group C', 'follower 1 · sao chép', 'follower 2 · sao chép']
  const appear = [a1 + d1 * 0.12, a1 + d1 * 0.22, a1 + d1 * 0.32, a1 + d1 * 0.62, a1 + d1 * 0.8]
  const n = appear.filter((x) => t >= x + 0.4).length
  const hot = clamp(span(t, a3 + 0.3, a3 + 1.4))
  const colorOf = (i: number) => (hot > 0.5 && i >= 3 ? INK.bad : hot > 0.5 ? INK.warn : INK.accent)
  const L = { x: 900, y: 495 }
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 540, s: 1.03 }, 1.2]])} title={{ kicker: 'MẠNG', text: 'Chiều ra nhiều hơn chiều vào' }}>
      <Rise t={t} at={0.3}>
        <ProducerBox x={100} y={430} w={380} title="producer" line="1 MB/giây" />
      </Rise>
      <Rise t={t} at={0.5}>
        <ServerUnit x={640} y={430} name="broker · leader" t={t} />
      </Rise>
      <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
        <path d="M480 480 L640 495" fill="none" stroke="rgba(110,160,255,0.55)" strokeWidth={18} strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 8px #5b97ff)' }} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - move(t, 0.8, 0.5)} />
        {TY.map((y, i) => (
          <path key={i} d={`M${L.x} ${L.y} C1080 ${L.y} 1100 ${y} 1270 ${y}`} fill="none" stroke={colorOf(i)} strokeOpacity={0.55} strokeWidth={18} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 8px ${colorOf(i)})` }} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - move(t, appear[i], 0.5)} />
        ))}
      </svg>
      <Packets t={t} from={{ x: 480, y: 480 }} to={{ x: 640, y: 495 }} start={1.2} every={0.5} len={0.7} size={20} />
      {TY.map((y, i) => (
        <Packets key={i} t={t} from={{ x: L.x, y: L.y }} to={{ x: 1270, y }} start={appear[i] + 0.5} every={hot > 0.5 && i >= 3 ? 1.1 : 0.5} len={hot > 0.5 && i >= 3 ? 1.6 : 0.9} size={18} color={colorOf(i)} />
      ))}
      {TY.map((y, i) => (
        <Rise key={NAMES[i]} t={t} at={appear[i] + 0.4}>
          <div style={{ ...panel, left: 1290, top: y - 42, width: 440, height: 84, boxSizing: 'border-box', display: 'flex', alignItems: 'center', fontSize: 32, border: hot > 0.5 && i >= 3 ? `2px solid ${INK.bad}` : (panel.border as string), color: hot > 0.5 && i >= 3 ? INK.bad : INK.text }}>
            {hot > 0.5 && i >= 3 ? NAMES[i].replace('sao chép', 'tụt lại') : NAMES[i]}
          </div>
        </Rise>
      ))}
      <Chip x={100} y={600} text="vào: 1 MB/giây" color={INK.good} border={INK.good} o={vis(t, a0 + 1.4)} />
      <Chip x={640} y={640} text={`ra: ${n} MB/giây`} color={n >= 5 ? INK.warn : '#ffffff'} border={n >= 5 ? INK.warn : undefined} o={vis(t, a1 + 0.2)} size={34} />
      <Statement x={100} y={740} text={t < a2 + d2 * 0.4 ? '1 × (3 + 2)' : '1 × (3 + 2) = 5 MB/giây'} size={52} color={INK.warn} o={sp(t, a2 + 0.5)} />
      <Icon3D name="wifi" x={700} y={900} size={120} t={t} at={a2 + d2 * 0.55} />
      <Chip x={790} y={872} text="card mạng 10 Gb" size={32} o={vis(t, a2 + d2 * 0.55 + 0.5)} />
      <Chip x={1290} y={900} text="thiếu bản sao (URP)" size={32} color={INK.bad} border={INK.bad} o={vis(t, a3 + 1.8)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 3. partitions */

function partitions(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const d1 = c.end(1) - a1
  const dy = lerp(150, 0, move(t, a2 - 0.2, 0.8))
  const blockAt = (i: number) => a1 + 0.5 + (i * (d1 - 2.2)) / 9
  const done = Math.min(10, Array.from({ length: 10 }, (_, i) => (t >= blockAt(i) + 0.2 ? 1 : 0)).reduce((s: number, x) => s + x, 0))
  const dim = 1 - 0.65 * span(t, a2, a2 + 0.5)
  const gaugeP = move(t, a3 + 0.8, 2.4)
  const fillW = 1600 * gaugeP * (14000 / 16000)
  const chips = [
    { icon: 'folder' as const, text: 'file mở, index', at: a2 + 2.5 },
    { icon: 'battery' as const, text: 'bộ nhớ', at: a2 + 3.5 },
    { icon: 'flash' as const, text: 'bầu leader lại', at: a2 + 4.5 },
  ]
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 1000, y: 520, s: 1.06 }, 1.2], [a2, WIDE, 1.2]])} title={{ kicker: 'PARTITION', text: 'Bao nhiêu là đủ?' }}>
      <Group dy={dy}>
        <Icon3D name="flash" x={200} y={290} size={120} t={t} at={a0 + 0.4} />
        <Chip x={290} y={262} text="T = 50 MB/giây" size={34} o={vis(t, a0 + 0.8)} />
        <Chip x={760} y={262} text="c = 5 MB/giây / consumer" size={34} o={vis(t, a0 + 2.4)} />
        <Statement x={1360} y={252} text="T ÷ c" size={64} color={INK.accent} o={sp(t, a0 + 3.6) * dim} />
        {Array.from({ length: 10 }, (_, i) => (
          <div key={`g${i}`} style={{ position: 'absolute', left: 130 + i * 168, top: 390, width: 148, height: 180, boxSizing: 'border-box', borderRadius: 24, border: '2.5px dashed rgba(110,160,255,0.55)', display: 'grid', placeItems: 'center', fontSize: 44, fontWeight: 800, color: INK.faint, opacity: vis(t, a0 + 2.0 + i * 0.25) * (1 - span(t, blockAt(i), blockAt(i) + 0.3)) }}>
            ?
          </div>
        ))}
        {Array.from({ length: 10 }, (_, i) => (
          <Rise key={i} t={t} at={blockAt(i)}>
            <div style={{ position: 'absolute', left: 130 + i * 168, top: 390, width: 148, height: 180, borderRadius: 24, background: HERO, boxShadow: HERO_SHADOW, display: 'grid', placeItems: 'center', opacity: dim * (1 - 0.6 * span(t, a3, a3 + 0.5)) }}>
              <div style={{ textAlign: 'center', color: '#fff' }}>
                <div style={{ fontSize: 40, fontWeight: 800 }}>P{i}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#d6e5ff' }}>5 MB/s</div>
              </div>
            </div>
          </Rise>
        ))}
        <Statement x={130} y={620} text="50 ÷ 5 = ?" size={78} color="#ffffff" o={sp(t, a0 + 3.4) * (1 - span(t, a1 + 0.2, a1 + 0.5))} />
        <Statement x={130} y={620} text={`${done * 5} ÷ 5 = ${done} partition`} size={78} color={done >= 10 ? INK.good : '#ffffff'} o={sp(t, a1 + 0.5) * (1 - span(t, a2, a2 + 0.4))} />
        {done >= 10 && <Chip x={1320} y={636} text="≥ 10 partition" size={40} color={INK.good} border={INK.good} o={vis(t, blockAt(9) + 0.4) * (1 - span(t, a2, a2 + 0.4))} />}
      </Group>
      <Statement x={130} y={632} text="500 partition cho chắc?" size={66} color={INK.bad} o={sp(t, a2 + 0.5) * (1 - span(t, a3, a3 + 0.4))} />
      {chips.map((ch) => (
        <Rise key={ch.text} t={t} at={ch.at}>
          <div style={{ opacity: 1 - span(t, a3 - 0.2, a3 + 0.3) }}>
            <div style={{ ...INK.card, position: 'absolute', left: 130 + chips.indexOf(ch) * 590, top: 760, width: 540, height: 160, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 20, padding: '0 28px' }}>
              <Icon3D name={ch.icon} x={80} y={80} size={110} t={t} at={ch.at} />
              <div style={{ marginLeft: 120, fontSize: 38, fontWeight: 800, color: INK.text }}>{ch.text}</div>
            </div>
          </div>
        </Rise>
      ))}
      {/* partition-replicas per broker gauge */}
      <Label x={160} y={690} text="partition-replica mỗi broker" color="#ffffff" size={34} weight={800} o={vis(t, a3 + 0.5)} />
      <Bar x={160} y={780} w={1600} h={64} p={fillW / 1600} o={vis(t, a3 + 0.5)} color={gaugeP > 0.95 ? INK.warn : undefined} />
      <div style={{ position: 'absolute', left: 160 + 400 - 2, top: 760, width: 4, height: 104, borderRadius: 2, background: '#fff', opacity: vis(t, a3 + 0.8) }} />
      <div style={{ position: 'absolute', left: 160 + 1400 - 2, top: 760, width: 4, height: 104, borderRadius: 2, background: INK.warn, opacity: vis(t, a3 + 0.8) }} />
      <Label x={160 + 400 - 150} y={872} text="4.000 · cũ (ZooKeeper)" color="#ffffff" o={vis(t, a3 + 1.4)} />
      <Label x={160 + 1400 - 150} y={872} text="14.000 · sách khuyên" color={INK.warn} o={vis(t, a3 + 2.4)} />
      <Statement x={160} y={930} text="tính theo lưu lượng tương lai" size={44} color={INK.good} o={sp(t, a3 + 4.0)} />
      <Icon3D name="rocket" x={1000} y={955} size={110} t={t} at={a3 + 5.6} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 4. producer: batching */

function producer(t: number, c: Cue) {
  const [a0, a1, a2, a3, a4] = [c.at(0), c.at(1), c.at(2), c.at(3), c.at(4)]
  const d2 = c.end(2) - a2
  const d3 = c.end(3) - a3
  const d4 = c.end(4) - a4
  const BX = 640
  const BY = 330
  const shipA = a2 - 0.3
  const shipB = a2 + d2 * 0.78
  // cell i switches on at the time returned for the current batch
  const f1 = a1 + 0.9
  const s1 = (c.end(1) - 0.6 - f1) / 17
  const f2 = a2 + 0.8
  const s2 = (shipB - 0.5 - f2) / 17
  const f3 = a3 + 0.2
  const s3 = 0.07
  const on = (i: number) => (t < shipA + 0.6 ? t >= f1 + i * s1 : t < shipB + 0.7 ? t >= f2 + i * s2 : t >= f3 + i * s3)
  const squeeze = 1 - 0.68 * move(t, a3 + d3 * 0.4, 1.2)
  const full1 = t >= f1 + 17 * s1 && t < shipA + 0.6
  const lingerP = span(t, f2, shipB - 0.5)
  const req = lerp(1000, 100, move(snap(t), a2 + d2 * 0.45, 1.8))
  const kb = lerp(16, 4, move(snap(t), a3 + d3 * 0.4, 1.2))
  const showBox = t >= a1 + 0.2
  const cfg: [string, number][] = [
    ['batch.size = 16 KB', a1 + 0.4],
    ['linger.ms = 10', a2 + 0.4],
    ['compression = lz4', a3 + 0.4],
    ['acks = all', a4 + 0.4],
  ]
  const ackAt = a4 + d4 * 0.35
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 900, y: 540, s: 1.07 }, 1.2], [a3, { x: 960, y: 540, s: 1.05 }, 1.2], [a4, WIDE, 1.2]])} title={{ kicker: 'PRODUCER', text: 'Gom lô để gửi ít hơn' }}>
      <Rise t={t} at={0.3}>
        <ProducerBox x={100} y={380} w={400} title="producer" line="tin 100 byte" />
      </Rise>
      <Rise t={t} at={0.5}>
        <ServerUnit x={1450} y={400} name="broker" t={t} />
      </Rise>
      <Packets t={t} from={{ x: 505, y: 430 }} to={{ x: 1440, y: 465 }} start={0.9} end={a1 - 0.6} every={0.25} len={1.5} size={26} />
      {/* config panel */}
      <div style={{ ...INK.card, position: 'absolute', left: 100, top: 590, width: 480, height: 32 + 56 * cfg.filter(([, at]) => t >= at).length, boxSizing: 'border-box', padding: '16px 24px', opacity: vis(t, a1 + 0.2) }}>
        {cfg.map(([txt, at]) => (
          <div key={txt} style={{ fontFamily: MONO, fontSize: 28, fontWeight: 700, lineHeight: '56px', color: t >= at && t < at + 3 ? '#ffffff' : t >= at ? INK.faint : 'transparent', textShadow: t >= at && t < at + 3 ? '0 0 14px #5b97ff' : undefined, opacity: vis(t, at, Infinity, 0.3) }}>
            {txt}
          </div>
        ))}
      </div>
      {showBox && (
        <>
          <Rise t={t} at={a1 + 0.2}>
            <div style={{ ...INK.card, position: 'absolute', left: BX, top: BY, width: lerp(520, 230, move(t, a3 + d3 * 0.4, 1.2)), height: 280, boxSizing: 'border-box', border: full1 || t >= a3 + 1.5 ? '2px solid #ffffff' : (INK.card.border as string) }} />
          </Rise>
          <Label x={BX} y={BY - 52} text="batch.size = 16 KB" color="#ffffff" size={32} weight={800} o={vis(t, a1 + 0.4)} />
          <Packets t={t} from={{ x: 505, y: 430 }} to={{ x: BX + 40, y: BY + 100 }} start={a1 + 0.7} end={c.end(1) - 0.6} every={0.28} len={0.7} size={20} />
          <Packets t={t} from={{ x: 505, y: 430 }} to={{ x: BX + 40, y: BY + 100 }} start={f2} end={shipB - 0.5} every={0.4} len={0.7} size={20} />
          <Packets t={t} from={{ x: 505, y: 430 }} to={{ x: BX + 40, y: BY + 100 }} start={f3} end={f3 + 1.3} every={0.14} len={0.5} size={20} />
          <div style={{ position: 'absolute', left: BX + 28, top: BY + 28, width: 464, height: 224, transform: `scaleX(${squeeze})`, transformOrigin: 'left center' }}>
            {Array.from({ length: 18 }, (_, i) => on(i) && <div key={i} style={{ position: 'absolute', left: (i % 6) * 80, top: Math.floor(i / 6) * 80, width: 64, height: 64, borderRadius: 14, background: HERO, boxShadow: '0 0 14px rgba(77,141,255,0.7), inset 0 2px 0 rgba(255,255,255,0.5)' }} />)}
          </div>
        </>
      )}
      {/* shipping */}
      <Envelope t={t} at={shipA} from={{ x: BX + 530, y: BY + 140 }} to={{ x: 1440, y: 465 }} label="1 request" len={1.0} arc={30} />
      <Envelope t={t} at={shipB} from={{ x: BX + 530, y: BY + 140 }} to={{ x: 1440, y: 465 }} label="1 request" len={1.0} arc={30} />
      <Envelope t={t} at={a3 + d3 * 0.4 + 1.6} from={{ x: BX + 530, y: BY + 140 }} to={{ x: 1440, y: 465 }} label="request nhỏ" len={1.0} arc={30} />
      {/* beat captions share one slot */}
      <Chip x={BX} y={720} text="1 tin = 1 request" color={INK.warn} border={INK.warn} size={40} o={vis(t, a0 + 1.4, a1 - 0.2)} />
      <Chip x={BX} y={810} text={`đã gửi: ${fmtN(Math.max(0, Math.min(t, a1 - 0.6) - 0.9) * 40)} request`} size={40} o={vis(t, a0 + 1.4, a1 - 0.2)} />
      <Chip x={BX} y={720} text="thùng đầy → gửi 1 request" size={36} o={vis(t, c.end(1) - 0.8, a2 - 0.2)} />
      {/* linger */}
      <Label x={BX} y={640} text={`linger.ms: ${Math.round(lingerP * 10)} / 10`} color="#ffffff" size={30} weight={800} o={vis(t, a2 + 0.3, a3 - 0.2)} />
      <Bar x={BX} y={685} w={520} h={30} p={lingerP} o={vis(t, a2 + 0.3, a3 - 0.2)} />
      <Chip x={BX} y={760} text={`request/giây: ${fmtN(Math.round(req / 10) * 10)}`} size={38} color={req < 500 ? INK.good : INK.warn} border={req < 500 ? INK.good : INK.warn} o={vis(t, a2 + d2 * 0.4, a3 - 0.2)} />
      {/* compression */}
      <Chip x={BX} y={680} text="nén lz4 / zstd" size={34} o={vis(t, a3 + 0.4, a4 - 0.2)} />
      <Chip x={BX} y={760} text={`qua mạng: ${Math.round(kb)} KB`} size={38} color={kb < 8 ? INK.good : INK.warn} border={kb < 8 ? INK.good : INK.warn} o={vis(t, a3 + d3 * 0.3, a4 - 0.2)} />
      <Chip x={1440} y={640} text="mạng + đĩa giảm" size={32} color={INK.good} border={INK.good} o={vis(t, a3 + d3 * 0.8, a4 - 0.2)} />
      {/* acks */}
      {['leader', 'follower 1', 'follower 2'].map((nm, i) => (
        <Rise key={nm} t={t} at={a4 + 0.6 + i * 0.6}>
          <div style={{ ...panel, left: 1440, top: 600 + i * 100, width: 320, height: 80, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 14, fontSize: 32 }}>
            <Icon3D name="tick" x={40} y={40} size={64} t={t} at={a4 + 1.0 + i * 0.6} float={false} />
            <span style={{ marginLeft: 66 }}>{nm}</span>
          </div>
        </Rise>
      ))}
      <Chip x={100} y={500} text="nhận ack: đủ 3 bản" size={34} color={INK.good} border={INK.good} o={vis(t, ackAt + 1.2)} />
      <Icon3D name="shield" x={1250} y={720} size={130} t={t} at={a4 + d4 * 0.72} />
      <Chip x={BX} y={720} text="chờ cả 3 bản xác nhận" size={36} color={INK.good} border={INK.good} o={vis(t, a4 + 0.6)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 5. consumer: fetch and poll */

function consumer(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const d1 = c.end(1) - a1
  const dy = lerp(170, 0, move(t, a2 - 1.2, 0.9))
  const tiny = t >= a1 && t < a1 + d1 * 0.42
  const big = !tiny
  // gauge fill: slow cycles for 64 KB, flicker for 1 byte
  const T = tiny ? 0.25 : t < a1 ? 2.6 : 1.4
  const start = tiny ? a1 : t < a1 ? a0 + 1.2 : a1 + d1 * 0.42
  const phase = t < start ? 0 : ((t - start) / T) % 1
  const cycles = Math.floor((t - start) / T)
  const GX = 540
  const GW = 680
  const fetchT = (t < a1 ? 64 : tiny ? 1 : 64)
  const respEvery = (from: number, to: number, per: number) => {
    const out: number[] = []
    for (let x = from + per; x < to; x += per) out.push(x - 0.1)
    return out
  }
  const resp = [...respEvery(a0 + 1.2, a1 - 0.2, 2.6), ...respEvery(a1 + d1 * 0.42, a2 - 0.3, 1.4)]
  void cycles
  void big
  // poll timeline
  const kickStart = a2 + 2.0
  const kickDur = 6.7
  const secs = 500 * span(snap(t), kickStart, kickStart + kickDur)
  const hitAt = kickStart + kickDur * 0.6
  const kicked = t >= hitAt && t < a3 + 0.3
  const fixP = span(t, a3 + 0.8, a3 + 2.4)
  const barS = t < a3 + 0.5 ? secs : 100 * fixP
  const barSmooth = t < a3 + 0.5 ? 500 * span(t, kickStart, kickStart + kickDur) : 100 * fixP
  const PX = 200
  const PW = 1520
  const px = (s: number) => PX + (PW * s) / 600
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, { x: 960, y: 600, s: 1.08 }], [a2 - 1.2, WIDE, 1.2]])} title={{ kicker: 'CONSUMER', text: 'Fetch và poll' }}>
      <Group dy={dy}>
        <Rise t={t} at={0.3}>
          <ServerUnit x={150} y={300} name="broker" t={t} />
        </Rise>
        <Rise t={t} at={0.5}>
          <ConsumerUnit x={1300} y={300} w={440} name="consumer" down={kicked} parts={['P0']} t={t} busy={kicked ? undefined : (t * 0.9) % 1} />
        </Rise>
        <Packets t={t} from={{ x: 420, y: 365 }} to={{ x: GX, y: 365 }} start={a0 + 0.8} every={tiny ? 0.2 : 0.35} len={0.5} size={16} />
        <Rise t={t} at={a0 + 0.7}>
          <div style={{ ...INK.card, position: 'absolute', left: GX, top: 250, width: GW, height: 230, boxSizing: 'border-box' }} />
        </Rise>
        <Label x={GX + 28} y={268} text={`fetch.min.bytes = ${fetchT === 1 ? '1 byte' : '64 KB'}`} color="#ffffff" size={32} weight={800} o={vis(t, a0 + 1.0)} />
        <Bar x={GX + 28} y={338} w={GW - 56} h={56} p={fetchT === 1 ? Math.min(1, phase * 4) : phase} o={vis(t, a0 + 1.0)} />
        <Label x={GX + 28} y={412} text={tiny ? 'đủ 1 byte là trả ngay' : 'chờ tối đa 500 ms'} color={tiny ? INK.warn : INK.faint} size={28} o={vis(t, a0 + 1.4)} />
        <Label x={GX + 440} y={270} text={tiny ? '' : `gom ${Math.round((t < start ? 0 : ((snap(t) - start) / T) % 1) * 64)} / 64 KB`} color={INK.good} size={28} weight={800} o={vis(t, a0 + 1.4)} />
        <Packets t={t} from={{ x: GX + GW, y: 365 }} to={{ x: 1290, y: 359 }} start={tiny ? a1 + 0.3 : a1 + d1 * 0.42 + 0.4} end={tiny ? a1 + d1 * 0.42 : Infinity} every={tiny ? 0.2 : 1.4} len={0.5} size={tiny ? 14 : 28} />
        {resp.map((x) => (
          <Envelope key={x} t={t} at={x} from={{ x: GX + GW, y: 365 }} to={{ x: 1290, y: 359 }} label="64 KB" len={0.5} arc={0} />
        ))}
        <Chip x={GX} y={520} text={`request/giây: ${tiny ? '1.000' : '100'}`} size={34} color={tiny ? INK.warn : INK.good} border={tiny ? INK.warn : INK.good} o={vis(t, a1 + 0.3)} />
        <Chip x={GX + 460} y={520} text="độ trễ cao hơn" size={34} color={INK.warn} border={INK.warn} o={vis(t, a1 + d1 * 0.62)} />
      </Group>
      <Chip x={1300} y={410} text="bị đá khỏi group" size={36} color="#ffffff" border={INK.bad} o={kicked ? 1 : 0} />
      {/* poll timeline */}
      <Chip x={PX} y={622} text={t < a3 ? 'max.poll.records = 500' : 'max.poll.records = 100'} size={36} color={t < a3 ? '#ffffff' : INK.good} border={t < a3 ? undefined : INK.good} o={vis(t, a2 - 1.0)} mono />
      <Chip x={PX + 580} y={622} text="mỗi tin 1 giây" size={34} o={vis(t, a2 - 0.7)} />
      <Bar x={PX} y={770} w={PW} h={70} p={barSmooth / 600} color={barS > 300 ? INK.bad : t >= a3 + 0.5 ? INK.good : undefined} o={vis(t, a2 - 0.9)} />
      <div style={{ position: 'absolute', left: px(300) - 2, top: 740, width: 4, height: 130, borderRadius: 2, background: '#ffffff', boxShadow: '0 0 12px #fff', opacity: vis(t, a2 - 0.8) }} />
      <Label x={px(300) + 16} y={706} text="max.poll.interval.ms · 5 phút" color="#ffffff" o={vis(t, a2 - 0.8)} />
      <Chip x={PX} y={878} text={`${Math.round(barS)} giây`} color="#ffffff" border={barS > 300 ? INK.bad : t >= a3 + 0.5 ? INK.good : undefined} size={44} o={vis(t, a2 - 0.7)} />
      <Chip x={px(300) + 40} y={878} text={barS > 300 ? 'quá hạn → rebalance' : t >= a3 + 0.5 ? '< 5 phút: yên ổn' : ''} color="#ffffff" border={barS > 300 ? INK.bad : INK.good} size={36} o={barS > 300 || t >= a3 + 1.8 ? 1 : 0} />
      <Icon3D name="tick" x={1650} y={680} size={110} t={t} at={a3 + 2.2} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 6. broker: thread pools */

function broker(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const d1 = c.end(1) - a1
  const dy = lerp(110, -80, move(t, a2 - 0.2, 0.9))
  const netAt = (i: number) => a1 + 0.5 + i * 0.5
  const ioAt = (i: number) => a1 + d1 * 0.55 + i * 0.28
  const busy = (i: number, k: number) => ((t * 1.3 + i * 0.37 + k * 0.2) % 1) < 0.72
  const NX = 330
  const IX = 990
  const idleL = 8 * move(t, a2 + 0.9, 1.0)
  const idleR = 70 * move(t, a2 + 1.5, 1.0)
  const xs = (i: number) => 200 + i * 130
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 520, s: 1.06 }, 1.2], [a2, WIDE, 1.2]])} title={{ kicker: 'BROKER', text: 'Hai nhóm luồng' }}>
      <Group dy={dy}>
        <Icon3D name="wifi" x={170} y={460} size={130} t={t} at={0.4} />
        <Label x={110} y={545} text="request" size={28} o={vis(t, 0.8)} />
        <Rise t={t} at={a0 + 0.8}>
          <div style={{ ...INK.card, position: 'absolute', left: NX - 20, top: 310, width: 380, height: 330, boxSizing: 'border-box' }} />
        </Rise>
        <Label x={NX} y={330} text="network threads" color="#ffffff" size={32} weight={800} o={vis(t, a0 + 1.0)} />
        <Rise t={t} at={a0 + 1.6}>
          <div style={{ ...INK.card, position: 'absolute', left: IX - 40, top: 310, width: 600, height: 330, boxSizing: 'border-box' }} />
        </Rise>
        <Label x={IX - 20} y={330} text="io threads" color="#ffffff" size={32} weight={800} o={vis(t, a0 + 1.8)} />
        {[0, 1, 2].map((i) => (
          <Thread key={i} x={NX + i * 112} y={430} busy={busy(i, 0)} label={`N${i + 1}`} o={sp(t, netAt(i))} />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <Thread key={i} x={IX + (i % 4) * 124} y={385 + Math.floor(i / 4) * 100} busy={busy(i, 1)} label={`IO${i + 1}`} o={sp(t, ioAt(i))} />
        ))}
        <Label x={NX} y={590} text="mặc định 3" size={28} o={vis(t, netAt(2) + 0.6)} />
        <Label x={IX - 20} y={590} text="mặc định 8" size={28} o={vis(t, ioAt(7) + 0.4)} />
        {/* request queue */}
        <Label x={720} y={330} text="hàng đợi" size={28} o={vis(t, a0 + 1.6)} />
        <div style={{ position: 'absolute', left: 720, top: 380, width: 120, height: 190, borderRadius: 20, ...INK.card, opacity: vis(t, a0 + 1.6) }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ position: 'absolute', left: 16, top: 16 + i * 56, width: 88, height: 42, borderRadius: 10, background: HERO, opacity: ((t * 1.1 + i * 0.3) % 1) < 0.8 ? 1 : 0.3 }} />
          ))}
        </div>
        <Icon3D name="folder" x={1760} y={460} size={140} t={t} at={a0 + 2.4} />
        <Label x={1700} y={545} text="đĩa" size={28} o={vis(t, a0 + 2.6)} />
        <Packets t={t} from={{ x: 240, y: 460 }} to={{ x: NX - 30, y: 460 }} start={a1 + 0.6} every={0.45} len={0.6} size={18} />
        <Packets t={t} from={{ x: NX + 350, y: 460 }} to={{ x: 710, y: 470 }} start={a1 + 1.4} every={0.45} len={0.6} size={18} />
        <Packets t={t} from={{ x: 850, y: 470 }} to={{ x: IX - 50, y: 460 }} start={ioAt(0)} every={0.45} len={0.6} size={18} />
        <Packets t={t} from={{ x: IX + 560, y: 460 }} to={{ x: 1690, y: 460 }} start={ioAt(7)} every={0.45} len={0.6} size={18} />
      </Group>
      {/* idle gauges */}
      {[
        { x: 260, label: 'io idle', val: idleL, tone: INK.bad, verdict: 'thấp → tăng thêm', at: a2 + 0.6 },
        { x: 1000, label: 'io idle', val: idleR, tone: INK.good, verdict: 'cao → để yên', at: a2 + 1.3 },
      ].map((g) => (
        <div key={g.x} style={{ opacity: vis(t, g.at) * (1 - span(t, a3 - 0.2, a3 + 0.3)) }}>
          <div style={{ ...INK.card, position: 'absolute', left: g.x, top: 700, width: 640, height: 220, boxSizing: 'border-box' }} />
          <Label x={g.x + 28} y={720} text={`${g.label}: ${Math.round(g.val)}%`} color={g.tone} size={44} weight={800} />
          <Bar x={g.x + 28} y={800} w={584} h={44} p={g.val / 100} color={g.tone} />
          <Label x={g.x + 28} y={860} text={g.verdict} color={g.tone} size={32} weight={800} />
        </div>
      ))}
      {/* cores vs threads */}
      {Array.from({ length: 8 }, (_, i) => (
        <Rise key={i} t={t} at={a3 + 0.3 + i * 0.12}>
          <div>
            <Thread x={xs(i)} y={640} size={88} busy={busy(i, 1)} label={`IO${i + 1}`} />
            <div style={{ position: 'absolute', left: xs(i) - 11, top: 745, width: 110, height: 110, borderRadius: 22, ...INK.card, display: 'grid', placeItems: 'center', fontSize: 32, fontWeight: 800, color: INK.faint }}>CPU</div>
          </div>
        </Rise>
      ))}
      {[8, 9, 10].map((i) => (
        <Thread key={i} x={xs(i)} y={640} size={88} dashed label="+" o={vis(t, a3 + 2.0 + (i - 8) * 0.4)} />
      ))}
      <Chip x={200} y={890} text="8 lõi = 8 io threads" size={36} o={vis(t, a3 + 1.5)} />
      <Chip x={1330} y={770} text="thừa: không nhanh hơn" size={36} color={INK.warn} border={INK.warn} o={vis(t, a3 + 2.8)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 7. summary */

function summary(t: number, c: Cue) {
  return (
    <SoftTheme>
      <SummaryList t={t} cue={c} items={['Đĩa = tốc độ ghi × thời gian giữ × RF + dự phòng', 'Mạng ra = vào × (group đọc + follower)', 'Partition = max(T ÷ p, T ÷ c), đừng chọn bừa', 'Tuning = gom lô: đổi độ trễ lấy thông lượng']} />
    </SoftTheme>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { hook, disk, network, partitions, producer, consumer, broker, summary }

/** Key-moment sounds, timed to the same cue offsets the scenes animate on. */
const SFX: Record<string, SceneSfx[]> = {
  hook: [
    { kind: 'error', at: (c) => c.at(2) + 0.3 },
    { kind: 'ding', at: (c) => c.at(2) + 1.2 },
  ],
  disk: [
    { kind: 'tick', at: (c) => c.at(0) + 1.0 },
    { kind: 'tick', at: (c) => c.at(1) + 1.0 },
    { kind: 'tick', at: (c) => c.at(2) + 1.0 },
    { kind: 'tick', at: (c) => c.at(3) + 1.0 },
    { kind: 'ding', at: (c) => c.at(3) + 2.2 },
  ],
  network: [{ kind: 'error', at: (c) => c.at(3) + 1.0 }],
  partitions: [
    { kind: 'ding', at: (c) => c.end(1) - 1.7 },
    { kind: 'error', at: (c) => c.at(2) + 0.5 },
  ],
  producer: [
    { kind: 'ding', at: (c) => c.at(2) - 0.3 + 1.0 },
    { kind: 'ding', at: (c) => c.at(2) + (c.end(2) - c.at(2)) * 0.78 + 1.0 },
    { kind: 'ding', at: (c) => c.at(4) + (c.end(4) - c.at(4)) * 0.35 + 1.2 },
  ],
  consumer: [
    { kind: 'error', at: (c) => c.at(2) + 2.0 + 6.7 * 0.6 },
    { kind: 'ding', at: (c) => c.at(3) + 2.4 },
  ],
  broker: [{ kind: 'error', at: (c) => c.at(2) + 1.0 }],
}

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const sizingTuningLesson: Lesson = {
  ...sizingTuningScript,
  scenes: sizingTuningScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id], sfx: SFX[s.id] })),
  intro: [
    { kind: 'video', scenes: ['hook'] },
    {
      kind: 'quiz',
      title: 'Quick Quiz',
      questions: [q('Đoán trước khi học: ghi 10 MB/giây, giữ 7 ngày, RF = 3, không nén, chỉ dùng tối đa 70% đĩa. Cả cluster cần khoảng bao nhiêu đĩa?', ['6 TB', '18 TB', '26 TB', '60 TB'], 2, '864 GB mỗi ngày × 7 ≈ 6 TB, × RF 3 ≈ 18 TB, ÷ 0,7 ≈ 26 TB. Phần 1 đi từng bước.')],
    },
  ],
  roadmap: [
    'Chặng 1: Tính đĩa, mạng và số partition bằng phép nhân trên giấy.',
    'Chặng 2: Tuning producer (batch, linger, nén, acks) và consumer (fetch, poll): gom lô đổi độ trễ lấy thông lượng.',
    'Chặng 3: Hai nhóm luồng của broker, và máy tính sizing để tự thử.',
  ],
  sections: [
    {
      id: 'dung-luong',
      title: 'Tính dung lượng bằng phép nhân trên giấy',
      blocks: [
        { kind: 'video', scenes: ['disk'] },
        {
          kind: 'code',
          code: 'đĩa cần = tốc độ ghi (byte/giây) × thời gian giữ (giây) × replication factor ÷ tỉ lệ nén   (+ khoảng trống dự phòng)',
        },
        {
          kind: 'table',
          head: ['Bước', 'Phép tính', 'Kết quả'],
          rows: [
            ['1 ngày', '10 MB × 86.400 giây', '864.000 MB ≈ 864 GB'],
            ['7 ngày', '864 GB × 7', '≈ 6.048 GB ≈ 6 TB'],
            ['× RF 3', '6 TB × 3', '≈ 18 TB'],
            ['Chỉ dùng tối đa khoảng 70% đĩa', '18 TB ÷ 0,7', '≈ **26 TB** cho cả cluster'],
          ],
        },
        { kind: 'p', text: 'Với 6 broker → khoảng 4,3 TB mỗi broker. Nén zstd được 4 lần (Module 1) → chỉ còn khoảng 6,5 TB.' },
        {
          kind: 'list',
          items: [
            { title: 'Ba thừa số hay bị quên', text: '**RF**, **khoảng trống dự phòng**, và **đỉnh tải** (thiết kế theo giờ cao điểm, không theo trung bình ngày).' },
            { title: 'Hình ảnh: thuê kho', text: 'Mỗi ngày nhập 10 tấn hàng, giữ 7 ngày, mỗi lô cất 3 bản ở 3 kho khác nhau → cần chứa 210 tấn. Không ai thuê kho vừa khít: phải chừa lối đi và chỗ cho hàng về đột xuất.' },
            { title: 'Đo kích thước thật', text: 'Mỗi tin trên đĩa có overhead của batch, key, header. Sách khuyên chừa thêm ít nhất **10%** đĩa cho các file khác (index, checkpoint…). (📘 sách, ch.2)' },
          ],
        },
        { kind: 'video', scenes: ['network'] },
        {
          kind: 'callout',
          tone: 'info',
          title: 'Mạng chiều ra',
          text: '**Mạng ra = byte vào × (số consumer group + số follower).** Producer ghi 1 MB/giây, 3 group đọc, RF = 3 (2 follower) → leader đẩy ra khoảng 3 + 2 = 5 MB/giây. Card mạng bão hoà thì sao chép giữa các broker tụt lại, cluster rơi vào thế thiếu dự phòng (URP). Sách khuyên card ít nhất 10 Gb. (📘 sách, ch.2, ch.13)',
        },
        { kind: 'video', scenes: ['partitions'] },
        {
          kind: 'code',
          code: 'số partition ≥ max( T ÷ p , T ÷ c )',
        },
        {
          kind: 'list',
          items: [
            { text: 'T = tốc độ mục tiêu; p = tốc độ một partition nhận ghi được; c = tốc độ **một consumer** xử lý được.' },
            { text: 'Ví dụ: T = 50 MB/giây, mỗi consumer 5 MB/giây → ít nhất **10 partition**.' },
            { text: 'Chưa đo được c? Mẹo trong sách: giữ mỗi partition dưới khoảng **6 GB dữ liệu cho mỗi ngày retention**. Bắt đầu nhỏ rồi tăng dần dễ hơn bắt đầu quá lớn. (📘 sách, ch.2)' },
            { text: 'Tính theo **lưu lượng tương lai**, vì tăng partition về sau phá thứ tự theo key (Module 2).' },
            { text: 'Mỗi partition-replica tốn file mở (segment, index), bộ nhớ, và việc bầu lại leader khi broker chết. Khuyến nghị cũ: 4.000 mỗi broker và 200.000 mỗi cluster; sách (2021): không quá khoảng **14.000 mỗi broker và 1 triệu mỗi cluster**. (📘 sách, ch.2)' },
          ],
        },
        { kind: 'callout', tone: 'tip', title: 'RAM cho page cache, không cho heap', text: 'Broker chỉ cần heap JVM nhỏ (sách ví dụ khoảng 5 GB cho 150.000 tin/giây). Phần RAM còn lại để hệ điều hành giữ các segment vừa ghi trong **page cache**, nhờ đó consumer đọc ở cuối log lấy thẳng từ RAM. Đừng chạy ứng dụng nặng khác chung máy broker. (📘 sách, ch.2)' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Ghi 2 MB/giây, retention 3 ngày, RF = 3, nén được 2 lần. Cần bao nhiêu đĩa (chưa tính dự phòng)?', ['khoảng 260 GB', 'khoảng 520 GB', 'khoảng 778 GB', 'khoảng 1.555 GB'], 2, '2 MB × 86.400 × 3 = 518 GB; × RF 3 = 1.555 GB; ÷ 2 nén ≈ 778 GB.'),
            q('Vì sao không chọn sẵn 500 partition cho mọi topic "cho chắc"?', ['Kafka không cho phép', 'Mỗi partition-replica tốn file mở, bộ nhớ, và làm bầu leader lâu hơn khi broker chết', 'Vì thứ tự message bị mất', 'Vì consumer chỉ đọc được 100 partition'], 1, 'Chi phí mỗi partition có thật, trong khi topic nhỏ chẳng cần độ song song đó.'),
          ],
        },
      ],
    },
    {
      id: 'tuning',
      title: 'Tuning cơ bản: producer, consumer, broker',
      blocks: [
        { kind: 'p', text: 'Nguyên tắc chung: hầu hết tuning là **đánh đổi độ trễ lấy thông lượng**, bằng cách gom nhiều tin hơn mỗi lần gửi hoặc đọc.' },
        { kind: 'video', scenes: ['producer'] },
        {
          kind: 'table',
          head: ['Cấu hình producer', 'Mặc định (3.9)', 'Tăng lên thì'],
          rows: [
            ['`batch.size`', '16.384 byte (16 KB)', 'Thùng to hơn, ít request hơn, nén tốt hơn'],
            ['`linger.ms`', '0 (Kafka 4.0 đổi thành 5)', 'Chờ thêm vài ms để thùng đầy hơn; tăng độ trễ'],
            ['`compression.type`', '`none`', '`lz4`/`zstd`: tốn CPU producer, tiết kiệm mạng + đĩa ở **mọi** broker và replica'],
          ],
        },
        { kind: 'p', text: 'Ví dụ số: 10.000 tin/giây, mỗi tin 100 byte. `linger.ms=0` → có thể hàng nghìn request nhỏ mỗi giây. `linger.ms=10`, `batch.size=64 KB` → khoảng 100 request/giây, mỗi request chở khoảng 100 tin: ít hơn 10 lần, đổi lại mỗi tin chờ thêm tối đa 10 ms. Hình ảnh: xe buýt chạy ngay khi có 1 khách thì đường đầy xe trống; chờ cho đầy thì ít chuyến, mỗi chuyến chở nhiều.' },
        { kind: 'callout', tone: 'tip', title: 'Nhìn metric nào?', text: 'Xem `record-queue-time-avg`: thời gian trung bình một tin chờ trong producer. Topic đông thì thùng đầy trước (`batch.size` quyết định); topic vắng thì hết giờ chờ trước (`linger.ms` quyết định). Đặt cảnh báo cho `record-error-rate` (phải luôn bằng 0) và `request-latency-avg`. (📘 sách, ch.13)' },
        { kind: 'video', scenes: ['consumer'] },
        {
          kind: 'table',
          head: ['Cấu hình consumer', 'Mặc định', 'Ý nghĩa'],
          rows: [
            ['`fetch.min.bytes`', '1', 'Broker chờ có đủ bấy nhiêu byte mới trả lời (tối đa `fetch.max.wait.ms` = 500 ms). Tăng → ít request, độ trễ cao hơn'],
            ['`max.poll.records`', '500', 'Số tin tối đa mỗi lần `poll()`. **Giảm** nếu xử lý mỗi tin chậm, để không vượt `max.poll.interval.ms` (5 phút) và bị đá khỏi group'],
          ],
        },
        { kind: 'video', scenes: ['broker'] },
        {
          kind: 'list',
          items: [
            { title: '`num.network.threads` (mặc định 3)', text: 'nhận/gửi dữ liệu mạng.' },
            { title: '`num.io.threads` (mặc định 8)', text: 'xử lý request và ghi đĩa. Sách khuyên khoảng bằng số lõi CPU (tính cả hyperthreading), vì request chờ lâu đã được gác sang purgatory (9.3). (📘 sách, ch.13)' },
            { title: 'Chỉ tăng khi idle percent thấp', text: 'đừng tăng "cho chắc" (xem bài giám sát).' },
          ],
        },
        {
          kind: 'list',
          items: [
            { title: 'Thông lượng thấp vì request quá nhỏ', text: 'tăng `batch.size`, `linger.ms`, bật nén.' },
            { title: 'Consumer bị đá khỏi group liên tục', text: 'giảm `max.poll.records` hoặc tăng `max.poll.interval.ms`, không phải thêm partition.' },
            { title: 'Quy trình', text: 'đo trước, đổi **một** tham số mỗi lần, đo lại (`kafka-producer-perf-test.sh`, `kafka-consumer-perf-test.sh`).' },
            { title: 'Hệ điều hành (broker Linux)', text: '`vm.swappiness=1`, filesystem XFS, mount `noatime`, JVM dùng G1GC. (📘 sách, ch.2)' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Vì sao bật nén ở producer lại giảm tải cho cả broker và follower?', ['Broker nén lại dữ liệu cho follower', 'Broker lưu nguyên thùng đã nén và follower sao chép nguyên thùng đó, nên byte qua mạng và trên đĩa của mọi replica đều giảm', 'Follower không cần dữ liệu', 'Nén làm giảm số partition'], 1, 'Broker không tốn công nén lại khi compression.type của topic để mặc định producer.'),
            q('Consumer mỗi tin xử lý 1 giây, max.poll.records = 500, max.poll.interval.ms = 5 phút. Chuyện gì xảy ra?', ['Bình thường', '500 giây > 300 giây: bị đá khỏi group, rebalance, xử lý lặp', 'Broker tăng timeout', 'Offset tự nhảy'], 1, 'Cách chữa: giảm max.poll.records (ví dụ 100), không phải thêm partition.'),
          ],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: máy tính sizing',
      blocks: [
        { kind: 'p', text: 'Kéo các thanh trượt để tính đĩa cả cluster, mạng ra mỗi broker và số partition cần ít nhất. Thử lại ví dụ 26 TB, rồi bật nén và xem đĩa giảm.' },
        { kind: 'widget', name: 'sizing-lab' },
      ],
    },
    {
      id: 'tom-tat-video',
      title: 'Nhìn lại cả bài',
      blocks: [{ kind: 'video', scenes: ['summary'] }],
    },
  ],
  finalQuiz: [
    q('Ghi 10 MB/giây, giữ 7 ngày. Mỗi ngày dữ liệu (chưa nhân RF) khoảng bao nhiêu?', ['86 GB', '864 GB', '8,6 TB', '864 MB'], 1, '10 MB × 86.400 giây = 864.000 MB ≈ 864 GB.'),
    q('Producer ghi 1 MB/giây, 3 group đọc, RF = 3. Leader đẩy ra khoảng bao nhiêu?', ['1 MB/giây', '3 MB/giây', '5 MB/giây', '9 MB/giây'], 2, '1 × (3 group + 2 follower) = 5 MB/giây.'),
    q('T = 50 MB/giây, mỗi consumer 5 MB/giây, mỗi partition nhận ghi 10 MB/giây. Cần ít nhất bao nhiêu partition?', ['5', '10', '15', '50'], 1, 'max(50÷10, 50÷5) = 10.'),
    q('Chỉ tăng num.io.threads khi nào?', ['Luôn tăng cho chắc', 'Khi idle percent thấp', 'Khi thêm partition', 'Khi tăng RF'], 1, 'Và không cần vượt số lõi CPU.'),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao đĩa cần mua lớn hơn nhiều so với "tốc độ ghi × thời gian giữ"?',
      keywords: ['RF', 'bản sao', 'dự phòng', 'đỉnh'],
      modelAnswer: 'Vì mỗi partition được lưu đủ RF bản trên các broker khác nhau và mỗi bản chiếm đĩa thật, nên phải nhân RF. Ngoài ra không ai dùng đầy đĩa: phải chừa khoảng 30% dự phòng cho đỉnh tải, tăng trưởng và các file khác như index. Ví dụ 6 TB thành 18 TB rồi khoảng 26 TB.',
    },
  ],
  recap: {
    journey:
      'Tính đĩa bằng chuỗi phép nhân: tốc độ ghi × thời gian × RF ÷ 0,7 → mạng ra lớn hơn mạng vào vì có group đọc và follower → số partition là lớn nhất của hai phép chia, có trần do chi phí → tuning producer, consumer, broker đều là gom lô đổi độ trễ lấy thông lượng.',
    points: [
      { title: 'Đĩa', text: '10 MB/giây × 86.400 × 7 ngày × RF 3 ÷ 0,7 ≈ 26 TB cho cả cluster.' },
      { title: 'Mạng', text: 'Ra = vào × (số group đọc + số follower); dùng card ít nhất 10 Gb.' },
      { title: 'Partition', text: 'max(T ÷ p, T ÷ c); tính theo tương lai; không chọn bừa.' },
      { title: 'Tuning', text: 'batch.size, linger.ms, nén, fetch.min.bytes, max.poll.records; đo, đổi một tham số, đo lại.' },
    ],
    next: 'Bài tiếp theo: Sự cố, bảo trì & bảo mật.',
  },
}
