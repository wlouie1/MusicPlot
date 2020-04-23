'use strict';

const example_music = [
    'resources/data/mozart_eine_kleine'
];

// ==================================================
/**
 * Application Model
 */
function ViewModel(elem) {
    this._elem = elem;
    this._midiInputManager = new MidiInputManager(this);

    let vizContainer = this._elem.querySelector('.viz-container');
    this._vizManager = new VisualizationManager(vizContainer, this);
}

ViewModel.prototype.getElem = function() {
    return this._elem;
};

ViewModel.prototype.setMidi = function(midi) {
    this._midi = midi;
};

ViewModel.prototype.getMidi = function() {
    return this._midi;
};

ViewModel.prototype.setMusicDisplay = function(osmd) {
    this._osmd = osmd;
};

ViewModel.prototype.getMusicDisplay = function() {
    return this._osmd;
};

ViewModel.prototype.getVisualizationManager = function() {
    return this._vizManager;
};

ViewModel.prototype.render = function() {
    if (this._midi == null) {
        return;
    }

    this._vizManager.render();
};

// ==================================================
/**
 * Handles the rendering of the visualization.
 */
function VisualizationManager(elem, viewModel) {
    this._elem = elem;
    this._viewModel = viewModel;

    let matrixContainer = this._elem.querySelector('.sim-matrix-container');
    this._matrixViz = new SimilarityVizManager(matrixContainer, this);

    let musicContainer = this._elem.querySelector('.music-container');
    this._music = new SheetMusicPlayerManager(musicContainer, this);
}

VisualizationManager.prototype.getElem = function() {
    return this._elem;
};

VisualizationManager.prototype.getViewModel = function() {
    return this._viewModel;
};

VisualizationManager.prototype.getSheetMusicPlayerManager = function() {
    return this._music;
};

VisualizationManager.prototype.render = function() {
    this._matrixViz.render();
    this._music.render();
};

// ==================================================
/**
 * Handles the rendering of the similarity matrix and controls
 */
function SimilarityVizManager(elem, vizManager) {
    this._elem = elem;
    this._vizManager = vizManager;

    let matrixContainer = this._elem.querySelector('.sim-matrix');
    this._matrix = new SimilarityMatrixManager(matrixContainer, this);
}

SimilarityVizManager.prototype.getElem = function() {
    return this._elem;
};

SimilarityVizManager.prototype.getViewModel = function() {
    return this._vizManager.getViewModel();
};

SimilarityVizManager.prototype.render = function() {
    let midi = this.getViewModel().getMidi();
    let horiTrack = midi.tracks[0];
    let vertTrack = midi.tracks[0]
    this._matrix.render(horiTrack, vertTrack);
};

// ==================================================
/**
 * Handles the rendering of the music player
 */
function MusicPlayerManager(elem, sheetMusicPlayerManager) {
    this._elem = elem;
    this._musicManager = sheetMusicPlayerManager;
}

MusicPlayerManager.prototype.getElem = function() {
    return this._elem;
};

MusicPlayerManager.prototype.render = function() {

};

// ==================================================
/**
 * Handles the rendering of the similarity matrix
 */
function SimilarityMatrixManager(elem, simVizManager) {
    this._elem = elem;
    this._simVizManager = simVizManager;
}

SimilarityMatrixManager.prototype.getElem = function() {
    return this._elem;
};

SimilarityMatrixManager.prototype._trackToMelody = function(track) {
    let melody = [track.notes[0]];
    track.notes.forEach(function(note) {
        let prevNote = melody[melody.length - 1];
        if (note.ticks === prevNote.ticks) {
            if (note.midi > prevNote.midi) {
                melody[melody.length - 1] = note;
            }
        } else {
            melody.push(note);
        }
    });
    return melody;
};

SimilarityMatrixManager.prototype._melodyToMeasures = function(melody) {
    let midi = this._simVizManager.getViewModel().getMidi();
    let ppq = midi.header.ppq;

    let defaultTimeSig = [4, 4];
    let timeSigs = midi.header.timeSignatures.map(function(timeSig) {
        return [timeSig.measures, timeSig.timeSignature ? timeSig.timeSignature : defaultTimeSig];
    });
    if (timeSigs.length === 0) {
        timeSigs.push([0, defaultTimeSig]);
    }
    timeSigs.push([-1, defaultTimeSig]);

    let measureNotes = [];
    let currNoteInd = 0;
    let measureTickStart = 0;
    for (let i = 1; i < timeSigs.length; i++) {
        let nn = timeSigs[i - 1][1][0];
        let dd = timeSigs[i - 1][1][1];
        let measureLength = ppq * 4 * nn / dd;
        while ((timeSigs[i][0] === -1 && currNoteInd < melody.length) || (measureNotes.length < timeSigs[i][0] - 1)) {
            let measure = [];
            let measureTickEnd = measureTickStart + measureLength;
            while (currNoteInd < melody.length && melody[currNoteInd].ticks < measureTickEnd) {
                measure.push(melody[currNoteInd]);
                currNoteInd += 1;
            }

            measureTickStart = measureTickEnd;
            measureNotes.push(measure);
        }
    }

    return measureNotes;
};

SimilarityMatrixManager.prototype._measureToUnigrams = function(measure) {
    let unigrams = []

    if (measure.length == 1) {
        measure = [measure[0], measure[0]];
    }

    for (let i = 0; i < measure.length - 1; i++) {
        let pitchDiff = measure[i + 1].midi - measure[i].midi;
        let durationRatio = measure[i + 1].durationTicks / measure[i].durationTicks;
        unigrams.push([pitchDiff, durationRatio]);
    }

    return unigrams;
};

SimilarityMatrixManager.prototype._similarity = function(measure1, measure2) {
    let unigrams1 = new Set(this._measureToUnigrams(measure1).map(function(u) {
        return JSON.stringify(u);
    }));
    let unigrams2 = new Set(this._measureToUnigrams(measure2).map(function(u) {
        return JSON.stringify(u);
    }));

    let intersection = new Set();
    unigrams1.forEach(function(u) {
        if (unigrams2.has(u)) {
            intersection.add(u);
        }
    });
    return 2 * intersection.size / (unigrams1.size + unigrams2.size);
};

// SimilarityMatrixManager.prototype._trackToUnigrams = function(track) {
//     let melody = this._trackToMelody(track);

//     return this._melodyToMeasures(melody);

//     // let unigrams = []
//     // for (let i = 0; i < melody.length - 1; i++) {
//     //     let pitchDiff = melody[i + 1].midi - melody[i].midi;
//     //     let durationRatio = melody[i + 1].durationTicks / melody[i].durationTicks;
//     //     unigrams.push([pitchDiff, durationRatio]);
//     // }

//     // return unigrams;
// };

SimilarityMatrixManager.prototype.render = function(horiTrack, vertTrack) {
    let canvas = this._elem;
    canvas.width = 800;
    canvas.height = 800;
    let ctx = canvas.getContext('2d');

    // Clear existing matrix
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let horiMeasures = this._melodyToMeasures(this._trackToMelody(horiTrack));
    let vertMeasures = this._melodyToMeasures(this._trackToMelody(vertTrack));

    let N = Math.min(horiMeasures.length, vertMeasures.length);
    let sqLen = canvas.width / N;

    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            let score = this._similarity(vertMeasures[i], horiMeasures[j]);
            // ctx.fillStyle = 'rgba(0, 0, 0, ' + ((score < 0.5) + 0) + ')';
            ctx.fillStyle = 'rgba(0, 0, 0, ' + ((score < 0.5) + 0) + ')';
            // ctx.fillStyle = 'rgba(0, 0, 0, ' + Math.pow((1-score), 0.5) + ')';
            ctx.fillRect(j * sqLen, i * sqLen, sqLen, sqLen);
        }
    }
};

// ==================================================

/**
 * Handles the rendering of the sheet music player
 */
function SheetMusicPlayerManager(elem, vizManager) {
    this._elem = elem;
    this._vizManager = vizManager;

    let sheetMusicContainer = this._elem.querySelector('.music-sheet');
    this._sheetMusicManager = new SheetMusicManager(sheetMusicContainer, this);
}

SheetMusicPlayerManager.prototype.getElem = function() {
    return this._elem;
};

SheetMusicPlayerManager.prototype.getViewModel = function() {
    return this._vizManager.getViewModel();
};

SheetMusicPlayerManager.prototype.getSheetMusicManager = function() {
    return this._sheetMusicManager;
};

SheetMusicPlayerManager.prototype.render = function() {
    this._sheetMusicManager.render();
};

// ==================================================

/**
 * Handles the rendering of the sheet music
 */
function SheetMusicManager(elem, sheetMusicPlayerManager) {
    this._elem = elem;
    this._musicManager = sheetMusicPlayerManager;
}

SheetMusicManager.prototype.getElem = function() {
    return this._elem;
};

SheetMusicManager.prototype.render = function() {
    let viewModel = this._musicManager.getViewModel();
    let osmd = viewModel.getMusicDisplay();
    // osmd.zoom = 0.75;
    osmd.render();
};


/**
 * Handles the rendering of the music selection region.
 */
function MidiInputManager(viewModel) {
    this._viewModel = viewModel;
}

MidiInputManager.prototype.render = function() {

};


// ====================== Main ========================

function main() {
    let initialRender = function() {
        let viewModel = new ViewModel(document.querySelector('.container'));

        let midiPromise = Midi.fromUrl(example_music[0] + '.mid');

        let musicSheetContainer = viewModel.getVisualizationManager()
                                        .getSheetMusicPlayerManager()
                                        .getSheetMusicManager()
                                        .getElem();
        let osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(musicSheetContainer,
            {backend: 'svg', drawingParameters: 'compact', drawPartNames: true});
        let musicPromise = osmd.load(example_music[0] + '.musicxml');

        return Promise.all([midiPromise, musicPromise]).then(function(values) {
            let midi = values[0];
            console.log(midi);
            viewModel.setMidi(midi);
            viewModel.setMusicDisplay(osmd);
            viewModel.render();
        });
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialRender);
    } else {
        initialRender();
    }
}

main();