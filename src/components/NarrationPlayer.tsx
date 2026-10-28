import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, SkipBack, SkipForward, Volume2 } from 'lucide-react'

type NarrationPlayerProps = {
  paragraphs: string[]
  chapterTitle: string
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

/**
 * Chapter narration via the Web Speech API (free, instant — no audio files).
 * Highlights the paragraph currently being spoken and auto-reports progress.
 */
export default function NarrationPlayer({ paragraphs, chapterTitle, onParagraph, onEnded }: NarrationPlayerProps) {
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0) // paragraph cursor
  const [supported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window)
  const [voiceURI, setVoiceURI] = useState<string>('')
  const [voiceOptions, setVoiceOptions] = useState<SpeechSynthesisVoice[]>([])
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const paragraphsRef = useRef(paragraphs)
  paragraphsRef.current = paragraphs

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
    if (!supported) return
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
      // charIndex is measured against the joined text; walk the cursor forward.
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
  }, [supported, onParagraph, onEnded, chosenVoice])

  // Cancel whenever the chapter changes or the component unmounts.
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

  if (!supported) return null

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
