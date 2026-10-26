import { useState } from 'react'
import { MapPin, Radio } from 'lucide-react'

type Site = {
  id: string
  name: string
  x: number
  y: number
  status: string
  blurb: string
  firstNoted: string
  major?: boolean
}

// Schematic chart of San Francisco — not to scale, per the Dark Reel survey.
// Positions are hand-placed on the calibration grid.
const SITES: Site[] = [
  { id: 'S-01', name: 'Golden Gate Bridge', x: 128, y: 96, status: 'Echo site', blurb: 'The hum rides the fog under the deck. Ferry crews report “a second engine” with no source.', firstNoted: 'Ch. 4' },
  { id: 'S-02', name: 'The Presidio', x: 238, y: 140, status: 'Records sealed', blurb: 'Military storage. The 1977 intake logs exist here, if anyone with clearance still breathes.', firstNoted: 'Ch. 9' },
  { id: 'S-03', name: 'Clement Street', x: 176, y: 208, status: 'Weak signal', blurb: 'A block of televisions turning on by themselves at 3:33 AM. All thirteen of them.', firstNoted: 'Ch. 7' },
  { id: 'S-04', name: 'Clarendon Heights', x: 348, y: 236, status: 'Residential overlap', blurb: 'The distortion drifts uphill on fog nights. Dogs refuse the western fence line.', firstNoted: 'Ch. 11' },
  { id: 'S-05', name: 'Sutro Tower', x: 392, y: 272, status: 'SOURCE — 19.8 HZ', blurb: 'The antenna at the top of the city. The signal does not originate here. It only arrives here. Everything points back down.', firstNoted: 'Ch. 2', major: true },
  { id: 'S-06', name: 'Mount Sutro', x: 340, y: 318, status: 'Dead zone ring', blurb: 'A perfect circle where radios only pick up a voice counting backwards.', firstNoted: 'Ch. 13' },
  { id: 'S-07', name: 'Twin Peaks', x: 428, y: 336, status: 'Overlook', blurb: 'On clear nights you can see the whole city flicker once — a single dropped frame.', firstNoted: 'Ch. 15' },
  { id: 'S-08', name: 'The Mission', x: 486, y: 430, status: 'Spread pattern', blurb: 'The tears cluster along Valencia like a vein. They are widening in sequence, south to north.', firstNoted: 'Ch. 5' },
  { id: 'S-09', name: 'Tenderloin Bunker', x: 552, y: 296, status: 'THE DOOR', blurb: 'Sub-level survey site. The steel door has been holding since 1977. This is where the survey ends — and where you stop being a witness.', firstNoted: 'Ch. 18', major: true },
  { id: 'S-10', name: '4th & King Caltrain', x: 664, y: 418, status: 'First contact', blurb: 'Platform 3. The commuter never noticed the wake. His footsteps are still slightly out of sync.', firstNoted: 'Prologue' },
  { id: 'S-11', name: 'Bay Bridge', x: 724, y: 330, status: 'Resonance line', blurb: 'Crossing at night, drivers hear the 19.8 Hz through the suspension cables. It matches no wind.', firstNoted: 'Ch. 16' },
]

export default function StoryMap() {
  const [active, setActive] = useState<Site>(SITES[4])

  return (
    <section className="story-map" aria-labelledby="map-title">
      <header className="map-header">
        <div>
          <p className="eyebrow"><Radio size={13} aria-hidden="true" /> Field survey — end of Chapter 18</p>
          <h2 id="map-title">SIGNAL SITE SURVEY</h2>
        </div>
        <p className="map-classification">PROJECT DARK REEL / CALIBRATION MASTER<br />DO NOT DUPLICATE</p>
      </header>

      <div className="map-frame">
        <svg viewBox="0 0 800 520" role="img" aria-label="Schematic map of San Francisco marking eleven signal sites">
          <defs>
            <radialGradient id="mapGlow" cx="49%" cy="52%" r="60%">
              <stop offset="0%" stopColor="rgba(201,168,106,0.12)" />
              <stop offset="100%" stopColor="rgba(201,168,106,0)" />
            </radialGradient>
          </defs>
          <rect width="800" height="520" fill="#0a0d1f" />
          <g className="map-grid">
            {Array.from({ length: 15 }, (_, i) => <line key={`v${i}`} x1={i * 57.14} y1="0" x2={i * 57.14} y2="520" />)}
            {Array.from({ length: 9 }, (_, i) => <line key={`h${i}`} x1="0" y1={i * 65} x2="800" y2={i * 65} />)}
          </g>
          {/* Bay */}
          <path className="map-bay" d="M 800 40 C 700 90, 690 190, 730 260 C 760 320, 750 400, 700 470 L 800 520 Z" />
          <path className="map-coast" d="M 40 60 C 120 40, 200 70, 250 120 C 300 170, 380 190, 460 210 C 540 230, 620 250, 700 260 M 60 300 C 140 280, 200 330, 260 380 C 320 430, 420 460, 520 470 C 580 475, 640 480, 690 470" />
          {/* Sutro broadcast rings */}
          <g className="map-rings">
            <circle cx="392" cy="272" r="60" />
            <circle cx="392" cy="272" r="110" />
            <circle cx="392" cy="272" r="165" />
          </g>
          <rect width="800" height="520" fill="url(#mapGlow)" />
          {SITES.map((site) => (
            <g
              key={site.id}
              className={`map-site${site.major ? ' major' : ''}${site.id === active.id ? ' active' : ''}`}
              transform={`translate(${site.x}, ${site.y})`}
              onClick={() => setActive(site)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActive(site) } }}
              aria-label={`${site.name} — ${site.status}`}
            >
              <circle className="site-pulse" r="16" />
              <circle className="site-dot" r={site.major ? 7 : 4.5} />
              <text className="site-label" x="0" y="-14">{site.id}</text>
            </g>
          ))}
        </svg>

        <aside className="map-detail" aria-live="polite">
          <p className="md-id"><MapPin size={13} aria-hidden="true" /> {active.id} · {active.status}</p>
          <h3>{active.name}</h3>
          <p className="md-blurb">{active.blurb}</p>
          <p className="md-noted">First noted: {active.firstNoted}</p>
          <div className="md-index">
            {SITES.map((site) => (
              <button key={site.id} className={site.id === active.id ? 'active' : ''} onClick={() => setActive(site)}>
                {site.id.replace('S-', '')}
              </button>
            ))}
          </div>
        </aside>
      </div>

      <p className="map-footnote">Survey ends at the door. What broadcasts from below it is on the other side — Chapters 19–28.</p>
    </section>
  )
}
