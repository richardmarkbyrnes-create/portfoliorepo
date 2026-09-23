#!/usr/bin/env python3
"""Local dev server with cache disabled so Chrome always fetches fresh files.

Also hosts the deck's inline text editor (js/deck-edit.js): a POST endpoint that
writes edited slide copy straight back into the HTML on disk. That only works
here — the deployed site is static files on GitHub Pages with nothing to write
to — so the client refuses to load anywhere but localhost.
"""

import json
import os
import re
from html.parser import HTMLParser
from http.server import HTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.realpath(os.getcwd())

# Elements the editor exposes. The client walks the same set in the same order
# with querySelectorAll, so an index means the same element on both sides.
EDITABLE_TAGS = ('p', 'h1', 'h2', 'li')
OPEN_TAG_RE = re.compile(r'<(%s)\b[^>]*>' % '|'.join(EDITABLE_TAGS), re.I)

# contenteditable is a generous host: a paste can arrive carrying divs, fonts and
# inline styles. Only the inline markup the slides actually use survives.
ALLOWED = {
    'span': {'class', 'aria-hidden'},
    'b': {'class'},
    'strong': set(),
    'em': set(),
    'i': set(),
    'br': set(),
    'img': {'class', 'src', 'alt', 'width', 'height', 'loading', 'aria-hidden'},
}
VOID = {'br', 'img'}
# Unwrapping one of these would weld the line to the one before it. They aren't
# allowed through, but the boundary they mark is preserved as a break.
BLOCK_TAGS = {'div', 'p', 'li', 'section', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'}
# Unwrapping these would leave their source sitting in the slide as visible text.
DROP_CONTENT = {'script', 'style', 'template'}


class Sanitiser(HTMLParser):
    """Keeps allowed tags and their allowed attributes; unwraps everything else
    so the text inside a stripped tag is preserved rather than lost."""

    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.out = []
        self.muted = 0

    def handle_starttag(self, tag, attrs):
        if tag in DROP_CONTENT:
            self.muted += 1
            return
        if tag not in ALLOWED:
            if tag in BLOCK_TAGS and self.out and not ''.join(self.out).endswith('<br>'):
                self.out.append('<br>')
            return
        keep = ''.join(
            ' %s="%s"' % (k, v.replace('"', '&quot;'))
            for k, v in attrs
            if k in ALLOWED[tag] and v is not None
        )
        self.out.append('<%s%s>' % (tag, keep))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        if tag in DROP_CONTENT:
            self.muted = max(0, self.muted - 1)
            return
        if tag in ALLOWED and tag not in VOID:
            self.out.append('</%s>' % tag)

    def handle_data(self, data):
        if not self.muted:
            self.out.append(data)

    def handle_entityref(self, name):
        if not self.muted:
            self.out.append('&%s;' % name)

    def handle_charref(self, name):
        if not self.muted:
            self.out.append('&#%s;' % name)

    def result(self):
        return ''.join(self.out).strip()


def clean(html):
    parser = Sanitiser()
    parser.feed(html)
    parser.close()
    return parser.result()


def resolve_page(url_path):
    """Map a request path to a file inside the repo, refusing anything outside it."""
    rel = url_path.split('?')[0].lstrip('/')
    if rel.endswith('/') or rel == '':
        rel += 'index.html'
    target = os.path.realpath(os.path.join(ROOT, rel))
    if not (target == ROOT or target.startswith(ROOT + os.sep)):
        raise ValueError('path escapes the served directory')
    if not target.endswith('.html'):
        raise ValueError('only .html files are editable')
    if not os.path.isfile(target):
        raise ValueError('no such file')
    return target


def slide_bounds(text, number):
    """Byte range of the body of <section ... aria-label="Slide N"> ... </section>."""
    open_tag = re.search(
        r'<section\b[^>]*aria-label="Slide %d"[^>]*>' % number, text, re.I
    )
    if not open_tag:
        raise ValueError('slide %d not found' % number)
    # Sections are never nested in these decks, so the next close tag is the match.
    close = text.index('</section>', open_tag.end())
    return open_tag.end(), close


WIDTH_RE = re.compile(r'^\d{1,3}(\.\d)?%$')


def set_width(open_tag, value):
    """Rewrite an element's inline max-width, leaving any other styling alone."""
    match = re.search(r'\sstyle="([^"]*)"', open_tag)
    decls = [
        d.strip() for d in (match.group(1) if match else '').split(';')
        if d.strip() and not d.strip().lower().startswith('max-width')
    ]
    if value:
        decls.append('max-width: %s' % value)
    style = '; '.join(decls)

    if match:
        replacement = ' style="%s"' % style if style else ''
        return open_tag[:match.start()] + replacement + open_tag[match.end():]
    if style:
        return open_tag[:-1] + ' style="%s">' % style
    return open_tag


def apply_edits(text, number, edits, widths=None):
    widths = widths or {}
    start, end = slide_bounds(text, number)
    body = text[start:end]

    spans = []
    for match in OPEN_TAG_RE.finditer(body):
        tag = match.group(1).lower()
        try:
            close = body.index('</%s>' % tag, match.end())
        except ValueError:
            raise ValueError('unclosed <%s> in slide %d' % (tag, number))
        spans.append((match.start(), match.end(), close))

    touched = set(int(k) for k in edits) | set(int(k) for k in widths)
    for index in touched:
        if index < 0 or index >= len(spans):
            raise ValueError('element %d out of range for slide %d' % (index, number))

    # Last element first, so edits don't shift the offsets of the ones before
    # them; within an element, the inner content before the opening tag, for the
    # same reason.
    written = 0
    for index in sorted(touched, reverse=True):
        tag_start, inner_start, inner_end = spans[index]
        key = str(index)

        if key in edits:
            body = body[:inner_start] + clean(edits[key]) + body[inner_end:]
            written += 1

        if key in widths:
            value = widths[key]
            if value is not None and not WIDTH_RE.match(str(value)):
                raise ValueError('bad width %r — expected a percentage' % value)
            open_tag = body[tag_start:inner_start]
            body = body[:tag_start] + set_width(open_tag, value) + body[inner_start:]
            written += 1

    return text[:start] + body + text[end:], written


class DeckHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def _json(self, status, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path.split('?')[0] != '/__edit':
            self._json(404, {'ok': False, 'error': 'unknown endpoint'})
            return
        try:
            length = int(self.headers.get('Content-Length') or 0)
            payload = json.loads(self.rfile.read(length) or b'{}')
            path = resolve_page(payload['page'])
            updated, written = apply_edits(
                open(path, encoding='utf-8').read(),
                int(payload['slide']),
                payload.get('edits') or {},
                payload.get('widths') or {},
            )
            with open(path, 'w', encoding='utf-8') as handle:
                handle.write(updated)
            rel = os.path.relpath(path, ROOT)
            print('edited %s slide %s (%d element%s)'
                  % (rel, payload['slide'], written, '' if written == 1 else 's'))
            self._json(200, {'ok': True, 'written': written, 'file': rel})
        except Exception as err:  # noqa: BLE001 — surfaced to the editor's banner
            self._json(400, {'ok': False, 'error': str(err)})


if __name__ == "__main__":
    port = 8080
    server = HTTPServer(("localhost", port), DeckHandler)
    print(f"Serving at http://localhost:{port} (cache disabled, deck editing on)")
    server.serve_forever()
