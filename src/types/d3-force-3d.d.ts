declare module 'd3-force-3d' {
  export interface ForceNodeDatum {
    index?: number;
    x?: number;
    y?: number;
    z?: number;
    vx?: number;
    vy?: number;
    vz?: number;
    fx?: number;
    fy?: number;
    fz?: number;
  }

  export interface Force<NodeDatum extends ForceNodeDatum = ForceNodeDatum> {
    (alpha: number): void;
    initialize?(nodes: NodeDatum[], random?: () => number, numDimensions?: number): void;
  }

  export interface ForceCenter<NodeDatum extends ForceNodeDatum = ForceNodeDatum>
    extends Force<NodeDatum> {
    x(): number;
    x(x: number): this;
    y(): number;
    y(y: number): this;
    z(): number;
    z(z: number): this;
    strength(): number;
    strength(strength: number): this;
  }

  export interface ForceCollide<NodeDatum extends ForceNodeDatum = ForceNodeDatum>
    extends Force<NodeDatum> {
    iterations(): number;
    iterations(iterations: number): this;
    radius(): (node: NodeDatum, index: number, nodes: NodeDatum[]) => number;
    radius(radius: number | ((node: NodeDatum, index: number, nodes: NodeDatum[]) => number)): this;
    strength(): number;
    strength(strength: number): this;
  }

  export function forceCenter<NodeDatum extends ForceNodeDatum = ForceNodeDatum>(
    x?: number,
    y?: number,
    z?: number,
  ): ForceCenter<NodeDatum>;

  export function forceCollide<NodeDatum extends ForceNodeDatum = ForceNodeDatum>(
    radius?: number | ((node: NodeDatum, index: number, nodes: NodeDatum[]) => number),
  ): ForceCollide<NodeDatum>;
}
