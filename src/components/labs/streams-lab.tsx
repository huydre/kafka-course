import { useState, type CSSProperties } from 'react'

/**
 * Kafka Streams simulator with four panels.
 * 1) Tasks: one task per input partition, spread over the running instances (extra instances idle or act as standby).
 * 2) Restore: after an instance dies, how many changelog records the replacement replays (compaction, standby).
 * 3) Crash: one processing round = output + changelog + offset commit; at_least_once vs exactly_once_v2 and an
 *    external side effect (SMS) that no transaction covers.
 * 4) Join: two topics must be co-partitioned (same partition count) for a key join.
 */

type Guarantee = 'at_least_once' | 'exactly_once_v2'
type CrashPoint = 'none' | 'after-output' | 'after-changelog'

/** Replay speed assumed by the restore estimate (records per second). Illustrative, not a benchmark. */
const REPLAY_RATE = 50_000

const box: CSSProperties = { border: '1px solid var(--line, #3a4458)', borderRadius: 10, padding: '10px 14px', minWidth: 0 }

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`wg-stat ${tone}`}>
      <div className="wg-stat-label">{label}</div>
      <div className="wg-stat-value">{value}</div>
    </div>
  )
}

const fmt = (n: number) => n.toLocaleString('vi-VN')

function fmtTime(sec: number): string {
  if (sec < 1) return '< 1 giây'
  if (sec < 120) return `${Math.round(sec)} giây`
  return `${Math.round(sec / 60)} phút`
}

/** Round-robin the tasks over the given instances: result[i] = task ids of instance i. */
function spread(tasks: number, instances: number): number[][] {
  const out: number[][] = Array.from({ length: instances }, () => [])
  for (let t = 0; t < tasks; t++) out[t % instances].push(t)
  return out
}

export default function StreamsLab() {
  const [partitions, setPartitions] = useState(6)
  const [instances, setInstances] = useState(4)
  const [standby, setStandby] = useState(false)

  const [updates, setUpdates] = useState(1_000_000)
  const [keys, setKeys] = useState(1000)
  const [compacted, setCompacted] = useState(true)

  const [guarantee, setGuarantee] = useState<Guarantee>('at_least_once')
  const [crash, setCrash] = useState<CrashPoint>('after-changelog')
  const [sms, setSms] = useState(true)

  const [clicksParts, setClicksParts] = useState(6)
  const [profileParts, setProfileParts] = useState(4)

  // 1) tasks
  const tasks = partitions
  const active = Math.min(instances, tasks)
  const idle = instances - active
  const layout = spread(tasks, active)
  const heaviest = Math.max(...layout.map((l) => l.length))

  // 2) restore: records the new owner must read before the task can run again
  const distinct = Math.min(keys, updates)
  const toReplay = standby ? 0 : compacted ? distinct : updates
  const seconds = toReplay / REPLAY_RATE
  const restoreTone = seconds < 5 ? 'good' : seconds < 60 ? 'warn' : 'bad'

  // 3) crash: what a read_committed consumer sees after the retry
  const crashed = crash !== 'none'
  const eos = guarantee === 'exactly_once_v2'
  const countValue = crashed && !eos ? 2 : 1
  const visibleOutputs = crashed && !eos ? 2 : 1
  const smsSent = sms ? (crashed ? 2 : 1) : 0
  const crashVerdict = !crashed
    ? 'Không crash: mỗi thứ đúng một lần'
    : eos
      ? 'Transaction bị huỷ rồi chạy lại: output, changelog và offset chỉ hiện ra một lần'
      : crash === 'after-output'
        ? 'Output đã ghi nhưng chưa commit offset: chạy lại ghi output thêm lần nữa'
        : 'Output và changelog đã ghi nhưng chưa commit offset: chạy lại đếm thêm lần nữa'

  // 4) join
  const coPartitioned = clicksParts === profileParts

  return (
    <div className="wg">
      <div className="wg-head">
        <span className="wg-badge">Mô phỏng</span>
        <h4>Kafka Streams: task, khôi phục state, exactly_once_v2, co-partitioning</h4>
      </div>

      <div className="wg-controls">
        <label>
          <span>
            Partition của topic đầu vào: {partitions}{' '}
            <input type="range" min={1} max={12} value={partitions} onChange={(e) => setPartitions(Number(e.target.value))} />
          </span>
        </label>
        <label>
          <span>
            Số instance ứng dụng: {instances}{' '}
            <input type="range" min={1} max={12} value={instances} onChange={(e) => setInstances(Number(e.target.value))} />
          </span>
        </label>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '12px 0' }}>
        {Array.from({ length: instances }, (_, i) => {
          const mine = i < active ? layout[i] : []
          return (
            <div key={i} style={{ ...box, width: 170, opacity: mine.length ? 1 : 0.55, borderColor: mine.length ? '#22c55e' : undefined }}>
              <div style={{ fontWeight: 800 }}>instance-{i + 1}</div>
              <div style={{ fontFamily: 'monospace', fontSize: 14, minHeight: 20 }}>{mine.length ? mine.map((t) => `T${t}`).join(' ') : standby ? 'standby (bản sao state)' : 'ngồi không'}</div>
            </div>
          )
        })}
      </div>

      <div className="wg-stats">
        <Stat label="Số task" value={`${tasks} (= số partition)`} />
        <Stat label="Instance có việc" value={`${active} / ${instances}`} tone={idle ? 'warn' : 'good'} />
        <Stat label="Instance ngồi không" value={String(idle)} tone={idle ? 'warn' : 'good'} />
        <Stat label="Instance nặng nhất" value={`${heaviest} task`} />
      </div>

      <div className="wg-controls" style={{ marginTop: 16 }}>
        <label>
          <span>
            Số lần cập nhật state:{' '}
            <select className="wg-input" value={updates} onChange={(e) => setUpdates(Number(e.target.value))}>
              <option value={10_000}>10.000</option>
              <option value={1_000_000}>1.000.000</option>
              <option value={100_000_000}>100.000.000</option>
            </select>
          </span>
        </label>
        <label>
          <span>
            Số key khác nhau:{' '}
            <select className="wg-input" value={keys} onChange={(e) => setKeys(Number(e.target.value))}>
              <option value={100}>100</option>
              <option value={1000}>1.000</option>
              <option value={100_000}>100.000</option>
            </select>
          </span>
        </label>
        <label>
          <span>
            <input type="checkbox" checked={compacted} onChange={(e) => setCompacted(e.target.checked)} /> changelog compact (mặc định)
          </span>
        </label>
        <label>
          <span>
            <input type="checkbox" checked={standby} onChange={(e) => setStandby(e.target.checked)} /> num.standby.replicas = 1
          </span>
        </label>
      </div>

      <div className="wg-stats">
        <Stat label="Tin changelog phải đọc lại" value={standby ? '~0 (bản sao nóng đã có state)' : fmt(toReplay)} tone={restoreTone} />
        <Stat label="Thời gian task đứng yên (ước tính)" value={fmtTime(seconds)} tone={restoreTone} />
        <Stat label="Instance chết" value={standby ? 'chuyển sang bản sao nóng' : 'instance khác đọc lại changelog từ đầu'} />
      </div>
      <p className="wg-note">
        Ước tính theo {fmt(REPLAY_RATE)} tin/giây (số minh hoạ). Tắt compact để thấy changelog phình theo số lần cập nhật; bật compact thì chỉ còn khoảng một tin cho mỗi key.
      </p>

      <div className="wg-controls" style={{ marginTop: 16 }}>
        <label>
          <span>
            processing.guarantee:{' '}
            <select className="wg-input" value={guarantee} onChange={(e) => setGuarantee(e.target.value as Guarantee)}>
              <option value="at_least_once">at_least_once (mặc định)</option>
              <option value="exactly_once_v2">exactly_once_v2</option>
            </select>
          </span>
        </label>
        <label>
          <span>
            Crash:{' '}
            <select className="wg-input" value={crash} onChange={(e) => setCrash(e.target.value as CrashPoint)}>
              <option value="none">không crash</option>
              <option value="after-output">sau khi ghi output</option>
              <option value="after-changelog">sau khi ghi changelog, trước commit offset</option>
            </select>
          </span>
        </label>
        <label>
          <span>
            <input type="checkbox" checked={sms} onChange={(e) => setSms(e.target.checked)} /> hàm xử lý gửi SMS ra ngoài
          </span>
        </label>
      </div>

      <div className="wg-stats">
        <Stat label="Bộ đếm của A sau khi chạy lại" value={String(countValue)} tone={countValue === 1 ? 'good' : 'bad'} />
        <Stat label="Output (read_committed)" value={`${visibleOutputs} tin`} tone={visibleOutputs === 1 ? 'good' : 'bad'} />
        <Stat label="SMS đã gửi" value={String(smsSent)} tone={smsSent > 1 ? 'bad' : 'good'} />
        <Stat label="Kết quả" value={crashVerdict} tone={crashed && !eos ? 'bad' : 'good'} />
      </div>
      {sms && crashed && eos && (
        <p className="wg-note">Dù đã bật exactly_once_v2, SMS vẫn gửi 2 lần: transaction chỉ bao các lần ghi vào Kafka và commit offset, không bao việc gọi ra ngoài.</p>
      )}

      <div className="wg-controls" style={{ marginTop: 16 }}>
        <label>
          <span>
            Partition topic clicks: {clicksParts}{' '}
            <input type="range" min={1} max={12} value={clicksParts} onChange={(e) => setClicksParts(Number(e.target.value))} />
          </span>
        </label>
        <label>
          <span>
            Partition topic user-profile: {profileParts}{' '}
            <input type="range" min={1} max={12} value={profileParts} onChange={(e) => setProfileParts(Number(e.target.value))} />
          </span>
        </label>
      </div>
      <div className="wg-stats">
        <Stat label="Join theo user_id" value={coPartitioned ? 'được: partition N của hai bên về cùng một task' : 'không được: cùng user_id có thể rơi vào partition khác nhau ở hai topic'} tone={coPartitioned ? 'good' : 'bad'} />
        {!coPartitioned && <Stat label="Cách sửa" value={`ghi lại một bên sang topic mới ${clicksParts} hoặc ${profileParts} partition (repartition)`} tone="warn" />}
      </div>
      <p className="wg-note">
        Thử: đặt 6 partition và 10 instance để thấy 4 instance ngồi không. Bật standby để thấy bản sao nóng rút thời gian khôi phục về gần 0. Chọn at_least_once với crash trước commit để thấy bộ đếm
        thành 2, rồi đổi sang exactly_once_v2: bộ đếm đúng nhưng SMS vẫn lặp.
      </p>
    </div>
  )
}
