import type Redis from "ioredis";
import { randomBytes } from "node:crypto";

export interface InviteData {
  roomId: string;
  createdBy: string;
  createdAt: number;
  expiresAt: number;
  usageCount: number;
  maxUsage?: number;
}

export interface InviteStats {
  totalGenerated: number;
  totalUsed: number;
  activeInvites: number;
}

/**
 * Invite repository for Redis-based invite token management
 */
export class InviteRepository {
  private readonly INVITE_PREFIX = "invite:";
  private readonly ROOM_INVITES_PREFIX = "room_invites:";
  private readonly INVITE_STATS_PREFIX = "invite_stats:";
  private readonly DEFAULT_EXPIRY = 24 * 60 * 60; // 24 hours in seconds

  constructor(private redis: Redis) {}

  /**
   * Generate a unique invite token
   */
  private generateToken(): string {
    return randomBytes(32).toString("hex");
  }

  /**
   * Generate invite link token for a room
   */
  async generateInviteToken(
    roomId: string,
    createdBy: string,
    expiresIn: number = this.DEFAULT_EXPIRY,
    maxUsage?: number,
  ): Promise<string> {
    const token = this.generateToken();
    const now = Date.now();

    const inviteData: InviteData = {
      roomId,
      createdBy,
      createdAt: now,
      expiresAt: now + expiresIn * 1000,
      usageCount: 0,
      maxUsage,
    };

    // Store invite data with expiration
    await this.redis.setex(`${this.INVITE_PREFIX}${token}`, expiresIn, JSON.stringify(inviteData));

    // Add token to room's invite list
    await this.redis.sadd(`${this.ROOM_INVITES_PREFIX}${roomId}`, token);

    // Update room invite stats
    await this.redis.hincrby(`${this.INVITE_STATS_PREFIX}${roomId}`, "totalGenerated", 1);

    return token;
  } /**

   * Validate invite token and return room information
   */
  async validateInviteToken(
    token: string,
  ): Promise<{ roomId: string; valid: boolean; reason?: string }> {
    const inviteKey = `${this.INVITE_PREFIX}${token}`;
    const inviteDataStr = await this.redis.get(inviteKey);

    if (!inviteDataStr) {
      return { roomId: "", valid: false, reason: "Token not found or expired" };
    }

    try {
      const inviteData: InviteData = JSON.parse(inviteDataStr);
      const now = Date.now();

      // Check if token has expired
      if (now > inviteData.expiresAt) {
        await this.revokeInviteToken(token);
        return { roomId: inviteData.roomId, valid: false, reason: "Token expired" };
      }

      // Check usage limits
      if (inviteData.maxUsage && inviteData.usageCount >= inviteData.maxUsage) {
        return { roomId: inviteData.roomId, valid: false, reason: "Usage limit exceeded" };
      }

      return { roomId: inviteData.roomId, valid: true };
    } catch (error) {
      return { roomId: "", valid: false, reason: "Invalid token format" };
    }
  }

  /**
   * Use invite token (increment usage count)
   */
  async useInviteToken(token: string): Promise<boolean> {
    const inviteKey = `${this.INVITE_PREFIX}${token}`;
    const inviteDataStr = await this.redis.get(inviteKey);

    if (!inviteDataStr) {
      return false;
    }

    try {
      const inviteData: InviteData = JSON.parse(inviteDataStr);
      inviteData.usageCount += 1;

      // Update the invite data
      const ttl = await this.redis.ttl(inviteKey);
      if (ttl > 0) {
        await this.redis.setex(inviteKey, ttl, JSON.stringify(inviteData));

        // Update room stats
        await this.redis.hincrby(`${this.INVITE_STATS_PREFIX}${inviteData.roomId}`, "totalUsed", 1);

        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }
  /**
   * Revoke invite token
   */
  async revokeInviteToken(token: string): Promise<void> {
    const inviteKey = `${this.INVITE_PREFIX}${token}`;
    const inviteDataStr = await this.redis.get(inviteKey);

    if (inviteDataStr) {
      try {
        const inviteData: InviteData = JSON.parse(inviteDataStr);

        // Remove from room's invite list
        await this.redis.srem(`${this.ROOM_INVITES_PREFIX}${inviteData.roomId}`, token);
      } catch (error) {
        // Continue with deletion even if parsing fails
      }
    }

    // Delete the invite token
    await this.redis.del(inviteKey);
  }

  /**
   * Get all active invite tokens for a room
   */
  async getRoomInviteTokens(roomId: string): Promise<string[]> {
    const tokens = await this.redis.smembers(`${this.ROOM_INVITES_PREFIX}${roomId}`);

    // Filter out expired tokens
    const activeTokens: string[] = [];
    for (const token of tokens) {
      const validation = await this.validateInviteToken(token);
      if (validation.valid) {
        activeTokens.push(token);
      } else {
        // Clean up expired token
        await this.redis.srem(`${this.ROOM_INVITES_PREFIX}${roomId}`, token);
      }
    }

    return activeTokens;
  }

  /**
   * Get invite statistics for a room
   */
  async getInviteStats(roomId: string): Promise<InviteStats> {
    const stats = await this.redis.hmget(
      `${this.INVITE_STATS_PREFIX}${roomId}`,
      "totalGenerated",
      "totalUsed",
    );

    const activeInvites = await this.getRoomInviteTokens(roomId);

    return {
      totalGenerated: parseInt(stats[0] || "0", 10),
      totalUsed: parseInt(stats[1] || "0", 10),
      activeInvites: activeInvites.length,
    };
  }
  /**
   * Revoke all invite tokens for a room
   */
  async revokeAllRoomInvites(roomId: string): Promise<void> {
    const tokens = await this.redis.smembers(`${this.ROOM_INVITES_PREFIX}${roomId}`);

    if (tokens.length > 0) {
      // Delete all invite tokens
      const inviteKeys = tokens.map((token) => `${this.INVITE_PREFIX}${token}`);
      await this.redis.del(...inviteKeys);

      // Clear room's invite list
      await this.redis.del(`${this.ROOM_INVITES_PREFIX}${roomId}`);
    }
  }

  /**
   * Get invite token details
   */
  async getInviteDetails(token: string): Promise<InviteData | null> {
    const inviteKey = `${this.INVITE_PREFIX}${token}`;
    const inviteDataStr = await this.redis.get(inviteKey);

    if (!inviteDataStr) {
      return null;
    }

    try {
      return JSON.parse(inviteDataStr);
    } catch (error) {
      return null;
    }
  }

  /**
   * Clean up expired invite tokens for a room
   */
  async cleanupExpiredInvites(roomId: string): Promise<number> {
    const tokens = await this.redis.smembers(`${this.ROOM_INVITES_PREFIX}${roomId}`);
    let cleanedCount = 0;

    for (const token of tokens) {
      const validation = await this.validateInviteToken(token);
      if (!validation.valid) {
        await this.revokeInviteToken(token);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }
}
