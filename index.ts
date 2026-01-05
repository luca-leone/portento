#!/usr/bin/env node

import * as fs from 'fs';
import yargs, {type Argv} from 'yargs';
import {hideBin} from 'yargs/helpers';
import figlet from 'figlet';
import {PathResolver} from './services/PathResolver';
import {Logger, cleanupRegistry} from './utils';
import {CliError} from './errors';
import {
  StartCommand,
  BuildCommand,
  InstallCommand,
  DevicesCommand,
  OpenCommand,
  CleanCommand,
} from './commands';

type CliConfig = {
  banner: {
    text: string;
    font: string;
  };
  appName: string;
};

function loadCliConfig(): CliConfig {
  try {
    const configFile: string = PathResolver.getCliConfigFile();
    if (fs.existsSync(configFile)) {
      const content: string = fs.readFileSync(configFile, 'utf-8');
      return JSON.parse(content) as CliConfig;
    }
  } catch (error: unknown) {
    Logger.warn('Failed to load CLI config, using defaults');
  }

  return {
    banner: {
      text: 'CLI',
      font: 'Standard',
    },
    appName: 'React Native App',
  };
}

function displayBanner(): void {
  const config: CliConfig = loadCliConfig();

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const banner: string = figlet.textSync(config.banner.text, {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      font: config.banner.font as any,
    });
    Logger.banner(banner);
  } catch (error: unknown) {
    Logger.banner(config.banner.text);
  }
}

function main(): void {
  displayBanner();

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  yargs(hideBin(process.argv))
    .scriptName('cli')
    .usage('Usage: $0 <command> [options]')
    .command(
      'start',
      'Start Metro bundler for development',
      (yargs: Argv) => {
        return yargs.option('environment', {
          alias: 'e',
          type: 'string',
          description: 'Environment to use',
          default: 'dev',
        });
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (args: any) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        StartCommand.execute(args as never);
      },
    )
    .command(
      'build',
      'Build the application',
      (yargs: Argv) => {
        return yargs
          .option('platform', {
            alias: 'p',
            type: 'string',
            description: 'Platform to build for (android or ios)',
            demandOption: true,
            choices: ['android', 'ios'],
          })
          .option('environment', {
            alias: 'e',
            type: 'string',
            description: 'Environment to build for',
            default: 'dev',
          })
          .option('buildType', {
            alias: 't',
            type: 'string',
            description: 'Build type (debug or prod)',
            default: 'prod',
            choices: ['debug', 'prod'],
          });
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (args: any) => {
        BuildCommand.execute(args);
      },
    )
    .command(
      'install',
      'Install and run the application on a device',
      (yargs: Argv) => {
        return yargs
          .option('platform', {
            alias: 'p',
            type: 'string',
            description: 'Platform to install on (android or ios)',
            demandOption: true,
            choices: ['android', 'ios'],
          })
          .option('environment', {
            alias: 'e',
            type: 'string',
            description: 'Environment to use',
            default: 'dev',
          })
          .option('buildType', {
            alias: 't',
            type: 'string',
            description: 'Build type (debug or prod)',
            default: 'prod',
            choices: ['debug', 'prod'],
          })
          .option('deviceId', {
            type: 'string',
            description: 'Device ID to install on (optional)',
          });
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (args: any) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        InstallCommand.execute(args);
      },
    )
    .command(
      'devices',
      'List available devices and emulators',
      (yargs: Argv) => {
        return yargs.option('list', {
          alias: 'l',
          type: 'boolean',
          description: 'List all available devices',
          default: true,
        });
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (args: any) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        DevicesCommand.execute(args);
      },
    )
    .command(
      'open',
      'Open an emulator/simulator',
      (yargs: Argv) => {
        return yargs.option('platform', {
          alias: 'p',
          type: 'string',
          description: 'Platform (android or ios)',
          demandOption: true,
          choices: ['android', 'ios'],
        });
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (args: any) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        OpenCommand.execute(args);
      },
    )
    .command(
      'clean',
      'Clean build artifacts and temporary files',
      (_yargs: Argv) => {
        return _yargs;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (args: any) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        CleanCommand.execute(args);
      },
    )
    .demandCommand(1, 'You must specify a command')
    .help('h')
    .alias('h', 'help')
    .version('2.0.0')
    .alias('v', 'version')
    .strict()
    .fail((msg: string, err: Error | undefined, yargsInstance: Argv) => {
      if (err) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        handleError(err);
      } else {
        Logger.error(msg);
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        console.log('\n' + String(yargsInstance.help()));
        process.exit(1);
      }
    })
    .parse();
}

function handleError(error: unknown): void {
  if (error instanceof CliError) {
    Logger.error(`${error.name}: ${error.message}`);

    if (error.context) {
      Logger.debug('Error context:', error.context);
    }
  } else if (error instanceof Error) {
    Logger.error(`Error: ${error.message}`);

    if (process.env.DEBUG === 'true') {
      console.error(error.stack);
    }
  } else {
    Logger.error(`Unknown error: ${String(error)}`);
  }

  // Run cleanup handlers
  try {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    cleanupRegistry.execute();
  } catch (cleanupError: unknown) {
    Logger.error('Failed to run cleanup:', cleanupError);
  }
  process.exit(1);
}

// Global error handlers
process.on('uncaughtException', (error: Error) => {
  Logger.error('Uncaught exception:');
  handleError(error);
});

process.on('unhandledRejection', (reason: unknown) => {
  Logger.error('Unhandled rejection:');
  handleError(reason);
});

// Graceful shutdown
process.on('SIGINT', () => {
  Logger.info('\nReceived SIGINT, cleaning up...');
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  cleanupRegistry.execute();
  process.exit(0);
});

process.on('SIGTERM', () => {
  Logger.info('\nReceived SIGTERM, cleaning up...');
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  cleanupRegistry.execute();
  process.exit(0);
});

// Run main
try {
  main();
} catch (error: unknown) {
  handleError(error);
}
