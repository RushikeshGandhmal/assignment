import { beforeEach, describe, expect, it } from 'vitest';
import { users } from '../src/db/schema/users.js';
import { createTestDb } from './helpers/test-db.js';

type Db = ReturnType<typeof createTestDb>;

const baseUser = {
  id: 'usr_01',
  email: 'hr@example.com',
  passwordHash: '$2b$10$fakehashfortestingonly',
};

describe('users table', () => {
  let db: Db;

  beforeEach(() => {
    db = createTestDb();
  });

  it('stores a user and reads it back', () => {
    db.insert(users).values(baseUser).run();
    const rows = db.select().from(users).all();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject(baseUser);
    expect(rows[0]?.createdAt).toBeTypeOf('number');
  });

  it('enforces unique email across users', () => {
    db.insert(users).values(baseUser).run();
    expect(() =>
      db
        .insert(users)
        .values({ ...baseUser, id: 'usr_02' })
        .run(),
    ).toThrow(/UNIQUE/i);
  });

  it('rejects users without password_hash', () => {
    expect(() =>
      db
        .insert(users)
        // @ts-expect-error intentionally missing password_hash
        .values({ id: 'usr_03', email: 'other@example.com' })
        .run(),
    ).toThrow(/NOT NULL/i);
  });
});
