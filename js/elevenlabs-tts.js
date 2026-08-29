/**
 * GANTZ ROOM - ELEVENLABS TTS SERVICE & CACHE ENGINE
 * 
 * Manages Text-to-Speech generation, IndexedDB local audio caching,
 * and key management without leaking secrets to Git.
 */

(function() {
  'use strict';

  const DB_NAME = 'GantzTTSDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'audio_cache';

  class GantzTTSEngine {
    constructor() {
      this.db = null;
      this.dbReady = this.initDB();
      this.activeAudio = null;
      this.isSpeaking = false;
    }

    // Initialize IndexedDB for permanent local audio caching
    async initDB() {
      return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
          console.warn('[GantzTTS] IndexedDB not available, cache disabled');
          resolve(null);
          return;
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };

        request.onsuccess = (e) => {
          this.db = e.target.result;
          resolve(this.db);
        };

        request.onerror = (e) => {
          console.warn('[GantzTTS] IndexedDB error:', e);
          resolve(null);
        };
      });
    }

    // Get current API key (優先: LocalStorage, Fallback: config.js)
    getApiKey() {
      const localKey = localStorage.getItem('gantz_elevenlabs_api_key');
      if (localKey && localKey.trim()) return localKey.trim();

      if (window.GANTZ_CONFIG && window.GANTZ_CONFIG.ELEVENLABS_API_KEY) {
        return window.GANTZ_CONFIG.ELEVENLABS_API_KEY.trim();
      }

      return '';
    }

    // Set & save API key in LocalStorage
    setApiKey(key) {
      if (key && key.trim()) {
        localStorage.setItem('gantz_elevenlabs_api_key', key.trim());
      } else {
        localStorage.removeItem('gantz_elevenlabs_api_key');
      }
    }

    // Check if valid API Key exists
    hasApiKey() {
      const key = this.getApiKey();
      return Boolean(key && key.startsWith('sk_'));
    }

    // Validate API Key format before making API calls
    validateApiKey() {
      const key = this.getApiKey();
      if (!key) {
        throw new Error('API Key de ElevenLabs no configurada. Ve a Modos -> Ajustar API Key.');
      }
      if (!key.startsWith('sk_')) {
        throw new Error("Formato incorrecto: La API Key de ElevenLabs DEBE comenzar por 'sk_'. Has pegado el 'Key ID' público. En elevenlabs.io -> Profile -> API Keys -> Create API Key, copia la clave secreta completa (ej: sk_...).");
      }
      return key;
    }

    // Get active Voice ID
    getVoiceId(customVoiceId) {
      if (customVoiceId && customVoiceId.trim()) return customVoiceId.trim();
      const localVoice = localStorage.getItem('gantz_elevenlabs_voice_id');
      if (localVoice && localVoice.trim()) return localVoice.trim();
      if (window.GANTZ_CONFIG && window.GANTZ_CONFIG.ELEVENLABS_DEFAULT_VOICE_ID) {
        return window.GANTZ_CONFIG.ELEVENLABS_DEFAULT_VOICE_ID.trim();
      }
      return 'pNInz6obpgDQGcFmaJgB'; // Adam / Default Deep Voice
    }

    setVoiceId(voiceId) {
      if (voiceId && voiceId.trim()) {
        localStorage.setItem('gantz_elevenlabs_voice_id', voiceId.trim());
      }
    }

    // Generate hash ID for cache lookup
    hashText(voiceId, text) {
      const str = `${voiceId}_${text.trim().toLowerCase()}`;
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
      }
      return `tts_${Math.abs(hash).toString(36)}_${str.length}`;
    }

    // Get cached audio from IndexedDB
    async getCachedAudio(cacheId) {
      await this.dbReady;
      if (!this.db) return null;

      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction([STORE_NAME], 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(cacheId);
          req.onsuccess = () => resolve(req.result ? req.result.audioBase64 : null);
          req.onerror = () => resolve(null);
        } catch (err) {
          resolve(null);
        }
      });
    }

    // Save audio to IndexedDB
    async saveCachedAudio(cacheId, audioBase64, text, voiceId) {
      await this.dbReady;
      if (!this.db) return;

      try {
        const tx = this.db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({
          id: cacheId,
          audioBase64: audioBase64,
          text: text.slice(0, 100),
          voiceId: voiceId,
          timestamp: Date.now()
        });
      } catch (err) {
        console.warn('[GantzTTS] Error caching audio:', err);
      }
    }

    // Synthesize text to speech via ElevenLabs API (or from local cache)
    async synthesize(text, options = {}) {
      if (!text || !text.trim()) throw new Error('Texto vacío');

      const voiceId = this.getVoiceId(options.voiceId);
      const cacheId = this.hashText(voiceId, text);

      // 1. Check local IndexedDB cache first
      const cached = await this.getCachedAudio(cacheId);
      if (cached) {
        return {
          audioBase64: cached,
          fromCache: true,
          voiceId: voiceId,
          text: text
        };
      }

      // 2. Fetch from ElevenLabs API
      const apiKey = this.validateApiKey();

      const modelId = window.GANTZ_CONFIG?.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
      const voiceSettings = window.GANTZ_CONFIG?.ELEVENLABS_VOICE_SETTINGS || {
        stability: 0.5,
        similarity_boost: 0.8
      };

      const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text: text,
          model_id: modelId,
          voice_settings: voiceSettings
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson?.detail?.message || `Error ElevenLabs (${response.status}): ${response.statusText}`;
        throw new Error(errMsg);
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = this.arrayBufferToBase64(arrayBuffer);
      const dataUri = `data:audio/mpeg;base64,${base64}`;

      // 3. Save to local cache
      await this.saveCachedAudio(cacheId, dataUri, text, voiceId);

      return {
        audioBase64: dataUri,
        fromCache: false,
        voiceId: voiceId,
        text: text
      };
    }

    // Generate Sound Effect using ElevenLabs Sound Generation API
    async generateSoundEffect(prompt, durationSeconds = 2.5) {
      const p = prompt ? prompt.trim() : '';
      if (!p) throw new Error('Prompt de sonido vacío');

      const apiKey = this.validateApiKey();

      const dur = Math.max(0.5, Math.min(5.0, parseFloat(durationSeconds) || 2.5));
      const cacheId = `sfx_${this.hashText('sfx', `${p}_${dur}`)}`;

      // 1. Check local IndexedDB cache
      const cached = await this.getCachedAudio(cacheId);
      if (cached) {
        return {
          audioBase64: cached,
          fromCache: true,
          prompt: p,
          duration: dur
        };
      }

      // 2. Call ElevenLabs Sound Generation API
      const url = 'https://api.elevenlabs.io/v1/sound-generation';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text: p,
          duration_seconds: dur,
          prompt_influence: 0.35
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson.detail?.message || errJson.detail || `Error HTTP ${response.status}`;
        throw new Error(typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg);
      }

      const buffer = await response.arrayBuffer();
      const base64 = this.arrayBufferToBase64(buffer);
      const dataUri = `data:audio/mpeg;base64,${base64}`;

      // 3. Save to local cache
      await this.saveCachedAudio(cacheId, dataUri, p, 'sound-generation');

      return {
        audioBase64: dataUri,
        fromCache: false,
        prompt: p,
        duration: dur
      };
    }

    // Play synthesized audio locally
    async playAudioUri(audioUri) {
      if (this.activeAudio) {
        this.activeAudio.pause();
        this.activeAudio = null;
      }

      return new Promise((resolve, reject) => {
        const audio = new Audio(audioUri);
        this.activeAudio = audio;
        this.isSpeaking = true;

        audio.onended = () => {
          this.isSpeaking = false;
          this.activeAudio = null;
          resolve();
        };

        audio.onerror = (e) => {
          this.isSpeaking = false;
          this.activeAudio = null;
          reject(e);
        };

        audio.play().catch(err => {
          this.isSpeaking = false;
          reject(err);
        });
      });
    }

    stop() {
      if (this.activeAudio) {
        this.activeAudio.pause();
        this.activeAudio = null;
        this.isSpeaking = false;
      }
    }

    // Helper: ArrayBuffer to Base64
    arrayBufferToBase64(buffer) {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
    }
  }

  window.GantzTTS = new GantzTTSEngine();
})();
