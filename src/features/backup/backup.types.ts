
export interface BackupMetadata {
  id: string;
  name: string;
  date: Date;
  size: number;
  type: 'full' | 'fast';
  status: 'local' | 'cloud' | 'both';
  encryption: boolean;
  checksum: string;
  version: string;
}

export interface BackupEntry {
  metadata: BackupMetadata;
  data: string; // Encrypted data string
  blob?: Blob;
}

export interface RestoreResult {
  success: boolean;
  restoredTables: string[];
  restoredRecords?: number;
  warnings?: string[];
  version?: string;
  errorCode?: string;
  message?: string;
}

export interface RestorePlan {
  tablesToRestore: string[];
  recordCounts: Record<string, number>;
  totalRecords: number;
  warnings: string[];
  backupVersion?: string;
}

export interface BackupValidationResult {
  valid: boolean;
  version?: string;
  tables?: string[];
  recordCounts?: Record<string, number>;
  totalRecords?: number;
  warnings?: string[];
  error?: string;
  errorCode?: string;
  plan?: RestorePlan;
}

