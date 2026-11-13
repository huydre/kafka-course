import type { CSSProperties, ReactNode } from 'react'
import { Fragment } from 'react'
import { cameraAt, clamp, lerp, move, sp, vis } from '../player/motion-kit'
import { ConsumerUnit, HERO, Icon3D, Packets, Rise, SOFT, SOFT_PANEL, ServerUnit, SoftScene, SoftTheme, Statement, SummaryList, Wire } from '../player/schematic'
import type { Icon3DName } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene, SceneSfx } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { retrySagaScript } from './retry-saga-script'

/** This lesson is drawn in the navy glow style. */
const INK = SOFT
const panel = SOFT_PANEL
const WIDE = { x: 960, y: 540, s: 1 }

/* ------------------------------------------------------------------ shared building blocks */

type CellKind = 'ok' | 'wait' | 'done' | 'bad' | 'warn' | 'dead' | 'empty'

const CELL_STYLE: Record<CellKind, CSSProperties> = {
  ok: { background: HERO, boxShadow: '0 0 22px rgba(77,141,255,0.6), inset 0 2px 0 rgba(255,255,255,0.5)', color: '#fff' },
  wait: { background: INK.cell.filled as string, boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.4), 0 8px 16px rgba(0,8,50,0.45)', color: '#fff' },
  done: { background: 'rgba(40,62,140,0.5)', border: '1.5px solid rgba(110,160,255,0.35)', color: INK.faint },
  bad: { background: 'linear-gradient(160deg, #ff9aa4 0%, #ff5a6a 50%, #a81c2e 100%)', boxShadow: '0 0 26px rgba(255,90,106,0.8), inset 0 2px 0 rgba(255,255,255,0.5)', color: '#fff' },
  warn: { background: 'linear-gradient(160deg, #ffd58a 0%, #ffb547 55%, #b8710c 100%)', boxShadow: '0 0 22px rgba(255,181,71,0.7), inset 0 2px 0 rgba(255,255,255,0.5)', color: '#1a1200' },
  dead: { background: 'rgba(110,26,48,0.6)', border: `2px dashed ${INK.bad}`, color: '#ffd0d6' },
  empty: { background: 'rgba(12,30,96,0.4)', border: '1.5px dashed rgba(110,160,255,0.35)', color: 'transparent' },
}

/** One message cell centred on (x, y). */
function Cell({ x, y, label, kind = 'wait', w = 92, h = 80, o = 1, size = 26, dx = 0 }: { x: number; y: number; label?: string; kind?: CellKind; w?: number; h?: number; o?: number; size?: number; dx?: number }) {
  return (
    <div style={{ position: 'absolute', left: x - w / 2 + dx, top: y - h / 2, width: w, height: h, boxSizing: 'border-box', borderRadius: 16, display: 'grid', placeItems: 'center', fontSize: size, fontWeight: 800, whiteSpace: 'nowrap', opacity: clamp(o), ...CELL_STYLE[kind] }}>
      {label}
    </div>
  )
}

/** Glowing pill centred on (x, y). */
function Pill({ x, y, text, color = '#ffffff', o = 1, size = 28, hero = false }: { x: number; y: number; text: string; color?: string; o?: number; size?: number; hero?: boolean }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)', padding: '8px 24px', borderRadius: 999, whiteSpace: 'nowrap', fontSize: size, fontWeight: 800, color: hero ? '#fff' : color, background: hero ? HERO : 'rgba(8,22,82,0.92)', border: hero ? 'none' : `1.5px solid ${color}`, boxShadow: hero ? '0 0 26px rgba(77,141,255,0.7)' : `0 0 18px ${color}88`, opacity: clamp(o) }}>
      {text}
    </div>
  )
}

const LaneLabel = ({ x, y, text, o = 1 }: { x: number; y: number; text: string; o?: number }) => (
  <div style={{ position: 'absolute', left: x, top: y - 22, fontSize: 34, fontWeight: 800, color: INK.faint, opacity: clamp(o), whiteSpace: 'nowrap' }}>{text}</div>
)

/** Consumer status text drawn at a readable size next to the ConsumerUnit name (the kit's own note is only 24px). */
const ConsumerNote = ({ x, y, text, o = 1 }: { x: number; y: number; text: string; o?: number }) => (
  <div style={{ position: 'absolute', left: x + 232, top: y + 17, fontSize: 30, fontWeight: 700, color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap', opacity: clamp(o) }}>{text}</div>
)

/** Left x for a Statement so that it is centred on `cx`. */
const centred = (cx: number, text: string, size: number) => cx - text.length * size * 0.26

/** Position of something that hops between lanes: each `leg` moves it from the previous point to the next. */
function hopAlong(t: number, pts: { x: number; y: number }[], starts: number[], len = 0.7) {
  let x = pts[0].x
  let y = pts[0].y
  starts.forEach((s, k) => {
    const m = move(t, s, len)
    x += (pts[k + 1].x - pts[k].x) * m
    y += (pts[k + 1].y - pts[k].y) * m
  })
  return { x, y }
}

/* ------------------------------------------------------------------ 0. hook: one poison message blocks the partition */

const HK = { x0: 130, pitch: 108, y: 520, n: 16 }
const hkX = (i: number) => HK.x0 + i * HK.pitch

function hook(t: number, c: Cue) {
  const [a1, a2, a3] = [c.at(1), c.at(2), c.at(3)]
  const pt = [1.4, 2.6, 3.8]
  const caret = pt.reduce((s, p) => s + move(t, p - 0.6, 0.6), 0)
  const poison = t >= a1 + 0.3
  const tries = t >= a1 + 1.8 ? Math.floor((t - a1 - 1.8) / 0.8) + 1 : 0
  const lag = t >= a2 ? 9 + Math.floor((t - a2) * 9) : 0
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 900, y: 540, s: 1.05 }, 1.2], [a3, WIDE, 1.2]])}>
      <div style={{ position: 'absolute', right: 1920 - (hkX(15) + 49), top: 360, fontSize: 28, fontWeight: 700, color: INK.faint, opacity: vis(t, 0.2) }}>partition P0 · topic orders</div>
      {Array.from({ length: HK.n }, (_, i) => {
        const arrive = i >= 12 ? a3 + 0.3 + (i - 12) * 0.6 : 0.2 + i * 0.05
        const kind: CellKind = i < 3 ? (t >= pt[i] ? 'done' : 'wait') : i === 3 ? (poison ? 'bad' : 'wait') : 'wait'
        const shake = i === 3 && t >= a1 + 1.0 ? Math.sin(t * 34) * 4 : 0
        return <Cell key={i} x={hkX(i)} y={HK.y} label={`#${27 + i}`} kind={kind} w={98} h={92} size={28} o={vis(t, arrive, Infinity, 0.3)} dx={shake} />
      })}
      <Icon3D name="fire" x={hkX(3)} y={410} size={120} t={t} at={a1 + 0.3} />
      <div style={{ position: 'absolute', left: hkX(0) + caret * HK.pitch - 90, top: HK.y + 56, width: 180, textAlign: 'center', opacity: vis(t, 0.6) }}>
        <svg width={180} height={26} viewBox="0 0 180 26">
          <path d="M90 2 L104 24 L76 24 Z" fill={INK.good} />
        </svg>
        <div style={{ fontSize: 28, fontWeight: 800, color: INK.good }}>consumer</div>
      </div>
      <div style={{ ...panel, left: 120, top: 800, fontSize: 40, color: INK.good, opacity: vis(t, 0.9, a1 + 1.6) }}>đã xử lý: {Math.round(caret)} tin</div>
      <div style={{ ...panel, left: 120, top: 800, fontSize: 40, color: INK.bad, opacity: vis(t, a1 + 1.8) }}>thử lại: {tries} lần</div>
      <div style={{ ...panel, left: 1030, top: 800, fontSize: 40, color: INK.warn, opacity: vis(t, a2) }}>lag: {lag} tin ↑</div>
      <Statement x={centred(960, '1 tin độc → cả partition kẹt', 52)} y={950} text="1 tin độc → cả partition kẹt" color={INK.bad} size={52} o={sp(t, a3 + 1.6)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 1. retry-5s → retry-1m → dlq */

const RY = [290, 480, 670, 860]
const RX = (j: number) => 380 + j * 112
const ROW_NAMES = ['orders', 'retry-5s', 'retry-1m', 'dlq']

function retry(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const hops = [a0 + 3.2, a2 + 0.2, a3 + 0.2]
  const pos = hopAlong(t, RY.map((y) => ({ x: RX(3), y })), hops)
  const born = a0 + 1.0
  const atDlq = t >= hops[2] + 0.7
  const failR1 = t >= a1 + 3.0
  const failR2 = t >= a2 + 3.2
  const shake = (from: number) => (t >= from && t < from + 0.5 ? Math.sin(t * 40) * 5 : 0)
  const count1 = clamp(5 - Math.floor(((t - a1 - 0.4) / 2.5) * 5), 0, 5)
  const count2 = clamp(60 - Math.floor(((t - a2 - 0.9) / 2.2) * 12) * 5, 0, 60)
  const processed = t > 0.6 ? 12 + Math.floor(t * 3.2) : 0
  const rowAt = [0.3, a0 + 1.4, a0 + 1.7, a0 + 2.0]
  const panelBox = (row: number, children: ReactNode, at: number) => (
    <Rise t={t} at={at}>
      <div style={{ ...panel, left: 1210, top: RY[row] - 59, width: 560, height: 118, boxSizing: 'border-box', padding: '0 24px 0 130px', display: 'flex', alignItems: 'center', fontSize: 32 }}>{children}</div>
    </Rise>
  )
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE]])} title={{ kicker: 'RETRY TOPIC', text: 'Đừng đứng chờ', until: a0 + 1.2 }}>
      {ROW_NAMES.map((name, r) => (
        <div key={name} style={{ opacity: vis(t, rowAt[r], Infinity, 0.3) }}>
          <LaneLabel x={70} y={RY[r]} text={name} />
          {Array.from({ length: 7 }, (_, j) => {
            const kind: CellKind = r === 0 ? (j < 3 ? 'done' : j === 3 ? (t < born ? 'wait' : 'empty') : 'wait') : 'empty'
            return <Cell key={j} x={RX(j)} y={RY[r]} kind={kind} w={100} h={84} size={28} label={r === 0 ? `#${27 + j}` : undefined} />
          })}
        </div>
      ))}
      {t >= born && <Cell x={pos.x} y={pos.y} label="#30" kind={atDlq ? 'dead' : 'bad'} w={100} h={84} size={28} o={vis(t, born, Infinity, 0.15)} dx={shake(a1 + 3.0) + shake(a2 + 3.2)} />}
      <Wire from={{ x: RX(6) + 56, y: RY[0] }} to={{ x: 1200, y: RY[0] }} color={INK.line} p={move(t, 0.5, 0.4)} flow={t} />
      <Packets t={t} from={{ x: RX(6) + 56, y: RY[0] }} to={{ x: 1200, y: RY[0] }} start={0.9} every={0.4} len={0.7} size={20} />
      <Rise t={t} at={0.3}>
        <ConsumerUnit x={1210} y={RY[0] - 59} w={560} name="consumer" t={t} busy={(t * 1.4) % 1} />
        <ConsumerNote x={1210} y={RY[0] - 59} text={`xong ${processed} tin`} />
      </Rise>
      {panelBox(1, <span style={{ color: failR1 ? INK.bad : INK.text }}>{failR1 ? 'thử lại → lỗi' : `đợi đủ ${count1}s`}</span>, a1)}
      {panelBox(2, <span style={{ color: failR2 ? INK.bad : INK.text }}>{failR2 ? 'thử lại → lỗi' : t < a2 + 0.9 ? 'đợi 60s' : `đợi ${count2}s`}</span>, a2)}
      {panelBox(3, <span style={{ color: INK.warn }}>hết 3 lần · chờ người xem</span>, a3)}
      {[1, 2].map((r) => (
        <Icon3D key={r} name="clock" x={1270} y={RY[r]} size={90} t={t} at={r === 1 ? a1 : a2} />
      ))}
      <Icon3D name="folder" x={1270} y={RY[3]} size={90} t={t} at={a3 + 0.8} />
      <Statement x={centred(960, 'topic chính vẫn chạy đều, không ai phải chờ', 40)} y={950} text="topic chính vẫn chạy đều, không ai phải chờ" color={INK.good} size={40} o={sp(t, a3 + 2.4)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 2. ordering is lost */

const OX = (j: number) => 440 + j * 190
const OY = { main: 330, retry: 520, ledger: 735 }

function order(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const labels = ['Placed·1', 'Paid·1', 'Placed·3', 'Paid·3', 'Placed·4']
  const processedAt = [a0 + 0.9, a0 + 1.5, Infinity, a1 + 0.8, a1 + 2.0]
  const failAt = a0 + 1.9
  const hopOut = a0 + 2.8
  const back = a2 + 0.2
  const ledgerAt = [a0 + 1.0, a0 + 1.6, a1 + 0.9, a1 + 2.1]
  const ledgerLabels = ['Placed·1', 'Paid·1', 'Paid·3', 'Placed·4']
  const paidBad = t >= a2 + 1.1
  // Placed·3: main lane → retry lane → ledger slot 4
  const pos = hopAlong(t, [{ x: OX(2), y: OY.main }, { x: OX(2), y: OY.retry }, { x: OX(4), y: OY.ledger }], [hopOut, back], 0.8)
  const showMoving = t >= failAt
  const countdown = clamp(5 - Math.floor(((t - a1 - 0.4) / 3.0) * 5), 0, 5)
  const retried = t >= a1 + 3.5
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE]])} title={{ kicker: 'THỨ TỰ', text: 'Cái giá của retry topic', until: a0 + 1.2 }}>
      <LaneLabel x={60} y={OY.main} text="orders" />
      <LaneLabel x={60} y={OY.retry} text="retry-5s" o={vis(t, a0 + 1.6)} />
      <LaneLabel x={60} y={OY.ledger - 70} text="thứ tự xử lý thực tế" o={vis(t, a0 + 0.6)} />
      {labels.map((l, j) => {
        const gone = j === 2 && t >= hopOut
        const kind: CellKind = gone ? 'empty' : j === 2 ? (t >= failAt ? 'bad' : 'wait') : t >= processedAt[j] ? 'done' : 'wait'
        const glow = j === 3 && t >= a1 + 0.1 && t < processedAt[3] ? 'ok' : kind
        return (
          <Rise key={j} t={t} at={0.2 + j * 0.12}>
            <Cell x={OX(j)} y={OY.main} label={gone ? undefined : l} kind={glow} w={172} h={88} size={30} />
          </Rise>
        )
      })}
      {Array.from({ length: 5 }, (_, j) => (
        <div key={j} style={{ opacity: vis(t, a0 + 1.6) }}>
          <Cell x={OX(j)} y={OY.retry} kind="empty" w={172} h={88} />
        </div>
      ))}
      {Array.from({ length: 5 }, (_, j) => (
        <div key={j} style={{ opacity: vis(t, a0 + 0.6) }}>
          <Cell x={OX(j)} y={OY.ledger} kind="empty" w={172} h={88} />
        </div>
      ))}
      {ledgerLabels.map((l, j) => (
        <Cell key={l} x={OX(j)} y={OY.ledger} label={l} kind={j === 2 && paidBad ? 'bad' : 'ok'} w={172} h={88} size={30} o={vis(t, ledgerAt[j], Infinity, 0.25)} />
      ))}
      {showMoving && <Cell x={pos.x} y={pos.y} label="Placed·3" kind={t >= back + 0.8 ? 'ok' : 'bad'} w={172} h={88} size={30} o={vis(t, failAt, Infinity, 0.15)} />}
      <Rise t={t} at={0.4}>
        <ConsumerUnit x={1390} y={OY.main - 59} w={440} name="consumer" t={t} busy={(t * 1.3) % 1} />
        <ConsumerNote x={1390} y={OY.main - 59} text="đang đọc" />
      </Rise>
      <div style={{ ...panel, left: 1390, top: OY.retry - 38, fontSize: 32, color: retried ? INK.good : INK.warn, padding: '10px 24px', opacity: vis(t, a1 + 0.4, back, 0.3) }}>{retried ? 'thử lại → xong' : `đợi ${countdown}s`}</div>
      <Icon3D name="thumb-down" x={1420} y={OY.ledger} size={110} t={t} at={a2 + 1.1} />
      <Pill x={1660} y={OY.ledger} text="Paid trước Placed" color={INK.bad} size={30} o={vis(t, a2 + 1.4)} />
      <Rise t={t} at={a3 - 0.7}>
        <div style={{ ...panel, left: 110, top: 850, width: 790, height: 112, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 20, fontSize: 34 }}>
          <span style={{ width: 90 }} />
          blocking retry: giữ thứ tự
        </div>
      </Rise>
      <Rise t={t} at={a3 + 2.4}>
        <div style={{ ...panel, left: 1010, top: 850, width: 810, height: 112, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 20, fontSize: 34 }}>
          <span style={{ width: 90 }} />
          tin sau cùng key → vào retry
        </div>
      </Rise>
      <Icon3D name="pause" x={185} y={906} size={90} t={t} at={a3 - 0.6} />
      <Icon3D name="key" x={1085} y={906} size={90} t={t} at={a3 + 2.5} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 3. DLQ: inspect and replay */

const DX = (j: number) => 380 + j * 120
const DY = { orders: 260, dlq: 450 }
const HEADER = ['x-original-topic: orders', 'x-original-offset: 30', 'x-exception: JSON parse error', 'x-retry-count: 3']

function dlq(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const fixedAt = a1 + 2.5
  const fixed = t >= fixedAt
  const hop = a2 + 0.3
  const pos = hopAlong(t, [{ x: DX(3), y: DY.dlq }, { x: DX(5), y: DY.orders }], [hop], 0.9)
  const replayed = t >= hop + 0.9
  const processed = t >= a2 + 2.0
  const highlight = t >= a1 + 0.3 && t < fixedAt ? Math.floor((t - a1 - 0.3) / 0.55) % 4 : -1
  const days = t >= a3 + 0.4 ? Math.min(14, 1 + Math.floor((t - a3 - 0.4) * 3.5)) : 0
  const icon: Icon3DName = t < fixedAt ? 'zoom' : t < a2 ? 'tools' : !processed ? 'forward' : t < a3 ? 'tick' : 'trash-can'
  const iconAt = t < fixedAt ? a1 + 0.2 : t < a2 ? fixedAt : !processed ? a2 : t < a3 ? a2 + 2.0 : a3
  const caption = t < fixedAt ? 'người trực xem tin' : t < a2 ? 'sửa dữ liệu / sửa code' : !processed ? 'phát lại → orders' : t < a3 ? 'xử lý xong' : `không ai mở: ${days} ngày`
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE]])} title={{ kicker: 'DLQ', text: 'Không phải thùng rác', until: a0 + 1.2 }}>
      <LaneLabel x={70} y={DY.orders} text="orders" />
      <LaneLabel x={70} y={DY.dlq} text="dlq" />
      {Array.from({ length: 7 }, (_, j) => {
        const k: CellKind = j < 5 ? 'done' : j === 5 ? (processed ? 'done' : replayed ? 'ok' : 'empty') : 'empty'
        return <Cell key={j} x={DX(j)} y={DY.orders} kind={k} w={106} h={88} size={28} label={j < 5 ? `#${25 + j}` : j === 5 && replayed ? '#30' : undefined} o={vis(t, 0.2 + j * 0.05)} />
      })}
      {Array.from({ length: 7 }, (_, j) => {
        const parked = j === 3 && t < hop
        const filler = t >= a3 + 0.2 + j * 0.3 && !(j === 3 && t < hop)
        const k: CellKind = parked ? (fixed ? 'ok' : 'bad') : filler ? 'dead' : 'empty'
        return <Cell key={j} x={DX(j)} y={DY.dlq} kind={k} w={106} h={88} size={28} label={parked ? '#30' : filler ? `#${60 + j}` : undefined} o={vis(t, j === 3 ? a0 + 0.2 : 0.4 + j * 0.05, Infinity, 0.3)} />
      })}
      {t >= hop && t < hop + 0.9 && <Cell x={pos.x} y={pos.y} label="#30" kind="ok" w={106} h={88} size={28} />}
      <Rise t={t} at={0.5}>
        <div style={{ ...panel, left: 130, top: 590, width: 900, height: 340, boxSizing: 'border-box', padding: '28px 36px' }}>
          {HEADER.map((line, k) => {
            const text = k === 2 && fixed ? 'x-exception: đã sửa dữ liệu' : line
            return (
              <div key={k} style={{ height: 70, display: 'flex', alignItems: 'center', fontFamily: MONO, fontSize: 30, fontWeight: 700, color: k === 2 && fixed ? INK.good : INK.text, opacity: vis(t, a0 + 0.8 + k * 0.8, Infinity, 0.3), background: highlight === k ? 'rgba(110,160,255,0.28)' : 'transparent', borderRadius: 12, padding: '0 12px', margin: '0 -12px' }}>
                {text}
              </div>
            )
          })}
        </div>
      </Rise>
      <Rise t={t} at={0.6}>
        <ConsumerUnit x={1290} y={DY.orders - 59} w={480} name="consumer" t={t} busy={(t * 1.3) % 1} />
        <ConsumerNote x={1290} y={DY.orders - 59} text={processed ? 'xử lý lại #30' : 'đang đọc'} />
      </Rise>
      <Icon3D key={icon} name={icon} x={1400} y={720} size={220} t={t} at={iconAt} />
      <Pill x={1400} y={900} text={caption} color={t >= a3 ? INK.bad : INK.accent} size={30} o={vis(t, a1 + 0.1)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 4. saga: forward events, then compensation */

const SG = { w: 300, y: 380, h: 240, xs: [150, 810, 1470] }
const sgC = (k: number) => SG.xs[k] + SG.w / 2

function saga(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const failed = t >= a2 + 0.3
  const names = ['Đơn hàng', 'Thanh toán', 'Kho']
  const icons: Icon3DName[] = ['file-text', 'money-bag', failed ? 'fire' : 'cube']
  const wy = { f: 460, b: 560 }
  const gap = (k: number) => ({ l: SG.xs[k] + SG.w + 10, r: SG.xs[k + 1] - 10 })
  const fwdAt = [a1 + 0.2, a1 + 1.6]
  const bwdAt = [a3 + 0.3, a3 + 2.4]
  const fwd = ['OrderCreated', 'PaymentDone']
  const bwd = ['StockFailed', 'PaymentRefunded']
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE]])} title={{ kicker: 'SAGA', text: 'Bước bù thay rollback', until: a0 + 1.2 }}>
      <Statement x={centred(960, 'mỗi service một database · không có giao dịch chung', 40)} y={230} text="mỗi service một database · không có giao dịch chung" size={40} o={sp(t, a0 + 5.0) * (1 - clamp((t - a2) / 0.4))} />
      <Statement x={centred(960, 'tiền đã trừ · không rollback được', 46)} y={230} text="tiền đã trừ · không rollback được" color={INK.bad} size={46} o={sp(t, a2 + 1.4)} />
      {names.map((n, k) => (
        <Rise key={n} t={t} at={1.6 + k * 0.7}>
          <div style={{ ...panel, left: SG.xs[k], top: SG.y, width: SG.w, height: SG.h, boxSizing: 'border-box', padding: 0, border: k === 2 && failed ? `2px solid ${INK.bad}` : (INK.card.border as string), boxShadow: k === 2 && failed ? `0 0 34px ${INK.bad}88` : (INK.card.boxShadow as string) }}>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 28, textAlign: 'center', fontSize: 38, fontWeight: 800, color: k === 2 && failed ? INK.bad : INK.text }}>{n}</div>
          </div>
        </Rise>
      ))}
      {names.map((n, k) => (
        <Icon3D key={`${n}-${icons[k]}`} name={icons[k]} x={sgC(k)} y={SG.y + 80} size={120} t={t} at={k === 2 && failed ? a2 + 0.3 : 1.8 + k * 0.7} />
      ))}
      {[0, 1].map((k) => {
        const g = gap(k)
        const fwdOn = t >= fwdAt[k]
        const bwdOn = t >= bwdAt[k]
        return (
          <div key={k}>
            {fwdOn && <Wire from={{ x: g.l, y: wy.f }} to={{ x: g.r, y: wy.f }} color={INK.accent} p={move(t, fwdAt[k], 0.5)} flow={t} />}
            {fwdOn && <Packets t={t} from={{ x: g.l, y: wy.f }} to={{ x: g.r, y: wy.f }} start={fwdAt[k] + 0.4} end={bwdOn || k === 1 ? fwdAt[k] + 3.2 : fwdAt[k] + 4} every={0.45} len={0.7} size={20} />}
            <Pill x={(g.l + g.r) / 2} y={wy.f - 52} text={fwd[k]} color={INK.accent} size={32} o={vis(t, fwdAt[k] + 0.2)} />
            {bwdOn && <Wire from={{ x: g.r, y: wy.b }} to={{ x: g.l, y: wy.b }} color={INK.bad} p={move(t, bwdAt[k], 0.5)} flow={t} />}
            {bwdOn && <Packets t={t} from={{ x: g.r, y: wy.b }} to={{ x: g.l, y: wy.b }} start={bwdAt[k] + 0.4} every={0.45} len={0.7} color={INK.bad} size={20} />}
            <Pill x={(g.l + g.r) / 2} y={wy.b + 52} text={bwd[k]} color={INK.bad} size={32} o={vis(t, bwdAt[k] + 0.2)} />
          </div>
        )
      })}
      {['DB riêng', 'DB riêng', 'DB riêng'].map((d, k) => (
        <Pill key={k} x={sgC(k)} y={680} text={d} color={INK.faint} size={34} o={vis(t, a0 + 3.6 + k * 0.5)} />
      ))}
      {[
        { text: 'tạo đơn', at: a1 + 0.4, color: INK.good },
        { text: 'trừ tiền', at: a1 + 1.8, color: INK.good },
        { text: failed ? 'hết hàng' : 'giữ hàng', at: failed ? a2 + 0.3 : a1 + 2.6, color: failed ? INK.bad : INK.accent },
      ].map((p, k) => (
        <Pill key={k} x={sgC(k)} y={760} text={p.text} color={p.color} size={34} o={vis(t, p.at)} />
      ))}
      {[
        { text: '↩ huỷ đơn', at: a3 + 3.2, k: 0 },
        { text: '↩ hoàn tiền', at: a3 + 1.2, k: 1 },
      ].map((p) => (
        <Pill key={p.k} x={sgC(p.k)} y={840} text={p.text} color={INK.warn} size={34} o={vis(t, p.at)} />
      ))}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 5. choreography vs orchestration */

const CH = { cardW: 250, cardH: 110, xs: [70, 360, 650], y: 320 }
const cc = (k: number) => CH.xs[k] + CH.cardW / 2
const BUS = { y: 610, x0: 70, x1: 900 }
const OR = { xs: [1010, 1300, 1590], y: 640 }
const oc = (k: number) => OR.xs[k] + CH.cardW / 2

function orchestra(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const names = ['Đơn hàng', 'Thanh toán', 'Kho']
  const svc = (x: number, y: number, name: string, at: number, accent?: string) => (
    <Rise t={t} at={at}>
      <div style={{ ...panel, left: x, top: y, width: CH.cardW, height: CH.cardH, boxSizing: 'border-box', padding: 0, display: 'grid', placeItems: 'center', fontSize: 30, fontWeight: 800, background: HERO, border: 'none', color: '#fff', ...(accent ? { boxShadow: `0 0 28px ${accent}` } : {}) }}>{name}</div>
    </Rise>
  )
  // choreography chain: A emits, B listens, B emits, C listens
  const chain = [
    { from: { x: cc(0) - 30, y: CH.y + CH.cardH }, to: { x: cc(0) - 30, y: BUS.y }, at: a0 + 1.4, color: INK.accent },
    { from: { x: cc(1) + 30, y: BUS.y }, to: { x: cc(1) + 30, y: CH.y + CH.cardH }, at: a0 + 2.2, color: INK.good },
    { from: { x: cc(1) - 30, y: CH.y + CH.cardH }, to: { x: cc(1) - 30, y: BUS.y }, at: a0 + 3.0, color: INK.accent },
    { from: { x: cc(2) + 30, y: BUS.y }, to: { x: cc(2) + 30, y: CH.y + CH.cardH }, at: a0 + 3.8, color: INK.good },
  ]
  const orchBottom = { x: 1425, y: 430 }
  const cmd = [a2 + 0.6, a2 + 1.9, a2 + 3.2]
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE]])} title={{ kicker: 'SAGA', text: 'Hai cách tổ chức', until: a0 + 1.2 }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${475 * (1 - move(t, a2 - 0.3, 0.9))}px, ${70 * (1 - move(t, a1, 0.9))}px)` }}>
      <Pill x={495} y={230} text="choreography" color={INK.accent} size={34} o={vis(t, a0 + 0.2)} />
      {names.map((n, k) => <Fragment key={n}>{svc(CH.xs[k], CH.y, n, a0 + 0.4 + k * 0.3)}</Fragment>)}
      <Rise t={t} at={a0 + 1.0}>
        <div style={{ ...panel, left: BUS.x0, top: BUS.y, width: BUS.x1 - BUS.x0, height: 64, boxSizing: 'border-box', padding: 0, display: 'grid', placeItems: 'center', fontSize: 34, fontWeight: 700, color: INK.faint }}>topic sự kiện</div>
      </Rise>
      {chain.map((w, i) => (
        <div key={i}>
          <Wire from={w.from} to={w.to} color={w.color} p={move(t, w.at, 0.4)} flow={t} />
          <Packets t={t} from={w.from} to={w.to} start={w.at + 0.4} every={0.8} len={0.6} color={w.color} size={20} />
        </div>
      ))}
      <Icon3D name="puzzle" x={495} y={800} size={130} t={t} at={a1 + 0.3} />
      <Pill x={495} y={915} text="đơn đang ở bước nào?" color={INK.warn} size={30} o={vis(t, a1 + 1.4, a3 + 3.6)} />
      <Pill x={495} y={915} text="hợp 2–3 bước" color={INK.good} size={30} o={vis(t, a3 + 4.2)} />
      </div>
      <div style={{ position: 'absolute', left: 959, top: 200, width: 2, height: 760, background: 'rgba(110,160,255,0.25)', opacity: vis(t, a2) }} />
      <Pill x={1425} y={230} text="orchestration" color={INK.good} size={34} o={vis(t, a2 + 0.2)} />
      <Rise t={t} at={a2 + 0.3}>
        <div style={{ ...panel, left: 1235, top: 300, width: 380, height: 130, boxSizing: 'border-box', padding: 0, display: 'grid', placeItems: 'center', fontSize: 34, fontWeight: 800, background: HERO, border: 'none', color: '#fff', boxShadow: '0 0 34px rgba(77,141,255,0.7)' }}>Orchestrator</div>
      </Rise>
      {names.map((n, k) => <Fragment key={n}>{svc(OR.xs[k], OR.y, n, a2 + 0.5 + k * 0.2)}</Fragment>)}
      {[0, 1, 2].map((k) => {
        const down = { from: { x: orchBottom.x + (k - 1) * 70 - 15, y: orchBottom.y }, to: { x: oc(k) - 25, y: OR.y } }
        const up = { from: { x: oc(k) + 25, y: OR.y }, to: { x: orchBottom.x + (k - 1) * 70 + 15, y: orchBottom.y } }
        return (
          <div key={k}>
            <Wire from={down.from} to={down.to} color={INK.accent} p={move(t, cmd[k], 0.4)} flow={t} />
            <Packets t={t} from={down.from} to={down.to} start={cmd[k] + 0.4} every={1.2} len={0.6} size={20} />
            <Wire from={up.from} to={up.to} color={INK.good} p={move(t, cmd[k] + 0.7, 0.4)} flow={t} />
            <Packets t={t} from={up.from} to={up.to} start={cmd[k] + 1.1} every={1.2} len={0.6} color={INK.good} size={20} />
          </div>
        )
      })}
      <Pill x={1425} y={830} text="luồng nằm một chỗ" color={INK.good} size={30} o={vis(t, a3 + 0.3)} />
      <Pill x={1425} y={915} text="+ 1 thành phần phải vận hành" color={INK.warn} size={30} o={vis(t, a3 + 2.4)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 6. when NOT to use Kafka */

function notKafka(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const yK = lerp(540, 250, move(t, a1, 0.8))
  const rows: { icon: Icon3DName; need: string; answer: string; at: number; every: number; both?: boolean }[] = [
    { icon: 'chat', need: 'Hỏi và chờ trả lời ngay', answer: 'HTTP · gRPC', at: a1 + 0.3, every: 0.6, both: true },
    { icon: 'notebook', need: 'Vài trăm tin/ngày · team 2 người', answer: 'Bảng job trong DB', at: a2 + 0.7, every: 1.4 },
    { icon: 'bell', need: 'Ack từng tin · ưu tiên · hẹn giờ', answer: 'RabbitMQ · SQS', at: a3 + 0.7, every: 0.5 },
  ]
  const answerAt = [a1 + 4.0, a2 + 2.7, a3 + 1.4]
  // the stack of rows is centred in the lower area and re-spaces smoothly whenever a row joins
  const m2 = move(t, a2 - 0.2, 0.6)
  const m3 = move(t, a3 - 0.2, 0.6)
  const rowY = [730 - 85 * m2 - 85 * m3, 815 - 85 * m3, 900]
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE]])} title={{ kicker: 'ĐÚNG CÔNG CỤ', text: 'Không cần Kafka', until: a0 + 1.2 }}>
      <Rise t={t} at={0.4}>
        <ServerUnit x={260} y={yK - 90} name="Kafka" t={t} />
      </Rise>
      <Packets t={t} from={{ x: 560, y: yK - 25 }} to={{ x: 1560, y: yK - 25 }} start={0.9} every={0.11} len={1.1} size={34} />
      {['nhiều', 'xa', 'bền'].map((p, k) => (
        <Pill key={p} x={760 + k * 260} y={yK + 100} text={p} color={INK.accent} size={34} o={vis(t, a0 + 1.8 + k * 0.9)} />
      ))}
      {/* metaphor: Kafka is a wide truck lane with a flood of packets; a small lane carries only a few */}
      <div style={{ position: 'absolute', left: 540, top: yK - 25 - 46, width: 1040, height: 92, borderRadius: 24, background: 'rgba(77,141,255,0.14)', border: '1.5px solid rgba(110,160,255,0.4)', opacity: vis(t, a0 + 2.6, a1 + 0.3, 0.4) }} />
      <Pill x={1050} y={yK - 130} text="xe tải · hàng triệu tin" color={INK.accent} size={34} o={vis(t, a0 + 3.3, a1 + 0.3, 0.4)} />
      <div style={{ opacity: vis(t, a0 + 4.2, a1 + 0.3, 0.4) }}>
        <div style={{ position: 'absolute', left: 540, top: yK + 290 - 20, width: 1040, height: 40, borderRadius: 14, background: 'rgba(110,160,255,0.08)', border: '1.5px dashed rgba(110,160,255,0.35)' }} />
        <Packets t={t} from={{ x: 560, y: yK + 290 }} to={{ x: 1560, y: yK + 290 }} start={a0 + 4.4} every={1.1} len={1.6} size={22} color={INK.warn} />
        <Pill x={1050} y={yK + 365} text="xe máy · vài tin" color={INK.warn} size={34} />
      </div>
      <Icon3D name="rocket" x={1700} y={yK - 25} size={190} t={t} at={a0 + 0.8} />
      {rows.map((r, i) => {
        const y = rowY[i]
        const wf = { x: 1030, y: y - 14 }
        const wt = { x: 1250, y: y - 14 }
        return (
          <div key={r.icon}>
            <Rise t={t} at={r.at}>
              <div style={{ ...panel, left: 270, top: y - 59, width: 740, height: 118, boxSizing: 'border-box', display: 'flex', alignItems: 'center', fontSize: 32 }}>{r.need}</div>
            </Rise>
            <Icon3D name={r.icon} x={170} y={y} size={110} t={t} at={r.at} />
            <Wire from={wf} to={wt} color={INK.line} p={move(t, r.at + 0.7, 0.4)} flow={t} />
            <Packets t={t} from={wf} to={wt} start={r.at + 1.1} every={r.every} len={0.7} size={18} />
            {r.both && <Wire from={{ x: 1250, y: y + 18 }} to={{ x: 1030, y: y + 18 }} color={INK.good} p={move(t, r.at + 0.7, 0.4)} flow={t} />}
            {r.both && <Packets t={t} from={{ x: 1250, y: y + 18 }} to={{ x: 1030, y: y + 18 }} start={r.at + 1.4} every={r.every} len={0.7} color={INK.good} size={18} />}
            <Rise t={t} at={answerAt[i]}>
              <div style={{ position: 'absolute', left: 1280, top: y - 45, width: 540, height: 90, borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: 34, fontWeight: 800, color: '#fff', background: HERO, boxShadow: '0 0 28px rgba(77,141,255,0.65)' }}>{r.answer}</div>
            </Rise>
          </div>
        )
      })}
      <Pill x={1140} y={rowY[0] - 64} text="còn hàng?" color={INK.accent} size={26} o={vis(t, a1 + 2.4)} />
      <Pill x={1140} y={rowY[0] + 68} text="còn 5" color={INK.good} size={26} o={vis(t, a1 + 3.2)} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 7. summary */

function summary(t: number, c: Cue) {
  return (
    <SoftTheme>
      <SummaryList t={t} cue={c} items={['Đứng thử lại tin độc → cả partition kẹt', 'Retry topic + DLQ: đi tiếp, đổi lại mất thứ tự', 'Saga: bước bù thay rollback', 'Không cần replay, nhiều consumer: đừng dùng Kafka']} />
    </SoftTheme>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { hook, retry, order, dlq, saga, orchestra, notkafka: notKafka, summary }

/** Key-moment sounds, timed to the same cue offsets the scenes animate on. */
const SFX: Record<string, SceneSfx[]> = {
  hook: [{ kind: 'error', at: (c) => c.at(1) + 0.3 }],
  retry: [
    { kind: 'error', at: (c) => c.at(0) + 1.0 },
    { kind: 'error', at: (c) => c.at(1) + 3.0 },
    { kind: 'error', at: (c) => c.at(2) + 3.2 },
  ],
  order: [
    { kind: 'error', at: (c) => c.at(0) + 1.9 },
    { kind: 'error', at: (c) => c.at(2) + 1.1 },
  ],
  dlq: [{ kind: 'ding', at: (c) => c.at(2) + 2.0 }],
  saga: [
    { kind: 'ding', at: (c) => c.at(1) + 1.8 },
    { kind: 'error', at: (c) => c.at(2) + 0.3 },
  ],
}

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const retrySagaLesson: Lesson = {
  ...retrySagaScript,
  scenes: retrySagaScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id], sfx: SFX[s.id] })),
  intro: [
    { kind: 'video', scenes: ['hook'] },
    {
      kind: 'quiz',
      title: 'Quick Quiz',
      questions: [q('Đoán trước khi học: consumer đọc từng tin theo thứ tự, gặp một tin JSON hỏng và retry vô hạn tại chỗ. Chuyện gì xảy ra với các tin phía sau?', ['Vẫn được xử lý bình thường', 'Bị kẹt cho đến khi tin hỏng qua được, mà tin hỏng thì không bao giờ qua', 'Tự chuyển sang partition khác', 'Kafka tự bỏ qua tin hỏng'], 1, 'Offset là một dấu trang duy nhất cho cả partition: không qua được tin hỏng thì không đi tiếp được.')],
    },
  ],
  roadmap: [
    'Chặng 1: Tin độc chặn partition thế nào, retry topic và DLQ giải quyết ra sao, và cái giá là thứ tự.',
    'Chặng 2: Saga thay giao dịch phân tán bằng chuỗi bước và bước bù; choreography so với orchestration.',
    'Chặng 3: Những lúc Kafka không phải công cụ đúng.',
  ],
  sections: [
    {
      id: 'retry-dlq',
      title: 'Retry topic và DLQ',
      blocks: [
        { kind: 'p', text: 'Consumer gặp tin **không xử lý được** có hai loại lý do: **lỗi tạm thời** (DB quá tải, API đối tác timeout; thử lại sau vài giây thường được) và **poison message** (JSON hỏng, `amount = "abc"`; thử lại 1.000 lần vẫn hỏng).' },
        { kind: 'video', scenes: ['retry'] },
        {
          kind: 'table',
          head: ['', 'Blocking retry', 'Non-blocking (retry topic)'],
          rows: [
            ['Thứ tự trong partition', 'giữ nguyên', '**mất** cho các tin bị retry'],
            ['Một tin độc', 'kẹt cả partition', 'chỉ tin đó bị tách ra'],
            ['Hợp với', 'lỗi tạm thời ngắn, thứ tự bắt buộc', 'tin độc lập, hoặc có cơ chế giữ thứ tự theo key'],
          ],
        },
        { kind: 'callout', tone: 'info', title: 'Vì sao không "bỏ qua tin lỗi, quay lại sau"?', text: 'Consumer chỉ commit **một vị trí** cho cả partition. Tin #30 lỗi, tin #31 xong mà commit vượt qua #31 thì Kafka coi **mọi tin tới #31, kể cả #30**, là đã xử lý. Blocking retry đúng cách: commit tới tin thành công cuối liền mạch, giữ tin chưa xong trong bộ đệm, `pause()` để `poll()` không trả thêm tin và vẫn gọi `poll()` đều để không bị đá khỏi group. (📘 sách, ch.7)' },
        {
          kind: 'code',
          code: 'orders ──(lỗi)──► orders.retry.1 ──(chờ 30s, lỗi)──► orders.retry.2 ──(chờ 5 phút, lỗi)──► orders.dlq\n   │                     │                                  │                                │\n   ▼ ok                  ▼ ok                               ▼ ok                             ▼\n xử lý xong          xử lý xong                         xử lý xong                 người xem + sửa tay,\n                                                                                   rồi "phát lại"',
        },
        {
          kind: 'list',
          items: [
            { text: 'Consumer chính lỗi → **chép tin sang retry topic** (kèm header: số lần thử, lỗi gì, topic gốc), **commit và đi tiếp**.' },
            { text: 'Consumer của retry topic chỉ xử lý khi **đủ thời gian chờ** kể từ timestamp của tin (chưa đủ thì `pause` partition). Kafka **không có** "giao tin trễ" sẵn.' },
            { text: 'Hết số lần thử → **DLQ**: nơi tin "chết", chờ người điều tra. (📘 sách, ch.7)' },
          ],
        },
        { kind: 'video', scenes: ['order'] },
        { kind: 'callout', tone: 'warn', title: 'Cái giá: mất thứ tự', text: '`OrderPlaced` của `order-3` hỏng và vào retry, nhưng `OrderPaid` của `order-3` ngay sau nó vẫn được xử lý ở topic chính → **thanh toán chạy trước khi đơn tồn tại**. Giữ thứ tự mà vẫn non-blocking: khi một key đang có tin trong retry, các tin sau **cùng key** cũng phải vào retry; các key khác vẫn chạy. Cần lưu "key nào đang bị treo", phức tạp hơn nhiều.' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Lỗi "JSON không parse được" nên xử lý thế nào?', ['Retry 1.000 lần', 'Đi thẳng DLQ', 'Bỏ qua, commit luôn', 'Restart consumer'], 1, 'Đó là lỗi xác định: dữ liệu sai thì lúc nào thử cũng sai, retry chỉ tốn thời gian.'),
            q('Tin #30 ghi DB lỗi (DB tạm sập), #31 thành công. Đồng nghiệp commit vị trí sau #31. Hỏng gì?', ['Không hỏng gì', 'Mất tin #30 vì offset là một dấu trang duy nhất', 'Tin #31 bị xử lý hai lần', 'Consumer bị đá khỏi group'], 1, 'Commit vượt qua #31 nghĩa là mọi tin tới #31, kể cả #30, đã xong. Khởi động lại sẽ đọc từ #32.'),
          ],
        },
        { kind: 'video', scenes: ['dlq'] },
        {
          kind: 'list',
          items: [
            { title: 'Header đủ thông tin', text: 'topic gốc, partition, offset, lỗi gì, số lần thử.' },
            { title: 'Có người và quy trình', text: 'ai xem, xem khi nào, sửa gì, phát lại về đâu.' },
            { title: 'Retry cũng phải idempotent', text: 'tin chép sang retry xong, chết trước khi commit → có thể **trùng**.' },
          ],
        },
        { kind: 'callout', tone: 'tip', title: '🎓 Nâng cao', text: 'Spring Kafka có sẵn `@RetryableTopic` (tạo topic retry/DLT và cơ chế chờ). Kafka Connect có `errors.tolerance=all` + `errors.deadletterqueue.topic.name` cho DLQ của sink connector.' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Với sự kiện ví tiền (nạp, rút theo userId), lập luận nào hợp lý nhất?', ['Non-blocking thuần: nhanh nhất', 'Blocking có giới hạn, hoặc non-blocking giữ thứ tự theo key, vì thứ tự nạp/rút quyết định số dư', 'Bỏ qua tin lỗi', 'Không cần retry'], 1, 'Poison vẫn vào DLQ và dừng các tin sau của cùng user cho tới khi xử lý xong.')],
        },
      ],
    },
    {
      id: 'saga',
      title: 'Saga: choreography và orchestration',
      blocks: [
        { kind: 'video', scenes: ['saga'] },
        { kind: 'p', text: '**Saga** = chuỗi giao dịch **cục bộ**, mỗi bước có một **bước bù (compensation)** để huỷ tác dụng nếu bước sau thất bại: trừ tiền ↔ hoàn tiền; giữ hàng ↔ nhả hàng. Hệ thống **tạm thời** không nhất quán.' },
        { kind: 'video', scenes: ['orchestra'] },
        {
          kind: 'table',
          head: ['', 'Choreography', 'Orchestration'],
          rows: [
            ['Cách chạy', 'mỗi service nghe sự kiện và tự phản ứng', 'một **orchestrator** gửi command, chờ trả lời, quyết bước tiếp hoặc bù'],
            ['Ưu', 'không có điểm trung tâm, ít code ban đầu', 'luồng ở một chỗ, dễ đọc, dễ theo dõi'],
            ['Nhược', 'luồng rải khắp nơi, khó biết "đơn đang ở bước nào"', 'thêm một thành phần phải vận hành'],
            ['Hợp với', '2–3 bước đơn giản', 'nhiều bước, nhiều nhánh bù'],
          ],
        },
        {
          kind: 'list',
          items: [
            { text: 'Mỗi bước gửi sự kiện/command vẫn cần **outbox** (bài trước) và mỗi bên nhận vẫn cần **idempotent**; bước bù cũng vậy, vì lệnh "hoàn 250.000 đồng" nhận hai lần sẽ hoàn 500.000.' },
            { text: 'Orchestrator gửi command bằng **Kafka transaction**: đừng gửi rồi **chờ trả lời trước khi commit**. Bên kia (`read_committed`) chỉ thấy command sau khi commit, hai bên chờ nhau mãi: deadlock. (📘 sách, ch.8)' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Vì sao saga không "rollback" như giao dịch DB mà phải dùng bước bù?', ['Vì Kafka cấm rollback', 'Vì mỗi bước đã commit và có thể đã có tác động ra ngoài; chỉ có thể làm một hành động mới ngược lại', 'Vì rollback chậm', 'Vì saga chỉ có hai bước'], 1, 'Tiền đã trừ, email đã gửi: không có cơ chế chung quay lại, chỉ có hành động ngược (hoàn tiền).'),
            q('Quy trình 6 bước, nhiều nhánh bù. Chọn kiểu nào?', ['Choreography', 'Orchestration', 'Không cần saga', 'Cả hai đều tệ'], 1, 'Nhiều bước, nhiều nhánh bù: để luồng ở một chỗ cho dễ đọc và theo dõi.'),
          ],
        },
      ],
    },
    {
      id: 'khong-kafka',
      title: 'Khi nào KHÔNG nên dùng Kafka',
      blocks: [
        { kind: 'video', scenes: ['notkafka'] },
        {
          kind: 'table',
          head: ['Nhu cầu', 'Vì sao Kafka không hợp', 'Thay bằng'],
          rows: [
            ['Gọi và **chờ trả lời ngay**', 'luồng một chiều; request/reply phải tự ghép cặp, tăng độ trễ', 'HTTP/gRPC'],
            ['Vài trăm tin/ngày, team 2 người', 'vận hành cluster tốn hơn giá trị nhận được', 'bảng job trong DB, Redis, SQS/RabbitMQ'],
            ['Hàng đợi cần **ack từng tin, ưu tiên, hẹn giờ giao**', 'Kafka commit theo offset, không có priority hay delayed delivery sẵn', 'RabbitMQ, SQS (Kafka 4.x có share groups, KIP-932: kiểm tra ở phiên bản bạn dùng)'],
            ['**Truy vấn tuỳ ý**', 'log chỉ đọc tuần tự theo offset, không có index theo nội dung', 'DB, Elasticsearch (nạp **từ** Kafka)'],
            ['Gửi **file lớn**', 'giới hạn mặc định khoảng 1MB/tin; tin to làm chậm cả partition', 'lưu file ở S3, gửi **đường dẫn** qua Kafka'],
          ],
        },
        { kind: 'callout', tone: 'info', title: 'Kafka mạnh ở đâu', text: 'Luồng sự kiện lớn, nhiều consumer độc lập, cần đọc lại (replay), cần giữ lâu. Nếu không cần những thứ đó, chi phí vận hành thường lớn hơn lợi ích.' },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Startup 3 người, 500 đơn/ngày, chỉ cần gửi email xác nhận sau khi đặt hàng. Có nên dựng Kafka?', ['Có, để sẵn cho tương lai', 'Thường không: một bảng job trong DB hiện có là đủ, không thêm hệ thống phải vận hành', 'Có, vì email cần exactly-once', 'Phải dùng ít nhất 3 broker'], 1, 'Không cần replay hay nhiều consumer độc lập.')],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: blocking hay retry topic?',
      blocks: [
        { kind: 'p', text: 'Chọn kiểu retry, tin nào lỗi và lỗi bao nhiêu lần. Xem các tin phía sau bị kẹt hay trễ bao lâu, tin lỗi đi qua retry-5s, retry-1m hay vào DLQ, và thứ tự cùng key có bị đảo không.' },
        { kind: 'widget', name: 'retry-lab' },
      ],
    },
    {
      id: 'tom-tat-video',
      title: 'Nhìn lại cả bài',
      blocks: [{ kind: 'video', scenes: ['summary'] }],
    },
  ],
  finalQuiz: [
    q('Blocking retry vô hạn một poison message trên partition có 10.000 tin phía sau, producer ghi thêm 100 tin/phút. Lag sau 1 giờ?', ['Khoảng 0', 'Khoảng 6.000', 'Khoảng 16.000 và còn tăng', 'Khoảng 10.000 và đứng yên'], 2, '10.000 + 100 × 60. Offset không bao giờ dời nên lag tăng mãi.'),
    q('Retry topic giữ cho partition khỏi kẹt, nhưng đổi lại điều gì?', ['Mất tin', 'Mất thứ tự của các tin bị retry', 'Tin bị nhân đôi chắc chắn', 'Phải dùng transaction'], 1, 'OrderPaid có thể chạy trước OrderPlaced của chính đơn đó.'),
    q('Tin trong DLQ thiếu gì thì gần như vô dụng?', ['Schema', 'Header: topic gốc, offset, lỗi, số lần thử, và người/quy trình xử lý', 'Key', 'Timestamp tương lai'], 1, 'DLQ không ai nhìn là thùng rác có giấy phép.'),
    q('Saga khác giao dịch DB ở điểm nào?', ['Không có điểm khác', 'Chuỗi giao dịch cục bộ, huỷ bằng bước bù thay vì rollback, và tạm thời không nhất quán', 'Chạy nhanh hơn', 'Chỉ chạy trên một service'], 1, 'Mỗi bước đã commit nên chỉ có thể bù bằng hành động ngược.'),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao không thể "bỏ qua tin lỗi, xử lý tin sau, quay lại sau" ngay trong một partition?',
      keywords: ['offset', 'commit', 'vị trí', 'partition'],
      modelAnswer: 'Vì consumer chỉ commit một vị trí duy nhất cho cả partition, không ack từng tin. Nếu tin #30 lỗi mà ta xử lý và commit qua #31 thì Kafka coi mọi tin tới #31, kể cả #30, là đã xong; khởi động lại sẽ đọc từ #32 và #30 không bao giờ được thử lại. Muốn đi tiếp phải chép #30 sang retry topic rồi mới commit qua nó.',
    },
  ],
  recap: {
    journey:
      'Một tin độc làm cả partition kẹt → chép tin lỗi sang retry-5s, retry-1m rồi DLQ để topic chính đi tiếp → đổi lại mất thứ tự, nên cần blocking hoặc giữ thứ tự theo key → DLQ phải có header và người xem → saga thay rollback bằng bước bù, theo kiểu choreography hoặc orchestration → và có những lúc Kafka không phải công cụ đúng.',
    points: [
      { title: 'Tin độc', text: 'Blocking retry vô hạn một poison message làm kẹt cả partition; lỗi xác định đi thẳng DLQ.' },
      { title: 'Retry topic + DLQ', text: 'Non-blocking giữ partition chạy, đổi lại mất thứ tự các tin bị retry; DLQ cần header đủ và người xem.' },
      { title: 'Saga', text: 'Chuỗi giao dịch cục bộ với bước bù idempotent; choreography cho 2–3 bước, orchestration cho nhiều bước.' },
      { title: 'Không dùng Kafka', text: 'Request/response, lượng tin nhỏ, ack từng tin, truy vấn tuỳ ý, file lớn: có công cụ hợp hơn.' },
    ],
    next: 'Capstone: hệ thống đặt hàng (Module 11).',
  },
}
