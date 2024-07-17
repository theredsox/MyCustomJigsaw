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

let AUDIO_ENABLED = true;

function audio(key) {
    if (AUDIO_ENABLED) {
        let audio = new Audio(audioAssets[key]);
        audio.play();
    }
}

function setAudioEnabled(enabled) {
    AUDIO_ENABLED = enabled;
    if (AUDIO_ENABLED) {
        document.getElementById("soundOn").classList.remove("remove");
        document.getElementById("soundOff").classList.add("remove");
    } else {
        document.getElementById("soundOn").classList.add("remove");
        document.getElementById("soundOff").classList.remove("remove");
    }
    setSoundEnabled(AUDIO_ENABLED);     // Save setting
}

function audioSetup() {
    let clicks = document.querySelectorAll('button,#diskSpace,#export,#import,#backToMenu,#soundOff,#ghostImageOn,#ghostImageOff');
    for (let click of clicks) {
        click.addEventListener('click', function() { audio('click') });
    }

    setAudioEnabled(isSoundEnabled());
}