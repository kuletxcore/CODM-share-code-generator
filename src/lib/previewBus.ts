/**
 * A one-line broadcast between the preview canvas and anything that reads it.
 *
 * The tone map used to poll the preview every 800 ms to keep its histogram in
 * step, which drained a phone battery during a session and still showed a
 * histogram up to 0.8 s behind the sliders. Instead the preview says when it
 * has drawn and the readers redraw on the next frame.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

/** Call after the preview has painted. Cheap: no work when nobody listens. */
export function previewDrawn() {
  for (const fn of listeners) fn();
}

/** Subscribe; returns the unsubscribe function. */
export function onPreviewDrawn(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
