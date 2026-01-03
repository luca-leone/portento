import {execSync, spawn, type ChildProcess} from 'child_process';
import {PathResolver} from '../services/PathResolver';
import {EnvironmentService} from '../services/EnvironmentService';
import {PropertyService} from '../services/PropertyService';
import {Logger} from '../utils/Logger';
import {CommandExecutionError, InvalidConfigurationError} from '../errors';
import type {Arguments} from 'yargs';
import type {InstallCommandArgs} from '../types';

export class InstallCommand {
  public static execute(args: Arguments<InstallCommandArgs>): void {
    const platform: string = args.platform || args.p;
    const environment: string = args.environment || args.e || 'dev';
    const buildType: string = args.buildType || args.t || 'prod';
    const deviceId: string | undefined = args.deviceId;

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

    Logger.info(
      `Installing ${normalizedPlatform} app for ${environment} (${buildType})`,
    );

    try {
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

      if (normalizedPlatform === 'android') {
        InstallCommand.installAndroid(deviceId);
      } else {
        InstallCommand.installIOS(deviceId);
      }

      Logger.success(`${normalizedPlatform} app installed successfully`);
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new CommandExecutionError(
        `Failed to install ${normalizedPlatform} app: ${errorMessage}`,
        {
          platform: normalizedPlatform,
          environment,
          originalError: errorMessage,
        },
      );
    }
  }

  private static installAndroid(deviceId?: string): void {
    const projectRoot: string = PathResolver.getProjectRoot();

    // If no deviceId is specified, try to find or start a device
    if (!deviceId) {
      deviceId = InstallCommand.findOrStartAndroidDevice();
    }

    const args: Array<string> = ['react-native', 'run-android'];

    if (deviceId) {
      args.push(`--device=${deviceId}`);
    }

    Logger.info('Installing Android app...');

    // Use spawn instead of execSync to properly handle streams and prevent memory leaks
    const installProcess: ChildProcess = spawn('npx', args, {
      cwd: projectRoot,
      stdio: 'pipe',
    });

    // Pipe output to console but destroy streams when done
    installProcess.stdout?.on('data', (data: Buffer) => {
      process.stdout.write(data);
    });

    installProcess.stderr?.on('data', (data: Buffer) => {
      process.stderr.write(data);
    });

    installProcess.on('close', (code: number | null) => {
      // Clean up streams
      installProcess.stdout?.destroy();
      installProcess.stderr?.destroy();
      installProcess.stdin?.destroy();

      if (code !== 0) {
        throw new CommandExecutionError(
          `React Native installation failed with exit code ${code}`,
          {exitCode: code},
        );
      }
    });

    // Wait for the process to complete synchronously
    const waitSync: () => void = (): void => {
      const buffer: SharedArrayBuffer = new SharedArrayBuffer(4);
      const view: Int32Array = new Int32Array(buffer);
      while (installProcess.exitCode === null) {
        Atomics.wait(view, 0, 0, 100); // Check every 100ms
      }
    };

    waitSync();

    // Final cleanup
    installProcess.stdout?.destroy();
    installProcess.stderr?.destroy();
    installProcess.stdin?.destroy();
  }

  private static findOrStartAndroidDevice(): string | undefined {
    try {
      // First, check if adb server is running and restart it to ensure clean state
      Logger.info('Ensuring ADB server is running...');
      try {
        execSync('adb kill-server', {stdio: 'pipe'});
      } catch {
        // Ignore if server was not running
      }
      execSync('adb start-server', {stdio: 'pipe'});

      // Check for connected devices
      const devicesOutput: string = execSync('adb devices', {
        encoding: 'utf-8',
      });
      const deviceLines: Array<string> = devicesOutput
        .split('\n')
        .slice(1)
        .filter((line: string) => line.trim() && line.includes('device'));

      if (deviceLines.length > 0) {
        // Extract first device ID
        const match: RegExpMatchArray | null =
          deviceLines[0].match(/^(\S+)\s+device/);
        if (match) {
          const firstDeviceId: string = match[1];
          Logger.info(`Found connected device: ${firstDeviceId}`);
          return firstDeviceId;
        }
      }

      // No devices connected, try to start first available emulator
      Logger.info('No devices connected, checking for available emulators...');
      const emulatorsOutput: string = execSync('emulator -list-avds', {
        encoding: 'utf-8',
      });
      const emulators: Array<string> = emulatorsOutput
        .split('\n')
        .filter((line: string) => line.trim());

      if (emulators.length > 0) {
        const firstEmulator: string = emulators[0];
        Logger.info(`Starting emulator: ${firstEmulator}`);
        Logger.info('This may take a few moments...');

        // Start emulator in background using spawn
        const emulatorProcess: ChildProcess = spawn(
          'emulator',
          ['-avd', firstEmulator],
          {
            detached: true,
            stdio: 'ignore',
          },
        );

        // Unref to allow parent process to exit independently
        emulatorProcess.unref();

        // Kill emulator process reference to avoid memory leaks
        emulatorProcess.stdout?.destroy();
        emulatorProcess.stderr?.destroy();
        emulatorProcess.stdin?.destroy();

        Logger.info('Emulator process started, waiting for device...');

        // Wait for device to be online with shorter timeout
        try {
          execSync('adb wait-for-device', {
            stdio: 'pipe',
            timeout: 60000, // 1 minute timeout (reduced from 2)
          });
        } catch (error: unknown) {
          const errorMessage: string =
            error instanceof Error ? error.message : String(error);
          Logger.warn(`Timeout waiting for emulator to boot: ${errorMessage}`);
          Logger.info(
            'The emulator is starting in the background. You can run the install command again in a few moments.',
          );
          return undefined;
        }

        // Wait for emulator to fully boot (check boot_completed property)
        Logger.info('Device detected, waiting for full boot...');

        const startTime: number = Date.now();
        const maxWaitTime: number = 45000; // 45 seconds max total wait
        const checkInterval: number = 3000; // Check every 3 seconds
        let bootCompleted: boolean = false;

        while (!bootCompleted) {
          // Safety check: total time limit
          const elapsedTime: number = Date.now() - startTime;
          if (elapsedTime > maxWaitTime) {
            Logger.warn(
              'Emulator is taking longer than expected to boot completely.',
            );
            Logger.info(
              'You can try running the install command again in a few moments.',
            );
            return undefined;
          }

          try {
            const bootStatus: string = execSync(
              'adb shell getprop sys.boot_completed',
              {encoding: 'utf-8', timeout: 5000},
            ).trim();

            if (bootStatus === '1') {
              bootCompleted = true;
              Logger.success('Emulator fully booted!');
              break;
            }

            // Calculate remaining time
            const remainingTime: number = Math.ceil(
              (maxWaitTime - elapsedTime) / 1000,
            );
            Logger.info(
              `Waiting for boot completion (${remainingTime}s remaining)...`,
            );

            // Wait before next check using Atomics.wait (blocking but safe)
            const buffer: SharedArrayBuffer = new SharedArrayBuffer(4);
            const view: Int32Array = new Int32Array(buffer);
            Atomics.wait(view, 0, 0, checkInterval);
          } catch (checkError: unknown) {
            // If we can't check boot status, emulator might not be ready yet
            // Continue waiting unless we hit the time limit
            const remainingTime: number = Math.ceil(
              (maxWaitTime - (Date.now() - startTime)) / 1000,
            );
            if (remainingTime > 0) {
              Logger.info(`Emulator starting (${remainingTime}s remaining)...`);
              const buffer: SharedArrayBuffer = new SharedArrayBuffer(4);
              const view: Int32Array = new Int32Array(buffer);
              Atomics.wait(view, 0, 0, checkInterval);
            }
          }
        }

        if (!bootCompleted) {
          return undefined;
        }

        // Get the device ID of the started emulator
        const newDevicesOutput: string = execSync('adb devices', {
          encoding: 'utf-8',
        });
        const newDeviceLines: Array<string> = newDevicesOutput
          .split('\n')
          .slice(1)
          .filter((line: string) => line.trim() && line.includes('device'));

        if (newDeviceLines.length > 0) {
          const match: RegExpMatchArray | null =
            newDeviceLines[0].match(/^(\S+)\s+device/);
          if (match) {
            const deviceId: string = match[1];
            Logger.success(`Emulator ready: ${deviceId}`);
            return deviceId;
          }
        }
      } else {
        Logger.warn(
          'No Android emulators found. Please create one in Android Studio.',
        );
      }
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      Logger.warn(`Failed to find or start Android device: ${errorMessage}`);
    }

    return undefined;
  }

  private static findFirstIOSSimulator(): string | undefined {
    try {
      Logger.info('Looking for available iOS simulators...');
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

      // Find first booted simulator, or first available simulator
      let firstAvailable: {name: string; udid: string} | undefined;

      for (const runtime of Object.keys(data.devices)) {
        const devices:
          | Array<{name: string; udid: string; state: string}>
          | undefined = data.devices[runtime];
        if (devices && devices.length > 0) {
          // Check for booted simulator first
          const booted:
            | {name: string; udid: string; state: string}
            | undefined = devices.find(
            (d: {name: string; udid: string; state: string}) =>
              d.state === 'Booted',
          );
          if (booted) {
            Logger.info(
              `Found booted simulator: ${booted.name} (${booted.udid})`,
            );
            return booted.name;
          }

          // Keep track of first available
          if (!firstAvailable && devices[0]) {
            firstAvailable = devices[0];
          }
        }
      }

      // No booted simulator, use first available and boot it
      if (firstAvailable) {
        Logger.info(`Starting simulator: ${firstAvailable.name}`);
        Logger.info('This may take a few moments...');

        execSync(`xcrun simctl boot "${firstAvailable.udid}"`, {
          stdio: 'pipe',
        });

        // Wait a bit for simulator to boot
        execSync('sleep 3', {stdio: 'pipe'});

        Logger.success(`Simulator ready: ${firstAvailable.name}`);
        return firstAvailable.name;
      }

      Logger.warn('No iOS simulators found');
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      Logger.warn(`Failed to find iOS simulator: ${errorMessage}`);
    }

    return undefined;
  }

  private static installIOS(deviceId?: string): void {
    const projectRoot: string = PathResolver.getProjectRoot();
    const iosDir: string = PathResolver.getIOSDir();

    // Run pod install first to ensure dependencies are up to date
    Logger.info('Running pod install...');
    execSync('pod deintegrate && pod install --repo-update', {
      stdio: 'inherit',
      cwd: iosDir,
    });

    // If no deviceId is specified, try to find the first available simulator
    if (!deviceId) {
      deviceId = InstallCommand.findFirstIOSSimulator();
    }

    const args: Array<string> = ['react-native', 'run-ios'];

    if (deviceId) {
      // Check if deviceId looks like a UDID (simulator) or device name
      const isUDID: boolean =
        /^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}$/i.test(
          deviceId,
        );

      if (isUDID) {
        // Simulator UDID
        args.push(`--udid=${deviceId}`);
      } else {
        // Physical device name or simulator name
        args.push(`--device=${deviceId}`);
      }
    } else {
      // No device specified and couldn't find one, use default simulator
      args.push('--simulator');
    }

    Logger.info('Installing iOS app...');

    // Use spawn instead of execSync to properly handle streams and prevent memory leaks
    const installProcess: ChildProcess = spawn('npx', args, {
      cwd: projectRoot,
      stdio: 'pipe',
    });

    // Pipe output to console but destroy streams when done
    installProcess.stdout?.on('data', (data: Buffer) => {
      process.stdout.write(data);
    });

    installProcess.stderr?.on('data', (data: Buffer) => {
      process.stderr.write(data);
    });

    installProcess.on('close', (code: number | null) => {
      // Clean up streams
      installProcess.stdout?.destroy();
      installProcess.stderr?.destroy();
      installProcess.stdin?.destroy();

      if (code !== 0) {
        throw new CommandExecutionError(
          `React Native installation failed with exit code ${code}`,
          {exitCode: code},
        );
      }
    });

    // Wait for the process to complete synchronously
    const waitSync: () => void = (): void => {
      const buffer: SharedArrayBuffer = new SharedArrayBuffer(4);
      const view: Int32Array = new Int32Array(buffer);
      while (installProcess.exitCode === null) {
        Atomics.wait(view, 0, 0, 100); // Check every 100ms
      }
    };

    waitSync();

    // Final cleanup
    installProcess.stdout?.destroy();
    installProcess.stderr?.destroy();
    installProcess.stdin?.destroy();
  }
}
