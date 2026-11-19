"""The heart reaction, drawn as a mask.

Staw sent a heart and asked for it beside the other faces: "if we dont
have one already you can use this one ive attached, and when its colourful
it should be the same red colour we used for the heart eyes reaction".

It is the same 96 by 96 white silhouette every other reaction is, so the
mask paints it whatever colour the place wants, and it is drawn here rather
than traced so the curve is exact at any size.

Run with /usr/bin/python3.13.
"""
from PIL import Image, ImageDraw

SIZE = 96
UP = 8  # drawn big, then shrunk, which is what smooths the edge


def heart() -> Image.Image:
    w = SIZE * UP
    im = Image.new('L', (w, w), 0)
    draw = ImageDraw.Draw(im)

    """
    Two circles and a triangle, which is what a heart is: the lobes sit
    side by side and the point hangs below them.
    """
    r = w * 0.26
    cx, cy = w / 2, w * 0.36
    draw.ellipse([cx - r * 2, cy - r, cx, cy + r], fill=255)
    draw.ellipse([cx, cy - r, cx + r * 2, cy + r], fill=255)
    draw.polygon(
        [(cx - r * 2, cy + r * 0.05), (cx + r * 2, cy + r * 0.05), (cx, w * 0.93)],
        fill=255,
    )

    small = im.resize((SIZE, SIZE), Image.LANCZOS)
    out = Image.new('RGBA', (SIZE, SIZE), (255, 255, 255, 0))
    out.putalpha(small)
    white = Image.new('RGBA', (SIZE, SIZE), (255, 255, 255, 255))
    white.putalpha(small)
    return white


if __name__ == '__main__':
    heart().save('public/icons/ui/reaction-heart.png')
    print('wrote reaction-heart.png')
