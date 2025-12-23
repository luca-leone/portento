import {execSync} from 'child_process';
import {PathResolver} from './PathResolver';
import {IOSProjectResolver} from './IOSProjectResolver';
import type {CertificateService} from './CertificateService';
import {CommandExecutionError} from '../errors';
import {Logger} from '../utils/Logger';

export class PushNotificationService {
  private certificateService: CertificateService;

  public constructor(certificateService: CertificateService) {
    this.certificateService = certificateService;
  }

  public configureIOSPushNotifications(): void {
    if (!this.certificateService.hasPushNotificationCertificate('ios')) {
      Logger.info(
        'iOS push notification certificate not found, skipping configuration',
      );
      return;
    }

    try {
      // Copy the GoogleService-Info.plist to iOS directory
      this.certificateService.copyPushNotificationCertificate('ios');

      // Execute Ruby script to update Xcode project
      const projectName: string = IOSProjectResolver.getProjectName();
      const projectPath: string = IOSProjectResolver.getXcodeprojPath();
      const googleServiceFile: string = PathResolver.getIOSGoogleServicesFile();
      const targetName: string = projectName;

      const rubyScript: string = PathResolver.getGoogleServicesIOSRubyScript();

      const command: string = `ruby "${rubyScript}" "${projectPath}" "${googleServiceFile}" "${targetName}"`;

      Logger.info('Updating Xcode project with GoogleService-Info.plist...');
      execSync(command, {stdio: 'inherit', cwd: PathResolver.getProjectRoot()});

      Logger.success('iOS push notifications configured successfully');
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new CommandExecutionError(
        `Failed to configure iOS push notifications: ${errorMessage}`,
        {originalError: errorMessage},
      );
    }
  }

  public configureAndroidPushNotifications(): void {
    if (!this.certificateService.hasPushNotificationCertificate('android')) {
      Logger.info(
        'Android push notification certificate not found, skipping configuration',
      );
      return;
    }

    try {
      this.certificateService.copyPushNotificationCertificate('android');
      Logger.success('Android push notifications configured successfully');
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new CommandExecutionError(
        `Failed to configure Android push notifications: ${errorMessage}`,
        {originalError: errorMessage},
      );
    }
  }

  public setIOSArchiveConfiguration(buildType: 'debug' | 'prod'): void {
    try {
      const configuration: string = buildType === 'prod' ? 'Release' : 'Debug';
      const schemePath: string = IOSProjectResolver.getSchemePath();
      const rubyScript: string = PathResolver.getXcodeArchiveConfigRubyScript();

      const command: string = `ruby "${rubyScript}" "${schemePath}" "${configuration}"`;

      Logger.info(`Setting iOS archive configuration to ${configuration}...`);
      execSync(command, {stdio: 'inherit', cwd: PathResolver.getProjectRoot()});

      Logger.success(`iOS archive configuration set to ${configuration}`);
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new CommandExecutionError(
        `Failed to set iOS archive configuration: ${errorMessage}`,
        {originalError: errorMessage},
      );
    }
  }
}
