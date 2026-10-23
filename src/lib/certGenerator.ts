/**
 * PKCS#12 certificate generator.
 *
 * All cryptographic operations run entirely in the browser using node-forge.
 * Private keys and passwords never leave the device.
 */

import forge from "node-forge";
import type { CertRow, CACredentials, GenerationResult } from "@/types";

/** 16-byte random hex serial number */
function randomSerial(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Build a forge Attribute array from a CertRow */
function buildAttributes(row: CertRow): forge.pki.CertificateField[] {
  const attrs: forge.pki.CertificateField[] = [
    { name: "commonName", value: row.commonName },
  ];
  if (row.organization) attrs.push({ name: "organizationName", value: row.organization });
  if (row.orgUnit) attrs.push({ name: "organizationalUnitName", value: row.orgUnit });
  if (row.locality) attrs.push({ name: "localityName", value: row.locality });
  if (row.state) attrs.push({ name: "stateOrProvinceName", value: row.state });
  if (row.country) attrs.push({ name: "countryName", value: row.country });
  if (row.email) attrs.push({ name: "emailAddress", value: row.email });
  return attrs;
}

/**
 * Generate one PKCS#12 (.p12) file for a single spreadsheet row.
 *
 * @param row        Validated row data
 * @param caCredentials  Optional CA credentials for Custom CA mode
 * @returns DER-encoded bytes of the .p12 file
 */
export async function generateP12(
  row: CertRow,
  caCredentials?: CACredentials
): Promise<Uint8Array> {
  // 1. Generate 2048-bit RSA key pair
  const keyPair = await new Promise<forge.pki.rsa.KeyPair>((resolve, reject) => {
    forge.pki.rsa.generateKeyPair({ bits: 2048, workers: -1 }, (err, kp) => {
      if (err) reject(err);
      else resolve(kp);
    });
  });

  // 2. Build X.509 certificate
  const cert = forge.pki.createCertificate();
  cert.publicKey = keyPair.publicKey;
  cert.serialNumber = randomSerial();

  const now = new Date();
  const notAfter = new Date(now);
  notAfter.setDate(notAfter.getDate() + row.validityDays);

  cert.validity.notBefore = now;
  cert.validity.notAfter = notAfter;

  const attrs = buildAttributes(row);
  cert.setSubject(attrs);

  // In Custom CA mode, issuer = CA; otherwise self-signed
  if (caCredentials) {
    const caCert = forge.pki.certificateFromPem(caCredentials.certPem);
    cert.setIssuer(caCert.subject.attributes);
  } else {
    cert.setIssuer(attrs);
  }

  // 3. Extensions
  cert.setExtensions([
    { name: "basicConstraints", cA: false },
    {
      name: "keyUsage",
      digitalSignature: true,
      keyEncipherment: true,
    },
    {
      name: "extKeyUsage",
      clientAuth: true,
      emailProtection: true,
    },
  ]);

  // 4. Sign
  const md = forge.md.sha256.create();
  if (caCredentials) {
    const caKey = forge.pki.privateKeyFromPem(caCredentials.keyPem);
    cert.sign(caKey, md);
  } else {
    cert.sign(keyPair.privateKey, md);
  }

  // 5. Package into PKCS#12
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keyPair.privateKey, [cert], row.p12Password, {
    algorithm: "aes256",
    generateLocalKeyId: true,
    friendlyName: row.commonName,
  } as Parameters<typeof forge.pkcs12.toPkcs12Asn1>[3]);

  // 6. Serialize to DER bytes
  // forge.util.ByteStringBuffer.getBytes() returns a binary string;
  // convert to Uint8Array via TextEncoder would mis-encode high bytes, so we
  // use charCodeAt on the raw data string instead.
  const der = forge.asn1.toDer(p12Asn1);
  const derBytes = der.getBytes();
  const bytes = new Uint8Array(derBytes.length);
  for (let i = 0; i < derBytes.length; i++) {
    bytes[i] = derBytes.charCodeAt(i);
  }
  return bytes;
}

/**
 * Batch-generate PKCS#12 files.
 *
 * Yields to the event loop between rows so the UI remains responsive.
 */
export async function generateBatch(
  rows: CertRow[],
  onProgress: (current: number, name: string) => void,
  caCredentials?: CACredentials
): Promise<GenerationResult[]> {
  const results: GenerationResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    onProgress(i + 1, row.commonName);

    // Yield to the event loop for UI responsiveness
    await new Promise<void>((r) => setTimeout(r, 20));

    try {
      const data = await generateP12(row, caCredentials);
      results.push({ index: row.index, filename: row.filename, success: true, data });
    } catch (err) {
      results.push({
        index: row.index,
        filename: row.filename,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}
