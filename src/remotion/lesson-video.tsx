import { Audio } from '@remotion/media'
import { linearTiming, TransitionSeries } from '@remotion/transitions'
import { fade } from '@remotion/transitions/fade'
import { Fragment } from 'react'
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { LESSONS } from '../lessons/course-catalog'
import { beatAt, lessonTiming, type SceneTiming } from '../player/timeline'
import type { Lesson, Scene } from '../player/types'
import { SANS } from './video-fonts'

export const FPS = 30
export const WIDTH = 1920
export const HEIGHT = 1080
/** Cross-fade between scenes, in frames. */
export const FADE = 15
/** Stage height when subtitles are burned in; the rest of the 1080px is the subtitle band. */
const CAPTION_STAGE_H = 920

export type LessonVideoProps = { slug: string; scenes: string[]; burnCaptions: boolean }

export const findLesson = (slug: string): Lesson => LESSONS.find((l) => l.slug === slug) ?? LESSONS[0]

/**
 * Every scene except the last gets FADE extra frames so the cross-fade does not eat its content.
 * Net effect: scene i still starts at the sum of the previous scene durations.
 */
const sceneFrames = (timing: SceneTiming, i: number, n: number) => Math.round(timing.duration * FPS) + (i < n - 1 ? FADE : 0)

export const videoDurationInFrames = (lesson: Lesson, sceneIds: string[]) => {
  const { scenes } = lessonTiming(lesson, sceneIds)
  return scenes.reduce((a, s, i) => a + sceneFrames(s, i, scenes.length), 0) - FADE * (scenes.length - 1)
}

function SceneClip({ scene, timing, burnCaptions }: { scene: Scene; timing: SceneTiming; burnCaptions: boolean }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = Math.min(frame / fps, timing.duration)
  const picture = scene.render(t, timing.cue)

  const voice = timing.beats.map(
    (b, k) =>
      b.audio && (
        <Sequence key={k} from={Math.round(b.start * fps)} durationInFrames={Math.ceil((b.duration + 0.2) * fps)} layout="none">
          <Audio src={staticFile(b.audio)} />
        </Sequence>
      ),
  )

  if (!burnCaptions)
    return (
      <AbsoluteFill style={{ fontFamily: SANS }}>
        {picture}
        {voice}
      </AbsoluteFill>
    )

  // Rendered MP4: shrink the stage a little and give subtitles their own band so they never cover the drawing.
  return (
    <AbsoluteFill style={{ fontFamily: SANS, alignItems: 'center', background: '#040914' }}>
      <div style={{ height: CAPTION_STAGE_H, width: (WIDTH * CAPTION_STAGE_H) / HEIGHT, position: 'relative', overflow: 'hidden' }}>
        {/* Scenes are laid out in a 1920×1080 world; scale that world down into the stage box. */}
        <div style={{ position: 'absolute', width: WIDTH, height: HEIGHT, transform: `scale(${CAPTION_STAGE_H / HEIGHT})`, transformOrigin: 'top left' }}>
          {picture}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 160px',
          color: '#e6edf9',
          fontSize: 36,
          lineHeight: 1.35,
          textAlign: 'center',
          borderTop: '2px solid #13203a',
        }}
      >
        {beatAt(timing, t)?.text}
      </div>
      {voice}
    </AbsoluteFill>
  )
}

/** One section video: the given narrated scenes chained with cross-fades. */
export function LessonVideo({ slug, scenes: sceneIds, burnCaptions }: LessonVideoProps) {
  const lesson = findLesson(slug)
  const { scenes } = lessonTiming(lesson, sceneIds)
  return (
    <AbsoluteFill style={{ background: '#040914' }}>
      <TransitionSeries>
        {scenes.map((s, i) => (
          <Fragment key={s.scene.id}>
            {i > 0 && <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />}
            <TransitionSeries.Sequence durationInFrames={sceneFrames(s, i, scenes.length)} premountFor={FPS}>
              <SceneClip scene={s.scene} timing={s} burnCaptions={burnCaptions} />
            </TransitionSeries.Sequence>
          </Fragment>
        ))}
      </TransitionSeries>
    </AbsoluteFill>
  )
}
