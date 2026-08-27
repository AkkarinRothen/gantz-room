// Gantz Mobile Remote Controller (Multi-Layer Transport + Logcat)
(function() {
  let peer = null;
  let conn = null;
  let localWS = null;
  let broadcastChan = null;
  let roomId = null;
  let aliensList = window.GANTZ_DEFAULT_ALIENS || [];
  let weaponsList = window.GANTZ_DEFAULT_WEAPONS || [];
  
  let defaultState = {
    mode: 'standby',
    timer: { totalSeconds: 3600, remainingSeconds: 3600, isRunning: false },
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
  let appState = { ...defaultState };

  // DOM Elements
  const roomConnectOverlay = document.getElementById('roomConnectOverlay');
  const roomPinInput = document.getElementById('roomPinInput');
  const btnConnectRoom = document.getElementById('btnConnectRoom');
  const btnPastePin = document.getElementById('btnPastePin');
  const connectFeedback = document.getElementById('connectFeedback');

  const syncDot = document.getElementById('syncDot');
  const syncText = document.getElementById('syncText');
  const headerTimer = document.getElementById('headerTimer');
  const mainTimerDisplay = document.getElementById('mainTimerDisplay');
  const timerStatusLabel = document.getElementById('timerStatusLabel');
  const timerBox = document.getElementById('timerBox');
  const btnPlayPause = document.getElementById('btnPlayPause');
  const playIcon = document.getElementById('playIcon');
  const playText = document.getElementById('playText');
  const btnResetTimer = document.getElementById('btnResetTimer');

  const monstersContainer = document.getElementById('monstersContainer');
  const btnNewAlien = document.getElementById('btnNewAlien');
  const alienModal = document.getElementById('alienModal');
  const alienForm = document.getElementById('alienForm');
  const alienModalTitle = document.getElementById('alienModalTitle');

  const weaponsContainer = document.getElementById('weaponsContainer');
  const btnNewWeapon = document.getElementById('btnNewWeapon');
  const weaponModal = document.getElementById('weaponModal');
  const weaponForm = document.getElementById('weaponForm');
  const weaponModalTitle = document.getElementById('weaponModalTitle');

  const huntersContainer = document.getElementById('huntersContainer');
  const btnAddHunter = document.getElementById('btnAddHunter');
  const btnBroadcastScoring = document.getElementById('btnBroadcastScoring');

  const customMsgInput = document.getElementById('customMsgInput');
  const btnSendCustomMsg = document.getElementById('btnSendCustomMsg');

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

  function formatTime(totalSec) {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function vibrate(ms = 30) {
    if ('vibrate' in navigator) {
      try { navigator.vibrate(ms); } catch (e) {}
    }
  }

  window.switchTab = function(tabId) {
    vibrate(15);
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    const targetPanel = document.getElementById(tabId);
    if (targetPanel) targetPanel.classList.add('active');

    const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => 
      b.getAttribute('onclick')?.includes(tabId)
    );
    if (activeBtn) activeBtn.classList.add('active');
  };

  // Broadcast to all connected transports
  function sendDisplay(data) {
    data.source = 'remote';
    data.targetRoom = roomId;
    logNet(`Enviando a Display [${data.type}]`, data);

    // 1. WebRTC DataChannel
    if (conn && conn.open) {
      try { conn.send(data); } catch (e) {}
    }
    // 2. Local WebSocket Relay
    if (localWS && localWS.readyState === WebSocket.OPEN) {
      try { localWS.send(JSON.stringify(data)); } catch (e) {}
    }
    // 3. Browser BroadcastChannel
    if (broadcastChan) {
      try { broadcastChan.postMessage(data); } catch (e) {}
    }
  }

  function handleServerMessage(msg) {
    if (!msg || msg.source === 'remote') return;
    logNet(`Respuesta recibida de Display [${msg.type}]`, msg);

    switch (msg.type) {
      case 'SYNC_STATE':
        appState = msg.state;
        aliensList = msg.aliens || aliensList;
        weaponsList = msg.weapons || weaponsList;
        renderAll();
        break;

      case 'TIMER_UPDATED':
      case 'TIMER_TICK':
        if (appState) appState.timer = msg.timer;
        renderTimer();
        break;

      case 'ALIEN_SELECTED':
        if (appState) appState.currentAlien = msg.alien;
        renderMonsters();
        break;

      case 'ALIENS_LIST_UPDATED':
        aliensList = msg.aliens;
        renderMonsters();
        break;

      case 'WEAPONS_LIST_UPDATED':
        weaponsList = msg.weapons;
        renderWeapons();
        break;

      case 'HUNTERS_UPDATED':
        if (appState) appState.hunters = msg.hunters;
        renderHunters();
        break;
    }
  }

  function renderAll() {
    renderTimer();
    renderMonsters();
    renderWeapons();
    renderHunters();
  }

  // Connect to Room
  function connectToRoom(targetRoomId) {
    let clean = targetRoomId.trim().toUpperCase();
    if (!clean) return;

    let peerTarget = clean.toLowerCase();
    if (!peerTarget.startsWith('gantz-')) {
      peerTarget = 'gantz-' + peerTarget;
    }
    roomId = peerTarget;

    // Save to Saved / Recent Rooms
    saveRoom(clean);

    if (window.GantzLogger) {
      window.GantzLogger.updateState('roomId', clean);
    }

    log(`Iniciando conexión con la sala [${clean}]...`);
    roomConnectOverlay.style.display = 'none';
    syncDot.style.background = '#00ff66';
    syncDot.style.boxShadow = '0 0 8px #00ff66';
    syncText.textContent = clean;
    syncText.style.color = '#00ff66';

    // Layer 1: Try Local WebSocket if on localhost
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      try {
        const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        if (!localWS || localWS.readyState !== WebSocket.OPEN) {
          localWS = new WebSocket(`${wsProtocol}//${location.host}`);
          localWS.onopen = () => {
            logNet('⚡ Servidor WebSocket Local Conectado');
            if (window.GantzLogger) window.GantzLogger.updateState('transport', 'WebSocket Local');
            sendDisplay({ type: 'REQUEST_SYNC' });
          };
          localWS.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              handleServerMessage(data);
            } catch (e) {}
          };
        }
      } catch (e) {}
    }

    // Layer 2: BroadcastChannel
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        if (!broadcastChan) {
          broadcastChan = new BroadcastChannel('gantz_sync_channel');
          broadcastChan.onmessage = (event) => {
            handleServerMessage(event.data);
          };
        }
        broadcastChan.postMessage({ type: 'REQUEST_SYNC', targetRoom: roomId, source: 'remote' });
      }
    } catch (e) {}

    // Layer 3: PeerJS WebRTC
    try {
      if (!peer) {
        logNet('Inicializando cliente PeerJS WebRTC...');
        if (window.GantzLogger) window.GantzLogger.updateState('brokerStatus', 'Conectando...');

        peer = new Peer({
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        });

        peer.on('open', (id) => {
          logNet(`✓ PeerJS listo. ID Local: [${id}]`);
          if (window.GantzLogger) {
            window.GantzLogger.updateState('brokerStatus', 'Online');
            window.GantzLogger.updateState('peerId', id);
          }
          doPeerConnect();
        });

        peer.on('error', (err) => {
          logError('Error en PeerJS:', err);
          if (window.GantzLogger) window.GantzLogger.updateState('brokerStatus', 'Error: ' + err.type);
        });
      } else if (peer.open) {
        doPeerConnect();
      }

      function doPeerConnect() {
        logNet(`Intentando conexión WebRTC a Display [${roomId}]...`);
        conn = peer.connect(roomId, { reliable: true });

        conn.on('open', () => {
          logNet('✓ Conexión WebRTC P2P abierta con Display');
          if (window.GantzLogger) {
            window.GantzLogger.updateState('webrtcStatus', 'Conectado');
            window.GantzLogger.updateState('transport', 'WebRTC P2P');
          }
          conn.send({ type: 'REQUEST_SYNC', source: 'remote' });
        });

        conn.on('data', (data) => {
          handleServerMessage(data);
        });

        conn.on('close', () => {
          logWarn('Conexión WebRTC cerrada');
          if (window.GantzLogger) window.GantzLogger.updateState('webrtcStatus', 'Cerrado');
        });

        conn.on('error', (err) => {
          logError('Error en conexión WebRTC DataChannel:', err);
        });
      }
    } catch (err) {
      logError('Error en setup WebRTC:', err);
    }
  }

  // 1. TIMER
  function renderTimer() {
    if (!appState || !appState.timer) return;
    const { remainingSeconds, isRunning } = appState.timer;
    const formatted = formatTime(remainingSeconds);

    headerTimer.textContent = formatted;
    mainTimerDisplay.textContent = formatted;

    if (remainingSeconds <= 60 && remainingSeconds > 0) {
      headerTimer.classList.add('danger');
      timerBox.classList.add('danger');
    } else {
      headerTimer.classList.remove('danger');
      timerBox.classList.remove('danger');
    }

    if (isRunning) {
      timerBox.classList.add('running');
      playIcon.textContent = '⏸';
      playText.textContent = 'PAUSAR';
      btnPlayPause.style.background = '#eab308';
      timerStatusLabel.textContent = 'MISIÓN EN CURSO // CAZA ACTIVA';
      timerStatusLabel.style.color = '#00ff66';
    } else {
      timerBox.classList.remove('running');
      playIcon.textContent = '▶';
      playText.textContent = 'INICIAR MISIÓN';
      btnPlayPause.style.background = '#00ff66';
      timerStatusLabel.textContent = 'TEMPORIZADOR EN PAUSA';
      timerStatusLabel.style.color = '#94a3b8';
    }
  }

  btnPlayPause.addEventListener('click', () => {
    vibrate(40);
    const isRunning = appState && appState.timer ? appState.timer.isRunning : false;
    const action = isRunning ? 'pause' : 'start';
    if (appState && appState.timer) appState.timer.isRunning = !isRunning;
    renderTimer();
    sendDisplay({ type: 'TIMER_CONTROL', action });
    if (action === 'start') {
      sendDisplay({ type: 'SET_MODE', mode: 'mission' });
    }
  });

  btnResetTimer.addEventListener('click', () => {
    vibrate(40);
    sendDisplay({ type: 'TIMER_CONTROL', action: 'reset' });
  });

  window.adjustTimer = function(deltaSeconds) {
    vibrate(25);
    sendDisplay({ type: 'TIMER_CONTROL', action: 'adjust', delta: deltaSeconds });
  };

  window.setTimerPreset = function(seconds) {
    vibrate(40);
    sendDisplay({ type: 'TIMER_CONTROL', action: 'set', seconds });
  };

  // 2. MONSTERS & IMAGE PICKER
  const alienFileInput = document.getElementById('alienFileInput');
  const btnUploadAlienFile = document.getElementById('btnUploadAlienFile');
  const alienPreviewImg = document.getElementById('alienPreviewImg');
  const alienFormImage = document.getElementById('alienFormImage');

  if (btnUploadAlienFile && alienFileInput) {
    btnUploadAlienFile.addEventListener('click', () => {
      alienFileInput.click();
    });

    alienFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(evt) {
        const img = new Image();
        img.onload = function() {
          const maxDimension = 500;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const base64Url = canvas.toDataURL('image/jpeg', 0.82);
          alienFormImage.value = base64Url;
          if (alienPreviewImg) alienPreviewImg.src = base64Url;
          log('✓ Imagen local cargada y optimizada para transferencia');
        };
        img.src = evt.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  if (alienFormImage) {
    alienFormImage.addEventListener('input', () => {
      const val = alienFormImage.value.trim();
      if (val && alienPreviewImg) {
        alienPreviewImg.src = val;
      }
    });
  }

  function renderMonsters() {
    monstersContainer.innerHTML = '';
    const currentId = appState?.currentAlien?.id;

    aliensList.forEach(alien => {
      const isSelected = alien.id === currentId;
      const item = document.createElement('div');
      item.className = `monster-item ${isSelected ? 'selected' : ''}`;
      item.innerHTML = `
        <img src="${alien.image || 'assets/aliens/alien_negi.jpg'}" class="monster-thumb" alt="${alien.name}">
        <div class="monster-info">
          <div class="monster-name">${alien.name}</div>
          <div class="monster-meta">
            <span>🏆 ${alien.points || 0} pts</span>
            <span>🏷️ ${alien.category || 'Misión'}</span>
          </div>
          <div style="font-size: 0.72rem; color: #00ff66; margin-top: 2px;">💚 Le gusta: ${alien.likes || 'Las cebolletas'}</div>
          <div class="monster-quote">${alien.quote ? `"${alien.quote}"` : ''}</div>
        </div>
        <div class="monster-actions">
          <button class="btn btn-sm ${isSelected ? 'btn-primary' : 'btn-cyan'}" onclick="selectAlien('${alien.id}')">
            ${isSelected ? '✓ EN PANTALLA' : 'Proyectar'}
          </button>
          <button class="btn btn-sm" onclick="editAlien('${alien.id}')">✏️</button>
        </div>
      `;
      monstersContainer.appendChild(item);
    });
  }

  window.selectAlien = function(alienId) {
    vibrate(30);
    const alien = aliensList.find(a => a.id === alienId);
    if (alien) {
      if (appState) appState.currentAlien = alien;
      renderMonsters();
      sendDisplay({ type: 'SELECT_ALIEN', alien });
    }
  };

  window.editAlien = function(alienId) {
    vibrate(20);
    const alien = aliensList.find(a => a.id === alienId);
    if (!alien) return;

    document.getElementById('alienFormId').value = alien.id;
    document.getElementById('alienFormName').value = alien.name || '';
    document.getElementById('alienFormCat').value = alien.category || '';
    document.getElementById('alienFormPoints').value = alien.points || 0;
    document.getElementById('alienFormCharacteristics').value = alien.characteristics || alien.traits || '';
    document.getElementById('alienFormLikes').value = alien.likes || '';
    document.getElementById('alienFormDislikes').value = alien.dislikes || '';
    document.getElementById('alienFormQuote').value = alien.quote || '';
    document.getElementById('alienFormImage').value = alien.image || '';
    if (alienPreviewImg) alienPreviewImg.src = alien.image || 'assets/aliens/alien_negi.jpg';

    alienModalTitle.textContent = '✏️ EDITAR OBJETIVO';
    alienModal.classList.add('active');
  };

  btnNewAlien.addEventListener('click', () => {
    vibrate(20);
    alienForm.reset();
    document.getElementById('alienFormId').value = 'alien-' + Date.now();
    document.getElementById('alienFormImage').value = 'assets/aliens/alien_negi.jpg';
    if (alienPreviewImg) alienPreviewImg.src = 'assets/aliens/alien_negi.jpg';
    alienModalTitle.textContent = '👾 CREAR NUEVO ALIEN';
    alienModal.classList.add('active');
  });

  window.closeAlienModal = function() {
    alienModal.classList.remove('active');
  };

  alienForm.addEventListener('submit', (e) => {
    e.preventDefault();
    vibrate(40);
    const id = document.getElementById('alienFormId').value;
    const newAlien = {
      id,
      name: document.getElementById('alienFormName').value,
      category: document.getElementById('alienFormCat').value || 'Misión',
      points: parseInt(document.getElementById('alienFormPoints').value, 10) || 0,
      characteristics: document.getElementById('alienFormCharacteristics').value || 'FUERTE',
      likes: document.getElementById('alienFormLikes').value || 'LAS COSAS RARAS',
      dislikes: document.getElementById('alienFormDislikes').value || '',
      quote: document.getElementById('alienFormQuote').value || '...',
      image: document.getElementById('alienFormImage').value || 'assets/aliens/alien_negi.jpg'
    };

    const idx = aliensList.findIndex(a => a.id === id);
    if (idx >= 0) aliensList[idx] = newAlien;
    else aliensList.push(newAlien);

    if (appState && appState.currentAlien && appState.currentAlien.id === id) {
      appState.currentAlien = newAlien;
    }
    renderMonsters();
    sendDisplay({ type: 'SAVE_ALIEN', alien: newAlien });
    closeAlienModal();
  });

  // 3. WEAPONS & ARMORY
  function renderWeapons() {
    if (!weaponsContainer) return;
    weaponsContainer.innerHTML = '';
    const currentId = appState?.currentWeapon?.id;

    weaponsList.forEach(wpn => {
      const isSelected = wpn.id === currentId;
      const item = document.createElement('div');
      item.className = `monster-item ${isSelected ? 'selected' : ''}`;
      item.innerHTML = `
        <div style="font-size: 2.2rem; min-width: 55px; text-align: center; line-height: 1;">
          ${wpn.icon || '🔫'}
        </div>
        <div class="monster-info">
          <div class="monster-name">${wpn.name}</div>
          <div class="monster-meta">
            <span style="color: #00f0ff;">🏷️ ${wpn.category || 'Armamento'}</span>
            <span>📏 ${wpn.range || 'Medio'}</span>
          </div>
          <div style="font-size: 0.72rem; color: #cbd5e1; margin-top: 2px;">⚡ ${wpn.mechanics || wpn.description}</div>
          <div class="monster-quote">${wpn.quote ? `"${wpn.quote}"` : ''}</div>
        </div>
        <div class="monster-actions" style="display: flex; flex-direction: column; gap: 4px;">
          <button class="btn btn-sm ${isSelected ? 'btn-primary' : 'btn-cyan'}" onclick="selectWeapon('${wpn.id}')">
            ${isSelected ? '✓ EN PANTALLA' : 'Proyectar'}
          </button>
          <button class="btn btn-sm btn-danger" onclick="fireWeapon('${wpn.id}')" title="Disparar sonido">
            💥 Disparar
          </button>
          <button class="btn btn-sm" onclick="editWeapon('${wpn.id}')">✏️</button>
        </div>
      `;
      weaponsContainer.appendChild(item);
    });
  }

  window.selectWeapon = function(weaponId) {
    vibrate(35);
    const weapon = weaponsList.find(w => w.id === weaponId);
    if (weapon) {
      if (appState) appState.currentWeapon = weapon;
      renderWeapons();
      sendDisplay({ type: 'SELECT_WEAPON', weapon });
    }
  };

  window.fireWeapon = function(weaponId) {
    vibrate(50);
    const weapon = weaponsList.find(w => w.id === weaponId);
    if (weapon) {
      log(`💥 Disparando arma: ${weapon.name}`);
      sendDisplay({ type: 'FIRE_WEAPON', sound: weapon.sound });
    }
  };

  window.editWeapon = function(weaponId) {
    vibrate(20);
    const weapon = weaponsList.find(w => w.id === weaponId);
    if (!weapon) return;

    document.getElementById('weaponFormId').value = weapon.id;
    document.getElementById('weaponFormName').value = weapon.name || '';
    document.getElementById('weaponFormIcon').value = weapon.icon || '🔫';
    document.getElementById('weaponFormCategory').value = weapon.category || '';
    document.getElementById('weaponFormRange').value = weapon.range || '';
    document.getElementById('weaponFormSound').value = weapon.sound || 'xgun';
    document.getElementById('weaponFormMechanics').value = weapon.mechanics || weapon.description || '';
    document.getElementById('weaponFormQuote').value = weapon.quote || '';

    weaponModalTitle.textContent = '🔫 EDITAR ARMA';
    weaponModal.classList.add('active');
  };

  if (btnNewWeapon) {
    btnNewWeapon.addEventListener('click', () => {
      vibrate(20);
      weaponForm.reset();
      document.getElementById('weaponFormId').value = 'wpn-' + Date.now();
      weaponModalTitle.textContent = '🔫 CREAR NUEVA ARMA';
      weaponModal.classList.add('active');
    });
  }

  window.closeWeaponModal = function() {
    if (weaponModal) weaponModal.classList.remove('active');
  };

  if (weaponForm) {
    weaponForm.addEventListener('submit', (e) => {
      e.preventDefault();
      vibrate(40);
      const id = document.getElementById('weaponFormId').value;
      const newWeapon = {
        id,
        name: document.getElementById('weaponFormName').value,
        icon: document.getElementById('weaponFormIcon').value || '🔫',
        category: document.getElementById('weaponFormCategory').value || 'Armamento',
        range: document.getElementById('weaponFormRange').value || 'Medio',
        sound: document.getElementById('weaponFormSound').value || 'xgun',
        mechanics: document.getElementById('weaponFormMechanics').value || '',
        quote: document.getElementById('weaponFormQuote').value || ''
      };

      const idx = weaponsList.findIndex(w => w.id === id);
      if (idx >= 0) weaponsList[idx] = newWeapon;
      else weaponsList.push(newWeapon);

      if (appState && appState.currentWeapon && appState.currentWeapon.id === id) {
        appState.currentWeapon = newWeapon;
      }
      renderWeapons();
      sendDisplay({ type: 'SAVE_WEAPON', weapon: newWeapon });
      closeWeaponModal();
    });
  }

  // 4. HUNTERS
  function renderHunters() {
    huntersContainer.innerHTML = '';
    const hunters = appState?.hunters || [];

    hunters.forEach((h, idx) => {
      const card = document.createElement('div');
      card.className = 'hunter-card';
      card.innerHTML = `
        <div class="hunter-header-row">
          <div>
            <input type="text" class="hunter-name-input" value="${h.name}" onchange="updateHunterField(${idx}, 'name', this.value)">
            <input type="text" class="hunter-nick-input" value="${h.nickname || 'Novato'}" onchange="updateHunterField(${idx}, 'nickname', this.value)" placeholder="Apodo Gantz...">
          </div>
          <div class="hunter-points-badge">+${h.points || 0} pts</div>
        </div>
        <div class="hunter-controls-row">
          <button class="btn btn-sm" onclick="adjustHunterScore(${idx}, -1)">-1</button>
          <button class="btn btn-sm btn-primary" onclick="adjustHunterScore(${idx}, 1)">+1</button>
          <button class="btn btn-sm btn-cyan" onclick="adjustHunterScore(${idx}, 5)">+5</button>
          <button class="btn btn-sm btn-gold" onclick="adjustHunterScore(${idx}, 10)">+10</button>
          <div style="flex: 1; text-align: right; font-size: 0.75rem; color: #94a3b8;">
            Total: ${h.totalPoints || 0} pts
          </div>
          <button class="btn btn-sm btn-danger" onclick="removeHunter(${idx})">✕</button>
        </div>
      `;
      huntersContainer.appendChild(card);
    });
  }

  window.adjustHunterScore = function(index, delta) {
    vibrate(25);
    if (!appState || !appState.hunters) return;
    const h = appState.hunters[index];
    if (h) {
      h.points = Math.max(0, (h.points || 0) + delta);
      h.totalPoints = Math.max(0, (h.totalPoints || 0) + delta);
      sendDisplay({ type: 'UPDATE_HUNTERS', hunters: appState.hunters });
      renderHunters();
    }
  };

  window.updateHunterField = function(index, field, value) {
    if (!appState || !appState.hunters) return;
    if (appState.hunters[index]) {
      appState.hunters[index][field] = value;
      sendDisplay({ type: 'UPDATE_HUNTERS', hunters: appState.hunters });
    }
  };

  window.removeHunter = function(index) {
    vibrate(30);
    if (!appState || !appState.hunters) return;
    appState.hunters.splice(index, 1);
    sendDisplay({ type: 'UPDATE_HUNTERS', hunters: appState.hunters });
    renderHunters();
  };

  btnAddHunter.addEventListener('click', () => {
    vibrate(25);
    if (!appState) return;
    if (!appState.hunters) appState.hunters = [];
    appState.hunters.push({
      id: Date.now(),
      name: `Cazador ${appState.hunters.length + 1}`,
      nickname: 'Carne de Cañón',
      points: 0,
      totalPoints: 0,
      status: 'alive'
    });
    sendDisplay({ type: 'UPDATE_HUNTERS', hunters: appState.hunters });
    renderHunters();
  });

  btnBroadcastScoring.addEventListener('click', () => {
    vibrate(40);
    sendDisplay({ type: 'SET_MODE', mode: 'scoring' });
  });

  // 4. BROADCAST
  btnSendCustomMsg.addEventListener('click', () => {
    vibrate(35);
    const msg = customMsgInput.value.trim();
    if (msg) {
      sendDisplay({ type: 'BROADCAST_MESSAGE', message: msg });
    }
  });

  window.quickSendMsg = function(text) {
    vibrate(30);
    customMsgInput.value = text;
    sendDisplay({ type: 'BROADCAST_MESSAGE', message: text });
  };

  // 5. MODES & SOUNDBOARD
  window.setSphereMode = function(mode) {
    vibrate(30);
    sendDisplay({ type: 'SET_MODE', mode });
  };

  window.triggerSFX = function(sound) {
    vibrate(35);
    sendDisplay({ type: 'TRIGGER_SOUND', sound });
  };

  window.forceReconnectGantz = function() {
    log('Forzando reconexión en Remote...');
    if (roomId) connectToRoom(roomId);
  };

  // ==================== SAVED & FAVORITE ROOMS MANAGER ====================
  const STORAGE_ROOMS_KEY = 'gantz_saved_rooms';

  function getSavedRooms() {
    try {
      const data = localStorage.getItem(STORAGE_ROOMS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveRoom(pin, label = '') {
    const cleanPin = pin.trim().toUpperCase().replace(/^GANTZ-/, '');
    if (!cleanPin) return;

    let rooms = getSavedRooms();
    const existingIndex = rooms.findIndex(r => r.pin === cleanPin);

    if (existingIndex >= 0) {
      rooms[existingIndex].lastUsed = Date.now();
      if (label) rooms[existingIndex].label = label;
    } else {
      rooms.unshift({
        pin: cleanPin,
        label: label || `Sala ${cleanPin}`,
        lastUsed: Date.now(),
        isFavorite: false
      });
    }

    // Sort: favorites first, then by lastUsed desc
    rooms.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return b.lastUsed - a.lastUsed;
    });

    try {
      localStorage.setItem(STORAGE_ROOMS_KEY, JSON.stringify(rooms));
    } catch (e) {}

    renderSavedRooms();
  }

  window.toggleFavoriteRoom = function(pin, event) {
    if (event) event.stopPropagation();
    let rooms = getSavedRooms();
    const room = rooms.find(r => r.pin === pin);
    if (room) {
      room.isFavorite = !room.isFavorite;
      localStorage.setItem(STORAGE_ROOMS_KEY, JSON.stringify(rooms));
      renderSavedRooms();
    }
  };

  window.deleteSavedRoom = function(pin, event) {
    if (event) event.stopPropagation();
    let rooms = getSavedRooms().filter(r => r.pin !== pin);
    localStorage.setItem(STORAGE_ROOMS_KEY, JSON.stringify(rooms));
    renderSavedRooms();
  };

  window.renameSavedRoom = function(pin, event) {
    if (event) event.stopPropagation();
    let rooms = getSavedRooms();
    const room = rooms.find(r => r.pin === pin);
    if (!room) return;

    const newLabel = prompt('Ingresa un nombre para esta sala:', room.label);
    if (newLabel && newLabel.trim()) {
      room.label = newLabel.trim();
      localStorage.setItem(STORAGE_ROOMS_KEY, JSON.stringify(rooms));
      renderSavedRooms();
    }
  };

  function renderSavedRooms() {
    const container = document.getElementById('savedRoomsContainer');
    const countEl = document.getElementById('savedRoomsCount');
    if (!container) return;

    const rooms = getSavedRooms();
    if (countEl) countEl.textContent = `${rooms.length} sala${rooms.length === 1 ? '' : 's'}`;

    if (rooms.length === 0) {
      container.innerHTML = '<div style="font-size: 0.75rem; color: #64748b; font-style: italic; text-align: center; padding: 10px;">No hay salas guardadas aún</div>';
      return;
    }

    container.innerHTML = '';
    rooms.forEach(r => {
      const timeStr = formatRelativeTime(r.lastUsed);
      const item = document.createElement('div');
      item.className = `saved-room-item ${r.isFavorite ? 'is-fav' : ''}`;
      item.innerHTML = `
        <div style="flex: 1; cursor: pointer; display: flex; flex-direction: column; text-align: left;" onclick="connectToRoom('${r.pin}')">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="saved-room-pin">${r.pin}</span>
            <span class="saved-room-name">${escapeHtml(r.label)}</span>
          </div>
          <span class="saved-room-time">${timeStr}</span>
        </div>
        <div class="saved-room-actions">
          <button class="btn-icon-fav ${r.isFavorite ? 'active' : ''}" onclick="toggleFavoriteRoom('${r.pin}', event)" title="Favorito">
            ${r.isFavorite ? '⭐' : '☆'}
          </button>
          <button class="btn btn-sm btn-cyan" style="padding: 4px 8px; font-size: 0.75rem;" onclick="connectToRoom('${r.pin}')">
            Entrar
          </button>
          <button class="btn btn-sm" style="padding: 4px 6px; font-size: 0.75rem;" onclick="renameSavedRoom('${r.pin}', event)" title="Renombrar">
            ✏️
          </button>
          <button class="btn btn-sm btn-danger" style="padding: 4px 6px; font-size: 0.75rem;" onclick="deleteSavedRoom('${r.pin}', event)" title="Eliminar">
            ✕
          </button>
        </div>
      `;
      container.appendChild(item);
    });
  }

  function formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    const diffMs = Date.now() - timestamp;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Reciente';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    return `Hace ${diffDays} d`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ==================== CAMERA QR SCANNER ====================
  let html5QrScanner = null;
  const btnOpenQrScanner = document.getElementById('btnOpenQrScanner');
  const btnCloseQrScanner = document.getElementById('btnCloseQrScanner');
  const qrScannerModal = document.getElementById('qrScannerModal');
  const qrScanStatus = document.getElementById('qrScanStatus');

  if (btnOpenQrScanner && qrScannerModal) {
    btnOpenQrScanner.addEventListener('click', async () => {
      vibrate(30);
      qrScannerModal.style.display = 'flex';
      if (qrScanStatus) qrScanStatus.textContent = 'Iniciando cámara...';

      try {
        if (typeof Html5Qrcode !== 'undefined') {
          html5QrScanner = new Html5Qrcode("qrCameraReader");
          const config = { fps: 10, qrbox: { width: 220, height: 220 } };

          await html5QrScanner.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
              vibrate([50, 50, 50]);
              if (qrScanStatus) qrScanStatus.textContent = '¡Código detectado!';
              
              let detectedPin = decodedText.trim();
              try {
                const url = new URL(detectedPin);
                const pinFromParam = url.searchParams.get('room');
                if (pinFromParam) detectedPin = pinFromParam;
              } catch (e) {}

              detectedPin = detectedPin.replace(/^GANTZ-/, '');

              stopQrScanner();
              roomPinInput.value = detectedPin;
              connectToRoom(detectedPin);
            },
            (errorMsg) => {}
          );
          if (qrScanStatus) qrScanStatus.textContent = 'Apunta al código QR de la pantalla...';
        } else {
          if (qrScanStatus) qrScanStatus.textContent = 'Lector QR no disponible en este dispositivo.';
        }
      } catch (err) {
        logWarn('Error al abrir cámara para QR', err);
        if (qrScanStatus) qrScanStatus.textContent = 'Permiso de cámara denegado o no disponible.';
      }
    });
  }

  function stopQrScanner() {
    if (html5QrScanner) {
      html5QrScanner.stop().then(() => {
        html5QrScanner.clear();
        html5QrScanner = null;
      }).catch(() => {});
    }
    if (qrScannerModal) qrScannerModal.style.display = 'none';
  }

  if (btnCloseQrScanner) {
    btnCloseQrScanner.addEventListener('click', stopQrScanner);
  }

  // ==================== PWA INSTALLATION ====================
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(() => log('PWA ServiceWorker registrado con éxito'))
        .catch(err => logWarn('Error registrando ServiceWorker', err));
    });
  }

  let deferredPrompt = null;
  const btnInstallPwa = document.getElementById('btnInstallPwa');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (btnInstallPwa) {
      btnInstallPwa.style.display = 'block';
      btnInstallPwa.addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          log(`Resultado instalación PWA: ${outcome}`);
          deferredPrompt = null;
          btnInstallPwa.style.display = 'none';
        }
      });
    }
  });

  // ==================== GALLERY PICKER ====================
  let galleryData = null;
  let currentGalleryFilter = 'all';
  const galleryModal = document.getElementById('galleryModal');
  const galleryGrid = document.getElementById('galleryGrid');
  const btnOpenGallery = document.getElementById('btnOpenGallery');

  async function loadGalleryData() {
    if (galleryData) return;
    try {
      const res = await fetch('assets/webp/gallery_manifest.json');
      if (res.ok) {
        galleryData = await res.json();
      }
    } catch (e) {}
  }

  function renderGalleryGrid() {
    if (!galleryGrid || !galleryData) return;
    galleryGrid.innerHTML = '';

    let items = [];
    if (currentGalleryFilter === 'all') {
      items = [
        ...(galleryData.monsters || []),
        ...(galleryData.weapons || []),
        ...(galleryData.characters || []),
        ...(galleryData.scenes || [])
      ];
    } else {
      items = galleryData[currentGalleryFilter] || [];
    }

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      card.innerHTML = `
        <img src="${item.path}" class="gallery-thumb" loading="lazy">
        <div class="gallery-card-title">${escapeHtml(item.title)}</div>
      `;
      card.addEventListener('click', () => {
        vibrate(30);
        if (alienPreviewImg) alienPreviewImg.src = item.path;
        if (alienFormImage) alienFormImage.value = item.path;
        closeGalleryModal();
      });
      galleryGrid.appendChild(card);
    });
  }

  window.filterGalleryCategory = function(cat, btn) {
    vibrate(20);
    currentGalleryFilter = cat;
    const filterButtons = document.querySelectorAll('#galleryCategoryFilters button');
    filterButtons.forEach(b => b.classList.remove('btn-primary', 'active'));
    if (btn) btn.classList.add('btn-primary', 'active');
    renderGalleryGrid();
  };

  if (btnOpenGallery) {
    btnOpenGallery.addEventListener('click', async () => {
      vibrate(25);
      await loadGalleryData();
      renderGalleryGrid();
      if (galleryModal) galleryModal.classList.add('active');
    });
  }

  window.closeGalleryModal = function() {
    if (galleryModal) galleryModal.classList.remove('active');
  };

  // Initial Render
  renderAll();
  renderSavedRooms();

  // Auto-connect check from URL query parameter ?room=...
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');

  if (roomParam) {
    connectToRoom(roomParam);
  } else {
    roomConnectOverlay.style.display = 'flex';
  }

  btnConnectRoom.addEventListener('click', () => {
    const inputPin = roomPinInput.value.trim();
    if (inputPin) {
      connectToRoom(inputPin);
    }
  });

  roomPinInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      const inputPin = roomPinInput.value.trim();
      if (inputPin) connectToRoom(inputPin);
    }
  });

  if (btnPastePin) {
    btnPastePin.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          roomPinInput.value = text.trim();
          connectToRoom(text.trim());
        }
      } catch (err) {
        roomPinInput.focus();
      }
    });
  }

  const syncStatusEl = document.querySelector('.sync-status');
  if (syncStatusEl) {
    syncStatusEl.style.cursor = 'pointer';
    syncStatusEl.title = 'Clic para cambiar sala';
    syncStatusEl.addEventListener('click', () => {
      roomConnectOverlay.style.display = 'flex';
      renderSavedRooms();
      roomPinInput.focus();
    });
  }
})();
