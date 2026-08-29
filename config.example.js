/**
 * GANTZ ROOM - CONFIGURACIÓN DE SECRETOS Y APIS
 * 
 * ⚠️ INSTRUCCIONES DE SEGURIDAD:
 * 1. NUNCA subas tu API Key a repositorios públicos como GitHub.
 * 2. Copia este archivo y renómbralo a "config.js" en esta misma carpeta.
 * 3. "config.js" ya está listado en .gitignore para que nunca sea commiteado.
 * 4. Pega tu API Key de ElevenLabs en la propiedad ELEVENLABS_API_KEY abajo.
 */

window.GANTZ_CONFIG = {
  // Tu API Key de ElevenLabs (ej: "sk_1234567890abcdef...")
  ELEVENLABS_API_KEY: '',

  // ID de la voz predeterminada de Gantz (puedes cambiarlo por cualquier Voice ID de tu cuenta)
  // Ejemplo: "pNInz6obpgDQGcFmaJgB" (Adam), "ErXwobaYiN019PkySvjV" (Antoni), etc.
  ELEVENLABS_DEFAULT_VOICE_ID: 'pNInz6obpgDQGcFmaJgB',

  // Modelo de síntesis de ElevenLabs
  // Opciones: 'eleven_multilingual_v2' (Recomendado para español), 'eleven_turbo_v2_5', 'eleven_monolingual_v1'
  ELEVENLABS_MODEL_ID: 'eleven_multilingual_v2',

  // Estabilidad y similitud (0.0 a 1.0)
  ELEVENLABS_VOICE_SETTINGS: {
    stability: 0.5,
    similarity_boost: 0.8,
    style: 0.15,
    use_speaker_boost: true
  }
};
