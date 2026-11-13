import { useState } from 'react'

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`wg-stat ${tone}`}>
      <div className="wg-stat-label">{label}</div>
      <div className="wg-stat-value">{value}</div>
    </div>
  )
}

type Policy = 'delete' | 'compact'

const fmtTb = (tb: number) => (tb >= 1000 ? `${(tb / 1000).toFixed(1).replace('.', ',')} PB` : `${Math.round(tb * 10) / 10} TB`.replace('.', ','))

/**
 * Storage model of one topic. Without tiered storage every replica keeps `retention` days on broker SSD.
 * With it, brokers keep `local` days x replication factor; the remote tier keeps the full `retention` days once
 * (the object store handles its own redundancy).
 */
export default function TieredLab() {
  const [policy, setPolicy] = useState<Policy>('delete')
  const [tiered, setTiered] = useState(true)
  const [daily, setDaily] = useState(2)
  const [retention, setRetention] = useState(90)
  const [local, setLocal] = useState(1)
  const [rf, setRf] = useState(3)

  const localDays = Math.min(local, retention)
  const blocked = policy === 'compact' && tiered
  const active = tiered && !blocked
  const withoutTiered = retention * daily * rf
  const ssd = active ? localDays * daily * rf : withoutTiered
  const remote = active ? retention * daily : 0
  const saved = withoutTiered > 0 ? Math.round((1 - ssd / withoutTiered) * 100) : 0
  // A replacement broker only has to copy the local tier from the other replicas.
  const replaceCopy = active ? localDays * daily : retention * daily

  return (
    <div className="wg">
      <div className="wg-head">
        <span className="wg-badge">Mô phỏng</span>
        <h4>Tiered storage: SSD broker và object storage</h4>
      </div>
      <div className="wg-controls">
        <label>
          <span>
            Policy của topic:{' '}
            <select className="wg-input" value={policy} onChange={(e) => setPolicy(e.target.value as Policy)}>
              <option value="delete">delete (sự kiện, vd clicks)</option>
              <option value="compact">compact (trạng thái, vd user-profile)</option>
            </select>
          </span>
        </label>
        <label>
          <span>
            <input type="checkbox" checked={tiered} onChange={(e) => setTiered(e.target.checked)} /> remote.storage.enable=true
          </span>
        </label>
        <label>
          <span>Dữ liệu mỗi ngày: <b>{daily} TB</b></span>
          <input type="range" min={1} max={10} step={1} value={daily} onChange={(e) => setDaily(+e.target.value)} />
        </label>
        <label>
          <span>retention.ms: <b>{retention} ngày</b></span>
          <input type="range" min={1} max={365} step={1} value={retention} onChange={(e) => setRetention(+e.target.value)} />
        </label>
        <label>
          <span>local.retention.ms: <b>{localDays} ngày</b></span>
          <input type="range" min={1} max={30} step={1} value={local} onChange={(e) => setLocal(+e.target.value)} />
        </label>
        <label>
          <span>Replication factor: <b>{rf}</b></span>
          <input type="range" min={1} max={5} step={1} value={rf} onChange={(e) => setRf(+e.target.value)} />
        </label>
      </div>
      <div className="wg-stats">
        <Stat label="SSD trên broker" value={fmtTb(ssd)} tone={active ? 'good' : 'bad'} />
        <Stat label="Object storage (remote)" value={active ? fmtTb(remote) : '0 TB'} />
        <Stat label="Tiết kiệm SSD" value={active ? `${saved}%` : '0%'} tone={active ? 'good' : ''} />
        <Stat label="Thay broker hỏng: chép" value={fmtTb(replaceCopy)} tone={active ? 'good' : 'bad'} />
      </div>
      {blocked ? (
        <p className="wg-note" style={{ color: '#ff5a6a' }}>
          Không bật được: tiered storage không hỗ trợ topic compacted (<code>cleanup.policy=compact</code>). Topic này vẫn nằm hết trên đĩa broker, nên số SSD ở trên là số khi chưa bật.
        </p>
      ) : (
        <p className="wg-note">
          Thử: đặt local.retention.ms bằng retention.ms để thấy tiered storage không còn tiết kiệm gì; bật rồi tắt tiered để so lượng dữ liệu phải chép khi thay broker; đổi sang compact để thấy giới hạn.
          {localDays < local ? ' (local.retention.ms bị chặn bằng retention.ms.)' : ''}
        </p>
      )}
    </div>
  )
}
