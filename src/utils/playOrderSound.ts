let audioInstance: HTMLAudioElement | null = null;

export function playOrderSound() {
  try {
    if (audioInstance) {
      audioInstance.pause();
      audioInstance.currentTime = 0;
    }
    audioInstance = new Audio('/sounds/cha-ching.mp3');
    audioInstance.volume = 1.0;
    audioInstance.play().catch((e) =>
      console.log('[SOUND] Autoplay blocked:', e)
    );
  } catch (error) {
    console.error('[SOUND] Error:', error);
  }
}

export function preloadOrderSound() {
  const audio = new Audio('/sounds/cha-ching.mp3');
  audio.preload = 'auto';
  audio.load();
}
