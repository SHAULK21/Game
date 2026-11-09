from PIL import Image, ImageDraw
import sys
out=sys.argv[1]; files=sys.argv[2:]; cols=4
ims=[]
for f in files:
    im=Image.open(f).convert('RGB').resize((300,650)); d=ImageDraw.Draw(im); d.rectangle((0,0,300,14),fill='black'); d.text((3,1),f.split('/')[-1][:45],fill='yellow'); ims.append(im)
rows=(len(ims)+cols-1)//cols; S=Image.new('RGB',(cols*300,rows*650),'white')
for i,im in enumerate(ims): S.paste(im,((i%cols)*300,(i//cols)*650))
S.save(out)
