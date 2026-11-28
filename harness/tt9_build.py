"""Assemble TikTok video #7 (no voice, captions and text cards) from tt9.mjs screenshot sequences.
python3 tt9_build.py <out.mp4>"""
import subprocess, sys, os
OUT = sys.argv[1]
TT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'video', 'tt9')
ORDER = ['card1', 'battle', 'card2', 'tavern', 'card3', 'board', 'cta']
def run(*a): subprocess.run(a, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
def dur(f): return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout)
segs = []
for name in ORDER:
    d = os.path.join(TT, name); out = os.path.join(TT, name + '.mp4')
    run('ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', os.path.join(d, 'list.txt'), '-vf', 'fps=30,scale=1080:1920:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', out)
    segs.append((out, dur(out))); print(name, round(segs[-1][1], 2), 's')
XF, inputs, flt, off, prev = 0.3, [], [], 0.0, '0:v'
for f, _ in segs: inputs += ['-i', f]
for i in range(1, len(segs)):
    off += segs[i - 1][1] - XF; lab = f'v{i}'; flt.append(f'[{prev}][{i}:v]xfade=transition=fade:duration={XF}:offset={off:.3f}[{lab}]'); prev = lab
total = sum(t for _, t in segs) - XF * (len(segs) - 1)
run('ffmpeg', '-y', *inputs, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-filter_complex', ';'.join(flt), '-map', f'[{prev}]', '-map', f'{len(segs)}:a',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '96k', '-shortest', '-movflags', '+faststart', '-t', f'{total:.3f}', OUT)
print('total', round(total, 2), 's →', OUT)
