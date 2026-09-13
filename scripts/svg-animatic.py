#!/usr/bin/env python3
"""Render trusted local Python frame(t, width, height) SVGs to an MP4 clip.

The clip can be part of a mixed-media task or cover its entire source timeline.

t is Fraction(n, fps); SOURCE executes once in this Python process, not a sandbox.
Requires system librsvg >= 2.46, Cairo, GLib/GObject and FFmpeg with libx264.
Static SVG only: compute motion in frame(), not SMIL/JavaScript/CSS animation.
See examples/svg-animatic/README.md for timing, fonts and references.
"""

import argparse
from contextlib import redirect_stdout
import ctypes as C
import ctypes.util
from fractions import Fraction
import json
import os
from pathlib import Path
import runpy
import shutil
import subprocess
import sys
import tempfile


class GError(C.Structure):
    _fields_ = [("domain", C.c_uint), ("code", C.c_int), ("message", C.c_char_p)]


class Rectangle(C.Structure):
    _fields_ = [(key, C.c_double) for key in ("x", "y", "width", "height")]


class Rasterizer:
    """Small binding to the installed librsvg/Cairo static document renderer."""

    def __init__(self):
        self.libs = []

        def library(name):
            path = ctypes.util.find_library(name)
            if not path:
                raise ValueError(f"missing system library {name}; no dependencies installed")
            lib = C.CDLL(path)
            self.libs.append(lib)
            return lib

        def bind(lib, name, result, *args):
            fn = getattr(lib, name)
            fn.restype, fn.argtypes = result, args
            return fn

        r = library("rsvg-2")
        # Resolve dependency symbols through librsvg to use its own Cairo/GLib,
        # including on Conda hosts with different libraries in their search path.
        c = g = o = r
        ptr, integer = C.c_void_p, C.c_int
        error = C.POINTER(C.POINTER(GError))
        self.load = bind(r, "rsvg_handle_new_from_data", ptr, C.c_char_p, C.c_size_t, error)
        self.render = bind(r, "rsvg_handle_render_document", integer,
                           ptr, ptr, C.POINTER(Rectangle), error)
        self.unref = bind(o, "g_object_unref", None, ptr)
        self.free_error = bind(g, "g_error_free", None, C.POINTER(GError))
        self.surface = bind(c, "cairo_image_surface_create", ptr, integer, integer, integer)
        self.context = bind(c, "cairo_create", ptr, ptr)
        self.status = bind(c, "cairo_status", integer, ptr)
        self.surface_status = bind(c, "cairo_surface_status", integer, ptr)
        self.flush = bind(c, "cairo_surface_flush", None, ptr)
        self.data = bind(c, "cairo_image_surface_get_data", ptr, ptr)
        self.stride = bind(c, "cairo_image_surface_get_stride", integer, ptr)
        self.destroy = bind(c, "cairo_destroy", None, ptr)
        self.destroy_surface = bind(c, "cairo_surface_destroy", None, ptr)

    def check(self, ok, error):
        message = error.contents.message.decode("utf-8", "replace") if error else "render failed"
        if error:
            self.free_error(error)
        if not ok:
            raise ValueError(f"SVG: {message}")

    def pixels(self, svg, width, height):
        if not isinstance(svg, str) or not svg.strip():
            raise ValueError("frame must return a nonempty SVG string")
        encoded = svg.encode("utf-8")
        error = C.POINTER(GError)()
        handle = self.load(encoded, len(encoded), C.byref(error))
        self.check(handle, error)
        surface = context = None
        try:
            # CAIRO_FORMAT_RGB24 is native-endian 0x00RRGGBB, opaque black initially.
            surface = self.surface(1, width, height)
            context = self.context(surface)
            if self.surface_status(surface) or self.status(context):
                raise ValueError("Cairo surface/context allocation failed")
            viewport = Rectangle(0, 0, width, height)
            error = C.POINTER(GError)()
            self.check(self.render(handle, context, C.byref(viewport), C.byref(error)), error)
            self.flush(surface)
            if self.surface_status(surface) or self.status(context):
                raise ValueError("Cairo rendering failed")
            stride = self.stride(surface)
            data = C.string_at(self.data(surface), stride * height)
            if stride != width * 4:
                data = b"".join(data[y * stride:y * stride + width * 4] for y in range(height))
            return data
        finally:
            if context:
                self.destroy(context)
            if surface:
                self.destroy_surface(surface)
            self.unref(handle)


def positive_fraction(text):
    try:
        value = Fraction(text)
        if value > 0:
            return value
    except (ValueError, ZeroDivisionError):
        pass
    raise argparse.ArgumentTypeError("expected a positive decimal or fraction")


def encode(frame, rasterizer, args, count, output, log):
    rate = args.fps
    command = ["ffmpeg", "-v", "error", "-nostdin", "-y", "-f", "rawvideo",
               "-pix_fmt", "bgr0" if sys.byteorder == "little" else "0rgb",
               "-video_size", f"{args.width}x{args.height}", "-framerate", str(rate),
               "-i", "pipe:0", "-an", "-c:v", "libx264", "-threads", "2",
               "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-vsync", "0",
               "-video_track_timescale", str(rate.numerator),
               "-movflags", "+faststart", str(output)]
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=log,
                               stdout=subprocess.DEVNULL)
    try:
        for n in range(count):
            t = Fraction(n, 1) / rate
            try:
                pixels = rasterizer.pixels(frame(t, args.width, args.height),
                                           args.width, args.height)
            except (Exception, SystemExit) as error:
                raise ValueError(f"frame {n} at t={t}: {error}") from error
            process.stdin.write(pixels)
        process.stdin.close()
        if process.wait() != 0:
            raise ValueError("encoder failed")
    except BaseException:
        if process.poll() is None:
            process.terminate()
        process.wait()
        try:
            process.stdin.close()
        except BrokenPipeError:
            pass
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="trusted executable local SOURCE.py")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--duration", required=True, type=positive_fraction)
    parser.add_argument("--fps", required=True, type=positive_fraction)
    parser.add_argument("--width", required=True, type=int)
    parser.add_argument("--height", required=True, type=int)
    parser.add_argument("--overwrite", action="store_true", help="atomically replace an existing MP4")
    args = parser.parse_args()
    count = args.duration * args.fps
    if count.denominator != 1:
        raise ValueError("duration * fps must be an integer; no rounding is applied")
    if any(x <= 0 or x % 2 for x in (args.width, args.height)):
        raise ValueError("width and height must be positive even integers for yuv420p")
    source = args.source.resolve(strict=True)
    output = args.output.absolute()
    if (output.resolve() == source or
            (output.exists() and os.path.samefile(output, source))):
        raise ValueError("output must not overwrite SOURCE")
    if output.suffix.lower() != ".mp4":
        raise ValueError("output must have .mp4 extension")
    if os.path.lexists(output) and not args.overwrite:
        raise ValueError("output exists; use --overwrite to replace it")
    if not shutil.which("ffmpeg"):
        raise ValueError("missing FFmpeg with libx264; no dependencies installed")
    rasterizer = Rasterizer()
    try:
        with redirect_stdout(sys.stderr):
            namespace = runpy.run_path(str(source))
    except (Exception, SystemExit) as error:
        raise ValueError(f"SOURCE: {error}") from error
    frame = namespace.get("frame")
    if not callable(frame):
        raise ValueError("SOURCE must define frame(t, width, height)")
    # Same filesystem permits atomic publication; no frame files are written.
    with tempfile.TemporaryDirectory(prefix=".svg-animatic-", dir=output.parent) as directory:
        temporary = Path(directory) / "complete.mp4"
        with (Path(directory) / "encoder.log").open("w+b") as log:
            try:
                with redirect_stdout(sys.stderr):
                    encode(frame, rasterizer, args, int(count), temporary, log)
            except Exception as error:
                log.seek(0)
                detail = log.read().decode("utf-8", "replace").strip()
                raise ValueError(f"{error}" + (f"; FFmpeg: {detail}" if detail else "")) from error
        if args.overwrite:
            os.replace(temporary, output)
        else:
            os.link(temporary, output)  # Atomic no-clobber even if output appeared meanwhile.
    print(json.dumps({"output": str(output), "frames": int(count),
                      "duration": str(args.duration), "fps": str(args.fps),
                      "width": args.width, "height": args.height}))


if __name__ == "__main__":
    try:
        main()
    except (Exception, KeyboardInterrupt) as error:
        print(f"svg-animatic: {error}", file=sys.stderr)
        sys.exit(1)
