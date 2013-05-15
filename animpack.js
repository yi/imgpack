#!/usr/bin/env node
//
// animpack - animation-sheet-aware image packer
//
// Copyright 2013 Tom Novelli
// Copyright 2013 Ethereal Darkness Interactive
//
// TODO: cleanup, refactoring, documentation if input/output formats...

var SRCDIRS=['tests'];
var OUTPUT_DIR='output';
var OUTPUT_JSON= OUTPUT_DIR+'/images.json';
var GUTTER=1; //blank pixels between packed images

var W=2048;
var H=W;

var fs = require('fs');
var path = require('path');
var async = require('async');
var PNG = require('pngjs').PNG;

var config=require('./js/data/animationTemplates.js').createAnimationTemplates();
function getConf(filename){
	return config[filename] || {cols:1, rows:1};
}

// outputs
var frames={}; // metadata for output to JSON
var canvases=[];

// temp
var queue=[];
function enqueue(filename,idx, img, w,h, sx,sy, ox,oy){
	queue.push({filename:filename, idx:idx, canvas:img, w:w, h:h, ox:ox, oy:oy, sx:sx+ox, sy:sy+oy});
}

var ctx;
var bin=-1, x, y, rowheight, count=0;
function addBin(){
	bin++;
	console.log("ADD BIN",bin,"("+count+" images in previous bin)");
	x=y=rowheight=count=0;

	ctx= new PNG({
		filterType: 2,
		width: W,
		height: H
	});
	// clear it
	var length= W*H*4;
	for(var i=0; i<length; i++) ctx.data[i]=0;

	ctx.num=bin; //for output filename!
	canvases.push(ctx);
	//~ console.log("  canvas=", canvases[bin], '=', ctx);
}

// inputs
var filenames=[];
SRCDIRS.forEach(function(srcdir){
	//~ console.log('srcdir=',srcdir);
	var fns= fs.readdirSync(srcdir);
	fns.forEach(function(fn){
		filenames.push(srcdir+'/'+fn);
	});
});
filenames=filenames.filter(function(fn){return fn.match(/\.png$/);});
filenames=filenames.sort();
//~ console.log(filenames);



//~ filenames=filenames.slice(0,10); //TEST


// break up any animation sheets & trim whitespace
function processImage(pathname, callback){
	var filename= path.basename(pathname);

	var src = fs.createReadStream(pathname);
	var img = new PNG({
		filterType: 2
	});
	//~ img.on('metadata', function(metadata){console.log('metadata=',metadata)});
	img.on('parsed', loaded);
	src.pipe(img);

	function loaded(){
		var conf=getConf(filename);
		console.log("LOADED",filename, conf.cols, conf.rows);

		var w=img.width;
		var h=img.height;
		if(w>W || h>H){
			console.log(pathname+" ("+w+"x"+h+") is larger than atlas size - OMITTED");
			return callback();
		}

		if(conf.cols==1 && conf.rows==1){
			//~ console.log("SINGLE IMAGE: "+filename);
			//~ if(w>2000 || h>200) console.log("(warning) SHOULD BE ANIMATION PAGE?",pathname,w,h);
			//TODO trim?
			enqueue(filename,0, img, w,h, 0,0, 0,0);
		}
		else{
			packSheet(filename, img, w,h, conf.cols,conf.rows);
		}

		return callback();
	}
}


function packSheet(filename, img, w,h, cols,rows){
	//cell size
	var cw= w/cols;
	var ch= h/rows;
	//TODO warn if fractional (indicates wrong metadata or sloppy image sizing)
	cw=Math.floor(cw);
	ch=Math.floor(ch);

	var frame=[];
	for(var row=0; row<rows; row++){
		for(var col=0; col<cols; col++){
			var idx= row*cols+col;
			var f= trim(filename, img, cw*col, ch*row, cw,ch);
			if(f.w==cw && f.h==ch) console.log("(warning) NOT TRIMMED: ", filename, row,col);
			enqueue(filename,idx, img, f.tw,f.th, cw*col,ch*row, f.ox,f.oy);
		}
	}
}

function trim(filename, img, x0,y0, w,h){
	var x1,y1,x2,y2;
	var tx,ty,hit;
	var data= img.data; //the WHOLE page, not the cell as in V2
	var pw= img.width;
	var ph= img.height;

//~ return {x:0, y:0, w:w, h:h};//TEST TODO

	//trim top
	for(y1=0, hit=false;  y1<h;  y1++){
		for(tx=0; tx<w; tx++){
			if(data[((y0+y1)*pw + x0+tx)*4+3]){
				hit=true;
				break;
			}
		}
		if(hit) break;
	}
	//trim bottom
	for(y2=h-1, hit=false;  y2>y1;  y2--){
		for(tx=0; tx<w; tx++){
			if(data[((y0+y2)*pw + x0+tx)*4+3]){
				hit=true;
				break;
			}
		}
		if(hit) break;
	}
	//trim left
	for(x1=0, hit=false;  x1<w;  x1++){
		for(ty=y1; ty<y2; ty++){
			if(data[((y0+ty)*pw + x0+x1)*4+3]){
				hit=true;
				break;
			}
		}
		if(hit) break;
	}
	//trim right
	for(x2=w-1, hit=false;  x2>x1;  x2--){
		for(ty=y1; ty<y2; ty++){
			if(data[((y0+ty)*pw + x0+x2)*4+3]){
				hit=true;
				break;
			}
		}
		if(hit) break;
	}

	var w2=x2-x1+1;
	var h2=y2-y1+1;
	//~ console.log(filename, img.width,img.height, x0,y0, 'w2=',w2,'h2=',h2, '... x1=',x1,'x2=',x2,   '... y1=',y1,'y2=',y2 );

	//This shows up on lostprince_die.png (in MW) - the last cell is in fact empty
	if(w2<1 || h2<1) console.log("(warning) EMPTY CELL:", filename, 'w2=',w2,'h2=',h2, '... x1=',x1,'x2=',x2,   '... y1=',y1,'y2=',y2 );
	return {ox:x1, oy:y1, tw:w2, th:h2}; //offset x,y ; trimmed w,h
}




// sort by height, then pack
function packAll(){
	queue.sort(function(a,b){return a.h-b.h;});

	console.log("Packing...");
	addBin();
	for(i=0; i<queue.length; i++){
		//~ console.log(queue[i].h, queue[i].filename);
		pack(queue[i]);
	}
}

function pack(img){
	if(x+img.w > W){
		x=0; y+=rowheight+GUTTER;
		rowheight=0;
	}
	if(img.h>rowheight) rowheight=img.h;

	//add bin?
	if(y+img.h > H){
		addBin();
		//~ console.log("NO ROOM FOR "+img.w+"x"+img.h+"  "+img.filename+" - NEW BIN #"+bin);
	}

	//generate metadata
	if(frames[img.filename]===undefined) frames[img.filename]=[];
	frames[img.filename][img.idx]= [bin, x,y, img.ox,img.oy, img.w,img.h];
	/*
	frames[img.filename][img.idx]={
		bin: bin,
		x: x,
		y: y,
		ox: img.ox,
		oy: img.oy,
		w: img.w,
		h: img.h
	};
	*/

	//blit
	img.canvas.bitblt(ctx, img.sx,img.sy, img.w,img.h, x,y);

	//increment...
	count++;
	x+=img.w+GUTTER;
}



// START PROCESSING
// compute
async.eachSeries(filenames, processImage, finish);
//~ async.each(filenames, processImage, finish);

function finish(err){
	if(err){ console.log("ERROR:",err); return; }

	packAll();
	console.log("Finished");
//~ return;//TEST

	// write JSON
	console.log("\nWriting "+OUTPUT_JSON+" ...");

	fs.writeFileSync(OUTPUT_JSON, JSON.stringify(frames)); //dense
	//~ fs.writeFileSync(OUTPUT_JSON, JSON.stringify(frames, null, "\t")); //human-readable
	//~ fs.writeFileSync(OUTPUT_JSON, JSON.stringify(frames, null, "    ")); //for comparison w/ PHP version

//~ return;//TEST

	// write PNGs  TODO: use async
	var n= canvases.length-1;
	async.eachSeries(canvases, function(ctx, callback){
	//~ async.each(canvases, function(ctx, callback){
		var bin= ctx.num;
		console.log(bin+" of "+n);
		var out = fs.createWriteStream(OUTPUT_DIR+"/images"+bin+".png");
		var stream = ctx.pack();
		stream.pipe(out);
		//~ stream.on('data', function(chunk){out.write(chunk);});
		stream.on('end', callback);
	},
	function(err){
		if(err) console.log("Done w/ error:",err);
		else console.log("Done.");
	});
}
