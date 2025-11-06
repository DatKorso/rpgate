import type { Database } from "@rpgate/database";
import { schema } from "@rpgate/database";
import { eq, and, desc, count, sql } from "drizzle-orm";

const { rooms, roomMembers, users } = schema;
type Room = typeof rooms.$inferSelect;
type NewRoom = typeof rooms.$inferInsert;
type RoomMember = typeof roomMembers.$inferSelect;
type NewRoomMember = typeof roomMembers.$inferInsert;

/**
 * Room repository for database operations
 */
export class RoomRepository {
  constructor(private db: Database) {}

  /**
   * Create a new room
   */
  async create(roomData: NewRoom): Promise<Room> {
    const [room] = await this.db.insert(rooms).values(roomData).returning();
    if (!room) {
      throw new Error("Failed to create room");
    }
    return room;
  }

  /**
   * Find room by ID
   */
  async findById(id: string): Promise<Room | null> {
    const [room] = await this.db.select().from(rooms).where(eq(rooms.id, id)).limit(1);

    return room || null;
  }

  /**
   * Find rooms by user ID (rooms where user is a member)
   */
  async findByUserId(userId: string): Promise<Room[]> {
    const userRooms = await this.db
      .select({
        id: rooms.id,
        name: rooms.name,
        description: rooms.description,
        createdBy: rooms.createdBy,
        isPrivate: rooms.isPrivate,
        inviteToken: rooms.inviteToken,
        inviteExpiresAt: rooms.inviteExpiresAt,
        settings: rooms.settings,
        lastActivityAt: rooms.lastActivityAt,
        createdAt: rooms.createdAt,
        updatedAt: rooms.updatedAt,
      })
      .from(rooms)
      .innerJoin(roomMembers, eq(rooms.id, roomMembers.roomId))
      .where(eq(roomMembers.userId, userId))
      .orderBy(desc(rooms.lastActivityAt));

    return userRooms;
  } /**

   * Find public rooms (paginated)
   */
  async findPublic(limit: number = 20, offset: number = 0): Promise<Room[]> {
    const publicRooms = await this.db
      .select()
      .from(rooms)
      .where(eq(rooms.isPrivate, false))
      .orderBy(desc(rooms.lastActivityAt))
      .limit(limit)
      .offset(offset);

    return publicRooms;
  }

  /**
   * Update room
   */
  async update(id: string, data: Partial<Room>): Promise<Room> {
    const [updatedRoom] = await this.db
      .update(rooms)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rooms.id, id))
      .returning();

    if (!updatedRoom) {
      throw new Error("Failed to update room");
    }
    return updatedRoom;
  }

  /**
   * Delete room
   */
  async delete(id: string): Promise<void> {
    await this.db.delete(rooms).where(eq(rooms.id, id));
  }

  /**
   * Add member to room
   */
  async addMember(
    roomId: string,
    userId: string,
    role: "owner" | "member" = "member",
  ): Promise<void> {
    const memberData: NewRoomMember = {
      roomId,
      userId,
      role,
      joinedAt: new Date(),
      lastSeenAt: new Date(),
    };

    await this.db.insert(roomMembers).values(memberData);
  }

  /**
   * Remove member from room
   */
  async removeMember(roomId: string, userId: string): Promise<void> {
    await this.db
      .delete(roomMembers)
      .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)));
  } /*
   *
   * Check if user is a member of the room
   */
  async isMember(roomId: string, userId: string): Promise<boolean> {
    const [member] = await this.db
      .select({ userId: roomMembers.userId })
      .from(roomMembers)
      .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
      .limit(1);

    return !!member;
  }

  /**
   * Check if user is the owner of the room
   */
  async isOwner(roomId: string, userId: string): Promise<boolean> {
    const [member] = await this.db
      .select({ role: roomMembers.role })
      .from(roomMembers)
      .where(
        and(
          eq(roomMembers.roomId, roomId),
          eq(roomMembers.userId, userId),
          eq(roomMembers.role, "owner"),
        ),
      )
      .limit(1);

    return !!member;
  }

  /**
   * Get member count for a room
   */
  async getMemberCount(roomId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(roomMembers)
      .where(eq(roomMembers.roomId, roomId));

    return result?.count || 0;
  }

  /**
   * Get last activity timestamp for a room
   */
  async getLastActivity(roomId: string): Promise<Date | null> {
    const [room] = await this.db
      .select({ lastActivityAt: rooms.lastActivityAt })
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);

    return room?.lastActivityAt || null;
  }

  /**
   * Update room's last activity timestamp
   */
  async updateLastActivity(roomId: string): Promise<void> {
    await this.db.update(rooms).set({ lastActivityAt: new Date() }).where(eq(rooms.id, roomId));
  }
  /**
   * Transfer room ownership to another member
   */
  async transferOwnership(
    roomId: string,
    currentOwnerId: string,
    newOwnerId: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Remove owner role from current owner
      await tx
        .update(roomMembers)
        .set({ role: "member" })
        .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, currentOwnerId)));

      // Set new owner
      await tx
        .update(roomMembers)
        .set({ role: "owner" })
        .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, newOwnerId)));
    });
  }

  /**
   * Get room members with their details
   */
  async getRoomMembers(roomId: string): Promise<Array<RoomMember & { username: string }>> {
    const members = await this.db
      .select({
        roomId: roomMembers.roomId,
        userId: roomMembers.userId,
        joinedAt: roomMembers.joinedAt,
        role: roomMembers.role,
        lastSeenAt: roomMembers.lastSeenAt,
        username: users.username,
      })
      .from(roomMembers)
      .innerJoin(users, eq(roomMembers.userId, users.id))
      .where(eq(roomMembers.roomId, roomId))
      .orderBy(desc(roomMembers.joinedAt));

    return members;
  }

  /**
   * Find next oldest member (for ownership transfer when owner leaves)
   */
  async findNextOldestMember(roomId: string, excludeUserId: string): Promise<string | null> {
    const [member] = await this.db
      .select({ userId: roomMembers.userId })
      .from(roomMembers)
      .where(and(eq(roomMembers.roomId, roomId), sql`${roomMembers.userId} != ${excludeUserId}`))
      .orderBy(roomMembers.joinedAt)
      .limit(1);

    return member?.userId || null;
  }
}
