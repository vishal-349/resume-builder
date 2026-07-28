/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The importer's public surface.
 *
 * The UI imports exactly one thing from the AI layer: `parseResume`. Nothing in
 * `src/components` or `src/hooks` may reach past this module — that constraint
 * is what makes the provider swappable.
 */

import { isAIConfigured, resolveAIConfig } from './config';
import { ImportError, toImportError } from './errors';
import { toParsedResume } from './normalize';
import { buildRepairPrompt, buildUserPrompt, SYSTEM_INSTRUCTION } from './prompt';
import { getProvider } from './provider';
import { RESUME_RESPONSE_SCHEMA } from './schema';
import { toDocumentPayload, textToPayload } from '../import/documentSource';
import { validateFile, validatePastedText } from '../import/fileValidation';
import type { DocumentPayload, ParsedResume, ProgressReporter } from '../import/types';

export interface ParseOptions {
  onProgress?: ProgressReporter;
  signal?: AbortSignal;
}

/**
 * The analysis stage dominates wall-clock time, so progress is weighted to
 * reflect that rather than advancing evenly and then stalling.
 */
const STAGE_PERCENT = { validating: 5, reading: 20, analyzing: 45, building: 92, done: 100 } as const;

/** Analyze an already-prepared payload. Shared by the file and paste paths. */
async function analyzePayload(payload: DocumentPayload, options: ParseOptions): Promise<ParsedResume> {
  const config = resolveAIConfig();
  const provider = getProvider(config);
  const startedAt = Date.now();

  options.onProgress?.({
    stage: 'analyzing',
    percent: STAGE_PERCENT.analyzing,
    message: 'Analyzing layout and content with AI…',
  });

  const request = {
    payload,
    systemInstruction: SYSTEM_INSTRUCTION,
    userPrompt: buildUserPrompt(payload),
    responseSchema: RESUME_RESPONSE_SCHEMA,
    signal: options.signal,
    onAttempt: (attempt: number, maxAttempts: number) => {
      if (attempt > 1) {
        options.onProgress?.({
          stage: 'analyzing',
          percent: STAGE_PERCENT.analyzing,
          message: `Retrying analysis (attempt ${attempt} of ${maxAttempts})…`,
        });
      }
    },
  };

  const result = await provider.analyzeDocument(request);

  options.onProgress?.({
    stage: 'building',
    percent: STAGE_PERCENT.building,
    message: 'Rebuilding your resume as an editable document…',
  });

  const context = {
    fileName: payload.fileName,
    format: payload.format,
    provider: result.provider,
    model: result.model,
    durationMs: Date.now() - startedAt,
  };

  try {
    return toParsedResume(result.data, context);
  } catch (err) {
    // The response was structurally unusable. Re-ask once with the specific
    // problem attached — far cheaper and more effective than a blind retry.
    if (err instanceof ImportError && err.code === 'MALFORMED_RESPONSE') {
      options.onProgress?.({
        stage: 'analyzing',
        percent: STAGE_PERCENT.analyzing,
        message: 'Refining the result…',
      });
      const repaired = await provider.analyzeDocument({
        ...request,
        userPrompt: `${request.userPrompt}\n\n${buildRepairPrompt(err.detail || err.message)}`,
      });
      return toParsedResume(repaired.data, {
        ...context,
        durationMs: Date.now() - startedAt,
      });
    }
    throw err;
  }
}

/**
 * Parse an uploaded resume into structured, editable data.
 *
 * validate → read → analyze → normalize. Always throws `ImportError`, never a
 * raw exception, so callers have exactly one error type to handle.
 */
export async function parseResume(file: File, options: ParseOptions = {}): Promise<ParsedResume> {
  try {
    const config = resolveAIConfig();
    if (!isAIConfigured(config)) throw new ImportError('MISSING_API_KEY', { retryable: false });

    options.onProgress?.({
      stage: 'validating',
      percent: STAGE_PERCENT.validating,
      message: `Checking "${file.name}"…`,
    });
    const validated = validateFile(file, config.maxFileBytes);

    options.onProgress?.({
      stage: 'reading',
      percent: STAGE_PERCENT.reading,
      message: validated.format === 'pdf' ? 'Preparing the document for visual analysis…' : 'Reading document structure…',
    });
    const payload = await toDocumentPayload(validated, config.maxPdfPages);

    if (options.signal?.aborted) throw new ImportError('CANCELLED');

    const parsed = await analyzePayload(payload, options);
    options.onProgress?.({ stage: 'building', percent: STAGE_PERCENT.done, message: 'Done.' });
    return parsed;
  } catch (err) {
    throw toImportError(err);
  }
}

/** Same pipeline for manually pasted resume text. */
export async function parseResumeText(text: string, options: ParseOptions = {}): Promise<ParsedResume> {
  try {
    if (!isAIConfigured()) throw new ImportError('MISSING_API_KEY', { retryable: false });

    options.onProgress?.({ stage: 'validating', percent: STAGE_PERCENT.validating, message: 'Checking text…' });
    const validated = validatePastedText(text);

    const parsed = await analyzePayload(textToPayload(validated), options);
    options.onProgress?.({ stage: 'building', percent: STAGE_PERCENT.done, message: 'Done.' });
    return parsed;
  } catch (err) {
    throw toImportError(err);
  }
}
