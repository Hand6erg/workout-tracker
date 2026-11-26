import { cleanTrainingDays } from "../lib/logic";
import { useStore } from "../lib/store";

export const DAY_SHORT = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
export const DAY_LONG = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

/** "Træningsdage" i Profil (#323): vælg de ugedage, du plejer at træne */
export function TrainingDaysSection() {
  const { state, dispatch } = useStore();
  const days = cleanTrainingDays(state.trainingDays);
  const toggle = (d: number) =>
    dispatch({
      type: "SET_TRAINING_DAYS",
      days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d],
    });
  return (
    <section aria-label="Træningsdage">
      <h2 className="section">Træningsdage</h2>
      <p className="muted small-print">
        Vælg de dage, du plejer at træne. Hviledage er en del af planen.
      </p>
      <div className="seg week-days" role="group" aria-label="Ugedage">
        {DAY_SHORT.map((label, d) => (
          <button
            key={d}
            type="button"
            aria-pressed={days.includes(d)}
            aria-label={DAY_LONG[d]}
            onClick={() => toggle(d)}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
