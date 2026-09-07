#!/usr/bin/env python3
"""Create a display derivative; source_sha256 always fingerprints the original."""

import argparse
import hashlib
import io
import json
from pathlib import Path
import sys

HELPER_VERSION = "1"


class Parser(argparse.ArgumentParser):
    def error(self, message):
        raise ValueError(message)


def main():
    parser = Parser(description=__doc__)
    parser.add_argument("source")
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--crop", nargs=4, type=int,
                        metavar=("X", "Y", "WIDTH", "HEIGHT"))
    parser.add_argument("--max-edge", type=int, default=1024)
    args = parser.parse_args()
    if not 1 <= args.max_edge <= 1280:
        raise ValueError("--max-edge must be between 1 and 1280")
    try:
        from PIL import Image, ImageOps, __version__ as pillow_version
    except ImportError:
        raise ValueError("Pillow is required; install with: python3 -m pip install Pillow") from None

    source = Path(args.source).resolve(strict=True)
    source_bytes = source.read_bytes()
    source_hash = hashlib.sha256(source_bytes).hexdigest()
    try:
        with Image.open(io.BytesIO(source_bytes)) as image:
            if getattr(image, "is_animated", False) or getattr(image, "n_frames", 1) > 1:
                raise ValueError("animated/multi-frame images are not supported; "
                                 "use explicit extracted frames/video preview")
            image = ImageOps.exif_transpose(image)
            source_size = image.size
            if args.crop is not None:
                x, y, width, height = args.crop
                if (x < 0 or y < 0 or width <= 0 or height <= 0
                        or x + width > image.width or y + height > image.height):
                    raise ValueError("crop must fit within the EXIF-oriented source bounds")
                image = image.crop((x, y, x + width, y + height))
            image = image.convert("RGBA" if "A" in image.getbands()
                                  or "transparency" in image.info else "RGB")
            image.thumbnail((args.max_edge, args.max_edge), Image.Resampling.LANCZOS)
            # A fresh pixel-only image cannot carry EXIF, text, or color profiles.
            preview = Image.frombytes(image.mode, image.size, image.tobytes())
    except (OSError, SyntaxError, EOFError, Image.DecompressionBombError) as error:
        raise ValueError(f"cannot decode image: {error}") from None

    settings = [source_hash, args.crop, args.max_edge, HELPER_VERSION, pillow_version]
    identity = hashlib.sha256(json.dumps(settings).encode("utf-8")).hexdigest()
    output_dir = Path(args.output_dir).resolve()
    output = output_dir / f"{source_hash}-{identity}.png"
    if output.resolve() == source or (output.exists() and output.samefile(source)):
        raise ValueError("preview output must not be the source")
    buffer = io.BytesIO()
    preview.save(buffer, format="PNG")
    preview_bytes = buffer.getvalue()
    output_dir.mkdir(parents=True, exist_ok=True)
    try:
        with output.open("xb") as stream:
            stream.write(preview_bytes)
    except FileExistsError:
        if output.read_bytes() != preview_bytes:
            raise ValueError("existing preview differs; refusing to overwrite it") from None
    print(json.dumps({
        "source": str(source),
        "source_sha256": source_hash,
        "source_size": source_size,
        "preview": str(output),
        "preview_sha256": hashlib.sha256(preview_bytes).hexdigest(),
        "preview_size": preview.size,
        "crop": args.crop,
    }))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError) as error:
        print("review-image: " + " ".join(str(error).splitlines()), file=sys.stderr)
        sys.exit(1)
