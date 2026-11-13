import type { ReactNode } from 'react'
import { cameraAt, clamp, lerp, move, sp, vis } from '../player/motion-kit'
import { ConsumerUnit, Envelope, Icon3D, Packets, ProducerBox, Rise, SOFT, SOFT_PANEL, ServerUnit, SoftScene, SoftTheme, Statement, SummaryList, Wire } from '../player/schematic'
import type { Icon3DName } from '../player/schematic'
import type { Cue, Lesson, Scene as LessonScene, SceneSfx } from '../player/types'
import { MONO } from '../remotion/video-fonts'
import { schemaRegistryScript } from './schema-registry-script'

/** This lesson is drawn in the navy glow style. */
const INK = SOFT
const panel = SOFT_PANEL
const WIDE = { x: 960, y: 540, s: 1 }

/** Time at fraction p of beat k. */
const at = (c: Cue, k: number, p: number) => c.at(k) + (c.end(k) - c.at(k)) * p

/* ------------------------------------------------------------------ shared pieces */

const CH = 70
const GREEN = 'linear-gradient(160deg, #9ff5cf 0%, #27d391 55%, #0e9a6c 100%)'
const AMBER = 'linear-gradient(160deg, #ffe0a8 0%, #ffb547 55%, #d98614 100%)'
const SOFTBLUE = 'linear-gradient(160deg, #78b0ff 0%, #2f66f2 55%, #1c3fc4 100%)'
const EMPTY = { background: INK.cell.empty as string, border: '1.5px solid rgba(110,160,255,0.35)' }

type Spec = { kind: 'data' | 'open'; label?: string; at: number }

function Slot({ t, x, y, w, spec }: { t: number; x: number; y: number; w: number; spec: Spec }) {
  const k = sp(t, spec.at, 14, 140)
  if (k <= 0) return null
  const open = spec.kind === 'open'
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: CH, padding: '0 3px', boxSizing: 'border-box', opacity: clamp(k * 1.6), transform: `scale(${0.85 + 0.15 * k})` }}>
      <div style={{ height: '100%', borderRadius: 14, boxSizing: 'border-box', background: open ? AMBER : INK.cell.filled, border: 'none', boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.5), 0 0 14px rgba(77,141,255,0.35), 0 10px 20px rgba(0,8,50,0.45)', display: 'grid', placeItems: 'center', fontSize: 26, fontWeight: 800, color: open ? '#3a2400' : '#fff' }}>{spec.label}</div>
    </div>
  )
}

/** A tape of `n` equal slots with optional filled cells and a title above. */
function Tape({ t, x, y, cw, n, cells, title, titleSize = 26 }: { t: number; x: number; y: number; cw: number; n: number; cells: Record<number, Spec>; title?: string; titleSize?: number }) {
  return (
    <div>
      {title && <div style={{ position: 'absolute', left: x, top: y - 20 - titleSize * 1.2, fontSize: titleSize, fontWeight: 700, color: INK.faint, whiteSpace: 'nowrap' }}>{title}</div>}
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ position: 'absolute', left: x + i * cw, top: y, width: cw, height: CH, padding: '0 3px', boxSizing: 'border-box' }}>
          <div style={{ height: '100%', borderRadius: 14, boxSizing: 'border-box', ...EMPTY }} />
        </div>
      ))}
      {Object.entries(cells).map(([i, spec]) => (
        <Slot key={i} t={t} x={x + Number(i) * cw} y={y} w={cw} spec={spec} />
      ))}
    </div>
  )
}

/** Small glowing pill. */
function Pill({ x, y, text, color = '#ffffff', o = 1, mono = false, size = 28, center = false }: { x: number; y: number; text: string; color?: string; o?: number; mono?: boolean; size?: number; center?: boolean }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: center ? 'translateX(-50%)' : undefined, padding: '8px 20px', borderRadius: 999, background: 'rgba(8,22,82,0.92)', border: `1.5px solid ${color === '#ffffff' ? '#6ea2ff' : color}`, boxShadow: `0 0 18px ${color === '#ffffff' ? 'rgba(77,141,255,0.65)' : `${color}88`}`, fontFamily: mono ? MONO : undefined, fontSize: size, fontWeight: 800, color, whiteSpace: 'nowrap', opacity: clamp(o) }}>
      {text}
    </div>
  )
}

/** A square-ish byte cell that lights up with `lit` (0..1) and can wear a white ring. */
function ByteCell({ x, y, w, h, label, grad, lit, ring = false, size = 28, ghost = false }: { x: number; y: number; w: number; h: number; label: string; grad: string; lit: number; ring?: boolean; size?: number; ghost?: boolean }) {
  const l = clamp(lit)
  if (l <= 0.02 && !ghost) return null
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, boxSizing: 'border-box', borderRadius: 14, background: l > 0.02 ? grad : (EMPTY.background as string), border: l > 0.02 ? 'none' : EMPTY.border, boxShadow: l > 0.02 ? `inset 0 2px 0 rgba(255,255,255,0.5), 0 10px 20px rgba(0,8,50,0.45)${ring ? ', 0 0 0 4px #ffffff, 0 0 26px rgba(255,255,255,0.8)' : ''}` : undefined, display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: size, fontWeight: 800, color: l > 0.02 ? '#fff' : 'transparent', opacity: 0.35 + 0.65 * l, transform: `scale(${0.9 + 0.1 * l})`, textShadow: l > 0.02 ? '0 2px 4px rgba(0,8,50,0.5)' : undefined }}>
      {label}
    </div>
  )
}

/** Text lines card (title + rows) in the glow panel look. */
function Card({ x, y, w, h, children, border, o = 1 }: { x: number; y: number; w: number; h: number; children: ReactNode; border?: string; o?: number }) {
  return <div style={{ ...panel, left: x, top: y, width: w, height: h, boxSizing: 'border-box', padding: '16px 26px', border: border ?? (panel.border as string), opacity: clamp(o) }}>{children}</div>
}

/* ------------------------------------------------------------------ 0. cold open: rename a field */

function hook(t: number, c: Cue) {
  const a3 = c.at(3)
  const renameAt = at(c, 2, 0.15)
  const lockOn = t < c.at(2)
  const cells: Record<number, Spec> = {
    0: { kind: 'data', label: '150k', at: at(c, 0, 0.3) },
    1: { kind: 'data', label: '90k', at: at(c, 0, 0.6) },
    2: { kind: 'open', label: '200k', at: at(c, 2, 0.5) },
  }
  const revenue = t >= at(c, 0, 0.85) ? '240.000' : t >= at(c, 0, 0.55) ? '150.000' : '0'
  const badAt = at(c, 3, 0.35)
  const pulse = 0.5 + 0.5 * Math.sin(t * 5)
  const P1 = { x: 599, y: 500 }
  const P2 = { x: 691, y: 495 }
  const C1p = { x: 1227, y: 495 }
  const C2p = { x: 1321, y: 500 }
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a3, { x: 1000, y: 580, s: 1.04 }, 1.4]])}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: 'translateY(40px) scale(1.18)', transformOrigin: '960px 540px' }}>
        <Rise t={t} at={0.3}>
          <ProducerBox x={235} y={445} w={360} title="đội A · producer" line={t >= renameAt ? 'total: 200000' : 'amount: 150000'} />
        </Rise>
        <Rise t={t} at={0.6}>
          <Tape t={t} x={695} y={460} cw={88} n={6} cells={cells} title="orders · P0" titleSize={30} />
        </Rise>
        <Rise t={t} at={0.9}>
          <ConsumerUnit x={1325} y={441} w={360} name="đội B · consumer" t={t} busy={(t * 1.1) % 1} />
        </Rise>
        <Wire from={P1} to={P2} color={INK.line} p={move(t, 0.8, 0.4)} flow={t} />
        <Wire from={C1p} to={C2p} color={INK.line} p={move(t, 1.0, 0.4)} flow={t} />
        <Packets t={t} from={P1} to={P2} start={at(c, 0, 0.1)} end={at(c, 0, 0.75)} every={0.45} len={0.7} size={18} />
        <Packets t={t} from={C1p} to={C2p} start={at(c, 0, 0.3)} end={at(c, 0, 0.85)} every={0.4} len={0.6} size={18} />
        <Packets t={t} from={P1} to={P2} start={at(c, 2, 0.35)} end={at(c, 2, 0.6)} every={0.4} len={0.7} size={18} color={INK.warn} />
        <Packets t={t} from={C1p} to={C2p} start={at(c, 3, 0.05)} every={0.4} len={0.6} size={18} color={INK.warn} />
        <div style={{ ...panel, left: 1325, top: 620, width: 360, boxSizing: 'border-box', padding: '14px 26px', border: t >= badAt ? `2px solid ${INK.bad}` : (panel.border as string), boxShadow: t >= badAt ? `0 0 ${16 + 22 * pulse}px ${INK.bad}` : (panel.boxShadow as string) }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: INK.faint }}>doanh thu</div>
          <div style={{ fontSize: 56, fontWeight: 800, color: t >= badAt ? INK.bad : '#fff' }}>{revenue}</div>
        </div>
        {/* beat 1: the broker only sees bytes */}
        <Rise t={t} at={at(c, 1, 0.1)}>
          <div style={{ ...panel, left: 695, top: 610, width: 528, boxSizing: 'border-box', padding: '14px 26px', fontFamily: MONO, fontSize: 30, color: INK.faint, whiteSpace: 'nowrap' }}>7B 22 61 6D 6F 75 6E 74 …</div>
        </Rise>
        {lockOn ? <Icon3D name="lock" x={959} y={250} size={110} t={t} at={at(c, 1, 0.1)} /> : <Icon3D name="tick" x={959} y={250} size={110} t={t} at={c.at(2)} />}
        <Pill x={959} y={330} center text={lockOn ? 'broker chỉ thấy byte' : 'broker vẫn nhận bình thường'} color={lockOn ? INK.accent : INK.good} o={vis(t, at(c, 1, 0.3))} size={30} />
        {t >= renameAt && t < a3 && <Pill x={235} y={590} text="amount → total" color={INK.warn} o={sp(t, renameAt + 0.2)} size={30} />}
        {t >= badAt && <Pill x={1325 + 180} y={775} center text="amount = null" color={INK.bad} o={sp(t, badAt)} size={34} />}
        {t >= at(c, 3, 0.55) && (
          <div style={{ position: 'absolute', left: 0, width: 1920, top: 880, textAlign: 'center', fontSize: 42, fontWeight: 800, color: INK.bad, whiteSpace: 'nowrap', opacity: sp(t, at(c, 3, 0.55)), transform: `scale(${1 + 0.02 * pulse})`, textShadow: `0 0 ${10 + 14 * pulse}px ${INK.bad}88` }}>
            dữ liệu sai nằm im trong topic, không lỗi nào báo
          </div>
        )}
      </div>
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 1. schema is a contract, bytes saved */

const JSON_S = '{"order_id":42,"amount":150000}'
const JSON_KIND = (() => {
  let q = false
  return JSON_S.split('').map((ch) => {
    if (ch === '"') {
      q = !q
      return 'name'
    }
    if (q) return 'name'
    return /\d/.test(ch) ? 'val' : 'punct'
  })
})()
const AVRO_BYTES = ['54', 'E0', 'A7', '12']
const KIND_GRAD: Record<string, string> = { name: AMBER, val: SOFTBLUE, punct: 'linear-gradient(160deg, #5f78c8 0%, #3a4f9e 100%)' }

function contract(t: number, c: Cue) {
  const [a1, a2, a3] = [c.at(1), c.at(2), c.at(3)]
  const BX = 110
  const PITCH = 52
  const jsonStart = a1 + 0.3
  const jsonLit = (i: number) => clamp((t - (jsonStart + i * 0.07)) / 0.15)
  const lit = JSON_S.split('').filter((_, i) => jsonLit(i) > 0).length
  const avroStart = a2 + 0.4
  const avroLit = (i: number) => clamp((t - (avroStart + i * 0.45)) / 0.2)
  const avroN = AVRO_BYTES.filter((_, i) => avroLit(i) > 0).length
  const formats: { icon: Icon3DName; name: string; sub: string }[] = [
    { icon: 'flash', name: 'Avro', sub: 'nhị phân gọn · phổ biến nhất' },
    { icon: 'cube', name: 'Protobuf', sub: 'file .proto · hợp với gRPC' },
    { icon: 'file-text', name: 'JSON Schema', sub: 'tin vẫn là JSON dễ đọc' },
  ]
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1 + 0.5, { x: 960, y: 580, s: 1.05 }, 1.5], [a3, WIDE, 1.5]])} title={{ kicker: 'SCHEMA', text: 'Hợp đồng dữ liệu' }}>
      <Rise t={t} at={0.9}>
        <Card x={110} y={270} w={640} h={250} border={t >= a2 + 0.3 ? `2px solid ${INK.good}` : undefined}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, height: '100%' }}>
            <div style={{ width: 130, height: 130, flex: 'none', position: 'relative' }}>
              <Icon3D name="file-text" x={65} y={65} size={130} t={t} at={1.0} />
            </div>
            <div>
              <div style={{ fontSize: 34, fontWeight: 800 }}>Order v1</div>
              <div style={{ marginTop: 10, fontFamily: MONO, fontSize: 30, color: INK.faint, lineHeight: 1.45 }}>order_id : long</div>
              <div style={{ fontFamily: MONO, fontSize: 30, color: INK.faint, lineHeight: 1.45 }}>amount&nbsp;&nbsp;: long</div>
            </div>
          </div>
        </Card>
      </Rise>
      <Wire from={{ x: 754, y: 330 }} to={{ x: 826, y: 330 }} color={INK.line} p={move(t, 1.8, 0.4)} />
      <Wire from={{ x: 754, y: 460 }} to={{ x: 826, y: 460 }} color={INK.line} p={move(t, 2.4, 0.4)} />
      <Rise t={t} at={1.8}>
        <Card x={830} y={280} w={560} h={100}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, height: '100%', fontSize: 30 }}>
            <div style={{ width: 70, height: 70, flex: 'none', position: 'relative' }}>
              <Icon3D name="pencil" x={35} y={35} size={70} t={t} at={1.9} float={false} />
            </div>
            <span>producer ghi đúng mẫu</span>
          </div>
        </Card>
      </Rise>
      <Rise t={t} at={2.4}>
        <Card x={830} y={410} w={560} h={100}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, height: '100%', fontSize: 30 }}>
            <div style={{ width: 70, height: 70, flex: 'none', position: 'relative' }}>
              <Icon3D name="notebook" x={35} y={35} size={70} t={t} at={2.5} float={false} />
            </div>
            <span>consumer đọc đúng mẫu</span>
          </div>
        </Card>
      </Rise>
      {/* JSON, byte by byte */}
      <div style={{ opacity: vis(t, a1 + 0.1) }}>
        <div style={{ position: 'absolute', left: BX, top: 578, fontSize: 28, fontWeight: 800 }}>JSON · {lit} byte</div>
        <Pill x={620} y={568} text="tên trường lặp lại ở mọi tin" color={INK.warn} o={sp(t, jsonStart + 2.4)} />
      </div>
      {JSON_S.split('').map((ch, i) => (
        <ByteCell key={i} x={BX + i * PITCH} y={642} w={46} h={56} label={ch} grad={KIND_GRAD[JSON_KIND[i]]} lit={jsonLit(i)} size={28} />
      ))}
      {/* Avro */}
      <div style={{ opacity: vis(t, a2 + 0.1) }}>
        <div style={{ position: 'absolute', left: BX, top: 742, fontSize: 28, fontWeight: 800 }}>Avro · {avroN} byte</div>
        <Pill x={620} y={732} text="tên trường nằm trong schema" color={INK.good} o={sp(t, avroStart + 2.0)} />
      </div>
      {AVRO_BYTES.map((b, i) => (
        <ByteCell key={i} x={BX + i * PITCH} y={792} w={46} h={56} label={b} grad={SOFTBLUE} lit={avroLit(i)} size={26} />
      ))}
      <div style={{ position: 'absolute', left: BX - 10, top: 858, width: PITCH, textAlign: 'center', fontSize: 28, color: INK.faint, opacity: avroLit(0) }}>42</div>
      <div style={{ position: 'absolute', left: BX + PITCH, top: 858, width: PITCH * 3 - 6, textAlign: 'center', fontSize: 28, color: INK.faint, opacity: avroLit(1) }}>150000</div>
      {/* formats */}
      {formats.map((f, i) => (
        <Rise key={f.name} t={t} at={a3 + 0.2 + i * 0.7}>
          <Card x={110 + i * 570} y={915} w={540} h={120}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22, height: '100%' }}>
              <div style={{ width: 80, height: 80, flex: 'none', position: 'relative' }}>
                <Icon3D name={f.icon} x={40} y={40} size={80} t={t} at={a3 + 0.3 + i * 0.7} />
              </div>
              <div>
                <div style={{ fontSize: 34, fontWeight: 800 }}>{f.name}</div>
                <div style={{ marginTop: 4, fontSize: 26, fontWeight: 600, color: INK.faint, whiteSpace: 'nowrap' }}>{f.sub}</div>
              </div>
            </div>
          </Card>
        </Rise>
      ))}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 2. Schema Registry hands out ids */

function registry(t: number, c: Cue) {
  const [a1, a2, a3] = [c.at(1), c.at(2), c.at(3)]
  const P = { x: 400, y: 647 }
  const R = { x: 826, y: 330 }
  const R2 = { x: 1094, y: 330 }
  const CN = { x: 1620, y: 633 }
  // message pills stop short of the registry so they never cover it
  const near = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: lerp(a.x, b.x, 0.8), y: lerp(a.y, b.y, 0.8) })
  const RP = near(P, R)
  const RC = near(CN, R2)
  const fatOut = a1 - 0.05
  const idAt = at(c, 2, 0.35)
  const sendAt = a3 + 0.1
  const askAt = at(c, 3, 0.45)
  const replyAt = askAt + 1.0
  const cells: Record<number, Spec> = { 0: { kind: 'data', label: '#42', at: sendAt + 0.8 } }
  const grow = move(t, at(c, 0, 0.35), 0.9)
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a2, { x: 960, y: 520, s: 1.05 }, 1.4], [a3, { x: 960, y: 540, s: 1.05 }, 1.4]])} title={{ kicker: 'REGISTRY', text: 'Schema Registry' }}>
      <Rise t={t} at={0.3}>
        <ProducerBox x={110} y={650} w={400} title="producer" line="gửi tin Order" />
      </Rise>
      <Rise t={t} at={0.5}>
        <Tape t={t} x={600} y={655} cw={90} n={8} cells={cells} title="orders · P0" />
      </Rise>
      <Rise t={t} at={0.7}>
        <ConsumerUnit x={1430} y={636} w={380} name="consumer" t={t} busy={(t * 1.1) % 1} />
      </Rise>
      <Wire from={{ x: 514, y: 705 }} to={{ x: 596, y: 690 }} color={INK.line} p={move(t, 0.9, 0.4)} flow={t} />
      <Wire from={{ x: 1326, y: 690 }} to={{ x: 1426, y: 695 }} color={INK.line} p={move(t, 1.0, 0.4)} flow={t} />
      {/* beat 0: the fat message */}
      <div style={{ opacity: vis(t, 0.8, fatOut, 0.35) }}>
        <div style={{ position: 'absolute', left: 110, top: 470, width: 100, height: CH, borderRadius: 14, boxSizing: 'border-box', background: INK.cell.filled as string, boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.5), 0 10px 20px rgba(0,8,50,0.45)', display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 800 }}>4 B</div>
        <div style={{ position: 'absolute', left: 224, top: 470, width: 1000 * grow, height: CH, borderRadius: 14, background: AMBER, boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.6), 0 10px 20px rgba(0,8,50,0.45)', display: 'grid', placeItems: 'center', overflow: 'hidden', fontSize: 28, fontWeight: 800, color: '#3a2400', whiteSpace: 'nowrap' }}>{grow > 0.9 ? 'schema ≈ 300 B' : ''}</div>
        <Pill x={1260} y={477} text="304 byte cho 4 byte dữ liệu" color={INK.bad} o={sp(t, at(c, 0, 0.7))} />
      </div>
      {/* beat 1+: the registry */}
      <Rise t={t} at={a1 + 0.4}>
        <ServerUnit x={R.x} y={230} name="Schema Registry" t={t} />
      </Rise>
      <Icon3D name="notebook" x={1230} y={295} size={120} t={t} at={a1 + 0.9} />
      <Wire from={{ x: P.x, y: P.y }} to={{ x: R.x, y: R.y }} color={INK.line} p={move(t, a1 + 1.4, 0.5)} flow={t >= a1 + 1.9 ? t : undefined} />
      <Wire from={{ x: CN.x, y: CN.y }} to={{ x: R2.x, y: R2.y }} color={INK.line} p={move(t, a1 + 1.8, 0.5)} flow={t >= a1 + 2.3 ? t : undefined} />
      <Envelope t={t} at={a2 + 0.2} from={P} to={RP} label="đăng ký Order v1" color={INK.accent} len={1.1} arc={0} />
      <Envelope t={t} at={idAt} from={RP} to={P} label="id = 42" color={INK.good} len={0.9} arc={0} />
      {t >= idAt + 0.7 && (
        <Rise t={t} at={idAt + 0.7}>
          <Card x={800} y={440} w={320} h={86}>
            <div style={{ fontFamily: MONO, fontSize: 30, fontWeight: 800 }}>42 → Order v1</div>
          </Card>
        </Rise>
      )}
      <Packets t={t} from={{ x: 514, y: 705 }} to={{ x: 596, y: 690 }} start={sendAt} end={sendAt + 0.7} every={0.35} len={0.6} size={18} />
      <Envelope t={t} at={askAt} from={CN} to={RC} label="id 42 là gì?" color={INK.warn} len={1.0} arc={0} />
      <Envelope t={t} at={replyAt} from={RC} to={CN} label="Order v1" color={INK.good} len={0.9} arc={0} />
      <Packets t={t} from={{ x: 1326, y: 690 }} to={{ x: 1426, y: 695 }} start={sendAt + 1.4} end={sendAt + 1.9} every={0.35} len={0.6} size={18} />
      {t >= replyAt + 0.8 && (
        <Rise t={t} at={replyAt + 0.8}>
          <Card x={1430} y={790} w={380} h={86}>
            <div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 800, color: INK.good }}>cache: 42 → v1</div>
          </Card>
        </Rise>
      )}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 3. wire format */

const WIRE = ['00', '00', '00', '00', '2A', '54', 'E0', 'A7', '12']

function wire(t: number, c: Cue) {
  const [a1, a2, a3] = [c.at(1), c.at(2), c.at(3)]
  const X0 = 290
  const PITCH = 150
  const Y = 520
  const grad = (i: number) => (i === 0 ? AMBER : i <= 4 ? SOFTBLUE : GREEN)
  const lightAt = (i: number) => (i <= 4 ? at(c, 0, 0.25) + i * 0.4 : a3 + 0.3 + (i - 5) * 0.35)
  const litOf = (i: number) => clamp((t - lightAt(i)) / 0.2)
  const cx = (i: number) => X0 + i * PITCH + 70
  const decodeOut = a3 - 0.05
  const sweep = Math.floor((t - (a3 + 3)) / 0.3) % 9
  const groups = [
    { label: 'magic byte', from: 0, to: 0, color: INK.warn, at: a1 + 0.1 },
    { label: 'schema id · 4 byte', from: 1, to: 4, color: INK.accent, at: a2 + 0.1 },
    { label: 'dữ liệu Avro', from: 5, to: 8, color: INK.good, at: a3 + 0.1 },
  ]
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a2 + 0.5, { x: 940, y: 580, s: 1.06 }, 1.5], [a3, WIDE, 1.5]])} title={{ kicker: 'WIRE FORMAT', text: 'Năm byte đầu' }}>
      {WIRE.map((b, i) => (
        <ByteCell key={i} x={X0 + i * PITCH} y={Y} w={140} h={130} label={b} grad={grad(i)} lit={litOf(i)} ghost={i >= 5} ring={(i === 0 && t >= a1 + 0.2 && t < a2) || (i >= 1 && i <= 4 && t >= a2 + 0.2 && t < a3) || (t >= a3 + 3 && i === sweep)} size={44} />
      ))}
      {WIRE.map((_, i) => (
        <div key={i} style={{ position: 'absolute', left: X0 + i * PITCH, width: 140, textAlign: 'center', top: Y + 142, fontFamily: MONO, fontSize: 28, color: INK.faint, opacity: litOf(i) }}>
          byte {i}
        </div>
      ))}
      {groups.map((g) => {
        const gx = X0 + g.from * PITCH
        const gw = (g.to - g.from) * PITCH + 140
        const o = vis(t, g.at)
        return (
          <div key={g.label} style={{ opacity: o }}>
            <div style={{ position: 'absolute', left: gx, width: gw, top: 430, textAlign: 'center', fontSize: 32, fontWeight: 800, color: g.color, whiteSpace: 'nowrap' }}>{g.label}</div>
            <div style={{ position: 'absolute', left: gx, width: gw, top: 490, height: 8, borderRadius: 4, background: g.color, boxShadow: `0 0 14px ${g.color}` }} />
          </div>
        )
      })}
      {t >= at(c, 0, 0.8) && t < a1 && <Pill x={X0 + 2.5 * PITCH + 70 - 70} y={370} center text="5 byte cố định" color={INK.accent} size={32} o={sp(t, at(c, 0, 0.8))} />}
      {t >= a1 + 1.0 && t < a2 && <Pill x={cx(0)} y={740} center text="luôn bằng 0" color={INK.warn} size={32} o={sp(t, a1 + 1.0)} />}
      {/* decode the id */}
      <div style={{ opacity: vis(t, a2 + 0.6, decodeOut, 0.35) }}>
        <div style={{ ...panel, left: 500, top: 770, width: 470, boxSizing: 'border-box', padding: '14px 26px', textAlign: 'center' }}>
          <div style={{ fontFamily: MONO, fontSize: 28, color: INK.faint }}>00 00 00 2A</div>
          <div style={{ fontFamily: MONO, fontSize: 56, fontWeight: 800 }}>= 42</div>
        </div>
        <Wire from={{ x: 984, y: 850 }} to={{ x: 1060, y: 850 }} color={INK.line} p={move(t, a2 + 1.8, 0.4)} />
        <Icon3D name="notebook" x={1150} y={845} size={120} t={t} at={a2 + 2.2} />
        <Pill x={1150} y={920} center text="Registry: 42 → Order v1" color={INK.accent} o={sp(t, a2 + 2.6)} />
      </div>
      {t >= a3 + 2.2 && <Statement x={290} y={820} text="thêm 5 byte mỗi tin, thay vì cả schema" color={INK.good} size={46} o={sp(t, a3 + 2.2)} />}
      {t >= a3 + 2.8 && <Icon3D name="tick" x={1640} y={850} size={110} t={t} at={a3 + 2.8} />}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 4. the gatekeeper */

function gate(t: number, c: Cue) {
  const [a1, a2, a3] = [c.at(1), c.at(2), c.at(3)]
  const regAt = at(c, 0, 0.12)
  const refuseAt = at(c, 1, 0.55)
  const acceptAt = at(c, 3, 0.55)
  const P = { x: 494, y: 445 }
  const R = { x: 796, y: 445 }
  // envelopes travel inside the gap between producer and registry and never touch either card
  const EP = { x: 620, y: 445 }
  const ER = { x: 655, y: 445 }
  const verdict: Icon3DName | null = t >= acceptAt + 0.8 ? 'tick' : t >= refuseAt + 0.8 ? 'thumb-down' : null
  const Row = ({ name, type, def, mark, color }: { name: string; type: string; def?: string; mark?: string; color?: string }) => (
    <div style={{ fontFamily: MONO, fontSize: 28, lineHeight: 1.45, color: color ?? INK.faint, whiteSpace: 'nowrap' }}>
      {mark ?? ' '} {name} : {type}
      {def && <span> = {def}</span>}
    </div>
  )
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1 + 0.5, { x: 940, y: 570, s: 1.05 }, 1.5], [a3 - 0.5, WIDE, 1.5]])} title={{ kicker: 'COMPATIBILITY', text: 'Người gác cổng' }}>
      <Rise t={t} at={0.3}>
        <ProducerBox x={110} y={390} w={380} title="producer" line="đăng ký schema" />
      </Rise>
      <Rise t={t} at={regAt}>
        <ServerUnit x={800} y={380} name="Schema Registry" t={t} />
      </Rise>
      <Rise t={t} at={0.9}>
        <Tape t={t} x={1260} y={410} cw={80} n={6} cells={t >= acceptAt + 1.4 ? { 0: { kind: 'data', label: '#43', at: acceptAt + 1.4 } } : {}} title="orders · P0" />
      </Rise>
      <Wire from={{ x: P.x, y: P.y }} to={{ x: R.x, y: R.y }} color={INK.line} p={move(t, 1.0, 0.4)} flow={t} />
      {t >= a2 + 0.2 && t < a3 ? <Wire from={{ x: 1066, y: 445 }} to={{ x: 1256, y: 445 }} color={INK.bad} p={move(t, a2 + 0.2, 0.4)} dashed /> : null}
      {verdict === null ? <Icon3D name="shield" x={930} y={290} size={130} t={t} at={regAt + 0.8} /> : <Icon3D name={verdict} x={930} y={290} size={130} t={t} at={verdict === 'tick' ? acceptAt + 0.8 : refuseAt + 0.8} />}
      <Pill x={1020} y={268} text="tương thích với v1 không?" color="#ffffff" size={32} o={vis(t, at(c, 0, 0.55), a1, 0.3)} />
      <Rise t={t} at={at(c, 0, 0.35)}>
        <Card x={780} y={585} w={340} h={t >= acceptAt + 0.8 ? 130 : 86}>
          <div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 800, lineHeight: 1.5 }}>42 → Order v1</div>
          {t >= acceptAt + 0.8 && <div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 800, lineHeight: 1.5, color: INK.good, opacity: clamp(sp(t, acceptAt + 0.8)) }}>43 → Order v2</div>}
        </Card>
      </Rise>
      {/* candidate schemas */}
      <Rise t={t} at={a1 + 0.2}>
        <Card x={110} y={735} w={800} h={235} border={t >= refuseAt ? `2px solid ${INK.bad}` : undefined}>
          <div style={{ fontSize: 30, fontWeight: 800 }}>Order v2 · bản thử</div>
          <Row name="order_id" type="long" />
          <Row name="amount" type="long" />
          <Row name="discount" type="long" mark="+" color={INK.warn} />
        </Card>
      </Rise>
      {t >= a1 + 1.0 && <Pill x={640} y={865} text="không default" color={INK.bad} o={sp(t, a1 + 1.0)} />}
      <Rise t={t} at={a3 + 0.2}>
        <Card x={1000} y={735} w={800} h={235} border={t >= acceptAt ? `2px solid ${INK.good}` : undefined}>
          <div style={{ fontSize: 30, fontWeight: 800 }}>Order v2 · đã sửa</div>
          <Row name="order_id" type="long" />
          <Row name="amount" type="long" />
          <Row name="discount" type="long" def="0" mark="+" color={INK.good} />
        </Card>
      </Rise>
      <Envelope t={t} at={at(c, 1, 0.3)} from={EP} to={ER} label="đăng ký Order v2" color={INK.accent} len={0.9} arc={0} />
      <Envelope t={t} at={refuseAt} from={ER} to={EP} label="từ chối" color={INK.bad} len={0.8} arc={0} />
      <Pill x={1500} y={560} center text="topic vẫn sạch" color={INK.good} o={vis(t, a2 + 1.0, a3 - 0.1, 0.3)} />
      <Envelope t={t} at={at(c, 3, 0.25)} from={EP} to={ER} label="đăng ký (có default)" color={INK.accent} len={1.0} arc={0} />
      <Envelope t={t} at={acceptAt} from={ER} to={EP} label="id = 43" color={INK.good} len={0.8} arc={0} />
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 5. compatibility cases */

type Case = { title: string; chips: { text: string; tone?: 'new' | 'gone' }[]; newOld: boolean; oldNew: boolean; capA: string; capB: string }
const CASES: Case[] = [
  { title: 'Thêm trường có default', chips: [{ text: 'order_id' }, { text: 'amount' }, { text: '+ note = ""', tone: 'new' }], newOld: true, oldNew: true, capA: 'điền default', capB: 'bỏ qua note' },
  { title: 'Thêm trường không default', chips: [{ text: 'order_id' }, { text: 'amount' }, { text: '+ note', tone: 'new' }], newOld: false, oldNew: true, capA: 'thiếu note', capB: 'bỏ qua note' },
  { title: 'Bỏ trường amount', chips: [{ text: 'order_id' }, { text: '− amount', tone: 'gone' }], newOld: true, oldNew: false, capA: 'bỏ qua amount', capB: 'thiếu amount' },
]

function Chip({ text, tone }: { text: string; tone?: 'new' | 'gone' }) {
  const col = tone === 'new' ? INK.good : tone === 'gone' ? INK.bad : '#ffffff'
  return (
    <span style={{ padding: '6px 18px', borderRadius: 999, background: 'rgba(8,22,82,0.92)', border: `1.5px solid ${tone ? col : '#6ea2ff'}`, boxShadow: `0 0 12px ${tone ? `${col}88` : 'rgba(77,141,255,0.45)'}`, fontFamily: MONO, fontSize: 26, fontWeight: 800, color: col, textDecoration: tone === 'gone' ? 'line-through' : undefined, whiteSpace: 'nowrap' }}>{text}</span>
  )
}

function compat(t: number, c: Cue) {
  const [a1, a3] = [c.at(1), c.at(3)]
  const ROW_Y = [405, 595, 785]
  const rowAt = [at(c, 1, 0.08), at(c, 2, 0.05), at(c, 3, 0.05)]
  const verdictAt = [
    [at(c, 1, 0.5), at(c, 1, 0.78)],
    [at(c, 2, 0.55), at(c, 2, 0.85)],
    [at(c, 3, 0.4), at(c, 3, 0.8)],
  ]
  const C1 = 1190
  const C2 = 1545
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [a1, { x: 960, y: 550, s: 1.04 }, 1.4], [a3, { x: 960, y: 560, s: 1.04 }, 1.6]])} title={{ kicker: 'COMPATIBILITY', text: 'Đổi schema có an toàn không' }}>
      <Rise t={t} at={at(c, 0, 0.25)}>
        <Card x={110} y={265} w={1000} h={80}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: '100%' }}>
            <span style={{ fontSize: 30, fontWeight: 800, marginRight: 8 }}>Order v1</span>
            <Chip text="order_id" />
            <Chip text="amount" />
          </div>
        </Card>
      </Rise>
      <Rise t={t} at={at(c, 0, 0.55)}>
        <div style={{ position: 'absolute', left: C1 - 40, top: 270, width: 330, textAlign: 'center' }}>
          <Pill x={0} y={0} text="code mới đọc tin cũ" color={INK.accent} />
        </div>
      </Rise>
      <Rise t={t} at={at(c, 0, 0.75)}>
        <div style={{ position: 'absolute', left: C2 - 40, top: 270, width: 330, textAlign: 'center' }}>
          <Pill x={0} y={0} text="code cũ đọc tin mới" color={INK.accent} />
        </div>
      </Rise>
      {CASES.map((cs, i) => (
        <div key={cs.title}>
          {t < rowAt[i] + 0.3 && t >= at(c, 0, 0.6) && (
            <Card x={110} y={ROW_Y[i]} w={1000} h={150} o={0.3 * clamp(1 - (t - rowAt[i]) / 0.3) * sp(t, at(c, 0, 0.6))}>
              <div style={{ width: 360, height: 26, borderRadius: 13, background: 'rgba(159,182,238,0.45)' }} />
              <div style={{ marginTop: 24, width: 640, height: 26, borderRadius: 13, background: 'rgba(159,182,238,0.3)' }} />
            </Card>
          )}
          <Rise t={t} at={rowAt[i]}>
            <Card x={110} y={ROW_Y[i]} w={1000} h={150}>
              <div style={{ fontSize: 30, fontWeight: 800 }}>{cs.title}</div>
              <div style={{ marginTop: 16, display: 'flex', gap: 14, alignItems: 'center' }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: INK.faint, marginRight: 4 }}>v2</span>
                {cs.chips.map((ch) => (
                  <Chip key={ch.text} {...ch} />
                ))}
              </div>
            </Card>
          </Rise>
          {[
            { ok: cs.newOld, cap: cs.capA, x: C1, at: verdictAt[i][0] },
            { ok: cs.oldNew, cap: cs.capB, x: C2, at: verdictAt[i][1] },
          ].map((v) => (
            <div key={v.x}>
              <Icon3D name={v.ok ? 'tick' : 'thumb-down'} x={v.x} y={ROW_Y[i] + 75} size={100} t={t} at={v.at} />
              <div style={{ position: 'absolute', left: v.x + 62, top: ROW_Y[i] + 54, fontSize: 28, fontWeight: 700, color: v.ok ? INK.good : INK.bad, whiteSpace: 'nowrap', opacity: sp(t, v.at + 0.15) }}>{v.cap}</div>
            </div>
          ))}
        </div>
      ))}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 6. who upgrades first */

function Unit({ x, y, w, name, upAt, order, t }: { x: number; y: number; w: number; name: string; upAt: number | null; order?: number | string; t: number }) {
  const up = upAt !== null && t >= upAt
  const flash = upAt !== null ? clamp(1 - (t - upAt) / 0.8) * (t >= upAt ? 1 : 0) : 0
  return (
    <div style={{ ...panel, left: x, top: y, width: w, height: 130, boxSizing: 'border-box', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 18, border: up ? `2px solid ${INK.good}` : (panel.border as string), boxShadow: up ? `0 0 ${20 + 30 * flash}px ${INK.good}` : (panel.boxShadow as string) }}>
      {order !== undefined && (
        <div style={{ minWidth: 64, height: 64, padding: typeof order === 'string' ? '0 14px' : 0, flex: 'none', boxSizing: 'border-box', borderRadius: 32, display: 'grid', placeItems: 'center', whiteSpace: 'nowrap', fontSize: typeof order === 'string' ? 28 : 34, fontWeight: 800, color: '#1a3cc0', background: up ? '#ffffff' : 'transparent', border: up ? 'none' : '2px dashed rgba(159,182,238,0.6)', boxShadow: up ? '0 0 16px rgba(91,151,255,0.6)' : undefined }}>{up ? order : ''}</div>
      )}
      <div style={{ fontSize: 34, fontWeight: 800 }}>{name}</div>
      <div style={{ marginLeft: 'auto', padding: '6px 22px', borderRadius: 999, fontFamily: MONO, fontSize: 30, fontWeight: 800, color: up ? '#04331f' : '#fff', background: up ? GREEN : 'rgba(8,22,82,0.92)', border: up ? 'none' : '1.5px solid #6ea2ff' }}>{up ? 'v2' : 'v1'}</div>
    </div>
  )
}

function order(t: number, c: Cue) {
  const [a1, a2, a3] = [c.at(1), c.at(2), c.at(3)]
  const ROW = [290, 540, 790]
  const UW = 440
  const UA = 580
  const UB = 1220
  const modes: { name: string; sub: string; icon: Icon3DName }[] = [
    { name: 'BACKWARD', sub: 'mới đọc được tin cũ', icon: 'backward' },
    { name: 'FORWARD', sub: 'cũ đọc được tin mới', icon: 'forward' },
    { name: 'FULL', sub: 'cả hai chiều', icon: 'puzzle' },
  ]
  const rowAt = [0.3, at(c, 2, 0.04), at(c, 3, 0.05)]
  // [producer upgrade, consumer upgrade]
  const up = [
    [at(c, 1, 0.55), at(c, 0, 0.8)],
    [at(c, 2, 0.5), at(c, 2, 0.88)],
    [a3 + 1.0, a3 + 1.7],
  ]
  const doneAt = [at(c, 1, 0.85), at(c, 2, 0.95), a3 + 2.3]
  const wy = (i: number) => ROW[i] + 65
  return (
    <SoftScene t={t} camera={cameraAt(t, [[0, WIDE], [at(c, 0, 0.5), { x: 960, y: 480, s: 1.05 }, 1.5], [a2, { x: 960, y: 580, s: 1.05 }, 1.5], [a3, WIDE, 1.5]])} title={{ kicker: 'THỨ TỰ NÂNG CẤP', text: 'Ai đổi trước' }}>
      {modes.map((m, i) => (
        <div key={m.name}>
          <Rise t={t} at={rowAt[i]}>
            <Card x={110} y={ROW[i]} w={420} h={130}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, height: '100%' }}>
                <div style={{ width: 80, height: 80, flex: 'none', position: 'relative' }}>
                  <Icon3D name={m.icon} x={40} y={40} size={80} t={t} at={rowAt[i] + 0.2} />
                </div>
                <div>
                  <div style={{ fontSize: 36, fontWeight: 800 }}>{m.name}</div>
                  <div style={{ marginTop: 2, fontSize: 26, fontWeight: 600, color: INK.faint, whiteSpace: 'nowrap' }}>{m.sub}</div>
                </div>
              </div>
            </Card>
          </Rise>
          <Rise t={t} at={rowAt[i] + 0.4}>
            <Unit x={UA} y={ROW[i]} w={UW} name="producer" upAt={up[i][0]} order={i === 0 ? 2 : i === 1 ? 1 : 'tuỳ ý'} t={t} />
          </Rise>
          <Rise t={t} at={rowAt[i] + 0.6}>
            <Unit x={UB} y={ROW[i]} w={UW} name="consumer" upAt={up[i][1]} order={i === 0 ? 1 : i === 1 ? 2 : 'tuỳ ý'} t={t} />
          </Rise>
          <Wire from={{ x: UA + UW + 4, y: wy(i) }} to={{ x: UB - 6, y: wy(i) }} color={INK.line} p={move(t, rowAt[i] + 0.8, 0.4)} flow={t} />
          {t >= doneAt[i] + 0.2 && <Icon3D name="tick" x={1780} y={wy(i)} size={100} t={t} at={doneAt[i] + 0.2} />}
        </div>
      ))}
      {/* data flowing in each row: old records (blue) until the producer is on v2, then new records (green) */}
      <Packets t={t} from={{ x: UA + UW + 20, y: wy(0) }} to={{ x: UB - 20, y: wy(0) }} start={at(c, 0, 0.3)} end={up[0][0]} every={0.45} len={0.6} size={18} />
      <Packets t={t} from={{ x: UA + UW + 20, y: wy(0) }} to={{ x: UB - 20, y: wy(0) }} start={up[0][0] + 0.2} end={a2} every={0.45} len={0.6} size={18} color={INK.good} />
      <Packets t={t} from={{ x: UA + UW + 20, y: wy(1) }} to={{ x: UB - 20, y: wy(1) }} start={up[1][0] + 0.2} end={up[1][1]} every={0.45} len={0.6} size={18} color={INK.good} />
      <Packets t={t} from={{ x: UA + UW + 20, y: wy(1) }} to={{ x: UB - 20, y: wy(1) }} start={up[1][1] + 0.2} end={a3} every={0.45} len={0.6} size={18} color={INK.good} />
      <Packets t={t} from={{ x: UA + UW + 20, y: wy(2) }} to={{ x: UB - 20, y: wy(2) }} start={a3 + 0.3} every={0.45} len={0.6} size={18} />
      {t >= a1 + 0.2 && t < at(c, 1, 0.55) && <Pill x={UB + UW / 2} y={ROW[0] - 72} center text="đọc được cả tin cũ lẫn mới" color={INK.good} o={sp(t, a1 + 0.2)} />}
      {t >= at(c, 2, 0.6) && t < a3 && <Pill x={UB + UW / 2} y={ROW[1] - 72} center text="consumer cũ vẫn đọc được" color={INK.good} o={sp(t, at(c, 2, 0.6))} />}
      {t >= a3 + 2.4 && <Pill x={UB + UW / 2} y={ROW[2] - 72} center text="thứ tự nào cũng được" color={INK.good} o={sp(t, a3 + 2.4)} />}
    </SoftScene>
  )
}

/* ------------------------------------------------------------------ 7. summary */

function summary(t: number, c: Cue) {
  return (
    <SoftTheme>
      <SummaryList t={t} cue={c} items={['Broker chỉ thấy byte: schema là hợp đồng', 'Tin = magic byte 0 + id 4 byte + dữ liệu', 'Registry chặn schema không tương thích', 'Ai nâng cấp trước do chế độ quyết định']} />
    </SoftTheme>
  )
}

const RENDERS: Record<string, LessonScene['render']> = { hook, contract, registry, wire, gate, compat, order, summary }

/** Key-moment sounds, timed to the same cue offsets the scenes animate on. */
const SFX: Record<string, SceneSfx[]> = {
  hook: [{ kind: 'error', at: (c) => at(c, 3, 0.35) }],
  contract: [{ kind: 'tick', at: (c) => c.at(1) + 0.3 + 30 * 0.07 }, { kind: 'ding', at: (c) => c.at(2) + 0.4 + 3 * 0.45 + 0.2 }],
  registry: [{ kind: 'ding', at: (c) => at(c, 2, 0.35) + 0.8 }, { kind: 'tick', at: (c) => at(c, 3, 0.45) + 1.0 + 0.8 }],
  wire: [{ kind: 'tick', at: (c) => at(c, 0, 0.25) + 4 * 0.4 + 0.2 }, { kind: 'ding', at: (c) => c.at(3) + 0.3 + 3 * 0.35 + 0.2 }],
  gate: [{ kind: 'error', at: (c) => at(c, 1, 0.55) + 0.8 }, { kind: 'ding', at: (c) => at(c, 3, 0.55) + 0.8 }],
  compat: [{ kind: 'error', at: (c) => at(c, 2, 0.55) }, { kind: 'error', at: (c) => at(c, 3, 0.8) }],
  order: [{ kind: 'ding', at: (c) => at(c, 0, 0.8) }, { kind: 'ding', at: (c) => at(c, 2, 0.5) }],
}

const q = (prompt: string, options: string[], answer: number, explain: string) => ({ kind: 'choice' as const, prompt, options, answer, explain })

export const schemaRegistryLesson: Lesson = {
  ...schemaRegistryScript,
  scenes: schemaRegistryScript.scenes.map((s) => ({ ...s, render: RENDERS[s.id], sfx: SFX[s.id] })),
  intro: [
    { kind: 'video', scenes: ['hook'] },
    {
      kind: 'quiz',
      title: 'Quick Quiz',
      questions: [q('Đoán trước khi học: producer đổi tên trường amount thành total trong JSON. Broker làm gì?', ['Từ chối tin vì sai định dạng', 'Nhận bình thường, vì với broker đó chỉ là byte', 'Tự đổi tên trường cho consumer', 'Báo lỗi cho consumer'], 1, 'Broker không mở tin ra nên không thể kiểm tra. Việc kiểm tra hợp đồng phải nằm ở phía client, với Schema Registry hỗ trợ.')],
    },
  ],
  roadmap: [
    'Chặng 1: Vì sao cần schema: hợp đồng giữa producer và consumer, và định dạng Avro, Protobuf, JSON Schema.',
    'Chặng 2: Schema Registry cấp id, wire format năm byte đầu, và vai trò người gác cổng.',
    'Chặng 3: BACKWARD, FORWARD, FULL và thứ tự nâng cấp producer, consumer.',
  ],
  sections: [
    {
      id: 'vi-sao-can-schema',
      title: 'Vì sao cần schema',
      blocks: [
        { kind: 'p', text: '**Vấn đề:** broker Kafka **không hiểu nội dung tin**. Với broker, value chỉ là một dãy byte (Module 1: broker cất nguyên thùng, không mở ra). Vậy ai đảm bảo consumer đọc hiểu được thứ producer ghi?' },
        { kind: 'video', scenes: ['contract'] },
        {
          kind: 'code',
          code: `Đội A gửi:   {"order_id": 42, "amount": 150000}
Đội A "dọn code":   {"order_id": 43, "total": 200000}

Broker: nhận bình thường (chỉ là byte).
Consumer đội B: đọc amount → null → crash, hoặc cộng 0 vào doanh thu mà không ai biết.`,
        },
        { kind: 'callout', tone: 'info', title: 'Hình ảnh: mẫu tờ khai ở phường', text: 'Phường in sẵn mẫu tờ khai: ô "Họ tên", ô "Ngày sinh". Người nộp và cán bộ đều nhìn cùng một mẫu. Nếu mỗi người tự viết theo kiểu riêng trên giấy trắng, cán bộ phải đoán từng tờ. **Schema chính là mẫu tờ khai.**' },
        {
          kind: 'table',
          head: ['Định dạng', 'Đặc điểm', 'Ghi chú'],
          rows: [
            ['**Avro**', 'Nhị phân, gọn, schema viết bằng JSON', 'Phổ biến nhất trong hệ Kafka, luật tương thích rõ ràng'],
            ['**Protobuf**', 'Nhị phân, gọn, schema viết bằng file `.proto`', 'Hợp khi công ty đã dùng gRPC'],
            ['**JSON Schema**', 'Tin vẫn là JSON dễ đọc, schema mô tả ràng buộc', 'Dễ debug nhưng tin to hơn'],
          ],
        },
        { kind: 'p', text: '**Con số:** tin `{"order_id":42,"amount":150000}` dạng JSON tốn **31 byte**, vì lặp lại tên trường trong **mọi** tin. Dạng Avro chỉ chứa giá trị: 42 → 1 byte, 150000 → 3 byte, tổng **4 byte**. Tên trường nằm trong schema, không nằm trong tin.' },
        {
          kind: 'list',
          items: [
            { title: 'Kiểm tra ở client', text: 'broker không kiểm tra nội dung, nên hợp đồng dữ liệu phải được kiểm tra ở serializer (producer) và deserializer (consumer).' },
            { title: 'Breaking change', text: 'thay đổi làm consumer **đang chạy** không đọc được dữ liệu mới, hoặc consumer mới không đọc được dữ liệu cũ còn trong topic.' },
            { title: 'Dữ liệu sống lâu', text: 'retention nhiều ngày, compaction có thể mãi mãi, nên tin cũ có thể được đọc lại sau 6 tháng bằng code mới.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Vì sao broker không thể tự chặn tin "sai định dạng" như database chặn INSERT sai kiểu?', ['Broker quá chậm', 'Broker coi value là byte mờ đục, lưu nguyên thùng, không parse nên không biết có trường nào', 'Kafka không hỗ trợ schema', 'Do chạy trên nhiều máy'], 1, 'Việc kiểm tra nằm ở serializer/deserializer phía client.'),
            q('Topic retention 7 ngày, hôm nay consumer lên code mới. Vì sao code mới vẫn phải đọc được định dạng cũ?', ['Không cần, tin cũ tự được nâng cấp', 'Trong topic vẫn còn tin 7 ngày trước, và consumer có thể tụt lag hoặc reset offset về đầu', 'Vì broker yêu cầu', 'Chỉ khi bật compaction'], 1, 'Dữ liệu trong log không bị "nâng cấp" theo code.'),
          ],
        },
      ],
    },
    {
      id: 'registry-wire-format',
      title: 'Schema Registry và wire format',
      blocks: [
        { kind: 'p', text: '**Vấn đề:** nếu schema Avro (vài trăm byte) gửi kèm **mọi** tin, tin 4 byte thành 400 byte. Không gửi kèm thì consumer lấy schema ở đâu? **Giải pháp:** một dịch vụ riêng lưu schema, mỗi schema được cấp **một số id**; tin chỉ mang số id đó.' },
        { kind: 'video', scenes: ['registry'] },
        {
          kind: 'code',
          code: `Producer                         Schema Registry                Consumer
   │  1. đăng ký schema Order v1 ──▶ lưu, trả về id = 42
   │  2. gửi tin: [0][00 00 00 2A][dữ liệu Avro]  ──▶ Kafka ──▶ đọc tin
   │                                                  3. thấy id 42, hỏi Registry ◀──
   │                                                     (rồi cache lại, lần sau khỏi hỏi)`,
        },
        { kind: 'video', scenes: ['wire'] },
        {
          kind: 'table',
          head: ['Byte', 'Nội dung', 'Ví dụ'],
          rows: [
            ['0', '**Magic byte**, luôn là `0`', '`00`'],
            ['1–4', '**Schema id**, số nguyên 4 byte', '`00 00 00 2A` = 42'],
            ['5…', 'Dữ liệu đã mã hoá (Avro nhị phân; Protobuf có thêm vài byte chỉ mục message)', '`54 E0 A7 12`'],
          ],
        },
        { kind: 'callout', tone: 'info', title: 'Hình ảnh: mã số mẫu đơn', text: 'Thay vì kẹp cả quyển hướng dẫn vào mỗi tờ khai, góc tờ khai chỉ ghi "Mẫu số CT01". Cán bộ tra sổ mẫu một lần là biết từng ô nghĩa là gì. Chi phí mỗi tin chỉ thêm **5 byte**.' },
        { kind: 'video', scenes: ['gate'] },
        { kind: 'p', text: '**Registry còn là "người gác cổng":** khi producer đăng ký schema mới, Registry kiểm tra schema mới có **tương thích** với schema cũ không (mục tiếp theo). Không tương thích → từ chối đăng ký → producer không gửi được → lỗi bị chặn **trước khi** dữ liệu xấu vào topic.' },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Giấy phép (dễ nhầm)',
          text: '**Confluent Schema Registry** dùng **Confluent Community License**, không phải Apache: dùng nội bộ miễn phí, nhưng cấm bán thành dịch vụ SaaS cạnh tranh với Confluent, và **không** nằm trong dự án Apache Kafka. Lựa chọn **Apache 2.0**: **Apicurio Registry** (Red Hat) và **Karapace** (Aiven), cả hai có API tương thích nên serializer của Confluent dùng được.',
        },
        {
          kind: 'list',
          items: [
            { title: 'Subject', text: 'tên nhóm các phiên bản schema, mặc định `<topic>-value` và `<topic>-key`. Kiểm tra tương thích chạy **trong một subject**.' },
            { title: 'Lưu trong `_schemas`', text: 'Registry lưu schema trong một topic Kafka **compacted** (Module 7): key là (subject, version).' },
            { title: 'Cache', text: 'consumer cache schema theo id, nên Registry sập thì client đang chạy vẫn đọc được các id đã gặp; chỉ id **mới** mới cần hỏi.' },
            { title: 'Phía code Java', text: 'đăng ký và tra id do `KafkaAvroSerializer` làm; chỉ cần cấu hình `schema.registry.url`. Nó nhận lớp sinh từ schema hoặc `GenericRecord`, **không** nhận POJO thường. (📘 sách, ch.3)' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Tin 4 byte, schema 300 byte. Nhét schema vào mỗi tin thì mỗi tin to hơn bao nhiêu so với cách dùng id (9 byte)?', ['Bằng nhau', 'Khoảng 34 lần: 304 byte so với 9 byte', 'Khoảng 2 lần', 'Nhỏ hơn'], 1, 'Nhân với hàng tỷ tin là tốn đĩa, mạng, CPU. Schema giống nhau nên chỉ lưu một lần, tin trỏ bằng id.'),
            q('Consumer nhận tin có 5 byte đầu là 00 00 00 00 07. Nó làm gì tiếp?', ['Bỏ tin vì sai định dạng', 'Magic byte 0 đúng, schema id = 7: tra cache, chưa có thì hỏi Registry, rồi giải mã phần còn lại', 'Đoán schema từ nội dung', 'Hỏi broker'], 1, 'Dữ liệu Avro không chứa tên trường, thiếu schema thì chỉ là byte vô nghĩa.'),
            q('Vì sao Registry kiểm tra tương thích chặn lỗi sớm hơn cách để consumer tự phát hiện?', ['Registry nhanh hơn consumer', 'Kiểm tra lúc đăng ký, trước tin đầu tiên; còn tin xấu đã vào log thì không xoá từng tin được', 'Registry sửa tin giúp', 'Không sớm hơn'], 1, 'Log chỉ ghi nối đuôi, và mọi consumer khác cũng sẽ vấp phải tin xấu.'),
          ],
        },
      ],
    },
    {
      id: 'compatibility',
      title: 'Compatibility: BACKWARD, FORWARD, FULL',
      blocks: [
        { kind: 'p', text: '**Vấn đề:** schema rồi cũng phải đổi, nhưng producer và consumer **không được nâng cấp cùng một giây**. Luôn có lúc **code cũ gặp dữ liệu mới**, hoặc **code mới gặp dữ liệu cũ**.' },
        { kind: 'video', scenes: ['compat'] },
        {
          kind: 'table',
          head: ['Thay đổi sang v2', 'Code mới (v2) đọc tin cũ (v1)?', 'Code cũ (v1) đọc tin mới (v2)?'],
          rows: [
            ['(a) Thêm `note: string`, **có default** `""`', '✅ tin cũ thiếu `note` → điền default', '✅ code cũ bỏ qua trường lạ'],
            ['(b) Thêm `note: string`, **không default**', '❌ tin cũ thiếu `note`, không có gì để điền', '✅ bỏ qua trường lạ'],
            ['(c) Bỏ trường `amount` (không có default)', '✅ code mới bỏ qua `amount` thừa', '❌ code cũ cần `amount`, tin mới không có'],
          ],
        },
        {
          kind: 'list',
          items: [
            { title: 'BACKWARD', text: '(mặc định của Confluent) schema mới đọc được dữ liệu **cũ**. Cho phép (a), (c). Chặn (b).' },
            { title: 'FORWARD', text: 'schema cũ đọc được dữ liệu **mới**. Cho phép (a), (b). Chặn (c).' },
            { title: 'FULL', text: 'cả hai chiều. Chỉ cho phép (a), và bỏ trường **có** default.' },
            { title: 'NONE', text: 'không kiểm tra. Nguy hiểm.' },
          ],
        },
        { kind: 'callout', tone: 'tip', title: 'Vì sao Avro điền default và bỏ qua trường lạ được?', text: 'Khi giải mã, Avro dùng **hai** schema cùng lúc: **writer schema** (schema producer đã dùng để ghi, lấy từ Registry nhờ schema id) và **reader schema** (schema code consumer mong đợi). Avro so theo tên trường: trường có ở writer mà reader không cần thì bỏ qua; trường reader cần mà writer không có thì lấy default. Đó là lý do thật sự cần Registry: để có **đúng schema lúc ghi**. (📘 sách, ch.3)' },
        { kind: 'video', scenes: ['order'] },
        {
          kind: 'table',
          head: ['Chế độ', 'Nâng cấp ai trước', 'Vì sao'],
          rows: [
            ['BACKWARD', '**Consumer trước**', 'Consumer mới đọc được cả tin cũ lẫn mới; producer chỉ đổi sau khi mọi consumer sẵn sàng'],
            ['FORWARD', '**Producer trước**', 'Consumer cũ vẫn đọc được tin mới'],
            ['FULL', 'Thứ tự nào cũng được', 'Hai chiều đều đọc được'],
          ],
        },
        { kind: 'callout', tone: 'info', title: 'Hình ảnh: đổi mẫu tờ khai', text: 'Phường thêm ô "Số điện thoại (không bắt buộc)". Cán bộ cầm mẫu mới gặp tờ khai cũ → để trống, vẫn xử lý được (BACKWARD). Cán bộ chưa tập huấn gặp tờ khai mới → lờ ô lạ đi (FORWARD). Nhưng nếu phường **bỏ** ô "Họ tên" mà cán bộ cũ bắt buộc phải có → cán bộ cũ kẹt.' },
        {
          kind: 'list',
          items: [
            { title: 'An toàn mọi chiều', text: 'chỉ thêm hoặc bỏ trường có giá trị default.' },
            { title: 'Đổi tên trường', text: 'là bỏ trường cũ + thêm trường mới, nên thường phá tương thích (Avro có `aliases` đỡ một phần ở phía đọc).' },
            { title: '🎓 `_TRANSITIVE`', text: 'BACKWARD/FORWARD/FULL chỉ so với **phiên bản liền trước**; bản `_TRANSITIVE` so với **mọi** phiên bản cũ. Topic giữ dữ liệu rất lâu thì transitive an toàn hơn.' },
            { title: '🎓 Protobuf', text: 'không có "default bắt buộc" như Avro; điều cấm kỵ là **dùng lại số thứ tự (tag)** của trường đã xoá.' },
          ],
        },
        {
          kind: 'quiz',
          title: 'Quick Quiz',
          questions: [
            q('Topic ở chế độ BACKWARD. Bạn thêm discount: long không có default. Registry có cho đăng ký không?', ['Có', 'Không, vì tin cũ không có discount và schema mới không có default để điền. Sửa: thêm "default": 0', 'Chỉ khi đổi sang NONE', 'Có, nhưng cảnh báo'], 1, 'BACKWARD yêu cầu schema mới đọc được tin cũ.'),
            q('Ở BACKWARD, vì sao phải deploy consumer trước producer?', ['Cho đẹp', 'BACKWARD chỉ đảm bảo code mới đọc được tin cũ, không đảm bảo code cũ đọc được tin mới', 'Vì consumer nhanh hơn', 'Không cần'], 1, 'Nếu producer đổi trước, consumer cũ có thể gặp tin mới mà nó không hiểu.'),
            q('Vì sao xoá amount (không default) qua được BACKWARD mà phá FORWARD?', ['Do Avro lỗi', 'Code mới gặp tin cũ chỉ bỏ qua trường thừa; code cũ cần amount mà tin mới không có và schema cũ không có default', 'Do Registry chọn ngẫu nhiên', 'Do compaction'], 1, 'Hai chiều đọc khác nhau, nên mỗi chế độ chặn một nhóm thay đổi khác nhau.'),
          ],
        },
      ],
    },
    {
      id: 'thuc-hanh',
      title: 'Thực hành: đổi schema và chế độ compatibility',
      blocks: [
        { kind: 'p', text: 'Chọn một thay đổi từ Order v1 sang v2 và chế độ của subject. Quan sát code mới đọc tin cũ, code cũ đọc tin mới, quyết định của Registry và thứ tự nâng cấp.' },
        { kind: 'widget', name: 'schema-lab' },
      ],
    },
    {
      id: 'tom-tat-video',
      title: 'Nhìn lại cả bài',
      blocks: [{ kind: 'video', scenes: ['summary'] }],
    },
  ],
  finalQuiz: [
    q('Vì sao cần schema khi dùng Kafka?', ['Để broker nén tin tốt hơn', 'Broker không hiểu nội dung, nên producer và consumer cần một hợp đồng chung được kiểm tra ở client', 'Để tăng số partition', 'Để giảm replication'], 1, 'Broker chỉ thấy byte, nên đổi tên trường cũng không bị chặn nếu không có schema.'),
    q('Năm byte đầu của tin theo wire format của Confluent gồm gì?', ['Offset và timestamp', 'Magic byte 0 và schema id 4 byte', 'Độ dài tin và checksum', 'Tên topic'], 1, 'Mỗi tin chỉ thêm 5 byte thay vì cả schema.'),
    q('Registry ở chế độ FORWARD. Bạn bỏ trường amount (không default) khỏi schema. Điều gì xảy ra?', ['Được chấp nhận', 'Bị từ chối, vì code cũ cần amount mà tin mới không còn', 'Consumer tự điền', 'Tin bị xoá'], 1, 'FORWARD yêu cầu schema cũ đọc được tin mới.'),
    q('Chế độ BACKWARD thì nâng cấp bên nào trước?', ['Producer', 'Consumer', 'Broker', 'Thứ tự nào cũng được'], 1, 'Consumer mới đọc được cả tin cũ lẫn mới; sau đó producer mới đổi.'),
    {
      kind: 'open',
      prompt: 'Giải thích bằng lời của bạn (nhớ có "vì"): vì sao Schema Registry kiểm tra tương thích chặn lỗi sớm hơn việc để consumer tự phát hiện?',
      keywords: ['đăng ký', 'trước', 'log', 'tin xấu'],
      modelAnswer: 'Vì kiểm tra diễn ra lúc đăng ký schema, trước khi ghi tin đầu tiên: schema không tương thích bị từ chối nên producer không gửi được. Còn để consumer tự phát hiện thì tin xấu đã nằm trong log, log chỉ ghi nối đuôi nên không xoá từng tin được, và mọi consumer khác cũng sẽ vấp.',
    },
  ],
  recap: {
    journey:
      'Broker chỉ thấy byte nên đổi tên trường cũng lọt → schema là hợp đồng → Registry cấp id, tin chỉ mang magic byte cùng bốn byte id → Registry gác cổng, chặn schema không tương thích → BACKWARD thì consumer nâng cấp trước, FORWARD thì producer trước, FULL thì thứ tự nào cũng được.',
    points: [
      { title: 'Hợp đồng', text: 'Broker không mở tin ra, nên schema được kiểm tra ở serializer/deserializer phía client.' },
      { title: 'Wire format', text: 'Magic byte 0 + schema id 4 byte + dữ liệu: chỉ thêm 5 byte mỗi tin; consumer cache schema theo id.' },
      { title: 'Người gác cổng', text: 'Registry từ chối schema không tương thích ngay lúc đăng ký, trước khi tin xấu vào topic.' },
      { title: 'Thứ tự nâng cấp', text: 'BACKWARD: consumer trước. FORWARD: producer trước. FULL: thứ tự nào cũng được. Chỉ thêm hoặc bỏ trường có default thì an toàn mọi chiều.' },
    ],
    next: 'Bài tiếp theo: Kafka Connect (Module 8).',
  },
}
