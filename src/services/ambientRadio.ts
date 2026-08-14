import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import {
  isUserTrackPlaylistId,
  normalizeRadioPlaylistId,
  userTrackIdFromPlaylist,
  type RadioPlaylistId,
} from '../theme/y2k';
import { getUserTrack, resolvePlayableUrl, revokePlayableUrl } from './userTracksStore';

/**
 * Ambient-пресеты (Web Audio) + файлы с устройства (HTMLAudioElement).
 * Произвольные URL-ссылки не поддерживаются.
 */
class AmbientEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private nodes: AudioNode[] = [];
  private timers: ReturnType<typeof setInterval>[] = [];
  private playlist: RadioPlaylistId = 'lofi';
  private playing = false;
  /** 0…1 */
  private volume = 0.7;
  private audioEl: HTMLAudioElement | null = null;

  private ensure() {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return false;
    if (!this.ctx) {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.applyMasterGain();
      this.master.connect(this.ctx.destination);
    }
    return true;
  }

  /**
   * Вызывать из обработчика клика — разблокирует AudioContext
   * до того, как React успеет отложить play в useEffect.
   */
  async unlock(): Promise<boolean> {
    if (!this.ensure() || !this.ctx) return false;
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (err) {
        console.warn('[ambient] AudioContext resume failed', err);
        return false;
      }
    }
    return this.ctx.state === 'running';
  }

  private applyMasterGain() {
    if (this.master) {
      this.master.gain.value = 0.18 + this.volume * 0.35;
    }
    if (this.audioEl) {
      this.audioEl.volume = Math.max(0, Math.min(1, this.volume));
    }
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyMasterGain();
  }

  getVolume() {
    return this.volume;
  }

  private clearGraph() {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    for (const n of this.nodes) {
      try {
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.nodes = [];
  }

  private stopAudioElement() {
    if (!this.audioEl) return;
    try {
      this.audioEl.pause();
      this.audioEl.removeAttribute('src');
      this.audioEl.load();
    } catch {
      /* ignore */
    }
    this.audioEl = null;
  }

  /** Пауза без уничтожения файла (чтобы работали seek и resume) */
  pause() {
    this.playing = false;
    if (this.audioEl) {
      try {
        this.audioEl.pause();
      } catch {
        /* ignore */
      }
      return;
    }
    this.clearGraph();
  }

  getPlaybackState(): {
    currentTime: number;
    duration: number;
    seekable: boolean;
  } {
    const el = this.audioEl;
    if (!el) {
      return { currentTime: 0, duration: 0, seekable: false };
    }
    const duration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0;
    const currentTime = Number.isFinite(el.currentTime) ? el.currentTime : 0;
    return {
      currentTime,
      duration,
      seekable: duration > 0,
    };
  }

  private waitForDuration(
    el: HTMLAudioElement,
    timeoutMs = 10000
  ): Promise<number> {
    if (Number.isFinite(el.duration) && el.duration > 0) {
      return Promise.resolve(el.duration);
    }
    return new Promise((resolve) => {
      const done = () => {
        el.removeEventListener('loadedmetadata', onMeta);
        el.removeEventListener('durationchange', onMeta);
        el.removeEventListener('error', onErr);
        window.clearTimeout(timer);
        resolve(
          Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0
        );
      };
      const onMeta = () => {
        if (Number.isFinite(el.duration) && el.duration > 0) done();
      };
      const onErr = () => done();
      const timer = window.setTimeout(done, timeoutMs);
      el.addEventListener('loadedmetadata', onMeta);
      el.addEventListener('durationchange', onMeta);
      el.addEventListener('error', onErr);
      if (el.readyState >= 1) onMeta();
    });
  }

  async seekTo(seconds: number): Promise<void> {
    const el = this.audioEl;
    if (!el) return;
    const duration = await this.waitForDuration(el);
    if (duration <= 0) return;
    const t = Math.max(0, Math.min(duration, seconds));
    try {
      el.currentTime = t;
    } catch (err) {
      console.warn('[ambient] seek failed', err);
      return;
    }
    if (this.playing) {
      try {
        await el.play();
      } catch (err) {
        console.warn('[ambient] play after seek failed', err);
      }
    }
  }

  private noiseBuffer(seconds = 2): AudioBuffer | null {
    if (!this.ctx) return null;
    const len = this.ctx.sampleRate * seconds;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private startForest() {
    this.startPad([174, 220, 261, 329], 5);
    if (!this.ctx || !this.master) return;
    const buf = this.noiseBuffer(4);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.045;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
    this.nodes.push(src, filter, gain);

    const cricket = () => {
      if (!this.ctx || !this.master || !this.playing) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 1800 + Math.random() * 600;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, this.ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.02, this.ctx.currentTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
      osc.connect(g);
      g.connect(this.master);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
    };
    this.timers.push(setInterval(cricket, 3200));
  }

  private startPad(freqs: number[], detuneSpread = 6) {
    if (!this.ctx || !this.master) return;
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      osc.detune.value = (Math.random() - 0.5) * detuneSpread;
      const g = this.ctx.createGain();
      g.gain.value = 0.05;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.08 + Math.random() * 0.1;
      const lfoG = this.ctx.createGain();
      lfoG.gain.value = 0.02;
      lfo.connect(lfoG);
      lfoG.connect(g.gain);
      osc.connect(g);
      g.connect(this.master);
      osc.start();
      lfo.start();
      this.nodes.push(osc, g, lfo, lfoG);
    }
  }

  private startLofiBeat() {
    if (!this.ctx || !this.master) return;
    this.startPad([196, 247, 294, 370], 8);

    const kick = () => {
      if (!this.ctx || !this.master || !this.playing) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.frequency.setValueAtTime(120, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.15);
      g.gain.setValueAtTime(0.28, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
      osc.connect(g);
      g.connect(this.master);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.22);
    };

    const hat = () => {
      if (!this.ctx || !this.master || !this.playing) return;
      const buf = this.noiseBuffer(0.05);
      if (!buf) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 6000;
      const g = this.ctx.createGain();
      g.gain.value = 0.04;
      src.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      src.start();
    };

    this.timers.push(setInterval(kick, 900));
    this.timers.push(setInterval(hat, 450));
    kick();
  }

  private startGenshin() {
    this.startPad([220, 247, 294, 330, 392, 440], 4);
    if (!this.ctx || !this.master) return;
    const shimmer = () => {
      if (!this.ctx || !this.master || !this.playing) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      const notes = [523, 587, 659, 784, 880];
      osc.frequency.value = notes[Math.floor(Math.random() * notes.length)]!;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, this.ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime + 0.4);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 2.2);
      osc.connect(g);
      g.connect(this.master);
      osc.start();
      osc.stop(this.ctx.currentTime + 2.4);
    };
    this.timers.push(setInterval(shimmer, 2800));
    shimmer();
  }

  private async playUserFile(url: string) {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    this.stopAudioElement();
    this.clearGraph();
    const el = new Audio();
    el.preload = 'auto';
    el.loop = true;
    el.volume = this.volume;
    el.src = url;
    this.audioEl = el;
    this.playing = true;
    try {
      await el.play();
    } catch (err) {
      console.warn('[ambient] file track play failed:', err);
      this.playing = false;
      throw err;
    }
  }

  async play(playlist: RadioPlaylistId) {
    const id = normalizeRadioPlaylistId(playlist);
    const prevUserId = userTrackIdFromPlaylist(this.playlist);

    // Resume того же пользовательского трека без перезагрузки
    if (
      this.audioEl &&
      normalizeRadioPlaylistId(this.playlist) === id &&
      isUserTrackPlaylistId(id)
    ) {
      this.playing = true;
      this.applyMasterGain();
      try {
        await this.audioEl.play();
      } catch (err) {
        console.warn('[ambient] resume failed', err);
        this.playing = false;
        throw err;
      }
      return;
    }

    this.playlist = id;
    this.stopAudioElement();
    this.clearGraph();

    if (isUserTrackPlaylistId(id)) {
      const trackId = userTrackIdFromPlaylist(id);
      if (!trackId) return;
      if (prevUserId && prevUserId !== trackId) {
        revokePlayableUrl(prevUserId);
      }
      const track = await getUserTrack(trackId);
      if (!track) {
        console.warn('[ambient] user track missing', trackId);
        this.playing = false;
        return;
      }
      // Только файлы с устройства / облака — не произвольные URL
      if (track.source === 'url') {
        console.warn('[ambient] URL tracks disabled', trackId);
        this.playing = false;
        throw new Error('Воспроизведение по ссылке отключено');
      }
      try {
        const playable = await resolvePlayableUrl(track);
        await this.playUserFile(playable);
      } catch (err) {
        console.warn('[ambient] resolve/play failed', err);
        this.playing = false;
        throw err;
      }
      return;
    }

    if (prevUserId) revokePlayableUrl(prevUserId);

    if (!(await this.unlock()) || !this.ctx) {
      this.playing = false;
      return;
    }

    this.playing = true;
    this.applyMasterGain();
    if (id === 'lofi') this.startLofiBeat();
    else if (id === 'forest') this.startForest();
    else this.startGenshin();
  }

  stop() {
    this.playing = false;
    this.clearGraph();
    this.stopAudioElement();
  }

  async setPlaylist(playlist: RadioPlaylistId) {
    this.playlist = normalizeRadioPlaylistId(playlist);
    if (this.playing) await this.play(this.playlist);
  }

  isPlaying() {
    return this.playing;
  }
}

export const ambientRadio = new AmbientEngine();

/** Хук: стор ↔ ambient-движок + громкость */
export function useAmbientRadio(
  playing: boolean,
  playlist: RadioPlaylistId,
  volume = 0.7
) {
  const ready = useRef(false);

  useEffect(() => {
    ready.current = true;
    return () => {
      ambientRadio.stop();
    };
  }, []);

  useEffect(() => {
    ambientRadio.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    if (!ready.current) return;
    const id = normalizeRadioPlaylistId(playlist);
    if (playing) {
      void ambientRadio.play(id).catch((err) => {
        console.warn('[ambient] play failed', err);
      });
    } else {
      ambientRadio.pause();
    }
  }, [playing, playlist]);
}
