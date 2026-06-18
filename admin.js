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
  showLogin();
}

function roundLabel(round) {
  return round === 'TESTE' ? 'TESTE' : `Round ${round}`;
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
      team.bestRound = 'Round 2';
      team.bestTable = team.r2?.tableName || '';
    } else {
      team.best = r1Score;
      team.bestRound = r1Score ? 'Round 1' : '-';
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

function buildChampionSumRanking() {
  const byTeam = {};

  allResults.forEach((r) => {
    if (!r.teamId) return;

    if (!byTeam[r.teamId]) {
      byTeam[r.teamId] = {
        teamId: r.teamId,
        name: r.teamName || 'Equipe sem nome',
        r1: null,
        r2: null,
        total: 0
      };
    }
  });

  Object.values(byTeam).forEach((team) => {
    team.r1 = getBestByRoundForTeam(team.teamId, '1');
    team.r2 = getBestByRoundForTeam(team.teamId, '2');
    team.total = Number(team.r1?.score || 0) + Number(team.r2?.score || 0);
  });

  return Object.values(byTeam).sort((a, b) => Number(b.total || 0) - Number(a.total || 0) || a.name.localeCompare(b.name));
}

function renderChampionSumRanking() {
  const body = $('championSumBody');
  if (!body) return;

  const ranking = buildChampionSumRanking();

  body.innerHTML = ranking.length ? ranking.map((team, index) => {
    const medal = index === 0 ? '🥇 ' : index === 1 ? '🥈 ' : index === 2 ? '🥉 ' : '';
    return `<tr class="champion-sum-row champion-pos-${index + 1}">
      <td><strong>${medal}${index + 1}º</strong></td>
      <td><strong>${team.name}</strong></td>
      <td>${resultCell(team.r1)}</td>
      <td>${resultCell(team.r2)}</td>
      <td><span class="best-badge champion-total-badge">${team.total} pts</span></td>
    </tr>`;
  }).join('') : '<tr><td colspan="5">Aguardando resultados dos rounds oficiais.</td></tr>';
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
  const rows = [['Mesa', 'Equipe', 'Round', 'Pontos', 'Juiz', 'Data']].concat(
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
  $('saveVisualBtn').onclick = saveVisualSettings;
  $('resetVisualBtn').onclick = resetVisualSettings;

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
    renderChampionSumRanking();
  });

  unsubVisual = onSnapshot(doc(db, 'settings', 'visual'), (snap) => {
    const data = snap.exists() ? snap.data() : {};
    $('bannerUrlInput').value = data.bannerUrl || DEFAULT_BANNER;
    $('backgroundUrlInput').value = data.backgroundUrl || DEFAULT_BACKGROUND;
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
