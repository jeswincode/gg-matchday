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

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let resumeTimer = 0;
let swiping = false;
let inClubs = false;

const play = () => {
  if (video.autoplay && !reducedMotion.matches) video.play().catch(() => {});
};

export function pauseBackgroundForSwipe(moving) {
  window.clearTimeout(resumeTimer);
  if (moving) {
    swiping = true;
    syncPlayback();
  } else if (swiping) {
    resumeTimer = window.setTimeout(() => {
      swiping = false;
      syncPlayback();
    }, 180);
  }
}

export function setBackgroundWorkspace(workspace) {
  const nextInClubs = workspace === "clubs";
  if (nextInClubs === inClubs) return;
  inClubs = nextInClubs;
  syncPlayback();
}

function syncPlayback() {
  video.classList.toggle('gg-video-reduced-motion', reducedMotion.matches);
  video.autoplay = !inClubs && !swiping && !reducedMotion.matches;
  if (video.autoplay) play();
  else video.pause();
}

video.addEventListener('loadeddata', play, { once: true });
reducedMotion.addEventListener('change', syncPlayback);
syncPlayback();

video.addEventListener('error', () => {
  video.classList.add('gg-video-fallback');
}, { once: true });
