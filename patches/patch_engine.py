"""Skip the server-actions session gate for requests from the deployed (local-save) client,
which never sends X-Game-Session; the regular legacy route handlers then process them."""
import sys
p = sys.argv[1]; s = open(p, encoding='utf-8').read()
old = 'e.use((s,i,c)=>{if(!n(s.path)||["GET","HEAD"].includes(s.method))return c();'
new = 'e.use((s,i,c)=>{if(!n(s.path)||["GET","HEAD"].includes(s.method)||!s.get("X-Game-Session"))return c();'
if s.count(new) == 1: print('already patched'); sys.exit()
assert s.count(old) == 1, 'anchor not found'
open(p, 'w', encoding='utf-8').write(s.replace(old, new)); print('engine patched')
