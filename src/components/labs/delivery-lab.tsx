import { useState } from 'react'

/** Small stat tile (same markup as the shared widgets). */
function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`wg-stat ${tone}`}>
      <div className="wg-stat-label">{label}</div>
      <div className="wg-stat-value">{value}</div>
    </div>
  )
}

type Mode = 'amo' | 'alo' | 'txn'

const N = 10
const FIRST = 100
const AMOUNT = 100

const MODES: [Mode, string][] = [
  ['amo', 'At-most-once: commit → xử lý'],
  ['alo', 'At-least-once: xử lý → commit'],
  ['txn', 'Exactly-once: xử lý + commit một khối (Kafka → Kafka)'],
]

/**
 * How many times each of the 10 messages (offset 100..109) is processed after the consumer dies once and restarts.
 * `done` = messages processed before the crash.
 */
function run(mode: Mode, crash: boolean, done: number): { counts: number[]; committed: number } {
  if (!crash) return { counts: Array(N).fill(1), committed: FIRST + N }
  if (mode === 'amo') return { counts: Array.from({ length: N }, (_, i) => (i < done ? 1 : 0)), committed: FIRST + N }
  if (mode === 'alo') return { counts: Array.from({ length: N }, (_, i) => (i < done ? 2 : 1)), committed: FIRST + N }
  // transaction: the half-done batch is aborted and nothing from it is visible, so the retry processes each message once
  return { counts: Array(N).fill(1), committed: FIRST + N }
}

const fmt = (n: number) => n.toLocaleString('vi-VN')

export default function DeliveryLab() {
  const [mode, setMode] = useState<Mode>('alo')
  const [crash, setCrash] = useState(true)
  const [done, setDone] = useState(5)
  const [idem, setIdem] = useState(false)

  const { counts, committed } = run(mode, crash, done)
  const lost = counts.filter((c) => c === 0).length
  const repeated = counts.filter((c) => c > 1).length
  const effects = counts.map((c) => (idem && c > 1 ? 1 : c))
  const balance = effects.reduce((a, c) => a + c * AMOUNT, 0)
  const target = N * AMOUNT

  const verdict = lost ? 'Mất tin' : repeated ? 'Lặp tin' : 'Đúng một lần'
  const note = !crash
    ? 'Không có sự cố thì cả ba cách đều cho kết quả đúng. Khác biệt chỉ lộ ra khi consumer chết giữa chừng.'
    : mode === 'amo'
      ? `Kẹp đã nhảy tới ${committed} trước khi xử lý, nên ${N - done} tin chưa xử lý bị bỏ qua vĩnh viễn. Bật idempotent cũng không lấy lại được tin đã mất.`
      : mode === 'alo'
        ? `Kẹp vẫn ở ${FIRST} vì chưa kịp commit, nên ${done} tin đã xử lý bị đọc lại và xử lý lần hai. ${idem ? 'Consumer idempotent bỏ qua lần hai nên số dư vẫn đúng.' : 'Bật idempotent để lần hai không còn tác dụng.'}`
        : 'Kết quả và offset nằm trong cùng một transaction: chết giữa chừng thì cả hai bị huỷ, đọc lại xử lý đúng một lần. Chỉ đúng khi kết quả được ghi vào Kafka; ghi ra database ngoài thì quay về at-least-once + idempotent.'

  return (
    <div className="wg">
      <div className="wg-head">
        <span className="wg-badge">Mô phỏng</span>
        <h4>Consumer chết một lần giữa mẻ 100..109</h4>
      </div>
      <div className="wg-controls">
        <label>
          <span>
            Thứ tự:{' '}
            <select className="wg-input" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              {MODES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label>
          <span>
            <input type="checkbox" checked={crash} onChange={(e) => setCrash(e.target.checked)} /> Consumer chết giữa chừng
          </span>
        </label>
        <label>
          <span>
            Đã xử lý trước khi chết: <b>{done}</b> / {N} tin
          </span>
          <input type="range" min={0} max={N} step={1} value={done} disabled={!crash} onChange={(e) => setDone(+e.target.value)} />
        </label>
        <label>
          <span>
            <input type="checkbox" checked={idem} onChange={(e) => setIdem(e.target.checked)} /> Consumer idempotent (bảng dedupe)
          </span>
        </label>
      </div>
      <div style={{ display: 'flex', gap: 6, margin: '12px 0 4px' }}>
        {counts.map((c, i) => {
          const eff = effects[i]
          const bad = c === 0
          const dup = c > 1 && !idem
          return (
            <div
              key={i}
              style={{
                flex: 1,
                minWidth: 0,
                height: 64,
                borderRadius: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                border: bad ? '2px dashed #ff5a6a' : `2px solid ${dup ? '#ffb547' : '#60a5fa'}`,
                background: bad ? 'transparent' : dup ? 'linear-gradient(180deg, #b45309, #78350f)' : 'linear-gradient(180deg, #3b82f6, #1e40af)',
              }}
            >
              <span style={{ fontWeight: 900, fontSize: 16 }}>{FIRST + i}</span>
              <span style={{ fontSize: 12, opacity: 0.9 }}>{bad ? 'mất' : eff > 1 ? `×${eff}` : c > 1 ? 'bỏ lần 2' : '✓'}</span>
            </div>
          )
        })}
      </div>
      <div className="wg-stats">
        <Stat label="Tin bị mất" value={`${lost}`} tone={lost ? 'bad' : 'good'} />
        <Stat label="Tin bị xử lý lặp" value={`${repeated}`} tone={repeated ? (idem ? 'good' : 'bad') : 'good'} />
        <Stat label={`Số dư (mục tiêu ${fmt(target)})`} value={fmt(balance)} tone={balance === target ? 'good' : 'bad'} />
        <Stat label="Kết luận" value={verdict} tone={verdict === 'Đúng một lần' ? 'good' : 'bad'} />
      </div>
      <p className="wg-note">{note}</p>
      <p className="wg-note">Thử: at-least-once chết sau 5 tin, rồi bật idempotent; at-most-once chết sớm (0 tin) để thấy cả mẻ biến mất.</p>
    </div>
  )
}
