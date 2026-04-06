#!/usr/bin/env python3
"""Check speech rate for storyboard dialogue segments.

Usage: python3 scripts/speech-rate.py "0-3:slow:台词文本" "3-9:normal:台词文本" ...

Arguments: start_sec-end_sec:speed_type:dialogue_text
Speed types: slow (<=3 w/s), normal (<=5 w/s), fast (<=8 w/s)
Auto-detects language: Chinese counts characters, English counts words.
"""
import re
import sys

LIMITS = {"slow": 3, "normal": 5, "fast": 8}

if len(sys.argv) < 2:
    print("Usage: python3 scripts/speech-rate.py \"start-end:speed:text\" ...")
    sys.exit(1)

for arg in sys.argv[1:]:
    ts, spd, txt = arg.split(":", 2)
    s, e = map(float, ts.split("-"))
    dur = e - s
    zh = len(re.findall(r"[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]", txt))
    en = len(re.findall(r"[a-zA-Z]+", txt))
    wc = zh + en if zh > 0 else en
    rate = round(wc / dur, 1) if dur > 0 else 0
    lim = LIMITS[spd]
    flag = "OVER" if rate > lim else "OK"
    print(f"[{ts}s] {dur:.0f}s | {wc} words | {rate} w/s | limit {lim} w/s | {flag}")
