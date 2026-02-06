/* ============================================
   FOLIO THEME — Theme Editor Support
   Handles Shopify theme customizer events
   ============================================ */

(function () {
  'use strict';

  document.addEventListener('shopify:section:load', (e) => {
    const section = e.target;
    reinitializeSection(section);
  });

  document.addEventListener('shopify:section:unload', () => {
    // Cleanup if needed
  });

  document.addEventListener('shopify:section:reorder', () => {
    // Handle reorder if needed
  });

  document.addEventListener('shopify:block:select', (e) => {
    const block = e.target;
    block.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  function reinitializeSection(section) {
    // Re-run scroll events for header
    if (section.querySelector('.header')) {
      window.dispatchEvent(new Event('scroll'));
    }
  }
})();
