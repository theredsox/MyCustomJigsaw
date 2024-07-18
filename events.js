function configureBoardEvents(BOARD) {
    BOARD.on('mouse:wheel', eventListenerMouseWheel);
    BOARD.on('mouse:down', eventListenerMouseDown);
    BOARD.on('mouse:move', eventListenerMouseMove);
    BOARD.on('mouse:up', eventListenerMouseUp);
    BOARD.on('mouse:over', eventListenerMouseOver);
    BOARD.on('mouse:out', eventListenerMouseOut);
    BOARD.on('selection:created', eventListenerSelectionCreated);
    BOARD.on('before:selection:cleared', eventListenerBeforeSelectionCreated);

    window.addEventListener("keydown", eventListenerKeydown);
    window.addEventListener("keyup", eventListenerKeyup);
}

function removeBoardEvents() {
    window.removeEventListener("keydown", eventListenerKeydown);
    window.removeEventListener("keyup", eventListenerKeyup);
}

function eventListenerMouseWheel(opt) {
    var delta = opt.e.deltaY;
    var zoom = BOARD.getZoom();
    zoom *= 0.999 ** delta;
    zoom = respectZoomMinMax(zoom);
    BOARD.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
    
    // If zooming out, more board space is being made visible. Respect the board pan boundaries.
    if (delta > 0) {
        respectBoardPanBoundaries(opt.e);
    }
    opt.e.preventDefault();
    opt.e.stopPropagation();
}

function eventListenerMouseDown(opt) {
    var evt = opt.e;
    var target = opt.target
    // If there is no target
    if (!target) {
        if (evt.shiftKey) {
            // Start multi-select area
            this.selection = true;

            // Drop any multi-select click (CTRL) selected pieces
            ctrlSelectionDrop();
        } else {
            // Drag the board
            this.isDragging = true;
            this.selection = false;
            this.lastPosX = evt.clientX;
            this.lastPosY = evt.clientY;
        }
    } else if (target) {
        // Left click
        if (evt.which == 1) {
            // Piece pickup if CTRL not pressed and target isn't a multi-select click (CTRL) piece
            if (!BOARD.ctrlSelection && !BOARD.ctrlSelectionObjects.includes(target)) {
                // Drop any multi-select click (CTRL) selected pieces
                ctrlSelectionDrop();

                target._shadow = target.shadow;     // Save original shadow

                if (target.isType("group")) {
                    target.getObjects().forEach(function(c) { c.shadow = undefined; });
                }

                var shadow = new fabric.Shadow({
                    color: "black",
                    blur: 4,
                    offsetX: BOARD._shadowUp,
                    offsetY: BOARD._shadowUp,
                });
                target.shadow = shadow;
                BOARD.renderAll();

                audio('up');
            } else if (BOARD.ctrlSelection) {
                // Add the target if not already included
                if (!BOARD.ctrlSelectionObjects.includes(target)) {
                    target.newlySelected = true;
                    BOARD.ctrlSelectionObjects.push(target);

                    // Select the piece/group
                    let pieces = (target.isType('path') ? [target] : target.getObjects());
                    for (let piece of pieces) {
                        piece._stroke = piece.stroke;
                        piece._strokeWidth = piece.strokeWidth;
                        piece.set('stroke', '#0460b1');
                        piece.set('strokeWidth', parseInt(piece._strokeWidth) * 5);
                    }

                    audio('up');
                }
                BOARD.ctrlSelectionDrag = true;
            } else if (BOARD.ctrlSelectionObjects.length > 0) {
                // New pieces can only be selected when CTRL is down, but when pieces are currently selected dragging can occur
                BOARD.ctrlSelectionDrag = true;
            }
        }

        // Right click - Zoom piece
        if (evt.which == 3 && !BOARD._zoomTarget) {
            // Save the zoom target so it can unzoom even if not the target when right click is released
            BOARD._zoomTarget = target;

            // Assure it'll be the front object for viewing
            target.bringToFront();

            // Determine the scale which will allow the object to zoom to 80% of the board size
            if (BOARD.width > BOARD.height) {
                var boundingRectFactor = target.getBoundingRect(false).height / target.getScaledHeight();
                target._maxScale = (BOARD.height * .8) / target.height / boundingRectFactor;
            } else {
                var boundingRectFactor = target.getBoundingRect(false).width / target.getScaledWidth();
                target._maxScale = (BOARD.width * .8) / target.width / boundingRectFactor;
            }

            animatePath(target, 'scaleX', target._maxScale, 500, true, function(path) {
                // Remember the original values for unzoom
                path._zoomScale = path.scaleX;
                path._zoomLeft = path.left;
                path._zoomTop = path.top;
            }, function(path, curValue) {
                path.scale(curValue);
                setZoomPosition(path, curValue);
            }, function(path) {
                path.setCoords();
            });
        }
    }

    // Disable browser mouse right click menu during gameplay
    if (BOARD && evt.which == "3") {
        evt.preventDefault();
    }
}

function eventListenerMouseMove(opt) {
    var e = opt.e;
    let target = opt.target;

    if (this.isDragging) {
        var vpt = this.viewportTransform;
        vpt[4] += e.clientX - this.lastPosX;
        vpt[5] += e.clientY - this.lastPosY;
       
        respectBoardPanBoundaries(e);

        this.requestRenderAll();
        this.lastPosX = e.clientX;
        this.lastPosY = e.clientY;
    } else if (BOARD.ctrlSelectionDrag && target && BOARD.ctrlSelectionObjects.includes(target) && !target.newlySelected) {
        // If in a multi-select click (CTRL), move all selected objects
        if (target.lastPosX && target.lastPosY) {
            let xDiff = target.left - target.lastPosX;
            let yDiff = target.top - target.lastPosY;
            
            for (let obj of BOARD.ctrlSelectionObjects) {
                if (obj != target) {
                    obj.left += xDiff;
                    obj.top += yDiff;
                }
            }
            BOARD.renderAll();
        }
        target.lastPosX = target.left;
        target.lastPosY = target.top;
    }
}

function eventListenerMouseUp(opt) {
    var evt = opt.e;
    let target = opt.target;

    // On mouse up recalculate new interaction for all objects, so call setViewportTransform
    this.setViewportTransform(this.viewportTransform);
    this.isDragging = false;
    this.selection = true;

    // Left click
    if (evt.which == 1) {
        if (target) {
            // If in a single piece pickup, drop it.
            if (!BOARD.ctrlSelection && !BOARD.ctrlSelectionObjects.includes(target)) {
                audio('down');
                target.shadow = target._shadow;
                target._shadow = undefined;
                snapPathOrGroup(target);
            } else if (!BOARD.ctrlSelection && BOARD.ctrlSelectionObjects.includes(target) && !target.lastPosX && !target.lastPosX) {
                // If clicking the board and no drag was performed, drop any multi-select click (CTRL) selected pieces
                ctrlSelectionDrop();
            } else {
                // If the target wasn't added in this click and not being moved, assume it is being unselected
                if (BOARD.ctrlSelection && !target.newlySelected && !target.lastPosX && !target.lastPosX) {
                    const index = BOARD.ctrlSelectionObjects.indexOf(target);
                    if (index > -1) {
                        audio('down');
                        BOARD.ctrlSelectionObjects.splice(index, 1);

                        // Deselect the piece/group
                        let pieces = (target.isType('path') ? [target] : target.getObjects());
                        for (let piece of pieces) {
                            piece.set('stroke', piece._stroke);
                            piece.set('strokeWidth', piece._strokeWidth);
                            piece._stroke = undefined;
                            piece._strokeWidth = undefined;
                        }
                    }
                }

                if (BOARD.ctrlSelection && target.newlySelected) {
                    // Move the piece to where the first piece is and bring it to the top
                    if (BOARD.ctrlSelectionObjects[0] != target) {
                        target.left = BOARD.ctrlSelectionObjects[0].left;
                        target.top = BOARD.ctrlSelectionObjects[0].top;
                        target.setCoords();
                        target.bringToFront();
                    }
                }

                target.newlySelected = false;
                target.lastPosX = undefined;
                target.lastPosY = undefined;
                BOARD.ctrlSelectionDrag = false;
            }
        } else if (BOARD.lastPosX == evt.clientX && BOARD.lastPosY == evt.clientY) {
            // If clicking the board and no drag was performed, drop any multi-select click (CTRL) selected pieces
            ctrlSelectionDrop();
        }
    }

    // Right click - Unzoom piece
    if (evt.which == 3) {
        let target = BOARD._zoomTarget;
        if (target && !target.unzoomInProgress) {
            target.unzoomInProgress = true;
            
            animatePath(target, 'scaleX', target._zoomScale, 500, true, undefined, function(path, curValue) {
                path.scale(curValue);
                setZoomPosition(path, curValue);
            }, function(path) {
                path.left = path._zoomLeft;
                path.top = path._zoomTop;
                path.setCoords();
                path._maxScale = null;
                path._zoomScale = null;
                path._zoomLeft = null;
                path._zoomTop = null;
                BOARD._zoomTarget = null;
                target.unzoomInProgress = false;
            });
        }
    }

    // Disable browser mouse right click menu during gameplay
    if (BOARD && evt.which == "3") {
        evt.preventDefault();
    }
}

function eventListenerMouseOver(opt) {
    BOARD.overTarget = opt.target;
}

function eventListenerMouseOut() {
    BOARD.overTarget = undefined;
}

function eventListenerSelectionCreated(opt) {
    if (opt.selected.length > 1) {
        var group = BOARD.getActiveObject();
        group.hasBorders = false;
        group.hasControls = false;
        group.lockRotation = true;
        group.lockScalingX = true;
        group.lockScalingY = true;
        group.perPixelTargetFind = true;

        for (let obj of group.getObjects()) {
            let pieces = (obj.isType('path') ? [obj] : obj.getObjects());
            for (let piece of pieces) {
                piece._stroke = piece.stroke;
                piece._strokeWidth = piece.strokeWidth;
                piece.set('stroke', '#0460b1');
                piece.set('strokeWidth', parseInt(piece._strokeWidth) * 5);
            }
        }
    }
}

function eventListenerBeforeSelectionCreated(opt) {
    if (opt.target.type == 'activeSelection') {
        let objs = opt.target.getObjects();
        // If in a multi-select click (CTRL), transfer the basic selection over
        if (BOARD.ctrlSelection && BOARD.overTarget && objs.length > 0) {
            for (let obj of objs) {
                BOARD.ctrlSelectionObjects.push(obj);
            }
        } else {
            for (let obj of opt.target.getObjects()) {
                let pieces = (obj.isType('path') ? [obj] : obj.getObjects());
                for (let piece of pieces) {
                    piece.set('stroke', piece._stroke);
                    piece.set('strokeWidth', piece._strokeWidth);
                    piece._stroke = undefined;
                    piece._strokeWidth = undefined;
                }
            }
        }
    }
}

function eventListenerKeydown(evt) {
    // Rotate piece
    if (BOARD.orientation > 0 && evt.key == "Alt" && BOARD.overTarget) {
        // Grab a reference immediately since mouse:out can detach target during animation
        let target = BOARD.overTarget;
        if (!target.rotationInProgress) {
            let angle = BOARD.orientation == 1 ? 180 : 90;
            animatePath(target, 'angle', target.angle + angle, 250, true, function(path){
                path.rotationInProgress = true;
                path.lockMovementX = true;
                path.lockMovementY = true;
                path._left = path.left;
                path._top = path.top;
            }, function(path, curAngle) {
                const pivot = path.translateToOriginPoint(path.getCenterPoint(), path._originX, path._originY);
                path.angle = curAngle;
                path.setPositionByOrigin(pivot, path._originX, path._originY);
            }, function(path) {
                path.straighten();

                rotateWhileMovingWorkaround(path, evt);

                path._left = undefined;
                path._top = undefined;
                path.lockMovementX = false;
                path.lockMovementY = false;
                path.rotationInProgress = false;
                snapPathOrGroup(path);
            });

            audio('rotate');
        }
    }

    // Enable multi-select drag when shift key is pressed
    BOARD.selection = evt.key == "Shift" && !BOARD.overTarget;
    
    // Enable multi-select click when CTRL key is pressed
    BOARD.ctrlSelection = evt.key == "Control";

    // Disable certain browser key shortcuts during active puzzle play.
    if (BOARD && evt.key == "Alt") {
        evt.preventDefault();
    }
}

function eventListenerKeyup(evt) {
    if (evt.key == "Control") {
        BOARD.ctrlSelection = false;
    }
}

// FabricJS appears to have a bug where if you rotate an object while it is being dragged,
// some internal values used in the move are not being properly updated. This is a workaround,
// I came up with for it. Hopefully can be removed after a future release of the lib.
function rotateWhileMovingWorkaround(target, e) {
    if (BOARD._currentTransform?.target == target) {
        // [x,y] shift due to rotate
        let diffLeft = target._left - target.left;
        let diffTop = target._top - target.top;

        // Original [x,y] upon piece being picked up
        let origLeft = BOARD._currentTransform.ex - BOARD._currentTransform.offsetX;
        let origTop = BOARD._currentTransform.ey - BOARD._currentTransform.offsetY;

        // Recalc the original offsets accounting for the rotation difference
        BOARD._currentTransform.offsetX = BOARD._currentTransform.ex - (origLeft - diffLeft);
        BOARD._currentTransform.offsetY = BOARD._currentTransform.ey - (origTop - diffTop);

        // Update other props in the transform related to the target
        BOARD._currentTransform.theta = fabric.util.degreesToRadians(BOARD._currentTransform.target.angle);
    }
}