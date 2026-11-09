import type { ReactNode } from 'react'

/** Narrated scene: each beat is one spoken sentence, also shown as the subtitle. */
export interface SceneScript {
  id: string
  title: string
  beats: string[]
  /** Extra seconds to hold the last frame after the final beat. */
  hold?: number
}

export interface LessonScript {
  slug: string
  title: string
  summary: string
  module: string
  scenes: SceneScript[]
}

/** Beat timing inside a scene, derived from the recorded voice lengths. */
export interface Cue {
  /** Start second of beat k (k past the end returns the scene end). */
  at: (k: number) => number
  /** End second of beat k's speech. */
  end: (k: number) => number
  duration: number
}

/** Sound effects synthesized by `npm run sfx` into public/sfx/. */
export type SfxKind = 'whoosh' | 'pop' | 'tick' | 'ding' | 'error'

/** A sound effect pinned to a moment of the scene (seconds, usually derived from the cue). */
export interface SceneSfx {
  at: (cue: Cue) => number
  kind: SfxKind
  volume?: number
}

export interface Scene extends SceneScript {
  render: (t: number, cue: Cue) => ReactNode
  /**
   * Key-moment sounds (a broker dies, a leader is promoted...).
   * Every scene also gets a whoosh on entry and a soft pop on each new beat automatically.
   */
  sfx?: SceneSfx[]
}

export interface ChoiceQuestion {
  kind: 'choice'
  prompt: string
  options: string[]
  answer: number
  explain: string
}

/** Free-text Feynman question: the learner must explain with "vì", then compares with the model answer. */
export interface OpenQuestion {
  kind: 'open'
  prompt: string
  keywords: string[]
  modelAnswer: string
}

export type Question = ChoiceQuestion | OpenQuestion

/** Theory content of a lesson section. Text supports **bold** and `code`. */
export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: { title?: string; text: string }[]; ordered?: boolean }
  | { kind: 'callout'; tone: 'info' | 'warn' | 'tip'; title?: string; text: string }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'code'; code: string }
  /** A narrated video made of these scene ids (from the lesson's scene list). */
  | { kind: 'video'; scenes: string[] }
  /** "Quick Quiz" after a part, or "Dự đoán trước khi xem" before a video. */
  | { kind: 'quiz'; title: string; questions: Question[] }
  /** Interactive simulator, looked up by name in the widget registry. */
  | { kind: 'widget'; name: string }

export interface Section {
  id: string
  title: string
  blocks: Block[]
}

export interface Lesson extends Omit<LessonScript, 'scenes'> {
  scenes: Scene[]
  /** Cold-open hook shown before the roadmap (usually one video + one quick question). */
  intro?: Block[]
  roadmap: string[]
  sections: Section[]
  finalQuiz: Question[]
  recap: { journey: string; points: { title: string; text: string }[]; next?: string }
}

/** Sidebar entry for a lesson that is planned but not built yet. */
export interface PlannedLesson {
  title: string
  module: string
}
