import { useState } from "react";
import {
  formatKg,
  newRecordsInMonth,
  recordsWall,
  type RecordsWallRow,
} from "../lib/logic";
import { useStore } from "../lib/store";
import { MUSCLES, type Muscle } from "../lib/types";
import { ExerciseDetail } from "../views/ExercisesView";
import { Chips, Empty } from "./ui";

const SHOW_FIRST = 10;
const date = new Intl.DateTimeFormat("da-DK", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** De bedste resultater for en øvelse som korte linjer ("Tungeste: 100 kg") */
export function recordLines(r: RecordsWallRow): string[] {
  const lines: string[] = [];
  if (r.heaviest) lines.push(`Tungeste: ${formatKg(r.heaviest.weight)}`);
  if (r.best1RM) lines.push(`1RM: ${formatKg(r.best1RM.value)}`);
  if (r.bestVolume)
    lines.push(
      `Bedste sæt: ${formatKg(r.bestVolume.weight)} × ${r.bestVolume.reps}`,
    );
  else if (r.mostReps) lines.push(`Flest reps: ${r.mostReps.reps}`);
  if (r.longestHold) lines.push(`Længste hold: ${r.longestHold.seconds} sek.`);
  if (r.longestDistance)
    lines.push(
      `Længste distance: ${String(r.longestDistance.meters).replace(".", ",")} m`,
    );
  return lines;
}

/** "Rekorder" i Profil (#163): dine bedste resultater for hver øvelse, nyeste først */
export function RecordsWall() {
  const { state } = useStore();
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [all, setAll] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = state.exercises.find((e) => e.id === openId);
  const newThisMonth = newRecordsInMonth(state, Date.now());
  const rows = recordsWall(state, muscle ?? undefined);
  const shown = all ? rows : rows.slice(0, SHOW_FIRST);

  return (
    <section aria-label="Rekorder">
      <h2 className="section">🏆 Rekorder</h2>
      {!state.history.length ? (
        <Empty>Log en træning for at se dine rekorder</Empty>
      ) : (
        <>
          {newThisMonth > 0 && (
            <p className="rw-month" data-testid="records-this-month">
              🏆{" "}
              {newThisMonth === 1
                ? "1 ny rekord denne måned"
                : `${newThisMonth} nye rekorder denne måned`}
            </p>
          )}
          <Chips
            options={MUSCLES}
            value={muscle}
            onChange={setMuscle}
            label="Filtrér rekorder efter muskelgruppe"
          />
          {!rows.length ? (
            <Empty>Ingen rekorder for {muscle} endnu</Empty>
          ) : (
            <ul className="card records-wall">
              {shown.map((r) => (
                <li key={r.exerciseId} aria-label={r.name}>
                  <button
                    className="rw-row"
                    aria-label={`Åbn ${r.name}`}
                    onClick={() => setOpenId(r.exerciseId)}
                  >
                    <span className="rw-head">
                      <strong>{r.name}</strong>
                      <small className="muted">{date.format(r.latest)}</small>
                    </span>
                    <span className="rw-lines">
                      {recordLines(r).map((l) => (
                        <span key={l}>{l}</span>
                      ))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {rows.length > SHOW_FIRST && (
            <button className="btn-ghost small" onClick={() => setAll(!all)}>
              {all ? "Vis færre" : `Vis alle (${rows.length})`}
            </button>
          )}
        </>
      )}
      {open && <ExerciseDetail ex={open} onClose={() => setOpenId(null)} />}
    </section>
  );
}
