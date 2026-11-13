"""Assemble TikTok video #2 from tt4.mjs recordings + RHVoice lines.
python3 tt3_build.py <voice_dir> <out.mp4>"""
import json, subprocess, sys, os
VOICE, OUT = sys.argv[1], sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__)); TT = os.path.join(HERE, 'video', 'tt4'); SEG = os.path.join(TT, 'seg'); os.makedirs(SEG, exist_ok=True)
marks = json.load(open(os.path.join(TT, 'marks.json')))
# scene, target length (s), voice line
PLAN = [('threat', 7.5, 1), ('arena', 3.7, 2), ('horde', 3.3, 3), ('twohand', 4.8, 4), ('mail', 3.1, 5), ('market', 3.2, 6), ('cta', 6.2, 7)]
def dur(f): return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).decode().strip())
def run(*a): subprocess.run(a, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
OFFSET = {'threat': -1.5}; SPEED = {'threat': 1.0}
segs = []
for name, target, _ in PLAN:
    m = dict(marks[name]); m['from'] += OFFSET.get(name, 0); src_len = m['to'] - m['from']
    speed = SPEED.get(name) or max(1.0, min(1.8, src_len / target))          # fast-forward long takes a little
    take = min(src_len, target * speed)
    out = os.path.join(SEG, name + '.mp4')
    vf = f"setpts=(PTS-STARTPTS)/{speed:.3f},scale=1080:1920,fps=30,tpad=stop_mode=clone:stop_duration=3,trim=duration={target}"
    run('ffmpeg', '-y', '-ss', f"{m['from']:.3f}", '-t', f"{take:.3f}", '-i', m['file'], '-vf', vf, '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', out)
    segs.append((out, target))
    print(name, f'src {src_len:.1f}s ×{speed:.2f} → {target}s')
# video: concat with short crossfades
inputs, flt, off, prev = [], [], 0.0, '0:v'
XF = 0.25
for i, (f, t) in enumerate(segs):
    inputs += ['-i', f]
for i in range(1, len(segs)):
    off += segs[i - 1][1] - XF
    lab = f'v{i}'; flt.append(f"[{prev}][{i}:v]xfade=transition=fade:duration={XF}:offset={off:.3f}[{lab}]"); prev = lab
total = sum(t for _, t in segs) - XF * (len(segs) - 1)
# audio: each voice line starts 0.15 s into its scene
starts, t = [], 0.0
for i, (_, target, _) in enumerate(PLAN):
    starts.append(t + 0.15); t += target - XF
ai = len(segs); amix = []
for i, (_, _, line) in enumerate(PLAN):
    inputs += ['-i', os.path.join(VOICE, f'v{line}.wav')]
    ms = int(starts[i] * 1000); amix.append(f"[{ai + i}:a]aresample=44100,adelay={ms}|{ms},volume=1.6[a{i}]")
flt += amix + [''.join(f'[a{i}]' for i in range(len(PLAN))) + f"amix=inputs={len(PLAN)}:normalize=0,apad,atrim=duration={total:.3f},loudnorm=I=-14:TP=-1.5[aout]"]
run('ffmpeg', '-y', *inputs, '-filter_complex', ';'.join(flt), '-map', f'[{prev}]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-t', f'{total:.3f}', OUT)
print('total', round(total, 2), 's →', OUT)
