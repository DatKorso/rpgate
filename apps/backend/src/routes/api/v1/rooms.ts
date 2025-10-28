import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import {
  createRoomSchema,
  updateRoomSchema,
  paginationSchema,
  generateInviteSchema,
  roomIdSchema,
} from "@rpgate/shared/schemas";
import type {
  CreateRoomInput,
  UpdateRoomInput,
  PaginationInput,
  GenerateInviteInput,
} from "@rpgate/shared/schemas";
import { RoomService } from "../../../services/room.service";
import { InviteService } from "../../../services/invite.service";
import {
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  parsePaginationQuery,
} from "../../../utils/response.util";
import {
  notifyRoomUpdate,
  notifyMemberCountUpdate,
  notifyUserJoined,
  notifyUserLeft,
} from "../../../utils/websocket.util";
import { createValidationHook } from "../../../utils/validation.util";
import "../../../types/session.types";

/**
 * Room management routes plugin
 * Handles room CRUD operations, membership management, and invite links
 */
const roomRoutes: FastifyPluginAsync = async (fastify) => {
  // Initialize services with database connection, redis, and logger
  const roomService = new RoomService(fastify.db, (fastify as any).redis, fastify.log);
  const inviteService = new InviteService(fastify.db, (fastify as any).redis, fastify.log);

  /**
   * POST /api/v1/rooms
   * Create a new room
   * Requires authentication
   */
  fastify.post<{ Body: CreateRoomInput }>(
    "/",
    {
      preHandler: [fastify.requireAuth],
      preValidation: [createValidationHook(createRoomSchema, "body")],
    },
    async (request: FastifyRequest<{ Body: CreateRoomInput }>, reply: FastifyReply) => {
      try {
        if (!request.user) {
          reply.status(401);
          return createErrorResponse("Unauthorized", 401, request, "UNAUTHORIZED");
        }

        const room = await roomService.createRoom(request.user.id, request.body);

        reply.status(201);
        return createSuccessResponse({ room }, request);
      } catch (error) {
        fastify.log.error({ error, correlationId: request.id }, "Room creation error");
        reply.status(500);
        return createErrorResponse("Внутренняя ошибка сервера", 500, request, "INTERNAL_ERROR");
      }
    },
  );

  /**
   * GET /api/v1/rooms
   * Get list of public rooms with pagination
   */
  fastify.get<{ Querystring: PaginationInput }>(
    "/",
    {
      preValidation: [createValidationHook(paginationSchema, "query")],
    },
    async (request: FastifyRequest<{ Querystring: PaginationInput }>, reply: FastifyReply) => {
      try {
        const pagination = parsePaginationQuery(request.query);
        const userId = request.user?.id;

        const result = await roomService.getPublicRooms(
          {
            limit: pagination.limit,
            offset: (pagination.page - 1) * pagination.limit,
          },
          userId,
        );

        return createPaginatedResponse(result.rooms, request, {
          page: pagination.page,
          limit: pagination.limit,
          total: result.total,
        });
      } catch (error) {
        fastify.log.error({ error, correlationId: request.id }, "Fetch public rooms error");
        reply.status(500);
        return createErrorResponse("Внутренняя ошибка сервера", 500, request, "INTERNAL_ERROR");
      }
    },
  );

  /**
   * GET /api/v1/rooms/my
   * Get list of rooms where the authenticated user is a member
   * Requires authentication
   */
  fastify.get(
    "/my",
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          reply.status(401);
          return createErrorResponse("Unauthorized", 401, request, "UNAUTHORIZED");
        }

        const rooms = await roomService.getUserRooms(request.user.id);

        return createSuccessResponse({ rooms }, request);
      } catch (error) {
        fastify.log.error({ error, correlationId: request.id }, "Fetch user rooms error");
        reply.status(500);
        return createErrorResponse("Внутренняя ошибка сервера", 500, request, "INTERNAL_ERROR");
      }
    },
  );

  /**
   * GET /api/v1/rooms/:id
   * Get detailed information about a specific room
   * Requires authentication for private rooms or to see detailed info
   */
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: [fastify.requireAuth],
      preValidation: [createValidationHook(roomIdSchema, "params")],
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        if (!request.user) {
          reply.status(401);
          return createErrorResponse("Unauthorized", 401, request, "UNAUTHORIZED");
        }

        const room = await roomService.getRoomById(request.params.id, request.user.id);

        if (!room) {
          reply.status(404);
          return createErrorResponse("Комната не найдена", 404, request, "ROOM_NOT_FOUND");
        }

        return createSuccessResponse({ room }, request);
      } catch (error) {
        fastify.log.error({ error, correlationId: request.id }, "Fetch room details error");
        reply.status(500);
        return createErrorResponse("Внутренняя ошибка сервера", 500, request, "INTERNAL_ERROR");
      }
    },
  );

  /**
   * PUT /api/v1/rooms/:id
   * Update room settings (owner only)
   * Requires authentication and ownership
   */
  fastify.put<{ Params: { id: string }; Body: UpdateRoomInput }>(
    "/:id",
    {
      preHandler: [fastify.requireAuth],
      preValidation: [
        createValidationHook(roomIdSchema, "params"),
        createValidationHook(updateRoomSchema, "body"),
      ],
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateRoomInput }>,
      reply: FastifyReply,
    ) => {
      try {
        if (!request.user) {
          reply.status(401);
          return createErrorResponse("Unauthorized", 401, request, "UNAUTHORIZED");
        }

        const room = await roomService.updateRoom(request.params.id, request.user.id, request.body);

        // Notify all room members about the update via WebSocket
        await notifyRoomUpdate(fastify, request.params.id, room);

        return createSuccessResponse({ room }, request);
      } catch (error: any) {
        // Handle RoomError with specific status codes
        if (error.statusCode) {
          reply.status(error.statusCode);
          return createErrorResponse(
            error.message || "Не удалось обновить комнату",
            error.statusCode,
            request,
            error.code || "ROOM_UPDATE_FAILED",
          );
        }

        fastify.log.error({ error, correlationId: request.id }, "Room update error");
        reply.status(500);
        return createErrorResponse("Внутренняя ошибка сервера", 500, request, "INTERNAL_ERROR");
      }
    },
  );

  /**
   * DELETE /api/v1/rooms/:id
   * Delete a room (owner only)
   * Requires authentication and ownership
   */
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    {
      preHandler: [fastify.requireAuth],
      preValidation: [createValidationHook(roomIdSchema, "params")],
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        if (!request.user) {
          reply.status(401);
          return createErrorResponse("Unauthorized", 401, request, "UNAUTHORIZED");
        }

        await roomService.deleteRoom(request.params.id, request.user.id);

        return createSuccessResponse({ message: "Комната успешно удалена" }, request);
      } catch (error: any) {
        // Handle RoomError with specific status codes
        if (error.statusCode) {
          reply.status(error.statusCode);
          return createErrorResponse(
            error.message || "Не удалось удалить комнату",
            error.statusCode,
            request,
            error.code || "ROOM_DELETE_FAILED",
          );
        }

        fastify.log.error({ error, correlationId: request.id }, "Room deletion error");
        reply.status(500);
        return createErrorResponse("Внутренняя ошибка сервера", 500, request, "INTERNAL_ERROR");
      }
    },
  );

  /**
   * POST /api/v1/rooms/:id/join
   * Join a room
   * Requires authentication
   */
  fastify.post<{ Params: { id: string } }>(
    "/:id/join",
    {
      preHandler: [fastify.requireAuth],
      preValidation: [createValidationHook(roomIdSchema, "params")],
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        if (!request.user) {
          reply.status(401);
          return createErrorResponse("Unauthorized", 401, request, "UNAUTHORIZED");
        }

        await roomService.joinRoom(request.params.id, request.user.id);

        // Get updated room details to get member count
        const room = await roomService.getRoomById(request.params.id, request.user.id);
        const memberCount = room?.memberCount || 0;

        // Notify all room members via WebSocket
        await notifyUserJoined(fastify, request.params.id, {
          id: request.user.id,
          username: request.user.username,
        });
        await notifyMemberCountUpdate(fastify, request.params.id, memberCount);

        return createSuccessResponse({ message: "Вы успешно присоединились к комнате" }, request);
      } catch (error: any) {
        // Handle RoomError with specific status codes
        if (error.statusCode) {
          reply.status(error.statusCode);
          return createErrorResponse(
            error.message || "Не удалось присоединиться к комнате",
            error.statusCode,
            request,
            error.code || "JOIN_ROOM_FAILED",
          );
        }

        fastify.log.error({ error, correlationId: request.id }, "Join room error");
        reply.status(500);
        return createErrorResponse("Внутренняя ошибка сервера", 500, request, "INTERNAL_ERROR");
      }
    },
  );

  /**
   * DELETE /api/v1/rooms/:id/leave
   * Leave a room (handles ownership transfer if owner leaves)
   * Requires authentication
   */
  fastify.delete<{ Params: { id: string } }>(
    "/:id/leave",
    {
      preHandler: [fastify.requireAuth],
      preValidation: [createValidationHook(roomIdSchema, "params")],
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        if (!request.user) {
          reply.status(401);
          return createErrorResponse("Unauthorized", 401, request, "UNAUTHORIZED");
        }

        const roomId = request.params.id;
        const userId = request.user.id;

        // Notify before leaving (so user is still in room for WebSocket)
        await notifyUserLeft(fastify, roomId, userId);

        // Leave the room
        await roomService.leaveRoom(roomId, userId);

        // Get updated member count and notify
        try {
          const room = await roomService.getRoomById(roomId, userId);
          if (room) {
            const memberCount = room.memberCount || 0;
            await notifyMemberCountUpdate(fastify, roomId, memberCount);
          }
        } catch (error) {
          // Ignore errors when getting updated count (room might be deleted if last member left)
          fastify.log.debug({ error, roomId }, "Could not get updated member count after leave");
        }

        return createSuccessResponse({ message: "Вы покинули комнату" }, request);
      } catch (error: any) {
        // Handle RoomError with specific status codes
        if (error.statusCode) {
          reply.status(error.statusCode);
          return createErrorResponse(
            error.message || "Не удалось покинуть комнату",
            error.statusCode,
            request,
            error.code || "LEAVE_ROOM_FAILED",
          );
        }

        fastify.log.error({ error, correlationId: request.id }, "Leave room error");
        reply.status(500);
        return createErrorResponse("Внутренняя ошибка сервера", 500, request, "INTERNAL_ERROR");
      }
    },
  );

  /**
   * POST /api/v1/rooms/:id/invite
   * Generate an invite link for the room (owner only)
   * Requires authentication and ownership
   */
  fastify.post<{ Params: { id: string }; Body: GenerateInviteInput }>(
    "/:id/invite",
    {
      preHandler: [fastify.requireAuth],
      preValidation: [
        createValidationHook(roomIdSchema, "params"),
        createValidationHook(generateInviteSchema, "body"),
      ],
    },
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: GenerateInviteInput }>,
      reply: FastifyReply,
    ) => {
      try {
        if (!request.user) {
          reply.status(401);
          return createErrorResponse("Unauthorized", 401, request, "UNAUTHORIZED");
        }

        const token = await inviteService.generateInviteLink(
          request.params.id,
          request.user.id,
          request.body,
        );

        // Calculate expiration date
        const expiresIn = request.body.expiresIn || 86400; // 24h default
        const expiresAt = new Date(Date.now() + expiresIn * 1000);

        // Build invite URL (you may need to adjust the base URL)
        const inviteUrl = `/rooms/join/${token}`;

        reply.status(201);
        return createSuccessResponse(
          {
            token,
            expiresAt,
            inviteUrl,
          },
          request,
        );
      } catch (error: any) {
        // Handle InviteError with specific status codes
        if (error.statusCode) {
          reply.status(error.statusCode);
          return createErrorResponse(
            error.message || "Не удалось создать приглашение",
            error.statusCode,
            request,
            error.code || "INVITE_GENERATION_FAILED",
          );
        }

        fastify.log.error({ error, correlationId: request.id }, "Invite generation error");
        reply.status(500);
        return createErrorResponse("Внутренняя ошибка сервера", 500, request, "INTERNAL_ERROR");
      }
    },
  );

  /**
   * GET /api/v1/rooms/join/:token
   * Join a room using an invite token
   * Requires authentication
   */
  fastify.get<{ Params: { token: string } }>(
    "/join/:token",
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) => {
      try {
        if (!request.user) {
          reply.status(401);
          return createErrorResponse("Unauthorized", 401, request, "UNAUTHORIZED");
        }

        const result = await inviteService.joinRoomWithInvite(
          request.params.token,
          request.user.id,
        );

        // Get updated room details for member count
        const room = await roomService.getRoomById(result.roomId, request.user.id);
        const memberCount = room?.memberCount || 0;

        // Notify all room members via WebSocket
        await notifyUserJoined(fastify, result.roomId, {
          id: request.user.id,
          username: request.user.username,
        });
        await notifyMemberCountUpdate(fastify, result.roomId, memberCount);

        return createSuccessResponse(
          {
            message: "Вы успешно присоединились к комнате",
            roomId: result.roomId,
            roomName: result.roomName,
          },
          request,
        );
      } catch (error: any) {
        // Handle InviteError with specific status codes
        if (error.statusCode) {
          reply.status(error.statusCode);
          return createErrorResponse(
            error.message || "Не удалось присоединиться по приглашению",
            error.statusCode,
            request,
            error.code || "JOIN_BY_INVITE_FAILED",
          );
        }

        fastify.log.error({ error, correlationId: request.id }, "Join by invite error");
        reply.status(500);
        return createErrorResponse("Внутренняя ошибка сервера", 500, request, "INTERNAL_ERROR");
      }
    },
  );

  /**
   * GET /api/v1/rooms/:id/members
   * Get list of room members
   * Requires authentication and membership
   */
  fastify.get<{ Params: { id: string } }>(
    "/:id/members",
    {
      preHandler: [fastify.requireAuth],
      preValidation: [createValidationHook(roomIdSchema, "params")],
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        if (!request.user) {
          reply.status(401);
          return createErrorResponse("Unauthorized", 401, request, "UNAUTHORIZED");
        }

        const members = await roomService.getRoomMembers(request.params.id, request.user.id);

        return createSuccessResponse({ members }, request);
      } catch (error: any) {
        // Handle RoomError with specific status codes
        if (error.statusCode) {
          reply.status(error.statusCode);
          return createErrorResponse(
            error.message || "Не удалось загрузить список участников",
            error.statusCode,
            request,
            error.code || "FETCH_MEMBERS_FAILED",
          );
        }

        fastify.log.error({ error, correlationId: request.id }, "Fetch room members error");
        reply.status(500);
        return createErrorResponse("Внутренняя ошибка сервера", 500, request, "INTERNAL_ERROR");
      }
    },
  );
};

export default roomRoutes;
