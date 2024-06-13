// Create a canvas element.
const canvas = document.createElement('canvas');

// Get the image element.
const image = document.getElementById('myImage');

// Set the canvas width and height to the image width and height.
canvas.width = image.width;
canvas.height = image.height;

// Get the canvas context.
const ctx = canvas.getContext('2d');

// Draw the image on the canvas.
ctx.drawImage(image, 0, 0);

// Scale the image.
ctx.scale(0.5, 0.5);

// Crop the image.
ctx.drawImage(canvas, 0, 0, 100, 100);

// Save the canvas as an image.
canvas.toBlob(function(blob) {
  saveAs(blob, 'myImage.png');
});