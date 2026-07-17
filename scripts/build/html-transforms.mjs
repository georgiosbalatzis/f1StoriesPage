export function replaceAssetReferences(html, replacements) {
  let output = String(html ?? '');
  for (const [from, to] of Object.entries(replacements || {})) {
    output = output.split(from).join(to);
  }
  return output;
}

export function injectMeta(html, meta) {
  const tags = Object.entries(meta || {})
    .map(([name, content]) => `<meta name="${name}" content="${String(content).replaceAll('"', '&quot;')}">`)
    .join('\n');
  return String(html).replace(/<head([^>]*)>/i, `<head$1>\n${tags}`);
}
