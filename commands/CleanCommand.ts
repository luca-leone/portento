import * as fs from 'fs';
import * as path from 'path';
import {execSync} from 'child_process';
import {PathResolver} from '../services/PathResolver';
import {CertificateService} from '../services/CertificateService';
import {Logger} from '../utils/Logger';
import {CommandExecutionError} from '../errors';
import type {Arguments} from 'yargs';
import type {CleanCommandArgs} from '../types';

export class CleanCommand {
  public static execute(_args: Arguments<CleanCommandArgs>): void {
    try {
      Logger.info('Cleaning project build artifacts...');

      CleanCommand.cleanAndroid();
      CleanCommand.cleanIOS();
      CleanCommand.cleanGeneral();

      Logger.success('Project cleaned successfully');
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      throw new CommandExecutionError(
        `Failed to clean project: ${errorMessage}`,
        {originalError: errorMessage},
      );
    }
  }

  private static cleanAndroid(): void {
    Logger.step('Android', 'Cleaning Android build artifacts');

    try {
      const androidDir: string = PathResolver.getAndroidDir();

      // Remove build directories
      const dirsToRemove: Array<string> = [
        path.resolve(androidDir, 'build'),
        path.resolve(androidDir, 'app', 'build'),
        path.resolve(androidDir, '.gradle'),
        path.resolve(androidDir, 'app', '.cxx'),
      ];

      for (const dir of dirsToRemove) {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, {recursive: true, force: true});
          Logger.info(`Removed: ${path.basename(dir)}`);
        }
      }

      // Remove Android files
      const filesToRemove: Array<string> = [
        path.resolve(androidDir, 'app', 'google-services.json'),
        path.resolve(
          androidDir,
          'app',
          'src',
          'main',
          'assets',
          'index.android.bundle',
        ),
        path.resolve(
          androidDir,
          'app',
          'src',
          'main',
          'assets',
          'index.android.bundle.map',
        ),
      ];

      for (const file of filesToRemove) {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          Logger.info(`Removed: ${path.basename(file)}`);
        }
      }

      // Clean Android resources (files with node_modules in their name)
      CleanCommand.cleanAndroidResources();

      // Remove keystore if exists
      const certificateService: CertificateService = new CertificateService();
      certificateService.removeAndroidKeystore();

      // Restore gradle.properties if backup exists
      const gradlePropertiesFile: string =
        PathResolver.getAndroidGradlePropertiesFile();
      const backupFile: string = gradlePropertiesFile + '.backup';

      if (fs.existsSync(backupFile)) {
        const backupContent: string = fs.readFileSync(backupFile, 'utf-8');
        fs.writeFileSync(gradlePropertiesFile, backupContent, 'utf-8');
        fs.unlinkSync(backupFile);
        Logger.info('Restored gradle.properties');
      }

      Logger.success('Android artifacts cleaned');
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      Logger.warn(`Failed to clean Android artifacts: ${errorMessage}`);
    }
  }

  private static cleanAndroidResources(): void {
    try {
      const androidResourceDir: string = path.resolve(
        PathResolver.getAndroidDir(),
        'app',
        'src',
        'main',
        'res',
      );

      if (!fs.existsSync(androidResourceDir)) {
        return;
      }

      const traverseAndClean: (dir: string) => void = (dir: string): void => {
        const entries: Array<string> = fs.readdirSync(dir);

        for (const entry of entries) {
          const fullPath: string = path.resolve(dir, entry);
          const stat: fs.Stats = fs.lstatSync(fullPath);

          if (stat.isDirectory()) {
            traverseAndClean(fullPath);
          } else if (entry.includes('node_modules')) {
            fs.unlinkSync(fullPath);
            Logger.info(`Removed resource: ${entry}`);
          }
        }
      };

      traverseAndClean(androidResourceDir);
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      Logger.warn(`Failed to clean Android resources: ${errorMessage}`);
    }
  }

  private static cleanIOS(): void {
    Logger.step('iOS', 'Cleaning iOS build artifacts');

    try {
      const iosDir: string = PathResolver.getIOSDir();
      const projectRoot: string = PathResolver.getProjectRoot();

      // Remove build directories
      const dirsToRemove: Array<string> = [
        path.resolve(iosDir, 'build'),
        path.resolve(iosDir, 'DerivedData'),
        path.resolve(iosDir, 'InSchool.xcarchive'),
        path.resolve(iosDir, 'Pods'),
        path.resolve(iosDir, 'assets'),
        path.resolve(projectRoot, 'out'),
        path.resolve(projectRoot, 'vendors'),
      ];

      const filesToRemove: Array<string> = [
        path.resolve(iosDir, 'main.jsbundle'),
        path.resolve(iosDir, 'main.jsbundle.map'),
        path.resolve(iosDir, 'Podfile.lock'),
        path.resolve(projectRoot, 'Gemfile.lock'),
      ];

      for (const dir of dirsToRemove) {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, {recursive: true, force: true});
          Logger.info(`Removed: ${path.basename(dir)}`);
        }
      }

      for (const file of filesToRemove) {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          Logger.info(`Removed: ${path.basename(file)}`);
        }
      }

      Logger.success('iOS artifacts cleaned');
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      Logger.warn(`Failed to clean iOS artifacts: ${errorMessage}`);
    }
  }

  private static cleanGeneral(): void {
    Logger.step('General', 'Cleaning general build artifacts');

    try {
      const projectRoot: string = PathResolver.getProjectRoot();

      // Remove node_modules
      const nodeModulesDir: string = path.resolve(projectRoot, 'node_modules');
      if (fs.existsSync(nodeModulesDir)) {
        Logger.info('Removing node_modules directory...');
        // Use Node.js rmSync with force option for complete removal
        fs.rmSync(nodeModulesDir, {
          recursive: true,
          force: true,
          maxRetries: 3,
        });

        // Verify it's actually gone
        if (fs.existsSync(nodeModulesDir)) {
          // Fallback to system rm command if still exists
          execSync(`rm -rf "${nodeModulesDir}"`, {
            stdio: 'pipe',
            cwd: projectRoot,
          });
        }
        Logger.info('Removed: node_modules');
      }

      // Remove lock files
      const lockFiles: Array<string> = [
        path.resolve(projectRoot, 'yarn.lock'),
        path.resolve(projectRoot, 'package-lock.json'),
      ];

      for (const lockFile of lockFiles) {
        if (fs.existsSync(lockFile)) {
          fs.unlinkSync(lockFile);
          Logger.info(`Removed: ${path.basename(lockFile)}`);
        }
      }

      Logger.success('General artifacts cleaned');
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error);
      Logger.warn(`Failed to clean general artifacts: ${errorMessage}`);
    }
  }
}
