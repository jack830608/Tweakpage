import { expect, test } from 'vitest';
import { signRequest } from './sigv4';

/**
 * AWS publishes worked examples for SigV4. The expected signature here is their
 * constant, independently reproduced before it was written down, so this test measures
 * the implementation rather than agreeing with it.
 */
test('reproduces the AWS "PUT Object" example signature', async () => {
  const { headers } = await signRequest({
    method: 'PUT',
    url: new URL('https://examplebucket.s3.amazonaws.com/test%24file.text'),
    region: 'us-east-1',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    body: 'Welcome to Amazon S3.',
    headers: {
      date: 'Fri, 24 May 2013 00:00:00 GMT',
      'x-amz-storage-class': 'REDUCED_REDUNDANCY',
    },
    now: new Date(Date.UTC(2013, 4, 24)),
  });

  expect(headers['x-amz-content-sha256']).toBe(
    '44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072',
  );
  expect(headers.Authorization).toContain(
    'Signature=98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd',
  );
  expect(headers.Authorization).toContain(
    'Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request',
  );
  expect(headers.Authorization).toContain(
    'SignedHeaders=date;host;x-amz-content-sha256;x-amz-date;x-amz-storage-class',
  );
});

test('the secret never leaves the machine — only a signature does', async () => {
  const secret = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
  const { headers } = await signRequest({
    method: 'PUT',
    url: new URL('https://b.s3.ap-northeast-1.amazonaws.com/tweakpage/abc.json'),
    region: 'ap-northeast-1',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: secret,
    body: '{}',
  });
  expect(JSON.stringify(headers)).not.toContain(secret);
});

test('a GET is signed with the hash of an empty body', async () => {
  const { headers } = await signRequest({
    method: 'GET',
    url: new URL('https://b.s3.ap-northeast-1.amazonaws.com/tweakpage/abc.json'),
    region: 'ap-northeast-1',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'secret',
  });
  // The published hash of the empty string, which S3 expects for a bodyless request.
  expect(headers['x-amz-content-sha256']).toBe(
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  );
});
