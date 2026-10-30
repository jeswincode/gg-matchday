import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import "./career-hub.css";
import { getCareerKits, getCareerMilestones, getNextCareerObjective } from "./career-progression.js";

const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const compactDate = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
};
const titleCase = value => String(value || "").replace(/[-_]/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
const AWARD_LABELS = {
  player: "Player of the Month",
  offensive: "Best Offensive Player",
  defensive: "Best Defensive Player",
  "golden-boot": "Golden Boot",
  "assist-leader": "Assist Leader",
  clasico: "El Clásico Award",
  motm: "Man of the Match",
};
const awardLabel = award => AWARD_LABELS[award.type] || titleCase(award.label || award.type || "Career award");


function readSelectedKit(playerId) {
  try { return window.localStorage.getItem("gg-v4-career-kit:" + playerId) || "home"; }
  catch { return "home"; }
}

function writeSelectedKit(playerId, kitId) {
  try { window.localStorage.setItem("gg-v4-career-kit:" + playerId, kitId); }
  catch { /* Kit selection is a convenience preference, not an unlock record. */ }
}

function Shirt({ number: shirtNumber }) {
  return (
    <svg className="career-shirt-art" viewBox="0 0 180 174" role="img" aria-label={"Jersey number " + (shirtNumber ?? "not set")}>
      <defs>
        <linearGradient id="career-shirt-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--career-shirt-light)" />
          <stop offset="1" stopColor="var(--career-shirt-dark)" />
        </linearGradient>
      </defs>
      <path d="M52 18 25 31 8 73l27 13 10-19v92h80V67l10 19 27-13-17-42-27-13-21 17H73L52 18Z" fill="url(#career-shirt-fill)" stroke="rgba(255,255,255,.62)" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M66 18c2 13 10 21 24 21s22-8 24-21" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="4"/>
      <path d="M45 67v92m90-92v92" stroke="rgba(255,255,255,.17)" strokeWidth="2"/>
      <text x="85" y="111" textAnchor="middle" className="career-shirt-number">{shirtNumber ?? "—"}</text>
      <path d="M18 71 36 80m126-9-18 9" stroke="rgba(255,255,255,.42)" strokeWidth="3"/>
    </svg>
  );
}

function CareerMetric({ label, value, hint }) {
  return (
    <article className="career-metric">
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
      <small>{hint}</small>
    </article>
  );
}

export default function CareerHub({ player, attributes, refreshKey = 0, onMatch }) {
  const [careerResponse, setCareerResponse] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [kitSelection, setKitSelection] = useState(() => ({
    playerId: String(player._id),
    kitId: readSelectedKit(String(player._id)),
  }));
  const requestKey = String(player._id) + ":" + String(refreshKey) + ":" + String(retryKey);

  useEffect(() => {
    let active = true;
    api("/stats/player/" + encodeURIComponent(player._id) + "?historyLimit=all")
      .then(data => {
        if (active) setCareerResponse({ key: requestKey, data, error: "" });
      })
      .catch(requestError => {
        if (active) setCareerResponse({
          key: requestKey,
          data: null,
          error: requestError.message || "Career data could not be loaded.",
        });
      });
    return () => { active = false; };
  }, [requestKey, player._id]);

  const responseIsCurrent = careerResponse?.key === requestKey;
  const career = responseIsCurrent ? careerResponse.data : null;
  const loading = !responseIsCurrent;
  const error = responseIsCurrent ? careerResponse.error : "";

  const stats = career?.stats || null;
  const objective = useMemo(() => getNextCareerObjective(stats), [stats]);
  const milestoneCards = useMemo(() => getCareerMilestones(stats), [stats]);
  const careerKits = useMemo(() => getCareerKits(stats), [stats]);
  const playerId = String(player._id);
  const savedKitId = kitSelection.playerId === playerId ? kitSelection.kitId : readSelectedKit(playerId);
  const selectedKit = careerKits.find(kit => kit.id === savedKitId && kit.unlocked) || careerKits[0];
  const selectKit = kit => {
    if (!kit.unlocked) return;
    writeSelectedKit(playerId, kit.id);
    setKitSelection({ playerId, kitId: kit.id });
  };
  const seasonRows = career?.seasons || [];
  const awards = career?.awards || [];
  const matches = career?.matches || [];
  const matchById = useMemo(() => new Map(matches.map(match => [String(match._id), match])), [matches]);
  const recent = (stats?.recent || []).map(item => ({
    ...item,
    name: matchById.get(String(item.matchId))?.name || "Matchday appearance",
  }));
  const winRate = stats?.matches ? Math.round((number(stats.wins) / number(stats.matches)) * 100) : 0;
  const objectiveProgress = Math.min(100, Math.round((objective.current / objective.target) * 100));
  const earnedCount = milestoneCards.reduce((total, item) => total + item.earnedLevels.length, 0)
    + awards.length + (career?.achievements?.length || 0)
    + careerKits.filter(kit => kit.unlocked && kit.id !== "home").length;

  if (loading && !career) {
    return (
      <section className="career-hub" aria-label="Player Career Hub" aria-busy="true">
        <div className="career-hub-heading"><div><p className="eyebrow">CAREER MODE</p><h3>Building your football story…</h3></div></div>
        <div className="career-hub-skeleton" />
      </section>
    );
  }

  if (error && !career) {
    return (
      <section className="career-hub" aria-label="Player Career Hub">
        <div className="career-hub-heading"><div><p className="eyebrow">CAREER MODE</p><h3>Player Career Hub</h3></div></div>
        <div className="career-hub-error" role="alert">{error}</div>
        <button type="button" className="secondary-button" onClick={() => setRetryKey(value => value + 1)}>Retry career data</button>
      </section>
    );
  }

  return (
    <section className="career-hub" aria-label="Player Career Hub">
      <div className="career-hub-heading">
        <div>
          <p className="eyebrow">GG MATCHDAY / PLAYER CAREER</p>
          <h3>Career Hub</h3>
          <p className="career-hub-subtitle">Your football journey, built from recorded Matchday history.</p>
        </div>
        <div className="career-hub-earned"><strong>{earnedCount}</strong><span>CAREER HONOURS & MILESTONES</span></div>
      </div>

      <div className="career-hub-feature">
        <div className="career-hub-dressing-room">
          <div className="career-hub-dressing-copy">
            <p className="career-hub-kicker">THE DRESSING ROOM</p>
            <h4>{player.name}</h4>
            <p>{player.position || "Position not set"} · {player.preferredFoot || "Foot not set"}</p>
            <div className="career-hub-shirt-caption"><span>OFFICIAL PLAYER NUMBER</span><strong>{player.jerseyNumber ?? "—"}</strong></div>
          </div>
          <div className="career-hub-shirt" style={{ "--career-shirt-light": selectedKit.light, "--career-shirt-dark": selectedKit.dark }}><Shirt number={player.jerseyNumber}/><span className="career-hub-kit-name">{selectedKit.label}</span></div>
          <div className="career-hub-player-image">
            {player.profileImage ? <img src={player.profileImage} alt="" /> : <span>{String(player.name || "P").slice(0, 1).toUpperCase()}</span>}
          </div>
          <div className="career-hub-ground-lines" aria-hidden="true" />
          <div className="career-hub-rating">
            <span>PLAYER OVR</span><strong>{attributes?.ovr ?? "—"}</strong><small>{attributes?.sampleStage || "Match data"}</small>
          </div>
        </div>

        <aside className="career-hub-objective">
          <div className="career-hub-objective-top"><span>NEXT OBJECTIVE</span><span className="career-hub-objective-index">01 / CAREER</span></div>
          <div className="career-hub-objective-icon">◎</div>
          <h4>{objective.label}</h4>
          <p>{objective.detail}</p>
          <div className="career-hub-progress-label"><span>{objective.current} / {objective.target}</span><strong>{objectiveProgress}%</strong></div>
          <div className="career-hub-progress"><span style={{ width: objectiveProgress + "%" }} /></div>
          <small>Progress updates from Match Record data. No manual claims.</small>
        </aside>
      </div>

      <section className="career-hub-kit-section">
        <div className="career-hub-section-head">
          <div><p className="eyebrow">DRESSING ROOM / KIT COLLECTION</p><h4>Choose your colours</h4></div>
          <span>{careerKits.filter(kit => kit.unlocked).length} / {careerKits.length} kits unlocked</span>
        </div>
        <div className="career-hub-kits">
          {careerKits.map(kit => (
            <button
              type="button"
              key={kit.id}
              className={"career-hub-kit" + (kit.unlocked ? " is-unlocked" : " is-locked") + (selectedKit.id === kit.id ? " is-selected" : "")}
              style={{ "--kit-light": kit.light, "--kit-dark": kit.dark }}
              disabled={!kit.unlocked}
              aria-pressed={selectedKit.id === kit.id}
              aria-label={(kit.unlocked ? "Select " : "Locked ") + kit.label + " kit"}
              onClick={() => selectKit(kit)}
            >
              <span className="career-hub-kit-shirt">G</span>
              <span className="career-hub-kit-copy"><strong>{kit.label}</strong><small>{kit.subtitle}</small><em>{kit.unlocked ? (selectedKit.id === kit.id ? "CURRENT KIT" : "UNLOCKED") : kit.requirement}</em></span>
              <span className="career-hub-kit-state">{kit.unlocked ? (selectedKit.id === kit.id ? "✓" : "＋") : "LOCK"}</span>
              {!kit.unlocked && <span className="career-hub-kit-track"><span style={{ width: kit.progress + "%" }}/></span>}
            </button>
          ))}
        </div>
        <p className="career-hub-kit-note">Kits unlock automatically from recorded appearances, goals and assists. Your selected look is saved on this device; no credits are charged.</p>
      </section>

      <div className="career-hub-metrics">
        <CareerMetric label="Appearances" value={stats?.matches ?? 0} hint="Recorded matches"/>
        <CareerMetric label="Goals" value={stats?.goals ?? 0} hint="Official goal events"/>
        <CareerMetric label="Assists" value={stats?.assists ?? 0} hint="Official assist events"/>
        <CareerMetric label="Win rate" value={winRate + "%"} hint={(stats?.wins ?? 0) + " team wins"}/>
        <CareerMetric label="Avg. match rating" value={stats?.averageRating == null ? "—" : Number(stats.averageRating).toFixed(2)} hint={(stats?.ratedMatches ?? 0) + " rated appearances"}/>
        <CareerMetric label="Clean sheets" value={stats?.cleanSheets ?? 0} hint="Team clean sheets"/>
      </div>

      <div className="career-hub-section-head">
        <div><p className="eyebrow">COLLECTIBLES & PROGRESSION</p><h4>Career milestones</h4></div>
        <span>Earned through recorded performances</span>
      </div>
      <div className="career-hub-milestones">
        {milestoneCards.map(item => (
          <article className={"career-milestone" + (item.unlocked ? " is-earned" : "")} key={item.key}>
            <div className="career-milestone-icon">{item.icon}</div>
            <div className="career-milestone-copy">
              <strong>{item.label}</strong>
              <span>{item.unlocked ? "Best unlocked: " + item.unlocked : "First milestone: " + item.next}</span>
              <div className="career-milestone-track"><span style={{ width: item.progress + "%" }} /></div>
              <small>{item.value} / {item.next}</small>
              <div className="career-milestone-badges" aria-label={item.label + " collectible levels"}>
                {item.earnedLevels.map(level => <span key={level} title={item.label + " milestone: " + level}>★ {level}</span>)}
                {!item.earnedLevels.length && <span className="is-locked">Next unlock · {item.next}</span>}
              </div>
            </div>
            <div className="career-milestone-status">{item.unlocked ? "✓" : "·"}</div>
          </article>
        ))}
      </div>

      <div className="career-hub-lower-grid">
        <section className="career-hub-panel">
          <div className="career-hub-section-head"><div><p className="eyebrow">HONOURS CABINET</p><h4>Official awards</h4></div><span>{awards.length} recorded</span></div>
          {awards.length ? (
            <div className="career-hub-awards">
              {awards.map((award, index) => (
                <article className="career-hub-award" key={String(award._id || award.key || index)}>
                  <span className="career-hub-award-mark">★</span>
                  <div><strong>{awardLabel(award)}</strong><small>{award.month ? new Date(Date.UTC(award.year, award.month - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }) : award.year || "GG Matchday"}</small></div>
                  {award.value != null && <b>{award.value}</b>}
                </article>
              ))}
            </div>
          ) : (
            <div className="career-hub-empty"><span className="career-hub-empty-icon">◇</span><strong>Your first trophy is waiting.</strong><small>Official monthly and seasonal awards will appear here when earned.</small></div>
          )}
          {career?.achievements?.length > 0 && (
            <div className="career-hub-stored-achievements">
              <p className="eyebrow">RECORDED ACHIEVEMENTS</p>
              {career.achievements.map((achievement, index) => <span key={String(achievement._id || index)}>{achievement.label || titleCase(achievement.key)}</span>)}
            </div>
          )}
        </section>

        <section className="career-hub-panel">
          <div className="career-hub-section-head"><div><p className="eyebrow">SEASON ARCHIVE</p><h4>Every season counts</h4></div><span>{seasonRows.length} seasons</span></div>
          {seasonRows.length ? (
            <div className="career-hub-seasons">
              {seasonRows.slice(0, 6).map(season => (
                <article className="career-hub-season" key={season.year}>
                  <div className="career-hub-season-year"><strong>{season.year}</strong><span>{season.matches || 0} MATCHES</span></div>
                  <div className="career-hub-season-data"><span><b>{season.goals || 0}</b> G</span><span><b>{season.assists || 0}</b> A</span><span><b>{season.wins || 0}</b> W</span><span><b>{season.ggRating == null ? "—" : Number(season.ggRating).toFixed(2)}</b> GG</span></div>
                </article>
              ))}
            </div>
          ) : (
            <div className="career-hub-empty"><span className="career-hub-empty-icon">▤</span><strong>Your season archive is empty.</strong><small>Season summaries appear after your first recorded match.</small></div>
          )}
        </section>
      </div>

      <section className="career-hub-panel career-hub-match-panel">
        <div className="career-hub-section-head"><div><p className="eyebrow">CAREER TIMELINE</p><h4>Recent appearances</h4></div><span>{matches.length} loaded</span></div>
        {recent.length ? (
          <div className="career-hub-recent">
            {recent.slice(0, 5).map((match, index) => (
              <button className="career-hub-recent-match" type="button" key={match.matchId || index} onClick={() => onMatch?.(match.matchId)}>
                <span className={"career-hub-result career-hub-result-" + String(match.result || "D").toLowerCase()}>{match.result || "—"}</span>
                <span className="career-hub-recent-copy"><strong>{match.name || "Matchday appearance"}</strong><small>{compactDate(match.date)}</small></span>
                <span className="career-hub-recent-open">VIEW →</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="career-hub-empty"><strong>No appearances yet.</strong><small>Your career timeline will start when a match is recorded.</small></div>
        )}
      </section>

      <p className="career-hub-footnote">Career statistics, honours and kit unlocks are derived from Matchday records. Kit selection is device-local. Cosmetic progression does not change match ratings, OVR, team results or Club Wallets.</p>
    </section>
  );
}
