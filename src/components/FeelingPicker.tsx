import type { Energy, Workout } from '../lib/types';
import { useStore } from '../lib/store';
import { ENERGY_NAMES as ENERGY_LABEL, FEELING_EMOJIS as FEELING_EMOJI } from '../lib/logic';

/** "Hvordan føltes det?" med fem knapper og "Energi før" (#382). Tryk igen på det valgte for at rydde. */
export function FeelingPicker({ workout, edit }: { workout: Workout; edit?: boolean }) {
  const { dispatch } = useStore();
  // edit (#383): ændrer kladden, når en afsluttet træning rettes, så "Annullér" også fortryder vurderingen
  const set = (patch: { feeling?: number | null; energy?: Energy | null }) =>
    dispatch(edit ? { type: 'SET_WORKOUT_FEELING', ...patch, edit: true } : { type: 'SET_WORKOUT_FEELING', workoutId: workout.id, ...patch });
  return (
    <section className="card feeling-picker" aria-label="Hvordan føltes det?">
      <h2>Hvordan føltes det?</h2>
      <div className="feeling-row" role="group" aria-label="Vurdering">
        {FEELING_EMOJI.map((emoji, i) => {
          const value = i + 1;
          const on = workout.feeling === value;
          return (
            <button
              key={value}
              type="button"
              className={`feeling-btn${on ? ' on' : ''}`}
              aria-label={`Føltes ${value} af 5`}
              aria-pressed={on}
              onClick={() => set({ feeling: on ? null : value })}
            >
              <span aria-hidden>{emoji}</span>
            </button>
          );
        })}
      </div>
      <div className="feeling-energy" role="group" aria-label="Energi før">
        <span className="muted">Energi før:</span>
        {(Object.keys(ENERGY_LABEL) as Energy[]).map((e) => {
          const on = workout.energy === e;
          return (
            <button key={e} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => set({ energy: on ? null : e })}>
              {ENERGY_LABEL[e]}
            </button>
          );
        })}
      </div>
    </section>
  );
}
