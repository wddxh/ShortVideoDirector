#!/usr/bin/env python3
"""Derive a subtitle-band MP4 from clean VIDEO and a previs-audio JSON PLAN.

Whole speaker:text utterances follow half-open plan spans (16 kHz rounding).
Overlapping spans of one segment display once; distinct segments remain distinct.
--timecode adds an elapsed HH:MM:SS clock, updated once per second.
Requires Python Pillow, FFmpeg/ffprobe (libx264), and a Chinese-capable font.
Input must be a verified CFR animation MP4; frame inspection has a 120 s timeout.
"""

import json
import math
import os
from fractions import Fraction
from pathlib import Path
import runpy
import shutil
import subprocess
import sys
import tempfile
import unicodedata

audio_plan = runpy.run_path(str(Path(__file__).with_name("previs-audio.py")))


def run(args, timeout=None):
    result = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        raise ValueError(f"{args[0]} failed: {result.stderr.strip()}")
    return result.stdout


def probe(path):
    return json.loads(run(["ffprobe", "-v", "error", "-show_streams",
                           "-of", "json", str(path)]))["streams"]


def video_info(streams):
    videos = [s for s in streams if s["codec_type"] == "video"]
    if not videos:
        raise ValueError("VIDEO must contain a video stream")
    video = videos[0]
    rotation = [s.get("rotation", 0) for s in video.get("side_data_list", [])]
    rotation.append(video.get("tags", {}).get("rotate", 0))
    if any(float(r) % 360 for r in rotation):
        raise ValueError("normalize VIDEO rotation before previewing")
    if video.get("sample_aspect_ratio", "1:1") not in ("1:1", "N/A"):
        raise ValueError("normalize VIDEO to square pixels before previewing")
    duration = float(video.get("duration", 0))
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError("VIDEO must report a positive video-stream duration")
    width, height = video["width"], video["height"]
    if width < 64 or width % 2 or height % 2:
        raise ValueError("VIDEO needs even dimensions and width >= 64 for H.264 preview")
    return width, height, duration


def cfr_timing(path, streams):
    """Verify the declared rational grid against every decoded presentation timestamp."""
    message = ("unsupported VFR or unverified frame timing; normalize VIDEO to a "
               "constant-frame-rate animation MP4 before previewing")
    video = next(s for s in streams if s["codec_type"] == "video")
    try:
        rate = Fraction(video["r_frame_rate"])
        timebase = Fraction(video["time_base"])
        if rate <= 0 or timebase <= 0:
            raise ValueError(message)
        period = 1 / rate / timebase
        frames = json.loads(run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                                 "-show_frames", "-show_entries",
                                 "frame=best_effort_timestamp,pkt_duration",
                                 "-of", "json", str(path)], timeout=120))["frames"]
        if not frames:
            raise ValueError(message)
        first = int(frames[0]["best_effort_timestamp"])
        previous = first - 1
        # Allow at most one source timebase tick of muxer quantization, never
        # cumulative drift. Frame-rate metadata alone does not establish CFR.
        for index, frame in enumerate(frames):
            pts = int(frame["best_effort_timestamp"])
            if (pts <= previous or abs(pts - first - index * period) > 1 or
                    abs(int(frame["pkt_duration"]) - period) > 1):
                raise ValueError(message)
            previous = pts
        duration = int(video["duration_ts"]) * timebase
        if abs(duration / timebase - len(frames) * period) > 1:
            raise ValueError(message)
    except (KeyError, TypeError, ValueError, ZeroDivisionError) as error:
        raise ValueError(message) from error
    except subprocess.TimeoutExpired as error:
        raise ValueError("CFR frame-timing inspection exceeded its 120-second execution "
                         "timeout (not a video duration limit)") from error
    return len(frames), timebase, rate, float(duration)


def variation_selector(char):
    return 0xfe00 <= ord(char) <= 0xfe0f or 0xe0100 <= ord(char) <= 0xe01ef


def load_font(path, size, text):
    from PIL import ImageFont
    if path is None:
        candidates = [Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
                      Path("/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc")]
        if shutil.which("fc-match"):
            match = run(["fc-match", "-f", "%{file}", ":lang=zh"]).strip()
            if match:
                candidates.append(Path(match))
    else:
        candidates = [Path(path)]
    # Format controls/selectors need no standalone ink. Keep them in the actual
    # strings so Pillow measures and renders them in context with adjacent text.
    required = {c for c in "中文字汉" + text if c not in "\n\r\t"
                and unicodedata.category(c) != "Cf" and not variation_selector(c)}
    for candidate in candidates:
        try:
            font = ImageFont.truetype(str(candidate), size)
            missing = bytes(font.getmask(chr(0x10ffff)))
            if all(bytes(font.getmask(c)) != missing and
                   (c.isspace() or font.getmask(c).getbbox()) for c in required):
                return font
        except (OSError, ValueError):
            continue
    raise ValueError("no usable Chinese font covering the subtitle text; pass --font PATH "
                     "to a covering TTF/OTF/TTC (for example Noto Sans CJK)")


def wrap(text, font, width):
    """Wrap Unicode by measured ink bounds; keep explicit lines and combining marks."""
    lines = []
    for paragraph in text.replace("\r\n", "\n").replace("\r", "\n").expandtabs(4).split("\n"):
        clusters = []
        for char in paragraph:
            if clusters and (unicodedata.combining(char) or variation_selector(char)):
                clusters[-1] += char
            else:
                clusters.append(char)
        line = ""
        for cluster in clusters:
            box = font.getbbox(line + cluster)
            if box[2] - box[0] > width:
                if line:
                    lines.append(line)
                line = cluster
                box = font.getbbox(line)
                if box[2] - box[0] > width:
                    raise ValueError("subtitle glyph exceeds band width")
            else:
                line += cluster
        lines.append(line)
    return lines


def cue_intervals(events, duration, timecode):
    end = duration * audio_plan["SAMPLE_RATE"]
    spans = [e for e in events if "segment" in e]
    bounds = {0, end}
    for event in spans:
        bounds.update(min(end, event[k]) for k in ("start_sample", "end_sample"))
    if timecode:
        bounds.update(s * 16000 for s in range(1, math.ceil(duration)))
    bounds = sorted(bounds)
    result = []
    for first, last in zip(bounds, bounds[1:]):
        active = tuple(sorted({e["segment"] for e in spans
                               if e["start_sample"] <= first < e["end_sample"]}))
        second = int(first / 16000) if timecode else None
        result.append((first / 16000, last / 16000, active, second))
    return result


def band_layouts(plan, intervals, font, width):
    margin = max(8, width // 80)
    wrapped = [wrap(s["speaker"] + ": " + s["text"], font, width - 2 * margin)
               for s in plan.get("segments", [])]
    layouts = {}
    episode = plan.get('layout') == 'episode'
    sections = [s.get('section', 'dialogue') for s in plan.get('segments', [])]
    context_height = 0
    if episode:
        for first, _, active, _ in intervals:
            count = sum(len(wrapped[i]) for i in active if sections[i] == 'context')
            if count > 6:
                raise ValueError(f'context at {first:g}s exceeds 6 wrapped lines; '
                                 'Creator must shorten the current beat or split its spans; no text truncated')
            context_height = max(context_height, count)
    for _, _, active, second in intervals:
        key = (active, second)
        if key in layouts:
            continue
        lines = []
        if second is not None:
            clock = f"{second // 3600:02d}:{second // 60 % 60:02d}:{second % 60:02d}"
            lines.extend(wrap(clock, font, width - 2 * margin))
        if episode:
            header = [line for i in active if sections[i] == 'header' for line in wrapped[i]]
            notes = [line for i in active if sections[i] == 'context' for line in wrapped[i]]
            lines.extend(header)
            lines.extend(wrap('【说明】', font, width - 2 * margin))
            lines.extend(notes + [''] * (context_height - len(notes)))
            lines.extend(wrap('【对白/旁白】', font, width - 2 * margin))
            lines.extend(line for i in active if sections[i] == 'dialogue' for line in wrapped[i])
        else:
            lines.extend(line for index in active for line in wrapped[index])
        layouts[key] = lines
    return layouts


def render_bands(directory, plan, intervals, font, width):
    from PIL import Image, ImageDraw
    margin = max(8, width // 80)
    layouts = band_layouts(plan, intervals, font, width)
    ascent, descent = font.getmetrics()
    line_height = max([ascent + descent] + [font.getbbox(line)[3] - font.getbbox(line)[1]
                       for lines in layouts.values() for line in lines]) + 4
    height = 2 * margin + max(1, max(map(len, layouts.values()))) * line_height
    height += height % 2
    images = {}
    for key, lines in layouts.items():
        # Identical rendered cues share a PNG, including pauses and repeated text.
        content = tuple(lines)
        if content in images:
            continue
        name = f"band-{len(images):04d}.png"
        image = Image.new("RGB", (width, height), "black")
        draw = ImageDraw.Draw(image)
        for index, line in enumerate(lines):
            left, top, _, _ = font.getbbox(line)
            draw.text((margin - left, margin + index * line_height - top),
                      line, font=font, fill="white")
        image.save(directory / name)
        images[content] = name
    entries = ["ffconcat version 1.0"]
    for first, last, active, second in intervals:
        name = images[tuple(layouts[(active, second)])]
        entries.append(f"file '{name}'")
    entries.append(f"file '{name}'")
    manifest = directory / "bands.ffconcat"
    manifest.write_text("\n".join(entries) + "\n", encoding="utf-8")
    return manifest, height, len(images)


def encode(video, replacement, streams, duration, height, band_height, manifest, intervals,
           frame_count, timebase, rate, output):
    args = ["ffmpeg", "-v", "error", "-nostdin", "-n", "-copyts",
            "-noautorotate", "-i", str(video), "-f", "concat", "-safe", "0",
            "-i", str(manifest)]
    if replacement:
        args.extend(["-i", str(replacement)])
    # One decoded image per event, timed explicitly: old concat demuxers force
    # PNGs onto a 25 Hz clock even when durations contain more precision.
    starts = [first for first, _, _, _ in intervals] + [duration]
    timing = "+".join(f"eq(N,{index})*{at:.9f}" for index, at in enumerate(starts))
    filters = [f"[0:v:0]setpts=PTS-STARTPTS,pad=iw:ih+{band_height}:0:0[base]",
               f"[1:v:0]settb=1/16000,setpts='({timing})/TB'[band]",
               f"[base][band]overlay=0:{height}:eof_action=repeat,"
               f"trim=end_frame={frame_count}[v]"]
    # Bound only the filtered video: output -frames:v/-t can stop audio before
    # the last picture's display interval. Its own atrim below owns audio EOF.
    has_audio = replacement or any(s["codec_type"] == "audio" for s in streams)
    if has_audio:
        start = next(s for s in streams if s["codec_type"] == "video").get("start_time", "0")
        expression = "PTS-STARTPTS" if replacement else f"PTS-({float(start)})/TB"
        source = "2:a:0" if replacement else "0:a:0"
        filters.append(f"[{source}]asetpts={expression},aresample=async=1:first_pts=0,"
                       f"apad,atrim=duration={duration}[a]")
    args.extend(["-filter_complex_threads", "1", "-filter_complex", ";".join(filters),
                 "-map", "[v]"])
    if has_audio:
        args.extend(["-map", "[a]", "-c:a", "aac"])
    args.extend(["-map_metadata", "-1", "-c:v", "libx264", "-threads", "2",
                 "-crf", "18", "-pix_fmt", "yuv420p", "-vsync", "0",
                 "-enc_time_base:v", str(timebase), "-r", str(rate),
                 "-video_track_timescale", str(timebase.denominator),
                 "-movflags", "+faststart", str(output)])
    run(args)


def publish(source, output):
    # Exclusive creation also catches collisions that appear during encoding.
    stream = output.open("xb")
    identity = os.fstat(stream.fileno())
    try:
        with stream, source.open("rb") as rendered:
            shutil.copyfileobj(rendered, stream)
    except BaseException:
        try:
            stream.close()
        except OSError:
            pass
        try:
            current = output.lstat()
            if (current.st_dev, current.st_ino) == (identity.st_dev, identity.st_ino):
                output.unlink()
        except OSError:
            pass
        raise


def main():
    parser = audio_plan["Parser"](description=__doc__)
    parser.add_argument("video")
    parser.add_argument("plan")
    parser.add_argument("--output", required=True)
    parser.add_argument("--timecode", action="store_true")
    parser.add_argument("--audio", metavar="WAV")
    parser.add_argument("--font", metavar="PATH")
    args = parser.parse_args()
    output = Path(args.output).absolute()
    if output.exists() or output.is_symlink():
        raise ValueError(f"refusing to overwrite {output}")
    if output.suffix.lower() != ".mp4" or not output.parent.is_dir():
        raise ValueError("--output must be a new .mp4 in an existing directory")
    video = Path(args.video).resolve(strict=True)
    streams = probe(video)
    width, height, duration = video_info(streams)
    frame_count, timebase, rate, duration = cfr_timing(video, streams)
    plan = json.loads(Path(args.plan).read_text(encoding="utf-8"))
    # Plans use ffprobe's six-decimal duration, including a rounded-up endpoint.
    _, events, _, _ = audio_plan["validate_plan"](plan, round(duration, 6))
    replacement = Path(args.audio).resolve(strict=True) if args.audio else None
    if replacement and not any(s["codec_type"] == "audio" for s in probe(replacement)):
        raise ValueError("--audio must contain an audio stream")
    text = "0123456789: " + "".join(s["speaker"] + s["text"]
                                  for s in plan.get("segments", []))
    font = load_font(args.font, max(16, min(48, width // 40)), text)
    intervals = cue_intervals(events, duration, args.timecode)
    with tempfile.TemporaryDirectory(prefix="previs-preview-", dir="/tmp/opencode") as temp:
        directory = Path(temp)
        manifest, band_height, images = render_bands(directory, plan, intervals, font, width)
        rendered = directory / "preview.mp4"
        encode(video, replacement, streams, duration, height, band_height,
               manifest, intervals, frame_count, timebase, rate, rendered)
        publish(rendered, output)
    print(json.dumps({"output": str(output), "duration": duration, "width": width,
                      "picture_height": height, "band_height": band_height,
                      "cue_images": images, "intervals": len(intervals)}))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, OverflowError, ImportError) as error:
        print("previs-preview: " + " ".join(str(error).splitlines()), file=sys.stderr)
        sys.exit(1)
