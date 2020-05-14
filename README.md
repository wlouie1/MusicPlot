# FP-Music-Plot

View the Project Page [here](https://github.mit.edu/pages/6894-sp20/FP-Music-Plot/)

Play with MusicPlot [here](https://github.mit.edu/pages/6894-sp20/FP-Music-Plot/musicplot.html)

Read the paper [here](https://github.mit.edu/pages/6894-sp20/FP-Music-Plot/musicplot_paper.pdf)

Watch a video demo [here](https://youtu.be/gc5JMgvbsPM)

## Development Process
### Work Distribution
As the sole member of this project, every aspect was completed by yours truly.

### Schedule Breakdown
The task and time breakdown is roughly as follows (total time spent is ~250 hours):

1. Visual design (~5 hours): This overlaps with Interaction design and Development below, and involves playing with various layouts on paper, and trying them out in code.
2. Interaction design (~5 hours): This overlaps with Visual design and Development, and involves a lot of brainstorming and trying things out in code. Oftentimes, ideas end up being janky, too complicated to implement, or not performant when implemented in code.
3. Development (~230 hours): Around 20% the time is spent trying out and throwing out visual/interaction ideas in code, 40% of the time is spent debugging, and the remaining 40% of the time is spent on solid development that made it to the final product. On the debugging front, much of the time is spent on trying to figure out how to implement audio playback, MIDI file parsing, music sheet rendering, and syncing up the two views.
4. Paper and Video Demo (~10 hours)

## Resources
Third-party tools and data used are explicitly outlined below:

### Dataset (MIDI files)
* [Beethoven - Fur Elise (Simple)](https://www.8notes.com/scores/457.asp)
* [Beethoven - Fur Elise (Complete)](https://musescore.com/user/20846/scores/35882)
* [Bach - Aria BWV988](http://www.jsbach.net/midi/index.html)
* [Greensleeves](https://www.contemplator.com/england/grenslevs.html)
* [Super Mario Bros Overworld](https://www.khinsider.com/midi/nes/super-mario-bros.)
* [Pokemon Center RBY](https://www.khinsider.com/midi/gameboy/pokemon-red-blue-yellow-)
* [Pokemon RBY Route 1](https://www.khinsider.com/midi/gameboy/pokemon-red-blue-yellow-)
* [The Beatles - Hey Jude](https://www.youtube.com/watch?v=df7od9Mx0AQ)

### Third Party Tools
* [NProgress](https://github.com/rstacruz/nprogress): For loading progress.
* [ToneJS Midi Parser](https://github.com/Tonejs/Midi): For MIDI file parsing.
* [WebAudio Tiny GM mapped Synthesizer](https://github.com/g200kg/webaudio-tinysynth): For MIDI audio playback.
* [OpenSheetMusicDisplay](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay): For music sheet rendering.

### Miscellaneous Resources
* [Musical Note Favicon](https://favicon.io/emoji-favicons/musical-note/): For the page's favicon (browser tab icon).
* [Flaticon](https://www.flaticon.com/): For musical track instrument icons.
* [Musescore](https://musescore.org/en): For exporting MusicXML files from MIDI source, and loaded by OpenSheetMusicDisplay to render the music sheet.