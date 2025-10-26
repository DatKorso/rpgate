import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app';
import type { FastifyInstance } from 'fastify';

describe('Server Infrastructure', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Create app instance for testing
    app = await createApp();
  });

  afterAll(async () => {
    // Clean up
    if (app) {
      await app.close();
    }
  });

  it('should create Fastify application successfully', () => {
    expect(app).toBeDefined();
    expect(app.server).toBeDefined();
  });

  it('should have database decorator', () => {
    expect(app.db).toBeDefined();
  });

  it('should have redis decorator', () => {
    expect(app.redis).toBeDefined();
  });

  it('should respond to root endpoint', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/'
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    expect(payload.success).toBe(true);
    expect(payload.data.name).toBe('RPGate API');
    expect(payload.data.status).toBe('running');
    expect(payload.data.version).toBe('1.0.0');
    expect(payload.meta.timestamp).toBeDefined();
  });

  it('should have proper error handler', async () => {
    // Test error handling by hitting a non-existent endpoint
    const response = await app.inject({
      method: 'GET',
      url: '/non-existent-endpoint'
    });

    expect(response.statusCode).toBe(404);
    const payload = JSON.parse(response.payload);
    
    // Check if it's our custom error format or Fastify's default
    if (payload.success !== undefined) {
      // Our custom error format
      expect(payload.success).toBe(false);
      expect(payload.error).toBeDefined();
      expect(payload.error.correlationId).toBeDefined();
    } else {
      // Fastify's default 404 format
      expect(payload.message).toBeDefined();
      expect(payload.statusCode).toBe(404);
    }
  });
});