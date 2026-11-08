import type { ReactNode } from 'react'
import { VideoPlayer } from '../player/video-player'
import type { Block, Lesson, Section } from '../player/types'
import { QuizPanel } from './quiz-panel'
import { WIDGETS } from './widgets'

/** Tiny inline formatter: **bold** and `code`. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p.startsWith('`') ? <code key={i}>{p.slice(1, -1)}</code> : p,
      )}
    </>
  )
}

const CALLOUT_ICON = { info: 'ℹ️', warn: '⚠️', tip: '💡' }

function BlockView({ block, lesson }: { block: Block; lesson: Lesson }): ReactNode {
  switch (block.kind) {
    case 'p':
      return (
        <p className="th-p">
          <Rich text={block.text} />
        </p>
      )
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul'
      return (
        <Tag className="th-list">
          {block.items.map((it, i) => (
            <li key={i}>
              {it.title && <strong>{it.title} — </strong>}
              <Rich text={it.text} />
            </li>
          ))}
        </Tag>
      )
    }
    case 'callout':
      return (
        <div className={`th-callout is-${block.tone}`}>
          <span className="th-callout-icon">{CALLOUT_ICON[block.tone]}</span>
          <div>
            {block.title && <div className="th-callout-title">{block.title}</div>}
            <Rich text={block.text} />
          </div>
        </div>
      )
    case 'table':
      return (
        <div className="th-table-wrap">
          <table className="th-table">
            <thead>
              <tr>
                {block.head.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j}>
                      <Rich text={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'code':
      return <pre className="th-code">{block.code}</pre>
    case 'video':
      return <VideoPlayer lesson={lesson} sceneIds={block.scenes} />
    case 'quiz':
      return <QuizPanel quiz={block.questions} title={block.title} />
    case 'widget': {
      const Widget = WIDGETS[block.name]
      return Widget ? <Widget /> : null
    }
  }
}

export function SectionView({ section, index, lesson }: { section: Section; index: number; lesson: Lesson }) {
  return (
    <section className="th-section" id={section.id}>
      <h2 className="th-h2">
        <span className="th-part">Phần {index + 1}</span>
        {section.title}
      </h2>
      {section.blocks.map((b, i) => (
        <BlockView key={i} block={b} lesson={lesson} />
      ))}
    </section>
  )
}
