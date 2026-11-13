import { Composition, Folder } from 'remotion'
import { LESSONS } from '../lessons/course-catalog'
import { BACKDROPS } from '../player/backdrops'
import { BackdropShowcase, SHOWCASE_SECONDS } from './backdrop-showcase'
import { SchematicShowcase } from './schematic-showcase'
import { FPS, HEIGHT, LessonVideo, WIDTH, videoDurationInFrames } from './lesson-video'

/**
 * Every video block of every lesson section, as `<lesson>--<section>`; a second video in the same section gets
 * `-2`, and so on (composition ids must be unique). Rendered MP4s burn in subtitles.
 */
export const VIDEOS = LESSONS.flatMap((lesson) =>
  [{ id: 'intro', blocks: lesson.intro ?? [] }, ...lesson.sections].flatMap((section) =>
    section.blocks
      .filter((b) => b.kind === 'video')
      .map((b, k) => ({ id: `${lesson.slug}--${section.id}${k ? `-${k + 1}` : ''}`, lesson, scenes: (b as { scenes: string[] }).scenes })),
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
      <Folder name="showcase">
        <Composition id="schematic" component={SchematicShowcase} durationInFrames={4 * FPS} fps={FPS} width={WIDTH} height={HEIGHT} />
        <Composition
          id="backdrops"
          component={BackdropShowcase}
          durationInFrames={Object.keys(BACKDROPS).length * SHOWCASE_SECONDS * FPS}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
        />
      </Folder>
    </>
  )
}
