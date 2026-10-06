"""Load the built fonts back and check they are structurally sound."""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from fontTools.ttLib import TTFont                       # noqa: E402

WANT = ('abcdefghijklmnopqrstuvwxyz'
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        '0123456789'
        " .,:;!?'\"-_()/&+=–’“”♡♥❤")

ok = True
for base in ('TharuHand', 'SaniHand'):
    for ext in ('.ttf', '.woff2'):
        path = os.path.join(ROOT, 'fonts', base + ext)
        f = TTFont(path)
        cmap = f.getBestCmap()
        missing = [c for c in WANT if ord(c) not in cmap]
        empty = []
        glyf = f['glyf']
        for c in WANT:
            if c == ' ' or ord(c) not in cmap:
                continue
            g = glyf[cmap[ord(c)]]
            if g.numberOfContours == 0:
                empty.append(c)
        hm = f['hmtx']
        zero_adv = [c for c in WANT if ord(c) in cmap
                    and hm[cmap[ord(c)]][0] <= 0]
        head, os2 = f['head'], f['OS/2']
        print('%-16s %-7s glyphs=%3d  cmap=%3d  upm=%d  xh=%d cap=%d  %s'
              % (base, ext, len(f.getGlyphOrder()), len(cmap),
                 head.unitsPerEm, os2.sxHeight, os2.sCapHeight,
                 '%d bytes' % os.path.getsize(path)))
        for label, bad in (('missing', missing), ('empty outline', empty),
                           ('zero advance', zero_adv)):
            if bad:
                ok = False
                print('   !! %s: %s' % (label, ''.join(bad)
                                        .encode('ascii', 'backslashreplace')
                                        .decode()))
        f.close()

print('\nALL CHECKS PASS' if ok else '\nPROBLEMS FOUND')
sys.exit(0 if ok else 1)
