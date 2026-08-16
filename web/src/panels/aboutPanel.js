// About modal — in-app data-source transparency (Phase 3 requirement: "must
// identify all the data sources used and how to access them") plus a
// one-click live demo of Test Scenario mode for anyone new to the app.

export function initAboutPanel() {
  const modal = document.getElementById('about-modal');
  const openBtn = document.getElementById('about-btn');
  const closeBtn = document.getElementById('about-close-btn');
  const demoBtn = document.getElementById('about-demo-btn');
  const testToggle = document.getElementById('test-mode-toggle');

  // scrollTop can only be set once the dialog has a layout box, i.e. after
  // showModal() — setting it while closed (display: none) is a no-op.
  openBtn.addEventListener('click', () => {
    modal.showModal();
    modal.scrollTop = 0;
  });
  closeBtn.addEventListener('click', () => modal.close());

  // Clicking the ::backdrop closes the dialog (click target === the dialog
  // itself, not any of its children).
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.close();
  });

  demoBtn.addEventListener('click', () => {
    testToggle.checked = true;
    testToggle.dispatchEvent(new Event('change'));
    modal.close();
  });
}
