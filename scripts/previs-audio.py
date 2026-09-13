#!/usr/bin/env python3
"""Render offline timing placeholders, not TTS, from an editable local JSON plan.

PLAN: {"segments": [{"speaker": str, "text": str, "spans": [[start, end]]}],
       "cues": [{"label": str, "at": seconds, "duration": seconds}]}
Both arrays may be absent or empty. Text and labels never determine timing.
Times are seconds, rounded to the nearest sample (half up); spans are half-open.
Outputs: speaker-001.wav, ... in first-use order, cues.wav when cues exist,
mix.wav, summary.json. All WAVs have the same length and shared gain. Existing
output files are never replaced; unrelated files in the directory are retained.
"""

import argparse
from array import array
import json
import math
from pathlib import Path
import sys
import wave

SAMPLE_RATE = 16000
FADE_SAMPLES = 160


class Parser(argparse.ArgumentParser):
    def error(self, message):
        raise ValueError(message)


def number(value, name):
    if type(value) not in (int, float) or not math.isfinite(value):
        raise ValueError(f"{name} must be a finite number")
    return value


def sample(seconds):
    return math.floor(seconds * SAMPLE_RATE + 0.5)


def interval(start, end, duration, name):
    number(start, name + " start")
    number(end, name + " end")
    if not 0 <= start < end <= duration:
        raise ValueError(f"{name} must satisfy 0 <= start < end <= duration")
    first, last = sample(start), sample(end)
    if first == last:
        raise ValueError(f"{name} collapses to zero samples")
    return first, last


def string(value, name, nonempty=True):
    if not isinstance(value, str) or (nonempty and not value.strip()):
        raise ValueError(f"{name} must be a {'nonempty ' if nonempty else ''}string")
    return value


def add_tone(track, first, last, frequency, cue=False):
    length = last - first
    fade = min(FADE_SAMPLES, (length - 1) / 2)
    for offset in range(length):
        time = offset / SAMPLE_RATE
        edge = min(offset, length - 1 - offset)
        envelope = (0.5 - 0.5 * math.cos(math.pi * min(1, edge / fade))) if fade else 0
        if cue:
            tone = 0.07 * (math.sin(math.tau * 1800 * time)
                           + math.sin(math.tau * 2400 * time))
        else:
            # A fixed soft pulse, independent of words, punctuation or syllables.
            pulse = 0.65 + 0.35 * math.cos(math.tau * 2 * time)
            tone = 0.20 * pulse * math.sin(math.tau * frequency * time)
        track[first + offset] += envelope * tone


def validate_plan(plan, duration):
    """Validate without I/O; return speaker metadata and sample-timed events."""
    duration = number(duration, "--duration")
    if duration <= 0 or sample(duration) < 1:
        raise ValueError("--duration must be positive and round to at least one sample")
    if not isinstance(plan, dict):
        raise ValueError("plan must be an object")
    segments, cues = plan.get("segments", []), plan.get("cues", [])
    if not isinstance(segments, list) or not isinstance(cues, list):
        raise ValueError("segments and cues must be arrays")
    speakers, events, cue_labels = {}, [], []
    for index, segment in enumerate(segments):
        name = f"segments[{index}]"
        if not isinstance(segment, dict):
            raise ValueError(f"{name} must be an object")
        speaker = string(segment.get("speaker"), name + ".speaker")
        string(segment.get("text"), name + ".text", nonempty=False)
        spans = segment.get("spans")
        if not isinstance(spans, list):
            raise ValueError(f"{name}.spans must be an array")
        if speaker not in speakers:
            order = len(speakers)
            speakers[speaker] = {
                "speaker": speaker, "file": f"speaker-{order + 1:03d}.wav",
                "frequency_hz": 220 + 660 * order / (order + 6), "span_count": 0,
            }
        for span_index, span in enumerate(spans):
            if not isinstance(span, list) or len(span) != 2:
                raise ValueError(f"{name}.spans[{span_index}] must be [start, end]")
            first, last = interval(*span, duration, f"{name}.spans[{span_index}]")
            events.append({"segment": index, "span": span_index,
                           "track": speakers[speaker]["file"],
                           "start_sample": first, "end_sample": last})
            speakers[speaker]["span_count"] += 1
    span_count = len(events)
    for index, cue in enumerate(cues):
        name = f"cues[{index}]"
        if not isinstance(cue, dict):
            raise ValueError(f"{name} must be an object")
        label = string(cue.get("label"), name + ".label")
        at = number(cue.get("at"), name + ".at")
        length = number(cue.get("duration"), name + ".duration")
        end = at + length
        # Decimal inputs such as 0.1 + 0.2 may exceed 0.3 by one float ULP.
        if duration < end <= math.nextafter(duration, math.inf):
            end = duration
        first, last = interval(at, end, duration, name)
        events.append({"cue": index, "track": "cues.wav",
                       "start_sample": first, "end_sample": last})
        cue_labels.append({"cue": index, "label": label})

    return speakers, events, cue_labels, span_count


def main():
    parser = Parser(description=__doc__)
    parser.add_argument("plan")
    parser.add_argument("--duration", required=True, type=float)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()
    duration = args.duration
    plan = json.loads(Path(args.plan).read_text(encoding="utf-8"))
    speakers, events, cue_labels, span_count = validate_plan(plan, duration)
    segments, cues = plan.get("segments", []), plan.get("cues", [])
    frames = sample(duration)

    overlaps = []
    for index, left in enumerate(events):
        for right in events[index + 1:]:
            first = max(left["start_sample"], right["start_sample"])
            last = min(left["end_sample"], right["end_sample"])
            if first >= last:
                continue
            kind = ("cue" if "cue" in left or "cue" in right else
                    "same_speaker" if left["track"] == right["track"] else "different_speakers")
            overlaps.append({"kind": kind, "left": left, "right": right,
                             "start_sample": first, "end_sample": last})
    same = sum(item["kind"] == "same_speaker" for item in overlaps)
    warnings = [f"{same} same-speaker overlap(s); all spans summed without trimming"] if same else []
    output = Path(args.output_dir)
    filenames = [info["file"] for info in speakers.values()]
    if cues:
        filenames.append("cues.wav")
    files = filenames + ["mix.wav", "summary.json"]
    for filename in files:
        path = output / filename
        if path.exists() or path.is_symlink():
            raise ValueError(f"refusing to overwrite {path}")

    tracks = {filename: array("d", [0]) * frames for filename in filenames}
    frequencies = {info["file"]: info["frequency_hz"] for info in speakers.values()}
    for event in events:
        add_tone(tracks[event["track"]], event["start_sample"], event["end_sample"],
                 frequencies.get(event["track"], 0), cue="cue" in event)
    mix = array("d", [0]) * frames
    peak = 0
    for track in tracks.values():
        for index, value in enumerate(track):
            mix[index] += value
            peak = max(peak, abs(value))
    tracks["mix.wav"] = mix
    peak = max(peak, max(map(abs, mix)))
    # Include individual stems: cancellation in the mix must not clip a stem.
    gain = min(1, 0.95 / peak) if peak else 1
    summary = {
        "sample_rate": SAMPLE_RATE, "channels": 1, "sample_width_bytes": 2,
        "requested_duration": duration, "duration": frames / SAMPLE_RATE,
        "frames": frames, "gain": gain, "peak_before_gain": peak,
        "files": files, "speakers": list(speakers.values()), "cues": cue_labels,
        "counts": {"segments": len(segments), "spans": span_count,
                   "speakers": len(speakers), "cues": len(cues)},
        "events": events, "overlaps": overlaps, "warnings": warnings,
    }
    output.mkdir(parents=True, exist_ok=True)
    streams = {}
    try:
        # Reserve every name exclusively before writing any audio.
        for filename in files:
            streams[filename] = (output / filename).open("xb")
        for filename, track in tracks.items():
            pcm = array("h", (round(value * gain * 32767) for value in track))
            if sys.byteorder != "little":
                pcm.byteswap()
            with wave.open(streams[filename], "wb") as wav:
                wav.setparams((1, 2, SAMPLE_RATE, frames, "NONE", "not compressed"))
                wav.writeframes(pcm.tobytes())
        streams["summary.json"].write((json.dumps(summary, indent=2) + "\n").encode("utf-8"))
        for stream in streams.values():
            stream.flush()
            stream.close()
    except Exception:
        # Buffered writes can fail again on close; still clean every owned path.
        for filename, stream in streams.items():
            try:
                stream.close()
            except OSError:
                pass
            try:
                (output / filename).unlink()
            except OSError:
                pass
        raise
    print(json.dumps({"output_dir": str(output), "files": files,
                      "duration": summary["duration"], "warnings": warnings}))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, OverflowError) as error:
        print("previs-audio: " + " ".join(str(error).splitlines()), file=sys.stderr)
        sys.exit(1)
