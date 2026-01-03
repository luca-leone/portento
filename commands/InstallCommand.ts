import {execSync} from 'child_process';
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

    let command: string = 'npx react-native run-android';

    if (deviceId) {
      command += ` --deviceId=${deviceId}`;
    }

    Logger.info('Installing Android app...');
    execSync(command, {stdio: 'inherit', cwd: projectRoot});
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

        // Start emulator in background
        execSync(`emulator -avd ${firstEmulator} &`, {
          stdio: 'pipe',
          shell: '/bin/bash',
        });

        // Wait for device to be online
        Logger.info('Waiting for emulator to boot...');
        execSync('adb wait-for-device', {stdio: 'pipe'});

        // Give it a few more seconds to fully boot
        execSync('sleep 5', {stdio: 'pipe'});

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

    let command: string = 'npx react-native run-ios';

    if (deviceId) {
      // Check if deviceId looks like a UDID (simulator) or device name
      const isUDID: boolean =
        /^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}$/i.test(
          deviceId,
        );

      if (isUDID) {
        // Simulator UDID
        command += ` --udid="${deviceId}"`;
      } else {
        // Physical device name or simulator name
        command += ` --device="${deviceId}"`;
      }
    } else {
      // No device specified and couldn't find one, use default simulator
      command += ' --simulator';
    }

    Logger.info('Installing iOS app...');
    execSync(command, {stdio: 'inherit', cwd: projectRoot});
  }
}
