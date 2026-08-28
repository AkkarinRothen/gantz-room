// Gantz Player Companion - P2P & BroadcastChannel Client

(function() {
  const urlParams = new URLSearchParams(window.location.search);
  let roomId = urlParams.get('room') || localStorage.getItem('gantz_player_room') || '';
  let selectedHunterId = localStorage.getItem('gantz_selected_hunter_id') || '';

  const playerRoomPinBadge = document.getElementById('playerRoomPinBadge');
  const playerHunterName = document.getElementById('playerHunterName');
  const playerSuitText = document.getElementById('playerSuitText');
  const playerSuitFill = document.getElementById('playerSuitFill');
  const playerSuitWarning = document.getElementById('playerSuitWarning');
  const playerPointsText = document.getElementById('playerPointsText');
  const playerStatusText = document.getElementById('playerStatusText');
  const playerTimerText = document.getElementById('playerTimerText');
  const playerAlienImg = document.getElementById('playerAlienImg');
  const playerAlienName = document.getElementById('playerAlienName');
  const playerAlienTraits = document.getElementById('playerAlienTraits');
  const playerAlienPoints = document.getElementById('playerAlienPoints');

  const playerSelectModal = document.getElementById('playerSelectModal');
  const playerSelectList = document.getElementById('playerSelectList');
  const playerRoomCodeInput = document.getElementById('playerRoomCodeInput');
  const btnConnectPlayerRoom = document.getElementById('btnConnectPlayerRoom');

  let appState = null;
  let peer = null;
  let conn = null;
  let broadcastChannel = null;

  function vibrate(ms) {
    if ('vibrate' in navigator) {
      try { navigator.vibrate(ms); } catch (e) {}
    }
  }

  function initBroadcast() {
    if ('BroadcastChannel' in window && roomId) {
      if (broadcastChannel) broadcastChannel.close();
      broadcastChannel = new BroadcastChannel(`gantz_${roomId}`);
      broadcastChannel.onmessage = (e) => {
        handleStateUpdate(e.data);
      };
    }
  }

  function initPeer() {
    if (!roomId || typeof Peer === 'undefined') return;
    try {
      peer = new Peer({
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      peer.on('open', () => {
        connectToHost();
      });

      peer.on('error', (err) => {
        console.warn('Player peer error:', err);
      });
    } catch (e) {
      console.warn('Peer error:', e);
    }
  }

  function connectToHost() {
    if (!peer || !roomId) return;
    const cleanId = 'GANTZ-ROOM-' + roomId.replace(/^GANTZ-/i, '');
    conn = peer.connect(cleanId, { reliable: true });

    conn.on('open', () => {
      if (playerRoomPinBadge) playerRoomPinBadge.textContent = `SALA: ${roomId.toUpperCase()}`;
      conn.send({ type: 'PING', time: Date.now() });
    });

    conn.on('data', (data) => {
      handleStateUpdate(data);
    });
  }

  function handleStateUpdate(data) {
    if (!data) return;
    if (data.type === 'SYNC_STATE' || data.type === 'TIMER_UPDATE' || data.type === 'SCORE_UPDATE') {
      if (data.state) appState = data.state;
      else if (data.timer !== undefined && appState) appState.timer = data.timer;
      updateUI();
    } else if (data.type === 'HAPTIC_PULSE') {
      vibrate(data.duration || 120);
    } else if (data.type === 'INITIATIVE_UPDATE') {
      const banner = document.getElementById('playerTurnBanner');
      if (banner) {
        if (selectedHunterId && String(data.activeId) === String(selectedHunterId)) {
          banner.style.display = 'block';
          vibrate([120, 60, 120]);
        } else {
          banner.style.display = 'none';
        }
      }
    }
  }

  function updateUI() {
    if (!appState) return;

    // Update Timer
    if (appState.timer !== undefined && playerTimerText) {
      const mins = Math.floor(appState.timer / 60);
      const secs = appState.timer % 60;
      playerTimerText.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      if (appState.timer <= 10 && appState.timer > 0) {
        playerTimerText.style.color = '#ff003c';
      } else {
        playerTimerText.style.color = 'var(--gantz-green)';
      }
    }

    // Update Alien
    const currentAlien = appState.currentAlien;
    if (currentAlien) {
      if (playerAlienName) playerAlienName.textContent = currentAlien.name || 'OBJETIVO';
      if (playerAlienTraits) playerAlienTraits.textContent = currentAlien.characteristics || 'FUERTE';
      if (playerAlienPoints) playerAlienPoints.textContent = `RECOMPENSA: ${currentAlien.points || 0} PTS`;
      if (playerAlienImg && currentAlien.image) playerAlienImg.src = currentAlien.image;
    }

    // Update Hunter
    const hunters = appState.hunters || [];
    renderHunterSelection(hunters);

    const myHunter = hunters.find(h => h.id === selectedHunterId) || hunters[0];
    if (myHunter) {
      selectedHunterId = myHunter.id;
      if (playerHunterName) playerHunterName.textContent = myHunter.name.toUpperCase();
      if (playerPointsText) playerPointsText.textContent = `${myHunter.score || 0} pts`;
      
      if (myHunter.isDead) {
        if (playerStatusText) {
          playerStatusText.textContent = '💀 MUERTO';
          playerStatusText.style.color = '#ff003c';
        }
      } else {
        if (playerStatusText) {
          playerStatusText.textContent = 'EN COMBATE';
          playerStatusText.style.color = 'var(--gantz-green)';
        }
      }

      // Suit logic
      if (myHunter.suitBroken) {
        if (playerSuitText) { playerSuitText.textContent = '💥 0% DESTRUIDO'; playerSuitText.style.color = '#ff003c'; }
        if (playerSuitFill) { playerSuitFill.className = 'suit-meter-fill broken'; }
        if (playerSuitWarning) { playerSuitWarning.textContent = '⚠️ ¡ADVERTENCIA! Las cápsulas de fluido negro han reventado. No tienes protección.'; }
      } else if (myHunter.suitCracked) {
        if (playerSuitText) { playerSuitText.textContent = '⚡ 50% FISURADO'; playerSuitText.style.color = '#ffd700'; }
        if (playerSuitFill) { playerSuitFill.className = 'suit-meter-fill cracked'; }
        if (playerSuitWarning) { playerSuitWarning.textContent = '⚡ Fuga de fluido biomecánico detectada tras impacto crítico.'; }
      } else {
        if (playerSuitText) { playerSuitText.textContent = '🛡️ 100% ÓPTIMO'; playerSuitText.style.color = 'var(--gantz-green)'; }
        if (playerSuitFill) { playerSuitFill.className = 'suit-meter-fill'; }
        if (playerSuitWarning) { playerSuitWarning.textContent = '✓ Circuitos de contracción muscular y cápsulas intactas.'; }
      }
    }
  }

  function renderHunterSelection(hunters) {
    if (!playerSelectList) return;
    if (!hunters || hunters.length === 0) {
      playerSelectList.innerHTML = '<div style="color: #94a3b8; font-size: 0.8rem;">Esperando a que el Master cree cazadores...</div>';
      return;
    }

    playerSelectList.innerHTML = '';
    hunters.forEach(h => {
      const btn = document.createElement('button');
      btn.style.cssText = 'background: #1e293b; color: #fff; border: 1px solid #334155; padding: 10px; border-radius: 6px; font-family: monospace; font-size: 0.9rem; font-weight: bold; cursor: pointer; text-align: left; display: flex; justify-content: space-between;';
      btn.innerHTML = `<span>👤 ${h.name}</span> <span style="color: var(--gantz-gold);">${h.score || 0} pts</span>`;
      btn.onclick = () => {
        vibrate(30);
        selectedHunterId = h.id;
        localStorage.setItem('gantz_selected_hunter_id', h.id);
        if (playerSelectModal) playerSelectModal.style.display = 'none';
        updateUI();
      };
      playerSelectList.appendChild(btn);
    });
  }

  if (btnConnectPlayerRoom) {
    btnConnectPlayerRoom.addEventListener('click', () => {
      vibrate(30);
      const inputVal = playerRoomCodeInput ? playerRoomCodeInput.value.trim().toUpperCase() : '';
      if (inputVal) {
        roomId = inputVal;
        localStorage.setItem('gantz_player_room', roomId);
        initBroadcast();
        initPeer();
        if (playerRoomPinBadge) playerRoomPinBadge.textContent = `SALA: ${roomId}`;
      }
    });
  }

  // Auto connect if room in URL
  if (roomId) {
    if (playerRoomPinBadge) playerRoomPinBadge.textContent = `SALA: ${roomId.toUpperCase()}`;
    initBroadcast();
    initPeer();
  }
})();
