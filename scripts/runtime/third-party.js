export function loadScript(src, { id, attributes = {} } = {}) {
  return new Promise((resolve, reject) => {
    if (id && document.getElementById(id)) return resolve(document.getElementById(id));
    const script = document.createElement('script');
    script.src = src; if (id) script.id = id;
    Object.entries(attributes).forEach(([key, value]) => script.setAttribute(key, value));
    script.onload = () => resolve(script); script.onerror = reject; document.head.appendChild(script);
  });
}

export const embeds = {
  facebook: container => globalThis.FB?.XFBML?.parse?.(container),
  instagram: () => globalThis.instgrm?.Embeds?.process?.(),
  disqus: (config, src) => loadScript(src, { id: 'f1s-disqus' }).then(() => config)
};
