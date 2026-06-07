/**
 * Module-level body-scroll lock manager.
 *
 * A reference counter coordinates lock/unlock across multiple concurrent
 * consumers (e.g. a lightbox hook + a lightbox component both participating).
 *
 * Invariants:
 *   lockCount ≥ 0 (releaseBodyScrollLock clamps at zero)
 *   previousOverflow snapshotted on 0→1 transition
 *   overflow restored on 1→0 transition
 */

let lockCount = 0;
let previousOverflow = '';

export function acquireBodyScrollLock(): void {
  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount++;
}

export function releaseBodyScrollLock(): void {
  if (lockCount <= 0) return;
  lockCount--;
  if (lockCount === 0) {
    document.body.style.overflow = previousOverflow;
    previousOverflow = '';
  }
}
