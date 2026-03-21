/**
 * FastMCP exception hierarchy.
 *
 * Mirrors the Python FastMCP exceptions module, providing
 * structured error types for the framework.
 */

/**
 * Base error for all FastMCP errors.
 */
export class FastMCPError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FastMCPError";
  }
}

/**
 * Error raised when a component is not found.
 */
export class NotFoundError extends FastMCPError {
  constructor(
    public readonly componentType: string,
    public readonly componentName: string
  ) {
    super(`${componentType} not found: ${componentName}`);
    this.name = "NotFoundError";
  }
}

/**
 * Error raised on duplicate component registration.
 */
export class DuplicateError extends FastMCPError {
  constructor(
    public readonly componentType: string,
    public readonly componentName: string
  ) {
    super(
      `Duplicate ${componentType} registration: ${componentName}`
    );
    this.name = "DuplicateError";
  }
}

/**
 * Error raised when validation fails.
 */
export class ValidationError extends FastMCPError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Error raised when authorization fails.
 */
export class AuthorizationError extends FastMCPError {
  constructor(message: string = "Authorization failed") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Error raised when authentication fails.
 */
export class AuthenticationError extends FastMCPError {
  constructor(message: string = "Authentication failed") {
    super(message);
    this.name = "AuthenticationError";
  }
}

/**
 * Error raised when a tool execution fails.
 */
export class ToolError extends FastMCPError {
  constructor(
    public readonly toolName: string,
    message: string
  ) {
    super(`Tool '${toolName}' error: ${message}`);
    this.name = "ToolError";
  }
}

/**
 * Error raised when a resource operation fails.
 */
export class ResourceError extends FastMCPError {
  constructor(
    public readonly resourceUri: string,
    message: string
  ) {
    super(`Resource '${resourceUri}' error: ${message}`);
    this.name = "ResourceError";
  }
}

/**
 * Error raised when a prompt operation fails.
 */
export class PromptError extends FastMCPError {
  constructor(
    public readonly promptName: string,
    message: string
  ) {
    super(`Prompt '${promptName}' error: ${message}`);
    this.name = "PromptError";
  }
}

/**
 * Error raised when a transport operation fails.
 */
export class TransportError extends FastMCPError {
  constructor(message: string) {
    super(message);
    this.name = "TransportError";
  }
}

/**
 * Error raised when a middleware operation fails.
 */
export class MiddlewareError extends FastMCPError {
  constructor(message: string) {
    super(message);
    this.name = "MiddlewareError";
  }
}

/**
 * Error raised on timeout.
 */
export class TimeoutError extends FastMCPError {
  constructor(
    public readonly operationName: string,
    public readonly timeoutMs: number
  ) {
    super(
      `Operation '${operationName}' timed out after ${timeoutMs}ms`
    );
    this.name = "TimeoutError";
  }
}
