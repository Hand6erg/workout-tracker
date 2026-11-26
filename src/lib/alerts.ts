import { useEffect, useRef } from 'react';
import { intervalCues, restAlertDue, type IntervalCueKind, type RestAlert, type RestAlertsFired } from './logic';
import { useStore } from './store';

/* Pausealarm (#80): vibration og bip med browserens egne funktioner. Gør ingenting, hvor de ikke findes. */

type AudioCtor = typeof AudioContext;
let audio: AudioContext | null = null;

function getAudio(): AudioContext | null {
  if (audio) return audio;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    audio = new Ctor();
  } catch {
    audio = null;
  }
  return audio;
}

/** Telefoner tillader kun lyd efter et tryk – så vi "låser lyden op" ved første tryk i appen. */
export function unlockAudio() {
  const ctx = getAudio();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch {
    /* ikke understøttet */
  }
}

export function beep(freq = 880, seconds = 0.5) {
  const ctx = getAudio();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + seconds + 0.05);
  } catch {
    /* ikke understøttet */
  }
}

const STALE_MS = 5000;
export const WARNING_VIBRATION = 200;
export const DONE_VIBRATION = [300, 150, 300, 150, 500];

export function playRestAlert(alert: RestAlert, opts: { sound: boolean; vibrate: boolean }) {
  if (alert === 'warning') {
    if (opts.vibrate) vibrate(WARNING_VIBRATION);
    return;
  }
  if (opts.vibrate) vibrate(DONE_VIBRATION);
  if (opts.sound) beep();
}

/** Holder øje med pausetimeren og giver advarsel (10 s før) og alarm (ved 0), mens appen er åben. */
export function useRestAlerts() {
  const { state } = useStore();
  const fired = useRef<RestAlertsFired | null>(null);
  const settings = useRef({ sound: state.restSound, vibrate: state.restVibrate });
  settings.current = { sound: state.restSound, vibrate: state.restVibrate };
  const rest = state.rest;

  useEffect(() => {
    const onTap = () => unlockAudio();
    window.addEventListener('pointerdown', onTap, { once: true });
    return () => window.removeEventListener('pointerdown', onTap);
  }, []);

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      const r = restAlertDue(rest, now, fired.current);
      fired.current = r.fired;
      // En pause, der sluttede for længe siden (fx app genåbnet), giver ingen alarm.
      const stale = rest && now - rest.endsAt > STALE_MS;
      if (r.alert && !stale) playRestAlert(r.alert, settings.current);
    };
    check();
    if (!rest) return;
    const t = setInterval(check, 250);
    return () => clearInterval(t);
  }, [rest]);
}

/** Bip og vibration for intervaltimeren (#330) – samme lyd- og vibrationsindstillinger som pausealarmen */
export function playIntervalCue(kind: IntervalCueKind, opts: { sound: boolean; vibrate: boolean }) {
  if (kind === 'count') {
    if (opts.vibrate) vibrate(80);
    if (opts.sound) beep(660, 0.15);
  } else if (kind === 'phase') {
    if (opts.vibrate) vibrate(300);
    if (opts.sound) beep(990, 0.4);
  } else {
    if (opts.vibrate) vibrate(DONE_VIBRATION);
    if (opts.sound) beep(880, 1.2);
  }
}

/** Giver intervaltimerens bip (3-2-1, faseskift, slut), mens den kører. Gamle bip (fx efter skærm slukket) springes over. */
export function useIntervalCues() {
  const { state } = useStore();
  const settings = useRef({ sound: state.restSound, vibrate: state.restVibrate });
  settings.current = { sound: state.restSound, vibrate: state.restVibrate };
  const run = state.interval;

  useEffect(() => {
    if (!run) return;
    let prev = Date.now();
    const t = setInterval(() => {
      const now = Date.now();
      for (const cue of intervalCues(run.config, run.startedAt, prev, now)) {
        if (now - (run.startedAt + cue.at * 1000) <= STALE_MS) playIntervalCue(cue.kind, settings.current);
      }
      prev = now;
    }, 200);
    return () => clearInterval(t);
  }, [run]);
}
