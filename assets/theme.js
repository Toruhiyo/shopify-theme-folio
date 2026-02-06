/* ============================================
   FOLIO THEME — Main JavaScript
   ============================================ */

(function () {
  'use strict';

  /* --- Sticky Header --- */
  const header = document.querySelector('.header');
  if (header) {
    const SCROLL_THRESHOLD = 50;
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
      const currentScroll = window.pageYOffset;
      header.classList.toggle('scrolled', currentScroll > SCROLL_THRESHOLD);
      lastScroll = currentScroll;
    }, { passive: true });
  }

  /* --- Mobile Menu --- */
  const mobileMenuToggle = document.querySelector('[data-mobile-menu-toggle]');
  const mobileMenu = document.querySelector('[data-mobile-menu]');
  const mobileMenuOverlay = document.querySelector('[data-mobile-menu-overlay]');
  const mobileMenuClose = document.querySelector('[data-mobile-menu-close]');

  function openMobileMenu() {
    if (!mobileMenu || !mobileMenuOverlay) return;
    mobileMenu.classList.add('is-open');
    mobileMenuOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    trapFocus(mobileMenu);
  }

  function closeMobileMenu() {
    if (!mobileMenu || !mobileMenuOverlay) return;
    mobileMenu.classList.remove('is-open');
    mobileMenuOverlay.classList.remove('is-open');
    document.body.style.overflow = '';
    if (mobileMenuToggle) mobileMenuToggle.focus();
  }

  if (mobileMenuToggle) mobileMenuToggle.addEventListener('click', openMobileMenu);
  if (mobileMenuClose) mobileMenuClose.addEventListener('click', closeMobileMenu);
  if (mobileMenuOverlay) mobileMenuOverlay.addEventListener('click', closeMobileMenu);

  /* --- Cart Drawer --- */
  const cartDrawer = document.querySelector('[data-cart-drawer]');
  const cartDrawerOverlay = document.querySelector('[data-cart-drawer-overlay]');
  const cartDrawerClose = document.querySelector('[data-cart-drawer-close]');
  const cartToggles = document.querySelectorAll('[data-cart-toggle]');

  function openCartDrawer() {
    if (!cartDrawer || !cartDrawerOverlay) return;
    cartDrawer.classList.add('is-open');
    cartDrawerOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    trapFocus(cartDrawer);
  }

  function closeCartDrawer() {
    if (!cartDrawer || !cartDrawerOverlay) return;
    cartDrawer.classList.remove('is-open');
    cartDrawerOverlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  cartToggles.forEach(toggle => toggle.addEventListener('click', openCartDrawer));
  if (cartDrawerClose) cartDrawerClose.addEventListener('click', closeCartDrawer);
  if (cartDrawerOverlay) cartDrawerOverlay.addEventListener('click', closeCartDrawer);

  /* --- Escape Key Handler --- */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMobileMenu();
      closeCartDrawer();
    }
  });

  /* --- Cart API --- */
  const CartAPI = {
    async getCart() {
      const response = await fetch('/cart.js');
      return response.json();
    },

    async addItem(variantId, quantity = 1) {
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: variantId, quantity })
      });
      return response.json();
    },

    async updateItem(key, quantity) {
      const response = await fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: key, quantity })
      });
      return response.json();
    },

    async removeItem(key) {
      return this.updateItem(key, 0);
    }
  };

  /* --- Add to Cart --- */
  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('[data-product-form]');
    if (!form) return;
    e.preventDefault();

    const submitBtn = form.querySelector('[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = submitBtn.dataset.addingText || 'Adding...';

    try {
      const formData = new FormData(form);
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Failed to add item');

      await refreshCartDrawer();
      openCartDrawer();
      updateCartCount();
    } catch (error) {
      submitBtn.textContent = 'Error — try again';
      setTimeout(() => { submitBtn.textContent = originalText; }, 2000);
    } finally {
      submitBtn.disabled = false;
      setTimeout(() => { submitBtn.textContent = originalText; }, 1500);
    }
  });

  /* --- Cart Drawer Quantity & Remove --- */
  document.addEventListener('click', async (e) => {
    const quantityBtn = e.target.closest('[data-cart-quantity]');
    if (quantityBtn) {
      const key = quantityBtn.dataset.cartKey;
      const action = quantityBtn.dataset.cartQuantity;
      const valueEl = quantityBtn.parentElement.querySelector('[data-cart-quantity-value]');
      let quantity = parseInt(valueEl.textContent, 10);

      if (action === 'minus') quantity = Math.max(0, quantity - 1);
      if (action === 'plus') quantity += 1;

      await CartAPI.updateItem(key, quantity);
      await refreshCartDrawer();
      updateCartCount();
      return;
    }

    const removeBtn = e.target.closest('[data-cart-remove]');
    if (removeBtn) {
      const key = removeBtn.dataset.cartRemove;
      await CartAPI.removeItem(key);
      await refreshCartDrawer();
      updateCartCount();
    }
  });

  /* --- Refresh Cart Drawer --- */
  async function refreshCartDrawer() {
    const drawer = document.querySelector('[data-cart-drawer]');
    if (!drawer) return;

    try {
      const response = await fetch('/?section_id=cart-drawer');
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const newDrawerContent = doc.querySelector('[data-cart-drawer]');
      if (newDrawerContent) {
        drawer.innerHTML = newDrawerContent.innerHTML;
      }
    } catch (error) {
      // Silently fail — cart will refresh on page reload
    }
  }

  /* --- Update Cart Count Badge --- */
  async function updateCartCount() {
    try {
      const cart = await CartAPI.getCart();
      const badges = document.querySelectorAll('[data-cart-count]');
      badges.forEach(badge => {
        badge.textContent = cart.item_count;
        badge.style.display = cart.item_count > 0 ? '' : 'none';
      });
    } catch (error) {
      // Silently fail
    }
  }

  /* --- Product Variant Selector --- */
  const variantSelectors = document.querySelectorAll('[data-variant-select]');
  variantSelectors.forEach(selector => {
    const buttons = selector.querySelectorAll('[data-option-value]');
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        buttons.forEach(btn => btn.classList.remove('is-selected'));
        button.classList.add('is-selected');

        const optionIndex = selector.dataset.optionIndex;
        const value = button.dataset.optionValue;
        const productForm = button.closest('[data-product-form]');
        if (productForm) {
          updateVariant(productForm, optionIndex, value);
        }
      });
    });
  });

  function updateVariant(form, optionIndex, value) {
    const variantJson = form.querySelector('[data-variant-json]');
    if (!variantJson) return;

    const variants = JSON.parse(variantJson.textContent);
    const selectedOptions = [];
    form.querySelectorAll('[data-variant-select]').forEach(selector => {
      const selected = selector.querySelector('.is-selected');
      if (selected) selectedOptions.push(selected.dataset.optionValue);
    });

    const matchedVariant = variants.find(variant =>
      variant.options.every((opt, i) => opt === selectedOptions[i])
    );

    if (matchedVariant) {
      const variantInput = form.querySelector('[name="id"]');
      if (variantInput) variantInput.value = matchedVariant.id;

      const priceEl = form.closest('.product__info')?.querySelector('.product__price');
      if (priceEl) {
        priceEl.textContent = formatMoney(matchedVariant.price);
      }

      const compareEl = form.closest('.product__info')?.querySelector('.product__price--compare');
      if (compareEl) {
        if (matchedVariant.compare_at_price && matchedVariant.compare_at_price > matchedVariant.price) {
          compareEl.textContent = formatMoney(matchedVariant.compare_at_price);
          compareEl.style.display = '';
        } else {
          compareEl.style.display = 'none';
        }
      }

      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = !matchedVariant.available;
        submitBtn.textContent = matchedVariant.available
          ? (submitBtn.dataset.addText || 'Add to Cart')
          : 'Sold Out';
      }
    }
  }

  /* --- Product Thumbnail Gallery --- */
  const thumbs = document.querySelectorAll('[data-media-thumb]');
  thumbs.forEach(thumb => {
    thumb.addEventListener('click', () => {
      const mediaId = thumb.dataset.mediaThumb;
      const mainMedia = document.querySelector('[data-media-main]');
      if (!mainMedia) return;

      const img = mainMedia.querySelector('img');
      if (img) {
        img.src = thumb.querySelector('img')?.src?.replace(/&width=\d+/, '&width=800') || '';
        img.srcset = '';
      }

      thumbs.forEach(t => t.classList.remove('is-active'));
      thumb.classList.add('is-active');
    });
  });

  /* --- Quantity Selector --- */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-quantity-btn]');
    if (!btn) return;

    const input = btn.parentElement.querySelector('[data-quantity-input]');
    if (!input) return;

    let value = parseInt(input.value, 10) || 1;
    if (btn.dataset.quantityBtn === 'minus') value = Math.max(1, value - 1);
    if (btn.dataset.quantityBtn === 'plus') value += 1;

    input.value = value;
    input.dispatchEvent(new Event('change'));
  });

  /* --- Focus Trap --- */
  function trapFocus(container) {
    const focusable = container.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    first.focus();

    container.addEventListener('keydown', function handler(e) {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }

  /* --- Money Formatter --- */
  function formatMoney(cents) {
    const amount = (cents / 100).toFixed(2);
    const moneyFormat = window.Shopify?.locale === 'en'
      ? `$${amount}`
      : `$${amount}`;
    return moneyFormat;
  }

  /* --- Initialize --- */
  updateCartCount();

})();
