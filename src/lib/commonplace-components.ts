/**
 * Back-compat shim. The toolbox is now the lens registry (commonplace-lenses).
 * A lens is a superset of the old toolbox item (adds kind + applies), so
 * existing imports of COMPONENT_TOOLBOX / ComponentToolboxItem keep working.
 */
import { LENS_REGISTRY } from './commonplace-lenses';
import type { LensDef } from './commonplace-lenses';

export type ComponentToolboxItem = LensDef;
export const COMPONENT_TOOLBOX: LensDef[] = LENS_REGISTRY;
