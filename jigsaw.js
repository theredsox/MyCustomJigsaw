function loadMainMenu() {

    // TODO: Grab saved puzzles from browser storage and load each
    loadMenuItem("One");
    loadMenuItem("Two");
    loadMenuItem("Three");
    loadMenuItem("Four");
    loadMenuItem("Five");
    loadMenuItem("Six");
    loadMenuItem("Seven");
    loadMenuItem("Eight testing long name that needs to be truncated");
    loadMenuItem("Nine");
    loadMenuItem("Ten");

    // TODO: create puzzle, create folder, delete, import, and export buttons in html body
}

// TODO: Load puzzle name and image from browser storage object
// TODO: Support for grouping puzzles into folders. 
function loadMenuItem(id) {
    // Create menu item container
    var menuItem = window.document.createElement('div');
    menuItem.className = "menuItem";
    menuItem.id = id;
    menuItem.addEventListener("click", function(){ startPuzzle(id) });

    // Create menu item header
    var itemHeaderDiv = window.document.createElement('div');
    itemHeaderDiv.className = "menuItemHeader";
    menuItem.appendChild(itemHeaderDiv);
    
    // Create menu item title
    var itemTitleSpan = window.document.createElement('span');
    itemTitleSpan.className = "menuItemTitle";
    itemTitleSpan.textContent = id;
    itemTitleSpan.title = id;
    menuItem.appendChild(itemTitleSpan);
    
    // TODO: Load the 250px x 250px version of the user uploaded base64 image as the background.
    /*
    var background = new Image();
    var base64Icon = "iVBORw0KGgoAAAANSUhEUgAAAfMAAAHyCAMAAADIj";
    background.src = "data:image/png;base64," + base64Icon;
    menuItem.style.backgroundImage = "url('" + img.src + "')";
    */

    // Add menu item to menu grid
    var menuGrid = document.getElementById("menuGrid");
    menuGrid.appendChild(menuItem);
}

function startPuzzle(id) {
    // Hide the menu grid
    displayMenuGrid(false);

    // TODO: Show play options [Puzzle size (# of pieces), Allow rotating pieces? (yes/no), Piece shape uniformity (seed, tab size, jitter) (identical, high, medium, low)]
}

function createPuzzle() {
    // Hide the menu grid
    displayMenuGrid(false);

    // TODO: Show upload image UI
    // TODO: Title input, Orientation input (Landscape, Portrait, Square), show preview of uploaded image, trim (drag edges in and out)
    // TODO: Save title, final image, and 250px x 250px preview image into browser storage (likely base64 image strings for images)
}

// @param show - boolean
function displayMenuGrid(show) {
    var menuGrid = document.getElementById("menuGrid");
    menuGrid.style.display = show ? "" : "none";
}