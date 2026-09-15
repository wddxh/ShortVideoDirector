#!/usr/bin/env python3
"""Internal stdin payload renderer for episode-previs.mjs; no editable clock source.

Plans contain dialogue/narration/body only. Creator removes obsolete task clocks
and cut labels semantically before invocation; this tool never rewrites text.
"""
import json
from fractions import Fraction
import os
from pathlib import Path
import runpy
import shutil
import sys
import tempfile

preview_path = Path(__file__).with_name('previs-preview.py')
preview = runpy.run_path(str(preview_path))
run, probe = preview['run'], preview['probe']
check_media = runpy.run_path(str(Path(__file__).with_name('local-reference-media-check.py')))['check_media']


def context(part, operation):
    try:
        return operation()
    except (ValueError, OSError) as error:
        raise ValueError(f"part {part['part']} / {part['task_id']}: {error}") from error


def read_part(part, expected):
    plan = json.loads(Path(part['plan']).read_text(encoding='utf-8'))
    if not isinstance(plan, dict) or set(plan) != {'segments'}:
        raise ValueError('plan requires only segments (dialogue/narration/body; no old clocks/cuts)')
    preview['audio_plan']['validate_plan'](plan, part['duration'])
    actual, streams, errors = check_media(expected, part['video'], part['duration'])
    if errors:
        raise ValueError('; '.join(errors))
    return {**part, 'segments': plan['segments'], 'streams': streams,
            'width': actual['width'], 'height': actual['height'],
            'rate': Fraction(actual['fps']), 'frames': actual['frames']}


def episode_plan(parts):
    segments = []
    for part in parts:
        for segment in part['segments']:
            segments.append({**segment, 'spans': [[a + part['start'], b + part['start']]
                                                  for a, b in segment['spans']]})
        for shot in part['timeline']:
            segments.append({'speaker': 'SHOT',
                             'text': f"{shot['shot']} [{shot['start']}s-{shot['end']}s]",
                             'spans': [[shot['start'], shot['end']]]})
    return {'segments': segments}


def concatenate(parts, rate, audio, output):
    args = ['ffmpeg', '-v', 'error', '-nostdin', '-n', '-copyts']
    filters, inputs = [], []
    for index, part in enumerate(parts):
        args += ['-noautorotate', '-i', part['video']]
        filters.append(f'[{index}:v:0]setpts=PTS-STARTPTS[v{index}]')
        inputs.append(f'[v{index}]')
        if audio:
            if any(s['codec_type'] == 'audio' for s in part['streams']):
                start = next(s for s in part['streams'] if s['codec_type'] == 'video').get('start_time', '0')
                source = (f'[{index}:a:0]asetpts=PTS-({float(start)})/TB,'
                          'aresample=48000:async=1:first_pts=0,apad')
            else:
                source = 'anullsrc=r=48000:cl=stereo'
            filters.append(f'{source},aformat=sample_rates=48000:channel_layouts=stereo,'
                           f"atrim=duration={part['duration']},asetpts=PTS-STARTPTS[a{index}]")
            inputs.append(f'[a{index}]')
    filters.append(''.join(inputs) + f'concat=n={len(parts)}:v=1:a={int(audio)}[joined]' +
                   ('[a]' if audio else ''))
    filters.append(f'[joined]settb=1/{rate.numerator},setpts=N*{rate.denominator}[v]')
    args += ['-filter_complex_threads', '1', '-filter_complex', ';'.join(filters), '-map', '[v]']
    if audio:
        args += ['-map', '[a]', '-c:a', 'aac']
    args += ['-map_metadata', '-1', '-c:v', 'libx264', '-threads', '2', '-crf', '18',
             '-pix_fmt', 'yuv420p', '-vsync', '0', '-enc_time_base:v', f'1/{rate.numerator}',
             '-r', str(rate), '-video_track_timescale', str(rate.numerator), str(output)]
    run(args)


def check_clock(video, duration, rate):
    streams = probe(video)
    frames, _, actual_rate, _ = preview['cfr_timing'](video, streams)
    if frames != duration * rate or actual_rate != rate:
        raise ValueError(f'{video.name}: encoded episode clock mismatch')
    for stream in streams:
        # AAC containers quantize the endpoint to milliseconds.
        tolerance = 0.002 if stream['codec_type'] == 'audio' else 0.000002
        if abs(float(stream.get('start_time', 0))) > tolerance or abs(float(stream['duration']) - duration) > tolerance:
            raise ValueError(f"{video.name}: {stream['codec_type']} start/duration mismatch")


def publish(source, output):
    # Stage on the destination filesystem; a hard link publishes atomically and
    # exclusively even if another caller creates output while we encode.
    with tempfile.TemporaryDirectory(prefix='.episode-previs-', dir=output.parent) as temp:
        staged = Path(temp) / 'complete.mp4'
        shutil.copyfile(source, staged)
        os.link(staged, output)


def main():
    payload = json.load(sys.stdin)
    output = Path(payload['output'])
    if output.exists() or output.is_symlink():
        raise ValueError(f'refusing to overwrite {output}')
    if output.suffix.lower() != '.mp4' or not output.parent.is_dir():
        raise ValueError('--output must be a new .mp4 in an existing directory')
    if not Path('/tmp/opencode').is_dir():
        raise ValueError('/tmp/opencode must be an existing temporary directory')
    expected = payload['expected']
    parts = [context(p, lambda p=p: read_part(p, expected)) for p in payload['mapping']]
    rate = Fraction(expected['fps'])
    width, height = expected['width'], expected['height']
    audio = any(s['codec_type'] == 'audio' for p in parts for s in p['streams'])
    plan = episode_plan(parts)
    # Fail missing fonts before encoding the clean concatenation.
    text = '0123456789: ' + ''.join(s['speaker'] + s['text'] for s in plan['segments'])
    preview['load_font'](payload.get('font'), max(16, min(48, width // 40)), text)
    with tempfile.TemporaryDirectory(prefix='episode-previs-', dir='/tmp/opencode') as temp:
        directory = Path(temp)
        clean = directory / 'clean.mp4'
        try:
            concatenate(parts, rate, audio, clean)
            check_clock(clean, payload['duration'], rate)
        except ValueError as error:
            names = ', '.join(f"part {p['part']} / {p['task_id']}" for p in parts)
            raise ValueError(f'concat {names}: {error}') from error
        plan_path = directory / 'plan.json'
        plan_path.write_text(json.dumps(plan, ensure_ascii=False), encoding='utf-8')
        rendered = directory / 'caption.mp4'
        args = [sys.executable, str(preview_path), str(clean), str(plan_path),
                '--timecode', '--output', str(rendered)]
        if payload.get('font'):
            args += ['--font', payload['font']]
        info = json.loads(run(args))
        check_clock(rendered, payload['duration'], rate)
        publish(rendered, output)
    mapping = [{**original, 'dimensions': {'width': part['width'], 'height': part['height']},
                'audio': any(s['codec_type'] == 'audio' for s in part['streams'])}
               for original, part in zip(payload['mapping'], parts)]
    print(json.dumps({'output': str(output), 'ep': payload['ep'],
                      'config': payload['config'], 'expected': expected,
                      'tasks': [p['task_id'] for p in parts],
                      'shots': [s for p in parts for s in p['shots']],
                      'duration': payload['duration'], 'fps': str(rate), 'audio': audio,
                      'dimensions': {'width': width, 'picture_height': height,
                                     'band_height': info['band_height'],
                                     'height': height + info['band_height']},
                      'mapping': mapping}))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, OverflowError, ImportError) as error:
        print(' '.join(str(error).splitlines()), file=sys.stderr)
        sys.exit(1)
