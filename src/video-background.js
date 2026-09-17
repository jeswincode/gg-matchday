const video = document.getElementById('gg-background-video');

if (video) {
  fetch('/ggmatchdaybg-web.mp4.b64', { cache: 'force-cache' })
    .then((response) => {
      if (!response.ok) throw new Error(`Background video asset failed (${response.status})`);
      return response.text();
    })
    .then((base64) => {
      const clean = base64.replace(/\s+/g, '');
      const binary = atob(clean);
      const bytes = new Uint8Array(binary.length);

      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }

      const objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'video/mp4' }));
      video.src = objectUrl;
      video.load();

      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }

      window.addEventListener('beforeunload', () => URL.revokeObjectURL(objectUrl), { once: true });
    })
    .catch((error) => {
      console.warn('GG Matchday background video unavailable:', error.message);
      video.classList.add('gg-video-fallback');
    });
}
