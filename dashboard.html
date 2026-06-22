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
