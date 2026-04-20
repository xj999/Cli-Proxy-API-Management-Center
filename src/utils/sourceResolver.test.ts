import { describe, expect, it } from 'vitest';
import {
  buildClientApiKeyDisplayMap,
  findMissingClientApiKeyIds,
  resolveClientApiKeyDisplay,
} from './sourceResolver';
import { buildClientApiKeyId } from './usage';

describe('client api key display resolution', () => {
  it('prefers configured alias over masked key', () => {
    const displayMap = buildClientApiKeyDisplayMap({
      apiKeys: ['sk-primary-123456'],
      apiKeyAliases: [{ apiKey: 'sk-primary-123456', alias: 'Primary Key' }],
    });

    expect(
      resolveClientApiKeyDisplay(
        buildClientApiKeyId('sk-primary-123456'),
        'sk******56',
        displayMap
      )
    ).toBe('Primary Key');
  });

  it('falls back to masked key when alias is not configured', () => {
    const displayMap = buildClientApiKeyDisplayMap({
      apiKeys: ['sk-secondary-abcdef'],
      apiKeyAliases: [],
    });

    expect(
      resolveClientApiKeyDisplay(
        buildClientApiKeyId('sk-secondary-abcdef'),
        'sk******ef',
        displayMap
      )
    ).toBe('sk******ef');
  });

  it('matches aliases for short client api keys that are not secret-shaped', () => {
    const displayMap = buildClientApiKeyDisplayMap({
      apiKeys: ['luxj'],
      apiKeyAliases: [{ apiKey: 'luxj', alias: 'luxj-alias' }],
    });

    expect(resolveClientApiKeyDisplay(buildClientApiKeyId('luxj'), 'lu******xj', displayMap)).toBe(
      'luxj-alias'
    );
  });

  it('uses alias when only api-key-aliases are configured', () => {
    const displayMap = buildClientApiKeyDisplayMap({
      apiKeyAliases: [{ apiKey: 'sk-alias-only-123456', alias: 'Alias Only Key' }],
    });

    expect(
      resolveClientApiKeyDisplay(
        buildClientApiKeyId('sk-alias-only-123456'),
        'sk******56',
        displayMap
      )
    ).toBe('Alias Only Key');
  });

  it('stores alias under the masked key for masked-only usage payloads', () => {
    const displayMap = buildClientApiKeyDisplayMap({
      apiKeyAliases: [{ apiKey: 'sk-masked-only-123456', alias: 'Masked Alias' }],
    });

    expect(displayMap.get('sk******56')).toBe('Masked Alias');
  });

  it('falls back to masked key when usage detail is missing client api key id', () => {
    const displayMap = buildClientApiKeyDisplayMap({
      apiKeyAliases: [{ apiKey: 'sk-alias-only-123456', alias: 'Alias Only Key' }],
    });

    expect(resolveClientApiKeyDisplay('', 'sk******56', displayMap)).toBe('sk******56');
  });

  it('finds usage client keys that are missing from the current display map', () => {
    const knownKey = 'sk-known-123456';
    const missingKey = 'sk-new-abcdef';
    const displayMap = buildClientApiKeyDisplayMap({
      apiKeys: [knownKey],
      apiKeyAliases: [{ apiKey: knownKey, alias: 'Known Key' }],
    });

    const usage = {
      apis: {
        '/v1/chat/completions': {
          models: {
            'gpt-4.1': {
              details: [
                {
                  timestamp: '2026-04-19T10:00:00Z',
                  source: 'cli',
                  client_api_key_id: buildClientApiKeyId(knownKey),
                  client_api_key_masked: 'sk******56',
                  tokens: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
                  failed: false,
                },
                {
                  timestamp: '2026-04-19T10:01:00Z',
                  source: 'cli',
                  client_api_key_id: buildClientApiKeyId(missingKey),
                  client_api_key_masked: 'sk******ef',
                  tokens: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
                  failed: false,
                },
                {
                  timestamp: '2026-04-19T10:02:00Z',
                  source: 'cli',
                  client_api_key_id: buildClientApiKeyId(missingKey),
                  client_api_key_masked: 'sk******ef',
                  tokens: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
                  failed: true,
                },
              ],
            },
          },
        },
      },
    };

    expect(findMissingClientApiKeyIds(usage, displayMap)).toEqual([buildClientApiKeyId(missingKey)]);
  });

  it('finds missing ids from camelCase usage detail fields', () => {
    const missingKey = 'sk-camel-missing-123456';
    const displayMap = buildClientApiKeyDisplayMap({
      apiKeyAliases: [{ apiKey: 'sk-known-123456', alias: 'Known Key' }],
    });

    const usage = {
      apis: {
        '/v1/chat/completions': {
          models: {
            'gpt-4.1': {
              details: [
                {
                  timestamp: '2026-04-19T10:01:00Z',
                  source: 'cli',
                  clientApiKeyId: buildClientApiKeyId(missingKey),
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

    expect(findMissingClientApiKeyIds(usage, displayMap)).toEqual([buildClientApiKeyId(missingKey)]);
  });
});
