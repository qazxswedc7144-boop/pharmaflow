import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  getBlob,
  deleteObject,
  FirebaseStorage
} from 'firebase/storage';
import { app } from '@/services/firebase';
import { BackupStorageAdapter, UploadProgressCallback } from './BackupStorageAdapter';

/**
 * Concrete implementation of BackupStorageAdapter using Google Firebase Cloud Storage.
 */
export class FirebaseStorageAdapter implements BackupStorageAdapter {
  private storage: FirebaseStorage;

  constructor(customStorage?: FirebaseStorage) {
    this.storage = customStorage || getStorage(app);
  }

  /**
   * Uploads a backup package to Firebase Storage at the given path with resumable upload task.
   */
  async upload(
    path: string,
    data: Blob | ArrayBuffer | Uint8Array | string,
    onProgress?: UploadProgressCallback
  ): Promise<string> {
    const storageRef = ref(this.storage, path);

    let blob: Blob;
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
      blob = data;
    } else if (typeof data === 'string') {
      blob = new Blob([data], { type: 'application/octet-stream' });
    } else {
      blob = new Blob([data], { type: 'application/octet-stream' });
    }

    const uploadTask = uploadBytesResumable(storageRef, blob);

    return new Promise<string>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0 && onProgress) {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            onProgress(progress);
          }
        },
        (error) => {
          reject(error);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref)
            .then((downloadURL) => resolve(downloadURL))
            .catch((err) => reject(err));
        }
      );
    });
  }

  /**
   * Downloads a backup package Blob from Firebase Storage.
   */
  async download(path: string): Promise<Blob> {
    const storageRef = ref(this.storage, path);
    return await getBlob(storageRef);
  }

  /**
   * Deletes a backup package from Firebase Storage.
   */
  async delete(path: string): Promise<void> {
    const storageRef = ref(this.storage, path);
    await deleteObject(storageRef);
  }
}

export const firebaseStorageAdapter = new FirebaseStorageAdapter();
