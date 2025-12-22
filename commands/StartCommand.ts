import {execSync} from 'child_process';
import * as path from 'path';
import {PathResolver} from '../services/PathResolver';
import {EnvironmentService} from '../services/EnvironmentService';
import {PropertyService} from '../services/PropertyService';
import {Logger} from '../utils/Logger';
import {CommandExecutionError} from '../errors';
import type {Arguments} from 'yargs';
import type {StartCommandArgs} from '../types';

export class StartCommand {
  public static execute(args: Arguments<StartCommandArgs>): void {
    const environment: string = args.environment || args.e || 'dev';

    try {
      Logger.info(`Starting Metro bundler for environment: ${environment}`);

      // Validate environment
      const environmentService: EnvironmentService = new EnvironmentService();
      environmentService.validateEnvironment(environment);

      // Generate application properties
      environmentService.generateApplicationProperties(environment);

      // Generate TypeScript definitions
      const propertyService: PropertyService = new PropertyService(
        environmentService,
      );
      propertyService.generateTypeScriptDefinitions();

      // Start Metro
      const projectRoot: string = PathResolver.getProjectRoot();
      const rnxCli: string = path.resolve(
        projectRoot,
        'node_modules',
        '.bin',
        'rnx-cli',
      );
      const command: string = `${rnxCli} start --reset-cache`;

      Logger.success('Starting Metro bundler...');
      execSync(command, {stdio: 'inherit', cwd: projectRoot});
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('SIGINT')) {
        Logger.info('Metro bundler stopped');
        return;
      }

      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new CommandExecutionError(
        `Failed to start Metro bundler: ${errorMessage}`,
        {environment, originalError: errorMessage},
      );
    }
  }
}
