/**
 * GANTZ ROOM - ELEVENLABS AUDIO GENERATOR SCRIPT
 * 
 * Generates custom Sound Effects (SFX) and Voice Lines using ElevenLabs API
 * and saves them as high quality .mp3 files into assets/audio/.
 */

const fs = require('fs');
const path = require('path');

// 1. Load API key from config.js
const configPath = path.join(__dirname, '..', 'config.js');
let apiKey = '';
let defaultVoiceId = 'pNInz6obpgDQGcFmaJgB';

if (fs.existsSync(configPath)) {
  const content = fs.readFileSync(configPath, 'utf8');
  const keyMatch = content.match(/ELEVENLABS_API_KEY:\s*['"]([^'"]+)['"]/);
  if (keyMatch && keyMatch[1]) {
    apiKey = keyMatch[1].trim();
  }
  const voiceMatch = content.match(/ELEVENLABS_DEFAULT_VOICE_ID:\s*['"]([^'"]+)['"]/);
  if (voiceMatch && voiceMatch[1]) {
    defaultVoiceId = voiceMatch[1].trim();
  }
}

if (!apiKey) {
  console.error('❌ Error: ELEVENLABS_API_KEY no encontrada en config.js');
  process.exit(1);
}

console.log('🔑 API Key cargada con éxito');
console.log(`🎙️ Voice ID por defecto: ${defaultVoiceId}`);

// Destination directory
const audioOutputDir = path.join(__dirname, '..', 'assets', 'audio');
if (!fs.existsSync(audioOutputDir)) {
  fs.mkdirSync(audioOutputDir, { recursive: true });
}

// 2. Sound Effects to generate via /v1/sound-effects
const SFX_ITEMS = [
  {
    filename: 'xgun.mp3',
    prompt: 'Futuristic sci-fi laser weapon fire followed by a deep delayed microwave compression explosion blast boom',
    duration: 3.5
  },
  {
    filename: 'ygun.mp3',
    prompt: 'High-tech mechanical wire anchor launch with a sci-fi quantum teleportation warp whoosh',
    duration: 3.0
  },
  {
    filename: 'suit.mp3',
    prompt: 'Futuristic battle suit power surge electric servo hum with nano muscle contraction activation',
    duration: 2.5
  },
  {
    filename: 'sword.mp3',
    prompt: 'Metallic high-frequency cyber katana blade unsheath followed by a swift supersonic air slash swoosh',
    duration: 2.2
  },
  {
    filename: 'zgun.mp3',
    prompt: 'Massive heavy gravity distortion beam blast crushing vertically downward with deep sub-bass impact',
    duration: 3.8
  },
  {
    filename: 'sphere_boot.mp3',
    prompt: 'Black sci-fi sphere mechanical opening hum with resonant metallic harmonics and electronic boot chime',
    duration: 3.2
  },
  {
    filename: 'transfer.mp3',
    prompt: 'Sci-fi quantum digital teleportation transfer beam with molecular reconstruction electronic sweep',
    duration: 4.0
  },
  {
    filename: 'radar_ping.mp3',
    prompt: 'Tactical sci-fi sonar radar ping echo in high technology scanner',
    duration: 1.5
  },
  {
    filename: 'radar_alert.mp3',
    prompt: 'Three urgent high-tech warning beeps electronic danger alarm',
    duration: 1.8
  },
  {
    filename: 'alarm.mp3',
    prompt: 'Futuristic emergency perimeter klaxon siren alert pulse',
    duration: 3.5
  }
];

// 3. Voice Lines to generate via /v1/text-to-speech/{voice_id}
const VOICE_ITEMS = [
  {
    filename: 'voice_welcome.mp3',
    text: 'La habéis palmado. Ahora vuestras vidas me pertenecen. Lo que hagáis con ellas es asunto mío.'
  },
  {
    filename: 'voice_mission_start.mp3',
    text: 'Misión iniciada. Cazad al objetivo antes de que se agote el tiempo. Si salís del perímetro, vuestras cabezas explotarán.'
  },
  {
    filename: 'voice_countdown.mp3',
    text: 'Atención cazadores. Diez segundos para el final de la transferencia.'
  },
  {
    filename: 'voice_score_bad.mp3',
    text: 'Menuda basura de puntuación esta noche. Habéis sido unos inútiles.'
  },
  {
    filename: 'voice_100pts.mp3',
    text: '¡Cien puntos! Elige tu recompensa: volver al mundo real, un arma más potente o revivir a un compañero de mi memoria.'
  }
];

async function generateSFX(item) {
  const filePath = path.join(audioOutputDir, item.filename);
  console.log(`\n🔊 Generando SFX: ${item.filename}...`);
  console.log(`   Prompt: "${item.prompt}"`);

  const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey
    },
    body: JSON.stringify({
      text: item.prompt,
      duration_seconds: item.duration,
      prompt_influence: 0.35
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error en ElevenLabs SFX (${response.status}): ${errText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
  console.log(`   ✓ Guardado en ${filePath} (${(arrayBuffer.byteLength / 1024).toFixed(1)} KB)`);
}

async function generateVoice(item) {
  const filePath = path.join(audioOutputDir, item.filename);
  console.log(`\n🎙️ Generando Voz: ${item.filename}...`);
  console.log(`   Texto: "${item.text}"`);

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${defaultVoiceId}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey
    },
    body: JSON.stringify({
      text: item.text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.8,
        style: 0.2,
        use_speaker_boost: true
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error en ElevenLabs TTS (${response.status}): ${errText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
  console.log(`   ✓ Guardado en ${filePath} (${(arrayBuffer.byteLength / 1024).toFixed(1)} KB)`);
}

async function main() {
  console.log('==============================================');
  console.log('🚀 INICIANDO GENERACIÓN DE AUDIOS ELEVENLABS');
  console.log('==============================================');

  let successCount = 0;
  let failCount = 0;

  // 1. Generate SFX
  for (const sfx of SFX_ITEMS) {
    try {
      await generateSFX(sfx);
      successCount++;
      // Polite delay between API calls
      await new Promise(r => setTimeout(r, 600));
    } catch (err) {
      console.error(`   ❌ Falló ${sfx.filename}: ${err.message}`);
      failCount++;
    }
  }

  // 2. Generate Voices
  for (const v of VOICE_ITEMS) {
    try {
      await generateVoice(v);
      successCount++;
      await new Promise(r => setTimeout(r, 600));
    } catch (err) {
      console.error(`   ❌ Falló ${v.filename}: ${err.message}`);
      failCount++;
    }
  }

  console.log('\n==============================================');
  console.log(`✨ PROCESO COMPLETADO: ${successCount} generados con éxito, ${failCount} errores.`);
  console.log('==============================================');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
