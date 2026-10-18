"""
The other half of a mark Staw drew once.

He draws each mark twice: a light fill for the dark interface, a dark one
for daylight, and the outline the same colour in both. Where only one of
the pair exists, this makes the other - every pixel that is not the outline
keeps its hue and its saturation and has its lightness turned over, which
is exactly what his own pair does (checked against the two logomarks: the
made version lands within a couple of levels of his).

    /usr/bin/python3 tools/brand/flip-fill.py <in.png> <out.png>

Pillow is on /usr/bin/python3 here, not the default one.
"""
import colorsys
import sys
from collections import Counter

from PIL import Image

source, out = sys.argv[1:3]
im = Image.open(source).convert('RGBA')
pixels = list(im.getdata())

# The outline is the saturated colour the drawing is mostly made of.
seen = Counter()
for r, g, b, a in pixels:
    if a < 200:
        continue
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    if s > 0.5 and 0.2 < l < 0.8:
        seen[(r, g, b)] += 1
outline = seen.most_common(1)[0][0]
near = 42 ** 2


def flipped(r, g, b):
    gap = (r - outline[0]) ** 2 + (g - outline[1]) ** 2 + (b - outline[2]) ** 2
    if gap < near:
        return r, g, b
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    r2, g2, b2 = colorsys.hls_to_rgb(h, 1 - l, s)
    return round(r2 * 255), round(g2 * 255), round(b2 * 255)


cache = {}
made = Image.new('RGBA', im.size)
made.putdata([
    (*cache.setdefault((r, g, b), flipped(r, g, b)), a) if a else (r, g, b, a)
    for r, g, b, a in pixels
])
made.save(out)
print(out, im.size, 'outline', outline)
