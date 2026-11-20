"""The holes in a face, filled.

A reaction is one silhouette painted through a CSS mask, so every hole in
it - the mouth, the eyes, the gap under a grin - is the page showing
through. On a dark card that reads as black and looks drawn; on white it
reads as white and the face falls apart.

So each face gets a companion mask holding its outer boundary filled: the
silhouette plus everything the silhouette encloses. `Icon.tsx` paints that
in Kobblon black underneath the face, and the holes are black in both
themes rather than whatever is behind.

The flame is left out. It is one colour and has no holes to fill, and
Staw asked for it to stay as it is.

Run with /usr/bin/python3.13, which is the one here that has Pillow.
"""
from collections import deque
from PIL import Image

UI = 'public/icons/ui'

FACES = [
    'smile', 'laugh', 'happy-grin', 'winky-grin', 'heart-eyes',
    'sunglasses', 'shocked', 'sad', 'angry', 'skull',
    # Not 'heart'. Staw drew his own and it is one solid shape that runs to
    # the edge of its picture, so the flood fill cannot get round it, calls
    # the whole heart an interior, and would paint it black over the red.
    # A shape with no hole in it has nothing for this script to do.
]


def fill(face: str) -> None:
    im = Image.open(f'{UI}/reaction-{face}.png').convert('RGBA')
    w, h = im.size
    px = im.load()

    """Everything the outside can reach, walking only through empty pixels."""
    outside = [[False] * w for _ in range(h)]
    queue = deque()
    for x in range(w):
        for y in (0, h - 1):
            if px[x, y][3] < 24 and not outside[y][x]:
                outside[y][x] = True
                queue.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if px[x, y][3] < 24 and not outside[y][x]:
                outside[y][x] = True
                queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not outside[ny][nx] and px[nx, ny][3] < 24:
                outside[ny][nx] = True
                queue.append((nx, ny))

    out = Image.new('RGBA', (w, h), (255, 255, 255, 0))
    o = out.load()
    for y in range(h):
        for x in range(w):
            a = px[x, y][3]
            o[x, y] = (255, 255, 255, 255 if a >= 24 or not outside[y][x] else 0)

    out.save(f'{UI}/reaction-{face}-fill.png')
    print('wrote', f'reaction-{face}-fill.png')


if __name__ == '__main__':
    for one in FACES:
        fill(one)
