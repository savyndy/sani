"""Centerline-stroke font engine.

Glyphs are written as pen skeletons (the path the nib travels), then
inflated into filled outlines. Keeps the handwriting feel honest: the
shapes come from strokes, not from drawn contours.
"""
import math

STEP = 11.0          # flattening resolution in font units


# ---------------------------------------------------------------- paths

class Pa:
    """A single pen stroke, flattened to a polyline as it is built."""

    def __init__(self):
        self.pts = []
        self.closed = False

    def m(self, x, y):
        self.pts = [(x, y)]
        return self

    def l(self, x, y):
        x0, y0 = self.pts[-1]
        n = max(1, int(math.hypot(x - x0, y - y0) / STEP))
        for i in range(1, n + 1):
            self.pts.append((x0 + (x - x0) * i / n, y0 + (y - y0) * i / n))
        return self

    def c(self, x1, y1, x2, y2, x, y):
        x0, y0 = self.pts[-1]
        approx = (math.hypot(x1 - x0, y1 - y0) + math.hypot(x2 - x1, y2 - y1)
                  + math.hypot(x - x2, y - y2))
        n = max(2, int(approx / STEP))
        for i in range(1, n + 1):
            t = i / n
            u = 1 - t
            self.pts.append((
                u*u*u*x0 + 3*u*u*t*x1 + 3*u*t*t*x2 + t*t*t*x,
                u*u*u*y0 + 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t*y))
        return self

    def q(self, x1, y1, x, y):
        x0, y0 = self.pts[-1]
        return self.c(x0 + 2/3*(x1-x0), y0 + 2/3*(y1-y0),
                      x + 2/3*(x1-x), y + 2/3*(y1-y), x, y)

    def arc(self, cx, cy, rx, ry, a0, a1):
        """Elliptical arc, angles in degrees, counter-clockwise positive."""
        span = abs(a1 - a0)
        n = max(4, int(span / 360 * 2 * math.pi * max(rx, ry) / STEP))
        start = 0 if not self.pts else 1
        for i in range(start, n + 1):
            a = math.radians(a0 + (a1 - a0) * i / n)
            self.pts.append((cx + rx * math.cos(a), cy + ry * math.sin(a)))
        return self

    def close(self):
        self.closed = True
        return self


def S(path, w=1.0, taper=(0.80, 0.62)):
    """Tag a path with a pen-width multiplier and end taper."""
    return {'p': path, 'w': w, 'taper': taper}


def dot(x, y, r):
    """A round pen dot (the tittle on i and j, periods, and so on)."""
    return {'p': Pa().arc(x, y, r, r, 0, 360).close(), 'w': 0.0001,
            'taper': (1, 1), 'solid': True}


# ------------------------------------------------------------- stroking

def _dedupe(pts):
    out = [pts[0]]
    for p in pts[1:]:
        if math.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) > 0.08:
            out.append(p)
    return out


def _profile(t, taper):
    a, b = taper
    f = 1.0
    e = 0.14
    if t < e:
        u = t / e
        f = min(f, a + (1 - a) * (u * u * (3 - 2 * u)))
    if t > 1 - e:
        u = (1 - t) / e
        f = min(f, b + (1 - b) * (u * u * (3 - 2 * u)))
    return f


def _area(c):
    s = 0.0
    for i in range(len(c)):
        x0, y0 = c[i]
        x1, y1 = c[(i + 1) % len(c)]
        s += x0 * y1 - x1 * y0
    return s / 2


def _orient(c, positive=True):
    return c if ((_area(c) > 0) == positive) else c[::-1]


def stroke(rec, width):
    """Inflate one pen stroke into filled contours."""
    pts = _dedupe(rec['p'].pts)
    closed = rec['p'].closed
    hw = width * rec.get('w', 1.0) / 2.0

    if rec.get('solid'):
        # a dot: the path itself is already the outline
        return [_orient(pts, True)]

    if closed and math.hypot(pts[0][0]-pts[-1][0], pts[0][1]-pts[-1][1]) < 0.6:
        pts = pts[:-1]

    n = len(pts)
    if n < 2:
        pts = [pts[0], (pts[0][0] + 1, pts[0][1])]
        n = 2

    # arc length for the taper profile
    seg = [0.0]
    for i in range(1, n):
        seg.append(seg[-1] + math.hypot(pts[i][0]-pts[i-1][0],
                                        pts[i][1]-pts[i-1][1]))
    total = seg[-1] or 1.0

    left, right = [], []
    for i in range(n):
        if closed:
            a, b = pts[(i - 1) % n], pts[(i + 1) % n]
        else:
            a = pts[i - 1] if i > 0 else pts[i]
            b = pts[i + 1] if i < n - 1 else pts[i]
        dx, dy = b[0] - a[0], b[1] - a[1]
        d = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / d, dx / d
        r = hw if closed else hw * _profile(seg[i] / total, rec['taper'])
        x, y = pts[i]
        left.append((x + nx * r, y + ny * r))
        right.append((x - nx * r, y - ny * r))

    if closed:
        outer, inner = (left, right) if abs(_area(left)) > abs(_area(right)) \
            else (right, left)
        return [_orient(outer, True), _orient(inner, False)]

    # open stroke: one contour, round caps on both ends
    def cap(centre, frm, to, r):
        a0 = math.atan2(frm[1] - centre[1], frm[0] - centre[0])
        a1 = math.atan2(to[1] - centre[1], to[0] - centre[0])
        while a1 - a0 > 0:
            a1 -= 2 * math.pi
        steps = max(3, int(abs(a1 - a0) * r / STEP))
        return [(centre[0] + r * math.cos(a0 + (a1 - a0) * i / steps),
                 centre[1] + r * math.sin(a0 + (a1 - a0) * i / steps))
                for i in range(1, steps)]

    re = hw * _profile(1.0, rec['taper'])
    rs = hw * _profile(0.0, rec['taper'])
    contour = (left
               + cap(pts[-1], left[-1], right[-1], re)
               + right[::-1]
               + cap(pts[0], right[0], left[0], rs))
    return [_orient(contour, True)]


# ------------------------------------------------------- transformation

def transform(pts, shear=0.0, rot=0.0, dx=0.0, dy=0.0, about=0.0):
    ca, sa = math.cos(rot), math.sin(rot)
    out = []
    for x, y in pts:
        x -= about
        x, y = x * ca - y * sa, x * sa + y * ca
        x += about
        out.append((x + y * shear + dx, y + dy))
    return out


def wobble(pts, amp, phase, freq=1.0):
    """Low-frequency drift so strokes are not machine-straight."""
    if amp <= 0:
        return pts
    n = len(pts)
    out = []
    for i, (x, y) in enumerate(pts):
        t = i / max(1, n - 1)
        out.append((x + amp * math.sin(phase + t * 6.283 * freq),
                    y + amp * 0.8 * math.sin(phase * 1.7 + 2.1
                                             + t * 6.283 * freq * 0.7)))
    return out


# ------------------------------------------------------- rasteriser (QA)

def rasterise(contours, w, h, ox, oy, scale, ss=3):
    """Nonzero-winding scanline fill, used only to eyeball the result."""
    W, H = w * ss, h * ss
    rows = [bytearray(b'\xff' * W) for _ in range(H)]
    edges = []
    for c in contours:
        n = len(c)
        for i in range(n):
            x0, y0 = c[i]
            x1, y1 = c[(i + 1) % n]
            X0 = (x0 - ox) * scale * ss
            Y0 = H - (y0 - oy) * scale * ss
            X1 = (x1 - ox) * scale * ss
            Y1 = H - (y1 - oy) * scale * ss
            if Y0 != Y1:
                edges.append((X0, Y0, X1, Y1))
    for py in range(H):
        yc = py + 0.5
        xs = []
        for X0, Y0, X1, Y1 in edges:
            if (Y0 <= yc < Y1) or (Y1 <= yc < Y0):
                t = (yc - Y0) / (Y1 - Y0)
                xs.append((X0 + (X1 - X0) * t, 1 if Y1 > Y0 else -1))
        if not xs:
            continue
        xs.sort()
        wind = 0
        row = rows[py]
        for i in range(len(xs) - 1):
            wind += xs[i][1]
            if wind != 0:
                a = max(0, int(math.ceil(xs[i][0] - 0.5)))
                b = min(W, int(math.ceil(xs[i + 1][0] - 0.5)))
                for px in range(a, b):
                    row[px] = 0
    # box downsample
    out = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            s = 0
            for j in range(ss):
                row = rows[y * ss + j]
                base = x * ss
                for i in range(ss):
                    s += row[base + i]
            out[y * w + x] = s // (ss * ss)
    return bytes(out)
