import { useState } from 'react'

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`wg-stat ${tone}`}>
      <div className="wg-stat-label">{label}</div>
      <div className="wg-stat-value">{value}</div>
    </div>
  )
}

const fmt = (n: number) => n.toLocaleString('vi-VN')

/* ------------------------------------------------------------------ part 1: notification vs state transfer */

type Style = 'notification' | 'ecst'

/** API calls hitting the Customer service per hour: every consumer calls back once per event it receives. */
function callLoad(style: Style, services: number, perHour: number) {
  return style === 'notification' ? services * perHour : 0
}

/* ------------------------------------------------------------------ part 2: replay an event log */

type Ev = { name: string; delta: number; label: string }

const LOG: Ev[] = [
  { name: 'AccountOpened', delta: 0, label: 'mở tài khoản' },
  { name: 'MoneyDeposited', delta: 500, label: 'nạp 500' },
  { name: 'MoneyWithdrawn', delta: -120, label: 'rút 120' },
  { name: 'MoneyDeposited', delta: 30, label: 'nạp 30' },
  { name: 'MoneyWithdrawn', delta: -200, label: 'rút 200' },
  { name: 'MoneyDeposited', delta: 1000, label: 'nạp 1.000' },
  { name: 'MoneyWithdrawn', delta: -90, label: 'rút 90' },
  { name: 'MoneyDeposited', delta: 15, label: 'nạp 15' },
]

/** Balance after applying the events in (from, to] on top of a starting balance. */
function replay(from: number, to: number, start: number) {
  let b = start
  for (let i = from + 1; i <= to; i++) b += LOG[i].delta
  return b
}

const BIG = [1_000, 100_000, 1_000_000]
const SNAP = [0, 100_000, 10_000]

/** Compare event styles by call load, then replay an account's event log with and without a snapshot. */
export default function EventLab() {
  const [style, setStyle] = useState<Style>('notification')
  const [services, setServices] = useState(10)
  const [perHour, setPerHour] = useState(1000)
  const [down, setDown] = useState(false)

  const [upTo, setUpTo] = useState(LOG.length - 1)
  const [snapAt, setSnapAt] = useState<number | null>(null)
  const [total, setTotal] = useState(1_000_000)
  const [every, setEvery] = useState(0)

  const calls = callLoad(style, services, perHour)
  const blocked = down && style === 'notification'

  const full = replay(-1, upTo, 0)
  const snapOk = snapAt !== null && snapAt <= upTo
  const snapBalance = snapAt === null ? 0 : replay(-1, snapAt, 0)
  const summed = snapOk ? upTo - (snapAt as number) : upTo + 1
  const result = snapOk ? replay(snapAt as number, upTo, snapBalance) : full

  // Large log: the last snapshot sits at the latest multiple of `every`; the rest must still be replayed.
  const lastSnap = every > 0 ? Math.floor(total / every) * every : 0
  const toSum = total - lastSnap

  return (
    <div className="wg">
      <div className="wg-head">
        <span className="wg-badge">Mô phỏng</span>
        <h4>Sự kiện mang gì, và replay log tốn bao nhiêu?</h4>
      </div>

      <div className="wg-controls">
        <label>
          <span>
            Kiểu sự kiện:{' '}
            <select className="wg-input" value={style} onChange={(e) => setStyle(e.target.value as Style)}>
              <option value="notification">Notification (chỉ có customerId)</option>
              <option value="ecst">Event-carried state transfer (kèm địa chỉ mới)</option>
            </select>
          </span>
        </label>
        <label>
          <span>
            Số service cùng nghe: <b>{services}</b>
          </span>
          <input type="range" min={1} max={30} step={1} value={services} onChange={(e) => setServices(+e.target.value)} />
        </label>
        <label>
          <span>
            Sự kiện mỗi service mỗi giờ: <b>{fmt(perHour)}</b>
          </span>
          <input type="range" min={100} max={5000} step={100} value={perHour} onChange={(e) => setPerHour(+e.target.value)} />
        </label>
        <label>
          <span>
            <input type="checkbox" checked={down} onChange={(e) => setDown(e.target.checked)} /> Service Khách hàng đang sập
          </span>
        </label>
      </div>
      <div className="wg-stats">
        <Stat label="Lần gọi API vào service Khách hàng / giờ" value={fmt(calls)} tone={calls > 0 ? 'bad' : 'good'} />
        <Stat label="Consumer lấy được địa chỉ mới" value={blocked ? 'KẸT: không gọi được' : 'có'} tone={blocked ? 'bad' : 'good'} />
        <Stat label="Kích thước sự kiện" value={style === 'ecst' ? 'to hơn, dữ liệu nhân bản' : 'nhẹ'} />
      </div>

      <div className="wg-controls" style={{ marginTop: 22 }}>
        <label>
          <span>
            Replay account <b>acc-A</b> đến offset: <b>{upTo}</b>
          </span>
          <input type="range" min={0} max={LOG.length - 1} step={1} value={upTo} onChange={(e) => setUpTo(+e.target.value)} />
        </label>
        <label>
          <span>
            Snapshot tại offset:{' '}
            <select className="wg-input" value={snapAt ?? ''} onChange={(e) => setSnapAt(e.target.value === '' ? null : +e.target.value)}>
              <option value="">không có</option>
              {LOG.map((_, i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </span>
        </label>
      </div>
      <div className="wg-strip" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {LOG.map((e, i) => {
          const covered = snapOk && i <= (snapAt as number)
          const used = i <= upTo
          return (
            <div
              key={i}
              title={e.name}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                background: !used ? 'rgba(110,160,255,0.12)' : covered ? 'rgba(110,160,255,0.35)' : 'linear-gradient(160deg,#6aa8ff,#2f66f2)',
                color: used ? '#fff' : undefined,
                opacity: used ? 1 : 0.55,
                outline: snapAt === i ? '3px solid #ffb547' : undefined,
              }}
            >
              <div style={{ opacity: 0.75, fontSize: 12 }}>offset {i}</div>
              {e.label}
            </div>
          )
        })}
      </div>
      <div className="wg-stats">
        <Stat label="Số dư tại offset này" value={fmt(result)} tone="good" />
        <Stat label="Bắt đầu từ" value={snapOk ? `snapshot @${snapAt} (= ${fmt(snapBalance)})` : 'offset 0'} />
        <Stat label="Số sự kiện phải cộng" value={fmt(summed)} tone={snapOk ? 'good' : ''} />
        <Stat label="Kiểm tra bằng replay từ đầu" value={result === full ? 'khớp' : 'LỆCH'} tone={result === full ? 'good' : 'bad'} />
      </div>
      {snapAt !== null && !snapOk && <p className="wg-note">Snapshot nằm sau offset đang hỏi nên không dùng được; phải replay từ đầu.</p>}

      <div className="wg-controls" style={{ marginTop: 22 }}>
        <label>
          <span>
            Log của một tài khoản:{' '}
            <select className="wg-input" value={total} onChange={(e) => setTotal(+e.target.value)}>
              {BIG.map((n) => (
                <option key={n} value={n}>
                  {fmt(n)} sự kiện
                </option>
              ))}
            </select>
          </span>
        </label>
        <label>
          <span>
            Lưu snapshot:{' '}
            <select className="wg-input" value={every} onChange={(e) => setEvery(+e.target.value)}>
              {SNAP.map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? 'không bao giờ' : `mỗi ${fmt(n)} sự kiện`}
                </option>
              ))}
            </select>
          </span>
        </label>
      </div>
      <div className="wg-stats">
        <Stat label="Snapshot gần nhất" value={lastSnap > 0 ? `offset ${fmt(lastSnap)}` : 'chưa có'} />
        <Stat label="Dòng phải cộng khi hỏi số dư" value={fmt(toSum)} tone={toSum > 100_000 ? 'bad' : 'good'} />
        <Stat label="Tiết kiệm so với replay từ đầu" value={`${Math.round((lastSnap / total) * 100)}%`} />
      </div>
      <p className="wg-note">
        Thử: bật notification với 10 service, 1.000 sự kiện mỗi giờ (10.000 lần gọi), rồi đánh dấu service Khách hàng sập để thấy consumer kẹt. Đổi sang state transfer: 0 lần gọi, vẫn chạy. Ở phần replay, chọn snapshot tại offset 3 rồi kéo replay đến offset 7: chỉ cộng 4 sự kiện, kết quả vẫn khớp.
      </p>
    </div>
  )
}
