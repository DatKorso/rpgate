import type { Database } from "@rpgate/database";
import { schema } from "@rpgate/database";
import type { FastifyBaseLogger } from "fastify";

type User = typeof schema.users.$inferSelect;
import type { LoginInput, RegisterInput, PublicUser } from "@rpgate/shared/schemas";
import { UserRepository } from "./user.repository";
import { hashPassword, verifyPassword, validatePasswordStrength } from "../utils/password.util";

/**
 * Authentication service for user registration and login
 */

export interface AuthResult {
  success: boolean;
  user?: PublicUser;
  error?: string;
}

export interface AuthContext {
  correlationId: string;
  ip: string;
  userAgent?: string;
  timestamp: string;
}

export class AuthService {
  private userRepository: UserRepository;
  private logger: FastifyBaseLogger;

  constructor(db: Database, logger: FastifyBaseLogger) {
    this.userRepository = new UserRepository(db);
    this.logger = logger;
  }

  /**
   * Log security events with proper context and correlation IDs
   */
  private logSecurityEvent(
    event: string,
    context: AuthContext,
    details: Record<string, any> = {},
    level: 'info' | 'warn' | 'error' = 'info'
  ) {
    const logData = {
      correlationId: context.correlationId,
      event,
      ip: context.ip,
      userAgent: context.userAgent,
      timestamp: context.timestamp,
      ...details,
    };

    // Remove sensitive information from logs
    const sanitizedDetails = { ...details };
    delete sanitizedDetails.password;
    delete sanitizedDetails.passwordHash;

    this.logger[level]({
      ...logData,
      ...sanitizedDetails,
    }, `Security event: ${event}`);
  }

  /**
   * Register a new user
   */
  async register(input: RegisterInput, context: AuthContext): Promise<AuthResult> {
    try {
      this.logSecurityEvent('registration_attempt', context, {
        username: input.username,
        email: input.email,
      });

      // Validate password strength
      const passwordValidation = validatePasswordStrength(input.password);
      if (!passwordValidation.isValid) {
        this.logSecurityEvent('registration_failed', context, {
          username: input.username,
          email: input.email,
          reason: 'weak_password',
          errors: passwordValidation.errors,
        }, 'warn');

        return {
          success: false,
          error: passwordValidation.errors.join(", "),
        };
      }

      // Check if username or email already exists
      const exists = await this.userRepository.existsByUsernameOrEmail(
        input.username,
        input.email
      );

      if (exists) {
        this.logSecurityEvent('registration_failed', context, {
          username: input.username,
          email: input.email,
          reason: 'duplicate_credentials',
        }, 'warn');

        return {
          success: false,
          error: "Username or email already exists",
        };
      }

      // Hash password
      const passwordHash = await hashPassword(input.password);

      // Create user
      const user = await this.userRepository.create({
        username: input.username,
        email: input.email,
        passwordHash,
      });

      // Return public user data
      const publicUser: PublicUser = {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
      };

      this.logSecurityEvent('registration_success', context, {
        userId: user.id,
        username: user.username,
      });

      return {
        success: true,
        user: publicUser,
      };
    } catch (error) {
      this.logSecurityEvent('registration_error', context, {
        username: input.username,
        email: input.email,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'error');

      return {
        success: false,
        error: "Registration failed",
      };
    }
  }

  /**
   * Authenticate user login
   */
  async login(input: LoginInput, context: AuthContext): Promise<AuthResult> {
    try {
      this.logSecurityEvent('login_attempt', context, {
        username: input.username,
      });

      // Find user by username
      const user = await this.userRepository.findByUsername(input.username);

      if (!user) {
        this.logSecurityEvent('login_failed', context, {
          username: input.username,
          reason: 'user_not_found',
        }, 'warn');

        return {
          success: false,
          error: "Invalid credentials",
        };
      }

      // Verify password
      const isValidPassword = await verifyPassword(input.password, user.passwordHash);

      if (!isValidPassword) {
        this.logSecurityEvent('login_failed', context, {
          userId: user.id,
          username: input.username,
          reason: 'invalid_password',
        }, 'warn');

        return {
          success: false,
          error: "Invalid credentials",
        };
      }

      // Update last activity
      await this.userRepository.updateLastActivity(user.id);

      // Return public user data
      const publicUser: PublicUser = {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
      };

      this.logSecurityEvent('login_success', context, {
        userId: user.id,
        username: user.username,
      });

      return {
        success: true,
        user: publicUser,
      };
    } catch (error) {
      this.logSecurityEvent('login_error', context, {
        username: input.username,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'error');

      return {
        success: false,
        error: "Login failed",
      };
    }
  }

  /**
   * Log logout event
   */
  async logout(userId: string, username: string, context: AuthContext): Promise<void> {
    this.logSecurityEvent('logout_success', context, {
      userId,
      username,
    });
  }

  /**
   * Log logout error
   */
  async logoutError(userId: string | undefined, username: string | undefined, context: AuthContext, error: any): Promise<void> {
    this.logSecurityEvent('logout_error', context, {
      userId,
      username,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 'error');
  }

  /**
   * Get user by ID for session validation
   */
  async getUserById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  /**
   * Convert user to public user data
   */
  toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
    };
  }
}