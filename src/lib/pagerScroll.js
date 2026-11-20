export function scrollToPagerStart(surface) {
  if (!surface) return;
  const top = surface.getBoundingClientRect().top;
  if (top < 0) window.scrollBy({ top, behavior: "instant" });
}
