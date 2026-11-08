import { useState } from 'react'
import type { Lesson, PlannedLesson } from '../player/types'

interface Props {
  title: string
  lessons: Lesson[]
  planned: PlannedLesson[]
  current: string
  completed: Set<string>
  collapsed: boolean
  onToggle: () => void
  onPick: (slug: string) => void
}

/** Course outline grouped by module; planned lessons are listed but locked. */
export function CourseSidebar({ title, lessons, planned, current, completed, collapsed, onToggle, onPick }: Props) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const items = [
    ...lessons.map((l) => ({ module: l.module, title: l.title, slug: l.slug as string | undefined })),
    ...planned.map((p) => ({ module: p.module, title: p.title, slug: undefined })),
  ].filter((i) => !q || i.title.toLowerCase().includes(q))
  const modules = [...new Set(items.map((i) => i.module))].sort()

  return (
    <aside className={`sb${collapsed ? ' is-collapsed' : ''}`}>
      <div className="sb-top">
        <div className="sb-logo">
          <span className="sb-mark">K</span>
          {!collapsed && (
            <span>
              kafka<b>·</b>lab
            </span>
          )}
        </div>
        <button className="icon-btn" onClick={onToggle} aria-label="Thu gọn thanh bên">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <path d="M9 4v16" />
          </svg>
        </button>
      </div>
      {!collapsed && (
        <>
          <h2 className="sb-title">{title}</h2>
          <div className="sb-progress">
            {completed.size}/{lessons.length} bài đã xong
          </div>
          <label className="sb-search">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
            <input placeholder="Tìm bài học" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <nav className="sb-list">
            {modules.map((m) => (
              <div key={m} className="sb-group">
                <div className="sb-module">{m}</div>
                {items
                  .filter((i) => i.module === m)
                  .map((i) =>
                    i.slug ? (
                      <button key={i.title} className={`sb-item${i.slug === current ? ' is-current' : ''}`} onClick={() => onPick(i.slug!)}>
                        <span>{i.title}</span>
                        {completed.has(i.slug) ? <span className="sb-check">✓</span> : <span className="sb-dot" />}
                      </button>
                    ) : (
                      <div key={i.title} className="sb-item is-locked" title="Sắp có">
                        <span>{i.title}</span>
                        <span className="sb-soon">sắp có</span>
                      </div>
                    ),
                  )}
              </div>
            ))}
          </nav>
        </>
      )}
    </aside>
  )
}
