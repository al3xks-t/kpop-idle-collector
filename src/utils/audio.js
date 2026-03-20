const audioCache = new Map();

export function playSound(src, volume = 0.5) {
  try {
    let cached = audioCache.get(src);

    if (!cached) {
      cached = new Audio(src);
      cached.preload = "auto";
      audioCache.set(src, cached);
    }

    const sound = cached.cloneNode();
    sound.volume = volume;
    sound.play().catch(() => {});
  } catch {
    // Fail silently so gameplay never breaks
  }
}