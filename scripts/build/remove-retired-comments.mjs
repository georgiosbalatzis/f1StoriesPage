// Source-less articles bypass the template; remove their retired UI before stamping.
export function removeRetiredComments(html) {
    return String(html || '')
        .replace(/^[ \t]*<div\b[^>]*class=["'][^"']*\barticle-comments\b[^"']*["'][^>]*>\s*<h2\b[^>]*>[\s\S]*?<\/h2>\s*<div\b[^>]*id=["']disqus_thread["'][^>]*>\s*<\/div>\s*<\/div>[ \t]*\r?\n?\r?\n?/gim, '')
        .replace(/^[ \t]*<script\b([^>]*)>([\s\S]*?)<\/script>[ \t]*\r?\n?/gim, (tag, attrs, body) => (
            /\bsrc=["'][^"']*(?:article-comments(?:\.min)?\.js|(?:disqus|disquscdn)\.com\/)/i.test(attrs)
            || /\b(?:disqus_config|disqusThread)\b/.test(body) ? '' : tag
        ));
}
