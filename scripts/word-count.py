#!/usr/bin/env python3
"""Count words in a text file. Auto-detects language: Chinese counts characters, English counts words."""
import re
import sys

if len(sys.argv) != 2:
    print("Usage: python3 scripts/word-count.py <file_path>")
    sys.exit(1)

text = open(sys.argv[1], encoding="utf-8").read()
zh = len(re.findall(r"[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]", text))
en = len(re.findall(r"[a-zA-Z]+", text))
print(zh + en if zh > 0 else en)
