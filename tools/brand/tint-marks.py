"""Stand-in seasonal marks, turned out of the blue ones.

Staw drew a halloween wordmark and logomark and a christmas logomark; they
are not in the repository yet, and an appearance with the ordinary blue "k"
in the corner is an appearance that looks broken rather than one that is
waiting for art. So these are made the same way the seasonal chrome is -
the hue moved and nothing else, so the shading, the outline and the
highlight all survive - and they are replaced the moment his land.

Rotating the hue rather than recolouring: the marks are a three-dimensional
drawing, and painting one flat throws away everything that makes it that.

Run with /usr/bin/python3, which is the one here with Pillow.
"""
import colorsys
from PIL import Image

B = 'public/brand/'


def tint(src, dst, hue):
    im = Image.open(B + src).convert('RGBA')
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if not a:
                continue
            _, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            # Grey is grey in every season: the outline and the white
            # highlight have no hue to move, and moving one anyway is how a
            # black outline comes out brown.
            if s < 0.12:
                continue
            nr, ng, nb = colorsys.hsv_to_rgb(hue / 360, s, v)
            px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    im.save(B + dst)
    print(dst, im.size)


tint('wordmark2.png', 'wordmark-halloween.png', 26)
tint('logomark.png', 'logomark-halloween.png', 26)
tint('logomark.png', 'logomark-christmas.png', 354)
