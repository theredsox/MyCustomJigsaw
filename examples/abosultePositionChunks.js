// Retrieving the absolute top left corner coords based on object rotation.
// For group, just rotate and return the point at TL once done. For paths it is
// more complicated because their point positioning is relative to the group. So 
// the group and piece must rotate and return relative TL from the group rotation.
// Rotation chart (group, piece, total, point pos):
// 0   0   = 0    = TL
// 0   90  = 90   = TR
// 0   180 = 180  = BR
// 0   270 = 270  = BL
// 90  0   = -90  = BL
// 90  90  = 0    = TL
// 90  180 = 90   = TR
// 90  270 = 180  = BR
// 180 0   = -180 = BR
// 180 90  = -90  = BL
// 180 180 = 0    = TL
// 180 270 = 90   = TR
// 270 0   = -270 = TR
// 270 90  = -180 = BR
// 270 180 = -90  = BL
// 270 270 = 0    = TL
//
// Alternatively we could add 360 before taking the modulo to assure a positive result.  I think it is clearer seeing both 
// clockwise and counterclockwise positioning. It also supports angles greater than 360. Otherwise to support that we'd 
// have to mod both angles by 360 before subtracting, like (([group angle] % 360) - ([angle] % 360) + 360) % 360
function getRotatedCorner(object) {
    // Object is a path without a group or is a group itself (which wouldn't have a nested group)
    if (!object.group) {
        switch (object.angle % 360) {
            case 0:
                return object.aCoords.tl;
            case 90:
                return object.aCoords.bl;
            case 180:
                return object.aCoords.br;
            case 270:
                return object.aCoords.tr;
            default:
                throw new Error("Unsupported angle (" + object.angle + ")");
        }
    } else {
        switch ((object.group.angle - object.angle) % 360) {
            case 0:
                return object.aCoords.tl;
            case 90:
            case -270:
                return object.aCoords.tr;
            case 180:
            case -180:
                return object.aCoords.br;
            case 270:
            case -90:
                return object.aCoords.bl;
            default:
                throw new Error("Unsupported angle (" + object.angle + ")");
        }
    }     
}

function getAbsolutePosition(object) {
    // Groups use relative positioning for children. Oddly relative to the center of the group, a FabricJS choice.
    if (object.group) {
        // TODO: Think I need to invest in learning the transform system. I believe that in theory should help 
        // translate the relative positioning to absolute while dealing with rotations. 
        // See my resetOrigin(), which kind of does a simplier version of this for rotating pieces around a center point
        /*
            // https://github.com/fabricjs/fabric.js/issues/801
            // 1. get the matrix for the object.
            var matrix = ObjectInGroup.calcTransformMatrix();
            // 2. choose the point you want, fro example top, left.
            var point = { x: -ObjectInGroup.width/2, y: ObjectInGroup.height/2 };
            // 3. transform the point
            var pointOnCanvas = fabric.util.transformPoint(point, matrix)
        */
       /*
            // This one is like previous, but uses getPointByOrigin() which may prove useful
            // https://stackoverflow.com/questions/29829475/how-to-get-the-canvas-relative-position-of-an-object-that-is-in-a-group
            const position = fabric.util.transformPoint(
            // you can choose point of object (left/center/right, top/center/bottom)
            object.getPointByOrigin('left', 'top'), 
            object.calcTransformMatrix()
            )
       */
        // let gCorner = getRotatedCorner(object.group);
        // let corner = getRotatedCorner(object);
        // if (key == 'top') {
        //     // TODO: May need to switch width and height for 90 and 270
        //     if (object.angle == 180) {
        //         ((object.group.height/2) - corner.y) + gCorner.y;
        //     }
        //     return ((object.group.height/2) + corner.y) + gCorner.y;
        // } else if (key == 'left') {
        //     // TODO: May need to switch width and height for 90 and 270
        //     if (object.angle == 180) {
        //         ((object.group.width/2) - corner.x) + gCorner.x;
        //     }
        //     return ((object.group.width/2) + corner.x) + gCorner.x;
        // }
        // 1. get the matrix for the object.
        //var matrix = object.calcTransformMatrix();
        //var point = { x: -object.width/2, y: object.height/2 };
        //var point = object.getPointByOrigin('left', 'top');
        //var pointOnCanvas = fabric.util.transformPoint(point, matrix)
    }
    // let corner = getRotatedCorner(object);
    // return key == 'top' ? corner.y : corner.x;
    return object.aCoords.tl;
}