import { useState, type CSSProperties } from 'react'

/**
 * Transactions simulator. One partition holds three producer transactions and one plain record. Each transaction is
 * committed, aborted or left open; markers are appended to the end of the log in the order the transactions close.
 * The readout shows what a consumer sees under read_uncommitted vs read_committed, the Last Stable Offset, and the
 * offset lag that includes marker "holes".
 */

type Status = 'commit' | 'abort' | 'open'
type Isolation = 'read_uncommitted' | 'read_committed'

interface Tx {
  id: string
  size: number
}

/** Data layout in the log: T1(3) T2(2) plain(1) T3(2). Markers follow, one per closed transaction. */
const TXS: Tx[] = [
  { id: 'T1', size: 3 },
  { id: 'T2', size: 2 },
  { id: 'T3', size: 2 },
]
const PLAIN_AFTER = 'T2'

interface Rec {
  offset: number
  kind: 'data' | 'plain' | 'marker'
  tx?: string
  /** For markers: the verdict they carry. */
  verdict?: 'commit' | 'abort'
}

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`wg-stat ${tone}`}>
      <div className="wg-stat-label">{label}</div>
      <div className="wg-stat-value">{value}</div>
    </div>
  )
}

function buildLog(status: Record<string, Status>): Rec[] {
  const log: Rec[] = []
  let offset = 0
  for (const tx of TXS) {
    for (let i = 0; i < tx.size; i++) log.push({ offset: offset++, kind: 'data', tx: tx.id })
    if (tx.id === PLAIN_AFTER) log.push({ offset: offset++, kind: 'plain' })
  }
  for (const tx of TXS) {
    const s = status[tx.id]
    if (s !== 'open') log.push({ offset: offset++, kind: 'marker', tx: tx.id, verdict: s })
  }
  return log
}

const STATUS_LABEL: Record<Status, string> = { commit: 'COMMIT', abort: 'ABORT', open: 'còn mở' }

export default function TxnLab() {
  const [status, setStatus] = useState<Record<string, Status>>({ T1: 'commit', T2: 'abort', T3: 'open' })
  const [iso, setIso] = useState<Isolation>('read_committed')

  const log = buildLog(status)
  const hw = log.length
  const firstOpen = log.find((r) => r.kind === 'data' && status[r.tx as string] === 'open')
  const lso = firstOpen ? firstOpen.offset : hw

  const visible = (r: Rec): boolean => {
    if (r.kind === 'marker') return false
    if (iso === 'read_uncommitted') return r.offset < hw
    if (r.offset >= lso) return false
    return r.kind === 'plain' || status[r.tx as string] === 'commit'
  }
  const seen = log.filter(visible)
  const realData = log.filter((r) => r.kind !== 'marker').length
  const markers = log.filter((r) => r.kind === 'marker').length
  const aborted = log.filter((r) => r.kind === 'data' && status[r.tx as string] === 'abort').length
  const leaked = iso === 'read_uncommitted' ? seen.filter((r) => r.kind === 'data' && status[r.tx as string] === 'abort').length : 0
  const blocked = iso === 'read_committed' ? log.filter((r) => r.kind !== 'marker' && r.offset >= lso && (r.kind === 'plain' || status[r.tx as string] !== 'abort')).length : 0

  const cellStyle = (r: Rec): CSSProperties => {
    const st = r.tx ? status[r.tx] : 'commit'
    const base: CSSProperties = { height: 64, borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14, border: '2px solid transparent', minWidth: 0 }
    if (r.kind === 'marker') return { ...base, background: r.verdict === 'commit' ? 'linear-gradient(180deg,#16a34a,#14532d)' : 'linear-gradient(180deg,#ef4444,#7f1d1d)', borderColor: r.verdict === 'commit' ? '#4ade80' : '#f87171' }
    if (r.kind === 'plain') return { ...base, background: 'linear-gradient(180deg,#3b82f6,#1e40af)', borderColor: '#60a5fa' }
    if (st === 'open') return { ...base, background: 'linear-gradient(180deg,#3b82f6,#1e40af)', borderColor: '#f59e0b', borderStyle: 'dashed' }
    if (st === 'abort') return { ...base, background: 'rgba(40,62,140,0.45)', borderColor: '#f87171', borderStyle: 'dashed' }
    return { ...base, background: 'linear-gradient(180deg,#3b82f6,#1e40af)', borderColor: '#60a5fa' }
  }

  return (
    <div className="wg">
      <div className="wg-head">
        <span className="wg-badge">Mô phỏng</span>
        <h4>Transaction và read_committed trên một partition</h4>
      </div>
      <div className="wg-controls">
        {TXS.map((tx) => (
          <label key={tx.id}>
            <span>
              {tx.id} ({tx.size} tin):{' '}
              <select className="wg-input" value={status[tx.id]} onChange={(e) => setStatus({ ...status, [tx.id]: e.target.value as Status })}>
                {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </span>
          </label>
        ))}
        <label>
          <span>
            isolation.level:{' '}
            <select className="wg-input" value={iso} onChange={(e) => setIso(e.target.value as Isolation)}>
              <option value="read_committed">read_committed</option>
              <option value="read_uncommitted">read_uncommitted (mặc định)</option>
            </select>
          </span>
        </label>
      </div>

      <div className="wg-strip" style={{ paddingTop: 40, paddingBottom: 30 }}>
        {log.map((r) => {
          const mark = r.offset === lso && lso < hw
          return (
            <div key={r.offset} style={{ position: 'relative', flex: '1 1 0', minWidth: 0, opacity: visible(r) || r.kind === 'marker' ? 1 : 0.4 }}>
              {mark && <div style={{ position: 'absolute', top: -34, left: 0, fontSize: 12, fontWeight: 800, color: '#f59e0b', whiteSpace: 'nowrap' }}>▼ Last Stable Offset</div>}
              <div style={cellStyle(r)}>
                <span>{r.kind === 'marker' ? (r.verdict === 'commit' ? '✔' : '✖') : r.kind === 'plain' ? 'tin' : r.tx}</span>
                <span style={{ fontSize: 11, opacity: 0.85 }}>{r.kind === 'marker' ? `marker ${r.tx}` : r.kind === 'plain' ? 'thường' : ''}</span>
              </div>
              <div style={{ textAlign: 'center', fontSize: 12, marginTop: 4, color: 'var(--muted)' }}>{r.offset}</div>
            </div>
          )
        })}
        <div style={{ position: 'relative', flex: '0 0 auto', paddingLeft: 4, alignSelf: 'flex-end', paddingBottom: 22, fontSize: 12, fontWeight: 800, color: 'var(--muted)', whiteSpace: 'nowrap' }}>◀ HW = {hw}</div>
      </div>

      <div className="wg-stats">
        <Stat label="High Watermark" value={`${hw}`} />
        <Stat label="Last Stable Offset" value={lso === hw ? `${lso} (= HW, không transaction mở)` : `${lso} (ghim bởi transaction mở)`} tone={lso === hw ? 'good' : 'bad'} />
        <Stat label={`Consumer ${iso} nhận`} value={`${seen.length} tin`} tone={leaked ? 'bad' : 'good'} />
        <Stat label="Lag hiển thị (HW − 0)" value={`${hw} offset, chỉ ${realData} tin dữ liệu, ${markers} marker`} tone={markers ? 'bad' : 'good'} />
      </div>
      <div className="wg-stats">
        <Stat label="Tin của transaction bị huỷ" value={`${aborted} tin vẫn nằm trên đĩa`} />
        <Stat label="Lọt tới consumer" value={leaked ? `${leaked} tin của transaction bị huỷ` : 'không có'} tone={leaked ? 'bad' : 'good'} />
        <Stat label="Bị chặn sau Last Stable Offset" value={blocked ? `${blocked} tin đang chờ` : 'không có'} tone={blocked ? 'bad' : 'good'} />
        <Stat label="Marker chiếm offset" value={`${markers}`} />
      </div>
      <p className="wg-note">
        Thử: để T3 còn mở và đổi sang read_committed: consumer dừng ở Last Stable Offset, kể cả tin thường nằm sau. Đóng T3 để mốc nhảy lên bằng HW. Đổi sang read_uncommitted để thấy tin của T2 bị huỷ vẫn lọt tới consumer. So HW với số tin thật để thấy marker tạo &quot;lỗ&quot; trong offset.
      </p>
    </div>
  )
}
