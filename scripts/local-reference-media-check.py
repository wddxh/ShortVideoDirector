#!/usr/bin/env python3
"""Internal stdin media inspection; reuses preview's decoded CFR checks."""
from fractions import Fraction
import json
from pathlib import Path
import runpy
import sys

preview = runpy.run_path(str(Path(__file__).with_name('previs-preview.py')))


def check_media(expected, video, duration):
    streams = preview['probe'](video)
    width, height, _ = preview['video_info'](streams)
    frames, _, rate, seconds = preview['cfr_timing'](video, streams)
    actual = {'width': width, 'height': height, 'fps': str(rate),
              'frames': frames, 'duration': seconds, 'cfr': True,
              'square_pixels': True, 'rotation': 0}
    errors = []
    if (width, height) != (expected['width'], expected['height']):
        errors.append(f"dimensions mismatch: {width}x{height}, expected "
                      f"{expected['width']}x{expected['height']}")
    if rate != Fraction(expected['fps']):
        errors.append(f"fps mismatch: {rate}, expected {expected['fps']}")
    count = Fraction(str(duration)) * Fraction(expected['fps'])
    if count.denominator != 1:
        errors.append(f"canonical duration {duration}s is not representable at {expected['fps']} fps")
    elif frames != count:
        errors.append(f'duration mismatch: {frames} frames, expected {count} for {duration}s')
    return actual, streams, errors


def main():
    payload = json.load(sys.stdin)
    actual = None
    try:
        actual, _, errors = check_media(payload['expected'], payload['video'], payload['duration'])
    except (ValueError, OSError, OverflowError, ImportError) as error:
        errors = [' '.join(str(error).splitlines())]
    print(json.dumps({'actual': actual, 'errors': errors}))
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
