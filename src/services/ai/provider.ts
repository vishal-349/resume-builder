/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Provider selection — the single swap point.
 *
 * This is the ONLY module that decides which AI backend is in use. To adopt a
 * different vendor, add an adapter implementing `AIProvider` and register it
 * here; nothing else in the application changes.
 */

import { resolveAIConfig, type AIConfig } from './config';
import { GeminiProvider } from './gemini';
import { ProxyProvider } from './proxy';
import type { AIProvider } from './types';

/**
 * Build the provider for a configuration.
 *
 * Not cached: configuration can change at runtime (the user pasting a key),
 * and constructing an adapter is free.
 */
export function getProvider(config: AIConfig = resolveAIConfig()): AIProvider {
  switch (config.mode) {
    case 'proxy':
      return new ProxyProvider(config);
    case 'direct':
    default:
      return new GeminiProvider(config);
  }
}
