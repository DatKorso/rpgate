import type { Database } from "@rpgate/database";
import { schema } from "@rpgate/database";
import type { FastifyBaseLogger } from "fastify";
import { RoomRepository } from "./room.repository.js";
import { InviteRepository } from "./invite.repository.js";
import type { Redis } from "ioredis";
import { createRoomSchema, type CreateRoomInput } from "@rpgate/shared";
import { randomUUID } from "node:crypto";

// Types from database schema
const { rooms } = schema;
type Room = typeof rooms.$inferSelect;
type NewRoom = typeof rooms.$inferInsert;

// Extended room type with proper settings typing
interface RoomWithSettings extends Omit<Room, "settings"> {
  settings: Record<string, any>;
}

// Service interfaces
interface CreateRoomData extends CreateRoomInput {
  settings?: Record<string, any>;
}

interface UpdateRoomData {
  name?: string;
  description?: string | null;
  maxMembers?: number;
  isPrivate?: boolean;
  settings?: Record<string, any>;
}

interface RoomWithStats extends RoomWithSettings {
  memberCount: number;
  isOwner: boolean;
  isMember: boolean;
}

interface PaginationOptions {
  limit?: number;
  offset?: number;
}

interface PaginatedRooms {
  rooms: RoomWithStats[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}

interface JoinRoomResult {
  joined: boolean;
}

// Error types
export class RoomError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = "RoomError";
  }
}

export const ROOM_ERRORS = {
  ROOM_NOT_FOUND: "ROOM_NOT_FOUND",
  ROOM_FULL: "ROOM_FULL",
  ALREADY_MEMBER: "ALREADY_MEMBER",
  NOT_MEMBER: "NOT_MEMBER",
  NOT_OWNER: "NOT_OWNER",
  INVALID_CAPACITY: "INVALID_CAPACITY",
  CANNOT_LEAVE_AS_OWNER: "CANNOT_LEAVE_AS_OWNER",
} as const;

/**
 * Room service for business logic operations
 */
export class RoomService {
  private roomRepository: RoomRepository;
  private inviteRepository: InviteRepository;
  private logger: FastifyBaseLogger;

  constructor(db: Database, redis: Redis, logger: FastifyBaseLogger) {
    this.roomRepository = new RoomRepository(db);
    this.inviteRepository = new InviteRepository(redis);
    this.logger = logger;
  }

  /**
   * Create a new room with owner assignment
   */
  async createRoom(userId: string, data: CreateRoomData): Promise<RoomWithSettings> {
    try {
      // Validate input
      const validatedData = createRoomSchema.parse(data);

      // Set default values
      const roomData: NewRoom = {
        id: randomUUID(),
        name: validatedData.name,
        description: validatedData.description || null,
        createdBy: userId,
        isPrivate: validatedData.isPrivate || false,
        maxMembers: data.maxMembers || 10, // Default max members
        settings: data.settings || {},
        lastActivityAt: new Date(),
      };

      // Create room
      const room = await this.roomRepository.create(roomData);

      // Add creator as owner
      await this.roomRepository.addMember(room.id, userId, "owner");

      this.logger.info(
        {
          roomId: room.id,
          userId,
          roomName: room.name,
        },
        "Room created successfully",
      );

      return {
        ...room,
        settings: room.settings as Record<string, any>,
      };
    } catch (error) {
      this.logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to create room",
      );

      if (error instanceof Error) {
        throw error;
      }
      throw new RoomError("Failed to create room", "CREATION_FAILED", 500);
    }
  } /**
 
  * Get room by ID with user context
   */
  async getRoomById(roomId: string, userId?: string): Promise<RoomWithStats | null> {
    try {
      const room = await this.roomRepository.findById(roomId);
      if (!room) {
        return null;
      }

      // Check if room is private and user is not a member
      if (room.isPrivate && userId) {
        const isMember = await this.roomRepository.isMember(roomId, userId);
        if (!isMember) {
          return null; // Hide private rooms from non-members
        }
      }

      const memberCount = await this.roomRepository.getMemberCount(roomId);
      const isOwner = userId ? await this.roomRepository.isOwner(roomId, userId) : false;
      const isMember = userId ? await this.roomRepository.isMember(roomId, userId) : false;

      return {
        ...room,
        settings: room.settings as Record<string, any>,
        memberCount,
        isOwner,
        isMember,
      };
    } catch (error) {
      this.logger.error(
        {
          roomId,
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to get room by ID",
      );

      throw new RoomError("Failed to get room", "FETCH_FAILED", 500);
    }
  }

  /**
   * Get user's rooms (where user is a member)
   */
  async getUserRooms(userId: string): Promise<RoomWithStats[]> {
    try {
      const rooms = await this.roomRepository.findByUserId(userId);

      const roomsWithStats: RoomWithStats[] = [];

      for (const room of rooms) {
        const memberCount = await this.roomRepository.getMemberCount(room.id);
        const isOwner = await this.roomRepository.isOwner(room.id, userId);

        roomsWithStats.push({
          ...room,
          settings: room.settings as Record<string, any>,
          memberCount,
          isOwner,
          isMember: true, // User is always a member of their own rooms
        });
      }

      return roomsWithStats;
    } catch (error) {
      this.logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to get user rooms",
      );

      throw new RoomError("Failed to get user rooms", "FETCH_FAILED", 500);
    }
  }

  /**
   * Get public rooms with pagination
   */
  async getPublicRooms(
    pagination: PaginationOptions = {},
    userId?: string,
  ): Promise<PaginatedRooms> {
    try {
      const limit = pagination.limit || 20;
      const offset = pagination.offset || 0;
      const page = Math.floor(offset / limit) + 1;

      const rooms = await this.roomRepository.findPublic(limit + 1, offset); // Get one extra to check hasNext
      const hasNext = rooms.length > limit;
      const actualRooms = hasNext ? rooms.slice(0, limit) : rooms;

      const roomsWithStats: RoomWithStats[] = [];

      for (const room of actualRooms) {
        const memberCount = await this.roomRepository.getMemberCount(room.id);
        const isOwner = userId ? await this.roomRepository.isOwner(room.id, userId) : false;
        const isMember = userId ? await this.roomRepository.isMember(room.id, userId) : false;

        roomsWithStats.push({
          ...room,
          settings: room.settings as Record<string, any>,
          memberCount,
          isOwner,
          isMember,
        });
      }

      return {
        rooms: roomsWithStats,
        total: actualRooms.length, // Note: This is not the total count, would need separate query
        page,
        limit,
        hasNext,
      };
    } catch (error) {
      this.logger.error(
        {
          pagination,
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to get public rooms",
      );

      throw new RoomError("Failed to get public rooms", "FETCH_FAILED", 500);
    }
  }

  /**
   * Join a room with capacity and permission checks
   */
  async joinRoom(roomId: string, userId: string): Promise<JoinRoomResult> {
    try {
      // Check if room exists
      const room = await this.roomRepository.findById(roomId);
      if (!room) {
        throw new RoomError("Room not found", ROOM_ERRORS.ROOM_NOT_FOUND, 404);
      }

      // Check if user is already a member
      const isMember = await this.roomRepository.isMember(roomId, userId);
      if (isMember) {
        await this.roomRepository.updateLastActivity(roomId);

        this.logger.debug(
          {
            roomId,
            userId,
            roomName: room.name,
          },
          "Join request ignored - user already a member",
        );

        return { joined: false };
      }

      // Check room capacity
      const memberCount = await this.roomRepository.getMemberCount(roomId);
      if (memberCount >= room.maxMembers) {
        throw new RoomError("Room is at maximum capacity", ROOM_ERRORS.ROOM_FULL, 400);
      }

      // Add user as member
      await this.roomRepository.addMember(roomId, userId, "member");

      // Update room activity
      await this.roomRepository.updateLastActivity(roomId);

      this.logger.info(
        {
          roomId,
          userId,
          roomName: room.name,
        },
        "User joined room successfully",
      );

      return { joined: true };
    } catch (error) {
      if (error instanceof RoomError) {
        throw error;
      }

      this.logger.error(
        {
          roomId,
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to join room",
      );

      throw new RoomError("Failed to join room", "JOIN_FAILED", 500);
    }
  }

  /**
   * Leave a room with ownership transfer handling
   */
  async leaveRoom(roomId: string, userId: string): Promise<void> {
    try {
      // Check if room exists
      const room = await this.roomRepository.findById(roomId);
      if (!room) {
        throw new RoomError("Room not found", ROOM_ERRORS.ROOM_NOT_FOUND, 404);
      }

      // Check if user is a member
      const isMember = await this.roomRepository.isMember(roomId, userId);
      if (!isMember) {
        throw new RoomError("User is not a member of this room", ROOM_ERRORS.NOT_MEMBER, 400);
      }

      // Check if user is the owner
      const isOwner = await this.roomRepository.isOwner(roomId, userId);

      if (isOwner) {
        // Find next oldest member for ownership transfer
        const nextOwner = await this.roomRepository.findNextOldestMember(roomId, userId);

        if (nextOwner) {
          // Transfer ownership before leaving
          await this.roomRepository.transferOwnership(roomId, userId, nextOwner);
          this.logger.info(
            {
              roomId,
              previousOwner: userId,
              newOwner: nextOwner,
            },
            "Room ownership transferred",
          );
        }
        // If no other members, room will be archived when owner leaves
      }

      // Remove user from room
      await this.roomRepository.removeMember(roomId, userId);

      // Check if room is now empty
      const remainingMembers = await this.roomRepository.getMemberCount(roomId);
      if (remainingMembers === 0) {
        // Archive the room (soft delete by updating settings)
        const currentSettings = room.settings as Record<string, any>;
        await this.roomRepository.update(roomId, {
          settings: { ...currentSettings, archived: true },
        });

        this.logger.info(
          {
            roomId,
            roomName: room.name,
          },
          "Room archived - no remaining members",
        );
      } else {
        // Update room activity
        await this.roomRepository.updateLastActivity(roomId);
      }

      this.logger.info(
        {
          roomId,
          userId,
          roomName: room.name,
          wasOwner: isOwner,
        },
        "User left room successfully",
      );
    } catch (error) {
      if (error instanceof RoomError) {
        throw error;
      }

      this.logger.error(
        {
          roomId,
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to leave room",
      );

      throw new RoomError("Failed to leave room", "LEAVE_FAILED", 500);
    }
  }
  /**
   * Update room with owner permission validation
   */
  async updateRoom(
    roomId: string,
    userId: string,
    data: UpdateRoomData,
  ): Promise<RoomWithSettings> {
    try {
      // Check if room exists
      const room = await this.roomRepository.findById(roomId);
      if (!room) {
        throw new RoomError("Room not found", ROOM_ERRORS.ROOM_NOT_FOUND, 404);
      }

      // Check if user is the owner
      const isOwner = await this.roomRepository.isOwner(roomId, userId);
      if (!isOwner) {
        throw new RoomError("Only room owner can update room settings", ROOM_ERRORS.NOT_OWNER, 403);
      }

      // Validate capacity changes
      if (data.maxMembers !== undefined) {
        const currentMemberCount = await this.roomRepository.getMemberCount(roomId);
        if (data.maxMembers < currentMemberCount) {
          throw new RoomError(
            `Cannot reduce capacity below current member count (${currentMemberCount})`,
            ROOM_ERRORS.INVALID_CAPACITY,
            400,
          );
        }
      }

      // Update room
      const updatedRoom = await this.roomRepository.update(roomId, {
        ...data,
        updatedAt: new Date(),
      });

      this.logger.info(
        {
          roomId,
          userId,
          updates: Object.keys(data),
        },
        "Room updated successfully",
      );

      return {
        ...updatedRoom,
        settings: updatedRoom.settings as Record<string, any>,
      };
    } catch (error) {
      if (error instanceof RoomError) {
        throw error;
      }

      this.logger.error(
        {
          roomId,
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to update room",
      );

      throw new RoomError("Failed to update room", "UPDATE_FAILED", 500);
    }
  }

  /**
   * Delete room with owner permission validation
   */
  async deleteRoom(roomId: string, userId: string): Promise<void> {
    try {
      // Check if room exists
      const room = await this.roomRepository.findById(roomId);
      if (!room) {
        throw new RoomError("Room not found", ROOM_ERRORS.ROOM_NOT_FOUND, 404);
      }

      // Check if user is the owner
      const isOwner = await this.roomRepository.isOwner(roomId, userId);
      if (!isOwner) {
        throw new RoomError("Only room owner can delete the room", ROOM_ERRORS.NOT_OWNER, 403);
      }

      // Revoke all invite tokens for the room
      await this.inviteRepository.revokeAllRoomInvites(roomId);

      // Delete the room (this will cascade delete members due to foreign key constraints)
      await this.roomRepository.delete(roomId);

      this.logger.info(
        {
          roomId,
          userId,
          roomName: room.name,
        },
        "Room deleted successfully",
      );
    } catch (error) {
      if (error instanceof RoomError) {
        throw error;
      }

      this.logger.error(
        {
          roomId,
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to delete room",
      );

      throw new RoomError("Failed to delete room", "DELETE_FAILED", 500);
    }
  }

  /**
   * Transfer room ownership to another member
   */
  async transferOwnership(
    roomId: string,
    currentOwnerId: string,
    newOwnerId: string,
  ): Promise<void> {
    try {
      // Check if room exists
      const room = await this.roomRepository.findById(roomId);
      if (!room) {
        throw new RoomError("Room not found", ROOM_ERRORS.ROOM_NOT_FOUND, 404);
      }

      // Check if current user is the owner
      const isOwner = await this.roomRepository.isOwner(roomId, currentOwnerId);
      if (!isOwner) {
        throw new RoomError("Only room owner can transfer ownership", ROOM_ERRORS.NOT_OWNER, 403);
      }

      // Check if new owner is a member
      const isNewOwnerMember = await this.roomRepository.isMember(roomId, newOwnerId);
      if (!isNewOwnerMember) {
        throw new RoomError("New owner must be a member of the room", ROOM_ERRORS.NOT_MEMBER, 400);
      }

      // Transfer ownership
      await this.roomRepository.transferOwnership(roomId, currentOwnerId, newOwnerId);

      this.logger.info(
        {
          roomId,
          previousOwner: currentOwnerId,
          newOwner: newOwnerId,
          roomName: room.name,
        },
        "Room ownership transferred successfully",
      );
    } catch (error) {
      if (error instanceof RoomError) {
        throw error;
      }

      this.logger.error(
        {
          roomId,
          currentOwnerId,
          newOwnerId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to transfer room ownership",
      );

      throw new RoomError("Failed to transfer ownership", "TRANSFER_FAILED", 500);
    }
  }

  /**
   * Remove member from room (owner only)
   */
  async removeMember(roomId: string, ownerId: string, memberIdToRemove: string): Promise<void> {
    try {
      // Check if room exists
      const room = await this.roomRepository.findById(roomId);
      if (!room) {
        throw new RoomError("Room not found", ROOM_ERRORS.ROOM_NOT_FOUND, 404);
      }

      // Check if user is the owner
      const isOwner = await this.roomRepository.isOwner(roomId, ownerId);
      if (!isOwner) {
        throw new RoomError("Only room owner can remove members", ROOM_ERRORS.NOT_OWNER, 403);
      }

      // Check if member to remove exists
      const isMember = await this.roomRepository.isMember(roomId, memberIdToRemove);
      if (!isMember) {
        throw new RoomError("User is not a member of this room", ROOM_ERRORS.NOT_MEMBER, 400);
      }

      // Prevent owner from removing themselves (use leaveRoom instead)
      if (ownerId === memberIdToRemove) {
        throw new RoomError(
          "Owner cannot remove themselves. Use leave room instead.",
          ROOM_ERRORS.CANNOT_LEAVE_AS_OWNER,
          400,
        );
      }

      // Remove member
      await this.roomRepository.removeMember(roomId, memberIdToRemove);

      // Update room activity
      await this.roomRepository.updateLastActivity(roomId);

      this.logger.info(
        {
          roomId,
          ownerId,
          removedMemberId: memberIdToRemove,
          roomName: room.name,
        },
        "Member removed from room successfully",
      );
    } catch (error) {
      if (error instanceof RoomError) {
        throw error;
      }

      this.logger.error(
        {
          roomId,
          ownerId,
          memberIdToRemove,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to remove member from room",
      );

      throw new RoomError("Failed to remove member", "REMOVE_MEMBER_FAILED", 500);
    }
  }

  /**
   * Get room members with details
   */
  async getRoomMembers(
    roomId: string,
    userId: string,
  ): Promise<
    Array<{ userId: string; username: string; role: string; joinedAt: Date; lastSeenAt: Date }>
  > {
    try {
      // Check if room exists
      const room = await this.roomRepository.findById(roomId);
      if (!room) {
        throw new RoomError("Room not found", ROOM_ERRORS.ROOM_NOT_FOUND, 404);
      }

      // Check if user is a member (only members can see member list)
      const isMember = await this.roomRepository.isMember(roomId, userId);
      if (!isMember) {
        throw new RoomError("Only room members can view member list", ROOM_ERRORS.NOT_MEMBER, 403);
      }

      const members = await this.roomRepository.getRoomMembers(roomId);

      return members.map((member) => ({
        userId: member.userId,
        username: member.username,
        role: member.role,
        joinedAt: member.joinedAt,
        lastSeenAt: member.lastSeenAt,
      }));
    } catch (error) {
      if (error instanceof RoomError) {
        throw error;
      }

      this.logger.error(
        {
          roomId,
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to get room members",
      );

      throw new RoomError("Failed to get room members", "GET_MEMBERS_FAILED", 500);
    }
  }
}
