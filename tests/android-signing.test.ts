import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../scripts/verify-android-signing.sh', import.meta.url));
const cert = 'test fixture certificate bytes';
const fingerprint = createHash('sha256').update(cert).digest('hex');

function checkSignature(report: string) {
  const tmp = mkdtempSync(join(tmpdir(), 'pbp-apk-sign-test-'));
  try {
    const home = join(tmp, 'home');
    const tools = join(tmp, 'bin');
    const sdkTools = join(tmp, 'sdk', 'build-tools', '35.0.0');
    const apkDir = join(tmp, 'android', 'app', 'build', 'outputs', 'apk', 'debug');
    mkdirSync(join(home, '.android'), { recursive: true });
    mkdirSync(tools, { recursive: true });
    mkdirSync(sdkTools, { recursive: true });
    mkdirSync(apkDir, { recursive: true });
    writeFileSync(join(home, '.android', 'debug.keystore'), 'fixture key');
    writeFileSync(join(apkDir, 'app-debug.apk'), 'fixture apk');

    const keytool = join(tools, 'keytool');
    const apksigner = join(sdkTools, 'apksigner');
    writeFileSync(keytool, "#!/bin/sh\nprintf '%s' 'test fixture certificate bytes'\n");
    writeFileSync(apksigner, "#!/bin/sh\ncat <<'CERT_REPORT'\n" + report + "\nCERT_REPORT\n");
    chmodSync(keytool, 0o755);
    chmodSync(apksigner, 0o755);

    return spawnSync('bash', [SCRIPT], {
      cwd: tmp,
      env: { ...process.env, HOME: home, ANDROID_HOME: join(tmp, 'sdk'), PATH: tools + ':' + process.env.PATH },
      encoding: 'utf8',
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

test('accepts standard apksigner signer #1 certificate format', () => {
  const result = checkSignature('Signer #1 certificate SHA-256 digest: ' + fingerprint);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /APK signing verified/);
});

test('accepts modern apksigner minSdkVersion signer format, not public key digests', () => {
  const lines = [
    'Signer (minSdkVersion=24, maxSdkVersion=32) certificate SHA-256 digest: ' + fingerprint,
    'Signer (minSdkVersion=24, maxSdkVersion=32) public key SHA-256 digest: ' + 'f'.repeat(64),
  ];
  const result = checkSignature(lines.join('\n'));
  assert.equal(result.status, 0, result.stderr);
});

test('accepts Android build-tools V2 Signer certificate labels', () => {
  const lines = [
    'Verifies',
    'Verified using v2 scheme (APK Signature Scheme v2): true',
    'Number of signers: 1',
    'V2 Signer: certificate SHA-256 digest: ' + fingerprint,
    'V2 Signer: public key SHA-256 digest: ' + '0'.repeat(64),
  ];
  const result = checkSignature(lines.join('\n'));
  assert.equal(result.status, 0, result.stderr);
});

test('rejects an APK signed with another certificate', () => {
  const result = checkSignature('Signer #1 certificate SHA-256 digest: ' + '0'.repeat(64));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not match/);
});

test('rejects an output without signer certificate hashes', () => {
  const result = checkSignature('Verifies\nNumber of signers: 1');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /did not report any certificate/);
});
