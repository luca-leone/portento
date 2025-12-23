import * as fs from 'fs';
import * as path from 'path';
import {PathResolver} from './PathResolver';
import {InvalidConfigurationError} from '../errors';

export class IOSProjectResolver {
  private static cachedProjectName: string | null = null;

  /**
   * Find the iOS project name by scanning the ios directory for .xcodeproj or .xcworkspace
   */
  public static getProjectName(): string {
    if (this.cachedProjectName) {
      return this.cachedProjectName;
    }

    const iosDir: string = PathResolver.getIOSDir();

    if (!fs.existsSync(iosDir)) {
      throw new InvalidConfigurationError('iOS directory not found', {
        iosDir,
      });
    }

    const entries: Array<string> = fs.readdirSync(iosDir);

    // Look for .xcodeproj first
    const xcodeprojEntry: string | undefined = entries.find((entry: string) =>
      entry.endsWith('.xcodeproj'),
    );

    if (xcodeprojEntry) {
      this.cachedProjectName = path.basename(xcodeprojEntry, '.xcodeproj');
      return this.cachedProjectName;
    }

    // Fall back to .xcworkspace
    const xcworkspaceEntry: string | undefined = entries.find((entry: string) =>
      entry.endsWith('.xcworkspace'),
    );

    if (xcworkspaceEntry) {
      this.cachedProjectName = path.basename(xcworkspaceEntry, '.xcworkspace');
      return this.cachedProjectName;
    }

    throw new InvalidConfigurationError(
      'No .xcodeproj or .xcworkspace found in iOS directory',
      {iosDir},
    );
  }

  /**
   * Get the full path to the .xcodeproj directory
   */
  public static getXcodeprojPath(): string {
    const projectName: string = this.getProjectName();
    return path.join(PathResolver.getIOSDir(), `${projectName}.xcodeproj`);
  }

  /**
   * Get the full path to the .xcworkspace directory
   */
  public static getXcworkspacePath(): string {
    const projectName: string = this.getProjectName();
    return path.join(PathResolver.getIOSDir(), `${projectName}.xcworkspace`);
  }

  /**
   * Get the full path to the .xcscheme file
   */
  public static getSchemePath(): string {
    const projectName: string = this.getProjectName();
    const xcodeprojPath: string = this.getXcodeprojPath();
    return path.join(
      xcodeprojPath,
      'xcshareddata',
      'xcschemes',
      `${projectName}.xcscheme`,
    );
  }

  /**
   * Get the full path to the .xcarchive directory
   */
  public static getArchivePath(): string {
    const projectName: string = this.getProjectName();
    return path.join(PathResolver.getIOSDir(), `${projectName}.xcarchive`);
  }

  /**
   * Get the full path to the project's entitlements file
   */
  public static getEntitlementsPath(): string {
    const projectName: string = this.getProjectName();
    return path.join(
      PathResolver.getIOSDir(),
      projectName,
      `${projectName}.entitlements`,
    );
  }

  /**
   * Get the IPA file name based on project name
   */
  public static getIPAFileName(): string {
    const projectName: string = this.getProjectName();
    return `${projectName}.ipa`;
  }

  /**
   * Clear the cached project name (useful for testing)
   */
  public static clearCache(): void {
    this.cachedProjectName = null;
  }
}
