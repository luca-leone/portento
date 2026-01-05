import {ManifestService} from '../services/ManifestService';
import {EnvironmentService} from '../services/EnvironmentService';
import {CertificateService} from '../services/CertificateService';
import {PushNotificationService} from '../services/PushNotificationService';
import {AndroidBuilder} from '../builders/AndroidBuilder';
import {IOSBuilder} from '../builders/IOSBuilder';
import {Logger, cleanupRegistry} from '../utils';
import {InvalidConfigurationError} from '../errors';
import type {Arguments} from 'yargs';
import type {BuildCommandArgs} from '../types';

export class BuildCommand {
  public static execute(args: Arguments<BuildCommandArgs>): void {
    const platform: string = args.platform || args.p;
    const environment: string = args.environment || args.e || 'dev';
    const buildType: string = args.buildType || args.t || 'prod';

    // Validate platform
    if (!platform || !['android', 'ios'].includes(platform.toLowerCase())) {
      throw new InvalidConfigurationError(
        'Invalid platform. Must be "android" or "ios"',
        {platform},
      );
    }

    // Validate build type
    if (!['debug', 'prod'].includes(buildType.toLowerCase())) {
      throw new InvalidConfigurationError(
        'Invalid build type. Must be "debug" or "prod"',
        {buildType},
      );
    }

    const normalizedPlatform: 'android' | 'ios' = platform.toLowerCase() as
      | 'android'
      | 'ios';
    const normalizedBuildType: 'debug' | 'prod' = buildType.toLowerCase() as
      | 'debug'
      | 'prod';

    Logger.info(
      `Building ${normalizedPlatform} app for ${environment} (${normalizedBuildType})`,
    );

    try {
      // Initialize services
      const manifestService: ManifestService = new ManifestService();
      const environmentService: EnvironmentService = new EnvironmentService();
      const certificateService: CertificateService = new CertificateService();
      const pushNotificationService: PushNotificationService =
        new PushNotificationService(certificateService);

      // Validate environment
      environmentService.validateEnvironment(environment);

      if (normalizedPlatform === 'android') {
        BuildCommand.buildAndroid(
          environment,
          normalizedBuildType,
          manifestService,
          environmentService,
          certificateService,
          pushNotificationService,
        );
      } else {
        BuildCommand.buildIOS(
          environment,
          normalizedBuildType,
          manifestService,
          environmentService,
          certificateService,
          pushNotificationService,
        );
      }

      // Clear cleanup registry after successful build
      cleanupRegistry.clear();
    } catch (error: unknown) {
      // Run cleanup handlers on error
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      cleanupRegistry.execute();
      throw error;
    }
  }

  private static buildAndroid(
    environment: string,
    buildType: 'debug' | 'prod',
    manifestService: ManifestService,
    environmentService: EnvironmentService,
    certificateService: CertificateService,
    pushNotificationService: PushNotificationService,
  ): void {
    const builder: InstanceType<typeof AndroidBuilder.Builder> =
      new AndroidBuilder.Builder(
        environment,
        buildType,
        manifestService,
        environmentService,
        certificateService,
        pushNotificationService,
      );

    builder
      .cleanProject()
      .setupKeystore()
      .updateGradleProperties()
      .configurePushNotifications()
      .updateVersion()
      .bundleJS()
      .compile()
      .exportArtifact()
      .removeTemporaryFiles()
      .build();

    // Run cleanup after successful build
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    cleanupRegistry.execute();
  }

  private static buildIOS(
    environment: string,
    buildType: 'debug' | 'prod',
    manifestService: ManifestService,
    environmentService: EnvironmentService,
    certificateService: CertificateService,
    pushNotificationService: PushNotificationService,
  ): void {
    const builder: InstanceType<typeof IOSBuilder.Builder> =
      new IOSBuilder.Builder(
        environment,
        buildType,
        manifestService,
        environmentService,
        certificateService,
        pushNotificationService,
      );

    builder
      .cleanProject()
      .setConfiguration()
      .configurePushNotifications()
      .installPods()
      .updateVersion()
      .bundleJS()
      .archive()
      .exportIPA()
      .removeTemporaryFiles()
      .build();

    // Run cleanup after successful build
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    cleanupRegistry.execute();
  }
}
