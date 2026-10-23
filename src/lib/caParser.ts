/**
 * CA credential parser.
 * Reads a CA .p12 (or separate .crt + .key) and extracts PEM-encoded
 * certificate and private key for use in Custom CA signing mode.
 */

import forge from "node-forge";
import type { CACredentials } from "@/types";

/**
 * Parse a CA .p12 file with a password.
 */
export async function parseCAP12(file: File, password: string): Promise<CACredentials> {
  const buffer = await file.arrayBuffer();
  const der = String.fromCharCode(...new Uint8Array(buffer));
  const p12Asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

  // Extract certificate
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = certBags[forge.pki.oids.certBag]?.[0];
  if (!certBag?.cert) throw new Error("No certificate found in CA .p12 file.");
  const certPem = forge.pki.certificateToPem(certBag.cert);

  // Extract private key
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
  if (!keyBag?.key) throw new Error("No private key found in CA .p12 file.");
  const keyPem = forge.pki.privateKeyToPem(keyBag.key as forge.pki.rsa.PrivateKey);

  return { certPem, keyPem };
}

/**
 * Parse separate CA .crt (PEM) and .key (PEM) files.
 */
export async function parseCAFiles(
  certFile: File,
  keyFile: File
): Promise<CACredentials> {
  const [certPem, keyPem] = await Promise.all([
    certFile.text(),
    keyFile.text(),
  ]);
  return { certPem, keyPem };
}
