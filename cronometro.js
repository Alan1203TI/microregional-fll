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

// Sirene final em MP3.
// Salve o arquivo em: assets/audio/sirene.mp3
const finalSirenAudio = new Audio('./assets/audio/sirene.mp3');
finalSirenAudio.preload = 'auto';
finalSirenAudio.volume = 1.0;

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) audioCtx = new AudioContextClass();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function connectLoudChain(ctx) {
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-30, ctx.currentTime);
  compressor.knee.setValueAtTime(8, ctx.currentTime);
  compressor.ratio.setValueAtTime(12, ctx.currentTime);
  compressor.attack.setValueAtTime(0.003, ctx.currentTime);
  compressor.release.setValueAtTime(0.18, ctx.currentTime);
  compressor.connect(ctx.destination);
  return compressor;
}

function playTone(frequency = 880, duration = 0.16, delay = 0, volume = 0.55, type = 'square') {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'suspended') return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime + delay;
  const end = start + duration;

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.min(volume, 0.95), start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.connect(gain);
  gain.connect(connectLoudChain(ctx));
  osc.start(start);
  osc.stop(end + 0.04);
}

function playWarningSound() {
  // Bipe alto nos últimos segundos
  playTone(1150, 0.18, 0, 0.72, 'square');
}

function playThirtySecondsWarning() {
  // Dois avisos fortes aos 30 segundos
  playTone(820, 0.25, 0, 0.68, 'square');
  playTone(820, 0.25, 0.34, 0.68, 'square');
}

function playSirenLayer(startDelay = 0, baseFreq = 520, peakFreq = 1250, duration = 3.8, volume = 0.92) {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'suspended') return;

  const start = ctx.currentTime + startDelay;
  const end = start + duration;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.04);

  // Sirene tipo alarme: sobe/desce várias vezes, bem perceptível em TV/caixa de som.
  for (let t = 0; t <= duration; t += 0.38) {
    osc.frequency.linearRampToValueAtTime(peakFreq, start + t + 0.19);
    osc.frequency.linearRampToValueAtTime(baseFreq, Math.min(end, start + t + 0.38));
  }

  gain.gain.setValueAtTime(volume, end - 0.18);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.connect(gain);
  gain.connect(connectLoudChain(ctx));
  osc.start(start);
  osc.stop(end + 0.06);
}

function playFinishedSound() {
  if (!soundEnabled) return;

  // Toca a sirene em MP3. Salve o arquivo em: assets/audio/sirene.mp3
  // Importante: o navegador só libera áudio depois de algum clique/toque na página.
  try {
    finalSirenAudio.pause();
    finalSirenAudio.currentTime = 0;
    finalSirenAudio.volume = 1.0;

    const playPromise = finalSirenAudio.play();

    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Reserva: se o MP3 não carregar ou for bloqueado, toca a sirene gerada pelo navegador.
        playSirenLayer(0, 500, 1250, 4.2, 0.95);
        playSirenLayer(0.04, 760, 1580, 4.0, 0.65);
        playTone(420, 0.35, 4.25, 0.85, 'square');
        playTone(420, 0.35, 4.68, 0.85, 'square');
      });
    }
  } catch (error) {
    playSirenLayer(0, 500, 1250, 4.2, 0.95);
    playSirenLayer(0.04, 760, 1580, 4.0, 0.65);
    playTone(420, 0.35, 4.25, 0.85, 'square');
    playTone(420, 0.35, 4.68, 0.85, 'square');
  }
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
  window.addEventListener(eventName, () => { getAudioContext(); finalSirenAudio.load(); }, { once: true, passive: true });
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
