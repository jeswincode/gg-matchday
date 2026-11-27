import { InputError, record, textField } from './identity.ts';
import {
  parseObservations,
  type Observations,
} from '../football/community-rating.ts';

export interface Performance {
  playerId: string;
  side: 'home' | 'away';
  goals: number;
  ownGoals: number;
  assists: number | null;
  observations?: Observations;
}
export interface MatchInput {
  date: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  performances: Performance[] | null;
}
function count(value: unknown) {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 99
  )
    throw new InputError(
      'Scores and counts must be whole numbers from 0 to 99.',
    );
  return value;
}
export function parseMatch(input: unknown): MatchInput {
  const data = record(input);
  if (
    Object.keys(data).some(
      (key) =>
        ![
          'date',
          'home',
          'away',
          'homeScore',
          'awayScore',
          'performances',
        ].includes(key),
    )
  )
    throw new InputError('Unsupported match field.');
  const date = textField(data.date, 10, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw new InputError('Choose a valid match date.');
  const home = textField(data.home, 1, 60),
    away = textField(data.away, 1, 60);
  if (home.toLowerCase() === away.toLowerCase())
    throw new InputError('Give the sides different names.');
  const homeScore = count(data.homeScore),
    awayScore = count(data.awayScore);
  let performances: Performance[] | null = null;
  if (data.performances != null) {
    if (
      !Array.isArray(data.performances) ||
      data.performances.length < 2 ||
      data.performances.length > 60
    )
      throw new InputError('Select both teams.');
    performances = data.performances.map((value) => {
      const p = record(value);
      if (
        Object.keys(p).some(
          (key) =>
            ![
              'playerId',
              'side',
              'goals',
              'ownGoals',
              'assists',
              'observations',
            ].includes(key),
        )
      )
        throw new InputError('Unsupported performance field.');
      if (p.side !== 'home' && p.side !== 'away')
        throw new InputError('Choose a side for each player.');
      return {
        playerId: textField(p.playerId, 1, 96),
        side: p.side,
        goals: count(p.goals),
        ownGoals: count(p.ownGoals),
        assists: p.assists == null ? null : count(p.assists),
        ...(p.observations == null
          ? {}
          : { observations: parseObservations(p.observations) }),
      };
    });
    if (
      new Set(performances.map((p) => p.playerId)).size !== performances.length
    )
      throw new InputError('Each player can appear once.');
    for (const side of ['home', 'away'] as const) {
      const team = performances.filter((p) => p.side === side);
      const goals = team.reduce((s, p) => s + p.goals, 0);
      const opponentOwnGoals = performances
        .filter((p) => p.side !== side)
        .reduce((s, p) => s + p.ownGoals, 0);
      if (
        !team.length ||
        goals + opponentOwnGoals !== (side === 'home' ? homeScore : awayScore)
      )
        throw new InputError(
          'Player goals and opposition own goals must match the team score.',
        );
      if (
        team.reduce((s, p) => s + (p.assists ?? 0), 0) > goals ||
        team.some((p) => (p.assists ?? 0) > goals - p.goals)
      )
        throw new InputError(
          'Assists must belong to goals scored by teammates.',
        );
    }
  }
  return { date, home, away, homeScore, awayScore, performances };
}
