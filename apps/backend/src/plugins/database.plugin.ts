import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { db } from "../config/database";

declare module "fastify" {
  interface FastifyInstance {
    db: typeof db;
  }
}

/**
 * Database decorator plugin
 */
const databasePlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate("db", db);
};

export default fp(databasePlugin, {
  name: "database",
});
