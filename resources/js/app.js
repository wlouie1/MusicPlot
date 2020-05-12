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
    'bach_846',
    '988-aria'
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

    this._loadingOverlay = document.createElement('div');
    this._loadingOverlay.classList.add('loading-overlay');
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

ViewModel.prototype.getMidiArrayBuffer = function() {
    return this._midiArrayBuffer;
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

ViewModel.prototype.setPlayMeasureInd = function(measureInd) {
    this._vizManager.setPlayMeasureInd(measureInd);
};

ViewModel.prototype._preloadMusic = function() {
    let loadingContainer = this._vizManager.getElem();
    loadingContainer.appendChild(this._loadingOverlay);
    NProgress.configure({ 
        parent: this._vizManager.getElem()
    });
    NProgress.start();
    NProgress.set(0.3);
};

ViewModel.prototype.loadMusicEnd = function() {
    let self = this;
    setTimeout(function() {
        NProgress.done();
        let loadingContainer = self._vizManager.getElem();
        loadingContainer.removeChild(self._loadingOverlay);
    }, 1500);
};

ViewModel.prototype.loadMusic = function(fn) {
    let self = this;

    this._preloadMusic();

    let midiPromise = fetch(data_root + fn + '.mid').then(function(response) {
        if (response.ok) {
            return response.arrayBuffer()
        } else {
            throw new Error('could not load midi');
        }
    }).then(function(arrayBuffer) {
        self._midiArrayBuffer = arrayBuffer;
        return new Midi(arrayBuffer);
    });

    // let midiPromise = Midi.fromUrl(data_root + fn + '.mid');

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
    // Also disable autoresize--osmd has a bug where after resize, cursor disappears and can't be put back
    let osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(musicSheetContainer,
        {backend: 'svg', drawingParameters: 'compact', drawPartNames: true, disableCursor: false, autoResize: false});
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
        }).then(viewModel.loadMusicEnd.bind(viewModel));
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

VisualizationManager.prototype.setPlayMeasureInd = function(measureInd) {
    this._music.setPlayMeasureInd(measureInd);
    this._matrixViz.setPlayMeasureInd(measureInd);
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

SimilarityVizManager.prototype.setPlayMeasureInd = function(measureInd) {
    this._matrix.setPlayMeasureInd(measureInd);
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
        self._simVizManager.getMatrix().render(false);
    });

    binarizeSlider.addEventListener('input', function(event) {
        self._binarizeThres = this.value;
        binarizeThres.innerHTML = parseFloat(this.value).toFixed(2);
        self._simVizManager.getMatrix().render(false);
    });

    let scrollToggle = this._elem.querySelector('.music-scroll-toggle');
    this._isAutoScrollOn = false; // off by default
    scrollToggle.addEventListener('change', function(event) {
        self._isAutoScrollOn = this.checked;
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

SimilarityMatrixControlsManager.prototype.isAutoScrollOn = function() {
    return this._isAutoScrollOn;
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
    this._initialRender = true;

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

    let horiColor = '#72b8c9';
    let vertColor = '#fe9001';

    let lineTop = tooltip.querySelector('.matrix-tooltip-l1');
    let lineBottom = tooltip.querySelector('.matrix-tooltip-l2');
    let vertDetail;
    let horiDetail;
    if (j < i) {
        horiDetail = lineTop;
        vertDetail = lineBottom;
    } else if (j > i) {
        horiDetail = lineBottom;
        vertDetail = lineTop;
    } else {
        horiDetail = lineTop;
        vertDetail = lineBottom;
    }

    vertDetail.style.color = vertColor;
    horiDetail.style.color = horiColor;

    let simScore = tooltip.querySelector('.matrix-tooltip-l3');

    horiDetail.innerHTML = horiTrackName + ': Measure ' + (j + 1);
    vertDetail.innerHTML = vertTrackName + ': Measure ' + (i + 1);
    simScore.innerHTML = 'Similarity: ' + this._gridSimVals[i][j].toFixed(2);

    let buffer = 20;
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
            ctx.rect(j * sqLen, i * sqLen, sqLen, sqLen);
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

    let controls = this._simVizManager.getControls();
    let isAutoScrollOn = controls.isAutoScrollOn();
    let scrollHoriIntoView = false;
    let scrollVertIntoView = false
    if (isAutoScrollOn) {
        scrollHoriIntoView = payload.tj > payload.ti;
        scrollVertIntoView = !scrollHoriIntoView;
    }
    
    let sheetMusicManager = this.getSheetMusicManager();
    sheetMusicManager.highlightHoriTrackMeasure(payload.horiTrackInd, payload.tj, scrollHoriIntoView);
    sheetMusicManager.highlightVertTrackMeasure(payload.vertTrackInd, payload.ti, scrollVertIntoView);
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
    this._selectedX = event.clientX;
    this._selectedY = event.clientY;

    this._renderActive(payload.ctx, payload.sqLen, payload.ti, payload.tj);
    this._renderTooltip(event.clientX, event.clientY, payload.ti, payload.tj);

    let sheetMusicManager = this.getSheetMusicManager();
    sheetMusicManager.hideHoriTrackMeasure();
    sheetMusicManager.hideVertTrackMeasure();
    sheetMusicManager.highlightSelectedHoriTrackMeasure(payload.horiTrackInd, payload.tj);
    sheetMusicManager.highlightSelectedVertTrackMeasure(payload.vertTrackInd, payload.ti);

    // Save scroll position; selection is visible right now, and can be restored on mouse leave
    this._selectionScrollTop = sheetMusicManager.getElem().scrollTop;
};

SimilarityMatrixManager.prototype.handleMouseLeave = function(event) {
    let sheetMusicManager = this.getSheetMusicManager();
    sheetMusicManager.hideHoriTrackMeasure();
    sheetMusicManager.hideVertTrackMeasure();
    
    this.render(false);

    // Restore selection scroll position
    let controls = this._simVizManager.getControls();
    let isAutoScrollOn = controls.isAutoScrollOn();
    if (isAutoScrollOn && this._selectionScrollTop != null) {
        let self = this;
        // Somehow, scroll-behavior smooth needs some time for the scrollTop to update
        setTimeout(function() {
            sheetMusicManager.getElem().scrollTop = self._selectionScrollTop;
        }, 100);
    }
};

SimilarityMatrixManager.prototype._resizeCanvas = function() {
    let canvas = this._elem;
    canvas.width = 20;
    let canvasParent = this._elem.parentElement;
    let availWidth = canvasParent.clientWidth - 25;
    let availHeight = canvasParent.clientHeight - 10;
    canvas.width = Math.min(availWidth, availHeight);
    canvas.height = canvas.width;
};

SimilarityMatrixManager.prototype.setPlayMeasureInd = function(measureInd) {
    if (measureInd == null) {

        return;
    }

};

SimilarityMatrixManager.prototype.render = function(clearSelection = true) {
    if (clearSelection) {
        this._selectedI = null;
        this._selectedJ = null;
        this._selectedX = null;
        this._selectedY = null;

        let sheetMusicManager = this.getSheetMusicManager();
        sheetMusicManager.hideHoriTrackMeasure();
        sheetMusicManager.hideVertTrackMeasure();
        sheetMusicManager.hideSelectedHoriTrackMeasure();
        sheetMusicManager.hideSelectedVertTrackMeasure();
    }
    this._hideTooltip();

    let horiTrackPicker = this._simVizManager.getHoriTrackPicker();
    let vertTrackPicker = this._simVizManager.getVertTrackPicker();
    let horiTrack = horiTrackPicker.getSelectedTrack();
    let vertTrack = vertTrackPicker.getSelectedTrack();

    // Center horizontal track picker
    // For some reason need to call twice to force vertTrackPicker to render properly and give correct width
    // horiTrackPicker.getElem().style.paddingLeft = vertTrackPicker.getElem().clientWidth + 'px';
    // horiTrackPicker.getElem().style.paddingLeft = vertTrackPicker.getElem().clientWidth + 'px';

    // let controlsContainer = this._simVizManager.getControls();

    let canvas = this._elem;
    let ctx = canvas.getContext('2d');

    if (this._initialRender) {
        canvas.classList.remove('invisible');
        this._resizeCanvas();

        // On window resize, resize the canvas
        let self = this;
        window.addEventListener('resize', function() {
            self._resizeCanvas();
            self.render(false);
        });
    }
    this._initialRender = false;

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

    // Restore selection
    if (this._selectedI != null) {
        let N = this._gridSimVals.length;
        let sqLen = canvas.width / N;
        let ctx = canvas.getContext('2d');
        this._renderActive(ctx, sqLen, this._selectedI, this._selectedJ);
        this._renderTooltip(this._selectedX, this._selectedY, this._selectedI, this._selectedJ);
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

    let musicPlayer = this._elem.querySelector('.music-player');
    this._musicPlayerManager = new MusicPlayerManager(musicPlayer, this);
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

SheetMusicPlayerManager.prototype.setPlayMeasureInd = function(measureInd) {
    if (measureInd == null) {
        
        return;
    }
    this._sheetMusicManager.moveCursorToMeasureInd(measureInd);
};

SheetMusicPlayerManager.prototype.render = function() {
    this._sheetMusicManager.render();
    this._musicPlayerManager.setup();
};

// ==================================================
/**
 * Handles the rendering of the music player
 */
function MusicPlayerManager(elem, sheetMusicPlayerManager) {
    this._elem = elem;
    this._musicManager = sheetMusicPlayerManager;
    

    let self = this;
    this._playing = false;
    this._playBtn = this._elem.querySelector('.player-play-toggle');
    this._playBtn.addEventListener('click', function(event) {
        self._playing ? self.pause() : self.play();
    });

    this._stopBtn = this._elem.querySelector('.player-stop');
    this._stopBtn.addEventListener('click', this.stop.bind(this));
}

MusicPlayerManager.prototype.getElem = function() {
    return this._elem;
};

MusicPlayerManager.prototype.getViewModel = function() {
    return this._musicManager.getViewModel();
};

MusicPlayerManager.prototype.play = function() {
    this._playing = true;

    // play icon
    let icon = this._playBtn.querySelector('.fa');
    icon.classList.remove('fa-play');
    icon.classList.add('fa-pause');
    

    // play midi
    this._synth.playMIDI();

    // continuously check and update view every 1ms
    let self = this;
    clearInterval(this._interval);
    this._interval = setInterval(function() {
        let status = self._synth.getPlayStatus();
        
        if (!status.play || !self._playing) {
            clearInterval(self._interval);
            return;
        }

        let currMeasureInd = self._tickToMeasureInd(status.curTick);
        self.getViewModel().setPlayMeasureInd(currMeasureInd);
    }, 1);
};

MusicPlayerManager.prototype.pause = function() {
    this._playing = false;

    // pause icon
    let icon = this._playBtn.querySelector('.fa');
    icon.classList.remove('fa-pause');
    icon.classList.add('fa-play');

    // pause midi
    this._synth.stopMIDI();
};

MusicPlayerManager.prototype.stop = function() {
    if (this._playing) {
        // stop playing
        this._synth.stopMIDI();
        this._playing = false;
    }

    // Clear interval
    clearInterval(this._interval);
    
    // change to play icon
    let playIcon = this._playBtn.querySelector('.fa');
    playIcon.classList.remove('fa-pause');
    playIcon.classList.add('fa-play');

    // reset to beginning
    this._synth.locateMIDI(0);
};

MusicPlayerManager.prototype._computeMidiMeasureTicks = function() {
    let midi = this.getViewModel().getMidi();
    let maxTick = midi.durationTicks;
    let ppq = midi.header.ppq;

    let defaultTimeSig = [4, 4];
    let timeSigs = midi.header.timeSignatures.map(function(timeSig) {
        return [timeSig.measures, timeSig.timeSignature ? timeSig.timeSignature : defaultTimeSig];
    });
    if (timeSigs.length === 0) {
        timeSigs.push([0, defaultTimeSig]);
    }
    timeSigs.push([-1, defaultTimeSig]);

    let measureEndTicks = [];
    let measureTickStart = 0;
    for (let i = 1; i < timeSigs.length; i++) {
        let nn = timeSigs[i - 1][1][0];
        let dd = timeSigs[i - 1][1][1];
        let measureLength = ppq * 4 * nn / dd;
        while (timeSigs[i][0] === -1 && measureTickStart < maxTick) {
            let measureTickEnd = measureTickStart + measureLength;
            measureEndTicks.push(measureTickEnd);
            measureTickStart = measureTickEnd;
        }
    }

    return measureEndTicks;
};

MusicPlayerManager.prototype._tickToMeasureInd = function(tick) {
    for (let i = 0; i < this._midiMeasureTicks.length; i++) {
        let measureTickEnd = this._midiMeasureTicks[i];
        if (tick < measureTickEnd) {
            return i;
        }
    }
    return this._midiMeasureTicks.length - 1; // should not happen
};

MusicPlayerManager.prototype._measureIndToTick = function(measureInd) {
    if (measureInd === 0) {
        return 0;
    }
    return this._midiMeasureTicks[measureInd - 1];
};

// MusicPlayerManager.prototype._tickToTime = function(tick) {
    
// };

// MusicPlayerManager.prototype._midiOnTicks = function() {
//     let onTicks = new Set();

//     let midi = this.getViewModel().getMidi();
//     midi.tracks.forEach(function(track) {
//         track.notes.forEach(function(note) {
//             onTicks.add(note.ticks);
//         });
//     });

//     return Array.from(onTicks).sort();
// };

// MusicPlayerManager.prototype._getMidiMeasureTimeInfo = function() {
//     let midi = this.getViewModel().getMidi();
//     let maxTick = midi.durationTicks;
//     let tempos = midi.header.tempos;
//     let ppq = midi.header.ppq;

//     let defaultTimeSig = [4, 4];
//     let timeSigs = midi.header.timeSignatures.map(function(timeSig) {
//         return [timeSig.measures, timeSig.timeSignature ? timeSig.timeSignature : defaultTimeSig];
//     });
//     if (timeSigs.length === 0) {
//         timeSigs.push([0, defaultTimeSig]);
//     }
//     timeSigs.push([-1, defaultTimeSig]);



//     let measureBPMs = [];
//     let measureEndTicks = [];
//     let measureDurations = [];
//     let measureTickStart = 0;
//     for (let i = 1; i < timeSigs.length; i++) {
//         let nn = timeSigs[i - 1][1][0];
//         let dd = timeSigs[i - 1][1][1];
//         let measureLength = ppq * 4 * nn / dd;
//         while (timeSigs[i][0] === -1 && measureTickStart < maxTick) {
//             let measureTickEnd = measureTickStart + measureLength;
//             measureEndTicks.push(measureTickEnd);

//             let bpm;
//             if (tempos.length == 1) {
//                 bpm = tempos[0].bpm;
//             } else {
//                 let measureTempo = tempos[tempos.length - 1];
//                 for (let j = 1; j < tempos.length; j++) {
//                     if (tempos[j].ticks > measureTickEnd) {
//                         measureTempo = tempos[j - 1];
//                         break;
//                     }
//                 }
//                 bpm = measureTempo.bpm;
//             }

//             measureBPMs.push(bpm);
//             measureDurations.push((60000 / (bpm * ppq)) * measureLength); // ms

//             measureTickStart = measureTickEnd;
//         }
//     }

//     return {
//         measureBPMs: measureBPMs,
//         measureEndTicks: measureEndTicks,
//         measureDurations: measureDurations
//     };
// };

// MusicPlayerManager.prototype._tickToTime = function(tick) {
    
// };

MusicPlayerManager.prototype.setup = function() {
    if (this._synth == null) {
        this._synth = new WebAudioTinySynth();
    }
    this._synth.loadMIDI(this.getViewModel().getMidiArrayBuffer());
    this._playing = false;
    clearInterval(this._interval);

    // change to play icon
    let playIcon = this._playBtn.querySelector('.fa');
    playIcon.classList.remove('fa-pause');
    playIcon.classList.add('fa-play');

    this._midiMeasureTicks = this._computeMidiMeasureTicks();

    // console.log(this._midiOnTicks());

    // let cursorLength = 0;
    // let osmd = this.getViewModel().getMusicDisplay();
    // osmd.cursor.reset()
    // let iterator = osmd.cursor.iterator;

    // let tieSet = new Set();
    // while(!iterator.endReached){
    //     let voices = iterator.currentVoiceEntries;
    //     let silentVoices = 0;
        
    //     for(var i = 0; i < voices.length; i++){
    //         let v = voices[i];
    //         let notes = v.notes;
    //         let silentNotes = 0;
    //         // console.log(v)
    //         for(var j = 0; j < notes.length; j++){
    //             let note = notes[j];
    //             // console.log(note.tie)
    //             if (note.tie) {
    //                 // console.log(note.tie)
    //                 // note.tie.forEach(function(t) {
    //                 //     tieSet.add(note.tie);
    //                 // })
    //                 tieSet.add(note.tie.notes);
    //             }
    //             // tieSet.add(note.tie.notes);
                
    //             // make sure our note is not silent
    //             if((note != null) && (note.halfTone != 0)){
    //                 // cursorLength += 1;
    //             } else {
    //                 silentNotes += 1
    //             }
    //         }
    //         if (silentNotes == notes.length) {
    //             silentVoices += 1
    //         }
    //     }
    //     if (silentVoices < voices.length) {
    //         cursorLength += 1;
    //     }
        
        
    //     iterator.moveToNext()
    // }
    // console.log(cursorLength);
    // console.log(tieSet.size);

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

SheetMusicManager.prototype._scrollToView = function(bbox) {
    let visibleTop = this._elem.scrollTop || 0;
    let visibleHeight = this._elem.clientHeight
    let visibleBottom = visibleTop + visibleHeight;

    if (bbox.y < visibleTop) {
        this._elem.scrollTop = (visibleTop - visibleHeight) + (bbox.height - (visibleTop - bbox.y));
    } else if ((bbox.y + bbox.height) > visibleBottom) {
        this._elem.scrollTop = bbox.y;
    }
};

SheetMusicManager.prototype._getMeasureBBox = function(trackIndex, measureIndex) {
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

    return {
        'x': x,
        'y': y,
        'width': width,
        'height': height
    }
};

SheetMusicManager.prototype._highlightTrackMeasure = function(bboxElem, offset, trackIndex, measureIndex, scrollIntoView) {
    if (!bboxElem) {
        return;
    }

    let bbox = this._getMeasureBBox(trackIndex, measureIndex);

    bboxElem.classList.remove('hidden');
    bboxElem.style.top = (bbox.y - offset) + 'px';
    bboxElem.style.left = (bbox.x - offset) + 'px';
    bboxElem.style.width = bbox.width + 'px';
    bboxElem.style.height = bbox.height + 'px';

    if (scrollIntoView) {
        this._scrollToView({
            'y': bbox.y - 2*offset,
            'height': bbox.height
        });
    }
};

SheetMusicManager.prototype.highlightHoriTrackMeasure = function(trackIndex, measureIndex, scrollIntoView) {
    let offset = 6; // account for borderWidth
    this._highlightTrackMeasure(this._trackbbox1, offset, trackIndex, measureIndex, scrollIntoView);
};

SheetMusicManager.prototype.highlightVertTrackMeasure = function(trackIndex, measureIndex, scrollIntoView) {
    let offset = 6; // account for borderWidth
    this._highlightTrackMeasure(this._trackbbox2, offset, trackIndex, measureIndex, scrollIntoView);
};

SheetMusicManager.prototype.highlightSelectedHoriTrackMeasure = function(trackIndex, measureIndex) {
    this._highlightTrackMeasure(this._trackbboxSelected1, 0, trackIndex, measureIndex);
};

SheetMusicManager.prototype.highlightSelectedVertTrackMeasure = function(trackIndex, measureIndex) {
    this._highlightTrackMeasure(this._trackbboxSelected2, 0, trackIndex, measureIndex);
};

SheetMusicManager.prototype.hideHoriTrackMeasure = function() {
    if (!this._trackbbox1) {
        return;
    }
    this._trackbbox1.classList.add('hidden');
};

SheetMusicManager.prototype.hideVertTrackMeasure = function() {
    if (!this._trackbbox2) {
        return;
    }
    this._trackbbox2.classList.add('hidden');
};

SheetMusicManager.prototype.hideSelectedHoriTrackMeasure = function() {
    if (!this._trackbboxSelected1) {
        return;
    }
    this._trackbboxSelected1.classList.add('hidden');
};

SheetMusicManager.prototype.hideSelectedVertTrackMeasure = function() {
    if (!this._trackbboxSelected2) {
        return;
    }
    this._trackbboxSelected2.classList.add('hidden');
};

// SheetMusicManager.prototype._initCursorIterator = function(startMeasureInd) {
//     let osmd = viewModel.getMusicDisplay();
//     osmd.cursor.resetIterator();

//     this._cursorIterator = function* () {

//     };
// };

// SheetMusicManager.prototype.moveCursorToTime = function(second) {

// };

// SheetMusicManager.prototype.moveCursorToMeasure = function(measureInd) {
//     let osmd = viewModel.getMusicDisplay();
//     this._initCursorIterator(measureInd);
//     osmd.cursor.update();
// };

SheetMusicManager.prototype.moveCursorToMeasureInd = function(measureInd) {
    let viewModel = this._musicManager.getViewModel();
    let osmd = viewModel.getMusicDisplay();
    let cursor = osmd.cursor;
    cursor.resetIterator();
    let iterator = cursor.iterator;
    let currMeasureInd = 0;

    while (currMeasureInd < measureInd && !iterator.endReached) {
        iterator.moveToNext();
        currMeasureInd = iterator.currentMeasureIndex;
    }

    cursor.update();
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

    this._trackbboxSelected1 = document.createElement('div');
    this._trackbboxSelected1.classList.add('music-track-bbox', 'music-track1-selected-bbox', 'hidden');
    this._trackbboxSelected2 = document.createElement('div');
    this._trackbboxSelected2.classList.add('music-track-bbox', 'music-track2-selected-bbox', 'hidden');

    let drawParent = osmd.cursor.cursorElement.parentElement;
    drawParent.appendChild(this._trackbbox1);
    drawParent.appendChild(this._trackbbox2);
    drawParent.appendChild(this._trackbboxSelected1);
    drawParent.appendChild(this._trackbboxSelected2);

    // osmd.cursor.hide();
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
        }).then(viewModel.loadMusicEnd.bind(viewModel));
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialRender);
    } else {
        initialRender();
    }
}

main();