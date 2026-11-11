// The Canvas Insights "Solution" illustration: the hairline Layers figure,
// three rounded plates floating apart, the top one a card with hatched wells
// (a local addition to the vendored library, js/vendor/hairline.js). Driven
// by scroll like the other project figures: a virtual pointer crosses the
// stage left to right, so the plates stack down onto one another as you
// scroll and float apart again as you scroll back.
import { layers } from '/js/vendor/hairline.js?v=8';
import { scrollDrive } from '/js/hairline-scroll.js?v=1';

const el = document.getElementById('canvas-figure');
if (el) {
  layers(el, {
    intensity: 0.5,
    theme: 'auto',
    play: false,
    label: 'Three floating plates that stack down into one card, the insight components layering together.',
  });
  scrollDrive(el, [[0, 100], [120, 120], [300, 200], [400, 230]]);
}
