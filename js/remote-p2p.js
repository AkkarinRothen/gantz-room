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

  function vibrate(msOrPattern = 30) {
    try {
      if (window.AndroidBridge) {
        if (typeof msOrPattern === 'string') {
          window.AndroidBridge.vibratePattern(msOrPattern);
          return;
        } else if (typeof msOrPattern === 'number') {
          window.AndroidBridge.vibrate(msOrPattern);
          return;
        }
      }
      if ('vibrate' in navigator) {
        if (typeof msOrPattern === 'string') {
          if (msOrPattern === 'xgun') navigator.vibrate([25, 2500, 80, 50, 160, 60, 320]);
          else if (msOrPattern === 'ygun') navigator.vibrate([40, 50, 40, 50, 140]);
          else if (msOrPattern === 'suit') navigator.vibrate([180, 60, 320]);
          else if (msOrPattern === 'sword') navigator.vibrate([30, 40, 80]);
          else if (msOrPattern === 'sphere') navigator.vibrate([100, 50, 160, 50, 240, 50, 400]);
          else if (msOrPattern === 'heartbeat') navigator.vibrate([70, 120, 130]);
          else navigator.vibrate(30);
        } else {
          navigator.vibrate(msOrPattern);
        }
      }
    } catch (e) {}
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

  function cleanRoomId(input) {
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

  // Broadcast to all connected transports
  function sendDisplay(data) {
    data.source = 'remote';
    data.targetRoom = roomId;
    logNet(`Enviando a Display [${data.type}]`, data);

    // 1. WebRTC DataChannel
    if (conn && conn.open) {
      try { conn.send(data); } catch (e) {}
    } else if (peer && peer.open && roomId) {
      // Try to re-establish connection if dropped
      try {
        conn = peer.connect(roomId, { reliable: true });
        conn.on('open', () => {
          try { conn.send(data); } catch (e) {}
        });
      } catch (e) {}
    }

    // 2. Local WebSocket Relay
    if (localWS && localWS.readyState === WebSocket.OPEN) {
      try { localWS.send(JSON.stringify(data)); } catch (e) {}
    }

    // 3. Browser BroadcastChannel
    if (broadcastChan) {
      try { broadcastChan.postMessage(data); } catch (e) {}
    }

    // 4. LocalStorage Cross-Tab Fallback
    try {
      localStorage.setItem('gantz_remote_event', JSON.stringify({ ...data, ts: Date.now() }));
    } catch (e) {}
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
        if (msg.appVersion) {
          checkAppVersion(msg.appVersion);
        }
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

      case 'PONG':
        missedPongs = 0;
        const rtt = Date.now() - msg.timestamp;
        if (latencyBadge) {
          latencyBadge.textContent = `${rtt} ms`;
          if (rtt < 80) {
            latencyBadge.style.color = '#00ff66';
            latencyBadge.style.borderColor = '#00ff66';
            latencyBadge.style.background = 'rgba(0,255,102,0.15)';
          } else if (rtt < 200) {
            latencyBadge.style.color = '#00f0ff';
            latencyBadge.style.borderColor = '#00f0ff';
            latencyBadge.style.background = 'rgba(0,240,255,0.15)';
          } else {
            latencyBadge.style.color = '#ff003c';
            latencyBadge.style.borderColor = '#ff003c';
            latencyBadge.style.background = 'rgba(255,0,60,0.15)';
          }
        }
        break;

      case 'HAPTIC_PULSE':
        if (msg.pattern === 'fatal') {
          vibrate([150, 50, 150, 50, 300]);
        } else {
          vibrate(50);
        }
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
    const clean = cleanRoomId(targetRoomId);
    if (!clean) {
      if (connectFeedback) {
        connectFeedback.style.display = 'block';
        connectFeedback.textContent = '⚠️ Ingresa un código PIN válido (ej: GANTZ-XXXX)';
        connectFeedback.style.color = '#ff003c';
      }
      return;
    }

    roomId = clean.toLowerCase();

    // Save to Saved / Recent Rooms
    saveRoom(clean);

    if (window.GantzLogger) {
      window.GantzLogger.updateState('roomId', clean);
    }

    // Update URL query parameter
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('room', clean);
      window.history.replaceState(null, '', u.toString());
    } catch (e) {}

    log(`Iniciando conexión con la sala [${clean}]...`);
    
    // UI Visual status connecting
    syncDot.style.background = '#ffd700';
    syncDot.style.boxShadow = '0 0 8px #ffd700';
    syncText.textContent = `CONECTANDO: ${clean}`;
    syncText.style.color = '#ffd700';

    if (connectFeedback) {
      connectFeedback.style.display = 'block';
      connectFeedback.textContent = `⚡ Vinculando con sala ${clean}...`;
      connectFeedback.style.color = '#ffd700';
    }

    // Auto-close overlay after brief connection start
    setTimeout(() => {
      if (roomConnectOverlay) roomConnectOverlay.style.display = 'none';
    }, 600);

    // Close any previous WebRTC connection if changing rooms
    if (conn) {
      try { conn.close(); } catch (e) {}
      conn = null;
    }

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
            setConnectedUI(clean);
          };
          localWS.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              handleServerMessage(data);
            } catch (e) {}
          };
        } else if (localWS.readyState === WebSocket.OPEN) {
          sendDisplay({ type: 'REQUEST_SYNC' });
          setConnectedUI(clean);
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
        setConnectedUI(clean);
      }
    } catch (e) {}

    // Layer 3: PeerJS WebRTC
    try {
      if (!peer) {
        logNet('Inicializando cliente PeerJS WebRTC...');
        if (window.GantzLogger) window.GantzLogger.updateState('brokerStatus', 'Conectando...');

        peer = new Peer({
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
      } else if (peer.disconnected) {
        peer.reconnect();
        peer.once('open', () => doPeerConnect());
      }

      function doPeerConnect() {
        logNet(`Intentando conexión WebRTC a Display [${roomId}]...`);
        if (conn) {
          try { conn.close(); } catch (e) {}
          conn = null;
        }
        conn = peer.connect(roomId, { reliable: true });

        conn.on('open', () => {
          logNet('✓ Conexión WebRTC P2P abierta con Display');
          setConnectedUI(clean);
          vibrate(50);
          conn.send({ type: 'REQUEST_SYNC', source: 'remote' });
        });

        conn.on('data', (data) => {
          handleServerMessage(data);
        });

        conn.on('close', () => {
          logWarn('Conexión WebRTC cerrada');
          if (window.GantzLogger) window.GantzLogger.updateState('webrtcStatus', 'Cerrado');
          syncDot.style.background = '#ff003c';
          syncDot.style.boxShadow = '0 0 8px #ff003c';
          syncText.textContent = `RECONECTAR (${clean})`;
          syncText.style.color = '#ff003c';
        });

        conn.on('error', (err) => {
          logError('Error en conexión WebRTC DataChannel:', err);
        });
      }
    } catch (err) {
      logError('Error en setup WebRTC:', err);
    }

    // Layer 4: LocalStorage Event Listener for Cross-Tab Sync
    try {
      window.addEventListener('storage', (e) => {
        if (e.key === 'gantz_display_event' && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            if (data && data.source === 'display') {
              handleServerMessage(data);
              setConnectedUI(clean);
            }
          } catch (err) {}
        }
      });
    } catch (e) {}
  }

  window.connectToRoom = connectToRoom;
  window.openRoomConnectOverlay = function() {
    vibrate(20);
    renderSavedRooms();
    if (roomConnectOverlay) roomConnectOverlay.style.display = 'flex';
  };
  window.closeRoomConnectOverlay = function() {
    vibrate(20);
    if (roomConnectOverlay) roomConnectOverlay.style.display = 'none';
  };

  let heartbeatTimer = null;
  let lastPingSent = 0;
  let missedPongs = 0;
  const latencyBadge = document.getElementById('latencyBadge');

  function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (conn && conn.open) {
        lastPingSent = Date.now();
        sendDisplay({ type: 'PING', timestamp: lastPingSent });
        missedPongs++;
        if (missedPongs >= 3) {
          logWarn('Sin respuesta de la Esfera. Intentando reconexión silenciosa...');
          if (latencyBadge) {
            latencyBadge.textContent = 'RECON...';
            latencyBadge.style.color = '#eab308';
            latencyBadge.style.borderColor = '#eab308';
          }
          if (roomId) connectToRoom(roomId);
        }
      }
    }, 2500);
  }

  function setConnectedUI(cleanName) {
    if (window.GantzLogger) {
      window.GantzLogger.updateState('webrtcStatus', 'Conectado');
      window.GantzLogger.updateState('transport', 'WebRTC P2P');
    }
    syncDot.style.background = '#00ff66';
    syncDot.style.boxShadow = '0 0 8px #00ff66';
    syncText.textContent = cleanName;
    syncText.style.color = '#00ff66';
    if (roomConnectOverlay) roomConnectOverlay.style.display = 'none';
    startHeartbeat();
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
        <img src="${alien.image || 'assets/aliens/alien_negi.jpg'}" class="monster-thumb" alt="${escapeHtml(alien.name)}">
        <div class="monster-info">
          <div class="monster-name">${escapeHtml(alien.name)}</div>
          <div class="monster-meta">
            <span>🏆 ${alien.points || 0} pts</span>
            <span>🏷️ ${escapeHtml(alien.category || 'Misión')}</span>
          </div>
          <div style="font-size: 0.72rem; color: #00ff66; margin-top: 2px;">💚 ${escapeHtml(alien.likes || 'Las cebolletas')}</div>
          <div class="monster-quote">${alien.quote ? `"${escapeHtml(alien.quote)}"` : ''}</div>
        </div>
        <div class="monster-actions">
          <button class="btn btn-sm ${isSelected ? 'btn-primary' : 'btn-cyan'}" onclick="selectAlien('${alien.id}')">
            ${isSelected ? '✓ EN PANTALLA' : 'Proyectar'}
          </button>
          <button class="btn btn-sm btn-cyan" onclick="speakAlienBriefing('${alien.id}')" title="Narrar briefing con voz IA de Gantz">
            🗣️
          </button>
          <button class="btn btn-sm btn-gold" onclick="inspectAlien('${alien.id}')" title="Inspección táctica con zoom en pantalla grande">
            🔍 Zoom
          </button>
          <button class="btn btn-sm" onclick="editAlien('${alien.id}')">✏️</button>
        </div>
      `;
      monstersContainer.appendChild(item);
    });
  }

  window.setAliensView = function(mode) {
    vibrate(20);
    const container = document.getElementById('monstersContainer');
    const btnGrid = document.getElementById('btnAliensGrid');
    const btnList = document.getElementById('btnAliensList');
    if (container) {
      container.classList.toggle('grid-view', mode === 'grid');
    }
    if (btnGrid && btnList) {
      btnGrid.className = `btn btn-sm ${mode === 'grid' ? 'btn-cyan' : ''}`;
      btnList.className = `btn btn-sm ${mode === 'list' ? 'btn-cyan' : ''}`;
    }
    try { localStorage.setItem('gantz_aliens_view_mode', mode); } catch (e) {}
  };

  window.setWeaponsView = function(mode) {
    vibrate(20);
    const container = document.getElementById('weaponsContainer');
    const btnGrid = document.getElementById('btnWeaponsGrid');
    const btnList = document.getElementById('btnWeaponsList');
    if (container) {
      container.classList.toggle('grid-view', mode === 'grid');
    }
    if (btnGrid && btnList) {
      btnGrid.className = `btn btn-sm ${mode === 'grid' ? 'btn-cyan' : ''}`;
      btnList.className = `btn btn-sm ${mode === 'list' ? 'btn-cyan' : ''}`;
    }
    try { localStorage.setItem('gantz_weapons_view_mode', mode); } catch (e) {}
  };

  let isRemoteCrtEnabled = true;
  window.toggleRemoteCrt = function() {
    vibrate(25);
    isRemoteCrtEnabled = !isRemoteCrtEnabled;
    const btn = document.getElementById('btnRemoteCrtToggle');
    if (btn) {
      btn.className = `btn ${isRemoteCrtEnabled ? 'btn-gold' : ''}`;
      btn.textContent = isRemoteCrtEnabled ? '📺 Filtro CRT (ON)' : '📺 Filtro CRT (OFF)';
    }
    sendDisplay({ type: 'TOGGLE_CRT', enabled: isRemoteCrtEnabled });
  };

  window.selectAlien = function(alienId) {
    vibrate(30);
    const alien = aliensList.find(a => a.id === alienId);
    if (alien) {
      if (appState) appState.currentAlien = alien;
      renderMonsters();
      sendDisplay({ type: 'SELECT_ALIEN', alien });
    }
  };

  const alienPreviewContainer = document.getElementById('alienPreviewContainer');

  function updatePreviewFraming() {
    const y = alienFramePosY ? parseInt(alienFramePosY.value, 10) : 0;
    const x = alienFramePosX ? parseInt(alienFramePosX.value, 10) : 50;
    const scale = alienFrameScale ? (alienFrameScale.value / 100).toFixed(2) : 1.05;

    if (labelFramePosY) labelFramePosY.textContent = `${y}%`;
    if (labelFramePosX) labelFramePosX.textContent = `${x}%`;
    if (labelFrameScale) labelFrameScale.textContent = `${scale}x`;

    if (alienPreviewImg) {
      alienPreviewImg.style.objectPosition = `${x}% ${y}%`;
      alienPreviewImg.style.transform = `scale(${scale})`;
    }

    sendDisplay({
      type: 'LIVE_ALIEN_FRAMING',
      posX: x,
      posY: y,
      scale: scale
    });
  }

  if (alienFramePosY) alienFramePosY.addEventListener('input', updatePreviewFraming);
  if (alienFramePosX) alienFramePosX.addEventListener('input', updatePreviewFraming);
  if (alienFrameScale) alienFrameScale.addEventListener('input', updatePreviewFraming);

  // Initialize Touch gestures on Alien Preview Box
  if (alienPreviewContainer && alienPreviewImg) {
    initTouchZoomPan(
      alienPreviewContainer,
      alienPreviewImg,
      () => ({
        posX: alienFramePosX ? parseInt(alienFramePosX.value, 10) : 50,
        posY: alienFramePosY ? parseInt(alienFramePosY.value, 10) : 0,
        scale: alienFrameScale ? parseFloat((alienFrameScale.value / 100).toFixed(2)) : 1.05
      }),
      (vals) => {
        if (alienFramePosX) alienFramePosX.value = Math.round(vals.posX);
        if (alienFramePosY) alienFramePosY.value = Math.round(vals.posY);
        if (alienFrameScale) alienFrameScale.value = Math.round(vals.scale * 100);
        updatePreviewFraming();
      },
      () => {
        updatePreviewFraming();
      }
    );
  }

  window.quickFramePosition = function(y, x, scale) {
    vibrate(20);
    if (alienFramePosY) alienFramePosY.value = y;
    if (alienFramePosX) alienFramePosX.value = x;
    if (alienFrameScale) alienFrameScale.value = Math.round(scale * 100);
    updatePreviewFraming();
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
    if (alienPreviewImg) alienPreviewImg.src = alien.image || 'assets/webp/monsters/alien_cebolla_joven_recortado.webp';

    // Parse imagePosition (e.g. "center 10%" or "50% 10%")
    let posY = 0;
    let posX = 50;
    if (alien.imagePosition) {
      const parts = alien.imagePosition.split(' ');
      if (parts.length >= 2) {
        if (parts[0] === 'center') posX = 50;
        else posX = parseInt(parts[0], 10) || 50;

        if (parts[1] === 'top') posY = 0;
        else if (parts[1] === 'center') posY = 50;
        else if (parts[1] === 'bottom') posY = 100;
        else posY = parseInt(parts[1], 10) || 0;
      }
    }

    if (alienFramePosY) alienFramePosY.value = posY;
    if (alienFramePosX) alienFramePosX.value = posX;
    if (alienFrameScale) alienFrameScale.value = Math.round((alien.imageScale || 1.05) * 100);
    updatePreviewFraming();

    alienModalTitle.textContent = '✏️ EDITAR OBJETIVO';
    alienModal.classList.add('active');
  };

  btnNewAlien.addEventListener('click', () => {
    vibrate(20);
    alienForm.reset();
    document.getElementById('alienFormId').value = 'alien-' + Date.now();
    document.getElementById('alienFormImage').value = 'assets/webp/monsters/alien_cebolla_joven_recortado.webp';
    if (alienPreviewImg) alienPreviewImg.src = 'assets/webp/monsters/alien_cebolla_joven_recortado.webp';
    if (alienFramePosY) alienFramePosY.value = 0;
    if (alienFramePosX) alienFramePosX.value = 50;
    if (alienFrameScale) alienFrameScale.value = 105;
    updatePreviewFraming();

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
    const posX = alienFramePosX ? alienFramePosX.value : 50;
    const posY = alienFramePosY ? alienFramePosY.value : 0;
    const scale = alienFrameScale ? (alienFrameScale.value / 100) : 1.05;

    const newAlien = {
      id,
      name: document.getElementById('alienFormName').value,
      category: document.getElementById('alienFormCat').value || 'Misión',
      points: parseInt(document.getElementById('alienFormPoints').value, 10) || 0,
      characteristics: document.getElementById('alienFormCharacteristics').value || 'FUERTE',
      likes: document.getElementById('alienFormLikes').value || 'LAS COSAS RARAS',
      dislikes: document.getElementById('alienFormDislikes').value || '',
      quote: document.getElementById('alienFormQuote').value || '...',
      image: document.getElementById('alienFormImage').value || 'assets/webp/monsters/alien_cebolla_joven_recortado.webp',
      imagePosition: `${posX}% ${posY}%`,
      imageScale: parseFloat(scale)
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
      const isRevealed = !!wpn.isRevealed;
      const item = document.createElement('div');
      item.className = `monster-item ${isSelected ? 'selected' : ''}`;
      item.innerHTML = `
        <div style="position: relative; width: 65px; height: 65px; border-radius: 6px; overflow: hidden; border: 1px solid rgba(0,240,255,0.4); flex-shrink: 0; background: #000;">
          <img src="${wpn.image || 'assets/webp/weapons/civil_y_pistola_alienigena_en_retroceso.webp'}" style="width: 100%; height: 100%; object-fit: cover;">
          <div style="position: absolute; bottom: 2px; right: 2px; background: rgba(0,0,0,0.7); font-size: 0.8rem; padding: 1px 3px; border-radius: 3px;">
            ${wpn.icon || '🔫'}
          </div>
        </div>
        <div class="monster-info" style="flex: 1;">
          <div class="monster-name" style="display: flex; align-items: center; gap: 6px;">
            <span>${escapeHtml(wpn.name)}</span>
            <span style="font-size: 0.65rem; padding: 1px 6px; border-radius: 4px; ${isRevealed ? 'background: rgba(0,255,102,0.2); color: #00ff66; border: 1px solid #00ff66;' : 'background: rgba(255,0,60,0.2); color: #ff003c; border: 1px solid rgba(255,0,60,0.5);'}">
              ${isRevealed ? '🔓 REVELADA' : '🔒 OCULTA'}
            </span>
          </div>
          <div class="monster-meta">
            <span style="color: #00f0ff;">🏷️ ${escapeHtml(wpn.category || 'Armamento')}</span>
            <span>📏 ${escapeHtml(wpn.range || 'Medio')}</span>
          </div>
          <div style="font-size: 0.72rem; color: #fbbf24; margin-top: 2px;">
            💥 <strong>Daño (Master):</strong> ${escapeHtml(wpn.damageInfo || '2d10')}
          </div>
          <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 2px; line-height: 1.25;">
            ⚡ <em>${escapeHtml(wpn.secretMechanics || wpn.mechanics || wpn.description || '')}</em>
          </div>
        </div>
        <div class="monster-actions" style="display: flex; flex-direction: column; gap: 4px; min-width: 95px;">
          <button class="btn btn-sm ${isSelected ? 'btn-primary' : 'btn-cyan'}" onclick="selectWeapon('${wpn.id}')" style="font-size: 0.72rem; padding: 4px 6px;">
            ${isSelected ? '✓ EN PANTALLA' : '📺 Proyectar'}
          </button>
          <button class="btn btn-sm btn-gold" onclick="inspectWeapon('${wpn.id}')" style="font-size: 0.72rem; padding: 4px 6px;" title="Inspección táctica con zoom en pantalla grande">
            🔍 Zoom
          </button>
          <button class="btn btn-sm ${isRevealed ? 'btn-danger' : 'btn-gold'}" onclick="toggleRevealWeapon('${wpn.id}')" style="font-size: 0.72rem; padding: 4px 6px;" title="${isRevealed ? 'Ocultar mecánicas a jugadores' : 'Revelar mecánicas en la Esfera'}">
            ${isRevealed ? '🔒 Ocultar' : '👁️ Revelar'}
          </button>
          <button class="btn btn-sm btn-danger" onclick="fireWeapon('${wpn.id}')" style="font-size: 0.72rem; padding: 4px 6px;" title="Disparar sonido">
            💥 Disparar
          </button>
          <button class="btn btn-sm" onclick="editWeapon('${wpn.id}')" style="font-size: 0.68rem; padding: 3px 6px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2);">
            ✏️ Editar
          </button>
        </div>
      `;
      weaponsContainer.appendChild(item);
    });
  }

  window.toggleRevealWeapon = function(weaponId) {
    vibrate(40);
    const weapon = weaponsList.find(w => w.id === weaponId);
    if (weapon) {
      weapon.isRevealed = !weapon.isRevealed;
      renderWeapons();
      sendDisplay({ type: 'TOGGLE_REVEAL_WEAPON', weaponId: weapon.id, isRevealed: weapon.isRevealed });
      log(`${weapon.isRevealed ? '🔓 Revelado' : '🔒 Ocultado'}: ${weapon.name} a los jugadores`);
    }
  };

  window.selectWeapon = function(weaponId) {
    vibrate(35);
    const weapon = weaponsList.find(w => w.id === weaponId);
    if (weapon) {
      if (appState) appState.currentWeapon = weapon;
      renderWeapons();
      sendDisplay({ type: 'SELECT_WEAPON', weapon });
      sendDisplay({ type: 'SET_MODE', mode: 'weapon' });
      log(`📺 Proyectando arma en la Esfera: ${weapon.name}`);
    }
  };

  window.fireWeapon = function(weaponId) {
    vibrate(50);
    const weapon = weaponsList.find(w => w.id === weaponId);
    if (weapon) {
      log(`💥 Disparando arma: ${weapon.name}`);
      sendDisplay({ type: 'TRIGGER_SOUND', sound: weapon.sound || 'xgun' });
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
    document.getElementById('weaponFormImage').value = weapon.image || '';
    document.getElementById('weaponFormRange').value = weapon.range || '';
    document.getElementById('weaponFormDamage').value = weapon.damageInfo || '';
    document.getElementById('weaponFormSound').value = weapon.sound || 'xgun';
    document.getElementById('weaponFormMechanics').value = weapon.secretMechanics || weapon.mechanics || weapon.description || '';
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

  const btnOpenWeaponGallery = document.getElementById('btnOpenWeaponGallery');
  if (btnOpenWeaponGallery) {
    btnOpenWeaponGallery.addEventListener('click', async () => {
      vibrate(25);
      await loadGalleryData();
      currentGalleryFilter = 'weapons';
      renderGalleryGrid();
      if (galleryModal) galleryModal.classList.add('active');
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
        image: document.getElementById('weaponFormImage').value || 'assets/webp/weapons/civil_y_pistola_alienigena_en_retroceso.webp',
        range: document.getElementById('weaponFormRange').value || 'Medio (30m)',
        damageInfo: document.getElementById('weaponFormDamage').value || '2d10 Daño',
        sound: document.getElementById('weaponFormSound').value || 'xgun',
        secretMechanics: document.getElementById('weaponFormMechanics').value || '',
        quote: document.getElementById('weaponFormQuote').value || '',
        isRevealed: false
      };

      const idx = weaponsList.findIndex(w => w.id === id);
      if (idx >= 0) {
        newWeapon.isRevealed = weaponsList[idx].isRevealed || false;
        weaponsList[idx] = newWeapon;
      } else {
        weaponsList.push(newWeapon);
      }

      if (appState && appState.currentWeapon && appState.currentWeapon.id === id) {
        appState.currentWeapon = newWeapon;
      }
      renderWeapons();
      sendDisplay({ type: 'SAVE_WEAPON', weapon: newWeapon });
      closeWeaponModal();
    });
  }

  // 4. HUNTERS
  let current100HunterIdx = null;

  function renderHunters() {
    huntersContainer.innerHTML = '';
    const hunters = appState?.hunters || [];

    hunters.forEach((h, idx) => {
      const card = document.createElement('div');
      card.className = 'hunter-card';
      const status = h.status || 'alive';
      const statusLabel = status === 'dead' ? '💀 MUERTO' : (status === 'liberated' ? '✨ LIBERADO' : '🟢 VIVO');
      const statusColor = status === 'dead' ? '#ff003c' : (status === 'liberated' ? '#ffd700' : '#00ff66');
      const suit = h.suitIntegrity !== undefined ? h.suitIntegrity : 100;

      card.innerHTML = `
        <div class="hunter-header-row">
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="text" class="hunter-name-input" value="${escapeHtml(h.name)}" onchange="updateHunterField(${idx}, 'name', this.value)" style="flex: 1;">
              <span class="btn btn-sm" onclick="toggleHunterStatus(${idx})" style="padding: 2px 6px; font-size: 0.68rem; background: rgba(0,0,0,0.6); border: 1px solid ${statusColor}; color: ${statusColor}; cursor: pointer;">
                ${statusLabel}
              </span>
            </div>
            <input type="text" class="hunter-nick-input" value="${escapeHtml(h.nickname || 'Novato')}" onchange="updateHunterField(${idx}, 'nickname', this.value)" placeholder="Apodo Gantz..." style="margin-top: 4px;">
          </div>
          <div class="hunter-points-badge">+${h.points || 0} pts</div>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px; padding: 4px 8px; background: rgba(0,0,0,0.5); border: 1px solid rgba(0,240,255,0.15); border-radius: 4px; font-size: 0.72rem;">
          <span style="color: #94a3b8; font-weight: bold;">🦺 Traje:</span>
          <div style="display: flex; gap: 4px;">
            <button type="button" class="btn btn-sm" onclick="setHunterSuit(${idx}, 100)" style="font-size: 0.65rem; padding: 2px 6px; ${suit === 100 ? 'border-color: #00ff66; color: #00ff66; background: rgba(0,255,102,0.15);' : 'opacity: 0.5;'}">🛡️ 100%</button>
            <button type="button" class="btn btn-sm" onclick="setHunterSuit(${idx}, 50)" style="font-size: 0.65rem; padding: 2px 6px; ${suit === 50 ? 'border-color: #00f0ff; color: #00f0ff; background: rgba(0,240,255,0.15);' : 'opacity: 0.5;'}">⚡ 50%</button>
            <button type="button" class="btn btn-sm" onclick="setHunterSuit(${idx}, 0)" style="font-size: 0.65rem; padding: 2px 6px; ${suit === 0 ? 'border-color: #ff003c; color: #ff003c; background: rgba(255,0,60,0.15);' : 'opacity: 0.5;'}">💥 Roto</button>
          </div>
        </div>

        <div class="hunter-controls-row" style="margin-top: 8px;">
          <button class="btn btn-sm" onclick="adjustHunterScore(${idx}, -1)">-1</button>
          <button class="btn btn-sm btn-primary" onclick="adjustHunterScore(${idx}, 1)">+1</button>
          <button class="btn btn-sm btn-cyan" onclick="adjustHunterScore(${idx}, 5)">+5</button>
          <button class="btn btn-sm btn-gold" onclick="adjustHunterScore(${idx}, 10)">+10</button>
          <button class="btn btn-sm btn-cyan" onclick="openHunterRoastModal(${idx})" title="Narrar evaluación cínica de Gantz con IA">
            🗣️
          </button>
          <button class="btn btn-sm btn-gold" onclick="open100PtsModal(${idx})" title="Menú de 100 Puntos">
            🏆 100 PTS
          </button>
          <div style="flex: 1; text-align: right; font-size: 0.75rem; color: #94a3b8;">
            Total: <strong>${h.totalPoints || 0}</strong> pts
          </div>
          <button class="btn btn-sm btn-danger" onclick="removeHunter(${idx})">✕</button>
        </div>
      `;
      huntersContainer.appendChild(card);
    });
  }

  window.setHunterSuit = function(idx, level) {
    vibrate(20);
    if (!appState || !appState.hunters || !appState.hunters[idx]) return;
    appState.hunters[idx].suitIntegrity = level;
    sendDisplay({ type: 'UPDATE_HUNTERS', hunters: appState.hunters });
    renderHunters();
  };

  window.toggleHunterStatus = function(idx) {
    vibrate(25);
    if (!appState || !appState.hunters || !appState.hunters[idx]) return;
    const h = appState.hunters[idx];
    if (h.status === 'alive' || !h.status) h.status = 'dead';
    else if (h.status === 'dead') h.status = 'liberated';
    else h.status = 'alive';
    sendDisplay({ type: 'UPDATE_HUNTERS', hunters: appState.hunters });
    renderHunters();
  };

  // ==================== 100 POINTS MODAL LOGIC ====================
  const modal100Pts = document.getElementById('modal100Pts');
  const modal100HunterName = document.getElementById('modal100HunterName');
  const modal100HunterPoints = document.getElementById('modal100HunterPoints');
  const select100Resurrect = document.getElementById('select100Resurrect');
  const select100Weapon = document.getElementById('select100Weapon');

  window.open100PtsModal = function(hunterIdx) {
    vibrate(30);
    if (!appState || !appState.hunters || !appState.hunters[hunterIdx]) return;
    current100HunterIdx = hunterIdx;
    const h = appState.hunters[hunterIdx];

    if (modal100HunterName) modal100HunterName.textContent = h.name;
    if (modal100HunterPoints) modal100HunterPoints.textContent = `Puntos Acumulados: ${h.totalPoints || 0} pts`;

    // Populate dead hunters list
    if (select100Resurrect) {
      select100Resurrect.innerHTML = '';
      const deadHunters = (appState.hunters || []).filter((dh, i) => i !== hunterIdx && dh.status === 'dead');
      if (deadHunters.length === 0) {
        select100Resurrect.innerHTML = '<option value="">(No hay compañeros caídos en la memoria)</option>';
      } else {
        deadHunters.forEach(dh => {
          const opt = document.createElement('option');
          opt.value = dh.id;
          opt.textContent = `💀 ${dh.name} (${dh.nickname || 'Novato'})`;
          select100Resurrect.appendChild(opt);
        });
      }
    }

    if (modal100Pts) modal100Pts.classList.add('active');
  };

  window.close100PtsModal = function() {
    if (modal100Pts) modal100Pts.classList.remove('active');
  };

  window.project100PtsMenu = function() {
    vibrate(40);
    if (current100HunterIdx === null || !appState || !appState.hunters) return;
    const h = appState.hunters[current100HunterIdx];
    sendDisplay({ type: 'TRIGGER_100PTS_MENU', hunter: h });
    log(`🏆 Menú de 100 Puntos Proyectado para ${h.name}`);
  };

  window.confirm100PtsReward = function() {
    vibrate(50);
    if (current100HunterIdx === null || !appState || !appState.hunters) return;
    const h = appState.hunters[current100HunterIdx];
    const choiceInput = document.querySelector('input[name="opt100Choice"]:checked');
    const option = choiceInput ? parseInt(choiceInput.value, 10) : 1;

    let resolutionTitle = '';
    let resolutionBody = '';

    if (option === 1) {
      // 1. Borrar memoria y ser liberado
      h.status = 'liberated';
      h.totalPoints = Math.max(0, (h.totalPoints || 0) - 100);
      h.points = 0;
      resolutionTitle = `¡${h.name.toUpperCase()} HA ELEGIDO LA LIBERTAD!`;
      resolutionBody = 'MEMORIA BORRADA // TRASLADO AL MUNDO REAL';
    } else if (option === 2) {
      // 2. Obtener un arma más potente
      const weaponId = select100Weapon ? select100Weapon.value : 'wpn-zgun';
      const wpn = weaponsList.find(w => w.id === weaponId) || { name: 'Super Arma' };
      h.totalPoints = Math.max(0, (h.totalPoints || 0) - 100);
      h.points = 0;
      resolutionTitle = `¡${h.name.toUpperCase()} OBTIENE: ${wpn.name.toUpperCase()}!`;
      resolutionBody = 'ARSENAL SUPERIOR DESBLOQUEADO EN EL RACK';
    } else if (option === 3) {
      // 3. Revivir a una persona
      const deadHunterId = select100Resurrect ? select100Resurrect.value : null;
      const deadHunter = (appState.hunters || []).find(dh => String(dh.id) === String(deadHunterId));
      h.totalPoints = Math.max(0, (h.totalPoints || 0) - 100);
      h.points = 0;

      if (deadHunter) {
        deadHunter.status = 'alive';
        deadHunter.points = 0;
        resolutionTitle = `¡RECONSTRUYENDO A ${deadHunter.name.toUpperCase()}!`;
        resolutionBody = 'SÍNTESIS BIOLÓGICA COMPLETADA // VUELVE AL JUEGO';
      } else {
        resolutionTitle = '¡RECONSTRUCCIÓN DE MEMORIA EJECUTADA!';
        resolutionBody = 'SUJETO RESTAURADO EN LA SALA';
      }
    }

    sendDisplay({ type: 'UPDATE_HUNTERS', hunters: appState.hunters });
    sendDisplay({
      type: 'RESOLVE_100PTS_REWARD',
      option,
      title: resolutionTitle,
      body: resolutionBody
    });

    renderHunters();
    close100PtsModal();
    log(`✨ Recompensa de 100 Puntos otorgada a ${h.name}: Opción ${option}`);
  };

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

  // ==================== DYNAMIC SCORING ROASTS CONTROLLER ====================
  let currentRoastHunterIdx = null;

  window.openHunterRoastModal = function(hunterIdx) {
    vibrate(30);
    if (!appState || !appState.hunters || !appState.hunters[hunterIdx]) return;
    currentRoastHunterIdx = hunterIdx;
    const h = appState.hunters[hunterIdx];

    const modal = document.getElementById('scoringRoastModal');
    const nameEl = document.getElementById('roastHunterName');
    const ptsEl = document.getElementById('roastHunterPoints');
    const inputEl = document.getElementById('inputHunterRoastText');

    if (nameEl) nameEl.textContent = h.name || 'Cazador';
    if (ptsEl) ptsEl.textContent = `${h.points || 0} pts (Total: ${h.totalPoints || 0})`;

    const roastText = window.GantzScoringEvaluator ? window.GantzScoringEvaluator.generateRoast(h) : `${h.name}: ${h.points || 0} puntos.`;
    if (inputEl) inputEl.value = roastText;

    if (modal) modal.style.display = 'flex';
  };

  window.closeHunterRoastModal = function() {
    vibrate(20);
    const modal = document.getElementById('scoringRoastModal');
    if (modal) modal.style.display = 'none';
  };

  window.rerollHunterRoast = function() {
    vibrate(25);
    if (currentRoastHunterIdx === null || !appState?.hunters?.[currentRoastHunterIdx]) return;
    const h = appState.hunters[currentRoastHunterIdx];
    const inputEl = document.getElementById('inputHunterRoastText');
    if (inputEl && window.GantzScoringEvaluator) {
      inputEl.value = window.GantzScoringEvaluator.generateRoast(h);
    }
  };

  window.confirmNarrateHunterScore = async function() {
    vibrate(40);
    if (currentRoastHunterIdx === null || !appState?.hunters?.[currentRoastHunterIdx]) return;
    const h = appState.hunters[currentRoastHunterIdx];
    const inputEl = document.getElementById('inputHunterRoastText');
    const text = inputEl ? inputEl.value.trim() : '';
    if (!text) return;

    closeHunterRoastModal();
    await narrateSingleHunterRoast(h, text);
  };

  async function narrateSingleHunterRoast(hunter, text) {
    // 1. Switch display to scoring mode and highlight hunter
    sendDisplay({
      type: 'EVALUATE_HUNTER_CEREMONY',
      hunter: hunter,
      text: text
    });

    // 2. Synthesize audio via ElevenLabs
    if (window.GantzTTS && window.GantzTTS.hasApiKey()) {
      try {
        log(`🎙️ Generando locución de Gantz para ${hunter.name}...`);
        const res = await window.GantzTTS.synthesize(text);
        sendDisplay({
          type: 'PLAY_TTS',
          audioBase64: res.audioBase64,
          text: text
        });
      } catch (err) {
        log('❌ Error TTS:', err.message);
      }
    }
  }

  window.evaluateAllHuntersWithTTS = async function() {
    vibrate(50);
    if (!appState || !appState.hunters || appState.hunters.length === 0) {
      alert('No hay cazadores registrados para evaluar.');
      return;
    }

    const btn = document.getElementById('btnEvaluateAllTTS');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ EVALUANDO...';
    }

    sendDisplay({ type: 'SET_MODE', mode: 'scoring' });
    sendDisplay({ type: 'TRIGGER_SOUND', sound: 'score' });

    log('🎙️ Iniciando evaluación ceremonial completa con voz de Gantz...');

    for (let i = 0; i < appState.hunters.length; i++) {
      const h = appState.hunters[i];
      const text = window.GantzScoringEvaluator ? window.GantzScoringEvaluator.generateRoast(h) : `${h.name}: ${h.points || 0} puntos.`;

      log(`[${i + 1}/${appState.hunters.length}] Evaluando a ${h.name}...`);
      await narrateSingleHunterRoast(h, text);

      // Wait for speech duration (~14 chars/sec + 1.8s pause)
      const waitTime = Math.max(3500, (text.length / 14) * 1000 + 1800);
      await new Promise(r => setTimeout(r, waitTime));
    }

    log('✨ Ceremonia de evaluación completada');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🗣️ EVALUAR CON VOZ GANTZ';
    }
  };

  // ==================== SHADOWDARK INITIATIVE & TURN TRACKER ====================
  let initiativeQueue = [];
  let currentTurnIndex = -1;

  window.rollInitiative = function() {
    vibrate(45);
    initiativeQueue = [];
    const hunters = appState?.hunters || [];
    hunters.forEach(h => {
      if (!h.isDead && h.status !== 'dead') {
        const roll = Math.floor(Math.random() * 20) + 1;
        initiativeQueue.push({
          id: h.id,
          name: h.name,
          roll: roll,
          isAlien: false
        });
      }
    });

    const alien = appState?.currentAlien;
    if (alien) {
      const alienRoll = Math.floor(Math.random() * 20) + 1;
      initiativeQueue.push({
        id: alien.id || 'alien',
        name: `👾 ${alien.name}`,
        roll: alienRoll,
        isAlien: true
      });
    }

    initiativeQueue.sort((a, b) => b.roll - a.roll);
    currentTurnIndex = 0;
    renderInitiativeList();
    broadcastActiveTurn();
  };

  window.nextTurn = function() {
    vibrate(35);
    if (initiativeQueue.length === 0) {
      rollInitiative();
      return;
    }
    currentTurnIndex = (currentTurnIndex + 1) % initiativeQueue.length;
    renderInitiativeList();
    broadcastActiveTurn();
  };

  function broadcastActiveTurn() {
    const current = initiativeQueue[currentTurnIndex];
    const activeName = current ? current.name : '';
    const activeId = current ? current.id : '';

    const initiativeStatusText = document.getElementById('initiativeStatusText');
    if (initiativeStatusText) {
      initiativeStatusText.textContent = activeName ? `TURNO: ${activeName.toUpperCase()}` : 'TURNO: --';
    }

    sendDisplay({
      type: 'INITIATIVE_UPDATE',
      activeName: activeName,
      activeId: activeId,
      queue: initiativeQueue
    });
  }

  function renderInitiativeList() {
    const container = document.getElementById('initiativeListContainer');
    if (!container) return;
    container.innerHTML = '';

    if (initiativeQueue.length === 0) {
      container.innerHTML = '<div style="font-size: 0.72rem; color: #64748b; text-align: center;">Sin iniciativa activa. Toca "Tirar Iniciativa"</div>';
      return;
    }

    initiativeQueue.forEach((item, idx) => {
      const isActive = idx === currentTurnIndex;
      const row = document.createElement('div');
      row.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; border-radius: 4px; font-size: 0.78rem; font-family: monospace; ${isActive ? 'background: rgba(255,215,0,0.2); border: 1px solid #ffd700; color: #fff; font-weight: bold;' : 'background: #090d16; border: 1px solid #1e293b; color: #94a3b8;'}`;
      row.innerHTML = `
        <span>${isActive ? '⚔️ ' : ''}#${idx + 1} ${escapeHtml(item.name)}</span>
        <span style="color: ${item.isAlien ? '#ff003c' : 'var(--gantz-gold)'}; font-weight: bold;">d20: ${item.roll}</span>
      `;
      container.appendChild(row);
    });
  }

  // 4. BROADCAST & TTS
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

  // ==================== ELEVENLABS TTS CONTROLLER ====================
  function updateTtsStatusBadge() {
    const badge = document.getElementById('remoteTtsStatusBadge');
    if (!badge) return;
    const rawKey = window.GantzTTS ? window.GantzTTS.getApiKey() : '';
    if (!rawKey) {
      badge.textContent = '🟡 SIN CLAVE';
      badge.style.borderColor = '#ffd700';
      badge.style.color = '#ffd700';
      badge.style.background = 'rgba(255,215,0,0.15)';
    } else if (!rawKey.startsWith('sk_')) {
      badge.textContent = '🔴 CLAVE INVÁLIDA (FALTA sk_)';
      badge.style.borderColor = '#ff003c';
      badge.style.color = '#ff003c';
      badge.style.background = 'rgba(255,0,60,0.2)';
    } else {
      badge.textContent = '🟢 CLAVE ACTIVA (sk_...)';
      badge.style.borderColor = '#00ff66';
      badge.style.color = '#00ff66';
      badge.style.background = 'rgba(0,255,102,0.15)';
    }
  }

  window.openElevenLabsModal = function() {
    vibrate(30);
    const modal = document.getElementById('elevenLabsSettingsModal');
    if (!modal) return;
    modal.style.display = 'flex';

    const inputKey = document.getElementById('inputElevenLabsApiKey');
    const labelSource = document.getElementById('labelKeySource');
    const selectPreset = document.getElementById('selectElevenLabsVoicePreset');
    const inputCustom = document.getElementById('inputElevenLabsCustomVoice');

    const curKey = window.GantzTTS ? window.GantzTTS.getApiKey() : '';
    if (inputKey) inputKey.value = curKey;

    const fromConfig = window.GANTZ_CONFIG?.ELEVENLABS_API_KEY;
    const fromLocal = localStorage.getItem('gantz_elevenlabs_api_key');
    if (labelSource) {
      if (fromLocal) labelSource.textContent = '📦 Guardada en Navegador';
      else if (fromConfig) labelSource.textContent = '📄 Leída de config.js';
      else labelSource.textContent = '⚠️ Sin configurar';
    }

    const curVoice = window.GantzTTS ? window.GantzTTS.getVoiceId() : 'pNInz6obpgDQGcFmaJgB';
    const presets = ['pNInz6obpgDQGcFmaJgB', 'ErXwobaYiN019PkySvjV', '21m00Tcm4TlvDq8ikWAM', 'VR6AewLTigWG4xSOukaG'];
    if (presets.includes(curVoice)) {
      if (selectPreset) selectPreset.value = curVoice;
      if (inputCustom) inputCustom.style.display = 'none';
    } else {
      if (selectPreset) selectPreset.value = 'custom';
      if (inputCustom) {
        inputCustom.style.display = 'block';
        inputCustom.value = curVoice;
      }
    }
  };

  window.closeElevenLabsModal = function() {
    vibrate(20);
    const modal = document.getElementById('elevenLabsSettingsModal');
    if (modal) modal.style.display = 'none';
  };

  window.toggleShowApiKey = function() {
    const input = document.getElementById('inputElevenLabsApiKey');
    const btn = document.getElementById('btnToggleShowApiKey');
    if (input) {
      if (input.type === 'password') {
        input.type = 'text';
        if (btn) btn.textContent = '🔒';
      } else {
        input.type = 'password';
        if (btn) btn.textContent = '👁️';
      }
    }
  };

  window.onVoicePresetChange = function(val) {
    const inputCustom = document.getElementById('inputElevenLabsCustomVoice');
    if (inputCustom) {
      inputCustom.style.display = val === 'custom' ? 'block' : 'none';
      if (val === 'custom') inputCustom.focus();
    }
  };

  window.saveElevenLabsConfig = function(e) {
    if (e) e.preventDefault();
    vibrate(40);
    const inputKey = document.getElementById('inputElevenLabsApiKey');
    const selectPreset = document.getElementById('selectElevenLabsVoicePreset');
    const inputCustom = document.getElementById('inputElevenLabsCustomVoice');

    const key = inputKey ? inputKey.value.trim() : '';
    let voiceId = selectPreset ? selectPreset.value : '';
    if (voiceId === 'custom' && inputCustom) {
      voiceId = inputCustom.value.trim();
    }

    if (window.GantzTTS) {
      window.GantzTTS.setApiKey(key);
      window.GantzTTS.setVoiceId(voiceId);
    }

    updateTtsStatusBadge();
    closeElevenLabsModal();
    log(`✓ Configuración ElevenLabs guardada (Voz: ${voiceId || 'Default'})`);
  };

  window.clearElevenLabsAudioCache = async function() {
    vibrate(40);
    if (window.indexedDB) {
      try {
        window.indexedDB.deleteDatabase('GantzTTSDB');
        log('🗑️ Caché de audios de ElevenLabs vaciada con éxito');
        alert('Caché local de audio de ElevenLabs vaciada.');
      } catch (e) {
        log('Error vaciando caché:', e);
      }
    }
  };

  window.sendMsgWithTTS = async function() {
    vibrate(35);
    const msg = customMsgInput.value.trim();
    if (!msg) return;

    sendDisplay({ type: 'BROADCAST_MESSAGE', message: msg });

    if (!window.GantzTTS || !window.GantzTTS.hasApiKey()) {
      openElevenLabsModal();
      log('⚠️ Por favor ingresa tu API Key de ElevenLabs para generar audio.');
      return;
    }

    const btn = document.getElementById('btnSendCustomMsgTTS');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ GENERANDO...';
    }

    try {
      const res = await window.GantzTTS.synthesize(msg);
      log(`🎙️ Audio TTS listo (${res.fromCache ? 'de caché' : 'de ElevenLabs API'})`);
      sendDisplay({
        type: 'PLAY_TTS',
        audioBase64: res.audioBase64,
        text: msg
      });
    } catch (err) {
      log('❌ Error TTS:', err.message);
      alert(`Error ElevenLabs: ${err.message}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🗣️ TEXTO + VOZ GANTZ';
      }
    }
  };

  window.testGantzVoice = async function() {
    vibrate(40);
    if (!window.GantzTTS || !window.GantzTTS.hasApiKey()) {
      openElevenLabsModal();
      log('⚠️ Configura tu API Key de ElevenLabs primero.');
      return;
    }

    const testPhrases = [
      'SISTEMA DE GANTZ INICIADO. LA HABÉIS PALMADO.',
      'CAZAD AL OBJETIVO O VUESTRAS CABEZAS EXPLOTARÁN.',
      'HABÉIS SIDO UNOS INÚTILES ESTA NOCHE.'
    ];
    const phrase = testPhrases[Math.floor(Math.random() * testPhrases.length)];

    log(`🎙️ Sintetizando prueba: "${phrase}"...`);
    try {
      const res = await window.GantzTTS.synthesize(phrase);
      sendDisplay({
        type: 'PLAY_TTS',
        audioBase64: res.audioBase64,
        text: phrase
      });
      if (!isPeerConnected && window.GantzTTS) {
        window.GantzTTS.playAudioUri(res.audioBase64);
      }
    } catch (err) {
      log('❌ Error probando voz:', err.message);
      alert(`Error ElevenLabs: ${err.message}`);
    }
  };

  window.speakAlienBriefing = async function(alienId) {
    vibrate(35);
    const alien = aliensList.find(a => a.id === alienId);
    if (!alien) return;

    if (!window.GantzTTS || !window.GantzTTS.hasApiKey()) {
      openElevenLabsModal();
      log('⚠️ Configura tu API Key de ElevenLabs primero.');
      return;
    }

    selectAlien(alienId);

    const chars = Array.isArray(alien.characteristics) ? alien.characteristics.join(', ') : (alien.characteristics || '');
    const text = `OBJETIVO: ${alien.name}. PUNTOS: ${alien.points || 0}. CARACTERÍSTICAS: ${chars}. LE GUSTA: ${alien.likes || 'Desconocido'}. FRASE FAVORITA: ${alien.quote || 'Ninguna'}.`;

    log(`🎙️ Narrando briefing de ${alien.name}...`);
    try {
      const res = await window.GantzTTS.synthesize(text);
      sendDisplay({
        type: 'PLAY_TTS',
        audioBase64: res.audioBase64,
        text: text
      });
    } catch (err) {
      log('❌ Error narrando alien:', err.message);
      alert(`Error ElevenLabs: ${err.message}`);
    }
  };

  // Initialize TTS status on load
  setTimeout(updateTtsStatusBadge, 500);

  // ==================== ELEVENLABS SFX SOUND LAB CONTROLLER ====================
  let currentGeneratedSfx = null;

  const sliderSfxDuration = document.getElementById('sliderSfxDuration');
  const labelSfxDuration = document.getElementById('labelSfxDuration');
  if (sliderSfxDuration && labelSfxDuration) {
    sliderSfxDuration.addEventListener('input', () => {
      labelSfxDuration.textContent = `${parseFloat(sliderSfxDuration.value).toFixed(1)}s`;
    });
  }

  window.fillSfxPrompt = function(text) {
    vibrate(20);
    const input = document.getElementById('inputCustomSfxPrompt');
    if (input) {
      input.value = text;
      input.focus();
    }
  };

  window.generateCustomSFX = async function() {
    vibrate(35);
    const input = document.getElementById('inputCustomSfxPrompt');
    const slider = document.getElementById('sliderSfxDuration');
    const prompt = input ? input.value.trim() : '';

    if (!prompt) {
      alert('Por favor escribe una descripción del sonido o pulsa un botón de inspiración.');
      return;
    }

    if (!window.GantzTTS || !window.GantzTTS.hasApiKey()) {
      openElevenLabsModal();
      log('⚠️ Configura tu API Key de ElevenLabs primero.');
      return;
    }

    const btnGen = document.getElementById('btnGenerateCustomSFX');
    const btnPrev = document.getElementById('btnPreviewCustomSFX');
    const btnSend = document.getElementById('btnSendCustomSFX');
    const btnSave = document.getElementById('btnSaveToSoundboard');

    if (btnGen) {
      btnGen.disabled = true;
      btnGen.textContent = '⏳ GENERANDO SFX...';
    }

    try {
      const duration = slider ? parseFloat(slider.value) : 2.5;
      log(`⚡ Generando SFX (${duration}s): "${prompt}"...`);
      const res = await window.GantzTTS.generateSoundEffect(prompt, duration);

      currentGeneratedSfx = res;
      log(`✓ SFX generado con éxito (${res.fromCache ? 'de caché' : 'de ElevenLabs API'})`);

      if (btnPrev) btnPrev.disabled = false;
      if (btnSend) btnSend.disabled = false;
      if (btnSave) btnSave.disabled = false;

      // Play local preview automatically
      if (window.GantzTTS) {
        window.GantzTTS.playAudioUri(res.audioBase64).catch(() => {});
      }
    } catch (err) {
      log('❌ Error generando SFX:', err.message);
      alert(`Error ElevenLabs Sound Gen: ${err.message}`);
    } finally {
      if (btnGen) {
        btnGen.disabled = false;
        btnGen.textContent = '⚡ GENERAR SFX';
      }
    }
  };

  window.previewCurrentCustomSFX = function() {
    vibrate(20);
    if (currentGeneratedSfx && currentGeneratedSfx.audioBase64 && window.GantzTTS) {
      window.GantzTTS.playAudioUri(currentGeneratedSfx.audioBase64).catch(() => {});
    }
  };

  window.sendCurrentCustomSFXToDisplay = function() {
    vibrate(40);
    if (!currentGeneratedSfx || !currentGeneratedSfx.audioBase64) return;

    sendDisplay({
      type: 'PLAY_TTS',
      audioBase64: currentGeneratedSfx.audioBase64,
      text: `SFX: ${currentGeneratedSfx.prompt}`
    });
    log(`📺 SFX transmitido a la Pantalla Grande: "${currentGeneratedSfx.prompt.slice(0, 30)}..."`);
  };

  // ==================== PERSISTENT SESSION SOUNDBOARD ====================
  function getSessionSoundboard() {
    try {
      const raw = localStorage.getItem('gantz_session_soundboard');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveSessionSoundboard(list) {
    try {
      localStorage.setItem('gantz_session_soundboard', JSON.stringify(list));
    } catch (e) {}
  }

  window.saveCustomSFXToSoundboard = function() {
    vibrate(30);
    if (!currentGeneratedSfx || !currentGeneratedSfx.audioBase64) return;

    const defaultName = currentGeneratedSfx.prompt.split(' ')[0] || 'SFX';
    const customName = prompt('Nombre para el botón en la botonera:', defaultName);
    if (!customName || !customName.trim()) return;

    const list = getSessionSoundboard();
    const item = {
      id: Date.now(),
      name: customName.trim().slice(0, 20),
      prompt: currentGeneratedSfx.prompt,
      duration: currentGeneratedSfx.duration,
      audioBase64: currentGeneratedSfx.audioBase64
    };

    list.push(item);
    saveSessionSoundboard(list);
    renderSessionSoundboard();
    log(`💾 Guardado en Botonera de Sesión: "${item.name}"`);
  };

  window.renderSessionSoundboard = function() {
    const container = document.getElementById('sessionSoundboardList');
    if (!container) return;

    const list = getSessionSoundboard();
    if (list.length === 0) {
      container.innerHTML = '<div style="font-size: 0.7rem; color: #64748b; font-style: italic;">Sin sonidos guardados aún. Genera uno arriba y pulsa "Guardar en Botonera".</div>';
      return;
    }

    container.innerHTML = '';
    list.forEach(item => {
      const chip = document.createElement('div');
      chip.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; background: rgba(0,240,255,0.12); border: 1px solid #00f0ff; border-radius: 4px; padding: 2px 6px; font-size: 0.72rem;';
      chip.innerHTML = `
        <button type="button" class="btn btn-sm btn-cyan" onclick="playSessionSound(${item.id})" style="padding: 2px 6px; font-size: 0.72rem; font-weight: bold;" title="${escapeHtml(item.prompt)}">
          ▶ ${escapeHtml(item.name)}
        </button>
        <button type="button" onclick="deleteSessionSound(${item.id})" style="background: none; border: none; color: #ff003c; cursor: pointer; font-size: 0.75rem; padding: 0 2px;">✕</button>
      `;
      container.appendChild(chip);
    });
  };

  window.playSessionSound = function(id) {
    vibrate(30);
    const list = getSessionSoundboard();
    const item = list.find(s => s.id === id);
    if (!item) return;

    sendDisplay({
      type: 'PLAY_TTS',
      audioBase64: item.audioBase64,
      text: `SFX: ${item.name}`
    });
    if (!isPeerConnected && window.GantzTTS) {
      window.GantzTTS.playAudioUri(item.audioBase64).catch(() => {});
    }
    log(`🔊 Disparando SFX de sesión: "${item.name}"`);
  };

  window.deleteSessionSound = function(id) {
    vibrate(20);
    let list = getSessionSoundboard();
    list = list.filter(s => s.id !== id);
    saveSessionSoundboard(list);
    renderSessionSoundboard();
  };

  window.clearSessionSoundboard = function() {
    vibrate(35);
    if (confirm('¿Vaciar todos los sonidos guardados en la botonera de la sesión?')) {
      localStorage.removeItem('gantz_session_soundboard');
      renderSessionSoundboard();
      log('🗑️ Botonera de sesión vaciada');
    }
  };

  setTimeout(renderSessionSoundboard, 600);

  // ==================== 1-TOUCH SESSION MACROS ====================
  window.macroStartMission = function() {
    vibrate(60);
    log('🚀 Ejecutando Macro: INICIAR CACERÍA');
    if (appState && appState.timer) {
      if (appState.timer.remainingSeconds <= 0) appState.timer.remainingSeconds = 3600;
      appState.timer.isRunning = true;
    }
    renderTimer();
    sendDisplay({ type: 'TRIGGER_SOUND', sound: 'transfer' });
    sendDisplay({ type: 'TIMER_CONTROL', action: 'start' });
    sendDisplay({ type: 'SET_MODE', mode: 'mission' });
  };

  window.macroEndMission = function() {
    vibrate(60);
    log('🏁 Ejecutando Macro: FIN DE MISIÓN');
    if (appState && appState.timer) {
      appState.timer.isRunning = false;
    }
    renderTimer();
    sendDisplay({ type: 'TIMER_CONTROL', action: 'pause' });
    sendDisplay({ type: 'TRIGGER_SOUND', sound: 'score' });
    sendDisplay({ type: 'SET_MODE', mode: 'scoring' });
  };

  // 5. MODES & SOUNDBOARD
  window.setSphereMode = function(mode) {
    if (mode === 'open') vibrate('sphere');
    else vibrate(30);
    sendDisplay({ type: 'SET_MODE', mode });
  };

  window.triggerSFX = function(sound) {
    vibrate(35);
    sendDisplay({ type: 'TRIGGER_SOUND', sound });
  };

  const remoteVolumeSlider = document.getElementById('remoteVolumeSlider');
  const remoteVolumeValue = document.getElementById('remoteVolumeValue');
  const btnRemoteMuteToggle = document.getElementById('btnRemoteMuteToggle');
  let isRemoteMuted = false;

  if (remoteVolumeSlider) {
    remoteVolumeSlider.addEventListener('input', (e) => {
      const vol = parseFloat(e.target.value);
      if (remoteVolumeValue) remoteVolumeValue.textContent = Math.round(vol * 100) + '%';
      sendDisplay({ type: 'SET_VOLUME', volume: vol });
    });
  }

  if (btnRemoteMuteToggle) {
    btnRemoteMuteToggle.addEventListener('click', () => {
      vibrate(20);
      isRemoteMuted = !isRemoteMuted;
      btnRemoteMuteToggle.textContent = isRemoteMuted ? '🔊 Activar' : '🔇 Silenciar';
      const vol = isRemoteMuted ? 0 : (remoteVolumeSlider ? parseFloat(remoteVolumeSlider.value) : 1);
      sendDisplay({ type: 'SET_VOLUME', volume: vol });
    });
  }

  window.stopRemoteAudio = function() {
    vibrate(30);
    log('🛑 Deteniendo todos los audios de la Esfera');
    sendDisplay({ type: 'STOP_ALL_AUDIO' });
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
        const weaponFormImage = document.getElementById('weaponFormImage');
        if (currentGalleryFilter === 'weapons' || (weaponModal && weaponModal.classList.contains('active'))) {
          if (weaponFormImage) weaponFormImage.value = item.path;
        } else {
          if (alienPreviewImg) alienPreviewImg.src = item.path;
          if (alienFormImage) alienFormImage.value = item.path;
          if (alienFramePosY) alienFramePosY.value = 0;
          if (alienFramePosX) alienFramePosX.value = 50;
          if (alienFrameScale) alienFrameScale.value = 105;
          updatePreviewFraming();
        }
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

  // ==================== VERSION CHECK & OTA UPDATER ====================
  let latestAvailableVersion = null;
  let updateModalDismissed = false;

  function getInstalledVersionInfo() {
    let code = 1;
    let name = "1.0.0";
    if (window.AndroidBridge && typeof window.AndroidBridge.getAppVersionCode === 'function') {
      try {
        code = window.AndroidBridge.getAppVersionCode();
        name = window.AndroidBridge.getAppVersionName() || ("1." + code + ".0");
      } catch (e) {}
    }
    return { code, name };
  }

  function checkAppVersion(remoteVer) {
    if (!remoteVer || !remoteVer.versionCode) return;
    const installed = getInstalledVersionInfo();
    
    log(`Verificación de Versión: Instalada v${installed.name} (código ${installed.code}) | Remota v${remoteVer.versionName} (código ${remoteVer.versionCode})`);

    if (remoteVer.versionCode > installed.code) {
      latestAvailableVersion = remoteVer;
      
      const badge = document.getElementById('updateAvailableBadge');
      if (badge) {
        badge.style.display = 'block';
        badge.textContent = `⚡ V${remoteVer.versionName || remoteVer.versionCode} DISPONIBLE`;
      }

      if (!updateModalDismissed) {
        showUpdateModal(remoteVer, installed);
      }
    }
  }

  function showUpdateModal(remoteVer, installed) {
    const modal = document.getElementById('updateModal');
    const installedText = document.getElementById('updateInstalledVersionText');
    const newText = document.getElementById('updateNewVersionText');
    const changelogList = document.getElementById('updateChangelogList');

    if (installedText) installedText.textContent = `v${installed.name}`;
    if (newText) newText.textContent = `v${remoteVer.versionName || remoteVer.versionCode}`;

    if (changelogList && Array.isArray(remoteVer.changelog)) {
      changelogList.innerHTML = remoteVer.changelog.map(item => `<li>${escapeHtml(item)}</li>`).join('');
    }

    if (modal) modal.classList.add('active');
  }

  function closeUpdateModal() {
    vibrate(20);
    updateModalDismissed = true;
    const modal = document.getElementById('updateModal');
    if (modal) modal.classList.remove('active');
  }

  window.onUpdateDownloadProgress = function(percent) {
    const progressWrap = document.getElementById('updateDownloadProgressWrap');
    const statusText = document.getElementById('updateProgressStatusText');
    const pBar = document.getElementById('updateProgressBar');
    const pPercent = document.getElementById('updateProgressPercent');

    if (progressWrap) progressWrap.style.display = 'block';
    if (pBar) pBar.style.width = percent + '%';
    if (pPercent) pPercent.textContent = percent + '%';

    if (percent >= 100) {
      if (statusText) statusText.textContent = '✓ DESCARGA COMPLETADA. ABRIENDO INSTALADOR...';
    } else {
      if (statusText) statusText.textContent = `DESCARGANDO ACTUALIZACIÓN (${percent}%)...`;
    }
  };

  const btnInstallApkDirect = document.getElementById('btnInstallApkDirect');
  if (btnInstallApkDirect) {
    btnInstallApkDirect.addEventListener('click', () => {
      vibrate(40);
      let apkUrl = (latestAvailableVersion && latestAvailableVersion.apkUrl)
        ? latestAvailableVersion.apkUrl
        : 'https://akkarinrothen.github.io/gantz-room/assets/apk/gantz-remote.apk';

      if (!apkUrl.startsWith('http://') && !apkUrl.startsWith('https://')) {
        apkUrl = 'https://akkarinrothen.github.io/gantz-room/' + apkUrl.replace(/^\//, '');
      }

      const progressWrap = document.getElementById('updateDownloadProgressWrap');
      const statusText = document.getElementById('updateProgressStatusText');
      const pBar = document.getElementById('updateProgressBar');
      const pPercent = document.getElementById('updateProgressPercent');

      if (progressWrap) progressWrap.style.display = 'block';
      if (statusText) statusText.textContent = 'CONECTANDO CON EL SERVIDOR...';
      if (pBar) pBar.style.width = '5%';
      if (pPercent) pPercent.textContent = '5%';

      if (window.AndroidBridge && typeof window.AndroidBridge.downloadAndInstallApk === 'function') {
        try {
          window.AndroidBridge.downloadAndInstallApk(apkUrl);
        } catch (e) {
          logError('Fallo al invocar instalador nativo:', e);
          window.open(apkUrl, '_blank');
        }
      } else {
        window.open(apkUrl, '_blank');
      }
    });
  }

  const btnDownloadApkBrowser = document.getElementById('btnDownloadApkBrowser');
  if (btnDownloadApkBrowser) {
    btnDownloadApkBrowser.addEventListener('click', () => {
      vibrate(25);
      const apkUrl = (latestAvailableVersion && latestAvailableVersion.apkUrl)
        ? latestAvailableVersion.apkUrl
        : 'https://akkarinrothen.github.io/gantz-room/assets/apk/gantz-remote.apk';

      if (window.AndroidBridge && typeof window.AndroidBridge.openInBrowser === 'function') {
        window.AndroidBridge.openInBrowser(apkUrl);
      } else {
        window.open(apkUrl, '_blank');
      }
    });
  }

  const btnPostponeUpdate = document.getElementById('btnPostponeUpdate');
  if (btnPostponeUpdate) btnPostponeUpdate.addEventListener('click', closeUpdateModal);

  const btnCloseUpdateModal = document.getElementById('btnCloseUpdateModal');
  if (btnCloseUpdateModal) btnCloseUpdateModal.addEventListener('click', closeUpdateModal);

  const updateAvailableBadge = document.getElementById('updateAvailableBadge');
  if (updateAvailableBadge) {
    updateAvailableBadge.addEventListener('click', () => {
      vibrate(25);
      if (latestAvailableVersion) {
        showUpdateModal(latestAvailableVersion, getInstalledVersionInfo());
      }
    });
  }

  async function fetchOnlineVersionCheck() {
    try {
      const res = await fetch('version.json?t=' + Date.now());
      if (res.ok) {
        const verData = await res.json();
        checkAppVersion(verData);
      }
    } catch (e) {}
  }

  // Initial Render
  renderAll();
  renderSavedRooms();
  fetchOnlineVersionCheck();

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

  // ==================== LASER POINTER TOUCHPAD CONTROLLER ====================
  const laserTouchpadModal = document.getElementById('laserTouchpadModal');
  const laserTouchpadArea = document.getElementById('laserTouchpadArea');
  const touchpadReticle = document.getElementById('touchpadReticle');
  const laserCoordinatesText = document.getElementById('laserCoordinatesText');

  window.openLaserTouchpad = function() {
    vibrate(25);
    if (laserTouchpadModal) laserTouchpadModal.style.display = 'flex';
  };

  window.closeLaserTouchpad = function() {
    vibrate(20);
    if (laserTouchpadModal) laserTouchpadModal.style.display = 'none';
    sendDisplay({ type: 'LASER_POINTER', active: false });
  };

  function handleTouchpadMove(e) {
    if (!laserTouchpadArea) return;
    const rect = laserTouchpadArea.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    let normX = (clientX - rect.left) / rect.width;
    let normY = (clientY - rect.top) / rect.height;

    normX = Math.max(0, Math.min(1, normX));
    normY = Math.max(0, Math.min(1, normY));

    if (touchpadReticle) {
      touchpadReticle.style.display = 'block';
      touchpadReticle.style.left = (normX * 100) + '%';
      touchpadReticle.style.top = (normY * 100) + '%';
    }

    if (laserCoordinatesText) {
      laserCoordinatesText.textContent = `POSICIÓN: ${Math.round(normX * 100)}% , ${Math.round(normY * 100)}%`;
    }

    sendDisplay({ type: 'LASER_POINTER', x: normX, y: normY, active: true });
  }

  if (laserTouchpadArea) {
    laserTouchpadArea.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      handleTouchpadMove(e);
    });

    laserTouchpadArea.addEventListener('pointermove', (e) => {
      if (e.buttons > 0 || e.pointerType === 'touch') {
        e.preventDefault();
        handleTouchpadMove(e);
      }
    });

    laserTouchpadArea.addEventListener('pointerup', () => {
      sendDisplay({ type: 'LASER_POINTER', active: false });
    });

    laserTouchpadArea.addEventListener('pointerleave', () => {
      sendDisplay({ type: 'LASER_POINTER', active: false });
    });
  }

  // ==================== TACTICAL RADAR CONTROLLER ENGINE ====================
  const radarState = {
    target: {
      x: 65,
      y: 35,
      distanceMeters: 120,
      label: 'ALIEN'
    },
    hunters: {
      x: 50,
      y: 50
    },
    minions: null,
    isStealth: false,
    perimeterAlert: false
  };

  function calculateDistanceMeters(x, y) {
    const dx = x - 50;
    const dy = y - 50;
    const distNormalized = Math.hypot(dx, dy) / 50;
    const meters = Math.max(5, Math.round(distNormalized * 1000));
    return meters;
  }

  function updateRemoteRadarUI() {
    const { target, isStealth, minions, perimeterAlert } = radarState;
    const remoteRadarTargetBlip = document.getElementById('remoteRadarTargetBlip');
    const remoteRadarMetersLabel = document.getElementById('remoteRadarMetersLabel');
    const remoteRadarThreatBadge = document.getElementById('remoteRadarThreatBadge');
    const btnToggleRadarStealth = document.getElementById('btnToggleRadarStealth');
    const btnToggleRadarMinions = document.getElementById('btnToggleRadarMinions');
    const btnTogglePerimeterAlert = document.getElementById('btnTogglePerimeterAlert');
    const remoteRadarMinionsContainer = document.getElementById('remoteRadarMinionsContainer');

    if (remoteRadarTargetBlip) {
      remoteRadarTargetBlip.style.left = `${target.x}%`;
      remoteRadarTargetBlip.style.top = `${target.y}%`;
      remoteRadarTargetBlip.style.display = isStealth ? 'none' : 'block';
    }

    if (remoteRadarMetersLabel) {
      remoteRadarMetersLabel.textContent = `${target.distanceMeters} m`;
    }

    if (remoteRadarThreatBadge) {
      const m = target.distanceMeters;
      if (m <= 20) {
        remoteRadarThreatBadge.textContent = 'EXTREMA // CONTACTO';
        remoteRadarThreatBadge.style.color = '#ff003c';
        remoteRadarThreatBadge.style.borderColor = '#ff003c';
        remoteRadarThreatBadge.style.background = 'rgba(255,0,60,0.25)';
      } else if (m <= 60) {
        remoteRadarThreatBadge.textContent = 'ALTA // CERCA';
        remoteRadarThreatBadge.style.color = '#ff5500';
        remoteRadarThreatBadge.style.borderColor = '#ff5500';
        remoteRadarThreatBadge.style.background = 'rgba(255,85,0,0.2)';
      } else if (m <= 200) {
        remoteRadarThreatBadge.textContent = 'MEDIA // EN RANGO';
        remoteRadarThreatBadge.style.color = 'var(--gantz-gold)';
        remoteRadarThreatBadge.style.borderColor = 'var(--gantz-gold)';
        remoteRadarThreatBadge.style.background = 'rgba(255,215,0,0.15)';
      } else {
        remoteRadarThreatBadge.textContent = 'LEJANA // RASTREO';
        remoteRadarThreatBadge.style.color = 'var(--gantz-cyan)';
        remoteRadarThreatBadge.style.borderColor = 'var(--gantz-cyan)';
        remoteRadarThreatBadge.style.background = 'rgba(0,240,255,0.15)';
      }
    }

    if (btnToggleRadarStealth) {
      btnToggleRadarStealth.style.background = isStealth ? 'rgba(255,0,60,0.3)' : 'rgba(255,255,255,0.08)';
      btnToggleRadarStealth.style.borderColor = isStealth ? '#ff003c' : 'rgba(255,255,255,0.3)';
      btnToggleRadarStealth.style.color = isStealth ? '#ff003c' : '#fff';
      btnToggleRadarStealth.textContent = isStealth ? '👻 SIGILO ACTIVO' : '👻 CAMUFLAJE / SIGILO';
    }

    if (btnToggleRadarMinions) {
      const hasMinions = Array.isArray(minions);
      btnToggleRadarMinions.style.background = hasMinions ? 'rgba(0,240,255,0.25)' : 'rgba(255,255,255,0.08)';
      btnToggleRadarMinions.style.borderColor = hasMinions ? 'var(--gantz-cyan)' : 'rgba(255,255,255,0.3)';
      btnToggleRadarMinions.style.color = hasMinions ? 'var(--gantz-cyan)' : '#fff';
    }

    if (btnTogglePerimeterAlert) {
      btnTogglePerimeterAlert.style.background = perimeterAlert ? 'rgba(255,0,60,0.4)' : 'rgba(255,0,60,0.15)';
      btnTogglePerimeterAlert.style.borderColor = perimeterAlert ? '#ff003c' : 'rgba(255,0,60,0.4)';
    }

    if (remoteRadarMinionsContainer) {
      if (Array.isArray(minions)) {
        remoteRadarMinionsContainer.innerHTML = minions.map(m => `
          <div class="radar-blip blip-target" style="left: ${m.x}%; top: ${m.y}%; width: 6px; height: 6px; opacity: 0.85;"></div>
        `).join('');
      } else {
        remoteRadarMinionsContainer.innerHTML = '';
      }
    }
  }

  let radarThrottleTimer = null;
  function broadcastRadarUpdate(threatAlert = false, ping = false) {
    updateRemoteRadarUI();
    if (radarThrottleTimer) clearTimeout(radarThrottleTimer);
    radarThrottleTimer = setTimeout(() => {
      sendDisplay({
        type: 'RADAR_UPDATE',
        target: radarState.target,
        hunters: radarState.hunters,
        minions: radarState.minions,
        isStealth: radarState.isStealth,
        perimeterAlert: radarState.perimeterAlert,
        threatAlert: threatAlert,
        ping: ping
      });
    }, 16);
  }

  function initRadarTouchpad() {
    const pad = document.getElementById('remoteRadarTouchpad');
    if (!pad) return;

    let isTouching = false;
    let lastThresholdMeters = radarState.target.distanceMeters;

    function handlePos(clientX, clientY) {
      const rect = pad.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const radius = rect.width / 2;

      let dx = clientX - centerX;
      let dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);

      const maxR = radius * 0.92;
      if (dist > maxR) {
        dx = (dx / dist) * maxR;
        dy = (dy / dist) * maxR;
      }

      const x = Math.round(50 + (dx / radius) * 50);
      const y = Math.round(50 + (dy / radius) * 50);
      const meters = calculateDistanceMeters(x, y);

      radarState.target.x = x;
      radarState.target.y = y;
      radarState.target.distanceMeters = meters;
      radarState.target.label = appState?.currentAlien?.name || 'ALIEN';

      let crossedThreat = false;
      if ((lastThresholdMeters > 50 && meters <= 50) || (lastThresholdMeters > 20 && meters <= 20)) {
        vibrate(40);
        crossedThreat = true;
      }
      lastThresholdMeters = meters;

      broadcastRadarUpdate(crossedThreat);
    }

    pad.addEventListener('touchstart', (e) => {
      isTouching = true;
      if (e.touches.length > 0) {
        handlePos(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    pad.addEventListener('touchmove', (e) => {
      if (!isTouching) return;
      if (e.touches.length > 0) {
        handlePos(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    pad.addEventListener('touchend', () => { isTouching = false; });
    pad.addEventListener('touchcancel', () => { isTouching = false; });

    let isMouseDown = false;
    pad.addEventListener('mousedown', (e) => {
      isMouseDown = true;
      handlePos(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      if (!isMouseDown) return;
      handlePos(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => { isMouseDown = false; });
  }

  window.openRadarTouchpad = function() {
    vibrate(30);
    const modal = document.getElementById('radarControlModal');
    if (modal) modal.style.display = 'flex';
    if (appState?.currentAlien) {
      radarState.target.label = appState.currentAlien.name;
    }
    updateRemoteRadarUI();
  };

  window.closeRadarTouchpad = function() {
    vibrate(20);
    const modal = document.getElementById('radarControlModal');
    if (modal) modal.style.display = 'none';
  };

  window.setRadarDistancePreset = function(meters) {
    vibrate(30);
    const dx = radarState.target.x - 50;
    const dy = radarState.target.y - 50;
    let angle = Math.atan2(dy, dx);
    if (dx === 0 && dy === 0) angle = -Math.PI / 3;

    const distNormalized = Math.min(0.92, meters / 1000);
    radarState.target.x = Math.round(50 + Math.cos(angle) * distNormalized * 50);
    radarState.target.y = Math.round(50 + Math.sin(angle) * distNormalized * 50);
    radarState.target.distanceMeters = meters;

    const isThreatAlert = meters <= 50;
    broadcastRadarUpdate(isThreatAlert, false);
    log(`Radar: Aproximación fijada en ${meters}m`);
  };

  window.triggerRadarPingFromRemote = function() {
    vibrate(50);
    sendDisplay({ type: 'RADAR_PING' });
    log('📡 Ping de escaneo emitido en radar');
  };

  window.toggleRadarStealth = function() {
    vibrate(40);
    radarState.isStealth = !radarState.isStealth;
    sendDisplay({ type: 'RADAR_STEALTH', isStealth: radarState.isStealth });
    updateRemoteRadarUI();
    log(`Radar: ${radarState.isStealth ? 'Camuflaje activado (Señal perdida)' : 'Señal recuperada'}`);
  };

  window.toggleRadarMinions = function() {
    vibrate(35);
    if (radarState.minions) {
      radarState.minions = null;
    } else {
      const tx = radarState.target.x;
      const ty = radarState.target.y;
      radarState.minions = [
        { x: Math.min(94, Math.max(6, tx - 8)), y: Math.min(94, Math.max(6, ty + 6)) },
        { x: Math.min(94, Math.max(6, tx + 7)), y: Math.min(94, Math.max(6, ty - 5)) },
        { x: Math.min(94, Math.max(6, tx - 4)), y: Math.min(94, Math.max(6, ty - 8)) }
      ];
    }
    broadcastRadarUpdate(false);
    log(`Radar: ${radarState.minions ? 'Manada de esbirros desplegada' : 'Esbirros eliminados del radar'}`);
  };

  window.togglePerimeterAlert = function() {
    vibrate(45);
    radarState.perimeterAlert = !radarState.perimeterAlert;
    broadcastRadarUpdate(false);
    log(`Radar: ${radarState.perimeterAlert ? '🚨 ALERTA 1 KM ACTIVADA' : 'Alerta de perímetro cancelada'}`);
  };

  // Initialize Radar Touchpad
  initRadarTouchpad();

  // ==================== CAMPAIGN BACKUP & RESTORE ====================
  window.exportCampaignBackup = function() {
    vibrate(30);
    const backupData = {
      version: 1,
      timestamp: Date.now(),
      roomId: roomId,
      appState: appState,
      aliensList: aliensList,
      weaponsList: weaponsList,
      savedRooms: getSavedRooms()
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gantz_campaign_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    log('💾 Respaldo de campaña exportado con éxito');
  };

  const campaignBackupFileInput = document.getElementById('campaignBackupFileInput');
  window.triggerImportBackup = function() {
    vibrate(20);
    if (campaignBackupFileInput) campaignBackupFileInput.click();
  };

  if (campaignBackupFileInput) {
    campaignBackupFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = JSON.parse(evt.target.result);
          if (data && data.appState) {
            appState = data.appState;
            if (data.aliensList) aliensList = data.aliensList;
            if (data.weaponsList) weaponsList = data.weaponsList;
            saveAppState();
            renderAll();
            sendDisplay({
              type: 'SYNC_STATE',
              state: appState,
              aliens: aliensList,
              weapons: weaponsList,
              roomId: roomId
            });
            alert('✓ Respaldo de campaña restaurado y sincronizado con la Esfera.');
            log('✓ Campaña restaurada correctamente');
          } else {
            alert('⚠️ El archivo seleccionado no contiene un formato de respaldo válido de Gantz.');
          }
        } catch (err) {
          alert('Error al leer el archivo de respaldo: ' + err.message);
        }
      };
      reader.readAsText(file);
    });
  }

  // ==================== MULTI-TOUCH GESTURE ENGINE (PINCH-TO-ZOOM & PAN) ====================
  function initTouchZoomPan(container, imgElement, getValues, setValues, onUpdate) {
    if (!container || !imgElement) return;

    let startX = 0;
    let startY = 0;
    let initialPosX = 50;
    let initialPosY = 50;
    let initialScale = 1.0;
    let startDist = 0;
    let isTouching = false;
    let lastTapTime = 0;

    function getDistance(t1, t2) {
      return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    }

    container.addEventListener('touchstart', (e) => {
      isTouching = true;
      container.classList.add('touch-active');

      const now = Date.now();
      if (e.touches.length === 1 && (now - lastTapTime < 320)) {
        // Double tap toggle
        vibrate(35);
        const cur = getValues();
        const newScale = cur.scale > 1.4 ? 1.0 : 2.5;
        setValues({ scale: newScale, posX: 50, posY: 50 });
        if (onUpdate) onUpdate();
        lastTapTime = 0;
        return;
      }
      lastTapTime = now;

      const cur = getValues();
      initialPosX = cur.posX;
      initialPosY = cur.posY;
      initialScale = cur.scale;

      if (e.touches.length === 1) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      } else if (e.touches.length >= 2) {
        startDist = getDistance(e.touches[0], e.touches[1]);
        startX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        startY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      }
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      if (!isTouching) return;

      const rect = container.getBoundingClientRect();
      const current = getValues();
      let newScale = current.scale;
      let newPosX = current.posX;
      let newPosY = current.posY;

      // 2 fingers = Pinch zoom + pan
      if (e.touches.length >= 2) {
        const currentDist = getDistance(e.touches[0], e.touches[1]);
        if (startDist > 0) {
          const ratio = currentDist / startDist;
          newScale = Math.min(5.0, Math.max(0.5, parseFloat((initialScale * ratio).toFixed(2))));
        }
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const deltaX = ((midX - startX) / rect.width) * 100;
        const deltaY = ((midY - startY) / rect.height) * 100;
        const sensitivity = 1.0 / Math.max(0.7, initialScale * 0.75);
        newPosX = Math.min(100, Math.max(0, Math.round(initialPosX - deltaX * sensitivity)));
        newPosY = Math.min(100, Math.max(0, Math.round(initialPosY - deltaY * sensitivity)));
      } else if (e.touches.length === 1) {
        // 1 finger = Pan
        const deltaX = ((e.touches[0].clientX - startX) / rect.width) * 100;
        const deltaY = ((e.touches[0].clientY - startY) / rect.height) * 100;
        const sensitivity = 1.0 / Math.max(0.7, initialScale * 0.75);
        newPosX = Math.min(100, Math.max(0, Math.round(initialPosX - deltaX * sensitivity)));
        newPosY = Math.min(100, Math.max(0, Math.round(initialPosY - deltaY * sensitivity)));
      }

      setValues({ scale: newScale, posX: newPosX, posY: newPosY });
      if (onUpdate) onUpdate();
    }, { passive: true });

    function onEnd() {
      if (isTouching) {
        isTouching = false;
        container.classList.remove('touch-active');
      }
    }

    container.addEventListener('touchend', onEnd);
    container.addEventListener('touchcancel', onEnd);

    // Mouse drag support for PC browser testing
    let isMouseDown = false;
    container.addEventListener('mousedown', (e) => {
      isMouseDown = true;
      startX = e.clientX;
      startY = e.clientY;
      const cur = getValues();
      initialPosX = cur.posX;
      initialPosY = cur.posY;
      initialScale = cur.scale;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isMouseDown) return;
      const rect = container.getBoundingClientRect();
      const deltaX = ((e.clientX - startX) / rect.width) * 100;
      const deltaY = ((e.clientY - startY) / rect.height) * 100;
      const sensitivity = 1.0 / Math.max(0.7, initialScale * 0.75);
      const newPosX = Math.min(100, Math.max(0, Math.round(initialPosX - deltaX * sensitivity)));
      const newPosY = Math.min(100, Math.max(0, Math.round(initialPosY - deltaY * sensitivity)));
      setValues({ scale: initialScale, posX: newPosX, posY: newPosY });
      if (onUpdate) onUpdate();
    });

    window.addEventListener('mouseup', () => {
      isMouseDown = false;
    });

    // Mouse wheel zoom support
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const cur = getValues();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      const newScale = Math.min(5.0, Math.max(0.5, parseFloat((cur.scale + delta).toFixed(2))));
      setValues({ scale: newScale, posX: cur.posX, posY: cur.posY });
      if (onUpdate) onUpdate();
    }, { passive: false });
  }

  // ==================== REAL-TIME OPTICAL ZOOM & INSPECTION ENGINE ====================
  let activeInspectTarget = null;
  let inspectZoomThrottleTimer = null;

  const inspectControlModal = document.getElementById('inspectControlModal');
  const inspectModalTitle = document.getElementById('inspectModalTitle');
  const inspectModalThumb = document.getElementById('inspectModalThumb');
  const inspectModalName = document.getElementById('inspectModalName');
  const inspectModalSub = document.getElementById('inspectModalSub');
  const inspectZoomValLabel = document.getElementById('inspectZoomValLabel');
  const remoteInspectZoomSlider = document.getElementById('remoteInspectZoomSlider');
  const remoteInspectPanX = document.getElementById('remoteInspectPanX');
  const remoteInspectPanY = document.getElementById('remoteInspectPanY');
  const remoteInspectPanXVal = document.getElementById('remoteInspectPanXVal');
  const remoteInspectPanYVal = document.getElementById('remoteInspectPanYVal');
  const inspectTouchViewport = document.getElementById('inspectTouchViewport');
  const inspectTouchImg = document.getElementById('inspectTouchImg');
  const inspectTouchReticle = document.getElementById('inspectTouchReticle');

  window.inspectAlien = function(alienId) {
    vibrate(40);
    const alien = aliensList.find(a => a.id === alienId);
    if (!alien) return;

    activeInspectTarget = {
      type: 'alien',
      id: alien.id,
      title: alien.name || 'ALIEN',
      subtitle: `${alien.category || 'Misión'} // ${alien.points || 0} Puntos`,
      quote: alien.quote || '...',
      stat1: `🎯 VALOR: ${alien.points || 0} PTS`,
      stat2: `💚 GUSTO: ${alien.likes || 'Desconocido'}`,
      tag: '🔬 ANÁLISIS BIOMÉTRICO ÓPTICO // GANTZ HUD',
      image: alien.image || 'assets/webp/monsters/alien_cebolla_joven_recortado.webp',
      scale: 1.0,
      posX: 50,
      posY: 50
    };

    openInspectModalWithTarget(activeInspectTarget);
  };

  window.inspectWeapon = function(weaponId) {
    vibrate(40);
    const wpn = weaponsList.find(w => w.id === weaponId);
    if (!wpn) return;

    activeInspectTarget = {
      type: 'weapon',
      id: wpn.id,
      title: wpn.name || 'EQUIPAMIENTO',
      subtitle: `${wpn.category || 'Armamento'} // Alcance: ${wpn.range || 'Medio'}`,
      quote: wpn.quote || wpn.description || '...',
      stat1: `💥 DAÑO: ${wpn.damageInfo || '2d10'}`,
      stat2: `🔒 ESTADO: ${wpn.isRevealed ? 'REVELADA' : 'CLASIFICADA'}`,
      tag: '🔬 ANÁLISIS DE ARSENAL TÁCTICO // GANTZ HUD',
      image: wpn.image || 'assets/webp/weapons/civil_y_pistola_alienigena_en_retroceso.webp',
      scale: 1.0,
      posX: 50,
      posY: 50
    };

    openInspectModalWithTarget(activeInspectTarget);
  };

  window.inspectCustomMedia = function(imagePath, title = 'IMAGEN', category = 'GALERÍA') {
    vibrate(40);
    activeInspectTarget = {
      type: 'custom',
      id: 'custom_' + Date.now(),
      title: title,
      subtitle: category,
      quote: 'REGISTRO VISUAL EN MEMORIA DE LA ESFERA',
      stat1: '🖼️ ARCHIVO OFICIAL',
      stat2: '⚡ INSPECCIÓN EN VIVO',
      tag: '🔬 VISUALIZACIÓN HOLOGRÁFICA // GANTZ HUD',
      image: imagePath,
      scale: 1.0,
      posX: 50,
      posY: 50
    };

    openInspectModalWithTarget(activeInspectTarget);
  };

  function openInspectModalWithTarget(target) {
    if (inspectModalTitle) inspectModalTitle.textContent = `INSPECCIÓN: ${(target.title || 'OBJETIVO').toUpperCase()}`;
    if (inspectModalName) inspectModalName.textContent = (target.title || 'OBJETIVO').toUpperCase();
    if (inspectModalSub) inspectModalSub.textContent = target.subtitle || 'EN ANÁLISIS';
    if (inspectModalThumb) inspectModalThumb.src = target.image;

    const scale = parseFloat(target.scale || 1.0);
    const posX = target.posX !== undefined ? parseInt(target.posX, 10) : 50;
    const posY = target.posY !== undefined ? parseInt(target.posY, 10) : 50;

    const maxPan = Math.max(30, (scale - 0.7) * 50);
    const tx = (((50 - posX) / 50) * maxPan).toFixed(2);
    const ty = (((50 - posY) / 50) * maxPan).toFixed(2);

    if (inspectTouchImg) {
      inspectTouchImg.src = target.image;
      inspectTouchImg.style.transform = `translate(${tx}%, ${ty}%) scale(${scale})`;
    }

    if (remoteInspectZoomSlider) remoteInspectZoomSlider.value = Math.round(scale * 100);
    if (inspectZoomValLabel) inspectZoomValLabel.textContent = `${scale.toFixed(2)}x`;
    if (remoteInspectPanX) remoteInspectPanX.value = posX;
    if (remoteInspectPanY) remoteInspectPanY.value = posY;
    if (remoteInspectPanXVal) remoteInspectPanXVal.textContent = `${posX}%`;
    if (remoteInspectPanYVal) remoteInspectPanYVal.textContent = `${posY}%`;

    if (inspectControlModal) inspectControlModal.style.display = 'flex';

    // Broadcast INSPECT_MEDIA to display
    sendDisplay({
      type: 'INSPECT_MEDIA',
      image: target.image,
      title: target.title,
      subtitle: target.subtitle,
      quote: target.quote,
      stat1: target.stat1,
      stat2: target.stat2,
      tag: target.tag,
      scale: scale,
      posX: posX,
      posY: posY
    });
  }

  function emitInspectZoomUpdate() {
    if (!activeInspectTarget) return;
    const scale = parseFloat((parseFloat(remoteInspectZoomSlider.value) / 100).toFixed(2));
    const posX = parseInt(remoteInspectPanX.value, 10);
    const posY = parseInt(remoteInspectPanY.value, 10);

    if (inspectZoomValLabel) inspectZoomValLabel.textContent = `${scale.toFixed(2)}x`;
    if (remoteInspectPanXVal) remoteInspectPanXVal.textContent = `${posX}%`;
    if (remoteInspectPanYVal) remoteInspectPanYVal.textContent = `${posY}%`;

    const maxPan = Math.max(30, (scale - 0.7) * 50);
    const tx = (((50 - posX) / 50) * maxPan).toFixed(2);
    const ty = (((50 - posY) / 50) * maxPan).toFixed(2);

    if (inspectTouchImg) {
      inspectTouchImg.style.transform = `translate(${tx}%, ${ty}%) scale(${scale})`;
    }

    activeInspectTarget.scale = scale;
    activeInspectTarget.posX = posX;
    activeInspectTarget.posY = posY;

    // Send with light throttle
    if (inspectZoomThrottleTimer) clearTimeout(inspectZoomThrottleTimer);
    inspectZoomThrottleTimer = setTimeout(() => {
      sendDisplay({
        type: 'INSPECT_ZOOM_UPDATE',
        scale: scale,
        posX: posX,
        posY: posY
      });
    }, 16);
  }

  window.setRemoteInspectZoom = function(val) {
    vibrate(20);
    if (remoteInspectZoomSlider) {
      remoteInspectZoomSlider.value = Math.round(val * 100);
      emitInspectZoomUpdate();
    }
  };

  window.resetRemoteInspectPan = function() {
    vibrate(20);
    if (remoteInspectPanX) remoteInspectPanX.value = 50;
    if (remoteInspectPanY) remoteInspectPanY.value = 50;
    emitInspectZoomUpdate();
  };

  window.closeInspectControl = function() {
    vibrate(30);
    activeInspectTarget = null;
    if (inspectControlModal) inspectControlModal.style.display = 'none';
    sendDisplay({ type: 'CLOSE_INSPECT' });
  };

  if (remoteInspectZoomSlider) remoteInspectZoomSlider.addEventListener('input', emitInspectZoomUpdate);
  if (remoteInspectPanX) remoteInspectPanX.addEventListener('input', emitInspectZoomUpdate);
  if (remoteInspectPanY) remoteInspectPanY.addEventListener('input', emitInspectZoomUpdate);

  // Initialize Touch gestures on Inspection Viewport
  if (inspectTouchViewport && inspectTouchImg) {
    initTouchZoomPan(
      inspectTouchViewport,
      inspectTouchImg,
      () => ({
        posX: remoteInspectPanX ? parseInt(remoteInspectPanX.value, 10) : 50,
        posY: remoteInspectPanY ? parseInt(remoteInspectPanY.value, 10) : 50,
        scale: remoteInspectZoomSlider ? parseFloat((remoteInspectZoomSlider.value / 100).toFixed(2)) : 1.0
      }),
      (vals) => {
        if (remoteInspectPanX) remoteInspectPanX.value = Math.round(vals.posX);
        if (remoteInspectPanY) remoteInspectPanY.value = Math.round(vals.posY);
        if (remoteInspectZoomSlider) remoteInspectZoomSlider.value = Math.round(vals.scale * 100);
        emitInspectZoomUpdate();
      },
      () => {
        emitInspectZoomUpdate();
      }
    );
  }

  // ==================== SCREEN WAKELOCK (KEEP AWAKE) ====================
  async function requestScreenWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        await navigator.wakeLock.request('screen');
        log('💡 WakeLock de pantalla activado');
      }
    } catch (err) {}
    try {
      if (window.GantzAndroidBridge && typeof window.GantzAndroidBridge.setKeepScreenOn === 'function') {
        window.GantzAndroidBridge.setKeepScreenOn(true);
      }
    } catch (e) {}
  }
  document.addEventListener('click', requestScreenWakeLock, { once: true });
})();
