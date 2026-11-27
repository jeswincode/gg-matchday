import { createHash } from 'node:crypto';
import {
  AccessError,
  CommunityStore,
  RequestConflict,
  isDuplicateKey,
} from './community-store.ts';
import type { Account } from './community-store.ts';
import type { MatchInput } from '../contracts/match.ts';
import { InputError } from '../contracts/identity.ts';
import { rateMatch } from '../football/community-rating.ts';

type Match = MatchInput & {
  _id: string;
  communityId: string;
  submittedBy: string;
  createdAt: Date;
  status: 'submitted' | 'official' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: Date;
  digest: string;
  ratings?: ReturnType<typeof rateMatch>;
  motm?: { winners: string[]; votes: number; closedAt: Date };
  voteVersion?: number;
};
const reviewers = new Set(['owner', 'admin', 'staff', 'captain']);

function display(match: Match) {
  const { _id, date, home, away, homeScore, awayScore, performances, status } =
    match;
  return {
    id: _id,
    date,
    home,
    away,
    homeScore,
    awayScore,
    performances,
    ratings: match.ratings ?? [],
    motm: match.motm ?? null,
    status,
  };
}
export class MatchService {
  constructor(privateStore: CommunityStore) {
    this.store = privateStore;
  }
  private readonly store: CommunityStore;

  async submit(
    account: Account,
    communityId: string,
    input: MatchInput,
    key: string,
  ) {
    const id = createHash('sha256')
      .update([communityId, account._id, key].join('/'))
      .digest('hex');
    const digest = createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex');
    const save = () =>
      this.store.within(
        account,
        communityId,
        null,
        async (db, session, member) => {
          const matches = db.collection<Match>('matches');
          const existing = await matches.findOne(
            { _id: id, communityId },
            { session },
          );
          if (existing) {
            if (existing.digest !== digest) throw new RequestConflict();
            return display(existing);
          }
          if (input.performances) {
            const ids = input.performances.map((p) => p.playerId);
            const found = await db
              .collection<{
                _id: string;
                communityId: string;
              }>('communityPlayers')
              .countDocuments({ communityId, _id: { $in: ids } }, { session });
            if (found !== ids.length)
              throw new InputError('Choose players from this community.');
          }
          const now = new Date();
          const official = reviewers.has(member.role);
          const match: Match = {
            ...input,
            _id: id,
            digest,
            communityId,
            createdAt: now,
            submittedBy: account._id,
            status: official ? 'official' : 'submitted',
            ...(official
              ? {
                  reviewedBy: account._id,
                  reviewedAt: now,
                  ratings: rateMatch(input),
                }
              : {}),
          };
          await matches.insertOne(match, { session });
          await db.collection('matchAudit').insertOne(
            {
              communityId,
              matchId: id,
              actor: account._id,
              action: match.status,
              at: now,
            },
            { session },
          );
          return display(match);
        },
      );
    try {
      return await save();
    } catch (error) {
      if (!isDuplicateKey(error))
        throw error;
      return save();
    }
  }

  async review(
    account: Account,
    communityId: string,
    id: string,
    approve: boolean,
  ) {
    return this.store.within(
      account,
      communityId,
      ['owner', 'admin', 'staff', 'captain'],
      async (db, session) => {
        const matches = db.collection<Match>('matches');
        const match = await matches.findOne(
          { _id: id, communityId },
          { session },
        );
        if (!match) throw new AccessError();
        const status = approve ? 'official' : 'rejected';
        if (match.status === status) return display(match);
        if (match.status !== 'submitted') throw new RequestConflict();
        const at = new Date();
        const ratings = approve ? rateMatch(match) : [];
        await matches.updateOne(
          { _id: id, communityId, status: 'submitted' },
          {
            $set: { status, reviewedAt: at, reviewedBy: account._id, ratings },
          },
          { session },
        );
        await db.collection('matchAudit').insertOne(
          {
            communityId,
            matchId: id,
            actor: account._id,
            action: status,
            at,
          },
          { session },
        );
        return display({ ...match, status, ratings });
      },
    );
  }

  async list(account: Account, communityId: string, cursor?: string) {
    const boundary = cursor?.match(/^(\d{13})\.([a-f0-9]{64})$/);
    if (cursor && !boundary) throw new InputError('Invalid match cursor.');
    return this.store.within(
      account,
      communityId,
      null,
      async (db, session, member) => {
        const conditions = [];
        if (!reviewers.has(member.role))
          conditions.push({
            $or: [
              { status: 'official' as const },
              { submittedBy: account._id },
            ],
          });
        if (boundary) {
          const time = new Date(Number(boundary[1]));
          conditions.push({
            $or: [
              { createdAt: { $lt: time } },
              { createdAt: time, _id: { $lt: boundary[2] } },
            ],
          });
        }
        const rows = await db
          .collection<Match>('matches')
          .find(
            { communityId, ...(conditions.length ? { $and: conditions } : {}) },
            { session },
          )
          .sort({ createdAt: -1, _id: -1 })
          .limit(26)
          .toArray();
        const page = rows.slice(0, 25),
          last = page.at(-1);
        return {
          items: page.map(display),
          next:
            rows.length > 25 && last
              ? last.createdAt.getTime() + '.' + last._id
              : null,
        };
      },
    );
  }
}
