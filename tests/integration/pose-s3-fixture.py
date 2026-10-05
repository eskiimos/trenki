"""Isolated S3 wire fixture for pose integration; never exposes host ports."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
import shutil

root = Path('/tmp/pose-test-objects')
(root / 'pose-test/videos').mkdir(parents=True, exist_ok=True)
shutil.copyfile('/validation/sample.mp4', root / 'pose-test/videos/sample.mp4')

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass
    def target(self):
        target = (root / unquote(urlsplit(self.path).path).lstrip('/')).resolve()
        if not target.is_relative_to(root):
            raise ValueError('outside fixture')
        return target
    def do_HEAD(self):
        target = self.target()
        if not target.is_file():
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header('Content-Length', str(target.stat().st_size))
        self.send_header('Content-Type', 'video/mp4' if target.suffix == '.mp4' else 'application/gzip')
        self.end_headers()
    def do_GET(self):
        target = self.target()
        if not target.is_file():
            self.send_error(404)
            return
        self.do_HEAD()
        self.wfile.write(target.read_bytes())
    def do_PUT(self):
        target = self.target()
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(self.rfile.read(int(self.headers['Content-Length'])))
        self.send_response(200)
        self.send_header('ETag', '"pose-test-etag"')
        self.send_header('Content-Length', '0')
        self.end_headers()

ThreadingHTTPServer(('0.0.0.0', 9000), Handler).serve_forever()
