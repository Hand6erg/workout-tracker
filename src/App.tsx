import { useState } from 'react';
import { formatDuration, IS_STAGING, workoutDuration } from './lib/logic';
import { useRestAlerts } from './lib/alerts';
import { useWakeLock } from './lib/wakeLock';
import { useNow, useStore } from './lib/store';
import { ActiveWorkout, WorkoutEditor } from './views/ActiveWorkout';
import { ExercisesView } from './views/ExercisesView';
import { HistoryView } from './views/HistoryView';
import { ProfileView } from './views/ProfileView';
import { StartView } from './views/StartView';
import { SummaryView } from './views/SummaryView';

type Tab = 'start' | 'history' | 'exercises' | 'profile';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'start', label: 'Træning', icon: '＋' },
  { id: 'history', label: 'Historik', icon: '🕘' },
  { id: 'exercises', label: 'Øvelser', icon: '🏋️' },
  { id: 'profile', label: 'Profil', icon: '👤' },
];

export default function App() {
  const { state, dispatch } = useStore();
  const [tab, setTab] = useState<Tab>('start');
  const [workoutOpen, setWorkoutOpen] = useState(true);
  const showWorkout = !!state.active && workoutOpen;
  const summaryOpen = !!state.lastFinishedId && !state.active;
  useRestAlerts();
  useWakeLock();

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
          />
        )}
        {!summaryOpen && tab === 'start' && <StartView onOpenWorkout={() => setWorkoutOpen(true)} />}
        {!summaryOpen && tab === 'history' && <HistoryView onOpenWorkout={() => setWorkoutOpen(true)} />}
        {!summaryOpen && tab === 'exercises' && <ExercisesView />}
        {!summaryOpen && tab === 'profile' && <ProfileView />}
      </main>

      {state.active && !workoutOpen && <MiniBar onOpen={() => setWorkoutOpen(true)} />}

      <nav className="tabbar" aria-label="Hovedmenu">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => {
              if (summaryOpen) dispatch({ type: 'CLOSE_SUMMARY' });
              setTab(t.id);
            }}>
            <span aria-hidden>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {showWorkout && <ActiveWorkout onMinimize={() => setWorkoutOpen(false)} />}
      {state.editing && <WorkoutEditor />}
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
