export function renderPreview(draft, { escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])) } = {}) {
  const title = escape(draft.title); const author = escape(draft.author);
  const body = escape(draft.content).replaceAll('\n', '<br>');
  return `<article class="author-preview"><h1>${title}</h1><p class="author-preview-byline">${author}</p><div class="author-preview-body">${body}</div></article>`;
}
