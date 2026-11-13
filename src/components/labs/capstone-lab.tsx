import { useState } from 'react'

/** One thing you must be able to prove with real output (log, count). `pts` of the group's total. */
interface Check {
  id: string
  text: string
  pts: number
}

interface Group {
  id: string
  title: string
  total: number
  bonus?: boolean
  checks: Check[]
}

/** Rubric of docs/kafka/11-capstone-project.md §6; the checks of each group add up to its total. */
const GROUPS: Group[] = [
  {
    id: 'm1',
    title: 'Cluster + topic (M1)',
    total: 10,
    checks: [
      { id: 'm1-a', text: '3 broker KRaft, `orders` 6 partition, RF=3, minISR=2 (R1.1, R1.2)', pts: 4 },
      { id: 'm1-b', text: '`orders.retry.1`, `orders.dlq` (retention ≥ 14 ngày), `order-status` compact (R1.3, R1.4)', pts: 3 },
      { id: 'm1-c', text: '`create-topics.sh` chạy lại không lỗi (R1.5)', pts: 3 },
    ],
  },
  {
    id: 'm2',
    title: 'Producer (M2)',
    total: 10,
    checks: [
      { id: 'm2-a', text: 'Key = orderId, `acks=all` (R2.2)', pts: 4 },
      { id: 'm2-b', text: '`enable.idempotence=true` đặt tường minh (R2.2)', pts: 3 },
      { id: 'm2-c', text: 'Có `expected.json`, `--duplicate-rate`, `--poison` (R2.3 – R2.5)', pts: 3 },
    ],
  },
  {
    id: 'm3',
    title: 'At-least-once + inbox (M3)',
    total: 20,
    checks: [
      { id: 'm3-a', text: 'AC2 đạt: số eventId = số sự kiện duy nhất, read model khớp 100%', pts: 6 },
      { id: 'm3-b', text: 'AC3 đạt: kill -9 một consumer, log có tin đọc lại nhưng bị bỏ qua', pts: 6 },
      { id: 'm3-c', text: 'Inbox và đổi trạng thái trong cùng một giao dịch SQLite (R3.3)', pts: 5 },
      { id: 'm3-d', text: 'Tắt auto commit, chỉ commit sau khi ghi xong (R3.2)', pts: 3 },
    ],
  },
  {
    id: 'm4',
    title: 'Read model (M4)',
    total: 10,
    checks: [
      { id: 'm4-a', text: 'AC1 đạt: 1.000 đơn khớp 100% `expected.json`, lag về 0', pts: 4 },
      { id: 'm4-b', text: 'AC9 đạt: replay từ đầu khớp bản đang chạy', pts: 4 },
      { id: 'm4-c', text: '`status-query` chỉ đọc từ `order-status`', pts: 2 },
    ],
  },
  {
    id: 'm5',
    title: 'Retry + DLQ (M5)',
    total: 15,
    checks: [
      { id: 'm5-a', text: 'AC6 đạt: đúng 10 tin trong `orders.dlq`, consumer chính không dừng', pts: 5 },
      { id: 'm5-b', text: 'AC7 đạt: lỗi tạm thời 2% cuối cùng đều được xử lý', pts: 5 },
      { id: 'm5-c', text: 'Đủ header: retry-count, original-topic/partition/offset, error', pts: 3 },
      { id: 'm5-d', text: 'Poison đi thẳng DLQ, không qua retry', pts: 2 },
    ],
  },
  {
    id: 'dur',
    title: 'Durability (AC4, AC5)',
    total: 10,
    checks: [
      { id: 'dur-a', text: 'AC4 đạt: dừng 1 broker, producer không lỗi, không mất tin', pts: 4 },
      { id: 'dur-b', text: 'AC5 đạt: dừng 2 broker, producer nhận lỗi thay vì "thành công" giả', pts: 4 },
      { id: 'dur-c', text: 'Giải thích đúng cơ chế acks=all + minISR', pts: 2 },
    ],
  },
  {
    id: 'mon',
    title: 'Giám sát (M6)',
    total: 10,
    checks: [
      { id: 'mon-a', text: 'AC8 đạt: dừng processor 2 phút, lag-monitor cảnh báo, bật lại lag về 0', pts: 5 },
      { id: 'mon-b', text: 'Cảnh báo khi lag > 500 trong 3 lần đo liên tiếp (R6.1)', pts: 3 },
      { id: 'mon-c', text: 'Output của 4 kịch bản diễn tập được lưu lại (R6.2)', pts: 2 },
    ],
  },
  {
    id: 'rep',
    title: 'REPORT.md',
    total: 15,
    checks: [
      { id: 'rep-1', text: 'Câu 1: vì sao 6 partition, tối đa mấy instance có ích', pts: 2 },
      { id: 'rep-2', text: 'Câu 2: vì sao key là orderId', pts: 2 },
      { id: 'rep-3', text: 'Câu 3: vì sao AC4 không mất còn AC5 từ chối ghi', pts: 2 },
      { id: 'rep-4', text: 'Câu 4: vì sao commit sau khi ghi SQLite', pts: 2 },
      { id: 'rep-5', text: 'Câu 5: vì sao `order-status` compact còn `orders` thì không', pts: 2 },
      { id: 'rep-6', text: 'Câu 6: xử lý mất thứ tự do retry, nêu đánh đổi', pts: 2 },
      { id: 'rep-7', text: 'Câu 7: ít nhất 3 giới hạn đã biết và cách sửa', pts: 3 },
    ],
  },
  {
    id: 'bonus',
    title: 'Thưởng: outbox (M7)',
    total: 10,
    bonus: true,
    checks: [
      { id: 'bonus-a', text: 'R7.1: ghi đơn + sự kiện vào `outbox` trong cùng giao dịch', pts: 5 },
      { id: 'bonus-b', text: 'R7.2: kill publisher giữa chừng, không mất tin, trùng thì inbox loại', pts: 5 },
    ],
  },
]

const BASE_MAX = GROUPS.filter((g) => !g.bonus).reduce((s, g) => s + g.total, 0)
const ALL: Check[] = GROUPS.flatMap((g) => g.checks)

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`wg-stat ${tone}`}>
      <div className="wg-stat-label">{label}</div>
      <div className="wg-stat-value">{value}</div>
    </div>
  )
}

/** Splits `code` spans of a check text into <code> nodes. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('`').map((part, i) => (i % 2 ? <code key={i}>{part}</code> : <span key={i}>{part}</span>))}
    </>
  )
}

function verdict(score: number): { label: string; tone: string } {
  if (score >= 85) return { label: 'Vững để làm production nhỏ', tone: 'good' }
  if (score >= 70) return { label: 'Hiểu đúng, cần luyện thêm sự cố', tone: '' }
  return { label: 'Quay lại module của hạng mục mất điểm', tone: 'bad' }
}

/** Capstone self-check: tick what you can prove with real output; the score and the weakest group update live. */
export default function CapstoneLab() {
  const [done, setDone] = useState<Record<string, boolean>>({})

  const toggle = (id: string) => setDone((d) => ({ ...d, [id]: !d[id] }))
  const groupScore = (g: Group) => g.checks.reduce((s, c) => s + (done[c.id] ? c.pts : 0), 0)
  const base = GROUPS.filter((g) => !g.bonus).reduce((s, g) => s + groupScore(g), 0)
  const bonus = groupScore(GROUPS[GROUPS.length - 1])
  const ticked = ALL.filter((c) => done[c.id]).length
  const v = verdict(base)

  const missing = GROUPS.filter((g) => !g.bonus)
    .map((g) => ({ g, lost: g.total - groupScore(g) }))
    .sort((a, b) => b.lost - a.lost)[0]

  const setAll = (value: boolean) => setDone(value ? Object.fromEntries(ALL.map((c) => [c.id, true])) : {})

  return (
    <div className="wg">
      <div className="wg-head">
        <span className="wg-badge">Tự chấm</span>
        <h4>Capstone: bảng tự chấm {BASE_MAX} điểm</h4>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={BASE_MAX}
          aria-valuenow={base}
          style={{ flex: 1, height: 18, borderRadius: 9, background: 'var(--bg-2)', border: '1px solid var(--border)', overflow: 'hidden', position: 'relative' }}
        >
          <div style={{ width: `${(base / BASE_MAX) * 100}%`, height: '100%', background: base >= 85 ? 'var(--good)' : 'var(--primary)', transition: 'width 0.25s' }} />
          <div title="85 điểm" style={{ position: 'absolute', left: '85%', top: 0, bottom: 0, width: 2, background: 'var(--muted)' }} />
        </div>
        <b style={{ fontSize: 20, minWidth: 130, textAlign: 'right' }}>
          {base} / {BASE_MAX}
          {bonus > 0 && <span style={{ color: 'var(--good)' }}> +{bonus}</span>}
        </b>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {GROUPS.map((g) => {
          const got = groupScore(g)
          const full = got === g.total
          return (
            <div key={g.id} style={{ border: `1px solid ${full ? 'var(--good)' : 'var(--border)'}`, borderRadius: 12, background: 'var(--bg-2)', padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <b>{g.title}</b>
                <span style={{ fontWeight: 800, color: full ? 'var(--good)' : 'var(--muted)' }}>
                  {g.bonus ? '+' : ''}
                  {got} / {g.total}
                </span>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {g.checks.map((c) => (
                  <label key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, cursor: 'pointer', color: done[c.id] ? 'var(--text)' : 'var(--muted)' }}>
                    <input type="checkbox" checked={!!done[c.id]} onChange={() => toggle(c.id)} style={{ marginTop: 3, accentColor: 'var(--primary)' }} />
                    <span style={{ flex: 1 }}>
                      <Rich text={c.text} />
                    </span>
                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{c.pts} đ</span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="wg-stats">
        <Stat label="Điểm tự chấm" value={`${base} / ${BASE_MAX}${bonus ? ` (+${bonus})` : ''}`} tone={base >= 85 ? 'good' : v.tone} />
        <Stat label="Đã chứng minh" value={`${ticked} / ${ALL.length} mục`} />
        <Stat label="Mất điểm nhiều nhất" value={missing && missing.lost > 0 ? `${missing.g.title} (−${missing.lost})` : 'không mất điểm'} tone={missing && missing.lost > 0 ? 'bad' : 'good'} />
        <Stat label="Thang" value={v.label} tone={v.tone} />
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="button" className="wg-input" onClick={() => setAll(true)} style={{ cursor: 'pointer' }}>
          Tick tất cả
        </button>
        <button type="button" className="wg-input" onClick={() => setAll(false)} style={{ cursor: 'pointer' }}>
          Xoá hết
        </button>
      </div>
      <p className="wg-note">Chỉ tick một mục khi bạn có output thật (log, số đếm) chứng minh, không phải "chắc là chạy". Thang: 85+ vững; 70–84 hiểu đúng; dưới 70 quay lại module ứng với hạng mục mất điểm.</p>
    </div>
  )
}
