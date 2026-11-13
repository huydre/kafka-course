import { useState } from 'react'

/**
 * Sizing calculator. Pure arithmetic from the lesson: disk = rate x seconds x retention x RF / compression / usable%,
 * network out = in x (consumer groups + followers), partitions = max(T / p, T / c).
 */

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`wg-stat ${tone}`}>
      <div className="wg-stat-label">{label}</div>
      <div className="wg-stat-value">{value}</div>
    </div>
  )
}

const DAY = 86_400
const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })
const fmt = (n: number) => nf.format(n)

/** MB -> human size (decimal units, like the lesson's 6.048 GB ≈ 6 TB). */
function size(mb: number): string {
  if (mb >= 1_000_000) return `${fmt(mb / 1_000_000)} TB`
  if (mb >= 1_000) return `${fmt(mb / 1_000)} GB`
  return `${fmt(mb)} MB`
}

function Slider({ label, value, min, max, step = 1, unit = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <label>
      <span>
        {label}: <b>{fmt(value)}{unit}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </label>
  )
}

export default function SizingLab() {
  const [rate, setRate] = useState(10) // MB/s written
  const [days, setDays] = useState(7)
  const [rf, setRf] = useState(3)
  const [comp, setComp] = useState(1)
  const [usable, setUsable] = useState(70)
  const [brokers, setBrokers] = useState(6)
  const [groups, setGroups] = useState(3)
  const [target, setTarget] = useState(50) // MB/s target throughput of the topic
  const [perConsumer, setPerConsumer] = useState(5)
  const [perPartition, setPerPartition] = useState(10)
  const [nic, setNic] = useState(10) // Gb/s

  const perDayMb = rate * DAY
  const rawMb = perDayMb * days
  const replicatedMb = rawMb * rf
  const storedMb = replicatedMb / comp
  const clusterMb = storedMb / (usable / 100)
  const perBrokerMb = clusterMb / brokers

  const followers = rf - 1
  const outMb = rate * (groups + followers)
  const nicMb = (nic * 1000) / 8 // Gb/s -> MB/s
  const perBrokerOut = outMb / brokers
  const nicLoad = perBrokerOut / nicMb

  const partitions = Math.max(1, Math.ceil(Math.max(target / perPartition, target / perConsumer)))
  const replicasPerBroker = (partitions * rf) / brokers

  return (
    <div className="wg">
      <div className="wg-head">
        <span className="wg-badge">Mô phỏng</span>
        <h4>Máy tính sizing: đĩa, mạng, partition</h4>
      </div>
      <div className="wg-controls">
        <Slider label="Tốc độ ghi" value={rate} min={1} max={200} unit=" MB/giây" onChange={setRate} />
        <Slider label="Retention" value={days} min={1} max={30} unit=" ngày" onChange={setDays} />
        <Slider label="Replication factor" value={rf} min={1} max={5} onChange={setRf} />
        <Slider label="Tỉ lệ nén" value={comp} min={1} max={6} step={0.5} unit="x" onChange={setComp} />
        <Slider label="Dùng tối đa đĩa" value={usable} min={40} max={95} step={5} unit="%" onChange={setUsable} />
        <Slider label="Số broker" value={brokers} min={3} max={30} onChange={setBrokers} />
      </div>
      <div className="wg-stats">
        <Stat label="1 ngày" value={size(perDayMb)} />
        <Stat label={`${days} ngày`} value={size(rawMb)} />
        <Stat label={`× RF ${rf}${comp > 1 ? ` ÷ nén ${fmt(comp)}` : ''}`} value={size(storedMb)} />
        <Stat label={`Đĩa cả cluster (÷ ${fmt(usable / 100)})`} value={size(clusterMb)} tone="good" />
        <Stat label={`Mỗi broker (${brokers} máy)`} value={size(perBrokerMb)} />
      </div>

      <div className="wg-controls" style={{ marginTop: 18 }}>
        <Slider label="Số consumer group đọc" value={groups} min={0} max={10} onChange={setGroups} />
        <Slider label="Card mạng" value={nic} min={1} max={25} unit=" Gb/s" onChange={setNic} />
      </div>
      <div className="wg-stats">
        <Stat label="Mạng vào" value={`${fmt(rate)} MB/giây`} />
        <Stat label={`Mạng ra (${groups} group + ${followers} follower)`} value={`${fmt(outMb)} MB/giây`} tone={nicLoad > 0.7 ? 'bad' : ''} />
        <Stat label={`Ra mỗi broker (chia đều ${brokers} máy)`} value={`${fmt(perBrokerOut)} MB/giây`} />
        <Stat label={`Tải card ${nic} Gb/s mỗi broker`} value={`${fmt(nicLoad * 100)}%`} tone={nicLoad > 0.7 ? 'bad' : 'good'} />
      </div>

      <div className="wg-controls" style={{ marginTop: 18 }}>
        <Slider label="Tốc độ mục tiêu T" value={target} min={1} max={500} unit=" MB/giây" onChange={setTarget} />
        <Slider label="Một consumer xử lý (c)" value={perConsumer} min={1} max={50} unit=" MB/giây" onChange={setPerConsumer} />
        <Slider label="Một partition nhận ghi (p)" value={perPartition} min={1} max={50} unit=" MB/giây" onChange={setPerPartition} />
      </div>
      <div className="wg-stats">
        <Stat label="T ÷ p" value={fmt(Math.ceil(target / perPartition))} />
        <Stat label="T ÷ c" value={fmt(Math.ceil(target / perConsumer))} />
        <Stat label="Partition cần ít nhất" value={fmt(partitions)} tone="good" />
        <Stat label="Partition-replica mỗi broker" value={fmt(replicasPerBroker)} tone={replicasPerBroker > 4000 ? 'bad' : ''} />
      </div>
      <p className="wg-note">
        Thử: ví dụ trong bài (10 MB/giây, 7 ngày, RF 3) ra 26 TB; bật nén 4x còn khoảng 6,5 TB. Hạ card xuống 1 Gb/s rồi tăng tốc độ ghi lên 100 MB/giây với 6 group đọc để thấy card bão hòa. Muốn cân nhắc đỉnh tải, hãy nhập tốc độ giờ cao điểm thay vì trung bình ngày.
      </p>
    </div>
  )
}
