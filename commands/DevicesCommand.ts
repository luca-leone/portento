import {execSync} from 'child_process';
import {Logger} from '../utils/Logger';
import {CommandExecutionError} from '../errors';
import type {Arguments} from 'yargs';
import type {DevicesCommandArgs} from '../types';

export class DevicesCommand {
  public static execute(_args: Arguments<DevicesCommandArgs>): void {
    try {
      Logger.info('Listing available devices and emulators...\n');

      DevicesCommand.listAndroidDevices();
      Logger.info(''); // Empty line
      DevicesCommand.listIOSDevices();
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new CommandExecutionError(
        `Failed to list devices: ${errorMessage}`,
        {originalError: errorMessage},
      );
    }
  }

  private static listAndroidDevices(): void {
    Logger.step('Android', 'Connected devices');

    try {
      const output: string = execSync('adb devices -l', {encoding: 'utf-8'});
      const lines: string[] = output.split('\n').filter(line => line.trim());

      // Skip first line "List of devices attached"
      const deviceLines: string[] = lines.slice(1).filter(line => line.trim());

      if (deviceLines.length === 0) {
        Logger.info('No Android devices connected');
      } else {
        Logger.info('Use the Device ID in the --deviceId parameter\n');
        deviceLines.forEach(line => {
          // Parse line format: "emulator-5554    device product:sdk_gphone64_arm64 model:Pixel_9_API_35 device:emu64a"
          const match = line.match(/^(\S+)\s+(\w+)/);
          if (match) {
            const deviceId: string = match[1];
            const status: string = match[2];

            // Extract model name if available
            const modelMatch = line.match(/model:([^\s]+)/);
            const model: string = modelMatch
              ? modelMatch[1].replace(/_/g, ' ')
              : '';

            if (status === 'device') {
              if (model) {
                console.log(`  • ${deviceId} (${model})`);
              } else {
                console.log(`  • ${deviceId}`);
              }
            }
          }
        });
      }
    } catch (error: unknown) {
      Logger.warn('Failed to list Android devices. Make sure adb is in PATH');
    }

    Logger.info(''); // Empty line
    Logger.step('Android', 'Available emulators (not running)');

    try {
      const emulators: string = execSync('emulator -list-avds', {
        encoding: 'utf-8',
      });

      if (emulators.trim()) {
        Logger.info(
          'To use these, start them first with: emulator -avd <name>\n',
        );
        emulators
          .split('\n')
          .filter(line => line.trim())
          .forEach(name => {
            console.log(`  • ${name}`);
          });
      } else {
        Logger.info('No Android emulators found');
      }
    } catch (error: unknown) {
      Logger.warn(
        'Failed to list Android emulators. Make sure emulator is in PATH',
      );
    }
  }

  private static listIOSDevices(): void {
    Logger.step('iOS', 'Available devices and simulators');

    try {
      const devices: string = execSync('xcrun xctrace list devices', {
        encoding: 'utf-8',
      });
      console.log(devices);
    } catch (error: unknown) {
      Logger.warn('Failed to list iOS devices. Make sure Xcode is installed');
    }
  }
}
