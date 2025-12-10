#!/usr/bin/env node

/**
 * Generate demo certificates for QZ Tray testing
 * Run this script to create proper certificate and key files
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('Generating QZ Tray demo certificates...\n');

// Generate a private key and public key
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});

// Export private key in PKCS8 format
const privateKeyPem = privateKey.export({
  format: 'pem',
  type: 'pkcs8',
});

// Create a self-signed certificate using openssl-style approach
// For now, we'll use a simple approach: generate the cert externally or use a library
// For demo purposes, let's create a certificate request and self-sign it

const { exec } = require('child_process');
const tempDir = path.join(__dirname, '.temp-qz');

// Create temp directory
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Write private key to temp file
const privKeyFile = path.join(tempDir, 'private.key');
fs.writeFileSync(privKeyFile, privateKeyPem);

// Generate self-signed certificate using openssl
const certFile = path.join(tempDir, 'certificate.pem');
const opensslCmd = `openssl req -new -x509 -key "${privKeyFile}" -out "${certFile}" -days 365 -subj "/C=US/ST=State/L=City/O=Org/CN=localhost"`;

exec(opensslCmd, (error, stdout, stderr) => {
  if (error) {
    console.error('Error generating certificate with openssl:', error);
    console.log('Please install openssl or use QZ Tray to generate certificates');
    console.log('\nInstead, go to QZ Tray Settings > Certificates > Export and copy the certificate');
    return;
  }

  // Read generated certificate
  const certPem = fs.readFileSync(certFile, 'utf-8');

  // Display the certificates
  console.log('=== PRIVATE KEY (PKCS8) ===\n');
  console.log(privateKeyPem);

  console.log('\n=== CERTIFICATE ===\n');
  console.log(certPem);

  // Save to files for reference
  const certDir = path.join(__dirname, 'config', 'qz-certs');
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }

  fs.writeFileSync(path.join(certDir, 'certificate.pem'), certPem);
  fs.writeFileSync(path.join(certDir, 'private-key.pem'), privateKeyPem);

  console.log('\n✓ Certificates saved to:', certDir);
  console.log('\nCopy the above Private Key and Certificate into the Accessories Settings in your app.');

  // Cleanup
  fs.rmSync(tempDir, { recursive: true });
});

