import { prepareMatch } from "../services/validation.js";
import { scheduleHistory } from "../services/history.js";
import { normalizeMatchScores } from "../services/statistics.js";
import Vote from "../models/Vote.js";
import express from "express";

import Match from "../models/Match.js";
import Player from "../models/Player.js";
import News from "../models/News.js";

import {
  requireAuth,
  requireEditor,
} from "../middleware/auth.js";

import {
  generateMatchNews,
} from "../services/aiNews.js";

const router = express.Router();

// ==================================================
// VALIDATION
// ==================================================

async function validateMatchData(body) {
  const {
    teamA,
    teamB,
    participants = [],
    events = [],
  } = body;

  if (!teamA || !teamB) {
    return "Both sides are required.";
  }

  const teamAScore = Number(teamA.score);
  const teamBScore = Number(teamB.score);

  if (
    !Number.isInteger(teamAScore) ||
    !Number.isInteger(teamBScore) ||
    teamAScore < 0 ||
    teamBScore < 0
  ) {
    return "Scores must be whole numbers 0 or higher.";
  }

  if (!Array.isArray(participants)) {
    return "Participants must be an array.";
  }

  if (!Array.isArray(events)) {
    return "Events must be an array.";
  }

  if (participants.length < 2) {
    return "At least two players must participate.";
  }

  const participantPlayerIds =
    participants.map((participant) =>
      String(participant.player)
    );

  const uniqueParticipantIds = [
    ...new Set(participantPlayerIds),
  ];

  if (
    participantPlayerIds.length !==
    uniqueParticipantIds.length
  ) {
    return "A player cannot appear on both sides in the same match.";
  }

  for (const participant of participants) {
    if (!["A", "B"].includes(participant.team)) {
      return "Every participant must belong to Side 1 or Side 2.";
    }
  }

  const validPlayers = await Player.find({
    _id: {
      $in: uniqueParticipantIds,
    },
  }).select("_id");

  if (
    validPlayers.length !==
    uniqueParticipantIds.length
  ) {
    return "One or more players do not exist.";
  }

  const participantTeams = new Map(
    participants.map((participant) => [
      String(participant.player),
      participant.team,
    ])
  );

  for (const event of events) {
    if (
      !participantTeams.has(
        String(event.player)
      )
    ) {
      return "Every event must belong to a participating player.";
    }

    if (
      !["goal", "assist"].includes(event.type)
    ) {
      return "Invalid event type.";
    }

    if (
      event.minute !== null &&
      event.minute !== undefined
    ) {
      const minute = Number(
        event.minute
      );

      if (
        !Number.isInteger(minute) ||
        minute < 0 ||
        minute > 150
      ) {
        return "Match minutes must be between 0 and 150.";
      }
    }
  }

  const teamAGoals = events.filter(
    (event) =>
      event.type === "goal" &&
      participantTeams.get(
        String(event.player)
      ) === "A"
  ).length;

  const teamBGoals = events.filter(
    (event) =>
      event.type === "goal" &&
      participantTeams.get(
        String(event.player)
      ) === "B"
  ).length;

  // IMPORTANT:
  // The entered score must match
  // actual goal events.

  if (teamAGoals !== teamAScore) {
    return `Side 1 score is ${teamAScore}, but ${teamAGoals} goal events were recorded.`;
  }

  if (teamBGoals !== teamBScore) {
    return `Side 2 score is ${teamBScore}, but ${teamBGoals} goal events were recorded.`;
  }

  const totalGoals =
    teamAGoals +
    teamBGoals;

  const totalAssists =
    events.filter(
      (event) =>
        event.type === "assist"
    ).length;

  if (totalAssists > totalGoals) {
    return "Total assists cannot be greater than total goals.";
  }

  return null;
}

// ==================================================
// POPULATE MATCH
// ==================================================

async function populateMatch(match) {
  return match.populate([
    {
      path:
        "participants.player",
      select:
        "name profileImage",
    },
    {
      path:
        "events.player",
      select:
        "name profileImage",
    },
  ]);
}

// ==================================================
// FALLBACK NEWS
// ==================================================

function createFallbackNews(match) {
  const teamA =
    match.teamA?.label ||
    "Side 1";

  const teamB =
    match.teamB?.label ||
    "Side 2";

  const scoreA =
    Number(
      match.teamA?.score || 0
    );

  const scoreB =
    Number(
      match.teamB?.score || 0
    );

  const goalEvents =
    (
      match.events || []
    ).filter(
      (event) =>
        event.type === "goal"
    );

  const scorerCounts = {};

  for (const event of goalEvents) {
    const playerName =
      event.player?.name ||
      "Unknown player";

    scorerCounts[playerName] =
      (
        scorerCounts[playerName] ||
        0
      ) + 1;
  }

  const scorers =
    Object.entries(
      scorerCounts
    ).sort(
      (a, b) =>
        b[1] - a[1]
    );

  const topScorer =
    scorers[0] || null;

  // DRAW
  if (scoreA === scoreB) {
    return {
      headline:
        `${match.name || "Football Match"} ends all square`,

      summary:
        `${teamA} and ${teamB} finished level at ${scoreA}-${scoreB}.`,

      body:
        `${teamA} and ${teamB} could not be separated as the match ended ${scoreA}-${scoreB}.`,

      icon:
        "🤝",
    };
  }

  // HAT-TRICK
  if (
    topScorer &&
    topScorer[1] >= 3
  ) {
    return {
      headline:
        `${topScorer[0]} hits a hat-trick`,

      summary:
        `${topScorer[0]} scored ${topScorer[1]} times in a standout performance.`,

      body:
        `${topScorer[0]} found the net ${topScorer[1]} times as ${teamA} and ${teamB} finished ${scoreA}-${scoreB}.`,

      icon:
        "🔥",
    };
  }

  // BRACE
  if (
    topScorer &&
    topScorer[1] === 2
  ) {
    return {
      headline:
        `${topScorer[0]} bags a brace`,

      summary:
        `${topScorer[0]} scored twice in ${match.name || "the match"}.`,

      body:
        `${topScorer[0]} found the net twice as the match finished ${scoreA}-${scoreB}.`,

      icon:
        "⚡",
    };
  }

  // NORMAL WIN
  const winner =
    scoreA > scoreB
      ? teamA
      : teamB;

  return {
    headline:
      `${winner} takes the win`,

    summary:
      `${winner} came out on top in ${match.name || "the match"}.`,

    body:
      `${winner} finished ahead ${scoreA}-${scoreB} in ${match.name || "the match"}.`,

    icon:
      "🏆",
  };
}

// ==================================================
// CREATE / UPGRADE NEWS
// ==================================================

async function createNewsForMatch(
  populatedMatch
) {
  try {
    const fallback =
      createFallbackNews(
        populatedMatch
      );

    const firstGoal =
      (
        populatedMatch.events ||
        []
      ).find(
        (event) =>
          event.type ===
          "goal"
      );

    // Create fallback immediately.
    const news =
      await News.create({
        type:
          "match",

        match:
          populatedMatch._id,

        featuredPlayer:
          firstGoal?.player ||
          null,

        headline:
          fallback.headline,

        summary:
          fallback.summary,

        body:
          fallback.body,

        icon:
          fallback.icon,

        tags: [
          "match",
          "football",
        ],

        generatedBy:
          "fallback",
      });

    console.log(
      "📰 Fallback news created"
    );

    /*
      IMPORTANT:
      Gemini runs in the background.
      It does NOT prevent the match
      or fallback article from appearing.
    */

    Promise.resolve()
      .then(async () => {
        try {
          const generated =
            await generateMatchNews(
              populatedMatch
            );

          if (
            generated.generatedBy ===
              "gemini" &&
            !generated.aiError
          ) {
            news.headline =
              generated.headline;

            news.summary =
              generated.summary;

            news.body =
              generated.body;

            news.icon =
              generated.icon ||
              "⚽";

            news.generatedBy =
              "gemini";

            await news.save();

            console.log(
              "🤖 News upgraded with Gemini"
            );
          } else {
            console.log(
              "ℹ️ Keeping fallback news"
            );
          }
        } catch (error) {
          console.error(
            "Gemini upgrade failed:",
            error.message
          );
        }
      });

    return news;
  } catch (error) {
    console.error(
      "News creation failed:",
      error.message
    );

    return null;
  }
}

// ==================================================
// GET ALL MATCHES
// PUBLIC
// ==================================================

router.get(
  "/",
  async (
    req,
    res
  ) => {
    try {
      const matches =
        await Match.find()
          .populate(
            "participants.player",
            "name profileImage"
          )
          .populate(
            "events.player",
            "name profileImage"
          )
          .sort({date:-1,createdAt:-1})
          .skip(Math.max(0,(Number(req.query.page)||1)-1)*Math.min(100,Math.max(1,Number(req.query.limit)||50)))
          .limit(Math.min(100,Math.max(1,Number(req.query.limit)||50)));
      matches.forEach(normalizeMatchScores);

      res.json(
        matches
      );
    } catch (error) {
      console.error(
        "Error fetching matches:",
        error
      );

      res.status(
        500
      ).json({
        message:
          "Failed to fetch matches.",
      });
    }
  }
);

// ==================================================
// CREATE MATCH
// EDITOR / ADMIN ONLY
// ==================================================

router.post(
  "/",
  requireAuth,
  requireEditor,
  async (
    req,
    res
  ) => {
    try {
      try { prepareMatch(req.body); } catch (error) { return res.status(400).json({ message: error.message }); }
      const validationError =
        await validateMatchData(
          req.body
        );

      if (validationError) {
        return res
          .status(
            400
          )
          .json({
            message:
              validationError,
          });
      }

      const {
        date,
        name,
        teamA,
        teamB,
        participants,
        events,
      } = req.body;

      const match =
        await Match.create({
          date: date
            ? new Date(
                `${date}T12:00:00.000Z`
              )
            : new Date(),

          name:
            name?.trim() ||
            "Football Match",

          teamA: {
            label:
              teamA.label?.trim() ||
              "Team A",

            score:
              Number(
                teamA.score
              ),
          },

          teamB: {
            label:
              teamB.label?.trim() ||
              "Team B",

            score:
              Number(
                teamB.score
              ),
          },

          participants,
          events,
        });

      const populatedMatch =
        await populateMatch(
          match
        );

      // Match is saved.
      // Fallback news is saved.
      // Gemini upgrade starts
      // in the background.
      const news =
        await createNewsForMatch(
          populatedMatch
        );

      scheduleHistory();
      res.status(
        201
      ).json({
        match:
          populatedMatch,

        newsCreated:
          Boolean(news),
      });
    } catch (error) {
      console.error(
        "Error creating match:",
        error
      );

      res.status(
        500
      ).json({
        message:
          "Failed to create match.",
      });
    }
  }
);

// ==================================================
// EDIT MATCH
// EDITOR / ADMIN ONLY
// ==================================================

router.put(
  "/:id",
  requireAuth,
  requireEditor,
  async (
    req,
    res
  ) => {
    try {
      const previous = await Match.findById(req.params.id);
      if (!previous) return res.status(404).json({message:"Match not found."});
      if (await Vote.exists({match:previous._id})) return res.status(409).json({message:"Matches with votes are locked to preserve final votes and recognition."});
      try { prepareMatch(req.body, previous); } catch (error) { return res.status(400).json({ message: error.message }); }
      const validationError =
        await validateMatchData(
          req.body
        );

      if (validationError) {
        return res
          .status(
            400
          )
          .json({
            message:
              validationError,
          });
      }

      const match =
        await Match.findById(
          req.params.id
        );

      if (!match) {
        return res
          .status(
            404
          )
          .json({
            message:
              "Match not found.",
          });
      }

      const {
        date,
        name,
        teamA,
        teamB,
        participants,
        events,
      } = req.body;

      match.date =
        date
          ? new Date(
              `${date}T12:00:00.000Z`
            )
          : match.date;

      match.name =
        name?.trim() ||
        "Football Match";

      match.teamA = {
        label:
          teamA.label?.trim() ||
          "Team A",

        score:
          Number(
            teamA.score
          ),
      };

      match.teamB = {
        label:
          teamB.label?.trim() ||
          "Team B",

        score:
          Number(
            teamB.score
          ),
      };

      match.participants =
        participants;

      match.events =
        events;

      await match.save();

      // Remove old generated article.
      await News.deleteMany({
        match:
          match._id,
      });

      const populatedMatch =
        await populateMatch(
          match
        );

      const news =
        await createNewsForMatch(
          populatedMatch
        );

      scheduleHistory();
      res.json({
        match:
          populatedMatch,

        newsCreated:
          Boolean(news),
      });
    } catch (error) {
      console.error(
        "Error updating match:",
        error
      );

      res.status(
        500
      ).json({
        message:
          "Failed to update match.",
      });
    }
  }
);

// ==================================================
// DELETE MATCH
// EDITOR / ADMIN ONLY
// ==================================================

router.delete(
  "/:id",
  requireAuth,
  requireEditor,
  async (
    req,
    res
  ) => {
    try {
      if (await Vote.exists({match:req.params.id})) return res.status(409).json({message:"Matches with votes cannot be deleted."});
      const match =
        await Match.findByIdAndDelete(
          req.params.id
        );

      if (!match) {
        return res
          .status(
            404
          )
          .json({
            message:
              "Match not found.",
          });
      }

      // Remove news tied to this match.
      await News.deleteMany({
        match:
          match._id,
      });

      scheduleHistory();
      res.json({
        message:
          "Match deleted.",
      });
    } catch (error) {
      console.error(
        "Error deleting match:",
        error
      );

      res.status(
        500
      ).json({
        message:
          "Failed to delete match.",
      });
    }
  }
);

export default router;