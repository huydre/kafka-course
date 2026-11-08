import { useEffect, useState } from 'react'
import type { ChoiceQuestion, OpenQuestion, Question } from '../player/types'

/** Lowercase and strip Vietnamese diacritics so "Vì" / "vi" / "VÌ" all match. */
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')

function Choice({ q, n, onDone }: { q: ChoiceQuestion; n: number; onDone: (ok: boolean) => void }) {
  const [pick, setPick] = useState<number | null>(null)
  const [checked, setChecked] = useState(false)
  const ok = checked && pick === q.answer

  return (
    <div className="qz-item">
      <p className="qz-prompt">
        <span className="qz-num">{n}.</span> {q.prompt}
      </p>
      <div className="qz-options">
        {q.options.map((o, i) => {
          const state = !checked ? (pick === i ? 'is-picked' : '') : i === q.answer && ok ? 'is-right' : pick === i && !ok ? 'is-wrong' : ''
          return (
            <button
              key={i}
              className={`qz-opt ${state}`}
              onClick={() => {
                if (ok) return
                setPick(i)
                setChecked(false)
              }}
            >
              <span className="qz-letter">{String.fromCharCode(65 + i)}</span>
              {o}
            </button>
          )
        })}
      </div>
      <div className="qz-actions">
        <button
          className="btn-primary"
          disabled={pick === null || ok}
          onClick={() => {
            setChecked(true)
            onDone(pick === q.answer)
          }}
        >
          Kiểm tra
        </button>
        {checked && (
          <span className={`qz-verdict ${ok ? 'good' : 'bad'}`}>{ok ? 'Chính xác!' : 'Chưa đúng — xem lại video rồi chọn lại nhé.'}</span>
        )}
      </div>
      {ok && <p className="qz-explain">💡 {q.explain}</p>}
    </div>
  )
}

function Open({ q, n, onDone }: { q: OpenQuestion; n: number; onDone: (ok: boolean) => void }) {
  const [text, setText] = useState('')
  const [checked, setChecked] = useState(false)
  const t = norm(text)
  // Exact "vì" with its accent, so "ví dụ" does not count as a reason.
  const hasWhy = /(^|[^\p{L}])vì([^\p{L}]|$)/u.test(text.toLowerCase().normalize('NFC'))
  const hits = q.keywords.filter((k) => t.includes(norm(k)))
  const passed = hasWhy && text.trim().length >= 40

  return (
    <div className="qz-item">
      <p className="qz-prompt">
        <span className="qz-num">{n}.</span> {q.prompt}
        <span className="qz-tag">Feynman</span>
      </p>
      <textarea
        className="qz-text"
        rows={4}
        placeholder="Viết như đang giảng cho một người chưa biết gì về Kafka…"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setChecked(false)
        }}
      />
      <div className="qz-actions">
        <button
          className="btn-primary"
          disabled={!text.trim()}
          onClick={() => {
            setChecked(true)
            onDone(passed)
          }}
        >
          Kiểm tra
        </button>
        {checked && (
          <span className={`qz-verdict ${passed ? 'good' : 'bad'}`}>
            {!hasWhy ? 'Thiếu chữ "vì" — hãy nêu nguyên nhân.' : text.trim().length < 40 ? 'Hơi ngắn, giải thích thêm cơ chế nhé.' : 'Đã có "vì" ✓ — so với đáp án mẫu bên dưới.'}
          </span>
        )}
      </div>
      {checked && (
        <div className="qz-feedback">
          <div className="qz-keywords">
            Ý chính:{' '}
            {q.keywords.map((k) => (
              <span key={k} className={`qz-kw ${hits.includes(k) ? 'hit' : ''}`}>
                {hits.includes(k) ? '✓' : '○'} {k}
              </span>
            ))}
          </div>
          {passed && <p className="qz-explain">📘 Đáp án mẫu: {q.modelAnswer}</p>}
        </div>
      )}
    </div>
  )
}

/** Quiz under the video; reports once every question has been passed. */
export function QuizPanel({
  quiz,
  title = 'Quick Quiz',
  doneText,
  onComplete,
}: {
  quiz: Question[]
  title?: string
  doneText?: string
  onComplete?: () => void
}) {
  const [passed, setPassed] = useState<boolean[]>(() => quiz.map(() => false))
  const done = passed.filter(Boolean).length

  const mark = (i: number) => (ok: boolean) => {
    setPassed((prev) => prev.map((v, j) => (j === i ? v || ok : v)))
  }

  useEffect(() => {
    if (done === quiz.length) onComplete?.()
  }, [done, quiz.length, onComplete])

  return (
    <section className="qz">
      <header className="qz-head">
        <h2>{title}</h2>
        <span className="qz-progress">
          {done}/{quiz.length} câu
          <span className="qz-meter">
            <span style={{ width: `${(done / quiz.length) * 100}%` }} />
          </span>
        </span>
      </header>
      <div className="qz-body">
        {quiz.map((q, i) =>
          q.kind === 'choice' ? <Choice key={i} q={q} n={i + 1} onDone={mark(i)} /> : <Open key={i} q={q} n={i + 1} onDone={mark(i)} />,
        )}
        {done === quiz.length && doneText && <div className="qz-done">{doneText}</div>}
      </div>
    </section>
  )
}
