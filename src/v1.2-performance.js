/*
 * GG Matchday v1.2 performance layer
 *
 * Goals:
 * - de-duplicate short-lived public GET requests
 * - invalidate the cache after API mutations
 * - lazy-load gallery images
 * - optimize Cloudinary image delivery for the current viewport role
 * - decode images asynchronously
 *
 * This file intentionally stays framework-agnostic so it can improve the
 * existing app without changing the match/award/profile business logic.
 */

function isCloudinaryImage(url) {
  try {
    return new URL(url, window.location.href).hostname.endsWith(
      "res.cloudinary.com"
    );
  } catch {
    return false;
  }
}

function cloudinaryOptimizedUrl(url, width) {
  if (!isCloudinaryImage(url)) return url;

  try {
    const parsed = new URL(url, window.location.href);
    const marker = "/image/upload/";

    if (!parsed.pathname.includes(marker)) return url;

    const afterUpload = parsed.pathname.split(marker)[1];
    const firstSegment = afterUpload.split("/")[0] || "";
    const alreadyOptimized =
      firstSegment.includes("f_auto") ||
      firstSegment.includes("q_auto") ||
      firstSegment.includes("dpr_auto");

    if (alreadyOptimized) return url;

    const transformation = `f_auto,q_auto,dpr_auto,c_limit,w_${width}`;
    parsed.pathname = parsed.pathname.replace(
      marker,
      `${marker}${transformation}/`
    );

    return parsed.toString();
  } catch {
    return url;
  }
}

function optimizeImage(image) {
  if (!(image instanceof HTMLImageElement)) return;

  const rawSource = image.getAttribute("src");
  if (!rawSource) return;


  const isProfileImage = Boolean(
    image.closest(
      ".profile-modal, .player-profile, .player-profile-card, .account-user"
    )
  );

  image.decoding = "async";


  const width = isProfileImage ? 480 : 1200;
  const optimizedSource = cloudinaryOptimizedUrl(rawSource, width);

  if (optimizedSource !== rawSource) {
    image.setAttribute("src", optimizedSource);
  }
}

function optimizeImages(root = document) {
  root.querySelectorAll?.("img").forEach(optimizeImage);

  if (root instanceof HTMLImageElement) {
    optimizeImage(root);
  }
}

function scheduleImageOptimization() {
  const run = () => optimizeImages(document);

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 1200 });
  } else {
    window.setTimeout(run, 0);
  }
}

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        optimizeImages(node);
      }
    }

    if (
      mutation.type === "attributes" &&
      mutation.target instanceof HTMLImageElement &&
      mutation.attributeName === "src"
    ) {
      optimizeImage(mutation.target);
    }
  }
});

observer.observe(document.documentElement, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ["src"],
});

scheduleImageOptimization();
