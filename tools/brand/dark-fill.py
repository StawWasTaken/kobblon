"""
The daylight wordmark, out of Staw's own pair of logomarks.

He drew the mark twice - a light fill for the dark interface and a dark one
for daylight - and only one wordmark, the light one. Rather than guess at
the dark version, this learns it: the two logomarks are the same artwork
pixel for pixel, so every colour in the light drawing has its counterpart
in the dark one sitting at the same coordinates. That is a lookup table of
his own recolour, and it maps the wordmark the same way.

    /usr/bin/python3 tools/brand/dark-fill.py <light.png> <dark.png> <in> <out>

Pillow is on /usr/bin/python3 here, not the default one.
"""
import sys
from PIL import Image

light_ref, dark_ref, source, out = sys.argv[1:5]

a = Image.open(light_ref).convert('RGBA')
b = Image.open(dark_ref).convert('RGBA')
if a.size != b.size:
    raise SystemExit('the two references have to be the same drawing')

table = {}
for one, two in zip(a.getdata(), b.getdata()):
    if one[3] < 8:
        continue
    table.setdefault(one[:3], two[:3])

keys = list(table)


def nearest(rgb):
    r, g, bl = rgb
    return min(keys, key=lambda k: (k[0] - r) ** 2 + (k[1] - g) ** 2 + (k[2] - bl) ** 2)


cache = {}
im = Image.open(source).convert('RGBA')
pixels = []
for r, g, bl, al in im.getdata():
    if al < 8:
        pixels.append((r, g, bl, al))
        continue
    key = (r, g, bl)
    got = cache.get(key)
    if got is None:
        got = table.get(key) or table[nearest(key)]
        cache[key] = got
    pixels.append((*got, al))

made = Image.new('RGBA', im.size)
made.putdata(pixels)
made.save(out)
print(out, im.size, len(table), 'colours learned')
