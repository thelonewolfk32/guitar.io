"""Render the existing AudioLines brand shape into native iOS asset sizes."""
from pathlib import Path
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parent.parent / 'ios/App/App/Assets.xcassets'
def artwork(size, symbol):
    image = Image.new('RGB', (size, size), '#161d1a')
    draw = ImageDraw.Draw(image)
    for i, height in enumerate([.35, .65, 1, .65, .35]):
        x = size/2 + (i-2)*symbol*.2
        top, bottom, width = size/2-height*symbol/2, size/2+height*symbol/2, symbol*.07
        draw.rounded_rectangle((x-width/2,top,x+width/2,bottom), radius=width/2, fill='#cbe4a6')
    return image
artwork(1024, 430).save(root / 'AppIcon.appiconset/AppIcon-512@2x.png')
for name in ['splash-2732x2732.png','splash-2732x2732-1.png','splash-2732x2732-2.png']:
    artwork(2732, 230).save(root / 'Splash.imageset' / name)
