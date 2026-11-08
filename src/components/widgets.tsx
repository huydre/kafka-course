import { useState, type FC } from 'react'
import { POS, SIZES, TOTAL } from '../lessons/sparse-index-data'
import { textHash } from '../player/text-hash'

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

export const WIDGETS: Record<string, FC> = { 'sparse-lab': SparseLab, 'partition-lab': PartitionLab }
