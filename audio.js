const audioAssets = {
    // https://freesound.org/people/Duisterwho/sounds/645495/
    'click': 'assets/click.wav',

    // https://freesound.org/people/MattRuthSound/sounds/561571/
    'down': 'assets/down.wav',

    // https://freesound.org/people/el_boss/sounds/560701/
    'rotate': 'assets/rotate.mp3',

    // https://freesound.org/people/Duisterwho/sounds/645398/
    'shake': 'assets/shake.wav',

    // https://freesound.org/people/ilip33/sounds/593222/
    'snap': 'assets/snap.wav',
    
    // https://freesound.org/people/MattRuthSound/sounds/561572/
    'up': 'assets/up.wav',
};

function audio(key) {
    let audio = new Audio(audioAssets[key]);
    audio.play();
}

// Attach common audio triggers, just to save some clutter
function audioSetup() {
    let clicks = document.querySelectorAll('button,#diskSpace,#export,#import');
    for (let click of clicks) {
        click.addEventListener('click', function() { audio('click') });
    }
}