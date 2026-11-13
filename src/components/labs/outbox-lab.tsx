import { useState, type CSSProperties } from 'react'

/**
 * Outbox / inbox simulator. Pick how the order service publishes (two plain writes in either order, or an outbox
 * drained by a polling publisher or by CDC), pick where the process dies, and see what ends up in the database, on
 * the Kafka topic, and what the consumer applies (with or without an inbox table).
 */

type Approach = 'db-first' | 'kafka-first' | 'outbox-poll' | 'outbox-cdc'
type Tone = 'good' | 'bad' | 'warn'

interface Crash {
  id: string
  label: string
}

const APPROACHES: { id: Approach; label: string }[] = [
  { id: 'db-first', label: 'Ghi kép: DB trước, Kafka sau' },
  { id: 'kafka-first', label: 'Ghi kép: Kafka trước, DB sau' },
  { id: 'outbox-poll', label: 'Outbox + polling publisher' },
  { id: 'outbox-cdc', label: 'Outbox + CDC (Debezium)' },
]

const CRASHES: Record<Approach, Crash[]> = {
  'db-first': [
    { id: 'none', label: 'Không sự cố' },
    { id: 'before', label: 'Chết trước khi INSERT DB' },
    { id: 'between', label: 'Chết sau INSERT DB, trước khi gửi Kafka' },
  ],
  'kafka-first': [
    { id: 'none', label: 'Không sự cố' },
    { id: 'before', label: 'Chết trước khi gửi Kafka' },
    { id: 'between', label: 'Chết sau khi gửi Kafka, trước INSERT DB' },
    { id: 'rollback', label: 'INSERT DB vi phạm ràng buộc, rollback' },
  ],
  'outbox-poll': [
    { id: 'none', label: 'Không sự cố' },
    { id: 'before-commit', label: 'Chết trước COMMIT' },
    { id: 'delay', label: 'Đã COMMIT, poller chưa chạy (chết một lúc)' },
    { id: 'after-send', label: 'Poller chết sau khi gửi, trước khi đánh dấu sent' },
  ],
  'outbox-cdc': [
    { id: 'none', label: 'Không sự cố' },
    { id: 'before-commit', label: 'Chết trước COMMIT' },
    { id: 'delay', label: 'Đã COMMIT, Debezium dừng một lúc' },
    { id: 'after-send', label: 'Debezium chết sau khi gửi, trước khi lưu vị trí log' },
  ],
}

interface Outcome {
  /** Order row exists in the database. */
  db: boolean
  /** Outbox row exists (outbox approaches only). */
  outbox: boolean | null
  /** Outbox row already marked as sent / log position saved. */
  marked: boolean | null
  /** Copies of the event on the Kafka topic. */
  copies: number
  /** The event shows up late (but is not lost). */
  late: boolean
  note: string
}

function simulate(approach: Approach, crash: string): Outcome {
  switch (approach) {
    case 'db-first':
      if (crash === 'before') return { db: false, outbox: null, marked: null, copies: 0, late: false, note: 'Chưa ghi gì, cả hai bên cùng trống: nhất quán.' }
      if (crash === 'between') return { db: true, outbox: null, marked: null, copies: 0, late: false, note: 'DB đã commit, Kafka chưa nhận gì và không ai thử lại: đơn ma.' }
      return { db: true, outbox: null, marked: null, copies: 1, late: false, note: 'Không sự cố: cả hai bên cùng có. May mắn, không phải bảo đảm.' }
    case 'kafka-first':
      if (crash === 'before') return { db: false, outbox: null, marked: null, copies: 0, late: false, note: 'Chưa ghi gì, cả hai bên cùng trống: nhất quán.' }
      if (crash === 'between') return { db: false, outbox: null, marked: null, copies: 1, late: false, note: 'Sự kiện đã nằm trên Kafka nhưng DB không có đơn: sự kiện ma.' }
      if (crash === 'rollback') return { db: false, outbox: null, marked: null, copies: 1, late: false, note: 'Kafka đã có sự kiện, DB rollback: sự kiện ma, kho xuất hàng cho đơn không tồn tại.' }
      return { db: true, outbox: null, marked: null, copies: 1, late: false, note: 'Không sự cố: cả hai bên cùng có.' }
    default: {
      if (crash === 'before-commit') return { db: false, outbox: false, marked: null, copies: 0, late: false, note: 'Chưa COMMIT nên dòng đơn và dòng outbox cùng không có: nhất quán.' }
      if (crash === 'delay') return { db: true, outbox: true, marked: false, copies: 1, late: true, note: 'Dòng outbox vẫn nằm trong DB; khi người chép chạy lại, sự kiện được gửi. Chỉ trễ, không mất.' }
      if (crash === 'after-send')
        return {
          db: true,
          outbox: true,
          marked: false,
          copies: 2,
          late: false,
          note: approach === 'outbox-poll' ? 'Đã gửi nhưng sent vẫn là false, lần sau gửi lại: tin trùng.' : 'Vị trí log chưa lưu, sau khi khởi động lại đọc lại đoạn log và gửi lại: tin trùng.',
        }
      return { db: true, outbox: true, marked: true, copies: 1, late: false, note: 'Không sự cố: một lần ghi nguyên tử, rồi chép sang Kafka đúng một lần.' }
    }
  }
}

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`wg-stat ${tone}`}>
      <div className="wg-stat-label">{label}</div>
      <div className="wg-stat-value">{value}</div>
    </div>
  )
}

const box: CSSProperties = { flex: '1 1 0', minWidth: 0, border: '1.5px solid rgba(110,160,255,0.45)', borderRadius: 12, padding: '10px 12px', background: 'rgba(12,30,96,0.35)' }
const boxTitle: CSSProperties = { fontSize: 13, fontWeight: 800, color: 'var(--muted)', marginBottom: 8 }

function Row({ text, tone = 'ok' }: { text: string; tone?: 'ok' | 'bad' | 'good' | 'warn' }) {
  const bg = tone === 'bad' ? 'linear-gradient(180deg,#ef4444,#7f1d1d)' : tone === 'good' ? 'linear-gradient(180deg,#16a34a,#14532d)' : tone === 'warn' ? 'linear-gradient(180deg,#f59e0b,#92400e)' : 'linear-gradient(180deg,#3b82f6,#1e40af)'
  return <div style={{ background: bg, color: '#fff', borderRadius: 8, padding: '6px 10px', fontWeight: 700, fontSize: 13, marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</div>
}

const Empty = ({ text }: { text: string }) => <div style={{ border: '1.5px dashed rgba(255,255,255,0.35)', borderRadius: 8, padding: '6px 10px', fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>{text}</div>

export default function OutboxLab() {
  const [approach, setApproach] = useState<Approach>('db-first')
  const [crash, setCrash] = useState('between')
  const [inbox, setInbox] = useState(false)

  const choices = CRASHES[approach]
  const safeCrash = choices.some((c) => c.id === crash) ? crash : 'none'
  const o = simulate(approach, safeCrash)
  const isOutbox = approach === 'outbox-poll' || approach === 'outbox-cdc'

  const applied = inbox ? Math.min(o.copies, 1) : o.copies
  const skipped = o.copies - applied
  const ghostOrder = o.db && o.copies === 0
  const ghostEvent = !o.db && o.copies > 0
  const duplicated = applied > 1
  const balance = 500000 + applied * 100000

  let verdict = 'Nhất quán: DB và Kafka khớp nhau'
  let tone: Tone = 'good'
  if (ghostOrder) [verdict, tone] = ['Đơn ma: có trong DB, Kafka không có sự kiện, Kho không biết', 'bad']
  else if (ghostEvent) [verdict, tone] = ['Sự kiện ma: Kafka có sự kiện cho đơn không tồn tại', 'bad']
  else if (duplicated) [verdict, tone] = [`Trùng: consumer xử lý ${applied} lần, cộng tiền sai ${(applied - 1) * 100000}`, 'bad']
  else if (skipped > 0) [verdict, tone] = [`Inbox bỏ qua ${skipped} bản trùng, kết quả vẫn đúng`, 'good']
  else if (o.late) [verdict, tone] = ['Không mất, không trùng, chỉ trễ cho tới khi người chép chạy lại', 'warn']
  else if (!o.db && o.copies === 0) [verdict, tone] = ['Nhất quán: cả hai bên cùng không có gì', 'good']

  return (
    <div className="wg">
      <div className="wg-head">
        <span className="wg-badge">Mô phỏng</span>
        <h4>Outbox, điểm chết và bảng inbox</h4>
      </div>
      <div className="wg-controls">
        <label>
          <span>
            Cách làm:{' '}
            <select
              className="wg-input"
              value={approach}
              onChange={(e) => {
                setApproach(e.target.value as Approach)
                setCrash('none')
              }}
            >
              {APPROACHES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label>
          <span>
            Điểm chết:{' '}
            <select className="wg-input" value={safeCrash} onChange={(e) => setCrash(e.target.value)}>
              {choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label>
          <span>
            <input type="checkbox" checked={inbox} onChange={(e) => setInbox(e.target.checked)} /> Consumer có bảng inbox
          </span>
        </label>
      </div>

      <div style={{ display: 'flex', gap: 12, padding: '6px 0 14px', flexWrap: 'wrap' }}>
        <div style={box}>
          <div style={boxTitle}>DATABASE</div>
          {o.db ? <Row text="orders · order-42" tone={ghostEvent ? 'bad' : 'ok'} /> : <Empty text="orders: chưa có order-42" />}
          {isOutbox && (o.outbox ? <Row text={`outbox · 9f1c · sent=${o.marked ? 'true' : 'false'}`} tone={o.marked ? 'good' : 'warn'} /> : <Empty text="outbox: chưa có dòng" />)}
        </div>
        <div style={box}>
          <div style={boxTitle}>KAFKA · orders</div>
          {o.copies === 0 ? <Empty text="chưa có sự kiện" /> : Array.from({ length: o.copies }, (_, i) => <Row key={i} text={`OrderPlaced · order-42${i > 0 ? ' (gửi lại)' : ''}`} tone={i > 0 ? 'bad' : ghostEvent ? 'bad' : 'ok'} />)}
        </div>
        <div style={box}>
          <div style={boxTitle}>CONSUMER · ví / kho</div>
          {o.copies === 0 ? <Empty text="không nhận gì" /> : <Row text={`nhận ${o.copies} bản · event_id 9f1c`} />}
          {inbox && o.copies > 0 && <Row text={`inbox: 9f1c đã ghi${skipped > 0 ? `, bỏ ${skipped} bản trùng` : ''}`} tone="good" />}
          {o.copies > 0 && <Row text={`số dư: ${balance.toLocaleString('vi-VN')}`} tone={duplicated ? 'bad' : 'ok'} />}
        </div>
      </div>

      <div className="wg-stats">
        <Stat label="Kết luận" value={verdict} tone={tone === 'warn' ? '' : tone} />
        <Stat label="Order trong DB" value={o.db ? 'có' : 'không'} tone={ghostEvent ? 'bad' : ''} />
        <Stat label="Bản sự kiện trên Kafka" value={`${o.copies}`} tone={o.copies > 1 ? 'bad' : ''} />
        <Stat label="Consumer áp dụng" value={`${applied} lần`} tone={duplicated ? 'bad' : 'good'} />
      </div>
      <p className="wg-note">
        {o.note} Thử: chọn &quot;Ghi kép&quot; rồi chết giữa hai bước để thấy đơn ma và sự kiện ma; chuyển sang outbox để mất mát biến thành trễ hoặc trùng; chọn &quot;chết sau khi gửi&quot; rồi bật inbox để tin trùng bị chặn bằng mã sự kiện.
      </p>
    </div>
  )
}
