import type { FastifyBaseLogger } from "fastify";
import type { Redis } from "ioredis";
import { InviteRepository } from "./invite.repository.js";
import { RoomRepository } from "./room.repository.js";
import type { Database } from "@rpgate/database";

// Types for invite functionality (re-export from repository)
export interface InviteData {
  roomId: string;
  createdBy: string;
  createdAt: number;
  expiresAt: number;
  usageCount: number;
  maxUsage?: number;
}

interface InviteStats {
  totalGenerated: number;
  totalUsed: number;
  activeInvites: number;
}

interface InviteValidationResult {
  roomId: string;
  valid: boolean;
  reason?: string;
}

interface GenerateInviteOptions {
  expiresIn?: number; // seconds
  maxUsage?: number;
}

// Error types
export class InviteError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = "InviteError";
  }
}

export const INVITE_ERRORS = {
  ROOM_NOT_FOUND: "ROOM_NOT_FOUND",
  NOT_OWNER: "NOT_OWNER",
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  USAGE_LIMIT_EXCEEDED: "USAGE_LIMIT_EXCEEDED",
  ALREADY_MEMBER: "ALREADY_MEMBER",
} as const;

/**
 * Invite service for invite link functionality
 */
export class InviteService {
  private inviteRepository: InviteRepository;
  private roomRepository: RoomRepository;
  private logger: FastifyBaseLogger;

  constructor(db: Database, redis: Redis, logger: FastifyBaseLogger) {
    this.inviteRepository = new InviteRepository(redis);
    this.roomRepository = new RoomRepository(db);
    this.logger = logger;
  }

  /**
   * Generate invite link for a room with expiration handling
   */
  async generateInviteLink(
    roomId: string,
    userId: string,
    options: GenerateInviteOptions = {},
  ): Promise<string> {
    try {
      // Check if room exists
      const room = await this.roomRepository.findById(roomId);
      if (!room) {
        throw new InviteError("Room not found", INVITE_ERRORS.ROOM_NOT_FOUND, 404);
      }

      // Check if user is the owner (only owners can generate invite links)
      const isOwner = await this.roomRepository.isOwner(roomId, userId);
      if (!isOwner) {
        throw new InviteError(
          "Only room owner can generate invite links",
          INVITE_ERRORS.NOT_OWNER,
          403,
        );
      }

      // Set default expiration (24 hours)
      const expiresIn = options.expiresIn || 24 * 60 * 60; // 24 hours in seconds

      // Generate invite token
      const token = await this.inviteRepository.generateInviteToken(
        roomId,
        userId,
        expiresIn,
        options.maxUsage,
      );

      this.logger.info(
        {
          roomId,
          userId,
          token: token.substring(0, 8) + "...", // Log partial token for security
          expiresIn,
          maxUsage: options.maxUsage,
        },
        "Invite link generated successfully",
      );

      return token;
    } catch (error) {
      if (error instanceof InviteError) {
        throw error;
      }

      this.logger.error(
        {
          roomId,
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to generate invite link",
      );

      throw new InviteError("Failed to generate invite link", "GENERATION_FAILED", 500);
    }
  }

  /**
   * Validate invite token and return room access information
   */
  async validateInviteToken(token: string): Promise<InviteValidationResult> {
    try {
      const validation = await this.inviteRepository.validateInviteToken(token);

      if (!validation.valid) {
        this.logger.warn(
          {
            token: token.substring(0, 8) + "...",
            reason: validation.reason,
          },
          "Invalid invite token validation attempt",
        );
      }

      return validation;
    } catch (error) {
      this.logger.error(
        {
          token: token.substring(0, 8) + "...",
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to validate invite token",
      );

      return {
        roomId: "",
        valid: false,
        reason: "Validation failed",
      };
    }
  }

  /**
   * Join room using invite token with validation
   */
  async joinRoomWithInvite(
    token: string,
    userId: string,
  ): Promise<{ roomId: string; roomName: string; joined: boolean }> {
    try {
      // Validate invite token
      const validation = await this.validateInviteToken(token);
      if (!validation.valid) {
        let errorCode: string = INVITE_ERRORS.INVALID_TOKEN;
        if (validation.reason?.includes("expired")) {
          errorCode = INVITE_ERRORS.TOKEN_EXPIRED;
        } else if (validation.reason?.includes("usage limit")) {
          errorCode = INVITE_ERRORS.USAGE_LIMIT_EXCEEDED;
        }

        throw new InviteError(validation.reason || "Invalid invite token", errorCode, 400);
      }

      const roomId = validation.roomId;

      // Check if room still exists
      const room = await this.roomRepository.findById(roomId);
      if (!room) {
        throw new InviteError("Room not found", INVITE_ERRORS.ROOM_NOT_FOUND, 404);
      }

      // Check if user is already a member
      const isMember = await this.roomRepository.isMember(roomId, userId);
      if (isMember) {
        await this.roomRepository.updateLastActivity(roomId);

        this.logger.debug(
          {
            roomId,
            userId,
            token: token.substring(0, 8) + "...",
          },
          "Invite join ignored - user already member",
        );

        return {
          roomId,
          roomName: room.name,
          joined: false,
        };
      }

      // Use the invite token (increment usage count)
      const tokenUsed = await this.inviteRepository.useInviteToken(token);
      if (!tokenUsed) {
        throw new InviteError("Failed to use invite token", INVITE_ERRORS.INVALID_TOKEN, 400);
      }

      // Add user as member
      await this.roomRepository.addMember(roomId, userId, "member");

      // Update room activity
      await this.roomRepository.updateLastActivity(roomId);

      this.logger.info(
        {
          roomId,
          userId,
          token: token.substring(0, 8) + "...",
          roomName: room.name,
        },
        "User joined room via invite link successfully",
      );

      return {
        roomId,
        roomName: room.name,
        joined: true,
      };
    } catch (error) {
      if (error instanceof InviteError) {
        throw error;
      }

      this.logger.error(
        {
          token: token.substring(0, 8) + "...",
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to join room with invite",
      );

      throw new InviteError("Failed to join room with invite", "JOIN_FAILED", 500);
    }
  }

  /**
   * Get invite analytics and usage tracking for a room
   */
  async getInviteStats(roomId: string, userId: string): Promise<InviteStats> {
    try {
      // Check if room exists
      const room = await this.roomRepository.findById(roomId);
      if (!room) {
        throw new InviteError("Room not found", INVITE_ERRORS.ROOM_NOT_FOUND, 404);
      }

      // Check if user is the owner (only owners can view invite stats)
      const isOwner = await this.roomRepository.isOwner(roomId, userId);
      if (!isOwner) {
        throw new InviteError(
          "Only room owner can view invite statistics",
          INVITE_ERRORS.NOT_OWNER,
          403,
        );
      }

      const stats = await this.inviteRepository.getInviteStats(roomId);

      this.logger.info(
        {
          roomId,
          userId,
          stats,
        },
        "Invite statistics retrieved successfully",
      );

      return stats;
    } catch (error) {
      if (error instanceof InviteError) {
        throw error;
      }

      this.logger.error(
        {
          roomId,
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to get invite statistics",
      );

      throw new InviteError("Failed to get invite statistics", "STATS_FAILED", 500);
    }
  }

  /**
   * Revoke invite token (owner only)
   */
  async revokeInviteToken(token: string, userId: string): Promise<void> {
    try {
      // Get invite details to check ownership
      const inviteDetails = await this.inviteRepository.getInviteDetails(token);
      if (!inviteDetails) {
        throw new InviteError("Invite token not found", INVITE_ERRORS.INVALID_TOKEN, 404);
      }

      // Check if user is the owner of the room
      const isOwner = await this.roomRepository.isOwner(inviteDetails.roomId, userId);
      if (!isOwner) {
        throw new InviteError(
          "Only room owner can revoke invite tokens",
          INVITE_ERRORS.NOT_OWNER,
          403,
        );
      }

      // Revoke the token
      await this.inviteRepository.revokeInviteToken(token);

      this.logger.info(
        {
          roomId: inviteDetails.roomId,
          userId,
          token: token.substring(0, 8) + "...",
        },
        "Invite token revoked successfully",
      );
    } catch (error) {
      if (error instanceof InviteError) {
        throw error;
      }

      this.logger.error(
        {
          token: token.substring(0, 8) + "...",
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to revoke invite token",
      );

      throw new InviteError("Failed to revoke invite token", "REVOKE_FAILED", 500);
    }
  }

  /**
   * Get all active invite tokens for a room (owner only)
   */
  async getRoomInviteTokens(roomId: string, userId: string): Promise<string[]> {
    try {
      // Check if room exists
      const room = await this.roomRepository.findById(roomId);
      if (!room) {
        throw new InviteError("Room not found", INVITE_ERRORS.ROOM_NOT_FOUND, 404);
      }

      // Check if user is the owner
      const isOwner = await this.roomRepository.isOwner(roomId, userId);
      if (!isOwner) {
        throw new InviteError(
          "Only room owner can view invite tokens",
          INVITE_ERRORS.NOT_OWNER,
          403,
        );
      }

      const tokens = await this.inviteRepository.getRoomInviteTokens(roomId);

      this.logger.info(
        {
          roomId,
          userId,
          tokenCount: tokens.length,
        },
        "Room invite tokens retrieved successfully",
      );

      return tokens;
    } catch (error) {
      if (error instanceof InviteError) {
        throw error;
      }

      this.logger.error(
        {
          roomId,
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to get room invite tokens",
      );

      throw new InviteError("Failed to get room invite tokens", "GET_TOKENS_FAILED", 500);
    }
  }

  /**
   * Revoke all invite tokens for a room (owner only)
   */
  async revokeAllRoomInvites(roomId: string, userId: string): Promise<void> {
    try {
      // Check if room exists
      const room = await this.roomRepository.findById(roomId);
      if (!room) {
        throw new InviteError("Room not found", INVITE_ERRORS.ROOM_NOT_FOUND, 404);
      }

      // Check if user is the owner
      const isOwner = await this.roomRepository.isOwner(roomId, userId);
      if (!isOwner) {
        throw new InviteError(
          "Only room owner can revoke all invite tokens",
          INVITE_ERRORS.NOT_OWNER,
          403,
        );
      }

      await this.inviteRepository.revokeAllRoomInvites(roomId);

      this.logger.info(
        {
          roomId,
          userId,
        },
        "All room invite tokens revoked successfully",
      );
    } catch (error) {
      if (error instanceof InviteError) {
        throw error;
      }

      this.logger.error(
        {
          roomId,
          userId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to revoke all room invite tokens",
      );

      throw new InviteError("Failed to revoke all invite tokens", "REVOKE_ALL_FAILED", 500);
    }
  }

  /**
   * Clean up expired invite tokens for a room
   */
  async cleanupExpiredInvites(roomId: string): Promise<number> {
    try {
      const cleanedCount = await this.inviteRepository.cleanupExpiredInvites(roomId);

      this.logger.info(
        {
          roomId,
          cleanedCount,
        },
        "Expired invite tokens cleaned up",
      );

      return cleanedCount;
    } catch (error) {
      this.logger.error(
        {
          roomId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Failed to cleanup expired invite tokens",
      );

      return 0; // Return 0 on error, don't throw as this is a cleanup operation
    }
  }
}
