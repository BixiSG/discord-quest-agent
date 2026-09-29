# Contact sheet of screenshots: one small JPEG instead of many PNGs (images in
# a Claude session's context are re-uploaded on every step; keep them few and small).
#   python tools/cdp/sheet.py <out.jpg> <shot name> [<shot name>...]   (names in dev/out/shots, no .png)
import os, sys
from PIL import Image
names = sys.argv[2:]
out = sys.argv[1]
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "dev", "out"))
scale = 0.62
ims = [Image.open(f"shots/{n}.png").convert("RGB") for n in names]
ims = [im.resize((int(im.width*scale), int(im.height*scale)), Image.LANCZOS) for im in ims]
cols = 2
w = max(im.width for im in ims); h = max(im.height for im in ims)
rows = (len(ims)+cols-1)//cols
sheet = Image.new("RGB", (w*cols, h*rows), (40,40,40))
for i, im in enumerate(ims):
    sheet.paste(im, ((i%cols)*w, (i//cols)*h))
sheet.save(out, quality=80)
print(sheet.size)
