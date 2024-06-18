// Stores basic information needed for application functionality
// Note: PID is a unique identifier assigned to each puzzle. EX: p0,p1,p2
//       FID is a unique identifier assigned to each folder. EX: f0,f1,f2

// Description of keys:
// "nextPuzzleID" - integer - tracks the number of puzzles created
// "nextFolderID" - integer - tracks the number of folders created
// "puzzles_root" - JSON - tracks the puzzles that exist at the root menu level. EX: { PID:title, FID:name }
// "puzzles_" + FID - JSON - tracks the puzzles that exist in that folder. Folders cannot be nested. EX: { PID:title, PID:title }
// "stats_" + PID - JSON - tracks stats for the puzzle. TODO: determine structure (# of times completed and best time, per difficulty)

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
// @return JSON - { PID:title, FID:name }
function getPuzzles(fid) {
    return JSON.parse(localStorage.getItem("puzzles_" + fid) || "{}");
}

// @param fid - string - folder ID
// @param json - JSON - { PID:title, FID:name }
function savePuzzles(fid, json) {
    localStorage.setItem("puzzles_" + fid, json ? JSON.stringify(json) : "{}");
}

// @param fid - string - folder ID
// @param pid - string - puzzle ID
// @param title - string - puzzle title
function addPuzzle(fid, pid, title) {
    let puzzles = getPuzzles(fid);
    puzzles[pid] = title;
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
// @return string - deleted puzzle title
function deletePuzzle(fid, pid) {
    let puzzles = getPuzzles(fid);
    let title = puzzles[pid];
    delete puzzles[pid];
    savePuzzles(fid, puzzles);
    return title;
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
    let title = deletePuzzle(fromFid, pid);
    addPuzzle(toFid, pid, title);
}