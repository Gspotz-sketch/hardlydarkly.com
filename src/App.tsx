import { useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  Menu,
  Minus,
  Plus,
  Search,
  X,
} from 'lucide-react'
import { chapters, totalWords, type Chapter } from './data/chapters'
import NarrationPlayer from './components/NarrationPlayer'
import StoryMap from './components/StoryMap'
import Gate from './components/Gate'
import AgeGate, { hasAgeConsent } from './components/AgeGate'
import Memorabilia from './components/Memorabilia'
import useUnlock from './hooks/useUnlock'
import { isAdultChapter } from './config'
import { syncAds } from './ads'
import './App.css'

type Route = { view: 'home' } | { view: 'reader'; slug: string }

function routeFromHash(): Route {
  const hash = window.location.hash
  if (hash.startsWith('#/read/')) {
    return { view: 'reader', slug: decodeURIComponent(hash.slice(7)) }
  }
  return { view: 'home' }
}

function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key)
      return stored ? JSON.parse(stored) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Reading remains fully functional when storage is unavailable.
    }
  }, [key, value])
  return [value, setValue] as const
}

const readTime = (chapter: Chapter) => Math.max(1, Math.ceil(chapter.wordCount / 220))
const chapterLabel = (chapter: Chapter) => chapter.number === 0 ? 'Prologue' : `Chapter ${chapter.number}`
const shortLabel = (chapter: Chapter) => chapter.number === 0 ? 'PR' : String(chapter.number).padStart(2, '0')

function goRead(slug: string) {
  window.location.hash = `/read/${encodeURIComponent(slug)}`
}

function goHome(section = 'top') {
  window.location.hash = section
}

function Wordmark({ onClick }: { onClick: () => void }) {
  return (
    <button className="wordmark" onClick={onClick} aria-label="Hardly Darkly home">
      <span>HARDLY</span><span>DARKLY</span>
    </button>
  )
}

function SiteHeader({ route, lastRead }: { route: Route; lastRead: string }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [])
  const navigate = (section: string) => {
    setOpen(false)
    goHome(section)
  }
  return (
    <>
      <header className="site-header">
        <Wordmark onClick={() => navigate('top')} />
        <nav className="desktop-nav" aria-label="Main navigation">
          <button onClick={() => navigate('reader')}>The reader</button>
          <button onClick={() => navigate('memorabilia')}>Memorabilia</button>
          <button onClick={() => navigate('chapters')}>Chapters</button>
        </nav>
        <div className="header-actions">
          <button className="continue-button" onClick={() => route.view === 'reader' ? goHome('chapters') : goRead(lastRead)}>
            <BookOpen size={15} aria-hidden="true" />
            <span>{route.view === 'reader' ? 'Chapter index' : 'Continue reading'}</span>
          </button>
          <button className="menu-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? 'Close menu' : 'Open menu'}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>
      {open && (
        <div className="mobile-menu" id="mobile-menu">
          <nav aria-label="Mobile navigation">
            <button onClick={() => navigate('reader')}>The reader <ArrowRight size={18} /></button>
            <button onClick={() => navigate('memorabilia')}>Memorabilia <ArrowRight size={18} /></button>
            <button onClick={() => navigate('chapters')}>Chapters <ArrowRight size={18} /></button>
            <button onClick={() => { setOpen(false); goRead(chapters[0].slug) }}>Start with the prologue <ArrowRight size={18} /></button>
          </nav>
        </div>
      )}
    </>
  )
}

function ChapterIndex({ bookmarks, onRead }: { bookmarks: string[]; onRead: (slug: string) => void }) {
  const [query, setQuery] = useState('')
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false)
  const filtered = useMemo(() => chapters.filter((chapter) => {
    if (bookmarkedOnly && !bookmarks.includes(chapter.slug)) return false
    const haystack = `${chapterLabel(chapter)} ${chapter.title} ${chapter.excerpt}`.toLowerCase()
    return haystack.includes(query.trim().toLowerCase())
  }), [query, bookmarkedOnly, bookmarks])

  return (
    <section className="chapters-section" id="chapters" aria-labelledby="chapters-title">
      <div className="section-heading chapter-heading">
        <div>
          <p className="eyebrow">The transmission so far</p>
          <h2 id="chapters-title">Start reading.</h2>
        </div>
        <p>One prologue. Twenty-eight chapters.<br />New signals arrive as they’re received.</p>
      </div>
      <div className="chapter-tools">
        <label className="search-field">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search chapters</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or opening line" />
          {query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={16} /></button>}
        </label>
        <button className={`bookmark-filter ${bookmarkedOnly ? 'active' : ''}`} onClick={() => setBookmarkedOnly(!bookmarkedOnly)} aria-pressed={bookmarkedOnly}>
          <Bookmark size={15} aria-hidden="true" /> Bookmarked {bookmarks.length > 0 && `(${bookmarks.length})`}
        </button>
      </div>
      <div className="chapter-list" aria-live="polite">
        {filtered.map((chapter) => (
          <button className="chapter-row" key={chapter.slug} onClick={() => onRead(chapter.slug)}>
            <span className="chapter-number">{shortLabel(chapter)}</span>
            <span className="chapter-row-main">
              <span className="chapter-kicker">{chapterLabel(chapter)}</span>
              <strong>{chapter.title}</strong>
              <span className="chapter-excerpt">{chapter.excerpt}…</span>
            </span>
            <span className="chapter-meta">
              {bookmarks.includes(chapter.slug) && <BookmarkCheck size={16} aria-label="Bookmarked" />}
              <span>{readTime(chapter)} min</span>
              <ArrowRight size={20} aria-hidden="true" />
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="empty-state">
            <p>{bookmarkedOnly && bookmarks.length === 0 ? 'No chapters bookmarked yet.' : 'No chapters match that signal.'}</p>
            <button onClick={() => { setQuery(''); setBookmarkedOnly(false) }}>Show every transmission</button>
          </div>
        )}
      </div>
    </section>
  )
}

function Home({ bookmarks, lastRead, onReadChapter }: { bookmarks: string[]; lastRead: string; onReadChapter: (slug: string) => void }) {
  const lastChapter = chapters.find((chapter) => chapter.slug === lastRead) ?? chapters[0]
  return (
    <main>
      <section className="hero" id="top" aria-labelledby="hero-title">
        <div className="hero-image" aria-hidden="true" />
        <div className="hero-static" aria-hidden="true" />
        <div className="hero-content">
          <p className="hero-overline">A serialized supernatural thriller</p>
          <h1 id="hero-title"><span>HARDLY</span><span>DARKLY</span></h1>
          <p className="hero-subtitle">Press play. The signal reads itself aloud.</p>
          <button className="primary-cta" onClick={() => goRead(chapters[0].slug)}>
            Enter the signal <ArrowRight size={18} />
          </button>
        </div>
        <div className="hero-footer">
          <span>San Francisco / 19.8 Hz</span>
          <span>28 transmissions, more coming</span>
          <span className="scroll-cue">Scroll to descend <span aria-hidden="true">↓</span></span>
        </div>
      </section>

      <section className="signal-strip" aria-label="Manuscript details">
        <div><strong>29</strong><span>Installments</span></div>
        <div><strong>{totalWords.toLocaleString()}</strong><span>Words</span></div>
        <div><strong>19.8</strong><span>Hertz</span></div>
        <p>“The air wasn’t just distorting anymore.<br />It was tearing.”</p>
      </section>

      <section className="reader-section" id="reader" aria-labelledby="reader-title">
        <div className="section-label"><span>01</span> The reader</div>
        <div className="ebook-copy">
          <p className="eyebrow">The story finds you</p>
          <h2 id="reader-title">Press play.<br /><em>Let the city read to you.</em></h2>
          <p className="large-copy">A signal that shouldn’t exist. A frequency only Samantha White can hear. And a door beneath San Francisco that has been holding since 1977. The transmission is ongoing — this is everything received so far.</p>
          <ul className="feature-list">
            <li><span>01</span> Prologue + 28 transmissions, more coming</li>
            <li><span>02</span> Press play and the story reads itself aloud</li>
            <li><span>03</span> Bookmarks, progress, reading controls</li>
          </ul>
          <button className="text-link" onClick={() => onReadChapter(lastChapter.slug)}>
            {lastRead === chapters[0].slug ? 'Begin with the prologue' : `Continue: ${lastChapter.title}`} <ArrowRight size={17} />
          </button>
        </div>
        <aside className="ebook-aside">
          <div className="frequency-graphic" aria-hidden="true">
            {Array.from({ length: 34 }, (_, index) => <i key={index} style={{ height: `${18 + ((index * 37) % 82)}%` }} />)}
          </div>
          <p>PROJECT DARK REEL<br />CALIBRATION MASTER<br />DO NOT ERASE</p>
        </aside>
      </section>

      <Memorabilia />

      <section className="quote-section">
        <p className="eyebrow">From the manuscript</p>
        <blockquote>“It wasn’t an empty room. It was an open frequency, waiting for whatever they decided to broadcast next.”</blockquote>
        <cite>Chapter 28: Open Bandwidth</cite>
      </section>

      <section className="notes-section" aria-labelledby="notes-title">
        <div className="section-label"><span>03</span> Reader notes</div>
        <h2 id="notes-title">What the community<br />is saying.</h2>
        <div className="notes-grid">
          <figure><blockquote>“I started reading at midnight. I didn’t sleep.”</blockquote><figcaption><span>R</span><div>Riley K.<small>@rileyreads</small></div></figcaption></figure>
          <figure><blockquote>“The atmosphere is relentless—in the best way.”</blockquote><figcaption><span>S</span><div>Sam V.<small>@samvox</small></div></figcaption></figure>
          <figure><blockquote>“It feels like the story is watching me back.”</blockquote><figcaption><span>J</span><div>Jules M.<small>@julesm</small></div></figcaption></figure>
        </div>
      </section>

      <section className="author-section">
        <div className="author-mark" aria-hidden="true">HD<span>19.8</span></div>
        <div>
          <p className="eyebrow">Author note</p>
          <h2>Why I built the dark.</h2>
          <p>I wanted a story that lives in the corners—between notifications, between waking and sleep. Hardly Darkly is that corner.</p>
        </div>
      </section>

      <ChapterIndex bookmarks={bookmarks} onRead={onReadChapter} />

      <footer className="site-footer">
        <Wordmark onClick={() => goHome('top')} />
        <p>A serialized supernatural thriller.<br />San Francisco, California.</p>
        <button className="text-link" onClick={() => goRead(chapters[0].slug)}>Start at the beginning <ArrowRight size={16} /></button>
        <span className="footer-signal">END OF CURRENT TRANSMISSION / 19.8 HZ</span>
      </footer>
    </main>
  )
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>
    return <span key={index}>{part}</span>
  })
}

type ReaderProps = {
  chapter: Chapter
  bookmarks: string[]
  setBookmarks: Dispatch<SetStateAction<string[]>>
  readChapters: string[]
  setReadChapters: Dispatch<SetStateAction<string[]>>
  unlocked: boolean
  unlockPending: boolean
  onCheckout: (slug: string) => Promise<void>
  onRestore: () => Promise<void>
  onReadChapter: (slug: string) => void
}

function Reader({ chapter, bookmarks, setBookmarks, readChapters, setReadChapters, unlocked, unlockPending, onCheckout, onRestore, onReadChapter }: ReaderProps) {
  const [progress, setProgress] = useState(0)
  const [fontSize, setFontSize] = usePersistentState('hardly-darkly-font-size', 20)
  const [sans, setSans] = usePersistentState('hardly-darkly-sans', false)
  const [indexOpen, setIndexOpen] = useState(false)
  const articleRef = useRef<HTMLElement>(null)
  const index = chapters.findIndex((item) => item.slug === chapter.slug)
  const previous = chapters[index - 1]
  const next = chapters[index + 1]
  const bookmarked = bookmarks.includes(chapter.slug)
  const [spoken, setSpoken] = useState<number | null>(null)
  const locked = isAdultChapter(chapter.number) && !unlocked

  useEffect(() => {
    setProgress(0)
    setSpoken(null)
    setIndexOpen(false)
    window.scrollTo(0, 0)
    document.title = `${chapterLabel(chapter)}: ${chapter.title} — Hardly Darkly`
  }, [chapter.slug])

  useEffect(() => {
    const update = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      setProgress(Math.min(1, Math.max(0, window.scrollY / max)))
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [chapter.slug])

  useEffect(() => {
    if (progress > 0.9) {
      setReadChapters((current) => current.includes(chapter.slug) ? current : [...current, chapter.slug])
    }
  }, [progress, chapter.slug, setReadChapters])

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.key === 'Escape') setIndexOpen(false)
      if (event.altKey && event.key === 'ArrowLeft' && previous) goRead(previous.slug)
      if (event.altKey && event.key === 'ArrowRight' && next) goRead(next.slug)
    }
    window.addEventListener('keydown', keyboard)
    return () => window.removeEventListener('keydown', keyboard)
  }, [previous?.slug, next?.slug])

  const toggleBookmark = () => {
    setBookmarks((current) => bookmarked ? current.filter((slug) => slug !== chapter.slug) : [...current, chapter.slug])
  }

  const chapterNavigation = (mobile = false) => (
    <nav className={mobile ? 'reader-index mobile-reader-index' : 'reader-index'} aria-label="Chapter index">
      <div className="reader-index-heading"><span>Transmission index</span><span>{chapters.length}</span></div>
      <div className="reader-index-scroll">
        {chapters.map((item) => (
          <button key={item.slug} className={item.slug === chapter.slug ? 'current' : ''} onClick={() => onReadChapter(item.slug)} aria-current={item.slug === chapter.slug ? 'page' : undefined}>
            <span>{shortLabel(item)}</span>
            <span>{item.title}</span>
            {isAdultChapter(item.number) && !unlocked && <Lock size={11} aria-label="Adults only — locked" />}
            {readChapters.includes(item.slug) && <Check size={13} aria-label="Read" />}
          </button>
        ))}
      </div>
    </nav>
  )

  return (
    <main className="reader-page">
      <div className="reading-progress" aria-hidden="true"><i style={{ transform: `scaleX(${progress})` }} /></div>
      <div className="reader-mobile-bar">
        <button onClick={() => setIndexOpen(true)} aria-label="Open chapter index"><Menu size={18} /> Index</button>
        <label>
          <span className="sr-only">Current chapter</span>
          <select value={chapter.slug} onChange={(event) => goRead(event.target.value)}>
            {chapters.map((item) => <option key={item.slug} value={item.slug}>{chapterLabel(item)}: {item.title}</option>)}
          </select>
        </label>
        <button onClick={toggleBookmark} aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this chapter'}>{bookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}</button>
      </div>
      {indexOpen && (
        <div className="reader-drawer" role="dialog" aria-modal="true" aria-label="Chapter index">
          <button className="drawer-backdrop" onClick={() => setIndexOpen(false)} aria-label="Close chapter index" />
          <div className="drawer-panel">
            <button className="drawer-close" onClick={() => setIndexOpen(false)} aria-label="Close chapter index"><X size={20} /></button>
            {chapterNavigation(true)}
          </div>
        </div>
      )}
      <div className="reader-layout">
        <aside className="reader-left">{chapterNavigation()}</aside>
        <article className={`reader-article ${sans ? 'sans' : ''}`} ref={articleRef} style={{ '--reader-size': `${fontSize}px` } as CSSProperties}>
          <header className="reader-article-header">
            <p className="eyebrow">{chapterLabel(chapter)} <span>/</span> Hardly Darkly</p>
            <h1>{chapter.title}</h1>
            <div className="reader-byline">
              <span><Clock size={14} /> {readTime(chapter)} minute read</span>
              <span>{chapter.wordCount.toLocaleString()} words</span>
              <span>{Math.round(progress * 100)}% read</span>
            </div>
          </header>
          {!locked && (
            <NarrationPlayer
              paragraphs={chapter.paragraphs}
              chapterTitle={chapter.title}
              onParagraph={(index) => setSpoken(index)}
              onEnded={() => { if (next && !isAdultChapter(next.number)) goRead(next.slug) }}
            />
          )}
          {locked ? (
            <Gate
              pending={unlockPending}
              slug={chapter.slug}
              onCheckout={(target) => { void onCheckout(target) }}
              onRestore={() => { void onRestore() }}
            />
          ) : (
            <>
              <div className="reader-body">
                {chapter.paragraphs.map((paragraph, paragraphIndex) => (
                  <p key={paragraphIndex} className={`${paragraphIndex === 0 ? 'opening-paragraph' : ''}${spoken === paragraphIndex ? ' spoken' : ''}`}>{renderInline(paragraph)}</p>
                ))}
              </div>
              {chapter.number === 18 && <StoryMap />}
              <div className="chapter-end">
                <span>END OF {chapterLabel(chapter).toUpperCase()}</span>
                <i aria-hidden="true" />
                <span>19.8 HZ</span>
              </div>
            </>
          )}
          <nav className="previous-next" aria-label="Adjacent chapters">
            {previous ? (
              <button className="previous" onClick={() => goRead(previous.slug)}>
                <ChevronLeft size={20} /><span><small>Previous</small><strong>{previous.title}</strong></span>
              </button>
            ) : <span />}
            {next ? (
              <button className="next" onClick={() => goRead(next.slug)}>
                <span><small>{isAdultChapter(next.number) ? 'The door — adults only' : 'Next transmission'}</small><strong>{next.title}</strong></span><ChevronRight size={20} />
              </button>
            ) : (
              <button className="next" onClick={() => goHome('chapters')}>
                <span><small>You are at the live edge</small><strong>The next transmission is coming</strong></span><ArrowRight size={20} />
              </button>
            )}
          </nav>
        </article>
        <aside className="reader-settings" aria-label="Reading settings">
          <p className="eyebrow">Reader controls</p>
          <div className="setting-group">
            <span>Text size</span>
            <div className="size-control">
              <button onClick={() => setFontSize((size) => Math.max(17, size - 1))} disabled={fontSize <= 17} aria-label="Decrease text size"><Minus size={15} /></button>
              <output aria-label="Current text size">{fontSize}</output>
              <button onClick={() => setFontSize((size) => Math.min(25, size + 1))} disabled={fontSize >= 25} aria-label="Increase text size"><Plus size={15} /></button>
            </div>
          </div>
          <div className="setting-group">
            <span>Typeface</span>
            <button className="type-toggle" onClick={() => setSans(!sans)} aria-pressed={sans}>{sans ? 'Sans serif' : 'Serif'}<span>Switch</span></button>
          </div>
          <button className={`reader-bookmark ${bookmarked ? 'active' : ''}`} onClick={toggleBookmark}>
            {bookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
            {bookmarked ? 'Bookmarked' : 'Bookmark chapter'}
          </button>
          <button className="back-index" onClick={() => goHome('chapters')}><ArrowLeft size={15} /> Full chapter index</button>
          <p className="keyboard-note">Alt + ← / →<br />moves between chapters.</p>
        </aside>
      </div>
    </main>
  )
}

export default function App() {
  const [route, setRoute] = useState<Route>(routeFromHash)
  const [bookmarks, setBookmarks] = usePersistentState<string[]>('hardly-darkly-bookmarks', [])
  const [readChapters, setReadChapters] = usePersistentState<string[]>('hardly-darkly-read', [])
  const [lastRead, setLastRead] = usePersistentState('hardly-darkly-last-read', chapters[0].slug)
  const [ageTarget, setAgeTarget] = useState<string | null>(null)
  const { unlocked, pending: unlockPending, checkout, restore } = useUnlock()

  useEffect(() => {
    const update = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])

  useEffect(() => {
    if (route.view === 'reader') {
      const chapter = chapters.find((item) => item.slug === route.slug)
      if (chapter) setLastRead(chapter.slug)
    } else {
      document.title = 'Hardly Darkly — A Supernatural Thriller'
      const id = window.location.hash.slice(1)
      if (id && !id.startsWith('/')) {
        window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 40)
      }
    }
  }, [route])

  const current = route.view === 'reader' ? chapters.find((chapter) => chapter.slug === route.slug) : undefined

  // AdSense only on surfaces safe for monetization — never on adult chapters.
  useEffect(() => {
    syncAds(route.view !== 'reader' || !current || !isAdultChapter(current.number))
  }, [route, current])

  // Adult chapters must not be indexed.
  useEffect(() => {
    const adult = route.view === 'reader' && current ? isAdultChapter(current.number) : false
    const existing = document.querySelector('meta[name="robots"]')
    if (adult) {
      if (existing) {
        existing.setAttribute('content', 'noindex')
      } else {
        const meta = document.createElement('meta')
        meta.name = 'robots'
        meta.content = 'noindex'
        document.head.appendChild(meta)
      }
    } else if (existing) {
      existing.remove()
    }
  }, [route, current])

  const readChapter = (slug: string) => {
    const target = chapters.find((item) => item.slug === slug)
    if (target && isAdultChapter(target.number) && !unlocked && !hasAgeConsent()) {
      setAgeTarget(slug)
      return
    }
    goRead(slug)
  }

  return (
    <div className="app-shell">
      <SiteHeader route={route} lastRead={lastRead} />
      {route.view === 'reader' && current ? (
        <Reader
          chapter={current}
          bookmarks={bookmarks}
          setBookmarks={setBookmarks}
          readChapters={readChapters}
          setReadChapters={setReadChapters}
          unlocked={unlocked}
          unlockPending={unlockPending}
          onCheckout={checkout}
          onRestore={restore}
          onReadChapter={readChapter}
        />
      ) : route.view === 'reader' ? (
        <main className="not-found"><p className="eyebrow">Signal lost</p><h1>That chapter doesn’t exist.</h1><button className="primary-cta" onClick={() => goHome('chapters')}>Return to the transmission index <ArrowRight size={18} /></button></main>
      ) : <Home bookmarks={bookmarks} lastRead={lastRead} onReadChapter={readChapter} />}
      {ageTarget && (
        <AgeGate onConfirm={() => { const slug = ageTarget; setAgeTarget(null); goRead(slug) }} />
      )}
    </div>
  )
}
