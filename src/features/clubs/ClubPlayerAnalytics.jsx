import { useMemo, useState } from "react";
import Modal from "../../components/Modal";
import useResource from "../../components/useResource";
import "./club-player-analytics.css";

const attributeLabels = [
  ["pace", "PAC", "Pace"],
  ["shooting", "SHO", "Shooting"],
  ["passing", "PAS", "Passing"],
  ["dribbling", "DRI", "Dribbling"],
  ["defending", "DEF", "Defending"],
  ["physical", "PHY", "Physical"],
];

function displayNumber(value, digits = 1) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits).replace(/\.0$/, "") : "—";
}

function percentage(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return Math.round(Number(value) * 100) + "%";
}

function initials(name = "") {
  return String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map(part => part[0]).join("").toUpperCase() || "GG";
}

function formatDate(value) {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date not recorded"
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function resultLabel(result) {
  return ({ W: "Win", D: "Draw", L: "Loss" })[result] || "Result unavailable";
}

function RadarProfile({ attributes }) {
  const cx = 160, cy = 128, radius = 82;
  const measured = attributeLabels.map(([key, short, label], index) => ({
    key, short, label, value: attributes?.[key] == null ? null : Number(attributes[key]),
    angle: (-90 + index * 60) * Math.PI / 180,
  }));
  const ringPoints = scale => measured.map(entry =>
    (cx + Math.cos(entry.angle) * radius * scale) + "," +
    (cy + Math.sin(entry.angle) * radius * scale)
  ).join(" ");
  const dataPoints = measured.map(entry => {
    const value = entry.value == null || !Number.isFinite(entry.value) ? 0 : Math.max(0, Math.min(99, entry.value)) / 99;
    return (cx + Math.cos(entry.angle) * radius * value) + "," +
      (cy + Math.sin(entry.angle) * radius * value);
  }).join(" ");
  const complete = measured.filter(item => item.value !== null && Number.isFinite(item.value)).length >= 3;

  return (
    <div className="club-analytics-radar-wrap">
      <svg className="club-analytics-radar" viewBox="0 0 320 260" role="img" aria-label="Six player attributes on a scale from 1 to 99">
        {[0.25, 0.5, 0.75, 1].map(scale => (
          <polygon key={scale} className="club-analytics-radar-grid" points={ringPoints(scale)} />
        ))}
        {measured.map(entry => (
          <line key={entry.key} className="club-analytics-radar-axis" x1={cx} y1={cy}
            x2={cx + Math.cos(entry.angle) * radius} y2={cy + Math.sin(entry.angle) * radius} />
        ))}
        {complete && <polygon className="club-analytics-radar-data" points={dataPoints} />}
        {measured.map(entry => {
          const x = cx + Math.cos(entry.angle) * (radius + 24);
          const y = cy + Math.sin(entry.angle) * (radius + 24);
          return (
            <text key={entry.key} className="club-analytics-radar-label" x={x} y={y + 4} textAnchor="middle">
              {entry.short} {entry.value == null || !Number.isFinite(entry.value) ? "—" : Math.round(entry.value)}
            </text>
          );
        })}
      </svg>
      {!complete && <p className="club-analytics-muted">The radar fills in as enough attribute values are recorded.</p>}
      <div className="club-analytics-attribute-list">
        {measured.map(entry => (
          <div className="club-analytics-attribute" key={entry.key}>
            <div><span>{entry.label}</span><strong>{entry.value == null || !Number.isFinite(entry.value) ? "—" : Math.round(entry.value)}</strong></div>
            <div className="club-analytics-attribute-track" aria-hidden="true">
              <span style={{ width: entry.value == null || !Number.isFinite(entry.value) ? "0%" : Math.max(0, Math.min(100, entry.value)) + "%" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendChart({ items, field, label, percent = false }) {
  const points = items.map(item => ({ item, value: item[field] }))
    .filter(point => point.value !== null && point.value !== undefined && Number.isFinite(Number(point.value)))
    .map(point => ({ ...point, value: Number(point.value) }));

  if (points.length < 2) {
    return <div className="club-analytics-chart-empty">More recorded matches are needed to show this trend.</div>;
  }

  const width = 640, height = 190, pad = 24;
  const max = percent ? 1 : Math.max(10, ...points.map(point => point.value));
  const min = 0;
  const x = index => pad + (index / Math.max(1, points.length - 1)) * (width - pad * 2);
  const y = value => height - pad - ((Math.max(min, Math.min(max, value)) - min) / (max - min)) * (height - pad * 2);
  const line = points.map((point, index) => x(index) + "," + y(point.value)).join(" ");

  return (
    <div className="club-analytics-chart-wrap">
      <svg className="club-analytics-trend" viewBox={"0 0 " + width + " " + height} role="img" aria-label={label}>
        {[0.25, 0.5, 0.75, 1].map(scale => (
          <line key={scale} className="club-analytics-chart-grid" x1={pad} x2={width - pad}
            y1={height - pad - scale * (height - pad * 2)} y2={height - pad - scale * (height - pad * 2)} />
        ))}
        <polyline className="club-analytics-chart-line" points={line} />
        {points.map((point, index) => (
          <circle className="club-analytics-chart-dot" key={point.item.matchId || point.item.date || index}
            cx={x(index)} cy={y(point.value)} r="4">
            <title>{formatDate(point.item.date)} · {displayNumber(percent ? point.value * 100 : point.value)}{percent ? "%" : ""}</title>
          </circle>
        ))}
      </svg>
      <div className="club-analytics-chart-foot"><span>{formatDate(points[0].item.date)}</span><span>{formatDate(points.at(-1).item.date)}</span></div>
    </div>
  );
}

function Metric({ label, value, detail }) {
  return (
    <article className="club-analytics-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}

function ResultBadge({ result }) {
  const code = ["W", "D", "L"].includes(result) ? result : "N";
  return <span className="club-analytics-result" data-result={code}>{code === "N" ? "—" : code}</span>;
}

export default function ClubPlayerAnalytics({ playerId, isCaptain = false, onClose }) {
  const performance = useResource("/stats/player/" + playerId + "/performance");
  const attributesResource = useResource("/players/" + playerId + "/attributes");
  const clubResource = useResource("/clubs/player/" + playerId + "/analytics");
  const [section, setSection] = useState("overview");
  const [range, setRange] = useState("10");

  const player = performance.data?.player;
  const stats = performance.data?.stats || {};
  const analytics = performance.data?.analytics;
  const attributeData = attributesResource.data || {};
  const attributes = attributeData.attributes || attributeData.currentAttributes || {};
  const clubCareer = clubResource.data?.career || {};
  const timeline = analytics?.timeline || [];
  const chartItems = useMemo(() => {
    const rated = timeline.filter(item => item.rating !== null && item.rating !== undefined);
    return range === "all" ? rated : rated.slice(-10);
  }, [timeline, range]);
  const latest = timeline.at(-1);
  const ovr = attributeData.currentOvr ?? attributeData.ovr ?? null;
  const identityName = player?.name || "Player analytics";
  const loading = performance.loading && attributesResource.loading && clubResource.loading;
  const anyError = performance.error || attributesResource.error || clubResource.error;

  return (
    <Modal title={identityName + " · Player Card & Analytics"} onClose={onClose} className="clubs-player-analytics-modal">
      <div className="club-player-analytics" data-player-analytics>
        {loading ? (
          <div className="club-analytics-state" role="status"><span className="club-analytics-loading-mark">GG</span><strong>Building player view…</strong><p>Loading Matchday performance, player attributes and Clubs career.</p></div>
        ) : (
          <>
            {anyError && (
              <div className="club-analytics-partial-note" role="status">
                Some analytics could not load. Available verified statistics are still shown; missing values remain blank.
              </div>
            )}
            <section className="club-analytics-hero">
              <div className="club-analytics-player-card">
                <div className="club-analytics-card-top">
                  <span className="club-analytics-mark">GG</span>
                  <span className="club-analytics-card-position">{attributeData.position || player?.position || "PLAYER"}</span>
                </div>
                <div className="club-analytics-player-identity">
                  <div className="club-analytics-portrait">
                    {player?.profileImage ? <img src={player.profileImage} alt={player.name + " profile"} /> : <span>{initials(player?.name)}</span>}
                  </div>
                  <div className="club-analytics-card-rating"><strong>{displayNumber(ovr, 0)}</strong><span>OVR</span></div>
                </div>
                <h3>{player?.name || "Player"}</h3>
                <p>{attributeData.position || player?.position || "Position not set"}{isCaptain ? " · CLUB CAPTAIN" : ""}</p>
                <div className="club-analytics-card-confidence">
                  <span>OVR confidence</span><strong>{attributeData.confidence == null ? "—" : attributeData.confidence + "%"}</strong>
                </div>
                <div className="club-analytics-card-meta">
                  <span>{attributeData.sampleStage || "sample unavailable"}</span>
                  <span>{attributeData.matchesPlayed ?? analytics?.totals?.matches ?? 0} Matchday appearances</span>
                </div>
              </div>
              <div className="club-analytics-hero-detail">
                <p className="clubs-eyebrow">PLAYER PERFORMANCE PROFILE</p>
                <h3>{player?.name ? "A view grounded in recorded matches" : "Verified player data"}</h3>
                <p className="club-analytics-muted">Current OVR describes the six-attribute player card. GG Rating and Defensive Rating stay separate and follow their existing Matchday rules.</p>
                <div className="club-analytics-metrics-grid">
                  <Metric label="GG Rating" value={displayNumber(stats.ggRating, 2)} detail="Matchday rating" />
                  <Metric label="Avg Match Rating" value={displayNumber(analytics?.totals?.performanceRating, 2)} detail="Rated appearances only" />
                  <Metric label="Current Form" value={analytics?.totals?.form == null ? "—" : Math.round(analytics.totals.form) + "%"} detail="Recent five-match window" />
                  <Metric label="Win Rate" value={analytics ? percentage(analytics.totals.winRate) : "—"} detail={(analytics?.totals?.wins ?? 0) + " wins · " + (analytics?.totals?.draws ?? 0) + " draws · " + (analytics?.totals?.losses ?? 0) + " losses"} />
                </div>
              </div>
            </section>

            <nav className="club-analytics-tabs" aria-label="Player analytics sections">
              {[
                ["overview", "Overview"],
                ["performance", "Performance"],
                ["history", "Match History"],
              ].map(([key, label]) => (
                <button type="button" key={key} className={section === key ? "active" : ""}
                  aria-current={section === key ? "page" : undefined} onClick={() => setSection(key)}>
                  {label}
                </button>
              ))}
            </nav>

            {section === "overview" && (
              <div className="club-analytics-content">
                <section className="club-analytics-section">
                  <div className="club-analytics-section-head"><div><p className="clubs-eyebrow">MATCHDAY CAREER</p><h3>Career snapshot</h3></div><span>{analytics?.totals?.matches ?? 0} appearances</span></div>
                  <div className="club-analytics-kpi-grid">
                    <Metric label="Goals" value={analytics?.totals?.goals ?? "—"} />
                    <Metric label="Assists" value={analytics?.totals?.assists ?? "—"} />
                    <Metric label="Clean Sheets" value={analytics?.totals?.cleanSheets ?? "—"} />
                    <Metric label="Wins" value={analytics?.totals?.wins ?? "—"} />
                    <Metric label="Match Rating" value={displayNumber(analytics?.totals?.performanceRating, 2)} detail="Average of recorded ratings" />
                    <Metric label="Defensive Rating" value={displayNumber(stats.defensiveRating, 2)} detail="Kept separate from GG Rating" />
                  </div>
                  <div className="club-analytics-form-strip">
                    <div><span>RECENT FORM</span><strong>{timeline.length ? timeline.slice(-5).map(item => item.result || "—").join(" · ") : "Not enough recorded matches"}</strong></div>
                    <div><span>LAST MATCH</span><strong>{latest ? resultLabel(latest.result) + " · " + (latest.name || "Football Match") : "No match history"}</strong></div>
                  </div>
                </section>

                <div className="club-analytics-two-column">
                  <section className="club-analytics-section">
                    <div className="club-analytics-section-head"><div><p className="clubs-eyebrow">PLAYER ATTRIBUTES</p><h3>Attribute profile</h3></div><span>Scale 1–99</span></div>
                    <RadarProfile attributes={attributes} />
                  </section>
                  <section className="club-analytics-section club-analytics-club-career">
                    <div className="club-analytics-section-head"><div><p className="clubs-eyebrow">CLUBS CAREER</p><h3>Club contribution</h3></div><span>{clubResource.data?.clubCount ?? 0} Clubs</span></div>
                    <div className="club-analytics-kpi-grid club-analytics-kpi-grid--compact">
                      <Metric label="Matches" value={clubCareer.matches ?? "—"} />
                      <Metric label="W–D–L" value={(clubCareer.wins ?? 0) + "–" + (clubCareer.draws ?? 0) + "–" + (clubCareer.losses ?? 0)} />
                      <Metric label="Goals" value={clubCareer.goals ?? "—"} />
                      <Metric label="Assists" value={clubCareer.assists ?? "—"} />
                      <Metric label="MOTM" value={clubCareer.motm ?? "—"} />
                      <Metric label="Avg Club Match Rating" value={displayNumber(clubCareer.averageRating, 2)} />
                    </div>
                    <p className="club-analytics-muted">Club totals use recorded Club match summaries across current and previous Clubs. Financial data is not included here.</p>
                    {(clubResource.data?.clubs || []).length > 0 ? (
                      <div className="club-analytics-tenures">
                        {clubResource.data.clubs.map(club => (
                          <article className="club-analytics-tenure" key={club.clubId}>
                            <div className="club-analytics-tenure-mark">{club.logoUrl ? <img src={club.logoUrl} alt="" /> : <span>GG</span>}</div>
                            <div className="club-analytics-tenure-copy"><strong>{club.clubName}</strong><span>{club.clubStatus === "archived" ? "Past Club" : "Club career"} · {club.matches} matches · {club.wins} wins</span></div>
                            <strong className="club-analytics-tenure-rating">{displayNumber(club.averageRating, 2)}<small>AVG</small></strong>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="club-analytics-empty">No Club match statistics have been recorded for this player yet.</div>
                    )}
                  </section>
                </div>
              </div>
            )}

            {section === "performance" && (
              <div className="club-analytics-content">
                <section className="club-analytics-section">
                  <div className="club-analytics-section-head"><div><p className="clubs-eyebrow">RATING TREND</p><h3>Match rating progression</h3></div><div className="club-analytics-range"><button type="button" className={range === "10" ? "active" : ""} onClick={() => setRange("10")}>Last 10</button><button type="button" className={range === "all" ? "active" : ""} onClick={() => setRange("all")}>All</button></div></div>
                  <TrendChart items={chartItems} field="rating" label="Match rating progression" />
                  <p className="club-analytics-muted">Only recorded ratings are charted. Unrated matches are not treated as zero.</p>
                </section>
                <div className="club-analytics-two-column">
                  <section className="club-analytics-section"><div className="club-analytics-section-head"><div><p className="clubs-eyebrow">FORM</p><h3>Win-rate progression</h3></div><strong className="club-analytics-large-stat">{percentage(analytics?.totals?.winRate)}</strong></div><TrendChart items={timeline} field="winRate" label="Win-rate progression" percent /></section>
                  <section className="club-analytics-section"><div className="club-analytics-section-head"><div><p className="clubs-eyebrow">ATTACK & DEFENCE</p><h3>Latest recorded contributions</h3></div><span>Separate measures</span></div>
                    <div className="club-analytics-contributions">
                      <div><span>Goals in latest match</span><strong>{latest?.goals ?? "—"}</strong></div>
                      <div><span>Assists in latest match</span><strong>{latest?.assists ?? "—"}</strong></div>
                      <div><span>Defensive performance</span><strong>{displayNumber(latest?.defensivePerformance, 2)}</strong></div>
                      <div><span>Calculated Defensive Rating</span><strong>{displayNumber(latest?.defensiveRating ?? stats.defensiveRating, 2)}</strong></div>
                    </div>
                    <p className="club-analytics-muted">Defensive contributions are not added to the GG match rating.</p>
                  </section>
                </div>
                <section className="club-analytics-section"><div className="club-analytics-section-head"><div><p className="clubs-eyebrow">FORM GUIDE</p><h3>Last ten rated performances</h3></div><span>{analytics?.last10Ratings?.length ?? 0} ratings</span></div>
                  {(analytics?.last10Ratings || []).length ? <div className="club-analytics-rating-strip">{analytics.last10Ratings.map((item, index) => <div key={item.matchId || index}><strong>{displayNumber(item.rating, 2)}</strong><span>{index === 0 ? "Latest" : item.name || formatDate(item.date)}</span></div>)}</div> : <div className="club-analytics-empty">No rated performances recorded yet.</div>}
                </section>
              </div>
            )}

            {section === "history" && (
              <div className="club-analytics-content">
                <section className="club-analytics-section">
                  <div className="club-analytics-section-head"><div><p className="clubs-eyebrow">MATCH RECORD</p><h3>Recent appearances</h3></div><span>{timeline.length} recorded</span></div>
                  {timeline.length ? (
                    <div className="club-analytics-match-history">
                      {[...timeline].reverse().slice(0, 20).map(item => (
                        <article className="club-analytics-match-row" key={item.matchId}>
                          <ResultBadge result={item.result} />
                          <div className="club-analytics-match-title"><strong>{item.name || "Football Match"}</strong><span>{formatDate(item.date)}</span></div>
                          <div className="club-analytics-match-stat"><strong>{item.goals}</strong><span>Goals</span></div>
                          <div className="club-analytics-match-stat"><strong>{item.assists}</strong><span>Assists</span></div>
                          <div className="club-analytics-match-stat"><strong>{displayNumber(item.rating, 2)}</strong><span>Match Rating</span></div>
                          <div className="club-analytics-match-stat"><strong>{displayNumber(item.defensivePerformance, 2)}</strong><span>Defensive</span></div>
                        </article>
                      ))}
                    </div>
                  ) : <div className="club-analytics-empty">No Matchday appearances have been recorded for this player yet.</div>}
                  <p className="club-analytics-muted">Matchday is the source of truth for football results and player performances. This view never fills missing legacy values with zero.</p>
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
