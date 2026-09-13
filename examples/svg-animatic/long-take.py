"""15 s single take: stdlib world-space 3D -> static 2D SVG, fixed lens.

Editable scene/camera constants below; no rigs, engine or external assets.
Separated layers + backface culling suit this box scene and camera corridor,
not arbitrary intersecting geometry. Ground is drawn first (all solids above it).
"""
import math

DURATION = 15
FOV = 50  # vertical degrees, constant throughout
ORBIT_DEGREES = 80
PLATFORM_TOP = 0.35


def add(a, b):
    return tuple(x + y for x, y in zip(a, b))


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def mul(a, s):
    return tuple(x * s for x in a)


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2],
            a[0]*b[1]-a[1]*b[0])


def unit(a):
    return mul(a, 1 / math.sqrt(dot(a, a)))


def ease(t, start, end):
    u = max(0, min(1, (t-start)/(end-start)))
    return u*u*u*(10 + u*(-15 + 6*u))


def subject(t):
    distance = 1.8 * ease(t, 9, 15)
    return (0.5*distance, PLATFORM_TOP, -math.sqrt(3)/2*distance)


def camera(t):
    center = add(subject(t), (0, 0.65, 0))
    angle = math.radians(-20 + ORBIT_DEGREES * ease(t, 3, 11))
    radius = 13 - 4 * ease(t, 0, 4)
    eye = add(center, (radius*math.sin(angle), 4, radius*math.cos(angle)))
    forward = unit(sub(center, eye))
    right = unit(cross(forward, (0, 1, 0)))
    up = cross(right, forward)
    return eye, right, up, forward


def view(p, pose):
    q = sub(p, pose[0])
    return tuple(dot(q, axis) for axis in pose[1:])


def project(p, width, height):
    focal = height / (2 * math.tan(math.radians(FOV / 2)))
    return (width/2 + focal*p[0]/p[2], height/2 - focal*p[1]/p[2])


def near_clip(points):
    result = []
    for a, b in zip(points[-1:] + points[:-1], points):
        if (a[2] >= 0.2) != (b[2] >= 0.2):
            result.append(add(a, mul(sub(b, a), (0.2-a[2])/(b[2]-a[2]))))
        if b[2] >= 0.2:
            result.append(b)
    return result


# World axes: Y up; the camera starts on +Z, travels toward +X.
STONE = ('#405e73', '#62869a', '#304655', '#adc4cc', '#527184', '#7d9aa8')
TEAL = ('#24686a', '#388b8c', '#254f54', '#9bd0c1', '#347b7d', '#63aba5')
GOLD = ('#ad5739', '#ef8050', '#984827', '#ffe0a0', '#de6943', '#ffc36b')


def box(origin, size, colors):
    """Six planar faces; layer order below handles this scene's overlaps."""
    result = []
    for axis in range(3):
        others = [i for i in range(3) if i != axis]
        u, v = others
        for side in (0, 1):
            normal = tuple((2*side-1) if i == axis else 0 for i in range(3))
            vertices = []
            for du, dv in ((0, 0), (1, 0), (1, 1), (0, 1)):
                p = list(origin)
                p[axis] += side*size[axis]
                p[u] += du*size[u]
                p[v] += dv*size[v]
                vertices.append(tuple(p))
            result.append((vertices, normal, colors[axis*2+side]))
    return result


PLATFORM = box((-2.5, 0, -2.4), (6.5, PLATFORM_TOP, 3.9), STONE)
NEAR = box((1.65, 0, 2.15), (0.65, 2.8, 0.65), TEAL)
FAR = box((-3.6, 0, -3.8), (0.8, 3.3, 0.8), STONE)
HERO = box((-0.6, 0, -0.6), (1.2, 1.4, 1.2), GOLD)


def frame(t, width, height):
    t = float(t)
    pose = camera(t)
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" '
           f'height="{height}" viewBox="0 0 {width} {height}">',
           '<rect width="100%" height="100%" fill="#172732"/>']

    def polygon(points, color):
        points = near_clip(points)
        if len(points) < 3:
            return
        coords = ' '.join(f'{x:.3f},{y:.3f}' for x, y in
                          (project(p, width, height) for p in points))
        svg.append(f'<polygon points="{coords}" fill="{color}" '
                   f'stroke="{color}" stroke-width="0.45" stroke-linejoin="round"/>')

    # Floor first: it never occludes the above-ground solids.
    for x in range(-14, 15):
        for z in range(-14, 15):
            color = '#293f4a' if (x+z) % 2 else '#304955'
            polygon([view(p, pose) for p in
                     ((x, 0, z), (x+1, 0, z), (x+1, 0, z+1), (x, 0, z+1))], color)

    hero = [([add(p, subject(t)) for p in points], normal, color)
            for points, normal, color in HERO]
    # For this camera corridor, overlaps are FAR < platform < hero < NEAR.
    # Explicit support-before-subject avoids centroid sorting at floor contact.
    # Convex boxes have nonoverlapping visible face interiors after culling.
    for faces in (FAR, PLATFORM, hero, NEAR):
        for points, normal, color in faces:
            if dot(normal, sub(pose[0], points[0])) > 0:
                polygon([view(p, pose) for p in points], color)
    return ''.join(svg) + '</svg>'
