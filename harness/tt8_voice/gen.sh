#!/bin/bash
# Voiceover for TikTok #6 with Audio8-TTS-Realistic-Air (CPU): line 1 sets the voice, the rest clone it.
set -e
. /home/user/a8venv/bin/activate
cd /home/user/edge0-ai/audio8_tts
V=/home/user/serverless-game/harness/video/tt8/voice
T1=$(python3 -c "import json;print(json.load(open('$V/lines.json'))[0][1])")
python audio8_tts_infer.py --model /home/user/a8model --device cpu --dtype float32 --seed 11 --text "$T1" --output $V/create.wav
python3 - <<PY
import json
L=json.load(open('$V/lines.json'))
with open('$V/rest.jsonl','w') as f:
    for k,t in L[1:]: f.write(json.dumps({'id':k,'text':t,'reference_audio':'$V/create.wav','reference_text':L[0][1]},ensure_ascii=False)+'\n')
PY
python audio8_tts_infer.py --model /home/user/a8model --device cpu --dtype float32 --seed 11 --input-jsonl $V/rest.jsonl --output-dir $V --batch-size 1
echo DONE
