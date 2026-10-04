import type {
  ApiTokenRecord,
  AttemptResult,
  AuthServiceDeps,
  IssuedToken,
  IssueTokenInput,
  PasswordHasher,
  Principal,
  RegisterInput,
  UserRecord,
} from './types';

/** First-attempt dummy hash so unknown emails cost the same as known ones. */
let dummyHash: Promise<string> | undefined;
const timingDummyVerify = (hasher: PasswordHasher, password: string): Promise<boolean> => {
  dummyHash ??= hasher.hash('timing-equalization-placeholder');
  return dummyHash.then((hash) => hasher.verify(password, hash));
};

/**
 * Authentication operations over the framework stores. `attempt` rotates
 * sessions on every login (a stolen pre-login cookie dies at login).
 */
export class AuthService {
  constructor(private readonly deps: AuthServiceDeps) {}

  async register(input: RegisterInput): Promise<UserRecord> {
    const passwordHash = await this.deps.hasher.hash(input.password);
    // Insert directly (provider lookups are read contracts); a duplicate
    // email raises SQLSTATE 23505, which the error handler maps to 409.
    return this.deps.users.create({ ...input, passwordHash });
  }

  async attempt(email: string, password: string): Promise<AttemptResult | null> {
    const user = await this.deps.users.findByEmail(email);
    const ok = user
      ? await this.deps.hasher.verify(password, user.passwordHash)
      : await timingDummyVerify(this.deps.hasher, password);
    if (!user || !ok) return null;
    const issued = await this.deps.sessions.create(user.id, this.deps.sessionTtlSeconds);
    return { user, sessionId: issued.session.id, sessionToken: issued.token };
  }

  async issueToken(user: Pick<UserRecord, 'id'>, input: IssueTokenInput): Promise<IssuedToken> {
    return this.deps.tokens.issue(
      user.id,
      input.name,
      input.abilities ?? ['*'],
      input.ttlSeconds === undefined ? this.deps.tokenTtlSeconds : input.ttlSeconds,
    );
  }

  async startSession(userId: string): Promise<{ sessionId: string; sessionToken: string }> {
    const issued = await this.deps.sessions.create(userId, this.deps.sessionTtlSeconds);
    return { sessionId: issued.session.id, sessionToken: issued.token };
  }

  async listTokens(userId: string): Promise<readonly ApiTokenRecord[]> {
    return this.deps.tokens.listForUser(userId);
  }

  async revokeToken(id: string, userId: string): Promise<boolean> {
    return this.deps.tokens.revoke(id, userId);
  }

  async logout(principal: Principal): Promise<boolean> {
    if (principal.via === 'session' && principal.sessionId) {
      return this.deps.sessions.revokeById(principal.sessionId);
    }
    if (principal.via === 'api-token' && principal.tokenId) {
      return this.deps.tokens.revoke(principal.tokenId, principal.id);
    }
    return false;
  }

  async revokeAllSessions(userId: string): Promise<number> {
    return this.deps.sessions.revokeAllForUser(userId);
  }

  async revokeAllTokens(userId: string): Promise<number> {
    return this.deps.tokens.revokeAllForUser(userId);
  }
}
