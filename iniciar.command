#!/bin/bash
cd "$(dirname "$0")"
PORT=8934
open "http://localhost:$PORT/index.html"
python3 -m http.server "$PORT"
