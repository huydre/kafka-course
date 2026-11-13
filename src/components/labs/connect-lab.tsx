import { useState, type CSSProperties } from 'react'

/**
 * Kafka Connect simulator with two panels.
 * 1) Division of work: a source connector copying 3 tables and a sink connector reading a 4-partition topic. Pick
 *    tasks.max, the number of workers and (distributed only) kill one worker to see who runs which task.
 * 2) Bad records: a batch of 10 records goes through the converter. Pick the fault, errors.tolerance and the DLQ to see
 *    how many records are delivered, parked in the DLQ, lost silently, and whether the task stops.
 */

type Mode = 'standalone' | 'distributed'
type Fault = 'none' | 'two' | 'converter'
type Tolerance = 'none' | 'all'

const TABLES = 3
const PARTITIONS = 4
const BATCH = 10
/** Records (1-based) that are broken in the "two bad records" fault. */
const BAD_TWO = [4, 8]

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`wg-stat ${tone}`}>
      <div className="wg-stat-label">{label}</div>
      <div className="wg-stat-value">{value}</div>
    </div>
  )
}

const box: CSSProperties = { border: '1px solid var(--line, #3a4458)', borderRadius: 10, padding: '10px 14px', minWidth: 0 }

interface Task {
  name: string
  worker: number | null
}

/** Round-robin the tasks over the workers that are still alive; null = nobody runs it. */
function place(count: number, alive: number[], prefix: string): Task[] {
  return Array.from({ length: count }, (_, i) => ({ name: `${prefix}-${i}`, worker: alive.length ? alive[i % alive.length] : null }))
}

function Tasks({ title, tasks, note }: { title: string; tasks: Task[]; note: string }) {
  return (
    <div style={{ ...box, flex: '1 1 300px' }}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 14, opacity: 0.75, marginBottom: 6 }}>{note}</div>
      {tasks.map((t) => (
        <div key={t.name} style={{ display: 'flex', gap: 10, fontFamily: 'monospace', fontSize: 14, color: t.worker === null ? '#ef4444' : undefined }}>
          <span>{t.name}</span>
          <span>→</span>
          <span>{t.worker === null ? 'không ai chạy (dừng)' : `worker-${t.worker + 1}`}</span>
        </div>
      ))}
    </div>
  )
}

export default function ConnectLab() {
  const [mode, setMode] = useState<Mode>('distributed')
  const [workers, setWorkers] = useState(3)
  const [killed, setKilled] = useState<number | null>(null)
  const [tasksMax, setTasksMax] = useState(8)
  const [fault, setFault] = useState<Fault>('converter')
  const [tolerance, setTolerance] = useState<Tolerance>('none')
  const [dlq, setDlq] = useState(false)

  const nWorkers = mode === 'standalone' ? 1 : workers
  const dead = killed !== null && killed < nWorkers ? killed : null
  const alive = Array.from({ length: nWorkers }, (_, i) => i).filter((i) => i !== dead)

  const srcCount = Math.min(tasksMax, TABLES)
  const sinkCount = Math.min(tasksMax, PARTITIONS)
  const srcTasks = place(srcCount, alive, 'source')
  const sinkTasks = place(sinkCount, alive, 'sink')
  const running = srcTasks.filter((t) => t.worker !== null).length + sinkTasks.filter((t) => t.worker !== null).length

  const bad = fault === 'none' ? [] : fault === 'two' ? BAD_TWO : Array.from({ length: BATCH }, (_, i) => i + 1)
  const firstBad = bad.length ? bad[0] : null
  const stopped = tolerance === 'none' && firstBad !== null
  const delivered = stopped ? (firstBad as number) - 1 : BATCH - bad.length
  const parked = tolerance === 'all' && dlq ? bad.length : 0
  const lost = tolerance === 'all' && !dlq ? bad.length : 0
  const waiting = stopped ? BATCH - (firstBad as number) + 1 : 0

  const verdict = stopped
    ? `Task FAILED ở tin #${firstBad}: ${delivered} tin đã ghi, ${waiting} tin còn kẹt phía sau, đường ống đứng`
    : lost > 0
      ? `Chạy hết, nhưng ${lost} tin hỏng biến mất, không để lại dấu vết nào (chỉ có thể có dòng log)`
      : parked > 0
        ? `Chạy hết: ${delivered} tin ghi xong, ${parked} tin hỏng nằm trong dlq-orders để xem lại`
        : 'Mọi tin đều qua, không có gì phải xử lý'
  const tone = stopped ? 'bad' : lost > 0 ? 'warn' : 'good'

  return (
    <div className="wg">
      <div className="wg-head">
        <span className="wg-badge">Mô phỏng</span>
        <h4>Kafka Connect: chia task và xử lý tin hỏng</h4>
      </div>

      <div className="wg-controls">
        <label>
          <span>
            Chế độ:{' '}
            <select className="wg-input" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              <option value="distributed">distributed (nhiều worker)</option>
              <option value="standalone">standalone (1 worker)</option>
            </select>
          </span>
        </label>
        {mode === 'distributed' && (
          <label>
            <span>
              Số worker: {workers}{' '}
              <input
                type="range"
                min={2}
                max={4}
                value={workers}
                onChange={(e) => {
                  setWorkers(Number(e.target.value))
                  setKilled(null)
                }}
              />
            </span>
          </label>
        )}
        <label>
          <span>
            tasks.max: {tasksMax}{' '}
            <input type="range" min={1} max={8} value={tasksMax} onChange={(e) => setTasksMax(Number(e.target.value))} />
          </span>
        </label>
        <label>
          <span>
            Worker chết:{' '}
            <select className="wg-input" value={dead === null ? 'none' : String(dead)} onChange={(e) => setKilled(e.target.value === 'none' ? null : Number(e.target.value))}>
              <option value="none">không có</option>
              {Array.from({ length: nWorkers }, (_, i) => (
                <option key={i} value={i}>
                  worker-{i + 1}
                </option>
              ))}
            </select>
          </span>
        </label>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '12px 0' }}>
        <Tasks title={`Source JDBC (${TABLES} bảng)`} tasks={srcTasks} note={`min(tasks.max = ${tasksMax}, ${TABLES} bảng) = ${srcCount} task`} />
        <Tasks title={`Sink (topic ${PARTITIONS} partition)`} tasks={sinkTasks} note={`min(tasks.max = ${tasksMax}, ${PARTITIONS} partition) = ${sinkCount} task`} />
      </div>

      <div className="wg-stats">
        <Stat label="Task đang chạy" value={`${running} / ${srcCount + sinkCount}`} tone={running === srcCount + sinkCount ? 'good' : 'bad'} />
        <Stat label="Worker còn sống" value={`${alive.length} / ${nWorkers}`} tone={alive.length === nWorkers ? 'good' : alive.length ? 'warn' : 'bad'} />
        <Stat
          label="Sau khi worker chết"
          value={dead === null ? 'chưa có worker nào chết' : mode === 'standalone' ? 'mọi thứ dừng, offset nằm trong file trên máy đó' : alive.length ? 'task được chia lại cho worker còn sống' : 'không còn worker nào'}
          tone={dead === null ? '' : mode === 'standalone' ? 'bad' : 'good'}
        />
      </div>

      <div className="wg-controls" style={{ marginTop: 16 }}>
        <label>
          <span>
            Lỗi trong lô {BATCH} tin:{' '}
            <select className="wg-input" value={fault} onChange={(e) => setFault(e.target.value as Fault)}>
              <option value="none">không có tin hỏng</option>
              <option value="two">2 tin hỏng (#4 và #8)</option>
              <option value="converter">converter lệch: mọi tin đều lỗi</option>
            </select>
          </span>
        </label>
        <label>
          <span>
            errors.tolerance:{' '}
            <select className="wg-input" value={tolerance} onChange={(e) => setTolerance(e.target.value as Tolerance)}>
              <option value="none">none (mặc định)</option>
              <option value="all">all</option>
            </select>
          </span>
        </label>
        <label>
          <span>
            <input type="checkbox" checked={dlq} disabled={tolerance === 'none'} onChange={(e) => setDlq(e.target.checked)} /> bật dead letter queue
          </span>
        </label>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '12px 0' }}>
        {Array.from({ length: BATCH }, (_, i) => {
          const n = i + 1
          const isBad = bad.includes(n)
          const state = stopped && n >= (firstBad as number) ? (n === firstBad ? 'dừng' : 'kẹt') : isBad ? (parked ? 'DLQ' : 'mất') : 'ghi'
          const color = state === 'ghi' ? '#22c55e' : state === 'DLQ' ? '#f59e0b' : '#ef4444'
          return (
            <div key={n} style={{ ...box, width: 86, textAlign: 'center', borderColor: color, color }}>
              <div style={{ fontWeight: 800 }}>#{n}</div>
              <div style={{ fontSize: 14 }}>{state}</div>
            </div>
          )
        })}
      </div>

      <div className="wg-stats">
        <Stat label="Đã ghi ra đích" value={`${delivered} / ${BATCH}`} tone={delivered === BATCH ? 'good' : ''} />
        <Stat label="Trong DLQ" value={String(parked)} tone={parked ? 'warn' : ''} />
        <Stat label="Mất lặng lẽ" value={String(lost)} tone={lost ? 'bad' : 'good'} />
        <Stat label="Kết quả" value={verdict} tone={tone} />
      </div>
      <p className="wg-note">
        Thử: để tasks.max = 8 và xem chỉ có 3 task source, 4 task sink. Chọn distributed rồi cho worker-2 chết để thấy task chia lại; đổi sang standalone thì
        mọi task dừng. Với converter lệch và tolerance none, task dừng ngay ở tin đầu. Đặt tolerance all không DLQ để thấy dữ liệu mất mà không ai biết, rồi
        bật DLQ để giữ lại các tin hỏng.
      </p>
    </div>
  )
}
