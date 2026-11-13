import { useState } from 'react'

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`wg-stat ${tone}`}>
      <div className="wg-stat-label">{label}</div>
      <div className="wg-stat-value">{value}</div>
    </div>
  )
}

type Mode = 'auto' | 'after' | 'before'
type Threads = 'same' | 'other'

const BATCH = 100
const RATE = 50 // records per second the handler finishes

/**
 * Deterministic model of one consumer that polls batches of 100 records.
 * Same-thread handling: the next poll happens when the batch is done (every 2 s).
 * Other-thread handling: poll() returns at once and fires again every second.
 */
function simulate(mode: Mode, threads: Threads, interval: number, crash: number) {
  const pollEvery = threads === 'same' ? BATCH / RATE : 1
  const processed = Math.floor(crash * RATE)
  const polls = Math.floor(crash / pollEvery + 1e-9) + 1
  let committed = 0
  let commits = 0
  if (mode === 'auto') {
    // Auto commit runs inside poll(): it commits the position left by the previous polls.
    let last = 0
    for (let k = 1; k < polls; k++) {
      const at = k * pollEvery
      if (at - last >= interval) {
        committed = BATCH * k
        last = at
        commits++
      }
    }
  } else if (mode === 'after') {
    // Commit only once a whole batch has really been handled.
    committed = Math.min(BATCH * Math.floor(processed / BATCH), BATCH * polls)
    commits = Math.floor(processed / BATCH)
  } else {
    // Commit right after poll(), before handling.
    committed = BATCH * polls
    commits = polls
  }
  const repeated = Math.max(0, processed - committed)
  const lost = Math.max(0, committed - processed)
  return { processed, committed, repeated, lost, commits, polls }
}

const fmt = (n: number) => n.toLocaleString('vi-VN')

/** Pick when to commit and where to handle records, then crash the consumer and see where it resumes. */
export default function CommitLab() {
  const [mode, setMode] = useState<Mode>('auto')
  const [threads, setThreads] = useState<Threads>('same')
  const [interval, setIntervalSec] = useState(5)
  const [crash, setCrash] = useState(4.5)
  const r = simulate(mode, threads, interval, crash)
  const max = Math.max(r.processed, r.committed, 100)
  const pct = (n: number) => `${(n / max) * 100}%`
  const lo = Math.min(r.processed, r.committed)
  const hi = Math.max(r.processed, r.committed)
  const gapColor = r.lost ? '#ff5a6a' : '#ffb547'
  const verdict = r.lost ? `MẤT ${fmt(r.lost)} tin` : r.repeated ? `LẶP ${fmt(r.repeated)} tin` : 'Không mất, không lặp'
  const modes: [Mode, string][] = [
    ['auto', 'Auto commit (tự động)'],
    ['after', 'commitSync sau khi xử lý xong mẻ'],
    ['before', 'Commit ngay sau poll(), xử lý sau'],
  ]
  return (
    <div className="wg">
      <div className="wg-head">
        <span className="wg-badge">Mô phỏng</span>
        <h4>Consumer chết lúc nào, đọc lại từ đâu?</h4>
      </div>
      <div className="wg-controls">
        <label>
          <span>
            Cách commit:{' '}
            <select className="wg-input" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              {modes.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label>
          <span>
            Xử lý tin ở:{' '}
            <select className="wg-input" value={threads} onChange={(e) => setThreads(e.target.value as Threads)}>
              <option value="same">cùng luồng với poll() (xong mẻ mới poll tiếp)</option>
              <option value="other">luồng khác (poll tiếp ngay mỗi giây)</option>
            </select>
          </span>
        </label>
        {mode === 'auto' && (
          <label>
            <span>
              auto.commit.interval.ms: <b>{interval} giây</b>
            </span>
            <input type="range" min={1} max={30} step={1} value={interval} onChange={(e) => setIntervalSec(+e.target.value)} />
          </label>
        )}
        <label>
          <span>
            Consumer chết ở giây: <b>{crash.toString().replace('.', ',')}</b>
          </span>
          <input type="range" min={0.5} max={30} step={0.5} value={crash} onChange={(e) => setCrash(+e.target.value)} />
        </label>
      </div>
      <div style={{ margin: '14px 0 6px', fontSize: 13, opacity: 0.8 }}>Trục offset: đã xử lý xong, và chỗ kẹp (committed)</div>
      <div style={{ position: 'relative', height: 22, borderRadius: 11, background: 'rgba(110,160,255,0.15)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct(r.processed), background: 'linear-gradient(90deg,#2f66f2,#6aa8ff)' }} />
        {hi > lo && <div style={{ position: 'absolute', left: pct(lo), top: 0, bottom: 0, width: `${((hi - lo) / max) * 100}%`, background: gapColor, opacity: 0.85 }} />}
      </div>
      <div style={{ position: 'relative', height: 28, fontSize: 12 }}>
        <span style={{ position: 'absolute', left: pct(r.committed), top: 2, transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontWeight: 700 }}>▲ committed {fmt(r.committed)}</span>
      </div>
      <div className="wg-stats">
        <Stat label="Đã xử lý xong lúc chết" value={`${fmt(r.processed)} tin`} />
        <Stat label="Committed offset" value={fmt(r.committed)} />
        <Stat label="Khởi động lại đọc từ" value={fmt(r.committed)} />
        <Stat label="Kết quả" value={verdict} tone={r.lost ? 'bad' : r.repeated ? 'warn' : 'good'} />
        <Stat label="Số lần commit / số lần poll" value={`${r.commits} / ${r.polls}`} />
      </div>
      <p className="wg-note">
        Thử: auto commit, xử lý cùng luồng, chết ở giây 4,5 (lặp 225 tin). Rồi đổi sang luồng khác với auto commit để thấy tin bị mất. Chuyển sang commitSync sau khi xử lý xong mẻ: chỉ còn lặp tối đa một mẻ, không mất.
      </p>
    </div>
  )
}
