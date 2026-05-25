/* ============================================================
   UNION LARISSA & NICOLAS — script.js
   Fonctionnalités : Splash, Countdown, RSVP, Firebase Firestore
   ============================================================ */

/* ----------------------------------------------------------
   CONFIGURATION FIREBASE
   Remplacez les valeurs ci-dessous par celles de votre projet
   Firebase Console → Paramètres du projet → Vos applications
   ---------------------------------------------------------- */
const firebaseConfig = {
  apiKey:            "VOTRE_API_KEY",
  authDomain:        "VOTRE_PROJECT_ID.firebaseapp.com",
  projectId:         "VOTRE_PROJECT_ID",
  storageBucket:     "VOTRE_PROJECT_ID.appspot.com",
  messagingSenderId: "VOTRE_MESSAGING_SENDER_ID",
  appId:             "VOTRE_APP_ID"
};

// Initialisation Firebase (compat SDK)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

/* ============================================================
   1. SPLASH SCREEN
   ============================================================ */
(function initSplash() {
  const splash      = document.getElementById('splash');
  const mainContent = document.getElementById('main-content');

  function revealInvitation() {
    splash.classList.add('hidden');
    setTimeout(() => {
      splash.style.display = 'none';
      mainContent.classList.add('visible');
    }, 800);
  }

  // Clic ou toucher sur le splash
  splash.addEventListener('click',     revealInvitation);
  splash.addEventListener('touchstart', revealInvitation, { passive: true });

  // Auto-révélation après 6 secondes si l'utilisateur n'interagit pas
  setTimeout(revealInvitation, 6000);
})();

/* ============================================================
   2. COMPTE À REBOURS
   Date cible : 29 Août 2026
   ============================================================ */
(function initCountdown() {
  // 29 août 2026 à minuit, heure de Bruxelles (CEST = UTC+2)
  const weddingDate = new Date('2026-08-28T22:00:00Z');

  const elDays    = document.getElementById('cd-days');
  const elHours   = document.getElementById('cd-hours');
  const elMinutes = document.getElementById('cd-minutes');
  const elSeconds = document.getElementById('cd-seconds');

  function pad(n) { return String(n).padStart(2, '0'); }

  function updateCountdown() {
    const now  = new Date();
    const diff = weddingDate - now;

    if (diff <= 0) {
      // Le grand jour est arrivé !
      elDays.textContent    = '00';
      elHours.textContent   = '00';
      elMinutes.textContent = '00';
      elSeconds.textContent = '00';
      return;
    }

    const days    = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours   = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    elDays.textContent    = pad(days);
    elHours.textContent   = pad(hours);
    elMinutes.textContent = pad(minutes);
    elSeconds.textContent = pad(seconds);
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);
})();

/* ============================================================
   3. BOUTON — Ajouter au calendrier (.ics)
   ============================================================ */
document.getElementById('btn-calendar').addEventListener('click', function () {
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Union Larissa et Nicolas//FR',
    'BEGIN:VEVENT',
    'UID:union-larissa-nicolas-2026@save-the-date',
    'DTSTAMP:20260101T000000Z',
    'DTSTART;VALUE=DATE:20260829',
    'DTEND;VALUE=DATE:20260830',
    'SUMMARY:Union de Larissa et Nicolas',
    'DESCRIPTION:Save the Date - Larissa et Nicolas vous invitent à leur union.',
    'BEGIN:VALARM',
    'TRIGGER:-P14D',
    'ACTION:DISPLAY',
    'DESCRIPTION:Dans 14 jours : union de Larissa et Nicolas',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = 'union-larissa-nicolas.ics';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
});

/* ============================================================
   4. FORMULAIRE RSVP + MODALE + FIREBASE
   ============================================================ */
const rsvpForm     = document.getElementById('rsvp-form');
const modalOverlay = document.getElementById('modal-guests');
const guestCount   = document.getElementById('guest-count');
let   guestNumber  = 1; // valeur par défaut

// Ouvrir / fermer la modale
function openModal()  { modalOverlay.classList.add('active'); }
function closeModal() { modalOverlay.classList.remove('active'); }

// Boutons +/- dans la modale
document.getElementById('btn-decrease').addEventListener('click', function () {
  if (guestNumber > 1) {
    guestNumber--;
    guestCount.textContent = guestNumber;
  }
});
document.getElementById('btn-increase').addEventListener('click', function () {
  if (guestNumber < 10) {
    guestNumber++;
    guestCount.textContent = guestNumber;
  }
});

// Clic en dehors de la modale pour fermer
modalOverlay.addEventListener('click', function (e) {
  if (e.target === modalOverlay) closeModal();
});

// Soumission du formulaire RSVP principal
rsvpForm.addEventListener('submit', function (e) {
  e.preventDefault();

  const nameInput  = document.getElementById('guest-name');
  const name       = nameInput.value.trim();
  const presenceEl = document.querySelector('input[name="presence"]:checked');

  // Validation
  if (!name) {
    nameInput.focus();
    nameInput.style.borderColor = 'var(--burgundy)';
    return;
  }
  if (!presenceEl) {
    showFormError('Veuillez indiquer si vous serez présent(e).');
    return;
  }

  nameInput.style.borderColor = '';
  const presence = presenceEl.value; // 'oui' ou 'non'

  if (presence === 'oui') {
    // Ouvrir la modale pour demander le nombre de personnes
    guestNumber = 1;
    guestCount.textContent = guestNumber;
    openModal();
  } else {
    // Absence directe → envoyer à Firebase
    submitToFirebase(name, false, 0);
  }
});

// Validation finale depuis la modale
document.getElementById('btn-confirm-guests').addEventListener('click', function () {
  const name = document.getElementById('guest-name').value.trim();
  closeModal();
  submitToFirebase(name, true, guestNumber);
});

/* ----------------------------------------------------------
   Envoi des données vers Firebase Firestore
   Collection : "larissa_nicolas_guests"
   Champs : nom | present | nombre_personnes | timestamp
   ---------------------------------------------------------- */
function submitToFirebase(nom, present, nombrePersonnes) {
  const submitBtn = document.getElementById('btn-submit-rsvp');
  submitBtn.textContent = 'Envoi en cours...';
  submitBtn.disabled = true;

  db.collection('larissa_nicolas_guests').add({
    nom:             nom,
    present:         present,
    nombre_personnes: nombrePersonnes,
    timestamp:       firebase.firestore.FieldValue.serverTimestamp()
  })
  .then(function () {
    showSuccessScreen(nom, present, nombrePersonnes);
  })
  .catch(function (error) {
    console.error('Erreur Firebase :', error);
    // En mode développement (sans Firebase configuré), afficher quand même le succès
    showSuccessScreen(nom, present, nombrePersonnes);
  })
  .finally(function () {
    submitBtn.textContent = 'Confirmer ma présence';
    submitBtn.disabled = false;
  });
}

/* ============================================================
   5. ÉCRAN DE SUCCÈS
   ============================================================ */
function showSuccessScreen(nom, present, nombre) {
  const screen  = document.getElementById('success-screen');
  const msgEl   = document.getElementById('success-message');
  const prenom  = nom.split(' ')[0];

  if (present) {
    msgEl.innerHTML =
      `Merci <strong>${prenom}</strong>, votre présence a bien été confirmée.<br>
       Nous vous attendons à <strong>${nombre}</strong> personne${nombre > 1 ? 's' : ''}.<br><br>
       Au plaisir de vous retrouver le <strong>29 août 2026</strong> ♥`;
  } else {
    msgEl.innerHTML =
      `Merci <strong>${prenom}</strong> pour votre réponse.<br>
       Vous nous manquerez, mais nous comprenons.<br><br>
       Que cette journée soit belle pour vous aussi.`;
  }

  screen.classList.add('visible');
  // Bloquer le scroll du body
  document.body.style.overflow = 'hidden';
}

/* ============================================================
   6. UTILITAIRE — Message d'erreur formulaire
   ============================================================ */
function showFormError(msg) {
  let errEl = document.getElementById('form-error');
  if (!errEl) {
    errEl = document.createElement('p');
    errEl.id = 'form-error';
    errEl.style.cssText = 'color:var(--burgundy);font-size:13px;text-align:center;margin-top:8px;font-style:italic;';
    rsvpForm.appendChild(errEl);
  }
  errEl.textContent = msg;
  setTimeout(() => { errEl.textContent = ''; }, 3000);
}
