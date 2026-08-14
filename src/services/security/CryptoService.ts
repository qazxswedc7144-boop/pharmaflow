import CryptoJS from 'crypto-js';

export interface EncryptedPayload {
  ciphertext: string;
  salt: string;
  iv: string;
}

export class CryptoService {
  private static readonly ITERATIONS = 100000;
  private static readonly KEY_SIZE = 256 / 32; // 256 bits = 8 words in CryptoJS
  private static readonly SALT_BYTE_SIZE = 16; // 128 bits
  private static readonly IV_BYTE_SIZE = 16; // 128 bits

  /**
   * Encrypts a plain text string using AES-256-CBC with PBKDF2 derived key.
   *
   * @param data - Plaintext string to encrypt
   * @param password - User-provided password
   * @returns EncryptedPayload containing ciphertext, salt (hex), and iv (hex)
   */
  static encrypt(data: string, password: string): EncryptedPayload {
    if (!data) {
      throw new Error('Data to encrypt cannot be empty');
    }
    if (!password) {
      throw new Error('Password for encryption cannot be empty');
    }

    // Generate random 128-bit salt and IV
    const salt = CryptoJS.lib.WordArray.random(this.SALT_BYTE_SIZE);
    const iv = CryptoJS.lib.WordArray.random(this.IV_BYTE_SIZE);

    // Derive 256-bit key using PBKDF2 with 100,000 iterations
    const derivedKey = CryptoJS.PBKDF2(password, salt, {
      keySize: this.KEY_SIZE,
      iterations: this.ITERATIONS,
    });

    // Encrypt data using AES-CBC with PKCS7 padding
    const encrypted = CryptoJS.AES.encrypt(data, derivedKey, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    return {
      ciphertext: encrypted.toString(),
      salt: salt.toString(CryptoJS.enc.Hex),
      iv: iv.toString(CryptoJS.enc.Hex),
    };
  }

  /**
   * Decrypts an EncryptedPayload using AES-256-CBC with PBKDF2 derived key.
   *
   * @param payload - EncryptedPayload containing ciphertext, salt, and iv
   * @param password - User-provided password used during encryption
   * @returns Decrypted plain text string
   */
  static decrypt(payload: EncryptedPayload, password: string): string {
    if (!payload || !payload.ciphertext || !payload.salt || !payload.iv) {
      throw new Error('Invalid encrypted payload provided for decryption');
    }
    if (!password) {
      throw new Error('Password for decryption cannot be empty');
    }

    // Parse salt and IV from hex
    const salt = CryptoJS.enc.Hex.parse(payload.salt);
    const iv = CryptoJS.enc.Hex.parse(payload.iv);

    // Derive 256-bit key using PBKDF2 with 100,000 iterations
    const derivedKey = CryptoJS.PBKDF2(password, salt, {
      keySize: this.KEY_SIZE,
      iterations: this.ITERATIONS,
    });

    // Decrypt ciphertext using AES-CBC with PKCS7 padding
    const decrypted = CryptoJS.AES.decrypt(payload.ciphertext, derivedKey, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);

    if (!decryptedStr) {
      throw new Error('Decryption failed: Incorrect password or corrupted payload');
    }

    return decryptedStr;
  }
}
