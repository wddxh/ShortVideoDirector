# SVG frame author → reusable MP4 component

SVG is one material source. A complete task video may combine SVG clips, existing
PNG stills, 2D animation and necessary 3D clips. Reuse suitable existing media;
only author/render the parts that need it. This tool exports an SVG-authored clip
of the explicitly requested duration; it does not require all tasks or materials
to be SVG and does not assemble mixed-media inputs itself.

The six-second example below happens to cover a whole synthetic task using only
SVG, demonstrating this component rather than imposing a workflow requirement.
Regardless of material mix, deliver a **complete clean task MP4 plus a complete
subtitle/timecode review MP4 on the same timeline**, governed by the storyboard.

Run from the repository root (create the output parent first):

```sh
mkdir -p /tmp/opencode/svg-animatic-engineering
python3 scripts/svg-animatic.py examples/svg-animatic/source.py \
  --duration 6 --fps 24 --width 640 --height 360 \
  --output /tmp/opencode/svg-animatic-engineering/example.mp4
```

Add `--overwrite` to atomically replace an existing output after successful
encoding. Otherwise an existing output is an error. SOURCE itself, including
symlink/hardlink aliases, cannot be the output. The output must end in `.mp4`.

## Author interface and clock

`SOURCE.py` defines `frame(t, width, height) -> str`, returning one **static SVG
document**. The module loads once; all calls execute sequentially in one Python
process. `t` is an exact Python `fractions.Fraction`: `n / fps` for
`n = 0 .. duration * fps - 1`. Convert to `float` for geometry when useful, while
keeping cut comparisons exact. Load reusable data at module scope; use
`Path(__file__).parent` for source-relative Python assets. Execution keeps the
caller's working directory.

All five CLI values (`--output`, `--duration`, `--fps`, `--width`, `--height`) are
required. Duration/fps accept positive decimal or fraction strings. Their product
must be an integer; incompatible timing fails instead of rounding. Dimensions
must be positive even integers for H.264/yuv420p. The final frame covers
`[duration - 1/fps, duration)`; there is no extra endpoint frame.

Each invocation exports every frame of the requested SVG clip. It can cover one
portion or, as in this fixture, the whole task. The author derives the portion's
duration, placement and internal cuts from the authoritative storyboard and
chooses a frame grid that represents them. After assembling all materials, the
complete task retains every source shot, cut and the full task duration. This tool
does not read or modify manifests, retime shots, infer boundaries, or certify
content fidelity. Off-grid events first appear at the next sampled frame.

Exact timing is stored in the video track (timescale = fps numerator); inspect
`duration_ts * time_base` and decoded frame timestamps. Older FFmpeg MP4 container
summary durations may round to milliseconds; the video track remains exact.

## Runtime and SVG support

Requires Python 3, system **librsvg >= 2.46**, its Cairo/GLib/GObject dependencies,
and FFmpeg with libx264 on PATH. The renderer uses Python stdlib `ctypes` to call
librsvg's static document API, resolving Cairo/GLib through that library. Missing
libraries/symbols or encoder errors fail nonzero; nothing is auto-installed.
Pillow and CairoSVG are not required.

Supported scope is librsvg static SVG: shapes, paths, groups/transforms, painter's
order/occlusion and text with installed fonts. Supply `viewBox` and explicit root
dimensions. Compute every animated state from `t`; SMIL, JavaScript, CSS animation,
browser layout and `foreignObject` are outside this interface. SVG features ignored
by librsvg are not automatically diagnosed. Transparent areas flatten over black.
This is a silent RGB video exporter, without rigs or an animation DSL.

The document is loaded from memory without a base URI. Keep SVG self-contained;
embed image data rather than relying on relative SVG resource URLs. SOURCE is
trusted executable local Python with the caller's privileges, **not a sandbox**.

Rasterized native RGB frames go straight to one FFmpeg rawvideo pipe. No per-frame
SVG/PNG files accumulate. An adjacent temporary directory holds only the MP4 and
encoder log; normal source/frame/SVG/encoder errors clean it and preserve the old
output. Success publishes atomically on the same filesystem. Abrupt SIGKILL/power
loss can leave the hidden temporary directory, but cannot publish a partial MP4.
Success prints JSON with output path, frame count, exact duration/fps strings and
dimensions; failures report diagnostics on stderr and exit nonzero.

## Fixture references

- Source: `examples/svg-animatic/source.py`; all geometry is synthetic and local.
- Dependencies verified here: Python 3.13.5 and 3.10.12; librsvg 2.52.5, Cairo
  1.16.0; FFmpeg/ffprobe 4.4.2 with libx264. Pillow 11.1.0 is available for optional
  engineering thumbnails; CairoSVG is absent.
- Font: `DejaVu Sans`, resolved here to
  `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf` (`fc-match 'DejaVu Sans'`).
  Text uses English ASCII. Font substitution/glyph coverage is host-dependent;
  choose and record installed fonts covering the actual language, inspect text,
  or author text outlines. The tool does not install fonts or certify glyphs.
- No story materials, external imagery, audio, model or provider calls.

Keep source, font names/files, dependencies and any reused assets in the consuming
project's existing references declaration; the exporter creates no new ledger.

| Time | Frames at 24 fps | Synthetic content |
| --- | --- | --- |
| [0, 2) | 0–47 | Static wide composition, screen and bodybox |
| [2, 4) | 48–95 | Hard cut, bodybox translates behind a foreground pillar |
| [4, 6) | 96–143 | Hard cut to screen UI, full two-second reading hold |

The bodybox controls layout/trajectory only; its rigid sliding is not a final
walking performance. No limbs are needed for this synthetic translation fixture.
There are visible intermediate positions before, during and after occlusion.
This example verifies an engineering path, not production acceptance.

## Reproduce checks

```sh
node --test .opencode/tests/svg-animatic.test.js
ffprobe -v error -count_frames \
  -show_entries stream=codec_name,width,height,time_base,duration_ts,nb_read_frames \
  -of json /tmp/opencode/svg-animatic-engineering/example.mp4
ffmpeg -v error -n -i /tmp/opencode/svg-animatic-engineering/example.mp4 \
  -vf "select='eq(n,47)+eq(n,48)+eq(n,60)+eq(n,72)+eq(n,84)+eq(n,96)'" \
  -vsync 0 /tmp/opencode/svg-animatic-engineering/sample-%02d.png
```

Expected: H.264, 640×360, 144 decoded frames, `time_base=1/24`,
`duration_ts=144`. Tests use the actual rasterizer/encoder (dependencies required),
check exact rational timestamps and both cuts, sample movement/occlusion pixels,
and exercise source/frame/SVG failures, explicit replacement, source alias
protection, and a real FFmpeg file-size failure with cleanup.

## Mixed-source assembly with existing FFmpeg

For example, suppose the storyboard calls for three two-second portions:
an SVG clip, an existing PNG hold, then an existing 2D **or** 3D animation clip.
The following is a composition template with placeholder input paths, not an
additional implemented tool or the source of the pure-SVG fixture's timing.
Use actual storyboard durations and selected source ranges. Here the two videos
are already 24 fps, 640×360, square-pixel, with at least 48 frames available;
prepare compatible media when needed without recreating usable imagery.

```sh
ffmpeg -v error -n \
  -i /path/to/svg-portion.mp4 \
  -loop 1 -framerate 24 -i /path/to/existing-still.png \
  -i /path/to/existing-2d-or-3d-clip.mp4 \
  -filter_complex "[0:v]trim=start_frame=0:end_frame=48,setpts=PTS-STARTPTS[a]; \
    [1:v]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2,setsar=1,trim=end_frame=48,setpts=PTS-STARTPTS[b]; \
    [2:v]trim=start_frame=0:end_frame=48,setpts=PTS-STARTPTS[c]; \
    [a][b][c]concat=n=3:v=1:a=0[v]" \
  -map '[v]' -an -c:v libx264 -pix_fmt yuv420p -vsync 0 -enc_time_base 1/24 \
  -video_track_timescale 24 -movflags +faststart \
  /tmp/opencode/svg-animatic-engineering/mixed-clean.mp4
```

This silent template makes hard cuts after frames 47 and 95. It neither supplies
missing frames nor validates input suitability; check the assembled output is
144 frames/6 seconds and inspect its cuts before deriving the review version.
Retain required source audio with an appropriate audio composition when present;
`-an` here applies only to the silent example. Suitable clips can also use FFmpeg's
concat demuxer with stream copy when their encoding/timestamps are compatible.
Final delivery remains the full clean video and its full same-timeline review,
not a collection of component clips. Assembly is independent of the SVG renderer.

## Complete subtitle review MP4 (second command)

For mixed materials, run this step on the **assembled complete clean task**,
not on each component separately. Subtitle windows use task-global storyboard
time; component-local `t=0` does not reset the task's subtitle clock.

Deliver both the complete clean MP4 above and the complete review MP4 below.
Use the existing preview tool to add a subtitle band and elapsed timecode:

```sh
python3 scripts/previs-preview.py \
  /tmp/opencode/svg-animatic-engineering/example.mp4 \
  examples/svg-animatic/review-plan.json \
  --timecode --font /usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc \
  --output /tmp/opencode/svg-animatic-engineering/example-review.mp4
```

`previs-preview.py` requires a **new output path**; it has no overwrite flag.
For another run choose a new review filename. This second command needs Python
with Pillow, FFmpeg/ffprobe, and a covering CJK font. Verified here: Pillow 11.1.0
and the explicit Noto Sans CJK font above. System Python without Pillow can export
the clean SVG MP4 but cannot run this subtitle command.

The existing PLAN format is `{"segments":[{"speaker":"...","text":"...",
"spans":[[start,end]]}]}` with half-open time windows in seconds. Each segment's
complete original text appears throughout its window, with overlapping segments
on separate lines. Cut labels are explicitly named `切点标识` segments: the preview
tool renders `segments`, whereas audio `cues` are not visual subtitle labels.

`review-plan.json` is a synthetic engineering reference, not canonical source.
Its test original words and windows are:

| Window (seconds) | Type | Original text |
| --- | --- | --- |
| [0.25, 1.75) | 测试旁白 | 先看静态构图。 |
| [2, 2.75) | 切点标识 | 02.000s 硬切：侧面移动 |
| [2.25, 3.75) | 测试对白 | 我从立柱后经过。 |
| [4, 4.75) | 切点标识 | 04.000s 硬切：屏幕特写 |
| [4.25, 5.75) | 测试旁白 | 屏幕显示：准备就绪。 |

In production, derive original words, speakers, windows and cut markers from the
authoritative storyboard; neither this fixture nor the SVG export creates that
authority. The sample remains silent: these are timing-review subtitles, not
recorded dialogue. The review band and cut labels are internal review content.
`--timecode` displays HH:MM:SS, updated once per second (not a frame counter).
Explicit labels give the exact cut seconds; the PLAN provides subsecond windows.

Verified clean/review pair: both **6 seconds, 24 fps, 144 frames**, with identical
decoded frame timestamps and packet durations. Clean is 640×360; review is
640×460 because the existing tool adds a 100-pixel band without covering the
picture. The integration test checks timing equality, subtitle window boundaries,
overlapping labels/dialogue and clock changes. Engineering screenshot inspection
at 1s, 2.25s and 4.25s confirms readable complete Chinese text, without clipping.

Optional engineering screenshots (the full review MP4 is the deliverable):

```sh
ffmpeg -v error -n \
  -i /tmp/opencode/svg-animatic-engineering/example-review.mp4 \
  -vf "select='eq(n,24)+eq(n,54)+eq(n,102)'" -vsync 0 \
  /tmp/opencode/svg-animatic-engineering/review-%02d.png
```

Screenshots: `review-01.png` (1s), `review-02.png` (2.25s), and
`review-03.png` (4.25s), alongside both complete MP4s in the temporary directory.
