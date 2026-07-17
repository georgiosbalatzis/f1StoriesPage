import { MARKER_TOKEN, markerCount } from './draft-model.mjs';

export function markerImagePlan(content, images) {
  const markers = markerCount(content); const ordered = Array.from(images || []);
  return { markers, ordered, orphanCount: Math.max(0, ordered.length - markers), missingCount: Math.max(0, markers - ordered.length), token: MARKER_TOKEN };
}
