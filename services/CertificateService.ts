import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import {PathResolver} from './PathResolver';
import {CertificateNotFoundError} from '../errors';
import {Logger} from '../utils/Logger';
import type {CredentialsData} from '../types';

export class CertificateService {
  private credentialsData: CredentialsData | null = null;

  public loadCredentials(): CredentialsData {
    const credentialsFile: string = PathResolver.getCredentialsFile();

    if (!PathResolver.fileExists(credentialsFile)) {
      throw new CertificateNotFoundError(
        `credentials.yaml file not found at ${credentialsFile}`,
        {filePath: credentialsFile},
      );
    }

    try {
      const content: string = fs.readFileSync(credentialsFile, 'utf-8');
      const data: unknown = yaml.parse(content);

      this.credentialsData = data as CredentialsData;
      return this.credentialsData;
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new CertificateNotFoundError(
        `Failed to parse credentials.yaml: ${errorMessage}`,
        {filePath: credentialsFile, originalError: errorMessage},
      );
    }
  }

  public getAndroidCredentials(): CredentialsData['ANDROID'] {
    if (!this.credentialsData) {
      this.loadCredentials();
    }

    // After loadCredentials, credentialsData is guaranteed to exist
    return (this.credentialsData as CredentialsData).ANDROID;
  }

  public getIOSCredentials(): CredentialsData['IOS'] {
    if (!this.credentialsData) {
      this.loadCredentials();
    }

    // After loadCredentials, credentialsData is guaranteed to exist
    return (this.credentialsData as CredentialsData).IOS;
  }

  public hasPushNotificationCertificate(platform: 'android' | 'ios'): boolean {
    if (platform === 'android') {
      return PathResolver.fileExists(
        PathResolver.getAndroidPushNotificationsCertificate(),
      );
    } else {
      return PathResolver.fileExists(
        PathResolver.getIOSPushNotificationsCertificate(),
      );
    }
  }

  public copyPushNotificationCertificate(platform: 'android' | 'ios'): void {
    if (!this.hasPushNotificationCertificate(platform)) {
      Logger.info(
        `Push notification certificate not found for ${platform}, skipping configuration`,
      );
      return;
    }

    try {
      if (platform === 'android') {
        const source: string =
          PathResolver.getAndroidPushNotificationsCertificate();
        const destination: string = PathResolver.getAndroidGoogleServicesFile();
        fs.copyFileSync(source, destination);
        Logger.info('Android push notification certificate copied');
      } else {
        const source: string =
          PathResolver.getIOSPushNotificationsCertificate();
        const destination: string = PathResolver.getIOSGoogleServicesFile();
        fs.copyFileSync(source, destination);
        Logger.info('iOS push notification certificate copied');
      }
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      Logger.warn(
        `Failed to copy push notification certificate: ${errorMessage}`,
      );
    }
  }

  public hasAndroidKeystore(): boolean {
    return PathResolver.fileExists(PathResolver.getAndroidKeystoreFile());
  }

  public copyAndroidKeystore(): void {
    if (!this.hasAndroidKeystore()) {
      throw new CertificateNotFoundError('Android keystore not found', {
        keystorePath: PathResolver.getAndroidKeystoreFile(),
      });
    }

    const source: string = PathResolver.getAndroidKeystoreFile();
    const destination: string = path.join(
      PathResolver.getAndroidDir(),
      'app',
      'release.keystore',
    );

    fs.copyFileSync(source, destination);
    Logger.info('Android keystore copied to project');
  }

  public removeAndroidKeystore(): void {
    const keystorePath: string = path.join(
      PathResolver.getAndroidDir(),
      'app',
      'release.keystore',
    );

    if (PathResolver.fileExists(keystorePath)) {
      fs.unlinkSync(keystorePath);
      Logger.info('Android keystore removed from project');
    }
  }
}
