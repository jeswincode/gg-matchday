export const companionOptions = {
  character: ["original", "captain", "winger"],
  style: ["striker", "playmaker"],
  kit: ["signature", "away", "training"],
  complexion: ["sand", "copper", "umber"],
  celebration: ["ronaldo", "messi"],
};

export function companionLook(value) {
  return Object.fromEntries(Object.entries(companionOptions).map(([key, options]) =>
    [key, options.includes(value?.[key]) ? value[key] : options[0]],
  ));
}

export function iconicCelebration(role, side, look) {
  if (role === "admin") return companionLook(look).celebration;
  return side === "Ronaldo" || side === "Messi" ? side.toLowerCase() : "";
}
