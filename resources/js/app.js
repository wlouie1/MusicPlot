'use strict';

const example_midis = [
    'resources/data/mozart_eine_kleine.mid'
];

const viewModel = new ViewModel();

// ==================================================

/**
 * Handles the rendering of the music selection region.
 */
function MidiInputManager(viewModel) {
    this._viewModel = viewModel;
}

MidiInputManager.prototype.render = function() {

};

// ==================================================

/**
 * Handles the rendering of the similarity matrix
 */
function SimilarityMatrixManager(vizManager) {
    this._vizManager = vizManager;
}

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
    let midi = this._vizManager.getViewModel().getMidi();
    let ppq = midi.header.ppq;

    let timeSigs = midi.header.timeSignatures.map(function(timeSig) {
        return [timeSig.measures, timeSig.timeSignature ? timeSig.timeSignature : [4, 4]];
    });
    if (timeSigs.length === 0) {
        timeSigs.push([0, [4, 4]]);
    }
    timeSigs.push([-1, [4, 4]]);

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

SimilarityMatrixManager.prototype.render = function(container, horiTrack, vertTrack) {
    let canvas = container.querySelector('.sim-matrix');
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
            ctx.fillStyle = 'rgba(0, 0, 0, ' + ((score < 0.5) + 0) + ')';
            ctx.fillRect(j * sqLen, i * sqLen, sqLen, sqLen);
        }
    }
};

// ==================================================

/**
 * Handles the rendering of the visualization.
 */
function VisualizationManager(viewModel) {
    this._viewModel = viewModel;
    this._matrix = new SimilarityMatrixManager(this);
}

VisualizationManager.prototype.getViewModel = function() {
    return this._viewModel;
};

VisualizationManager.prototype.render = function(container) {
    let midi = this._viewModel.getMidi();
    let track1 = midi.tracks[0];
    let track2 = midi.tracks[0]

    let matrixContainer = container.querySelector('.sim-matrix-container');
    this._matrix.render(matrixContainer, track1, track2);
};


// ==================================================

/**
 * Application Model
 */
function ViewModel() {
    this._midiInputManager = new MidiInputManager(this);
    this._vizManager = new VisualizationManager(this);
}


ViewModel.prototype.setMidi = function(midi) {
    this._midi = midi;
};

ViewModel.prototype.getMidi = function() {
    return this._midi;
};


ViewModel.prototype.render = function(container) {
    if (this._midi == null) {
        return;
    }

    let vizContainer = container.querySelector('.viz-container');
    this._vizManager.render(vizContainer);
};




// ========== Main ==========

async function main() {
    // Initial load midi
    let midi = await Midi.fromUrl(example_midis[0]);
    console.log(midi)
    viewModel.setMidi(midi);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            viewModel.render(document.querySelector('.container'));
        });
    } else {
        viewModel.render(document.querySelector('.container'));
    }
}

main();