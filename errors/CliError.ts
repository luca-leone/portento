export class CliError extends Error {
  public code: string;
  public context?: Record<string, unknown>;

  public constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class EnvironmentValidationError extends CliError {
  public constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'ENV_VALIDATION_ERROR', context);
  }
}

export class BuildFailedError extends CliError {
  public constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'BUILD_FAILED', context);
  }
}

export class CertificateNotFoundError extends CliError {
  public constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CERTIFICATE_NOT_FOUND', context);
  }
}

export class ManifestParseError extends CliError {
  public constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'MANIFEST_PARSE_ERROR', context);
  }
}

export class CommandExecutionError extends CliError {
  public constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'COMMAND_EXECUTION_ERROR', context);
  }
}

export class InvalidConfigurationError extends CliError {
  public constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'INVALID_CONFIGURATION', context);
  }
}
