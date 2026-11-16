"""Add small runtime helpers to index.html (served no-store, so it is safe to edit in place)."""
import sys
p = sys.argv[1]; s = open(p, encoding='utf-8').read()
MARK = '<!-- aeth-runtime -->'
if MARK in s: s = s[:s.index(MARK)] + s[s.index('<!-- /aeth-runtime -->') + len('<!-- /aeth-runtime -->'):]
script = MARK + '''<script>
(() => {
  // Marks <html data-in-combat> while a battle screen is shown, so CSS can compact the bottom navigation.
  const root = document.documentElement;
  const check = () => {
    const inCombat = !!document.querySelector('.combat-command-center') ||
      [...document.querySelectorAll('button')].some(b => /^Защита \\(\\+\\d+ MP\\)$/i.test((b.textContent || '').trim()));
    if (inCombat) root.setAttribute('data-in-combat', ''); else root.removeAttribute('data-in-combat');
  };
  let queued = false;
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; check(); }); } };
  new MutationObserver(schedule).observe(document.documentElement, {childList: true, subtree: true});
})();
</script><!-- /aeth-runtime -->'''
import re
s = re.sub(r'<script type="module" src="/assets/aeth-addons-v\d+\.js"></script>', '', s)
script = script.replace('</script><!-- /aeth-runtime -->', '</script><script type="module" src="/assets/aeth-addons-v101.js"></script><!-- /aeth-runtime -->')
s = s.replace('</body>', script + '\n</body>', 1)

# Startup splash art (head, so it paints before the bundle loads).
s = re.sub(r'<link rel="preload" href="/assets/banners/splash.webp"[^>]*>|<style id="aeth-splash">.*?</style>', '', s, flags=re.S)
s = s.replace('</head>', '<link rel="preload" href="/assets/banners/splash.webp" as="image"><style id="aeth-splash">#startup-splash{background:#0d1113 url(/assets/banners/splash.webp) center 40%/cover no-repeat!important}#startup-splash::before{content:"";position:absolute;inset:0;background:linear-gradient(#0d1113cc 0%,#0d111300 28%,#0d111300 70%,#0d1113e6 100%)}#startup-splash .splash-brand{position:absolute;top:max(48px,env(safe-area-inset-top));left:0;right:0;text-align:center;font-size:30px;text-shadow:0 2px 12px #000,0 0 24px #f0cf7a55}#startup-splash .splash-status{z-index:1;text-shadow:0 1px 4px #000}</style></head>', 1)
open(p, 'w', encoding='utf-8').write(s); print('index.html runtime injected')
