"""Development server for dev/harness.html.

Serves the repository over http://127.0.0.1:8765 (stdlib only) and accepts
POST /upload?name=<file>.png with a data: URL body, saved to dev/out/<file>.
The harness uses that to export screenshots of the HUD for the README.
Run from the repository root:  python dev/serve.py
"""
import base64
import http.server
import os
import re
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "dev", "out")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_POST(self):
        url = urllib.parse.urlparse(self.path)
        name = urllib.parse.parse_qs(url.query).get("name", [""])[0]
        if url.path != "/upload" or not re.fullmatch(r"[\w.-]{1,64}\.png", name):
            self.send_error(400, "POST /upload?name=<file>.png")
            return
        body = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode("ascii", "replace")
        data = base64.b64decode(body.split(",", 1)[-1])
        os.makedirs(OUT, exist_ok=True)
        with open(os.path.join(OUT, name), "wb") as f:
            f.write(data)
        self.send_response(204)
        self.end_headers()


if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
