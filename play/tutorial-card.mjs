// The tutorial card (PLAYABLE.md item 29): five steps in a corner, ticks as they finish, dismissible. Owner: haiku.
// tutorialHtml() is pure (tested in node); mountTutorial() adds the one element to the page and is the only DOM code.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** The card's markup for a tutorialProgress() result. Done steps get a tick; the current one is bold. */
export function tutorialHtml(progress) {
  const rows = progress.steps.map((s, i) => {
    const mark = s.done ? '&#10003;' : `${i + 1}`;
    const cls = s.done ? 'done' : i === progress.current ? 'now' : 'later';
    return `<li class="${cls}"><span class="mark">${mark}</span><span><b>${esc(s.title)}</b> ${s.done ? '' : esc(s.body)}</span></li>`;
  }).join('');
  const head = progress.finished ? 'Tutorial done. Press on, or restart for a rematch.' : 'First breakfast';
  return `<div class="tutorial-head"><b>${head}</b><button type="button" data-close aria-label="Hide the guide">x</button></div>`
    + `<ol class="tutorial-steps">${rows}</ol>`;
}

const CSS = 'position:fixed;left:12px;top:76px;width:300px;z-index:20;background:#fff8e7;color:#2a1d0c;'
  + 'border:2px solid #2a1d0c;border-radius:10px;padding:10px 12px;font:13px/1.35 system-ui,sans-serif;box-shadow:0 3px 0 #2a1d0c;';

/**
 * Adds the card to `doc` (a document). Returns { update(progress), dismiss(), el }. Once dismissed, update() keeps it
 * hidden for the rest of the match. A null progress hides it too (for example, while a replay runs).
 */
export function mountTutorial(doc) {
  const el = doc.createElement('div');
  el.id = 'tutorial';
  el.setAttribute('style', CSS);
  el.hidden = true;
  doc.body.appendChild(el);
  let dismissed = false;
  let last = '';
  const dismiss = () => { dismissed = true; el.hidden = true; };
  el.addEventListener('click', (e) => { if (e.target.closest?.('button[data-close]')) dismiss(); });
  return {
    el,
    dismiss,
    update(progress) {
      if (dismissed || !progress) { el.hidden = true; return; }
      const html = tutorialHtml(progress);
      if (html !== last) { el.innerHTML = html; last = html; }
      el.hidden = false;
    },
  };
}
