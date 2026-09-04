/**
 * Real-time Audio processing utilities for Gemini Live API
 * - 16kHz Little-Endian Int16 PCM capture for user audio
 * - 24kHz Little-Endian Int16 PCM queued playback for Gemini audio
 * - Interruption / cancellation management
 */

// Helper to convert Float32 [-1.0, 1.0] to Int16 PCM Little-Endian ArrayBuffer
export function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    // 0x7FFF = 32767, 0x8000 = 32768
    const intVal = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(i * 2, intVal, true); // little-endian
  }
  return buffer;
}

// Convert ArrayBuffer to Base64
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 string to Int16Array (24kHz little-endian)
export function base64ToInt16Array(base64: string): Int16Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

/**
 * Captures microphone audio at 16,000 Hz, emits base64 PCM chunks,
 * and detects voice activity for instant interruption.
 */
export class LiveAudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isRecording = false;

  public onAudioChunk?: (base64Pcm: string) => void;
  public onUserSpeechDetected?: () => void;

  async start(): Promise<void> {
    if (this.isRecording) return;

    // Request microphone access
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    // Standardize input context to 16000Hz as required by Gemini Live
    this.audioContext = new AudioContextClass({ sampleRate: 16000 });

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
    // Buffer size 2048 or 4096 gives ~128ms - 256ms audio chunks
    this.processor = this.audioContext.createScriptProcessor(2048, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const channelData = e.inputBuffer.getChannelData(0);

      // Measure volume energy (RMS)
      let sum = 0;
      for (let i = 0; i < channelData.length; i++) {
        sum += channelData[i] * channelData[i];
      }
      const rms = Math.sqrt(sum / channelData.length);

      // Threshold for voice activity
      if (rms > 0.035) {
        this.onUserSpeechDetected?.();
      }

      // Convert to 16-bit PCM little endian
      const pcmBuffer = floatTo16BitPCM(channelData);
      const base64 = arrayBufferToBase64(pcmBuffer);
      this.onAudioChunk?.(base64);
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
    this.isRecording = true;
  }

  stop(): void {
    this.isRecording = false;

    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch {}
      this.processor = null;
    }

    if (this.source) {
      try {
        this.source.disconnect();
      } catch {}
      this.source = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
  }
}

/**
 * Gapless audio playback for Gemini Live 24,000 Hz responses.
 * Implements schedule queue using `nextStartTime` and instant interruption cancellation.
 */
export class LiveAudioPlayer {
  private audioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  public onPlaybackFinished?: () => void;

  private initContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass({ sampleRate: 24000 });
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  playChunk(base64Pcm: string): void {
    try {
      const ctx = this.initContext();
      const int16 = base64ToInt16Array(base64Pcm);
      const float32 = new Float32Array(int16.length);

      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
      }

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.copyToChannel(float32, 0);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const currentTime = ctx.currentTime;
      // Schedule gaplessly
      const startTime = Math.max(currentTime, this.nextStartTime);
      source.start(startTime);
      this.nextStartTime = startTime + audioBuffer.duration;

      this.activeSources.push(source);

      source.onended = () => {
        const idx = this.activeSources.indexOf(source);
        if (idx !== -1) {
          this.activeSources.splice(idx, 1);
        }
        if (this.activeSources.length === 0 && ctx.currentTime >= this.nextStartTime - 0.05) {
          this.onPlaybackFinished?.();
        }
      };
    } catch (err) {
      console.warn('Error playing audio chunk:', err);
    }
  }

  // Interruption: instantly stop all active playback nodes and reset timeline
  stopAndClear(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    }
    this.activeSources = [];
    this.nextStartTime = 0;
    this.onPlaybackFinished?.();
  }

  close(): void {
    this.stopAndClear();
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
  }
}
