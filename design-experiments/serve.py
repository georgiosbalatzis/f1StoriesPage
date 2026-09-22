"""Local-only prototype server. Run: python3 design-experiments/serve.py"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, unquote
ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, url):
        path = unquote(urlparse(url).path)
        if path.startswith('/source/'):
            relative = Path(path.removeprefix('/source/'))
            candidate = (REPO / relative).resolve()
            allowed = relative.parts and relative.parts[0] in ('images', 'assets', 'blog-module')
            if allowed and candidate.is_relative_to(REPO) and candidate.suffix in ('.webp','.avif','.png','.jpg','.woff2'):
                return str(candidate)
            return str(ROOT / '__not_found__')
        candidate = (ROOT / path.lstrip('/')).resolve()
        return str(candidate) if candidate.is_relative_to(ROOT) else str(ROOT / '__not_found__')
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Robots-Tag', 'noindex, nofollow')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()
    def log_message(self, fmt, *args):
        if args and str(args[1]) not in ('200','304'):
            super().log_message(fmt, *args)
if __name__ == '__main__':
    print('F1Stories design review: http://127.0.0.1:4186/ — local only', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 4186), Handler).serve_forever()
