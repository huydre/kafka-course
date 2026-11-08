/**
 * Records one Vietnamese voice clip per narration beat with VieNeu-TTS (runs locally, no network),
 * then writes src/lessons/voice-manifest.json with each clip's length so the animation can follow the voice.
 * Unchanged beats (same text and voice) are skipped, so re-running only records edited lines.
 *
 * Usage: npm run voice                (all lessons)
 *        npm run voice -- sparse-index
 * Env:   TTS_VOICE  VieNeu preset voice (default "Hải Đăng"); changing it re-records everything.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { keyPartitionScript } from '../src/lessons/key-partition-script'
import { sparseIndexScript } from '../src/lessons/sparse-index-script'
import { textHash } from '../src/player/text-hash'
import type { VoiceClip, VoiceManifest } from '../src/player/timeline'

const SCRIPTS = [sparseIndexScript, keyPartitionScript]
const ROOT = join(import.meta.dirname, '..')
const MANIFEST = join(ROOT, 'src/lessons/voice-manifest.json')
const PYTHON = join(ROOT, 'vieneu-env/bin/python')
const VOICE = process.env.TTS_VOICE ?? 'Hải Đăng'

const only = process.argv[2]
const manifest: VoiceManifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {}

const duration = (file: string) =>
  Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim())

type Job = { text: string; out: string; mp3: string; lesson: string; scene: string; k: number; clip: VoiceClip }
const jobs: Job[] = []

// 1. Work out which beats need (re)recording; keep the rest as they are.
for (const lesson of SCRIPTS) {
  if (only && lesson.slug !== only) continue
  mkdirSync(join(ROOT, 'public/voice', lesson.slug), { recursive: true })
  const next: Record<string, VoiceClip[]> = {}
  for (const scene of lesson.scenes) {
    const old = manifest[lesson.slug]?.[scene.id] ?? []
    next[scene.id] = scene.beats.map((text, k) => {
      const hash = textHash(`${VOICE}|${text}`)
      const file = `voice/${lesson.slug}/${scene.id}-${k}-${hash}.mp3`
      const mp3 = join(ROOT, 'public', file)
      const clip: VoiceClip = { file, duration: 0, hash: textHash(text), voice: VOICE }
      if (old[k]?.file === file && existsSync(mp3)) return old[k]
      jobs.push({ text, out: join(tmpdir(), `${lesson.slug}-${scene.id}-${k}-${hash}.wav`), mp3, lesson: lesson.slug, scene: scene.id, k, clip })
      return clip
    })
  }
  manifest[lesson.slug] = next
}

// 2. Synthesise all missing beats in one VieNeu process, then encode to mp3 and measure.
if (jobs.length) {
  console.log(`● Recording ${jobs.length} line(s) with VieNeu voice "${VOICE}"…`)
  const jobFile = join(tmpdir(), 'vieneu-jobs.json')
  writeFileSync(jobFile, JSON.stringify(jobs.map(({ text, out }) => ({ text, out }))))
  execFileSync(PYTHON, [join(ROOT, 'scripts/vieneu_batch.py'), jobFile, VOICE], { stdio: 'inherit' })
  for (const job of jobs) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', job.out, '-b:a', '128k', job.mp3])
    rmSync(job.out)
    job.clip.duration = Number(duration(job.mp3).toFixed(3))
    manifest[job.lesson][job.scene][job.k] = job.clip
  }
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
console.log(`✓ ${jobs.length} clip(s) recorded · manifest: ${MANIFEST}`)
