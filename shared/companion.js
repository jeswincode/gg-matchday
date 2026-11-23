export const companionOptions = {
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
