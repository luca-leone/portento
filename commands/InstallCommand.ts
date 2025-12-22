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
    let command: string = 'npx react-native run-android';

    if (deviceId) {
      command += ` --deviceId=${deviceId}`;
    }

    Logger.info('Installing Android app...');
    execSync(command, {stdio: 'inherit', cwd: projectRoot});
  }

  private static installIOS(deviceId?: string): void {
    const projectRoot: string = PathResolver.getProjectRoot();
    const iosDir: string = PathResolver.getIOSDir();

    // Install pods first
    Logger.info('Installing iOS dependencies (pod install)...');
    try {
      execSync('pod install', {stdio: 'inherit', cwd: iosDir});
    } catch (error: unknown) {
      Logger.warn('Pod install failed, continuing with installation...');
    }

    let command: string = 'npx react-native run-ios';

    if (deviceId) {
      command += ` --device="${deviceId}"`;
    }

    Logger.info('Installing iOS app...');
    execSync(command, {stdio: 'inherit', cwd: projectRoot});
  }
}
