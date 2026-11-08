import { Composition, Folder } from 'remotion'
import { LESSONS } from '../lessons/course-catalog'
import { FPS, HEIGHT, LessonVideo, WIDTH, videoDurationInFrames } from './lesson-video'

/** Every video block of every lesson section, as `<lesson>--<section>` (rendered MP4s burn in subtitles). */
export const VIDEOS = LESSONS.flatMap((lesson) =>
  lesson.sections.flatMap((section) =>
    section.blocks.flatMap((b) => (b.kind === 'video' ? [{ id: `${lesson.slug}--${section.id}`, lesson, scenes: b.scenes }] : [])),
  ),
)

export function RemotionRoot() {
  return (
    <>
      {LESSONS.map((lesson) => (
        <Folder key={lesson.slug} name={lesson.slug}>
          {VIDEOS.filter((v) => v.lesson === lesson).map((v) => (
            <Composition
              key={v.id}
              id={v.id}
              component={LessonVideo}
              durationInFrames={videoDurationInFrames(v.lesson, v.scenes)}
              fps={FPS}
              width={WIDTH}
              height={HEIGHT}
              defaultProps={{ slug: v.lesson.slug, scenes: v.scenes, burnCaptions: true }}
            />
          ))}
        </Folder>
      ))}
    </>
  )
}
