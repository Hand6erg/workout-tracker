import { cleanTrainingDays, weekPlan, weekPlanNudge } from "../lib/logic";
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

const DAY_LETTER = ["M", "T", "O", "T", "F", "L", "S"];

function dayLabel(d: { day: number; planned: boolean; done: boolean; today: boolean }) {
  const status = d.planned
    ? d.done ? "planlagt, trænet" : "planlagt, ikke trænet"
    : d.done ? "ikke planlagt, trænet" : "hviledag";
  return `${DAY_LONG[d.day]}${d.today ? " (i dag)" : ""}: ${status}`;
}

/** Ugeplan på startskærmen (#324): dagens plan, ugestrimmel og "x af y" */
export function WeekPlanCard() {
  const { state } = useStore();
  const plan = weekPlan(state, Date.now());
  if (!plan.plannedCount) return null;
  const nudge = weekPlanNudge(plan);
  return (
    <section className="card week-plan" aria-label="Ugeplan">
      <h2>{plan.todayIsTrainingDay ? "I dag: træningsdag 💪" : "I dag: hviledag 😴"}</h2>
      <ol className="week-strip" aria-label="Denne uge">
        {plan.days.map((d) => (
          <li
            key={d.day}
            className={[d.planned && "planned", d.done && "done", d.today && "today"].filter(Boolean).join(" ")}
            aria-label={dayLabel(d)}
          >
            <span aria-hidden="true">{DAY_LETTER[d.day]}</span>
          </li>
        ))}
      </ol>
      <p className="muted">
        {Math.min(plan.doneCount, plan.plannedCount)} af {plan.plannedCount} planlagte træninger denne uge
      </p>
      {nudge && (
        <p className="week-nudge">
          Du mangler {nudge.missing} {nudge.missing === 1 ? "træning" : "træninger"} – du har{" "}
          {nudge.daysAvailable} {nudge.daysAvailable === 1 ? "dag" : "dage"} tilbage
        </p>
      )}
    </section>
  );
}
