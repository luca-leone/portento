import chalk from 'chalk';

export class Logger {
  public static info(message: string, ...args: unknown[]): void {
    console.log(chalk.blue('ℹ'), message, ...args);
  }

  public static success(message: string, ...args: unknown[]): void {
    console.log(chalk.green('✔'), message, ...args);
  }

  public static warn(message: string, ...args: unknown[]): void {
    console.log(chalk.yellow('⚠'), message, ...args);
  }

  public static error(message: string, ...args: unknown[]): void {
    console.error(chalk.red('✖'), message, ...args);
  }

  public static debug(message: string, ...args: unknown[]): void {
    if (process.env.DEBUG === 'true') {
      console.log(chalk.gray('🔍'), message, ...args);
    }
  }

  public static step(step: string, message: string): void {
    console.log(chalk.cyan(`[${step}]`), message);
  }

  public static banner(text: string): void {
    console.log(chalk.bold.magenta(text));
  }
}
