"""Assemble TikTok video #4 (no voice: captions only, silent audio track) from tt6.mjs recordings.
python3 tt6_build.py <out.mp4>"""
import json, subprocess, sys, os
OUT = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__)); TT = os.path.join(HERE, 'video', 'tt6'); SEG = os.path.join(TT, 'seg'); os.makedirs(SEG, exist_ok=True)
marks = json.load(open(os.path.join(TT, 'marks.json')))
PLAN = [('lands', 6.2), ('land2', 9.6), ('leagues', 5.6), ('where', 3.6), ('mine', 3.4), ('cta', 5.0)]
def run(*a): subprocess.run(a, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
segs = []
for name, target in PLAN:
    m = marks[name]; src = m['to'] - m['from']; speed = max(1.0, min(1.6, src / target)); take = min(src, target * speed)
    out = os.path.join(SEG, name + '.mp4')
    vf = f"setpts=(PTS-STARTPTS)/{speed:.3f},scale=1080:1920,fps=30,tpad=stop_mode=clone:stop_duration=3,trim=duration={target}"
    run('ffmpeg', '-y', '-ss', f"{m['from']:.3f}", '-t', f"{take:.3f}", '-i', m['file'], '-vf', vf, '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', out)
    segs.append((out, target)); print(name, f'src {src:.1f}s ×{speed:.2f} → {target}s')
inputs, flt, off, prev, XF = [], [], 0.0, '0:v', 0.25
for f, t in segs: inputs += ['-i', f]
for i in range(1, len(segs)):
    off += segs[i - 1][1] - XF; lab = f'v{i}'; flt.append(f"[{prev}][{i}:v]xfade=transition=fade:duration={XF}:offset={off:.3f}[{lab}]"); prev = lab
total = sum(t for _, t in segs) - XF * (len(segs) - 1)
run('ffmpeg', '-y', *inputs, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-filter_complex', ';'.join(flt), '-map', f'[{prev}]', '-map', f'{len(segs)}:a',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '96k', '-shortest', '-movflags', '+faststart', '-t', f'{total:.3f}', OUT)
print('total', round(total, 2), 's →', OUT)
