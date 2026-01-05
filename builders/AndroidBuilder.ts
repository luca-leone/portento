import * as fs from 'fs';
import * as path from 'path';
import {execSync} from 'child_process';
import {PathResolver} from '../services/PathResolver';
import type {ManifestService} from '../services/ManifestService';
import type {EnvironmentService} from '../services/EnvironmentService';
import type {CertificateService} from '../services/CertificateService';
import type {PushNotificationService} from '../services/PushNotificationService';
import type {PlatformVersion, CredentialsData} from '../types';
import {Logger, cleanupRegistry} from '../utils';
import {BuildFailedError} from '../errors';

type BuildType = 'debug' | 'prod';
type BundleType = 'apk' | 'aab';

export class AndroidBuilder {
  public static Builder: typeof Builder;

  private version!: string;
  private buildNumber!: number;
  private environment!: string;
  private buildType!: BuildType;

  public constructor(builder: Builder) {
    this.version = builder.version;
    this.buildNumber = builder.buildNumber;
    this.environment = builder.environment;
    this.buildType = builder.buildType;
  }

  public getVersion(): string {
    return this.version;
  }

  public getBuildNumber(): number {
    return this.buildNumber;
  }

  public getEnvironment(): string {
    return this.environment;
  }

  public getBuildType(): BuildType {
    return this.buildType;
  }
}

class Builder {
  public version!: string;
  public buildNumber!: number;
  public environment!: string;
  public buildType!: BuildType;

  private manifestService: ManifestService;
  private environmentService: EnvironmentService;
  private certificateService: CertificateService;
  private pushNotificationService: PushNotificationService;

  public constructor(
    environment: string,
    buildType: BuildType,
    manifestService: ManifestService,
    environmentService: EnvironmentService,
    certificateService: CertificateService,
    pushNotificationService: PushNotificationService,
  ) {
    this.environment = environment;
    this.buildType = buildType;
    this.manifestService = manifestService;
    this.environmentService = environmentService;
    this.certificateService = certificateService;
    this.pushNotificationService = pushNotificationService;

    const versionData: PlatformVersion =
      this.manifestService.getAndroidVersion();
    this.version = versionData.VERSION;
    this.buildNumber = versionData.BUILD;
  }

  public cleanProject(): this {
    Logger.step('Clean', 'Cleaning Android project');

    try {
      const androidDir: string = PathResolver.getAndroidDir();

      // Clean build directories
      const buildDir: string = path.resolve(androidDir, 'build');
      const appBuildDir: string = path.resolve(androidDir, 'app', 'build');

      if (fs.existsSync(buildDir)) {
        fs.rmSync(buildDir, {recursive: true, force: true});
      }

      if (fs.existsSync(appBuildDir)) {
        fs.rmSync(appBuildDir, {recursive: true, force: true});
      }

      Logger.success('Android project cleaned');
      return this;
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new BuildFailedError(
        `Failed to clean Android project: ${errorMessage}`,
      );
    }
  }

  public setupKeystore(): this {
    if (this.buildType === 'debug') {
      Logger.info('Debug build, skipping keystore setup');
      return this;
    }

    Logger.step('Keystore', 'Setting up release keystore');

    try {
      this.certificateService.copyAndroidKeystore();

      // Register cleanup handler
      cleanupRegistry.register(() => {
        this.certificateService.removeAndroidKeystore();
      });

      return this;
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new BuildFailedError(`Failed to setup keystore: ${errorMessage}`);
    }
  }

  public updateGradleProperties(): this {
    if (this.buildType === 'debug') {
      Logger.info('Debug build, skipping gradle properties update');
      return this;
    }

    Logger.step('Gradle', 'Updating gradle.properties');

    try {
      const gradlePropertiesFile: string =
        PathResolver.getAndroidGradlePropertiesFile();
      const backupFile: string = gradlePropertiesFile + '.backup';

      // Backup original file
      const originalContent: string = fs.readFileSync(
        gradlePropertiesFile,
        'utf-8',
      );
      fs.writeFileSync(backupFile, originalContent, 'utf-8');

      // Register cleanup handler
      cleanupRegistry.register(() => {
        this.restoreGradleProperties();
      });

      // Get credentials
      const credentials: CredentialsData['ANDROID'] =
        this.certificateService.getAndroidCredentials();

      // Update gradle.properties
      let content: string = originalContent;
      content = content.replace(
        /(?<=ANDROID_STORE_FILE=).*$/gm,
        credentials.STORE_FILE,
      );
      content = content.replace(
        /(?<=ANDROID_KEY_ALIAS=).*$/gm,
        credentials.KEY_ALIAS,
      );
      content = content.replace(
        /(?<=ANDROID_STORE_PASSWORD=).*$/gm,
        credentials.STORE_PASSWORD,
      );
      content = content.replace(
        /(?<=ANDROID_KEY_PASSWORD=).*$/gm,
        credentials.KEY_PASSWORD,
      );

      fs.writeFileSync(gradlePropertiesFile, content, 'utf-8');
      Logger.success('Gradle properties updated');

      return this;
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new BuildFailedError(
        `Failed to update gradle properties: ${errorMessage}`,
      );
    }
  }

  public configurePushNotifications(): this {
    Logger.step('Push Notifications', 'Configuring Android push notifications');

    try {
      this.pushNotificationService.configureAndroidPushNotifications();
      return this;
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new BuildFailedError(
        `Failed to configure push notifications: ${errorMessage}`,
      );
    }
  }

  public updateVersion(): this {
    Logger.step(
      'Version',
      `Updating version to ${this.version} (${this.buildNumber})`,
    );

    try {
      const buildGradleFile: string = PathResolver.getAndroidBuildGradleFile();
      let content: string = fs.readFileSync(buildGradleFile, 'utf-8');

      // Update versionName and versionCode
      content = content.replace(
        /(versionName\s+")([^"]+)(")/,
        `$1${this.version}$3`,
      );
      content = content.replace(
        /(versionCode\s+)(\d+)/,
        `$1${this.buildNumber}`,
      );

      fs.writeFileSync(buildGradleFile, content, 'utf-8');
      Logger.success(
        `Version updated to ${this.version} (${this.buildNumber})`,
      );

      return this;
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new BuildFailedError(`Failed to update version: ${errorMessage}`);
    }
  }

  public bundleJS(): this {
    Logger.step('Bundle', 'Bundling JavaScript code');

    try {
      // Generate application.properties
      this.environmentService.generateApplicationProperties(this.environment);

      const projectRoot: string = PathResolver.getProjectRoot();
      const rnxCli: string = path.resolve(
        projectRoot,
        'node_modules',
        '.bin',
        'rnx-cli',
      );

      const bundleDir: string = path.resolve(
        PathResolver.getAndroidDir(),
        'app',
        'src',
        'main',
        'assets',
      );
      if (!fs.existsSync(bundleDir)) {
        fs.mkdirSync(bundleDir, {recursive: true});
      }

      const sourcemapOutput: string = path.resolve(
        PathResolver.getDistDir(),
        `android-${this.environment}.map`,
      );

      const bundleOutput: string = path.join(bundleDir, 'index.android.bundle');

      const command: string = `${rnxCli} bundle --platform android --dev false --entry-file index.ts --bundle-output ${bundleOutput} --assets-dest ${bundleDir} --sourcemap-output ${sourcemapOutput}`;

      Logger.info('Running rnx-cli bundle...');
      execSync(command, {stdio: 'inherit', cwd: projectRoot});

      Logger.success('JavaScript bundle created');
      return this;
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new BuildFailedError(
        `Failed to bundle JavaScript: ${errorMessage}`,
      );
    }
  }

  public compile(): this {
    const bundleType: BundleType = this.getBundleType();
    Logger.step('Compile', `Compiling Android ${bundleType.toUpperCase()}`);

    try {
      const androidDir: string = PathResolver.getAndroidDir();
      const gradleCommand: string =
        this.buildType === 'prod' && bundleType === 'aab'
          ? './gradlew bundleRelease'
          : './gradlew assembleDebug';

      Logger.info(`Running: ${gradleCommand}`);
      execSync(gradleCommand, {stdio: 'inherit', cwd: androidDir});

      Logger.success(
        `Android ${bundleType.toUpperCase()} compiled successfully`,
      );
      return this;
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new BuildFailedError(
        `Failed to compile Android app: ${errorMessage}`,
      );
    }
  }

  public exportArtifact(): this {
    Logger.step('Export', 'Exporting build artifact');

    try {
      PathResolver.ensureDistDir();

      const bundleType: BundleType = this.getBundleType();
      const fileName: string = `v${this.version}_build_${this.buildNumber}_${this.environment.toUpperCase()}.${bundleType}`;
      const distPath: string = path.resolve(
        PathResolver.getDistDir(),
        fileName,
      );

      let sourcePath: string;

      if (this.buildType === 'prod' && bundleType === 'aab') {
        sourcePath = path.resolve(
          PathResolver.getAndroidDir(),
          'app',
          'build',
          'outputs',
          'bundle',
          'release',
          'app-release.aab',
        );
      } else if (this.buildType === 'debug' || bundleType === 'apk') {
        sourcePath = path.resolve(
          PathResolver.getAndroidDir(),
          'app',
          'build',
          'outputs',
          'apk',
          'debug',
          'app-debug.apk',
        );
      } else {
        sourcePath = path.resolve(
          PathResolver.getAndroidDir(),
          'app',
          'build',
          'outputs',
          'apk',
          'release',
          'app-release.apk',
        );
      }

      if (!fs.existsSync(sourcePath)) {
        throw new BuildFailedError(`Build artifact not found at ${sourcePath}`);
      }

      fs.copyFileSync(sourcePath, distPath);
      Logger.success(`Artifact exported to: ${distPath}`);

      return this;
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new BuildFailedError(`Failed to export artifact: ${errorMessage}`);
    }
  }

  public removeTemporaryFiles(): this {
    Logger.step('Cleanup', 'Removing temporary build files');

    try {
      const androidDir: string = PathResolver.getAndroidDir();

      // Remove build directories
      const dirsToRemove: Array<string> = [
        path.resolve(androidDir, 'build'),
        path.resolve(androidDir, 'app', 'build'),
        path.resolve(androidDir, '.gradle'),
      ];

      for (const dir of dirsToRemove) {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, {recursive: true, force: true});
          Logger.info(`Removed: ${path.basename(dir)}`);
        }
      }

      Logger.success('Temporary files removed');
      return this;
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      Logger.warn(`Failed to remove temporary files: ${errorMessage}`);
      return this;
    }
  }

  private restoreGradleProperties(): void {
    const gradlePropertiesFile: string =
      PathResolver.getAndroidGradlePropertiesFile();
    const backupFile: string = gradlePropertiesFile + '.backup';

    if (fs.existsSync(backupFile)) {
      // Read backup content
      let content: string = fs.readFileSync(backupFile, 'utf-8');

      // Replace values with xxxxxx placeholders
      content = content.replace(/(?<=ANDROID_STORE_FILE=).*$/gm, 'xxxxxx');
      content = content.replace(/(?<=ANDROID_KEY_ALIAS=).*$/gm, 'xxxxxx');
      content = content.replace(/(?<=ANDROID_STORE_PASSWORD=).*$/gm, 'xxxxxx');
      content = content.replace(/(?<=ANDROID_KEY_PASSWORD=).*$/gm, 'xxxxxx');

      // Write restored content with placeholders
      fs.writeFileSync(gradlePropertiesFile, content, 'utf-8');

      // Remove backup file
      fs.unlinkSync(backupFile);
      Logger.info('Gradle properties restored with placeholders');
    }
  }

  private getBundleType(): BundleType {
    return this.buildType === 'prod' ? 'aab' : 'apk';
  }

  public build(): AndroidBuilder {
    Logger.success('Android build completed successfully!');
    Logger.info(
      `Artifact: v${this.version}_build_${this.buildNumber}_${this.environment.toUpperCase()}.${this.getBundleType()}`,
    );

    return new AndroidBuilder(this);
  }
}

// Assign Builder class to static property after class declaration
AndroidBuilder.Builder = Builder;
