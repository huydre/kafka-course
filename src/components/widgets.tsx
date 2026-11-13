import { useState, type FC } from 'react'
import { POS, SIZES, TOTAL } from '../lessons/sparse-index-data'
import { textHash } from '../player/text-hash'
import CommitLab from './labs/commit-lab'
import DeliveryLab from './labs/delivery-lab'
import TxnLab from './labs/txn-lab'
import CompactionLab from './labs/compaction-lab'
import TieredLab from './labs/tiered-lab'
import SchemaLab from './labs/schema-lab'
import ConnectLab from './labs/connect-lab'
import StreamsLab from './labs/streams-lab'
import MonitorLab from './labs/monitor-lab'
import SizingLab from './labs/sizing-lab'
import IncidentLab from './labs/incident-lab'
import OutboxLab from './labs/outbox-lab'
import EventLab from './labs/event-lab'
import RetryLab from './labs/retry-lab'
import CapstoneLab from './labs/capstone-lab'

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`wg-stat ${tone}`}>
      <div className="wg-stat-label">{label}</div>
      <div className="wg-stat-value">{value}</div>
    </div>
  )
}

/** Try a sparse index yourself: pick the offset to read and how often a marker is written. */
function SparseLab() {
  const [target, setTarget] = useState(6)
  const [every, setEvery] = useState(4)
  const marks = SIZES.map((_, i) => i).filter((i) => i % every === 0)
  const mark = Math.floor(target / every) * every
  const scanned = target - mark
  return (
    <div className="wg">
      <div className="wg-head">
        <span className="wg-badge">Mô phỏng</span>
        <h4>Tự tra cứu bằng sparse index</h4>
      </div>
      <div className="wg-controls">
        <label>
          Đọc offset <b>{target}</b>
          <input type="range" min={0} max={9} value={target} onChange={(e) => setTarget(+e.target.value)} />
        </label>
        <label>
          Cắm mốc mỗi <b>{every}</b> tin {every === 1 && '(= index dày)'}
          <input type="range" min={1} max={5} value={every} onChange={(e) => setEvery(+e.target.value)} />
        </label>
      </div>
      <div className="wg-strip">
        {SIZES.map((s, i) => {
          const state = i === target ? 'is-target' : i >= mark && i < target ? 'is-scan' : ''
          return (
            <div key={i} className={`wg-block ${state} ${i === mark ? 'is-mark' : ''}`} style={{ flex: s }}>
              {marks.includes(i) && <span className="wg-flag">⚑</span>}
              <span className="wg-num">{i}</span>
              <span className="wg-size">{s}B</span>
            </div>
          )
        })}
      </div>
      <div className="wg-stats">
        <Stat label="Số dòng index" value={`${marks.length} dòng`} tone={marks.length >= 10 ? 'bad' : 'good'} />
        <Stat label="Nhảy tới mốc" value={`${mark} → byte ${POS[mark]}`} />
        <Stat label="Phải lướt qua" value={`${scanned} tin · ${POS[target] - POS[mark]}B`} tone={scanned >= 3 ? 'bad' : 'good'} />
        <Stat label="Offset bắt đầu ở" value={`byte ${POS[target]}`} />
      </div>
      <p className="wg-note">
        {every === 1
          ? 'Mốc ở mọi tin: không phải lướt, nhưng bảng index dài nhất (tốn RAM nhất).'
          : every >= 4
            ? 'Ít mốc: bảng index rất ngắn, đổi lại có lúc phải lướt xa hơn. Kafka chọn khoảng 4KB một mốc.'
            : 'Thử kéo thanh "cắm mốc" để thấy đánh đổi giữa kích thước index và đoạn phải lướt.'}{' '}
        (Segment mẫu: 10 tin, {TOTAL} byte.)
      </p>
    </div>
  )
}

const partitionOf = (key: string, n: number) => parseInt(textHash(key), 16) % n
const SAMPLE_KEYS = ['wallet-1', 'wallet-2', 'wallet-3', 'wallet-4', 'wallet-5', 'wallet-6', 'wallet-7', 'wallet-8']

/** Try key → partition yourself, and see which keys move house when partitions are added. */
function PartitionLab() {
  const [key, setKey] = useState('wallet-42')
  const [n, setN] = useState(3)
  const p = partitionOf(key, n)
  const p2 = partitionOf(key, n + 1)
  const moved = SAMPLE_KEYS.filter((k) => partitionOf(k, n) !== partitionOf(k, n + 1)).length
  return (
    <div className="wg">
      <div className="wg-head">
        <span className="wg-badge">Mô phỏng</span>
        <h4>Key nào vào partition nào?</h4>
      </div>
      <div className="wg-controls">
        <label>
          Key
          <input className="wg-input" value={key} onChange={(e) => setKey(e.target.value)} />
        </label>
        <label>
          Số partition <b>{n}</b>
          <input type="range" min={1} max={12} value={n} onChange={(e) => setN(+e.target.value)} />
        </label>
      </div>
      <div className="wg-lanes">
        {Array.from({ length: n }, (_, i) => (
          <div key={i} className={`wg-lane ${i === p ? 'is-target' : ''}`}>
            P{i}
            {i === p && <span className="wg-chip">{key || '∅'}</span>}
          </div>
        ))}
      </div>
      <div className="wg-stats">
        <Stat label="hash(key)" value={String(parseInt(textHash(key), 16))} />
        <Stat label={`hash % ${n}`} value={`P${p}`} tone="good" />
        <Stat label={`Nếu tăng lên ${n + 1}`} value={p === p2 ? `vẫn P${p2}` : `đổi sang P${p2}`} tone={p === p2 ? 'good' : 'bad'} />
        <Stat label={`Key mẫu đổi nhà (${n} → ${n + 1})`} value={`${moved}/${SAMPLE_KEYS.length}`} tone={moved ? 'bad' : 'good'} />
      </div>
      <p className="wg-note">Gõ cùng một key nhiều lần: luôn ra cùng partition. Kafka thật dùng hàm murmur2; ở đây dùng hàm hash đơn giản để minh hoạ.</p>
    </div>
  )
}

const SPAN_DAYS = 20

/** Roll + retention simulator: one message per day; segments roll by segment.ms (checked on append), retention deletes whole segments. */
function RetentionLab() {
  const [segDays, setSegDays] = useState(7)
  const [retDays, setRetDays] = useState(7)
  const [silent, setSilent] = useState(0)

  // Messages oldest → newest, by age in days; nothing was written during the last `silent` days.
  const ages = Array.from({ length: SPAN_DAYS - silent + 1 }, (_, i) => SPAN_DAYS - i)
  const segs: { oldest: number; newest: number }[] = []
  for (const age of ages) {
    const cur = segs[segs.length - 1]
    if (!cur || cur.oldest - age >= segDays) segs.push({ oldest: age, newest: age })
    else cur.newest = age
  }
  const kept = segs.filter((g) => g.newest <= retDays)
  const allGone = kept.length === 0
  const oldestKept = allGone ? null : Math.max(...kept.map((g) => g.oldest))
  const overdue = kept.reduce((n, g) => n + ages.filter((a) => a <= g.oldest && a >= g.newest && a > retDays).length, 0)
  const pct = (age: number) => ((SPAN_DAYS - age) / SPAN_DAYS) * 100

  return (
    <div className="wg">
      <div className="wg-head">
        <span className="wg-badge">Mô phỏng</span>
        <h4>Roll & retention trong 20 ngày</h4>
      </div>
      <div className="wg-controls wg-controls-3">
        <label>
          segment.ms = <b>{segDays} ngày</b>
          <input type="range" min={1} max={10} value={segDays} onChange={(e) => setSegDays(+e.target.value)} />
        </label>
        <label>
          retention.ms = <b>{retDays} ngày</b>
          <input type="range" min={1} max={14} value={retDays} onChange={(e) => setRetDays(+e.target.value)} />
        </label>
        <label>
          Im lặng <b>{silent} ngày</b> cuối
          <input type="range" min={0} max={15} value={silent} onChange={(e) => setSilent(+e.target.value)} />
        </label>
      </div>
      <div className="wg-timeline">
        <div className="wg-cutoff" style={{ left: `${pct(retDays)}%` }}>
          <span>retention</span>
        </div>
        {segs.map((g, i) => {
          const dead = g.newest > retDays
          const active = !allGone && i === segs.length - 1
          return (
            <div
              key={g.oldest}
              className={`wg-seg ${dead ? 'is-dead' : active ? 'is-active' : ''}`}
              style={{ left: `${pct(g.oldest)}%`, width: `calc(${pct(g.newest) - pct(g.oldest)}% + 14px)` }}
              title={`tin ${g.oldest} → ${g.newest} ngày tuổi`}
            >
              {dead ? '✗' : active ? 'active' : `S${i}`}
            </div>
          )
        })}
        {allGone && (
          <div className="wg-seg is-active" style={{ left: 'calc(100% - 64px)', width: 64 }}>
            rỗng
          </div>
        )}
        <div className="wg-axis">
          <span>20 ngày trước</span>
          <span>hôm nay</span>
        </div>
      </div>
      <div className="wg-stats">
        <Stat label="Segment còn lại" value={allGone ? '1 (rỗng)' : `${kept.length}`} />
        <Stat label="Segment bị xoá" value={`${segs.length - kept.length}`} tone={segs.length - kept.length ? 'bad' : ''} />
        <Stat label="Tin cũ nhất còn" value={oldestKept === null ? 'không còn tin' : `${oldestKept} ngày tuổi`} tone={oldestKept !== null && oldestKept > retDays ? 'bad' : 'good'} />
        <Stat label="Tin quá retention vẫn còn" value={`${overdue} tin`} tone={overdue ? 'bad' : 'good'} />
      </div>
      <p className="wg-note">
        {allGone
          ? 'Topic im lặng lâu hơn retention: mọi segment bị xoá, chỉ còn một segment rỗng mới.'
          : 'Segment chỉ bị xoá khi tin MỚI NHẤT trong nó quá retention, nên tin cũ hơn retention vẫn có thể còn. Thử giảm segment.ms để xoá sát hơn.'}
      </p>
    </div>
  )
}

/** Numbers that split evenly across many consumer counts (multiples of 6 and 12). */
const FRIENDLY = [1, 2, 3, 4, 6, 8, 12, 18, 24, 30, 36, 48, 60, 72, 96, 120, 144, 180, 240, 360]

/** Partition calculator: throughput → partition count, then how a consumer group shares them. */
function PartitionCalculator() {
  const [target, setTarget] = useState(1000)
  const [perConsumer, setPerConsumer] = useState(50)
  const [perPartition, setPerPartition] = useState(100)
  const [headroom, setHeadroom] = useState(1.5)
  const need = Math.max(Math.ceil(target / perConsumer), Math.ceil(target / perPartition))
  const withRoom = Math.ceil(need * headroom)
  const pick = FRIENDLY.find((f) => f >= withRoom) ?? withRoom
  const [consumers, setConsumers] = useState(4)
  const working = Math.min(consumers, pick)
  const per = Math.floor(pick / working)
  const extra = pick % working
  const loads = Array.from({ length: working }, (_, j) => per + (j < extra ? 1 : 0))
  const ramKb = pick * 16
  const ramText = ramKb < 1024 ? `${ramKb} KB` : `${(ramKb / 1024).toFixed(1)} MB`
  return (
    <div className="wg">
      <div className="wg-head">
        <span className="wg-badge">Mô phỏng</span>
        <h4>Máy tính số partition</h4>
      </div>
      <div className="wg-controls wg-controls-3">
        <label>
          Mục tiêu <b>{target} MB/s</b>
          <input type="range" min={50} max={3000} step={50} value={target} onChange={(e) => setTarget(+e.target.value)} />
        </label>
        <label>
          1 consumer xử lý <b>{perConsumer} MB/s</b>
          <input type="range" min={5} max={200} step={5} value={perConsumer} onChange={(e) => setPerConsumer(+e.target.value)} />
        </label>
        <label>
          1 partition ghi <b>{perPartition} MB/s</b>
          <input type="range" min={10} max={300} step={10} value={perPartition} onChange={(e) => setPerPartition(+e.target.value)} />
        </label>
        <label>
          Dư phòng <b>× {headroom}</b>
          <input type="range" min={1} max={3} step={0.25} value={headroom} onChange={(e) => setHeadroom(+e.target.value)} />
        </label>
        <label>
          Số consumer chạy <b>{consumers}</b>
          <input type="range" min={1} max={Math.max(12, pick + 4)} value={consumers} onChange={(e) => setConsumers(+e.target.value)} />
        </label>
      </div>
      <div className="wg-stats">
        <Stat label="Tối thiểu (max đọc, ghi)" value={`${need} partition`} />
        <Stat label="Cộng dư phòng" value={`${withRoom} partition`} />
        <Stat label="Gợi ý số chia đều" value={`${pick} partition`} tone="good" />
        <Stat label="RAM producer (16KB × N)" value={ramText} tone={ramKb > 32 * 1024 ? 'bad' : 'good'} />
      </div>
      <div className="wg-loads">
        {Array.from({ length: consumers }, (_, j) => {
          const load = j < working ? loads[j] : 0
          const heavy = j < working && extra > 0 && load === per + 1
          return (
            <div key={j} className={`wg-load ${load === 0 ? 'is-idle' : heavy ? 'is-heavy' : ''}`}>
              <div className="wg-load-bar" style={{ height: `${Math.min(100, (load / Math.max(1, per + 1)) * 100)}%` }} />
              <span>{load === 0 ? 'rảnh' : load}</span>
            </div>
          )
        })}
      </div>
      <p className="wg-note">
        {consumers > pick
          ? `${consumers - pick} consumer ngồi chơi: số partition (${pick}) là trần song song.`
          : extra > 0
            ? `${pick} partition chia cho ${working} consumer bị lệch: ${extra} người gánh ${per + 1}, còn lại gánh ${per}.`
            : `${pick} partition chia đều: mỗi consumer ${per} partition.`}
      </p>
    </div>
  )
}

/**
 * Simplified single-partition producer model: a batch leaves when it is full (batch.size) or linger.ms expires,
 * but never faster than one round trip (the sender is busy with the previous request meanwhile).
 */
function LingerLab() {
  const [rate, setRate] = useState(5000)
  const [msgBytes, setMsgBytes] = useState(100)
  const [linger, setLinger] = useState(0)
  const [batchKb, setBatchKb] = useState(16)
  const [netMb, setNetMb] = useState(20)
  const RTT_MS = 4
  const fillMs = ((batchKb * 1024) / (rate * msgBytes)) * 1000
  const intervalMs = Math.max(RTT_MS, Math.min(fillMs, Math.max(linger, RTT_MS)))
  const perReq = Math.max(1, Math.round((rate * intervalMs) / 1000))
  const reqPerSec = Math.round(Math.min(rate, 1000 / intervalMs))
  const waitMs = Math.round(Math.min(linger, fillMs) / 2)
  const inMb = (rate * msgBytes) / 1e6
  const overflow = inMb > netMb
  const fullAfter = overflow ? 32 / (inMb - netMb) : Infinity
  return (
    <div className="wg">
      <div className="wg-head">
        <span className="wg-badge">Mô phỏng</span>
        <h4>Producer: linger.ms, batch.size và kho</h4>
      </div>
      <div className="wg-controls wg-controls-3">
        <label>
          Tốc độ gửi <b>{rate.toLocaleString('vi-VN')} tin/s</b>
          <input type="range" min={10} max={100000} step={10} value={rate} onChange={(e) => setRate(+e.target.value)} />
        </label>
        <label>
          Cỡ một tin <b>{msgBytes} B</b>
          <input type="range" min={20} max={2000} step={10} value={msgBytes} onChange={(e) => setMsgBytes(+e.target.value)} />
        </label>
        <label>
          linger.ms <b>{linger} ms</b>
          <input type="range" min={0} max={200} value={linger} onChange={(e) => setLinger(+e.target.value)} />
        </label>
        <label>
          batch.size <b>{batchKb} KB</b>
          <input type="range" min={1} max={1024} value={batchKb} onChange={(e) => setBatchKb(+e.target.value)} />
        </label>
        <label>
          Mạng chở được <b>{netMb} MB/s</b>
          <input type="range" min={1} max={200} value={netMb} onChange={(e) => setNetMb(+e.target.value)} />
        </label>
      </div>
      <div className="wg-stats">
        <Stat label="Tin mỗi request" value={`~${perReq.toLocaleString('vi-VN')}`} tone={perReq >= 50 ? 'good' : ''} />
        <Stat label="Request mỗi giây" value={`~${reqPerSec.toLocaleString('vi-VN')}`} />
        <Stat label="Mỗi tin chờ thêm" value={`~${waitMs} ms`} tone={waitMs > 50 ? 'bad' : ''} />
        <Stat label="Kho 32 MB" value={overflow ? `đầy sau ~${fullAfter.toFixed(1)} s` : 'không đầy'} tone={overflow ? 'bad' : 'good'} />
      </div>
      <p className="wg-note">
        {overflow
          ? `App ghi ${inMb.toFixed(1)} MB/s nhưng mạng chỉ chở ${netMb} MB/s: kho đầy, send() bị chặn rồi TimeoutException sau max.block.ms.`
          : fillMs < Math.max(linger, RTT_MS)
            ? 'Thùng đầy trước khi hết linger: tăng linger thêm cũng không giúp gì, thử tăng batch.size.'
            : linger === 0
              ? 'linger.ms = 0: thùng đi ngay khi sender rảnh — vẫn gom được vài tin nhờ batching tự nhiên.'
              : 'Hết linger trước khi thùng đầy: tăng linger thì thùng to hơn nhưng mỗi tin chờ lâu hơn.'}{' '}
        (Mô hình đơn giản: 1 partition, một vòng mạng ~{RTT_MS} ms.)
      </p>
    </div>
  )
}

/** HW lab: set each replica's LEO and ISR membership; HW = min LEO over the ISR, and minISR gates acks=all writes. */
function HwLab() {
  const [leos, setLeos] = useState([10, 8, 6])
  const [inIsr, setInIsr] = useState([true, true, true])
  const [minIsr, setMinIsr] = useState(2)
  const isrLeos = leos.filter((_, i) => inIsr[i])
  const hw = Math.min(...isrLeos)
  const isrSize = isrLeos.length
  const canWrite = isrSize >= minIsr
  const names = ['leader', 'follower 1', 'follower 2']
  return (
    <div className="wg">
      <div className="wg-head">
        <span className="wg-badge">Mô phỏng</span>
        <h4>High Watermark và min.insync.replicas</h4>
      </div>
      {names.map((n, i) => (
        <div key={n} className="wg-replica">
          <label className="wg-replica-name">
            <input type="checkbox" checked={inIsr[i]} disabled={i === 0} onChange={(e) => setInIsr(inIsr.map((v, j) => (j === i ? e.target.checked : v)))} /> {n}
            {i === 0 ? ' (luôn trong ISR)' : inIsr[i] ? ' · trong ISR' : ' · ngoài ISR'}
          </label>
          <div className="wg-tape">
            {Array.from({ length: 14 }, (_, k) => (
              <div key={k} className={`wg-cell ${k < leos[i] ? (k < hw ? 'is-committed' : 'is-pending') : ''} ${!inIsr[i] ? 'is-out' : ''}`}>
                {k === hw && <span className="wg-hw">HW</span>}
              </div>
            ))}
          </div>
          <input type="range" min={i === 0 ? Math.max(...leos.slice(1)) : 0} max={14} value={leos[i]} onChange={(e) => setLeos(leos.map((v, j) => (j === i ? +e.target.value : v)))} />
          <span className="wg-leo">LEO {leos[i]}</span>
        </div>
      ))}
      <div className="wg-controls" style={{ marginTop: 14 }}>
        <label>
          min.insync.replicas <b>{minIsr}</b>
          <input type="range" min={1} max={3} value={minIsr} onChange={(e) => setMinIsr(+e.target.value)} />
        </label>
      </div>
      <div className="wg-stats">
        <Stat label="ISR" value={`${isrSize} bản`} />
        <Stat label="High Watermark" value={`${hw}`} tone="good" />
        <Stat label="Consumer đọc được" value={`offset 0–${hw - 1}`} />
        <Stat label="Ghi acks=all" value={canWrite ? 'được ✓' : 'NOT_ENOUGH_REPLICAS'} tone={canWrite ? 'good' : 'bad'} />
      </div>
      <p className="wg-note">HW = LEO nhỏ nhất trong ISR. Bỏ tick một follower chậm để thấy HW nhảy lên; giảm ISR xuống dưới min.insync.replicas để thấy leader từ chối ghi.</p>
    </div>
  )
}

/** Election lab: toggle brokers alive/in-ISR and unclean election; see who becomes leader and what is lost. */
function ElectionLab() {
  const LEO = [13, 13, 9]
  const [alive, setAlive] = useState([true, true, true])
  const [inIsr, setInIsr] = useState([true, true, false])
  const [unclean, setUnclean] = useState(false)
  const isrAlive = [0, 1, 2].filter((i) => alive[i] && inIsr[i])
  const anyAlive = [0, 1, 2].filter((i) => alive[i])
  const leader = isrAlive[0] ?? (unclean ? anyAlive[0] : undefined)
  const lost = leader !== undefined && !isrAlive.includes(leader) ? 13 - LEO[leader] : 0
  const status = leader === undefined ? (anyAlive.length ? 'đứng chờ: không đọc, không ghi' : 'mọi broker đã chết') : lost ? `chạy tiếp, MẤT ${lost} tin` : 'chạy tiếp, không mất tin'
  return (
    <div className="wg">
      <div className="wg-head">
        <span className="wg-badge">Mô phỏng</span>
        <h4>Bầu leader khi broker chết</h4>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="wg-replica">
          <label className="wg-replica-name">
            <input type="checkbox" checked={alive[i]} onChange={(e) => setAlive(alive.map((v, j) => (j === i ? e.target.checked : v)))} /> broker-{i + 1} sống
            {leader === i && <b style={{ color: 'var(--good)' }}> · LEADER</b>}
          </label>
          <div className="wg-tape">
            {Array.from({ length: 14 }, (_, k) => (
              <div key={k} className={`wg-cell ${k < LEO[i] ? 'is-committed' : ''} ${!alive[i] ? 'is-out' : ''}`} />
            ))}
          </div>
          <label className="wg-replica-name">
            <input type="checkbox" checked={inIsr[i]} onChange={(e) => setInIsr(inIsr.map((v, j) => (j === i ? e.target.checked : v)))} /> trong ISR
          </label>
          <span className="wg-leo">LEO {LEO[i]}</span>
        </div>
      ))}
      <div className="wg-controls" style={{ marginTop: 14 }}>
        <label>
          <span>
            <input type="checkbox" checked={unclean} onChange={(e) => setUnclean(e.target.checked)} /> unclean.leader.election.enable = <b>{String(unclean)}</b>
          </span>
        </label>
      </div>
      <div className="wg-stats">
        <Stat label="ISR còn sống" value={isrAlive.length ? isrAlive.map((i) => i + 1).join(', ') : 'trống'} tone={isrAlive.length ? 'good' : 'bad'} />
        <Stat label="Leader" value={leader === undefined ? '—' : `broker-${leader + 1}`} />
        <Stat label="Partition" value={status} tone={leader === undefined || lost ? 'bad' : 'good'} />
        <Stat label="Tin mất" value={`${lost}`} tone={lost ? 'bad' : 'good'} />
      </div>
      <p className="wg-note">broker-3 đang ngoài ISR và thiếu offset 9–12. Tắt broker-1 và broker-2, rồi thử bật/tắt unclean để thấy đánh đổi giữa sẵn sàng và không mất dữ liệu.</p>
    </div>
  )
}

/** Consumer group lab: who gets which partition under Range / RoundRobin, who idles, and does the team keep up. */
function GroupLab() {
  const WRITE = 1000
  const SPEED = 300
  const [topics, setTopics] = useState(1)
  const [parts, setParts] = useState(4)
  const [consumers, setConsumers] = useState(3)
  const [strategy, setStrategy] = useState<'range' | 'roundrobin'>('range')
  const all = Array.from({ length: topics }, (_, ti) => Array.from({ length: parts }, (_, p) => ({ topic: String.fromCharCode(88 + ti), p }))).flat()
  const owned: { topic: string; p: number }[][] = Array.from({ length: consumers }, () => [])
  if (strategy === 'roundrobin') all.forEach((tp, i) => owned[i % consumers].push(tp))
  else
    for (let ti = 0; ti < topics; ti++) {
      const base = Math.floor(parts / consumers)
      const extra = parts % consumers
      let p = 0
      for (let c = 0; c < consumers; c++) {
        const n = base + (c < extra ? 1 : 0)
        for (let k = 0; k < n; k++) owned[c].push({ topic: String.fromCharCode(88 + ti), p: p++ })
      }
    }
  const perPartition = WRITE / all.length
  const read = owned.reduce((sum, list) => sum + Math.min(SPEED, list.length * perPartition), 0)
  const idle = owned.filter((l) => l.length === 0).length
  const max = Math.max(...owned.map((l) => l.length), 1)
  const growth = Math.round(WRITE - read)
  return (
    <div className="wg">
      <div className="wg-head">
        <span className="wg-badge">Mô phỏng</span>
        <h4>Chia partition trong consumer group</h4>
      </div>
      <div className="wg-controls">
        <label>
          <span>Số topic: <b>{topics}</b></span>
          <input type="range" min={1} max={3} value={topics} onChange={(e) => setTopics(+e.target.value)} />
        </label>
        <label>
          <span>Partition mỗi topic: <b>{parts}</b></span>
          <input type="range" min={1} max={12} value={parts} onChange={(e) => setParts(+e.target.value)} />
        </label>
        <label>
          <span>Số consumer: <b>{consumers}</b></span>
          <input type="range" min={1} max={10} value={consumers} onChange={(e) => setConsumers(+e.target.value)} />
        </label>
        <label>
          <span>
            Thuật toán:{' '}
            <select className="wg-input" value={strategy} onChange={(e) => setStrategy(e.target.value as 'range' | 'roundrobin')}>
              <option value="range">RangeAssignor</option>
              <option value="roundrobin">RoundRobinAssignor</option>
            </select>
          </span>
        </label>
      </div>
      <div className="wg-assign">
        {owned.map((list, c) => {
          const load = list.length * perPartition
          return (
            <div key={c} className={`wg-assign-row ${list.length === 0 ? 'is-idle' : load > SPEED ? 'is-heavy' : ''}`}>
              <span>C{c + 1}</span>
              <div className="wg-assign-track">
                <div className="wg-assign-bar" style={{ width: `${(list.length / max) * 100}%` }} />
              </div>
              <span>{list.length ? list.map((x) => `${topics > 1 ? x.topic : 'P'}${x.p}`).join(' ') : 'ngồi chơi'}</span>
            </div>
          )
        })}
      </div>
      <div className="wg-stats">
        <Stat label="Consumer ngồi chơi" value={`${idle}`} tone={idle ? 'bad' : 'good'} />
        <Stat label="Lệch tải (nhiều nhất / ít nhất)" value={`${max} / ${Math.min(...owned.map((l) => l.length))}`} />
        <Stat label="Đội đọc được" value={`${Math.round(read)} / ${WRITE} tin/s`} tone={growth > 0 ? 'bad' : 'good'} />
        <Stat label="Lag" value={growth > 0 ? `tăng ${growth} tin/s` : 'theo kịp'} tone={growth > 0 ? 'bad' : 'good'} />
      </div>
      <p className="wg-note">Ghi tổng {WRITE} tin/giây, mỗi consumer xử lý tối đa {SPEED} tin/giây. Thử 4 partition với 5 consumer, rồi 3 topic × 5 partition với 2 consumer và đổi Range ↔ RoundRobin.</p>
    </div>
  )
}

/** Rebalance lab: an event + strategy + static membership + session timeout → when, how long unread, how much pauses. */
function RebalanceLab() {
  type Ev = 'join' | 'leave' | 'kill' | 'stuck' | 'deploy'
  const [ev, setEv] = useState<Ev>('join')
  const [coop, setCoop] = useState(false)
  const [stat, setStat] = useState(false)
  const [session, setSession] = useState(45)
  const RESTART = 30
  const PARTS = 8
  // 4 consumers × 2 partitions; a change moves 2 partitions under cooperative-sticky.
  const pausedDuringRebalance = coop ? 2 : PARTS
  let when = ''
  let unread = '0 giây'
  let count = 1
  if (ev === 'join') when = 'ngay (JoinGroup)'
  if (ev === 'leave') {
    when = stat ? `sau ${session} giây (static không gửi LeaveGroup)` : 'ngay (LeaveGroup)'
    unread = stat ? `2 partition × ${session} giây` : '0 giây'
  }
  if (ev === 'kill') {
    when = `sau ${session} giây (hết nhịp tim)`
    unread = `2 partition × ${session} giây`
  }
  if (ev === 'stuck') {
    when = 'sau 300 giây (max.poll.interval.ms)'
    unread = '2 partition × 300 giây'
  }
  if (ev === 'deploy') {
    const kept = stat && session > RESTART
    count = kept ? 0 : 8
    when = kept ? `không rebalance (pod về sau ${RESTART}s < ${session}s)` : `${count} lần (mỗi pod tắt + bật)`
    unread = kept ? `2 partition × ${RESTART} giây, lần lượt từng pod` : '0 giây'
  }
  const events: [Ev, string][] = [
    ['join', 'Thêm consumer'],
    ['leave', 'Tắt gọn (Ctrl+C)'],
    ['kill', 'kill -9 / mất mạng'],
    ['stuck', 'Kẹt trong process()'],
    ['deploy', 'Rolling restart 4 pod'],
  ]
  return (
    <div className="wg">
      <div className="wg-head">
        <span className="wg-badge">Mô phỏng</span>
        <h4>Tình huống rebalance (4 consumer, 8 partition)</h4>
      </div>
      <div className="wg-controls">
        <label>
          <span>
            Sự kiện:{' '}
            <select className="wg-input" value={ev} onChange={(e) => setEv(e.target.value as Ev)}>
              {events.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label>
          <span>session.timeout.ms: <b>{session} giây</b></span>
          <input type="range" min={10} max={300} step={5} value={session} onChange={(e) => setSession(+e.target.value)} />
        </label>
        <label>
          <span>
            <input type="checkbox" checked={coop} onChange={(e) => setCoop(e.target.checked)} /> CooperativeStickyAssignor
          </span>
        </label>
        <label>
          <span>
            <input type="checkbox" checked={stat} onChange={(e) => setStat(e.target.checked)} /> group.instance.id (static)
          </span>
        </label>
      </div>
      <div className="wg-stats">
        <Stat label="Group chia lại" value={when} />
        <Stat label="Số lần rebalance" value={`${count}`} tone={count ? (count > 1 ? 'bad' : '') : 'good'} />
        <Stat label="Không ai đọc" value={unread} tone={unread === '0 giây' ? 'good' : 'bad'} />
        <Stat label="Dừng trong lúc chia" value={count ? `${pausedDuringRebalance}/${PARTS} partition` : '0'} tone={count && !coop ? 'bad' : 'good'} />
      </div>
      <p className="wg-note">Thử: kill -9 với session 45 rồi 10 giây; rolling restart có và không có static membership; bật cooperative để thấy số partition phải dừng giảm từ 8 xuống 2.</p>
    </div>
  )
}

export const WIDGETS: Record<string, FC> = {
  'commit-lab': CommitLab,
  'delivery-lab': DeliveryLab,
  'txn-lab': TxnLab,
  'compaction-lab': CompactionLab,
  'tiered-lab': TieredLab,
  'schema-lab': SchemaLab,
  'connect-lab': ConnectLab,
  'streams-lab': StreamsLab,
  'monitor-lab': MonitorLab,
  'sizing-lab': SizingLab,
  'incident-lab': IncidentLab,
  'outbox-lab': OutboxLab,
  'event-lab': EventLab,
  'retry-lab': RetryLab,
  'capstone-lab': CapstoneLab,
  'rebalance-lab': RebalanceLab, 'group-lab': GroupLab, 'election-lab': ElectionLab, 'hw-lab': HwLab, 'linger-lab': LingerLab, 'partition-calculator': PartitionCalculator,  'sparse-lab': SparseLab, 'partition-lab': PartitionLab, 'retention-lab': RetentionLab }
