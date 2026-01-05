import {execSync, spawn, type ChildProcess} from 'child_process';
import * as readline from 'readline';
import {Logger} from '../utils/Logger';
import {CommandExecutionError, InvalidConfigurationError} from '../errors';
import type {Arguments} from 'yargs';
import type {OpenCommandArgs, AndroidEmulator, IOSSimulator} from '../types';

export class OpenCommand {
  public static execute(args: Arguments<OpenCommandArgs>): void {
    const platform: string = (args.platform || args.p) as string;

    // Validate platform
    if (!platform || !['android', 'ios'].includes(platform.toLowerCase())) {
      throw new InvalidConfigurationError(
        'Invalid platform. Must be "android" or "ios"',
        {platform},
      );
    }

    const normalizedPlatform: 'android' | 'ios' = platform.toLowerCase() as
      | 'android'
      | 'ios';

    try {
      if (normalizedPlatform === 'android') {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        OpenCommand.openAndroid();
      } else {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        OpenCommand.openIOS();
      }
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new CommandExecutionError(
        `Failed to open ${normalizedPlatform} emulator: ${errorMessage}`,
        {
          platform: normalizedPlatform,
          originalError: errorMessage,
        },
      );
    }
  }

  private static async openAndroid(): Promise<void> {
    Logger.info('Fetching Android emulators...\n');

    try {
      // First, ensure ADB server is running
      try {
        execSync('adb kill-server', {stdio: 'pipe'});
      } catch {
        // Ignore if server was not running
      }
      execSync('adb start-server', {stdio: 'pipe'});

      // Get list of available emulators
      let emulatorsOutput: string = '';
      try {
        emulatorsOutput = execSync('emulator -list-avds', {
          encoding: 'utf-8',
        });
      } catch (error: unknown) {
        const errorMessage: string =
          error instanceof Error ? error.message : String(error);
        throw new CommandExecutionError(
          `Failed to list emulators: ${errorMessage}. Make sure Android SDK emulator is in PATH.`,
          {originalError: errorMessage},
        );
      }

      const emulators: Array<AndroidEmulator> = emulatorsOutput
        .split('\n')
        .filter((line: string) => line.trim())
        .map((name: string): AndroidEmulator => ({name: name.trim()}));

      if (emulators.length === 0) {
        Logger.warn('No Android emulators found.');
        Logger.info(
          'Please create an emulator in Android Studio (AVD Manager).',
        );
        return;
      }

      // Check which emulators are already running
      const runningDevices: Set<string> = new Set<string>();
      try {
        const devicesOutput: string = execSync('adb devices', {
          encoding: 'utf-8',
        });
        const deviceLines: Array<string> = devicesOutput
          .split('\n')
          .filter(
            (line: string) =>
              line.trim() &&
              line.includes('emulator') &&
              line.includes('device'),
          );

        for (const line of deviceLines) {
          const match: RegExpMatchArray | null = line.match(/^(\S+)\s+device/);
          if (match) {
            runningDevices.add(match[1]);
          }
        }
      } catch {
        // Ignore errors when checking running devices
      }

      Logger.info('Available Android Emulators:\n');
      emulators.forEach((emulator: AndroidEmulator, index: number) => {
        const runningIndicator: string = runningDevices.size > 0 ? ' ▶' : '';
        Logger.info(`  ${index + 1}. ${emulator.name}${runningIndicator}`);
      });

      Logger.info('');

      const selectedIndex: number = await OpenCommand.promptSelection(
        'Select emulator to open (number)',
        emulators.length,
      );

      // Type is guaranteed by promptSelection validation
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const selectedEmulator: AndroidEmulator = emulators[selectedIndex];
      if (!selectedEmulator) {
        throw new CommandExecutionError('Failed to select emulator', {
          selectedIndex,
        });
      }

      Logger.info(`\nStarting emulator: ${selectedEmulator.name}`);
      Logger.info('This may take a few moments...\n');

      // Start emulator in background
      const emulatorProcess: ChildProcess = spawn(
        'emulator',
        ['-avd', selectedEmulator.name],
        {
          detached: true,
          stdio: 'ignore',
        },
      );

      // Unref to allow parent process to exit independently
      emulatorProcess.unref();

      // Clean up streams to prevent memory leaks
      emulatorProcess.stdout?.destroy();
      emulatorProcess.stderr?.destroy();
      emulatorProcess.stdin?.destroy();

      Logger.success(
        `Emulator "${selectedEmulator.name}" is starting in the background.`,
      );
    } catch (error: unknown) {
      if (error instanceof CommandExecutionError) {
        throw error;
      }
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new CommandExecutionError(
        `Failed to open Android emulator: ${errorMessage}`,
        {originalError: errorMessage},
      );
    }
  }

  private static async openIOS(): Promise<void> {
    Logger.info('Fetching iOS simulators...\n');

    try {
      const output: string = execSync(
        'xcrun simctl list devices available --json',
        {encoding: 'utf-8'},
      );

      const data: {
        devices: Record<
          string,
          Array<{name: string; udid: string; state: string}>
        >;
      } = JSON.parse(output) as {
        devices: Record<
          string,
          Array<{name: string; udid: string; state: string}>
        >;
      };

      // Collect all simulators across all runtimes
      const simulators: Array<IOSSimulator> = [];

      for (const runtime of Object.keys(data.devices)) {
        const devices:
          | Array<{name: string; udid: string; state: string}>
          | undefined = data.devices[runtime];

        if (devices && devices.length > 0) {
          for (const device of devices) {
            // Extract iOS version from runtime (e.g., "com.apple.CoreSimulator.SimRuntime.iOS-17-2" -> "iOS 17.2")
            const versionMatch: RegExpMatchArray | null =
              runtime.match(/iOS-(\d+)-(\d+)/);
            const version: string = versionMatch
              ? `iOS ${versionMatch[1]}.${versionMatch[2]}`
              : 'Unknown';

            const simulator: IOSSimulator = {
              name: device.name,
              udid: device.udid,
              state: device.state,
              runtime: version,
            };
            simulators.push(simulator);
          }
        }
      }

      if (simulators.length === 0) {
        Logger.warn('No iOS simulators found.');
        Logger.info('Please install iOS simulators in Xcode.');
        return;
      }

      Logger.info('Available iOS Simulators:\n');
      simulators.forEach((simulator: IOSSimulator, index: number) => {
        const stateIndicator: string =
          simulator.state === 'Booted' ? ' ▶ (Running)' : '';
        Logger.info(
          `  ${index + 1}. ${simulator.name} (${simulator.runtime})${stateIndicator}`,
        );
      });

      Logger.info('');

      const selectedIndex: number = await OpenCommand.promptSelection(
        'Select simulator to open (number)',
        simulators.length,
      );

      // Type is guaranteed by promptSelection validation
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const selectedSimulator: IOSSimulator = simulators[selectedIndex];

      if (!selectedSimulator) {
        throw new CommandExecutionError('Failed to select simulator', {
          selectedIndex,
        });
      }

      Logger.info(
        `\nOpening simulator: ${selectedSimulator.name} (${selectedSimulator.runtime})`,
      );

      // Check if already booted
      if (selectedSimulator.state === 'Booted') {
        Logger.info('Simulator is already running, bringing to front...\n');
      } else {
        Logger.info('This may take a few moments...\n');
      }

      // Boot the simulator if not already booted
      if (selectedSimulator.state !== 'Booted') {
        try {
          execSync(`xcrun simctl boot "${selectedSimulator.udid}"`, {
            stdio: 'pipe',
          });
        } catch (error: unknown) {
          // Ignore error if already booted
          const errorMessage: string =
            error instanceof Error ? error.message : String(error);
          if (!errorMessage.includes('current state: Booted')) {
            throw error;
          }
        }
      }

      // Open Simulator.app to bring the simulator to the front
      execSync('open -a Simulator', {stdio: 'pipe'});

      Logger.success(`Simulator "${selectedSimulator.name}" is now running.`);
    } catch (error: unknown) {
      if (error instanceof CommandExecutionError) {
        throw error;
      }
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new CommandExecutionError(
        `Failed to open iOS simulator: ${errorMessage}`,
        {originalError: errorMessage},
      );
    }
  }

  private static async promptSelection(
    message: string,
    maxNumber: number,
  ): Promise<number> {
    return new Promise(
      (
        resolve: (value: number) => void,
        reject: (reason?: unknown) => void,
      ) => {
        const rl: readline.Interface = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const askQuestion: () => void = () => {
          rl.question(`${message}: `, (answer: string) => {
            const num: number = parseInt(answer.trim(), 10);

            if (isNaN(num) || num < 1 || num > maxNumber) {
              Logger.error(
                `Invalid selection. Please enter a number between 1 and ${maxNumber}.`,
              );
              askQuestion();
            } else {
              rl.close();
              resolve(num - 1); // Convert to 0-based index
            }
          });
        };

        askQuestion();

        rl.on('close', () => {
          // If readline is closed without selection, reject
          if (rl.terminal === false) {
            reject(new Error('Input was closed without selection'));
          }
        });
      },
    );
  }
}
