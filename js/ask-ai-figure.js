// The Ask Insights "Solution" illustration: hairline's Settle figure, twelve
// crooked tiles that slide into a tree round a hub as the pointer nears
// (vendored from @lucasmarkes/hairline 0.5.1, MIT, in js/vendor), driven by
// scroll (js/hairline-scroll.js) along the figure's own tour in to the hub.
// Theme "auto" follows the site's dark theme; colours are set in CSS on
// .pc-hairline.
import { settle } from '/js/vendor/hairline.js?v=8';
import { scrollDrive } from '/js/hairline-scroll.js?v=1';

const el = document.getElementById('ask-ai-figure');
if (el) {
  settle(el, {
    intensity: 0.5,
    theme: 'auto',
    play: false,
    label: 'Twelve scattered tiles that slide into a connected tree around a central hub.',
  });
  scrollDrive(el, [[400, 0], [360, 40], [320, 120], [203, 155]]);
}
