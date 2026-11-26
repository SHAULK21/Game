"""Assemble TikTok video #6 with the Audio8 TTS voiceover (video/tt8/voice/<scene>.wav) from tt8.mjs recordings.
Each scene lasts as long as its voice line (+ a short pause); the video is sped up or slowed a little to fit.
python3 tt8_build.py <out.mp4>"""
import json, subprocess, sys, os, wave
OUT = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__)); TT = os.path.join(HERE, 'video', 'tt8'); SEG = os.path.join(TT, 'seg'); os.makedirs(SEG, exist_ok=True)
VOICE = os.path.join(TT, 'voice')
marks = json.load(open(os.path.join(TT, 'marks.json')))
ORDER = ['create', 'battle', 'path', 'daily', 'chars', 'cta']
def dur(f):
    with wave.open(f) as w: return w.getnframes() / w.getframerate()
def run(*a): subprocess.run(a, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
LEAD, TAIL, XF = 0.25, 0.55, 0.25
segs = []
for name in ORDER:
    v = os.path.join(VOICE, name + '.wav'); target = round(LEAD + dur(v) + (1.2 if name == 'cta' else TAIL), 2)
    m = marks[name]; src = m['to'] - m['from']; speed = max(0.8, min(1.6, src / target)); take = min(src, target * speed)
    out = os.path.join(SEG, name + '.mp4')
    vf = f"setpts=(PTS-STARTPTS)/{speed:.3f},scale=1080:1920,fps=30,tpad=stop_mode=clone:stop_duration=4,trim=duration={target}"
    run('ffmpeg', '-y', '-ss', f"{m['from']:.3f}", '-t', f"{take:.3f}", '-i', m['file'], '-vf', vf, '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', out)
    segs.append((out, target, v)); print(name, f'src {src:.1f}s ×{speed:.2f} → {target}s')
inputs, flt, off, prev, starts = [], [], 0.0, '0:v', [0.0]
for f, t, _ in segs: inputs += ['-i', f]
for i in range(1, len(segs)):
    off += segs[i - 1][1] - XF; starts.append(off); lab = f'v{i}'; flt.append(f"[{prev}][{i}:v]xfade=transition=fade:duration={XF}:offset={off:.3f}[{lab}]"); prev = lab
total = sum(t for _, t, _ in segs) - XF * (len(segs) - 1)
n = len(segs); amix = []
for i, (_, _, v) in enumerate(segs):
    inputs += ['-i', v]; ms = int((starts[i] + LEAD) * 1000); amix.append(f'[{n + i}:a]aresample=44100,aformat=channel_layouts=stereo,adelay={ms}|{ms}[a{i}]')
flt += amix + [''.join(f'[a{i}]' for i in range(n)) + f'amix=inputs={n}:normalize=0,apad,atrim=0:{total:.3f},loudnorm=I=-15:TP=-1.5:LRA=11[aout]']
run('ffmpeg', '-y', *inputs, '-filter_complex', ';'.join(flt), '-map', f'[{prev}]', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-movflags', '+faststart', '-t', f'{total:.3f}', OUT)
print('total', round(total, 2), 's →', OUT)
