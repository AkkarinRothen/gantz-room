// Gantz Manga Mission Report Generator
// Generates an authentic black-and-white halftone manga debriefing page

(function() {
  window.generateMangaReport = function(appState, aliensList) {
    const currentAlien = appState?.currentAlien || (aliensList && aliensList[0]) || {
      name: 'ALIEN DESCONOCIDO',
      points: 10,
      image: 'assets/webp/monsters/alien_cebolla_joven_recortado.webp',
      characteristics: 'FUERTE Y PELIGROSO',
      quote: '...'
    };

    const hunters = appState?.hunters || [];
    const dateStr = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

    const huntersRows = hunters.map((h, i) => `
      <tr style="border-bottom: 1px dashed #000;">
        <td style="padding: 6px 8px; font-weight: bold;">#${i + 1} ${escapeManga(h.name)}</td>
        <td style="padding: 6px 8px; text-align: center;">${h.isDead ? '💀 MUERTO' : '✅ VIVO'}</td>
        <td style="padding: 6px 8px; text-align: center;">${h.suitBroken ? '💥 0% ROTO' : (h.suitCracked ? '⚡ 50% FISURADO' : '🛡️ 100% OK')}</td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 1.1rem; font-weight: 900;">+${h.score || 0} pts</td>
      </tr>
    `).join('') || '<tr><td colspan="4" style="text-align: center; padding: 12px;">Sin cazadores registrados</td></tr>';

    const reportHtml = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>GANTZ // REPORTE DE MISIÓN - ${escapeManga(currentAlien.name)}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Share+Tech+Mono&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: #fff;
            color: #000;
            font-family: 'Share Tech Mono', monospace;
            padding: 30px;
            display: flex;
            justify-content: center;
          }
          .manga-page {
            max-width: 800px;
            width: 100%;
            border: 4px solid #000;
            padding: 24px;
            position: relative;
            background: #fff;
            box-shadow: 0 0 20px rgba(0,0,0,0.15);
          }
          .manga-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            border-bottom: 4px solid #000;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .manga-title {
            font-family: 'Orbitron', sans-serif;
            font-size: 2.2rem;
            font-weight: 900;
            letter-spacing: 3px;
          }
          .manga-subtitle {
            font-size: 0.85rem;
            letter-spacing: 2px;
          }
          .stamp {
            border: 3px solid #000;
            padding: 4px 10px;
            font-family: 'Orbitron', sans-serif;
            font-size: 0.9rem;
            font-weight: 900;
            transform: rotate(-3deg);
            display: inline-block;
          }
          .manga-grid {
            display: grid;
            grid-template-columns: 240px 1fr;
            gap: 20px;
            margin-bottom: 24px;
          }
          .alien-box {
            border: 2px solid #000;
            padding: 10px;
            text-align: center;
          }
          .alien-img {
            width: 100%;
            height: 220px;
            object-fit: cover;
            filter: grayscale(100%) contrast(150%);
            border: 1px solid #000;
          }
          .info-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.9rem;
          }
          .info-table th {
            background: #000;
            color: #fff;
            padding: 6px 8px;
            text-align: left;
            font-family: 'Orbitron', sans-serif;
            font-size: 0.8rem;
          }
          .footer-banner {
            border-top: 4px solid #000;
            padding-top: 14px;
            margin-top: 20px;
            text-align: center;
            font-size: 0.8rem;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="manga-page">
          <div class="manga-header">
            <div>
              <div class="manga-title">GANTZ <span>DEBRIEFING</span></div>
              <div class="manga-subtitle">INFORME DE MISIÓN // ${dateStr.toUpperCase()}</div>
            </div>
            <div class="stamp">MISIÓN COMPLETADA</div>
          </div>

          <div class="manga-grid">
            <div class="alien-box">
              <img src="${currentAlien.image || 'assets/webp/monsters/alien_cebolla_joven_recortado.webp'}" class="alien-img" alt="Alien">
              <div style="font-family: 'Orbitron', sans-serif; font-weight: 900; margin-top: 8px; font-size: 1rem;">
                ${escapeManga(currentAlien.name)}
              </div>
              <div style="font-size: 0.85rem; font-weight: bold; margin-top: 4px;">
                VALOR: ${currentAlien.points || 0} PUNTOS
              </div>
            </div>

            <div>
              <div style="font-family: 'Orbitron', sans-serif; font-size: 1.1rem; font-weight: 900; margin-bottom: 8px;">
                DATOS DEL OBJETIVO:
              </div>
              <p style="margin-bottom: 8px; font-size: 0.9rem;"><strong>CARACTERÍSTICAS:</strong> ${escapeManga(currentAlien.characteristics || 'Desconocidas')}</p>
              <p style="margin-bottom: 8px; font-size: 0.9rem;"><strong>LE GUSTA:</strong> ${escapeManga(currentAlien.likes || 'Cosas raras')}</p>
              <p style="margin-bottom: 12px; font-size: 0.9rem;"><strong>ÚLTIMAS PALABRAS:</strong> "${escapeManga(currentAlien.quote || '...')}"</p>
              
              <div style="font-family: 'Orbitron', sans-serif; font-size: 1rem; font-weight: 900; margin-bottom: 6px;">
                EVALUACIÓN DE CAZADORES:
              </div>
              <table class="info-table">
                <thead>
                  <tr>
                    <th>CAZADOR</th>
                    <th style="text-align: center;">ESTADO</th>
                    <th style="text-align: center;">TRAJE G-SUIT</th>
                    <th style="text-align: right;">PUNTOS</th>
                  </tr>
                </thead>
                <tbody>
                  ${huntersRows}
                </tbody>
              </table>
            </div>
          </div>

          <div class="footer-banner">
            <p style="font-weight: 900; font-size: 0.9rem; letter-spacing: 2px;">"VUESTRAS VIDAS ANTIGUAS HAN TERMINADO. LO QUE HAGÁIS CON LAS NUEVAS ME PERTENECE."</p>
            <p style="margin-top: 6px; font-size: 0.75rem; color: #555;">GANTZ ROOM SYSTEM // SHADOWDARK RPG COMPANION</p>
          </div>

          <div class="no-print" style="margin-top: 20px; text-align: center;">
            <button onclick="window.print()" style="background: #000; color: #fff; border: none; padding: 10px 24px; font-family: 'Orbitron', sans-serif; font-size: 0.9rem; cursor: pointer; border-radius: 4px;">
              🖨️ IMPRIMIR / GUARDAR EN PDF
            </button>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(reportHtml);
      printWin.document.close();
    }
  };

  function escapeManga(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function(m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }
})();
