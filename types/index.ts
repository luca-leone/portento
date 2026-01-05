// Function types
export type VoidFunction = () => void;
export type Func<T, R> = (arg: T) => R;
export type AsyncFunc<T, R> = (arg: T) => Promise<R>;
export type AsyncVoidFunction = () => Promise<void>;

// Environment types
export type EnvironmentConfig = {
  protocol: string;
  domain: string;
  port: string;
  [key: string]: unknown;
};

export type EnvironmentsData = {
  dev: EnvironmentConfig;
  stage: EnvironmentConfig;
  prod: EnvironmentConfig;
  [key: string]: EnvironmentConfig;
};

// Manifest types
export type PlatformVersion = {
  VERSION: string;
  BUILD: number;
};

export type ManifestData = {
  ANDROID: PlatformVersion;
  IOS: PlatformVersion;
};

// Certificate types
export type CredentialsData = {
  ANDROID: {
    STORE_FILE: string;
    KEY_ALIAS: string;
    STORE_PASSWORD: string;
    KEY_PASSWORD: string;
  };
  IOS: {
    PROVISIONING_PROFILE: string;
    CODE_SIGN_IDENTITY: string;
  };
};

// Command argument types
export type StartCommandArgs = {
  environment: string;
  e: string;
};

export type BuildCommandArgs = {
  platform: string;
  p: string;
  environment: string;
  e: string;
  buildType: string;
  t: string;
};

export type InstallCommandArgs = {
  platform: string;
  p: string;
  environment: string;
  e: string;
  buildType: string;
  t: string;
  deviceId?: string;
};

export type DevicesCommandArgs = {
  list: boolean;
  l: boolean;
};

export type OpenCommandArgs = {
  platform: string;
  p: string;
};

export type AndroidEmulator = {
  name: string;
};

export type IOSSimulator = {
  name: string;
  udid: string;
  state: string;
  runtime: string;
};

export type CleanCommandArgs = Record<string, unknown>;
