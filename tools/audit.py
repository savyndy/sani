"""Numeric sanity pass over every glyph: does the ink sit where it should?

    python tools/audit.py
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from build_fonts import BOY, GIRL, build_glyph          # noqa: E402
from glyphs import GLYPHS                               # noqa: E402

DESCENDERS = set('gjpqy,;()/')
SHORT = set(".,'\"-_:;") | set('–’“”')
TALL = set('bdfhkl') | set('ABCDEFGHIJKLMNOPQRSTUVWXYZ') \
    | set('0123456789') | set('!?()/')
# glyphs that legitimately sit clear of the baseline, or poke past x-height
FLOATS = set('+=\'"') | set('–’“”')
OVERSHOOT_OK = set('ijt')


def check(K):
    bad = []
    for ch in sorted(GLYPHS):
        contours, adv = build_glyph(K, ch)
        if not contours:
            bad.append((ch, 'empty'))
            continue
        ys = [p[1] for c in contours for p in c]
        xs = [p[0] for c in contours for p in c]
        lo, hi = min(ys), max(ys)
        w = max(xs) - min(xs)

        if ch not in DESCENDERS and ch not in SHORT and ch not in FLOATS:
            if lo > 55:
                bad.append((ch, 'floats above baseline: bottom %.0f' % lo))
            if lo < -90:
                bad.append((ch, 'dips below baseline: bottom %.0f' % lo))
        if ch in DESCENDERS and lo > -60:
            bad.append((ch, 'descender too shallow: bottom %.0f' % lo))
        if ch in TALL and hi < K.cap * 0.78:
            bad.append((ch, 'too short: top %.0f vs cap %d' % (hi, K.cap)))
        if ch.islower() and ch not in TALL and ch not in SHORT \
                and ch not in OVERSHOOT_OK:
            if hi > K.xh + K.pen:
                bad.append((ch, 'overshoots x-height: top %.0f vs %d'
                            % (hi, K.xh)))
        if adv > 900:
            bad.append((ch, 'advance very wide: %d' % adv))
        if w < 20 and ch != ' ':
            bad.append((ch, 'almost no width'))
    return bad


for K in (BOY, GIRL):
    issues = check(K)
    print('%-12s %d glyphs, %d issues' % (K.family, len(GLYPHS), len(issues)))
    for ch, msg in issues:
        line = '   %r  %s' % (ch, msg)
        print(line.encode('ascii', 'backslashreplace').decode())
