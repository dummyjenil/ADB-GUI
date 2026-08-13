export interface PackageInfo {
  name: string;
  package_name: string;
  version_name: string;
  version_code: string;
  size_bytes: number;
  size_formatted: string;
  app_type: 'User' | 'System';
  status: 'Enabled' | 'Disabled' | 'Running';
  uid?: string;
  apk_path: string;
  is_debuggable: boolean;
  first_install_time: string;
  last_update_time: string;
  has_apk: boolean;
}

export interface PackageDetails {
  info: PackageInfo;
  permissions: string[];
  app_ops: string[];
  activities: string[];
  services: string[];
  receivers: string[];
  providers: string[];
  raw_dump: string;
}

export type FilterOption =
  | 'all'
  | 'user'
  | 'system'
  | 'disabled'
  | 'enabled'
  | 'debuggable'
  | 'recently_installed'
  | 'running'
  | 'with_apk'
  | 'without_apk'
  | 'by_uid';

export interface RuntimePermissionInfo {
  permission: string;
  granted: boolean;
  flags: string;
}

export interface AppOpInfo {
  op: string;
  mode: string;
  raw: string;
}

export interface DetailedPermissions {
  runtime_permissions: RuntimePermissionInfo[];
  requested_permissions: string[];
  app_ops: AppOpInfo[];
}

export interface IntentExtra {
  key: string;
  value: string;
  extra_type: 'string' | 'int' | 'bool' | 'long' | 'float';
}

export interface IntentPayload {
  intent_type: 'start' | 'startservice' | 'broadcast';
  package_name?: string;
  activity_name?: string;
  action?: string;
  data_uri?: string;
  category?: string;
  extras: IntentExtra[];
  flags?: string;
}

