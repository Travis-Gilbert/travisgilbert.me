'use client';

/**
 * CommonPlace Code screen (HANDOFF-CODE-SURFACE-UI). The former prototype
 * markup was replaced by the CodeSurface shell; status fetching, runtime
 * probing, and all regions now live in src/components/commonplace/code/.
 */

import CodeSurface from '@/components/commonplace/code/CodeSurface';

export default function CommonPlaceCodeView() {
  return <CodeSurface />;
}
