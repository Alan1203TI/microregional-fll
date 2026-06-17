import { db } from './firebase-init.js';
import { MISSIONS, TEAMS_DEFAULT, calculateScore } from './rules.js';
import {
  collection,
  addDoc,
  doc,
  setDoc,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const answers = {};
const $ = (id) => document.getElementById(id);
const toast = (msg) => {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
};

let liveTimer = null;
let isReadyForLive = false;

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

function getLivePayload(status = 'editing') {
  const teamSelect = $('teamSelect');

  return {
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
    await setDoc(doc(db, 'liveScores', 'current'), getLivePayload(status), { merge: true });
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
$('teamSelect').addEventListener('change', () => scheduleLiveUpdate('editing'));
$('roundSelect').addEventListener('change', () => scheduleLiveUpdate('editing'));
$('judgeInput').addEventListener('input', () => scheduleLiveUpdate('editing'));

await loadTeams();
renderMissions();
updateTotals();
isReadyForLive = true;
await updateLiveScore('editing');
