import { useState, type CSSProperties } from 'react'

/**
 * Schema compatibility simulator. Pick a change from Order v1 to v2 and a compatibility mode. The readout shows each
 * field table, what a NEW reader does with an OLD record and what an OLD reader does with a NEW record (Avro rules:
 * a missing field is filled from the default, an unknown field is skipped), the Registry verdict for the chosen mode,
 * and which side must be upgraded first.
 */

type Mode = 'BACKWARD' | 'FORWARD' | 'FULL' | 'NONE'
type ChangeId = 'add-default' | 'add-no-default' | 'remove-no-default' | 'remove-default' | 'rename'

interface Field {
  name: string
  type: string
  /** Default value as shown to the learner; undefined = no default. */
  def?: string
}

interface Change {
  id: ChangeId
  label: string
  v2: Field[]
}

const V1: Field[] = [
  { name: 'order_id', type: 'long' },
  { name: 'amount', type: 'long' },
]

const CHANGES: Change[] = [
  { id: 'add-default', label: 'Thêm note: string, có default ""', v2: [...V1, { name: 'note', type: 'string', def: '""' }] },
  { id: 'add-no-default', label: 'Thêm note: string, không default', v2: [...V1, { name: 'note', type: 'string' }] },
  { id: 'remove-no-default', label: 'Bỏ amount (không có default)', v2: [V1[0]] },
  { id: 'remove-default', label: 'Bỏ trường có default (amount default 0)', v2: [V1[0]] },
  { id: 'rename', label: 'Đổi tên amount thành total', v2: [V1[0], { name: 'total', type: 'long' }] },
]

const MODES: Mode[] = ['BACKWARD', 'FORWARD', 'FULL', 'NONE']

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`wg-stat ${tone}`}>
      <div className="wg-stat-label">{label}</div>
      <div className="wg-stat-value">{value}</div>
    </div>
  )
}

/** v1 fields for the chosen change: the "remove with default" case needs amount to carry a default in v1. */
function v1For(id: ChangeId): Field[] {
  return id === 'remove-default' ? [V1[0], { ...V1[1], def: '0' }] : V1
}

interface ReadResult {
  ok: boolean
  /** One line per reader field: how it was obtained. */
  lines: string[]
}

/** Avro resolution: reader fields come from the writer by name, else the default, else the read fails. */
function resolve(writer: Field[], reader: Field[]): ReadResult {
  let ok = true
  const lines = reader.map((f) => {
    if (writer.some((w) => w.name === f.name)) return `${f.name}: đọc từ tin`
    if (f.def !== undefined) return `${f.name}: thiếu trong tin, điền default ${f.def}`
    ok = false
    return `${f.name}: thiếu trong tin và không có default, lỗi`
  })
  const skipped = writer.filter((w) => !reader.some((f) => f.name === w.name)).map((w) => w.name)
  if (skipped.length) lines.push(`bỏ qua trường lạ: ${skipped.join(', ')}`)
  return { ok, lines }
}

const FIRST: Record<Mode, string> = {
  BACKWARD: 'Nâng cấp consumer trước, rồi mới đến producer.',
  FORWARD: 'Nâng cấp producer trước, rồi mới đến consumer.',
  FULL: 'Thứ tự nào cũng được.',
  NONE: 'Không có đảm bảo nào: tự chịu rủi ro.',
}

const box: CSSProperties = { border: '1px solid var(--line, #3a4458)', borderRadius: 10, padding: '10px 14px', minWidth: 0 }

function FieldTable({ title, fields, mark }: { title: string; fields: Field[]; mark?: (f: Field) => 'new' | 'gone' | undefined }) {
  return (
    <div style={{ ...box, flex: '1 1 220px' }}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>{title}</div>
      {fields.map((f) => {
        const m = mark?.(f)
        return (
          <div key={f.name} style={{ display: 'flex', gap: 8, fontFamily: 'monospace', fontSize: 14, color: m === 'new' ? '#22c55e' : m === 'gone' ? '#ef4444' : undefined, textDecoration: m === 'gone' ? 'line-through' : undefined }}>
            <span>{m === 'new' ? '+' : m === 'gone' ? '−' : ' '}</span>
            <span>{f.name}</span>
            <span style={{ opacity: 0.7 }}>{f.type}</span>
            {f.def !== undefined && <span style={{ opacity: 0.7 }}>= {f.def}</span>}
          </div>
        )
      })}
    </div>
  )
}

export default function SchemaLab() {
  const [changeId, setChangeId] = useState<ChangeId>('add-default')
  const [mode, setMode] = useState<Mode>('BACKWARD')

  const change = CHANGES.find((c) => c.id === changeId) as Change
  const v1 = v1For(changeId)
  const v2 = change.v2
  const newReadsOld = resolve(v1, v2)
  const oldReadsNew = resolve(v2, v1)

  const needBackward = mode === 'BACKWARD' || mode === 'FULL'
  const needForward = mode === 'FORWARD' || mode === 'FULL'
  const accepted = (!needBackward || newReadsOld.ok) && (!needForward || oldReadsNew.ok)
  const why = [needBackward && !newReadsOld.ok ? 'schema mới không đọc được tin cũ' : '', needForward && !oldReadsNew.ok ? 'schema cũ không đọc được tin mới' : ''].filter(Boolean).join('; ')

  const addedOrGone = (other: Field[]) => (f: Field) => (other.some((o) => o.name === f.name) ? undefined : 'new')
  const goneIn = (other: Field[]) => (f: Field) => (other.some((o) => o.name === f.name) ? undefined : 'gone')

  return (
    <div className="wg">
      <div className="wg-head">
        <span className="wg-badge">Mô phỏng</span>
        <h4>Đổi schema Order v1 → v2 và chế độ compatibility</h4>
      </div>
      <div className="wg-controls">
        <label>
          <span>
            Thay đổi:{' '}
            <select className="wg-input" value={changeId} onChange={(e) => setChangeId(e.target.value as ChangeId)}>
              {CHANGES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label>
          <span>
            Chế độ của subject:{' '}
            <select className="wg-input" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              {MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                  {m === 'BACKWARD' ? ' (mặc định)' : ''}
                </option>
              ))}
            </select>
          </span>
        </label>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '12px 0' }}>
        <FieldTable title="Order v1" fields={v1} mark={goneIn(v2)} />
        <FieldTable title="Order v2" fields={v2} mark={addedOrGone(v1)} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '12px 0' }}>
        {[
          { title: 'Code mới (v2) đọc tin cũ (v1)', r: newReadsOld },
          { title: 'Code cũ (v1) đọc tin mới (v2)', r: oldReadsNew },
        ].map(({ title, r }) => (
          <div key={title} style={{ ...box, flex: '1 1 260px', borderColor: r.ok ? '#22c55e' : '#ef4444' }}>
            <div style={{ fontWeight: 800, color: r.ok ? '#22c55e' : '#ef4444' }}>
              {r.ok ? '✔' : '✖'} {title}
            </div>
            {r.lines.map((l) => (
              <div key={l} style={{ fontSize: 14, marginTop: 4 }}>
                {l}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="wg-stats">
        <Stat label={`Registry (${mode}) cho đăng ký v2?`} value={accepted ? 'Chấp nhận, cấp id mới' : `Từ chối: ${why}`} tone={accepted ? 'good' : 'bad'} />
        <Stat label="Ai nâng cấp trước" value={accepted ? FIRST[mode] : 'Chưa đăng ký được nên chưa có gì để nâng cấp'} tone={accepted ? 'good' : ''} />
        <Stat label="Chế độ yêu cầu" value={mode === 'NONE' ? 'không kiểm tra' : [needBackward ? 'mới đọc cũ' : '', needForward ? 'cũ đọc mới' : ''].filter(Boolean).join(' + ')} />
      </div>
      <p className="wg-note">
        Thử: thêm note không default ở BACKWARD để thấy bị từ chối, rồi đổi sang FORWARD thì qua. Bỏ amount (không default) thì ngược lại. Chỉ &quot;thêm trường có default&quot; qua được cả FULL. Đổi tên là bỏ một trường và thêm một trường nên phá cả hai chiều. Chế độ NONE chấp nhận mọi thứ, kể cả những thay đổi làm hỏng consumer.
      </p>
    </div>
  )
}
