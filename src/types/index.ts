/**
 * Barrel for the app's shared domain types.
 *
 * The definitions were split out of this once-1,811-line file into per-domain
 * modules (Phase 70-G) and are re-exported here, so every existing
 * `import { … } from '@/types'` continues to resolve unchanged.
 */
export * from './gallerySettings';
export * from './media';
export * from './access';
export * from './campaign';
export * from './layoutTemplate';
