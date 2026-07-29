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
import { ProxyProvider } from './proxy';
import type { AIProvider } from './types';

/**
 * Build the provider for a configuration.
 *
 * The Gemini adapter is loaded on demand rather than imported statically. In a
 * proxy deployment the vendor client is then never fetched at all: the code
 * that could talk to Gemini from the browser is not merely unused, it is not
 * present. That turns "the client must not call the vendor directly" from a
 * branch you have to trust into something the bundle guarantees, and keeps the
 * vendor SDK path out of the main chunk.
 *
 * Not cached: configuration can change at runtime (the user pasting a key), and
 * constructing an adapter is free.
 */
export async function getProvider(config: AIConfig = resolveAIConfig()): Promise<AIProvider> {
  if (config.mode === 'proxy') return new ProxyProvider(config);
  const { GeminiProvider } = await import('./gemini');
  return new GeminiProvider(config);
}
