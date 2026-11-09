import {
  At,
  Burst,
  DataCard,
  Stream,
  type LogBlock,
  Kinetic,
  MsgChip,
  NEON,
  NeonCard,
  Pill,
  Scene,
  SummaryGrid,
  TitleCard,
  cameraAt,
  clamp,
  glow,
  lerp,
  move,
  sp,
  span,
  vis,
  type Neon,
} from '../player/motion-kit'
import type { Cue, Lesson, Scene as LessonScene } from '../player/types'
import { INK, LogTape, Note, ServerUnit, Wire, type CellState } from '../player/schematic'
import { MONO } from '../remotion/video-fonts'
import { acksIdempotenceScript } from './acks-idempotence-script'

/** A chip travelling from a to b during [at, at+len], with a small arc. */
function Flying({ t, at, len = 0.7, from, to, label, tone = 'sky', stopAt }: { t: number; at: number; len?: number; from: { x: number; y: number }; to: { x: number; y: number }; label: string; tone?: Neon; stopAt?: number }) {
  if (t < at) return null
  const raw = move(t, at, len)
  const p = stopAt === undefined ? raw : Math.min(raw, stopAt)
  if (raw >= 1 && stopAt === undefined) return null
  return <MsgChip x={lerp(from.x, to.x, p)} y={lerp(from.y, to.y, p) - Math.sin(Math.PI * p) * 60} label={label} tone={tone} />
}

/* ------------------------------------------------------------------ 0. cold open */

const ROW = { p: { x: 370, y: 560 }, l: { x: 960, y: 560 }, f: { x: 1550, y: 560 } }
const blocks = (n: number, tone?: Neon) => Array.from({ length: n }, () => ({ tone }))

function hook(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const { p: P, l: L, f: F } = ROW
  const sent = Math.round(100 * span(t, a0 + 0.3, a0 + 2.3))
  const acked = t >= a0 + 2.4
  const dead = t >= a1 + 0.4
  const promoted = t >= a1 + 2.2
  const cam = cameraAt(t, [
    [0, { x: 960, y: 540, s: 1.08, rx: 12 }],
    [a0 + 0.4, { x: 960, y: 560, s: 0.95 }, 1.8],
    [a1 + 0.2, { x: 1080, y: 560, s: 0.97, ry: -4 }, 1.1],
    [a2 + 0.2, { x: 960, y: 560, s: 0.93 }, 1.2],
  ])
  return (
    <Scene
      t={t}
      camera={cam}
      overlay={
        <At x={960} y={985} style={{ opacity: vis(t, a2 + 0.6), padding: '12px 40px', borderRadius: 24, background: 'rgba(5,7,15,0.9)' }}>
          <Kinetic t={t} at={a2 + 0.6} text="đã OK rồi… mà vẫn mất?" size={84} color="#fde68a" glowColor={NEON.amber} />
        </At>
      }
    >
      <DataCard x={P.x} y={P.y} t={t} header="app · producer" value={String(sent)} unit="tin" role="producer" footer={acked ? 'đã nhận OK ✓' : 'đang gửi…'} o={sp(t, 0.1)} />
      <DataCard x={L.x} y={L.y} t={t} header="broker-1 · payments-0" value={String(sent)} unit="tin" role={dead ? 'offline' : 'leader'} blocks={blocks(Math.round(sent / 10))} footer={dead ? 'broker đã chết' : 'ghi xong → trả OK'} o={sp(t, 0.3)} />
      <DataCard x={F.x} y={F.y} t={t} header="broker-2 · payments-0" value="0" unit="tin" role={promoted ? 'new-leader' : 'follower'} meter={promoted ? undefined : 0.04 * span(t, a0 + 1, a1)} meterLabel="đang chép từ leader" footer={promoted ? '100 tin đã OK → mất' : undefined} o={sp(t, 0.5)} />
      <Stream t={t} from={{ x: P.x + 230, y: P.y }} to={{ x: L.x - 230, y: L.y }} start={a0 + 0.3} end={a0 + 2.2} every={0.12} />
      <Stream t={t} from={{ x: L.x - 230, y: L.y + 120 }} to={{ x: P.x + 230, y: P.y + 120 }} start={a0 + 0.8} end={a0 + 2.6} every={0.2} tone="green" arc={-40} />
      <At x={F.x} y={F.y}>
        <Burst t={t} at={a1 + 2.2} tone="amber" r={260} />
      </At>
      <At x={L.x} y={L.y}>
        <Burst t={t} at={a1 + 0.4} tone="red" r={260} />
      </At>
    </Scene>
  )
}

/* ------------------------------------------------------------------ 1. three levels */

/**
 * Producer → Leader → Follower chain with a message looping along it; the "OK" lights up at the node the
 * producer waits for (0 = producer itself, 1 = leader, 2 = follower).
 */
function WaitChain({ t, at, wait, tone }: { t: number; at: number; wait: 0 | 1 | 2; tone: Neon }) {
  const nodes = ['P', 'L', 'F']
  const NX = (i: number) => 40 + i * 160
  const phase = t < at + 0.4 ? -1 : ((t - at - 0.4) % 2.2) / 1.6
  const pos = clamp(phase) * 2
  const okOn = phase >= 0 && pos >= wait && phase < 1.3
  return (
    <div style={{ position: 'relative', height: 120, marginTop: 30 }}>
      <div style={{ position: 'absolute', left: NX(0) + 35, width: 320, top: 33, height: 6, borderRadius: 3, background: '#334155' }} />
      {nodes.map((n, i) => {
        const lit = i <= wait && phase >= 0 && pos >= i
        return (
          <div key={n} style={{ position: 'absolute', left: NX(i), top: 0, width: 72, height: 72, borderRadius: 36, display: 'grid', placeItems: 'center', fontSize: 30, fontWeight: 900, background: '#151922', border: `4px solid ${lit ? NEON[tone] : '#475569'}`, color: lit ? '#fff' : '#94a3b8', boxShadow: lit ? glow(NEON[tone], 0.6) : undefined }}>
            {n}
          </div>
        )
      })}
      {phase >= 0 && phase < 1 && <MsgChip x={NX(0) + 36 + pos * 160} y={36} />}
      <div style={{ position: 'absolute', left: NX(wait) - 4, top: 84, width: 80, textAlign: 'center', fontSize: 24, fontWeight: 900, color: NEON.green, opacity: okOn ? 1 : 0.15 }}>OK ✓</div>
    </div>
  )
}

function levels(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const X = [400, 960, 1520]
  const cam = cameraAt(t, [
    [0, { x: 960, y: 560, s: 0.95, rx: 10 }],
    [a1 - 0.2, { x: X[0], y: 560, s: 1.2, ry: 6 }, 1.1],
    [a2 - 0.2, { x: X[1], y: 560, s: 1.2 }, 1.0],
    [a3 - 0.2, { x: X[2], y: 560, s: 1.2, ry: -6 }, 1.0],
    [c.end(3) - 1.2, { x: 960, y: 560, s: 0.92 }, 1.2],
  ])
  const cards: { k: string; title: string; sub: string; wait: 0 | 1 | 2; tone: Neon; at: number }[] = [
    { k: 'acks = 0', title: 'Không chờ', sub: 'nhanh nhất · không biết có tới không', wait: 0, tone: 'red', at: a1 - 0.2 },
    { k: 'acks = 1', title: 'Chờ leader', sub: 'leader ghi xong là OK', wait: 1, tone: 'amber', at: a2 - 0.2 },
    { k: 'acks = all', title: 'Chờ cả ISR', sub: 'leader + mọi bản sao đồng bộ', wait: 2, tone: 'green', at: a3 - 0.2 },
  ]
  return (
    <Scene t={t} camera={cam} overlay={<TitleCard t={t} at={a0} kicker="ACKS" title="Thế nào là gửi xong?" dock={a0 + 1.4} />}>
      {cards.map((cd, i) => (
        <div key={cd.k}>
          <NeonCard x={X[i]} y={560} w={500} h={460} kicker={cd.k.toUpperCase()} title={cd.title} sub={cd.sub} tone={cd.tone} strong={t >= cd.at && (i === 2 || t < (cards[i + 1]?.at ?? Infinity))} o={sp(t, cd.at)} titleSize={56}>
            <WaitChain t={t} at={cd.at} wait={cd.wait} tone={cd.tone} />
          </NeonCard>
        </div>
      ))}
      <At x={X[2]} y={290}>
        <Pill text="MẶC ĐỊNH từ Kafka 3.0" tone="green" size={32} o={sp(t, a3 + 2.0)} />
      </At>
    </Scene>
  )
}

/* ------------------------------------------------------------------ 2. how acks=1 loses data */

/* Schematic prototype: two log tapes (leader, follower), a replication cursor, and annotations. */
function lossSchematic(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const CELLS = 20
  const CW = 66
  const TAPE_X = 440
  const LY = 330
  const FY = 660
  const written = 10 + Math.floor(10 * span(t, a0 + 0.3, a0 + 2.0))
  const copied = 10 + 2.6 * span(t, a1 + 0.1, a1 + 1.2)
  const dead = t >= a1 + 1.2
  const promoted = t >= a2 + 0.4
  const okBack = move(t, a0 + 2.0, 0.5)
  const cx = (i: number) => TAPE_X + i * CW
  const leaderState = (i: number): CellState => (i < 10 ? (dead ? 'dead' : 'filled') : i < written ? (dead ? 'dead' : 'new') : 'empty')
  const followerState = (i: number): CellState => (i < Math.floor(copied) ? 'filled' : promoted && i < 20 ? 'missing' : 'empty')
  const cam = cameraAt(t, [
    [0, { x: 960, y: 540, s: 0.98 }],
    [a2 + 0.2, { x: 1000, y: 600, s: 1.05 }, 1.4],
    [a3, { x: 960, y: 560, s: 0.98 }, 1.2],
  ])
  return (
    <Scene t={t} camera={cam} backdrop="plain" overlay={<TitleCard t={t} at={0.1} kicker="ACKS = 1" title="Mất tin đã báo OK" tone="amber" dock={1.2} />}>
      <ServerUnit x={120} y={LY - 30} name={dead ? 'broker-1 ✕' : 'broker-1 leader'} down={dead} t={t} />
      <ServerUnit x={120} y={FY - 30} name={promoted ? 'broker-2 leader mới' : 'broker-2 follower'} accent={promoted ? INK.warn : INK.accent} t={t} />
      <LogTape x={TAPE_X} y={LY} cells={CELLS} cellW={CW} state={leaderState} offsetOf={(i) => i * 10} />
      <LogTape x={TAPE_X} y={FY} cells={CELLS} cellW={CW} state={followerState} offsetOf={(i) => i * 10} cursor={t >= a1 && !promoted ? copied : undefined} cursorLabel="đang chép" />
      <Wire from={{ x: cx(15), y: 200 }} to={{ x: cx(15), y: LY - 8 }} color={INK.accent} p={move(t, a0 + 0.2, 0.5)} />
      <div style={{ position: 'absolute', left: cx(15) - 130, top: 150, width: 260, textAlign: 'center', padding: '8px 0', border: `2px solid ${INK.line}`, borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 26, color: INK.text, background: INK.bg }}>app · acks=1</div>
      <div style={{ position: 'absolute', left: cx(15) + 30, top: 230, fontFamily: 'JetBrains Mono, monospace', fontSize: 28, fontWeight: 700, color: INK.good, opacity: okBack }}>↑ OK (đã xong?)</div>
      <Note x={cx(12)} y={FY + 35} dx={-60} dy={170} text="follower mới chép tới offset ~125" color={INK.warn} o={vis(t, a1 + 0.6, a2 + 0.3)} />
      <Note x={cx(15)} y={FY + 35} dx={-80} dy={170} text="offset 130–199 mất — dù đã báo OK" color={INK.bad} o={vis(t, a2 + 0.6, a3)} />
      <div style={{ position: 'absolute', left: TAPE_X, top: 860, fontSize: 40, fontWeight: 600, color: INK.good, opacity: vis(t, a3 + 0.4) }}>
        acks=all → chỉ trả OK khi follower đã chép tới offset 199
      </div>
    </Scene>
  )
}

// Previous card-based version, kept until the schematic style is approved.
export function lossCards(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const { p: P, l: L, f: F } = ROW
  const written = Math.round(100 + 100 * span(t, a0 + 0.3, a0 + 2.0))
  const copied = Math.round(100 + 25 * span(t, a1 + 0.2, a1 + 1.2))
  const dead = t >= a1 + 1.2
  const promoted = t >= a2 + 0.4
  const leaderBlocks = [...blocks(10), ...Array.from({ length: Math.round((written - 100) / 10) }, () => ({ tone: 'amber' as Neon }))]
  const followerBlocks = promoted ? [...blocks(10), ...blocks(10, 'red')] : [...blocks(10), ...blocks(Math.round((copied - 100) / 10), 'amber')]
  const cam = cameraAt(t, [
    [0, { x: 960, y: 560, s: 0.98, rx: 10 }],
    [a1 - 0.1, { x: 1060, y: 560, s: 0.97, ry: -4 }, 1.1],
    [a2 + 0.2, { x: 1120, y: 560, s: 0.98, ry: -5 }, 1.0],
    [a3, { x: 960, y: 560, s: 0.95 }, 1.2],
  ])
  return (
    <Scene
      t={t}
      camera={cam}
      overlay={
        <>
          <TitleCard t={t} at={0.1} kicker="ACKS = 1" title="Mất tin đã báo OK" tone="amber" dock={1.2} />
          <At x={960} y={985} style={{ opacity: vis(t, a3 + 0.4), padding: '12px 40px', borderRadius: 24, background: 'rgba(5,7,15,0.9)' }}>
            <Kinetic t={t} at={a3 + 0.5} text="acks=all: OK chỉ sau khi follower đã chép" size={58} color="#bbf7d0" glowColor={NEON.green} stagger={0.012} />
          </At>
        </>
      }
    >
      <DataCard x={P.x} y={P.y} t={t} header="app · acks=1" value={t >= a0 + 1.4 ? 'OK' : '…'} role="producer" footer={t >= a0 + 1.4 ? 'offset 100–199 xong ✓' : 'gửi offset 100–199'} o={sp(t, 0.2)} />
      <DataCard x={L.x} y={L.y} t={t} header="broker-1 · payments-0" value={String(written)} unit="tin" role={dead ? 'offline' : 'leader'} blocks={leaderBlocks} footer={dead ? 'chết trước khi chép xong' : 'ghi xong → OK ngay'} o={sp(t, 0.4)} />
      <DataCard
        x={F.x}
        y={F.y}
        t={t}
        header="broker-2 · payments-0"
        value={promoted ? '100' : String(copied)}
        unit="tin"
        role={promoted ? 'new-leader' : 'follower'}
        blocks={followerBlocks}
        footer={promoted ? 'offset 100–199 ✗ mất' : 'đang chép…'}
        o={sp(t, 0.6)}
      />
      <Stream t={t} from={{ x: P.x + 230, y: P.y }} to={{ x: L.x - 230, y: L.y }} start={a0 + 0.3} end={a0 + 1.9} every={0.15} />
      <Stream t={t} from={{ x: L.x - 230, y: L.y + 120 }} to={{ x: P.x + 230, y: P.y + 120 }} start={a0 + 1.0} end={a0 + 2.0} every={0.25} tone="green" arc={-40} />
      <Stream t={t} from={{ x: L.x + 230, y: L.y }} to={{ x: F.x - 230, y: F.y }} start={a1 + 0.2} end={a1 + 1.1} every={0.35} tone="amber" />
      <At x={L.x} y={L.y}>
        <Burst t={t} at={a1 + 1.2} tone="red" r={260} />
      </At>
      <At x={F.x} y={F.y}>
        <Burst t={t} at={a2 + 0.4} tone="red" r={260} />
      </At>
    </Scene>
  )
}

/* ------------------------------------------------------------------ 3. retry creates duplicates */

function duplicate(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const P = { x: 520, y: 560 }
  const B = { x: 1400, y: 560 }
  const written1 = t >= a0 + 1.0
  const written2 = t >= a2 + 1.0
  const log: LogBlock[] = [{ label: '#1 · đơn A' }, ...(written1 ? [{ label: '#2 · đơn B' }] : []), ...(written2 ? [{ label: '#2 · đơn B', tone: 'red' as Neon }] : [])]
  const okLost = t >= a1 + 1.0
  const cam = cameraAt(t, [
    [0, { x: 960, y: 560, s: 1.0, rx: 10 }],
    [a1 - 0.1, { x: 960, y: 540, s: 1.06 }, 1.0],
    [a2 + 0.6, { x: 1150, y: 580, s: 1.04, ry: -4 }, 1.1],
  ])
  return (
    <Scene
      t={t}
      camera={cam}
      overlay={
        <>
          <TitleCard t={t} at={0.1} kicker="RETRY" title="Một tin thành hai" tone="red" dock={1.2} />
          <At x={960} y={985} style={{ opacity: vis(t, a2 + 1.3), padding: '12px 40px', borderRadius: 24, background: 'rgba(5,7,15,0.9)' }}>
            <Kinetic t={t} at={a2 + 1.4} text="đơn B bị ghi 2 lần" size={80} color="#fecaca" glowColor={NEON.red} />
          </At>
        </>
      }
    >
      <DataCard x={P.x} y={P.y} t={t} w={500} header="app · producer" value="#2" unit="thùng" role="producer" footer={t >= a2 ? 'không thấy OK → gửi lại' : t >= a0 + 0.2 ? 'chờ trả lời…' : ''} o={sp(t, 0.2)} />
      <DataCard x={B.x} y={B.y} t={t} w={560} header="broker-1 · log payments-0" value={String(log.length)} unit="bản ghi" role={written2 ? 'error' : 'leader'} badge={written2 ? 'TRÙNG' : undefined} blocks={log} footer={written2 ? 'trùng ✗' : written1 ? 'đã ghi #2 → gửi OK' : ''} o={sp(t, 0.4)} />
      <Flying t={t} at={a0 + 0.2} from={{ x: P.x + 250, y: P.y - 40 }} to={{ x: B.x - 280, y: B.y - 40 }} label="#2" />
      <Flying t={t} at={a1 + 0.2} len={1.6} from={{ x: B.x - 280, y: B.y + 80 }} to={{ x: P.x + 250, y: P.y + 80 }} label="OK" tone="green" stopAt={0.5} />
      <At x={(P.x + B.x) / 2} y={P.y + 80} style={{ opacity: okLost ? 1 : 0 }}>
        <div style={{ width: 96, height: 96, borderRadius: 48, display: 'grid', placeItems: 'center', border: `5px solid ${NEON.red}`, color: NEON.red, fontSize: 60, fontWeight: 900, boxShadow: glow(NEON.red, 0.7), background: '#1b0d10' }}>✗</div>
      </At>
      <At x={(P.x + B.x) / 2} y={P.y + 190}>
        <Pill text="câu trả lời bị mất" tone="red" size={30} o={sp(t, a1 + 1.1)} />
      </At>
      <Flying t={t} at={a2 + 0.2} from={{ x: P.x + 250, y: P.y - 40 }} to={{ x: B.x - 280, y: B.y - 40 }} label="#2" tone="amber" />
      <At x={B.x} y={B.y}>
        <Burst t={t} at={a2 + 1.0} tone="red" r={300} />
      </At>
    </Scene>
  )
}

/* ------------------------------------------------------------------ 4. sequence numbers */

function sequence(t: number, c: Cue) {
  const [a0, a1, a2, a3] = [c.at(0), c.at(1), c.at(2), c.at(3)]
  const P = { x: 520, y: 540 }
  const B = { x: 1400, y: 540 }
  const got1 = t >= a0 + 1.4
  const got2 = t >= a0 + 2.6
  const last = got2 ? 317 : got1 ? 119 : null
  const batches: LogBlock[] = [
    { label: '0–119', tone: got1 ? 'green' : undefined },
    { label: '120–317', tone: got2 ? 'green' : undefined },
    { label: '318–515' },
    { label: '516–694', tone: t >= a3 + 1.0 ? 'red' : undefined },
  ]
  const stored: LogBlock[] = [...(got1 ? [{ label: '0–119', tone: 'green' as Neon }] : []), ...(got2 ? [{ label: '120–317', tone: 'green' as Neon }] : [])]
  const verdict = t >= a3 + 1.0 ? { text: '516 ≠ 318 → từ chối ✗', tone: 'red' as Neon } : t >= a2 + 1.0 ? { text: '120–317 ≤ 317 → đã có, bỏ qua ✓', tone: 'green' as Neon } : null
  const cam = cameraAt(t, [
    [0, { x: 960, y: 560, s: 1.0, rx: 10 }],
    [a1 - 0.1, { x: 1300, y: 540, s: 1.08, ry: -4 }, 1.0],
    [a2 - 0.1, { x: 960, y: 560, s: 0.98 }, 1.0],
  ])
  return (
    <Scene
      t={t}
      camera={cam}
      overlay={
        <>
          <TitleCard t={t} at={0.1} kicker="IDEMPOTENCE" title="Đánh số thùng" tone="green" dock={1.2} />
          {verdict && (
            <At x={960} y={985} style={{ padding: '12px 40px', borderRadius: 24, background: 'rgba(5,7,15,0.9)' }}>
              <div style={{ fontSize: 64, fontWeight: 900, fontFamily: MONO, whiteSpace: 'nowrap', color: verdict.tone === 'red' ? '#fecaca' : '#bbf7d0', textShadow: glow(NEON[verdict.tone], 0.7) }}>{verdict.text}</div>
            </At>
          )}
        </>
      }
    >
      <DataCard x={P.x} y={P.y} t={t} w={520} header="app · producer" value="16" unit="producerId" role="producer" blocks={batches} footer="mỗi thùng mang seq" o={sp(t, 0.2)} />
      <DataCard x={B.x} y={B.y} t={t} w={560} header="trí nhớ · producer 16 · P0" value={last === null ? '—' : String(last)} unit="seq cuối" role="leader" blocks={stored} footer={t >= a3 + 1.0 ? 'đang chờ 318' : t >= a1 ? 'nhớ seq cuối đã ghi' : ''} strong={t >= a1} o={sp(t, 0.4)} />
      <Flying t={t} at={a0 + 0.6} from={{ x: P.x + 260, y: P.y - 40 }} to={{ x: B.x - 280, y: B.y - 40 }} label="0–119" />
      <Flying t={t} at={a0 + 1.8} from={{ x: P.x + 260, y: P.y - 40 }} to={{ x: B.x - 280, y: B.y - 40 }} label="120–317" />
      <Flying t={t} at={a2 + 0.2} from={{ x: P.x + 260, y: P.y + 60 }} to={{ x: B.x - 280, y: B.y + 60 }} label="120–317 (lại)" tone="amber" />
      <Flying t={t} at={a3 + 0.2} from={{ x: P.x + 260, y: P.y + 60 }} to={{ x: B.x - 280, y: B.y + 60 }} label="516–694" tone="red" />
      <At x={B.x} y={B.y}>
        <Burst t={t} at={a2 + 1.0} tone="green" r={300} />
      </At>
      <At x={B.x} y={B.y}>
        <Burst t={t} at={a3 + 1.0} tone="red" r={300} />
      </At>
    </Scene>
  )
}

/* ------------------------------------------------------------------ 5. limits */

function limits(t: number, c: Cue) {
  const [a0, a1, a2] = [c.at(0), c.at(1), c.at(2)]
  const { p: A, l: B, f: C } = ROW
  const d2 = c.end(2) - a2
  // Each card is a mini broker log for "đơn B": how many copies end up stored in each situation.
  const at = { ok1: a1 + 0.3, ok2: a1 + 1.4, re1: a2 + 0.2, re2: a2 + d2 * 0.3, two1: a2 + d2 * 0.45, two2: a2 + d2 * 0.6 }
  const show = (k: keyof typeof at) => t >= at[k]
  const cards: { x: number; header: string; role: 'ok' | 'error'; badge: string; blocks: LogBlock[]; footer: string; o: number }[] = [
    {
      x: A.x,
      header: 'retry · 1 producer',
      role: 'ok',
      badge: 'CHỐNG ĐƯỢC',
      blocks: show('ok1') ? [{ label: 'đơn B · pid 16', tone: 'green' }] : [],
      footer: show('ok2') ? 'bản gửi lại bị bỏ qua ✓' : 'pid 16 gửi đơn B',
      o: sp(t, a1 - 0.2),
    },
    {
      x: B.x,
      header: 'restart app',
      role: 'error',
      badge: 'KHÔNG CHỐNG',
      blocks: [...(show('re1') ? [{ label: 'đơn B · pid 16' }] : []), ...(show('re2') ? [{ label: 'đơn B · pid 17', tone: 'red' as Neon }] : [])],
      footer: show('re2') ? 'pid mới → coi là khác' : 'trước khi restart',
      o: sp(t, a2),
    },
    {
      x: C.x,
      header: '2 producer',
      role: 'error',
      badge: 'KHÔNG CHỐNG',
      blocks: [...(show('two1') ? [{ label: 'đơn B · pid 16' }] : []), ...(show('two2') ? [{ label: 'đơn B · pid 22', tone: 'red' as Neon }] : [])],
      footer: show('two2') ? 'mỗi bên một pid' : 'instance A và B',
      o: sp(t, a2 + d2 * 0.4),
    },
  ]
  const cam = cameraAt(t, [
    [0, { x: 960, y: 560, s: 0.95, rx: 10 }],
    [a1 - 0.2, { x: 760, y: 560, s: 1.0, ry: 5 }, 1.0],
    [a2 - 0.2, { x: 960, y: 560, s: 0.93, ry: -3 }, 1.1],
  ])
  return (
    <Scene
      t={t}
      camera={cam}
      overlay={
        <>
          <TitleCard t={t} at={0.1} kicker="GIỚI HẠN" title="Idempotence chống được gì?" dock={1.2} />
          <At x={960} y={985} style={{ opacity: vis(t, c.end(2) - 1.2), padding: '12px 40px', borderRadius: 24, background: 'rgba(5,7,15,0.9)' }}>
            <Kinetic t={t} at={c.end(2) - 1.1} text="muốn hơn → transaction (Module 6)" size={60} color="#bfdbfe" glowColor={NEON.blue} stagger={0.015} />
          </At>
        </>
      }
    >
      <At x={960} y={260}>
        <Pill text="enable.idempotence=true mặc định từ 3.0 · cần acks=all" tone="sky" size={32} o={Math.min(sp(t, a0 + 0.6), vis(t, 0, a1 - 0.2))} style={{ fontFamily: MONO }} />
      </At>
      {cards.map((cd) => (
        <DataCard
          key={cd.header}
          x={cd.x}
          y={580}
          t={t}
          header={cd.header}
          value={String(cd.blocks.length)}
          unit="bản đơn B"
          role={cd.role}
          badge={cd.badge}
          blocks={cd.blocks}
          footer={cd.footer}
          o={cd.o}
        />
      ))}
      <Flying t={t} at={at.ok2 - 0.6} from={{ x: A.x, y: 300 }} to={{ x: A.x, y: 520 }} label="pid 16 · lại" tone="amber" />
      <At x={A.x} y={580}>
        <Burst t={t} at={at.ok2} tone="green" r={260} />
      </At>
      <At x={B.x} y={580}>
        <Burst t={t} at={at.re2} tone="red" r={260} />
      </At>
      <At x={C.x} y={580}>
        <Burst t={t} at={at.two2} tone="red" r={260} />
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
        { title: 'acks = khi nào xong', body: '0 không chờ · 1 leader · all cả ISR', tone: 'blue' },
        { title: 'acks=1 có thể mất', body: 'leader chết trước khi follower chép', tone: 'red' },
        { title: 'producerId + seq', body: 'broker bỏ thùng trùng, chặn thùng nhảy cóc', tone: 'green' },
        { title: 'Chỉ trong 1 phiên', body: 'restart / 2 producer → cần transaction', tone: 'amber' },
      ]}
    />
  )
}

const RENDERS: Record<string, LessonScene['render']> = { hook, levels, loss: lossSchematic, duplicate, sequence, limits, summary }

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const acksIdempotenceLesson: Lesson = {
  ...acksIdempotenceScript,
  scenes: acksIdempotenceScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id] })),
  intro: [
    { kind: 'video', scenes: ['hook'] },
    {
      kind: 'quiz',
      title: 'Quick Quiz',
      questions: [
        q('Đoán trước khi học: broker đã trả OK, vì sao tin vẫn có thể mất?', ['Vì consumer xoá tin', 'Vì OK chỉ có nghĩa leader đã ghi, bản sao chưa kịp chép', 'Vì tin bị nén', 'Vì retention quá ngắn'], 1, 'Đúng hướng. Phần 1–2 giải thích "OK" nghĩa là gì với từng mức acks.'),
      ],
    },
  ],
  roadmap: [
    'Chặng 1: Ba mức acks, và vì sao acks=1 có thể mất tin đã báo OK.',
    'Chặng 2: Retry để không mất — nhưng retry lại sinh trùng.',
    'Chặng 3: Idempotence đánh số thùng để retry an toàn, và giới hạn của nó.',
  ],
  sections: [
    {
      id: 'ba-muc-acks',
      title: 'Ba mức acks',
      blocks: [
        { kind: 'video', scenes: ['levels'] },
        {
          kind: 'table',
          head: ['`acks`', 'Producer coi là thành công khi', 'Hình ảnh bưu điện'],
          rows: [
            ['`0`', '**Không chờ gì**, gửi đi là xong', 'bỏ thư vào thùng thư ven đường'],
            ['`1`', '**Leader** đã ghi', 'gửi thường, nhân viên quầy nhận'],
            ['`all` (= `-1`)', 'Leader **và mọi bản sao đồng bộ** (ISR) đã có', 'thư bảo đảm, ký nhận đủ các bên'],
          ],
        },
        {
          kind: 'callout',
          tone: 'info',
          text: 'Mặc định là `acks=all` **từ Kafka 3.0** (trước đó là `1`). Trên cụm 1 broker như lab, `1` và `all` gần như giống nhau vì không có bản sao nào để chờ.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Với acks=0, producer có retry được không?', ['Có, như bình thường', 'Retry vô nghĩa vì producer không biết tin có tới hay không', 'Chỉ retry khi leader chết', 'Chỉ retry 1 lần'], 1, 'Không chờ trả lời thì không có gì để biết là phải gửi lại.')],
        },
      ],
    },
    {
      id: 'acks-1-mat-tin',
      title: 'acks=1 mất tin thế nào',
      blocks: [
        { kind: 'video', scenes: ['loss'] },
        {
          kind: 'code',
          code: 't=0  Leader (broker 1) ghi offset 100–199 → trả "OK"\nt=1  Producer nhận OK, coi như xong, không giữ lại\nt=2  Broker 1 chết TRƯỚC KHI follower (broker 2) kịp chép\nt=3  Broker 2 lên làm leader: không có offset 100–199\n     → 100 tin MẤT, dù producer đã nhận "OK"',
        },
        {
          kind: 'callout',
          tone: 'tip',
          text: '`acks` thấp chỉ làm **producer** nhanh hơn, không làm consumer thấy tin sớm hơn: consumer chỉ đọc được tin đã chép đủ sang ISR (high watermark, Module 4). Cái giá của `acks=all` chỉ là thêm một vòng chép sang follower.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Vì sao acks=all tránh được kịch bản trên?', ['Vì nó nén dữ liệu', 'Vì leader chỉ trả OK khi các bản sao đồng bộ đã chép xong', 'Vì nó ghi xuống đĩa ngay', 'Vì nó dùng nhiều partition'], 1, 'Leader mới chắc chắn có tin vì nó đã chép trước khi producer nhận OK.')],
        },
      ],
    },
    {
      id: 'retry-trung',
      title: 'Retry để không mất — nhưng sinh trùng',
      blocks: [
        { kind: 'video', scenes: ['duplicate'] },
        {
          kind: 'p',
          text: 'Producer tự gửi lại khi gặp lỗi tạm thời hoặc hết thời gian chờ. Nhưng "không nhận được trả lời" có hai khả năng: thùng **chưa tới**, hoặc thùng **đã ghi** mà câu trả lời bị mất. Trường hợp sau, gửi lại sẽ tạo **bản ghi thứ hai**. Retry còn có thể **đảo thứ tự** khi nhiều thùng đang bay cùng lúc.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Thùng đã được broker ghi, nhưng câu trả lời OK bị mất trên mạng. Không có idempotence, retry sẽ…', ['Không làm gì', 'Ghi thêm một bản → trùng', 'Xoá bản cũ', 'Báo lỗi cho consumer'], 1, 'Broker không biết đây là bản gửi lại.')],
        },
      ],
    },
    {
      id: 'idempotence',
      title: 'Idempotence: đánh số thùng',
      blocks: [
        {
          kind: 'quiz',
          title: 'Dự đoán trước khi xem',
          questions: [q('Làm sao broker nhận ra một thùng là bản gửi lại?', ['So nội dung từng byte', 'Mỗi thùng mang mã producer và số thứ tự', 'Dựa vào timestamp', 'Không thể nhận ra'], 1, 'Xem video để thấy broker dùng "trí nhớ" số thứ tự thế nào.')],
        },
        { kind: 'video', scenes: ['sequence'] },
        {
          kind: 'code',
          code: 'Thùng 1: producerId 16, seq 0–119    → ghi, nhớ "16 đã đến 119"\nThùng 2: producerId 16, seq 120–317  → ghi, nhớ "đến 317"\n         phản hồi bị MẤT, producer gửi lại thùng 2\nThùng 2 (lần 2): seq 120–317         → "đã có rồi" → không ghi lại ✅\nThùng 4: seq 516–694 trước thùng 3   → "đang chờ 318" → từ chối ✅',
        },
        {
          kind: 'table',
          head: ['Điều kiện', 'Vì sao'],
          rows: [
            ['`acks=all`', 'Chỉ leader ghi rồi chết thì leader mới mất luôn "trí nhớ" số thứ tự'],
            ['`retries > 0`', 'Không retry thì chẳng có gì để chống trùng'],
            ['`max.in.flight.requests.per.connection ≤ 5`', 'Broker chỉ nhớ 5 thùng gần nhất của mỗi producer cho mỗi partition'],
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Bẫy (Kafka 3.2+)',
          text: 'Đặt `acks=1` mà **không** ghi gì về `enable.idempotence` → Kafka **lặng lẽ tắt** idempotence (`producerId: -1`). Ghi rõ `enable.idempotence=true` cùng `acks=1` → producer từ chối khởi động với `ConfigException`.',
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Broker đang chờ seq 318 mà nhận thùng seq 516–694. Nó làm gì?', ['Ghi luôn', 'Từ chối; producer gửi lại theo đúng thứ tự', 'Xoá thùng 318', 'Bỏ qua lặng lẽ'], 1, 'Nhờ vậy vừa retry thoải mái vừa giữ thứ tự.')],
        },
      ],
    },
    {
      id: 'gioi-han',
      title: 'Idempotence chống được gì, không chống được gì',
      blocks: [
        { kind: 'video', scenes: ['limits'] },
        {
          kind: 'list',
          items: [
            { title: 'Chống được', text: 'Trùng và đảo thứ tự do **retry nội bộ** của **một phiên producer**.' },
            { title: 'Không chống', text: 'App khởi động lại → `producerId` mới. App tự gọi `send()` hai lần cùng nội dung → hai tin.' },
            { title: 'Không chống', text: 'Hai producer (hai instance) cùng gửi một dữ liệu → mỗi bên một `producerId`, mọi tin bị nhân đôi.' },
            { title: 'Giá rất rẻ', text: 'Thêm một lần xin `producerId` lúc khởi động và 96 bit mỗi thùng; với `acks=all` gần như không đổi hiệu năng.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [q('Chạy nhầm hai instance cùng đọc một file rồi đẩy vào Kafka (idempotence bật). Kết quả?', ['Không trùng', 'Mọi tin bị nhân đôi, vì hai producer có producerId khác nhau', 'Chỉ trùng tin đầu', 'Producer báo lỗi'], 1, 'Idempotence chỉ lọc trùng trong cùng một producerId.')],
        },
      ],
    },
    {
      id: 'tom-tat-video',
      title: 'Nhìn lại cả bài',
      blocks: [{ kind: 'video', scenes: ['summary'] }],
    },
  ],
  finalQuiz: [
    q('Trên cluster 3 broker, acks=1. Leader ghi xong, trả OK, rồi chết trước khi follower chép. Điều gì xảy ra?', ['Không mất gì', 'Tin đã báo OK bị mất khi follower lên làm leader', 'Producer tự gửi lại', 'Consumer đọc trùng'], 1, 'Đây là lý do mặc định đổi sang acks=all từ 3.0.'),
    q('Cấu hình nào cần cho idempotence?', ['acks=0', 'acks=all, retries > 0, max.in.flight ≤ 5', 'linger.ms > 0', 'compression=gzip'], 1, 'Mặc định của Kafka 3.0+ đã thoả cả ba.'),
    q('Đặt acks=1 và không ghi gì về enable.idempotence (Kafka 3.9). Kết quả?', ['ConfigException', 'Idempotence bị tắt lặng lẽ', 'acks tự đổi về all', 'Không ảnh hưởng gì'], 1, 'Chỉ khi ghi rõ enable.idempotence=true mới bị từ chối khởi động.'),
    q('App bị restart giữa chừng, gửi lại một lô đã gửi trước đó. Idempotence có lọc được không?', ['Có', 'Không: producerId mới, broker coi là khách khác', 'Chỉ khi acks=all', 'Chỉ lọc 5 thùng gần nhất'], 1, 'Cần transaction / xử lý trùng ở phía consumer.'),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao idempotence cho phép retry mà không trùng tin?',
      keywords: ['producerId', 'số thứ tự', 'broker', 'nhớ'],
      modelAnswer:
        'Vì mỗi producer có một producerId và đánh số thứ tự cho từng tin theo partition. Broker nhớ số cuối cùng đã ghi cho mỗi cặp producerId–partition, nên khi thùng gửi lại mang số đã có, broker nhận ra trùng và không ghi lại; thùng nhảy cóc thì bị từ chối để producer gửi lại đúng thứ tự.',
    },
  ],
  recap: {
    journey:
      'Broker báo OK mà tin vẫn mất → acks quyết định "gửi xong" là khi nào → acks=1 mất tin khi leader chết trước khi chép → acks=all + retry để không mất → retry sinh trùng → idempotence đánh số thùng để bỏ trùng và giữ thứ tự → nhưng chỉ trong một phiên producer.',
    points: [
      { title: 'acks', text: '0 không chờ · 1 leader · all leader + ISR (mặc định từ 3.0).' },
      { title: 'acks=1', text: 'Có thể mất tin đã báo OK khi leader chết.' },
      { title: 'Idempotence', text: 'producerId + seq: bỏ thùng trùng, chặn thùng nhảy cóc.' },
      { title: 'Giới hạn', text: 'Restart hay 2 producer vẫn trùng → transaction (Module 6).' },
    ],
    next: 'Bài tiếp theo (Module 4): Leader, ISR & High Watermark — bản sao thật sự hoạt động thế nào.',
  },
}
