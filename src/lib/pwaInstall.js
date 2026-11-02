let deferredPrompt = null;
const installPromptListeners = new Set();
const installedListeners = new Set();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    installPromptListeners.forEach(listener => listener(true));
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installPromptListeners.forEach(listener => listener(false));
    installedListeners.forEach(listener => listener());
  });
}

export function subscribeToInstallPrompt(listener) {
  installPromptListeners.add(listener);
  listener(Boolean(deferredPrompt));
  return () => installPromptListeners.delete(listener);
}

export function subscribeToAppInstalled(listener) {
  installedListeners.add(listener);
  return () => installedListeners.delete(listener);
}

export async function promptPwaInstall() {
  const prompt = deferredPrompt;
  if (!prompt) return { outcome: "unavailable" };

  deferredPrompt = null;
  installPromptListeners.forEach(listener => listener(false));
  await prompt.prompt();
  return await prompt.userChoice;
}

export function isPwaStandalone() {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true,
  );
}
