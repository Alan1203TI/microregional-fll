import { db } from './firebase-init.js';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const form = document.getElementById('teamForm');
const input = document.getElementById('teamName');
const list = document.getElementById('teamsList');

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

if (form && input) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = input.value.trim();
    if (!name) return;

    await addDoc(collection(db, 'teams'), {
      name,
      info: '',
      createdAt: serverTimestamp()
    });

    input.value = '';
    input.focus();
  });
}

if (list) {
  const q = query(collection(db, 'teams'), orderBy('name'));

  onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      list.innerHTML = '<p class="muted">Nenhuma equipe cadastrada ainda.</p>';
      return;
    }

    list.innerHTML = snapshot.docs.map((item) => {
      const data = item.data();
      return `
        <div class="team-row">
          <span>${escapeHtml(data.name)}</span>
          <button class="btn red small" type="button" data-id="${item.id}">Excluir</button>
        </div>
      `;
    }).join('');
  });

  list.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-id]');
    if (!btn) return;
    if (!confirm('Excluir esta equipe?')) return;
    await deleteDoc(doc(db, 'teams', btn.dataset.id));
  });
}
