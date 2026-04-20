import type { GeminiKeyConfig, OpenAIProviderConfig, ProviderKeyConfig } from '@/types';
import type { ApiKeyAliasConfig } from '@/types/config';
import type { CredentialInfo, SourceInfo } from '@/types/sourceInfo';
import {
  buildCandidateUsageSourceIds,
  buildClientApiKeyId,
  collectUsageDetails,
  normalizeAuthIndex,
} from '@/utils/usage';
import { maskApiKey } from './format';

export interface SourceInfoMapInput {
  geminiApiKeys?: GeminiKeyConfig[];
  claudeApiKeys?: ProviderKeyConfig[];
  codexApiKeys?: ProviderKeyConfig[];
  vertexApiKeys?: ProviderKeyConfig[];
  openaiCompatibility?: OpenAIProviderConfig[];
}

export interface ClientApiKeyDisplayMapInput {
  apiKeys?: string[];
  apiKeyAliases?: ApiKeyAliasConfig[];
}

export function buildSourceInfoMap(input: SourceInfoMapInput): Map<string, SourceInfo> {
  const map = new Map<string, SourceInfo>();

  const registerSource = (sourceId: string, displayName: string, type: string) => {
    if (!sourceId || !displayName || map.has(sourceId)) return;
    map.set(sourceId, { displayName, type });
  };

  const registerCandidates = (displayName: string, type: string, candidates: string[]) => {
    candidates.forEach((sourceId) => registerSource(sourceId, displayName, type));
  };

  const providers: Array<{
    items: Array<{ apiKey?: string; prefix?: string }>;
    type: string;
    label: string;
  }> = [
    { items: input.geminiApiKeys || [], type: 'gemini', label: 'Gemini' },
    { items: input.claudeApiKeys || [], type: 'claude', label: 'Claude' },
    { items: input.codexApiKeys || [], type: 'codex', label: 'Codex' },
    { items: input.vertexApiKeys || [], type: 'vertex', label: 'Vertex' },
  ];

  providers.forEach(({ items, type, label }) => {
    items.forEach((item, index) => {
      const displayName = item.prefix?.trim() || `${label} #${index + 1}`;
      registerCandidates(
        displayName,
        type,
        buildCandidateUsageSourceIds({ apiKey: item.apiKey, prefix: item.prefix })
      );
    });
  });

  // OpenAI 特殊处理：多 apiKeyEntries
  (input.openaiCompatibility || []).forEach((provider, providerIndex) => {
    const displayName = provider.prefix?.trim() || provider.name || `OpenAI #${providerIndex + 1}`;
    const candidates = new Set<string>();
    buildCandidateUsageSourceIds({ prefix: provider.prefix }).forEach((id) => candidates.add(id));
    (provider.apiKeyEntries || []).forEach((entry) => {
      buildCandidateUsageSourceIds({ apiKey: entry.apiKey }).forEach((id) => candidates.add(id));
    });
    registerCandidates(displayName, 'openai', Array.from(candidates));
  });

  return map;
}

export function buildClientApiKeyDisplayMap(
  input: ClientApiKeyDisplayMapInput
): Map<string, string> {
  const map = new Map<string, string>();
  const registerDisplay = (lookupKey: string, display: string) => {
    const trimmedLookupKey = lookupKey.trim();
    const trimmedDisplay = display.trim();
    if (!trimmedLookupKey || !trimmedDisplay || map.has(trimmedLookupKey)) return;
    map.set(trimmedLookupKey, trimmedDisplay);
  };

  (input.apiKeyAliases || []).forEach((entry) => {
    const rawKey = entry.apiKey.trim();
    const maskedKey = maskApiKey(entry.apiKey);
    const keyId = buildClientApiKeyId(entry.apiKey);
    const alias = entry.alias?.trim();
    if (!alias) return;
    registerDisplay(rawKey, alias);
    registerDisplay(keyId, alias);
    registerDisplay(maskedKey, alias);
  });

  (input.apiKeys || []).forEach((apiKey) => {
    const rawKey = apiKey.trim();
    const keyId = buildClientApiKeyId(apiKey);
    const maskedKey = maskApiKey(apiKey);
    registerDisplay(rawKey, maskedKey);
    registerDisplay(keyId, maskedKey);
    registerDisplay(maskedKey, maskedKey);
  });

  return map;
}

export function resolveClientApiKeyDisplay(
  clientApiKeyId: string,
  clientApiKeyMasked: string,
  displayMap: Map<string, string>
): string {
  const keyId = clientApiKeyId.trim();
  if (keyId) {
    const matched = displayMap.get(keyId);
    if (matched) return matched;
  }

  const masked = clientApiKeyMasked.trim();
  if (masked) return masked;
  return '-';
}

export function findMissingClientApiKeyIds(
  usage: unknown,
  displayMap: Map<string, string>
): string[] {
  const missing = new Set<string>();

  collectUsageDetails(usage).forEach((detail) => {
    const keyId = String(detail.client_api_key_id ?? '').trim();
    if (!keyId || displayMap.has(keyId)) return;
    missing.add(keyId);
  });

  return Array.from(missing).sort();
}

export function resolveSourceDisplay(
  sourceRaw: string,
  authIndex: unknown,
  sourceInfoMap: Map<string, SourceInfo>,
  authFileMap: Map<string, CredentialInfo>
): SourceInfo {
  const source = sourceRaw.trim();
  const matched = sourceInfoMap.get(source);
  if (matched) return matched;

  const authIndexKey = normalizeAuthIndex(authIndex);
  if (authIndexKey) {
    const authInfo = authFileMap.get(authIndexKey);
    if (authInfo) {
      return { displayName: authInfo.name || authIndexKey, type: authInfo.type };
    }
  }

  return {
    displayName: source.startsWith('t:') ? source.slice(2) : source || '-',
    type: '',
  };
}
