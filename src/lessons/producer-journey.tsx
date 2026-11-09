import type { CSSProperties, ReactNode } from 'react'
import {
  At,
  Burst,
  CodeWindow,
  GearIcon,
  Kinetic,
  LetterIcon,
  MailBagIcon,
  MsgChip,
  NEON,
  NeonCard,
  Panel,
  Pill,
  Scene,
  Stamp,
  SummaryGrid,
  TitleCard,
  TruckIcon,
  cameraAt,
  clamp,
  glow,
  lerp,
  move,
  sp,
  span,
  vis,
} from '../player/motion-kit'
import type { Cue, Lesson, Scene as LessonScene } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { producerJourneyScript } from './producer-journey-script'

/* Palette for this lesson: slate for neutral, blue for Kafka, amber for the post-office analogy, red/green for outcomes. */
const SLATE = '#94a3b8'
const label: CSSProperties = { fontSize: 22, fontWeight: 800, letterSpacing: 3, color: SLATE }

/** Column x positions shared by the pipeline and the post-office scenes, so the analogy lines up with the diagram. */
const COL = { send: 230, ser: 450, part: 790, acc: 1160, sender: 1520, broker: 1800 }

/** Neon station card in the same language as the Segment lesson's file cards (content inside, never overlaid). */
function Station({ x, y, title, sub, active, w = 280, children }: { x: number; y: number; title: string; sub?: string; active?: boolean; w?: number; children?: ReactNode }) {
  const c = active ? NEON.cyan : NEON.blue
  return (
    <At x={x} y={y} style={{ transform: `translate(-50%, -50%) scale(${active ? 1.06 : 1})` }}>
      <div
        style={{
          width: w,
          padding: '22px 22px 24px',
          borderRadius: 24,
          background: 'linear-gradient(160deg, #2d313d 0%, #1b1e27 60%, #15171e 100%)',
          border: `4px solid ${c}`,
          boxShadow: `${glow(c, active ? 1 : 0.45)}, 0 30px 50px rgba(0,0,0,0.55)`,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 3, color: active ? '#a5f3fc' : '#93c5fd' }}>{sub}</div>
        <div style={{ fontSize: 44, fontWeight: 900, marginTop: 6, color: '#fff' }}>{title}</div>
        {children}
      </div>
    </At>
  )
}

/* ------------------------------------------------------------------ 0. cold open */

function hook(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const sent = Math.min(100, Math.floor(span(t, a0 + 0.6, a0 + 2.6) * 100))
  const exited = t >= a1 + 0.4
  const cam = cameraAt(t, [
    [0, { x: 640, y: 520, s: 1.25, rx: 10 }],
    [a0 + 0.4, { x: 640, y: 540, s: 1.15 }, 1.6],
    [a1 + 0.6, { x: 1380, y: 540, s: 1.15, ry: -5 }, 1.2],
    [a2 - 0.1, { x: 960, y: 560, s: 0.9 }, 1.3],
  ])
  return (
    <Scene
      t={t}
      camera={cam}
      backdrop="terminal"
      overlay={
        <At x={960} y={960} style={{ opacity: vis(t, a2 + 0.3), padding: '16px 44px', borderRadius: 26, background: 'rgba(5,7,15,0.9)' }}>
          <Kinetic t={t} at={a2 + 0.4} text="send() trả về ≠ tin đã tới broker" size={72} color="#e2e8f0" stagger={0.018} />
        </At>
      }
    >
      <At x={640} y={470} style={{ opacity: exited ? 0.35 : 1 }}>
        <CodeWindow
          t={t}
          at={0.1}
          w={880}
          size={30}
          cps={60}
          lines={[
            [['for', '#93c5fd'], [' (i in 1..100)', '#e2e8f0']],
            [['  producer', '#e2e8f0'], ['.', SLATE], ['send', '#60a5fa'], ['(record)', '#e2e8f0']],
            [['System', '#e2e8f0'], ['.', SLATE], ['exit', '#f87171'], ['(0)', '#e2e8f0']],
          ]}
        />
      </At>
      <At x={640} y={700} style={{ display: 'flex', gap: 20, opacity: vis(t, a0 + 0.6) }}>
        <Pill text={`đã gọi send(): ${sent}/100`} tone="sky" size={30} />
        <Pill text="mỗi lần ~0,1 ms" tone="sky" size={30} />
      </At>
      <At x={640} y={260}>
        <Pill text="ứng dụng đã tắt" tone="red" size={34} o={sp(t, a1 + 0.4)} />
      </At>
      <At x={1380} y={500}>
        <Panel t={t} at={a1 + 0.2} w={520} h={360} tone={exited ? 'red' : 'blue'} still>
          <div style={{ padding: '30px 36px' }}>
            <div style={label}>BROKER · payments-0</div>
            <div style={{ fontSize: 120, fontWeight: 900, fontFamily: MONO, marginTop: 20, color: '#f8fafc' }}>0</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: SLATE }}>tin nhận được</div>
          </div>
        </Panel>
      </At>
      <At x={1460} y={690}>
        <Stamp t={t} at={a1 + 1.8} text="MẤT 100 TIN" size={60} />
      </At>
    </Scene>
  )
}

/* ------------------------------------------------------------------ 1. the four stations */

/** Accumulator content: three partition rows with batches; `fill` per row in [0, 1]. */
function Accumulator({ fill, highlight }: { fill: number[]; highlight?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
      {fill.map((f, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 40, fontSize: 22, fontWeight: 900, color: SLATE }}>P{i}</span>
          <div style={{ flex: 1, height: 34, borderRadius: 8, border: `2px solid ${highlight === i ? NEON.blue : '#334155'}`, background: '#0f1525', overflow: 'hidden' }}>
            <div style={{ width: `${f * 100}%`, height: '100%', background: highlight === i ? NEON.blue : '#3b5b9a' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function pipeline(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const d1 = c.end(1) - a1
  // The message: object → (serializer) bytes → (partitioner) P1 → drops into the P1 batch.
  const atSer = a1 + 0.2
  const atPart = a1 + d1 * 0.55
  const atAcc = a2 + 0.3
  const mx = t < atSer ? lerp(COL.send, COL.ser, move(t, a0 + 1.6, 1.0)) : t < atPart ? COL.ser : t < atAcc ? lerp(COL.ser, COL.part, move(t, atPart - 0.6, 0.6)) : lerp(COL.part, COL.acc, move(t, atAcc, 0.7))
  const my = t < atAcc ? 330 : lerp(330, 560, move(t, atAcc, 0.7))
  const msgText = t < atSer + 0.4 ? '{ id: 42 }' : t < atPart + 0.4 ? '0101 1100…' : '0101… → P1'
  const dropped = t >= atAcc + 0.8
  const truck = move(t, a3 + 0.6, 1.4)
  const cam = cameraAt(t, [
    [0, { x: 960, y: 540, s: 0.86, rx: 12 }],
    [a0 + 1.2, { x: 420, y: 470, s: 1.2 }, 1.2],
    [a1 - 0.1, { x: 660, y: 470, s: 1.2, ry: 4 }, 1.1],
    [a2 - 0.1, { x: 1120, y: 560, s: 1.18 }, 1.1],
    [a3 + 0.3, { x: 1500, y: 560, s: 1.05, ry: -4 }, 1.3],
    [c.end(3) - 0.6, { x: 990, y: 560, s: 0.86 }, 1.2],
  ])
  return (
    <Scene t={t} camera={cam} overlay={<div style={{ opacity: vis(t, -1, a1 - 0.2) }}><TitleCard t={t} at={0.1} kicker="BỐN TRẠM" title="Bên trong send()" dock={1.2} /></div>}>
      {/* The app process: everything left of the broker runs inside the app's own RAM (dashed = volatile). */}
      <div style={{ position: 'absolute', left: 60, top: 180, width: 1630, height: 760, borderRadius: 30, border: '3px dashed #475569', opacity: vis(t, 0.2) }}>
        <div style={{ ...label, position: 'absolute', left: 30, bottom: 20 }}>ỨNG DỤNG CỦA BẠN · RAM (nét đứt = dễ mất)</div>
      </div>
      <Station x={COL.send} y={330} title="send()" sub="APP" active={t < atSer} />
      <Station x={COL.ser} y={560} w={300} title="Serializer" sub="① OBJECT → BYTE" active={t >= atSer && t < atPart} />
      <Station x={COL.part} y={560} w={300} title="Partitioner" sub="② CHỌN PARTITION" active={t >= atPart && t < atAcc} />
      <Station x={COL.acc} y={640} w={330} title="Bộ gom thùng" sub="③ RECORD ACCUMULATOR" active={t >= atAcc && t < a3}>
        <Accumulator fill={[0.55, dropped ? 0.78 : 0.62, 0.3].map((f) => f * (1 - move(t, a3 + 0.6, 0.6)))} highlight={t >= atAcc ? 1 : undefined} />
      </Station>
      <Station x={COL.sender} y={560} w={250} title="Sender" sub="④ LUỒNG NỀN" active={t >= a3 && t < c.end(3)}>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <GearIcon size={46} t={t >= a3 ? t * 2 : 0} color={t >= a3 ? NEON.blue : '#475569'} />
        </div>
      </Station>
      <At x={COL.broker} y={560}>
        <div style={{ width: 170, height: 300, borderRadius: 22, background: 'linear-gradient(160deg,#1e293b,#0f172a)', border: '3px solid #475569', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ ...label }}>BROKER</div>
          {[0, 1, 2].map((k) => (
            <div key={k} style={{ width: 120, height: 22, borderRadius: 5, background: t >= a3 + 2.0 ? NEON.blue : '#334155', opacity: t >= a3 + 2.0 ? 1 : 0.6 }} />
          ))}
        </div>
      </At>
      {/* The travelling message. */}
      {t >= a0 + 1.4 && !dropped && (
        <At x={mx} y={my - 120}>
          <div style={{ padding: '10px 18px', borderRadius: 12, background: '#0b1630', border: `2px solid ${NEON.blue}`, fontFamily: MONO, fontSize: 24, fontWeight: 700, whiteSpace: 'nowrap', boxShadow: glow(NEON.blue, 0.5) }}>{msgText}</div>
        </At>
      )}
      <At x={COL.acc} y={360}>
        <Pill text="send() trả về ở đây ✓" tone="green" size={30} o={Math.min(sp(t, atAcc + 0.9), vis(t, 0, a3 + 0.2))} />
      </At>
      {/* Sender carries the batches to the broker; the callback comes back. */}
      {t >= a3 + 0.4 && truck < 1 && (
        <At x={lerp(COL.sender, COL.broker - 60, truck)} y={400 - Math.sin(Math.PI * truck) * 60}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[0, 1, 2].map((k) => (
              <div key={k} style={{ width: 36, height: 26, borderRadius: 5, background: NEON.blue }} />
            ))}
          </div>
        </At>
      )}
      <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <path d={`M${COL.broker} 400 C ${COL.broker} 200, ${COL.send} 120, ${COL.send} 250`} fill="none" stroke={NEON.green} strokeWidth={4} strokeDasharray="12 10" pathLength={1} strokeDashoffset={0} opacity={vis(t, a3 + 2.2)} />
      </svg>
      <At x={980} y={140}>
        <Pill text="callback: thành công ✓" tone="green" size={30} o={sp(t, a3 + 2.6)} />
      </At>
    </Scene>
  )
}

/* ------------------------------------------------------------------ 2. post-office analogy */

/** Analogy card: amber neon (everyday side), an icon prop, a title and one line. */
function AnalogyCard({ x, t, at, title, line, active, children }: { x: number; t: number; at: number; title: string; line: string; active: boolean; children: ReactNode }) {
  const p = clamp(sp(t, at, 13, 110), 0, 1.1)
  return (
    <At x={x} y={540} style={{ opacity: clamp(p * 1.4), transform: `translate(-50%, -50%) translateY(${(1 - clamp(p)) * 80}px) scale(${active ? 1.05 : 1})` }}>
      <div
        style={{
          width: 470,
          height: 460,
          borderRadius: 28,
          background: 'linear-gradient(160deg, #2d313d 0%, #1b1e27 60%, #15171e 100%)',
          border: `4px solid ${NEON.amber}`,
          boxShadow: `${glow(NEON.amber, active ? 0.9 : 0.35)}, 0 30px 50px rgba(0,0,0,0.55)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '36px 30px',
        }}
      >
        <div style={{ height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>{children}</div>
        <div style={{ fontSize: 48, fontWeight: 900, marginTop: 18, color: '#fff' }}>{title}</div>
        <div style={{ fontSize: 28, fontWeight: 600, color: '#cbd5e1', marginTop: 10, textAlign: 'center' }}>{line}</div>
      </div>
    </At>
  )
}

function post(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const X = [330, 960, 1590]
  const fillAt = span(t, a1 + 0.3, c.end(1))
  const drive = move(t, a2 + 0.8, 1.6)
  const cam = cameraAt(t, [
    [0, { x: X[0], y: 560, s: 1.15, ry: 6 }],
    [a1 - 0.2, { x: X[1], y: 560, s: 1.12 }, 1.2],
    [a2 - 0.1, { x: X[2], y: 560, s: 1.12, ry: -5 }, 1.2],
    [a2 + 2.8, { x: 960, y: 560, s: 0.86 }, 1.3],
  ])
  const arrow = (x1: number, x2: number, at: number) => (
    <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
      <path d={`M${x1} 540 H${x2}`} stroke={NEON.amber} strokeWidth={6} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - move(t, at, 0.5)} style={{ filter: `drop-shadow(0 0 8px ${NEON.amber})` }} />
      <path d={`M${x2 - 18} 524 L${x2} 540 L${x2 - 18} 556`} fill="none" stroke={NEON.amber} strokeWidth={6} strokeLinecap="round" opacity={vis(t, at + 0.4)} />
    </svg>
  )
  const mapTo = (x: number, text: string, at: number) => (
    <At x={x} y={860}>
      <Pill text={`= ${text}`} tone="sky" size={34} o={sp(t, at)} style={{ fontFamily: MONO }} />
    </At>
  )
  return (
    <Scene t={t} camera={cam} overlay={<TitleCard t={t} at={0.1} kicker="VÍ DỤ ĐỜI THƯỜNG" title="Giống bưu cục" tone="amber" dock={1.2} />}>
      <AnalogyCard x={X[0]} t={t} at={a0 + 0.3} title="Quầy gửi" line="đưa thư, nhận biên nhận, về ngay" active={t < a1}>
        <div style={{ transform: `translateX(${lerp(-40, 40, move(t, a0 + 1.0, 0.8))}px) rotate(${lerp(-8, 4, move(t, a0 + 1.0, 0.8))}deg)` }}>
          <LetterIcon size={190} />
        </div>
      </AnalogyCard>
      {arrow(X[0] + 250, X[1] - 250, a1 - 0.2)}
      <AnalogyCard x={X[1]} t={t} at={a1 - 0.2} title="Ngăn theo tỉnh" line="mỗi tỉnh một bao tải" active={t >= a1 && t < a2}>
        {['HN', 'ĐN', 'HCM'].map((p, i) => (
          <MailBagIcon key={p} size={130} fill={lerp(0.2, [0.9, 0.7, 0.5][i], fillAt) * (1 - drive)} label={p} />
        ))}
      </AnalogyCard>
      {arrow(X[1] + 250, X[2] - 250, a2 - 0.2)}
      <AnalogyCard x={X[2]} t={t} at={a2 - 0.2} title="Xe tải theo tuyến" line="một chuyến chở mọi bao cùng tuyến" active={t >= a2}>
        <div style={{ transform: `translateX(${lerp(-40, 60, drive)}px)` }}>
          <TruckIcon size={320} t={t} moving={drive > 0 && drive < 1} />
        </div>
      </AnalogyCard>
      {mapTo(X[0], 'send()', a0 + 2.0)}
      {mapTo(X[1], 'partition → thùng', a1 + 1.0)}
      {mapTo(X[2], 'sender thread', a2 + 1.0)}
      <At x={X[0]} y={220}>
        <Pill text="☎ thư tới nơi = callback" tone="green" size={34} o={sp(t, a2 + 3.0)} />
      </At>
      <At x={X[0]} y={220}>
        <Burst t={t} at={a2 + 3.0} tone="green" r={150} />
      </At>
    </Scene>
  )
}

/* ------------------------------------------------------------------ 3. batches per partition, requests per broker */

function batching(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const SRC = { x: 330, y: 540 }
  const PART = [300, 540, 780].map((y) => ({ x: 900, y }))
  const BRK = [
    { x: 1580, y: 400, name: 'Broker 1', lead: 'leader P0, P1' },
    { x: 1580, y: 780, name: 'Broker 2', lead: 'leader P2' },
  ]
  const brokerOf = (p: number) => (p === 2 ? 1 : 0)
  // Naive phase: one request per message, straight to the broker.
  const naiveEnd = a2 - 0.2
  const naiveCount = Math.round(lerp(0, 1000, span(t, a1 + 0.2, naiveEnd)))
  // Batching phase: messages drop into their partition's batch, then one request per broker.
  const fillStart = a2 + 0.2
  const fillEnd = a2 + 2.0
  const ship = move(t, fillEnd + 0.3, 1.1)
  const shipped = t >= fillEnd + 1.4
  const fly = (k: number, start: number, step: number, to: (k: number) => { x: number; y: number }, len = 0.55) => {
    const at = start + k * step
    const p = move(t, at, len)
    if (t < at || p >= 1) return null
    const d = to(k)
    return <MsgChip key={`${start}-${k}`} x={lerp(SRC.x + 150, d.x, p)} y={lerp(SRC.y, d.y, p) - Math.sin(Math.PI * p) * 70} />
  }
  const cam = cameraAt(t, [
    [0, { x: 960, y: 560, s: 1.05, rx: 12 }],
    [a0 + 0.6, { x: 960, y: 560, s: 0.92 }, 1.4],
    [a1 + 0.2, { x: 1000, y: 580, s: 0.9, ry: -3 }, 1.1],
    [a2 + 0.2, { x: 820, y: 560, s: 1.0, ry: 4 }, 1.1],
    [fillEnd + 0.3, { x: 1020, y: 580, s: 0.9, ry: -3 }, 1.2],
  ])
  return (
    <Scene
      t={t}
      camera={cam}
      overlay={
        <>
          <TitleCard t={t} at={0.1} kicker="GOM CHUYẾN" title="Thùng theo partition" dock={1.2} />
          <At x={960} y={985} style={{ opacity: vis(t, a1 + 0.2, a2 - 0.2), padding: '10px 40px', borderRadius: 24, background: 'rgba(5,7,15,0.88)' }}>
            <div style={{ fontSize: 96, fontWeight: 900, color: '#fecaca', textShadow: glow(NEON.red, 0.8), fontFamily: MONO, whiteSpace: 'nowrap' }}>{naiveCount.toLocaleString('vi-VN')} request</div>
          </At>
          <At x={960} y={985} style={{ opacity: vis(t, fillEnd + 1.3), padding: '10px 40px', borderRadius: 24, background: 'rgba(5,7,15,0.88)' }}>
            <Kinetic t={t} at={fillEnd + 1.4} text="chỉ còn 2 request" size={96} color="#bbf7d0" glowColor={NEON.green} />
          </At>
        </>
      }
    >
      <NeonCard x={SRC.x} y={SRC.y} w={380} h={220} kicker="PRODUCER" title="1.000 tin" sub="gửi vào 3 partition" o={sp(t, a0 + 0.2)} />
      {PART.map((pt, i) => (
        <NeonCard
          key={i}
          x={pt.x}
          y={pt.y}
          w={330}
          h={200}
          kicker={`THÙNG · P${i}`}
          title={`P${i}`}
          tone={t >= fillStart ? 'cyan' : 'blue'}
          strong={t >= fillStart && !shipped}
          fill={span(t, fillStart, fillEnd) * (1 - ship)}
          o={sp(t, a0 + 0.5 + i * 0.15)}
        />
      ))}
      {BRK.map((b, k) => (
        <div key={b.name}>
          <NeonCard x={b.x} y={b.y} w={400} h={230} kicker="BROKER" title={b.name} sub={b.lead} tone={shipped ? 'green' : 'blue'} strong={shipped} o={sp(t, a0 + 0.9 + k * 0.2)} />
          <At x={b.x} y={b.y}>
            <Burst t={t} at={fillEnd + 1.4 + k * 0.1} tone="green" r={220} />
          </At>
        </div>
      ))}
      {/* Naive: every message is its own trip, the counter climbs to 1.000. */}
      {t >= a1 && t < naiveEnd + 0.6 && Array.from({ length: Math.ceil((naiveEnd - a1) / 0.07) }, (_, k) => fly(k, a1 + 0.2, 0.07, (j) => BRK[brokerOf(j % 3)], 0.6))}
      {/* Batching: messages fall into their partition's batch. */}
      {t >= fillStart && t < fillEnd + 0.6 && Array.from({ length: 24 }, (_, k) => fly(k, fillStart, 0.075, (j) => PART[j % 3], 0.5))}
      {/* One request per broker carries all of that broker's batches. */}
      {t >= fillEnd + 0.3 && !shipped &&
        BRK.map((b, k) => {
          const parts = k === 0 ? [0, 1] : [2]
          const from = k === 0 ? { x: 900, y: 420 } : PART[2]
          return (
            <At key={b.name} x={lerp(from.x + 170, b.x - 200, ship)} y={lerp(from.y, b.y, ship) - Math.sin(Math.PI * ship) * 60}>
              <div style={{ display: 'flex', gap: 8, padding: 10, borderRadius: 14, border: `3px solid ${NEON.cyan}`, background: '#0b1630', boxShadow: glow(NEON.cyan, 0.7) }}>
                {parts.map((p) => (
                  <div key={p} style={{ width: 70, height: 46, borderRadius: 8, background: 'linear-gradient(180deg,#3b82f6,#1e40af)', fontSize: 24, fontWeight: 900, display: 'grid', placeItems: 'center' }}>P{p}</div>
                ))}
              </div>
            </At>
          )
        })}
    </Scene>
  )
}

/* ------------------------------------------------------------------ 4. linger.ms vs batch.size */

/** A conveyor of batches leaving every `interval` seconds; batch width ∝ messages per request. */
function Conveyor({ t, y, start, interval, size, labelText }: { t: number; y: number; start: number; interval: number; size: number; labelText: string }) {
  const n = Math.max(0, Math.floor((t - start) / interval) + 1)
  return (
    <>
      <div style={{ position: 'absolute', left: 360, top: y - 50, width: 1300, height: 100, borderRadius: 18, border: '2px solid #334155', background: 'repeating-linear-gradient(90deg, rgba(148,163,184,0.06) 0 40px, transparent 40px 80px)', backgroundPosition: `${t * 120}px 0` }} />
      <div style={{ position: 'absolute', left: 120, top: y - 22, width: 220, fontFamily: MONO, fontSize: 30, fontWeight: 800, color: '#e2e8f0' }}>{labelText}</div>
      {Array.from({ length: Math.min(n, 40) }, (_, k) => {
        const idx = n - 1 - k
        const born = start + idx * interval
        const x = 380 + (t - born) * 420
        if (x > 1660) return null
        return <div key={idx} style={{ position: 'absolute', left: x, top: y - 18 - size / 2, width: size, height: 36 + size, borderRadius: 8, background: NEON.blue, opacity: 0.9, boxShadow: glow(NEON.blue, 0.3) }} />
      })}
    </>
  )
}

function linger(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  // Beat 0: one batch, two ways to leave: fill bar or timer, whichever first.
  const fill = span(t, a0 + 0.8, a0 + 4.2)
  const timer = span(t, a0 + 0.8, a0 + 3.2)
  const gone = t >= a0 + 3.2
  const cam = cameraAt(t, [
    [0, { x: 960, y: 520, s: 1.15, rx: 10 }],
    [a1 - 0.2, { x: 1000, y: 560, s: 0.96 }, 1.2],
    [a3 - 0.1, { x: 1000, y: 640, s: 1.02 }, 1.1],
  ])
  return (
    <Scene t={t} camera={cam} overlay={<TitleCard t={t} at={0.1} kicker="LINGER.MS" title="Khi nào thùng được gửi?" dock={1.2} />}>
      <At x={960} y={420} style={{ opacity: vis(t, -1, a1 - 0.2) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 70 }}>
          <div style={{ width: 420, transform: `translate(${gone ? move(t, a0 + 3.2, 0.7) * 260 : 0}px, ${gone ? move(t, a0 + 3.2, 0.7) * -260 : 0}px)`, opacity: gone ? 1 - span(t, a0 + 3.4, a0 + 3.9) : 1 }}>
            <div style={{ ...label }}>THÙNG P1 · batch.size 16 KB</div>
            <div style={{ height: 80, borderRadius: 14, border: `3px solid ${NEON.blue}`, marginTop: 10, overflow: 'hidden', background: '#0f1525' }}>
              <div style={{ width: `${fill * 100}%`, height: '100%', background: '#3b5b9a' }} />
            </div>
            <div style={{ fontFamily: MONO, fontSize: 28, marginTop: 8, color: SLATE }}>{Math.round(fill * 16)} / 16 KB</div>
          </div>
          <svg width={180} height={180} viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#334155" strokeWidth="8" />
            <circle cx="50" cy="50" r="42" fill="none" stroke={gone ? NEON.green : NEON.blue} strokeWidth="8" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - timer} transform="rotate(-90 50 50)" />
            <text x="50" y="47" textAnchor="middle" fontSize="13" fontWeight="800" fill={SLATE}>linger</text>
            <text x="50" y="65" textAnchor="middle" fontSize="16" fontWeight="900" fill="#e2e8f0" fontFamily="monospace">{Math.round(timer * 10)} ms</text>
          </svg>
        </div>
      </At>
      <At x={960} y={640}>
        <Pill text="hết linger trước → gửi, dù chưa đầy" tone="green" size={32} o={Math.min(sp(t, a0 + 3.3), vis(t, 0, a1 - 0.2))} />
      </At>
      <div style={{ opacity: vis(t, a1 - 0.3) }}>
        <Conveyor t={t} y={380} start={a1} interval={0.12} size={6} labelText="linger 0" />
        <Conveyor t={t} y={700} start={a2} interval={1.0} size={60} labelText="linger 50" />
      </div>
      <At x={1010} y={490}>
        <Pill text="~20 tin / request · ~25 request/giây" tone="sky" size={30} o={sp(t, a1 + 0.8)} />
      </At>
      <At x={1010} y={810}>
        <Pill text="~220 tin / request · ~3 request/giây" tone="sky" size={30} o={sp(t, a2 + 0.8)} />
      </At>
      <At x={960} y={960} style={{ display: 'flex', gap: 30, opacity: vis(t, a3 + 0.2) }}>
        <Pill text="ít request hơn ~10 lần" tone="green" size={34} />
        <Pill text="mỗi tin chờ thêm vài chục ms" tone="amber" size={34} />
      </At>
    </Scene>
  )
}

/* ------------------------------------------------------------------ 5. buffer.memory full */

function buffer(t: number, c: Cue) {
  const [a1, a2] = [c.at(1), c.at(2)]
  const level = clamp(lerp(0.15, 1, span(t, a1 - 0.3, a2 + 0.3)))
  const full = level >= 1
  const countdown = Math.max(0, 60 - Math.round(span(t, a2 + 0.8, a2 + 3.0) * 60))
  const cam = cameraAt(t, [
    [0, { x: 960, y: 560, s: 1.1, rx: 10 }],
    [a1 - 0.2, { x: 960, y: 560, s: 1.0 }, 1.2],
    [a2 + 0.2, { x: 860, y: 520, s: 1.12, ry: 4 }, 1.0],
  ])
  return (
    <Scene t={t} camera={cam} overlay={<TitleCard t={t} at={0.1} kicker="BUFFER.MEMORY" title="Khi kho đầy" tone="red" dock={1.2} />}>
      <At x={300} y={560}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...label }}>APP GỬI VÀO</div>
          <div style={{ fontSize: 64, fontWeight: 900, fontFamily: MONO, color: full ? NEON.red : '#e2e8f0' }}>50 MB/s</div>
          <div style={{ fontSize: 40, color: full ? NEON.red : SLATE }}>→</div>
        </div>
      </At>
      <At x={960} y={560}>
        <div style={{ position: 'relative', width: 560, height: 560, borderRadius: 30, border: `4px dashed ${full ? NEON.red : '#64748b'}`, background: 'rgba(15,21,37,0.85)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${level * 100}%`, background: full ? 'linear-gradient(180deg,#b91c1c,#7f1d1d)' : 'linear-gradient(180deg,#3b5b9a,#1e3a8a)' }} />
          <div style={{ position: 'absolute', left: 30, top: 24, ...label, color: '#cbd5e1' }}>buffer.memory · RAM</div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 230, textAlign: 'center', fontSize: 80, fontWeight: 900, fontFamily: MONO, whiteSpace: 'nowrap' }}>{Math.round(level * 32)} / 32 MB</div>
        </div>
      </At>
      <At x={1600} y={560}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...label }}>MẠNG CHỞ ĐI</div>
          <div style={{ fontSize: 64, fontWeight: 900, fontFamily: MONO }}>20 MB/s</div>
          <div style={{ fontSize: 40, color: SLATE }}>→</div>
        </div>
      </At>
      <At x={960} y={230}>
        <Pill text="send() bị chặn…" tone="red" size={40} o={sp(t, a2 + 0.3)} />
      </At>
      <At x={960} y={940}>
        <Pill text={`chờ tối đa max.block.ms: còn ${countdown} s`} tone="amber" size={34} o={Math.min(sp(t, a2 + 0.8), vis(t, 0, a2 + 3.2))} style={{ fontFamily: MONO }} />
      </At>
      <At x={960} y={560}>
        <Stamp t={t} at={a2 + 3.2} text="TimeoutException" size={64} />
      </At>
    </Scene>
  )
}

/* ------------------------------------------------------------------ 6. summary */

function summary(t: number, c: Cue) {
  return (
    <SummaryGrid
      t={t}
      cue={c}
      cards={[
        { title: 'send() ≠ đã tới broker', body: 'trả về khi tin vào thùng trong RAM', tone: 'blue' },
        { title: 'Thùng · chuyến', body: 'thùng theo partition, chuyến theo broker', tone: 'blue' },
        { title: 'Đầy hoặc hết linger', body: 'batch.size hay linger.ms, cái nào tới trước', tone: 'amber' },
        { title: 'flush() / close()', body: 'trước khi tắt app, kẻo mất tin', tone: 'red' },
      ]}
    />
  )
}

const RENDERS: Record<string, LessonScene['render']> = { hook, pipeline, post, batching, linger, buffer, summary }

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const producerJourneyLesson: Lesson = {
  ...producerJourneyScript,
  scenes: producerJourneyScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id] })),
  intro: [
    { kind: 'video', scenes: ['hook'] },
    {
      kind: 'quiz',
      title: 'Quick Quiz',
      questions: [
        q(
          'Đoán trước khi học: send() trả về sau 0,1 ms nghĩa là gì?',
          ['Tin đã được broker ghi xuống đĩa', 'Tin mới được đặt vào bộ đệm trong RAM của app', 'Tin đã được consumer đọc', 'Tin đã được nén xong'],
          1,
          'Đúng hướng. Phần 1 theo chân một tin qua bốn trạm để thấy vì sao.',
        ),
      ],
    },
  ],
  roadmap: [
    'Chặng 1: Bốn trạm của một tin trong producer, và chỗ send() thật sự trả về.',
    'Chặng 2: Gom tin thành thùng theo partition, chở theo chuyến theo broker.',
    'Chặng 3: Khi nào thùng được gửi (batch.size, linger.ms), chuyện gì xảy ra khi kho đầy — và tự tay thử.',
  ],
  sections: [
    {
      id: 'bon-tram',
      title: 'Bốn trạm của một tin',
      blocks: [
        { kind: 'video', scenes: ['pipeline'] },
        {
          kind: 'code',
          code: 'send(tin)\n  ① Serializer        object → byte (key và value)\n  ② Partitioner       hash(key) % N, hoặc sticky khi không có key\n  ③ RecordAccumulator thùng theo partition, trong RAM   ← send() trả về ở đây\n  ④ Sender thread     luồng nền chở thùng tới broker → callback',
        },
        {
          kind: 'list',
          items: [
            { title: 'Bất đồng bộ', text: '`send()` trả về khi tin **vào thùng trong RAM**, chưa phải khi broker đã nhận. Muốn biết kết quả: dùng **callback** hoặc `Future`.' },
            { title: 'Chưa an toàn', text: 'Tin còn trong thùng mà app tắt đột ngột (không gọi `flush()`/`close()`) thì **mất**.' },
            { title: 'Chỉ định partition', text: 'Đặt partition thẳng trong `ProducerRecord` thì bước ② bị bỏ qua.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('App gọi send() 100 tin rồi System.exit() ngay. Cách sửa đúng?', ['Tăng linger.ms', 'Gọi producer.flush() hoặc producer.close() trước khi thoát', 'Dùng nhiều partition hơn', 'Tắt nén'], 1, 'flush() và close() đều chờ sender chở hết các thùng còn trong RAM.'),
          ],
        },
      ],
    },
    {
      id: 'buu-cuc',
      title: 'Giống bưu cục — và ba cách gửi',
      blocks: [
        { kind: 'video', scenes: ['post'] },
        {
          kind: 'table',
          head: ['Cách gửi', 'Code', 'Khi nào dùng'],
          rows: [
            ['Bắn rồi quên', '`send(r)`', 'Hiếm: lỗi mất tăm, chỉ hợp dữ liệu có thể mất'],
            ['Đồng bộ', '`send(r).get()`', 'Chậm: mỗi tin chờ một vòng trả lời mới gửi tin sau'],
            ['Bất đồng bộ + callback', '`send(r, callback)`', '**Nên dùng** trong sản phẩm'],
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Callback phải nhanh',
          text: 'Callback chạy trên **luồng nội bộ của producer**. Gọi DB hay HTTP trong callback sẽ làm cả producer bị kẹt; việc nặng hãy đẩy sang luồng khác. Callback của các tin cùng partition được gọi đúng thứ tự gửi.',
        },
        {
          kind: 'callout',
          tone: 'tip',
          text: '**Một producer, dùng chung, sống lâu.** `KafkaProducer` an toàn khi nhiều luồng dùng chung. Đừng tạo producer mới cho mỗi request: mỗi producer xin một `producerId` mới và broker phải giữ trạng thái cho nó.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Trong ví dụ bưu cục, "xe tải chạy theo tuyến" tương ứng với gì?', ['Partitioner', 'Sender thread gom các thùng cùng broker vào một request', 'Serializer', 'Consumer'], 1, 'Một chuyến (request) chở mọi bao (thùng) cùng tuyến (broker).'),
          ],
        },
      ],
    },
    {
      id: 'gom-chuyen',
      title: 'Thùng theo partition, chuyến theo broker',
      blocks: [
        { kind: 'video', scenes: ['batching'] },
        {
          kind: 'p',
          text: 'Mỗi partition có **một thùng đang mở**. Sender không gửi từng thùng riêng: nó gom **mọi thùng có cùng broker leader** vào **một request**, vì mỗi chuyến mạng là tới một broker. 1.000 tin, 3 partition, 2 broker → chỉ **2 request**.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Vì sao sender gom thùng theo broker chứ không theo partition?', ['Vì broker nén tốt hơn', 'Vì mỗi request mạng đi tới một broker, và một broker làm leader cho nhiều partition', 'Vì partition không có địa chỉ', 'Vì consumer đọc theo broker'], 1, 'Partition không phải điểm đến mạng; broker mới là điểm đến.'),
          ],
        },
      ],
    },
    {
      id: 'linger',
      title: 'Khi nào thùng được gửi: batch.size và linger.ms',
      blocks: [
        {
          kind: 'quiz',
          title: 'Dự đoán trước khi xem',
          questions: [
            q('batch.size = 16 KB, linger.ms = 10. App gửi 1 tin 100 byte rồi im lặng. Bao lâu sau tin được gửi?', ['Ngay lập tức', 'Khoảng 10 ms', 'Khi thùng đầy 16 KB', 'Không bao giờ'], 1, 'Thùng chưa đầy, nên điều kiện "hết giờ chờ" tới trước.'),
          ],
        },
        { kind: 'video', scenes: ['linger'] },
        {
          kind: 'table',
          head: ['Cấu hình', 'Ý nghĩa', 'Mặc định'],
          rows: [
            ['`batch.size`', 'thùng đầy tới từng này byte thì gửi (mỗi partition một thùng)', '16 KB'],
            ['`linger.ms`', 'chờ tối đa từng này ms rồi gửi, dù chưa đầy', '0 ms (≤ 3.9) · 5 ms (từ 4.0)'],
            ['`buffer.memory`', 'tổng RAM cho mọi thùng chờ gửi', '32 MB'],
          ],
        },
        {
          kind: 'table',
          head: ['Lab (5.000 tin/s, ~80 byte)', '`linger.ms=0`', '`linger.ms=50`'],
          rows: [
            ['Tin mỗi request', '~20–27', '~210–230'],
            ['Request mỗi giây', '~22–30', '~3'],
            ['Độ trễ trung vị', '~3–18 ms', '~25 ms'],
          ],
        },
        {
          kind: 'callout',
          tone: 'info',
          text: '`linger.ms=0` mà vẫn có ~20 tin/request? Đúng: trong lúc sender đang bận chở chuyến trước, tin mới vẫn dồn vào thùng — **batching tự nhiên** khi tải cao. Đặt `batch.size` to cũng **không** làm tin chờ lâu hơn, vì producer không đợi thùng đầy; nó chỉ tốn thêm RAM.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Hệ thống đặt hàng chỉ 10 tin/giây, cần độ trễ thấp. Có nên tăng linger.ms lên 100?', ['Có, thùng sẽ to hơn nhiều', 'Không: 100 ms chỉ gom được ~1 tin mà mỗi tin chờ thêm 100 ms', 'Có, để giảm CPU', 'Không quan trọng'], 1, 'linger.ms chỉ đáng tăng khi tải đủ cao để thùng thực sự được lấp đầy.'),
          ],
        },
      ],
    },
    {
      id: 'kho-day',
      title: 'Khi kho buffer.memory đầy',
      blocks: [
        { kind: 'video', scenes: ['buffer'] },
        {
          kind: 'p',
          text: 'Khi app gửi nhanh hơn mạng chở đi, thùng chất đống tới hết `buffer.memory`. Lúc đó `send()` **bị chặn**, chờ tối đa `max.block.ms` (mặc định 60 giây) rồi ném `TimeoutException`. Độ trễ tăng vọt (lab: ~1 giây) vì tin phải **xếp hàng trong kho**, không phải vì mạng chậm.',
        },
        {
          kind: 'callout',
          tone: 'info',
          text: '**Quota cũng làm đầy kho:** broker có thể giới hạn tốc độ ghi của từng client. Vượt quota thì broker cố ý trả lời chậm, thùng dồn trong kho, triệu chứng giống hệt "mạng không chở kịp".',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('App ghi 50 MB/s, mạng chỉ chở 20 MB/s. Sau vài giây điều gì xảy ra?', ['Tin bị nén mạnh hơn', 'Kho 32 MB đầy, send() bị chặn, quá 60 s thì TimeoutException', 'Producer tự tăng partition', 'Broker tăng tốc'], 1, 'Kho đầy sau khoảng 1 giây (32 MB ÷ 30 MB/s chênh lệch).'),
          ],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: chỉnh linger.ms',
      blocks: [
        { kind: 'p', text: 'Kéo tốc độ gửi và `linger.ms`. **Đoán trước**: với 10 tin/giây, tăng linger từ 0 lên 100 ms thì số tin mỗi request tăng bao nhiêu?' },
        { kind: 'widget', name: 'linger-lab' },
      ],
    },
    {
      id: 'tom-tat-video',
      title: 'Nhìn lại cả bài',
      blocks: [{ kind: 'video', scenes: ['summary'] }],
    },
  ],
  finalQuiz: [
    q('send() trả về sau 0,1 ms. Đồng nghiệp kết luận "tin đã nằm trên broker". Đúng không?', ['Đúng', 'Sai: tin mới vào thùng trong RAM; chỉ callback/Future mới cho biết broker đã nhận', 'Đúng nếu acks=all', 'Đúng nếu linger.ms=0'], 1, 'send() luôn bất đồng bộ.'),
    q('Topic 6 partition, leader trên 3 broker. Mỗi lần sender gửi, tối đa bao nhiêu request?', ['6', '3', '1', '12'], 1, 'Mỗi broker một request, gom mọi thùng của các partition nó làm leader.'),
    q('Tăng batch.size từ 16 KB lên 1 MB (linger.ms = 5). Tác động chính?', ['Tin chờ lâu hơn nhiều', 'Tốn thêm RAM; tin không chờ lâu hơn vì vẫn đi khi hết linger', 'Mất dữ liệu', 'Request nhỏ hơn'], 1, 'Producer không đợi thùng đầy; batch.size chỉ là trần.'),
    q('Callback của bạn gọi một API HTTP mất 200 ms. Hậu quả?', ['Không sao', 'Luồng nội bộ của producer bị kẹt, mọi lần gửi chậm theo', 'Tin bị gửi lại', 'Broker từ chối'], 1, 'Callback chạy trên luồng của producer; việc nặng hãy đẩy sang luồng khác.'),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao Kafka gom tin vào thùng thay vì gửi từng tin?',
      keywords: ['request', 'broker', 'thùng', 'nén'],
      modelAnswer:
        'Vì mỗi request mạng có chi phí cố định (vòng chờ, header, CPU broker). Gom nhiều tin vào thùng theo partition, rồi gom các thùng cùng broker vào một request, thì số request giảm rất mạnh, nén cũng hiệu quả hơn vì thùng to. Đổi lại mỗi tin có thể chờ thêm tối đa linger.ms.',
    },
  ],
  recap: {
    journey:
      '100 tin biến mất khi app tắt → send() chỉ thả tin vào thùng trong RAM → sender thread chở thùng sau, gom theo broker → thùng đi khi đầy hoặc hết linger.ms → kho đầy thì send() bị chặn → trước khi tắt app phải flush/close.',
    points: [
      { title: 'Bất đồng bộ', text: 'send() trả về khi tin vào thùng; kết quả thật nằm ở callback/Future.' },
      { title: 'Gom', text: 'Thùng theo partition, request theo broker.' },
      { title: 'Khi nào gửi', text: 'Đầy batch.size hoặc hết linger.ms, cái nào tới trước.' },
      { title: 'Kho', text: 'buffer.memory đầy → send() bị chặn → TimeoutException sau max.block.ms.' },
    ],
    next: 'Bài tiếp theo: acks & Idempotence — thế nào là "gửi xong", và retry mà không trùng tin.',
  },
}
