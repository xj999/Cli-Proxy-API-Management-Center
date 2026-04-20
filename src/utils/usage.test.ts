import { describe, expect, it } from 'vitest';

import { buildClientApiKeyId, collectUsageDetails, formatCompactNumber, getApiStats } from './usage';

describe('formatCompactNumber', () => {
  it('formats values at 1B and above using B instead of M', () => {
    expect(formatCompactNumber(1_000_000_000)).toBe('1.0B');
    expect(formatCompactNumber(1_500_000_000)).toBe('1.5B');
  });

  it('uses chinese large-number units in chinese locales', () => {
    expect(formatCompactNumber(12_000, 'zh-CN')).toBe('1.2万');
    expect(formatCompactNumber(2_900_000, 'zh-CN')).toBe('290万');
    expect(formatCompactNumber(99_990_000, 'zh-CN')).toBe('9999万');
    expect(formatCompactNumber(420_000_000, 'zh-CN')).toBe('4.2亿');
    expect(formatCompactNumber(1_000_000_000, 'zh-CN')).toBe('10亿');
  });
});

describe('collectUsageDetails client api key fields', () => {
  it('keeps snake_case client api key fields', () => {
    const keyId = buildClientApiKeyId('sk-snake-123456');
    const usage = {
      apis: {
        '/v1/chat/completions': {
          models: {
            'gpt-4.1': {
              details: [
                {
                  timestamp: '2026-04-19T10:00:00Z',
                  source: 'cli',
                  client_api_key_id: keyId,
                  client_api_key_masked: 'sk******56',
                  tokens: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
                  failed: false,
                },
              ],
            },
          },
        },
      },
    };

    expect(collectUsageDetails(usage)).toEqual([
      expect.objectContaining({
        client_api_key_id: keyId,
        client_api_key_masked: 'sk******56',
      }),
    ]);
  });

  it('accepts camelCase client api key fields from usage details', () => {
    const keyId = buildClientApiKeyId('sk-camel-123456');
    const usage = {
      apis: {
        '/v1/chat/completions': {
          models: {
            'gpt-4.1': {
              details: [
                {
                  timestamp: '2026-04-19T10:00:00Z',
                  source: 'cli',
                  clientApiKeyId: keyId,
                  clientApiKeyMasked: 'sk******56',
                  tokens: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
                  failed: false,
                },
              ],
            },
          },
        },
      },
    };

    expect(collectUsageDetails(usage)).toEqual([
      expect.objectContaining({
        client_api_key_id: keyId,
        client_api_key_masked: 'sk******56',
      }),
    ]);
  });
});

describe('getApiStats client api key alias resolution', () => {
  it('uses alias when API grouping key is the raw client api key and details do not carry a client key id', () => {
    const apiKey = 'luxj';
    const usage = {
      apis: {
        [apiKey]: {
          total_requests: 1,
          total_tokens: 3,
          models: {
            'gpt-4.1': {
              total_requests: 1,
              total_tokens: 3,
              details: [
                {
                  timestamp: '2026-04-19T10:00:00Z',
                  source: 'cli',
                  tokens: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
                  failed: false,
                },
              ],
            },
          },
        },
      },
    };

    expect(
      getApiStats(usage, {}, new Map([[buildClientApiKeyId(apiKey), 'luxj-alias']]))
    ).toEqual([
      expect.objectContaining({
        endpoint: 'luxj-alias',
      }),
    ]);
  });

  it('uses alias for api details when usage details carry camelCase client api key fields', () => {
    const apiKey = 'sk-camel-api-details-123456';
    const keyId = buildClientApiKeyId(apiKey);
    const usage = {
      apis: {
        'sk******56': {
          total_requests: 1,
          total_tokens: 3,
          models: {
            'gpt-4.1': {
              total_requests: 1,
              total_tokens: 3,
              details: [
                {
                  timestamp: '2026-04-19T10:00:00Z',
                  source: 'cli',
                  clientApiKeyId: keyId,
                  clientApiKeyMasked: 'sk******56',
                  tokens: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
                  failed: false,
                },
              ],
            },
          },
        },
      },
    };

    expect(
      getApiStats(usage, {}, new Map([[keyId, 'hermes-agent']]))
    ).toEqual([
      expect.objectContaining({
        endpoint: 'hermes-agent',
      }),
    ]);
  });

  it('prefers alias for mixed snake_case, camelCase, and masked-only api detail entries', () => {
    const snakeKey = 'sk-snake-api-details-123456Zg';
    const camelKey = 'sk-camel-api-details-123456H2';
    const maskedOnlyKey = 'qi-masked-api-details-123456ng';
    const snakeKeyId = buildClientApiKeyId(snakeKey);
    const camelKeyId = buildClientApiKeyId(camelKey);

    const usage = {
      apis: {
        'sk******Zg': {
          total_requests: 1,
          total_tokens: 3,
          models: {
            'gpt-4.1': {
              total_requests: 1,
              total_tokens: 3,
              details: [
                {
                  timestamp: '2026-04-19T10:00:00Z',
                  source: 'cli',
                  client_api_key_id: snakeKeyId,
                  client_api_key_masked: 'sk******Zg',
                  tokens: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
                  failed: false,
                },
              ],
            },
          },
        },
        'sk******H2': {
          total_requests: 1,
          total_tokens: 3,
          models: {
            'gpt-4.1': {
              total_requests: 1,
              total_tokens: 3,
              details: [
                {
                  timestamp: '2026-04-19T10:01:00Z',
                  source: 'cli',
                  clientApiKeyId: camelKeyId,
                  clientApiKeyMasked: 'sk******H2',
                  tokens: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
                  failed: false,
                },
              ],
            },
          },
        },
        'qi******ng': {
          total_requests: 1,
          total_tokens: 3,
          models: {
            'gpt-4.1': {
              total_requests: 1,
              total_tokens: 3,
              details: [
                {
                  timestamp: '2026-04-19T10:02:00Z',
                  source: 'cli',
                  client_api_key_masked: 'qi******ng',
                  tokens: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
                  failed: false,
                },
              ],
            },
          },
        },
      },
    };

    expect(
      getApiStats(
        usage,
        {},
        new Map([
          [snakeKeyId, 'hermes-agent'],
          ['sk******Zg', 'hermes-agent'],
          [camelKeyId, 'luxj'],
          ['sk******H2', 'luxj'],
          [buildClientApiKeyId(maskedOnlyKey), 'qing-long'],
          ['qi******ng', 'qing-long'],
        ])
      ).map((entry) => entry.endpoint)
    ).toEqual(['hermes-agent', 'luxj', 'qing-long']);
  });
});
