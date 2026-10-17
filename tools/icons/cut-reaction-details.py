"""Cutting the coloured bits out of Staw's faces.

The faces are one silhouette each, because that is what a CSS mask can
paint. Anything inside one that has to be a different colour - the tongue,
the hearts, and now the tears - is a second file holding only that part,
drawn on top by `DETAILS` in `Icon.tsx`.

Found rather than traced, the way the tongue was: the parts are already
there in the drawing, so this reads them out instead of drawing them
again. Two shapes of part, and they need opposite treatment:

  the laughing one   the drops are islands of their own, away from the
                     face, so they are the small pieces of the silhouette
  the sad one        the streams are holes in the silhouette - the drawing
                     is a white face with the tears cut out of it - so
                     they are the tall thin pieces of the hole

Run with /usr/bin/python3, which is the one here that has Pillow.
"""
from PIL import Image

UI = 'public/icons/ui'


def pieces(hit, w, h):
    """Every four-connected run of pixels where `hit(x, y)` is true."""
    seen = [[False] * w for _ in range(h)]
    found = []
    for y in range(h):
        for x in range(w):
            if seen[y][x] or not hit(x, y):
                continue
            stack, part = [(x, y)], []
            seen[y][x] = True
            while stack:
                cx, cy = stack.pop()
                part.append((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and hit(nx, ny):
                        seen[ny][nx] = True
                        stack.append((nx, ny))
            found.append(part)
    return found


def write(part_pixels, size, name):
    out = Image.new('RGBA', size, (255, 255, 255, 0))
    px = out.load()
    for x, y in part_pixels:
        px[x, y] = (255, 255, 255, 255)
    out.save(f'{UI}/{name}')
    print(f'{name}: {len(part_pixels)} pixels')


def laugh_drops():
    """The two drops beside the laughing face.

    They are not islands, which is what the first version assumed: they
    touch the face's edge, so the whole drawing is one piece and splitting
    it by connectedness gives back the drawing. They are outside the face
    though, and the face is a rounded square - so the columns it fills are
    the tall ones, and whatever white sits either side of them is a drop.
    """
    im = Image.open(f'{UI}/reaction-laugh.png').convert('RGBA')
    w, h = im.size
    a = im.split()[3].load()

    tall = [x for x in range(w) if sum(1 for y in range(h) if a[x, y] > 128) > h // 2]
    left, right = min(tall), max(tall)

    drops = [(x, y) for x in range(w) for y in range(h)
             if a[x, y] > 128 and not (left <= x <= right)]
    write(drops, im.size, 'reaction-laugh-tears.png')
    return left, right


def sad_streams():
    """The two streams down the sad face: the tall thin holes in it."""
    im = Image.open(f'{UI}/reaction-sad.png').convert('RGBA')
    w, h = im.size
    a = im.split()[3].load()
    box = im.split()[3].getbbox()
    x0, y0, x1, y1 = box

    def hole(x, y):
        return x0 <= x < x1 and y0 <= y < y1 and a[x, y] <= 128

    streams = []
    for part in pieces(hole, w, h):
        xs = [p[0] for p in part]
        ys = [p[1] for p in part]
        tall = max(ys) - min(ys)
        wide = max(xs) - min(xs)
        # A stream is long and narrow; an eye and the mouth are neither.
        if tall > 35 and wide < 16:
            streams.append(part)
    write([p for part in streams for p in part], im.size, 'reaction-sad-tears.png')
    return len(streams)


print('laugh drops:', laugh_drops())
print('sad streams:', sad_streams())
