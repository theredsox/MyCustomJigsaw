// @return FileSystemDirectoryHandle
async function getRootDirectory() {
    let storageRoot = null;
    try {
        storageRoot = await navigator.storage.getDirectory();
    }
    catch( err ) {
        console.error(err);
        alert("Browser file system (OPFS) could not be opened. Please report this issue.");
        return;
    }
    return storageRoot;
}

// @param dir - string
// @param filename - string
// @return FileSystemFileHandle
async function createFile(dir, filename) {
    const rootDir = await getRootDirectory();
    const currentDir = await rootDir.getDirectoryHandle(dir, { "create" : true });
    return await currentDir.getFileHandle(filename, { "create" : true });
}

// @param file - FileSystemFileHandle
// @param contents - binary data to write
async function writeFile(file, contents) {
    const writer = await file.createWritable();
    try {
        await writer.write(contents);
    }
    finally {
        await writer.close();
    }
}

// @param dir - string
// @param filename - string
// @return File - Web API File, extends Blob
async function readFile(dir, filename) {
    const rootDir = await getRootDirectory();
    const currentDir = await rootDir.getDirectoryHandle(dir);
    const file = await currentDir.getFileHandle(filename);
    return await file.getFile();
}

async function deleteFile(dir, filename) {
    const rootDir = await getRootDirectory();
    const currentDir = await rootDir.getDirectoryHandle(dir);
    return await currentDir.removeEntry(filename);
}