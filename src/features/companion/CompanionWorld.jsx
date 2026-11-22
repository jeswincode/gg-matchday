import { lazy, Suspense } from "react";
import "./companion.css";

const CompanionStage = lazy(() => import("./CompanionStage.jsx"));
const preview = new URLSearchParams(window.location.search).get("companion") === "preview";

export default function CompanionWorld() {
  return <>
    <span className="gg-companion-rail gg-companion-rail--left" aria-hidden="true" />
    <span className="gg-companion-rail gg-companion-rail--right" aria-hidden="true" />
    {preview && <Suspense fallback={null}><CompanionStage /></Suspense>}
  </>;
}
