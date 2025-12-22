import * as fs from 'fs';
import {PathResolver} from './PathResolver';
import {EnvironmentValidationError} from '../errors';
import {Logger} from '../utils/Logger';
import type {EnvironmentConfig, EnvironmentsData} from '../types';

export class EnvironmentService {
  private environmentsData: EnvironmentsData | null = null;

  public loadEnvironments(): EnvironmentsData {
    const environmentsFile: string = PathResolver.getEnvironmentsFile();

    if (!PathResolver.fileExists(environmentsFile)) {
      throw new EnvironmentValidationError(
        `environments.json file not found at ${environmentsFile}`,
        {filePath: environmentsFile},
      );
    }

    try {
      const content: string = fs.readFileSync(environmentsFile, 'utf-8');
      const data: unknown = JSON.parse(content);

      this.validateEnvironmentsStructure(data);
      this.environmentsData = data as EnvironmentsData;

      return this.environmentsData;
    } catch (error: unknown) {
      if (error instanceof EnvironmentValidationError) {
        throw error;
      }

      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new EnvironmentValidationError(
        `Failed to parse environments.json: ${errorMessage}`,
        {filePath: environmentsFile, originalError: errorMessage},
      );
    }
  }

  private validateEnvironmentsStructure(data: unknown): void {
    if (typeof data !== 'object' || data === null) {
      throw new EnvironmentValidationError(
        'environments.json must contain a valid JSON object',
      );
    }

    const environments: Record<string, unknown> = data as Record<
      string,
      unknown
    >;
    const requiredKeys: Array<string> = ['dev', 'stage', 'prod'];

    for (const key of requiredKeys) {
      if (!(key in environments)) {
        throw new EnvironmentValidationError(
          `environments.json must contain "${key}" environment`,
          {missingKey: key},
        );
      }

      const env: unknown = environments[key];
      if (typeof env !== 'object' || env === null) {
        throw new EnvironmentValidationError(
          `Environment "${key}" must be an object`,
          {key},
        );
      }

      const envConfig: Record<string, unknown> = env as Record<string, unknown>;
      const requiredProps: Array<string> = ['protocol', 'domain', 'port'];

      for (const prop of requiredProps) {
        if (!(prop in envConfig)) {
          throw new EnvironmentValidationError(
            `Environment "${key}" must contain "${prop}" property`,
            {key, missingProperty: prop},
          );
        }

        if (typeof envConfig[prop] !== 'string') {
          throw new EnvironmentValidationError(
            `Environment "${key}.${prop}" must be a string`,
            {key, property: prop},
          );
        }
      }
    }
  }

  public validateEnvironment(environment: string): void {
    if (!this.environmentsData) {
      this.loadEnvironments();
    }

    if (!this.environmentsData || !(environment in this.environmentsData)) {
      const availableEnvs: Array<string> = this.environmentsData
        ? Object.keys(this.environmentsData)
        : [];

      throw new EnvironmentValidationError(
        `Invalid environment "${environment}". Available environments: ${availableEnvs.join(', ')}`,
        {environment, availableEnvironments: availableEnvs},
      );
    }
  }

  public getEnvironmentConfig(environment: string): EnvironmentConfig {
    this.validateEnvironment(environment);
    // After validateEnvironment, environmentsData is guaranteed to be loaded
    return (this.environmentsData as EnvironmentsData)[environment];
  }

  public getAllEnvironments(): Array<string> {
    if (!this.environmentsData) {
      this.loadEnvironments();
    }

    // After loadEnvironments, environmentsData is guaranteed to exist
    return Object.keys(this.environmentsData as EnvironmentsData);
  }

  public generateApplicationProperties(environment: string): void {
    if (!this.environmentsData) {
      this.loadEnvironments();
    }

    this.validateEnvironment(environment);
    this.generatePropertiesModule(environment);

    Logger.success(`Environment "${environment}" properties generated`);
  }

  private generatePropertiesModule(environment: string): void {
    const envData: EnvironmentsData = this.environmentsData as EnvironmentsData;
    const config: EnvironmentConfig = envData[environment];

    const header: string = [
      '// DO NOT HANDLE THIS FILE MANUALLY!',
      '// This file has been generated via CLI before the application starts/build',
      '// Environment variables are declared in environments.json',
      `// Current environment: ${environment}`,
      '',
    ].join('\n');

    // Add environment constant first
    const exports: Array<string> = [
      `export const environment: string = '${environment}';`,
    ];

    // Add all config properties
    Object.keys(config).forEach((key: string) => {
      const value: unknown = config[key];
      const stringValue: string =
        typeof value === 'string' ? `'${value}'` : String(value);
      exports.push(`export const ${key}: string = ${stringValue};`);
    });

    const content: string = `${header}${exports.join('\n')}\n`;

    const propertiesFile: string = PathResolver.getPropertiesFile();
    fs.writeFileSync(propertiesFile, content, {encoding: 'utf-8'});
  }
}
