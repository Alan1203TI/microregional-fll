import { db } from './firebase-init.js';
import { collection, onSnapshot, query } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const rankingEl = document.getElementById('ranking');
const roundsBody = document.getElementById('roundsBody');
const lastResult = document.getElementById('lastResult');
const teamCount = document.getElementById('teamCount');
const timerDisplay = document.getElementById('timerDisplay');
const startTimer = document.getElementById('startTimer');
const pauseTimer = document.getElementById('pauseTimer');
const resetTimer = document.getElementById('resetTimer');

function fmtDate(iso){ try{return new Date(iso).toLocaleString('pt-BR')}catch{return ''} }

let timeLeft = 150;
let timerId = null;
function renderTimer(){
  const m = String(Math.floor(timeLeft / 60)).padStart(2,'0');
  const s = String(timeLeft % 60).padStart(2,'0');
  timerDisplay.textContent = `${m}:${s}`;
  timerDisplay.classList.toggle('danger', timeLeft <= 30);
}
startTimer.onclick = () => {
  if(timerId) return;
  timerId = setInterval(() => {
    if(timeLeft > 0) timeLeft--;
    renderTimer();
    if(timeLeft === 0){ clearInterval(timerId); timerId = null; }
  }, 1000);
};
pauseTimer.onclick = () => { clearInterval(timerId); timerId = null; };
resetTimer.onclick = () => { clearInterval(timerId); timerId = null; timeLeft = 150; renderTimer(); };
renderTimer();

onSnapshot(query(collection(db,'results')), (snap)=>{
  const results=[]; snap.forEach(d=>results.push({id:d.id,...d.data()}));
  results.sort((a,b)=> new Date(b.createdAtLocal||0)-new Date(a.createdAtLocal||0));

  const byTeam={};
  results.forEach(r=>{
    if(!byTeam[r.teamId]) byTeam[r.teamId]={name:r.teamName, TESTE:null, '1':null, '2':null, best:0, updated:r.createdAtLocal};
    const cur=byTeam[r.teamId][r.round];
    if(!cur || r.score > cur.score) byTeam[r.teamId][r.round]=r;
    if(new Date(r.createdAtLocal||0) > new Date(byTeam[r.teamId].updated||0)) byTeam[r.teamId].updated=r.createdAtLocal;
  });
  Object.values(byTeam).forEach(t=>{ t.best=Math.max(t['1']?.score||0, t['2']?.score||0); });
  const ranking=Object.values(byTeam).sort((a,b)=>b.best-a.best || a.name.localeCompare(b.name));
  teamCount.textContent = `${ranking.length} equipes`;

  rankingEl.innerHTML = ranking.length ? ranking.map((t,i)=>{
    const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}º`;
    const width = Math.max(5, Math.min(100, (t.best/470)*100));
    return `<div class="champ-rank-row rank-${i+1}">
      <div class="champ-pos">${medal}</div>
      <div class="champ-team">
        <strong>${t.name}</strong>
        <small>R1: ${t['1']?.score ?? '-'} pts • R2: ${t['2']?.score ?? '-'} pts</small>
        <div class="score-bar"><i style="width:${width}%"></i></div>
      </div>
      <div class="champ-points"><strong>${t.best}</strong><span>pts</span></div>
    </div>`;
  }).join('') : '<p class="empty-state">Aguardando resultados...</p>';

  roundsBody.innerHTML = Object.values(byTeam).sort((a,b)=>a.name.localeCompare(b.name)).map(t=>`<tr><td><strong>${t.name}</strong></td><td>${t.TESTE?.score ?? '-'}</td><td>${t['1']?.score ?? '-'}</td><td>${t['2']?.score ?? '-'}</td><td><span class="best-badge">${t.best} pts</span></td></tr>`).join('');

  if(results[0]) lastResult.innerHTML = `<h3>${results[0].teamName}</h3><div class="last-score">${results[0].score}<span>pts</span></div><p>Round ${results[0].round} • ${fmtDate(results[0].createdAtLocal)}</p>`;
});
