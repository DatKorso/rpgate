import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import secureSession from "@fastify/secure-session";
import { env } from "../config/env";

/**
 * Session plugin configuration
 */
const sessionPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(secureSession, {
    secret: env.SESSION_SECRET,
    salt: "rpgate-sess-salt",
    cookie: {
      path: "/",
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    },
  });
};

export default fp(sessionPlugin, {
  name: "session",
});
