import crypto from 'crypto';
import { logger } from './logger';

// The encryption key should be a 32-byte key (256 bits)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';
const IV_LENGTH = 16; // For AES, this is always 16 bytes

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  logger.error('ENCRYPTION_KEY must be set in environment variables and must be 32 characters long');
  process.exit(1);
}

/**
 * Encrypts a string using AES-256-CBC
 * @param text The text to encrypt
 * @returns The encrypted text as a base64 string
 */
export function encrypt(text: string): string {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Prepend the IV to the encrypted data
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    logger.error(`Encryption error: ${error}`);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypts a string that was encrypted using AES-256-CBC
 * @param encryptedText The encrypted text (IV:encryptedData)
 * @returns The decrypted text
 */
export function decrypt(encryptedText: string): string {
  try {
    const textParts = encryptedText.split(':');
    if (textParts.length !== 2) {
      throw new Error('Invalid encrypted text format');
    }
    
    const iv = Buffer.from(textParts[0], 'hex');
    const encryptedData = textParts[1];
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error(`Decryption error: ${error}`);
    throw new Error('Failed to decrypt data');
  }
} 