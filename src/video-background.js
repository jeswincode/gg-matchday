const video = document.createElement('video');
video.id = 'gg-background-video';
video.className = 'gg-video-background';
video.autoplay = true;
video.muted = true;
video.loop = true;
video.playsInline = true;
video.preload = 'metadata';
video.setAttribute('aria-hidden', 'true');
video.setAttribute('tabindex', '-1');
video.src = '/ggmatchdaybg.mp4';

document.body.prepend(video);

const overlay = document.createElement('div');
overlay.className = 'gg-video-overlay';
overlay.setAttribute('aria-hidden', 'true');
document.body.prepend(overlay);

const play = () => video.play().catch(() => {});
video.addEventListener('loadeddata', play, { once: true });
play();

video.addEventListener('error', () => {
  video.classList.add('gg-video-fallback');
}, { once: true });

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  video.classList.add('gg-video-reduced-motion');
}
