// The Custom Stickers "Solution" illustration: the hairline Lens figure, two
// washers on a plinth that slide together as the pointer nears the seam
// between them, the lens where they cross hatched (a local addition to the
// vendored library, js/vendor/hairline.js). Driven by scroll like the Ask
// Insights figure: a virtual pointer travels in from the top left to the
// seam, so the rings close up as you scroll down and part as you scroll back.
import { lens } from '/js/vendor/hairline.js?v=8';
import { scrollDrive } from '/js/hairline-scroll.js?v=1';

const el = document.getElementById('stickers-figure');
if (el) {
  lens(el, {
    intensity: 0.5,
    theme: 'auto',
    play: false,
    label: 'Two rings that slide together until they overlap, the overlap hatched: creativity meeting Gen AI.',
  });
  scrollDrive(el, [[0, 0], [60, 70], [132, 128], [200, 166]]);
}
