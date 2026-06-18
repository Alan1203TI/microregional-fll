import { db } from './firebase-init.js';
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const DEFAULT_BANNER = 'assets/fundo-bioglow.png';
const DEFAULT_BACKGROUND = 'assets/fundo-bioglow.png';

function safeUrl(value, fallback) {
  const text = String(value || '').trim();
  if (!text) return fallback;
  return text;
}

function applyVisualSettings(settings = {}) {
  const bannerUrl = safeUrl(settings.bannerUrl, DEFAULT_BANNER);
  const backgroundUrl = safeUrl(settings.backgroundUrl, DEFAULT_BACKGROUND);

  document.documentElement.style.setProperty('--custom-banner-bg', `url("${bannerUrl}")`);
  document.documentElement.style.setProperty('--custom-page-bg', `url("${backgroundUrl}")`);
}

applyVisualSettings();

onSnapshot(doc(db, 'settings', 'visual'), (snap) => {
  if (snap.exists()) {
    applyVisualSettings(snap.data());
  } else {
    applyVisualSettings();
  }
}, () => applyVisualSettings());
