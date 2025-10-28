import type { FastifyInstance, FastifyPluginAsync } from "fastify";

/**
 * Route module configuration
 */
export interface RouteModule {
  plugin: FastifyPluginAsync;
  prefix?: string;
  options?: Record<string, unknown>;
}

/**
 * Register multiple route modules with their prefixes
 */
export async function registerRouteModules(
  fastify: FastifyInstance,
  modules: RouteModule[],
): Promise<void> {
  for (const { plugin, prefix, options } of modules) {
    await fastify.register(plugin, {
      prefix,
      ...options,
    });
  }
}

/**
 * Create a route module with consistent structure
 */
export function createRouteModule(name: string, routes: FastifyPluginAsync): FastifyPluginAsync {
  const routeModule: FastifyPluginAsync = async (fastify, options) => {
    // Add route module metadata
    fastify.addHook("onRoute", (routeOptions) => {
      if (!routeOptions.config) {
        routeOptions.config = {};
      }
      (routeOptions.config as any).module = name;
    });

    // Register the routes
    await routes(fastify, options);
  };

  // Set the module name for debugging
  Object.defineProperty(routeModule, "name", { value: name });

  return routeModule;
}

/**
 * Route metadata for documentation and debugging
 */
export interface RouteInfo {
  method: string;
  path: string;
  module?: string;
  description?: string;
}

/**
 * Extract route information from Fastify instance
 */
export function getRouteInfo(_fastify: FastifyInstance): RouteInfo[] {
  const routes: RouteInfo[] = [];

  // This would be implemented to extract route information
  // from the Fastify instance for documentation purposes
  // For now, we'll return an empty array as this is mainly
  // for future documentation generation

  return routes;
}
