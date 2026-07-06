
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
}
