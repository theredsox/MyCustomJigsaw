// Stores basic information needed for application functionality
// Note: PID is a unique identifier assigned to each puzzle. EX: p0,p1,p2
//       FID is a unique identifier assigned to each folder. EX: f0,f1,f2

// Description of keys:
// "nextPuzzleID" - integer - tracks the number of puzzles created
// "nextFolderID" - integer - tracks the number of folders created
// "puzzles_root" - JSON - tracks the puzzles that exist at the root menu level. EX: { PID:{}, FID:name }
// "puzzles_" + FID - JSON - tracks the puzzles that exist in that folder. Folders cannot be nested. EX: { PID:{}, PID:{} }
// "stats_" + PID - JSON - tracks stats for the puzzle. TODO: determine structure (# of times completed and best time, per difficulty)
// "soundEnabled" - boolean - tracks whether sound should be enabled or not
// "ghostImageEnabled" - boolean - tracks whether the ghost puzzle image should be displayed on the board
//
// Puzzle Object
// {
//      title: string
//      aspectRatio: [number, number] - [x, y]
//      width: integer
//      height: integer
// }

function getAndIncrementNextPuzzleID() {
    let id = parseInt(localStorage.getItem("nextPuzzleID") || "0");
    localStorage.setItem("nextPuzzleID", id + 1);
    return "p" + id;
}

function getAndIncrementNextFolderID() {
    let id = parseInt(localStorage.getItem("nextFolderID") || "0");
    localStorage.setItem("nextFolderID", id + 1);
    return "f" + id;
}

// @param fid - string - folder ID
// @return JSON - { PID:{}, FID:name }
function getPuzzles(fid) {
    return JSON.parse(localStorage.getItem("puzzles_" + fid) || "{}");
}

// @param fid - string - folder ID
// @param pid - string - pizzle ID
// @return JSON - {}
function getPuzzle(fid, pid) {
    let puzzles = getPuzzles(fid);
    return puzzles[pid];
}

// @param fid - string - folder ID
// @param json - JSON - { PID:{}, FID:name }
function savePuzzles(fid, json) {
    localStorage.setItem("puzzles_" + fid, json ? JSON.stringify(json) : "{}");
}

// @param fid - string - folder ID
// @param pid - string - puzzle ID
// @param puzzle - {} - puzzle object
function savePuzzle(fid, pid, puzzle) {
    let puzzles = getPuzzles(fid);
    puzzles[pid] = puzzle;
    savePuzzles(fid, puzzles);
}

// @param fid - string - folder ID
// @param pid - string - puzzle ID
// @param title - string - puzzle title
// @param aspectRatio - [number, number] - image aspect ratio in [x, y]
// @param width - integer - image width in px
// @param height - integer - image height in px
function savePuzzleFromAttrs(fid, pid, title, aspectRatio, width, height) {
    let puzzles = getPuzzles(fid);
    puzzles[pid] = {
        title: title,
        aspectRatio: aspectRatio,
        width: width,
        height: height
    };
    savePuzzles(fid, puzzles);
}

// @param fid - string - folder ID
// @param name - string - folder name
function addFolder(fid, name) {
    let puzzles = getPuzzles("root");
    puzzles[fid] = name;
    savePuzzles("root", puzzles);
}

// @param fid - string - folder ID
// @param pid - string - puzzle ID
// @return string - deleted puzzle object {}
function deletePuzzle(fid, pid) {
    let puzzles = getPuzzles(fid);
    let puzzle = puzzles[pid];
    delete puzzles[pid];
    savePuzzles(fid, puzzles);
    return puzzle;
}

// @param fid - string - folder ID
function deleteFolder(fid) {
    // Remove folder from root
    let puzzles = getPuzzles("root");
    delete puzzles[fid];
    savePuzzles("root", puzzles);
    // Remove the puzzles in the folder
    localStorage.removeItem("puzzles_" + fid);
}

// @param fromFid - string - folder ID to move from
// @param toFid - string - folder ID to move to
// @param pid - string - puzzle ID to move
function movePuzzle(fromFid, toFid, pid) {
    let puzzle = deletePuzzle(fromFid, pid);
    savePuzzle(toFid, pid, puzzle);
}

function isSoundEnabled() {
    let enabled = localStorage.getItem("soundEnabled");
    return enabled || enabled == null;
}

function setSoundEnabled(enabled) {
    localStorage.setItem("soundEnabled", enabled);
}

function isGhostImageEnabled() {
    let enabled = "true" == localStorage.getItem("ghostImageEnabled");
    return enabled || enabled == null;
}

function setGhostImageEnabled(enabled) {
    localStorage.setItem("ghostImageEnabled", enabled);
}

function localStorageExists(key) {
    return localStorage.getItem(key) != null;
}

function localStorageSet(key, value) {
    localStorage.setItem(key, value);
}

function findFolderByName(name) {
    let puzzles = getPuzzles("root");
    let matches = Object.entries(puzzles).filter(([k, v]) => k.startsWith("f") && v == name);
    return matches.length > 0 ? matches[0] : undefined;
}

function findPuzzleByTitle(fid, title) {
    let puzzles = getPuzzles(fid);
    let matches = Object.entries(puzzles).filter(([k, v]) => k.startsWith("p") && v.title == title);
    return matches.length > 0 ? matches[0] : undefined;
}