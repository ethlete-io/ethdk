#!/usr/bin/env python3
"""Dump the box tree of a Figma SVG export: every shape with absolute coordinates.

    python3 dump-figma-svg.py <export.svg>

Prints one line per drawn element in document order, indented by group nesting, then a
summary of repeated shapes and of the gaps between shapes that share a row.

An SVG export has no layer names and — because Figma outlines text on export — no strings
or font metrics. What it does have is exact geometry: every rect carries its own x/y/
width/height/rx, so padding and gaps are differences you can read off rather than numbers
you have to trust a label for. Outlined text is measured by the bounding box of its path
coordinates, which runs a fraction of a pixel wide because Bezier control points sit
outside the curve — enough to place a text run, not to size a glyph.
"""

import re
import sys
import xml.etree.ElementTree as ET

SVG_NS = '{http://www.w3.org/2000/svg}'
TRANSLATE = re.compile(r'translate\(\s*([-\d.]+)[\s,]+([-\d.]+)\s*\)')
TOKEN = re.compile(r'([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:e[-+]?\d+)?)', re.IGNORECASE)
ARITY = {'m': 2, 'l': 2, 'h': 1, 'v': 1, 'c': 6, 's': 4, 'q': 4, 't': 2, 'a': 7, 'z': 0}
SKIP = {'defs', 'clipPath', 'mask', 'filter', 'linearGradient', 'radialGradient', 'pattern'}


def tag_of(element):
    return element.tag[len(SVG_NS) :] if element.tag.startswith(SVG_NS) else element.tag


def number(element, name, fallback=0.0):
    try:
        return float(element.get(name, fallback))
    except ValueError:
        return fallback


def translation(element):
    match = TRANSLATE.search(element.get('transform') or '')

    return (float(match.group(1)), float(match.group(2))) if match else (0.0, 0.0)


def path_points(data):
    """Every point a path visits, control points included. `H`/`V`/`A` take counts of their
    own, so pairing the numbers off two at a time reports a box the shape never occupies."""
    tokens = TOKEN.findall(data)
    index, command, x, y = 0, 'm', 0.0, 0.0

    while index < len(tokens):
        letter, value = tokens[index]

        if letter:
            command = letter
            index += 1

            if command.lower() == 'z':
                continue

        arity = ARITY[command.lower()]
        args = [float(tokens[index + step][1]) for step in range(arity) if index + step < len(tokens)]

        if len(args) < arity:
            return

        index += arity
        relative = command.islower()

        if command.lower() == 'h':
            x = x + args[0] if relative else args[0]
        elif command.lower() == 'v':
            y = y + args[0] if relative else args[0]
        else:
            pairs = [(args[5], args[6])] if command.lower() == 'a' else list(zip(args[0::2], args[1::2]))

            for point_x, point_y in pairs:
                yield (x + point_x, y + point_y) if relative else (point_x, point_y)

            x, y = (x + pairs[-1][0], y + pairs[-1][1]) if relative else pairs[-1]

        yield x, y

        if command == 'M':
            command = 'L'
        elif command == 'm':
            command = 'l'


def path_box(data):
    points = list(path_points(data))
    xs, ys = [point[0] for point in points], [point[1] for point in points]

    if not xs:
        return None

    return min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)


def box_of(element):
    name = tag_of(element)

    if name in ('rect', 'image'):
        return number(element, 'x'), number(element, 'y'), number(element, 'width'), number(element, 'height')

    if name == 'path':
        return path_box(element.get('d') or '')

    if name in ('polygon', 'polyline'):
        return path_box('M' + (element.get('points') or ''))

    if name == 'circle':
        radius = number(element, 'r')

        return number(element, 'cx') - radius, number(element, 'cy') - radius, radius * 2, radius * 2

    if name == 'ellipse':
        rx, ry = number(element, 'rx'), number(element, 'ry')

        return number(element, 'cx') - rx, number(element, 'cy') - ry, rx * 2, ry * 2

    if name == 'line':
        x1, y1 = number(element, 'x1'), number(element, 'y1')

        return x1, y1, number(element, 'x2') - x1, number(element, 'y2') - y1

    return None


def trim(value):
    return f'{value:.3f}'.rstrip('0').rstrip('.')


def walk(element, offset, depth, boxes):
    for child in element:
        name = tag_of(child)

        if name in SKIP:
            continue

        dx, dy = translation(child)
        origin = (offset[0] + dx, offset[1] + dy)

        if name in ('g', 'svg'):
            print(f'{"  " * depth}<{name}>' + (f' translate({trim(dx)} {trim(dy)})' if (dx or dy) else ''))
            walk(child, origin, depth + 1, boxes)
            continue

        if name == 'text':
            content = ' '.join(''.join(child.itertext()).split())
            metrics = ' '.join(
                f'{key}={child.get(key)}'
                for key in ('font-family', 'font-size', 'font-weight', 'letter-spacing')
                if child.get(key)
            )
            x, y = number(child, 'x') + origin[0], number(child, 'y') + origin[1]
            print(f'{"  " * depth}{"text":<6} {trim(x):>9} {trim(y):>8}  {metrics}  "{content}"')
            continue

        box = box_of(child)

        if box is None:
            continue

        x, y, width, height = box[0] + origin[0], box[1] + origin[1], box[2], box[3]
        radius = child.get('rx') if name == 'rect' else None
        paint = child.get('fill') or child.get('stroke') or ''
        detail = f' r={radius}' if radius else ''
        detail += f' {"stroke" if child.get("stroke") else "fill"}={paint}' if paint and paint != 'none' else ''
        label = 'text?' if name == 'path' and width >= height * 3 else name

        print(f'{"  " * depth}{label:<6} {trim(x):>9} {trim(y):>8}  {trim(width):>8} × {trim(height):<8}{detail}'.rstrip())
        boxes.append((x, y, width, height, name, radius, paint))


def summarise(boxes):
    shapes = {}

    for x, y, width, height, name, radius, paint in boxes:
        if name != 'rect':
            continue

        shapes.setdefault((round(width, 2), round(height, 2), radius), []).append((x, y, paint))

    repeats = {key: hits for key, hits in shapes.items() if len(hits) > 1}

    if repeats:
        print('\nRepeated rects — one component rendered N times, not N designs:')

        for (width, height, radius), hits in sorted(repeats.items(), key=lambda item: -len(item[1])):
            fills = {paint for _, _, paint in hits}
            varies = f', {len(fills)} fills' if len(fills) > 1 else ''
            print(f'  {len(hits)}× {trim(width)} × {trim(height)}' + (f' r={radius}' if radius else '') + varies)

    rows = {}

    for x, y, width, height, name, _, _ in boxes:
        if name == 'rect':
            rows.setdefault(round(y, 2), set()).add((x, width))

    printed = False

    for y, hits in sorted(rows.items()):
        spans, edge = [], None

        for x, width in sorted(hits):
            if edge is not None and x >= edge:
                spans.append(round(x - edge, 2))

            edge = max(edge or 0, x + width)

        if not spans:
            continue

        if not printed:
            print('\nGaps between rects sharing a top edge — the auto-layout gap, measured:')
            printed = True

        print(f'  y={trim(y):<8} {len(spans) + 1} columns, gaps: {", ".join(trim(span) for span in spans)}')


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)

    root = ET.parse(sys.argv[1]).getroot()
    boxes = []

    print(f'canvas {root.get("width")} × {root.get("height")}  viewBox={root.get("viewBox")}\n')
    walk(root, (0.0, 0.0), 0, boxes)
    summarise(boxes)


if __name__ == '__main__':
    main()
