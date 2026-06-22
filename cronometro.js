import { db } from './firebase-init.js';
import { MISSIONS, TEAMS_DEFAULT, calculateScore } from './rules.js';
import {
  collection,
  addDoc,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const ROUND_DURATION = 150;
const answers = {};
const $ = (id) => document.getElementById(id);

const TABLE_ID = document.body.dataset.tableId || 'mesa1';
const TABLE_NAME = document.body.dataset.tableName || 'Mesa 1';

const toast = (msg) => {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
};

let liveTimer = null;
let isReadyForLive = false;

let timerState = {
  seconds: ROUND_DURATION,
  running: false,
  targetEndAt: null
};
let timerRenderInterval = null;
let timerCloudSyncInterval = null;

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

function renderJudgeTimer() {
  const display = $('judgeTimerDisplay');
  const status = $('judgeTimerStatus');
  if (!display || !status) return;

  const remaining = getRemainingSeconds();
  display.textContent = formatSeconds(remaining);
  display.classList.toggle('danger', remaining <= 30 && remaining > 10);
  display.classList.toggle('critical', remaining <= 10 && remaining > 0);
  display.classList.toggle('finished', remaining === 0);

  if (remaining === 0) {
    status.textContent = 'Tempo encerrado';
    status.className = 'judge-timer-status finished';
  } else if (timerState.running) {
    status.textContent = 'Em andamento';
    status.className = 'judge-timer-status running';
  } else {
    status.textContent = 'Parado';
    status.className = 'judge-timer-status paused';
  }
}

function startLocalTimerRender() {
  clearInterval(timerRenderInterval);
  timerRenderInterval = setInterval(renderJudgeTimer, 250);
  renderJudgeTimer();
}

function startTimerCloudSync() {
  clearInterval(timerCloudSyncInterval);

  if (!timerState.running) return;

  timerCloudSyncInterval = setInterval(async () => {
    const remaining = getRemainingSeconds();

    if (!timerState.running) {
      clearInterval(timerCloudSyncInterval);
      return;
    }

    try {
      await setDoc(doc(db, 'timers', TABLE_ID), {
        ...timerState,
        seconds: remaining,
        updatedAt: serverTimestamp(),
        updatedAtLocal: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.warn('Não foi possível sincronizar o cronômetro agora:', error);
    }

    if (remaining <= 0) {
      clearInterval(timerCloudSyncInterval);
    }
  }, 1000);
}

async function publishTimerState(nextState) {
  timerState = {
    ...timerState,
    ...nextState
  };

  renderJudgeTimer();
  startTimerCloudSync();

  await setDoc(doc(db, 'timers', TABLE_ID), {
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

  toast(`Cronômetro iniciado na ${TABLE_NAME}.`);
}

async function pauseRoundTimer() {
  const remaining = getRemainingSeconds();

  await publishTimerState({
    seconds: remaining,
    running: false,
    targetEndAt: null
  });

  toast('Cronômetro pausado.');
}

async function resetRoundTimer() {
  await publishTimerState({
    seconds: ROUND_DURATION,
    running: false,
    targetEndAt: null
  });

  toast('Cronômetro reiniciado para 02:30.');
}

async function loadTeams() {
  const select = $('teamSelect');
  select.innerHTML = '';

  const snap = await getDocs(collection(db, 'teams'));

  if (snap.empty) {
    for (const name of TEAMS_DEFAULT) {
      await setDoc(doc(collection(db, 'teams')), {
        name,
        info: '',
        createdAt: serverTimestamp()
      });
    }
    return loadTeams();
  }

  snap.forEach((d) => {
    const data = d.data();
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = data.name;
    opt.dataset.name = data.name;
    select.appendChild(opt);
  });
}

function getSelectedTeamName() {
  const teamSelect = $('teamSelect');
  if (!teamSelect || !teamSelect.value) return '';
  return teamSelect.options[teamSelect.selectedIndex].dataset.name || teamSelect.options[teamSelect.selectedIndex].textContent;
}

function renderJudgePanelInfo() {
  const teamDisplay = $('currentTeamDisplay');
  const roundDisplay = $('currentRoundDisplay');
  const tableDisplay = $('currentTableDisplay');

  if (teamDisplay) {
    teamDisplay.textContent = getSelectedTeamName() || 'Selecione uma equipe';
  }

  if (tableDisplay) {
    tableDisplay.textContent = TABLE_NAME;
  }

  if (roundDisplay) {
    const round = $('roundSelect')?.value || 'TESTE';
    roundDisplay.textContent = round === 'TESTE' ? 'Round Teste' : (round === '1' ? 'Round Oficial 1' : `Round ${round}`);
  }
}

function getLivePayload(status = 'editing') {
  const teamSelect = $('teamSelect');

  return {
    tableId: TABLE_ID,
    tableName: TABLE_NAME,
    teamId: teamSelect.value,
    teamName: getSelectedTeamName(),
    round: $('roundSelect').value,
    judge: $('judgeInput').value.trim(),
    answers: { ...answers },
    score: calculateScore(answers),
    status,
    updatedAt: serverTimestamp(),
    updatedAtLocal: new Date().toISOString()
  };
}

async function updateLiveScore(status = 'editing') {
  if (!isReadyForLive) return;

  const teamSelect = $('teamSelect');
  if (!teamSelect.value) return;

  try {
    await setDoc(doc(db, 'liveScores', TABLE_ID), getLivePayload(status), { merge: true });
  } catch (error) {
    console.error('Erro ao atualizar pontuação ao vivo:', error);
  }
}

function scheduleLiveUpdate(status = 'editing') {
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => updateLiveScore(status), 250);
}

function renderMissions() {
  const wrap = $('missions');
  wrap.innerHTML = '';

  MISSIONS.forEach((m) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div class="mission-title"><h3>${m.title}</h3><span class="mission-total" id="total-${m.id}">0 pts</span></div>`;

    m.items.forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option';
      btn.dataset.item = item.id;
      btn.innerHTML = `<span class="check"></span><span class="optionText">${item.text}</span><span class="pts">+${item.points}</span>`;

      btn.addEventListener('click', () => {
        if (m.type === 'single') {
          m.items.forEach((i) => {
            answers[i.id] = false;
            document.querySelector(`[data-item="${i.id}"]`)?.classList.remove('active');
            const check = document.querySelector(`[data-item="${i.id}"] .check`);
            if (check) check.textContent = '';
          });
        }

        answers[item.id] = !answers[item.id];
        btn.classList.toggle('active', !!answers[item.id]);
        btn.querySelector('.check').textContent = answers[item.id] ? '✓' : '';
        updateTotals();
      });

      card.appendChild(btn);
    });

    wrap.appendChild(card);
  });
}

function updateTotals() {
  $('totalScore').textContent = calculateScore(answers);
  renderJudgePanelInfo();

  MISSIONS.forEach((m) => {
    let total = 0;
    m.items.forEach((i) => {
      if (answers[i.id]) total += i.points;
    });
    $(`total-${m.id}`).textContent = `${total} pts`;
  });

  scheduleLiveUpdate('editing');
}

function resetForm() {
  Object.keys(answers).forEach((k) => answers[k] = false);
  document.querySelectorAll('.option').forEach((b) => {
    b.classList.remove('active');
    b.querySelector('.check').textContent = '';
  });
  updateTotals();
  scheduleLiveUpdate('editing');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function saveResult() {
  const teamSelect = $('teamSelect');
  if (!teamSelect.value) return toast('Cadastre ou selecione uma equipe.');

  const result = {
    tableId: TABLE_ID,
    tableName: TABLE_NAME,
    teamId: teamSelect.value,
    teamName: getSelectedTeamName(),
    round: $('roundSelect').value,
    judge: $('judgeInput').value.trim(),
    answers: { ...answers },
    score: calculateScore(answers),
    createdAt: serverTimestamp(),
    createdAtLocal: new Date().toISOString()
  };

  await addDoc(collection(db, 'results'), result);
  await updateLiveScore('saved');
  toast(`Resultado salvo: ${result.teamName} - ${result.score} pontos`);
}

$('saveBtn').addEventListener('click', saveResult);
$('newBtn').addEventListener('click', resetForm);
$('clearBtn').addEventListener('click', resetForm);
$('teamSelect').addEventListener('change', () => { renderJudgePanelInfo(); scheduleLiveUpdate('editing'); });
$('roundSelect').addEventListener('change', () => { renderJudgePanelInfo(); scheduleLiveUpdate('editing'); });
$('judgeInput').addEventListener('input', () => scheduleLiveUpdate('editing'));

$('judgeStartTimer')?.addEventListener('click', startRoundTimer);
$('judgePauseTimer')?.addEventListener('click', pauseRoundTimer);
$('judgeResetTimer')?.addEventListener('click', resetRoundTimer);

onSnapshot(doc(db, 'timers', TABLE_ID), (snap) => {
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

  renderJudgeTimer();
  startTimerCloudSync();
});

await loadTeams();
renderMissions();
renderJudgePanelInfo();
updateTotals();
isReadyForLive = true;
startLocalTimerRender();
await updateLiveScore('editing');
