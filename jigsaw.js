// Priority TODOs
// * Code cleanup - ES6 pass and split out sections to different files where possible. This file is getting too large.
// * Icons for main menu buttons (create buzzle, create folder, delete, return home, move puzzle home) to go with the text
// * Create a help menu (describes controls; drag and drop and mouse/keys for when playing)
// * Auto save board state for continuing later
// * Create a first pass at stat tracking
// * Add handling of filesystem.js exceptions so that menu's continue to load if a file is missing and that an error is raised if a failure happens saving any of the images during puzzle creation
// * Add a Rename button 
// * Advanced play options - auto-sorting by shape/color onto board or into buckets
// * Add loading message for puzzle creation (and maybe other areas like waiting on puzzle images)
// * Simplify/clean up CSS. Like display: individual none/inline's using .remove and .add instead
// * Consider using inline HTML format to create objects instead of separate lines for each attribute.
//       Or find ways to reduce attribute setting. Maybe remove IDs that are identical to class name and look up object by class
// * Puzzle piece CSS; Look into custom filter to warp the piece image around the edge
// * Work more on pan aspect ratio. Consider if it should be based on board instead of puzzle image
// * Puzzle buckets to sort pieces into. Common with doing physical puzzles, but have limited necessity in digital due to ease of stacking pieces vertically

// Tracks the active folder for the puzzle menu
var ACTIVE_FID = "root";

// Tracks the singleton FabricJS canvas object used for rendering the play board
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
        BOARD.setHeight(window.innerHeight - 20);

        if (isOverlayCover()) {
            document.getElementById("overlayCover").click();
        }
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

// @param menuItem - DOM object - menu item DIV
// @param event - DOM Event
function menuItemClick(menuItem, event){
    audio('click');

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
        // TODO: If this puzzle has a saved game, ask if they want to start it instead of showing the overlay
        loadPlayOverlay(menuItem, event);
    }
}

// @param menuItem - DOM object - menu item DIV
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

// @param menuItem - DOM object - menu item DIV
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

// @param id - string - Puzzle or folder ID
// @param title - string - Title of the stored puzzle or folder
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

// @param buttonId - string - ID of the DOM object button
// @param textField - DOM object - INPUT text field with name of puzzle of folder
// @param event - DOM Event
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
    showOverlayCover(closeFolderOverlay);
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

// @param difficulty - DOM object - DIV representing user selected difficulty
function playOverlayDifficultyClick(difficulty) {
    audio('click');

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

// @param orientationSelect - DOM Object - SELECT representing user selected orientation setting
function playOverlayOrientationSelectChange(orientationSelect) {
    audio('click');

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

// @param playButton - DOM Object - BUTTON starting play of a puzzle
function playOverlayPlayButtonClick(playButton) {
    audio('click');

    // Capture the user's play selections
    let playOverlay = playButton.parentElement;
    const puzzleId = playOverlay.id.substring(1);
    const difficulty = playOverlay.querySelector(".playOverlayDifficultySelected").id;
    const orientation = parseInt(playOverlay.querySelector(".orientationSelect").value);

    hideOverlayCover();
    playOverlay.remove();

    // Transition to the create puzzle page
    displayPage("page1", false, false);
    setTimeout(function(){
        displayPage("page2", true, false);
        startPuzzle(puzzleId, difficulty, orientation);
    }, 600);
}

function playOverlayCancelButtonClick() {
    audio('click');
    hideOverlayCover();
    document.getElementById("cancelPlayButton").parentElement.remove();
}

// @param menuItem - DOM object - menu item DIV
// @param event - DOM Event
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
    cancelButton.id = "cancelPlayButton";
    playOverlay.appendChild(cancelButton);

    // Render the play overlay
    document.body.appendChild(playOverlay);

    // Transition to the centered play overlay. Must be delayed for playOverlay to be drawn on screen or animations won't trigger.
    setTimeout(function() {
        // Bring up the overlay cover
        showOverlayCover(playOverlayCancelButtonClick);
        
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
    // Prompt user to choose an image
    document.getElementById("fileOpener").click();
}

// @param fileOpener - DOM Object - INPUT tracking user selected local puzzle image
function fileOpenerChange(fileOpener) {
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

        // Show the overlays and reset the input
        showOverlayCover(closePuzzleOverlay);
        document.getElementById("createPuzzleOverlay").classList.remove("remove");
        fileOpener.value = '';

        // Change focus to the name input
        setTimeout(function() { createPuzzleName.focus(); }, 50);
    }
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

// @param aspectRatio - [integer, integer] - Aspect ratio of chosen puzzle
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
// @param filename - string - filename to use when saving the image
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

// @param title - string - user provided title of puzzle or folder
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
// @param show - boolean - true if the page represented by the pased id should be visible
// @param showHeader - boolean - true if the DOM objects above the page DIV should be visible
function displayPage(id, show, showHeader) {
    var page = document.getElementById(id);
    if (show) {
        page.style.display = "";
    }
    page.classList.remove(show ? "hidden" : "visible");
    page.classList.add(show ? "visible" : "hidden");

    // Header objects
    let title = document.getElementById("title");
    let diskSpace = document.getElementById("diskSpace");
    let exp = document.getElementById("export");
    let imp = document.getElementById("import");
    if (showHeader) {
        title.classList.remove("remove");
        diskSpace.classList.remove("remove");
        exp.classList.remove("remove");
        imp.classList.remove("remove");
    } else {
        title.classList.add("remove");
        diskSpace.classList.add("remove");
        exp.classList.add("remove");
        imp.classList.add("remove");
    }

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

// @param onclickFunc - JS function - function to be executed upon overlay cover click
function showOverlayCover(onclickFunc) {
    let cover = document.getElementById("overlayCover");
    cover.classList.remove("remove");
    if (onclickFunc) {
        cover.onclick = onclickFunc;
    }
}

function hideOverlayCover() {
    let cover = document.getElementById("overlayCover");
    cover.classList.add("remove");
    cover.onclick = null;
}

function isOverlayCover() {
    return !document.getElementById("overlayCover").classList.contains("remove");
}

function getRandomColor() {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// @param object - fabric.Object - puzzle piece
// @param pos - string - (tl|tr|br|bl)
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
// @param event - Event
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

// @param zoom - number - zoom value looking to be set
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
// @param percent - number
function zoomTo(percent) {
    let puzzle = BOARD.puzzle;
    let ratio = Math.sqrt((puzzle.width * puzzle.height) / (BOARD.getWidth() * BOARD.getHeight()));
    let zoom = percent/ratio;
    
    return respectZoomMinMax(zoom);
}

function ctrlSelectionDrop() {
    if (BOARD.ctrlSelectionObjects.length > 0) {
        // Drop the selected pieces
        audio('down');
        for (let obj of BOARD.ctrlSelectionObjects) {
            let pieces = (obj.isType('path') ? [obj] : obj.getObjects());
            for (let piece of pieces) {
                piece.set('stroke', piece._stroke);
                piece.set('strokeWidth', piece._strokeWidth);
                piece._stroke = undefined;
                piece._strokeWidth = undefined;
            }
            //snapPathOrGroup(obj);  // TODO: Should we do this like we do for single drop? Could trigger multiple snap sounds
        }
        BOARD.renderAll();
    }

    BOARD.ctrlSelection = false;
    BOARD.ctrlSelectionObjects = [];
}

// @param path - fabric.Path - the piece being zoomed into
// @param curValue - number - the animated path attribute's current value
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

// @param path - fabric.Path - the piece being zoomed into
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

// @param path - fabric.Path - the piece being zoomed into
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

// @param target - fabric.Path|fabric.Group - Object user interacting with to check for adjacent piece
function snapPathOrGroup(target) {
    target.setCoords();
    
    let snapped = false;
    if (target.isType("path")) {
        snapped = snapPiece(target);
    } else if (target.isType("group")) {
        for (let obj of target.getObjects()) {
            snapped |= snapPiece(obj);
        }
    }

    if (snapped) {
        audio('snap');

        if (BOARD.getObjects().length == 1) {
            // Stop and clear out auto-save. Then do victory animation.
            clearInterval(BOARD.interval);
            clearAutoSave();
            victoryCelebration();
        }
    }
}

// @param path - fabric.Path - piece to be considered for snapping
function snapPiece(path) {
    // Consider the adjascent pieces that could be snapped to
    let aPiece = path.piece;
    // Above
    if (aPiece.row > 0) {
        let above = BOARD.pieces[aPiece.row - 1][aPiece.col];
        if (snap(path, above.object, "t")) {
            return true;
        }
    }
    // Below
    if (aPiece.row < BOARD.pieces.length - 1) {
        let below = BOARD.pieces[aPiece.row + 1][aPiece.col];
        if (snap(path, below.object, "b")) {
            return true;
        }
    }
    // Left
    if (aPiece.col > 0) {
        let left = BOARD.pieces[aPiece.row][aPiece.col - 1];
        if (snap(path, left.object, "l")) {
            return true;
        }
    }
    // Right
    if (aPiece.col < BOARD.pieces[0].length - 1) {
        let right = BOARD.pieces[aPiece.row][aPiece.col + 1];
        if (snap(path, right.object, "r")) {
            return true;
        }
    }

    return false;
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
// @return boolean - true if snap was successful
function snap(a, b) {
    // If both pieces are in the same group, already snapped
    if (a.group && b.group && a.group == b.group) {
        return;
    }

    // If they are not rotated in the same direction, cannot snap
    if (getPathAngle(a) % 360 != getPathAngle(b) % 360) {
        return;
    }

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

// @param a - fabric.Path|fabric.Group
// @param b - fabric.Path|fabric.Group
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

// @param group - fabric.Group
function setGroupShadow(group) {
    // Remove individual piece shadows
    group.getObjects().forEach(function(c) {
        c.shadow = undefined;
    });
    
    // Give the group a bit of 3D look
    var shadow = new fabric.Shadow({
        color: "black",
        blur: 3,
        offsetX: BOARD._shadow,
        offsetY: BOARD._shadow,
    });
    group.shadow = shadow;
}

// Returns the absolute top left point, regardless of rotation.
// @param a - fabric.Path|fabric.Group
// @param b - fabric.Path|fabric.Group
function getMinimumPoint(a, b) {
    let aC = a.aCoords;
    let bC = b.aCoords;
    let minX = Math.min(aC.tl.x, aC.tr.x, aC.br.x, aC.bl.x, bC.tl.x, bC.tr.x, bC.br.x, bC.bl.x);
    let minY = Math.min(aC.tl.y, aC.tr.y, aC.br.y, aC.bl.y, bC.tl.y, bC.tr.y, bC.br.y, bC.bl.y);

    //console.log("min[" + minX + "," + minY + "]");

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
            width: window.innerWidth - 20,
            height: window.innerHeight - 20,
        });
        BOARD.id = id;
        BOARD.puzzle = puzzle;
        BOARD.pieces = pieces;
        BOARD.panWidth = puzzle.width * 3;
        BOARD.panHeight = puzzle.height * 3;
        BOARD.snap = (generator.width / generator.xn) * .25; // X and Y equal due to supported aspect ratios
        BOARD.orientation = orientation;
        BOARD.selection = false;
        //BOARD.altSelectionKey = "ctrlKey";
        BOARD.ctrlSelection = false;
        BOARD.ctrlSelectionDrag = false;
        BOARD.ctrlSelectionObjects = [];

        // Set piece stroke border relative to image resolution
        let mp = (puzzle.width * puzzle.height) / 1000000;
        let stroke = mp <= 2.25 ? 1 : (mp <= 8 ? 2 : 3);

        // Set piece stadows relative to image resolution
        let avg = ((puzzle.width / generator.xn) + (puzzle.height / generator.yn)) / 2;
        BOARD._shadow = avg * .02;
        BOARD._shadowUp = avg * .1;

        // Set the image as the background
        let pattern = new fabric.Pattern({
            source: img,
            repeat: "no-repeat"
        });
        var bg = new fabric.Rect({ 
            width: puzzle.width, 
            height: puzzle.height, 
            stroke: 'black', 
            strokeWidth: 2, 
            fill: pattern, 
            opacity: 0.40,
            evented: false, 
            selectable: false });
        bg.canvas = BOARD;
        BOARD._backgroundImage = bg;
        setPuzzleBackgroundEnabled(isGhostImageEnabled());
            
        // Set a wide initial zoom to see puzzle image and then shuffle take place
        let zoom = zoomTo(.4);
        BOARD.setZoom(zoom);

        if (isAutoSave()) {
            loadAutoSave();
        } else {
            // Creates a board with all the pieces and the background
            for (let r = 0; r < generator.yn; r++) {
                for (let c = 0; c < generator.xn; c++) {
                    let piece = pieces[r][c];
                    const paths = piece.top + " " + piece.right + " " + piece.bottom + " " + piece.left;
                    let path = new fabric.Path(paths);
                    path.row = r;
                    path.col = c;
                    path.hasBorders = false;
                    path.hasControls = false;
                    path.stroke = "black";
                    path.strokeWidth = stroke;
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
                        offsetX: BOARD._shadow,
                        offsetY: BOARD._shadow,
                    });
                    path.shadow = shadow;

                    path.piece = piece;
                    piece.object = path;
                    BOARD.add(path);

                    path.originalCoords = {...path.aCoords};
                    setPathOrigin(path);
                }
            }
        }

        // Set initial pan position
        let br = pieces[generator.yn-1][generator.xn-1].object.oCoords.br;
        var vpt = BOARD.viewportTransform;
        vpt[4] += (BOARD.width / 2) - (br.x / 2);
        vpt[5] += (BOARD.height / 2) - (br.y / 2);

        // Set up the puzzle "box cover" image for user reference
        let boxCover = document.getElementById("boxCover");
        boxCover.style.aspectRatio = puzzle.aspectRatio[0] + "/" + puzzle.aspectRatio[1];
        boxCover.style.backgroundImage = "url('" + URL.createObjectURL(png) + "')";
        if (puzzle.width > puzzle.height) {
            boxCover.style.width = "200px";
            boxCover.style.height = (200 * (puzzle.aspectRatio[1] / puzzle.aspectRatio[0])) + "px";
        } else {
            boxCover.style.width = (200 * (puzzle.aspectRatio[0] / puzzle.aspectRatio[1])) + "px";
            boxCover.style.height = "200px";
        }

        // Show the drawn puzzle for 2 seconds and then shuffle to start the game
        setTimeout(function() {
            configureBoardEvents(BOARD);
            //shufflePieces();
            BOARD.interval = setInterval(autoSave, 60000);
        }, 2000);
    };
}

// Calculate the offset for the center of the piece vs the bounding box.
// This will be used to set the animation rotation point for the piece.
// @param path - fabric.Path
function setPathOrigin(path) {
    let boundingCenter = path.getCenterPoint();
    let pieceCenter = centerOfPiece(path);
    let centerOffset = new fabric.Point(pieceCenter.x - boundingCenter.x, pieceCenter.y - boundingCenter.y);
    path._originX = 0.5 + (centerOffset.x / path.width);
    path._originY = 0.5 + (centerOffset.y / path.height);
}

// @param enabled - boolean
function setPuzzleBackgroundEnabled(enabled) {
    if (enabled) {
        document.getElementById("ghostImageOn").classList.remove("remove");
        document.getElementById("ghostImageOff").classList.add("remove");
        BOARD.backgroundImage = BOARD._backgroundImage;
        BOARD._backgroundImage = undefined;
    } else {
        document.getElementById("ghostImageOn").classList.add("remove");
        document.getElementById("ghostImageOff").classList.remove("remove");
        BOARD._backgroundImage = BOARD.backgroundImage;
        BOARD.backgroundImage = undefined;
    }
    BOARD.renderAll();
    setGhostImageEnabled(enabled);     // Save setting
}

// @param path - fabric.Group|fabric.Path
// @param prop - string - DOM property to animate
// @param endPoint - number - the value which to animate the property to
// @param duration - number - the duration of the animation
// @param render - boolean - if true, the fabric canvas will be refreshed on each iteration
// @param onBeforeFunc - JS function - called before animation starts
// @param onChangeFunc - JS function - called in each iteration of the animation - be careful about performance
// @param onCompleteFunc - JS function - called when the animation has completed
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

    audio('shake');

    for (let r = 0; r < pieces.length; r++) {
        const cols = pieces[r].length;
        for (let c = 0; c < cols; c++) {
            let piece = pieces[r][c];
            let path = piece.object;
            const render = (r == pieces.length - 1) && (c == cols - 1);

            // Randomize piece placement across visible board space, margin of 100px
            const buf = 300;
            const height = ((2 * puzzle.height) - (2 * buf)) + buf;
            const width = ((2 * puzzle.width) - (2 * buf)) + buf;
            const top = Math.floor(Math.random() * height) - (height / 4);
            const left = Math.floor(Math.random() * width) - (width / 4);
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

function boxCoverClick() {
    var boxCover = document.getElementById("boxCover");
    
    // If in preview mode, show max size. Else show preview.
    if (!boxCover._height) {
        showOverlayCover(boxCoverClick);
        
        // Remember the preview size and wipe out dimensions set, will be reset using CSS class
        boxCover._height = boxCover.style.height;
        boxCover._width = boxCover.style.width;
        
        // If puzzle is wider, set to width. Else height
        let width, height;
        let boardAspect = BOARD.width / BOARD.height;
        let puzzleAspect = BOARD.puzzle.width / BOARD.puzzle.height;
        if (puzzleAspect > boardAspect) {
            width = window.innerWidth - 20 + 1;
            height = width * BOARD.puzzle.aspectRatio[1] / BOARD.puzzle.aspectRatio[0];
        } else {
            height = window.innerHeight - 20 + 1;
            width = height * BOARD.puzzle.aspectRatio[0] / BOARD.puzzle.aspectRatio[1];
        }

        boxCover._animate = boxCover.animate(
            [
                {   
                    height: boxCover.style.height,
                    width: boxCover.style.width,
                    transform: "translate(0%, 0%)",
                    right: "1px",
                    top: "0px",
                    border: "2px solid #0460b1",
                },
                { 
                    height: height + "px", 
                    width: width + "px",
                    transform: "translate(50%, -50%)",
                    right: "calc(50% - 1px)",
                    top: "calc(50% + 2px)",
                    border: "0px"
                },
            ],
            {
                duration: 500,
                fill: 'forwards'
            }
        );
    } else {
        boxCover._animate.reverse();
        setTimeout(hideOverlayCover, 500);
        boxCover._animate = undefined;
        boxCover._height = undefined;
        boxCover._width = undefined;
    }
}

function backToMenu() {
    if (!confirm("Are you sure you want to leave the puzzle?")) {
        return;
    }

    // Stop auto save
    clearInterval(BOARD.interval);

    // Clear out existing fabric canvas object
    removeBoardEvents();
    BOARD.clear();
    let containers = document.getElementsByClassName("canvas-container")
    while (containers.length > 0) { 
        containers[containers.length - 1].remove();
    }
    BOARD = undefined;
    
    // Create new canvas
    let board = document.createElement("canvas");
    board.id = "board";
    board.className = "board";
    document.getElementById("page2").appendChild(board);

    // Transition to the menu page
    displayPage("page2", false, false);
    setTimeout(function(){
        displayPage("page1", true, true);
    }, 600);
}

async function exportPuzzles() {
    // Show the processing overlay
    showOverlayCover();
    document.getElementById("processingOverlay").classList.remove("remove");

    // Create the export zip
    let zipWriter = new zip.ZipWriter(new zip.BlobWriter("application/zip"), { bufferedWrite: true });
    
    // Add the localStorage data, as a JSON file, to the zip
    let localStorageStr = JSON.stringify(localStorage);
    zipWriter.add("puzzles.json", new zip.TextReader(localStorageStr), {});

    // Create a "puzzles" directory in the zip
    zipWriter.add("puzzles/", undefined, {directory: true});
    
    // Add all files from the "puzzles" filesystem directory into the new directory in the zip
    let dir = await getDirectory("puzzles");
    for await (const handle of dir.values()) {
        let file = await handle.getFile();
        zipWriter.add("puzzles/" + file.name, new zip.BlobReader(file), {});
    }

    // Open a 'save as' prompt for the user to save the export.zip
    const blobURL = URL.createObjectURL(await zipWriter.close());
    const anchor = document.createElement("a");
    anchor.href = blobURL;
    anchor.download = "puzzles-export-" + todayAsString() + ".zip";

    // Hide the processing overlay, ready to prompt 'save as' dialog
    document.getElementById("processingOverlay").classList.add("remove");
    hideOverlayCover();

    const clickEvent = new MouseEvent("click");
    anchor.dispatchEvent(clickEvent);

    // Clean up
    zipWriter = null;
}

// Returns today's date as a string in the format of YYYY-MM-DD
function todayAsString() {
    let currentDate = new Date();
    let year = currentDate.getFullYear();
    let month = ('0' + (currentDate.getMonth() + 1)).slice(-2);
    let day = ('0' + currentDate.getDate()).slice(-2);

    return `${year}-${month}-${day}`;
}

async function importPuzzles() {
    // Prompt user to choose a zip file
    document.getElementById("importOpener").click();
}

// @param importOpener - DOM Object - INPUT tracking user selected local zip file
async function importPuzzlesChange(importOpener) {
    if (importOpener.files.length > 0) {
        // Show the processing overlay
        showOverlayCover();
        document.getElementById("processingOverlay").classList.remove("remove");

        let zipReader = new zip.ZipReader(new zip.BlobReader(importOpener.files[0]), {});
        let entries = await zipReader.getEntries();
        let entry = entries.filter(e => !e.directory && e.filename == "puzzles.json");
        if (entry.length == 0) {
            alert("Invalid puzzle export: puzzles.json not found inside");
            return;
        }
        
        // Parse the JSON
        let data = await entry[0].getData(new zip.BlobWriter(), {});
        let str = await data.text();
        var json = JSON.parse(str);
        for (let jsonEntry of Object.entries(json)) {
            json[jsonEntry[0]] = JSON.parse(jsonEntry[1]);
        }

        // Merge the data into the existing localStorage

        // Settings
        if (!localStorageExists("soundEnabled")) {
            localStorageSet("soundEnabled", json["soundEnabled"]);
        }
        if (!localStorageExists("ghostImageEnabled")) {
            localStorageSet("ghostImageEnabled", json["ghostImageEnabled"]);
        }

        // Folder/puzzle structures
        let root = json["puzzles_root"]
        for (let [k, v] of Object.entries(root)) {
            if (k.startsWith("f")) {
                let folder = findFolderByName(v);
                if (!folder) {
                    // Create the folder
                    let fid = getAndIncrementNextFolderID();
                    addFolder(fid, v);
                    folder = [fid, v];
                }
                
                // Import any puzzles not found by title
                let dir = json["puzzles_" + k];
                for (let [key, value] of Object.entries(dir)) {
                    let puzzle = findPuzzleByTitle(folder[0], value["title"]);
                    if (!puzzle) {
                        // Create puzzle and import its images from the zip
                        let pid = getAndIncrementNextPuzzleID();
                        await importImage(entries, key + ".png", pid + ".png");
                        await importImage(entries, key + "preview.png", pid + "preview.png");
                        savePuzzle(folder[0], pid, value);
                    }
                }
            } else {
                let puzzle = findPuzzleByTitle("root", v["title"]);
                if (!puzzle) {
                    // Create puzzle and import its images from the zip
                    let pid = getAndIncrementNextPuzzleID();
                    await importImage(entries, k + ".png", pid + ".png");
                    await importImage(entries, k + "preview.png", pid + "preview.png");
                    savePuzzle("root", pid, v);
                }
            }
        }

        // Refresh the menu, hide the processing overlay, and reset the input
        await loadMainMenu();
        document.getElementById("processingOverlay").classList.add("remove");
        hideOverlayCover();
        importOpener.value = '';
    }
}

// @param entries - zip.Entry[]
// @param entryName - string - name of the image file to import
// @param importName - string - name of the file to save into the filesystem
async function importImage(entries, entryName, importName) {
    let img = entries.filter(e => !e.directory && e.filename == "puzzles/" + entryName);
    if (img.length > 0) {
        var newFile = await createFile("puzzles", importName);
        let pngBlob = await img[0].getData(new zip.BlobWriter(), {});
        await writeFile(newFile, pngBlob);
    }
}

function victoryCelebration() {
    let puzzle = BOARD.puzzle;
    let pieces = BOARD.pieces;

    // TODO: Find a celebration audio, maybe 10-15s
    audio('shake');

    // TODO: Center the puzzle, BOARD.getObjects()[0]

    for (let r = 0; r < pieces.length; r++) {
        const cols = pieces[r].length;
        for (let c = 0; c < cols; c++) {
            let piece = pieces[r][c];
            let path = piece.object;
            const render = (r == pieces.length - 1) && (c == cols - 1);

            // TODO: Come up with a little celebration animation
            const buf = 300;
            const height = ((2 * puzzle.height) - (2 * buf)) + buf;
            const width = ((2 * puzzle.width) - (2 * buf)) + buf;
            const top = Math.floor(Math.random() * height) - (height / 4);
            const left = Math.floor(Math.random() * width) - (width / 4);
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