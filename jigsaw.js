// Priority TODOs
// * Implement import and export buttons (Export to zip, import from zip)
// * Icons for main menu buttons (create buzzle, create folder, delete, return home, move puzzle home) to go with the text
// * Add a Rename button 
// * Create the start game overlay (number of pieces, allow rotating, and advanced options like shape uniformity)
// * Create the game board and initialize the pieces
// * Initial play functionality (snap pieces, rotate pieces, puzzle image for reference, zoom, buckets, sound on/off)
// * Controls: left click+drag = move, right click = zoom on piece, ctrl+left click = multi-select pieces, shift+left click + drag = multi-select pieces in area
// * Create a help menu (describes controls; drag and drop and mouse/keys for when playing)
// * Create a first pass at stat tracking
// * Advanced play options - auto-sorting by shape/color onto board or into buckets
// * Add handling of filesystem.js exceptions so that menu's continue to load if a file is missing and that an error is raised if a failure happens saving any of the images during puzzle creation
// * BUG: Determine why fade out for pages works, but fade in happens fast. Maybe try non-CSS opacity fade, display none, display, opacity reveal
// * Add loading message for puzzle creation (and maybe other areas)

// Tracks the active folder for the puzzle menu
var ACTIVE_FID = "root";

// Tracks the singleton image cropper object used for creating new puzzles
var CROPPER;

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
        await loadMenuItem(key, value);
    }
    
    // Folder button text update
    let text = (ACTIVE_FID != "root" ? "Return Home" : "Create Folder");
    document.getElementById("createFolderButton").innerText = text;

    // Refresh estimated storage usage
    refreshStorageUsage();
}

// Sort folders before puzzles and then alpha order title
// @param [aK, aV] - [string, string] - [puzzle/folder ID, title]
// @param [bK, bV] - [string, string] - [puzzle/folder ID, title]
function sortPuzzles([aK,aV],[bK,bV]) {
    // First character of key is 'f' for folder or 'p' for puzzle
    if (aK.charAt(0) < bK.charAt(0)) {
        return -1;
    } else if (aK.charAt(0) > bK.charAt(0)) {
        return 1;
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
    menuItem.addEventListener("click", function(){
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
            startPuzzle(id);
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
                for (const [id, title] of Object.entries(puzzles)) {
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

function startPuzzle(id) {
    // Transition to the play board
    displayPage("page1", false);

    // TODO: Show play options [Puzzle size (# of pieces), Allow rotating pieces? (yes/no), Piece shape uniformity (seed, tab size, jitter) (identical, high, medium, low)]
}

function createPuzzle() {
    // Hide the main menu page
    displayPage("page1", false);

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
 
            // Show the create puzzle page
            displayPage("page2", true);
        } else {
            // No image was chosen, open the main menu page
            displayPage("page1", true);
        }
    });

    // Prompt user to choose an image
    fileOpener.click();
}

function cropImage() {
    CROPPER = new Croppr('#createPuzzlePreview', {
        minSize: { width: 175, height: 175 },
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
    addPuzzle(ACTIVE_FID, pid, title);

    // Reload the puzzles to include the new entry
    await loadMainMenu();

    // Transition to the main menu
    displayPage("page2", false);
    setTimeout(function(){displayPage("page1", true)}, 600);
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
