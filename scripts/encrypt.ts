/**
 * Script to encrypt a string using the application's encryption utility
 * 
 * Usage: npm run encrypt -- "string to encrypt"
 * The encrypted string will be output to the console
 */

import { encrypt, decrypt } from '../utils/encryption.js';
import { logger } from '../utils/logger.js';

/**
 * Main function to handle encryption of command line arguments
 * Supports both encryption and decryption operations
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    logger.error('Please provide a string to encrypt');
    logger.info('Usage: npm run encrypt -- "string to encrypt"');
    logger.info('For decryption: npm run encrypt -- --decrypt "encrypted string"');
    process.exit(1);
  }

  let operation = 'encrypt';
  let text = '';

  // Check if the first argument is a flag
  if (args[0] === '--decrypt' || args[0] === '-d') {
    operation = 'decrypt';
    text = args[1] || '';
    
    if (!text) {
      logger.error('Please provide a string to decrypt');
      process.exit(1);
    }
  } else {
    text = args[0];
  }

  try {
    if (operation === 'encrypt') {
      const encrypted = encrypt(text);
      logger.success(`Encrypted: ${encrypted}`);
    } else {
      const decrypted = decrypt(text);
      logger.success(`Decrypted: ${decrypted}`);
    }
  } catch (error: any) {
    logger.error(`Operation failed: ${error.message}`);
    process.exit(1);
  }
}

main(); 