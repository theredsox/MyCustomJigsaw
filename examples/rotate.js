// Functional demo and edge case testing for rotate object around non-centered pivot point
//https://jsfiddle.net/dugafshq/4/
//https://jsfiddle.net/dugafshq/5/
//https://jsfiddle.net/dugafshq/6/
//https://jsfiddle.net/dugafshq/7/
let CANVAS;

function loaded() {
    CANVAS = window._canvas = new fabric.Canvas('c');

    let rect = new fabric.Rect({
        left: 100,
        top: 100,
        width: 200,
        height: 100, 
        originX: 'left',
        originY: 'top',
        fill: 'blue'
    });

    CANVAS.add(rect);

    let target = new fabric.Circle({
        left: 250.5 - 2.5,
        top: 175.5 - 2.5,
        radius: 5,
        originX: 'left',
        originY: 'top',
        fill: 'red'
    });

    CANVAS.add(target);

    let button = document.getElementById("Rotate");
    button.onclick = function() {
        let rotateOffset = new fabric.Point(50, 25);
        let offsetAngle = setPathAngle(rect, rotateOffset);
        animatePath(rect, rect.angle + 90, rotateOffset, offsetAngle, 250);
    };
}

function setPathAngle(rect, rotateOffset) {
    let c = rect.getCenterPoint();
    let p = rect.getCenterPoint();
    // Determine offset angle at starting position, regardless of the objects current angle
    p.x += rotateOffset.x;
    p.y += rotateOffset.y;
    //let offsetAngle = Math.atan((c.y - p.y)/(c.x - p.x)) * (180 / Math.PI);

    let offsetAngle = (Math.atan2(c.y - p.y,c.x - p.x) * (180 / Math.PI)) % 360;

    console.log("offsetAngle: " + offsetAngle);
    return offsetAngle;
}

function animatePath(rect, endPoint, rotateOffset, offsetAngle, duration) {
    _setOriginToCenter(rect);

    // c is center point, p is pivot point
    let c = rect.getCenterPoint();
    let p = rect.getCenterPoint();

    // Depending on current angle, the initial pivot offset needs to be adjusted when applied
    if (rect.angle == 0) {
        p.x += rotateOffset.x;
        p.y += rotateOffset.y;
    } else if (rect.angle == 90) {
        p.x -= rotateOffset.y;
        p.y += rotateOffset.x;
    } else if (rect.angle == 180) {
        p.x -= rotateOffset.x;
        p.y -= rotateOffset.y;
    } else if (rect.angle == 270) {
        p.x += rotateOffset.y;
        p.y -= rotateOffset.x;
    }
    
    console.log("center: [" + c.x + "," + c.y + "]");
    console.log("pivot:  [" + p.x + "," + p.y + "]");

    let radius = Math.sqrt(Math.pow(p.x - c.x, 2) + Math.pow(p.y - c.y, 2));
    console.log("radius: " + radius);

    fabric.util.animate({
        startValue: rect.angle,
        endValue: endPoint,
        duration: duration,
        onChange: function(value) {
            // Change center of rect as angle changes to rotate around the target point
            rect.left = p.x + radius*Math.cos((value + offsetAngle) * (Math.PI / 180));
            rect.top = p.y + radius*Math.sin((value + offsetAngle) * (Math.PI / 180));
            rect.angle = value;
            console.log(rect.angle + " [" + rect.left + "," + rect.top + "]");
            CANVAS.renderAll();
        },
        onComplete: function() {
            rect.straighten();
            _resetOrigin(rect);
        }
    });
}

function _setOriginToCenter(target) {
    target._originalOriginX = target.originX;
    target._originalOriginY = target.originY;
    let center = target.getCenterPoint();
    target.originX = 'center';
    target.originY = 'center';
    target.left = center.x;
    target.top = center.y;
}

function _resetOrigin(target) {
    let originPoint = target.translateToOriginPoint(
        target.getCenterPoint(),
        target._originalOriginX,
        target._originalOriginY);
    target.originX = target._originalOriginX;
    target.originY = target._originalOriginY;
    target.left = originPoint.x;
    target.top = originPoint.y;
    target._originalOriginX = null;
    target._originalOriginY = null;
}