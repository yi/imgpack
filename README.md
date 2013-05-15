# imgpack
## a simple image/texture atlas packer in Javascript

## SUMMARY

Combines many small PNG images into a few large 'atlases', and outputs coordinate/size info to a JSON file.  This is necessary for efficient use of textures in OpenGL, and for efficient resource loading in HTML5 games/apps with a lot of bitmap images (this script was originally written for the games Mortal Fear, Revel Immortal, and the HTML5 port of Morning's Wrath with 50MB of sprites.)

There are two versions...

**imgpack.js** is very simple, and produces JSON output compatible with [TexturePacker](http://www.codeandweb.com/texturepacker).

**animpack.js** handles animation sheets (with multiple rows and/or columns per image) by slicing them up and packing each cell as a separate trimmed image.  This results in very little wasted space, even with the simple 'shelf' packing algorithm.  It requires config information, e.g. `{"filename.png": {"cols": 8, "rows": 8}}`.  The output is NOT compatible with TexturePacker.

For anything fancy, just copy the script into your codebase and customize it...


## TODO

- factor out common code between imgpack & animpack
- eliminate global vars
- config mechanism (including commandline args & whatever Grunt uses)
- in-browser support
- MaxRects algorithm


## INSTALL

Tested on Windows and Linux; should work on OSX too.

1. Install [Node.js](http://nodejs.org/) if you haven't already

1. Clone the imgpack repository from Github

2. Install packages:

    npm install pngjs async

(Originally used node-canvas which is a bit faster but requires libcairo which is difficult to install on Windows, so we switched to pure-javascript pngjs.)


## USAGE NOTES

This yields slightly sub-optimal PNG compression.  I tried
tweaking PNG filter and Zlib strategy options without success.

For better results, post-process with `mogrify output/*.png`
(ImageMagick/GraphicsMagick) or PNGgauntlet, Trimage, etc.


## REFERENCES

Jukka Jylänki, "A Thousand Ways to Pack the Bin", 2010.
http://clb.demon.fi/files/RectangleBinPack.pdf
(mainly concerns fancier packing algorithms eg. MaxRects)
