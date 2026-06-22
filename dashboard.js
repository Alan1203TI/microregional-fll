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
    .map((team) => {
      const testeTable = bestVisibleTableLabel(team.TESTE);
      const r1Table = bestVisibleTableLabel(team['1']);

      return `<tr>
        <td><strong>${team.name}</strong></td>
        <td>${team.TESTE?.score ?? '-'}${testeTable ? `<small>${testeTable.replace(' • ', '')}</small>` : ''}</td>
        <td>${team['1']?.score ?? '-'}${r1Table ? `<small>${r1Table.replace(' • ', '')}</small>` : ''}</td>
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

  renderRanking(ranking);
  renderRoundsTable(ranking);
  renderLastVisibleResult(results);
});
