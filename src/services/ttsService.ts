import { Platform } from 'react-native';

export type TtsLang = 'zh-CN' | 'zh-TW' | 'en-US' | 'en-GB' | 'ru-RU';

type SpeechModule = typeof import('expo-speech');
type SpeakingListener = (speaking: boolean) => void;

let Speech: SpeechModule | null = null;
let speaking = false;
const listeners = new Set<SpeakingListener>();

function notifySpeaking(next: boolean): void {
  speaking = next;
  listeners.forEach((fn) => {
    try {
      fn(next);
    } catch {
      /* ignore */
    }
  });
}

function getSpeech(): SpeechModule | null {
  if (Platform.OS === 'web') return null;
  if (Speech) return Speech;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Speech = require('expo-speech') as SpeechModule;
  } catch {
    Speech = null;
  }
  return Speech;
}

function getWebSynth(): SpeechSynthesis | null {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined') return null;
  try {
    return window.speechSynthesis ?? null;
  } catch {
    return null;
  }
}

function pickVoice(
  voices: SpeechSynthesisVoice[],
  lang: TtsLang
): SpeechSynthesisVoice | null {
  const exact = voices.find(
    (v) => v.lang === lang || v.lang.replace('_', '-') === lang
  );
  if (exact) return exact;
  const prefix = lang.slice(0, 2).toLowerCase();
  const byPrefix = voices.find((v) =>
    v.lang.toLowerCase().startsWith(prefix)
  );
  if (byPrefix) return byPrefix;
  if (prefix === 'zh') {
    return (
      voices.find((v) => /chinese|中文|普通话|國語|国语/i.test(v.name)) ?? null
    );
  }
  if (prefix === 'en') {
    return (
      voices.find((v) => /english|en-/i.test(v.lang) || /english/i.test(v.name)) ??
      null
    );
  }
  if (prefix === 'ru') {
    return (
      voices.find(
        (v) =>
          /ru-|russian/i.test(v.lang) ||
          /русск|кирил|рус|рос/i.test(v.name)
      ) ?? null
    );
  }
  return null;
}

/** Озвучка: Web SpeechSynthesis / native expo-speech */
export async function speak(
  text: string,
  rate: number = 0.85,
  lang: TtsLang = 'zh-CN'
): Promise<void> {
  const trimmed = text?.trim();
  if (!trimmed) return;

  stop();

  const clampedRate = Math.min(2, Math.max(0.1, rate));

  if (Platform.OS === 'web') {
    const synth = getWebSynth();
    if (!synth) {
      console.warn('[ttsService] speechSynthesis недоступен');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.lang = lang;
    utterance.rate = clampedRate;

    const applyVoice = () => {
      const voice = pickVoice(synth.getVoices(), lang);
      if (voice) utterance.voice = voice;
    };
    applyVoice();
    if (synth.getVoices().length === 0) {
      synth.addEventListener('voiceschanged', applyVoice, { once: true });
    }

    utterance.onstart = () => notifySpeaking(true);
    utterance.onend = () => notifySpeaking(false);
    utterance.onerror = () => notifySpeaking(false);

    notifySpeaking(true);
    setTimeout(() => {
      try {
        if (typeof window !== 'undefined') {
          window.speechSynthesis.cancel();
        }
        synth.speak(utterance);
      } catch {
        notifySpeaking(false);
      }
    }, 40);
    return;
  }

  const speech = getSpeech();
  if (!speech) {
    console.warn('[ttsService] expo-speech недоступен');
    return;
  }

  notifySpeaking(true);
  await new Promise<void>((resolve) => {
    speech.speak(trimmed, {
      language: lang,
      rate: clampedRate,
      onDone: () => {
        notifySpeaking(false);
        resolve();
      },
      onStopped: () => {
        notifySpeaking(false);
        resolve();
      },
      onError: () => {
        notifySpeaking(false);
        resolve();
      },
    });
  });
}

/** Мгновенная остановка озвучки */
export function stop(): void {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } catch {
      /* ignore */
    }
    notifySpeaking(false);
    return;
  }

  const speech = getSpeech();
  if (speech) speech.stop();
  notifySpeaking(false);
}

export function isSpeaking(): boolean {
  if (Platform.OS === 'web') {
    const synth = getWebSynth();
    if (synth) return Boolean(synth.speaking) || speaking;
  }
  return speaking;
}

export function subscribeSpeaking(listener: SpeakingListener): () => void {
  listeners.add(listener);
  try {
    listener(isSpeaking());
  } catch {
    /* ignore */
  }
  return () => {
    listeners.delete(listener);
  };
}

export const ttsService = {
  speak,
  stop,
  isSpeaking,
  subscribeSpeaking,
} as const;
