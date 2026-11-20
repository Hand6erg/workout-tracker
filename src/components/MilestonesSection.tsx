import { milestoneProgressText, milestones, milestoneTileLabel } from '../lib/logic';
import { useStore } from '../lib/store';

const date = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });

/** "Milepæle" i Profil (#183): alle badges, låst op i farver, låste grå med fremskridt */
export function MilestonesSection() {
  const { state } = useStore();
  const ms = milestones(state);
  const unlocked = ms.filter((m) => m.unlockedAt !== null).length;
  return (
    <section id="milepaele" aria-label="Milepæle">
      <h2 className="section">🎖️ Milepæle</h2>
      <p className="muted ms-count" data-testid="milestones-count">
        {unlocked} af {ms.length} låst op
      </p>
      <ul className="milestones">
        {ms.map((m) => {
          const on = m.unlockedAt !== null;
          return (
            <li key={m.id} className={`ms-tile${on ? ' on' : ''}`} aria-label={milestoneTileLabel(m)}>
              <span className="ms-icon" aria-hidden>
                {m.icon}
              </span>
              <strong className="ms-label">{m.label}</strong>
              <small className="muted">{on ? date.format(m.unlockedAt!) : milestoneProgressText(m)}</small>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
