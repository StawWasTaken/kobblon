"""Cutting the coloured bits out of Staw's faces.

The faces are one silhouette each, because that is what a CSS mask can
paint. Anything inside one that has to be a different colour - the tongue,
the hearts, the tears - is a second file holding only that part, drawn on
top by `DETAILS` in `Icon.tsx`.

The joy and sad faces were redrawn in October and arrived differently from
the first set: Staw sent both the white silhouette *and* his own coloured
version of each. So the tears are no longer guessed at by shape - which is
what the first version did, and it had to know that drops are islands and
streams are holes - they are read straight off the colour. Every pixel he
painted blue is a tear, and nothing else has to be true about it.

That matters for the next redraw as much as this one: a rule about where
the tears sit breaks the moment a face is drawn with them somewhere else.
"Blue is a tear" does not.

The coloured originals are kept beside this script, so the cut can be run
again without going back to a chat log.

Run with /usr/bin/python3.13, which is the one here that has Pillow.
"""
from PIL import Image

UI = 'public/icons/ui'
SOURCE = 'tools/icons/source'


def tears(face: str) -> None:
    """Everything blue in Staw's coloured drawing, as a white mask."""
    im = Image.open(f'{SOURCE}/reaction-{face}-colour.png').convert('RGBA')
    w, h = im.size
    px = im.load()

    out = Image.new('RGBA', (w, h), (255, 255, 255, 0))
    o = out.load()
    kept = 0
    for y in range(h):
        for x in range(w):
            r, _g, b, a = px[x, y]
            # Blue rather than the face's yellow. The edge pixels between
            # the two are left to the face, so a tear is never a ring of
            # half-blue over a yellow cheek.
            if a > 128 and b > r + 20:
                o[x, y] = (255, 255, 255, 255)
                kept += 1
    out.save(f'{UI}/reaction-{face}-tears.png')
    print(f'{face}: {kept} pixels, box {out.split()[3].getbbox()}')


tears('sad')
tears('laugh')
