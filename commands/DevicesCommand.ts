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
      const devices: string = execSync('adb devices -l', {encoding: 'utf-8'});
      console.log(devices);
    } catch (error: unknown) {
      Logger.warn('Failed to list Android devices. Make sure adb is in PATH');
    }

    Logger.step('Android', 'Available emulators');

    try {
      const emulators: string = execSync('emulator -list-avds', {
        encoding: 'utf-8',
      });

      if (emulators.trim()) {
        console.log(emulators);
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
