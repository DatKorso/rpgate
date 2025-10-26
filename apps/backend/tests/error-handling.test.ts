import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app';
import type { FastifyInstance } from 'fastify';

describe('Error Handling', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should handle validation errors with detailed field information', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/test/user',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        name: 'A', // Too short
        email: 'invalid-email', // Invalid format
        age: 12, // Too young
        role: 'invalid', // Invalid enum value
      },
    });

    expect(response.statusCode).toBe(400);
    const payload = JSON.parse(response.payload);
    
    // Check error response structure
    expect(payload.success).toBe(false);
    expect(payload.error).toBeDefined();
    expect(payload.error.code).toBe('VALIDATION_ERROR');
    expect(payload.error.correlationId).toBeDefined();
    expect(payload.error.timestamp).toBeDefined();
    expect(payload.error.details).toBeDefined();
    expect(payload.error.details.fields).toBeInstanceOf(Array);
    expect(payload.error.details.totalErrors).toBeGreaterThan(0);
    
    // Check that we have validation errors for each invalid field
    const fields = payload.error.details.fields;
    const fieldNames = fields.map((f: any) => f.field);
    
    expect(fieldNames).toContain('name');
    expect(fieldNames).toContain('email');
    expect(fieldNames).toContain('age');
    expect(fieldNames).toContain('role');
    
    // Check that each field error has the required properties
    fields.forEach((field: any) => {
      expect(field.field).toBeDefined();
      expect(field.message).toBeDefined();
      expect(field.constraint).toBeDefined();
      expect(field.path).toBeInstanceOf(Array);
    });
  });

  it('should handle valid data correctly', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/test/user',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        name: 'John Doe',
        email: 'john@example.com',
        age: 25,
        role: 'player',
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    
    expect(payload.success).toBe(true);
    expect(payload.data).toBeDefined();
    expect(payload.data.message).toBe('User data validated successfully');
    expect(payload.data.user).toBeDefined();
    expect(payload.meta.correlationId).toBeDefined();
  });

  it('should handle query parameter validation errors', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/test/users?page=0&limit=200', // Invalid values
    });

    expect(response.statusCode).toBe(400);
    const payload = JSON.parse(response.payload);
    
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('VALIDATION_ERROR');
    expect(payload.error.details.fields).toBeInstanceOf(Array);
    
    const fields = payload.error.details.fields;
    const fieldNames = fields.map((f: any) => f.field);
    
    expect(fieldNames).toContain('page'); // page must be >= 1
    expect(fieldNames).toContain('limit'); // limit must be <= 100
  });

  it('should handle manual errors correctly', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/test/error?type=auth',
    });

    expect(response.statusCode).toBe(401);
    const payload = JSON.parse(response.payload);
    
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('UNAUTHORIZED');
    expect(payload.error.message).toBe('Authentication required');
    expect(payload.error.correlationId).toBeDefined();
  });

  it('should handle not found errors', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/non-existent-endpoint',
    });

    expect(response.statusCode).toBe(404);
    const payload = JSON.parse(response.payload);
    
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('NOT_FOUND');
    expect(payload.error.correlationId).toBeDefined();
    expect(payload.error.message).toContain('not found');
  });

  it('should include correlation ID in response headers', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/non-existent-endpoint',
    });

    expect(response.headers['x-correlation-id']).toBeDefined();
    
    const payload = JSON.parse(response.payload);
    expect(payload.error.correlationId).toBe(response.headers['x-correlation-id']);
  });
});