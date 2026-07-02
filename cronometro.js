import { db } from './firebase-init.js';
import {
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const ROUND_DURATION = 150;
const display = document.getElementById('officialTimerDisplay');
const status = document.getElementById('officialTimerStatus');

let timerState = {
  seconds: ROUND_DURATION,
  running: false,
  targetEndAt: null
};

const soundState = { lastSecond: null, warned30: false, finished: false };
let audioCtx = null;
let soundEnabled = true;

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) audioCtx = new AudioContextClass();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(frequency = 880, duration = 0.16, delay = 0, volume = 0.18) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'suspended') return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime + delay;
  const end = start + duration;

  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(end + 0.03);
}

function playWarningSound() {
  playTone(920, 0.12, 0, 0.14);
}

function playThirtySecondsWarning() {
  playTone(740, 0.18, 0, 0.16);
  playTone(740, 0.18, 0.24, 0.16);
}

function playFinishedSound() {
  playTone(520, 0.26, 0, 0.2);
  playTone(520, 0.26, 0.32, 0.2);
  playTone(520, 0.42, 0.64, 0.22);
}

function handleTimerSound(remaining, running) {
  if (!running || remaining >= ROUND_DURATION) {
    soundState.lastSecond = remaining;
    soundState.warned30 = false;
    soundState.finished = false;
    return;
  }

  if (remaining !== soundState.lastSecond) {
    if (remaining === 30 && !soundState.warned30) {
      playThirtySecondsWarning();
      soundState.warned30 = true;
    }

    if (remaining <= 10 && remaining > 0) {
      playWarningSound();
    }

    if (remaining === 0 && !soundState.finished) {
      playFinishedSound();
      soundState.finished = true;
    }

    soundState.lastSecond = remaining;
  }
}

['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
  window.addEventListener(eventName, () => getAudioContext(), { once: true, passive: true });
});

function clampSeconds(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return ROUND_DURATION;
  return Math.max(0, Math.min(ROUND_DURATION, Math.round(n)));
}

function getRemainingSeconds() {
  if (!timerState.running || !timerState.targetEndAt) {
    return clampSeconds(timerState.seconds);
  }
  return clampSeconds(Math.ceil((Number(timerState.targetEndAt) - Date.now()) / 1000));
}

function formatSeconds(seconds) {
  const safe = clampSeconds(seconds);
  const m = String(Math.floor(safe / 60)).padStart(2, '0');
  const s = String(safe % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function renderTimer() {
  const remaining = getRemainingSeconds();
  display.textContent = formatSeconds(remaining);

  display.classList.toggle('danger', remaining <= 30 && remaining > 10);
  display.classList.toggle('critical', remaining <= 10 && remaining > 0);
  display.classList.toggle('finished', remaining === 0);

  handleTimerSound(remaining, !!timerState.running);

  if (remaining === 0) {
    status.textContent = 'Tempo encerrado';
    status.className = 'official-timer-status finished';
  } else if (timerState.running) {
    status.textContent = 'Em andamento';
    status.className = 'official-timer-status running';
  } else {
    status.textContent = 'Parado';
    status.className = 'official-timer-status paused';
  }
}

onSnapshot(doc(db, 'timers', 'global'), (snap) => {
  if (snap.exists()) {
    const data = snap.data();
    timerState = {
      seconds: clampSeconds(data.seconds),
      running: !!data.running,
      targetEndAt: data.targetEndAt || null
    };
  } else {
    timerState = {
      seconds: ROUND_DURATION,
      running: false,
      targetEndAt: null
    };
  }

  renderTimer();
});

setInterval(renderTimer, 250);
renderTimer();
