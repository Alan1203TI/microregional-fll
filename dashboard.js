import { db } from './firebase-init.js';
import {
  collection,
  doc,
  onSnapshot,
  query
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const ROUND_DURATION = 150;

const rankingEl = document.getElementById('ranking');
const roundsBody = document.getElementById('roundsBody');
const lastResult = document.getElementById('lastResult');
const teamCount = document.getElementById('teamCount');
const dashboardClock = document.getElementById('dashboardClock');

const timerElements = {
  mesa1: {
    display: document.getElementById('timerMesa1'),
    status: document.getElementById('timerStatusMesa1'),
    card: document.getElementById('timerCardMesa1')
  },
  mesa2: {
    display: document.getElementById('timerMesa2'),
    status: document.getElementById('timerStatusMesa2'),
    card: document.getElementById('timerCardMesa2')
  }
};

const timerStates = {
  mesa1: { seconds: ROUND_DURATION, running: false, targetEndAt: null, receivedAt: Date.now() },
  mesa2: { seconds: ROUND_DURATION, running: false, targetEndAt: null, receivedAt: Date.now() }
};

const soundState = {
  mesa1: { lastSecond: null, warned30: false, finished: false },
  mesa2: { lastSecond: null, warned30: false, finished: false }
};

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

function handleTimerSound(tableId, remaining, running) {
  const state = soundState[tableId];
  if (!state) return;

  if (!running || remaining >= ROUND_DURATION) {
    state.lastSecond = remaining;
    state.warned30 = false;
    state.finished = false;
    return;
  }

  if (remaining !== state.lastSecond) {
    if (remaining === 30 && !state.warned30) {
      playThirtySecondsWarning();
      state.warned30 = true;
    }

    if (remaining <= 10 && remaining > 0) {
      playWarningSound();
    }

    if (remaining === 0 && !state.finished) {
      playFinishedSound();
      state.finished = true;
    }

    state.lastSecond = remaining;
  }
}

['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
  window.addEventListener(eventName, () => { getAudioContext(); finalSirenAudio.load(); }, { once: true, passive: true });
});

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return '';
  }
}

function clampSeconds(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return ROUND_DURATION;
  return Math.max(0, Math.min(ROUND_DURATION, Math.round(n)));
}

function getRemainingSeconds(tableId) {
  const state = timerStates[tableId] || timerStates.mesa1;

  if (!state.running) {
    return clampSeconds(state.seconds);
  }

  const options = [];

  if (state.targetEndAt) {
    const byTarget = Math.ceil((Number(state.targetEndAt) - Date.now()) / 1000);
    if (Number.isFinite(byTarget)) options.push(byTarget);
  }

  if (state.receivedAt) {
    const elapsed = Math.floor((Date.now() - Number(state.receivedAt)) / 1000);
    const bySnapshot = Number(state.seconds || 0) - Math.max(0, elapsed);
    if (Number.isFinite(bySnapshot)) options.push(bySnapshot);
  }

  if (!options.length) return clampSeconds(state.seconds);

  // Usa o menor valor para evitar atraso visual no dashboard.
  return clampSeconds(Math.min(...options));
}

function formatSeconds(seconds) {
  const safe = clampSeconds(seconds);
  const m = String(Math.floor(safe / 60)).padStart(2, '0');
  const s = String(safe % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function renderTimer(tableId) {
  const el = timerElements[tableId];
  if (!el?.display || !el?.status || !el?.card) return;

  const state = timerStates[tableId];
  const remaining = getRemainingSeconds(tableId);

  el.display.textContent = formatSeconds(remaining);

  el.display.classList.toggle('danger', remaining <= 30 && remaining > 10);
  el.display.classList.toggle('critical', remaining <= 10 && remaining > 0);
  el.display.classList.toggle('finished', remaining === 0);

  el.card.classList.toggle('running', !!state.running && remaining > 0);
  el.card.classList.toggle('danger', remaining <= 30 && remaining > 10);
  el.card.classList.toggle('critical', remaining <= 10 && remaining > 0);
  el.card.classList.toggle('finished', remaining === 0);

  handleTimerSound(tableId, remaining, !!state.running);

  if (remaining === 0) {
    el.status.textContent = 'Tempo encerrado';
  } else if (state.running) {
    el.status.textContent = 'Em andamento';
  } else {
    el.status.textContent = 'Parado';
  }
}

function renderAllTimers() {
  renderTimer('mesa1');
  renderTimer('mesa2');
}


function updateDashboardClock() {
  if (!dashboardClock) return;
  dashboardClock.textContent = new Date().toLocaleTimeString('pt-BR', { hour12: false });
}

updateDashboardClock();
setInterval(updateDashboardClock, 1000);

function listenTimer(tableId) {
  onSnapshot(doc(db, 'timers', tableId), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      timerStates[tableId] = {
        seconds: clampSeconds(data.seconds),
        running: !!data.running,
        targetEndAt: data.targetEndAt || null,
        receivedAt: Date.now()
      };
    } else {
      timerStates[tableId] = { seconds: ROUND_DURATION, running: false, targetEndAt: null, receivedAt: Date.now() };
    }

    renderTimer(tableId);
  });
}

function bestVisibleTableLabel(result) {
  return result?.tableName ? ` • ${result.tableName}` : '';
}

function buildRanking(results) {
  const byTeam = {};

  results.forEach((r) => {
    if (!r.teamId) return;

    if (!byTeam[r.teamId]) {
      byTeam[r.teamId] = {
        name: r.teamName || 'Equipe sem nome',
        TESTE: null,
        '1': null,
        '2': null,
        publicScore: 0,
        publicRound: '-',
        publicTable: '',
        updated: r.createdAtLocal || ''
      };
    }

    const cur = byTeam[r.teamId][r.round];
    if (!cur || Number(r.score || 0) > Number(cur.score || 0)) {
      byTeam[r.teamId][r.round] = r;
    }

    if (new Date(r.createdAtLocal || 0) > new Date(byTeam[r.teamId].updated || 0)) {
      byTeam[r.teamId].updated = r.createdAtLocal;
    }
  });

  Object.values(byTeam).forEach((team) => {
    const r1 = Number(team['1']?.score || 0);
    team.publicScore = r1;
    team.publicRound = r1 ? 'Round Oficial 1' : '-';
    team.publicTable = team['1']?.tableName || '';
  });

  return Object.values(byTeam).sort((a, b) => b.publicScore - a.publicScore || a.name.localeCompare(b.name));
}



function applyAdaptiveDashboard(count) {
  const root = document.documentElement;
  const body = document.body;
  const safeCount = Math.max(1, Number(count) || 1);

  root.style.setProperty('--dashboard-team-count', String(safeCount));

  const tiers = [
    { max: 6,  cls: 'normal',  hero: '145px', rounds: 'minmax(120px,25vh)', gap: '8px', rowPad: '10px 14px', posW: '70px', scoreW: '142px', rowGap: '12px', pos: '34px', name: '38px', score: '58px', small: '12px', bar: '7px', scoreLabel: '11px', roundTd: '14px', roundTh: '10px', roundPad: '7px 10px', roundGap: '5px' },
    { max: 8,  cls: 'compact', hero: '125px', rounds: 'minmax(105px,22vh)', gap: '6px', rowPad: '7px 12px', posW: '56px', scoreW: '118px', rowGap: '10px', pos: '28px', name: '31px', score: '46px', small: '10px', bar: '5px', scoreLabel: '10px', roundTd: '12px', roundTh: '9px', roundPad: '5px 8px', roundGap: '4px' },
    { max: 10, cls: 'compact', hero: '110px', rounds: 'minmax(92px,19vh)',  gap: '5px', rowPad: '6px 10px', posW: '48px', scoreW: '104px', rowGap: '8px',  pos: '24px', name: '26px', score: '39px', small: '9px',  bar: '4px', scoreLabel: '9px',  roundTd: '11px', roundTh: '8px', roundPad: '4px 7px', roundGap: '3px' },
    { max: 14, cls: 'dense',   hero: '92px',  rounds: 'minmax(78px,16vh)',  gap: '4px', rowPad: '5px 9px',  posW: '40px', scoreW: '88px',  rowGap: '7px',  pos: '20px', name: '21px', score: '32px', small: '8px',  bar: '0px', scoreLabel: '8px',  roundTd: '9px',  roundTh: '7px', roundPad: '3px 6px', roundGap: '2px' },
    { max: 18, cls: 'ultra',   hero: '74px',  rounds: 'minmax(62px,13vh)',  gap: '3px', rowPad: '3px 7px',  posW: '34px', scoreW: '74px',  rowGap: '6px',  pos: '17px', name: '17px', score: '26px', small: '0px',  bar: '0px', scoreLabel: '7px',  roundTd: '8px',  roundTh: '6px', roundPad: '2px 5px', roundGap: '1px' },
    { max: Infinity, cls: 'ultra', hero: '62px', rounds: '52px',            gap: '2px', rowPad: '2px 6px',  posW: '30px', scoreW: '64px',  rowGap: '5px',  pos: '15px', name: '15px', score: '22px', small: '0px',  bar: '0px', scoreLabel: '6px',  roundTd: '7px',  roundTh: '6px', roundPad: '1px 4px', roundGap: '1px' }
  ];

  const tier = tiers.find(t => safeCount <= t.max) || tiers[tiers.length - 1];

  body.classList.toggle('dashboard-compact', tier.cls === 'compact');
  body.classList.toggle('dashboard-dense', tier.cls === 'dense');
  body.classList.toggle('dashboard-ultra', tier.cls === 'ultra');

  const vars = {
    '--dash-hero-height': tier.hero,
    '--dash-rounds-height': tier.rounds,
    '--rank-gap': tier.gap,
    '--rank-row-padding': tier.rowPad,
    '--rank-pos-width': tier.posW,
    '--rank-score-width': tier.scoreW,
    '--rank-row-gap': tier.rowGap,
    '--rank-pos-size': tier.pos,
    '--rank-name-size': tier.name,
    '--rank-score-size': tier.score,
    '--rank-small-size': tier.small,
    '--rank-bar-height': tier.bar,
    '--rank-score-label-size': tier.scoreLabel,
    '--round-td-size': tier.roundTd,
    '--round-th-size': tier.roundTh,
    '--round-td-padding': tier.roundPad,
    '--round-row-gap': tier.roundGap
  };

  Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));

  fitTvScoreboardRows(safeCount);
}

function fitTvScoreboardRows(count) {
  const root = document.documentElement;
  const safeCount = Math.max(1, Number(count) || 1);
  const wrap = document.querySelector('.tv-table-wrap');
  const tableHead = document.querySelector('.tv-score-table thead');

  // Usa a altura REAL da área da tabela, não uma estimativa da tela inteira.
  // Assim, se o título, cabeçalho ou margens mudarem, as linhas continuam cabendo.
  const wrapHeight = wrap?.clientHeight || Math.max(180, window.innerHeight * 0.64);
  const headHeight = tableHead?.offsetHeight || 34;
  const rowGap = Math.max(1, Math.min(6, Math.floor(wrapHeight / 150)));
  const safety = 18;
  const availableRowsHeight = Math.max(80, wrapHeight - headHeight - (rowGap * (safeCount + 1)) - safety);
  const rowHeight = Math.max(24, Math.floor(availableRowsHeight / safeCount));

  // Fontes proporcionais ao espaço disponível. A pontuação continua em destaque,
  // mas reduz automaticamente para a última equipe nunca ficar cortada.
  const scoreSize = Math.max(20, Math.min(82, Math.floor(rowHeight * 0.66)));
  const nameSize = Math.max(14, Math.min(42, Math.floor(rowHeight * 0.34)));
  const labelSize = Math.max(7, Math.min(16, Math.floor(rowHeight * 0.13)));
  const posSize = Math.max(13, Math.min(34, Math.floor(rowHeight * 0.28)));
  const headSize = Math.max(10, Math.min(24, Math.floor(rowHeight * 0.18)));
  const padY = Math.max(1, Math.min(6, Math.floor(rowHeight * 0.035)));

  root.style.setProperty('--tv-row-height', `${rowHeight}px`);
  root.style.setProperty('--tv-score-size', `${scoreSize}px`);
  root.style.setProperty('--tv-name-size', `${nameSize}px`);
  root.style.setProperty('--tv-score-label-size', `${labelSize}px`);
  root.style.setProperty('--tv-pos-size', `${posSize}px`);
  root.style.setProperty('--tv-head-size', `${headSize}px`);
  root.style.setProperty('--tv-cell-padding-y', `${padY}px`);
  root.style.setProperty('--tv-row-gap', `${rowGap}px`);
}

window.addEventListener('resize', () => {
  const count = Number(document.documentElement.style.getPropertyValue('--dashboard-team-count')) || 1;
  requestAnimationFrame(() => applyAdaptiveDashboard(count));
});

function renderRanking(ranking) {
  if (teamCount) teamCount.textContent = `${ranking.length} equipes`;

  if (!rankingEl) return;

  rankingEl.innerHTML = ranking.length ? ranking.map((team, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`;
    const width = Math.max(5, Math.min(100, (Number(team.publicScore || 0) / 470) * 100));
    const tableLabel = team.publicTable ? ` • ${team.publicTable}` : '';

    return `<div class="champ-rank-row rank-${index + 1}">
      <div class="champ-pos">${medal}</div>
      <div class="champ-team">
        <strong>${team.name}</strong>
        <small>Pontuação pública: ${team.publicRound}${tableLabel}</small>
        <div class="score-bar"><i style="width:${width}%"></i></div>
      </div>
      <div class="champ-points"><strong>${team.publicScore}</strong><span>pts</span></div>
    </div>`;
  }).join('') : '<p class="empty-state">Aguardando resultados do Round Oficial 1...</p>';
}

function renderRoundsTable(ranking) {
  if (!roundsBody) return;

  roundsBody.innerHTML = ranking
    .slice()
    .sort((a, b) => Number(b.publicScore || 0) - Number(a.publicScore || 0) || a.name.localeCompare(b.name))
    .map((team, index) => {
      const testeTable = bestVisibleTableLabel(team.TESTE);
      const r1Table = bestVisibleTableLabel(team['1']);
      const pos = `${index + 1}º`;

      return `<tr class="score-row rank-${index + 1}">
        <td class="score-pos">${pos}</td>
        <td class="score-team"><strong>${team.name}</strong></td>
        <td class="score-points">${team.TESTE?.score ?? '-'}${testeTable ? `<small>${testeTable.replace(' • ', '')}</small>` : ''}</td>
        <td class="score-points main-score">${team['1']?.score ?? '-'}${r1Table ? `<small>${r1Table.replace(' • ', '')}</small>` : ''}</td>
      </tr>`;
    }).join('');
}

function renderLastVisibleResult(results) {
  if (!lastResult) return;

  const visibleLast = results.find((r) => r.round !== '2');

  if (!visibleLast) {
    lastResult.innerHTML = 'Aguardando pontuações visíveis no dashboard...';
    return;
  }

  const roundLabel = visibleLast.round === 'TESTE' ? 'Round Teste' : (visibleLast.round === '1' ? 'Round Oficial 1' : `Round ${visibleLast.round}`);
  const tableLabel = visibleLast.tableName ? ` • ${visibleLast.tableName}` : '';

  lastResult.innerHTML = `<h3>${visibleLast.teamName}</h3>
    <div class="last-score">${visibleLast.score}<span>pts</span></div>
    <p>${roundLabel}${tableLabel} • ${fmtDate(visibleLast.createdAtLocal)}</p>`;
}

onSnapshot(query(collection(db, 'results')), (snap) => {
  const results = [];
  snap.forEach((d) => results.push({ id: d.id, ...d.data() }));

  results.sort((a, b) => new Date(b.createdAtLocal || 0) - new Date(a.createdAtLocal || 0));

  const ranking = buildRanking(results);

  const count = ranking.length;
  document.body.classList.toggle('dashboard-many', count > 6);
  document.body.classList.toggle('dashboard-lots', count > 10);
  rankingEl?.classList.toggle('many-teams', count > 6);
  rankingEl?.classList.toggle('lots-teams', count > 10);

  applyAdaptiveDashboard(count);
  renderRanking(ranking);
  renderRoundsTable(ranking);
  renderLastVisibleResult(results);

  // Depois de criar as linhas, mede novamente a tabela já renderizada.
  requestAnimationFrame(() => applyAdaptiveDashboard(count));
});
