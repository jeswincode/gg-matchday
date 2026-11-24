import { lazy, Suspense } from "react";
import { iconicCelebration } from "../../../shared/companion";
import "./companion.css";

const CompanionStage = lazy(() => import("./CompanionStage.jsx"));
const preview = new URLSearchParams(window.location.search).get("companion") === "preview";

export default function CompanionWorld({ account, enabled, clasicoSide }) {
  const legacy = preview && !enabled;
  return <>
    <span className="gg-companion-rail gg-companion-rail--left" aria-hidden="true" />
    <span className="gg-companion-rail gg-companion-rail--right" aria-hidden="true" />
    {(enabled || legacy) && <Suspense fallback={null}>
      <CompanionStage key={account?.id || (legacy ? "preview" : "account")} account={account}
        look={account?.companion} celebration={iconicCelebration(account?.role, clasicoSide, account?.companion)}
        legacy={legacy} />
    </Suspense>}
  </>;
}
