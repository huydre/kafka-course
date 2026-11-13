import { useState, type CSSProperties } from 'react'

/**
 * Compaction simulator. One partition made of closed segments plus an active segment. You append updates, roll the
 * active segment, write a tombstone, let days pass and run the log cleaner. The cleaner only works when the dirty ratio
 * reaches the threshold, never touches the active segment, keeps tombstones for delete.retention.ms and (with
 * compact,delete) also drops closed segments older than retention.ms.
 */

type Policy = 'delete' | 'compact' | 'compact,delete'

interface Rec {
  offset: number
  key: string
  /** null = tombstone. */
  ver: number | null
  day: number
  /** Day the cleaner first processed this tombstone. */
  tombSeen?: number
}

interface State {
  /** Closed segments followed by the active one (last). */
  segs: Rec[][]
  /** How many leading segments were already compacted ("clean part"). */
  cleaned: number
  next: number
  day: number
  versions: Record<string, number>
  log: string
}

const KEYS = ['u1', 'u2', 'u3', 'u4']
const RETENTION_DAYS = 7
const TOMB_DAYS = 1
const KEY_COLOR: Record<string, string> = {
  u1: 'linear-gradient(180deg,#3b82f6,#1e40af)',
  u2: 'linear-gradient(180deg,#8b5cf6,#4c1d95)',
  u3: 'linear-gradient(180deg,#14b8a6,#115e59)',
  u4: 'linear-gradient(180deg,#f59e0b,#92400e)',
}

function initial(): State {
  const keys = ['u1', 'u2', 'u1', 'u3', 'u1', 'u2', 'u3', 'u1', 'u4', 'u1']
  const versions: Record<string, number> = {}
  const segs: Rec[][] = [[], [], []]
  keys.forEach((key, i) => {
    versions[key] = (versions[key] ?? 0) + 1
    segs[Math.min(2, Math.floor(i / 4))].push({ offset: i, key, ver: versions[key], day: 0 })
  })
  return { segs, cleaned: 0, next: keys.length, day: 0, versions, log: 'Log có 10 tin: 2 segment đã đóng, active segment đang ghi.' }
}

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`wg-stat ${tone}`}>
      <div className="wg-stat-label">{label}</div>
      <div className="wg-stat-value">{value}</div>
    </div>
  )
}

const fmt = (v: number) => v.toFixed(2).replace('.', ',')

export default function CompactionLab() {
  const [policy, setPolicy] = useState<Policy>('compact')
  const [threshold, setThreshold] = useState(0.5)
  const [s, setS] = useState<State>(initial)

  const sealed = s.segs.slice(0, -1)
  const active = s.segs[s.segs.length - 1]
  const sizeOf = (segs: Rec[][]) => segs.reduce((n, g) => n + g.length, 0)
  const cleanSize = sizeOf(sealed.slice(0, s.cleaned))
  const dirtySize = sizeOf(sealed.slice(s.cleaned))
  const ratio = cleanSize + dirtySize === 0 ? 0 : dirtySize / (cleanSize + dirtySize)
  const all = s.segs.flat()
  const latest = new Map<string, Rec>()
  all.forEach((r) => latest.set(r.key, r))
  const dupes = all.length - latest.size
  const compacting = policy !== 'delete'

  const append = (key: string, tomb = false) =>
    setS((p) => {
      const versions = { ...p.versions }
      if (!tomb) versions[key] = (versions[key] ?? 0) + 1
      const segs = p.segs.map((g) => g.slice())
      segs[segs.length - 1].push({ offset: p.next, key, ver: tomb ? null : versions[key], day: p.day })
      return { ...p, segs, versions, next: p.next + 1, log: tomb ? `Ghi tombstone cho ${key} (value null) ở offset ${p.next}.` : `Ghi bản mới của ${key} ở offset ${p.next}, vào active segment.` }
    })

  const roll = () =>
    setS((p) => {
      if (p.segs[p.segs.length - 1].length === 0) return { ...p, log: 'Active segment đang trống, chưa cần roll.' }
      return { ...p, segs: [...p.segs, []], log: 'Roll: active segment đóng lại (thành phần bẩn), segment mới trống bắt đầu nhận tin.' }
    })

  const wait = (days: number) => setS((p) => ({ ...p, day: p.day + days, log: `Thời gian trôi ${days} ngày (hôm nay là ngày ${p.day + days}).` }))

  const runCleaner = () =>
    setS((p) => {
      let segs = p.segs.map((g) => g.slice())
      let cleaned = p.cleaned
      const notes: string[] = []
      // retention.ms: whole closed segments whose newest record is too old
      if (policy !== 'compact') {
        const closed = segs.slice(0, -1)
        const keep = closed.filter((g) => g.length === 0 || p.day - Math.max(...g.map((r) => r.day)) <= RETENTION_DAYS)
        const removed = closed.length - keep.length
        if (removed > 0) {
          const removedClean = closed.slice(0, cleaned).filter((g) => !(g.length === 0 || p.day - Math.max(...g.map((r) => r.day)) <= RETENTION_DAYS)).length
          segs = [...keep, segs[segs.length - 1]]
          cleaned = Math.max(0, cleaned - removedClean)
          notes.push(`retention.ms: xoá ${removed} segment quá ${RETENTION_DAYS} ngày (kể cả bản mới nhất của key)`)
        }
      }
      if (policy === 'delete') return { ...p, segs, cleaned, log: notes.length ? notes.join('; ') + '.' : 'Policy delete: không có segment nào quá hạn, không có gì để xoá. Compaction không chạy.' }
      const sealedNow = segs.slice(0, -1)
      const dirtyN = sizeOf(sealedNow.slice(cleaned))
      const cleanN = sizeOf(sealedNow.slice(0, cleaned))
      // an expired tombstone makes the log eligible even when the dirty ratio is low
      const expired = sealedNow.flat().some((rec) => rec.ver === null && rec.tombSeen !== undefined && p.day - rec.tombSeen >= TOMB_DAYS)
      if (dirtyN === 0 && !expired) return { ...p, segs, cleaned, log: [...notes, 'Không có phần bẩn, cleaner không có gì để làm.'].join('; ') }
      const r = cleanN + dirtyN === 0 ? 0 : dirtyN / (cleanN + dirtyN)
      if (r < threshold && !expired) return { ...p, segs, cleaned, log: [...notes, `Dirty ratio ${fmt(r)} < ngưỡng ${fmt(threshold)}: cleaner chưa chọn partition này.`].join('; ') }
      // build key -> latest offset over the closed part, then rewrite it
      const newest = new Map<string, number>()
      sealedNow.flat().forEach((rec) => newest.set(rec.key, rec.offset))
      let dropped = 0
      let tombDropped = 0
      const rewritten = sealedNow.map((g) =>
        g
          .filter((rec) => {
            if (rec.offset < (newest.get(rec.key) ?? -1)) {
              dropped++
              return false
            }
            if (rec.ver === null && rec.tombSeen !== undefined && p.day - rec.tombSeen >= TOMB_DAYS) {
              tombDropped++
              return false
            }
            return true
          })
          .map((rec) => (rec.ver === null && rec.tombSeen === undefined ? { ...rec, tombSeen: p.day } : rec)),
      )
      const nonEmpty = rewritten.filter((g) => g.length > 0)
      return {
        ...p,
        segs: [...nonEmpty, segs[segs.length - 1]],
        cleaned: nonEmpty.length,
        log: [...notes, `Dirty ratio ${fmt(r)} ≥ ${fmt(threshold)}: cleaner dọn, bỏ ${dropped} bản cũ${tombDropped ? `, dọn ${tombDropped} tombstone hết hạn` : ''}. Active segment không bị đụng tới.`].join('; '),
      }
    })

  const cell = (r: Rec): CSSProperties => ({
    height: 58,
    minWidth: 54,
    flex: '1 1 0',
    borderRadius: 10,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 800,
    fontSize: 14,
    background: r.ver === null ? 'rgba(40,62,140,0.5)' : KEY_COLOR[r.key],
    border: r.ver === null ? '2px dashed #f87171' : '2px solid rgba(255,255,255,0.25)',
    opacity: latest.get(r.key) === r ? 1 : 0.6,
  })

  const zone = (title: string, color: string, segs: Rec[][], base: number) => (
    <div style={{ flex: Math.max(1, sizeOf(segs)), minWidth: 120 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color, marginBottom: 6, whiteSpace: 'nowrap' }}>{title}</div>
      <div style={{ display: 'flex', gap: 4, paddingTop: 4, borderTop: `3px solid ${color}` }}>
        {segs.length === 0 || sizeOf(segs) === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--muted)', padding: '20px 0' }}>trống</div>
        ) : (
          segs.map((g, gi) => (
            <div key={base + gi} style={{ display: 'flex', gap: 4, flex: g.length, padding: '0 4px', borderRight: gi < segs.length - 1 ? '2px dashed rgba(110,160,255,0.45)' : undefined }}>
              {g.map((r) => (
                <div key={r.offset} style={{ flex: '1 1 0', minWidth: 54 }}>
                  <div style={cell(r)}>
                    <span>{r.key}</span>
                    <span style={{ fontSize: 12, opacity: 0.9 }}>{r.ver === null ? 'null' : `v${r.ver}`}</span>
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 12, marginTop: 3, color: 'var(--muted)' }}>{r.offset}</div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )

  const hasTomb = all.some((r) => r.ver === null)
  const staleInActive = active.filter((r) => latest.get(r.key) !== r).length

  return (
    <div className="wg">
      <div className="wg-head">
        <span className="wg-badge">Mô phỏng</span>
        <h4>Log cleaner trên một partition compacted</h4>
      </div>
      <div className="wg-controls">
        <label>
          <span>
            cleanup.policy:{' '}
            <select className="wg-input" value={policy} onChange={(e) => setPolicy(e.target.value as Policy)}>
              <option value="delete">delete (mặc định)</option>
              <option value="compact">compact</option>
              <option value="compact,delete">compact,delete</option>
            </select>
          </span>
        </label>
        <label>
          <span>
            min.cleanable.dirty.ratio:{' '}
            <select className="wg-input" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}>
              <option value={0.1}>0,1</option>
              <option value={0.5}>0,5 (mặc định)</option>
              <option value={0.9}>0,9</option>
            </select>
          </span>
        </label>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {KEYS.slice(0, 3).map((k) => (
          <button key={k} className="btn-ghost" onClick={() => append(k)}>
            Ghi bản mới của {k}
          </button>
        ))}
        <button className="btn-ghost" onClick={() => append('u2', true)}>
          Ghi tombstone u2
        </button>
        <button className="btn-ghost" onClick={roll}>
          Roll segment
        </button>
        <button className="btn-ghost" onClick={() => wait(1)}>
          +1 ngày
        </button>
        <button className="btn-ghost" onClick={() => wait(8)}>
          +8 ngày
        </button>
        <button className="btn-primary" onClick={runCleaner}>
          Chạy cleaner
        </button>
        <button className="btn-ghost" onClick={() => setS(initial())}>
          Đặt lại
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 6 }}>
        {zone('phần sạch (đã compact)', '#4ade80', sealed.slice(0, s.cleaned), 0)}
        {zone('phần bẩn (chưa compact)', '#f59e0b', sealed.slice(s.cleaned), s.cleaned)}
        {zone('active segment (không bao giờ compact)', '#ffffff', [active], 99)}
      </div>

      <div className="wg-stats">
        <Stat label="Ngày hiện tại" value={`${s.day}`} />
        <Stat label="Dirty ratio" value={`${dirtySize} / ${cleanSize + dirtySize} = ${fmt(ratio)}`} tone={compacting && ratio >= threshold ? 'bad' : 'good'} />
        <Stat label="Cleaner" value={!compacting ? 'không chạy (policy delete)' : ratio >= threshold ? 'đủ điều kiện dọn' : 'chưa đủ ngưỡng'} tone={compacting && ratio >= threshold ? 'bad' : 'good'} />
        <Stat label="Tin / key" value={`${all.length} tin, ${latest.size} key`} />
      </div>
      <div className="wg-stats">
        <Stat label="Bản cũ còn trong log" value={dupes ? `${dupes} bản (consumer vẫn có thể thấy)` : 'không có'} tone={dupes ? 'bad' : 'good'} />
        <Stat label="Bản cũ trong active segment" value={staleInActive ? `${staleInActive} bản, chưa thể compact` : 'không có'} tone={staleInActive ? 'bad' : 'good'} />
        <Stat label="Tombstone" value={hasTomb ? 'đang nằm trong log' : 'không có'} />
        <Stat label="Offset lớn nhất" value={`${s.next - 1}`} />
      </div>
      <p className="wg-note">
        <b>Cleaner:</b> {s.log}
      </p>
      <p className="wg-note">
        Thử: với <code>compact</code>, ghi thêm vài bản rồi chạy cleaner ngay: bản trong active segment vẫn còn. Bấm Roll segment rồi chạy lại để thấy chúng thành phần bẩn và được dọn. Hạ ngưỡng xuống 0,1 để cleaner dọn sớm hơn. Ghi tombstone u2, Roll segment, chạy cleaner (bản cũ của u2 mất, tombstone được giữ lại), +1 ngày rồi chạy lại (tombstone biến mất). Chuyển sang <code>compact,delete</code> và +8 ngày để thấy cả bản mới nhất bị xoá.
      </p>
    </div>
  )
}
