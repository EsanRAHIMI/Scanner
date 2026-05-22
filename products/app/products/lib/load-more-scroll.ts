/** Pixels from bottom of scroll container that trigger loading the next batch. */
export const LOAD_MORE_SCROLL_THRESHOLD_PX = 320;

/** True when the user has scrolled near the vertical end (ignores horizontal scroll position). */
export function isScrollContainerNearEnd(
  el: HTMLElement,
  threshold = LOAD_MORE_SCROLL_THRESHOLD_PX,
): boolean {
  return el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
}
