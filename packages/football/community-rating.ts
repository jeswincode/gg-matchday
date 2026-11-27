import { InputError, record } from '../contracts/identity.ts';
import type { MatchInput } from '../contracts/match.ts';

const weights = {
  goalkeeper: [0.1, 0.2, 0.7],
  defender: [0.15, 0.3, 0.55],
  midfielder: [0.25, 0.5, 0.25],
  forward: [0.55, 0.3, 0.15],
} as const;
export const ratingVersion = 'community-performance-v1';
export type Position = keyof typeof weights;
export interface Observations {
  position: Position;
  minutes: number;
  passesCompleted: number;
  passesAttempted: number;
  stops: number;
  opportunities: number;
}
export function parseObservations(raw: unknown): Observations {
  const data = record(raw);
  if (
    typeof data.position !== 'string' ||
    !Object.hasOwn(weights, data.position) ||
    Object.keys(data).some(
      (k) =>
        ![
          'position',
          'minutes',
          'passesCompleted',
          'passesAttempted',
          'stops',
          'opportunities',
        ].includes(k),
    )
  )
    throw new InputError(
      'Choose a playing position and supported observation fields.',
    );
  function integer(key: string, min: number, max: number) {
    const value = data[key];
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < min ||
      value > max
    )
      throw new InputError('Enter a whole number for every observed count.');
    return value;
  }
  const minutes = integer('minutes', 1, 180),
    passesAttempted = integer('passesAttempted', 0, 999),
    opportunities = integer('opportunities', 0, 999);
  return {
    position: data.position as Position,
    minutes,
    passesAttempted,
    opportunities,
    passesCompleted: integer('passesCompleted', 0, passesAttempted),
    stops: integer('stops', 0, opportunities),
  };
}

// The first version measures recorded contributions in a community's verified matches.
// A small number of measured opportunities is shrunk toward an even success rate.
function successRate(won: number, attempted: number) {
  return (won + 2) / (attempted + 4);
}
export function rateMatch(match: MatchInput) {
  return (match.performances ?? []).flatMap((player) => {
    const obs = player.observations;
    if (
      !obs ||
      player.assists == null ||
      !obs.passesAttempted ||
      !obs.opportunities
    )
      return [];
    const teamGoals =
      player.side === 'home' ? match.homeScore : match.awayScore;
    const involvement = (player.goals + player.assists + 1) / (teamGoals + 2);
    const [attack, passing, defending] = weights[obs.position];
    const measured =
      attack * involvement +
      passing * successRate(obs.passesCompleted, obs.passesAttempted) +
      defending * successRate(obs.stops, obs.opportunities);
    const exposure = Math.min(obs.minutes / 60, 1);
    const value = Math.max(
      1,
      Math.min(
        99,
        Math.round(
          50 +
            (measured - 0.5) * 98 * exposure -
            Math.min(player.ownGoals, 3) * 2,
        ),
      ),
    );
    return [
      {
        playerId: player.playerId,
        version: ratingVersion,
        value,
        minutes: obs.minutes,
        position: obs.position,
      },
    ];
  });
}
