import { useState } from 'react';
import { formatDuration } from './lib/logic';
import { useNow, useStore } from './lib/store';
import { ActiveWorkout } from './views/ActiveWorkout';
import { ExercisesView } from './views/ExercisesView';
import { HistoryView } from './views/HistoryView';
import { ProfileView } from './views/ProfileView';
import { StartView } from './views/StartView';

type Tab = 'start' | 'history' | 'exercises' | 'profile';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'start', label: 'Træning', icon: '＋' },
  { id: 'history', label: 'Historik', icon: '🕘' },
  { id: 'exercises', label: 'Øvelser', icon: '🏋️' },
  { id: 'profile', label: 'Profil', icon: '👤' },
];

export default function App() {
  const { state } = useStore();
  const [tab, setTab] = useState<Tab>('start');
  const [workoutOpen, setWorkoutOpen] = useState(true);
  const showWorkout = !!state.active && workoutOpen;

  return (
    <div className="app">
      <main>
        {tab === 'start' && <StartView onOpenWorkout={() => setWorkoutOpen(true)} />}
        {tab === 'history' && <HistoryView />}
        {tab === 'exercises' && <ExercisesView />}
        {tab === 'profile' && <ProfileView />}
      </main>

      {state.active && !workoutOpen && <MiniBar onOpen={() => setWorkoutOpen(true)} />}

      <nav className="tabbar" aria-label="Hovedmenu">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            <span aria-hidden>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {showWorkout && <ActiveWorkout onMinimize={() => setWorkoutOpen(false)} />}
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
      <span>{formatDuration(now - state.active.startedAt)}</span>
    </button>
  );
}
