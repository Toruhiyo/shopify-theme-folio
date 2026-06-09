/* ============================================
   FOLIO THEME — Main JavaScript
   ============================================ */

(function () {
  'use strict';

  /* --- Sticky Header --- */
  /* Over a hero, the header is transparent (blends with the artwork) and turns
     into solid chrome once the hero scrolls past, mirroring the bizmis.ai nav. */
  const header = document.querySelector('.header');
  if (header) {
    const headerSection = header.closest('.header-section');
    const hero = document.querySelector('.hero-mosaic');
    const SCROLL_THRESHOLD = 50;
    const HERO_EXIT_OFFSET = 100;

    function updateHeaderState() {
      const scrollY = window.pageYOffset;
      if (hero) {
        const inHero = scrollY < hero.offsetHeight - HERO_EXIT_OFFSET;
        if (headerSection) headerSection.classList.toggle('is-pinned', !inHero);
        header.classList.toggle('is-transparent', inHero);
        header.classList.toggle('scrolled', !inHero);
      } else {
        header.classList.toggle('scrolled', scrollY > SCROLL_THRESHOLD);
      }
    }

    updateHeaderState();
    window.addEventListener('scroll', updateHeaderState, { passive: true });
    window.addEventListener('resize', updateHeaderState, { passive: true });
  }

  const DESKTOP_NAV_BREAKPOINT = 990;

  function isInputFocused() {
    const el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  }

  /* --- Desktop Navigation (mega menus) --- */
  class DesktopNav {
    constructor() {
      this.header = document.querySelector('[data-header]');
      if (!this.header) return;

      this.megaItems = this.header.querySelectorAll('[data-nav-mega]');
      this.activeMega = null;
      this.hoverTimeout = null;
      this.leaveTimeout = null;

      this.bindMegaItems();
      this.bindHeaderLeave();
      this.bindKeyboard();
    }

    bindMegaItems() {
      this.megaItems.forEach(item => {
        item.addEventListener('mouseenter', () => {
          clearTimeout(this.leaveTimeout);
          clearTimeout(this.hoverTimeout);
          this.hoverTimeout = setTimeout(() => this.showMega(item), 80);
        });

        item.addEventListener('mouseleave', () => {
          clearTimeout(this.hoverTimeout);
          this.leaveTimeout = setTimeout(() => this.hideMega(), 150);
        });

        const trigger = item.querySelector('.header__nav-link');
        trigger?.addEventListener('click', (e) => {
          if (window.innerWidth < DESKTOP_NAV_BREAKPOINT) return;
          if (item.classList.contains('is-mega-active')) {
            this.hideMega();
          } else {
            e.preventDefault();
            this.showMega(item);
          }
        });
      });
    }

    bindHeaderLeave() {
      this.header.addEventListener('mouseleave', () => {
        clearTimeout(this.hoverTimeout);
        this.leaveTimeout = setTimeout(() => this.hideMega(), 200);
      });
      this.header.addEventListener('mouseenter', () => clearTimeout(this.leaveTimeout));
    }

    bindKeyboard() {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.activeMega) {
          const trigger = this.activeMega.querySelector('.header__nav-link');
          this.hideMega();
          trigger?.focus();
        }
      });
    }

    showMega(item) {
      if (this.activeMega && this.activeMega !== item) this.setExpanded(this.activeMega, false);
      this.setExpanded(item, true);
      this.activeMega = item;
    }

    hideMega() {
      if (this.activeMega) {
        this.setExpanded(this.activeMega, false);
        this.activeMega = null;
      }
    }

    setExpanded(item, expanded) {
      item.classList.toggle('is-mega-active', expanded);
      const trigger = item.querySelector('[aria-expanded]');
      if (trigger) trigger.setAttribute('aria-expanded', String(expanded));
    }
  }

  /* --- Nav overflow: collapse items that don't fit into a "More" dropdown --- */
  class NavOverflow {
    constructor() {
      this.nav = document.querySelector('[data-header] .header__nav');
      this.list = document.querySelector('[data-nav-list]');
      if (!this.nav || !this.list) return;

      this.moreItem = this.list.querySelector('[data-more]');
      this.moreContent = this.list.querySelector('[data-more-content]');
      this.moreTrigger = this.list.querySelector('[data-more-trigger]');
      if (!this.moreItem || !this.moreContent || !this.moreTrigger) return;

      this.items = () => Array.from(this.list.querySelectorAll('[data-nav-item]:not([data-more])'));
      this.overflowClass = 'header__nav-item--overflow';
      this.moreActiveClass = 'header__nav-item--more-active';

      this.moreTrigger.addEventListener('click', (e) => {
        if (window.innerWidth < DESKTOP_NAV_BREAKPOINT) return;
        e.preventDefault();
        this.toggleMore();
      });
      this.moreItem.addEventListener('mouseenter', () => this.openMore());
      this.moreItem.addEventListener('mouseleave', () => this.closeMore());
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.closeMore();
      });

      this.resizeObserver = new ResizeObserver(() => this.update());
      this.resizeObserver.observe(this.nav);

      this.update();

      // Re-measure once web fonts swap in and after full load: text width
      // (and therefore overflow) changes without the nav being resized.
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => this.update());
      }
      window.addEventListener('load', () => this.update());
    }

    update() {
      if (window.innerWidth < DESKTOP_NAV_BREAKPOINT) {
        this.moreItem.setAttribute('aria-hidden', 'true');
        this.moreItem.classList.remove(this.moreActiveClass);
        this.items().forEach(el => el.classList.remove(this.overflowClass));
        return;
      }

      const itemEls = this.items();

      // Reveal every item before measuring: items hidden by a previous run
      // report a width of 0 and would corrupt the recomputation.
      itemEls.forEach(el => el.classList.remove(this.overflowClass));

      this.moreItem.removeAttribute('aria-hidden');
      const listWidth = this.list.getBoundingClientRect().width;
      const moreWidth = this.moreItem.getBoundingClientRect().width;
      const MORE_SAFETY_BUFFER = 16;
      const available = listWidth - moreWidth - MORE_SAFETY_BUFFER;

      let total = 0;
      let overflowStart = itemEls.length;

      for (let i = 0; i < itemEls.length; i++) {
        const w = itemEls[i].getBoundingClientRect().width;
        if (total + w > available) {
          overflowStart = i;
          break;
        }
        total += w;
      }

      if (overflowStart >= itemEls.length) {
        this.moreItem.setAttribute('aria-hidden', 'true');
        this.moreItem.classList.remove(this.moreActiveClass);
        this.moreContent.innerHTML = '';
        itemEls.forEach(el => el.classList.remove(this.overflowClass));
        return;
      }

      itemEls.forEach((el, i) => el.classList.toggle(this.overflowClass, i >= overflowStart));
      this.buildMoreContent(itemEls.slice(overflowStart));
      this.moreItem.removeAttribute('aria-hidden');
    }

    buildMoreContent(overflowItems) {
      const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const parts = [];
      overflowItems.forEach(item => {
        const link = item.querySelector('.header__nav-link');
        const tiles = item.querySelectorAll('.mega-menu__tile');
        const href = escape(link?.getAttribute('href') || '#');
        const title = escape(link?.textContent?.trim() || '');
        if (tiles.length > 0) {
          parts.push(`<div class="header__more-group"><a href="${href}" class="header__more-link header__more-link--parent">${title}</a>`);
          tiles.forEach(tile => {
            const tHref = escape(tile.getAttribute('href') || '#');
            const tTitle = escape(tile.querySelector('.mega-menu__tile-title')?.textContent?.trim() || tile.textContent?.trim() || '');
            parts.push(`<a href="${tHref}" class="header__more-link header__more-link--child" role="menuitem">${tTitle}</a>`);
          });
          parts.push('</div>');
        } else {
          parts.push(`<a href="${href}" class="header__more-link" role="menuitem">${title}</a>`);
        }
      });
      this.moreContent.innerHTML = parts.join('');
    }

    openMore() {
      if (!this.moreContent.innerHTML) return;
      this.moreItem.classList.add(this.moreActiveClass);
      // Lift the list's overflow clip so the dropdown can escape; hidden
      // overflow items stay display:none, so nothing else spills.
      this.list.classList.add('header__nav-list--more-open');
      this.moreTrigger.setAttribute('aria-expanded', 'true');
    }

    closeMore() {
      this.moreItem.classList.remove(this.moreActiveClass);
      this.list.classList.remove('header__nav-list--more-open');
      this.moreTrigger.setAttribute('aria-expanded', 'false');
    }

    toggleMore() {
      if (this.moreItem.classList.contains(this.moreActiveClass)) this.closeMore();
      else this.openMore();
    }
  }

  /* --- Mobile Menu (multi-level accordion) --- */
  class MobileMenu {
    constructor() {
      this.menu = document.querySelector('[data-mobile-menu]');
      if (!this.menu) return;
      this.bindEvents();
      this.initAccordions();
    }

    bindEvents() {
      document.querySelectorAll('[data-menu-toggle]').forEach(btn => {
        btn.addEventListener('click', () => this.toggle());
      });
      this.menu.querySelector('[data-menu-close]')?.addEventListener('click', () => this.close());
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen()) this.close();
      });
    }

    initAccordions() {
      this.menu.querySelectorAll('[data-mobile-accordion-trigger]').forEach(trigger => {
        trigger.addEventListener('click', () => {
          const parent = trigger.closest('[data-mobile-accordion]');
          const content = parent?.querySelector('[data-mobile-accordion-content]');
          if (!content) return;

          const isOpen = trigger.getAttribute('aria-expanded') === 'true';
          trigger.setAttribute('aria-expanded', String(!isOpen));
          content.setAttribute('aria-hidden', String(isOpen));

          if (isOpen) {
            content.style.maxHeight = '0';
          } else {
            content.style.maxHeight = content.scrollHeight + 'px';
            this.updateParentHeights(content);
          }
        });
      });
    }

    updateParentHeights(el) {
      let parent = el.parentElement?.closest('[data-mobile-accordion-content]');
      while (parent) {
        parent.style.maxHeight = parent.scrollHeight + el.scrollHeight + 'px';
        parent = parent.parentElement?.closest('[data-mobile-accordion-content]');
      }
    }

    isOpen() {
      return this.menu.classList.contains('is-open');
    }

    open() {
      this.menu.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }

    close() {
      this.menu.classList.remove('is-open');
      document.body.style.overflow = '';
    }

    toggle() {
      this.isOpen() ? this.close() : this.open();
    }
  }

  /* --- Search Overlay --- */
  class SearchOverlay {
    constructor() {
      this.overlay = document.querySelector('[data-search-overlay]');
      if (!this.overlay) return;
      this.input = this.overlay.querySelector('.search-overlay__input');
      this.bindEvents();
    }

    bindEvents() {
      document.querySelectorAll('[data-search-toggle]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.toggle();
        });
      });

      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) this.close();
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen()) this.close();
        if (e.key === '/' && !this.isOpen() && !isInputFocused()) {
          e.preventDefault();
          this.open();
        }
      });
    }

    isOpen() {
      return this.overlay.classList.contains('is-open');
    }

    open() {
      this.overlay.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      setTimeout(() => this.input?.focus(), 100);
    }

    close() {
      this.overlay.classList.remove('is-open');
      document.body.style.overflow = '';
    }

    toggle() {
      this.isOpen() ? this.close() : this.open();
    }
  }

  new DesktopNav();
  new NavOverflow();
  new MobileMenu();
  new SearchOverlay();

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
      const mainMedia = document.querySelector('[data-media-main]');
      if (!mainMedia) return;

      const img = mainMedia.querySelector('img');
      if (img) {
        const mediaSrc = thumb.dataset.mediaSrc;
        img.src = mediaSrc || thumb.querySelector('img')?.src?.replace(/&width=\d+/, '&width=1200') || '';
        img.srcset = '';
      }

      thumbs.forEach(t => t.classList.remove('is-active'));
      thumb.classList.add('is-active');
    });
  });

  /* --- Product Share --- */
  document.addEventListener('click', async (e) => {
    const shareBtn = e.target.closest('[data-product-share]');
    if (!shareBtn) return;

    const url = shareBtn.dataset.shareUrl || window.location.href;
    const title = shareBtn.dataset.shareTitle || document.title;
    const copiedText = shareBtn.dataset.shareCopied || 'Link copied';

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      const originalText = shareBtn.textContent;
      shareBtn.textContent = copiedText;
      setTimeout(() => { shareBtn.textContent = originalText; }, 2000);
    } catch (error) {
      // Clipboard unavailable
    }
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

  /* --- Drag Carousel --- */
  function initDragCarousel(el) {
    let isPointerDown = false;
    let startX = 0;
    let scrollStart = 0;
    let hasDragged = false;
    const DRAG_THRESHOLD = 8;

    function endPointer() {
      if (!isPointerDown) return;
      isPointerDown = false;
      el.classList.remove('is-dragging');
    }

    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.pointerType !== 'mouse') return;
      isPointerDown = true;
      hasDragged = false;
      startX = e.clientX;
      scrollStart = el.scrollLeft;
    });

    el.addEventListener('pointermove', (e) => {
      if (!isPointerDown) return;
      const delta = e.clientX - startX;
      if (!hasDragged) {
        if (Math.abs(delta) <= DRAG_THRESHOLD) return;
        hasDragged = true;
        el.classList.add('is-dragging');
      }
      e.preventDefault();
      el.scrollLeft = scrollStart - delta;
    });

    el.addEventListener('pointerup', endPointer);
    el.addEventListener('pointercancel', endPointer);
    el.addEventListener('lostpointercapture', endPointer);

    el.addEventListener('click', (e) => {
      if (!hasDragged) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      hasDragged = false;
    }, true);
  }

  document.querySelectorAll('.drag-carousel').forEach(initDragCarousel);

  /* --- Hero Mosaic Auto-Scroll --- */
  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function shuffleTrack(track) {
    const cards = Array.from(track.children);
    const half = Math.ceil(cards.length / 2);
    const uniqueCards = cards.slice(0, half);

    shuffleArray(uniqueCards);

    track.innerHTML = '';
    uniqueCards.forEach((card) => track.appendChild(card));
    uniqueCards.forEach((card) => track.appendChild(card.cloneNode(true)));
  }

  function initMosaicRows() {
    const rows = document.querySelectorAll('[data-mosaic-row]');
    if (!rows.length) return;

    const DEFAULT_SPEED = 120;
    const SPEED_VARIATION = [1, 0.85, 1.15, 0.95];
    const heroSection = document.querySelector('.hero-mosaic');
    const baseDuration = heroSection
      ? parseInt(heroSection.dataset.mosaicSpeed, 10) || DEFAULT_SPEED
      : DEFAULT_SPEED;

    rows.forEach((row) => {
      const track = row.querySelector('.hero-mosaic__track');
      if (!track) return;

      shuffleTrack(track);

      const isReverse = row.dataset.direction === '1';
      const rowIndex = parseInt(row.dataset.rowIndex, 10) || 0;
      const contentWidth = track.scrollWidth / 2;

      if (contentWidth <= 0) return;

      const duration = baseDuration * (SPEED_VARIATION[rowIndex % SPEED_VARIATION.length]);
      const keyframeName = 'mosaic-slide-' + rowIndex;

      const startX = isReverse ? -contentWidth : 0;
      const endX = isReverse ? 0 : -contentWidth;

      const style = document.createElement('style');
      style.textContent =
        '@keyframes ' + keyframeName + ' {' +
        '  from { transform: translateX(' + startX + 'px); }' +
        '  to   { transform: translateX(' + endX + 'px); }' +
        '}';
      document.head.appendChild(style);

      track.style.animation = keyframeName + ' ' + duration + 's linear infinite';
    });
  }

  initMosaicRows();

  /* --- Product Recommendations --- */
  const PRODUCT_RECOMMENDATIONS_PRELOAD = '200px';

  class ProductRecommendations extends HTMLElement {
    constructor() {
      super();
      this.observer = null;
      this.startObserver();
    }

    disconnectedCallback() {
      this.stopObserver();
    }

    startObserver() {
      if (!this.dataset.url || this.observer) return;

      this.observer = new IntersectionObserver(
        (entries) => {
          if (!entries[0].isIntersecting) return;
          this.stopObserver();
          this.loadRecommendations();
        },
        { rootMargin: '0px 0px ' + PRODUCT_RECOMMENDATIONS_PRELOAD + ' 0px' }
      );

      this.observer.observe(this);
    }

    stopObserver() {
      if (!this.observer) return;
      this.observer.disconnect();
      this.observer = null;
    }

    async loadRecommendations() {
      const url = this.dataset.url;
      if (!url) return;

      try {
        const response = await fetch(url);
        if (!response.ok) return;

        const text = await response.text();
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const fresh = doc.querySelector('product-recommendations');
        if (!fresh || !fresh.innerHTML.trim()) return;

        this.innerHTML = fresh.innerHTML;
      } catch (error) {
        // Recommendations unavailable; server fallback may already be present
      }
    }
  }

  if (!customElements.get('product-recommendations')) {
    customElements.define('product-recommendations', ProductRecommendations);
  }

  /* --- Product Grid (tagged collection) --- */
  class ProductGridByTag extends HTMLElement {
    constructor() {
      super();
      this.loadProducts();
    }

    async loadProducts() {
      const url = this.dataset.url;
      const sectionId = this.dataset.sectionId;
      if (!url || !sectionId) return;

      try {
        const response = await fetch(url);
        if (!response.ok) return;

        const text = await response.text();
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const section = doc.getElementById('shopify-section-' + sectionId);
        const grid = section?.querySelector('product-grid-by-tag');
        if (!grid || !grid.innerHTML.trim()) return;

        this.innerHTML = grid.innerHTML;
      } catch (error) {
        const pendingEmpty = this.querySelector('.product-grid__empty--pending');
        if (pendingEmpty) pendingEmpty.classList.remove('product-grid__empty--pending');
      }
    }
  }

  if (!customElements.get('product-grid-by-tag')) {
    customElements.define('product-grid-by-tag', ProductGridByTag);
  }

  /* --- Locale Selector --- */
  const localeSelectors = document.querySelectorAll('[data-locale-selector]');

  function closeLocaleSelectors(except) {
    localeSelectors.forEach(el => {
      if (el === except) return;
      el.classList.remove('is-open');
      const trigger = el.querySelector('.locale-selector__trigger');
      const dropdown = el.querySelector('.locale-selector__dropdown');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
      if (dropdown) dropdown.setAttribute('aria-hidden', 'true');
    });
  }

  localeSelectors.forEach(el => {
    const trigger = el.querySelector('.locale-selector__trigger');
    const dropdown = el.querySelector('.locale-selector__dropdown');
    if (!trigger || !dropdown) return;

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      closeLocaleSelectors(el);
      const isOpen = el.classList.toggle('is-open');
      trigger.setAttribute('aria-expanded', String(isOpen));
      dropdown.setAttribute('aria-hidden', String(!isOpen));
    });
  });

  if (localeSelectors.length) {
    document.addEventListener('click', () => closeLocaleSelectors(null));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeLocaleSelectors(null);
    });
  }

  /* --- Newsletter Success Confetti --- */
  function fireConfetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const viewWidth = window.innerWidth;
    const viewHeight = window.innerHeight;
    canvas.width = viewWidth * dpr;
    canvas.height = viewHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const palette = ['#2A5C42', '#3B7A57', '#CC8A1E', '#5CA87A', '#EDE8DE'];
    const PARTICLE_COUNT = 150;
    const GRAVITY = 0.32;
    const DRAG = 0.992;
    const DURATION = 2600;
    const particles = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 6 + Math.random() * 9;
      particles.push({
        x: viewWidth / 2,
        y: viewHeight * 0.32,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        size: 5 + Math.random() * 6,
        color: palette[Math.floor(Math.random() * palette.length)],
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.3
      });
    }

    const start = performance.now();

    function frame(now) {
      const elapsed = now - start;
      const fade = Math.max(0, 1 - elapsed / DURATION);
      ctx.clearRect(0, 0, viewWidth, viewHeight);

      particles.forEach(p => {
        p.vx *= DRAG;
        p.vy = p.vy * DRAG + GRAVITY;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.spin;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });

      if (elapsed < DURATION) {
        requestAnimationFrame(frame);
      } else {
        canvas.remove();
      }
    }

    requestAnimationFrame(frame);
  }

  if (document.querySelector('[data-newsletter-success]')) {
    fireConfetti();
  }

  /* --- Newsletter (submit without reloading the page) --- */
  class NewsletterForms {
    constructor() {
      document.querySelectorAll('.js-newsletter-form').forEach(form => this.bind(form));
    }

    bind(form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submit(form);
      });
    }

    submit(form) {
      const button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;

      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'text/html' }
      })
        .then(response => response.text())
        .then(html => this.render(form, html))
        // If the request can't be made, fall back to a normal submit.
        .catch(() => form.submit())
        .finally(() => { if (button) button.disabled = false; });
    }

    render(form, html) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const scope = (form.id && doc.getElementById(form.id)) || doc;
      const success = scope.querySelector('[data-newsletter-success]');
      const message = success || scope.querySelector('.form-error');

      const previous = form.querySelector('[data-newsletter-message]');
      if (previous) previous.remove();
      if (!message) return;

      message.setAttribute('data-newsletter-message', '');
      form.appendChild(message);

      if (success) {
        form.reset();
        fireConfetti();
      }
    }
  }

  new NewsletterForms();

  /* --- Initialize --- */
  updateCartCount();

})();
