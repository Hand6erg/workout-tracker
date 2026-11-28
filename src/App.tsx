import { useEffect, useState } from 'react';
import { formatDuration, IS_STAGING, resolveTheme, workoutDuration } from './lib/logic';
import type { Theme } from './lib/types';
import { useIntervalCues, useRestAlerts } from './lib/alerts';
import { useWakeLock } from './lib/wakeLock';
import { useNow, useStore } from './lib/store';
import { ActiveWorkout, WorkoutEditor } from './views/ActiveWorkout';
import { ExercisesView } from './views/ExercisesView';
import { HistoryView } from './views/HistoryView';
import { ProfileView } from './views/ProfileView';
import { StartView } from './views/StartView';
import { IntervalBar } from './components/IntervalTimer';
import { SummaryView } from './views/SummaryView';
import { UndoBar } from './components/UndoBar';

type Tab = 'start' | 'history' | 'exercises' | 'profile';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'start', label: 'Træning', icon: '＋' },
  { id: 'history', label: 'Historik', icon: '🕘' },
  { id: 'exercises', label: 'Øvelser', icon: '🏋️' },
  { id: 'profile', label: 'Profil', icon: '👤' },
];

export default function App() {
  const { state, dispatch, clearUndo } = useStore();
  const [tab, setTab] = useState<Tab>('start');
  const [workoutOpen, setWorkoutOpen] = useState(true);
  const showWorkout = !!state.active && workoutOpen;
  const summaryOpen = !!state.lastFinishedId && !state.active;
  useRestAlerts();
  useIntervalCues();
  useWakeLock();
  useTheme(state.theme);
  useLargeText(state.largeText);

  return (
    <div className="app">
      {IS_STAGING && (
        <>
          <div className="staging-banner" role="status">
            TESTVERSION – egne testdata, ikke dine rigtige træninger
          </div>
          <div className="staging-frame" aria-hidden />
        </>
      )}
      <main>
        {summaryOpen && (
          <SummaryView
            onClose={() => {
              dispatch({ type: 'CLOSE_SUMMARY' });
              setTab('start');
            }}
            onOpenMilestones={() => {
              dispatch({ type: 'CLOSE_SUMMARY' });
              setTab('profile');
              setTimeout(() => document.getElementById('milepaele')?.scrollIntoView({ block: 'start' }), 50);
            }}
          />
        )}
        {!summaryOpen && tab === 'start' && <StartView onOpenWorkout={() => setWorkoutOpen(true)} />}
        {!summaryOpen && tab === 'history' && <HistoryView onOpenWorkout={() => setWorkoutOpen(true)} />}
        {!summaryOpen && tab === 'exercises' && <ExercisesView />}
        {!summaryOpen && tab === 'profile' && <ProfileView onOpenWorkout={() => setWorkoutOpen(true)} />}
      </main>

      {state.active && !workoutOpen && <MiniBar onOpen={() => setWorkoutOpen(true)} />}
      {!state.active && <IntervalBar onTabs />}

      <nav className="tabbar" aria-label="Hovedmenu">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => {
              if (summaryOpen) dispatch({ type: 'CLOSE_SUMMARY' });
              if (t.id !== tab) clearUndo();
              setTab(t.id);
            }}>
            <span aria-hidden>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {showWorkout && <ActiveWorkout onMinimize={() => setWorkoutOpen(false)} />}
      {state.editing && <WorkoutEditor />}
      <UndoBar inWorkout={showWorkout || !!state.editing} />
    </div>
  );
}

function MiniBar({ onOpen }: { onOpen: () => void }) {
  const { state } = useStore();
  const now = useNow();
  if (!state.active) return null;
  return (
    <button className="minibar" onClick={onOpen}>
      <strong>{state.active.name}</strong>
      <span>{formatDuration(workoutDuration(state.active, now))}</span>
    </button>
  );
}

/** Sætter `data-theme` på <html>; "Følg telefonen" følger telefonens lys/mørk-indstilling live (#293). */
function useTheme(theme: Theme | undefined) {
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    const apply = () => {
      const root = document.documentElement;
      root.dataset.theme = resolveTheme(theme, !!mq?.matches);
      // Statuslinjen på telefonen får samme farve som baggrunden (#294)
      const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
      if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
    };
    apply();
    if (theme !== 'system' || !mq) return;
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

/** Sætter `data-text="large"` på <html>, når "Stor tekst" er slået til (#295). */
function useLargeText(on: boolean | undefined) {
  useEffect(() => {
    const root = document.documentElement;
    if (on) root.dataset.text = 'large';
    else delete root.dataset.text;
  }, [on]);
}
