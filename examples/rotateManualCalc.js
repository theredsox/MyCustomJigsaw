window.addEventListener("keydown", function(e) {
    // Rotate piece
    if (BOARD.orientation > 0 && e.key == "Alt" && BOARD.overTarget) {
        // Grab a reference immediately since mouse:out can detach target during animation
        let target = BOARD.overTarget;
        if (!target.rotationInProgress) {
            target.rotationInProgress = true; // Toggled off at the end of resetOrigin when the animation has finished
            let angle = BOARD.orientation == 1 ? 180 : 90;
            let isPiece = target.isType("path");
            animatePath(target, 'angle', target.angle + angle, 250, true, function(path) {
                setOriginToCenter(path);
                if (isPiece) {
                        setPathAngle(path);
                        setupPathForRotate(path);
                }
            }, function(path, curAngle) {
                if (isPiece) {
                    // Change center of rect as angle changes to rotate around the pivot point (aka center of piece ignoring asymmetrical bits)
                    path.left = path._p.x + path._rad*Math.cos((curAngle + path._ang) * (Math.PI / 180));
                    path.top = path._p.y + path._rad*Math.sin((curAngle + path._ang) * (Math.PI / 180));
                    console.log(curAngle + " [" + path.left + "," + path.top + "]");
                }
            }, function(path) {
                if (isPiece) {
                    resetPathForRotate(path);
                }
                resetOrigin(path);
                snapPathOrGroup(path);
            });
        }
    }

    // Disable certain browser key shortcuts during active puzzle play.
    if (BOARD && e.key == "Alt") {
        e.preventDefault();
    }
});

// Calculates the relative/initial angle between the center object point and the pivot point.
function setPathAngle(path) {
    let c = path.getCenterPoint();
    let p = path.getCenterPoint();

    // The offset from center point to use to calculate pivot point
    let rotateOffset = path.centerOffset;

    // Use the initial pivot offset, as if path is at angle == 0
    p.x += rotateOffset.x;
    p.y += rotateOffset.y;

    // Calculates the angle between the center and pivot point, inverse tangent of deltaY over deltaX, convert radians to angle
    path._ang = (Math.atan2(c.y - p.y,c.x - p.x) * (180 / Math.PI)) % 360;
}

function setupPathForRotate(path) {
    // c is center point, p is pivot point
    let c = path.getCenterPoint();
    let p = path.getCenterPoint();

    // The offset from center point to use to calculate pivot point
    let rotateOffset = path.centerOffset;

    // Depending on current angle, the initial pivot offset needs to be adjusted when applied
    if (path.angle == 0) {
        p.x += rotateOffset.x;
        p.y += rotateOffset.y;
    } else if (path.angle == 90) {
        p.x -= rotateOffset.y;
        p.y += rotateOffset.x;
    } else if (path.angle == 180) {
        p.x -= rotateOffset.x;
        p.y -= rotateOffset.y;
    } else if (path.angle == 270) {
        p.x += rotateOffset.y;
        p.y -= rotateOffset.x;
    }

    // Calcluate the radius to use between the center and pivot point, square root of deltaX^2 + deltaY^2
    let radius = Math.sqrt(Math.pow(p.x - c.x, 2) + Math.pow(p.y - c.y, 2));

    path._c = c;
    path._p = p;
    path._rad = radius;

    console.log("center: [" + path._c.x + "," + path._c.y + "]");
    console.log("pivot:  [" + path._p.x + "," + path._p.y + "]");
    console.log("radius: " + path._rad);
    console.log("angle:  " + path._ang);
}

function resetPathForRotate(path) {
    path._c = null;
    path._p = null;
    path._rad = null;
    path._ang = null;
}

function resetOrigin(target) {
    // Assures a clean integer 90 degree angle, animated rotation timing can leave it very slightly short on occasion.
    target.straighten();

    var originPoint = target.translateToOriginPoint(
        target.getCenterPoint(),
        target._originalOriginX,
        target._originalOriginY);
    target.originX = target._originalOriginX;
    target.originY = target._originalOriginY;
    target.left = originPoint.x;
    target.top = originPoint.y;

    target._originalOriginX = null;
    target._originalOriginY = null;
    target.rotationInProgress = false;
}