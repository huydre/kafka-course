import manifest from '../lessons/voice-manifest.json'
import { textHash } from './text-hash'
import type { Cue, Lesson, Scene, SceneScript } from './types'

/** One recorded clip per beat, written by `npm run voice`. */
export type VoiceClip = { file: string; duration: number; hash: string; voice: string }
export type VoiceManifest = Record<string, Record<string, VoiceClip[]>>

/** Silence before the first beat, between beats, and after the last beat (seconds). */
const LEAD = 0.5
const GAP = 0.45
const TAIL = 1.1

/** Rough Vietnamese speaking rate, used until a clip is recorded. */
const estimate = (text: string) => Math.max(1.6, text.length / 14)

export interface BeatTiming {
  start: number
  duration: number
  text: string
  audio?: string
}

export interface SceneTiming {
  beats: BeatTiming[]
  duration: number
  cue: Cue
}

export function sceneTiming(slug: string, scene: SceneScript): SceneTiming {
  const clips = (manifest as VoiceManifest)[slug]?.[scene.id]
  let t = LEAD
  const beats = scene.beats.map((text, k) => {
    const clip = clips?.[k]
    const fresh = clip && clip.hash === textHash(text)
    const duration = fresh ? clip.duration : estimate(text)
    const beat: BeatTiming = { start: t, duration, text, audio: fresh ? clip.file : undefined }
    t += duration + GAP
    return beat
  })
  const duration = t - GAP + TAIL + (scene.hold ?? 0)
  const cue: Cue = {
    at: (k) => (k < beats.length ? beats[Math.max(0, k)].start : duration),
    end: (k) => {
      const b = beats[Math.min(beats.length - 1, Math.max(0, k))]
      return b.start + b.duration
    },
    duration,
  }
  return { beats, duration, cue }
}

export interface LessonTiming {
  scenes: (SceneTiming & { scene: Scene; start: number })[]
  total: number
}

/** Timing for one video: the given scene ids of a lesson, played back to back. */
export function lessonTiming(lesson: Lesson, sceneIds: string[]): LessonTiming {
  let acc = 0
  const scenes = sceneIds.map((id) => {
    const scene = lesson.scenes.find((s) => s.id === id)
    if (!scene) throw new Error(`Unknown scene "${id}" in lesson ${lesson.slug}`)
    const timing = sceneTiming(lesson.slug, scene)
    const start = acc
    acc += timing.duration
    return { ...timing, scene, start }
  })
  return { scenes, total: acc }
}

/** Subtitle for local time t: the beat being spoken, kept until the next one starts. */
export const beatAt = (timing: SceneTiming, t: number) => [...timing.beats].reverse().find((b) => t >= b.start - 0.05)
