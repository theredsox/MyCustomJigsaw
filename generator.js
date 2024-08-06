class PuzzlePiece {
    // DOM Element ID for this piece
    id;

    // Integers representing this piece's location within the puzzle
    row; col;

    // Path2D strings representing a side of this piece
    top; right; bottom; left;

    // The fabric Path object representing this piece
    object;

    // @param id - string - ID representing the piece
    // @param row - integer - 0-based row the piece is in
    // @param col - integer - 0-based column the piece is in
    constructor(id, row, col) {
        this.id = id;
        this.row = row;
        this.col = col;
    }
}

class PuzzleGenerator {
    // @param - puzzleMetadata - Object - metadata of the puzzle
    // @param - rows - number of rows to split the puzzle into
    // @param - cols - number of columns to split the puzzle into
    constructor(puzzleMetadata, rows, cols) {
        this.width = puzzleMetadata.width;
        this.height = puzzleMetadata.height;
        this.yn = rows;
        this.xn = cols;
        this.radius = 0.0;
    }

    generatePieces() {
        let pieces = [];
        
        this.generate_rows(pieces)
        this.generate_columns(pieces);

        return pieces;
    }

    // @param pieces - PuzzlePiece[] - the array in which generated pieces are stored
    getOrCreatePiece(pieces) {
        let row = pieces[this.yi];
        if (!row) {
            row = [];
            pieces[this.yi] = row;
        }
        let piece = row[this.xi];
        if (!piece) {
            piece = new PuzzlePiece(this.yi + ":" + this.xi, this.yi, this.xi);
            pieces[this.yi][this.xi] = piece;
        }
        return piece;
    }

    // @param pieces - PuzzlePiece[] - the array in which generated pieces are stored
    generate_rows(pieces) {
        this.vertical = 0;
       
        for (this.yi = 0; this.yi < this.yn; this.yi++) {
            this.xi = 0;    // Needs to be set before first()
            this.first();

            for (; this.xi < this.xn; this.xi++) {
                let piece = this.getOrCreatePiece(pieces);

                // Top is the path starting point, clockwise from relative 0,0 position
                let startPoint = "M " + this.p0l() + " " + this.p0w();
                
                // On the first row, set the top puzzle border edge
                if (this.yi == 0) {
                    let line = "L " + this.l(1.0) + " " + this.w(0.0);
                    piece.top = startPoint + " " + line;
                } else {
                    // Internal curved edge
                    let curveTop = "C " + this.p1l() + " " + this.p1w() + " " + this.p2l() + " " + this.p2w() + " " + this.p3l() + " " + this.p3w() + " ";
                    curveTop += "C " + this.p4l() + " " + this.p4w() + " " + this.p5l() + " " + this.p5w() + " " + this.p6l() + " " + this.p6w() + " ";
                    curveTop += "C " + this.p7l() + " " + this.p7w() + " " + this.p8l() + " " + this.p8w() + " " + this.p9l() + " " + this.p9w();
                    
                    // Set the top of the current piece
                    piece.top = startPoint + " " + curveTop;

                    // Internal curved edge
                    let curveBottom = "C " + this.p8l() + " " + this.p8w() + " " + this.p7l() + " " + this.p7w() + " " + this.p6l() + " " + this.p6w() + " ";
                    curveBottom += "C " + this.p5l() + " " + this.p5w() + " " + this.p4l() + " " + this.p4w() + " " + this.p3l() + " " + this.p3w() + " ";
                    curveBottom += "C " + this.p2l() + " " + this.p2w() + " " + this.p1l() + " " + this.p1w() + " " + this.p0l() + " " + this.p0w();

                    // Set the bottom of the previous row piece, whose edge is shared with the top edge of this piece
                    let prevPiece = pieces[this.yi - 1][this.xi];
                    prevPiece.bottom = curveBottom;
                }
                
                // On the last row, set the bottom puzzle border edge
                if (this.yi == (this.yn - 1)) {
                    let line = "L " + this.l(0.0) + " " + this.height;
                    piece.bottom = line;
                }
                
                this.next();
            }
        }
    }

    // @param pieces - PuzzlePiece[] - the array in which generated pieces are stored
    generate_columns(pieces) {
        this.vertical = 1;
         
        for (this.xi = 0; this.xi < this.xn; this.xi++) {
            this.yi = 0
            this.first();

            for (; this.yi < this.yn; this.yi++) {
                let piece = this.getOrCreatePiece(pieces);

                // On the first column, set the left puzzle border edge
                if (this.xi == 0) {
                    let line = "L " + this.w(0.0) + " " + this.l(0.0);
                    piece.left = line;
                } else {
                    // Internal curved edge
                    let curveLeft = "C " + this.p8w() + " " + this.p8l() + " " + this.p7w() + " " + this.p7l() + " " + this.p6w() + " " + this.p6l() + " ";
                    curveLeft += "C " + this.p5w() + " " + this.p5l() + " " + this.p4w() + " " + this.p4l() + " " + this.p3w() + " " + this.p3l() + " ";
                    curveLeft += "C " + this.p2w() + " " + this.p2l() + " " + this.p1w() + " " + this.p1l() + " " + this.p0w() + " " + this.p0l();
                    
                    // Set the left of the current piece
                    piece.left = curveLeft;

                    // Internal curved edge
                    let curveRight = "C " + this.p1w() + " " + this.p1l() + " " + this.p2w() + " " + this.p2l() + " " + this.p3w() + " " + this.p3l() + " ";
                    curveRight += "C " + this.p4w() + " " + this.p4l() + " " + this.p5w() + " " + this.p5l() + " " + this.p6w() + " " + this.p6l() + " ";
                    curveRight += "C " + this.p7w() + " " + this.p7l() + " " + this.p8w() + " " + this.p8l() + " " + this.p9w() + " " + this.p9l();

                    // Set the right of the previous column piece, whose edge is shared with the left edge of this piece
                    let prevPiece = pieces[this.yi][this.xi - 1];
                    prevPiece.right = curveRight;
                }
                
                // On the last column, set the right puzzle border edge
                if (this.xi == (this.xn - 1)) {
                    let line = "L " + this.width + " " + this.l(1.0);
                    piece.right = line;
                }

                this.next();
            }
        }
    }

    ///////////////////////////
    // Internals for edge generation; cubic bezier curves generation
    ///////////////////////////

    a; b; c; d; e; t; j; flip; xi; yi; xn; yn; vertical; offset = 0; width; height; radius; seed = 1;
    
    random() { var x = Math.sin(this.seed) * 10000; this.seed += 1; return x - Math.floor(x); }
    uniform(min, max) { var r = this.random(); return min + r * (max - min); }
    rbool() { return this.random() > 0.5; }
    
    first() { this.e = this.uniform(-this.j, this.j); this.next();}
    next()  { this.seeds(); var flipold = this.flip; this.flip = this.rbool(); this.a = (this.flip == flipold ? -this.e: this.e); this.b = this.uniform(-this.j, this.j); this.c = this.uniform(-this.j, this.j); this.d = this.uniform(-this.j, this.j); this.e = this.uniform(-this.j, this.j);}
    
    sl()  { return this.vertical ? this.height / this.yn : this.width / this.xn; }
    sw()  { return this.vertical ? this.width / this.xn : this.height / this.yn; }
    ol()  { return this.offset + this.sl() * (this.vertical ? this.yi : this.xi); }
    ow()  { return this.offset + this.sw() * (this.vertical ? this.xi : this.yi); }
    l(v)  { var ret = this.ol() + this.sl() * v; return Math.round(ret * 100) / 100; }
    w(v)  { var ret = this.ow() + this.sw() * v * (this.flip ? -1.0 : 1.0); return Math.round(ret * 100) / 100; }
    p0l() { return this.l(0.0); }
    p0w() { return this.w(0.0); }
    p1l() { return this.l(0.2); }
    p1w() { return this.w(this.a); }
    p2l() { return this.l(0.5 + this.b + this.d); }
    p2w() { return this.w(-this.t + this.c); }
    p3l() { return this.l(0.5 - this.t + this.b); }
    p3w() { return this.w(this.t + this.c); }
    p4l() { return this.l(0.5 - 2.0 * this.t + this.b - this.d); }
    p4w() { return this.w(3.0 * this.t + this.c); }
    p5l() { return this.l(0.5 + 2.0 * this.t + this.b - this.d); }
    p5w() { return this.w(3.0 * this.t + this.c); }
    p6l() { return this.l(0.5 + this.t + this.b); }
    p6w() { return this.w(this.t + this.c); }
    p7l() { return this.l(0.5 + this.b + this.d); }
    p7w() { return this.w(-this.t + this.c); }
    p8l() { return this.l(0.8); }
    p8w() { return this.w(this.e); }
    p9l() { return this.l(1.0); }
    p9w() { return this.w(0.0); }

    // @param min - number - minimum value
    // @param max - number - maximum value
    // @param decimals - integer - number of decimal places
    randomNum(min, max, decimals) {
        var precision = Math.pow(10, decimals);
        min *= precision;
        max *= precision;
        return Math.floor((Math.random() * (max - min)) + min) / precision;
    }
    
    seeds() { 
        this.seed = Math.random() * 10000;
        this.t = this.randomNum(20, 25, 1) / 200.0;
        this.j = this.randomNum(0, 5, 1) / 100.0;
    }
}