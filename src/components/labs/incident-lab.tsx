import { useState } from 'react'

/**
 * Incident simulator with three panels: (1) pick the symptoms you see and get the matching diagnosis and fix,
 * (2) how long a partition move takes under a throttle, (3) whether a rolling restart still lets producers write.
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

function Slider({ label, value, min, max, step, onChange, unit = '' }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <label>
      <span>
        {label}: <b>{fmt(value)}{unit}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </label>
  )
}

type LagShape = 'none' | 'uniform' | 'hot' | 'stuck'

const LAG_LABEL: Record<LagShape, string> = {
  none: 'Lag bình thường',
  uniform: 'Lag tăng đều ở mọi partition',
  hot: 'Một partition cao vút, offset vẫn nhích',
  stuck: 'Một partition đứng yên, offset không nhích',
}

interface Diagnosis {
  name: string
  cause: string
  check: string
  fix: string
  tone: 'bad' | 'warn'
}

function diagnose(lag: LagShape, storm: boolean, disk: number, urp: number, allAlive: boolean): Diagnosis[] {
  const out: Diagnosis[] = []
  if (lag === 'uniform')
    out.push({ name: 'Consumer chậm', tone: 'warn', cause: 'tốc độ ghi tăng hoặc consumer chậm đi (DB phía sau, GC)', check: 'số consumer so với số partition, tốc độ ghi vào topic', fix: 'thêm consumer (tối đa bằng số partition), gom batch khi ghi DB; đã bằng số partition thì mới tăng partition' })
  if (lag === 'hot')
    out.push({ name: 'Hot partition', tone: 'warn', cause: 'một key chiếm phần lớn tin', check: 'phân bố key, dung lượng từng partition (kafka-log-dirs.sh)', fix: 'đổi key, rắc muối key nóng (shop-1#0 … shop-1#9); thêm partition không giúp một key duy nhất' })
  if (lag === 'stuck')
    out.push({ name: 'Poison message', tone: 'bad', cause: 'một tin hỏng làm consumer crash hoặc retry mãi ở cùng offset', check: 'đọc đúng tin đó: kafka-console-consumer.sh --partition N --offset X --max-messages 1', fix: 'khẩn cấp: dừng group rồi --reset-offsets --shift-by 1 (lưu offset cũ ra CSV trước); lâu dài: bắt lỗi và đẩy sang DLQ' })
  if (storm)
    out.push({ name: 'Rebalance storm', tone: 'bad', cause: 'một lô xử lý vượt max.poll.interval.ms, hoặc consumer bị deploy/restart liên tục', check: 'thời gian xử lý một lô, session.timeout.ms so với GC pause', fix: 'giảm max.poll.records, dùng static membership (group.instance.id), dùng cooperative rebalancing' })
  if (disk >= 85)
    out.push({ name: disk >= 95 ? 'Đĩa sắp đầy' : 'Đĩa đang đầy dần', tone: disk >= 95 ? 'bad' : 'warn', cause: 'log tăng nhanh hơn retention dọn; đầy hẳn thì broker hỏng đột ngột', check: 'kafka-log-dirs.sh --describe, và cả inode', fix: 'giảm tạm retention.ms/retention.bytes, mở rộng ổ đĩa, dời partition sang broker khác; không rm file segment khi broker chạy' })
  if (urp > 0)
    out.push({
      name: allAlive ? 'URP > 0 dù broker còn sống' : 'Broker chết / URP > 0',
      tone: 'bad',
      cause: allAlive ? 'một broker có vấn đề: đĩa sắp hỏng, card mạng lỗi, cấu hình lệch' : 'một broker không còn trong ISR (hết RAM, hết đĩa, mạng)',
      check: allAlive ? 'tìm broker xuất hiện chung trong cột Replicas của mọi dòng URP' : '--under-replicated-partitions và log của broker đó',
      fix: 'khởi động lại broker để nó đuổi kịp và vào lại ISR; trong lúc URP > 0, không dừng thêm broker nào',
    })
  return out
}

export default function IncidentLab() {
  // 1. symptoms
  const [lag, setLag] = useState<LagShape>('none')
  const [storm, setStorm] = useState(false)
  const [disk, setDisk] = useState(60)
  const [urp, setUrp] = useState(0)
  const [allAlive, setAllAlive] = useState(false)
  // 2. reassign
  const [gb, setGb] = useState(500)
  const [throttle, setThrottle] = useState(50)
  // 3. rolling restart
  const [rf, setRf] = useState(3)
  const [minIsr, setMinIsr] = useState(2)

  const found = diagnose(lag, storm, disk, urp, allAlive)

  const NET = 1000 // MB/s the broker network card can carry
  const seconds = (gb * 1000) / throttle
  const hours = seconds / 3600
  const share = (throttle / NET) * 100

  const isrLeft = rf - 1
  const canWrite = isrLeft >= minIsr

  return (
    <div className="wg">
      <div className="wg-head">
        <span className="wg-badge">Mô phỏng</span>
        <h4>Sổ tay sự cố: chọn dấu hiệu, xem chẩn đoán</h4>
      </div>

      <h4 style={{ margin: '8px 0' }}>1. Bạn đang thấy gì?</h4>
      <div className="wg-controls">
        <label>
          <span>Hình dạng của lag</span>
          <select value={lag} onChange={(e) => setLag(e.target.value as LagShape)}>
            {(Object.keys(LAG_LABEL) as LagShape[]).map((k) => (
              <option key={k} value={k}>
                {LAG_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>
            <input type="checkbox" checked={storm} onChange={(e) => setStorm(e.target.checked)} /> Log consumer đầy chữ "rebalance"
          </span>
        </label>
        <Slider label="Đĩa broker đã dùng" value={disk} min={40} max={100} step={1} unit="%" onChange={setDisk} />
        <Slider label="UnderReplicatedPartitions" value={urp} min={0} max={20} step={1} onChange={setUrp} />
        <label>
          <span>
            <input type="checkbox" checked={allAlive} onChange={(e) => setAllAlive(e.target.checked)} /> Mọi broker vẫn sống
          </span>
        </label>
      </div>
      {found.length === 0 ? (
        <div className="wg-stats">
          <Stat label="Chẩn đoán" value="Chưa thấy sự cố nào" tone="good" />
        </div>
      ) : (
        found.map((d) => (
          <div key={d.name} className="wg-stats">
            <Stat label="Sự cố" value={d.name} tone={d.tone} />
            <Stat label="Nguyên nhân" value={d.cause} />
            <Stat label="Kiểm tra" value={d.check} />
            <Stat label="Xử lý" value={d.fix} tone="good" />
          </div>
        ))
      )}
      {urp > 0 && (
        <p className="wg-note">Đang có URP: ưu tiên khôi phục replica, hoãn mọi thay đổi rủi ro như rolling restart hay dời partition.</p>
      )}

      <h4 style={{ margin: '16px 0 8px' }}>2. Dời partition mất bao lâu?</h4>
      <div className="wg-controls">
        <Slider label="Dữ liệu cần sao chép" value={gb} min={50} max={2000} step={50} unit=" GB" onChange={setGb} />
        <Slider label="Throttle" value={throttle} min={10} max={500} step={10} unit=" MB/s" onChange={setThrottle} />
      </div>
      <div className="wg-stats">
        <Stat label="Thời gian sao chép" value={hours >= 1 ? `${hours.toFixed(1).replace('.', ',')} giờ` : `${fmt(seconds / 60)} phút`} />
        <Stat label="Chiếm băng thông mạng (card 1.000 MB/s)" value={`${fmt(share)}%`} tone={share > 30 ? 'bad' : 'good'} />
        <Stat label="Đánh giá" value={share > 30 ? 'Quá cao: producer và consumer thật sẽ bị chậm' : hours > 24 ? 'An toàn nhưng rất lâu; cân nhắc tăng nhẹ throttle' : 'Hợp lý: sao chép không giành mạng của traffic thật'} tone={share > 30 ? 'bad' : 'good'} />
      </div>

      <h4 style={{ margin: '16px 0 8px' }}>3. Rolling restart có còn ghi được không?</h4>
      <div className="wg-controls">
        <Slider label="Replication factor (RF)" value={rf} min={1} max={5} step={1} onChange={setRf} />
        <Slider label="min.insync.replicas" value={minIsr} min={1} max={5} step={1} onChange={setMinIsr} />
      </div>
      <div className="wg-stats">
        <Stat label="ISR còn lại khi tắt 1 broker" value={`${isrLeft}/${rf}`} />
        <Stat label="Producer acks=all" value={canWrite ? 'ghi được' : 'lỗi NotEnoughReplicas'} tone={canWrite ? 'good' : 'bad'} />
        <Stat label="Chịu thêm 1 sự cố bất ngờ?" value={rf - minIsr >= 2 ? 'có (RF lớn hơn min ISR 2 đơn vị)' : 'không'} tone={rf - minIsr >= 2 ? 'good' : ''} />
      </div>
      <p className="wg-note">
        Thử: chọn "Một partition đứng yên" để thấy poison message; kéo URP lên rồi bật "Mọi broker vẫn sống" để đổi hướng kiểm tra. Ở phần 2, kéo throttle lên 500 để thấy sao chép chiếm nửa card mạng. Ở phần 3, đặt RF = 2 và min ISR = 2 để thấy rolling restart làm producer lỗi.
      </p>
    </div>
  )
}
