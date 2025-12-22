import type {VoidFunction} from '../types';
import {Logger} from './Logger';

type CleanupHandler = VoidFunction;

export class CleanupRegistry {
  private handlers: CleanupHandler[] = [];
  private isExecuting: boolean = false;

  public register(handler: CleanupHandler): void {
    this.handlers.push(handler);
  }

  public execute(): void {
    if (this.isExecuting) {
      return;
    }

    this.isExecuting = true;
    Logger.info('Running cleanup handlers...');

    for (const handler of this.handlers.reverse()) {
      try {
        handler();
      } catch (error: unknown) {
        const errorMessage: string =
          error instanceof Error ? error.message : String(error);
        Logger.warn(`Cleanup handler failed: ${errorMessage}`);
      }
    }

    this.handlers = [];
    this.isExecuting = false;
  }

  public clear(): void {
    this.handlers = [];
  }
}

export const cleanupRegistry: CleanupRegistry = new CleanupRegistry();
