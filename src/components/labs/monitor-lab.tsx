import { useState } from 'react'

/**
 * Monitoring simulator with three panels: (1) lag trend and catch-up time from producer/consumer rates,
 * (2) cluster health counters for a 3-replica partition as brokers die, (3) request latency split by stage
 * with a diagnosis of the slowest stage.
 */

const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN')

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`wg-stat ${tone}`}>
      <div className="wg-stat-label">{label}</div>
      <div className="wg-stat-value">{value}</div>
    </div>
  )
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label>
      <span>
        {label}: <b>{fmt(value)}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </label>
  )
}

const STAGES = [
  { key: 'queue', label: 'RequestQueue (chờ luồng)', color: '#f59e0b' },
  { key: 'local', label: 'Local (ghi đĩa)', color: '#3b82f6' },
  { key: 'remote', label: 'Remote (chờ follower)', color: '#ef4444' },
  { key: 'send', label: 'Response (gửi trả)', color: '#22c55e' },
] as const
type StageKey = (typeof STAGES)[number]['key']

const DIAGNOSIS: Record<StageKey, string> = {
  queue: 'Chặng hàng đợi lớn nhất: broker thiếu luồng xử lý, xem RequestHandlerAvgIdlePercent.',
  local: 'Chặng ghi đĩa lớn nhất: đĩa của leader chậm hoặc bị tranh chấp.',
  remote: 'Chặng chờ follower lớn nhất: follower chậm (đĩa hoặc mạng của broker khác), không phải leader.',
  send: 'Chặng gửi trả lớn nhất: mạng giữa broker và client, hoặc response quá lớn.',
}

export default function MonitorLab() {
  // lag
  const [write, setWrite] = useState(1500)
  const [read, setRead] = useState(2000)
  const [lag, setLag] = useState(90000)
  // cluster
  const [alive, setAlive] = useState(3)
  const [minIsr, setMinIsr] = useState(2)
  // latency
  const [ms, setMs] = useState<Record<StageKey, number>>({ queue: 5, local: 10, remote: 100, send: 5 })

  const diff = read - write
  const catchUp = diff > 0 ? lag / diff : Infinity
  const delaySec = read > 0 ? lag / read : Infinity
  const trend = diff > 0 ? `giảm ${fmt(diff * 60)} tin mỗi phút` : diff === 0 ? 'đứng yên' : `tăng ${fmt(-diff * 60)} tin mỗi phút`

  const urp = alive < 3 && alive >= 1 ? 1 : 0
  const underMin = alive < minIsr && alive >= 1 ? 1 : 0
  const offline = alive === 0 ? 1 : 0
  const canWrite = alive >= minIsr && alive >= 1

  const total = ms.queue + ms.local + ms.remote + ms.send
  const worst = STAGES.reduce((a, s) => (ms[s.key] > ms[a.key] ? s : a), STAGES[0])

  return (
    <div className="wg">
      <div className="wg-head">
        <span className="wg-badge">Mô phỏng</span>
        <h4>Bảng giám sát: lag, sức khoẻ cluster, độ trễ request</h4>
      </div>

      <h4 style={{ margin: '8px 0' }}>1. Lag có hết không?</h4>
      <div className="wg-controls">
        <Slider label="Producer ghi (tin/giây)" value={write} min={0} max={5000} step={100} onChange={setWrite} />
        <Slider label="Consumer đọc (tin/giây)" value={read} min={0} max={5000} step={100} onChange={setRead} />
        <Slider label="Lag hiện tại (tin)" value={lag} min={0} max={200000} step={5000} onChange={setLag} />
      </div>
      <div className="wg-stats">
        <Stat label="Xu hướng lag" value={trend} tone={diff > 0 ? 'good' : 'bad'} />
        <Stat label="Thời gian đuổi kịp" value={Number.isFinite(catchUp) ? (lag === 0 ? 'đã hết lag' : `${fmt(catchUp)} giây`) : 'không bao giờ'} tone={Number.isFinite(catchUp) ? 'good' : 'bad'} />
        <Stat label="Tin mới nhất chờ khoảng" value={Number.isFinite(delaySec) ? `${fmt(delaySec)} giây` : 'vô hạn (consumer đứng)'} tone={delaySec > 60 ? 'bad' : ''} />
        <Stat label="Cảnh báo" value={diff > 0 || lag === 0 ? 'ổn' : 'lag tăng liên tục'} tone={diff > 0 || lag === 0 ? 'good' : 'bad'} />
      </div>

      <h4 style={{ margin: '16px 0 8px' }}>2. Sức khoẻ cluster (RF = 3, acks=all)</h4>
      <div className="wg-controls">
        <label>
          <span>
            Broker còn sống: <b>{alive}/3</b>
          </span>
          <input type="range" min={0} max={3} step={1} value={alive} onChange={(e) => setAlive(+e.target.value)} />
        </label>
        <label>
          <span>
            min.insync.replicas: <b>{minIsr}</b>
          </span>
          <input type="range" min={1} max={3} step={1} value={minIsr} onChange={(e) => setMinIsr(+e.target.value)} />
        </label>
      </div>
      <div className="wg-stats">
        <Stat label="UnderReplicatedPartitions" value={`${urp}`} tone={urp ? 'bad' : 'good'} />
        <Stat label="UnderMinIsr" value={`${underMin}`} tone={underMin ? 'bad' : 'good'} />
        <Stat label="OfflinePartitionsCount" value={`${offline}`} tone={offline ? 'bad' : 'good'} />
        <Stat label="Producer acks=all" value={canWrite ? 'ghi được' : alive === 0 ? 'lỗi: không có leader' : 'lỗi NotEnoughReplicas'} tone={canWrite ? 'good' : 'bad'} />
      </div>

      <h4 style={{ margin: '16px 0 8px' }}>3. Request chậm ở chặng nào?</h4>
      <div className="wg-controls">
        {STAGES.map((s) => (
          <Slider key={s.key} label={s.label} value={ms[s.key]} min={0} max={200} step={5} onChange={(v) => setMs({ ...ms, [s.key]: v })} />
        ))}
      </div>
      <div style={{ display: 'flex', height: 30, borderRadius: 8, overflow: 'hidden', background: 'rgba(110,160,255,0.15)', margin: '8px 0' }}>
        {STAGES.map((s) => (
          <div key={s.key} title={`${s.label}: ${ms[s.key]} ms`} style={{ width: total ? `${(ms[s.key] / total) * 100}%` : 0, background: s.color, transition: 'width 0.2s' }} />
        ))}
      </div>
      <div className="wg-stats">
        <Stat label="TotalTimeMs" value={`${total} ms`} tone={total > 100 ? 'bad' : 'good'} />
        <Stat label="Chặng lớn nhất" value={total ? `${worst.label}: ${ms[worst.key]} ms` : 'không có'} />
        <Stat label="Chẩn đoán" value={total ? DIAGNOSIS[worst.key] : '—'} tone={total > 100 ? 'bad' : ''} />
      </div>
      <p className="wg-note">
        Thử: để consumer đọc bằng producer ghi (lag không bao giờ hết). Hạ broker còn 2 rồi tăng min.insync.replicas lên 3 để thấy URP chuyển thành UnderMinIsr. Kéo Remote lên 150 ms rồi kéo RequestQueue lên để thấy chẩn đoán đổi từ follower sang thiếu luồng.
      </p>
    </div>
  )
}
