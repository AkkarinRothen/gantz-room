// Gantz Web Cloud Display Controller (PeerJS P2P)
(function() {
  let peer = null;
  let activeConn = null;
  let roomId = null;
  let typewriterTimeout = null;
  let isMuted = false;

  // Local State
  let aliensList = window.GANTZ_DEFAULT_ALIENS || [];
  let appState = {
    mode: 'standby',
    timer: {
      totalSeconds: 3600,
      remainingSeconds: 3600,
      isRunning: false
    },
    currentAlien: aliensList[0] || null,
    broadcastMessage: 'LA HABÉIS PALMADO. AHORA VUESTRAS VIDAS ME PERTENECEN.',
    hunters: [
      { id: 1, name: 'Kei Kurono', nickname: 'Kurono-kun', points: 0, totalPoints: 10, status: 'alive' },
      { id: 2, name: 'Masaru Kato', nickname: 'Gafas Justiciero', points: 0, totalPoints: 0, status: 'alive' },
      { id: 3, name: 'Kei Kishimoto', nickname: 'Chica del Baño', points: 0, totalPoints: 0, status: 'alive' },
      { id: 4, name: 'Yoshikazu Suzuki', nickname: 'Abuelo Solidario', points: 0, totalPoints: 0, status: 'alive' }
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
  const briefingQuote = document.getElementById('briefingQuote');
  const briefingDesc = document.getElementById('briefingDesc');
  const briefingPoints = document.getElementById('briefingPoints');

  const viewScoring = document.getElementById('viewScoring');
  const scoringList = document.getElementById('scoringList');

  const viewBroadcast = document.getElementById('viewBroadcast');
  const broadcastBody = document.getElementById('broadcastBody');

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

  let broadcastChan = null;

  // Load saved state if any
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

  // Copy helper with feedback
  function copyToClipboard(text, element, successMsg = '¡COPIADO!') {
    navigator.clipboard.writeText(text).then(() => {
      const origText = element.textContent;
      element.textContent = successMsg;
      element.style.borderColor = '#00ff66';
      element.style.color = '#00ff66';
      setTimeout(() => {
        element.textContent = origText;
        element.style.borderColor = '';
        element.style.color = '';
      }, 1500);
    }).catch(() => {
      // Fallback
      prompt('Copia este código manualmente:', text);
    });
  }

  if (btnCopyPin) {
    btnCopyPin.addEventListener('click', () => {
      copyToClipboard(roomId, btnCopyPin, '✓ ¡PIN COPIADO!');
    });
  }

  if (btnCopyUrl) {
    btnCopyUrl.addEventListener('click', () => {
      copyToClipboard(qrUrlText.textContent, btnCopyUrl, '✓');
    });
  }

  if (hudRoomPin) {
    hudRoomPin.addEventListener('click', () => {
      qrModal.classList.add('active');
    });
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
  if (hudRoomPin) hudRoomPin.addEventListener('click', () => qrModal.classList.add('active'));
  btnCloseQR.addEventListener('click', () => qrModal.classList.remove('active'));

  // Pure JS QR Code SVG generator
  function renderQRCode(url) {
    // Generate simple SVG QR Code with qrcode-generator or fallback
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

  // Generate short readable Room ID
  function generateRoomId() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = 'GANTZ-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Typewriter effect function
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

  // Set View Mode
  function setMode(mode) {
    viewStandby.style.display = 'none';
    viewMission.style.display = 'none';
    viewBriefing.style.display = 'none';
    viewScoring.style.display = 'none';
    viewBroadcast.style.display = 'none';
    
    sphereAssembly.classList.remove('is-open', 'active-mission');
    sphereDoors.style.display = 'none';

    hudStatusText.textContent = mode.toUpperCase();
    appState.mode = mode;
    saveState();

    switch (mode) {
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
          briefingImg.src = alien.image || 'assets/aliens/alien_negi.jpg';
          briefingName.textContent = alien.name;
          briefingQuote.textContent = alien.quote ? `"${alien.quote}"` : '...';
          briefingDesc.textContent = `${alien.description || ''} ${alien.weakness ? `[Debilidad: ${alien.weakness}]` : ''}`;
          briefingPoints.textContent = `RECOMPENSA: ${alien.points || 0} PTOS`;
        }
        if (window.GantzAudio) window.GantzAudio.playSphereBoot();
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
      }
      if (appState.mode === 'mission') {
        updateTimerDisplay();
      }
      // Broadcast timer tick to active remote
      sendRemote({ type: 'TIMER_TICK', timer: appState.timer });
    }
  }, 1000);

  function sendRemote(msg) {
    if (activeConn && activeConn.open) {
      activeConn.send(msg);
    }
    if (broadcastChan) {
      try { broadcastChan.postMessage(msg); } catch (e) {}
    }
  }

  // Handle messages from Remote tablet
  function handleRemoteMessage(msg) {
    switch (msg.type) {
      case 'REQUEST_SYNC':
        sendRemote({
          type: 'SYNC_STATE',
          state: appState,
          aliens: aliensList,
          roomId: roomId
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
        const idx = aliensList.findIndex(a => a.id === msg.alien.id);
        if (idx >= 0) aliensList[idx] = msg.alien;
        else aliensList.push(msg.alien);
        sendRemote({ type: 'ALIENS_LIST_UPDATED', aliens: aliensList });
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
        }
        break;
    }
  }

  // Initialize PeerJS Cloud WebRTC + Local BroadcastChannel
  function initPeerJS() {
    roomId = generateRoomId();
    hudRoomPin.textContent = `SALA: ${roomId}`;
    qrPinDisplay.textContent = roomId;

    const currentUrl = new URL(window.location.href);
    currentUrl.pathname = currentUrl.pathname.replace(/\/index\.html$|\/$/, '') + '/remote.html';
    currentUrl.searchParams.set('room', roomId);
    const remoteUrl = currentUrl.toString();

    qrUrlText.textContent = remoteUrl;
    renderQRCode(remoteUrl);

    // Setup BroadcastChannel for 0ms same-origin tab preview
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        broadcastChan = new BroadcastChannel('gantz_sync_channel');
        broadcastChan.onmessage = (event) => {
          const msg = event.data;
          if (msg && msg.targetRoom) {
            const target = msg.targetRoom.toUpperCase().trim();
            const cleanTarget = target.startsWith('GANTZ-') ? target : `GANTZ-${target}`;
            if (cleanTarget !== roomId) return;
          }
          handleRemoteMessage(msg);
        };
      }
    } catch (e) {}

    // Create Peer
    try {
      peer = new Peer(roomId.toLowerCase());

      peer.on('open', (id) => {
        console.log('Gantz Peer Room ready:', id);
        hudStatusBadge.style.borderColor = '#00ff66';
        hudStatusBadge.style.color = '#00ff66';
      });

      peer.on('connection', (conn) => {
        activeConn = conn;
        console.log('Tablet Remote connected via WebRTC!');

        conn.on('open', () => {
          hudStatusBadge.style.borderColor = '#00f0ff';
          hudStatusBadge.style.color = '#00f0ff';
          hudStatusText.textContent = 'TABLET CONECTADA';
          // Send initial state to tablet
          conn.send({
            type: 'SYNC_STATE',
            state: appState,
            aliens: aliensList,
            roomId: roomId
          });
          if (window.GantzAudio) window.GantzAudio.playClick();
        });

        conn.on('data', (data) => {
          handleRemoteMessage(data);
        });

        conn.on('close', () => {
          hudStatusBadge.style.borderColor = '#ff003c';
          hudStatusBadge.style.color = '#ff003c';
          hudStatusText.textContent = 'STANDBY';
        });
      });

      peer.on('error', (err) => {
        console.warn('Peer error:', err);
        if (err.type === 'unavailable-id') {
          setTimeout(initPeerJS, 1000);
        }
      });
    } catch (err) {
      console.warn('Peer init warning:', err);
    }
  }

  // Boot
  setMode('standby');
  initPeerJS();
})();
