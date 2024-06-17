// Attaches to puzzle menu items
menuItem.addEventListener("dragstart", function(event){
    initializeMimicDrag(event);
});

// Attaches to puzzle menu items
menuItem.addEventListener("dragend", function(event){
    cleanupMimicDrag();
});

// Comment out this chunk from folder menu items
// menuItem.addEventListener("dragover", function(event){ 
//     event.preventDefault();
// });
// menuItem.addEventListener("drop", function(event){ 
//     event.preventDefault();
//     var pid = event.dataTransfer.getData("text");
//     movePuzzle(ACTIVE_FID, event.target.id, pid);
//     document.getElementById(pid).remove();
// });

// Below are the implementation functions

//////////////////////////////////////////////////////////////////
// Hack strategy to override drag and drop transparency of drag item because it is hard to see.
// To do this, we hide the actual drag item and create an absolutely positioned clone
// of the object which follows the mouse around. We have full control over the clone's CSS.
//////////////////////////////////////////////////////////////////
function initializeMimicDrag(event) {
    // 1) Track the mouse during drag by binding dragover to the entire document.
    // This function is responsible for keeping the mimic object tracking the mouse.
    document.addEventListener("dragover", trackMouseForMimic, false);

    // 2) Override the drag image to a dummy div that won't be shown. The mimic will be shown instead.
    var dummy = window.document.createElement('div');
    event.dataTransfer.setDragImage(dummy, 0, 0);

    // 3) Clone the drag object and make it absolute positioned so trackMouseForMimic() can move it
    var dragMimic = document.getElementById(event.target.id).cloneNode(true);
    dragMimic.id = "dragMimic";
    dragMimic.style.position = "absolute";
    dragMimic.style.opacity = .75;

    // 4) Because the mouse will always be over this mimic object that moves with the mouse,
    // we must manually detect when we are hovering over a folder we can drop into.
    dragMimic.addEventListener("dragover", function(event){ 
        let elements = document.elementsFromPoint(event.pageX, event.pageY);
        let target = elements.find(e => e.id.charAt(0) == "f");
        if (target) {
            event.preventDefault();
        }
    });

    // 4) Because the mouse will always be over this mimic object that moves with the mouse,
    // we must manually detect a drop and execute it not on the event's target object, 
    // but instead on the folder object underneath it.
    dragMimic.addEventListener("drop", function(event){ 
        event.preventDefault();
        let elements = document.elementsFromPoint(event.pageX, event.pageY);
        let target = elements.find(e => e.id.charAt(0) == "f");
        if (target) {
            var pid = event.dataTransfer.getData("text");
            movePuzzle(ACTIVE_FID, target.id, pid);
            document.getElementById(pid).remove();
        }
    });
    document.body.appendChild(dragMimic);
}

var offsetX;
var offsetY;
function trackMouseForMimic(event) {
    // Only set the first call to determine relative position on puzzle menu item being dragged
    if (!offsetX && !offsetY) {
        offsetX = event.offsetX;
        offsetY = event.offsetY;
    }
    var dragMimic = document.getElementById("dragMimic");
    dragMimic.style.left = (event.pageX - offsetX) + "px";
    dragMimic.style.top = (event.pageY - offsetY) + "px";
}

function cleanupMimicDrag() {
    // Clear out the offsets
    offsetX = undefined;
    offsetY = undefined;

    // Stop listening for mouse positioning
    document.removeEventListener("dragover", trackMouseForMimic, false);

    // Remove the mimic object that was being moved with the mouse.
    document.getElementById("dragMimic").remove();
}