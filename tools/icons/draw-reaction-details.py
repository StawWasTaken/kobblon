"""
The parts of a reaction face that are not the face's own yellow.

Staw: "make sure to add colour to every reactions, like we did for the
tongue, you gonna do that for the tears too, and the fire, and etc".

The hearts on the heart-eyes face and the tongue on the winky one were cut
out of the drawings themselves, because they were already in them. Tears
were not: the sad face is a square face with two eyes and a frown, and the
laughing one is squinting with its mouth open. So these are drawn, in the
same vocabulary the faces are, and they are drawn as their own files rather
than painted into his, so his drawings are untouched and the tears can be
blue while the face stays yellow.

Run it with `/usr/bin/python3 tools/icons/draw-reaction-details.py`. The
files it writes are committed; nothing in the build runs it.
"""
from PIL import Image, ImageDraw

SIZE = 96
UP = 4   # drawn four times over and brought back down, for the edges


def blank():
    return Image.new('RGBA', (SIZE * UP, SIZE * UP), (0, 0, 0, 0))


def done(image, where):
    image.resize((SIZE, SIZE), Image.LANCZOS).save(where)
    print(where)


def teardrop(draw, x, y, w, h):
    """A drop: a point at the top, a round belly at the bottom."""
    draw.polygon(
        [(x + w / 2, y), (x + w, y + h * 0.62), (x, y + h * 0.62)],
        fill=(255, 255, 255, 255),
    )
    draw.ellipse([x, y + h * 0.30, x + w, y + h], fill=(255, 255, 255, 255))


# --------------------------------------------------- the sad one, one tear
#
# Under the left eye, which sits at roughly x 28 to 40 on the 96 grid. One
# rather than two: two is a face crying and one is a face that is sad, and
# the drawing underneath is a frown rather than a wail.
image = blank()
draw = ImageDraw.Draw(image)
teardrop(draw, 28 * UP, 44 * UP, 15 * UP, 26 * UP)
done(image, 'public/icons/ui/reaction-sad-tears.png')

# --------------------------------------------- the laughing one, two tears
#
# Outside the eyes rather than under them, because that is where they are on
# a face that is laughing: squeezed out at the corners.
image = blank()
draw = ImageDraw.Draw(image)
teardrop(draw, 12 * UP, 34 * UP, 14 * UP, 24 * UP)
teardrop(draw, 70 * UP, 34 * UP, 14 * UP, 24 * UP)
done(image, 'public/icons/ui/reaction-laugh-tears.png')
