import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, SkipBack, SkipForward, Volume2 } from 'lucide-react'

type NarrationPlayerProps = {
  paragraphs: string[]
  chapterTitle: string
  /** Pre-recorded neural-voice MP3 for this chapter. When absent/unreachable
   *  the player falls back to the Web Speech API. */
  audioSrc?: string
  onParagraph?: (index: number | null) => void
  onEnded?: () => void
}

function scoreVoice(voice: SpeechSynthesisVoice): number {
  const name = `${voice.name} ${voice.voiceURI}`.toLowerCase()
  let score = 0
  if (/natural|neural|online|premium|enhanced|aria|jenny|guy|samantha|zira|alloy|nova|shimmer/.test(name)) score += 40
  if (/google/.test(name)) score += 20
  if (voice.lang === 'en-US') score += 10
  else if (voice.lang.startsWith('en')) score += 5
  if (/compact|espeak|robot|retro/.test(name)) score -= 30
  return score
}

function englishVoices(): SpeechSynthesisVoice[] {
  const voices = window.speechSynthesis?.getVoices() ?? []
  return voices.filter((voice) => voice.lang.startsWith('en'))
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? []
  if (!voices.length) return null
  const english = englishVoices()
  const pool = english.length ? english : voices
  return pool.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] ?? null
}

/** Convert a playback time to the approximate paragraph index using word
 *  fractions, so the reader highlight still tracks the MP3. */
function paragraphAtTime(time: number, duration: number, paragraphs: string[]): number {
  if (duration <= 0 || paragraphs.length === 0) return 0
  const total = paragraphs.reduce((sum, p) => sum + p.split(/\s+/).length, 0)
  if (total === 0) return 0
  const targetWords = (time / duration) * total
  let acc = 0
  for (let i = 0; i < paragraphs.length; i += 1) {
    acc += paragraphs[i].split(/\s+/).length
    if (targetWords <= acc) return i
  }
  return paragraphs.length - 1
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Chapter narration. Prefers a pre-recorded MP3 (studio voice); falls back to
 * the Web Speech API (free, instant) when the file isn't available yet.
 */
export default function NarrationPlayer({ paragraphs, chapterTitle, audioSrc, onParagraph, onEnded }: NarrationPlayerProps) {
  const [speechSupported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window)

  // --- MP3 mode state ---
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [audioMode, setAudioMode] = useState<'checking' | 'file' | 'tts'>('checking')
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    if (!audioSrc) { setAudioMode('tts'); return }
    setAudioMode('checking')
    setTime(0); setDuration(0); setPlaying(false)
    const audio = new Audio()
    audioRef.current = audio
    audio.preload = 'metadata'
    audio.src = audioSrc
    const onReady = () => {
      setDuration(audio.duration)
      setAudioMode('file')
    }
    const onError = () => { audioRef.current = null; setAudioMode('tts') }
    const onTime = () => {
      setTime(audio.currentTime)
      const idx = paragraphAtTime(audio.currentTime, audio.duration || 0, paragraphsRef.current)
      onParagraphRef.current?.(idx)
    }
    const onEndedFile = () => {
      setPlaying(false)
      onParagraphRef.current?.(null)
      onEndedRef.current?.()
    }
    audio.addEventListener('loadedmetadata', onReady)
    audio.addEventListener('canplay', onReady)
    audio.addEventListener('error', onError)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('ended', onEndedFile)
    return () => {
      audio.pause()
      audio.removeEventListener('loadedmetadata', onReady)
      audio.removeEventListener('canplay', onReady)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('ended', onEndedFile)
      audioRef.current = null
    }
  }, [audioSrc])

  const paragraphsRef = useRef(paragraphs)
  paragraphsRef.current = paragraphs
  const onParagraphRef = useRef(onParagraph)
  onParagraphRef.current = onParagraph
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded

  const toggleFile = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) { audio.pause(); setPlaying(false); return }
    audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
  }, [playing])

  const seekFile = useCallback((delta: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.min(Math.max(0, audio.currentTime + delta), audio.duration || Infinity)
    setTime(audio.currentTime)
  }, [])

  const restartFile = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = 0
    setTime(0)
    if (!playing) { audio.play().then(() => setPlaying(true)).catch(() => {}) }
  }, [playing])

  // --- Web Speech mode (fallback) ---
  const [position, setPosition] = useState(0)
  const [voiceURI, setVoiceURI] = useState<string>('')
  const [voiceOptions, setVoiceOptions] = useState<SpeechSynthesisVoice[]>([])
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const refreshVoices = useCallback(() => {
    const list = englishVoices()
    setVoiceOptions(list)
    const best = pickVoice()
    if (best && !voiceURI) setVoiceURI(best.voiceURI)
  }, [voiceURI])

  const chosenVoice = useCallback((): SpeechSynthesisVoice | null => {
    const voices = window.speechSynthesis?.getVoices() ?? []
    return voices.find((voice) => voice.voiceURI === voiceURI) ?? pickVoice()
  }, [voiceURI])

  const stop = useCallback((notify = true) => {
    window.speechSynthesis?.cancel()
    utteranceRef.current = null
    setPlaying(false)
    if (notify) onParagraph?.(null)
  }, [onParagraph])

  const speakFrom = useCallback((startIndex: number) => {
    if (!speechSupported) return
    window.speechSynthesis.cancel()
    const text = paragraphsRef.current.slice(startIndex).join('\n\n')
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = chosenVoice()
    if (voice) utterance.voice = voice
    utterance.rate = 0.95
    utterance.pitch = 1
    let cursor = startIndex
    utterance.onboundary = (event) => {
      if (event.name && event.name !== 'word') return
      let acc = 0
      for (let index = 0; index < paragraphsRef.current.length; index += 1) {
        acc += paragraphsRef.current[index].length + 2
        if (event.charIndex < acc) {
          if (index !== cursor) {
            cursor = index
            setPosition(index)
            onParagraph?.(index)
          }
          break
        }
      }
    }
    utterance.onend = () => {
      setPlaying(false)
      utteranceRef.current = null
      onParagraph?.(null)
      onEnded?.()
    }
    utterance.onerror = () => {
      setPlaying(false)
      utteranceRef.current = null
      onParagraph?.(null)
    }
    utteranceRef.current = utterance
    setPosition(startIndex)
    onParagraph?.(startIndex)
    setPlaying(true)
    window.speechSynthesis.speak(utterance)
  }, [speechSupported, onParagraph, onEnded, chosenVoice])

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel()
      utteranceRef.current = null
    }
  }, [paragraphs])

  useEffect(() => {
    refreshVoices()
    window.speechSynthesis?.addEventListener('voiceschanged', refreshVoices)
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', refreshVoices)
  }, [refreshVoices])

  if (!speechSupported && audioMode !== 'file') return null

  // ================= MP3 player =================
  if (audioMode === 'file') {
    return (
      <div className="narration-player" role="region" aria-label={`Narration for ${chapterTitle}`}>
        <span className="np-reel" aria-hidden="true"><Volume2 size={15} /></span>
        <div className="np-info">
          <strong>{playing ? 'Now narrating' : 'Narrated chapter'}</strong>
          <span>{chapterTitle} — {formatTime(time)} / {formatTime(duration)}</span>
        </div>
        <div className="np-controls">
          <button onClick={restartFile} aria-label="Restart chapter"><RotateCcw size={15} /></button>
          <button onClick={() => seekFile(-15)} aria-label="Back 15 seconds"><SkipBack size={15} /></button>
          {playing ? (
            <button className="np-play" onClick={toggleFile} aria-label="Pause narration"><Pause size={17} /></button>
          ) : (
            <button className="np-play" onClick={toggleFile} aria-label="Play narration"><Play size={17} /></button>
          )}
          <button onClick={() => seekFile(15)} aria-label="Forward 15 seconds"><SkipForward size={15} /></button>
          <button onClick={() => { audioRef.current?.pause(); setPlaying(false); audioRef.current && (audioRef.current.currentTime = 0); setTime(0); onParagraph?.(null) }} aria-label="Stop narration" className="np-stop">Stop</button>
        </div>
        <div className="np-voice"><span className="np-badge">Studio voice</span></div>
        <div className="np-progress" aria-hidden="true"><i style={{ transform: `scaleX(${duration > 0 ? time / duration : 0})` }} /></div>
      </div>
    )
  }

  if (audioMode === 'checking') {
    return (
      <div className="narration-player" role="region" aria-label={`Narration for ${chapterTitle}`}>
        <span className="np-reel" aria-hidden="true"><Volume2 size={15} /></span>
        <div className="np-info"><strong>Read to me</strong><span>{chapterTitle}</span></div>
      </div>
    )
  }

  // ================= Web Speech fallback =================
  const total = paragraphs.length
  const atStart = position <= 0
  const atEnd = position >= total - 1

  return (
    <div className="narration-player" role="region" aria-label={`Narration for ${chapterTitle}`}>
      <span className="np-reel" aria-hidden="true"><Volume2 size={15} /></span>
      <div className="np-info">
        <strong>{playing ? 'Now reading' : 'Read to me'}</strong>
        <span>{chapterTitle} — {position + 1} / {total}</span>
      </div>
      <div className="np-controls">
        <button onClick={() => speakFrom(0)} disabled={playing && atStart} aria-label="Restart chapter"><RotateCcw size={15} /></button>
        <button onClick={() => speakFrom(Math.max(0, position - 1))} disabled={atStart && !playing} aria-label="Previous paragraph"><SkipBack size={15} /></button>
        {playing ? (
          <button className="np-play" onClick={() => stop()} aria-label="Pause narration"><Pause size={17} /></button>
        ) : (
          <button className="np-play" onClick={() => speakFrom(atEnd ? 0 : position)} aria-label="Play narration"><Play size={17} /></button>
        )}
        <button onClick={() => speakFrom(Math.min(total - 1, position + 1))} disabled={atEnd} aria-label="Next paragraph"><SkipForward size={15} /></button>
        <button onClick={() => { stop(); setPosition(0) }} aria-label="Stop narration" className="np-stop">Stop</button>
      </div>
      <div className="np-voice">
        <select
          aria-label="Narration voice"
          value={voiceURI}
          onChange={(event) => {
            stop()
            setVoiceURI(event.target.value)
          }}
        >
          {voiceOptions.length === 0 && <option value="">Default voice</option>}
          {voiceOptions.map((voice) => (
            <option key={voice.voiceURI} value={voice.voiceURI}>
              {voice.name.replace(/Microsoft |Google /, '')} ({voice.lang})
            </option>
          ))}
        </select>
      </div>
      <div className="np-progress" aria-hidden="true"><i style={{ transform: `scaleX(${total > 1 ? position / (total - 1) : 0})` }} /></div>
    </div>
  )
}
