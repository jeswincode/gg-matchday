import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { ClientSession, Db, MongoClient } from 'mongodb';
import type { ProfilePatch } from '../contracts/identity.ts';
import type { CommunityBrand } from '../branding/identity.ts';
import { foundingBrand } from '../branding/identity.ts';

export type Account = { _id: string; firebaseUid: string; globalPlayerId: string };
type Profile = { _id: string; customizedName?: true; seededPlayerId?: string } & ProfilePatch;
type Community = { _id: string; storageLocation: string; brand: CommunityBrand; visibility: 'private' };
type Member = {
  communityId: string;
  accountId: string;
  role: 'owner' | 'admin' | 'staff' | 'captain' | 'member';
  legacyPlayerId?: string;
  administrator?: true;
  admitted?: true;
};
type Player = { _id: string; communityId: string; globalPlayerId?: string; localName?: string };
type Invitation = { _id: string; communityId: string; expiresAt: Date; guestId?: string; recipient?: string; usedBy?: string; revokedAt?: Date };
type JoinRequest = { _id: string; communityId: string; accountId: string; status: 'pending' | 'approved' | 'declined'; requestedAt: Date; decidedAt?: Date };
export const foundingCommunityId = createHash('sha256').update('ballers/founding-community/gg-matchday').digest('hex');
const managers: Member['role'][] = ['owner', 'admin'];

export class AccessError extends Error {}
export class RequestConflict extends Error {}

type Collections = Pick<Db, 'collection'>;
export interface StorageLocation { client: MongoClient; db: Collections }

export function isDuplicateKey(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

export class CommunityStore {
  private readonly control: StorageLocation;
  private readonly locations: ReadonlyMap<string, StorageLocation>;
  private readonly initialLocation: string;

  constructor(control: StorageLocation, locations: ReadonlyMap<string, StorageLocation>, initialLocation: string) {
    this.control = control;
    this.locations = locations;
    this.initialLocation = initialLocation;
    if (locations.get(initialLocation)?.client !== control.client) {
      throw new Error('Initial provisioning requires the registry and initial location on one MongoClient.');
    }
  }

  async initialize() {
    const db = this.control.db;
    await Promise.all([
      db.collection<Account>('accounts').createIndex({ firebaseUid: 1 }, { unique: true }),
      db.collection<Account>('accounts').createIndex({ globalPlayerId: 1 }, { unique: true }),
      db.collection<Profile>('globalPlayers').createIndex({ username: 1 }, { unique: true, partialFilterExpression: { username: { $type: 'string' } } }),
      ...Array.from(this.locations.values()).flatMap(({ db: tenantDb }) => [
        tenantDb.collection<Member>('memberships').createIndex({ communityId: 1, accountId: 1 }, { unique: true }),
        tenantDb.collection<Member>('memberships').createIndex({ accountId: 1, communityId: 1 }),
        tenantDb.collection<Member>('memberships').createIndex({ communityId: 1, legacyPlayerId: 1 }, {
          unique: true, partialFilterExpression: { legacyPlayerId: { $type: 'string' } },
        }),
        tenantDb.collection<JoinRequest>('joinRequests').createIndex({ communityId: 1, status: 1, requestedAt: 1, _id: 1 }),
        tenantDb.collection<Player>('communityPlayers').createIndex({ communityId: 1, globalPlayerId: 1 }, { unique: true, partialFilterExpression: { globalPlayerId: { $type: 'string' } } }),
        tenantDb.collection<Invitation>('invitations').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        tenantDb.collection<Invitation>('invitations').createIndex({ communityId: 1, _id: 1 }),
        tenantDb.collection('matches').createIndex({ communityId: 1, createdAt: -1, _id: -1 }),
        tenantDb.collection('matches').createIndex({ communityId: 1, status: 1, date: 1 }),
        tenantDb.collection('matches').createIndex({ communityId: 1, status: 1, 'ratings.playerId': 1 }),
        tenantDb.collection('motmVotes').createIndex({ communityId: 1, matchId: 1, accountId: 1 }, { unique: true }),
        tenantDb.collection('matches').createIndex({ communityId: 1, status: 1, 'performances.playerId': 1 }),
      ]),
    ]);
    await db.collection<Community>('communities').updateOne({ _id: foundingCommunityId }, {
      $setOnInsert: { storageLocation: this.initialLocation, brand: foundingBrand, visibility: 'private' },
    }, { upsert: true });
  }

  async account(firebaseUid: string, initialProfile: ProfilePatch = {}): Promise<Account> {
    const { client, db } = this.control;
    const accounts = db.collection<Account>('accounts');
    const existing = await accounts.findOne({ firebaseUid });
    if (existing) return existing;
    const account = { _id: randomUUID(), firebaseUid, globalPlayerId: randomUUID() };
    try {
      await client.withSession(session => session.withTransaction(async () => {
        await accounts.insertOne(account, { session });
        await db.collection<Profile>('globalPlayers').insertOne({ _id: account.globalPlayerId, ...initialProfile }, { session });
      }));
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      const concurrent = await accounts.findOne({ firebaseUid });
      if (!concurrent) throw error;
      return concurrent;
    }
    return account;
  }

  async profile(account: Account) {
    return this.control.db.collection<Profile>('globalPlayers').findOne({ _id: account.globalPlayerId });
  }

  async accountBySubject(firebaseUid: string) {
    return this.control.db.collection<Account>('accounts').findOne({ firebaseUid });
  }

  async foundingMembership(account: Account) {
    const { location } = await this.locate(foundingCommunityId);
    return location.db.collection<Member>('memberships').findOne({ communityId: foundingCommunityId, accountId: account._id });
  }

  async syncFounding(account: Account, legacyPlayerId: string | null, admin: boolean) {
    const { location } = await this.locate(foundingCommunityId);
    const members = location.db.collection<Member>('memberships');
    const filter = { communityId: foundingCommunityId, accountId: account._id };
    if (!legacyPlayerId && !admin) {
      await members.deleteOne({ ...filter, admitted: { $ne: true }, $or: [{ legacyPlayerId: { $exists: true } }, { administrator: true }] });
      await members.updateOne({ ...filter, admitted: true, administrator: true }, {
        $set: { role: 'member' }, $unset: { administrator: '' },
      });
      return;
    }
    await location.client.withSession(session => session.withTransaction(async () => {
      const players = location.db.collection<Player>('communityPlayers');
      const existing = await members.findOne(filter, { session });
      if (admin) {
        if (existing?.role !== 'admin') await members.updateOne(filter, {
          $set: { role: 'admin', administrator: true },
        }, { upsert: true, session });
        return;
      }
      if (existing?.legacyPlayerId === legacyPlayerId && existing.role === 'member') return;
      if (existing?.legacyPlayerId && existing.legacyPlayerId !== legacyPlayerId) throw new RequestConflict();
      const legacyPlayer = await players.findOne({ _id: legacyPlayerId!, communityId: foundingCommunityId }, { session });
      if (legacyPlayer?.globalPlayerId && legacyPlayer.globalPlayerId !== account.globalPlayerId) throw new RequestConflict();
      await players.updateOne({ _id: legacyPlayerId!, communityId: foundingCommunityId }, {
        $setOnInsert: { globalPlayerId: account.globalPlayerId },
      }, { upsert: true, session });
      await members.updateOne(filter, {
        $set: { legacyPlayerId: legacyPlayerId!, role: 'member' },
        $unset: { administrator: '' },
      }, { upsert: true, session });
    }));
  }

  async seedLinkedName(account: Account, playerId: string, displayName: string) {
    await this.control.db.collection<Profile>('globalPlayers').updateOne({
      _id: account.globalPlayerId, customizedName: { $ne: true }, seededPlayerId: { $exists: false },
    }, { $set: { displayName, seededPlayerId: playerId } });
  }

  async updateProfile(account: Account, patch: ProfilePatch, session?: ClientSession) {
    return this.control.db.collection<Profile>('globalPlayers').findOneAndUpdate(
      { _id: account.globalPlayerId }, { $set: { ...patch, ...(patch.displayName ? { customizedName: true } : {}) } },
      { returnDocument: 'after', session },
    );
  }

  async createCommunity(account: Account, brand: Community['brand'], requestKey: string) {
    const id = createHash('sha256').update(account._id + '/' + requestKey).digest('hex');
    const location = this.locations.get(this.initialLocation)!;
    const communities = this.control.db.collection<Community>('communities');
    const community: Community = { _id: id, storageLocation: this.initialLocation, brand, visibility: 'private' };
    const member: Member = { communityId: id, accountId: account._id, role: 'owner' };
    const player: Player = { _id: randomUUID(), communityId: id, globalPlayerId: account.globalPlayerId };
    try {
      await this.control.client.withSession(session => session.withTransaction(async () => {
        await communities.insertOne(community, { session });
        await location.db.collection<Member>('memberships').insertOne(member, { session });
        await location.db.collection<Player>('communityPlayers').insertOne(player, { session });
        await this.control.db.collection<{ _id: string; originalName: string }>('communityCreationRequests')
          .insertOne({ _id: id, originalName: brand.name }, { session });
      }));
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      const receipt = await this.control.db.collection<{ _id: string; originalName: string }>('communityCreationRequests').findOne({ _id: id });
      if (!receipt || receipt.originalName !== brand.name) throw new RequestConflict();
      return this.openCommunity(account, id);
    }
    return { id, brand, visibility: community.visibility, role: member.role, playerId: player._id };
  }

  private async locate(communityId: string) {
    const community = await this.control.db.collection<Community>('communities').findOne({ _id: communityId });
    if (!community) throw new AccessError();
    const location = this.locations.get(community.storageLocation);
    if (!location) throw new Error('Community storage is unavailable.');
    return { community, location };
  }

  async openCommunity(account: Account, communityId: string) {
    const { community, location } = await this.locate(communityId);
    const member = await location.db.collection<Member>('memberships').findOne({ communityId, accountId: account._id });
    if (!member) throw new AccessError();
    const player = await location.db.collection<Player>('communityPlayers').findOne({ communityId, globalPlayerId: account.globalPlayerId });
    const settings = await location.db.collection<{ _id: string; communityId: string; brand: CommunityBrand }>('settings').findOne({ _id: communityId, communityId });
    return { id: communityId, brand: settings?.brand ?? community.brand, visibility: community.visibility, role: member.role, playerId: player?._id ?? null };
  }

  async directory(account: Account, after: string) {
    const pages = await Promise.all(Array.from(this.locations.values(), ({ db }) =>
      db.collection<Member>('memberships').find({ accountId: account._id, communityId: { $gt: after } })
        .sort({ communityId: 1 }).limit(26).project<{ communityId: string }>({ communityId: 1 }).toArray()));
    const ids = [...new Set(pages.flat().map(row => row.communityId))].sort();
    const entries = await Promise.all(ids.slice(0, 25).map(async id => {
      try { return await this.openCommunity(account, id); }
      catch (error) { if (error instanceof AccessError) return null; throw error; }
    }));
    return { items: entries.filter(Boolean), next: ids.length > 25 ? ids[24] : null };
  }

  async within<T>(account: Account, communityId: string, roles: Member['role'][] | null,
    operation: (db: Collections, session: ClientSession, member: Member) => Promise<T>): Promise<T> {
    const { location } = await this.locate(communityId);
    return location.client.withSession(session => session.withTransaction(async () => {
      const member = await location.db.collection<Member>('memberships').findOne({ communityId, accountId: account._id }, { session });
      if (!member || (roles && !roles.includes(member.role))) throw new AccessError();
      return operation(location.db, session, member);
    }, { readConcern: { level: 'snapshot' } }));
  }

  async askToJoin(account: Account, communityId: string) {
    const { community, location } = await this.locate(communityId);
    const _id = createHash('sha256').update(communityId + '/' + account._id).digest('hex');
    return location.client.withSession(session => session.withTransaction(async () => {
      const member = await location.db.collection<Member>('memberships').findOne({ communityId, accountId: account._id }, { session });
      if (member) return { name: community.brand.name, status: 'approved' };
      const item = await location.db.collection<JoinRequest>('joinRequests').findOneAndUpdate({ _id, communityId }, {
        $setOnInsert: { communityId, accountId: account._id, status: 'pending', requestedAt: new Date() },
      }, { upsert: true, returnDocument: 'after', session });
      return { name: community.brand.name, status: item!.status };
    }));
  }

  async joinRequests(account: Account, communityId: string) {
    return this.within(account, communityId, managers, async (db, session) => {
      const rows = await db.collection<JoinRequest>('joinRequests').find({ communityId, status: 'pending' }, { session })
        .sort({ requestedAt: 1, _id: 1 }).limit(50).toArray();
      const accounts = await this.control.db.collection<Account>('accounts').find({ _id: { $in: rows.map(row => row.accountId) } }, { session }).toArray();
      const profiles = await this.control.db.collection<Profile>('globalPlayers').find({ _id: { $in: accounts.map(row => row.globalPlayerId) } }, { session }).toArray();
      const names = new Map(profiles.map(profile => [profile._id, profile.displayName || profile.username || 'Player']));
      const playerIds = new Map(accounts.map(profile => [profile._id, profile.globalPlayerId]));
      return rows.map(row => ({ id: row._id, name: names.get(playerIds.get(row.accountId) ?? '') ?? 'Player', requestedAt: row.requestedAt }));
    });
  }

  async decideJoinRequest(account: Account, communityId: string, requestId: string, approve: boolean) {
    return this.within(account, communityId, managers, async (db, session) => {
      const requests = db.collection<JoinRequest>('joinRequests');
      const request = await requests.findOne({ _id: requestId, communityId }, { session });
      if (!request) throw new AccessError();
      const status = approve ? 'approved' : 'declined';
      if (request.status === status) return { status };
      if (request.status !== 'pending') throw new RequestConflict();
      if (approve) {
        const target = await this.control.db.collection<Account>('accounts').findOne({ _id: request.accountId }, { session });
        if (!target) throw new AccessError();
        await this.addMember(db, session, target, communityId);
      }
      await requests.updateOne({ _id: requestId, communityId, status: 'pending' }, {
        $set: { status, decidedAt: new Date() },
      }, { session });
      return { status };
    });
  }

  private async addMember(db: Collections, session: ClientSession, account: Account, communityId: string) {
    await db.collection<Member>('memberships').updateOne({ communityId, accountId: account._id }, {
      $setOnInsert: { role: 'member' }, $set: { admitted: true },
    }, { session, upsert: true });
    if (communityId !== foundingCommunityId) {
      await db.collection<Player>('communityPlayers').updateOne({ communityId, globalPlayerId: account.globalPlayerId }, {
        $setOnInsert: { _id: randomUUID() },
      }, { session, upsert: true });
    }
  }

  async roster(account: Account, communityId: string, after: string) {
    return this.within(account, communityId, null, async (db, session) => {
      const rows = await db.collection<Player>('communityPlayers').find({ communityId, _id: { $gt: after } }, { session }).sort({ _id: 1 }).limit(51).toArray();
      const page = rows.slice(0, 50);
      const profiles = await this.control.db.collection<Profile>('globalPlayers').find({ _id: { $in: page.flatMap(p => p.globalPlayerId ? [p.globalPlayerId] : []) } })
        .project<Profile>({ displayName: 1, username: 1 }).toArray();
      const names = new Map(profiles.map(p => [p._id, p.displayName || p.username]));
      const accounts = await this.control.db.collection<Account>('accounts').find({ globalPlayerId: { $in: profiles.map(p => p._id) } }).project<Account>({ globalPlayerId: 1 }).toArray();
      const members = await db.collection<Member>('memberships').find({ communityId, accountId: { $in: accounts.map(a => a._id) } }, { session }).toArray();
      const roles = new Map(members.map(m => [m.accountId, m.role]));
      const playerRoles = new Map(accounts.map(a => [a.globalPlayerId, roles.get(a._id)]));
      return { items: page.map(p => ({ id: p._id, name: p.localName || names.get(p.globalPlayerId ?? '') || 'Player', guest: !p.globalPlayerId, role: p.globalPlayerId ? playerRoles.get(p.globalPlayerId) ?? null : null })), next: rows.length > 50 ? page[49]._id : null };
    });
  }

  async createGuest(account: Account, communityId: string, localName: string, key: string) {
    const { location } = await this.locate(communityId);
    const playerId = createHash('sha256').update([communityId, account._id, key].join('/')).digest('hex');
    return location.client.withSession(session => session.withTransaction(async () => {
      const permitted = await location.db.collection<Member>('memberships').findOne({
        communityId, accountId: account._id, role: { $in: ['owner', 'admin', 'staff'] },
      }, { session });
      if (!permitted) throw new AccessError();
      const players = location.db.collection<Player>('communityPlayers');
      const player = await players.findOneAndUpdate({ communityId, _id: playerId }, {
        $setOnInsert: { localName },
      }, { session, upsert: true, returnDocument: 'after' });
      if (player?.localName !== localName) throw new RequestConflict();
      return { id: playerId, localName };
    }));
  }

  async invite(account: Account, communityId: string, claim?: { guestId: string; recipientId: string }) {
    const { location } = await this.locate(communityId);
    const token = randomBytes(32).toString('base64url');
    const invitation: Invitation = {
      _id: createHash('sha256').update(token).digest('hex'), communityId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
    await location.client.withSession(session => session.withTransaction(async () => {
      const manager = await location.db.collection<Member>('memberships').findOne({
        communityId, accountId: account._id, role: { $in: ['owner', 'admin'] },
      }, { session });
      if (!manager) throw new AccessError();
      if (claim) {
        const guest = await location.db.collection<Player>('communityPlayers').findOne({
          _id: claim.guestId, communityId, globalPlayerId: { $exists: false },
        }, { session });
        if (!guest) throw new AccessError();
        const profile = await this.control.db.collection<Profile>('globalPlayers').findOne({ _id: claim.recipientId });
        if (!profile) throw new AccessError();
        invitation.guestId = guest._id;
        invitation.recipient = profile._id;
      }
      await location.db.collection<Invitation>('invitations').insertOne(invitation, { session });
      await location.db.collection('ownershipAudit').insertOne({
        communityId, actor: account._id, action: claim ? 'claim-authorized' : 'invitation-issued',
        guestId: invitation.guestId ?? null, recipient: invitation.recipient ?? null, at: new Date(),
      }, { session });
    }));
    return { token, expiresAt: invitation.expiresAt };
  }

  async redeem(account: Account, communityId: string, token: string) {
    const { location } = await this.locate(communityId);
    const digest = createHash('sha256').update(token).digest('hex');
    await location.client.withSession(session => session.withTransaction(async () => {
      const invitations = location.db.collection<Invitation>('invitations');
      const invitation = await invitations.findOne({ _id: digest, communityId, revokedAt: { $exists:false }, expiresAt: { $gt: new Date() } }, { session });
      if (!invitation || (invitation.recipient && invitation.recipient !== account.globalPlayerId)) throw new AccessError();
      if (invitation.usedBy) {
        if (invitation.usedBy !== account._id) throw new AccessError();
        return;
      }
      const players = location.db.collection<Player>('communityPlayers');
      const owned = await players.findOne({ communityId, globalPlayerId: account.globalPlayerId }, { session });
      if (invitation.guestId) {
        if (owned && owned._id !== invitation.guestId) throw new RequestConflict();
        const bound = await players.updateOne({ _id: invitation.guestId, communityId, globalPlayerId: { $exists: false } },
          { $set: { globalPlayerId: account.globalPlayerId } }, { session });
        if (bound.modifiedCount !== 1) throw new RequestConflict();
      }
      await this.addMember(location.db, session, account, communityId);
      await location.db.collection<JoinRequest>('joinRequests').updateOne({ communityId, accountId: account._id, status: 'pending' }, {
        $set: { status: 'approved', decidedAt: new Date() },
      }, { session });
      await invitations.updateOne({ _id: digest, communityId }, { $set: { usedBy: account._id } }, { session });
      await location.db.collection('ownershipAudit').insertOne({
        communityId, actor: account._id, action: invitation.guestId ? 'guest-claimed' : 'invitation-redeemed',
        playerId: invitation.guestId ?? null, at: new Date(),
      }, { session });
    }));
    return this.openCommunity(account, communityId);
  }
}
