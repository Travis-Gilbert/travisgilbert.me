import type { LensDef, LensContext } from '@/lib/commonplace-lenses';
import type { RenderableObject } from '../objects/ObjectRenderer';

/** Props every lens renderer receives when opened in a pane. */
export interface LensViewProps {
  lens: LensDef;
  ctx: LensContext;
  /** Minimal renderable built from the context (for headers and cards). */
  object: RenderableObject;
}
