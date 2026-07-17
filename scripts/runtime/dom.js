export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
export const icon = (name, label = '') => `<svg class="icon" aria-hidden="${label ? 'false' : 'true'}"${label ? ` role="img"><title>${label}</title>` : '>'}<use href="#fa-${name}"></use></svg>`;
