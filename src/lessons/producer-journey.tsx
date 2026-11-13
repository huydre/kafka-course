import type { ReactNode } from 'react'
import { cameraAt, clamp, lerp, move, sp, span, vis } from '../player/motion-kit'
import { Envelope, HERO, Icon3D, Packets, ProducerBox, Rise, SOFT, SOFT_PANEL, ServerUnit, Sheen, SoftScene, SoftTheme, SummaryList, Wire } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene, SceneSfx } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { producerJourneyScript } from './producer-journey-script'

/** This lesson is drawn in the navy glow style. */
const INK = SOFT
const panel = SOFT_PANEL
const WIDE = { x: 960, y: 540, s: 1 }
const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN')
/** Snap time so counters change at most 6 times per second (motion blur smears faster digits). */
const tq = (t: number) => Math.floor(t * 6) / 6
const GLOW = '0 0 34px rgba(77,141,255,0.6), inset 0 2px 0 rgba(255,255,255,0.5)'

/** Glowing pill centred on (x, y). `hot` cross-fades a coloured state (`color`) over the navy base. */
function Tag({ x, y, text, o = 1, hot = 0, color = INK.good, size = 30, mono = false }: { x: number; y: number; text: string; o?: number; hot?: number; color?: string; size?: number; mono?: boolean }) {
  if (o <= 0) return null
  return (
    <div style={{ ...panel, left: x, top: y, transform: 'translate(-50%, -50%)', borderRadius: 999, padding: '10px 28px', fontSize: size, fontFamily: mono ? MONO : undefined, whiteSpace: 'nowrap', opacity: clamp(o), fontVariantNumeric: 'tabular-nums' }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 999, background: `${color}30`, border: `2px solid ${color}`, boxShadow: `0 0 22px ${color}99`, opacity: clamp(hot) }} />
      <span style={{ position: 'relative' }}>{text}</span>
    </div>
  )
}

/** Navy card centred on (x, y). `lit` cross-fades the glossy hero look, `bad` a red alert state. Children are positioned inside the card box. */
function Card({ x, y, w, h, lit = 0, bad = 0, o = 1, children }: { x: number; y: number; w: number; h: number; lit?: number; bad?: number; o?: number; children?: ReactNode }) {
  if (o <= 0) return null
  return (
    <div style={{ position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, opacity: clamp(o) }}>
      <div style={{ ...INK.card, position: 'absolute', inset: 0 }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: 22, background: HERO, boxShadow: GLOW, opacity: clamp(lit), overflow: 'hidden' }}>
      </div>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 22, background: 'linear-gradient(160deg, rgba(255,90,106,0.38), rgba(110,16,40,0.7))', border: `2px solid ${INK.bad}`, boxShadow: `0 0 28px ${INK.bad}88`, opacity: clamp(bad) }} />
      <div style={{ position: 'absolute', inset: 0 }}>{children}</div>
    </div>
  )
}

/** Centred big statement, revealed word by word. */
function Say({ y, text, color = INK.text, size = 52, o = 1 }: { y: number; text: string; color?: string; size?: number; o?: number }) {
  const q = clamp(o)
  if (q <= 0) return null
  return (
    <div style={{ position: 'absolute', left: 0, width: 1920, top: y, textAlign: 'center', fontSize: size, fontWeight: 800, letterSpacing: -0.5, color, whiteSpace: 'nowrap' }}>
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

/** Progress bar in the soft style (track + glossy fill). */
function Bar({ x, y, w, h, fill, hl = 0 }: { x: number; y: number; w: number; h: number; fill: number; hl?: number }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: h / 2, background: INK.cell.empty, border: '1.5px solid rgba(110,160,255,0.45)', boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ width: `${clamp(fill) * 100}%`, height: '100%', borderRadius: h / 2, background: INK.cell.filled, boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.5)' }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: h / 2, border: '2.5px solid #ffffff', boxShadow: '0 0 14px rgba(255,255,255,0.8)', opacity: clamp(hl) }} />
    </div>
  )
}

/* ------------------------------------------------------------------ 0. cold open */

function hook(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const sent = Math.min(100, Math.floor(span(tq(t), a0 + 1.4, a0 + 3.4) * 100))
  const dead = span(t, a1 + 0.3, a1 + 0.8)
  const brokerAt = a1 + 1.7
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE]])}>
      <Rise t={t} at={0.2}>
        <div style={{ opacity: 1 - 0.55 * dead }}>
          <ProducerBox x={110} y={380} title="ứng dụng" line={`send() × ${sent}`} w={420} />
        </div>
      </Rise>
      <Tag x={320} y={300} text="ứng dụng đã tắt" color={INK.bad} hot={1} o={vis(t, a1 + 0.3, Infinity, 0.35)} />
      <Icon3D name="toggle" x={320} y={600} size={120} t={t} at={a1 + 0.5} />
      <Wire from={{ x: 540, y: 430 }} to={{ x: 738, y: 430 }} color={INK.line} p={move(t, 0.8, 0.5)} flow={t} />
      <Packets t={t} from={{ x: 540, y: 430 }} to={{ x: 738, y: 430 }} start={a0 + 1.4} end={a0 + 3.4} every={0.12} len={0.5} size={18} />
      <Rise t={t} at={0.8}>
        <Card x={960} y={430} w={440} h={230}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 26, textAlign: 'center', fontSize: 28, fontWeight: 700, color: INK.faint }}>đã gọi send()</div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 78, textAlign: 'center', fontSize: 92, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: -2 }}>{sent}/100</div>
        </Card>
      </Rise>
      <Tag x={960} y={600} text="mỗi lần ~0,1 ms" o={vis(t, a0 + 1.4)} />
      <Wire from={{ x: 1180, y: 430 }} to={{ x: 1440, y: 430 }} color={INK.bad} dashed p={move(t, a1 + 1.4, 0.5)} />
      <Rise t={t} at={brokerAt}>
        <ServerUnit x={1450} y={365} name="broker" t={t} />
      </Rise>
      <Rise t={t} at={a1 + 2.3}>
        <Card x={1580} y={650} w={320} h={150} bad={1}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 10, textAlign: 'center', fontSize: 72, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>0</div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 98, textAlign: 'center', fontSize: 28, fontWeight: 700 }}>tin nhận được</div>
        </Card>
      </Rise>
      <Icon3D name="thumb-down" x={1580} y={250} size={120} t={t} at={a1 + 3.0} />
      <Icon3D name="zoom" x={960} y={280} size={130} t={t} at={a2 + 2.6} />
      <Say y={800} text="send() trả về ≠ tin đã tới broker" color={INK.warn} size={58} o={sp(t, a2 + 0.8)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 1. the four stations */

const PX = [175, 485, 795, 1105, 1415]
const ST_TOP = 370
const ST_Y = 565

function Station({ x, t, at, lit, sub, title, children }: { x: number; t: number; at: number; lit: number; sub: string; title: string; children?: ReactNode }) {
  return (
    <Rise t={t} at={at}>
      <div style={{ position: 'absolute', left: x - 120, top: ST_TOP, width: 240, height: 390 }}>
        <div style={{ ...INK.card, position: 'absolute', inset: 0 }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: 22, background: HERO, boxShadow: GLOW, opacity: clamp(lit), overflow: 'hidden' }}>
          <Sheen t={t} every={2.4} />
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 20, textAlign: 'center', fontSize: 24, fontWeight: 700, color: INK.faint }}>{sub}</div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 54, textAlign: 'center', fontSize: 34, fontWeight: 800, letterSpacing: -0.5 }}>{title}</div>
        {children}
      </div>
    </Rise>
  )
}

function pipeline(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const d1 = c.end(1) - a1
  const atPart = a1 + d1 * 0.55
  const fade = (a: number, b: number) => span(t, a, a + 0.4) - span(t, b, b + 0.4)
  // The message chip: object -> bytes -> "to P1" while it rides along the lane above the stations, then drops into P1.
  const cx = PX[0] + (PX[1] - PX[0]) * move(t, a1 + 0.2, 0.7) + (PX[2] - PX[1]) * move(t, atPart - 0.1, 0.7) + (PX[3] - PX[2]) * move(t, a2 + 0.1, 0.7)
  const cy = 300 + (609 - 300) * move(t, a2 + 1.0, 0.6)
  const chipO = vis(t, a0 + 2.8, Infinity, 0.35) * (1 - span(t, a2 + 1.45, a2 + 1.75))
  const txtB = fade(a1 + 0.9, atPart + 0.6 - 0.4)
  const txtP = span(t, atPart + 0.6, atPart + 1.0)
  const txtO = 1 - span(t, a1 + 0.9, a1 + 1.3)
  const drain = move(t, a3 + 0.5, 0.8)
  const creep = Math.min(0.18, Math.max(0, (t - a2) * 0.012))
  const fills = [0.5 + creep, 0.6 + creep * 0.4 + 0.2 * move(t, a2 + 1.5, 0.5), 0.28 + creep].map((f) => f * (1 - drain))
  const hl = vis(t, a2 + 0.8, a3 + 0.3, 0.35)
  const cam = cameraAt(t, [
    [0, WIDE],
    [a1 - 0.2, { x: 650, y: 540, s: 1.1 }, 1.3],
    [a2 - 0.2, { x: 1100, y: 540, s: 1.1 }, 1.3],
    [a3 - 0.2, { x: 1440, y: 540, s: 1.06 }, 1.3],
    [a3 + 2.6, WIDE, 1.3],
  ])
  const link = (i: number, at: number) => <Wire key={i} from={{ x: PX[i] + 124, y: ST_Y }} to={{ x: PX[i + 1] - 124, y: ST_Y }} color={INK.line} p={move(t, at, 0.5)} />
  return (
    <SoftScene t={t} camera={cam} title={{ kicker: 'BỐN TRẠM', text: 'Bên trong send()' }}>
      <div style={{ position: 'absolute', left: 25, top: 345, width: 1540, height: 505, borderRadius: 34, border: '2.5px dashed rgba(110,160,255,0.55)', opacity: vis(t, a0 + 0.2) }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, textAlign: 'center', fontSize: 26, fontWeight: 700, color: INK.faint }}>ỨNG DỤNG CỦA BẠN · RAM (nét đứt = dễ mất)</div>
      </div>
      <Station x={PX[0]} t={t} at={a0 + 0.5} lit={vis(t, a0 + 0.6, a1 + 0.1, 0.35)} sub="APP" title="send()" />
      <Station x={PX[1]} t={t} at={a0 + 1.1} lit={vis(t, a1 + 0.2, atPart, 0.35)} sub="① object → byte" title="Serializer" />
      <Station x={PX[2]} t={t} at={a0 + 1.7} lit={vis(t, atPart, a2 + 0.1, 0.35)} sub="② chọn partition" title="Partitioner" />
      <Station x={PX[3]} t={t} at={a0 + 2.3} lit={vis(t, a2 + 0.6, a3, 0.35)} sub="③ trong RAM" title="Bộ gom thùng">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <div style={{ position: 'absolute', left: 20, top: 146 + i * 70, width: 40, textAlign: 'center', fontSize: 28, fontWeight: 800 }}>P{i}</div>
            <Bar x={68} y={146 + i * 70} w={152} h={40} fill={fills[i]} hl={i === 1 ? hl : 0} />
          </div>
        ))}
      </Station>
      <Station x={PX[4]} t={t} at={a0 + 2.9} lit={vis(t, a3, a3 + 3.0, 0.35)} sub="④ luồng nền" title="Sender" />
      {[PX[0], PX[1], PX[2], PX[4]].map((x, k) => (
        <Icon3D key={x} name={(['computer', 'cube', 'hash', 'rocket'] as const)[k]} x={x} y={ST_TOP + 255} size={140} t={t} at={[a0 + 0.9, a0 + 1.5, a0 + 2.1, a0 + 3.3][k]} />
      ))}
      {link(0, a0 + 1.4)}
      {link(1, a0 + 2.0)}
      {link(2, a0 + 2.6)}
      {link(3, a0 + 3.2)}
      <Chip x={cx} y={cy} o={chipO} items={[{ text: '{ id: 42 }', o: txtO }, { text: '0101 1100', o: txtB }, { text: '→ P1', o: txtP }]} />
      <Tag x={PX[3]} y={232} text="send() trả về ngay tại đây" hot={1} o={vis(t, a2 + 3.0, a3 - 0.2, 0.35)} />
      <Packets t={t} from={{ x: PX[3] + 124, y: ST_Y }} to={{ x: PX[4] - 124, y: ST_Y }} start={a3 + 0.4} end={a3 + 1.6} every={0.25} len={0.5} size={18} />
      <Rise t={t} at={a3 + 0.9}>
        <ServerUnit x={1620} y={500} name="broker" t={t} />
      </Rise>
      <Wire from={{ x: PX[4] + 124, y: ST_Y }} to={{ x: 1612, y: ST_Y }} color={INK.line} p={move(t, a3 + 1.0, 0.5)} />
      <Packets t={t} from={{ x: PX[4] + 124, y: ST_Y }} to={{ x: 1612, y: ST_Y }} start={a3 + 1.5} end={a3 + 2.5} every={0.25} len={0.5} size={20} />
      <Envelope t={t} at={a3 + 2.7} from={{ x: 1740, y: 430 }} to={{ x: 250, y: 330 }} label="callback: thành công" color={INK.good} len={1.6} arc={130} />
      <Icon3D name="tick" x={175} y={310} size={100} t={t} at={a3 + 4.3} />
    </SoftScene>
  )
}

/** Pill chip carrying cross-fading texts (all stacked in one grid cell). */
function Chip({ x, y, o, items }: { x: number; y: number; o: number; items: { text: string; o: number }[] }) {
  if (o <= 0) return null
  return (
    <div style={{ ...panel, left: x, top: y, transform: 'translate(-50%, -50%)', borderRadius: 999, padding: '10px 26px', fontFamily: MONO, fontSize: 28, opacity: clamp(o), display: 'grid', justifyItems: 'center', borderColor: '#6ea2ff', boxShadow: '0 0 22px rgba(77,141,255,0.8)' }}>
      {items.map((i) => (
        <span key={i.text} style={{ gridArea: '1 / 1', opacity: clamp(i.o), whiteSpace: 'nowrap' }}>
          {i.text}
        </span>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ 2. post-office analogy */

const CX = [330, 960, 1590]
const CARD_Y = 520
const CARD_TOP = CARD_Y - 220

/** Analogy card: icon area on top, title and one line below; `lit` cross-fades the glossy highlight. */
function Analogy({ x, t, at, lit, title, line, children }: { x: number; t: number; at: number; lit: number; title: string; line: string; children: ReactNode }) {
  return (
    <Rise t={t} at={at}>
      <Card x={x} y={CARD_Y} w={470} h={440} lit={lit * 0.85}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 250, textAlign: 'center', fontSize: 46, fontWeight: 800, letterSpacing: -0.5 }}>{title}</div>
        <div style={{ position: 'absolute', left: 36, right: 36, top: 318, textAlign: 'center', fontSize: 28, fontWeight: 600, lineHeight: 1.3, color: 'rgba(255,255,255,0.88)' }}>{line}</div>
      </Card>
      {children}
    </Rise>
  )
}

function post(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const fillAt = span(t, a1 + 0.5, c.end(1))
  const drive = move(t, a2 + 0.8, 1.6)
  const bagX = [-130, 0, 130]
  const cam = cameraAt(t, [
    [0, { x: 520, y: 540, s: 1.05 }],
    [a1 - 0.2, { x: 960, y: 540, s: 1.06 }, 1.3],
    [a2 - 0.2, { x: 1400, y: 540, s: 1.05 }, 1.3],
    [a2 + 2.7, WIDE, 1.4],
  ])
  const mapTo = (x: number, text: string, at: number) => <Tag x={x} y={850} text={`= ${text}`} mono o={vis(t, at)} />
  return (
    <SoftScene t={t} camera={cam} title={{ kicker: 'VÍ DỤ ĐỜI THƯỜNG', text: 'Giống bưu cục' }}>
      <Analogy x={CX[0]} t={t} at={a0 + 1.2} lit={vis(t, a0 + 1.2, a1, 0.35)} title="Quầy gửi" line="đưa thư, nhận biên nhận, về ngay">
        <Icon3D name="mail" x={CX[0] + lerp(-50, 50, move(t, a0 + 2.0, 0.9))} y={CARD_TOP + 115} size={190} t={t} at={a0 + 1.5} />
      </Analogy>
      <Wire from={{ x: CX[0] + 245, y: CARD_Y }} to={{ x: CX[1] - 245, y: CARD_Y }} color={INK.line} p={move(t, a1, 0.5)} flow={t} />
      <Packets t={t} from={{ x: CX[0] + 245, y: CARD_Y }} to={{ x: CX[1] - 245, y: CARD_Y }} start={a1 + 0.3} end={a1 + 2.6} every={0.45} len={0.7} size={20} />
      <Analogy x={CX[1]} t={t} at={a1 + 0.3} lit={vis(t, a1 + 0.3, a2, 0.35)} title="Ngăn theo tỉnh" line="mỗi tỉnh một bao tải">
        {['HN', 'ĐN', 'HCM'].map((p, i) => (
          <div key={p}>
            <Icon3D name="money-bag" x={CX[1] + bagX[i]} y={CARD_TOP + 85} size={120} t={t} at={a1 + 0.7 + i * 0.25} />
            <div style={{ position: 'absolute', left: CX[1] + bagX[i] - 50, width: 100, top: CARD_TOP + 150, textAlign: 'center', fontSize: 26, fontWeight: 800, opacity: vis(t, a1 + 0.9 + i * 0.25) }}>{p}</div>
            <div style={{ opacity: vis(t, a1 + 0.9 + i * 0.25) }}>
              <Bar x={CX[1] + bagX[i] - 48} y={CARD_TOP + 192} w={96} h={16} fill={lerp(0.15, [0.9, 0.7, 0.5][i], fillAt) * (1 - drive)} />
            </div>
          </div>
        ))}
      </Analogy>
      <Wire from={{ x: CX[1] + 245, y: CARD_Y }} to={{ x: CX[2] - 245, y: CARD_Y }} color={INK.line} p={move(t, a2, 0.5)} flow={t} />
      <Packets t={t} from={{ x: CX[1] + 245, y: CARD_Y }} to={{ x: CX[2] - 245, y: CARD_Y }} start={a2 + 0.9} end={a2 + 2.3} every={0.25} len={0.6} size={20} />
      <Analogy x={CX[2]} t={t} at={a2 + 0.3} lit={vis(t, a2 + 0.3, Infinity, 0.35)} title="Xe tải theo tuyến" line="một chuyến chở mọi bao cùng tuyến">
        <Icon3D name="rocket" x={CX[2] + lerp(-40, 50, drive)} y={CARD_TOP + 115} size={180} t={t} at={a2 + 0.7} />
      </Analogy>
      {mapTo(CX[0], 'send()', a0 + 2.6)}
      {mapTo(CX[1], 'partition → thùng', a1 + 1.4)}
      {mapTo(CX[2], 'sender thread', a2 + 1.6)}
      <Envelope t={t} at={a2 + 3.0} from={{ x: CX[2], y: 275 }} to={{ x: CX[0], y: 285 }} label="callback" color={INK.good} len={1.6} arc={90} />
      <Icon3D name="bell" x={CX[0]} y={195} size={100} t={t} at={a2 + 4.6} />
      <Tag x={960} y={960} text="thư tới nơi, bưu cục gọi báo = callback" hot={1} o={vis(t, a2 + 4.6)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 3. batches per partition, requests per broker */

function batching(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const PY = [330, 540, 750]
  const BY = [435, 750]
  const fillStart = a2 + 0.2
  const fillEnd = a2 + 2.0
  const naiveEnd = a2 - 0.2
  const ship = move(t, fillEnd + 0.3, 1.1)
  const naiveCount = Math.round(lerp(0, 1000, span(tq(t), a1 + 0.2, naiveEnd)))
  const dim = vis(t, a1 + 0.2, naiveEnd, 0.35)
  const SRC = { x: 462, y: 540 }
  const sentTo = (y: number) => ({ x: 680, y })
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE]])} title={{ kicker: 'GOM CHUYẾN', text: 'Thùng theo partition' }}>
      <Rise t={t} at={a0 + 0.8}>
        <ProducerBox x={100} y={490} title="producer" line="1.000 tin" w={360} />
      </Rise>
      {PY.map((y, i) => (
        <div key={i} style={{ opacity: 1 - 0.7 * dim }}>
          <Wire from={SRC} to={sentTo(y)} color={INK.line} p={move(t, a0 + 1.5 + i * 0.3, 0.5)} />
          <Rise t={t} at={a0 + 1.4 + i * 0.3}>
            <Card x={830} y={y} w={300} h={130} lit={vis(t, fillStart, fillEnd + 1.3, 0.35)}>
              <div style={{ position: 'absolute', left: 26, top: 40, fontSize: 40, fontWeight: 800 }}>P{i}</div>
              <Bar x={100} y={50} w={170} h={30} fill={span(t, fillStart, fillEnd) * (1 - ship)} />
            </Card>
          </Rise>
        </div>
      ))}
      {BY.map((y, k) => (
        <div key={k}>
          <Rise t={t} at={a0 + 2.3 + k * 0.3}>
            <ServerUnit x={1470} y={y - 65} name={`Broker ${k + 1}`} t={t} />
          </Rise>
          <Tag x={1600} y={y + 140} text={k === 0 ? 'leader P0, P1' : 'leader P2'} o={vis(t, a0 + 2.8 + k * 0.3)} size={28} />
        </div>
      ))}
      {[0, 1, 2].map((i) => (
        <Wire key={i} from={{ x: 982, y: PY[i] }} to={{ x: 1460, y: i === 0 ? 405 : i === 1 ? 465 : 750 }} color={INK.line} p={move(t, a0 + 2.9 + i * 0.1, 0.5)} />
      ))}
      <Icon3D name="tick" x={1815} y={BY[0]} size={90} t={t} at={fillEnd + 1.7} />
      <Icon3D name="tick" x={1815} y={BY[1]} size={90} t={t} at={fillEnd + 1.8} />
      {/* One message per trip: dots pour straight to the brokers, the counter climbs to 1.000. */}
      <Packets t={t} from={SRC} to={{ x: 1430, y: BY[0] - 20 }} start={a1 + 0.2} end={naiveEnd} every={0.09} len={0.6} size={18} />
      <Packets t={t} from={SRC} to={{ x: 1430, y: BY[1] }} start={a1 + 0.25} end={naiveEnd} every={0.18} len={0.6} size={18} />
      {/* Batching: messages fall into their partition's bucket. */}
      {PY.map((y, i) => (
        <Packets key={i} t={t} from={SRC} to={sentTo(y)} start={fillStart + i * 0.05} end={fillEnd} every={0.2} len={0.5} size={18} />
      ))}
      <Envelope t={t} at={fillEnd + 0.3} from={{ x: 1090, y: BY[0] }} to={{ x: 1370, y: BY[0] }} label="P0 · P1" color={INK.accent} len={1.1} arc={0} />
      <Envelope t={t} at={fillEnd + 0.3} from={{ x: 1090, y: BY[1] }} to={{ x: 1370, y: BY[1] }} label="P2" color={INK.accent} len={1.1} arc={0} />
      <div style={{ position: 'absolute', left: 0, width: 1920, top: 915, textAlign: 'center', fontSize: 84, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: INK.bad, whiteSpace: 'nowrap', opacity: vis(t, a1 + 0.2, a2 - 0.2, 0.35), textShadow: `0 0 24px ${INK.bad}88` }}>{fmt(naiveCount)} request</div>
      <Say y={915} text="chỉ còn 2 request" color={INK.good} size={84} o={sp(t, fillEnd + 1.4)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 4. linger.ms vs batch.size */

/** A lane of batches leaving every `interval` seconds; block width is proportional to messages per request. */
function Lane({ t, y, start, interval, bw, o }: { t: number; y: number; start: number; interval: number; bw: number; o: number }) {
  const X0 = 480
  const X1 = 1420
  const TRAVEL = 2.8
  const n = Math.max(0, Math.floor((t - start) / interval) + 1)
  const first = Math.max(0, Math.floor((t - TRAVEL - start) / interval))
  const out: ReactNode[] = []
  for (let k = first; k < n; k++) {
    const p = (t - (start + k * interval)) / TRAVEL
    if (p < 0 || p >= 1) continue
    out.push(
      <div key={k} style={{ position: 'absolute', left: lerp(X0, X1, p) - bw / 2, top: y - 38, width: bw, height: 76, borderRadius: 12, background: HERO, boxShadow: '0 0 18px rgba(77,141,255,0.6), inset 0 2px 0 rgba(255,255,255,0.5)', opacity: Math.min(1, p * 8, (1 - p) * 8) }} />,
    )
  }
  return (
    <div style={{ opacity: o }}>
      <div style={{ position: 'absolute', left: X0 - 20, top: y - 3, width: X1 - X0 + 40, height: 6, borderRadius: 3, background: INK.line, opacity: 0.6 }} />
      {out}
    </div>
  )
}

function linger(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  // Beat 0: one bucket, two ways to leave. The timer runs out first, so the half-full bucket goes.
  const done = a0 + 3.2
  const fill = 0.7 * span(tq(t), a0 + 1.4, done) * (1 - move(t, done + 0.5, 0.6))
  const timer = span(tq(t), a0 + 1.4, done)
  const timerHot = span(t, done, done + 0.35)
  const gone = vis(t, 0, a1 - 0.5, 0.35)
  const cam = cameraAt(t, [
    [0, WIDE],
    [a1, { x: 960, y: 500, s: 1 }, 1.2],
    [a2, { x: 960, y: 540, s: 1 }, 1.2],
  ])
  const R = 70
  const row = (y: number, o: number, label: string, big: string, small: string, at: number) => (
    <div style={{ opacity: o }}>
      <Rise t={t} at={at}>
        <Card x={250} y={y} w={380} h={150}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 24, textAlign: 'center', fontSize: 28, fontWeight: 700, color: INK.faint }}>cấu hình</div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 66, textAlign: 'center', fontSize: 44, fontWeight: 800, fontFamily: MONO }}>{label}</div>
        </Card>
        <Card x={1680} y={y} w={380} h={190} lit={0.6}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 18, textAlign: 'center', fontSize: 64, fontWeight: 800, letterSpacing: -1 }}>{big}</div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 104, textAlign: 'center', fontSize: 30, fontWeight: 700 }}>{small}</div>
        </Card>
      </Rise>
    </div>
  )
  return (
    <SoftScene t={t} camera={cam} title={{ kicker: 'LINGER.MS', text: 'Khi nào thùng được gửi?' }}>
      <div style={{ opacity: gone }}>
        <Rise t={t} at={a0 + 0.9}>
          <Card x={430} y={450} w={640} h={300}>
            <div style={{ position: 'absolute', left: 40, top: 28, fontSize: 30, fontWeight: 700, color: INK.faint }}>THÙNG P1 · batch.size 16 KB</div>
            <Bar x={40} y={110} w={560} h={70} fill={fill} />
            <div style={{ position: 'absolute', left: 0, right: 0, top: 210, textAlign: 'center', fontSize: 44, fontWeight: 800, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>{(fill * 16).toFixed(0)} / 16 KB</div>
          </Card>
        </Rise>
        <Rise t={t} at={a0 + 1.3}>
          <Card x={1060} y={450} w={360} h={300}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 22, textAlign: 'center', fontSize: 28, fontWeight: 700, color: INK.faint }}>linger.ms = 10</div>
            <svg width={200} height={200} viewBox="0 0 200 200" style={{ position: 'absolute', left: 80, top: 80 }}>
              <circle cx="100" cy="100" r={R + 14} fill="none" stroke="rgba(110,160,255,0.3)" strokeWidth="14" />
              <circle cx="100" cy="100" r={R + 14} fill="none" stroke={INK.accent} strokeWidth="14" strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - timer} transform="rotate(-90 100 100)" opacity={1 - timerHot} />
              <circle cx="100" cy="100" r={R + 14} fill="none" stroke={INK.good} strokeWidth="14" strokeLinecap="round" transform="rotate(-90 100 100)" opacity={timerHot} />
              <text x="100" y="112" textAnchor="middle" fontSize="40" fontWeight="800" fill="#ffffff" fontFamily={MONO}>
                {Math.round(timer * 10)} ms
              </text>
            </svg>
          </Card>
        </Rise>
        <Tag x={430} y={680} text="① thùng đầy batch.size" o={vis(t, a0 + 1.0)} />
        <Tag x={1060} y={680} text="② hết linger.ms" o={vis(t, a0 + 1.6)} hot={timerHot} />
        <Tag x={745} y={790} text="→ gửi ngay, dù chưa đầy" hot={1} o={vis(t, done + 0.3)} size={34} />
        <Rise t={t} at={done - 0.6}>
          <ServerUnit x={1450} y={385} name="broker" t={t} />
        </Rise>
        <Envelope t={t} at={done + 0.5} from={{ x: 730, y: 450 }} to={{ x: 1370, y: 450 }} label="batch" color={INK.good} len={1.2} arc={190} />
      </div>
      {row(420, vis(t, a1 - 0.3), 'linger.ms = 0', '~20 tin', '~25 request/giây', a1 - 0.3)}
      {row(690, vis(t, a2 - 0.3), 'linger.ms = 50', '~220 tin', '~3 request/giây', a2 - 0.3)}
      <Lane t={t} y={420} start={a1} interval={0.16} bw={24} o={vis(t, a1 - 0.3)} />
      <Lane t={t} y={690} start={a2} interval={1.4} bw={130} o={vis(t, a2 - 0.3)} />
      <Rise t={t} at={a3 + 0.3}>
        <Card x={540} y={890} w={760} h={120}>
          <div style={{ position: 'absolute', left: 150, right: 20, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: 34, fontWeight: 800, color: INK.warn }}>mỗi tin chờ thêm vài chục ms</div>
        </Card>
        <Icon3D name="clock" x={230} y={890} size={110} t={t} at={a3 + 0.4} />
      </Rise>
      <Rise t={t} at={a3 + 2.6}>
        <Card x={1400} y={890} w={760} h={120}>
          <div style={{ position: 'absolute', left: 150, right: 20, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: 34, fontWeight: 800, color: INK.good }}>ít request hơn ~10 lần</div>
        </Card>
        <Icon3D name="thumb-up" x={1400 - 380 + 70} y={890} size={110} t={t} at={a3 + 2.7} />
      </Rise>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 5. buffer.memory full */

function buffer(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const full = a2 + 0.1
  const level = clamp(lerp(0.15, 1, span(t, a1 + 0.3, full)))
  const idle = lerp(0.08, 0.15, span(t, a0, a1 + 0.3))
  const lv = t < a1 + 0.3 ? idle : level
  const fullK = span(t, full, full + 0.4)
  const blocked = span(t, a2 + 0.2, a2 + 0.6)
  const shown = Math.round((t < a1 + 0.3 ? lv : clamp(lerp(0.15, 1, span(tq(t), a1 + 0.3, full)))) * 32)
  const left = Math.max(0, 60 - Math.round(span(tq(t), a2 + 1.0, a2 + 3.0) * 60))
  const TANK = { x: 960, y: 560, w: 520, h: 560 }
  const liquid = (bg: string, o: number) => (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${lv * 100}%`, background: bg, opacity: o, boxShadow: 'inset 0 4px 0 rgba(255,255,255,0.55)' }} />
  )
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE]])} title={{ kicker: 'BUFFER.MEMORY', text: 'Khi kho đầy' }}>
      <Rise t={t} at={a0 + 1.0}>
        <Card x={TANK.x} y={TANK.y} w={TANK.w} h={TANK.h} bad={fullK}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 22, overflow: 'hidden' }}>
            {liquid('linear-gradient(180deg, rgba(106,168,255,0.85), rgba(26,60,192,0.9))', 1 - fullK)}
            {liquid('linear-gradient(180deg, rgba(255,120,130,0.9), rgba(150,20,40,0.95))', fullK)}
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 24, textAlign: 'center', fontSize: 28, fontWeight: 700, color: INK.faint }}>buffer.memory · RAM</div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 74, textAlign: 'center', fontSize: 66, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: -1 }}>{shown} / 32 MB</div>
        </Card>
      </Rise>
      {['P0', 'P1', 'P2'].map((p, i) => (
        <Rise key={p} t={t} at={a0 + 2.4 + i * 0.7}>
          <Tag x={790 + i * 170} y={530} text={`thùng ${p}`} size={26} />
        </Rise>
      ))}
      <Rise t={t} at={a1 - 0.2}>
        <ProducerBox x={100} y={470} title="ứng dụng gửi vào" line="50 MB/s" w={380} />
      </Rise>
      <div style={{ opacity: 1 - blocked }}>
        <Wire from={{ x: 490, y: 520 }} to={{ x: 698, y: 520 }} color={INK.line} p={move(t, a1 + 0.1, 0.5)} flow={t} />
      </div>
      <div style={{ opacity: blocked }}>
        <Wire from={{ x: 490, y: 520 }} to={{ x: 698, y: 520 }} color={INK.bad} dashed p={1} />
      </div>
      <Packets t={t} from={{ x: 490, y: 520 }} to={{ x: 698, y: 520 }} start={a1 + 0.3} end={a2 + 0.1} every={0.1} len={0.5} size={18} />
      <Rise t={t} at={a1 + 0.1}>
        <Card x={1630} y={520} w={380} h={170} lit={0.6}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 20, textAlign: 'center', fontSize: 28, fontWeight: 700 }}>mạng chở đi</div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 72, textAlign: 'center', fontSize: 62, fontWeight: 800 }}>20 MB/s</div>
        </Card>
      </Rise>
      <Wire from={{ x: 1222, y: 520 }} to={{ x: 1432, y: 520 }} color={INK.line} p={move(t, a1 + 0.6, 0.5)} flow={t} />
      <Packets t={t} from={{ x: 1222, y: 520 }} to={{ x: 1432, y: 520 }} start={a1 + 0.9} every={0.35} len={0.6} size={18} />
      <Tag x={290} y={650} text="send() bị chặn…" color={INK.bad} hot={1} o={vis(t, a2 + 0.3)} size={32} />
      <Icon3D name="pause" x={290} y={790} size={120} t={t} at={a2 + 0.6} />
      <Tag x={960} y={925} text={`chờ tối đa max.block.ms: còn ${left} s`} color={INK.warn} hot={1} o={vis(t, a2 + 1.0, a2 + 3.0, 0.35)} size={32} />
      <Tag x={960} y={925} text="TimeoutException" color={INK.bad} hot={1} o={vis(t, a2 + 3.2)} size={54} />
      <Icon3D name="fire" x={1300} y={300} size={130} t={t} at={a2 + 3.3} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 6. summary */

function summary(t: number, c: Cue) {
  return (
    <SoftTheme>
      <SummaryList t={t} cue={c} items={['send() trả về khi tin vào thùng trong RAM', 'Thùng theo partition · chuyến theo broker', 'Đầy batch.size hoặc hết linger.ms', 'Trước khi tắt app: flush() / close()']} />
    </SoftTheme>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { hook, pipeline, post, batching, linger, buffer, summary }

/** Key-moment sounds, timed to the same cue offsets the scenes animate on. */
const SFX: Record<string, SceneSfx[]> = {
  hook: [{ kind: 'error', at: (c) => c.at(1) + 2.3 }],
  pipeline: [
    { kind: 'ding', at: (c) => c.at(2) + 3.0 },
    { kind: 'ding', at: (c) => c.at(3) + 4.3 },
  ],
  post: [{ kind: 'ding', at: (c) => c.at(2) + 4.6 }],
  batching: [{ kind: 'ding', at: (c) => c.at(2) + 2.0 + 1.4 }],
  linger: [{ kind: 'ding', at: (c) => c.at(0) + 3.2 + 0.5 + 1.2 }],
  buffer: [
    { kind: 'error', at: (c) => c.at(2) + 0.1 },
    { kind: 'error', at: (c) => c.at(2) + 3.2 },
  ],
}

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const producerJourneyLesson: Lesson = {
  ...producerJourneyScript,
  scenes: producerJourneyScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id], sfx: SFX[s.id] })),
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
