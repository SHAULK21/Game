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
script = script.replace('</script><!-- /aeth-runtime -->', '</script><script type="module" src="/assets/aeth-addons-v69.js"></script><!-- /aeth-runtime -->')
s = s.replace('</body>', script + '\n</body>', 1)
open(p, 'w', encoding='utf-8').write(s); print('index.html runtime injected')
