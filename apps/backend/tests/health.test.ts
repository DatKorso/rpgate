import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app';
import type { FastifyInstance } from 'fastify';

describe('Health Check Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should return basic health status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    
    expect(payload.status).toBe('healthy');
    expect(payload.timestamp).toBeDefined();
    expect(payload.uptime).toBeTypeOf('number');
    expect(payload.version).toBeDefined();
    expect(payload.environment).toBe('test');
  });

  it('should return database health status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/db'
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    
    expect(payload.connected).toBe(true);
    expect(payload.responseTime).toBeTypeOf('number');
    expect(payload.responseTime).toBeGreaterThan(0);
    expect(payload.error).toBeUndefined();
  });

  it('should return Redis health status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/redis'
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    
    expect(payload.connected).toBe(true);
    expect(payload.responseTime).toBeTypeOf('number');
    expect(payload.responseTime).toBeGreaterThanOrEqual(0); // Redis ping can be very fast (0ms)
    expect(payload.error).toBeUndefined();
  });

  it('should return detailed health status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/detailed'
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    
    // Basic health info
    expect(payload.status).toMatch(/^(healthy|degraded|unhealthy)$/);
    expect(payload.timestamp).toBeDefined();
    expect(payload.uptime).toBeTypeOf('number');
    expect(payload.version).toBeDefined();
    expect(payload.environment).toBe('test');
    
    // Services health
    expect(payload.services).toBeDefined();
    expect(payload.services.database).toBeDefined();
    expect(payload.services.database.connected).toBe(true);
    expect(payload.services.redis).toBeDefined();
    expect(payload.services.redis.connected).toBe(true);
    
    // Performance metrics
    expect(payload.performance).toBeDefined();
    expect(payload.performance.memoryUsage).toBeDefined();
    expect(payload.performance.cpuUsage).toBeDefined();
  });
});