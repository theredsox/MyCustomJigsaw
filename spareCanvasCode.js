// Set up using fabric.js
/*
// Build an image for each piece, scaled to canvas size, and clipped to the specific piece's path.
let opts = {
    //left: 0,
    //top: 0
};
let image = new fabric.Image(img);

const paths = piece.top + " " + piece.right + " " + piece.bottom + " " + piece.left;
let path = new fabric.Path(paths, {
    top: -(puzzle.height/2),
    left: -(puzzle.width/2)
});
image.clipPath = path;
//image.width = puzzle.width - path.width/2;
//image.height = puzzle.height - path.height/2;
//image.top = 

let imgScale = puzzle.width / puzzle.height;
let canvasScale = canvas.getWidth() / canvas.getHeight();
// If image ratio is taller than canvas, scale the height to assure it fits. Else width.
// if (imgScale < canvasScale) {
//     image.scaleToHeight(canvas.getHeight());
// } else {
//     image.scaleToWidth(canvas.getWidth());
// }

canvas.add(image);
*/

// Set up the canvas directly - various attempts varying success.
/*
const canvas = document.getElementById('board');
canvas.style.aspectRatio = puzzle.width / puzzle.height;
canvas.width = puzzle.width;
canvas.height = puzzle.height;

const ctx = canvas.getContext('2d');
ctx.lineWidth = 15;

var pattern = ctx.createPattern(img, "no-repeat");
ctx.fillStyle = pattern;

// Creates a board with all the pieces and the background
for (let r = 0; r < generator.yn; r++) {
    for (let c = 0; c < generator.xn; c++) {
        let piece = pieces[r][c];
        let paths = piece.top + " " + piece.right + " " + piece.bottom + " " + piece.left;
        let path = new Path2D(paths);

        ctx.stroke(path);
        ctx.fill(path);

        // Create individual puzzle piece images
        // let temp = document.createElement('canvas');
        // temp.width = Math.ceil(puzzle.width/generator.xn) * 1.50;
        // temp.height = Math.ceil(puzzle.height/generator.yn) * 1.50;
        
        // let xPos = Math.max(0, Math.ceil(puzzle.width/generator.xn)*c - temp.width*.25);
        // let yPos = Math.max(0, Math.ceil(puzzle.height/generator.yn)*c - temp.height*.25);

        // let tempCtx = temp.getContext('2d');
        // tempCtx.drawImage(canvas, xPos, yPos, temp.width, temp.height, 0, 0, temp.width, temp.height);
        
        // ctx.restore();
        // ctx.clearRect(0, 0, canvas.width, canvas.height);

        // temp.toBlob((blob) => { 
        //     piece.image = blob;

        //     if (c==0 && c==0) {
        //         const canvas2 = document.getElementById('board2');
        //         const ctx2 = canvas2.getContext('2d');

        //         var img2 = new Image();
        //         img2.onload = function() { 
        //             ctx2.translate(500,500);
        //             ctx2.drawImage(img2, 0, 0);

        //             ctx2.translate(-500,-500);
        //             ctx2.drawImage(img2, 0, 0);
        //         };
        //         img2.src = URL.createObjectURL(piece.image);
        //     }
        // });
    }
}
*/
/*
const canvas2 = document.getElementById('board2');
canvas2.width = puzzle.width;
canvas2.height = puzzle.height;

const ctx2 = canvas2.getContext('2d');
ctx2.lineWidth = 15;

// var pattern2 = ctx.createPattern(img, "no-repeat");
// ctx2.fillStyle = pattern2;

for (let r = 0; r < 1; r++) {
    for (let c = 0; c < 1; c++) {
        let piece = pieces[r][c];
        let paths = piece.top + " " + piece.right + " " + piece.bottom + " " + piece.left;
        let path = new Path2D(paths);
        
        ctx.save(); // Save the context before clipping
        ctx.stroke(path);
        ctx.fill(path);
        ctx.clip(path);
        //ctx.drawImage(canvas,0,0);
        //ctx2.translate(500, 500);
        ctx2.drawImage(canvas, 0, 0);
        ctx.restore(); // Get rid of the clipping region

        //ctx2.stroke(path);
        //ctx2.fill(path);
        //ctx.save(); // Save the context before we muck up its properties
        //ctx.translate(x,y);
        //ctx.fill(path);
        //lippedBackgroundImage(ctx, img, canvas.clientWidth, canvas.clientHeight);
        //ctx.stroke();  // Now draw our path
        //ctx.restore(); // Put the canvas back how it was before we started
    }
}
*/

// let p00 = pieces[0][0];
// let paths = p00.top + " " + p00.right + " " + p00.bottom + " " + p00.left;
// let piece = new Path2D(paths);
// ctx.strokeStyle = "Red";
// ctx.stroke(piece);

// let p10 = pieces[1][0];
// paths = p10.top + " " + p10.right + " " + p10.bottom + " " + p10.left;
// piece = new Path2D(paths);
// ctx.strokeStyle = "Green";
// ctx.stroke(piece);

// Options for putting the image onto the path2D
// EaselJS is simpliest lib lternative to native I've seen, but worry there are not enough usage examples and the docs don't provide much.
/*
// Load the image once. Create a pattern after it loads. Then "fill" all pieces with that pattern. 
// Not sure how moving those objects around the canvas after will impact the pattern though.
var img = new Image();
img.src = "<url>";
img.onload = function () {
    var pattern = ctx.createPattern(img, "repeat");
    ctx.fillStyle = pattern;
    ctx.fill(path2d);
};
*/
/*
// This approach seems more promising, in that it draws the image on the "clipped" content2d. So where
// the path2d is on the canvas shouldn't matter. May play better with dragging around.
// Concern is performance of drawing the image 1000 times. Though once the pieces are on the board, it'll
// usually be one at a time. Outside of the multi-select and sort options.
function clippedBackgroundImage( ctx, img, w, h ){
    ctx.save(); // Save the context before clipping
    ctx.clip(); // Clip to whatever path is on the context

    var imgHeight = w / img.width * img.height;
    if (imgHeight < h){
        ctx.fillStyle = '#000';
        ctx.fill();
    }
    ctx.drawImage(img,0,0,w,imgHeight);

    ctx.restore(); // Get rid of the clipping region
}
    
function clippedBackgroundImage( ctx, img, w, h ){
    ctx.save(); // Save the context before clipping
    ctx.clip(); // Clip to whatever path is on the context
    ctx.drawImage(img,0,0,w,h);
    ctx.restore(); // Get rid of the clipping region
}
    
function slashedRectWithBG( ctx, x, y, w, h, slash, img ){
    ctx.save(); // Save the context before we muck up its properties
    ctx.translate(x,y);
    ctx.fill(path2d);
    clippedBackgroundImage( ctx, img, w, h );
    ctx.stroke();  // Now draw our path
    ctx.restore(); // Put the canvas back how it was before we started
}
*/