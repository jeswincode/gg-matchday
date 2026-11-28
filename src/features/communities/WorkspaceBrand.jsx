import { createContext, useContext } from "react";

export const foundingBrand = {
  name: "GG Matchday", monogram: "GG", rating: "GG Rating", companion: "GG Companion", founding: true,
};
export const platformBrand = { name: "ballers.", monogram: "b." };
export const WorkspaceBrand = createContext(foundingBrand);
export const useWorkspaceBrand = () => useContext(WorkspaceBrand);
