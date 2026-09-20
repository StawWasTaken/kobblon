"""
Turns each material picture into a normal map.

A texture on a flat face is a flat face with a picture on it. What makes a
brick wall read as brick rather than as a photograph of brick is that its
hollows catch the light differently from its faces, and that is a normal
map: the same greyscale read as a height, differentiated, and stored as the
direction the surface points at every pixel.

Generated here rather than in the browser so that nobody's machine spends
the first second of a World doing arithmetic we could have done once.
"""
from PIL import Image
import numpy as np
import os

HERE = 'public/engine/textures'

# How deep each surface is. A stud stands proud of the part; marble is a
# polished slab with veins in it and is nearly flat.
DEPTH = {
    'stons': 9.0,
    'plate': 7.0,
    'brick': 5.0,
    'planks': 4.0,
    'pebble': 6.0,
    'grass': 3.5,
    'slate': 3.0,
    'sand': 3.0,
    'wood': 2.0,
    'marble': 1.2,
    'metal': 1.0,
}


def normal_map(path, depth):
    height = np.asarray(Image.open(path).convert('L'), dtype=np.float32) / 255.0

    # Wrapped differences, so the normal map tiles exactly as the picture does.
    dx = np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)
    dy = np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)

    nx = -dx * depth
    ny = -dy * depth
    nz = np.ones_like(height)

    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    nx, ny, nz = nx / length, ny / length, nz / length

    # Three.js reads green as pointing up, which is the OpenGL convention.
    out = np.stack([nx, -ny, nz], axis=-1)
    out = np.clip((out * 0.5 + 0.5) * 255.0, 0, 255).astype(np.uint8)
    return Image.fromarray(out, 'RGB')


for name, depth in DEPTH.items():
    source = f'{HERE}/{name}.webp'
    if not os.path.exists(source):
        print(f'{name:8} no picture, skipped')
        continue
    made = normal_map(source, depth)
    # Half the width of the colour picture. A normal map is a direction per
    # pixel, it is sampled smoothly, and nobody has ever spotted the
    # difference; lossless at full size was five megabytes of download.
    made = made.resize((256, 256), Image.LANCZOS)
    out = f'{HERE}/{name}-bump.webp'
    made.save(out, 'WEBP', quality=92, method=6)
    print(f'{name:8} depth {depth:>4}  {os.path.getsize(out):>7} bytes')
