import * as path from 'path';
import * as fs from 'fs';

export class PathResolver {
  private static projectRoot: string = process.cwd();

  public static getProjectRoot(): string {
    return this.projectRoot;
  }

  public static getEnvironmentsFile(): string {
    return path.resolve(this.projectRoot, 'environments.json');
  }

  public static getManifestFile(): string {
    return path.resolve(this.projectRoot, 'manifest.yaml');
  }

  public static getCliConfigFile(): string {
    return path.resolve(this.projectRoot, 'cli-config.json');
  }

  public static getEnvironmentsDefinitionFile(): string {
    return path.resolve(this.projectRoot, 'src', 'environments.d.ts');
  }

  public static getPropertiesFile(): string {
    return path.resolve(this.projectRoot, 'src', 'properties.ts');
  }

  public static getCertificatesDir(): string {
    return path.resolve(this.projectRoot, 'certificates');
  }

  public static getAndroidCertificatesDir(): string {
    return path.resolve(this.getCertificatesDir(), 'android');
  }

  public static getIOSCertificatesDir(): string {
    return path.resolve(this.getCertificatesDir(), 'ios');
  }

  public static getAndroidPushNotificationsCertificate(): string {
    return path.resolve(
      this.getAndroidCertificatesDir(),
      'push-notifications',
      'google-services.json',
    );
  }

  public static getIOSPushNotificationsCertificate(): string {
    return path.resolve(
      this.getIOSCertificatesDir(),
      'push-notifications',
      'GoogleService-Info.plist',
    );
  }

  public static getAndroidDir(): string {
    return path.resolve(this.projectRoot, 'android');
  }

  public static getIOSDir(): string {
    return path.resolve(this.projectRoot, 'ios');
  }

  public static getAndroidGoogleServicesFile(): string {
    return path.resolve(this.getAndroidDir(), 'app', 'google-services.json');
  }

  public static getIOSGoogleServicesFile(): string {
    return path.resolve(this.getIOSDir(), 'GoogleService-Info.plist');
  }

  public static getAndroidGradlePropertiesFile(): string {
    return path.resolve(this.getAndroidDir(), 'gradle.properties');
  }

  public static getAndroidBuildGradleFile(): string {
    return path.resolve(this.getAndroidDir(), 'app', 'build.gradle');
  }

  public static getCredentialsFile(): string {
    return path.resolve(this.getCertificatesDir(), 'credentials.yaml');
  }

  public static getAndroidKeystoreFile(): string {
    return path.resolve(this.getAndroidCertificatesDir(), 'release.keystore');
  }

  public static getDistDir(): string {
    return path.resolve(this.projectRoot, 'dist');
  }

  public static getRubyScriptsDir(): string {
    return path.resolve(__dirname, 'ruby');
  }

  public static getGoogleServicesIOSRubyScript(): string {
    return path.resolve(this.getRubyScriptsDir(), 'GoogleServicesIOS.rb');
  }

  public static getXcodeArchiveConfigRubyScript(): string {
    return path.resolve(this.getRubyScriptsDir(), 'XcodeArchiveConfig.rb');
  }

  public static ensureDistDir(): void {
    const distDir: string = this.getDistDir();
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, {recursive: true});
    }
  }

  public static fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }
}
