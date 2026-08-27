// Gantz Web Cloud Display Controller (Multi-Layer Transport + Logcat)
(function() {
  let peer = null;
  let activeConnections = [];
  let localWS = null;
  let broadcastChan = null;
  let roomId = null;
  let typewriterTimeout = null;
  let isMuted = false;

  // Local State
  let aliensList = window.GANTZ_DEFAULT_ALIENS || [];
  let weaponsList = window.GANTZ_DEFAULT_WEAPONS || [];
  let appState = {
    mode: 'standby',
    timer: {
      totalSeconds: 3600,
      remainingSeconds: 3600,
      isRunning: false
    },
    currentAlien: aliensList[0] || null,
    currentWeapon: weaponsList[0] || null,
    broadcastMessage: 'LA HABÉIS PALMADO. AHORA VUESTRAS VIDAS ME PERTENECEN.',
    hunters: [
      { id: 1, name: 'Kei Kurono', nickname: 'Kurono-kun', points: 0, totalPoints: 10, status: 'alive' },
      { id: 2, name: 'Masaru Kato', nickname: 'Gafas Justiciero', points: 0, totalPoints: 0, status: 'alive' },
      { id: 3, name: 'Kei Kishimoto', nickname: 'Chica del Baño', points: 0, totalPoints: 0, status: 'alive' },
      { id: 4, name: 'Yoshikazu Suzuki', nickname: 'Abuelo Solidario', points: 0, totalPoints: 0, status: 'alive' }
    ]
  };

  const appVersion = {
    versionCode: 2,
    versionName: "1.1.0",
    apkUrl: "https://akkarinrothen.github.io/gantz-room/assets/apk/gantz-remote.apk",
    changelog: [
      "Sistema canónico de recompensas de 100 Puntos",
      "Detección inteligente de salas y auto-reconexión WebRTC P2P",
      "Soporte offline nativo sin dependencias de CDNs externos"
    ]
  };

  // DOM Elements
  const sphereAssembly = document.getElementById('sphereAssembly');
  const sphereDoors = document.getElementById('sphereDoors');
  const sphereScreen = document.getElementById('sphereScreen');

  const hudStatusBadge = document.getElementById('hudStatusBadge');
  const hudStatusText = document.getElementById('hudStatusText');
  const hudRoomPin = document.getElementById('hudRoomPin');

  const viewStandby = document.getElementById('viewStandby');
  const standbyText = document.getElementById('standbyText');

  const viewMission = document.getElementById('viewMission');
  const timerDisplay = document.getElementById('timerDisplay');
  const missionTargetBadge = document.getElementById('missionTargetBadge');
  const missionSubstatus = document.getElementById('missionSubstatus');

  const viewBriefing = document.getElementById('viewBriefing');
  const briefingImg = document.getElementById('briefingImg');
  const briefingName = document.getElementById('briefingName');
  const briefingChars = document.getElementById('briefingChars');
  const briefingLikes = document.getElementById('briefingLikes');
  const briefingDislikes = document.getElementById('briefingDislikes');
  const briefingDislikesWrap = document.getElementById('briefingDislikesWrap');
  const briefingQuote = document.getElementById('briefingQuote');

  const viewScoring = document.getElementById('viewScoring');
  const scoringList = document.getElementById('scoringList');

  const viewBroadcast = document.getElementById('viewBroadcast');
  const broadcastBody = document.getElementById('broadcastBody');

  const viewWeapon = document.getElementById('viewWeapon');
  const wpnDisplayImg = document.getElementById('wpnDisplayImg');
  const wpnDisplayIcon = document.getElementById('wpnDisplayIcon');
  const wpnDisplayName = document.getElementById('wpnDisplayName');
  const wpnDisplayCategory = document.getElementById('wpnDisplayCategory');
  const wpnDisplayQuote = document.getElementById('wpnDisplayQuote');
  const wpnClassifiedBox = document.getElementById('wpnClassifiedBox');
  const wpnRevealedBox = document.getElementById('wpnRevealedBox');
  const wpnDisplayMechanics = document.getElementById('wpnDisplayMechanics');
  const wpnDisplayDamage = document.getElementById('wpnDisplayDamage');
  const wpnDisplayRange = document.getElementById('wpnDisplayRange');

  const view100Pts = document.getElementById('view100Pts');
  const rewardHunterTitle = document.getElementById('rewardHunterTitle');
  const rewardCardOpt1 = document.getElementById('rewardCardOpt1');
  const rewardCardOpt2 = document.getElementById('rewardCardOpt2');
  const rewardCardOpt3 = document.getElementById('rewardCardOpt3');
  const rewardResolutionBox = document.getElementById('rewardResolutionBox');
  const rewardResolutionTitle = document.getElementById('rewardResolutionTitle');
  const rewardResolutionBody = document.getElementById('rewardResolutionBody');

  const qrModal = document.getElementById('qrModal');
  const qrPinDisplay = document.getElementById('qrPinDisplay');
  const qrContainer = document.getElementById('qrContainer');
  const qrUrlText = document.getElementById('qrUrlText');
  const btnOpenQR = document.getElementById('btnOpenQR');
  const btnCloseQR = document.getElementById('btnCloseQR');
  const btnCopyPin = document.getElementById('btnCopyPin');
  const btnCopyUrl = document.getElementById('btnCopyUrl');
  const btnAudioToggle = document.getElementById('btnAudioToggle');
  const audioUnlockOverlay = document.getElementById('audioUnlockOverlay');

  // Load saved state
  try {
    const saved = localStorage.getItem('gantz_cloud_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      appState = { ...appState, ...parsed };
      appState.timer.isRunning = false;
    }
  } catch (e) {}

  function saveState() {
    try {
      localStorage.setItem('gantz_cloud_state', JSON.stringify(appState));
    } catch (e) {}
  }

  function log(msg, details) {
    if (window.GantzLogger) window.GantzLogger.log(msg, details);
  }
  function logNet(msg, details) {
    if (window.GantzLogger) window.GantzLogger.net(msg, details);
  }
  function logWarn(msg, details) {
    if (window.GantzLogger) window.GantzLogger.warn(msg, details);
  }
  function logError(msg, details) {
    if (window.GantzLogger) window.GantzLogger.error(msg, details);
  }

  // Copy helper
  function copyToClipboard(text, element, successMsg = '¡COPIADO!') {
    navigator.clipboard.writeText(text).then(() => {
      const origText = element.textContent;
      element.textContent = successMsg;
      element.style.borderColor = '#00ff66';
      element.style.color = '#00ff66';
      log('PIN copiado al portapapeles: ' + text);
      setTimeout(() => {
        element.textContent = origText;
        element.style.borderColor = '';
        element.style.color = '';
      }, 1500);
    }).catch(() => {
      prompt('Copia este código manualmente:', text);
    });
  }

  if (btnCopyPin) {
    btnCopyPin.addEventListener('click', () => copyToClipboard(roomId, btnCopyPin, '✓ ¡PIN COPIADO!'));
  }
  if (btnCopyUrl) {
    btnCopyUrl.addEventListener('click', () => copyToClipboard(qrUrlText.textContent, btnCopyUrl, '✓'));
  }
  if (hudRoomPin) {
    hudRoomPin.addEventListener('click', () => qrModal.classList.add('active'));
  }

  // Audio unlock listener
  function unlockAudio() {
    if (window.GantzAudio) {
      window.GantzAudio.init();
      window.GantzAudio.playClick();
    }
    if (audioUnlockOverlay) {
      audioUnlockOverlay.style.display = 'none';
    }
    log('Audio desbloqueado por interacción del usuario');
  }
  document.addEventListener('click', unlockAudio, { once: true });
  if (audioUnlockOverlay) {
    audioUnlockOverlay.addEventListener('click', unlockAudio);
  }

  // Audio Toggle
  btnAudioToggle.addEventListener('click', () => {
    isMuted = !isMuted;
    if (window.GantzAudio) window.GantzAudio.isMuted = isMuted;
    btnAudioToggle.textContent = isMuted ? '🔇 AUDIO OFF' : '🔊 AUDIO ON';
    btnAudioToggle.style.borderColor = isMuted ? '#ff003c' : '#00f0ff';
    btnAudioToggle.style.color = isMuted ? '#ff003c' : '#00f0ff';
  });

  // QR Modal Toggle
  btnOpenQR.addEventListener('click', () => qrModal.classList.add('active'));
  btnCloseQR.addEventListener('click', () => qrModal.classList.remove('active'));

  function renderQRCode(url) {
    if (typeof QRCode !== 'undefined' && qrContainer) {
      qrContainer.innerHTML = '';
      new QRCode(qrContainer, {
        text: url,
        width: 200,
        height: 200,
        colorDark: "#00ff66",
        colorLight: "#05070a",
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }

  function generateRoomId() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = 'GANTZ-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  function typewrite(element, text, speed = 40, callback) {
    if (typewriterTimeout) clearTimeout(typewriterTimeout);
    element.innerHTML = '<span class="cursor-blink"></span>';
    let idx = 0;
    
    function typeStep() {
      if (idx < text.length) {
        const char = text.charAt(idx);
        const textSpan = element.querySelector('.tw-content') || document.createElement('span');
        if (!element.querySelector('.tw-content')) {
          textSpan.className = 'tw-content';
          element.insertBefore(textSpan, element.querySelector('.cursor-blink'));
        }
        textSpan.textContent += char;
        idx++;
        
        if (char !== ' ' && window.GantzAudio) {
          window.GantzAudio.playTypewriter();
        }

        typewriterTimeout = setTimeout(typeStep, speed);
      } else if (callback) {
        callback();
      }
    }
    typeStep();
  }

  function formatTime(totalSec) {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function setMode(mode) {
    logNet(`Display cambio de modo -> [${mode.toUpperCase()}]`);
    viewStandby.style.display = 'none';
    viewMission.style.display = 'none';
    viewBriefing.style.display = 'none';
    viewScoring.style.display = 'none';
    viewBroadcast.style.display = 'none';
    viewWeapon.style.display = 'none';
    if (view100Pts) view100Pts.style.display = 'none';
    
    sphereAssembly.classList.remove('is-open', 'active-mission');
    sphereDoors.style.display = 'none';

    hudStatusText.textContent = mode.toUpperCase();
    appState.mode = mode;
    saveState();

    switch (mode) {
      case '100pts':
        if (view100Pts) view100Pts.style.display = 'flex';
        const h = appState.rewardHunter || (appState.hunters && appState.hunters[0]);
        if (rewardHunterTitle) {
          rewardHunterTitle.textContent = h ? `${(h.name || 'CAZADOR').toUpperCase()} (${h.totalPoints || 100} PTS)` : 'CAZADOR (100 PTS)';
        }
        [rewardCardOpt1, rewardCardOpt2, rewardCardOpt3].forEach(c => c && c.classList.remove('selected'));
        if (rewardResolutionBox) rewardResolutionBox.style.display = 'none';
        if (window.GantzAudio) window.GantzAudio.playScoreJingle();
        break;
      case 'standby':
        viewStandby.style.display = 'flex';
        typewrite(standbyText, appState.broadcastMessage || 'LA HABÉIS PALMADO. AHORA VUESTRAS VIDAS ME PERTENECEN.');
        break;

      case 'open':
        sphereDoors.style.display = 'block';
        sphereAssembly.classList.add('is-open');
        if (window.GantzAudio) window.GantzAudio.playSphereBoot();
        break;

      case 'briefing':
        viewBriefing.style.display = 'flex';
        if (appState.currentAlien) {
          const alien = appState.currentAlien;
          briefingImg.src = alien.image || 'assets/webp/monsters/alien_cebolla_joven_recortado.webp';
          briefingImg.style.objectPosition = alien.imagePosition || 'center top';
          briefingImg.style.transform = `scale(${alien.imageScale || 1.05})`;
          briefingName.textContent = (alien.name || 'ALIEN').toUpperCase();

          const chars = (alien.characteristics || alien.traits || 'FUERTE').split('\n').map(c => c.trim()).filter(Boolean).join('<br>');
          if (briefingChars) briefingChars.innerHTML = chars || 'FUERTE';

          if (briefingLikes) briefingLikes.textContent = (alien.likes || 'LAS COSAS RARAS').toUpperCase();

          if (alien.dislikes && alien.dislikes.trim()) {
            if (briefingDislikesWrap) briefingDislikesWrap.style.display = 'flex';
            if (briefingDislikes) briefingDislikes.textContent = alien.dislikes.toUpperCase();
          } else {
            if (briefingDislikesWrap) briefingDislikesWrap.style.display = 'none';
          }

          const q = alien.quote || '...';
          if (briefingQuote) briefingQuote.innerHTML = q.replace(/\n/g, '<br>').toUpperCase();
        }
        if (window.GantzAudio) window.GantzAudio.playSphereBoot();
        break;

      case 'weapon':
        viewWeapon.style.display = 'flex';
        if (appState.currentWeapon) {
          const wpn = appState.currentWeapon;
          if (wpnDisplayImg) wpnDisplayImg.src = wpn.image || 'assets/webp/weapons/civil_y_pistola_alienigena_en_retroceso.webp';
          if (wpnDisplayIcon) wpnDisplayIcon.textContent = wpn.icon || '🔫';
          if (wpnDisplayName) wpnDisplayName.textContent = (wpn.name || 'EQUIPAMIENTO').toUpperCase();
          if (wpnDisplayCategory) wpnDisplayCategory.textContent = (wpn.category || 'ARMAMENTO').toUpperCase();
          if (wpnDisplayQuote) wpnDisplayQuote.textContent = wpn.quote ? `"${wpn.quote}"` : '';

          // Check if revealed
          if (wpn.isRevealed) {
            if (wpnClassifiedBox) wpnClassifiedBox.style.display = 'none';
            if (wpnRevealedBox) wpnRevealedBox.style.display = 'flex';
            if (wpnDisplayMechanics) wpnDisplayMechanics.textContent = wpn.secretMechanics || wpn.mechanics || wpn.description;
            if (wpnDisplayDamage) wpnDisplayDamage.textContent = wpn.damageInfo || 'Daño Estándar';
            if (wpnDisplayRange) wpnDisplayRange.textContent = wpn.range || 'Medio';
          } else {
            if (wpnClassifiedBox) wpnClassifiedBox.style.display = 'flex';
            if (wpnRevealedBox) wpnRevealedBox.style.display = 'none';
          }

          if (window.GantzAudio) {
            if (wpn.sound === 'xgun') window.GantzAudio.playXGun();
            else if (wpn.sound === 'ygun') window.GantzAudio.playYGun();
            else if (wpn.sound === 'suit') window.GantzAudio.playSuitSurge();
            else if (wpn.sound === 'sword') window.GantzAudio.playSwordSlash();
            else window.GantzAudio.playClick();
          }
        }
        break;

      case 'mission':
        viewMission.style.display = 'flex';
        sphereAssembly.classList.add('active-mission');
        if (appState.currentAlien) {
          missionTargetBadge.textContent = `OBJETIVO: ${appState.currentAlien.name.toUpperCase()}`;
        }
        updateTimerDisplay();
        break;

      case 'scoring':
        viewScoring.style.display = 'flex';
        renderScoringList(appState.hunters || []);
        if (window.GantzAudio) window.GantzAudio.playScoreJingle();
        break;

      case 'broadcast':
        viewBroadcast.style.display = 'flex';
        typewrite(broadcastBody, appState.broadcastMessage || '¡MOVED EL TRASERO!');
        break;
    }
  }

  function updateTimerDisplay() {
    const remaining = appState.timer.remainingSeconds;
    timerDisplay.textContent = formatTime(remaining);

    if (remaining <= 60 && remaining > 0) {
      sphereAssembly.classList.add('danger');
      missionSubstatus.textContent = '¡¡¡ALERTA: TIEMPO CRÍTICO RESTANTE!!!';
      missionSubstatus.style.color = '#ff003c';
      if (remaining <= 10 && appState.timer.isRunning && window.GantzAudio) {
        window.GantzAudio.playCountdownBeep(remaining === 1);
      }
    } else {
      sphereAssembly.classList.remove('danger');
      missionSubstatus.textContent = appState.timer.isRunning ? 'MISIÓN EN CURSO // CAZA ACTIVA' : 'TEMPORIZADOR EN PAUSA';
      missionSubstatus.style.color = appState.timer.isRunning ? '#00ff66' : '#94a3b8';
    }
  }

  function renderScoringList(hunters) {
    scoringList.innerHTML = '';
    hunters.forEach((h, idx) => {
      const row = document.createElement('div');
      row.className = 'score-row';
      row.innerHTML = `
        <div class="hunter-name-col">
          <div class="hunter-real-name">${idx + 1}. ${h.name}</div>
          <div class="hunter-gantz-nick">"${h.nickname || 'Novato'}"</div>
        </div>
        <div class="hunter-points-col">
          <div>+${h.points || 0} pts</div>
          <div class="hunter-total-pts">Total: ${h.totalPoints || 0}/100</div>
        </div>
      `;
      scoringList.appendChild(row);
      setTimeout(() => {
        row.classList.add('highlight');
        if (window.GantzAudio) window.GantzAudio.playClick();
      }, (idx + 1) * 400);
    });
  }

  // Timer loop on Display
  setInterval(() => {
    if (appState.timer.isRunning && appState.timer.remainingSeconds > 0) {
      appState.timer.remainingSeconds--;
      if (appState.timer.remainingSeconds === 0) {
        appState.timer.isRunning = false;
        if (window.GantzAudio) window.GantzAudio.playAlarm();
        missionSubstatus.textContent = '¡¡¡TIEMPO AGOTADO: TRANSFERENCIA FINALIZADA!!!';
        logWarn('El temporizador ha llegado a cero');
      }
      if (appState.mode === 'mission') {
        updateTimerDisplay();
      }
      sendRemote({ type: 'TIMER_TICK', timer: appState.timer });
    }
  }, 1000);

  // Broadcast to all connected transports
  function sendRemote(msg) {
    msg.source = 'display';
    msg.roomId = roomId;
    
    // 1. WebRTC DataChannels (All connected remotes)
    activeConnections.forEach(conn => {
      if (conn && conn.open) {
        try { conn.send(msg); } catch (e) {}
      }
    });

    // 2. Local WebSocket Relay
    if (localWS && localWS.readyState === WebSocket.OPEN) {
      try { localWS.send(JSON.stringify(msg)); } catch (e) {}
    }
    // 3. Browser BroadcastChannel
    if (broadcastChan) {
      try { broadcastChan.postMessage(msg); } catch (e) {}
    }
    // 4. LocalStorage Cross-Tab Fallback
    try {
      localStorage.setItem('gantz_display_event', JSON.stringify({ ...msg, ts: Date.now() }));
    } catch (e) {}
  }

  // Handle messages from Remote
  function handleRemoteMessage(msg) {
    if (!msg || msg.source === 'display') return;
    logNet(`Comando recibido de Remote [${msg.type}]`, msg);

    switch (msg.type) {
      case 'REQUEST_SYNC':
        logNet('Enviando sincronización de estado a Remote');
        sendRemote({
          type: 'SYNC_STATE',
          state: appState,
          aliens: aliensList,
          weapons: weaponsList,
          roomId: roomId,
          appVersion: appVersion
        });
        break;

      case 'SET_MODE':
        setMode(msg.mode);
        break;

      case 'TIMER_CONTROL':
        if (msg.action === 'start') {
          appState.timer.isRunning = true;
          if (appState.mode !== 'mission') setMode('mission');
        } else if (msg.action === 'pause') {
          appState.timer.isRunning = false;
        } else if (msg.action === 'reset') {
          appState.timer.isRunning = false;
          appState.timer.remainingSeconds = msg.seconds || appState.timer.totalSeconds;
          appState.timer.totalSeconds = msg.seconds || appState.timer.totalSeconds;
        } else if (msg.action === 'adjust') {
          appState.timer.remainingSeconds = Math.max(0, appState.timer.remainingSeconds + (msg.delta || 0));
        } else if (msg.action === 'set') {
          appState.timer.remainingSeconds = msg.seconds;
          appState.timer.totalSeconds = msg.seconds;
        }
        saveState();
        updateTimerDisplay();
        sendRemote({ type: 'TIMER_UPDATED', timer: appState.timer });
        break;

      case 'SELECT_ALIEN':
        appState.currentAlien = msg.alien;
        saveState();
        setMode('briefing');
        break;

      case 'SELECT_WEAPON':
        appState.currentWeapon = msg.weapon;
        saveState();
        setMode('weapon');
        break;

      case 'FIRE_WEAPON':
        if (window.GantzAudio) {
          if (msg.sound === 'xgun') window.GantzAudio.playXGun();
          else if (msg.sound === 'ygun') window.GantzAudio.playYGun();
          else if (msg.sound === 'suit') window.GantzAudio.playSuitSurge();
          else if (msg.sound === 'sword') window.GantzAudio.playSwordSlash();
        }
        break;

      case 'TOGGLE_REVEAL_WEAPON': {
        const wpn = weaponsList.find(w => w.id === msg.weaponId);
        if (wpn) {
          wpn.isRevealed = msg.isRevealed !== undefined ? msg.isRevealed : !wpn.isRevealed;
          if (appState.currentWeapon && appState.currentWeapon.id === wpn.id) {
            appState.currentWeapon = wpn;
            if (appState.mode === 'weapon') setMode('weapon');
          }
          if (wpn.isRevealed && window.GantzAudio) window.GantzAudio.playScoreJingle();
          sendRemote({ type: 'WEAPONS_LIST_UPDATED', weapons: weaponsList });
        }
        break;
      }

      case 'TRIGGER_100PTS_MENU': {
        appState.rewardHunter = msg.hunter;
        appState.rewardResolution = null;
        setMode('100pts');
        break;
      }

      case 'RESOLVE_100PTS_REWARD': {
        const { option, title, body } = msg;
        [rewardCardOpt1, rewardCardOpt2, rewardCardOpt3].forEach(c => c && c.classList.remove('selected'));
        if (option === 1 && rewardCardOpt1) rewardCardOpt1.classList.add('selected');
        if (option === 2 && rewardCardOpt2) rewardCardOpt2.classList.add('selected');
        if (option === 3 && rewardCardOpt3) rewardCardOpt3.classList.add('selected');

        if (rewardResolutionBox) {
          rewardResolutionBox.style.display = 'block';
          if (rewardResolutionTitle) rewardResolutionTitle.textContent = title || '¡DECISIÓN CONFIRMADA!';
          if (rewardResolutionBody) rewardResolutionBody.textContent = body || 'PROCESANDO RECOMPENSA...';
        }
        if (window.GantzAudio) window.GantzAudio.playSphereBoot();
        break;
      }

      case 'SAVE_ALIEN': {
        const idx = aliensList.findIndex(a => a.id === msg.alien.id);
        if (idx >= 0) aliensList[idx] = msg.alien;
        else aliensList.push(msg.alien);
        sendRemote({ type: 'ALIENS_LIST_UPDATED', aliens: aliensList });
        break;
      }

      case 'SAVE_WEAPON': {
        const idx = weaponsList.findIndex(w => w.id === msg.weapon.id);
        if (idx >= 0) weaponsList[idx] = msg.weapon;
        else weaponsList.push(msg.weapon);
        sendRemote({ type: 'WEAPONS_LIST_UPDATED', weapons: weaponsList });
        break;
      }

      case 'BROADCAST_MESSAGE':
        appState.broadcastMessage = msg.message;
        saveState();
        setMode('broadcast');
        break;

      case 'UPDATE_HUNTERS':
        appState.hunters = msg.hunters;
        saveState();
        if (appState.mode === 'scoring') renderScoringList(appState.hunters);
        break;

      case 'TRIGGER_SOUND':
        if (window.GantzAudio) {
          if (msg.sound === 'radio') window.GantzAudio.playRadioTaisou();
          else if (msg.sound === 'alarm') window.GantzAudio.playAlarm();
          else if (msg.sound === 'transfer') window.GantzAudio.playTransferEffect();
          else if (msg.sound === 'boot') window.GantzAudio.playSphereBoot();
          else if (msg.sound === 'score') window.GantzAudio.playScoreJingle();
          else if (msg.sound === 'click') window.GantzAudio.playClick();
          else if (msg.sound === 'xgun') window.GantzAudio.playXGun();
          else if (msg.sound === 'ygun') window.GantzAudio.playYGun();
          else if (msg.sound === 'suit') window.GantzAudio.playSuitSurge();
          else if (msg.sound === 'sword') window.GantzAudio.playSwordSlash();
        }
        break;
    }
  }

  // Multi-layer Transport Initialization
  function initMultiTransport() {
    roomId = generateRoomId();
    hudRoomPin.textContent = `SALA: ${roomId}`;
    qrPinDisplay.textContent = roomId;

    if (window.GantzLogger) {
      window.GantzLogger.updateState('roomId', roomId);
    }

    const currentUrl = new URL(window.location.href);
    currentUrl.pathname = currentUrl.pathname.replace(/\/index\.html$|\/$/, '') + '/remote.html';
    currentUrl.searchParams.set('room', roomId);
    const remoteUrl = currentUrl.toString();

    qrUrlText.textContent = remoteUrl;
    renderQRCode(remoteUrl);

    log(`Sala iniciada con código [${roomId}]`);

    // Layer 1: Try Local WebSocket if on localhost
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      try {
        const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        localWS = new WebSocket(`${wsProtocol}//${location.host}`);
        
        localWS.onopen = () => {
          logNet('⚡ Servidor WebSocket Local Conectado (preview-server)');
          if (window.GantzLogger) window.GantzLogger.updateState('transport', 'WebSocket Local');
        };

        localWS.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleRemoteMessage(data);
          } catch (e) {}
        };

        localWS.onerror = () => {
          logWarn('WebSocket local no disponible, usando WebRTC/BroadcastChannel');
        };
      } catch (e) {}
    }

    // Layer 2: BroadcastChannel for Cross-Tab Sync
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        broadcastChan = new BroadcastChannel('gantz_sync_channel');
        broadcastChan.onmessage = (event) => {
          handleRemoteMessage(event.data);
        };
        logNet('⚡ BroadcastChannel inicializado');
      }
    } catch (e) {}

    // Layer 3: PeerJS WebRTC for Cloud P2P
    try {
      logNet('Conectando a broker PeerJS...');
      if (window.GantzLogger) window.GantzLogger.updateState('brokerStatus', 'Conectando...');

      peer = new Peer(roomId.toLowerCase(), {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      peer.on('open', (id) => {
        logNet(`✓ Broker PeerJS listo. ID Registrado: [${id}]`);
        if (window.GantzLogger) {
          window.GantzLogger.updateState('brokerStatus', 'Online');
          window.GantzLogger.updateState('peerId', id);
        }
        hudStatusBadge.style.borderColor = '#00ff66';
        hudStatusBadge.style.color = '#00ff66';
      });

      peer.on('connection', (conn) => {
        logNet(`Conexión entrante desde Tablet Remote (${conn.peer})`);
        
        // Add to active connections pool
        if (!activeConnections.some(c => c.peer === conn.peer)) {
          activeConnections.push(conn);
        }

        conn.on('open', () => {
          logNet('✓ Canal WebRTC P2P establecido con la tablet');
          if (window.GantzLogger) {
            window.GantzLogger.updateState('webrtcStatus', 'Conectado');
            window.GantzLogger.updateState('transport', 'WebRTC P2P');
          }
          hudStatusBadge.style.borderColor = '#00f0ff';
          hudStatusBadge.style.color = '#00f0ff';
          hudStatusText.textContent = 'TABLET CONECTADA';
          
          sendRemote({
            type: 'SYNC_STATE',
            state: appState,
            aliens: aliensList,
            weapons: weaponsList,
            roomId: roomId,
            appVersion: appVersion
          });
          if (window.GantzAudio) window.GantzAudio.playClick();
        });

        conn.on('data', (data) => {
          handleRemoteMessage(data);
        });

        conn.on('close', () => {
          logWarn('Canal WebRTC cerrado por la tablet');
          activeConnections = activeConnections.filter(c => c.peer !== conn.peer);
          if (activeConnections.length === 0) {
            if (window.GantzLogger) window.GantzLogger.updateState('webrtcStatus', 'Cerrado');
            hudStatusBadge.style.borderColor = '#ff003c';
            hudStatusBadge.style.color = '#ff003c';
            hudStatusText.textContent = 'STANDBY';
          }
        });

        conn.on('error', (err) => {
          logError('Error en conexión WebRTC:', err);
        });
      });

      peer.on('error', (err) => {
        logError('Error en PeerJS Broker:', err);
        if (window.GantzLogger) window.GantzLogger.updateState('brokerStatus', 'Error: ' + err.type);
        if (err.type === 'unavailable-id') {
          setTimeout(initMultiTransport, 1000);
        }
      });
    } catch (err) {
      logError('Error inicializando PeerJS:', err);
    }

    // Layer 4: LocalStorage Event Listener for Cross-Tab sync
    try {
      window.addEventListener('storage', (e) => {
        if (e.key === 'gantz_remote_event' && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            if (data && data.source === 'remote') {
              handleRemoteMessage(data);
            }
          } catch (err) {}
        }
      });
    } catch (e) {}
  }

  window.forceReconnectGantz = function() {
    log('Forzando reinicio de conexiones de red...');
    if (peer) try { peer.destroy(); } catch (e) {}
    if (localWS) try { localWS.close(); } catch (e) {}
    initMultiTransport();
  };

  // Boot
  setMode('standby');
  initMultiTransport();
})();
