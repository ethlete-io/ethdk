#!/usr/bin/env python3
"""Dump the properties of every layer in a Figma "copy as CSS" export, in document order.

    python3 dump-figma-layers.py <export.css> ['<name regex>']

Without a regex every layer is printed except obvious vector artwork. With one, only the
layers whose name matches it.

Figma emits sub-comments — `/* Auto layout */`, `/* Inside auto layout */`, `/* or 16px */`
and design-token names like `/* Brand/Chalk White/500 (base) */` — that carry properties
belonging to the layer named above them. They are folded into that layer rather than treated
as new ones: a parser that splits on every comment reports frames with zero properties.
"""

import re
import sys

COMMENT = re.compile(r'^/\* (.+) \*/$')
LAYOUT_NOTE = re.compile(r'^(Auto layout|Inside auto layout|or [\d.]+px|Hug|Fixed|Fill|Effect style)$')
ARTWORK = re.compile(
    r'^(Polygon|Vector|Ellipse|Rectangle \d|Star|Union|Subtract|Group|Mask|Clip'
    r'|Texture|Frame \d{6,})'
)


def read_blocks(path):
    """Yield ('comment', name) and ('prop', text), skipping Figma's multi-line prose notes."""
    lines = [line.rstrip('\n') for line in open(path)]
    index, total = 0, len(lines)

    while index < total:
        stripped = lines[index].strip()

        if stripped.startswith('/*') and not stripped.endswith('*/'):
            while index < total and not lines[index].rstrip().endswith('*/'):
                index += 1
            index += 1
            continue

        comment = COMMENT.match(stripped)

        if comment:
            following = lines[index + 1].strip() if index + 1 < total else ''
            yield 'comment', comment.group(1), following
        elif ':' in stripped and not stripped.startswith('/*'):
            yield 'prop', stripped, ''

        index += 1


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)

    path = sys.argv[1]
    match = re.compile(sys.argv[2]).search if len(sys.argv) > 2 else None
    show, index = False, 0

    for kind, text, following in read_blocks(path):
        if kind == 'prop':
            if show:
                print(f'    {text}')
            continue

        # A layer name is followed by a blank line; a sub-comment sits directly on top of the
        # declarations it annotates. The name list covers the few notes Figma writes before
        # another comment, where that spacing rule cannot decide.
        is_declaration = ':' in following and not following.startswith('/*')

        if is_declaration or LAYOUT_NOTE.match(text):
            if show:
                print(f'    /* {text} */')
            continue

        index += 1
        show = match(text) is not None if match else not ARTWORK.match(text)

        if show:
            print(f'\n--- [{index}] {text}')


if __name__ == '__main__':
    main()
