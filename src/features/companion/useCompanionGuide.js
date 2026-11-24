import useResource from "../../components/useResource";
import { useLiveRevision } from "../../lib/liveData";
import { clubDateKey, fixtureDateLabel } from "../clubs/clubPresentation";
import { clubNotes, clasicoNotes, rankingNotes } from "./companionGuide";

const clubTasks = new Set(["formation-accept", "formation-name", "captain-setup", "captain-vote",
  "match-respond", "auction-choose", "auction-approve", "join-request", "renewal"]);

export function useCompanionGuide(account, guide, onVote, onFixture) {
  const matchRevision = useLiveRevision("matchday");
  const clubRevision = useLiveRevision("clubs", "club-account");
  const linked = Boolean(account?.playerProfile);
  const atClubs = Boolean(account && guide?.workspace === "clubs");
  const atRankings = Boolean(account && !atClubs && guide?.tab === "leaderboard");
  const atClasico = Boolean(account && !atClubs && guide?.tab === "record" && guide?.recordSection === "clasico");
  const votes = useResource(linked ? "/matches/pending-votes" : null, matchRevision).data;
  const clubHome = useResource(linked ? "/clubs/home" : null, clubRevision).data;
  const rivalry = useResource(atClasico ? "/stats/clasico" : null, matchRevision).data;
  const trends = useResource(atRankings ? "/stats/companion-trends" : null, matchRevision).data;
  const needsPublicResults = atClubs && !clubHome?.recentMatches?.length;
  const publicClubs = useResource(needsPublicResults ? "/clubs" : null, clubRevision).data;
  const publicResults = useResource(needsPublicResults ? "/clubs/matches" : null, clubRevision).data;
  const publicResult = Array.isArray(publicResults) && publicResults.find(match => match.status === "completed");
  const clubId = clubHome?.currentClub?._id || publicResult?.winnerClubId || publicResult?.clubAId;
  const clubStats = useResource(atClubs && clubId ? "/clubs/" + clubId + "/stats" : null, clubRevision).data;

  const reminders = [];
  if (Array.isArray(votes)) for (const match of votes) {
    reminders.push({
      key: "vote:" + match._id,
      text: "Your Player of the Match vote is still open for " + match.name + ".",
      action: onVote && { label: "Open vote", run: () => onVote(match._id) },
    });
  }
  const today = clubDateKey();
  const fixture = [...(clubHome?.todayMatches || []), ...(clubHome?.upcomingMatches || [])]
    .find(match => match.status === "accepted" && match.source !== "unbooked" && match.fixtureDate >= today);
  if (fixture && clubHome?.currentClub) {
    const isHome = String(fixture.clubAId) === String(clubHome.currentClub._id);
    const opponent = isHome ? fixture.clubBName : fixture.clubAName;
    reminders.push({
      key: "fixture:" + fixture._id + ":" + fixture.fixtureDate,
      text: "Your club plays " + opponent + " on " + fixtureDateLabel(fixture) + ".",
      action: onFixture && { label: "View fixtures", run: onFixture },
    });
  }
  const pending = clubHome?.nextAction;
  if (atClubs && clubTasks.has(pending?.type) && pending.title) {
    reminders.push({ key: "club-task:" + pending.type + ":" + pending.title, text: pending.title + "." });
  }

  const context = atClubs ? "clubs" : atClasico ? "clasico" : guide?.tab;
  const notes = atClubs ? clubNotes(clubHome, publicClubs, publicResult, clubStats)
    : atClasico ? clasicoNotes(rivalry)
      : atRankings ? rankingNotes(trends, guide.leaderboard) : [];
  return { reminders, context, notes, pitch: !atClubs && guide?.tab === "players" && !guide.selectedPlayer };
}
