import { db } from './firebase-init.js';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  getDocs,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const ADMIN_PASSWORD = 'FLL@2026MG';
const AUTH_KEY = 'fllAdminAuthenticated';
const ROUND_DURATION = 150;
const DEFAULT_BANNER = 'assets/fundo-bioglow.png';
const DEFAULT_BACKGROUND = 'assets/fundo-bioglow.png';

const $ = (id) => document.getElementById(id);

const toast = (m) => {
  const t = $('toast');
  if (!t) return;
  t.textContent = m;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
};

let allResults = [];
let unsubTeams = null;
let unsubResults = null;
let unsubVisual = null;
let unsubGlobalTimer = null;
let unsubTablePasswords = null;
let adminTimerRenderInterval = null;
let globalTimerState = { seconds: ROUND_DURATION, running: false, targetEndAt: null };

function isAuthenticated() {
  return sessionStorage.getItem(AUTH_KEY) === 'true';
}

function showAdmin() {
  $('adminLoginScreen').style.display = 'none';
  $('adminTopbar').style.display = '';
  $('adminContent').style.display = '';
  initAdmin();
}

function showLogin() {
  $('adminLoginScreen').style.display = '';
  $('adminTopbar').style.display = 'none';
  $('adminContent').style.display = 'none';
  setTimeout(() => $('adminPasswordInput')?.focus(), 100);
}

function handleLogin() {
  const pass = $('adminPasswordInput').value;
  const error = $('adminLoginError');

  if (pass === ADMIN_PASSWORD) {
    sessionStorage.setItem(AUTH_KEY, 'true');
    if (error) error.textContent = '';
    showAdmin();
    toast('Acesso liberado.');
    return;
  }

  if (error) error.textContent = 'Senha incorreta. Tente novamente.';
  $('adminPasswordInput').value = '';
  $('adminPasswordInput').focus();
}

function logout() {
  sessionStorage.removeItem(AUTH_KEY);
  if (unsubTeams) unsubTeams();
  if (unsubResults) unsubResults();
  if (unsubVisual) unsubVisual();
  if (unsubGlobalTimer) unsubGlobalTimer();
  if (unsubTablePasswords) unsubTablePasswords();
  clearInterval(adminTimerRenderInterval);
  showLogin();
}

function roundLabel(round) {
  if (round === 'TESTE') return 'Round Teste';
  if (round === '1') return 'Round Oficial 1';
  return `Round ${round}`;
}

function clampSeconds(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return ROUND_DURATION;
  return Math.max(0, Math.min(ROUND_DURATION, Math.round(n)));
}

function fmtDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return value;
  }
}

function getBestByRoundForTeam(teamId, round) {
  const list = allResults.filter((r) => r.teamId === teamId && r.round === round);
  if (!list.length) return null;
  return list.sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0];
}

function buildAdminRanking() {
  const byTeam = {};

  allResults.forEach((r) => {
    if (!r.teamId) return;

    if (!byTeam[r.teamId]) {
      byTeam[r.teamId] = {
        teamId: r.teamId,
        name: r.teamName || 'Equipe sem nome',
        teste: null,
        r1: null,
        r2: null,
        best: 0,
        bestRound: '-',
        bestTable: ''
      };
    }
  });

  Object.values(byTeam).forEach((team) => {
    team.teste = getBestByRoundForTeam(team.teamId, 'TESTE');
    team.r1 = getBestByRoundForTeam(team.teamId, '1');
    team.r2 = getBestByRoundForTeam(team.teamId, '2');

    const r1Score = Number(team.r1?.score || 0);
    const r2Score = Number(team.r2?.score || 0);

    if (r2Score > r1Score) {
      team.best = r2Score;
      team.bestRound = 'Round Oficial 2';
      team.bestTable = team.r2?.tableName || '';
    } else {
      team.best = r1Score;
      team.bestRound = r1Score ? 'Round Oficial 1' : '-';
      team.bestTable = team.r1?.tableName || '';
    }
  });

  return Object.values(byTeam).sort((a, b) => Number(b.best || 0) - Number(a.best || 0) || a.name.localeCompare(b.name));
}

function resultCell(result) {
  if (!result) return '-';
  const mesa = result.tableName ? `<small>${result.tableName}</small>` : '';
  return `<strong>${result.score} pts</strong>${mesa}`;
}

function renderAdminRanking() {
  const body = $('adminRankingBody');
  if (!body) return;

  const ranking = buildAdminRanking();

  body.innerHTML = ranking.length ? ranking.map((team, index) => {
    const bestTable = team.bestTable ? ` • ${team.bestTable}` : '';
    return `<tr>
      <td><strong>${index + 1}º</strong></td>
      <td><strong>${team.name}</strong></td>
      <td>${resultCell(team.teste)}</td>
      <td>${resultCell(team.r1)}</td>
      <td>${resultCell(team.r2)}</td>
      <td><span class="best-badge">${team.best} pts</span><small>${team.bestRound}${bestTable}</small></td>
    </tr>`;
  }).join('') : '<tr><td colspan="6">Aguardando resultados.</td></tr>';
}

function renderResultsTable() {
  const body = $('resultsBody');
  if (!body) return;

  body.innerHTML = allResults.length ? allResults.map((r) => `
    <tr>
      <td>${r.tableName || 'Mesa 1'}</td>
      <td>${r.teamName || '-'}</td>
      <td>${roundLabel(r.round)}</td>
      <td><strong>${r.score ?? 0}</strong></td>
      <td>${r.judge || '-'}</td>
      <td>${fmtDate(r.createdAtLocal)}</td>
      <td><button class="btn red" data-delres="${r.id}">Excluir</button></td>
    </tr>
  `).join('') : '<tr><td colspan="7">Nenhum resultado salvo.</td></tr>';

  document.querySelectorAll('[data-delres]').forEach((b) => {
    b.onclick = async () => {
      if (confirm('Excluir resultado?')) {
        await deleteDoc(doc(db, 'results', b.dataset.delres));
        toast('Resultado excluído.');
      }
    };
  });
}

async function resetTimer(tableId) {
  await setDoc(doc(db, 'timers', tableId), {
    seconds: ROUND_DURATION,
    running: false,
    targetEndAt: null,
    updatedAt: serverTimestamp(),
    updatedAtLocal: new Date().toISOString()
  }, { merge: true });
}

async function clearLiveScore(tableId) {
  try {
    await deleteDoc(doc(db, 'liveScores', tableId));
  } catch (e) {
    console.warn('Pontuação ao vivo não encontrada para apagar:', tableId, e);
  }
}

async function clearTable(tableId, tableName) {
  if (!confirm(`Zerar ${tableName}? Isso apagará os resultados salvos desta mesa e reiniciará o cronômetro.`)) return;

  const targets = allResults.filter((r) => r.tableId === tableId || r.tableName === tableName);
  await Promise.all(targets.map((r) => deleteDoc(doc(db, 'results', r.id))));
  await clearLiveScore(tableId);
  await resetTimer(tableId);
  toast(`${tableName} zerada.`);
}

async function resetCompetition() {
  if (!confirm('Zerar TODA a competição? Isso apagará todos os resultados das duas mesas, mas manterá as equipes cadastradas.')) return;

  const snap = await getDocs(collection(db, 'results'));
  await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'results', d.id))));
  await Promise.all([
    clearLiveScore('mesa1'),
    clearLiveScore('mesa2'),
    resetTimer('mesa1'),
    resetTimer('mesa2')
  ]);

  toast('Competição zerada. Equipes mantidas.');
}

function exportCsv() {
  const rows = [['Mesa', 'Equipe', 'Round', 'Pontos', 'Árbitro', 'Data']].concat(
    allResults.map((r) => [r.tableName || 'Mesa 1', r.teamName || '', r.round || '', r.score ?? 0, r.judge || '', r.createdAtLocal || ''])
  );

  const csv = rows.map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'resultados-fll-2026-duas-mesas.csv';
  a.click();
}

async function saveVisualSettings() {
  const bannerUrl = $('bannerUrlInput').value.trim() || DEFAULT_BANNER;
  const backgroundUrl = $('backgroundUrlInput').value.trim() || DEFAULT_BACKGROUND;

  await setDoc(doc(db, 'settings', 'visual'), {
    bannerUrl,
    backgroundUrl,
    updatedAt: serverTimestamp(),
    updatedAtLocal: new Date().toISOString()
  }, { merge: true });

  toast('Visual salvo. Atualize as telas abertas, se necessário.');
}

async function resetVisualSettings() {
  $('bannerUrlInput').value = DEFAULT_BANNER;
  $('backgroundUrlInput').value = DEFAULT_BACKGROUND;
  await saveVisualSettings();
}

async function saveTablePasswords() {
  const mesa1Password = $('mesa1PasswordInput')?.value.trim();
  const mesa2Password = $('mesa2PasswordInput')?.value.trim();

  if (!mesa1Password || !mesa2Password) {
    toast('Preencha a senha da Mesa 1 e da Mesa 2.');
    return;
  }

  await setDoc(doc(db, 'settings', 'tablePasswords'), {
    mesa1: mesa1Password,
    mesa2: mesa2Password,
    updatedAt: serverTimestamp(),
    updatedAtLocal: new Date().toISOString()
  }, { merge: true });

  toast('Senhas das mesas salvas.');
}


function getGlobalRemainingSeconds() {
  if (!globalTimerState.running || !globalTimerState.targetEndAt) {
    return clampSeconds(globalTimerState.seconds);
  }
  return clampSeconds(Math.ceil((Number(globalTimerState.targetEndAt) - Date.now()) / 1000));
}

function formatTimer(seconds) {
  const safe = clampSeconds(seconds);
  const m = String(Math.floor(safe / 60)).padStart(2, '0');
  const s = String(safe % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function renderAdminTimer() {
  const display = $('adminTimerDisplay');
  const status = $('adminTimerStatus');
  if (!display || !status) return;

  const remaining = getGlobalRemainingSeconds();
  display.textContent = formatTimer(remaining);

  display.classList.toggle('danger', remaining <= 30 && remaining > 10);
  display.classList.toggle('critical', remaining <= 10 && remaining > 0);
  display.classList.toggle('finished', remaining === 0);

  if (remaining === 0) {
    status.textContent = 'Tempo encerrado';
    status.className = 'judge-timer-status finished';
  } else if (globalTimerState.running) {
    status.textContent = 'Em andamento';
    status.className = 'judge-timer-status running';
  } else {
    status.textContent = 'Parado';
    status.className = 'judge-timer-status paused';
  }
}

async function publishGlobalTimer(nextState) {
  globalTimerState = { ...globalTimerState, ...nextState };
  renderAdminTimer();

  await setDoc(doc(db, 'timers', 'global'), {
    ...globalTimerState,
    updatedAt: serverTimestamp(),
    updatedAtLocal: new Date().toISOString()
  }, { merge: true });
}

async function startGlobalTimer() {
  const remaining = getGlobalRemainingSeconds();
  const secondsToUse = remaining > 0 ? remaining : ROUND_DURATION;
  await publishGlobalTimer({
    seconds: secondsToUse,
    running: true,
    targetEndAt: Date.now() + (secondsToUse * 1000)
  });
  toast('Cronômetro oficial iniciado.');
}

async function pauseGlobalTimer() {
  await publishGlobalTimer({
    seconds: getGlobalRemainingSeconds(),
    running: false,
    targetEndAt: null
  });
  toast('Cronômetro oficial pausado.');
}

async function resetGlobalTimer() {
  await publishGlobalTimer({
    seconds: ROUND_DURATION,
    running: false,
    targetEndAt: null
  });
  toast('Cronômetro oficial reiniciado.');
}

function listenGlobalTimer() {
  if (unsubGlobalTimer) unsubGlobalTimer();
  if (unsubTablePasswords) unsubTablePasswords();

  unsubGlobalTimer = onSnapshot(doc(db, 'timers', 'global'), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      globalTimerState = {
        seconds: clampSeconds(data.seconds),
        running: !!data.running,
        targetEndAt: data.targetEndAt || null
      };
    } else {
      globalTimerState = { seconds: ROUND_DURATION, running: false, targetEndAt: null };
    }
    renderAdminTimer();
  });

  clearInterval(adminTimerRenderInterval);
  adminTimerRenderInterval = setInterval(renderAdminTimer, 250);
  renderAdminTimer();
}

function initAdmin() {
  if (initAdmin.started) return;
  initAdmin.started = true;

  $('logoutAdminBtn').onclick = logout;

  $('addTeamBtn').onclick = async () => {
    const name = $('teamName').value.trim();
    if (!name) return toast('Digite o nome da equipe.');

    await addDoc(collection(db, 'teams'), {
      name,
      info: $('teamInfo').value.trim(),
      createdAt: serverTimestamp()
    });

    $('teamName').value = '';
    $('teamInfo').value = '';
    toast('Equipe adicionada.');
  };

  $('clearMesa1Btn').onclick = () => clearTable('mesa1', 'Mesa 1');
  $('clearMesa2Btn').onclick = () => clearTable('mesa2', 'Mesa 2');
  $('resetCompetitionBtn').onclick = resetCompetition;
  $('exportBtn').onclick = exportCsv;
  $('adminStartTimer').onclick = startGlobalTimer;
  $('adminPauseTimer').onclick = pauseGlobalTimer;
  $('adminResetTimer').onclick = resetGlobalTimer;
  listenGlobalTimer();
  $('saveVisualBtn').onclick = saveVisualSettings;
  $('resetVisualBtn').onclick = resetVisualSettings;
  $('saveTablePasswordsBtn').onclick = saveTablePasswords;

  unsubTeams = onSnapshot(query(collection(db, 'teams')), (snap) => {
    const teams = [];
    snap.forEach((d) => teams.push({ id: d.id, ...d.data() }));
    teams.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    $('teamList').innerHTML = teams.length ? teams.map((t) => `
      <div class="admin-item">
        <div>
          <strong>${t.name}</strong><br>
          <span class="muted">${t.info || ''}</span>
        </div>
        <button class="btn red" data-delteam="${t.id}">Excluir</button>
      </div>
    `).join('') : '<p class="muted">Nenhuma equipe cadastrada.</p>';

    document.querySelectorAll('[data-delteam]').forEach((b) => {
      b.onclick = async () => {
        if (confirm('Excluir equipe?')) {
          await deleteDoc(doc(db, 'teams', b.dataset.delteam));
          toast('Equipe excluída.');
        }
      };
    });
  });

  unsubResults = onSnapshot(query(collection(db, 'results')), (snap) => {
    allResults = [];
    snap.forEach((d) => allResults.push({ id: d.id, ...d.data() }));
    allResults.sort((a, b) => new Date(b.createdAtLocal || 0) - new Date(a.createdAtLocal || 0));

    renderResultsTable();
    renderAdminRanking();
  });

  unsubVisual = onSnapshot(doc(db, 'settings', 'visual'), (snap) => {
    const data = snap.exists() ? snap.data() : {};
    $('bannerUrlInput').value = data.bannerUrl || DEFAULT_BANNER;
    $('backgroundUrlInput').value = data.backgroundUrl || DEFAULT_BACKGROUND;
  });

  unsubTablePasswords = onSnapshot(doc(db, 'settings', 'tablePasswords'), (snap) => {
    const data = snap.exists() ? snap.data() : {};
    $('mesa1PasswordInput').value = data.mesa1 || 'mesa1@2026';
    $('mesa2PasswordInput').value = data.mesa2 || 'mesa2@2026';
  });
}

$('adminLoginBtn').addEventListener('click', handleLogin);
$('adminPasswordInput').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') handleLogin();
});

if (isAuthenticated()) {
  showAdmin();
} else {
  showLogin();
}
