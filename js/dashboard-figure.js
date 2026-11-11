// The Visualisations "Solution" illustration: the hairline Dashboard figure,
// four component tiles (list, area chart, bar chart, line chart) hovering over
// a dashboard board (a local addition to the vendored library,
// js/vendor/hairline.js). Driven by scroll like the other project figures: a
// virtual pointer travels the figure's own tour onto the board, so the tiles
// seat into their slots as you scroll and lift back off as you scroll back.
import { dashboard } from '/js/vendor/hairline.js?v=8';
import { scrollDrive } from '/js/hairline-scroll.js?v=1';

const el = document.getElementById('dashboard-figure');
if (el) {
  dashboard(el, {
    intensity: 0.5,
    theme: 'auto',
    play: false,
    label: 'Chart and list tiles that settle into a dashboard: modular insights, cutting through the noise.',
  });
  scrollDrive(el, [[400, 40], [300, 100], [181, 145], [163, 191]]);
}
