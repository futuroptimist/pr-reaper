#!/usr/bin/env python3
import sys
import re

data = sys.stdin.read()
patterns = [r"(?i)api[_-]?key", r"(?i)secret[_-]?key"]
for pat in patterns:
    if re.search(pat, data):
        print(f"Potential secret matched: {pat}")
        sys.exit(1)

sys.exit(0)
