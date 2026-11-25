import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { yearReview, yearReviewCardYear, yearReviewSlides, yearsWithWorkouts } from '../lib/logic';
import { useStore } from '../lib/store';

/** "Dit træningsår"-kortet i Historik (dec–jan) og "Tidligere år"-links (#309) */
export function YearReviewSection({ now }: { now: number }) {
  const { state, dispatch } = useStore();
  const [openYear, setOpenYear] = useState<number | null>(null);
  const cardYear = yearReviewCardYear(state, now);
  const thisYear = new Date(now).getFullYear();
  // Afsluttede år (og et skjult kortår) kan altid åbnes
  const past = yearsWithWorkouts(state).filter((y) => y < thisYear && y !== cardYear);

  if (cardYear === null && !past.length) return null;
  return (
    <>
      {cardYear !== null && (
        <section className="card year-card" aria-label={`Dit træningsår ${cardYear}`}>
          <button className="year-card-open" onClick={() => setOpenYear(cardYear)}>
            <span className="year-card-icon" aria-hidden>
              🎉
            </span>
            <span>
              <strong>Dit træningsår {cardYear}</strong>
              <span className="muted">Se historien om dit år</span>
            </span>
          </button>
          <button className="btn-ghost small" onClick={() => dispatch({ type: 'HIDE_YEAR_REVIEW', year: cardYear })}>
            Skjul
          </button>
        </section>
      )}
      {past.length > 0 && (
        <nav className="year-past" aria-label="Tidligere år">
          <span className="muted">Tidligere år:</span>
          {past.map((y) => (
            <button key={y} className="chip" onClick={() => setOpenYear(y)} aria-label={`Dit træningsår ${y}`}>
              {y}
            </button>
          ))}
        </nav>
      )}
      {openYear !== null && <YearStory year={openYear} onClose={() => setOpenYear(null)} />}
    </>
  );
}

/** Fuldskærms-historien med 6–8 slides (#309) */
export function YearStory({ year, onClose, lastSlideExtra }: { year: number; onClose: () => void; lastSlideExtra?: ReactNode }) {
  const { state } = useStore();
  const slides = useMemo(() => yearReviewSlides(yearReview(state, year)), [state, year]);
  const [i, setI] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const last = slides.length - 1;
  const next = () => setI((n) => Math.min(last, n + 1));
  const prev = () => setI((n) => Math.max(0, n - 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const s = slides[i];
  return (
    <div className="story" role="dialog" aria-modal="true" aria-label={`Dit træningsår ${year}`}>
      <div className="story-progress" aria-hidden>
        {slides.map((x, n) => (
          <span key={x.id} className={n <= i ? 'on' : ''} />
        ))}
      </div>
      <header className="story-head">
        <span className="muted">
          {i + 1} / {slides.length}
        </span>
        <button className="btn-ghost" onClick={onClose} aria-label="Luk">
          ✕
        </button>
      </header>
      <div
        key={s.id}
        className={`story-slide story-${s.id}`}
        aria-live="polite"
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const t = touch.current;
          touch.current = null;
          if (!t) return;
          const dx = e.changedTouches[0].clientX - t.x;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.changedTouches[0].clientY - t.y)) {
            e.preventDefault();
            if (dx < 0) next();
            else prev();
          }
        }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          const r = e.currentTarget.getBoundingClientRect();
          if (e.clientX - r.left < r.width / 3) prev();
          else next();
        }}
      >
        <div className="story-icon" aria-hidden>
          {s.icon}
        </div>
        <h2>{s.title}</h2>
        <p className="story-big">{s.big}</p>
        {s.lines.map((l) => (
          <p key={l} className="story-line">
            {l}
          </p>
        ))}
        {i === last && lastSlideExtra}
      </div>
      <footer className="story-foot">
        <button className="btn-secondary" onClick={prev} disabled={i === 0}>
          Forrige
        </button>
        {i < last ? (
          <button className="btn-primary" onClick={next}>
            Næste
          </button>
        ) : (
          <button className="btn-primary" onClick={onClose}>
            Færdig
          </button>
        )}
      </footer>
    </div>
  );
}
