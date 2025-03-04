/**
 * Script to decrypt a string using the application's encryption utility
 * 
 * Usage: npm run decrypt -- "encrypted string"
 * The decrypted string will be output to the console
 */

import { decrypt } from '../utils/encryption.js';
import { logger } from '../utils/logger.js';

/**
 * Main function to handle decryption of command line arguments
 * Takes an encrypted string and outputs the decrypted result
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    logger.error('Please provide a string to decrypt');
    logger.info('Usage: npm run decrypt -- "encrypted string"');
    process.exit(1);
  }

  const encryptedText = args[0];

  try {
    const decrypted = decrypt(encryptedText);
    logger.success(`Decrypted: ${decrypted}`);
  } catch (error: any) {
    logger.error(`Decryption failed: ${error.message}`);
    process.exit(1);
  }
}

main(); 