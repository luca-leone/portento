import * as fs from 'fs';
import * as yaml from 'yaml';
import {PathResolver} from './PathResolver';
import {ManifestParseError} from '../errors';
import type {PlatformVersion, ManifestData} from '../types';

export class ManifestService {
  private manifestData: ManifestData | null = null;

  public loadManifest(): ManifestData {
    const manifestFile: string = PathResolver.getManifestFile();

    if (!PathResolver.fileExists(manifestFile)) {
      throw new ManifestParseError(
        `manifest.yaml file not found at ${manifestFile}`,
        {filePath: manifestFile},
      );
    }

    try {
      const content: string = fs.readFileSync(manifestFile, 'utf-8');
      const data: unknown = yaml.parse(content);

      this.validateManifestStructure(data);
      this.manifestData = data as ManifestData;

      return this.manifestData;
    } catch (error: unknown) {
      if (error instanceof ManifestParseError) {
        throw error;
      }

      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new ManifestParseError(
        `Failed to parse manifest.yaml: ${errorMessage}`,
        {filePath: manifestFile, originalError: errorMessage},
      );
    }
  }

  private validateManifestStructure(data: unknown): void {
    if (typeof data !== 'object' || data === null) {
      throw new ManifestParseError(
        'manifest.yaml must contain a valid YAML object',
      );
    }

    const manifest: Record<string, unknown> = data as Record<string, unknown>;
    const requiredPlatforms: Array<string> = ['ANDROID', 'IOS'];

    for (const platform of requiredPlatforms) {
      if (!(platform in manifest)) {
        throw new ManifestParseError(
          `manifest.yaml must contain "${platform}" platform`,
          {missingPlatform: platform},
        );
      }

      const platformData: unknown = manifest[platform];
      if (typeof platformData !== 'object' || platformData === null) {
        throw new ManifestParseError(
          `Platform "${platform}" must be an object`,
          {platform},
        );
      }

      const platformConfig: Record<string, unknown> = platformData as Record<
        string,
        unknown
      >;

      if (
        !('VERSION' in platformConfig) ||
        typeof platformConfig.VERSION !== 'string'
      ) {
        throw new ManifestParseError(
          `Platform "${platform}" must contain "VERSION" as a string`,
          {platform},
        );
      }

      if (
        !('BUILD' in platformConfig) ||
        typeof platformConfig.BUILD !== 'number'
      ) {
        throw new ManifestParseError(
          `Platform "${platform}" must contain "BUILD" as a number`,
          {platform},
        );
      }
    }
  }

  public getAndroidVersion(): PlatformVersion {
    if (!this.manifestData) {
      this.loadManifest();
    }

    // After loadManifest, manifestData is guaranteed to exist
    return (this.manifestData as ManifestData).ANDROID;
  }

  public getIOSVersion(): PlatformVersion {
    if (!this.manifestData) {
      this.loadManifest();
    }

    // After loadManifest, manifestData is guaranteed to exist
    return (this.manifestData as ManifestData).IOS;
  }

  public getVersion(platform: 'android' | 'ios'): PlatformVersion {
    if (platform === 'android') {
      return this.getAndroidVersion();
    } else {
      return this.getIOSVersion();
    }
  }
}
