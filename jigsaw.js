// Priority TODOs
// * Puzzle piece CSS; Look into custom filter to warp the piece image around the edge
// * Add sound effects for pick up, drop, and rotate
// * Change piece Path edge size based on Path resolution, low res puzzles with lots of pieces need thinner border
//  - Medium: more controls: right click = zoom on piece, ctrl+left click = multi-select pieces, shift+left click + drag = multi-select, left click board drag over pan area
// BUG: Try to track down group snapping to single piece alignment bug that ocassionally pops up.
// BUG: Rotate while left mouse held down causes location jump
// * Work more on pan aspect ratio. Consider if it should be based on board instead of puzzle image
// * Hide disk space, import, and export buttons. replace with play buttons for image reference toggle, sound effects on/off, and future buttons
//  - Low: puzzle image for reference, sound effects + on/off toggle during play, buckets
// * Implement import and export buttons (Export to zip, import from zip)
// * Icons for main menu buttons (create buzzle, create folder, delete, return home, move puzzle home) to go with the text
// * Add a Rename button 
// * Create a help menu (describes controls; drag and drop and mouse/keys for when playing)
// * Auto save board state for continuing later
// * Create a first pass at stat tracking
// * Add handling of filesystem.js exceptions so that menu's continue to load if a file is missing and that an error is raised if a failure happens saving any of the images during puzzle creation
// * Advanced play options - auto-sorting by shape/color onto board or into buckets
// * Add loading message for puzzle creation (and maybe other areas like waiting on puzzle images)
// * Simplify/clean up CSS. Like display: individual none/inline's using .remove and .add instead
// * Consider using inline HTML format to create objects instead of separate lines for each attribute.
//       Or find ways to reduce attribute setting. Maybe remove IDs that are identical to class name and look up object by class

// Tracks the active folder for the puzzle menu
var ACTIVE_FID = "root";

// Tracks the FabricJS canvas object used for rendering the play board
var BOARD;

// Tracks the singleton image cropper object used for creating new puzzles
var CROPPER;

// Tracks the difficulty labels
const DIFFICULTIES = [
    "Have a moment",
    "Commercial break", 
    "Quick jaunt", 
    "Break time", 
    "Lazy afternoon", 
    "Let's get serious", 
    "Up all night", 
    "Eat, sleep, jigsaw, repeat"
];

window.onresize = function() {
    if (CROPPER) {
        // Reset the cropper positioning on window resize since the image may scale
        // NOTE: Does not appear a debounce is needed for performance, but keep an eye on it
        CROPPER.reset(); 
    }

    if (BOARD) {
        BOARD.setWidth(window.innerWidth - 20);
        BOARD.setHeight(window.innerHeight - 80);
    }
}

async function loadMainMenu() {
    // Clear the puzzles first, as this may be a reload
    var mainMenu = document.getElementById("mainMenu");
    var menuItems = mainMenu.getElementsByClassName("menuItem")
    while (menuItems.length > 0) { 
        mainMenu.removeChild(menuItems[menuItems.length - 1]);
    }

    // Load the saved puzzles
    let puzzles = getPuzzles(ACTIVE_FID);
    for (const [key, value] of Object.entries(puzzles).sort(sortPuzzles)) {
        await loadMenuItem(key, value["title"] || value);
    }
    
    // Folder button text update
    let text = (ACTIVE_FID != "root" ? "Return Home" : "Create Folder");
    document.getElementById("createFolderButton").innerText = text;

    // Refresh estimated storage usage
    refreshStorageUsage();
}

// Sort folders before puzzles, then alpha order puzzle title and folder name
// @param [aK, aV] - [string, string] - [puzzle/folder ID, title]
// @param [bK, bV] - [string, string] - [puzzle/folder ID, title]
function sortPuzzles([aK,aV],[bK,bV]) {
    // First character of key is 'f' for folder or 'p' for puzzle
    if (aK.charAt(0) < bK.charAt(0)) {
        return -1;
    } else if (aK.charAt(0) > bK.charAt(0)) {
        return 1;
    }

    if (aK.charAt(0) == "p") {
        return aV["title"].localeCompare(bV["title"]);
    }
    return aV.localeCompare(bV);
}

function menuItemClick(menuItem, event){
    // If in delete mode, toggle checked and disable dragging
    let checkbox = menuItem.querySelector(".menuItemDelete");
    if (checkbox.checkVisibility()) {
        checkbox.checked = !checkbox.checked;
        checkbox.checked ? menuItem.classList.add("menuItemChecked") : menuItem.classList.remove("menuItemChecked");

        // Update delete button text
        let deleteButton = document.getElementById("deleteButton");
        const count = document.querySelectorAll(".menuItemChecked").length;
        deleteButton.innerText = "Delete (" + count + ")";
        return;
    }
    if (menuItem.id.startsWith("f")) {
        ACTIVE_FID = menuItem.id;
        loadMainMenu();
    } else {
        loadPlayOverlay(menuItem, event);
    }
}

function menuItemDropTarget(menuItem) {
    menuItem.addEventListener("dragover", function(event){ 
        event.preventDefault();
        menuItem.classList.add("dropTargetHighlight");
    });
    menuItem.addEventListener("dragleave", function(){ 
        menuItem.classList.remove("dropTargetHighlight");
    });
    menuItem.addEventListener("drop", function(event){ 
        event.preventDefault();
        var pid = event.dataTransfer.getData("text");
        movePuzzle(ACTIVE_FID, event.target.id, pid);
        document.getElementById(pid).remove();
        menuItem.classList.remove("dropTargetHighlight");
    });
}

function menuItemDragTarget(menuItem) {
    menuItem.addEventListener("dragstart", function(event){
        event.dataTransfer.setData("text", event.target.id);
        this.classList.add("dragging");

        if (ACTIVE_FID != "root") {
            // Turn the folder button into a drop point for moving a puzzle home
            let createFolderButton = document.getElementById("createFolderButton");
            createFolderButton.innerText = "Move Puzzle to Home";
            createFolderButton.ondragover = function(event){ 
                event.preventDefault();
                createFolderButton.classList.add("dropTargetHighlight");
            };
            createFolderButton.ondragleave = function(event){ 
                createFolderButton.classList.remove("dropTargetHighlight");
            }
            createFolderButton.ondrop = function(event){ 
                event.preventDefault();
                var pid = event.dataTransfer.getData("text");
                movePuzzle(ACTIVE_FID, "root", pid);
                document.getElementById(pid).remove();
                createFolderButton.classList.remove("dropTargetHighlight");
            };
        }
    });
    menuItem.addEventListener("dragend", function(){ 
        this.classList.remove("dragging");

        if (ACTIVE_FID != "root") {
            // Turn the folder button back into return home
            let createFolderButton = document.getElementById("createFolderButton");
            createFolderButton.innerText = "Return Home";
            createFolderButton.ondragover = null;
            createFolderButton.ondragleave = null;
            createFolderButton.ondrop = null;
        }
    });
}

async function loadMenuItem(id, title) {
    var isFolder = id.startsWith("f");

    // Create menu item container from the clone template
    var menuItem = window.document.getElementById("menuItemClone").cloneNode(true);
    menuItem.draggable = !isFolder;
    menuItem.id = id;
    
    if (isFolder) {
        menuItemDropTarget(menuItem);
    } else {
        menuItemDragTarget(menuItem);
    }

    menuItem.querySelector(".menuItemTitle").textContent = title;

    // If the item is a folder, show the folder image. Otherwise show the custom puzzle portrait
    if (isFolder) {
        menuItem.style.backgroundImage = "url('assets/folder.png')";
    } else {
        const filename = id + "preview.png";
        const png = await readFile("puzzles", filename);
        menuItem.style.backgroundImage = "url('" + URL.createObjectURL(png) + "')";
    }

    // Add menu item to menu grid
    var mainMenu = document.getElementById("mainMenu");
    mainMenu.appendChild(menuItem);
}

function checkButtonStatus(buttonId, textField, event) {
    // Disable passed button when no name is provided
    var button = document.getElementById(buttonId);
    button.disabled = textField.value.trim().length == 0;

    // Auto submit on enter key
    if (event.key === 'Enter') {
        button.click();
    }
}

function makeFolder() {
    let fid = getAndIncrementNextFolderID();
    var name = document.getElementById("createFolderName").value.trim();
    addFolder(fid, name);

    // TODO: Consider manually inserting the new DOM folder instead of reloading them all.
    // Need to determine where to insert it for alpha order of folders
    loadMainMenu();

    closeFolderOverlay();
}

function closeFolderOverlay() {
    // Hide overlays
    document.getElementById("createFolderOverlay").classList.add("remove");
    hideOverlayCover();

    // Reset name component
    document.getElementById("createFolderName").value = "";
}

function createFolder() {
    // Show overlays
    showOverlayCover();
    document.getElementById("createFolderOverlay").classList.remove("remove");

    // Change focus to the name input
    setTimeout(function() { document.getElementById("createFolderName").focus(); }, 50);
}

async function returnHome() {
    ACTIVE_FID = "root";
    await loadMainMenu();
}

function deletePuzzlesMode() {
    // Update menu buttons
    document.getElementById("createPuzzleButton").disabled = true;
    document.getElementById("createFolderButton").disabled = true;
    document.getElementById("deleteButton").innerText = "Delete (0)";
    document.getElementById("cancelButton").classList.remove("hidden");

    // Show the checkboxes
    let checkboxes = document.getElementsByClassName("menuItemDelete");
    for (let checkbox of checkboxes) {
        checkbox.style.display = "inline";
    }
    // Disable dragging for puzzles
    let items = document.getElementsByClassName("menuItem");
    for (let item of items) {
        if (item.id.charAt(0) == "p") {
            item.draggable = false;
        }
    }
}

function deletePuzzles() {
    let itemsToDelete = document.querySelectorAll(".menuItemChecked");
    if (confirm("Are you sure you want to delete " + itemsToDelete.length + " entries?") === true) {
        // Delete chosen folders/puzzles, their related image files, and remove them from the menu
        for (let item of itemsToDelete) {
            let menuItem = item.closest(".menuItem");
            if (menuItem.id.charAt(0) == "f") {
                let puzzles = getPuzzles(menuItem.id);
                for (const id of Object.keys(puzzles)) {
                    deleteFile("puzzles", id + ".png");
                    deleteFile("puzzles", id + "preview.png");
                    deletePuzzle(menuItem.id, id);
                }
                deleteFolder(menuItem.id);
            } else {
                deleteFile("puzzles", menuItem.id + ".png");
                deleteFile("puzzles", menuItem.id + "preview.png");
                deletePuzzle(ACTIVE_FID, menuItem.id);
            }
            menuItem.remove();
        }
        deletePuzzlesCancel();
    }
}

function deletePuzzlesCancel() {
    // Update menu buttons
    document.getElementById("createPuzzleButton").disabled = false;
    document.getElementById("createFolderButton").disabled = false;
    document.getElementById("deleteButton").innerText = "Delete";
    document.getElementById("cancelButton").classList.add("hidden");
    
    // Hide the checkboxes
    let checkboxes = document.getElementsByClassName("menuItemDelete");
    for (let checkbox of checkboxes) {
        checkbox.style.display = "none";
    }
    // Enable dragging for puzzles
    let items = document.getElementsByClassName("menuItem");
    for (let item of items) {
        if (item.id.charAt(0) == "p") {
            item.draggable = true;
        }
    }
}

function playOverlayDifficultyClick(difficulty) {
    let selected = difficulty.parentElement.querySelector(".playOverlayDifficultySelected");
    if (selected && difficulty != selected) {
        selected.classList.remove("playOverlayDifficultySelected");
    }
    difficulty.classList.add("playOverlayDifficultySelected");

    document.getElementById("playButton").disabled = false;
}

function playOverlayOrientationInfoClick() {
    const msg = "Piece orientation refers to how the pieces will be laid out on the board." + 
        "<ul>" + 
        "<li><font class='orientationOption0'>In standard mode</font>, pieces will always be oriented in the correct direction. A flat edge at the top of the piece is a top edge piece.</li>" + 
        "<li><font class='orientationOption1'>In intermediate mode</font>, pieces can be oriented two ways (north, south). A flat edge at the top of the piece could be a top or bottom edge piece. A flat edge on the left side is a left edge piece.</li>" + 
        "<li><font class='orientationOption2'>In advanced mode</font>, pieces can be oriented in four ways (north, south, east, west). A flat edge at the top could be an edge for any side of the puzzle. This best represents physical jigsaw puzzles and will make the puzzle far more challenging.</li></ul>" +
        "TIP: To rotate a piece, hover over or pick up the piece. Then hit the [Alt] key to rotate.";
    document.getElementById("infoOverlayText").innerHTML = msg;
    document.getElementById("infoOverlay").classList.remove("remove");
}

function playOverlayOrientationSelectChange(orientationSelect) {
    let span = orientationSelect.parentElement.querySelector(".playOverlayOrientationSpan");
    if (orientationSelect.value != 0) {
        span.classList.remove("playOverlayHidden");
        span.classList.add("playOverlayVisible");
    } else {
        span.classList.add("playOverlayHidden");
        span.classList.remove("playOverlayVisible");
    }
    orientationSelect.className = "orientationSelect orientationOption" + orientationSelect.value;
}

function playOverlayPlayButtonClick(playButton) {
    // Capture the user's play selections
    let playOverlay = playButton.parentElement;
    const puzzleId = playOverlay.id.substring(1);
    const difficulty = playOverlay.querySelector(".playOverlayDifficultySelected").id;
    const orientation = parseInt(playOverlay.querySelector(".orientationSelect").value);

    hideOverlayCover();
    playOverlay.remove();

    // Transition to the create puzzle page
    displayPage("page1", false);
    setTimeout(function(){
        displayPage("page2", true);
        startPuzzle(puzzleId, difficulty, orientation);
    }, 600);
}

function playOverlayCancelButtonClick(cancelButton) {
    hideOverlayCover();
    cancelButton.parentElement.remove();
}

function loadPlayOverlay(menuItem, event) {
    
    // Clone the menuItem to use as the play overlay
    // Position it absolute right on top of its parent to start
    var playOverlay = menuItem.cloneNode(true);
    playOverlay.id = "_" + playOverlay.id;  // Assure unique id
    playOverlay.className = "playOverlay";
    playOverlay.style.backgroundImage = menuItem.style.backgroundImage;     // TODO: Is this needed?
    playOverlay.style.position = "absolute";
    playOverlay.style.left = (event.pageX - event.offsetX) + "px";
    playOverlay.style.top = (event.pageY - event.offsetY) + "px";
    playOverlay.draggable = false;
    playOverlay.onclick=null;
    playOverlay.ondragstart=null;
    playOverlay.ondragend=null;

    // Select for difficulty - # of pieces 
    let difficulties = window.document.createElement('div');
    difficulties.className = "playOverlayDifficulties playOverlayHidden hidden";

    let index = 0;
    let puzzle = getPuzzle(ACTIVE_FID, menuItem.id);
    let availableDifficulties = getDifficulties(puzzle["aspectRatio"]);
    for (let [pieces, dimensions] of Object.entries(availableDifficulties)) {
        // Create difficulty from the clone template
        let difficulty = window.document.getElementById("playOverlayDifficultyClone").cloneNode(true);
        difficulty.id = dimensions;

        difficulty.querySelector(".difficultyHeader").classList.add("difficulty" + index)
        difficulty.querySelector(".difficultyTitle").textContent = pieces + " pieces";
        difficulty.querySelector(".difficultySpan").textContent = DIFFICULTIES[index];

        difficulties.appendChild(difficulty);
        index++;
    }
    playOverlay.appendChild(difficulties);

    // Create orientation container from the clone template
    let orientation = window.document.getElementById("playOverlayOrientationClone").cloneNode(true);
    orientation.id = "playOverlayOrientation";
    playOverlay.appendChild(orientation);

    // Play button
    var playButton = document.getElementById("playButtonClone").cloneNode(true);
    playButton.id = "playButton";
    playOverlay.appendChild(playButton);

    // Cancel button to exit folder creation
    var cancelButton = document.getElementById("cancelButtonClone").cloneNode(true);
    cancelButton.id = "cancelButton";
    playOverlay.appendChild(cancelButton);

    // Render the play overlay
    document.body.appendChild(playOverlay);

    // Transition to the centered play overlay. Must be delayed for playOverlay to be drawn on screen or animations won't trigger.
    setTimeout(function() {
        // Bring up the overlay cover
        showOverlayCover();
        
        // Apply the CSS class to trigger the transition position from menu item to play overlay
        playOverlay.classList.add("playOverlayTransition");

        // Set background transparency to make play options more visible
        playOverlay.style.backgroundImage = "linear-gradient(rgba(255,255,255,0.5), rgba(255,255,255,0.5)), " + playOverlay.style.backgroundImage;

        // Make play options visible after the transition animations finish
        setTimeout(function() {
            // Bring them into the DOM before starting transitions
            difficulties.classList.remove("hidden");
            orientation.classList.remove("hidden");
            playButton.classList.remove("hidden");
            cancelButton.classList.remove("hidden");

            // Start transitions
            difficulties.classList.add("playOverlayVisible");
            difficulties.classList.remove("playOverlayHidden");
            orientation.classList.add("playOverlayVisible");
            orientation.classList.remove("playOverlayHidden");
            playButton.classList.add("playOverlayVisible");
            playButton.classList.remove("playOverlayHidden");
            cancelButton.classList.add("playOverlayVisible");
            cancelButton.classList.remove("playOverlayHidden");
        }, 1000);
    }, 100);
}

function createPuzzle() {

    var fileOpener = document.getElementById("fileOpener");
    
    // Register post-image selection work
    fileOpener.addEventListener("change", function(){
        if (fileOpener.files.length > 0) {
            // Default title to file name
            var createPuzzleName = document.getElementById("createPuzzleName");
            createPuzzleName.value = formatTitle(fileOpener.files[0].name);

            // Populate the image preview
            var createPuzzlePreview = document.getElementById("createPuzzlePreview");
            createPuzzlePreview.src = URL.createObjectURL(fileOpener.files[0]);

            createPuzzlePreview.onload = function() {
                // TODO: If image resolution is too small, kick back to main menu page and alert user to choose a different image
                
                // Default to nearest supported aspect ratio of uploaded photo
                let aspectRatio = determineAspectRatio({ width: this.width, height: this.height });
                document.getElementById("createPuzzleAspectRatio").value = aspectRatio[0] + ":" + aspectRatio[1];
            }

            // Show the overlays
            showOverlayCover();
            document.getElementById("createPuzzleOverlay").classList.remove("remove");

            // Change focus to the name input
            setTimeout(function() { createPuzzleName.focus(); }, 50);
        }
    });

    // Prompt user to choose an image
    fileOpener.click();
}

function createPuzzleStep2() {
    // Transition overlay to step 2 (choosing aspect ratio and cropping image)
    document.getElementById("createPuzzleOverlay").classList.add("createPuzzleOverlayTransition");
    document.getElementById("createPuzzleNameLabel").classList.add("remove");
    document.getElementById("createPuzzleTitle").innerText = document.getElementById("createPuzzleName").value.trim();
    document.getElementById("createPuzzleAspectRatioWrapper").classList.remove("remove");
    
    document.getElementById("createPuzzlePreview").classList.remove("createPuzzleThumbnail");
    document.getElementById("createPuzzlePreview").classList.add("createPuzzlePreview");

    document.getElementById("createPuzzleNextButton").classList.add("remove");
    document.getElementById("createPuzzleSaveButton").classList.remove("remove");
    
    // Instanciate the image cropper tool
    let aspectRatio = document.getElementById("createPuzzleAspectRatio").value.split(":");
    aspectRatio = parseInt(aspectRatio[1]) / parseInt(aspectRatio[0]);
    cropImage(aspectRatio); 
}

// Destroy and recreate the cropper with teh new aspect ratio setting
// @param aspectRatio - string - "x:y"
function changeAspectRatio(aspectRatio) {
    aspectRatio = aspectRatio.split(":");
    CROPPER.options.aspectRatio = parseInt(aspectRatio[1]) / parseInt(aspectRatio[0]);
    CROPPER.reset();
}

// @param aspectRatio - [integer, integer] - [width, height]
function cropImage(aspectRatio) {
    CROPPER = new Croppr('#createPuzzlePreview', {
        minSize: { width: 175, height: 175 },
        aspectRatio: aspectRatio
    });
    
    // Due to a bug somewhere in the Croppr lib, a reset after rendering is required to catch the correct sizing of the parent container
    setTimeout(function() { CROPPER.reset(); }, 100);
}

function destroyCropper() {
    if (CROPPER) {
        CROPPER.destroy();
        CROPPER = null;
    }
}

// TODO: Change this function to be called on initial JS load. Put a warning icon in the top right corner if this function returns false.
//       Move the alert text to an onclick of the warning icon.
async function configurePersistedStorage() {
    
    // Check if site's storage has been marked as persistent
    if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persisted();
        if (isPersisted) {
            return;
        }

        const isPersist = await navigator.storage.persist();
        if (isPersist) {
            return;
        }

        alert("Detected persisted browser storage is off. Although unlikely, puzzles could be deleted. Export regularly to keep a backup.");
        return;
    }
}

function refreshStorageUsage() {
    navigator.storage.estimate().then((estimate) => {
        var percent = ((estimate.usage / estimate.quota) * 100).toFixed(2) + "%";
        var quota = (estimate.quota / 1024 / 1024).toFixed(2);
        if (quota < 1024) {
            quota += "MB";
         } else {
            quota = (quota / 1024).toFixed(2);
            if (quota < 1024) {
                quota += "GB";
            } else {
                quota = (quota / 1024).toFixed(2);
                quota += "TB";
            }
        }
        document.getElementById("diskSpaceText").innerText = "Disk space: " + percent + " of " + quota;
    });
}

async function makePuzzle() {
    // Verify the user provided a name for the puzzle
    var createPuzzleName = document.getElementById("createPuzzleName");
    if (createPuzzleName.value.trim() == "") {
        alert("A name must be provided for the puzzle");
        return;
    }

    // Grab the crop details from the user
    var cropSize = CROPPER.getValue();

    // TODO: Consider setting a minimum standard for final image size

    // Destroy cropper for resource cleanup
    destroyCropper();

    // Generate the unique puzzle ID
    const pid = getAndIncrementNextPuzzleID();

    // Generate the cropped puzzle images (Full size and preview)
    await generatePuzzleImages(pid, cropSize);

    // Save the new puzzle
    var title = createPuzzleName.value.trim();
    let aspectRatio = document.getElementById("createPuzzleAspectRatio").value.split(":");
    aspectRatio =[parseInt(aspectRatio[0]), parseInt(aspectRatio[1])];
    savePuzzleFromAttrs(ACTIVE_FID, pid, title, aspectRatio, cropSize.width, cropSize.height);

    // Reload the puzzles to include the new entry
    await loadMainMenu();

    closePuzzleOverlay();
}

// @param dimensions - { width: integer, height: integer }
// @return [integer, integer] - A supported aspect ratio
function determineAspectRatio(dimensions) {
    const ratio = dimensions.width / dimensions.height;
    
    // Supported ratios
    // 2:3 = 0.66...
    // 3:4 = 0.75
    // 1:1 = 1
    // 4:3 = 1.33...
    // 3:2 = 1.5
    if (ratio <= .71) {
        return [2,3];
    } else if (ratio <= .875) {
        return [3,4];
    } else if (ratio <= 1.17) {
        return [1,1];
    } else if (ratio <= 1.42) {
        return [4,3];
    } else {
        return [3,2];
    }
}

function getDifficulties(aspectRatio) {
    let difficulties = {};

    const x = aspectRatio[0];
    const y = aspectRatio[1];

    // Support for these aspect ratios: 1:1, 3:2, 2:3, 4:3, 3:4
    if (x == 1 && y == 1) {
        difficulties[64] = "8x8";
        difficulties[100] = "10x10";
        difficulties[144] = "12x12";
        difficulties[256] = "16x16";
        difficulties[400] = "20x20";
        difficulties[576] = "24x24";
        difficulties[784] = "28x28";
        difficulties[1024] = "32x32";
    } else if (x == 3 && y == 2) {
        difficulties[54] = "9x6";
        difficulties[96] = "12x8";
        difficulties[150] = "15x10";
        difficulties[216] = "18x12";
        difficulties[294] = "21x14";
        difficulties[486] = "27x18";
        difficulties[726] = "33x22";
        difficulties[1014] = "39x26";
    } else if (x == 2 && y == 3) {
        difficulties[54] = "6x9";
        difficulties[96] = "8x12";
        difficulties[150] = "10x15";
        difficulties[216] = "12x18";
        difficulties[294] = "14x21";
        difficulties[486] = "18x27";
        difficulties[726] = "22x33";
        difficulties[1014] = "26x39";
    } else if (x == 4 && y == 3) {
        difficulties[48] = "8x6";
        difficulties[108] = "12x9";
        difficulties[192] = "16x12";
        difficulties[300] = "20x15";
        difficulties[432] = "24x18";
        difficulties[588] = "28x21";
        difficulties[768] = "32x24";
        difficulties[972] = "36x27";
    } else if (x == 3 && y == 4) {
        difficulties[48] = "6x8";
        difficulties[108] = "9x12";
        difficulties[192] = "12x16";
        difficulties[300] = "15x20";
        difficulties[432] = "18x24";
        difficulties[588] = "21x28";
        difficulties[768] = "24x32";
        difficulties[972] = "27x36";
    }

    return difficulties;
}

// @param canvas - HTML5 canvas
// @param dir - string - directory to save image in
async function saveCanvasToPng(canvas, dir, filename) {
    // Convert canvas to PNG blob
    const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

    // Create a new filehandle
    var newFile = await createFile(dir, filename);

    // Write the blob to file
    await writeFile(newFile, pngBlob);
}

function closePuzzleOverlay() {
    // Hide overlays
    document.getElementById("createPuzzleOverlay").classList.add("remove");
    hideOverlayCover();

    // Destroy cropper for resource cleanup
    destroyCropper();

    // Reset overlay components (reverse of step 1/2)
    document.getElementById("createPuzzleOverlay").classList.remove("createPuzzleOverlayTransition");
    document.getElementById("createPuzzleNameLabel").classList.remove("remove");
    document.getElementById("createPuzzleName").value = "";
    document.getElementById("createPuzzleTitle").innerText = "Name your new puzzle";
    document.getElementById("createPuzzleAspectRatioWrapper").classList.add("remove");

    document.getElementById("createPuzzlePreview").src = "#";
    document.getElementById("createPuzzlePreview").classList.add("createPuzzleThumbnail");
    document.getElementById("createPuzzlePreview").classList.remove("createPuzzlePreview");

    document.getElementById("createPuzzleNextButton").classList.remove("remove");
    document.getElementById("createPuzzleSaveButton").classList.add("remove");
}

// @param title - string
function formatTitle(title) {
    // Trim file type
    title = title.substring(0, title.lastIndexOf("."));

    // Replace some common filename separator characters with spaces for readability
    title = title.replaceAll(/[\_\-\.]/g, " ");

    // Proper case
    title = title.toLowerCase()
        .split(" ")
        .map((s) => s.charAt(0).toUpperCase() + s.substring(1))
        .join(" ");
    
    // Trim to 20 character limit
    title = title.substring(0, 20);

    return title.trim();
}

// @param id - string - DOM id
// @param show - boolean
function displayPage(id, show) {
    var page = document.getElementById(id);
    if (show) {
        page.style.display = "";
    }
    page.classList.remove(show ? "hidden" : "visible");
    page.classList.add(show ? "visible" : "hidden");

    // Wait 550ms for the CSS transition to complete, then run cleanup
    if (!show) {
        setTimeout(function() { page.style.display = "none"; }, 550);
    }
}

// @param pid - integer - puzzle ID
// @param dimensions - {x, y, width, height}
async function generatePuzzleImages(pid, dimensions) {
    // Get the user selected image
    const image = document.getElementById('createPuzzlePreview');

    // Verify passed dimensions against image size
    // Image cropper lib appears to have slight inaccuracies, maybe rounding or CSS-based
    // If width or height are within 10px of full size, change to full size
    if (Math.abs((dimensions.x + dimensions.width) - image.naturalWidth) <= 10) {
        dimensions.x = 0;
        dimensions.width = image.naturalWidth;
    }
    if (Math.abs((dimensions.y + dimensions.height) - image.naturalHeight) <= 10) {
        dimensions.y = 0;
        dimensions.height = image.naturalHeight;
    }

    // Create a canvas
    const canvas = document.createElement('canvas');

    // Set the canvas width and height
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    // Get the canvas context
    const ctx = canvas.getContext('2d');

    // Draw the image on the canvas
    ctx.drawImage(image, dimensions.x, dimensions.y, dimensions.width, dimensions.height, 0, 0, dimensions.width, dimensions.height);

    // Save the canvas as a png image
    const png1 = pid + ".png";
    await saveCanvasToPng(canvas, "puzzles", png1);

    // Set the canvas ratio to 1:1 for preview image
    var previewSize = Math.min(dimensions.width, dimensions.height);
    canvas.width = previewSize;
    canvas.height = previewSize;

    // Determine the shift for the larger dimension so the crop happens evenly on each side
    var dx, dy;
    if (dimensions.width < dimensions.height) {
        dx = 0;
        dy = (dimensions.height - dimensions.width) / 2;
    } else {
        dx = (dimensions.width - dimensions.height) / 2;
        dy = 0;
    }

    // Redraw the image for the new scale and source image crop dimensions
    ctx.drawImage(image, dimensions.x + dx, dimensions.y + dy, dimensions.width - (dx * 2), dimensions.height - (dy * 2), 0, 0, previewSize, previewSize);

    // Save the canvas as a base64 encoded image
    const png2 = pid + "preview.png";
    await saveCanvasToPng(canvas, "puzzles", png2)
}

function toggleDiskSpaceText() {
    var diskSpaceText = document.getElementById("diskSpaceText");
    diskSpaceText.style.display = diskSpaceText.style.display !== "inline" ? "inline" : "none";
}

function closeInfoOverlay() {
    document.getElementById("infoOverlayText").innerHTML = "";
    document.getElementById("infoOverlay").classList.add("remove");
}

function showOverlayCover() {
    document.getElementById("overlayCover").classList.remove("remove");
}

function hideOverlayCover() {
    document.getElementById("overlayCover").classList.add("remove");
}

function getRandomColor() {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// @param object - fabric.Object
function getAbsolutePosition(object, pos) {
    if (object.group) {
        // Groups use relative positioning for children. Oddly relative to the center of the group, a FabricJS choice.
        var matrix = object.group.calcTransformMatrix();
        var point = object.getPointByOrigin(pos.charAt(1) == 'l' ? 'left' : 'right', pos.charAt(0) == 't' ? 'top' : 'bottom');
        // TODO: Do we need to transformPoint() point by the object.calcTransformMatrix() first? Needs deeper snap testing
        var pointOnCanvas = fabric.util.transformPoint(point, matrix);
        return pointOnCanvas;
    }
    return object.aCoords[pos];
}

// Try to keep the board view (BOARD.width/BOARD.height) view within pan boundaries (BOARD.panWidth/BOARD.panHeight). 
// At widest zoom levels, depending on the puzzle and window ratios, the width or height may be completely in view. 
// If so, balance the "blank" (unusable) space between top/bottom or left/right.
// 
// EX: If zooming out while mouse is in the [0,0] corner, user should never see to the left or 
//     above [0,0]. So adjust the "center" of the view to keep the edge at [0,0] as long as possible.
//     At zoom levels showing entire width or height, we will start showing below [0,0].
function respectBoardPanBoundaries(event) {
    // var vpt = this.viewportTransform;
    // var vpb = BOARD.calcViewportBoundaries();
    // var pAbs = BOARD.getPointer(event, true);
    // var pRel = BOARD.getPointer(event, false);
    
    // vpt[4] = x coord
    // vpt[5] = y coord
    // BOARD.backgroundImage = the "pan board" rectangle, maybe its coords can help determine if shifting x/y is needed
    // TODO: Determine if any visible point of the board is outside BOARD.panWidth/BOARD.panHeight
}

function respectZoomMinMax(zoom) {
    let puzzle = BOARD.puzzle;
    let ratio = Math.sqrt((puzzle.width * puzzle.height) / (BOARD.getWidth() * BOARD.getHeight()));
    let min = .25/ratio;
    let max = 3/ratio;

    if (zoom > max) {
        zoom = max;
    } else if (zoom < min) {
        zoom = min;
    }
    return zoom;
}

// Decimal percent to zoom, must be between .25 and 3
function zoomTo(percent) {
    let puzzle = BOARD.puzzle;
    let ratio = Math.sqrt((puzzle.width * puzzle.height) / (BOARD.getWidth() * BOARD.getHeight()));
    let zoom = percent/ratio;
    
    return respectZoomMinMax(zoom);
}

function configureBoardEvents() {
    BOARD.on('mouse:wheel', function(opt) {
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
    });
    BOARD.on('mouse:down', function(opt) {
        var evt = opt.e;

        // If there is no target
        if (!opt.target) {
            if (opt.shiftKey) {
                // Start multi-select area
                this.selection = true;
            } else {
                // Drag the board
                this.isDragging = true;
                this.selection = false;
                this.lastPosX = evt.clientX;
                this.lastPosY = evt.clientY;
            }
        } else if (opt.target) {
            // Left click - Pick up piece
            if (evt.which == 1) {
                // Initiate a shadow object
                opt.target._shadow = opt.target.shadow;     // Save original shadow

                if (opt.target.isType("group")) {
                    opt.target.getObjects().forEach(function(c) { c.shadow = undefined; });
                }

                var shadow = new fabric.Shadow({
                    color: "black",
                    blur: 4,
                    offsetX: 50,
                    offsetY: 50,
                });
                opt.target.shadow = shadow;
                BOARD.renderAll();
            }

            // Right click - Zoom piece
            if (evt.which == 3 && !BOARD._zoomTarget) {
                // Save the zoom target so it can unzoom even if not the target when right click is released
                BOARD._zoomTarget = opt.target;

                // Assure it'll be the front object for viewing
                opt.target.bringToFront();

                // Determine the scale which will allow the object to zoom to 80% of the board size
                if (BOARD.width > BOARD.height) {
                    var boundingRectFactor = opt.target.getBoundingRect(false).height / opt.target.getScaledHeight();
                    opt.target._maxScale = (BOARD.height * .8) / opt.target.height / boundingRectFactor;
                } else {
                    var boundingRectFactor = opt.target.getBoundingRect(false).width / opt.target.getScaledWidth();
                    opt.target._maxScale = (BOARD.width * .8) / opt.target.width / boundingRectFactor;
                }

                animatePath(opt.target, 'scaleX', opt.target._maxScale, 500, true, function(path) {
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
    });
    BOARD.on('mouse:move', function(opt) {
        if (this.isDragging) {
            var e = opt.e;
            var vpt = this.viewportTransform;
            vpt[4] += e.clientX - this.lastPosX;
            vpt[5] += e.clientY - this.lastPosY;
            
            respectBoardPanBoundaries(e);            
            
            this.requestRenderAll();
            this.lastPosX = e.clientX;
            this.lastPosY = e.clientY;
        }
    });
    BOARD.on('mouse:up', function(opt) {
        var evt = opt.e;

        // On mouse up recalculate new interaction for all objects, so call setViewportTransform
        this.setViewportTransform(this.viewportTransform);
        this.isDragging = false;
        this.selection = false;

        // Left click - Drop piece
        if (opt.target && evt.which == 1) {
            opt.target.shadow = opt.target._shadow;
            opt.target._shadow = undefined;
            snapPathOrGroup(opt.target);
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
    });
    BOARD.on('mouse:over', function(opt) {
        BOARD.overTarget = opt.target;
    });
    BOARD.on('mouse:out', function(opt) {
        BOARD.overTarget = undefined;
    });
    
    window.addEventListener("keydown", function(e) {
        // Rotate piece
        if (BOARD.orientation > 0 && e.key == "Alt" && BOARD.overTarget) {
            // Grab a reference immediately since mouse:out can detach target during animation
            let target = BOARD.overTarget;
            if (!target.rotationInProgress) {
                target.rotationInProgress = true; // Toggled off at the end of resetOrigin when the animation has finished
                let angle = BOARD.orientation == 1 ? 180 : 90;
                animatePath(target, 'angle', target.angle + angle, 250, true, undefined, function(path, curAngle) {
                    const pivot = path.translateToOriginPoint(path.getCenterPoint(), path._originX, path._originY);
                    path.angle = curAngle;
                    path.setPositionByOrigin(pivot, path._originX, path._originY);
                }, function(path) {
                    path.straighten();
                    path.rotationInProgress = false;
                    snapPathOrGroup(path);
                });
            }
        }

        // Disable certain browser key shortcuts during active puzzle play.
        if (BOARD && e.key == "Alt") {
            e.preventDefault();
        }
    });
}

function setZoomPosition(path, curValue) {
    // Center the piece as zoom occurs
    let per = (curValue - path._zoomScale)/(path._maxScale - path._zoomScale);
    let endX = BOARD.getVpCenter().x - (path.getScaledWidth() / 2);
    let endY = BOARD.getVpCenter().y - (path.getScaledHeight() / 2);
    if ((path.angle) % 360 == 0) {
        // Nothing additional to do
    } else if ((path.angle) % 360 == 90) {
        endX += path.getScaledWidth();
    } else if ((path.angle) % 360 == 180) {
        endX += path.getScaledWidth();
        endY += path.getScaledHeight();
    } else { // 270
        endY += path.getScaledHeight();
    }
    path.left = ((1-per) * path._zoomLeft) + (per * endX);
    path.top = ((1-per) * path._zoomTop) + (per * endY);
}

function centerOfPiece(path) {
    let tl = getPathPoint(path, 'tl');
    let tr = getPathPoint(path, 'tr');
    let br = getPathPoint(path, 'br');
    let bl = getPathPoint(path, 'bl');

    // (min + max) / 2
    return new fabric.Point(
        (Math.min(tl.x, tr.x, br.x, bl.x) + Math.max(tl.x, tr.x, br.x, bl.x)) / 2,
        (Math.min(tl.y, tr.y, br.y, bl.y) + Math.max(tl.y, tr.y, br.y, bl.y)) / 2);
}

// @param pos - string - (tl|tr|br|bl)
function getPathPoint(path, pos) {
    // Top of piece always starts with an entry point, 'M 100 100'. Others may be lines or a triplet of bezier curves.
    switch (pos) {
        case 'tl':
            let tl = path.piece.top.split(" ", 3);
            return new fabric.Point(tl[1], tl[2]);
        case 'tr':
            let tr = path.piece.top.split(" ");
            return new fabric.Point(tr[tr.length - 2], tr[tr.length - 1]);
        case 'br':
            let br = path.piece.right.split(" ");
            return new fabric.Point(br[br.length - 2], br[br.length - 1]);
        case 'bl':
            let bl = path.piece.bottom.split(" ");
            return new fabric.Point(bl[bl.length - 2], bl[bl.length - 1]);
        default:
            throw new Error("getPathPoint(path, pos): Unsupported position (" + pos + ")");
    }
}

function snapPathOrGroup(target) {
    target.setCoords();
        
    if (target.isType("path")) {
        snapPiece(target);
    } else if (target.isType("group")) {
        for (let obj of target.getObjects()) {
            snapPiece(obj);
        }
    }
}

function snapPiece(path) {
    // Consider the adjascent pieces that could be snapped to
    let aPiece = path.piece;
    // Above
    if (aPiece.row > 0) {
        let above = BOARD.pieces[aPiece.row - 1][aPiece.col];
        if (snap(path, above.object, "t")) {
            return;
        }
    }
    // Below
    if (aPiece.row < BOARD.pieces.length - 1) {
        let below = BOARD.pieces[aPiece.row + 1][aPiece.col];
        if (snap(path, below.object, "b")) {
            return;
        }
    }
    // Left
    if (aPiece.col > 0) {
        let left = BOARD.pieces[aPiece.row][aPiece.col - 1];
        if (snap(path, left.object, "l")) {
            return;
        }
    }
    // Right
    if (aPiece.col < BOARD.pieces[0].length - 1) {
        let right = BOARD.pieces[aPiece.row][aPiece.col + 1];
        if (snap(path, right.object, "r")) {
            return;
        }
    }
}

function getPathAngle(a) {
    if (a.group) {
        // Angle doesn't change after entering group. So need to combine with group angle to get current angle.
        return a.angle + a.group.angle;
    }
    return a.angle;
}

// @param a - fabric.Object - (Path or Group)
// @param b - fabric.Object - (Path or Group)
// @param dir - string - ("t"|"r"|"b"|"l") directions
// @return boolean - true if snap was successful
function snap(a, b, dir) {
    // If both pieces are in the same group, already snapped
    if (a.group && b.group && a.group == b.group) {
        return;
    }

    // If they are not rotated in the same direction, cannot snap
    if (getPathAngle(a) % 360 != getPathAngle(b) % 360) {
        return;
    }

    //console.log(dir);

    // Get the relative positioning of the two points at their origin and current position
    var aOrigPoint = a.originalCoords.tl;
    var bOrigPoint = b.originalCoords.tl;
    let origDiff = [aOrigPoint.x - bOrigPoint.x, aOrigPoint.y - bOrigPoint.y];
    //console.log("origDiff: [" + aOrigPoint.x + " - " + bOrigPoint.x + ", " + aOrigPoint.y + " - " + bOrigPoint.y + "]");

    // The paths may be in groups now, so cannot use aCoords as those are relative to the center of a group... odd FabricJS choice
    let aPoint = getAbsolutePosition(a, 'tl');
    let bPoint = getAbsolutePosition(b, 'tl');
    let curDiff = [aPoint.x - bPoint.x, aPoint.y - bPoint.y];
    //console.log("curDiff: [" + aPoint.x + " - " + bPoint.x + ", " + aPoint.y + " - " + bPoint.y + "]");

    // Compare the relative positioning to determine if they are within snap range
    let aPathAngle = getPathAngle(a);
    let xDiff, yDiff;
    if (aPathAngle % 360 == 0) {
        xDiff = curDiff[0] - origDiff[0];
        yDiff = curDiff[1] - origDiff[1];
    } else if (aPathAngle % 360 == 90) {
        xDiff = curDiff[1] - origDiff[0];
        yDiff = curDiff[0] + origDiff[1];
    } else if (aPathAngle % 360 == 180) {
        xDiff = curDiff[0] + origDiff[0];
        yDiff = curDiff[1] + origDiff[1];
    } else { // 270
        xDiff = curDiff[1] + origDiff[0];
        yDiff = curDiff[0] - origDiff[1];
    }
    //console.log("xDiff/yDiff: " + xDiff + "/" + yDiff);

    if (Math.abs(xDiff) <= BOARD.snap && Math.abs(yDiff) <= BOARD.snap) {
        //console.log("SNAPPED!");
        // Shift A exactly into place, as A is the piece being moved. If A is in a group, shift the group.
        // TODO: May need to shift B instead in some cases
        if (a.group) {
            if (aPathAngle % 360 == 0 || aPathAngle % 360 == 180) {
                a.group.left -= xDiff;
                a.group.top -= yDiff;
            } else {
                a.group.left -= yDiff;
                a.group.top -= xDiff;
            }
            a.group.setCoords();
        } else {
            if (aPathAngle % 360 == 0 || aPathAngle % 360 == 180) {
                a.left -= xDiff;
                a.top -= yDiff;
            } else {
                a.left -= yDiff;
                a.top -= xDiff;
            }
            a.setCoords();
        }

        updateGroups(a, b);
        return true;
    }
    return false;
}

function updateGroups(a, b) {
    // Merge or create a piece group so snapped pieces move together
    if (!a.group && !b.group) {
            
        // Determine the minimum point between the two pieces for placement of the new group
        let point = getMinimumPoint(a, b);
        
        // Save the angle to set it back on the new group
        let saveRotation = getPathAngle(a);

        // Reset the pieces and create a new group
        BOARD.remove(a);
        BOARD.remove(b);

        let objs = [a, b];
        for (obj of objs) {
            obj.rotate(0);
            obj.left = obj.originalCoords.tl.x;
            obj.top = obj.originalCoords.tl.y;
        }

        var group = new fabric.Group(objs, {});
        group.hasBorders = false;
        group.hasControls = false;
        group.lockRotation = true;
        group.lockScalingX = true;
        group.lockScalingY = true;
        group.perPixelTargetFind = true;
        group._originX = 0.5;
        group._originY = 0.5;

        a.group = group;
        b.group = group;

        // Set the angle back on the new group
        group.angle = saveRotation;

        // Now that objects have been added and rotation handled, set the position of the group
        if (saveRotation == 0) {
            group.left = point[0];
            group.top = point[1];
        } else if (saveRotation == 90) {
            group.left = point[0] + group.height;
            group.top = point[1];
        } else if (saveRotation == 180) {
            group.left = point[0] + group.width;
            group.top = point[1] + group.height;
        } else if (saveRotation == 270) {
            group.left = point[0];
            group.top = point[1] + group.width;
        }

        BOARD.add(group);
        setGroupShadow(group);
    } else if (a.group && !b.group) {
        BOARD.remove(b);
        let group = a.group;
        b.group = group;
        group.addWithUpdate(b);
        setGroupShadow(group);
    } else if (!a.group && b.group) {
        BOARD.remove(a);
        let group = b.group;
        a.group = group;
        group.addWithUpdate(a);
        setGroupShadow(group);
    } else {
        // Determine the minimum point between the two groups for placement of the new combined group
        let point = getMinimumPoint(a.group, b.group);

        // Save the angle to set it back on the new group
        let saveRotation = getPathAngle(a);

        // Both have groups, reset the pieces and create a new combined group
        BOARD.remove(a.group);
        BOARD.remove(b.group);
        
        let objs = [...a.group.getObjects(), ...b.group.getObjects()];
        for (obj of objs) {
            obj.rotate(0);
            obj.left = obj.originalCoords.tl.x;
            obj.top = obj.originalCoords.tl.y;
        }
        
        var group = new fabric.Group(objs, {});
        group.hasBorders = false;
        group.hasControls = false;
        group.lockRotation = true;
        group.lockScalingX = true;
        group.lockScalingY = true;
        group.perPixelTargetFind = true;
        group._originX = 0.5;
        group._originY = 0.5;

        for (obj of objs) {
            obj.group = group;
        }
        
        // Set the angle back on the new group
        group.angle = saveRotation;

        // Now that objects have been added and rotation handled, set the position of the group
        if (saveRotation == 0) {
            group.left = point[0];
            group.top = point[1];
        } else if (saveRotation == 90) {
            group.left = point[0] + group.height;
            group.top = point[1];
        } else if (saveRotation == 180) {
            group.left = point[0] + group.width;
            group.top = point[1] + group.height;
        } else if (saveRotation == 270) {
            group.left = point[0];
            group.top = point[1] + group.width;
        }

        BOARD.add(group);
        setGroupShadow(group);
    }
}

function setGroupShadow(group) {
    // Remove individual piece shadows
    group.getObjects().forEach(function(c) {
        c.shadow = undefined;
    });
    
    // Give the group a bit of 3D look
    var shadow = new fabric.Shadow({
        color: "black",
        blur: 3,
        offsetX: 8,
        offsetY: 8,
    });
    group.shadow = shadow;
}

// Returns the absulute top left point, regardless of rotation.
function getMinimumPoint(a, b) {
    let aC = a.aCoords;
    let bC = b.aCoords;
    let minX = Math.min(aC.tl.x, aC.tr.x, aC.br.x, aC.bl.x, bC.tl.x, bC.tr.x, bC.br.x, bC.bl.x);
    let minY = Math.min(aC.tl.y, aC.tr.y, aC.br.y, aC.bl.y, bC.tl.y, bC.tr.y, bC.br.y, bC.bl.y);

    console.log("min[" + minX + "," + minY + "]");

    return [minX, minY];
}

// @param id - string - puzzle ID
// @param difficulty - string - dimensions chosen - EX: "24x32"
// @param orientation - integer - 0=no rotation, 1=north/south, 2=cardinal rotation
async function startPuzzle(id, difficulty, orientation) {
    const filename = id + ".png";
    const png = await readFile("puzzles", filename);
    const img = new Image();
    img.src = URL.createObjectURL(png);

    img.onload = () => {
        let puzzle = getPuzzle(ACTIVE_FID, id);
        let rowscols = difficulty.split("x");
        let generator = new PuzzleGenerator(puzzle, parseInt(rowscols[1]), parseInt(rowscols[0]));
        let pieces = generator.generatePieces();

        // Performance optimization suggested by Chrome devtools
        // TODO: May not be needed, may be triggered by my Dark Reader browser extension being active on the site.
        let canvas = document.getElementById('board');
        canvas.willReadFrequently = true;
        canvas.getContext('2d', { willReadFrequently: true });

        BOARD = new fabric.Canvas('board', {
            fireRightClick: true,
            fireMiddleClick: true,
            stopContextMenu: true,
        });
        BOARD.puzzle = puzzle;
        BOARD.pieces = pieces;
        BOARD.setWidth(window.innerWidth - 20);
        BOARD.setHeight(window.innerHeight - 80);
        BOARD.panWidth = puzzle.width * 3;
        BOARD.panHeight = puzzle.height * 3;
        BOARD.snap = (generator.width / generator.xn) * .25; // X and Y equal due to supported aspect ratios
        BOARD.orientation = orientation;
        BOARD.selection = false;
        BOARD.altSelectionKey = "ctrlKey";

        // TODO: Temp border for testing pan restriction movement, remove it
        var bg = new fabric.Rect({ width: BOARD.panWidth, height: BOARD.panHeight, stroke: 'pink', strokeWidth: 10, fill: '', evented: false, selectable: false });
        bg.fill = new fabric.Pattern(
            { source: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAASElEQVQ4y2NkYGD4z0A6+M3AwMBKrGJWBgYGZiibEQ0zIInDaCaoelYyHYcX/GeitomjBo4aOGrgQBj4b7RwGFwGsjAwMDAAAD2/BjgezgsZAAAAAElFTkSuQmCC' },
            function() { bg.dirty = true; BOARD.requestRenderAll() });
        bg.canvas = BOARD;
        BOARD.backgroundImage = bg;

        // Set a wide initial zoom to see puzzle image and then shuffle take place
        let zoom = zoomTo(.4);
        BOARD.setZoom(zoom);

        // Creates a board with all the pieces and the background
        for (let r = 0; r < generator.yn; r++) {
            for (let c = 0; c < generator.xn; c++) {
                let piece = pieces[r][c];
                const paths = piece.top + " " + piece.right + " " + piece.bottom + " " + piece.left;
                let path = new fabric.Path(paths);
                path.hasBorders = false;
                path.hasControls = false;
                path.stroke = "black";
                // TODO: Knock down the width for smaller resolution photos that choose a lot of pieces.
                // So maybe based on Path size?
                path.strokeWidth = 3;
                path.lockRotation = true;
                path.lockScalingX = true;
                path.lockScalingY = true;
                path.perPixelTargetFind = true;

                // Locking user movement until shuffling completes
                //path.lockMovementX = true;
                //path.lockMovementY = true;

                // Set the image as the background
                let pattern = new fabric.Pattern({
                    source: img,
                    repeat: "no-repeat"
                });
                pattern.offsetX = 0 - path.left;
                pattern.offsetY = 0 - path.top;
                path.set("fill", pattern);

                // Give the pieces a bit of 3D look
                var shadow = new fabric.Shadow({
                    color: "black",
                    blur: 3,
                    offsetX: 8,
                    offsetY: 8,
                });
                path.shadow = shadow;

                path.piece = piece;
                piece.object = path;
                BOARD.add(path);

                path.originalCoords = {...path.aCoords};

                // Calculate the offset for the center of the piece vs the bounding box.
                // This will be used to set the animation rotation point for the piece
                let boundingCenter = path.getCenterPoint();
                let pieceCenter = centerOfPiece(path);
                let centerOffset = new fabric.Point(pieceCenter.x - boundingCenter.x, pieceCenter.y - boundingCenter.y);
                path._originX = 0.5 + (centerOffset.x / path.width);
                path._originY = 0.5 + (centerOffset.y / path.height);
            }
        }

        // Show the drawn puzzle for 3 seconds and then shuffle to start the game
        setTimeout(function() {
            configureBoardEvents();
            //shufflePieces();
        }, 3000);
    };
}

function animatePath(path, prop, endPoint, duration, render, onBeforeFunc, onChangeFunc, onCompleteFunc) {
    if (onBeforeFunc) {
        onBeforeFunc(path);
    }

    fabric.util.animate({
        startValue: path[prop],
        endValue: endPoint,
        duration: duration,
        onChange: function(value) {
            if (onChangeFunc) {
                onChangeFunc(path, value);
            }

            path[prop] = value;
            if (render) {
                // Only one path object being animated will control canvas refresh for optimal performance
                BOARD.renderAll();
            }
        },
        onComplete: function() {
            if (onCompleteFunc) {
                onCompleteFunc(path);
            }

            // Register the coordinates so the user can start interacting
            path.setCoords();
        }
    });
}

function shufflePieces() {
    let puzzle = BOARD.puzzle;
    let pieces = BOARD.pieces;

    for (let r = 0; r < pieces.length; r++) {
        const cols = pieces[r].length;
        for (let c = 0; c < cols; c++) {
            let piece = pieces[r][c];
            let path = piece.object;
            const render = (r == pieces.length - 1) && (c == cols - 1);

            // Randomize piece placement across visible board space, margin of 100px
            const buf = 300;
            const top = Math.floor(Math.random() * ((2 * puzzle.height) - (2 * buf)) + buf);
            const left = Math.floor(Math.random() * ((2 * puzzle.width) - (2 * buf)) + buf);
            animatePath(path, 'top', top, 2000, render);
            animatePath(path, 'left', left, 2000, render);
            if (BOARD.orientation > 0) {
                let angles = BOARD.orientation == 1 ? [0, 180] : [0, 90, 180, 270];
                const randomIndex = Math.floor(Math.random() * angles.length);
                animatePath(path, 'angle', angles[randomIndex] * Math.floor(Math.random() * 4), 2000, render, undefined, undefined, function(path) { 
                    path.straighten(); 
                            
                    // Unlock the path to allow user movement
                    path.lockMovementX = false;
                    path.lockMovementY = false;
                });
            }
        }
    }
}

class PuzzlePiece {
    // DOM Element ID for this piece
    id;

    // Integers representing this piece's location within the puzzle
    row; col;

    // Path2D strings representing a side of this piece
    top; right; bottom; left;

    // The fabric Path object representing this piece
    object;

    constructor(id, row, col) {
        this.id = id;
        this.row = row;
        this.col = col;
    }
}

class PuzzleGenerator {
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

    // Internals for edge generation; cubic bezier curves generation
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