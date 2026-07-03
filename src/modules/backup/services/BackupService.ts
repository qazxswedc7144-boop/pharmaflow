
import JSZip from 'jszip';
import CryptoJS from 'crypto-js';
import { BackupMetadata, BackupEntry } from '../backup.types';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { app } from '@/services/firebase';
import { db } from '@/core/db';

export class BackupService {
  private storage = getStorage(app);

  async createLocalBackup(data: any, type: 'full' | 'fast' = 'full'): Promise<BackupEntry> {
    const serializedData = JSON.stringify(data);
    const encryptionKey = import.meta.env.VITE_BACKUP_ENCRYPTION_KEY || 'default_key';
    const encryptedData = CryptoJS.AES.encrypt(serializedData, encryptionKey).toString();
    
    const zip = new JSZip();
    zip.file("data.enc", encryptedData);
    const content = await zip.generateAsync({ type: "blob" });

    const metadata: BackupMetadata = {
      id: crypto.randomUUID(),
      name: `PharmaFlow_Backup_${new Date().toISOString().replace(/:/g, '-')}.pfb`,
      date: new Date(),
      size: content.size,
      type,
      status: 'local',
      encryption: true,
      checksum: await this.calculateChecksum(encryptedData),
      version: '1.0.0'
    };

    // Save to Dexie
    await db.systemBackups.add({
        id: metadata.id,
        backupName: metadata.name,
        createdAt: metadata.date.toISOString(),
        backupType: metadata.type
    });

    return { metadata, data: encryptedData };
  }

  async uploadToCloud(backup: BackupEntry): Promise<string> {
    const storageRef = ref(this.storage, `backups/${backup.metadata.name}`);
    const blob = new Blob([backup.data], { type: 'application/octet-stream' });
    const uploadTask = uploadBytesResumable(storageRef, blob);

    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`Upload is ${progress}% done`);
        },
        (error) => reject(error),
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            resolve(downloadURL);
          });
        }
      );
    });
  }

  private async calculateChecksum(data: string): Promise<string> {
    return CryptoJS.SHA256(data).toString();
  }
}

export const backupService = new BackupService();
