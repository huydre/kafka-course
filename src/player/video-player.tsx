import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Player, type PlayerRef } from '@remotion/player'
import { FPS, HEIGHT, LessonVideo, WIDTH, videoDurationInFrames } from '../remotion/lesson-video'
import { beatAt, lessonTiming } from './timeline'
import type { Lesson } from './types'

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const RATES = [0.5, 0.75, 1, 1.25, 1.5]

const Icon = {
  play: <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" />,
  pause: (
    <g fill="currentColor">
      <rect x="6" y="4.5" width="4" height="15" rx="1" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" />
    </g>
  ),
  prev: <path d="M6 5v14M18 5 9 12l9 7z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />,
  next: <path d="M18 5v14M6 5l9 7-9 7z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />,
  replay: <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />,
  cc: (
    <g stroke="currentColor" strokeWidth="2" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M10 10.5a2 2 0 1 0 0 3M17 10.5a2 2 0 1 0 0 3" strokeLinecap="round" />
    </g>
  ),
  sound: (
    <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </g>
  ),
  muted: (
    <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="m16 9.5 5 5M21 9.5l-5 5" />
    </g>
  ),
  full: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" strokeWidth="2" fill="none" />,
}

function Btn({ label, onClick, children, active }: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <button className={`vp-btn${active ? ' is-active' : ''}`} onClick={onClick} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" width="20" height="20">
        {children}
      </svg>
    </button>
  )
}

/**
 * Plays a list of scenes as if it were a video. Time is the single source of truth:
 * each scene renders from its local time, so play, pause, seek and speed all stay consistent.
 */
export function VideoPlayer({ lesson, sceneIds }: { lesson: Lesson; sceneIds: string[] }) {
  const timing = useMemo(() => lessonTiming(lesson, sceneIds), [lesson, sceneIds])
  const scenes = timing.scenes
  const starts = scenes.map((s) => s.start)
  const frames = videoDurationInFrames(lesson, sceneIds)
  const total = frames / FPS

  const playerRef = useRef<PlayerRef>(null)
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)
  const [subs, setSubs] = useState(true)
  const [muted, setMuted] = useState(false)
  const toggleMute = () => {
    if (muted) playerRef.current?.unmute()
    else playerRef.current?.mute()
    setMuted(!muted)
  }
  const [started, setStarted] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  // Before the first play the player shows a poster frame, but the controls still read 0:00.
  const t = started ? frame / FPS : 0

  // The Remotion player owns the clock; mirror its frame and play state for our custom controls.
  useEffect(() => {
    const p = playerRef.current
    if (!p) return
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    p.addEventListener('frameupdate', onFrame)
    p.addEventListener('seeked', onFrame)
    p.addEventListener('play', onPlay)
    p.addEventListener('pause', onPause)
    p.addEventListener('ended', onPause)
    p.seekTo(Math.round(frames * 0.6))
    return () => {
      p.removeEventListener('frameupdate', onFrame)
      p.removeEventListener('seeked', onFrame)
      p.removeEventListener('play', onPlay)
      p.removeEventListener('pause', onPause)
      p.removeEventListener('ended', onPause)
    }
  }, [])

  let idx = starts.findIndex((s, i) => t >= s && t < s + scenes[i].duration)
  if (idx < 0) idx = scenes.length - 1
  const scene = scenes[idx]
  const local = Math.min(t - starts[idx], scene.duration)
  const caption = beatAt(scene, local)

  const ended = frame >= frames - 1 && !playing

  const seek = useCallback(
    (nt: number) => {
      const f = Math.max(0, Math.min(frames - 1, Math.round(nt * FPS)))
      playerRef.current?.seekTo(f)
      setFrame(f)
    },
    [frames],
  )
  const toggle = useCallback(
    (e?: React.SyntheticEvent) => {
      if (!started || ended) playerRef.current?.seekTo(0)
      setStarted(true)
      playerRef.current?.toggle(e)
    },
    [ended, started],
  )
  const goScene = (i: number) => {
    const j = Math.max(0, Math.min(scenes.length - 1, i))
    setStarted(true)
    seek(starts[j])
  }
  const prevScene = () => goScene(local > 1.5 ? idx : idx - 1)

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'k') {
      e.preventDefault()
      toggle(e)
    } else if (e.key === 'ArrowRight') seek(t + 5)
    else if (e.key === 'ArrowLeft') seek(t - 5)
  }

  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else wrapRef.current?.requestFullscreen()
  }

  const onBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setStarted(true)
    seek(((e.clientX - r.left) / r.width) * total)
  }

  return (
    <div className="vp" ref={wrapRef} tabIndex={0} onKeyDown={onKey}>
      <div className="vp-stage" onClick={(e) => toggle(e)}>
        <Player
          ref={playerRef}
          component={LessonVideo}
          inputProps={{ slug: lesson.slug, scenes: sceneIds, burnCaptions: false }}
          durationInFrames={frames}
          fps={FPS}
          compositionWidth={WIDTH}
          compositionHeight={HEIGHT}
          playbackRate={rate}
          style={{ width: '100%', aspectRatio: `${WIDTH} / ${HEIGHT}` }}
          clickToPlay={false}
          spaceKeyToPlayOrPause={false}
          acknowledgeRemotionLicense
        />
        {scenes.length > 1 && (
          <div className="vp-chip">
            Cảnh {idx + 1}/{scenes.length} · {scene.scene.title}
          </div>
        )}
        {(!started || ended) && (
          <div className="vp-overlay">
            <span className="vp-big-play">
              <svg viewBox="0 0 24 24" width="38" height="38">
                {ended ? Icon.replay : Icon.play}
              </svg>
            </span>
            <span>{ended ? 'Xem lại' : `Bắt đầu · ${fmt(total)}`}</span>
          </div>
        )}
      </div>

      {subs && (
        <div className="vp-caption">
          {caption && started && <span key={caption.text}>{caption.text}</span>}
        </div>
      )}

      <div className="vp-bar" onClick={onBarClick}>
        {scenes.map((s, i) => {
          const fill = Math.max(0, Math.min(1, (t - starts[i]) / s.duration))
          return (
            <div key={s.scene.id} className="vp-seg" style={{ flex: s.duration }} title={s.scene.title}>
              <div className="vp-seg-fill" style={{ width: `${fill * 100}%` }} />
            </div>
          )
        })}
      </div>

      <div className="vp-controls">
        <Btn label={playing ? 'Tạm dừng (Space)' : 'Phát (Space)'} onClick={() => toggle()}>
          {playing ? Icon.pause : ended ? Icon.replay : Icon.play}
        </Btn>
        <Btn label="Cảnh trước" onClick={prevScene}>
          {Icon.prev}
        </Btn>
        <Btn label="Cảnh sau" onClick={() => goScene(idx + 1)}>
          {Icon.next}
        </Btn>
        <span className="vp-time">
          {fmt(t)} / {fmt(total)}
        </span>
        <span className="vp-spacer" />
        <button className="vp-rate" onClick={() => setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length])} title="Tốc độ phát">
          {rate}x
        </button>
        <Btn label={muted ? 'Bật tiếng' : 'Tắt tiếng'} onClick={toggleMute} active={!muted}>
          {muted ? Icon.muted : Icon.sound}
        </Btn>
        <Btn label="Phụ đề" onClick={() => setSubs((s) => !s)} active={subs}>
          {Icon.cc}
        </Btn>
        <Btn label="Toàn màn hình" onClick={fullscreen}>
          {Icon.full}
        </Btn>
      </div>

      {scenes.length > 1 && (
      <ol className="vp-chapters">
        {scenes.map((s, i) => (
          <li key={s.scene.id}>
            <button className={i === idx ? 'is-current' : t >= starts[i] + s.duration ? 'is-done' : ''} onClick={() => goScene(i)}>
              <span className="vp-ch-time">{fmt(starts[i])}</span>
              {s.scene.title}
            </button>
          </li>
        ))}
      </ol>
      )}
    </div>
  )
}
