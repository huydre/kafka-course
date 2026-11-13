import { useState, type CSSProperties } from 'react'

/**
 * Retry simulator. A partition holds N messages, each taking 1 second to process. One message fails a chosen number
 * of times (or is a poison message that always fails). Blocking retry waits in place; non-blocking retry copies the
 * message to retry-5s, then retry-1m, then the DLQ while the main consumer keeps going. The readout shows when each
 * message finishes, what the failing message costs the ones behind it, and whether same-key ordering is broken.
 */

type Mode = 'blocking' | 'non-blocking'

const N = 10
const POISON = 99
const RETRY_DELAYS = [5, 60]
const BLOCKING_DELAY = 5
const BLOCKING_LIMIT = 3

interface Result {
  done: number[]
  dlqAt?: number
  /** Where the failing message finished: main consumer, retry-5s, retry-1m or never. */
  trail: string[]
}

/** done[i] is the second message i+1 is finished on (Infinity = never). */
function simulate(mode: Mode, failAt: number, fails: number, limited: boolean): Result {
  const done: number[] = Array(N).fill(Infinity)
  const trail: string[] = []
  let dlqAt: number | undefined
  let t = 0
  for (let i = 1; i <= N; i++) {
    if (i !== failAt || fails === 0) {
      t += 1
      done[i - 1] = t
      continue
    }
    t += 1
    trail.push('orders: lỗi')
    if (mode === 'blocking') {
      let attempt = 1
      for (;;) {
        if (limited && attempt >= BLOCKING_LIMIT) {
          dlqAt = t
          trail.push('DLQ')
          break
        }
        if (!limited && attempt > 3) {
          // only a poison message gets here: unlimited retry never ends, everything behind it is stuck
          trail.push('thử mãi mãi')
          return { done, trail }
        }
        t += BLOCKING_DELAY + 1
        if (attempt >= fails) {
          done[i - 1] = t
          trail.push(`thử lần ${attempt + 1}: xong`)
          break
        }
        trail.push(`thử lần ${attempt + 1}: lỗi`)
        attempt += 1
      }
    } else {
      let ready = t
      let attempt = 1
      let finished = false
      for (const [k, delay] of RETRY_DELAYS.entries()) {
        ready += delay + 1
        trail.push(k === 0 ? 'retry-5s' : 'retry-1m')
        if (attempt >= fails) {
          done[i - 1] = ready
          trail.push('xong')
          finished = true
          break
        }
        attempt += 1
      }
      if (!finished) {
        dlqAt = ready
        trail.push('DLQ')
      }
    }
  }
  return { done, dlqAt, trail }
}

const fmt = (s: number): string => (!Number.isFinite(s) ? 'không bao giờ' : s < 90 ? `${s} giây` : `${(s / 60).toFixed(1).replace('.', ',')} phút`)

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`wg-stat ${tone}`}>
      <div className="wg-stat-label">{label}</div>
      <div className="wg-stat-value">{value}</div>
    </div>
  )
}

const FAIL_LABEL: Record<number, string> = { 0: 'không lỗi', 1: 'lỗi 1 lần', 2: 'lỗi 2 lần', 3: 'lỗi 3 lần', [POISON]: 'poison (luôn lỗi)' }

export default function RetryLab() {
  const [mode, setMode] = useState<Mode>('non-blocking')
  const [failAt, setFailAt] = useState(3)
  const [fails, setFails] = useState(POISON)
  const [sameKey, setSameKey] = useState(true)
  const [limited, setLimited] = useState(false)

  const r = simulate(mode, failAt, fails, limited)
  const baseline = (i: number) => i + 1
  const after = r.done.slice(failAt)
  const stuck = after.filter((d) => !Number.isFinite(d)).length
  const worstDelay = Math.max(0, ...after.filter(Number.isFinite).map((d, k) => d - baseline(failAt + k)))
  const failedDone = r.done[failAt - 1]
  const next = r.done[failAt]
  const orderBroken = fails > 0 && failAt < N && sameKey && Number.isFinite(next) && failedDone > next
  const last = r.done[N - 1]
  const inDlq = r.dlqAt !== undefined
  const order = r.done
    .map((d, i) => ({ id: i + 1, d }))
    .filter((m) => Number.isFinite(m.d))
    .sort((a, b) => a.d - b.d || a.id - b.id)

  const cell = (id: number): CSSProperties => {
    const isFail = id === failAt && fails > 0
    const finished = Number.isFinite(r.done[id - 1])
    const delayed = r.done[id - 1] > id + 0.5 && id !== failAt
    const base: CSSProperties = { height: 58, borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14, borderWidth: 2, borderStyle: 'solid', borderColor: 'transparent', minWidth: 0 }
    if (!finished) return { ...base, background: 'rgba(40,62,140,0.45)', borderColor: '#f87171', borderStyle: 'dashed' }
    if (isFail) return { ...base, background: 'linear-gradient(180deg,#f59e0b,#92400e)', borderColor: '#fbbf24' }
    if (delayed) return { ...base, background: 'linear-gradient(180deg,#3b82f6,#1e40af)', borderColor: '#f59e0b', borderStyle: 'dashed' }
    return { ...base, background: 'linear-gradient(180deg,#3b82f6,#1e40af)', borderColor: '#60a5fa' }
  }

  return (
    <div className="wg">
      <div className="wg-head">
        <span className="wg-badge">Mô phỏng</span>
        <h4>Một tin lỗi: chờ tại chỗ hay đưa sang retry topic</h4>
      </div>
      <div className="wg-controls">
        <label>
          <span>
            Kiểu retry:{' '}
            <select className="wg-input" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              <option value="blocking">blocking (đứng chờ tại chỗ)</option>
              <option value="non-blocking">non-blocking (retry-5s, retry-1m, DLQ)</option>
            </select>
          </span>
        </label>
        <label>
          <span>
            Tin lỗi:{' '}
            <select className="wg-input" value={failAt} onChange={(e) => setFailAt(Number(e.target.value))}>
              {Array.from({ length: N }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  #{i + 1}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label>
          <span>
            Kiểu lỗi:{' '}
            <select className="wg-input" value={fails} onChange={(e) => setFails(Number(e.target.value))}>
              {Object.entries(FAIL_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label>
          <span>
            <input type="checkbox" checked={sameKey} onChange={(e) => setSameKey(e.target.checked)} /> tin kế tiếp cùng key (vd OrderPaid sau OrderPlaced)
          </span>
        </label>
        <label>
          <span>
            <input type="checkbox" checked={limited} disabled={mode === 'non-blocking'} onChange={(e) => setLimited(e.target.checked)} /> blocking: giới hạn {BLOCKING_LIMIT} lần rồi vào DLQ
          </span>
        </label>
      </div>

      <div className="wg-strip" style={{ paddingTop: 30, paddingBottom: 26 }}>
        {Array.from({ length: N }, (_, i) => i + 1).map((id) => (
          <div key={id} style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
            <div style={cell(id)}>
              <span>#{id}</span>
              <span style={{ fontSize: 11, opacity: 0.9 }}>{id === failAt && fails > 0 ? 'tin lỗi' : sameKey && id === failAt + 1 && fails > 0 ? 'cùng key' : ''}</span>
            </div>
            <div style={{ textAlign: 'center', fontSize: 12, marginTop: 4, color: 'var(--muted)' }}>{Number.isFinite(r.done[id - 1]) ? `xong ${fmt(r.done[id - 1])}` : inDlq && id === failAt ? 'vào DLQ' : 'kẹt'}</div>
          </div>
        ))}
      </div>

      <div className="wg-stats">
        <Stat label="Hành trình tin lỗi" value={fails === 0 ? 'không lỗi' : r.trail.join(' → ')} />
        <Stat label="Tin sau nó bị kẹt" value={stuck ? `${stuck} tin không bao giờ xong` : worstDelay ? `trễ tối đa ${fmt(worstDelay)}` : 'không bị trễ'} tone={stuck ? 'bad' : worstDelay ? 'bad' : 'good'} />
        <Stat label={`Tin #${N} xong lúc`} value={fmt(last)} tone={Number.isFinite(last) ? (last > N + 1 ? 'bad' : 'good') : 'bad'} />
        <Stat label="Trong DLQ" value={inDlq ? `1 tin (#${failAt}), cần người xem` : 'không có'} tone={inDlq ? 'bad' : 'good'} />
      </div>
      <div className="wg-stats">
        <Stat label="Thứ tự xử lý thực tế" value={order.map((m) => `#${m.id}`).join(' ')} />
        <Stat label={`Thứ tự cùng key (#${failAt} → #${Math.min(N, failAt + 1)})`} value={fails === 0 || !sameKey || failAt === N ? 'không áp dụng' : orderBroken ? `ĐẢO: #${failAt + 1} chạy trước #${failAt}` : 'giữ nguyên'} tone={orderBroken ? 'bad' : 'good'} />
      </div>
      <p className="wg-note">
        Thử: chọn poison ở kiểu blocking không giới hạn để thấy mọi tin sau kẹt vĩnh viễn. Đổi sang non-blocking: các tin sau chạy bình thường, tin lỗi đi qua retry-5s, retry-1m rồi vào DLQ, nhưng tin kế tiếp cùng key chạy trước nó. Chọn lỗi 1 lần để thấy vì sao lỗi tạm thời thường qua được ở retry đầu.
      </p>
    </div>
  )
}
