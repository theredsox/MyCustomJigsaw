// Priority TODOs
//
// * In start game overlay, change the two dropdowns to better UI elements. Dropdowns aren't easy for mobile devices.
// *    Consider using a solid background color for the overlay instead of the puzzle image
// * Allow selection of ratio on 'create a puzzle' menu. Right now hardcoded to 3:2 for CROPPER.
// * Add background "covers" to avoid  users interacting with background items when on an overlay (create puzzle, create folder, play menu)
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

// Tracks the piece orientation labels
const ORIENTATIONS = [
    "Standard - No rotation",
    "Intermediate (2x) - North, South", 
    "Advanced (4x) - Cardinal"
]

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

async function loadMenuItem(id, title) {
    var isFolder = id.startsWith("f");

    // Create menu item container
    var menuItem = window.document.createElement('div');
    menuItem.className = "menuItem";
    menuItem.draggable = !isFolder;
    menuItem.id = id;
    menuItem.addEventListener("click", function(event){
        // If in delete mode, toggle checked and disable dragging
        let checkbox = this.querySelector(".menuItemDelete");
        if (checkbox.checkVisibility()) {
            checkbox.checked = !checkbox.checked;
            checkbox.checked ? this.classList.add("menuItemChecked") : this.classList.remove("menuItemChecked");

            // Update delete button text
            let deleteButton = document.getElementById("deleteButton");
            const count = document.querySelectorAll(".menuItemChecked").length;
            deleteButton.innerText = "Delete (" + count + ")";
            return;
        }
        if (isFolder) {
            ACTIVE_FID = id;
            loadMainMenu();
        } else {
            loadPlayOverlay(this, id, event);
        }
    });
    if (isFolder) {
        menuItem.addEventListener("dragover", function(event){ 
            event.preventDefault();
            menuItem.classList.add("dropTargetHighlight");
        });
        menuItem.addEventListener("dragleave", function(event){ 
            menuItem.classList.remove("dropTargetHighlight");
        });
        menuItem.addEventListener("drop", function(event){ 
            event.preventDefault();
            var pid = event.dataTransfer.getData("text");
            movePuzzle(ACTIVE_FID, event.target.id, pid);
            document.getElementById(pid).remove();
            menuItem.classList.remove("dropTargetHighlight");
        });
    } else {
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
        menuItem.addEventListener("dragend", function(event){ 
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

    // Create menu item header
    var itemHeaderDiv = window.document.createElement('div');
    itemHeaderDiv.className = "menuItemHeader";
    menuItem.appendChild(itemHeaderDiv);
    
    // Create menu item delete checkbox
    var itemDeleteInput = window.document.createElement('input');
    itemDeleteInput.className = "menuItemDelete";
    itemDeleteInput.type = "checkbox";
    itemHeaderDiv.appendChild(itemDeleteInput);

    // Create menu item title
    var itemTitleSpan = window.document.createElement('span');
    itemTitleSpan.className = "menuItemTitle";
    itemTitleSpan.textContent = title;
    itemTitleSpan.title = title;
    menuItem.appendChild(itemTitleSpan);

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

function createFolder() {
    // Create overlay to capture folder name
    var overlayDiv = window.document.createElement('div');
    overlayDiv.className = "createFolderOverlay";

    // Create the header
    var header = window.document.createElement('div');
    header.className = "createFolderOverlayHeader";
    overlayDiv.appendChild(header);
    
    // Create the title
    var title = window.document.createElement('span');
    title.className = "createFolderOverlayTitle";
    title.innerText = "Create a new folder";
    overlayDiv.appendChild(title);

    // Create the text input label to capture the folder name
    var label = window.document.createElement('label');
    label.className = "createFolderOverlayInput";
    label.innerText = "Name ";
    overlayDiv.appendChild(label);

    // Create text input to capture folder name
    var input = window.document.createElement('input');
    input.id = "createFolderName";
    input.className = "createFolderName";
    input.type = "text";
    input.maxLength = 20;
    input.addEventListener("keyup", function(event){ 
        // Disable create button when no name is provided
        var createButton = document.getElementById("createButton");
        createButton.disabled = this.value.trim().length == 0;

        // Auto submit on enter key
        if (event.key === 'Enter') {
            createButton.click();
        }
    });
    label.appendChild(input);

    // Create button to create folder
    var createButton = window.document.createElement('button');
    createButton.id = "createButton";
    createButton.className = "createFolderOverlayButton";
    createButton.disabled = true;
    createButton.innerText = "Create";
    createButton.addEventListener("click", function(){ 
        let fid = getAndIncrementNextFolderID();
        var name = document.getElementById("createFolderName").value;
        addFolder(fid, name);

        overlayDiv.remove();

        // TODO: Consider manually inserting the new DOM folder instead of reloading them all.
        // Need to determine where to insert it for alpha order of folders
        loadMainMenu();
    });
    overlayDiv.appendChild(createButton);

    // Cancel button to exit folder creation
    var cancelButton = window.document.createElement('button');
    cancelButton.innerText = "Cancel";
    cancelButton.addEventListener("click", function(){ overlayDiv.remove(); });
    overlayDiv.appendChild(cancelButton);

    // Add the div to the body to display it
    document.body.appendChild(overlayDiv);
    
    // Change focus to the name input
    input.focus();
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

function loadPlayOverlay(menuItem, id, event) {
    // Clone the menuItem to use as the play overlay
    // Position it absolute right on top of its parent to start
    var playOverlay = menuItem.cloneNode(true);
    playOverlay.id = "playOverlay";
    playOverlay.style.position = "absolute";
    playOverlay.style.left = (event.pageX - event.offsetX) + "px";
    playOverlay.style.top = (event.pageY - event.offsetY) + "px";
    playOverlay.draggable = false;
    playOverlay.onclick=null;
    playOverlay.ondragstart=null;
    playOverlay.ondragend=null;

    // Select for difficulty - # of pieces 
    let difficultyLabel = window.document.createElement('label');
    difficultyLabel.className = "playOverlayLabel playOverlayHidden";
    difficultyLabel.for = "playOverlayDifficulty";
    difficultyLabel.innerText = "Choose your difficulty";

    let difficultySelect = window.document.createElement('select');
    difficultySelect.id = "playOverlayDifficulty";
    difficultySelect.className = "playOverlayDifficulty";
    let puzzle = getPuzzle(ACTIVE_FID, id);
    let difficulties = getDifficulties(puzzle["aspectRatio"]);
    let index = 0;
    for (let [pieces, dimensions] of Object.entries(difficulties)) {
        let difficulty = window.document.createElement('option');
        difficulty.value = dimensions; // [width]x[height] as string
        difficulty.innerText = pieces + " pieces - " + DIFFICULTIES[index];
        difficultySelect.appendChild(difficulty);
        index++;
    }
    difficultyLabel.appendChild(difficultySelect);
    playOverlay.appendChild(difficultyLabel);

    // Select for Orientation of pieces
    let orientationLabel = window.document.createElement('label');
    orientationLabel.className = "playOverlayLabel playOverlayHidden";
    orientationLabel.for = "playOverlayOrientation";
    orientationLabel.innerText = "Puzzle piece orientation";

    let orientationSelect = window.document.createElement('select');
    orientationSelect.id = "playOverlayOrientation";
    orientationSelect.className = "playOverlayOrientation";
    for (let [index, label] of ORIENTATIONS.entries()) {
        let orientation = window.document.createElement('option');
        orientation.value = index;
        orientation.innerText = label;
        orientation.selected = (index == 0);
        orientationSelect.appendChild(orientation);
    }
    orientationSelect.addEventListener("change", function() {
        var span = document.getElementById("playOverlayOrientationSpan");
        span.style.display = (this.value != 0 ? "inline" : "none");
    });
    orientationLabel.appendChild(orientationSelect);
    playOverlay.appendChild(orientationLabel);

    let orientationSpan = window.document.createElement('span');
    orientationSpan.id = "playOverlayOrientationSpan";
    orientationSpan.className = "playOverlayLabel playOverlayOrientationSpan playOverlayHidden";
    orientationSpan.innerText = "* NOTE: Press [Alt] key while holding a piece to rotate";
    orientationSpan.style.display = "none";
    playOverlay.appendChild(orientationSpan);

    // Play button
    var playButton = window.document.createElement('button');
    playButton.id = "playButton";
    playButton.className = "playOverlayButton playOverlayHidden";
    playButton.innerText = "Play now";
    playButton.addEventListener("click", function(){ 
        // TODO: Hide play overlay, hide page 1, and then show page 3 (the play board)
    });
    playOverlay.appendChild(playButton);

    // Cancel button to exit folder creation
    var cancelButton = window.document.createElement('button');
    cancelButton.className = "playOverlayHidden";
    cancelButton.innerText = "Cancel";
    cancelButton.addEventListener("click", function(){ playOverlay.remove(); });
    playOverlay.appendChild(cancelButton);

    document.body.appendChild(playOverlay);

    // Transition to the play overlay. Must be delayed for playOverlay to be drawn on screen or animations won't trigger.
    setTimeout(function() {
        // Apply the CSS class to trigger the transition position from menu item to play overlay
        playOverlay.classList.add("playOverlay");

        // Set background transparency to make play options more visible
        playOverlay.style.backgroundImage = "linear-gradient(rgba(255,255,255,0.5), rgba(255,255,255,0.5)), " + playOverlay.style.backgroundImage;

        // Make play options visible
        setTimeout(function() {
            difficultyLabel.classList.add("playOverlayVisible");
            difficultyLabel.classList.remove("playOverlayHidden");
            orientationLabel.classList.add("playOverlayVisible");
            orientationLabel.classList.remove("playOverlayHidden");
            orientationSpan.classList.add("playOverlayVisible");
            orientationSpan.classList.remove("playOverlayHidden");
            playButton.classList.add("playOverlayVisible");
            playButton.classList.remove("playOverlayHidden");
            cancelButton.classList.add("playOverlayVisible");
            cancelButton.classList.remove("playOverlayHidden");
        }, 500);
    }, 50);
}

function createPuzzle() {

    var fileOpener = document.getElementById("fileOpener");
    
    // Register post-image selection work
    fileOpener.addEventListener("change", function(){
        if (fileOpener.files.length > 0) {
            // Default title to file name
            var createPuzzleName = document.getElementById("createPuzzleName");
            createPuzzleName.value = formatTitle(fileOpener.files[0].name);
            setTimeout(function() { 
                createPuzzleName.focus();
            }, 50);

            // Populate the image preview
            var createPuzzlePreview = document.getElementById("createPuzzlePreview");
            createPuzzlePreview.src = URL.createObjectURL(fileOpener.files[0]);

            // TODO: If image resolution is too small, kick back to main menu page and alert user to choose a different image

            // Instanciate the image cropper tool
            setTimeout(cropImage, 300);
 
            // Transition to the create puzzle page
            displayPage("page1", false);
            setTimeout(function(){displayPage("page2", true);}, 600);
        }
    });

    // Prompt user to choose an image
    fileOpener.click();
}

function cropImage() {
    CROPPER = new Croppr('#createPuzzlePreview', {
        minSize: { width: 175, height: 175 },
        aspectRatio: [3,2]
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
    var aspectRatio = determineAspectRatio(cropSize);
    savePuzzleFromAttrs(ACTIVE_FID, pid, title, aspectRatio);

    // Reload the puzzles to include the new entry
    await loadMainMenu();

    // Transition to the main menu
    displayPage("page2", false);
    setTimeout(function(){displayPage("page1", true)}, 600);
}

// Finds the greatest common denominator of 2 passed integers
// @param a - integer
// @param b - integer
function findGCD(a, b) {
    if ( b === 0 ) {
        return a;
    }
    return findGCD(b, a % b);
}

function determineAspectRatio(dimensions) {
    // Determine aspect ratio, in fraction
    let gcd = findGCD(dimensions.width, dimensions.height);
    let x = dimensions.width / gcd;
    let y = dimensions.height / gcd;
    return [x,y];
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

function cancelPuzzle() {
    // Destroy cropper for resource cleanup
    destroyCropper()

    // Transition to the main menu
    displayPage("page2", false);
    setTimeout(function(){displayPage("page1", true)}, 600);
}

// @input title - string
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

// @input pid - integer - puzzle ID
// @input dimensions - {x, y, width, height}
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
