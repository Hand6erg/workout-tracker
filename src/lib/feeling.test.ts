import { describe, expect, it } from 'vitest';
import { feelingInsights, feelingLine, feelingTrend, toCsv, initialState, loadState, reducer, startOfWeek, stampChanges } from './logic';
import type { AppState, Workout } from './types';

const DAY = 86_400_000;
const T0 = new Date('2026-11-16T10:00:00').getTime(); // mandag

function wk(id: string, startedAt: number, feeling?: number): Workout {
  return { id, name: 'Træning', startedAt, finishedAt: startedAt + 3_600_000, exercises: [], ...(feeling ? { feeling } : {}) };
}

function withHistory(history: Workout[]): AppState {
  return { ...initialState(), history };
}

describe('SET_WORKOUT_FEELING (#381)', () => {
  it('sætter og rydder vurdering og energi på en afsluttet træning', () => {
    let s = withHistory([wk('a', T0)]);
    s = reducer(s, { type: 'SET_WORKOUT_FEELING', workoutId: 'a', feeling: 4, energy: 'high' });
    expect(s.history[0]).toMatchObject({ feeling: 4, energy: 'high' });
    s = reducer(s, { type: 'SET_WORKOUT_FEELING', workoutId: 'a', feeling: null });
    expect('feeling' in s.history[0]).toBe(false);
    expect(s.history[0].energy).toBe('high');
    s = reducer(s, { type: 'SET_WORKOUT_FEELING', workoutId: 'a', energy: null });
    expect('energy' in s.history[0]).toBe(false);
  });

  it('ignorerer ugyldige værdier', () => {
    const s = withHistory([wk('a', T0, 3)]);
    for (const feeling of [0, 6, 2.5, 'x' as unknown as number]) {
      expect(reducer(s, { type: 'SET_WORKOUT_FEELING', workoutId: 'a', feeling })).toBe(s);
    }
    expect(reducer(s, { type: 'SET_WORKOUT_FEELING', workoutId: 'a', energy: 'x' as never })).toBe(s);
    expect(reducer(s, { type: 'SET_WORKOUT_FEELING', workoutId: 'nope', feeling: 2 })).toBe(s);
  });

  it('virker på den aktive træning og på kladden', () => {
    let s = reducer(initialState(), { type: 'START_WORKOUT', now: T0 });
    s = reducer(s, { type: 'SET_WORKOUT_FEELING', feeling: 5 });
    expect(s.active?.feeling).toBe(5);
    s = reducer(s, { type: 'SET_WORKOUT_FEELING', workoutId: s.active!.id, energy: 'low' });
    expect(s.active?.energy).toBe('low');

    let h = withHistory([wk('a', T0, 2)]);
    h = reducer(h, { type: 'EDIT_WORKOUT', workoutId: 'a' });
    h = reducer(h, { type: 'SET_WORKOUT_FEELING', feeling: 3, edit: true });
    expect(h.editing?.feeling).toBe(3);
    expect(h.history[0].feeling).toBe(2);
  });

  it('en ændret vurdering får et tidsstempel til fletning', () => {
    const prev = withHistory([wk('a', T0)]);
    const next = stampChanges(prev, reducer(prev, { type: 'SET_WORKOUT_FEELING', workoutId: 'a', feeling: 4 }), T0 + 5);
    expect(next.history[0].updatedAt).toBe(T0 + 5);
  });

  it('gamle data uden felterne indlæses uændret', () => {
    const old = { ...initialState(), history: [wk('a', T0)] };
    const s = loadState(JSON.stringify(old));
    expect(s.history[0].feeling).toBeUndefined();
    expect(s.history[0].energy).toBeUndefined();
    expect(feelingTrend(s.history, 4, T0)).toHaveLength(4);
  });
});

describe('feelingTrend (#381)', () => {
  it('giver gennemsnit pr. uge med tomme uger som null', () => {
    const now = T0 + 2 * DAY;
    const history = [wk('a', T0, 4), wk('b', T0 + DAY, 5), wk('c', T0 - 14 * DAY, 2), wk('d', T0 - 7 * DAY)];
    const t = feelingTrend(history, 3, now);
    expect(t.map((x) => x.weekStart)).toEqual([startOfWeek(T0 - 14 * DAY), startOfWeek(T0 - 7 * DAY), startOfWeek(T0)]);
    expect(t.map((x) => x.avg)).toEqual([2, null, 4.5]);
    expect(t.map((x) => x.count)).toEqual([1, 0, 2]);
  });
});

describe('feelingInsights (#381)', () => {
  const at = (day: number, hour: number) => {
    const d = new Date(T0 + day * DAY);
    d.setHours(hour, 0, 0, 0);
    return d.getTime();
  };

  it('kræver mindst 8 vurderede træninger', () => {
    const history = Array.from({ length: 7 }, (_, i) => wk(`w${i}`, at(i * 2, i < 4 ? 8 : 19), i < 4 ? 5 : 2));
    expect(feelingInsights(history)).toEqual([]);
  });

  it('finder den bedste tid på dagen', () => {
    // Hver dag: morgen = 5, aften = 2 – ingen forskel på hvile
    const history = Array.from({ length: 10 }, (_, i) => wk(`w${i}`, at(i, i % 2 ? 8 : 19), i % 2 ? 5 : 2));
    expect(feelingInsights(history)).toEqual(['Dine bedste træninger er om morgenen']);
  });

  it('finder at hviledage hjælper', () => {
    // Skiftevis 3 dages pause (føles 5) og dagen efter (føles 2), samme tidspunkt
    const history: Workout[] = [];
    let day = 0;
    for (let i = 0; i < 10; i++) {
      day += i % 2 ? 1 : 3;
      history.push(wk(`w${i}`, at(day, 17), i % 2 ? 2 : 5));
    }
    expect(feelingInsights(history)).toEqual(['Efter 2+ hviledage føles det bedre']);
  });

  it('intet tip uden en tydelig forskel', () => {
    const history = Array.from({ length: 10 }, (_, i) => wk(`w${i}`, at(i * 2, i % 2 ? 8 : 19), i % 3 ? 4 : 3));
    expect(feelingInsights(history)).toEqual([]);
  });
});

describe('vurdering i Historik og eksport (#383)', () => {
  it('feelingLine viser emoji og energi, tom uden vurdering', () => {
    expect(feelingLine({ feeling: 4, energy: 'high' })).toBe('💪 · Energi: høj');
    expect(feelingLine({ feeling: 1 })).toBe('😫');
    expect(feelingLine({ energy: 'low' })).toBe('Energi: lav');
    expect(feelingLine({})).toBe('');
  });

  it('CSV har kolonnerne "Følelse" og "Energi"', () => {
    const base = initialState();
    const ex = base.exercises[0].id;
    const w: Workout = {
      ...wk('a', T0, 5),
      energy: 'normal',
      exercises: [{ id: 'e1', exerciseId: ex, sets: [{ id: 's1', weight: '50', reps: '5', rpe: '', done: true }] }],
    };
    const lines = toCsv({ ...base, history: [w, { ...w, id: 'b', feeling: undefined, energy: undefined }] }).split('\n');
    expect(lines[0].split(',').slice(-2)).toEqual(['Følelse', 'Energi']);
    expect(lines.slice(1).map((l) => l.split(',').slice(-2).join('|'))).toEqual(['|', '5|Normal']);
  });

  it('rettelse af vurderingen i kladden gemmes først ved "Gem"', () => {
    let s = withHistory([{ ...wk('a', T0, 2), exercises: [] }]);
    s = reducer(s, { type: 'EDIT_WORKOUT', workoutId: 'a' });
    s = reducer(s, { type: 'SET_WORKOUT_FEELING', feeling: 5, energy: 'high', edit: true });
    expect(s.history[0].feeling).toBe(2);
    expect(s.editing?.feeling).toBe(5);
    expect(reducer(s, { type: 'CANCEL_EDIT' }).history[0].feeling).toBe(2);
  });
});
