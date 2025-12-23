import * as fs from 'fs';
import * as path from 'path';
import {execSync} from 'child_process';
import {PathResolver} from '../services/PathResolver';
import {IOSProjectResolver} from '../services/IOSProjectResolver';
import type {ManifestService} from '../services/ManifestService';
import type {EnvironmentService} from '../services/EnvironmentService';
import type {CertificateService} from '../services/CertificateService';
import type {PushNotificationService} from '../services/PushNotificationService';
import type {PlatformVersion, CredentialsData} from '../types';
import {Logger, cleanupRegistry} from '../utils';
import {BuildFailedError} from '../errors';

type BuildType = 'debug' | 'prod';

export class IOSBuilder {
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

    const versionData: PlatformVersion = this.manifestService.getIOSVersion();
    this.version = versionData.VERSION;
    this.buildNumber = versionData.BUILD;
  }

  public cleanProject(): this {
    Logger.step('Clean', 'Cleaning iOS project');

    try {
      const iosDir: string = PathResolver.getIOSDir();

      // Clean build directories
      const buildDir: string = path.resolve(iosDir, 'build');
      const derivedDataDir: string = path.resolve(iosDir, 'DerivedData');
      const xcarchive: string = IOSProjectResolver.getArchivePath();
      const mainBundle: string = path.resolve(iosDir, 'main.jsbundle');
      const mainBundleMap: string = path.resolve(iosDir, 'main.jsbundle.map');
      const outDir: string = path.resolve(PathResolver.getProjectRoot(), 'out');

      const dirsToRemove: Array<string> = [
        buildDir,
        derivedDataDir,
        xcarchive,
        outDir,
      ];
      const filesToRemove: Array<string> = [mainBundle, mainBundleMap];

      for (const dir of dirsToRemove) {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, {recursive: true, force: true});
        }
      }

      for (const file of filesToRemove) {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      }

      Logger.success('iOS project cleaned');
      return this;
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new BuildFailedError(
        `Failed to clean iOS project: ${errorMessage}`,
      );
    }
  }

  public setConfiguration(): this {
    Logger.step(
      'Configuration',
      `Setting iOS configuration to ${this.buildType}`,
    );

    try {
      this.pushNotificationService.setIOSArchiveConfiguration(this.buildType);
      return this;
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new BuildFailedError(
        `Failed to set iOS configuration: ${errorMessage}`,
      );
    }
  }

  public configurePushNotifications(): this {
    Logger.step('Push Notifications', 'Configuring iOS push notifications');

    try {
      this.pushNotificationService.configureIOSPushNotifications();
      return this;
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new BuildFailedError(
        `Failed to configure push notifications: ${errorMessage}`,
      );
    }
  }

  public installPods(): this {
    Logger.step('Pods', 'Installing CocoaPods dependencies');

    try {
      const iosDir: string = PathResolver.getIOSDir();
      const command: string = 'pod deintegrate && pod install --repo-update';

      Logger.info('Running pod install...');
      execSync(command, {stdio: 'inherit', cwd: iosDir});

      Logger.success('CocoaPods dependencies installed');
      return this;
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new BuildFailedError(`Failed to install pods: ${errorMessage}`);
    }
  }

  public updateVersion(): this {
    Logger.step(
      'Version',
      `Updating version to ${this.version} (${this.buildNumber})`,
    );

    try {
      const projectName: string = IOSProjectResolver.getProjectName();
      const pbxprojFile: string = path.resolve(
        PathResolver.getIOSDir(),
        `${projectName}.xcodeproj`,
        'project.pbxproj',
      );

      let content: string = fs.readFileSync(pbxprojFile, 'utf-8');

      // Update MARKETING_VERSION and CURRENT_PROJECT_VERSION
      content = content.replaceAll(
        /MARKETING_VERSION = .*;/gm,
        `MARKETING_VERSION = ${this.version};`,
      ) as string;
      content = content.replaceAll(
        /CURRENT_PROJECT_VERSION = .*;/gm,
        `CURRENT_PROJECT_VERSION = ${this.buildNumber};`,
      ) as string;

      fs.writeFileSync(pbxprojFile, content, 'utf-8');
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
      const iosDir: string = PathResolver.getIOSDir();

      const bundleOutput: string = path.resolve(iosDir, 'main.jsbundle');
      const assetsOutput: string = iosDir;
      const sourcemapOutput: string = path.resolve(
        PathResolver.getDistDir(),
        `ios-${this.environment}.map`,
      );

      const command: string = `${rnxCli} bundle --platform ios --dev false --entry-file index.ts --bundle-output ${bundleOutput} --assets-dest ${assetsOutput} --sourcemap-output ${sourcemapOutput}`;

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

  public archive(): this {
    Logger.step('Archive', 'Creating iOS archive');

    try {
      const iosDir: string = PathResolver.getIOSDir();
      const projectName: string = IOSProjectResolver.getProjectName();
      const xcworkspace: string = `${projectName}.xcworkspace`;
      const archivePath: string = IOSProjectResolver.getArchivePath();
      const credentials: CredentialsData['IOS'] =
        this.certificateService.getIOSCredentials();
      const configuration: string =
        this.buildType === 'prod' ? 'Release' : 'Debug';

      const command: string = [
        'xcodebuild archive',
        `-workspace "${xcworkspace}"`,
        `-configuration ${configuration}`,
        `-scheme ${projectName}`,
        '-sdk iphoneos',
        `-archivePath "${archivePath}"`,
        `PROVISIONING_PROFILE="${credentials.PROVISIONING_PROFILE}"`,
        `CODE_SIGN_IDENTITY="${credentials.CODE_SIGN_IDENTITY}"`,
      ].join(' ');

      Logger.info('Running xcodebuild archive...');
      execSync(command, {stdio: 'inherit', cwd: iosDir});

      // Register cleanup handler
      cleanupRegistry.register(() => {
        if (fs.existsSync(archivePath)) {
          fs.rmSync(archivePath, {recursive: true, force: true});
          Logger.info('Removed iOS archive');
        }
      });

      Logger.success('iOS archive created');
      return this;
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new BuildFailedError(
        `Failed to create iOS archive: ${errorMessage}`,
      );
    }
  }

  public exportIPA(): this {
    Logger.step('Export', 'Exporting IPA');

    try {
      const projectRoot: string = PathResolver.getProjectRoot();
      const iosDir: string = PathResolver.getIOSDir();
      const archivePath: string = IOSProjectResolver.getArchivePath();
      const ipaFileName: string = IOSProjectResolver.getIPAFileName();
      const outDir: string = path.resolve(projectRoot, 'out');

      // Ensure out directory exists
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, {recursive: true});
      }

      const command: string = [
        'xcodebuild -exportArchive',
        `-archivePath "${archivePath}"`,
        `-exportPath "${outDir}"`,
        `-exportOptionsPlist "${iosDir}/ExportOptions.plist"`,
      ].join(' ');

      Logger.info('Running xcodebuild -exportArchive...');
      execSync(command, {stdio: 'inherit', cwd: projectRoot});

      // Move IPA to dist folder
      PathResolver.ensureDistDir();

      const fileName: string = `v${this.version}_${this.buildNumber}_${this.environment}.ipa`;
      const sourcePath: string = path.resolve(outDir, ipaFileName);
      const distPath: string = path.resolve(
        PathResolver.getDistDir(),
        fileName,
      );

      if (!fs.existsSync(sourcePath)) {
        throw new BuildFailedError(`IPA not found at ${sourcePath}`);
      }

      fs.copyFileSync(sourcePath, distPath);

      // Cleanup out directory
      if (fs.existsSync(outDir)) {
        fs.rmSync(outDir, {recursive: true, force: true});
      }

      Logger.success(`IPA exported to: ${distPath}`);
      return this;
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new BuildFailedError(`Failed to export IPA: ${errorMessage}`);
    }
  }

  public build(): IOSBuilder {
    Logger.success('iOS build completed successfully!');
    Logger.info(
      `Artifact: v${this.version}_${this.buildNumber}_${this.environment}.ipa`,
    );

    return new IOSBuilder(this);
  }
}

// Assign Builder class to static property after class declaration
IOSBuilder.Builder = Builder;
