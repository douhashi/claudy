export interface ClaudeConfig {
  version: string;
  profiles: Profile[];
  commands: CommandConfig[];
}

export interface Profile {
  name: string;
  path: string;
  settings: Record<string, unknown>;
}

export interface CommandConfig {
  name: string;
  description: string;
  path: string;
}

export interface ClaudyConfig {
  defaultProfile: string;
  profiles: {
    [key: string]: {
      path: string;
      description?: string;
    };
  };
}

export interface CommandOptions {
  verbose?: boolean;
  profile?: string;
}

export class ClaudyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ClaudyError';
  }
}