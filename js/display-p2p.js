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
    radarVisible: true,
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

  // Inspection Mode Elements
  const viewInspect = document.getElementById('viewInspect');
  const inspectHudTag = document.getElementById('inspectHudTag');
  const inspectTargetName = document.getElementById('inspectTargetName');
  const inspectTargetSub = document.getElementById('inspectTargetSub');
  const inspectZoomBadge = document.getElementById('inspectZoomBadge');
  const inspectLensInfo = document.getElementById('inspectLensInfo');
  const inspectViewport = document.getElementById('inspectViewport');
  const inspectImgFrame = document.getElementById('inspectImgFrame');
  const inspectMainImg = document.getElementById('inspectMainImg');
  const inspectHudFooter = document.getElementById('inspectHudFooter');
  const inspectFooterQuote = document.getElementById('inspectFooterQuote');
  const inspectStatPill1 = document.getElementById('inspectStatPill1');
  const inspectStatPill2 = document.getElementById('inspectStatPill2');

  // Tactical Radar Mode Elements
  const viewRadar = document.getElementById('viewRadar');
  const miniRadar = document.getElementById('miniRadar');
  const miniBlipTarget = document.getElementById('miniBlipTarget');
  const miniBlipHunter = document.getElementById('miniBlipHunter');
  const miniBlipsMinions = document.getElementById('miniBlipsMinions');
  const tacticalBlipTarget = document.getElementById('tacticalBlipTarget');
  const tacticalBlipHunter = document.getElementById('tacticalBlipHunter');
  const tacticalMinionsContainer = document.getElementById('tacticalMinionsContainer');
  const radarTargetLabel = document.getElementById('radarTargetLabel');
  const radarHunterLabel = document.getElementById('radarHunterLabel');
  const radarMetricMeters = document.getElementById('radarMetricMeters');
  const radarMetricThreat = document.getElementById('radarMetricThreat');
  const radarStatusBadge = document.getElementById('radarStatusBadge');
  const radarPerimeterWarning = document.getElementById('radarPerimeterWarning');

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

  // Radar Visibility Toggle
  const btnRadarToggle = document.getElementById('btnRadarToggle');
  function setRadarVisibility(visible, notify = true) {
    appState.radarVisible = Boolean(visible);
    if (miniRadar) {
      miniRadar.classList.toggle('radar-hidden', !appState.radarVisible);
    }
    if (btnRadarToggle) {
      btnRadarToggle.textContent = appState.radarVisible ? '📡 RADAR ON' : '📡 RADAR OFF';
      btnRadarToggle.style.borderColor = appState.radarVisible ? '#00ff66' : '#94a3b8';
      btnRadarToggle.style.color = appState.radarVisible ? '#00ff66' : '#94a3b8';
    }
    if (notify && window.GantzAudio) {
      if (appState.radarVisible) window.GantzAudio.playRadarPing();
      else window.GantzAudio.playRadarSignalLost();
    }
    saveState();
  }

  if (btnRadarToggle) {
    btnRadarToggle.addEventListener('click', () => {
      setRadarVisibility(!appState.radarVisible, true);
      sendRemote({
        type: 'RADAR_VISIBILITY_STATE',
        visible: appState.radarVisible
      });
    });
  }

  // CRT Filter Toggle
  const crtOverlay = document.getElementById('crtOverlay');
  const btnCrtToggle = document.getElementById('btnCrtToggle');
  if (btnCrtToggle && crtOverlay) {
    btnCrtToggle.addEventListener('click', () => {
      const active = crtOverlay.classList.toggle('active');
      btnCrtToggle.textContent = active ? '📺 CRT ON' : '📺 CRT OFF';
      btnCrtToggle.style.borderColor = active ? '#00ff66' : '#94a3b8';
      btnCrtToggle.style.color = active ? '#00ff66' : '#94a3b8';
    });
  }

  // QR Modal Toggle & Tabs (Master vs Players)
  const btnQrTypeMaster = document.getElementById('btnQrTypeMaster');
  const btnQrTypePlayers = document.getElementById('btnQrTypePlayers');
  const qrInstructionsText = document.getElementById('qrInstructionsText');
  let currentQrTarget = 'remote'; // 'remote' or 'player'

  function updateQrDisplay() {
    const origin = window.location.origin + window.location.pathname.replace('index.html', '');
    const cleanOrigin = origin.endsWith('/') ? origin : origin + '/';
    const targetFile = currentQrTarget === 'player' ? 'player.html' : 'remote.html';
    const url = `${cleanOrigin}${targetFile}?room=${roomId}`;
    renderQRCode(url);
    if (qrUrlText) qrUrlText.textContent = url;
    if (qrInstructionsText) {
      qrInstructionsText.textContent = currentQrTarget === 'player' 
        ? 'Escanea para vincular la pantalla del jugador (Traje G-Suit, Radar y Estado):'
        : 'Escanea con la tablet del Master para controlar la partida:';
    }
  }

  if (btnQrTypeMaster && btnQrTypePlayers) {
    btnQrTypeMaster.addEventListener('click', () => {
      currentQrTarget = 'remote';
      btnQrTypeMaster.style.background = 'rgba(0,240,255,0.2)';
      btnQrTypeMaster.style.color = '#fff';
      btnQrTypePlayers.style.background = 'transparent';
      btnQrTypePlayers.style.color = 'var(--gantz-green)';
      updateQrDisplay();
    });

    btnQrTypePlayers.addEventListener('click', () => {
      currentQrTarget = 'player';
      btnQrTypePlayers.style.background = 'rgba(0,255,102,0.2)';
      btnQrTypePlayers.style.color = '#fff';
      btnQrTypeMaster.style.background = 'transparent';
      btnQrTypeMaster.style.color = 'var(--gantz-cyan)';
      updateQrDisplay();
    });
  }

  btnOpenQR.addEventListener('click', () => {
    updateQrDisplay();
    qrModal.classList.add('active');
  });
  btnCloseQR.addEventListener('click', () => qrModal.classList.remove('active'));

  function renderQRCode(url) {
    if (typeof QRCode !== 'undefined' && qrContainer) {
      qrContainer.innerHTML = '';
      new QRCode(qrContainer, {
        text: url,
        width: 200,
        height: 200,
        colorDark: currentQrTarget === 'player' ? "#00f0ff" : "#00ff66",
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
    if (viewRadar) viewRadar.style.display = 'none';
    if (view100Pts) view100Pts.style.display = 'none';
    if (viewInspect) viewInspect.style.display = 'none';
    
    sphereAssembly.classList.remove('is-open', 'active-mission');
    sphereDoors.style.display = 'none';

    hudStatusText.textContent = mode.toUpperCase();
    if (mode !== 'inspect') {
      appState.previousMode = appState.mode;
    }
    appState.mode = mode;
    saveState();

    switch (mode) {
      case 'inspect':
        if (viewInspect) viewInspect.style.display = 'flex';
        if (window.GantzAudio && typeof window.GantzAudio.playTacticalScan === 'function') {
          window.GantzAudio.playTacticalScan();
        } else if (window.GantzAudio) {
          window.GantzAudio.playSphereBoot();
        }
        break;
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
          const posParts = (alien.imagePosition || '50% 0%').split(' ');
          const px = parseFloat(posParts[0]) || 50;
          const py = parseFloat(posParts[1]) || 0;
          const s = parseFloat(alien.imageScale) || 1.05;
          const tx = (-(px - 50) * 0.85).toFixed(2);
          const ty = (-(py - 0) * 0.85).toFixed(2);
          briefingImg.style.transform = `translate(${tx}%, ${ty}%) scale(${s})`;
          briefingImg.style.transformOrigin = 'center top';
          briefingName.textContent = (alien.name || 'ALIEN').toUpperCase();

          const chars = (alien.characteristics || alien.traits || 'FUERTE').split('\n').map(c => c.trim()).filter(Boolean).join('<br>');
          if (briefingChars) briefingChars.innerHTML = chars || 'FUERTE';

          if (briefingLikes) briefingLikes.textContent = (alien.likes || 'LAS COSAS RARAS').toUpperCase();

          if (alien.dislikes) {
            if (briefingDislikesWrap) briefingDislikesWrap.style.display = 'block';
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

      case 'radar':
        if (viewRadar) viewRadar.style.display = 'flex';
        if (radarTargetLabel && appState.currentAlien) {
          radarTargetLabel.textContent = `OBJETIVO: ${(appState.currentAlien.name || 'ALIEN').toUpperCase()}`;
        }
        if (window.GantzAudio) window.GantzAudio.playClick();
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
      const suit = h.suitIntegrity !== undefined ? h.suitIntegrity : 100;
      const suitColor = suit > 50 ? '#00ff66' : (suit > 0 ? '#00f0ff' : '#ff003c');
      const suitLabel = suit === 100 ? '🛡️ Traje 100%' : (suit === 50 ? '⚡ Traje Fisurado (50%)' : '💥 Traje Roto (0%)');
      const isDead = h.status === 'dead';

      row.innerHTML = `
        <div class="hunter-name-col">
          <div class="hunter-real-name">${idx + 1}. ${escapeHtml(h.name)} ${isDead ? '<span style="color: #ff003c; font-size: 0.72rem; font-weight: bold;">[💀 MUERTO]</span>' : ''}</div>
          <div class="hunter-gantz-nick">"${escapeHtml(h.nickname || 'Novato')}" • <span style="color: ${suitColor}; font-size: 0.72rem;">${suitLabel}</span></div>
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

  function renderCeremonyRoast(targetHunter, roastText) {
    if (!appState.hunters) return;
    scoringList.innerHTML = '';

    appState.hunters.forEach((h, idx) => {
      const row = document.createElement('div');
      const isTarget = targetHunter && (String(h.id) === String(targetHunter.id) || h.name === targetHunter.name);
      row.className = `score-row ${isTarget ? 'highlight' : ''}`;
      if (isTarget) {
        row.style.borderColor = 'var(--gantz-gold)';
        row.style.background = 'rgba(255, 215, 0, 0.14)';
        row.style.boxShadow = '0 0 25px rgba(255, 215, 0, 0.4)';
      }

      const suit = h.suitIntegrity !== undefined ? h.suitIntegrity : 100;
      const suitColor = suit > 50 ? '#00ff66' : (suit > 0 ? '#00f0ff' : '#ff003c');
      const suitLabel = suit === 100 ? '🛡️ Traje 100%' : (suit === 50 ? '⚡ Traje Fisurado (50%)' : '💥 Traje Roto (0%)');
      const isDead = h.status === 'dead';

      row.innerHTML = `
        <div class="hunter-name-col" style="flex: 1;">
          <div class="hunter-real-name" style="${isTarget ? 'color: var(--gantz-gold); font-size: 1.15rem; font-weight: bold;' : ''}">
            ${idx + 1}. ${escapeHtml(h.name)} ${isDead ? '<span style="color: #ff003c; font-size: 0.72rem; font-weight: bold;">[💀 MUERTO]</span>' : ''}
          </div>
          <div class="hunter-gantz-nick">"${escapeHtml(h.nickname || 'Novato')}" • <span style="color: ${suitColor}; font-size: 0.72rem;">${suitLabel}</span></div>
          ${isTarget && roastText ? `<div style="margin-top: 8px; padding: 8px 12px; background: rgba(0,0,0,0.75); border-left: 4px solid #00ff66; color: #00ff66; font-family: monospace; font-size: 0.92rem; border-radius: 4px; box-shadow: 0 0 15px rgba(0,255,102,0.2);">🗣️ "${escapeHtml(roastText)}"</div>` : ''}
        </div>
        <div class="hunter-points-col">
          <div style="${isTarget ? 'color: var(--gantz-gold); font-size: 1.25rem; font-weight: bold;' : ''}">+${h.points || 0} pts</div>
          <div class="hunter-total-pts">Total: ${h.totalPoints || 0}/100</div>
        </div>
      `;
      scoringList.appendChild(row);
    });

    if (window.GantzAudio) window.GantzAudio.playClick();
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

      case 'SAVE_ALIEN': {
        const alien = msg.alien;
        if (alien) {
          const idx = aliensList.findIndex(a => a.id === alien.id);
          if (idx >= 0) aliensList[idx] = alien;
          else aliensList.push(alien);

          if (appState.currentAlien && appState.currentAlien.id === alien.id) {
            appState.currentAlien = alien;
            if (appState.mode === 'briefing') {
              setMode('briefing');
            }
          }
          saveState();
          sendRemote({ type: 'ALIENS_LIST_UPDATED', aliens: aliensList });
        }
        break;
      }

      case 'LIVE_ALIEN_FRAMING': {
        if (briefingImg && appState.mode === 'briefing') {
          const px = msg.posX !== undefined ? parseFloat(msg.posX) : 50;
          const py = msg.posY !== undefined ? parseFloat(msg.posY) : 0;
          const s = msg.scale !== undefined ? parseFloat(msg.scale) : 1.05;
          const tx = (-(px - 50) * 0.85).toFixed(2);
          const ty = (-(py - 0) * 0.85).toFixed(2);
          briefingImg.style.transform = `translate(${tx}%, ${ty}%) scale(${s})`;
          briefingImg.style.transformOrigin = 'center top';
        }
        break;
      }

      case 'SELECT_WEAPON':
        appState.currentWeapon = msg.weapon;
        saveState();
        setMode('weapon');
        break;

      case 'SAVE_WEAPON': {
        const wpn = msg.weapon;
        if (wpn) {
          const idx = weaponsList.findIndex(w => w.id === wpn.id);
          if (idx >= 0) weaponsList[idx] = wpn;
          else weaponsList.push(wpn);

          if (appState.currentWeapon && appState.currentWeapon.id === wpn.id) {
            appState.currentWeapon = wpn;
            if (appState.mode === 'weapon') {
              setMode('weapon');
            }
          }
          saveState();
          sendRemote({ type: 'WEAPONS_LIST_UPDATED', weapons: weaponsList });
        }
        break;
      }

      case 'INSPECT_MEDIA': {
        const { image, title, subtitle, quote, stat1, stat2, tag, scale, posX, posY } = msg;
        const s = parseFloat(scale || 1.0);
        const px = posX !== undefined ? parseFloat(posX) : 50;
        const py = posY !== undefined ? parseFloat(posY) : 50;
        const maxPan = Math.max(30, (s - 0.7) * 50);
        const tx = (((50 - px) / 50) * maxPan).toFixed(2);
        const ty = (((50 - py) / 50) * maxPan).toFixed(2);

        if (inspectMainImg) {
          inspectMainImg.src = image || 'assets/webp/monsters/alien_cebolla_joven_recortado.webp';
          inspectMainImg.style.transform = `translate(${tx}%, ${ty}%) scale(${s})`;
        }
        if (inspectTargetName) inspectTargetName.textContent = (title || 'OBJETIVO').toUpperCase();
        if (inspectTargetSub) inspectTargetSub.textContent = (subtitle || 'ANÁLISIS BIOMÉTRICO').toUpperCase();
        if (inspectHudTag) inspectHudTag.textContent = tag || '🔬 ANÁLISIS ÓPTICO // GANTZ HUD';
        if (inspectFooterQuote) inspectFooterQuote.textContent = quote ? `"${quote}"` : '"VUESTRAS VIDAS ME PERTENECEN."';
        if (inspectStatPill1) inspectStatPill1.textContent = stat1 || '🎯 BLANCO FIJADO';
        if (inspectStatPill2) inspectStatPill2.textContent = stat2 || '⚡ ANÁLISIS ÓPTICO EN VIVO';
        if (inspectZoomBadge) inspectZoomBadge.textContent = `ZOOM ${s.toFixed(2)}x`;
        if (inspectLensInfo) inspectLensInfo.textContent = `POSICIÓN: ${Math.round(px)}% X / ${Math.round(py)}% Y`;

        appState.inspectData = msg;
        setMode('inspect');
        break;
      }

      case 'INSPECT_ZOOM_UPDATE': {
        const { scale, posX, posY } = msg;
        const s = scale !== undefined ? parseFloat(scale) : 1.0;
        const px = posX !== undefined ? parseFloat(posX) : 50;
        const py = posY !== undefined ? parseFloat(posY) : 50;
        const maxPan = Math.max(30, (s - 0.7) * 50);
        const tx = (((50 - px) / 50) * maxPan).toFixed(2);
        const ty = (((50 - py) / 50) * maxPan).toFixed(2);

        if (inspectMainImg) {
          inspectMainImg.style.transform = `translate(${tx}%, ${ty}%) scale(${s})`;
        }
        if (inspectZoomBadge && scale !== undefined) {
          inspectZoomBadge.textContent = `ZOOM ${s.toFixed(2)}x`;
        }
        if (inspectLensInfo) {
          inspectLensInfo.textContent = `POSICIÓN: ${Math.round(px)}% X / ${Math.round(py)}% Y`;
        }
        break;
      }

      case 'CLOSE_INSPECT': {
        const returnMode = appState.previousMode || (appState.currentAlien ? 'briefing' : (appState.currentWeapon ? 'weapon' : 'standby'));
        if (window.GantzAudio) window.GantzAudio.playClick();
        setMode(returnMode === 'inspect' ? 'briefing' : returnMode);
        break;
      }

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

      case 'EVALUATE_HUNTER_CEREMONY':
        if (appState.mode !== 'scoring') setMode('scoring');
        renderCeremonyRoast(msg.hunter, msg.text);
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
          else if (msg.sound === 'zgun') window.GantzAudio.playZGun();
          else if (msg.sound && msg.sound.startsWith('voice_')) window.GantzAudio.playVoiceLine(msg.sound.replace('voice_', ''));
        }
        break;

      case 'PING':
        sendRemote({ type: 'PONG', timestamp: msg.timestamp, serverTime: Date.now() });
        break;

      case 'LASER_POINTER':
        if (hologramLaserPointer) {
          if (msg.active) {
            hologramLaserPointer.classList.add('active');
            hologramLaserPointer.style.left = (msg.x * 100) + 'vw';
            hologramLaserPointer.style.top = (msg.y * 100) + 'vh';
          } else {
            hologramLaserPointer.classList.remove('active');
          }
        }
        break;

      case 'SET_VOLUME':
        if (window.GantzAudio && typeof window.GantzAudio.setMasterVolume === 'function') {
          window.GantzAudio.setMasterVolume(msg.volume);
          log(`Volumen maestro ajustado a ${Math.round(msg.volume * 100)}%`);
        }
        break;

      case 'STOP_ALL_AUDIO':
        if (window.GantzAudio && typeof window.GantzAudio.stopAll === 'function') {
          window.GantzAudio.stopAll();
          log('Todos los audios detenidos por el Master');
        }
        if (window.GantzTTS) window.GantzTTS.stop();
        break;

      case 'PLAY_TTS':
        if (msg.audioBase64) {
          if (window.GantzTTS) {
            window.GantzTTS.playAudioUri(msg.audioBase64).catch(e => {
              log('Error reproduciendo audio TTS en display:', e);
            });
          } else {
            const a = new Audio(msg.audioBase64);
            a.play().catch(() => {});
          }
          log(`🎙️ Locución ElevenLabs de Gantz recibida: "${(msg.text || '').slice(0, 35)}..."`);
        }
        break;

      case 'STOP_TTS':
        if (window.GantzTTS) window.GantzTTS.stop();
        break;

      case 'TOGGLE_CRT':
        if (crtOverlay) {
          const isActive = msg.enabled !== undefined ? msg.enabled : !crtOverlay.classList.contains('active');
          crtOverlay.classList.toggle('active', isActive);
          if (btnCrtToggle) {
            btnCrtToggle.textContent = isActive ? '📺 CRT ON' : '📺 CRT OFF';
            btnCrtToggle.style.borderColor = isActive ? '#00ff66' : '#94a3b8';
            btnCrtToggle.style.color = isActive ? '#00ff66' : '#94a3b8';
          }
          log(`Filtro CRT ${isActive ? 'activado' : 'desactivado'} desde control remoto`);
        }
        break;

      case 'INITIATIVE_UPDATE': {
        const hudActiveTurn = document.getElementById('hudActiveTurn');
        if (hudActiveTurn) {
          if (msg.activeName) {
            hudActiveTurn.style.display = 'inline-block';
            hudActiveTurn.textContent = `⚔️ ${msg.round ? `ASALTO #${msg.round} // ` : ''}TURNO: ${msg.activeName.toUpperCase()}`;
          } else {
            hudActiveTurn.style.display = 'none';
          }
        }
        break;
      }

      case 'COMBAT_EVENT': {
        handleDisplayCombatEvent(msg);
        break;
      }

      case 'RADAR_UPDATE':
        updateRadarDisplay(msg);
        if (msg.ping && window.GantzAudio) {
          window.GantzAudio.playRadarPing();
        }
        if (msg.threatAlert && window.GantzAudio) {
          window.GantzAudio.playRadarThresholdAlert();
        }
        break;

      case 'RADAR_PING':
        if (window.GantzAudio) window.GantzAudio.playRadarPing();
        triggerRadarPingVisual();
        break;

      case 'RADAR_VISIBILITY':
        setRadarVisibility(msg.visible !== undefined ? msg.visible : true, true);
        break;

      case 'TOGGLE_RADAR':
        setRadarVisibility(!appState.radarVisible, true);
        break;

      case 'RADAR_STEALTH':
        if (window.GantzAudio) window.GantzAudio.playRadarSignalLost();
        if (msg.isStealth) {
          if (miniBlipTarget) miniBlipTarget.style.display = 'none';
          if (tacticalBlipTarget) tacticalBlipTarget.style.display = 'none';
          if (radarStatusBadge) {
            radarStatusBadge.textContent = '⚠️ SEÑAL PERDIDA';
            radarStatusBadge.style.borderColor = '#ff003c';
            radarStatusBadge.style.color = '#ff003c';
            radarStatusBadge.style.background = 'rgba(255,0,60,0.2)';
          }
        } else {
          if (miniBlipTarget) miniBlipTarget.style.display = 'block';
          if (tacticalBlipTarget) tacticalBlipTarget.style.display = 'flex';
          if (radarStatusBadge) {
            radarStatusBadge.textContent = '🟢 HUD ACTIVO';
            radarStatusBadge.style.borderColor = '#00ff66';
            radarStatusBadge.style.color = '#00ff66';
            radarStatusBadge.style.background = 'rgba(0,255,102,0.15)';
          }
        }
        break;
    }
  }

  let combatBannerTimeout = null;

  function showCombatBanner(title, body, theme = 'red', durationMs = 4000) {
    const banner = document.getElementById('combatEventBanner');
    const content = document.getElementById('combatEventContent');
    const titleEl = document.getElementById('combatEventTitle');
    const bodyEl = document.getElementById('combatEventBody');
    if (!banner || !content || !titleEl || !bodyEl) return;

    content.className = `combat-event-content ${theme}`;
    titleEl.textContent = title;
    bodyEl.textContent = body;
    banner.style.display = 'block';

    if (combatBannerTimeout) clearTimeout(combatBannerTimeout);
    combatBannerTimeout = setTimeout(() => {
      banner.style.display = 'none';
    }, durationMs);
  }

  function handleDisplayCombatEvent(msg) {
    logNet(`Display evento de combate recibido [${msg.subType}]`, msg);

    switch (msg.subType) {
      case 'SUIT_BREACH':
        showCombatBanner(
          `💥 ¡TRAJE DE ${(msg.targetName || 'CAZADOR').toUpperCase()} REVENTADO!`,
          'NODOS EN SOBRECARGA // CIRCUITO DE FUERZA DESTRUIDO (CA 10)',
          'red',
          4500
        );
        if (window.GantzAudio && typeof window.GantzAudio.playSuitBreach === 'function') {
          window.GantzAudio.playSuitBreach();
        }
        break;

      case 'DELAYED_LOCKED':
        showCombatBanner(
          `🎯 IMPACTO MOLECULAR FIJADO`,
          `${(msg.weaponName || 'X-GUN').toUpperCase()} ➔ ${(msg.targetName || 'OBJETIVO').toUpperCase()} // DETONACIÓN EN 1 TURNO`,
          'cyan',
          3500
        );
        if (window.GantzAudio && typeof window.GantzAudio.playRadarPing === 'function') {
          window.GantzAudio.playRadarPing();
        }
        break;

      case 'DELAYED_DETONATION':
        showCombatBanner(
          `💥 ¡DETONACIÓN MOLECULAR DE ${(msg.weaponName || 'X-GUN').toUpperCase()}!`,
          `${msg.amount || 0} PUNTOS DE DAÑO EN ${(msg.targetName || 'OBJETIVO').toUpperCase()}`,
          'red',
          4000
        );
        if (window.GantzAudio && typeof window.GantzAudio.playDelayedExplosion === 'function') {
          window.GantzAudio.playDelayedExplosion();
        }
        break;

      case 'PANIC_TRIGGERED':
        showCombatBanner(
          `😱 ¡${(msg.targetName || 'CAZADOR').toUpperCase()} EN PÁNICO: ${(msg.panicLabel || 'PÁNICO').toUpperCase()}!`,
          msg.panicEffect || 'INCAPAZ DE ACTUAR CON NORMALIDAD',
          'gold',
          4500
        );
        if (window.GantzAudio && typeof window.GantzAudio.playPanicAlert === 'function') {
          window.GantzAudio.playPanicAlert();
        }
        break;
    }
  }

  function updateRadarDisplay(data) {
    if (!data) return;
    const { target, hunters, minions, isStealth, perimeterAlert } = data;

    if (target) {
      const tx = Math.min(96, Math.max(4, target.x !== undefined ? target.x : 65));
      const ty = Math.min(96, Math.max(4, target.y !== undefined ? target.y : 35));
      const meters = target.distanceMeters !== undefined ? target.distanceMeters : 120;
      const label = target.label || (appState.currentAlien ? appState.currentAlien.name : 'ALIEN');

      if (miniBlipTarget) {
        miniBlipTarget.style.left = `${tx}%`;
        miniBlipTarget.style.top = `${ty}%`;
        miniBlipTarget.style.display = isStealth ? 'none' : 'block';
      }

      if (tacticalBlipTarget) {
        tacticalBlipTarget.style.left = `${tx}%`;
        tacticalBlipTarget.style.top = `${ty}%`;
        tacticalBlipTarget.style.display = isStealth ? 'none' : 'flex';
      }

      if (radarTargetLabel) {
        radarTargetLabel.textContent = `${label.toUpperCase()} (${meters}m)`;
      }

      if (radarMetricMeters) {
        radarMetricMeters.textContent = `${meters}m`;
      }

      if (radarMetricThreat) {
        if (meters <= 20) {
          radarMetricThreat.textContent = 'EXTREMA // CONTACTO';
          radarMetricThreat.style.color = '#ff003c';
          radarMetricThreat.style.borderColor = '#ff003c';
          radarMetricThreat.style.background = 'rgba(255,0,60,0.3)';
        } else if (meters <= 60) {
          radarMetricThreat.textContent = 'ALTA // CERCA';
          radarMetricThreat.style.color = '#ff5500';
          radarMetricThreat.style.borderColor = '#ff5500';
          radarMetricThreat.style.background = 'rgba(255,85,0,0.25)';
        } else if (meters <= 200) {
          radarMetricThreat.textContent = 'MEDIA // EN RANGO';
          radarMetricThreat.style.color = 'var(--gantz-gold)';
          radarMetricThreat.style.borderColor = 'var(--gantz-gold)';
          radarMetricThreat.style.background = 'rgba(255,215,0,0.2)';
        } else {
          radarMetricThreat.textContent = 'LEJANA // RASTREO';
          radarMetricThreat.style.color = 'var(--gantz-cyan)';
          radarMetricThreat.style.borderColor = 'var(--gantz-cyan)';
          radarMetricThreat.style.background = 'rgba(0,240,255,0.15)';
        }
      }
    }

    if (hunters && hunters.x !== undefined && hunters.y !== undefined) {
      if (miniBlipHunter) {
        miniBlipHunter.style.left = `${hunters.x}%`;
        miniBlipHunter.style.top = `${hunters.y}%`;
      }
      if (tacticalBlipHunter) {
        tacticalBlipHunter.style.left = `${hunters.x}%`;
        tacticalBlipHunter.style.top = `${hunters.y}%`;
      }
    }

    if (Array.isArray(minions)) {
      if (miniBlipsMinions) {
        miniBlipsMinions.innerHTML = minions.map(m => `
          <div class="radar-blip blip-target" style="left: ${m.x}%; top: ${m.y}%; width: 4px; height: 4px; opacity: 0.85;"></div>
        `).join('');
      }
      if (tacticalMinionsContainer) {
        tacticalMinionsContainer.innerHTML = minions.map(m => `
          <div class="tactical-blip alien-minion" style="left: ${m.x}%; top: ${m.y}%;">
            <span class="blip-label" style="font-size: 0.55rem; padding: 0 3px;">MINION</span>
          </div>
        `).join('');
      }
    } else {
      if (miniBlipsMinions) miniBlipsMinions.innerHTML = '';
      if (tacticalMinionsContainer) tacticalMinionsContainer.innerHTML = '';
    }

    if (perimeterAlert !== undefined && radarPerimeterWarning) {
      if (perimeterAlert) {
        radarPerimeterWarning.textContent = '🚨 ¡PELIGRO! OBJETIVO AL BORDE DEL PERÍMETRO (1 KM)';
        radarPerimeterWarning.style.color = '#ff003c';
        radarPerimeterWarning.style.animation = 'pulse 0.8s infinite';
      } else {
        radarPerimeterWarning.textContent = '⚠️ ADVERTENCIA: SALIR DEL PERÍMETRO (1 KM) ACTIVARÁ LA BOMBA CRANEAL';
        radarPerimeterWarning.style.color = '#94a3b8';
        radarPerimeterWarning.style.animation = 'none';
      }
    }
  }

  function triggerRadarPingVisual() {
    const sweep = document.getElementById('tacticalRadarSweep');
    if (sweep) {
      sweep.style.animation = 'none';
      sweep.offsetHeight; // trigger reflow
      sweep.style.animation = 'radarSweepAnim 1.2s ease-out';
      setTimeout(() => {
        sweep.style.animation = 'radarSweepAnim 3s linear infinite';
      }, 1200);
    }
  }

  function cleanRoomCode(input) {
    if (!input) return '';
    let str = String(input).trim();
    if (str.includes('room=')) {
      try {
        const url = new URL(str, window.location.origin);
        str = url.searchParams.get('room') || str;
      } catch (e) {
        const m = str.match(/room=([a-zA-Z0-9_-]+)/i);
        if (m) str = m[1];
      }
    }
    let upper = str.toUpperCase().replace(/^GANTZ-?/i, '').trim();
    if (!upper) return '';
    return 'GANTZ-' + upper;
  }

  function resolveRoomId() {
    // 1. URL search param (?room=...)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const roomParam = urlParams.get('room');
      if (roomParam) {
        const clean = cleanRoomCode(roomParam);
        if (clean) return clean;
      }
    } catch (e) {}

    // 2. LocalStorage persistence
    try {
      const saved = localStorage.getItem('gantz_display_room_id');
      if (saved) {
        const clean = cleanRoomCode(saved);
        if (clean) return clean;
      }
    } catch (e) {}

    // 3. Fallback to generated ID
    return generateRoomId();
  }

  function saveDisplayRoom(code) {
    try {
      localStorage.setItem('gantz_display_room_id', code);
      let list = JSON.parse(localStorage.getItem('gantz_display_saved_rooms') || '[]');
      list = [code, ...list.filter(r => r !== code)].slice(0, 8);
      localStorage.setItem('gantz_display_saved_rooms', JSON.stringify(list));
    } catch (e) {}
    renderDisplaySavedRooms();
  }

  function renderDisplaySavedRooms() {
    const listEl = document.getElementById('displaySavedRoomsList');
    if (!listEl) return;
    try {
      const list = JSON.parse(localStorage.getItem('gantz_display_saved_rooms') || '[]');
      if (list.length === 0) {
        listEl.innerHTML = '<span style="font-size: 0.68rem; color: #64748b; font-style: italic;">Sin salas anteriores</span>';
        return;
      }
      listEl.innerHTML = list.map(r => {
        const isCurrent = r === roomId;
        return `<button type="button" class="hud-btn" onclick="window.switchGantzRoom('${r}')" style="font-size: 0.68rem; padding: 2px 6px; ${isCurrent ? 'border-color: #00ff66; color: #00ff66;' : 'border-color: rgba(0,240,255,0.3); color: #cbd5e1;'}">${r}</button>`;
      }).join('');
    } catch (e) {}
  }

  window.switchGantzRoom = function(targetId) {
    const clean = cleanRoomCode(targetId);
    if (!clean) return;

    log(`Cambiando sala a [${clean}]...`);
    if (peer) {
      try { peer.destroy(); } catch (e) {}
      peer = null;
    }
    activeConnections = [];

    roomId = clean;
    saveDisplayRoom(roomId);

    // Update browser URL query without reload
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('room', roomId);
      window.history.replaceState(null, '', u.toString());
    } catch (e) {}

    initMultiTransport(true);
  };

  // Multi-layer Transport Initialization
  function initMultiTransport(keepId = false) {
    if (!keepId || !roomId) {
      roomId = resolveRoomId();
    }
    saveDisplayRoom(roomId);

    hudRoomPin.textContent = `SALA: ${roomId}`;
    qrPinDisplay.textContent = roomId;

    if (window.GantzLogger) {
      window.GantzLogger.updateState('roomId', roomId);
    }

    const currentUrl = new URL(window.location.href);
    currentUrl.pathname = currentUrl.pathname.replace(/\/index\.html$|\/$/, '') + '/remote.html';
    currentUrl.searchParams.set('room', roomId);
    const remoteUrl = currentUrl.toString();

    // Update page URL query to preserve the room
    try {
      const pageUrl = new URL(window.location.href);
      pageUrl.searchParams.set('room', roomId);
      window.history.replaceState(null, '', pageUrl.toString());
    } catch (e) {}

    qrUrlText.textContent = remoteUrl;
    renderQRCode(remoteUrl);
    renderDisplaySavedRooms();

    log(`Sala iniciada con código persistente [${roomId}]`);

    // Layer 1: Try Local WebSocket if on localhost
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      try {
        const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        if (!localWS || localWS.readyState !== WebSocket.OPEN) {
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
        }
      } catch (e) {}
    }

    // Layer 2: BroadcastChannel for Cross-Tab Sync
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        if (!broadcastChan) {
          broadcastChan = new BroadcastChannel('gantz_sync_channel');
          broadcastChan.onmessage = (event) => {
            handleRemoteMessage(event.data);
          };
        }
        logNet('⚡ BroadcastChannel inicializado');
      }
    } catch (e) {}

    // Layer 3: PeerJS WebRTC for Cloud P2P
    try {
      logNet(`Conectando a broker PeerJS con ID [${roomId.toLowerCase()}]...`);
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
          updateConnectedDevicesBadge();
          
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
          updateConnectedDevicesBadge();
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
          logWarn('El ID de sala ya está en uso. Generando nuevo ID...');
          setTimeout(() => window.switchGantzRoom(generateRoomId()), 1000);
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

  // Keyboard shortcuts on PC
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') {
      e.preventDefault();
      appState.timer.isRunning = !appState.timer.isRunning;
      updateTimerDisplay();
      sendRemote({ type: 'SYNC_STATE', state: appState, aliens: aliensList, weapons: weaponsList, roomId: roomId, appVersion: appVersion });
    }
    if (e.key >= '1' && e.key <= '7') {
      const modes = ['standby', 'open', 'briefing', 'mission', 'radar', 'scoring', 'broadcast'];
      const m = modes[parseInt(e.key) - 1];
      if (m) {
        setMode(m);
        sendRemote({ type: 'SYNC_STATE', state: appState, aliens: aliensList, weapons: weaponsList, roomId: roomId, appVersion: appVersion });
      }
    }
  });

  // Room Management UI Listeners in QR Modal
  const btnGenerateNewRoom = document.getElementById('btnGenerateNewRoom');
  if (btnGenerateNewRoom) {
    btnGenerateNewRoom.addEventListener('click', () => {
      window.switchGantzRoom(generateRoomId());
    });
  }

  const btnSetCustomRoom = document.getElementById('btnSetCustomRoom');
  const customDisplayRoomInput = document.getElementById('customDisplayRoomInput');
  if (btnSetCustomRoom && customDisplayRoomInput) {
    btnSetCustomRoom.addEventListener('click', () => {
      const val = customDisplayRoomInput.value.trim();
      if (val) {
        window.switchGantzRoom(val);
        customDisplayRoomInput.value = '';
      }
    });

    customDisplayRoomInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        const val = customDisplayRoomInput.value.trim();
        if (val) {
          window.switchGantzRoom(val);
          customDisplayRoomInput.value = '';
        }
      }
    });
  }

  window.forceReconnectGantz = function() {
    log('Forzando reinicio de conexiones de red...');
    if (peer) try { peer.destroy(); } catch (e) {}
    if (localWS) try { localWS.close(); } catch (e) {}
    initMultiTransport(true);
  };

  // Boot
  setMode('standby');
  setRadarVisibility(appState.radarVisible !== false, false);
  initMultiTransport();
})();
