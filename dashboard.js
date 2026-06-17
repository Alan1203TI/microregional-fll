import { db } from './firebase-init.js';
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const ROUND_DURATION = 150;

const rankingEl = document.getElementById('ranking');
const roundsBody = document.getElementById('roundsBody');
const lastResult = document.getElementById('lastResult');
const liveScoreBox = document.getElementById('liveScoreBox');
const teamCount = document.getElementById('teamCount');
const timerDisplay = document.getElementById('timerDisplay');
const startTimer = document.getElementById('startTimer');
const pauseTimer = document.getElementById('pauseTimer');
const resetTimer = document.getElementById('resetTimer');

let timerState = {
  seconds: ROUND_DURATION,
  running: false,
  targetEndAt: null
};
let timerRenderInterval = null;

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return '';
  }
}

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

function clampSeconds(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return ROUND_DURATION;
  return Math.max(0, Math.min(ROUND_DURATION, Math.round(n)));
}

function getRemainingSeconds(state = timerState) {
  if (!state.running || !state.targetEndAt) {
    return clampSeconds(state.seconds);
  }

  const remaining = Math.ceil((Number(state.targetEndAt) - Date.now()) / 1000);
  return clampSeconds(remaining);
}

function formatSeconds(seconds) {
  const safe = clampSeconds(seconds);
  const m = String(Math.floor(safe / 60)).padStart(2, '0');
  const s = String(safe % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function renderTimer() {
  const remaining = getRemainingSeconds();
  timerDisplay.textContent = formatSeconds(remaining);
  timerDisplay.classList.toggle('danger', remaining <= 30 && remaining > 0);
  timerDisplay.classList.toggle('finished', remaining === 0);
}

function startLocalTimerRender() {
  clearInterval(timerRenderInterval);
  timerRenderInterval = setInterval(renderTimer, 250);
  renderTimer();
}

async function publishTimerState(nextState) {
  timerState = {
    ...timerState,
    ...nextState
  };

  renderTimer();

  await setDoc(doc(db, 'timer', 'current'), {
    ...timerState,
    updatedAt: serverTimestamp(),
    updatedAtLocal: new Date().toISOString()
  }, { merge: true });
}

async function startRoundTimer() {
  const remaining = getRemainingSeconds();
  const secondsToUse = remaining > 0 ? remaining : ROUND_DURATION;

  await publishTimerState({
    seconds: secondsToUse,
    running: true,
    targetEndAt: Date.now() + (secondsToUse * 1000)
  });
}

async function pauseRoundTimer() {
  const remaining = getRemainingSeconds();

  await publishTimerState({
    seconds: remaining,
    running: false,
    targetEndAt: null
  });
}

async function resetRoundTimer() {
  await publishTimerState({
    seconds: ROUND_DURATION,
    running: false,
    targetEndAt: null
  });
}

startTimer.onclick = startRoundTimer;
pauseTimer.onclick = pauseRoundTimer;
resetTimer.onclick = resetRoundTimer;

onSnapshot(doc(db, 'timer', 'current'), (snap) => {
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

startLocalTimerRender();

onSnapshot(doc(db, 'liveScores', 'current'), (snap) => {
  if (!snap.exists()) {
    liveScoreBox.innerHTML = 'Aguardando marcação do juiz...';
    return;
  }

  const live = snap.data();
  const width = Math.max(0, Math.min(100, ((live.score || 0) / 470) * 100));
  const roundLabel = live.round === 'TESTE' ? 'TESTE' : `ROUND ${live.round}`;
  const statusLabel = live.status === 'saved' ? 'Resultado salvo' : 'Juiz marcando agora';

  liveScoreBox.innerHTML = `
    <div class="live-team-name">${live.teamName || 'Equipe não selecionada'}</div>
    <div class="live-score-number">${live.score || 0}</div>
    <div class="live-score-label">PONTOS</div>
    <div class="live-meta">
      <strong>${roundLabel}</strong>
      <span>${statusLabel}</span>
    </div>
    <div class="score-bar live-progress"><i style="width:${width}%"></i></div>
    <p>Juiz: ${live.judge || 'não informado'} • Atualizado ${fmtTime(live.updatedAtLocal)}</p>
  `;
});

onSnapshot(query(collection(db, 'results')), (snap) => {
  const results = [];
  snap.forEach((d) => results.push({ id: d.id, ...d.data() }));
  results.sort((a, b) => new Date(b.createdAtLocal || 0) - new Date(a.createdAtLocal || 0));

  const byTeam = {};

  results.forEach((r) => {
    if (!byTeam[r.teamId]) {
      byTeam[r.teamId] = {
        name: r.teamName,
        TESTE: null,
        '1': null,
        '2': null,
        best: 0,
        updated: r.createdAtLocal
      };
    }

    const cur = byTeam[r.teamId][r.round];
    if (!cur || r.score > cur.score) byTeam[r.teamId][r.round] = r;

    if (new Date(r.createdAtLocal || 0) > new Date(byTeam[r.teamId].updated || 0)) {
      byTeam[r.teamId].updated = r.createdAtLocal;
    }
  });

  Object.values(byTeam).forEach((t) => {
    t.best = Math.max(t['1']?.score || 0, t['2']?.score || 0);
  });

  const ranking = Object.values(byTeam).sort((a, b) => b.best - a.best || a.name.localeCompare(b.name));
  teamCount.textContent = `${ranking.length} equipes`;

  rankingEl.innerHTML = ranking.length ? ranking.map((t, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`;
    const width = Math.max(5, Math.min(100, (t.best / 470) * 100));

    return `<div class="champ-rank-row rank-${i + 1}">
      <div class="champ-pos">${medal}</div>
      <div class="champ-team">
        <strong>${t.name}</strong>
        <small>R1: ${t['1']?.score ?? '-'} pts • R2: ${t['2']?.score ?? '-'} pts</small>
        <div class="score-bar"><i style="width:${width}%"></i></div>
      </div>
      <div class="champ-points"><strong>${t.best}</strong><span>pts</span></div>
    </div>`;
  }).join('') : '<p class="empty-state">Aguardando resultados salvos...</p>';

  roundsBody.innerHTML = Object.values(byTeam)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => `<tr><td><strong>${t.name}</strong></td><td>${t.TESTE?.score ?? '-'}</td><td>${t['1']?.score ?? '-'}</td><td>${t['2']?.score ?? '-'}</td><td><span class="best-badge">${t.best} pts</span></td></tr>`)
    .join('');

  if (results[0]) {
    lastResult.innerHTML = `<h3>${results[0].teamName}</h3><div class="last-score">${results[0].score}<span>pts</span></div><p>Round ${results[0].round} • ${fmtDate(results[0].createdAtLocal)}</p>`;
  }
});
