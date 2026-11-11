// The SAP Developer Platform illustration: the hairline Fold figure, a code
// editor stood on a plinth whose blocks fold shut (a local addition to the
// vendored library, js/vendor/hairline.js). Driven by scroll like the other
// project figures: as you scroll, a virtual pointer walks down the code a
// line at a time, each line going bright and the blocks it heads folding
// shut, then opening again as it moves on.
import { fold } from '/js/vendor/hairline.js?v=8';
import { scrollDrive } from '/js/hairline-scroll.js?v=1';

const el = document.getElementById('fold-figure');
if (el) {
  fold(el, {
    intensity: 0.5,
    theme: 'auto',
    play: false,
    label: 'A code editor whose blocks fold and unfold, line by line.',
  });
  const path = JSON.parse(el.dataset.hairlinePath || '[[203,100],[203,119],[203,200]]');
  scrollDrive(el, path);
}
