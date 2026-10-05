import { useEffect, useState } from 'react';

/** Sample only the locally saved cover, keeping artwork processing on this device. */
export function useArtworkTint(url?: string) {
  const [tint, setTint] = useState('145 174 133');
  useEffect(() => {
    setTint('145 174 133');
    if (!url) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 12;
        const ctx = canvas.getContext('2d'); if (!ctx) return;
        ctx.drawImage(image, 0, 0, 12, 12);
        const pixels = ctx.getImageData(0, 0, 12, 12).data;
        let r = 0, g = 0, b = 0, weight = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          const saturation = Math.max(...pixels.slice(i, i + 3)) - Math.min(...pixels.slice(i, i + 3));
          const w = (saturation + 12) * pixels[i + 3] / 255;
          r += pixels[i] * w; g += pixels[i + 1] * w; b += pixels[i + 2] * w; weight += w;
        }
        if (weight) setTint([r, g, b].map(v => Math.round(v / weight)).join(' '));
      } catch { /* A cover without readable pixels uses the theme tint. */ }
    };
    image.src = url;
    return () => { cancelled = true; };
  }, [url]);
  return tint;
}
