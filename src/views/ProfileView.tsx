import { useRef, useState } from 'react';
import { AccountSection } from '../components/AccountSection';
import { playRestAlert } from '../lib/alerts';
import { wakeLockSupported } from '../lib/wakeLock';
import { BarChart } from '../components/BarChart';
import { BodySection } from '../components/BodySection';
import { ProgramSection } from '../components/ProgramSection';
import { RecordsWall } from '../components/RecordsWall';
import { ProfileGoals } from '../components/GoalsSection';
import { MostLifted } from '../components/MostLifted';
import { BalanceCard } from '../components/BalanceCard';
import { MilestonesSection } from '../components/MilestonesSection';
import { YearHeatmap } from '../components/YearHeatmap';
import { SetTargetsSection } from '../components/SetTargets';
import { TrainingDaysSection } from '../components/TrainingDays';
import { ConfirmButton, Empty } from '../components/ui';
import {
  BAR_OPTIONS_KG,
  BAR_OPTIONS_LB,
  bodyToCsv,
  fromDisplay,
  plateSetup,
  weightInputText,
  formatWeight,
  num,
  initialState,
  loadState,
  muscleDistribution,
  THEMES,
  toCsv,
  weekStreak,
  weeklyVolume,
  withLoads,
  workoutVolume,
} from '../lib/logic';
import { useStore, useUnit } from '../lib/store';

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ProfileView({ onOpenWorkout }: { onOpenWorkout?: () => void } = {}) {
  const unit = useUnit();
  const { state, dispatch, account } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const total = state.history.reduce((a, w) => a + workoutVolume(withLoads(state, w)), 0);
  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <div className="page">
      <h1>Profil</h1>
      <div className="kpis">
        <div>
          <small>Træninger</small>
          <strong data-testid="total-workouts">{state.history.length}</strong>
        </div>
        <div>
          <small>Samlet løftet</small>
          <strong>{formatWeight(total, unit)}</strong>
        </div>
      </div>

      <StreakCard />
      <YearHeatmap onOpenWorkout={onOpenWorkout} />
      <WeeklyVolume />
      <MuscleSplit />
      <BalanceCard />
      <TrainingDaysSection />
      <SetTargetsSection />
      <ProfileGoals />
      <RecordsWall />
      <MostLifted />
      <MilestonesSection />
      <BodySection />
      <ProgramSection />

      <h2 className="section">Indstillinger</h2>
      <div className="theme-setting">
        <span id="theme-label">Tema</span>
        <div className="seg" role="group" aria-labelledby="theme-label">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={(state.theme ?? 'dark') === t.id}
              onClick={() => dispatch({ type: 'SET_THEME', theme: t.id })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="theme-setting">
        <span id="unit-label">Enhed</span>
        <div className="seg" role="group" aria-labelledby="unit-label">
          {(['kg', 'lb'] as const).map((u) => (
            <button key={u} type="button" aria-pressed={state.unit === u} onClick={() => dispatch({ type: 'SET_UNIT', unit: u })}>
              {u}
            </button>
          ))}
        </div>
        <p className="muted unit-note">Dine sæt gemmes altid i kg, så du kan skifte frem og tilbage uden at ændre din log.</p>
      </div>
      <label className="toggle">
        <input
          type="checkbox"
          checked={state.largeText === true}
          onChange={(e) => dispatch({ type: 'SET_LARGE_TEXT', on: e.target.checked })}
        />
        Stor tekst (større felter og knapper i træningen)
      </label>
      <label className="field">
        Pausetimer efter hvert sæt (sekunder, 0 = slået fra)
        <input
          type="number"
          min={0}
          max={600}
          step={15}
          value={state.restSeconds}
          onChange={(e) => dispatch({ type: 'SET_REST_SECONDS', seconds: Number(e.target.value) })}
        />
      </label>
      <p className="muted rest-global-note">Øvelser kan have deres egen pausetid – vælg den under Øvelser eller med ⏱ på øvelsen i træningen.</p>

      <div className="rest-alert-settings" role="group" aria-label="Signal når pausen er slut">
        <label className="toggle">
          <input
            type="checkbox"
            checked={state.restSound}
            onChange={(e) => dispatch({ type: 'SET_REST_SOUND', on: e.target.checked })}
          />
          Lyd når pausen er slut
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={state.restVibrate}
            onChange={(e) => dispatch({ type: 'SET_REST_VIBRATE', on: e.target.checked })}
          />
          Vibration når pausen er slut
        </label>
        <button
          type="button"
          className="btn-ghost small"
          aria-label="Test pausesignal"
          disabled={!state.restSound && !state.restVibrate}
          onClick={() => playRestAlert('done', { sound: state.restSound, vibrate: state.restVibrate })}
        >
          🔔 Test
        </button>
      </div>

      <label className="toggle">
        <input
          type="checkbox"
          checked={state.keepAwake}
          onChange={(e) => dispatch({ type: 'SET_KEEP_AWAKE', on: e.target.checked })}
        />
        Hold skærmen tændt under træning
      </label>

      <label className="toggle">
        <input
          type="checkbox"
          checked={state.showRpe !== false}
          onChange={(e) => dispatch({ type: 'SET_SHOW_RPE', on: e.target.checked })}
        />
        Vis RPE-felt (hvor hårdt sættet føltes, 6–10)
      </label>

      <label className="toggle">
        <input
          type="checkbox"
          checked={state.showTimeLeft !== false}
          onChange={(e) => dispatch({ type: 'SET_SHOW_TIME_LEFT', on: e.target.checked })}
        />
        Vis tid tilbage i træningen
      </label>
      {!wakeLockSupported() && <p className="muted rest-global-note">Understøttes ikke i denne browser</p>}

      <label className="field">
        Mål: træninger pr. uge
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={7}
          value={state.weeklyGoal}
          onChange={(e) => dispatch({ type: 'SET_WEEKLY_GOAL', goal: Number(e.target.value) })}
        />
      </label>

      <label className="toggle">
        <input
          type="checkbox"
          checked={state.showHints}
          onChange={(e) => dispatch({ type: 'SET_SHOW_HINTS', on: e.target.checked })}
        />
        Vis forslag til næste vægt
      </label>

      <BodyWeightSetting />

      <BarSetting />

      <AccountSection />

      <h2 className="section">Data</h2>
      <p className="muted">
        {account
          ? 'Alt gemmes på denne enhed og online på din konto.'
          : 'Alt gemmes kun på denne enhed. Tag en backup, hvis du skifter telefon.'}
      </p>
      <div className="stack">
        <button className="btn-secondary" onClick={() => download(`loeft-${stamp}.csv`, toCsv(state), 'text/csv')}>
          Eksportér CSV
        </button>
        <button
          className="btn-secondary"
          onClick={() => download(`loeft-backup-${stamp}.json`, JSON.stringify(state), 'application/json')}
        >
          Tag backup (JSON)
        </button>
        {state.bodyLog.length > 0 && (
          <button className="btn-secondary" onClick={() => download(`kropsmaal-${stamp}.csv`, bodyToCsv(state), 'text/csv')}>
            Eksportér kropsmål (CSV)
          </button>
        )}
        <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
          Gendan backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const text = await f.text();
            const next = loadState(text);
            if (text && next.history.length === 0 && !text.includes('"version":1')) {
              setMsg('Filen kunne ikke læses.');
              return;
            }
            dispatch({ type: 'IMPORT_STATE', state: { ...next, active: null, rest: null } });
            setMsg(
              `Gendannet ${next.history.length} træninger` +
                (next.bodyLog.length ? ` og ${next.bodyLog.length} kropsmål.` : '.'),
            );
          }}
        />
        <ConfirmButton onConfirm={() => dispatch({ type: 'IMPORT_STATE', state: initialState() })}>
          Slet alle data
        </ConfirmButton>
      </div>
      {msg && <p role="status">{msg}</p>}
    </div>
  );
}

function WeeklyVolume() {
  const unit = useUnit();
  const { state } = useStore();
  const weeks = weeklyVolume(state, 8, Date.now());
  const current = weeks[weeks.length - 1];
  return (
    <section aria-label="Volumen pr. uge">
      <h2 className="section">Volumen pr. uge</h2>
      {!state.history.length ? (
        <Empty>Afslut en træning, så kan du følge din ugentlige volumen her.</Empty>
      ) : (
        <div className="card chart-card">
          <BarChart
            label={`Volumen pr. uge, de seneste ${weeks.length} uger. Denne uge: ${formatWeight(current.volume, unit)}`}
            bars={weeks.map((w, i) => ({ label: `u${w.week}`, value: w.volume, highlight: i === weeks.length - 1 }))}
          />
          <p className="muted">
            Denne uge: <strong>{formatWeight(current.volume, unit)}</strong>
          </p>
        </div>
      )}
    </section>
  );
}

function MuscleSplit() {
  const { state } = useStore();
  const [period, setPeriod] = useState<'4w' | 'all'>('4w');
  const since = period === 'all' ? 0 : Date.now() - 28 * 86_400_000;
  const shares = muscleDistribution(state, since);
  const total = shares.reduce((n, m) => n + m.sets, 0);
  const max = Math.max(1, ...shares.map((m) => m.sets));
  const avg = total / shares.length;

  return (
    <section aria-label="Muskelgrupper">
      <h2 className="section">Muskelgrupper</h2>
      <div className="seg" role="group" aria-label="Periode">
        <button aria-pressed={period === '4w'} onClick={() => setPeriod('4w')}>
          Sidste 4 uger
        </button>
        <button aria-pressed={period === 'all'} onClick={() => setPeriod('all')}>
          Alt
        </button>
      </div>
      {!total ? (
        <Empty>Ingen udførte sæt i perioden.</Empty>
      ) : (
        <ul className="card hbars">
          {shares.map((m) => {
            const low = m.sets < avg * 0.5;
            return (
              <li key={m.muscle} className={low ? 'low' : ''}>
                <span className="name">{m.muscle}</span>
                <span className="track" aria-hidden>
                  <span className="fill" style={{ width: `${(100 * m.sets) / max}%` }} />
                </span>
                <span className="num">
                  {m.sets} sæt{low && <small> · lidt</small>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {total > 0 && <p className="muted small-print">"Lidt" = under halvdelen af gennemsnittet for dine muskelgrupper.</p>}
    </section>
  );
}

function BodyWeightSetting() {
  const { state, dispatch } = useStore();
  const unit = useUnit();
  const stored = state.bodyWeight ?? null;
  // Vist i den valgte enhed (#347); gemmes altid i kg
  const shown = (kg: number | null) => (kg === null ? '' : weightInputText(String(kg), unit).replace('.', ','));
  const [text, setText] = useState(() => shown(stored));
  // Følg med, hvis værdien eller enheden ændres udefra (fx fletning fra en anden enhed)
  const [seen, setSeen] = useState({ stored, unit });
  if (seen.stored !== stored || seen.unit !== unit) {
    setSeen({ stored, unit });
    if (seen.unit !== unit || fromDisplay(num(text), unit) !== (stored ?? 0)) setText(shown(stored));
  }
  return (
    <>
      <label className="field">
        Kropsvægt ({unit})
        <input
          type="text"
          inputMode="decimal"
          placeholder="fx 80"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const v = num(e.target.value);
            dispatch({ type: 'SET_BODY_WEIGHT', kg: v > 0 ? fromDisplay(v, unit) : v });
          }}
        />
      </label>
      <p className="muted rest-global-note">Bruges til kropsvægtsøvelser, når du ikke har et kropsmål.</p>
    </>
  );
}

function BarSetting() {
  const { state, dispatch } = useStore();
  const unit = useUnit();
  const { bar } = plateSetup(state, unit);
  return (
    <section aria-label="Stang">
      <label className="field">
        Stangvægt
        <select value={bar} onChange={(e) => dispatch({ type: 'SET_BAR_WEIGHT', weight: Number(e.target.value) })}>
          {(unit === 'lb' ? BAR_OPTIONS_LB : BAR_OPTIONS_KG).map((w) => (
            <option key={w} value={w}>
              {w} {unit}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}

function StreakCard() {
  const { state } = useStore();
  const { weeks, thisWeek } = weekStreak(state, state.weeklyGoal, Date.now());
  const goal = state.weeklyGoal;
  return (
    <section className="card streak" aria-label="Stime">
      <strong className="streak-weeks">
        🔥 {weeks === 1 ? '1 uge' : `${weeks} uger`} i træk
      </strong>
      <span className="muted">
        {Math.min(thisWeek, goal)} af {goal} {goal === 1 ? 'træning' : 'træninger'} denne uge
        {thisWeek >= goal ? ' ✓' : ''}
      </span>
      <span className="streak-dots" aria-hidden>
        {Array.from({ length: goal }, (_, i) => (
          <span key={i} className={i < thisWeek ? 'on' : ''} />
        ))}
      </span>
    </section>
  );
}
