import type { Database } from "@rpgate/database";
import { schema } from "@rpgate/database";
import { eq, or } from "drizzle-orm";

const { users } = schema;
type User = typeof users.$inferSelect;
type NewUser = typeof users.$inferInsert;

/**
 * User repository for database operations
 */
export class UserRepository {
  constructor(private db: Database) {}

  /**
   * Create a new user
   */
  async create(userData: NewUser): Promise<User> {
    const [user] = await this.db.insert(users).values(userData).returning();
    if (!user) {
      throw new Error("Failed to create user");
    }
    return user;
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    
    return user || null;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    return user || null;
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    
    return user || null;
  }

  /**
   * Check if username or email already exists
   */
  async existsByUsernameOrEmail(username: string, email: string): Promise<boolean> {
    const [existing] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.username, username), eq(users.email, email)))
      .limit(1);
    
    return !!existing;
  }

  /**
   * Update user's last activity timestamp
   */
  async updateLastActivity(id: string): Promise<void> {
    await this.db
      .update(users)
      .set({ updatedAt: new Date() })
      .where(eq(users.id, id));
  }
}