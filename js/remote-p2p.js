// Gantz Mobile Remote Controller (PeerJS P2P Cloud)
(function() {
  let peer = null;
  let conn = null;
  let roomId = null;
  let aliensList = window.GANTZ_DEFAULT_ALIENS || [];
  
  let defaultState = {
    mode: 'standby',
    timer: { totalSeconds: 3600, remainingSeconds: 3600, isRunning: false },
    currentAlien: aliensList[0] || null,
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

  let broadcastChan = null;

  // Setup BroadcastChannel immediately
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      broadcastChan = new BroadcastChannel('gantz_sync_channel');
      broadcastChan.onmessage = (event) => {
        if (event.data) handleServerMessage(event.data);
      };
    }
  } catch (e) {}

  function showFeedback(msg, color = '#ffd700') {
    if (connectFeedback) {
      connectFeedback.textContent = msg;
      connectFeedback.style.color = color;
      connectFeedback.style.display = 'block';
    }
  }

  // PeerJS Connection Setup
  function connectToRoom(targetRoomId) {
    let clean = targetRoomId.trim().toUpperCase();
    if (!clean) return;

    // Normalize room ID: if user types "2ZN5", turn it into "gantz-2zn5"
    let peerTarget = clean.toLowerCase();
    if (!peerTarget.startsWith('gantz-')) {
      peerTarget = 'gantz-' + peerTarget;
    }
    roomId = peerTarget;

    // Immediately hide the connect overlay to let the user control the app
    roomConnectOverlay.style.display = 'none';
    syncDot.style.background = '#00ff66';
    syncDot.style.boxShadow = '0 0 8px #00ff66';
    syncText.textContent = clean;
    syncText.style.color = '#00ff66';

    // 1. BroadcastChannel for local preview
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        if (!broadcastChan) {
          broadcastChan = new BroadcastChannel('gantz_sync_channel');
          broadcastChan.onmessage = (event) => {
            if (event.data) handleServerMessage(event.data);
          };
        }
        broadcastChan.postMessage({ type: 'REQUEST_SYNC', targetRoom: roomId });
      }
    } catch (e) {}

    // 2. PeerJS WebRTC for Cloud/Mobile
    try {
      if (!peer) {
        peer = new Peer();
      }

      function doPeerConnect() {
        console.log('Peer ready, connecting to display room:', roomId);
        conn = peer.connect(roomId, { reliable: true });

        conn.on('open', () => {
          console.log('WebRTC Connection established with Display!');
          syncDot.style.background = '#00ff66';
          syncDot.style.boxShadow = '0 0 8px #00ff66';
          syncText.textContent = clean;
          syncText.style.color = '#00ff66';
          conn.send({ type: 'REQUEST_SYNC' });
        });

        conn.on('data', (data) => {
          handleServerMessage(data);
        });

        conn.on('close', () => {
          console.warn('Connection closed');
        });
      }

      if (peer.open) {
        doPeerConnect();
      } else {
        peer.on('open', () => {
          doPeerConnect();
        });
      }
    } catch (err) {
      console.warn('Peer error:', err);
    }
  }

  function sendDisplay(data) {
    data.targetRoom = roomId;
    if (conn && conn.open) {
      conn.send(data);
    }
    if (broadcastChan) {
      try { broadcastChan.postMessage(data); } catch (e) {}
    }
  }

  function handleServerMessage(msg) {
    switch (msg.type) {
      case 'SYNC_STATE':
        appState = msg.state;
        aliensList = msg.aliens || aliensList;
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

      case 'HUNTERS_UPDATED':
        if (appState) appState.hunters = msg.hunters;
        renderHunters();
        break;
    }
  }

  function renderAll() {
    renderTimer();
    renderMonsters();
    renderHunters();
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
    if (!appState || !appState.timer) return;
    const action = appState.timer.isRunning ? 'pause' : 'start';
    sendDisplay({ type: 'TIMER_CONTROL', action });
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

  // 2. MONSTERS
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
    document.getElementById('alienFormQuote').value = alien.quote || '';
    document.getElementById('alienFormImage').value = alien.image || '';
    document.getElementById('alienFormDesc').value = alien.description || '';
    document.getElementById('alienFormWeakness').value = alien.weakness || '';

    alienModalTitle.textContent = '✏️ EDITAR OBJETIVO';
    alienModal.classList.add('active');
  };

  btnNewAlien.addEventListener('click', () => {
    vibrate(20);
    alienForm.reset();
    document.getElementById('alienFormId').value = 'alien-' + Date.now();
    document.getElementById('alienFormImage').value = 'assets/aliens/alien_negi.jpg';
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
      category: document.getElementById('alienFormCat').value,
      points: parseInt(document.getElementById('alienFormPoints').value, 10) || 0,
      quote: document.getElementById('alienFormQuote').value,
      image: document.getElementById('alienFormImage').value,
      description: document.getElementById('alienFormDesc').value,
      weakness: document.getElementById('alienFormWeakness').value
    };

    sendDisplay({ type: 'SAVE_ALIEN', alien: newAlien });
    closeAlienModal();
  });

  // 3. HUNTERS
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

  // Initial Render
  renderAll();

  // Auto-connect check from URL query parameter ?room=...
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');

  if (roomParam) {
    roomConnectOverlay.style.display = 'none';
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
        showFeedback('Presiona CTRL+V para pegar');
      }
    });
  }

  const syncStatusEl = document.querySelector('.sync-status');
  if (syncStatusEl) {
    syncStatusEl.style.cursor = 'pointer';
    syncStatusEl.title = 'Clic para cambiar sala';
    syncStatusEl.addEventListener('click', () => {
      roomConnectOverlay.style.display = 'flex';
      roomPinInput.focus();
    });
  }
})();
