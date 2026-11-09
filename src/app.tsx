import { useCallback, useEffect, useState } from 'react'
import { CourseSidebar } from './components/course-sidebar'
import { BlockView, Rich, SectionView } from './components/lesson-content'
import { QuizPanel } from './components/quiz-panel'
import { COURSE_TITLE, LESSONS, PLANNED } from './lessons/course-catalog'

const DONE_KEY = 'kafka-course:completed'
const THEME_KEY = 'kafka-course:theme'

const slugFromHash = () => {
  const s = location.hash.replace('#/', '').split('#')[0]
  return LESSONS.some((l) => l.slug === s) ? s : LESSONS[0].slug
}

/** Highlights the section currently in view, for the right-hand table of contents. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0])
  const key = ids.join('|')
  useEffect(() => {
    const ids = key.split('|')
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-20% 0px -60% 0px' },
    )
    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [key])
  return [active, setActive] as const
}

/** Scrolls to a section. Falls back to an instant jump when the browser ignores smooth scrolling. */
function scrollToSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - 24)
  const before = window.scrollY
  window.scrollTo({ top, behavior: 'smooth' })
  setTimeout(() => {
    if (Math.abs(window.scrollY - before) < 2 && Math.abs(top - before) > 2) window.scrollTo(0, top)
  }, 350)
}

export default function App() {
  const [slug, setSlug] = useState(slugFromHash)
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) ?? 'dark')
  const [collapsed, setCollapsed] = useState(false)
  const [completed, setCompleted] = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]')))

  useEffect(() => {
    const onHash = () => setSlug(slugFromHash())
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const idx = LESSONS.findIndex((l) => l.slug === slug)
  const lesson = LESSONS[idx]
  const tocIds = [...lesson.sections.map((s) => s.id), 'kiem-tra', 'tong-ket']
  const [active, setActive] = useActiveSection(tocIds)

  const go = (s: string) => {
    location.hash = `#/${s}`
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const jump = (id: string) => {
    setActive(id)
    scrollToSection(id)
  }

  const markDone = useCallback(() => {
    setCompleted((prev) => {
      if (prev.has(slug)) return prev
      const next = new Set(prev).add(slug)
      localStorage.setItem(DONE_KEY, JSON.stringify([...next]))
      return next
    })
  }, [slug])

  return (
    <div className="app">
      <CourseSidebar
        title={COURSE_TITLE}
        lessons={LESSONS}
        planned={PLANNED}
        current={slug}
        completed={completed}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        onPick={go}
      />
      <main className="main">
        <div className="theme-toggle" role="group" aria-label="Giao diện">
          <button className={theme === 'light' ? 'is-on' : ''} onClick={() => setTheme('light')} aria-label="Sáng">
            ☀
          </button>
          <button className={theme === 'dark' ? 'is-on' : ''} onClick={() => setTheme('dark')} aria-label="Tối">
            ☾
          </button>
        </div>
        <article className="lesson" key={lesson.slug}>
          <nav className="crumbs">
            <span>Trang chủ</span>›<span>Khoá học</span>›<b>{COURSE_TITLE}</b>
          </nav>
          <div className="lesson-module">{lesson.module}</div>
          <h1>{lesson.title}</h1>
          <p className="lesson-summary">{lesson.summary}</p>

          {lesson.intro && (
            <section className="th-intro">
              {lesson.intro.map((b, i) => (
                <BlockView key={i} block={b} lesson={lesson} />
              ))}
            </section>
          )}

          <section className="th-roadmap">
            <h2 className="th-h2">Lộ trình bài học</h2>
            <ol>
              {lesson.roadmap.map((r) => (
                <li key={r}>
                  <Rich text={r} />
                </li>
              ))}
            </ol>
          </section>

          {lesson.sections.map((s, i) => (
            <SectionView key={s.id} section={s} index={i} lesson={lesson} />
          ))}

          <section className="th-section" id="kiem-tra">
            <h2 className="th-h2">Kiểm tra kiến thức</h2>
            <p className="th-p">Các câu dưới đây không hỏi bạn nhớ con số nào, mà hỏi bạn có dùng được điều vừa học để suy luận hay không. Câu cuối cùng hãy trả lời bằng lời của bạn, có chữ "vì".</p>
            <QuizPanel quiz={lesson.finalQuiz} title="Kiểm tra kiến thức toàn bài" doneText="🎉 Hoàn thành bài học! Bài đã được đánh dấu ✓ ở thanh bên." onComplete={markDone} />
          </section>

          <section className="th-section" id="tong-ket">
            <h2 className="th-h2">Tổng kết</h2>
            <blockquote className="th-journey">
              <strong>Hành trình của bài này: </strong>
              {lesson.recap.journey}
            </blockquote>
            <div className="th-points">
              {lesson.recap.points.map((p) => (
                <div key={p.title} className="th-point">
                  <div className="th-point-title">{p.title}</div>
                  <Rich text={p.text} />
                </div>
              ))}
            </div>
            {lesson.recap.next && <blockquote className="th-journey is-next">{lesson.recap.next}</blockquote>}
          </section>

          <footer className="lesson-nav">
            {idx > 0 ? (
              <button className="btn-ghost" onClick={() => go(LESSONS[idx - 1].slug)}>
                ← {LESSONS[idx - 1].title}
              </button>
            ) : (
              <span />
            )}
            {idx < LESSONS.length - 1 && (
              <button className="btn-primary" onClick={() => go(LESSONS[idx + 1].slug)}>
                {LESSONS[idx + 1].title} →
              </button>
            )}
          </footer>
        </article>
      </main>
      <nav className="toc" aria-label="Mục lục bài">
        <div className="toc-title">Trong bài này</div>
        {lesson.sections.map((s, i) => (
          <button key={s.id} className={active === s.id ? 'is-active' : ''} onClick={() => jump(s.id)}>
            <span>{i + 1}.</span> {s.title}
          </button>
        ))}
        <button className={active === 'kiem-tra' ? 'is-active' : ''} onClick={() => jump('kiem-tra')}>
          Kiểm tra kiến thức
        </button>
        <button className={active === 'tong-ket' ? 'is-active' : ''} onClick={() => jump('tong-ket')}>
          Tổng kết
        </button>
      </nav>
    </div>
  )
}
