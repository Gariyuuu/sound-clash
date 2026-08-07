/**
 * ably's browser build (build/modular/index.mjs, and build/ably.js if that
 * variant is ever used instead) contains this pattern inside two
 * derived-Error classes (ErrorInfo, PartialErrorInfo):
 *
 *   var __super = (...args) => {
 *     super(...args);
 *   };
 *   ...
 *   __super(values.message);   // or __super(messageOrValues);
 *
 * This is valid ES2015+ (an arrow function inherits the `super` binding of
 * its enclosing constructor), but Next's SWC parser fails on it with
 * "'super' keyword outside a method". This webpack loader runs with
 * `enforce: "pre"` (see next.config.ts) so it patches the raw source before
 * SWC ever sees it. Inlining `__super(x)` call sites into direct `super(x)`
 * calls and dropping the indirection is behavior-identical here — the
 * helper is always invoked synchronously, exactly once, inside the same
 * constructor that defines it.
 */
module.exports = function fixAblySuper(source) {
  return source
    .replace(/var __super = \(\.\.\.args\) => \{\s*super\(\.\.\.args\);\s*\};\s*/g, "")
    .replace(/__super\(/g, "super(");
};
