// Gantz Room In-App Logcat & Diagnostics Module
(function() {
  const logs = [];
  const maxLogs = 200;
  let isModalOpen = false;

  // Connection State Indicators
  window.GantzConnectionState = {
    transport: 'Iniciando...',
    brokerStatus: 'Desconectado',
    roomId: '---',
    peerId: '---',
    webrtcStatus: '---',
    lastPing: Date.now()
  };

  function addLog(level, message, details = null) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = { timestamp, level, message, details };
    logs.push(entry);
    if (logs.length > maxLogs) logs.shift();

    // If modal is open, append immediately
    const logsContainer = document.getElementById('gantzLogcatContent');
    if (logsContainer) {
      appendLogToDOM(logsContainer, entry);
      logsContainer.scrollTop = logsContainer.scrollHeight;
    }
  }

  // Intercept standard console methods
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;

  console.log = function(...args) {
    origLog.apply(console, args);
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    addLog('INFO', msg);
  };

  console.warn = function(...args) {
    origWarn.apply(console, args);
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    addLog('WARN', msg);
  };

  console.error = function(...args) {
    origError.apply(console, args);
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    addLog('ERROR', msg);
  };

  window.addEventListener('error', function(event) {
    addLog('ERROR', `[Uncaught] ${event.message} at ${event.filename}:${event.lineno}`);
  });

  window.GantzLogger = {
    log: (msg, d) => addLog('INFO', msg, d),
    warn: (msg, d) => addLog('WARN', msg, d),
    error: (msg, d) => addLog('ERROR', msg, d),
    net: (msg, d) => addLog('NET', msg, d),
    updateState: (key, val) => {
      window.GantzConnectionState[key] = val;
      updateStateBadges();
    },
    getLogsText: () => {
      const header = `=== GANTZ ROOM LOGCAT REPORT ===\nFecha: ${new Date().toISOString()}\nURL: ${window.location.href}\nUserAgent: ${navigator.userAgent}\nTransporte: ${window.GantzConnectionState.transport}\nSala: ${window.GantzConnectionState.roomId}\nBroker: ${window.GantzConnectionState.brokerStatus}\nWebRTC: ${window.GantzConnectionState.webrtcStatus}\n=================================\n\n`;
      const body = logs.map(l => `[${l.timestamp}] [${l.level}] ${l.message} ${l.details ? JSON.stringify(l.details) : ''}`).join('\n');
      return header + body;
    }
  };

  function appendLogToDOM(container, log) {
    const row = document.createElement('div');
    row.style.cssText = 'padding: 4px 6px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.75rem; word-break: break-all;';
    
    let color = '#00ff66';
    if (log.level === 'WARN') color = '#ffd700';
    if (log.level === 'ERROR') color = '#ff003c';
    if (log.level === 'NET') color = '#00f0ff';

    row.innerHTML = `
      <span style="color: #64748b; font-size: 0.7rem;">${log.timestamp}</span>
      <strong style="color: ${color}; margin: 0 6px;">[${log.level}]</strong>
      <span style="color: #e2e8f0;">${escapeHTML(log.message)}</span>
    `;
    container.appendChild(row);
  }

  function escapeHTML(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function updateStateBadges() {
    const badgeTransport = document.getElementById('logcatBadgeTransport');
    const badgeBroker = document.getElementById('logcatBadgeBroker');
    const badgeRoom = document.getElementById('logcatBadgeRoom');

    if (badgeTransport) badgeTransport.textContent = window.GantzConnectionState.transport;
    if (badgeBroker) badgeBroker.textContent = window.GantzConnectionState.brokerStatus;
    if (badgeRoom) badgeRoom.textContent = window.GantzConnectionState.roomId;
  }

  // Create UI overlay on DOMContentLoaded
  function initUI() {
    if (document.getElementById('gantzLogcatFloatingBtn')) return;

    // Floating Button
    const btn = document.createElement('button');
    btn.id = 'gantzLogcatFloatingBtn';
    btn.innerHTML = '🐛 LOGS';
    btn.title = 'Abrir visor de errores y logs de conexión';
    btn.style.cssText = `
      position: fixed;
      bottom: 12px;
      left: 12px;
      z-index: 99999;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid #00f0ff;
      color: #00f0ff;
      font-family: 'Share Tech Mono', monospace;
      font-size: 0.75rem;
      font-weight: bold;
      padding: 6px 12px;
      border-radius: 20px;
      cursor: pointer;
      backdrop-filter: blur(6px);
      box-shadow: 0 0 10px rgba(0, 240, 255, 0.3);
      transition: all 0.2s ease;
    `;
    btn.onclick = toggleModal;
    document.body.appendChild(btn);

    // Modal
    const modal = document.createElement('div');
    modal.id = 'gantzLogcatModal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(3, 5, 10, 0.88);
      backdrop-filter: blur(10px);
      z-index: 100000;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 16px;
      font-family: 'Share Tech Mono', monospace;
    `;

    modal.innerHTML = `
      <div style="background: #090d16; border: 2px solid #00f0ff; border-radius: 10px; width: 100%; max-width: 650px; height: 85vh; display: flex; flex-direction: column; box-shadow: 0 0 40px rgba(0, 240, 255, 0.4); overflow: hidden;">
        
        <!-- Header -->
        <div style="padding: 12px 16px; background: #0e1424; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-family: 'Orbitron', sans-serif; font-size: 1rem; color: #00f0ff; font-weight: bold; letter-spacing: 1px;">
            🐛 GANTZ // LOGCAT & DIAGNÓSTICO
          </div>
          <button id="gantzLogcatCloseBtn" style="background: none; border: 1px solid #ff003c; color: #ff003c; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-weight: bold;">✕</button>
        </div>

        <!-- Badges Bar -->
        <div style="padding: 8px 16px; background: #05070d; border-bottom: 1px solid #1e293b; display: flex; gap: 8px; flex-wrap: wrap; font-size: 0.75rem;">
          <div style="background: rgba(0,240,255,0.1); border: 1px solid #00f0ff; padding: 2px 8px; border-radius: 4px; color: #00f0ff;">
            Transporte: <span id="logcatBadgeTransport" style="font-weight: bold;">---</span>
          </div>
          <div style="background: rgba(0,255,102,0.1); border: 1px solid #00ff66; padding: 2px 8px; border-radius: 4px; color: #00ff66;">
            Broker P2P: <span id="logcatBadgeBroker" style="font-weight: bold;">---</span>
          </div>
          <div style="background: rgba(255,215,0,0.1); border: 1px solid #ffd700; padding: 2px 8px; border-radius: 4px; color: #ffd700;">
            Sala: <span id="logcatBadgeRoom" style="font-weight: bold;">---</span>
          </div>
        </div>

        <!-- Logs Box -->
        <div id="gantzLogcatContent" style="flex: 1; overflow-y: auto; padding: 10px; background: #030508; color: #cbd5e1; font-family: monospace;"></div>

        <!-- Footer Actions -->
        <div style="padding: 10px 16px; background: #0e1424; border-top: 1px solid #1e293b; display: flex; gap: 10px; justify-content: space-between;">
          <div style="display: flex; gap: 8px;">
            <button id="gantzLogcatCopyBtn" style="background: #00ff66; color: #000; border: none; font-weight: bold; font-family: 'Share Tech Mono', monospace; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
              📋 COPIAR LOGS
            </button>
            <button id="gantzLogcatClearBtn" style="background: #1e293b; color: #cbd5e1; border: 1px solid #475569; font-family: 'Share Tech Mono', monospace; padding: 8px 12px; border-radius: 6px; cursor: pointer;">
              🧹 LIMPIAR
            </button>
          </div>
          <button id="gantzLogcatReconnectBtn" style="background: rgba(0,240,255,0.15); color: #00f0ff; border: 1px solid #00f0ff; font-weight: bold; font-family: 'Share Tech Mono', monospace; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
            🔄 RECONECTAR
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('gantzLogcatCloseBtn').onclick = toggleModal;
    document.getElementById('gantzLogcatClearBtn').onclick = () => {
      logs.length = 0;
      document.getElementById('gantzLogcatContent').innerHTML = '';
    };

    document.getElementById('gantzLogcatCopyBtn').onclick = () => {
      const text = window.GantzLogger.getLogsText();
      navigator.clipboard.writeText(text).then(() => {
        const copyBtn = document.getElementById('gantzLogcatCopyBtn');
        copyBtn.textContent = '✓ ¡LOGS COPIADOS!';
        setTimeout(() => copyBtn.textContent = '📋 COPIAR LOGS', 1500);
      }).catch(() => {
        prompt('Copia manualmente los logs:', text);
      });
    };

    document.getElementById('gantzLogcatReconnectBtn').onclick = () => {
      if (typeof window.forceReconnectGantz === 'function') {
        window.forceReconnectGantz();
      } else {
        window.location.reload();
      }
    };
  }

  function toggleModal() {
    isModalOpen = !isModalOpen;
    const modal = document.getElementById('gantzLogcatModal');
    if (modal) {
      modal.style.display = isModalOpen ? 'flex' : 'none';
      if (isModalOpen) {
        updateStateBadges();
        const logsContainer = document.getElementById('gantzLogcatContent');
        logsContainer.innerHTML = '';
        logs.forEach(l => appendLogToDOM(logsContainer, l));
        logsContainer.scrollTop = logsContainer.scrollHeight;
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }
})();
