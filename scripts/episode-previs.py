#!/usr/bin/env python3
"""Internal stdin payload renderer for episode-previs.mjs; no editable clock source.

PLAN: {segments: [...], context?: [{shot, scene, spans, camera?, action?,
performance?}]}. Context spans are task-local half-open seconds, contained in
their canonical shot; each entry is a complete window, not a persistent update.
Creator supplies concise source-based scene/craft text; no prose is inferred.
Distinct context entries cannot overlap. Legacy segments remain unchanged.
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


def validate_context(entries, part):
    if not isinstance(entries, list):
        raise ValueError('context must be an array')
    windows = []
    shots = {s['shot']: s for s in part['timeline']}
    for index, entry in enumerate(entries):
        name = f'context[{index}]'
        if (not isinstance(entry, dict) or not {'shot', 'scene', 'spans'} <= set(entry)
                or set(entry) - {'shot', 'scene', 'spans', 'camera', 'action', 'performance'}):
            raise ValueError(f'{name} requires shot, scene, spans; optional camera/action/performance')
        if type(entry['shot']) is not int or entry['shot'] not in shots:
            raise ValueError(f'{name}.shot must belong to this task')
        for key in ('scene', 'camera', 'action', 'performance'):
            if key in entry:
                preview['audio_plan']['string'](entry[key], f'{name}.{key}')
        if not isinstance(entry['spans'], list) or not entry['spans']:
            raise ValueError(f'{name}.spans must be a nonempty array')
        preview['audio_plan']['validate_plan']({'segments': [
            {'speaker': name, 'text': '', 'spans': entry['spans']}]}, part['duration'])
        shot = shots[entry['shot']]
        for a, b in entry['spans']:
            if not shot['start'] - part['start'] <= a < b <= shot['end'] - part['start']:
                raise ValueError(f'{name}.spans must stay within shot {entry["shot"]}')
            if any(a < end and start < b and owner != index for start, end, owner in windows):
                raise ValueError(f'{name}: overlapping context entries; combine simultaneous fields')
            windows.append((a, b, index))


def read_part(part, expected):
    plan = json.loads(Path(part['plan']).read_text(encoding='utf-8'))
    if (not isinstance(plan, dict) or 'segments' not in plan or
            set(plan) - {'segments', 'context'}):
        raise ValueError('plan allows only segments and optional context (no old clocks/cuts)')
    preview['audio_plan']['validate_plan'](plan, part['duration'])
    validate_context(plan.get('context', []), part)
    actual, streams, errors = check_media(expected, part['video'], part['duration'])
    if errors:
        raise ValueError('; '.join(errors))
    return {**part, 'segments': plan['segments'], 'context': plan.get('context', []),
            'streams': streams,
            'width': actual['width'], 'height': actual['height'],
            'rate': Fraction(actual['fps']), 'frames': actual['frames']}


def episode_plan(parts):
    segments = []
    for part in parts:
        for segment in part['segments']:
            segments.append({**segment, 'section': 'dialogue',
                             'spans': [[a + part['start'], b + part['start']]
                                                   for a, b in segment['spans']]})
        for shot in part['timeline']:
            segments.append({'speaker': part['task_id'], 'section': 'header',
                             'text': f"SHOT {shot['shot']} [{shot['start']}s-{shot['end']}s]",
                             'spans': [[shot['start'], shot['end']]]})
            entries = [e for e in part.get('context', []) if e['shot'] == shot['shot']]
            bounds = sorted({shot['start'], shot['end']} |
                            {t + part['start'] for e in entries for span in e['spans'] for t in span})
            for a, b in zip(bounds, bounds[1:]):
                entry = next((e for e in entries if any(
                    start + part['start'] <= a < end + part['start']
                    for start, end in e['spans'])), None)
                lines = [entry['scene'] if entry else '未提供']
                for key, label in [('camera', '运镜'), ('action', '动作'), ('performance', '表演')]:
                    if entry and key in entry:
                        lines.append(f'{label}：{entry[key]}')
                missing = not entry or not any(k in entry for k in ('camera', 'action'))
                if missing:
                    lines.append('运镜/动作：未提供')
                segments.append({'speaker': '场次', 'text': '\n'.join(lines),
                                 'section': 'context', 'missing': missing, 'spans': [[a, b]]})
    return {'segments': segments, 'layout': 'episode'}


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
    # Validate the complete subtitle layout before any video export.
    text = '0123456789: 【说明】【对白/旁白】' + ''.join(
        s['speaker'] + s['text'] for s in plan['segments'])
    font = preview['load_font'](payload.get('font'), max(16, min(48, width // 40)), text)
    _, events, _, _ = preview['audio_plan']['validate_plan'](plan, payload['duration'])
    intervals = preview['cue_intervals'](events, payload['duration'], True)
    preview['band_layouts'](plan, intervals, font, width)
    warnings = []
    if any(s.get('missing') for s in plan['segments']):
        warnings.append('说明未提供的窗口：新正式交付由 Creator 依据 source 补齐 PLAN.context '
                        '的场次及当前节拍运镜/动作；表演仅在源有依据时填写。')
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
                      'mapping': mapping, 'warnings': warnings}))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, OverflowError, ImportError) as error:
        print(' '.join(str(error).splitlines()), file=sys.stderr)
        sys.exit(1)
