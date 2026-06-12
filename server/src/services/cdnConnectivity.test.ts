import { describe, expect, it } from 'vitest';
import { testCdnApiConnectivity } from './cdnConnectivity.js';

describe('testCdnApiConnectivity', () => {
  it('returns structured result with testedAt', async () => {
    const result = await testCdnApiConnectivity();
    expect(result).toHaveProperty('reachable');
    expect(result).toHaveProperty('testedAt');
  });
});
