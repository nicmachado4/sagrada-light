import { startFloating } from './floating.js';

const canvas = document.getElementById('scene');
const dots = document.getElementById('dots');
const gear = document.getElementById('gear');
const panel = document.getElementById('panel');
const panelList = document.getElementById('panel-list');

let dotsTimer = 0;

const controls = startFloating(canvas, {
    onIndex(i) {
        renderDots(i);
        flashDots();
        markPanel(i);
    },
});

// Dots: one per window, shown only while moving.
function renderDots(active) {
    dots.innerHTML = '';
    for (let i = 0; i < controls.count; i++) {
        const d = document.createElement('i');
        if (i === active) d.className = 'on';
        dots.appendChild(d);
    }
}
function flashDots() {
    dots.classList.add('show');
    clearTimeout(dotsTimer);
    dotsTimer = setTimeout(() => dots.classList.remove('show'), 1600);
}
renderDots(0);

// The corner object and its soft card.
controls.names.forEach((name, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = name;
    b.setAttribute('role', 'option');
    if (i === 0) b.classList.add('on');
    b.addEventListener('click', () => {
        controls.goTo(i);
        closePanel();
    });
    panelList.appendChild(b);
});
function markPanel(active) {
    [...panelList.children].forEach((b, i) => b.classList.toggle('on', i === active));
}
function closePanel() { panel.hidden = true; gear.setAttribute('aria-expanded', 'false'); }
gear.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.hidden = !panel.hidden;
    gear.setAttribute('aria-expanded', String(!panel.hidden));
});
document.addEventListener('click', (e) => {
    if (!panel.hidden && !panel.contains(e.target)) closePanel();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanel();
});
