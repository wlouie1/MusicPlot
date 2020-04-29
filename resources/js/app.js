'use strict';

const image_root = 'resources/images/';
// indexed by midi instrument number
const instrument_image = [
    'musical-note', // fallback
    'piano','piano','piano','piano','piano','piano','piano','piano',
    'xylophone','xylophone','xylophone','xylophone','xylophone','xylophone','xylophone','xylophone',
    'organ','organ','organ','organ','organ','accordion','harmonica','accordion',
    'acoustic-guitar','acoustic-guitar','electric-guitar','electric-guitar','electric-guitar','electric-guitar','electric-guitar','electric-guitar',
    'electric-guitar','electric-guitar','electric-guitar','electric-guitar','electric-guitar','electric-guitar','electric-guitar','electric-guitar',
    'violin','violin','violin','violin','violin','violin','violin','timpani',
    'violin','violin','violin','violin','musical-note','musical-note','musical-note','violin',
    'trumpet','trombone','tuba','trumpet','french-horn','trombone','trombone','trombone',
    'saxophone','saxophone','saxophone','saxophone','clarinet','clarinet','bassoon','clarinet',
    'flute','flute','flute','pan-flute','ocarina','flute','whistle','ocarina',
    'synth','synth','synth','synth','synth','synth','synth','synth',
    'synth','synth','synth','synth','synth','synth','synth','synth',
    'synth','synth','synth','synth','synth','synth','synth','synth',
    'banjo','banjo','banjo','kalimba','kalimba','bagpipe','violin','clarinet',
    'drum-set','drum-set','drum-set','drum-set','drum-set','drum-set','drum-set','drum-set',
    'musical-note','musical-note','musical-note','musical-note','musical-note','musical-note','musical-note','musical-note',
    'musical-note' // fallback
];

const data_root = 'resources/data/';
const example_music = [
    'beethoven_fur_elise',
    // 'bwv582',
    'mozart_eine_kleine',
    // 'mary_had_a_little_lamb_VLN',
    // 'beethoven_sym5_mvt1_ORCH',
    // 'Lady_Gaga_-_poker_face'
    'bach_846'
];

// ==================================================
/**
 * Application Model
 */
function ViewModel(elem) {
    this._elem = elem;

    let inputContainer = this._elem.querySelector('.music-select-container');
    this._midiInputManager = new MidiInputManager(inputContainer, this);

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

ViewModel.prototype.loadMusic = function(fn) {
    let midiPromise = Midi.fromUrl(data_root + fn + '.mid');

    let musicSheetContainer = this.getVisualizationManager()
                                    .getSheetMusicPlayerManager()
                                    .getSheetMusicManager()
                                    .getElem();

    if (this._osmd) {
        this._osmd.clear();
    }

    // Canvas backend is faster, but at the time of writing, large music sheets
    // are clipped. This may be because there's a browser limit on the canvas height.
    // Use SVG backend instead.
    let osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(musicSheetContainer,
        {backend: 'svg', drawingParameters: 'compact', drawPartNames: true, disableCursor: false});
    let musicPromise = osmd.load(data_root + fn + '.musicxml');

    return Promise.all([midiPromise, musicPromise]).then(function(values) {
        let midi = values[0];

        // Filter tracks without any notes
        midi.tracks = midi.tracks.filter(function(track) {
            return track.notes.length > 0;
        });

        console.log(midi)

        return [midi, osmd];
    });
};

ViewModel.prototype.render = function() {
    if (this._midi == null) {
        return;
    }

    this._midiInputManager.render();
    this._vizManager.render();
};

// ==================================================
/**
 * Handles the rendering of the music selection region.
 */
function MidiInputManager(elem, viewModel) {
    this._elem = elem;
    this._viewModel = viewModel;
}

MidiInputManager.prototype.getElem = function() {
    return this._elem;
};

MidiInputManager.prototype.getViewModel = function() {
    return this._viewModel;
};

MidiInputManager.prototype.render = function() {
    let self = this;
    let select = this._elem.querySelector('#music-select');

    example_music.forEach(function(fn) {
        let option = document.createElement('option');
        option.value = fn;
        option.text = fn;
        select.appendChild(option);
    });

    select.addEventListener('change', function(event) {
        let viewModel = self.getViewModel();
        viewModel.loadMusic(event.target.value).then(function(values) {
            let midi = values[0];
            let osmd = values[1];

            viewModel.setMidi(midi);
            viewModel.setMusicDisplay(osmd);
            viewModel.getVisualizationManager().render();
        });
    });
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

    let horiTrackPickerContainer = this._elem.querySelector('.sim-h-track-container');
    this._horiTrackPicker = new SimilarityMatrixTrackPicker(horiTrackPickerContainer, this);
    let vertTrackPickerContainer = this._elem.querySelector('.sim-v-track-container');
    this._vertTrackPicker = new SimilarityMatrixTrackPicker(vertTrackPickerContainer, this);

    let matrixControlsContainer = this._elem.querySelector('.sim-matrix-controls-container');
    this._matrixControls = new SimilarityMatrixControlsManager(matrixControlsContainer, this);
}

SimilarityVizManager.prototype.getElem = function() {
    return this._elem;
};

SimilarityVizManager.prototype.getViewModel = function() {
    return this._vizManager.getViewModel();
};

SimilarityVizManager.prototype.getHoriTrackPicker = function() {
    return this._horiTrackPicker;
};

SimilarityVizManager.prototype.getVertTrackPicker = function() {
    return this._vertTrackPicker;
};

SimilarityVizManager.prototype.getMatrix = function() {
    return this._matrix;
};

SimilarityVizManager.prototype.getControls = function() {
    return this._matrixControls;
};

SimilarityVizManager.prototype.render = function() {
    this._horiTrackPicker.render()
    this._vertTrackPicker.render();
    this._matrixControls.render();
    this._matrix.render();
};



// ==================================================
/**
 * Handles the rendering of a track picker
 */
function SimilarityMatrixTrackPicker(elem, simVizManager) {
    this._elem = elem;
    this._simVizManager = simVizManager;
    this._btnTrackMap = null;
    this._selectedBtn = null;
}

SimilarityMatrixTrackPicker.prototype.getElem = function() {
    return this._elem;
};

SimilarityMatrixTrackPicker.prototype.getViewModel = function() {
    return this._simVizManager.getViewModel();
};

SimilarityMatrixTrackPicker.prototype.getSelectedTrack = function() {
    return this._btnTrackMap.get(this._selectedBtn)[0];
};

SimilarityMatrixTrackPicker.prototype.getSelectedTrackInd = function() {
    return this._btnTrackMap.get(this._selectedBtn)[1];
};

SimilarityMatrixTrackPicker.prototype.getSelectedTrackName = function() {
    return this._selectedBtn.title;
};

SimilarityMatrixTrackPicker.prototype._createTrackBtn = function(track) {
    let self = this;
    let btn = document.createElement('button');
    btn.classList.add('track-btn');
    let span = document.createElement('span');
    let instrument = instrument_image[Math.min(Math.max(0, track.instrument.number + 1), instrument_image.length - 1)];
    span.style.backgroundImage = "url('" + image_root + instrument + '.svg' + "')";

    btn.appendChild(span);

    btn.addEventListener('click', function(event) {
        self._selectedBtn.disabled = false;
        self._selectedBtn = event.currentTarget;
        self._selectedBtn.disabled = true;

        let selectedTrackContainer = self._elem.querySelector('.sim-track-selected');
        selectedTrackContainer.innerHTML = self._selectedBtn.title;

        self._simVizManager.getMatrix().render();
    });

    return btn;
};

SimilarityMatrixTrackPicker.prototype.render = function() {
    let self = this;

    let trackBtnsContainer = this._elem.querySelector('.sim-tracks');
    let selectedTrackContainer = this._elem.querySelector('.sim-track-selected')

    // Clear any previously rendered stuff
    trackBtnsContainer.innerHTML = '';
    selectedTrackContainer.innerHTML = '';

    this._btnTrackMap = new Map();
    let midi = this.getViewModel().getMidi();
    let osmd = this.getViewModel().getMusicDisplay();

    midi.tracks.forEach(function(track, i) {
        let part;
        try {
            part = osmd.Sheet.Parts[i].nameLabel.text;
        } catch(err) {
            part = null;
        } finally {
            let btn = self._createTrackBtn(track);
            btn.title = part ? part : (track.name.length > 0 ? track.name : track.instrument.name);

            if (i == 0) {
                self._selectedBtn = btn;
                selectedTrackContainer.innerHTML = self._selectedBtn.title;
                btn.disabled = true;
            }

            trackBtnsContainer.appendChild(btn);
            self._btnTrackMap.set(btn, [track, i]);
        }
    });  
};

// ==================================================
/**
 * Handles the rendering of the matrix controls
 */
function SimilarityMatrixControlsManager(elem, simVizManager) {
    this._elem = elem;
    this._simVizManager = simVizManager;
    this._isBinarizeOn = true;
    this._binarizeThres = 0.5;

    let self = this;
    let binarizeToggle = this._elem.querySelector('.matrix-binarize-toggle');
    let binarizeSlider = this._elem.querySelector('.matrix-binarize-thres-slider');
    let binarizeThres = this._elem.querySelector('.matrix-binarize-thres-value');

    binarizeToggle.addEventListener('change', function(event) {
        self._isBinarizeOn = this.checked;
        if (this.checked) {
            binarizeSlider.disabled = false;
            binarizeSlider.classList.remove('sim-matrix-controls-disabled');
            binarizeThres.classList.remove('sim-matrix-controls-disabled');
        } else {
            binarizeSlider.disabled = true;
            binarizeSlider.classList.add('sim-matrix-controls-disabled');
            binarizeThres.classList.add('sim-matrix-controls-disabled');
        }
        self._simVizManager.getMatrix().render();
    });

    binarizeSlider.addEventListener('input', function(event) {
        self._binarizeThres = this.value;
        binarizeThres.innerHTML = parseFloat(this.value).toFixed(2);
        self._simVizManager.getMatrix().render();
    });
}

SimilarityMatrixControlsManager.prototype.getElem = function() {
    return this._elem;
};

SimilarityMatrixControlsManager.prototype.getViewModel = function() {
    return this._simVizManager.getViewModel();
};

SimilarityMatrixControlsManager.prototype.isBinarizeOn = function() {
    return this._isBinarizeOn;
};

SimilarityMatrixControlsManager.prototype.getBinarizeThres = function() {
    return this._binarizeThres;
};

SimilarityMatrixControlsManager.prototype.render = function() {

};


// ==================================================
/**
 * Handles the rendering of the similarity matrix
 */
function SimilarityMatrixManager(elem, simVizManager) {
    this._elem = elem;
    this._simVizManager = simVizManager;

    this._elem.addEventListener('click', this.handleMouseClick.bind(this));
    this._elem.addEventListener('mousemove', this.handleMouseOver.bind(this));
    this._elem.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
}

SimilarityMatrixManager.prototype.getElem = function() {
    return this._elem;
};

SimilarityMatrixManager.prototype.getViewModel = function() {
    return this._simVizManager.getViewModel();
};

SimilarityMatrixManager.prototype.getSheetMusicManager = function() {
    return this.getViewModel()
                .getVisualizationManager()
                .getSheetMusicPlayerManager()
                .getSheetMusicManager();
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
    let midi = this.getViewModel().getMidi();
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

    if (unigrams1.size === 0 && unigrams2.size === 0) {
        return 1;
    }

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

SimilarityMatrixManager.prototype.getColor = function(score) {
    let controls = this._simVizManager.getControls();
    let isBinarizeOn = controls.isBinarizeOn();
    if (isBinarizeOn) {
        let binarizeThres = controls.getBinarizeThres();
        return score > binarizeThres ? 'white' : 'black';
    }
    return 'hsl(0, 0%, ' + (score * 100) + '%)';
};

SimilarityMatrixManager.prototype._renderTooltip = function(x, y, i, j) {
    let tooltip = document.querySelector('.matrix-tooltip');
    tooltip.classList.remove('invisible');
    tooltip.classList.add('visible');

    let horiTrackPicker = this._simVizManager.getHoriTrackPicker();
    let vertTrackPicker = this._simVizManager.getVertTrackPicker();
    let horiTrackName = horiTrackPicker.getSelectedTrackName();
    let vertTrackName = vertTrackPicker.getSelectedTrackName();

    let vertDetail = tooltip.querySelector('.matrix-tooltip-l1');
    let horiDetail = tooltip.querySelector('.matrix-tooltip-l2');
    let simScore = tooltip.querySelector('.matrix-tooltip-l3');

    horiDetail.innerHTML = horiTrackName + ': Measure ' + (j + 1);
    vertDetail.innerHTML = vertTrackName + ': Measure ' + (i + 1);
    simScore.innerHTML = 'Similarity: ' + this._gridSimVals[i][j].toFixed(2);

    let buffer = 15;
    tooltip.style.top = (y - tooltip.clientHeight - buffer) + 'px';
    tooltip.style.left = (x + buffer) + 'px';
};

SimilarityMatrixManager.prototype._hideTooltip = function() {
    let tooltip = document.querySelector('.matrix-tooltip');
    tooltip.classList.remove('visible');
    tooltip.classList.add('invisible');
    tooltip.style.top = '0px';
    tooltip.style.left = '0px';
};

SimilarityMatrixManager.prototype._renderCellAction = function(ctx, sqLen, i, j, isFill) {
    let strokeWidth = isFill ? 0 : sqLen / 3;
    let horiColor = '#72b8c9';
    let vertColor = '#fe9001';

    let topColor;
    let bottomColor;
    if (j < i) {
        topColor = horiColor;
        bottomColor = vertColor;
    } else if (j > i) {
        bottomColor = horiColor;
        topColor = vertColor;
    } else {
        topColor = vertColor;
        bottomColor = vertColor;
    }

    // horizontal track
    ctx.beginPath();
    ctx.lineWidth = strokeWidth;
    if (isFill) {
        ctx.shadowColor = horiColor;
        ctx.shadowBlur = 20;
    }
    ctx.strokeStyle = horiColor;
    ctx.fillStyle = horiColor;
    ctx.rect(j * sqLen, j * sqLen, sqLen, sqLen);
    isFill ? ctx.fill() : ctx.stroke();

    

    // vertical track
    ctx.beginPath();
    ctx.lineWidth = strokeWidth;
    if (isFill) {
        ctx.shadowColor = vertColor;
        ctx.shadowBlur = 20;
    }
    ctx.strokeStyle = vertColor;
    ctx.fillStyle = vertColor;
    ctx.rect(i * sqLen, i * sqLen, sqLen, sqLen);
    isFill ? ctx.fill() : ctx.stroke();

    // target cell
    ctx.lineWidth = strokeWidth;

    // bottom-left, bottom-right, top-right
    ctx.beginPath();
    if (isFill) {
        ctx.shadowColor = bottomColor;
        ctx.shadowBlur = 20;
    }
    ctx.strokeStyle = bottomColor;
    ctx.fillStyle = bottomColor;
    ctx.moveTo(j * sqLen, (i + 1) * sqLen);
    ctx.lineTo((j + 1) * sqLen, (i + 1) * sqLen);
    ctx.lineTo((j + 1) * sqLen, i * sqLen);
    isFill ? ctx.fill() : ctx.stroke();

    // bottom-left, top-left, top-right
    ctx.beginPath();
    if (isFill) {
        ctx.shadowColor = topColor;
        ctx.shadowBlur = 20;
    }
    ctx.strokeStyle = topColor;
    ctx.fillStyle = topColor;
    ctx.moveTo(j * sqLen, (i + 1) * sqLen + (strokeWidth / 2));
    ctx.lineTo(j * sqLen, i * sqLen);
    ctx.lineTo((j + 1) * sqLen + (strokeWidth / 2), i * sqLen);
    isFill ? ctx.fill() : ctx.stroke();

    ctx.shadowColor = 'rgba(0, 0, 0, 0)';
    ctx.shadowBlur = 0;
};

SimilarityMatrixManager.prototype._renderFocus = function(ctx, sqLen, i, j) {
    this._renderCellAction(ctx, sqLen, i, j, false);
};

SimilarityMatrixManager.prototype._renderActive = function(ctx, sqLen, i, j) {
    this._renderCellAction(ctx, sqLen, i, j, true);
};

SimilarityMatrixManager.prototype._preTargetCell = function(event) {
    let canvas = this._elem;

    let N = this._gridSimVals.length;
    let sqLen = canvas.width / N;
    let ctx = canvas.getContext('2d');

    let rect = canvas.getBoundingClientRect();
    let x = event.clientX - rect.left;
    let y = event.clientY - rect.top;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let ti;
    let tj;
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            let score = this._gridSimVals[i][j];
            ctx.beginPath();
            ctx.fillStyle = this.getColor(score);
            ctx.rect(j * sqLen, i * sqLen, sqLen - 1, sqLen - 1);
            ctx.fill();
            if (ctx.isPointInPath(x, y)) {
                ti = i;
                tj = j;
            }
        }
    }

    let horiTrackPicker = this._simVizManager.getHoriTrackPicker();
    let vertTrackPicker = this._simVizManager.getVertTrackPicker();
    let horiTrackInd = horiTrackPicker.getSelectedTrackInd();
    let vertTrackInd = vertTrackPicker.getSelectedTrackInd();

    return {
        'ti': ti,
        'tj': tj,
        'horiTrackInd': horiTrackInd,
        'vertTrackInd': vertTrackInd,
        'sqLen': sqLen,
        'ctx': ctx
    };
};

SimilarityMatrixManager.prototype.handleMouseOver = function(event) {
    let payload = this._preTargetCell(event);

    if (this._selectedI != null || this._selectedJ != null) {
        this._renderActive(payload.ctx, payload.sqLen, this._selectedI, this._selectedJ);
    }
    if (payload.ti == null || payload.tj == null) {
        return;
    }

    this._renderFocus(payload.ctx, payload.sqLen, payload.ti, payload.tj);
    this._renderTooltip(event.clientX, event.clientY, payload.ti, payload.tj);

    // sheetMusicManager.highlightHoriTrackMeasure(horiTrackInd, tj);
    // sheetMusicManager.highlightVertTrackMeasure(vertTrackInd, ti);
};

SimilarityMatrixManager.prototype.handleMouseClick = function(event) {
    let payload = this._preTargetCell(event);

    if (payload.ti == null || payload.tj == null) {
        return;
    }

    if (this._selectedI == payload.ti && this._selectedJ == payload.tj) {
        this.handleMouseOver(event);
        return;
    }

    this._selectedI = payload.ti;
    this._selectedJ = payload.tj;

    this._renderActive(payload.ctx, payload.sqLen, payload.ti, payload.tj);
    this._renderTooltip(event.clientX, event.clientY, payload.ti, payload.tj);

    let sheetMusicManager = this.getSheetMusicManager();
    sheetMusicManager.highlightHoriTrackMeasure(payload.horiTrackInd, payload.tj);
    sheetMusicManager.highlightVertTrackMeasure(payload.vertTrackInd, payload.ti);
};

SimilarityMatrixManager.prototype.handleMouseLeave = function(event) {
    this._hideTooltip();

    let sheetMusicManager = this.getSheetMusicManager();
    sheetMusicManager.hideHoriTrackMeasure();
    sheetMusicManager.hideVertTrackMeasure();
    
    this.render();

    let canvas = this._elem;
    let N = this._gridSimVals.length;
    let sqLen = canvas.width / N;
    let ctx = canvas.getContext('2d');
    this._renderActive(ctx, sqLen, this._selectedI, this._selectedJ);
};

SimilarityMatrixManager.prototype.render = function() {
    let horiTrackPicker = this._simVizManager.getHoriTrackPicker();
    let vertTrackPicker = this._simVizManager.getVertTrackPicker();
    let horiTrack = horiTrackPicker.getSelectedTrack();
    let vertTrack = vertTrackPicker.getSelectedTrack();

    // Center horizontal track picker
    // For some reason need to call twice to force vertTrackPicker to render properly and give correct width
    // horiTrackPicker.getElem().style.paddingLeft = vertTrackPicker.getElem().clientWidth + 'px';
    // horiTrackPicker.getElem().style.paddingLeft = vertTrackPicker.getElem().clientWidth + 'px';

    let controlsContainer = this._simVizManager.getControls();

    let canvas = this._elem;
    let availWidth = canvas.parentElement.clientWidth - vertTrackPicker.getElem().clientWidth * 2;
    let availHeight = this.getViewModel().getVisualizationManager().getElem().clientHeight
                        - horiTrackPicker.getElem().clientHeight
                        - controlsContainer.getElem().clientHeight;
    canvas.width = Math.min(availWidth, availHeight);
    canvas.height = canvas.width;

    let ctx = canvas.getContext('2d');

    // Clear existing matrix
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let horiMeasures = this._melodyToMeasures(this._trackToMelody(horiTrack));
    let vertMeasures = this._melodyToMeasures(this._trackToMelody(vertTrack));

    let N = Math.min(horiMeasures.length, vertMeasures.length);
    let sqLen = canvas.width / N;

    this._gridSimVals = []

    for (let i = 0; i < N; i++) {
        let row = [];
        for (let j = 0; j < N; j++) {
            let score = this._similarity(vertMeasures[i], horiMeasures[j]);
            row.push(score)
            // ctx.fillStyle = 'rgba(0, 0, 0, ' + ((score < 0.5) + 0) + ')';
            // ctx.fillStyle = 'rgba(0, 0, 0, ' + ((score < 0.5) + 0) + ')';
            // ctx.fillStyle = 'rgba(0, 0, 0, ' + Math.pow((1-score), 0.5) + ')';
            // if (score >= 0.5) {
            //     ctx.fillStyle = 'white';
            //     ctx.fillRect(j * sqLen, i * sqLen, sqLen, sqLen);
            // }   
            ctx.fillStyle = this.getColor(score);
            ctx.fillRect(j * sqLen, i * sqLen, sqLen - 1, sqLen - 1);
        }
        this._gridSimVals.push(row);
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
 * Handles the rendering of the sheet music
 */
function SheetMusicManager(elem, sheetMusicPlayerManager) {
    this._elem = elem;
    this._musicManager = sheetMusicPlayerManager;
}

SheetMusicManager.prototype.getElem = function() {
    return this._elem;
};

SheetMusicManager.prototype._highlightTrackMeasure = function(bboxElem, trackIndex, measureIndex) {
    let osmd = this._musicManager.getViewModel().getMusicDisplay();
    let sourceMeasure = osmd.Sheet.SourceMeasures[measureIndex];
    let verticalMeasures = sourceMeasure.VerticalMeasureList;
    
    let measureStaveMap = new Map();
    verticalMeasures.forEach(function(vm) {
        measureStaveMap.set(vm.ParentStaff, vm);
    });

    let trackMeasures = osmd.Sheet.Parts.map(function(p) {
        return measureStaveMap.get(p.staves[0]);
    })

    let targetMeasureStave = trackMeasures[trackIndex].stave;

    let x = targetMeasureStave.x * osmd.zoom;
    let y = targetMeasureStave.y * osmd.zoom;
    let height = targetMeasureStave.height * osmd.zoom;
    let width = targetMeasureStave.width * osmd.zoom;

    bboxElem.classList.remove('hidden');
    bboxElem.style.top = y + 'px';
    bboxElem.style.left = x + 'px';
    bboxElem.style.width = width + 'px';
    bboxElem.style.height = height + 'px';
};

SheetMusicManager.prototype.highlightHoriTrackMeasure = function(trackIndex, measureIndex) {
    this._highlightTrackMeasure(this._trackbbox1, trackIndex, measureIndex);
};

SheetMusicManager.prototype.highlightVertTrackMeasure = function(trackIndex, measureIndex) {
    this._highlightTrackMeasure(this._trackbbox2, trackIndex, measureIndex);
};

SheetMusicManager.prototype.hideHoriTrackMeasure = function() {
    this._trackbbox1.classList.add('hidden');
};

SheetMusicManager.prototype.hideVertTrackMeasure = function() {
    this._trackbbox2.classList.add('hidden');
};

SheetMusicManager.prototype.render = function() {
    // Clear any previously rendered sheet music
    this._elem.innerHTML = '';

    let viewModel = this._musicManager.getViewModel();
    let osmd = viewModel.getMusicDisplay();
    osmd.zoom = 0.7;
    osmd.render();
    osmd.cursor.show();

    // Add track measure bounding boxes
    this._trackbbox1 = document.createElement('div');
    this._trackbbox1.classList.add('music-track-bbox', 'music-track1-bbox', 'hidden');
    this._trackbbox2 = document.createElement('div');
    this._trackbbox2.classList.add('music-track-bbox', 'music-track2-bbox', 'hidden');

    let drawParent = osmd.cursor.cursorElement.parentElement;
    drawParent.appendChild(this._trackbbox1);
    drawParent.appendChild(this._trackbbox2);

    osmd.cursor.hide();
};


// ====================== Main ========================

function main() {
    let initialRender = function() {
        let viewModel = new ViewModel(document.querySelector('.container'));

        viewModel.loadMusic(example_music[0]).then(function(values) {
            let midi = values[0];
            let osmd = values[1];

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