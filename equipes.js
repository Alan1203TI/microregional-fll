import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js';
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const numeroEquipe = document.getElementById('numeroEquipe');
const nomeEquipe = document.getElementById('nomeEquipe');
const nomeRobo = document.getElementById('nomeRobo');
const escolaEquipe = document.getElementById('escolaEquipe');
const addEquipeBtn = document.getElementById('addEquipeBtn');
const listaEquipes = document.getElementById('listaEquipes');
const toast = document.getElementById('toast');

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

addEquipeBtn.addEventListener('click', async () => {
  const nome = nomeEquipe.value.trim();
  if (!nome) return showToast('Informe o nome da equipe.');

  await addDoc(collection(db, 'equipes'), {
    numero: numeroEquipe.value.trim(),
    nome,
    robo: nomeRobo.value.trim(),
    escola: escolaEquipe.value.trim(),
    criadoEm: serverTimestamp()
  });

  numeroEquipe.value = '';
  nomeEquipe.value = '';
  nomeRobo.value = '';
  escolaEquipe.value = '';
  showToast('Equipe adicionada!');
});

const q = query(collection(db, 'equipes'), orderBy('numero'));
onSnapshot(q, snapshot => {
  listaEquipes.innerHTML = '';
  snapshot.docs.forEach(item => {
    const eq = item.data();
    const row = document.createElement('div');
    row.className = 'team-row';
    row.innerHTML = `
      <div>
        <strong>${eq.numero || ''} ${eq.nome || ''}</strong>
        <span>${eq.robo || 'Sem nome do robô'} ${eq.escola ? ' • ' + eq.escola : ''}</span>
      </div>
      <button class="danger" data-id="${item.id}">Excluir</button>
    `;
    listaEquipes.appendChild(row);
  });
});

listaEquipes.addEventListener('click', async e => {
  const btn = e.target.closest('[data-id]');
  if (!btn) return;
  if (!confirm('Excluir esta equipe?')) return;
  await deleteDoc(doc(db, 'equipes', btn.dataset.id));
  showToast('Equipe excluída.');
});
