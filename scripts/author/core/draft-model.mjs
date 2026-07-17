export const MARKER_TOKEN = '[img-instert-tag]';

export function createDraft(input = {}) {
  return {
    title: String(input.title || '').trim(), author: String(input.author || '').trim(), tag: String(input.tag || '').trim(),
    category: String(input.category || '').trim(), content: String(input.content || ''), images: Array.isArray(input.images) ? [...input.images] : [],
    hero: input.hero || null, header: input.header || null
  };
}

export function validateDraft(draft) {
  const errors = {};
  if (!draft.title) errors.title = 'Title is required';
  if (!draft.author) errors.author = 'Author is required';
  if (!draft.category) errors.category = 'Category is required';
  if (!draft.content.trim()) errors.content = 'Content is required';
  return { valid: Object.keys(errors).length === 0, errors };
}

export function markerCount(content) { return String(content || '').split(MARKER_TOKEN).length - 1; }
export function imageOrder(images, from, to) {
  const next = [...images]; if (from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
  const [item] = next.splice(from, 1); next.splice(to, 0, item); return next;
}
