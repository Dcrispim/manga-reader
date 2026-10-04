// Structural stand-in for AbortSignal: the core avoids DOM/Node globals, and
// the real AbortSignal (Node, Hermes) satisfies this shape.
export interface AbortSignalLike {
  readonly aborted: boolean
}
