import { forbidden, type PrincipalLike, unauthenticated } from '@framework/http';
import type { Ability, Gate, Permission, RoleStore } from './types';

const ALL = '*';

const grants = (held: readonly string[], permission: string): boolean =>
  held.includes(ALL) || held.includes(permission);

/** Declares a rule about a specific thing. */
export function defineAbility<TSubject = void, TActor extends PrincipalLike = PrincipalLike>(
  name: string,
  check: Ability<TSubject, TActor>['check'],
): Ability<TSubject, TActor> {
  return { name, check };
}

export interface GateOptions {
  /** Roles the principal itself carries, such as a `role` column on the user row. */
  readonly rolesOf?: (actor: PrincipalLike) => readonly string[];
}

/**
 * The deny-by-default gate. A permission needs two things: a role that grants it,
 * and a principal whose own abilities allow it. So a token scoped to `orders.view`
 * can't use its owner's admin role, and a session, which holds `*`, gets what its
 * roles give. Holding `*` as a principal grants nothing by itself.
 *
 * An ability's name works the same way: a scoped token must hold that name before
 * its check runs, so a rule that only compares ownership can't be passed by a token
 * issued for something unrelated.
 *
 * A check that throws denies by throwing: it's a 500, never a pass.
 */
export class RoleGate implements Gate {
  /** Per principal object, which lives for one request, so a request reads its roles once. */
  readonly #held = new WeakMap<PrincipalLike, Promise<readonly string[]>>();

  constructor(
    private readonly store: RoleStore,
    private readonly options: GateOptions = {},
  ) {}

  #permissionsOf(actor: PrincipalLike): Promise<readonly string[]> {
    const cached = this.#held.get(actor);
    if (cached) return cached;
    const roles = this.options.rolesOf?.(actor) ?? [];
    const loaded = Promise.all([this.store.permissionsFor(actor.id), this.store.permissionsOfRoles(roles)]).then(
      ([assigned, carried]) => [...assigned, ...carried],
    );
    // A failed read isn't remembered as the answer.
    loaded.catch(() => this.#held.delete(actor));
    this.#held.set(actor, loaded);
    return loaded;
  }

  async #hasPermission(actor: PrincipalLike, permission: string): Promise<boolean> {
    if (!grants(actor.abilities, permission)) return false;
    return grants(await this.#permissionsOf(actor), permission);
  }

  async can<TSubject, TActor extends PrincipalLike>(
    actor: TActor | PrincipalLike | null | undefined,
    target: Permission | Ability<TSubject, TActor>,
    subject?: TSubject,
  ): Promise<boolean> {
    if (!actor) return false;
    if (typeof target === 'string') return this.#hasPermission(actor, target);
    if (!grants(actor.abilities, target.name)) return false;
    const allowed = await target.check({
      actor: actor as TActor,
      subject: subject as TSubject,
      can: (permission) => this.#hasPermission(actor, permission),
    });
    // Only a real `true` passes: a check that forgets to return must not.
    return allowed === true;
  }

  async authorize<TSubject, TActor extends PrincipalLike>(
    actor: TActor | PrincipalLike | null | undefined,
    target: Permission | Ability<TSubject, TActor>,
    subject?: TSubject,
  ): Promise<void> {
    if (!actor) throw unauthenticated();
    if (!(await this.can(actor, target, subject))) throw forbidden();
  }
}
