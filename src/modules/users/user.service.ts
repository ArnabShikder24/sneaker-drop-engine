import { User } from '../../db/models/index';

/**
 * Finds an existing user by username or creates one if they don't exist.
 * This is the minimal "auth" required by the assessment — no passwords,
 * no JWT — just enough to attribute purchases to a named identity.
 *
 * In a real system, replace with a proper auth system.
 */
export async function findOrCreateUser(
  username: string,
): Promise<{ user: User; created: boolean }> {
  const [user, created] = await User.findOrCreate({
    where: { username: username.trim().toLowerCase() },
    defaults: { username: username.trim().toLowerCase() },
  });
  return { user, created };
}

/**
 * Finds a user by ID. Throws if not found.
 */
export async function getUserById(userId: number): Promise<User> {
  const user = await User.findByPk(userId);
  if (!user) throw new Error(`User ${userId} not found.`);
  return user;
}
