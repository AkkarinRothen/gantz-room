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
    } else if (data.type === 'COMBAT_EVENT') {
      if (data.subType === 'SUIT_BREACH') {
        vibrate([80, 50, 200, 60, 150]);
      } else if (data.subType === 'DELAYED_DETONATION') {
        vibrate([100, 60, 300]);
      } else if (data.subType === 'PANIC_TRIGGERED') {
        vibrate([50, 40, 50, 40, 120]);
      } else if (data.subType === 'DAMAGE_TAKEN') {
        vibrate([60, 40, 60]);
      }
      if (appState && data.hunters) {
        appState.hunters = data.hunters;
        updateUI();
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

    // Update Radar Visibility
    const playerRadarBox = document.getElementById('playerRadarBox');
    const playerRadarLegend = document.getElementById('playerRadarLegend');
    const playerRadarOfflineNotice = document.getElementById('playerRadarOfflineNotice');
    const isRadarVis = appState.radarVisible !== false;

    if (playerRadarBox) {
      playerRadarBox.style.opacity = isRadarVis ? '1' : '0.2';
      playerRadarBox.style.pointerEvents = isRadarVis ? 'auto' : 'none';
      playerRadarBox.style.filter = isRadarVis ? 'none' : 'grayscale(100%)';
    }
    if (playerRadarLegend) {
      playerRadarLegend.style.display = isRadarVis ? 'flex' : 'none';
    }
    if (playerRadarOfflineNotice) {
      playerRadarOfflineNotice.style.display = isRadarVis ? 'none' : 'block';
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

    const myHunter = hunters.find(h => String(h.id) === String(selectedHunterId)) || hunters[0];
    if (myHunter) {
      selectedHunterId = myHunter.id;
      if (playerHunterName) playerHunterName.textContent = `${myHunter.name.toUpperCase()} (${myHunter.nickname || 'Novato'})`;
      if (playerPointsText) playerPointsText.textContent = `${myHunter.points || myHunter.score || 0} pts`;
      
      const suitMax = myHunter.suitMax || 8;
      const suitVal = myHunter.suitIntegrity !== undefined ? myHunter.suitIntegrity : suitMax;
      const hpMax = myHunter.hpMax || 6;
      const hpVal = myHunter.hp !== undefined ? myHunter.hp : hpMax;
      const isDead = myHunter.status === 'dead' || myHunter.isDead || hpVal <= 0;
      const isBreached = suitVal <= 0;

      const playerHpText = document.getElementById('playerHpText');
      const playerHpFill = document.getElementById('playerHpFill');
      const playerPanicAlert = document.getElementById('playerPanicAlert');
      const playerPanicTitle = document.getElementById('playerPanicTitle');
      const playerPanicDesc = document.getElementById('playerPanicDesc');

      // Status Text & Armor Class
      if (isDead) {
        if (playerStatusText) {
          playerStatusText.textContent = '💀 MUERTO // CA --';
          playerStatusText.style.color = '#ff003c';
        }
      } else {
        const ac = isBreached ? 10 : (myHunter.ac || 14);
        if (playerStatusText) {
          playerStatusText.textContent = `EN COMBATE // CA ${ac}`;
          playerStatusText.style.color = isBreached ? '#ff003c' : 'var(--gantz-green)';
        }
      }

      // Panic State
      if (playerPanicAlert) {
        if (myHunter.panicState) {
          playerPanicAlert.style.display = 'block';
          if (playerPanicTitle) playerPanicTitle.textContent = `😱 ¡EN PÁNICO: ${myHunter.panicState.label.toUpperCase()}!`;
          if (playerPanicDesc) playerPanicDesc.textContent = myHunter.panicState.effect || 'Incapaz de actuar con normalidad.';
        } else {
          playerPanicAlert.style.display = 'none';
        }
      }

      // G-Suit Logic
      const suitPct = Math.max(0, Math.min(100, Math.round((suitVal / suitMax) * 100)));
      if (playerSuitFill) {
        playerSuitFill.style.width = `${suitPct}%`;
        playerSuitFill.className = isBreached ? 'suit-meter-fill broken' : (suitPct <= 50 ? 'suit-meter-fill cracked' : 'suit-meter-fill');
      }

      if (playerSuitText) {
        if (isBreached) {
          playerSuitText.textContent = `💥 0/${suitMax} (DESTRUIDO)`;
          playerSuitText.style.color = '#ff003c';
        } else {
          playerSuitText.textContent = `🛡️ ${suitVal}/${suitMax} (${suitPct}% ÓPTIMO)`;
          playerSuitText.style.color = suitPct <= 50 ? '#ffd700' : 'var(--gantz-green)';
        }
      }

      if (playerSuitWarning) {
        if (isBreached) {
          playerSuitWarning.textContent = '⚠️ ¡ADVERTENCIA! Los nodos biomecánicos han reventado. Fluido derramado (CA 10).';
          playerSuitWarning.style.color = '#ff003c';
        } else if (suitPct <= 50) {
          playerSuitWarning.textContent = '⚡ Tensión muscular alta en el traje. Estructura bajo estrés (CA 14).';
          playerSuitWarning.style.color = '#ffd700';
        } else {
          playerSuitWarning.textContent = '✓ Circuitos de contracción muscular y cápsulas intactas (CA 14).';
          playerSuitWarning.style.color = '#94a3b8';
        }
      }

      // Human Hit Points (PG) Logic
      const hpPct = Math.max(0, Math.min(100, Math.round((hpVal / hpMax) * 100)));
      if (playerHpFill) {
        playerHpFill.style.width = `${hpPct}%`;
      }
      if (playerHpText) {
        playerHpText.textContent = `${hpVal}/${hpMax} PG (${hpPct}%)`;
        playerHpText.style.color = hpPct <= 30 ? '#ff003c' : '#ff6b81';
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
