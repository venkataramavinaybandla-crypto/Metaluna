/**
 * Metalune Web Application Logic - Motion, Interaction & Accessibility
 */

// 1. Progressive Enhancement: Mark JS capability immediately
document.documentElement.classList.add('js');

document.addEventListener('DOMContentLoaded', () => {
  const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isPointerFine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Accessible Live Region for Screen Readers
  let liveRegion = document.getElementById('a11y-live-region');
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'a11y-live-region';
    liveRegion.className = 'sr-only';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    document.body.appendChild(liveRegion);
  }

  // ----------------------------------------------------
  // 2. Header Glass Intensification on Scroll (scrollY > 24)
  // ----------------------------------------------------
  const header = document.querySelector('header');
  if (header) {
    let scrollTicking = false;
    const updateHeaderGlass = () => {
      if (window.scrollY > 24) {
        header.classList.add('header-scrolled');
      } else {
        header.classList.remove('header-scrolled');
      }
      scrollTicking = false;
    };

    window.addEventListener('scroll', () => {
      if (!scrollTicking) {
        requestAnimationFrame(updateHeaderGlass);
        scrollTicking = true;
      }
    }, { passive: true });
    updateHeaderGlass();
  }

  // ----------------------------------------------------
  // 3. Mobile Navigation Menu Toggle & Drawer
  // ----------------------------------------------------
  const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileMenuIcon = document.getElementById('mobile-menu-icon');

  function openMobileMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.remove('menu-closed');
    mobileMenu.classList.add('menu-open');
    mobileMenu.setAttribute('aria-hidden', 'false');
    if (mobileMenuToggle) {
      mobileMenuToggle.setAttribute('aria-expanded', 'true');
    }
    if (mobileMenuIcon) {
      mobileMenuIcon.textContent = 'close';
    }
    document.body.style.overflow = 'hidden';
  }

  function closeMobileMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.remove('menu-open');
    mobileMenu.classList.add('menu-closed');
    mobileMenu.setAttribute('aria-hidden', 'true');
    if (mobileMenuToggle) {
      mobileMenuToggle.setAttribute('aria-expanded', 'false');
    }
    if (mobileMenuIcon) {
      mobileMenuIcon.textContent = 'menu';
    }
    document.body.style.overflow = '';
  }

  if (mobileMenuToggle && mobileMenu) {
    mobileMenuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = mobileMenu.classList.contains('menu-open');
      if (isOpen) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    });

    document.addEventListener('click', (e) => {
      if (mobileMenu.classList.contains('menu-open') && !mobileMenu.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
        closeMobileMenu();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileMenu.classList.contains('menu-open')) {
        closeMobileMenu();
        mobileMenuToggle.focus();
      }
    });

    mobileMenu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        closeMobileMenu();
      });
    });
  }

  // ----------------------------------------------------
  // 4. Smooth Scroll Navigation for Anchor Links
  // ----------------------------------------------------
  const headerHeight = 80;
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') {
        if (this.getAttribute('data-path') === 'metalune-landing') {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
      }

      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        const elementPosition = targetEl.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerHeight;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });

        if (history.pushState) {
          history.pushState(null, null, targetId);
        }
      }
    });
  });

  // ----------------------------------------------------
  // 5. Active Navigation State on Scroll
  // ----------------------------------------------------
  const navLinks = document.querySelectorAll('header nav a[href^="#"]');
  const navSections = Array.from(navLinks)
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter((sec) => sec !== null);

  if (navSections.length > 0) {
    const activeClasses = ['text-primary', 'font-title-md'];
    const inactiveClasses = ['text-on-surface-variant', 'font-body-sm'];

    const navObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const currentId = `#${entry.target.id}`;
          navLinks.forEach((link) => {
            if (link.getAttribute('href') === currentId) {
              inactiveClasses.forEach((cls) => link.classList.remove(cls));
              activeClasses.forEach((cls) => link.classList.add(cls));
            } else {
              activeClasses.forEach((cls) => link.classList.remove(cls));
              inactiveClasses.forEach((cls) => link.classList.add(cls));
            }
          });
        }
      });
    }, {
      root: null,
      rootMargin: `-${headerHeight}px 0px -50% 0px`,
      threshold: 0
    });

    navSections.forEach((section) => navObserver.observe(section));
  }

  // ----------------------------------------------------
  // 6. Card Pointer-Following Light (Radial Gradient)
  // ----------------------------------------------------
  const allCards = document.querySelectorAll(
    '#bespoke-process .rounded-\\[28px\\], #finishes-catalog .rounded-\\[28px\\], #pricing-tiers .rounded-\\[28px\\]'
  );

  allCards.forEach((card) => {
    card.classList.add('card-light-container');

    if (isPointerFine && !isReducedMotion) {
      let cardRaf = null;

      card.addEventListener('pointerenter', () => {
        card.style.setProperty('--card-light-opacity', '1');
      });

      card.addEventListener('pointermove', (e) => {
        if (cardRaf) cancelAnimationFrame(cardRaf);
        cardRaf = requestAnimationFrame(() => {
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          card.style.setProperty('--mx', `${x}px`);
          card.style.setProperty('--my', `${y}px`);
        });
      });

      card.addEventListener('pointerleave', () => {
        if (cardRaf) cancelAnimationFrame(cardRaf);
        card.style.setProperty('--card-light-opacity', '0');
      });
    }
  });

  // ----------------------------------------------------
  // 7. Live Details: Blend Ratio Bars Setup
  // ----------------------------------------------------
  const blendCard = document.querySelector('#bespoke-process .rounded-\\[28px\\]');
  const blendBars = blendCard ? blendCard.querySelectorAll('.rounded-full.bg-surface-container-highest > div') : [];
  const barTargets = ['64%', '28%', '8%'];

  if (blendBars.length === 3) {
    blendBars.forEach((bar, idx) => {
      bar.classList.add('blend-bar-animated');
      if (!isReducedMotion) {
        bar.style.width = '0%';
      } else {
        bar.style.width = barTargets[idx];
      }
    });
  }

  function animateBlendBars() {
    if (isReducedMotion || blendBars.length !== 3) return;
    setTimeout(() => {
      blendBars.forEach((bar, idx) => {
        bar.style.width = barTargets[idx];
      });
    }, 180);
  }

  // ----------------------------------------------------
  // 8. Live Details: Stats Counter ("120k+")
  // ----------------------------------------------------
  const statsSection = document.querySelector('section.bg-surface-container-low');
  const statEl120k = statsSection ? statsSection.querySelector('span.font-display-xl') : null;

  function animateCountUp() {
    if (!statEl120k || isReducedMotion) return;
    const target = 120;
    const duration = 1400; // ~1.4 seconds
    const startTime = performance.now();

    function updateCounter(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Heavy ease-out cubic easing
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentVal = Math.floor(eased * target);

      if (progress < 1) {
        statEl120k.textContent = `${currentVal}k+`;
        requestAnimationFrame(updateCounter);
      } else {
        statEl120k.textContent = '120k+'; // Exact target text
      }
    }

    requestAnimationFrame(updateCounter);
  }

  // ----------------------------------------------------
  // 9. Scroll Reveals via Single Shared IntersectionObserver
  // ----------------------------------------------------
  const revealElements = [];

  // Headings & Section intros
  document.querySelectorAll('section > div > .flex.flex-col.items-start, section > div > .flex.flex-col.items-center, section > div > .flex.flex-col.md\\:flex-row').forEach((hdr) => {
    hdr.classList.add('reveal-item');
    revealElements.push(hdr);
  });

  // Card Grids with Staggering (80ms - 120ms => 100ms)
  const cardGrids = [
    document.querySelectorAll('#bespoke-process .grid > .rounded-\\[28px\\]'),
    document.querySelectorAll('#finishes-catalog .grid > .rounded-\\[28px\\]'),
    document.querySelectorAll('section.bg-surface-container-low .grid > div'),
    document.querySelectorAll('#pricing-tiers .grid > .rounded-\\[28px\\]'),
    document.querySelectorAll('section:last-of-type > .max-w-6xl')
  ];

  cardGrids.forEach((group) => {
    group.forEach((item, index) => {
      item.classList.add('reveal-item');
      item.style.setProperty('--reveal-delay', `${index * 100}ms`);
      revealElements.push(item);
    });
  });

  if (!isReducedMotion) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);

          // Trigger Blend bars if the Blend card was revealed
          if (entry.target === blendCard || entry.target.contains(blendCard)) {
            animateBlendBars();
          }

          // Trigger Count-up if stats column was revealed
          if (statEl120k && (entry.target.contains(statEl120k) || entry.target === statEl120k.parentElement)) {
            animateCountUp();
          }
        }
      });
    }, {
      root: null,
      rootMargin: '0px 0px -40px 0px',
      threshold: 0.12
    });

    revealElements.forEach((el) => revealObserver.observe(el));
  } else {
    // Under reduced motion: reveal everything immediately
    revealElements.forEach((el) => el.classList.add('revealed'));
  }

  // ----------------------------------------------------
  // 10. Copy Token Buttons (Archive Swatches)
  // ----------------------------------------------------
  // Token Definitions synthesized from DESIGN.md alloy hexes and card composition
  const finishTokens = {
    'boreal lilac': ':root {\n  --finish-boreal-lilac: linear-gradient(135deg, #7B6FD0 0%, #A89CF2 35%, #D6CEFF 70%, #AEB3D1 85%, #DCDFF2 95%, #F6F7FF 100%);\n}',
    'glaucous mirror': ':root {\n  --finish-glaucous-mirror: linear-gradient(135deg, #55689A 0%, #7C93C9 42%, #B4C4EC 85%, #AEB3D1 92%, #DCDFF2 96%, #F6F7FF 100%);\n}',
    'snow alloy 04': ':root {\n  --finish-snow-alloy-04: linear-gradient(135deg, #AEB3D1 0%, #DCDFF2 50%, #F6F7FF 100%);\n}',
    'imperial violet': ':root {\n  --finish-imperial-violet: linear-gradient(135deg, #7B6FD0 0%, #A89CF2 30%, #D6CEFF 60%, #55689A 75%, #7C93C9 90%, #B4C4EC 100%);\n}',
    'cold titanium': ':root {\n  --finish-cold-titanium: linear-gradient(135deg, #55689A 0%, #7C93C9 25%, #B4C4EC 50%, #AEB3D1 75%, #DCDFF2 90%, #F6F7FF 100%);\n}',
    'astral mercury': ':root {\n  --finish-astral-mercury: linear-gradient(135deg, #7B6FD0 0%, #A89CF2 18%, #D6CEFF 35%, #AEB3D1 50%, #DCDFF2 65%, #F6F7FF 75%, #55689A 85%, #7C93C9 95%, #B4C4EC 100%);\n}'
  };

  async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) {
        // Fallback below
      }
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    let success = false;
    try {
      success = document.execCommand('copy');
    } catch (e) {
      success = false;
    }
    document.body.removeChild(textArea);
    return success;
  }

  const copyButtons = document.querySelectorAll('#finishes-catalog button');
  copyButtons.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const card = btn.closest('.rounded-\\[28px\\]');
      const titleEl = card ? card.querySelector('h4') : null;
      const finishName = titleEl ? titleEl.textContent.trim() : 'finish';
      const key = finishName.toLowerCase();

      const snippet = finishTokens[key] || `:root {\n  --finish-${finishName.toLowerCase().replace(/\s+/g, '-')}: linear-gradient(135deg, #A89CF2 0%, #7C93C9 50%, #DCDFF2 100%);\n}`;

      await copyToClipboard(snippet);

      // Visual Feedback: Change label to "COPIED" for 1600ms
      const origText = btn.textContent;
      btn.textContent = 'COPIED';
      btn.classList.add('bg-primary', 'text-on-primary');

      // Accessibility announcement
      if (liveRegion) {
        liveRegion.textContent = `Copied ${finishName} token`;
      }

      setTimeout(() => {
        btn.textContent = origText;
        btn.classList.remove('bg-primary', 'text-on-primary');
      }, 1600);
    });
  });
});
