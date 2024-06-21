// Priority TODOs
// * Create the game board and initialize the pieces
// * Initial play functionality (snap pieces, rotate pieces, puzzle image for reference, zoom, buckets, sound on/off)
// * Controls: left click+drag = move, right click = zoom on piece, left click+alt = rotate, ctrl+left click = multi-select pieces, shift+left click + drag = multi-select pieces in area
// * Implement import and export buttons (Export to zip, import from zip)
// * Icons for main menu buttons (create buzzle, create folder, delete, return home, move puzzle home) to go with the text
// * Add a Rename button 
// * Create a help menu (describes controls; drag and drop and mouse/keys for when playing)
// * Create a first pass at stat tracking
// * Advanced play options - auto-sorting by shape/color onto board or into buckets
// * Add handling of filesystem.js exceptions so that menu's continue to load if a file is missing and that an error is raised if a failure happens saving any of the images during puzzle creation
// * BUG: Determine why fade out for pages works, but fade in happens fast. Maybe try non-CSS opacity fade, display none, display, opacity reveal
// * Add loading message for puzzle creation (and maybe other areas like waiting on puzzle images)
// * Simplify/clean up CSS. Like display: individual none/inline's using .remove and .add instead
// * Consider using inline HTML format to create objects instead of separate lines for each attribute.
//       Or find ways to reduce attribute setting. Maybe remove IDs that are identical to class name and look up object by class

// Tracks the active folder for the puzzle menu
var ACTIVE_FID = "root";

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
        "TIP: To rotate a piece, left click and hold to pick the piece up. Then hit the [Alt] key to rotate.";
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
    const orientation = playOverlay.querySelector(".orientationSelect").value;

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
    savePuzzleFromAttrs(ACTIVE_FID, pid, title, aspectRatio);

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
    ctx.drawImage(image, dimensions.x, dimensions.y, dimensions.width, dimensions.height);

    // Save the canvas as a png image
    //var imageBase64 = canvas.toDataURL('image/png');
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
    //var imagePreviewBase64 = canvas.toDataURL('image/png');
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

// @param id - string - puzzle ID
// @param difficulty - string - dimensions chosen - EX: "24x32"
// @param orientation - integer - 0=no rotation, 1=north/south, 2=cardinal rotation
function startPuzzle(id, difficulty, orientation) {
    // TODO: prepare the board, build the pieces, spread them out on the board
}