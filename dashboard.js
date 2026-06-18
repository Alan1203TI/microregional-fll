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
  mesa1: { seconds: ROUND_DURATION, running: false, targetEndAt: null },
  mesa2: { seconds: ROUND_DURATION, running: false, targetEndAt: null }
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
        targetEndAt: data.targetEndAt || null
      };
    } else {
      timerStates[tableId] = { seconds: ROUND_DURATION, running: false, targetEndAt: null };
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
        best: 0,
        bestRound: '-',
        bestTable: '',
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
    const r2 = Number(team['2']?.score || 0);

    if (r2 > r1) {
      team.best = r2;
      team.bestRound = 'Round 2';
      team.bestTable = team['2']?.tableName || '';
    } else {
      team.best = r1;
      team.bestRound = r1 ? 'Round 1' : '-';
      team.bestTable = team['1']?.tableName || '';
    }
  });

  return Object.values(byTeam).sort((a, b) => b.best - a.best || a.name.localeCompare(b.name));
}

function renderRanking(ranking) {
  if (teamCount) teamCount.textContent = `${ranking.length} equipes`;

  if (!rankingEl) return;

  rankingEl.innerHTML = ranking.length ? ranking.map((team, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`;
    const width = Math.max(5, Math.min(100, (Number(team.best || 0) / 470) * 100));
    const bestTable = team.bestTable ? ` • ${team.bestTable}` : '';

    return `<div class="champ-rank-row rank-${index + 1}">
      <div class="champ-pos">${medal}</div>
      <div class="champ-team">
        <strong>${team.name}</strong>
        <small>Melhor oficial: ${team.bestRound}${bestTable} • Round 2 reservado no telão</small>
        <div class="score-bar"><i style="width:${width}%"></i></div>
      </div>
      <div class="champ-points"><strong>${team.best}</strong><span>pts</span></div>
    </div>`;
  }).join('') : '<p class="empty-state">Aguardando resultados salvos...</p>';
}

function renderRoundsTable(ranking) {
  if (!roundsBody) return;

  roundsBody.innerHTML = ranking
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((team) => {
      const testeTable = bestVisibleTableLabel(team.TESTE);
      const r1Table = bestVisibleTableLabel(team['1']);

      return `<tr>
        <td><strong>${team.name}</strong></td>
        <td>${team.TESTE?.score ?? '-'}${testeTable ? `<small>${testeTable.replace(' • ', '')}</small>` : ''}</td>
        <td>${team['1']?.score ?? '-'}${r1Table ? `<small>${r1Table.replace(' • ', '')}</small>` : ''}</td>
        <td><span class="reserved-badge">Reservado</span></td>
        <td><span class="best-badge">${team.best} pts</span></td>
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

  const roundLabel = visibleLast.round === 'TESTE' ? 'Teste' : `Round ${visibleLast.round}`;
  const tableLabel = visibleLast.tableName ? ` • ${visibleLast.tableName}` : '';

  lastResult.innerHTML = `<h3>${visibleLast.teamName}</h3>
    <div class="last-score">${visibleLast.score}<span>pts</span></div>
    <p>${roundLabel}${tableLabel} • ${fmtDate(visibleLast.createdAtLocal)}</p>`;
}

listenTimer('mesa1');
listenTimer('mesa2');
setInterval(renderAllTimers, 250);
renderAllTimers();

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
