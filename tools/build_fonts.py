"""Build the two handwriting fonts and a PNG proof sheet for each.

    python tools/build_fonts.py

Writes fonts/*.ttf, fonts/*.woff2 and tools/proof-*.png
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from penkit import stroke, transform, wobble, rasterise          # noqa: E402
from glyphs import GLYPHS, XH, CAP, ASC, DSC                     # noqa: E402

UPM = 1000


class Hand:
    """One handwriting style."""

    def __init__(self, **kw):
        self.__dict__.update(kw)

    # vertical remap: reference heights to this hand's heights
    def ymap(self, y):
        pts = [(DSC, self.desc), (0, 0), (XH, self.xh),
               (CAP, self.cap), (ASC, self.asc)]
        if y <= pts[0][0]:
            a, b = pts[0], pts[1]
        elif y >= pts[-1][0]:
            a, b = pts[-2], pts[-1]
        else:
            for i in range(len(pts) - 1):
                if pts[i][0] <= y <= pts[i + 1][0]:
                    a, b = pts[i], pts[i + 1]
                    break
        t = (y - a[0]) / (b[0] - a[0])
        return a[1] + (b[1] - a[1]) * t


# Note 1 is the boy's hand, note 2 is the girl's. The boy is Tharu and the
# girl is Sani, so each font is named for the person whose hand it is.

BOY = Hand(
    key='tharu', family='Tharu Hand', partner='Sani',
    xh=400, cap=662, asc=734, desc=-244,
    slant=9.0, pen=46, wide=1.06, capwide=1.10, wob=8.0,
    loops=True, serif_I=False, dotr=32,
    lsb=32, rsb=32, space=240, jit_rot=1.5, jit_y=9,
    descr='Looser, forward-leaning hand with looped ascenders.')

GIRL = Hand(
    key='sani', family='Sani Hand', partner='Tharu',
    xh=386, cap=626, asc=676, desc=-210,
    slant=2.5, pen=40, wide=1.18, capwide=1.16, wob=5.0,
    loops=False, serif_I=True, dotr=28,
    lsb=30, rsb=30, space=226, jit_rot=0.9, jit_y=6,
    descr='Neater, rounder, near-upright hand with a barred capital I.')


def seedof(ch, i):
    h = 2166136261
    for c in (ch + '#' + str(i)):
        h = ((h ^ ord(c)) * 16777619) & 0xFFFFFFFF
    return h


def build_glyph(K, ch):
    """Return (contours, advance) in font units."""
    recs = GLYPHS[ch](K)
    shear = math.tan(math.radians(K.slant))
    gs = seedof(ch, 99)
    rot = math.radians(((gs % 2000) / 1000.0 - 1.0) * K.jit_rot)
    dy = ((gs >> 11) % 2000) / 1000.0 - 1.0

    # caps and figures carry a little extra width of their own, otherwise
    # they read as condensed next to the lowercase
    wide = K.wide * (K.capwide if (ch.isupper() or ch.isdigit()) else 1.0)

    contours = []
    for i, rec in enumerate(recs):
        pts = rec['p'].pts
        pts = [(x * wide, K.ymap(y)) for x, y in pts]
        s = seedof(ch, i)
        amp = K.wob * (0.55 + (s % 1000) / 1000.0 * 0.9)
        if rec.get('solid'):
            amp *= 0.25
        pts = wobble(pts, amp, (s >> 7) % 6283 / 1000.0,
                     0.6 + (s >> 17) % 100 / 100.0)
        pts = transform(pts, shear=shear, rot=rot, dy=dy * K.jit_y,
                        about=wide * 150)
        rec = dict(rec)
        rec['p'] = type(rec['p'])().m(0, 0)
        rec['p'].pts = pts
        rec['p'].closed = GLYPHS[ch](K)[i]['p'].closed
        contours += stroke(rec, K.pen)

    if not contours:
        return [], K.space

    xs = [p[0] for c in contours for p in c]
    minx, maxx = min(xs), max(xs)
    dx = K.lsb - minx
    contours = [[(x + dx, y) for x, y in c] for c in contours]
    adv = round(maxx - minx + K.lsb + K.rsb)
    return contours, adv


# ------------------------------------------------------------- compile

def to_ttf(K, glyphs, out):
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.ttGlyphPen import TTGlyphPen

    order = ['.notdef', 'space'] + [n for n, _ in glyphs]
    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(order)

    cmap = {0x20: 'space'}
    for name, (ch, _, _) in [(n, d) for n, d in glyphs]:
        cmap[ord(ch)] = name

    fb.setupCharacterMap(cmap)

    pen_glyphs = {}
    metrics = {'.notdef': (K.space, 0), 'space': (K.space, 0)}
    pen = TTGlyphPen(None)
    pen_glyphs['.notdef'] = pen.glyph()
    pen = TTGlyphPen(None)
    pen_glyphs['space'] = pen.glyph()

    for name, (ch, contours, adv) in glyphs:
        p = TTGlyphPen(None)
        for c in contours:
            pts = [(int(round(x)), int(round(y))) for x, y in c]
            ded = [pts[0]]
            for q in pts[1:]:
                if q != ded[-1]:
                    ded.append(q)
            if len(ded) > 2 and ded[0] == ded[-1]:
                ded.pop()
            if len(ded) < 3:
                continue
            p.moveTo(ded[0])
            for q in ded[1:]:
                p.lineTo(q)
            p.closePath()
        pen_glyphs[name] = p.glyph()
        lsb = min((int(round(x)) for c in contours for x, _ in c),
                  default=0)
        metrics[name] = (adv, lsb)

    fb.setupGlyf(pen_glyphs)
    fb.setupHorizontalMetrics(metrics)
    asc, desc = K.asc + 150, K.desc - 100
    fb.setupHorizontalHeader(ascent=asc, descent=desc, lineGap=0)
    fb.setupNameTable({
        'familyName': K.family,
        'styleName': 'Regular',
        'uniqueFontIdentifier': K.family + ' Regular; v1.0',
        'fullName': K.family,
        'psName': K.family.replace(' ', ''),
        'version': 'Version 1.000',
        'copyright': 'Made for Our Story. Free to use.',
        'description': K.descr,
    })
    fb.setupOS2(sTypoAscender=asc, sTypoDescender=desc, sTypoLineGap=0,
                usWinAscent=asc, usWinDescent=-desc,
                sxHeight=K.xh, sCapHeight=K.cap,
                achVendID='HAND', fsType=0,
                panose=dict(bFamilyType=3, bSerifStyle=0, bWeight=5,
                            bProportion=0, bContrast=0, bStrokeVariation=0,
                            bArmStyle=0, bLetterForm=0, bMidline=0,
                            bXHeight=0))
    fb.setupPost(isFixedPitch=0, italicAngle=-K.slant,
                 underlinePosition=-130, underlineThickness=K.pen)
    fb.font['head'].macStyle = 0
    fb.save(out)
    return out


# --------------------------------------------------------------- proof

def proof(K, built, path, lines):
    from PIL import Image

    W, H = 1500, 1180
    scale = 0.052
    allc = []

    def draw_text(text, x, y, sc):
        nonlocal allc
        for ch in text:
            if ch == ' ':
                x += K.space * sc
                continue
            if ch not in built:
                continue
            contours, adv = built[ch]
            for c in contours:
                allc.append([((px * sc) + x, (py * sc) + y) for px, py in c])
            x += adv * sc
        return x

    rows = [
        ('ABCDEFGHIJKLM', 0.050),
        ('NOPQRSTUVWXYZ', 0.050),
        ('abcdefghijklmn', 0.050),
        ('opqrstuvwxyz', 0.050),
        ('0123456789 .,!?&()', 0.044),
        ('Pack my box with five dozen jugs', 0.040),
    ]
    y = H - 130
    for text, sc in rows:
        draw_text(text, 40, y, sc)
        y -= 140
    for text, sc in lines:
        draw_text(text, 40, y, sc)
        y -= 220

    buf = rasterise(allc, W, H, 0, 0, 1.0, ss=2)
    img = Image.frombytes('L', (W, H), bytes(buf))
    img.save(path)
    return path


def run(K):
    built = {}
    glyphs = []
    for ch in sorted(GLYPHS):
        contours, adv = build_glyph(K, ch)
        built[ch] = (contours, adv)
        glyphs.append(('uni%04X' % ord(ch), (ch, contours, adv)))

    os.makedirs(os.path.join(ROOT, 'fonts'), exist_ok=True)
    ttf = os.path.join(ROOT, 'fonts', K.family.replace(' ', '') + '.ttf')
    to_ttf(K, glyphs, ttf)

    from fontTools.ttLib import TTFont
    f = TTFont(ttf)
    f.flavor = 'woff2'
    f.save(ttf[:-4] + '.woff2')

    png = os.path.join(HERE, 'proof-' + K.key + '.png')
    proof(K, built, png, [('I love my ' + K.partner + ' ♡', 0.090),
                          ('Always & forever, 2026 ♥', 0.062)])
    return ttf, png


if __name__ == '__main__':
    for K in (BOY, GIRL):
        t, p = run(K)
        print(os.path.basename(t), os.path.getsize(t), 'bytes ->', p)
