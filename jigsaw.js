// Tracks the image cropper object used for creating new puzzles
var cropper;

window.onresize = function() {
    if (cropper) {
        // Reset the cropper positioning on window resize since the image may scale
        // NOTE: Does not appear a debounce is needed for performance, but keep an eye on it
        cropper.reset(); 
    }
}

function loadMainMenu() {
    // Clear the puzzles first, as this may be a reload
    var mainMenu = document.getElementById("mainMenu");
    var menuOptions = mainMenu.getElementsByClassName("menuOptions")
    while (menuOptions.length > 1) { 
        mainMenu.removeChild(menuOptions[menuOptions.length - 1]);
    }

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
    
    // TODO: Load the 175px x 175px version of the user uploaded base64 image as the background.
    //var base64Icon = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAIAAACRXR/mAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNSBNYWNpbnRvc2giIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6RDUxRjY0ODgyQTkxMTFFMjk0RkU5NjI5MEVDQTI2QzUiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6RDUxRjY0ODkyQTkxMTFFMjk0RkU5NjI5MEVDQTI2QzUiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpENTFGNjQ4NjJBOTExMUUyOTRGRTk2MjkwRUNBMjZDNSIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDpENTFGNjQ4NzJBOTExMUUyOTRGRTk2MjkwRUNBMjZDNSIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PuT868wAAABESURBVHja7M4xEQAwDAOxuPw5uwi6ZeigB/CntJ2lkmytznwZFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYW1qsrwABYuwNkimqm3gAAAABJRU5ErkJggg==";
    //menuItem.style.backgroundImage = "url('" + base64Icon + "')";
    menuItem.style.backgroundImage = "url('assets/Screenshot 2024-03-28 103842-canvas.png')";

    // Add menu item to menu grid
    var mainMenu = document.getElementById("mainMenu");
    mainMenu.appendChild(menuItem);
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
    fileOpener.addEventListener("change", function() {
        if (fileOpener.files.length > 0) {
            // Default title to file name
            var createPuzzleName = document.getElementById("createPuzzleName");
            createPuzzleName.value = formatTitle(fileOpener.files[0].name);
            
            // Populate the image preview
            var createPuzzlePreview = document.getElementById("createPuzzlePreview");
            createPuzzlePreview.src = URL.createObjectURL(fileOpener.files[0]);

            // TODO: If image resolution is too small, kick back to main menu page and alert user to choose a different image

            // Instanciate the image cropper tool
            setTimeout(cropImage, 100);
 
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
    cropper = new Croppr('#createPuzzlePreview', {
        minSize: { width: 175, height: 175 },
    });
    
    // Due to a bug somewhere in the Croppr lib, a reset after rendering is required to catch the correct sizing of the parent container
    setTimeout(function() { cropper.reset(); }, 100);
}

function destroyCropper() {
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
}

function makePuzzle() {
    // Verify the user provided a name for the puzzle
    var createPuzzleName = document.getElementById("createPuzzleName");
    if (createPuzzleName.value.trim() == "") {
        alert("A name must be provided for the puzzle");
        return;
    }

    // Grab the crop details from the user
    var cropSize = cropper.getValue();

    // TODO: Consider setting a minimum standard for final image size

    // Destroy cropper for resource cleanup
    destroyCropper();

    // Generate the cropped base64 images(Full size and preview)
    var imagesBase64 = cropImageTo(cropSize);

    // Store the puzzle in browser storage
    // 1) Title
    var title = createPuzzleName.value.trim();

    // 2) Puzzle image
    var image = imagesBase64[0]

    // 3) Puzzle image resized and cropped to 175px x 175px for preview
    var preview = imagesBase64[1]
    
    // TODO: Create the browser store object
    // TODO: Then update loadMainMenu() to read those stored objects
    // TODO: Then update loadMenuItem() to load the 1:1 preview image on the items

    // Reload the puzzles to include the new entry
    loadMainMenu();

    // Transition to the main menu
    displayPage("page2", false);
    setTimeout(function(){displayPage("page1", true)}, 500);
}

function cancelPuzzle() {
    if (confirm("Are you sure you want to leave without saving your new puzzle?") === true) {
        // Destroy cropper for resource cleanup
        destroyCropper()

        // Transition to the main menu
        displayPage("page2", false);
        setTimeout(function(){displayPage("page1", true)}, 500);
    }
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
    title = title.substring(0, 20)

    return title;
}

// @param show - boolean
function displayPage(id, show) {
    var page = document.getElementById(id);
    if (show) {
        page.style.display = "";
    }
    page.classList.remove(show ? "hidden" : "visible");
    page.classList.add(show ? "visible" : "hidden");
    if (!show) {
        setTimeout(function(){page.style.display = "none";}, 500)
    }
}

// @input dimensions - {x, y, width, height}
// @return [full image in base64, preview image in base64]
function cropImageTo(dimensions) {
    // Get the image
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

    // Save the canvas as a base64 encoded image
    var imageBase64 = canvas.toDataURL('image/png');

    // Set the canvas ratio to 1:1 for preview image
    var previewSize = Math.min(dimensions.width, dimensions.height);
    canvas.width = previewSize;
    canvas.height = previewSize;

    // Determine the shift for the larger dimension so the crop happens evenly on each side
    var dx, dy;
    if (dimensions.width < dimensions.height) {
        // Width already properly sized
        dx = 0;

        // Make the adjustment and divide by 2 since we'll crop half from each side of the image
        dy = (dimensions.height - dimensions.width) / 2;
    } else {
        // Make the adjustment and divide by 2 since we'll crop half from each side of the image
        dx = (dimensions.width - dimensions.height) / 2;

        // Height already properly sized
        dy = 0;
    }

    // Redraw the image for the new scale and source image crop dimensions
    ctx.drawImage(image, dimensions.x + dx, dimensions.y + dy, dimensions.width - (dx * 2), dimensions.height - (dy * 2), 0, 0, previewSize, previewSize);

    // Save the canvas as a base64 encoded image
    var imagePreviewBase64 = canvas.toDataURL('image/png');

    return [imageBase64, imagePreviewBase64];
}