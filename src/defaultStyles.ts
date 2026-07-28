/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The baseline resume design.
 *
 * Lives in its own side-effect-free module rather than in `store.ts`: the store
 * instantiates a localStorage-backed singleton at import time, so anything that
 * reached in for these constants could not be used outside a browser (tests,
 * scripts, or a future server-side render).
 */

import type { ResumeStyles } from './types';

export const DEFAULT_STYLES: ResumeStyles = {
  primaryColor: '#1e3a8a', // Deep navy
  textColor: '#1f2937', // Dark gray
  backgroundColor: '#ffffff',
  fontFamily: 'sans', // Inter
  fontSize: 'md',
  spacing: 'normal',
  dividerStyle: 'solid',
  sectionHeadingSize: 'md',
  sectionHeadingAlignment: 'left',
  borderRadius: 'md',
};
