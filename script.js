      // Loading screen handler - fade out when page is ready
      (function() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (!loadingScreen) return;
        
        // Hide loading screen after DOM + critical assets loaded
        function hideLoadingScreen() {
          loadingScreen.classList.add('loaded');
          setTimeout(() => {
            loadingScreen.style.display = 'none';
          }, 600); // Match CSS transition duration
        }
        
        // Check if already loaded
        if (document.readyState === 'complete') {
          setTimeout(hideLoadingScreen, 100);
        } else {
          window.addEventListener('load', () => {
            setTimeout(hideLoadingScreen, 200);
          });
        }
        
        // Fallback: hide after 3 seconds regardless
        setTimeout(hideLoadingScreen, 3000);
      })();
      // Motion & input helpers
      const __motionQuery = (typeof window !== 'undefined' && typeof window.matchMedia === 'function')
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
      const __pointerQuery = (typeof window !== 'undefined' && typeof window.matchMedia === 'function')
        ? window.matchMedia('(pointer: coarse)')
        : null;
      function userPrefersReducedMotion() {
        return __motionQuery ? __motionQuery.matches : false;
      }
      function userHasCoarsePointer() {
        return __pointerQuery ? __pointerQuery.matches : false;
      }

      // Device capability detection for adaptive performance
      const DeviceCapabilities = (function() {
        const ua = navigator.userAgent || '';
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
        const isTablet = /(iPad|tablet|playbook|silk)|(android(?!.*mobile))/i.test(ua);
        const isLowEndDevice = /Android ([1-4]\.|5\.[0-1])|MSIE [6-9]|Windows Phone|Trident\/[4-7]/i.test(ua);
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // Estimate device tier based on available metrics
        function estimateDeviceTier() {
          let score = 10; // Start optimistic
          
          // Check CPU cores
          const cores = navigator.hardwareConcurrency || 2;
          if (cores <= 2) score -= 3;
          else if (cores <= 4) score -= 1;
          
          // Check memory (if available)
          if (navigator.deviceMemory) {
            if (navigator.deviceMemory <= 2) score -= 3;
            else if (navigator.deviceMemory <= 4) score -= 1;
          }
          
          // Mobile devices typically lower tier
          if (isMobile && !isTablet) score -= 2;
          if (isLowEndDevice) score -= 4;
          
          // Check for older Safari/Chrome versions
          const safariVersion = ua.match(/Version\/(\d+)/);
          const chromeVersion = ua.match(/Chrome\/(\d+)/);
          if (safariVersion && parseInt(safariVersion[1]) < 13) score -= 2;
          if (chromeVersion && parseInt(chromeVersion[1]) < 80) score -= 2;
          
          // Classify into tiers
          if (score >= 8) return 'high';
          if (score >= 5) return 'medium';
          return 'low';
        }
        
        // Battery/power save detection
        function checkLowPowerMode(callback) {
          if (!('getBattery' in navigator)) {
            callback(false);
            return;
          }
          navigator.getBattery().then(battery => {
            const isLowPower = battery.charging === false && battery.level < 0.2;
            callback(isLowPower);
            battery.addEventListener('levelchange', () => {
              const nowLowPower = battery.charging === false && battery.level < 0.2;
              if (nowLowPower !== isLowPower) callback(nowLowPower);
            });
          }).catch(() => callback(false));
        }
        
        // Connection speed detection
        function getConnectionSpeed() {
          const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
          if (!conn) return 'unknown';
          
          const effectiveType = conn.effectiveType;
          if (effectiveType === 'slow-2g' || effectiveType === '2g') return 'slow';
          if (effectiveType === '3g') return 'medium';
          return 'fast';
        }
        
        const tier = estimateDeviceTier();
        const connectionSpeed = getConnectionSpeed();
        
        return {
          isMobile,
          isTablet,
          isLowEndDevice,
          isTouchDevice,
          tier,
          connectionSpeed,
          cores: navigator.hardwareConcurrency || 2,
          memory: navigator.deviceMemory || null,
          checkLowPowerMode,
          
          // Performance budgets based on tier
          getParticleLimit() {
            if (userPrefersReducedMotion()) return 0;
            if (tier === 'low') return 15;
            if (tier === 'medium') return 40;
            return 80;
          },
          
          getTargetFPS() {
            if (tier === 'low') return 30;
            if (tier === 'medium') return 45;
            return 60;
          },
          
          shouldUseAdvancedEffects() {
            return tier === 'high' && !isMobile;
          },
          
          getCanvasScale() {
            if (tier === 'low') return 0.5;
            if (isMobile) return 0.75;
            return 1;
          },
          
          // Viewport-based scaling for responsive effects
          getViewportScale() {
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const baseWidth = 1920; // Desktop baseline
            const baseHeight = 1080;
            
            // Scale based on smaller dimension for consistent sizing
            const widthScale = vw / baseWidth;
            const heightScale = vh / baseHeight;
            const scale = Math.min(widthScale, heightScale);
            
            // Clamp between 0.3 and 1.2 for reasonable bounds
            return Math.max(0.3, Math.min(1.2, scale));
          },
          
          // Device-specific burst particle count multiplier
          getBurstScale() {
            if (tier === 'low' || isMobile) return 0.4;
            if (tier === 'medium' || isTablet) return 0.65;
            return 1;
          }
        };
      })();

      // Global Animation Throttling System for low-end devices
      const AnimationThrottle = (function() {
        let lastFrameTime = 0;
        const targetFPS = DeviceCapabilities.getTargetFPS();
        const frameInterval = 1000 / targetFPS;
        
        return {
          shouldSkipFrame: function(currentTime) {
            if (DeviceCapabilities.tier === 'high') return false; // No throttling for high-end devices
            
            if (currentTime - lastFrameTime < frameInterval) {
              return true; // Skip this frame
            }
            lastFrameTime = currentTime;
            return false;
          },
          
          getTargetFPS: function() {
            return targetFPS;
          }
        };
      })();

      // Scroll positioning — respect anchors and session restore while keeping hero reveal intact
      (function() {
        if ('scrollRestoration' in history) {
          history.scrollRestoration = 'manual';
        }
        const reset = () => {
          if (location.hash) return;
          try {
            window.scrollTo({ top: 0, behavior: 'auto' });
          } catch (_) {
            window.scrollTo(0, 0);
          }
        };
        if (document.readyState === 'complete') {
          reset();
        } else {
          window.addEventListener('load', reset, { once: true });
        }
      })();

  // Console Easter Egg — because developers deserve nice things too
      // console hello (yes, this is definitely written by a human)
      console.log('%cHello, curious developer.', 'font-size: 16px; font-weight: bold; color: #fff;');
      console.log('%cYou\'re poking around the code? Nice. The command palette (Cmd/Ctrl+K) is worth a look.', 'font-size: 12px; color: #bbb;');
      console.log('%cP.S. There are easter eggs hidden around. Keep exploring.', 'font-size: 11px; color: #999; font-style: italic;');

      // Cross-browser rAF polyfill
      window.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || function(cb){ return setTimeout(function(){ cb(Date.now()); }, 16); };
      window.cancelAnimationFrame = window.cancelAnimationFrame || window.webkitCancelAnimationFrame || window.mozCancelAnimationFrame || clearTimeout;

      // Progressive image hints — ensure non-critical imagery is lazy + async decoded
      (function() {
        const mark = () => {
          document.querySelectorAll('img').forEach(img => {
            if (img.dataset.priority === 'hero') return;
            if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
            if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
          });
        };
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', mark, { once: true });
        } else {
          mark();
        }
      })();

      // Smooth nav active underline on scroll + smooth anchor easing
      // This function makes the nav feel alive — active states that actually make sense!
      // Pro tip: The offset calculation accounts for sticky header, because details matter.
      (function() {
        // Input-mode detection: coarse pointer (touch), or TV-like devices (no hover)
        try {
          if (window.matchMedia('(pointer: coarse)').matches) document.documentElement.classList.add('coarse');
          const noHover = window.matchMedia('(hover: none)').matches;
          const big = Math.max(window.innerWidth, window.innerHeight) >= 1800;
          if (noHover && big) document.documentElement.classList.add('tv');
        } catch (_) {}

        const links = Array.from(document.querySelectorAll('nav a'));
        const sections = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
        // add simple helpful tooltips for nav
        links.forEach(a => {
          if (!a.getAttribute('data-tooltip')) {
            const txt = a.textContent && a.textContent.trim();
            if (txt) a.setAttribute('data-tooltip', 'Go to ' + txt);
          }
        });
        const setActive = () => {
          const y = window.scrollY + 120; // header offset
          let current = null;
          for (const section of sections) {
            if (section.offsetTop <= y) current = section;
          }
          links.forEach(a => a.classList.toggle('active', current && a.getAttribute('href') === '#' + current.id));
        };
        window.addEventListener('scroll', setActive, { passive: true });
        window.addEventListener('load', setActive);

        // Custom smooth anchor scrolling with ease - optimized for performance
        function easeOutCubic(x){ return 1 - Math.pow(1 - x, 3); }
        let __scrollAnimId = 0;
        function smoothScrollTo(targetY, duration = 350) {
          if (userPrefersReducedMotion() || duration <= 0) {
            window.__isSmoothScrolling = false;
            window.scrollTo({ top: targetY, behavior: 'auto' });
            return;
          }
          __scrollAnimId++;
          const myId = __scrollAnimId;
          const startY = window.scrollY;
          const delta = targetY - startY;
          
          // If distance is very small, just jump instantly
          if (Math.abs(delta) < 15) {
            window.scrollTo(0, targetY);
            window.__isSmoothScrolling = false;
            return;
          }
          
          const start = performance.now();
          window.__isSmoothScrolling = true;
          let rafId;
          let lastScroll = startY;
          
          const step = (now) => {
            if (myId !== __scrollAnimId) {
              window.__isSmoothScrolling = false;
              return;
            }
            const p = Math.min(1, (now - start) / duration);
            const eased = easeOutCubic(p);
            const newScroll = Math.round(startY + delta * eased);
            
            // Only scroll if position actually changed
            if (newScroll !== lastScroll) {
              window.scrollTo(0, newScroll);
              lastScroll = newScroll;
            }
            
            if (p < 1) {
              rafId = requestAnimationFrame(step);
            } else {
              window.__isSmoothScrolling = false;
            }
          };
          
          rafId = requestAnimationFrame(step);
          
          // Cancel on user interaction
          const cancel = () => { 
            __scrollAnimId++;
            window.__isSmoothScrolling = false;
            if (rafId) cancelAnimationFrame(rafId);
          };
          window.addEventListener('wheel', cancel, { passive: true, once: true });
          window.addEventListener('touchstart', cancel, { passive: true, once: true });
          window.addEventListener('keydown', cancel, { passive: true, once: true });
        }
        document.querySelectorAll('a[href^="#"]').forEach(a => {
          // Skip buttons that have custom fire highlight handlers
          if (a.classList.contains('btn') && 
              (a.textContent.includes('work together') || 
               a.textContent.includes('Collaborate') || 
               a.textContent.includes('Projects'))) {
            return; // These are handled by fire highlight function
          }
          
          a.addEventListener('click', e => {
            const href = a.getAttribute('href');
            const el = href && document.querySelector(href);
            if (el) {
              e.preventDefault();
              const y = Math.max(0, el.offsetTop - 70);
              smoothScrollTo(y);
            }
          });
        });

        window.smoothScrollTo = smoothScrollTo;
      })();

      // FAQ live search — instant filter with polite results updates
      (function(){
        const input = document.getElementById('faqSearch');
        const counter = document.getElementById('faqSearchCount');
        const container = document.querySelector('#faq .faq-list');
        if (!input || !container) return;
        const items = Array.from(container.querySelectorAll('.faq-item'));
        function normalize(s){ return (s || '').toLowerCase().trim(); }
        function filter(){
          const q = normalize(input.value);
          let shown = 0;
          items.forEach(d => {
            const text = normalize(d.textContent);
            const match = q.length === 0 || text.includes(q);
            d.style.display = match ? '' : 'none';
            if (match) shown++;
          });
          if (counter) counter.textContent = q ? `${shown} result${shown===1?'':'s'} for “${input.value}”` : 'Type to filter. I’ll find it (probably).';
        }
        input.addEventListener('input', filter);
        // Keyboard niceties
        input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { input.value=''; filter(); input.blur(); } });
      })();

      // FAQ particle effects — enhance interactions with sparkles when opening items
      (function(){
        const container = document.querySelector('#faq .faq-list');
        if (!container) return;

        // Listen for FAQ item toggle events
        container.addEventListener('toggle', (e) => {
          if (!(e.target instanceof HTMLDetailsElement)) return;

          // Only spawn particles when opening (not closing) and respecting device capabilities
          if (e.target.open && typeof window.spawnButtonParticles === 'function') {
            // Skip particle effects on low-end devices or when performance is critical
            if (DeviceCapabilities.tier === 'low' || window.__isSmoothScrolling) return;
            
            // Create a fake button element at the question position for particle spawning
            const summary = e.target.querySelector('.faq-question');
            if (summary) {
              const rect = summary.getBoundingClientRect();
              const fakeBtn = {
                getBoundingClientRect: () => ({
                  left: rect.left + rect.width / 2 - 30,
                  top: rect.top + rect.height / 2 - 15,
                  width: 60,
                  height: 30
                })
              };
              window.spawnButtonParticles(fakeBtn);
            }
          }
        });
      })();

      // Intersection reveal — because scroll animations should be smooth, not jarring
      // Uses Intersection Observer because we're living in 2024, not 2010.
      // Staggered delays make it feel organic, like content appearing naturally.
      (function() {
        const els = document.querySelectorAll('.reveal');
        const io = new IntersectionObserver(entries => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              // Use requestAnimationFrame for smoother reveal
              requestAnimationFrame(() => {
                entry.target.classList.add('visible');
              });
              io.unobserve(entry.target);
            }
          }
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
        els.forEach((el, i) => {
          el.style.transitionDelay = (i * 30) + 'ms'; // Reduced stagger for faster feel
          io.observe(el);
        });
      })();

      // Hover parallax light on project thumbs with smooth cursor follow
      // Now runs only while the pointer is active to keep the main thread cool
      (function() {
        const thumbs = document.querySelectorAll('[data-thumb]');
        if (!thumbs.length) return;
        
        // Skip parallax effects on low-end and medium devices for better performance
        if (DeviceCapabilities.tier === 'low' || DeviceCapabilities.tier === 'medium') return;
        
        if (userPrefersReducedMotion()) {
          thumbs.forEach(el => {
            el.style.setProperty('--mx', '50%');
            el.style.setProperty('--my', '50%');
          });
        } else {
          const lerp = (a, b, t) => a + (b - a) * t;
          const states = new WeakMap();

          function ensureLoop(el) {
            const state = states.get(el);
            if (!state || state.rafId) return;
            const tick = () => {
              const nextX = lerp(state.currentX, state.targetX, 0.3); // Snappier response
              const nextY = lerp(state.currentY, state.targetY, 0.3);
              state.currentX = nextX;
              state.currentY = nextY;
              el.style.setProperty('--mx', nextX.toFixed(0) + '%'); // Round to reduce repaints
              el.style.setProperty('--my', nextY.toFixed(0) + '%');

              const done = Math.abs(nextX - state.targetX) < 1 && Math.abs(nextY - state.targetY) < 1 && !state.active;
              if (done) {
                state.currentX = state.targetX;
                state.currentY = state.targetY;
                el.style.setProperty('--mx', state.targetX.toFixed(0) + '%');
                el.style.setProperty('--my', state.targetY.toFixed(0) + '%');
                state.rafId = null;
                return;
              }
              state.rafId = requestAnimationFrame(tick);
            };
            state.rafId = requestAnimationFrame(tick);
          }

          thumbs.forEach(el => {
            const state = {
              targetX: 50,
              targetY: 50,
              currentX: 50,
              currentY: 50,
              rafId: null,
              active: false
            };
            states.set(el, state);
            el.style.setProperty('--mx', '50%');
            el.style.setProperty('--my', '50%');

            el.addEventListener('pointerenter', e => {
              state.active = true;
              const rect = el.getBoundingClientRect();
              state.targetX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 100;
              state.targetY = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 100;
              ensureLoop(el);
            });
            // Use RAF for smooth, non-blocking updates
            let rafId = null;
            el.addEventListener('pointermove', e => {
              if (rafId) return; // Skip if update already queued
              const rect = el.getBoundingClientRect();
              const newX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 100;
              const newY = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 100;
              // Only update if significantly different
              if (Math.abs(newX - state.targetX) < 3 && Math.abs(newY - state.targetY) < 3) return;
              rafId = requestAnimationFrame(() => {
                state.targetX = newX;
                state.targetY = newY;
                ensureLoop(el);
                rafId = null;
              });
            }, { passive: true });
            el.addEventListener('pointerleave', () => {
              if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
              state.active = false;
              state.targetX = 50;
              state.targetY = 50;
              ensureLoop(el);
            });
          });
        }

        const interactiveCards = document.querySelectorAll('.card');
        const enableCardFollow = !userPrefersReducedMotion() && !userHasCoarsePointer() && DeviceCapabilities.tier === 'high';
        interactiveCards.forEach(card => {
          card.style.setProperty('--mx', '50%');
          card.style.setProperty('--my', '0%');
          if (!enableCardFollow) return;
          
          // Throttle card pointer movement for performance - use RAF for smooth updates
          let rafId = null;
          let lastX = 50, lastY = 0;
          card.addEventListener('pointermove', e => {
            if (rafId) return; // Skip if already scheduled
            const rect = card.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 100;
            const y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 100;
            // Only update if moved significantly (reduces jitter)
            if (Math.abs(x - lastX) < 2 && Math.abs(y - lastY) < 2) return;
            lastX = x; lastY = y;
            rafId = requestAnimationFrame(() => {
              card.style.setProperty('--mx', x.toFixed(0) + '%');
              card.style.setProperty('--my', y.toFixed(0) + '%');
              rafId = null;
            });
          }, { passive: true });
          card.addEventListener('pointerleave', () => {
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
            card.style.setProperty('--mx', '50%');
            card.style.setProperty('--my', '0%');
            lastX = 50; lastY = 0;
          }, { passive: true });
        });

        // TV/keyboard navigation for project cards
        (function(){
          const grid = document.querySelector('#projects .grid');
          if (!grid) return;
          const items = Array.from(grid.querySelectorAll('.card'));
          items.forEach((it, i) => {
            it.setAttribute('tabindex', '0');
            it.dataset.index = String(i);
          });
          function moveFocus(current, dx, dy){
            if (!current) return;
            const idx = Number(current.dataset.index || '0');
            const cols = Math.max(1, Math.round(grid.clientWidth / (grid.firstElementChild?.clientWidth || 1)));
            let next = idx;
            if (dx) next = idx + dx; if (dy) next = idx + dy * cols;
            next = Math.max(0, Math.min(items.length - 1, next));
            const el = items[next];
            if (el) { el.focus({ preventScroll: false }); }
          }
          grid.addEventListener('keydown', (e) => {
            const cur = document.activeElement?.closest?.('.card');
            if (!cur) return;
            if (e.key === 'ArrowRight') { e.preventDefault(); moveFocus(cur, 1, 0); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); moveFocus(cur, -1, 0); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(cur, 0, 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(cur, 0, -1); }
            else if (e.key === 'Enter') {
              const link = cur.querySelector('[data-open-modal]') || cur.querySelector('a');
              if (link) { e.preventDefault(); (link instanceof HTMLElement) && link.click(); }
            }
          });
        })();
      })();

      // Smooth button hover shine effect — tracks cursor position for that premium feel
      (function() {
        document.querySelectorAll('.btn').forEach(btn => {
          let rafId = null;
          let lastX = 50, lastY = 50;
          btn.addEventListener('pointermove', e => {
            if (rafId) return; // Skip if already scheduled
            const rect = btn.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            // Only update if moved significantly
            if (Math.abs(x - lastX) < 3 && Math.abs(y - lastY) < 3) return;
            lastX = x; lastY = y;
            rafId = requestAnimationFrame(() => {
              btn.style.setProperty('--hx', x.toFixed(0) + '%');
              btn.style.setProperty('--hy', y.toFixed(0) + '%');
              rafId = null;
            });
          }, { passive: true });
          btn.addEventListener('pointerleave', () => {
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
            lastX = 50; lastY = 50;
          }, { passive: true });
        });
      })();

      // Lava lamp liquid background effect — subtle, theme-aware, performance-optimized
      // Creates organic blob movement with cursor distortion for dynamic depth
      (function() {
        const canvas = document.getElementById('bg-grid');
        if (!canvas) return;
        
        // Skip on low-tier devices or if user prefers reduced motion
        if (DeviceCapabilities.tier === 'low' || userPrefersReducedMotion()) return;
        
        // Create offscreen canvas for lava lamp effect (renders behind grid)
        const lavaCanvas = document.createElement('canvas');
        lavaCanvas.id = 'bg-lava';
        lavaCanvas.style.cssText = 'position:fixed;inset:0;z-index:-2;pointer-events:none;opacity:0.35;';
        canvas.parentNode.insertBefore(lavaCanvas, canvas);
        const lavaCtx = lavaCanvas.getContext('2d', { alpha: true, desynchronized: true });
        
        const canvasScale = DeviceCapabilities.getCanvasScale();
        const dpr = Math.max(0.75, Math.min(1, window.devicePixelRatio || 1)) * canvasScale * 0.6; // Lower res for performance
        let w = 0, h = 0;
        
        // Lava blob configuration - reduce count on mobile for performance
        const blobCount = DeviceCapabilities.isMobile ? 3 : DeviceCapabilities.tier === 'high' ? 6 : 4;
        const blobs = [];
        
        class LavaBlob {
          constructor(index) {
            this.x = Math.random() * w;
            this.y = Math.random() * h;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.baseRadius = 140 + Math.random() * 180;
            this.radius = this.baseRadius;
            this.phase = Math.random() * Math.PI * 2;
            this.frequency = 0.35 + Math.random() * 0.5;
            this.distortX = 0;
            this.distortY = 0;
          }
          
          update(t, pointer) {
            // Organic motion with slight drift
            const drift = Math.sin(t * 0.25 + this.phase) * 0.2;
            this.x += this.vx + drift;
            this.y += this.vy + Math.cos(t * 0.2 + this.phase) * 0.2;
            
            // Bounce off edges with slight randomization
            if (this.x < -this.radius * 0.3 || this.x > w + this.radius * 0.3) {
              this.vx *= -0.9;
              this.vx += (Math.random() - 0.5) * 0.15;
            }
            if (this.y < -this.radius * 0.3 || this.y > h + this.radius * 0.3) {
              this.vy *= -0.9;
              this.vy += (Math.random() - 0.5) * 0.15;
            }
            
            // Contain within bounds
            this.x = Math.max(-this.radius * 0.3, Math.min(w + this.radius * 0.3, this.x));
            this.y = Math.max(-this.radius * 0.3, Math.min(h + this.radius * 0.3, this.y));
            
            // Smooth out distortion with faster decay
            this.distortX *= 0.8;
            this.distortY *= 0.8;
            
            // Cursor distortion - like finger disrupting water surface
            if (pointer.active) {
              const dx = this.x - pointer.x;
              const dy = this.y - pointer.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const influence = 400;
              
              if (dist < influence && dist > 0) {
                // Push away from cursor with smooth falloff
                const falloff = Math.pow(1 - dist / influence, 1.8);
                const force = falloff * 8;
                this.distortX += (dx / dist) * force;
                this.distortY += (dy / dist) * force;
                
                // Apply distortion with snappier response
                this.x += this.distortX * 0.4;
                this.y += this.distortY * 0.4;
                
                // Ripple effect on radius - creates water-like waves
                const ripple = Math.sin(t * 6 - dist * 0.02) * 0.2 * falloff;
                this.radius = this.baseRadius * (1 + ripple);
              } else {
                // Return to base radius when no cursor influence
                this.radius += (this.baseRadius - this.radius) * 0.15;
              }
            } else {
              // Organic pulsing when cursor not active
              this.radius = this.baseRadius * (1 + Math.sin(t * this.frequency + this.phase) * 0.12);
            }
          }
        }
        
        // Initialize blobs
        function initBlobs() {
          blobs.length = 0;
          for (let i = 0; i < blobCount; i++) {
            blobs.push(new LavaBlob(i));
          }
        }
        
        // Cache theme colors
        let themeColor = { r: 255, g: 255, b: 255 };
        let colorCacheTime = 0;
        
        function refreshThemeColor(now) {
          if (now - colorCacheTime < 500) return;
          const cs = getComputedStyle(document.documentElement);
          const accentColor = (cs.getPropertyValue('--theme-primary-3') || 'rgba(255,255,255,0.2)').trim();
          
          // Parse color
          const match = accentColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          if (match) {
            themeColor.r = parseInt(match[1]);
            themeColor.g = parseInt(match[2]);
            themeColor.b = parseInt(match[3]);
          }
          colorCacheTime = now;
        }
        
        let resizeTimer;
        function resize() {
          w = Math.ceil(window.innerWidth);
          h = Math.ceil(window.innerHeight);
          // Use lower resolution on mobile to improve performance
          const canvasScale = DeviceCapabilities.isMobile ? 0.7 : DeviceCapabilities.isTablet ? 0.85 : 1;
          lavaCanvas.width = Math.floor(w * dpr * canvasScale);
          lavaCanvas.height = Math.floor(h * dpr * canvasScale);
          lavaCanvas.style.width = w + 'px';
          lavaCanvas.style.height = h + 'px';
          lavaCtx.setTransform(dpr * canvasScale, 0, 0, dpr * canvasScale, 0, 0);
          initBlobs();
        }
        window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 150); }, { passive: true });
        resize();
        
        let pointer = { x: w / 2, y: h / 2, active: false };
        let rafId = null;
        
        function drawLava(time) {
          rafId = requestAnimationFrame(drawLava);
          
          if (document.hidden) return;
          
          refreshThemeColor(time);
          const t = time * 0.001;
          
          lavaCtx.clearRect(0, 0, w, h);
          
          // Update blobs
          blobs.forEach(blob => blob.update(t, pointer));
          
          // Render blobs with radial gradients (more performant than pixel manipulation)
          lavaCtx.globalCompositeOperation = 'lighter'; // Additive blending for organic merge
          
          blobs.forEach(blob => {
            const gradient = lavaCtx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.radius);
            
            // Theme-aware colors with stronger visibility
            const alpha = 0.12;
            gradient.addColorStop(0, `rgba(${themeColor.r}, ${themeColor.g}, ${themeColor.b}, ${alpha})`);
            gradient.addColorStop(0.35, `rgba(${themeColor.r}, ${themeColor.g}, ${themeColor.b}, ${alpha * 0.7})`);
            gradient.addColorStop(0.65, `rgba(${themeColor.r}, ${themeColor.g}, ${themeColor.b}, ${alpha * 0.3})`);
            gradient.addColorStop(1, `rgba(${themeColor.r}, ${themeColor.g}, ${themeColor.b}, 0)`);
            
            lavaCtx.fillStyle = gradient;
            lavaCtx.fillRect(
              blob.x - blob.radius, 
              blob.y - blob.radius, 
              blob.radius * 2, 
              blob.radius * 2
            );
          });
          
          lavaCtx.globalCompositeOperation = 'source-over';
        }
        
        function setPointer(e) {
          const rect = lavaCanvas.getBoundingClientRect();
          pointer.x = e.clientX - rect.left;
          pointer.y = e.clientY - rect.top;
          pointer.active = true;
        }
        
        window.addEventListener('pointermove', setPointer, { passive: true });
        window.addEventListener('pointerleave', () => { pointer.active = false; }, { passive: true });
        
        // Start animation
        requestAnimationFrame(drawLava);
      })();

      // Background animated geometric grid — straight lines with smoothed hover highlights
      // This is the silent hero of the page. Subtle enough to not distract,
      // but adds depth when you notice it. The lerp smoothing makes it feel organic.
      // Fun fact: The shimmer effect is synchronized with time, creating
      // a very subtle "breathing" effect that humans notice subconsciously.
      (function() {
        const canvas = document.getElementById('bg-grid');
        const ctx = canvas.getContext('2d');
        // Adaptive canvas resolution based on device capabilities
        const canvasScale = DeviceCapabilities.getCanvasScale();
        let dpr = Math.max(1, Math.min(1.5, window.devicePixelRatio || 1)) * canvasScale;
        let w = 0, h = 0, t = 0;
        const spacing = 60; // grid spacing in css px
        let pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999, active: false };
        const lerp = (a,b,p) => a + (b - a) * p;
        let lastFrame = 0;
        let hidden = document.hidden;
        document.addEventListener('visibilitychange', () => { hidden = document.hidden; });
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // Cache theme colors to avoid expensive style queries per frame
        let glow2 = 'rgba(255,255,255,0.25)';
        let glow3 = 'rgba(255,255,255,0.18)';
        let prim3 = 'rgba(255,255,255,0.2)';
        let gridScale = 0.75;
        let colorCacheAt = 0;
        function refreshColors(now){
          if (now - colorCacheAt < 400) return; // refresh at most ~2.5 Hz
          const cs = getComputedStyle(document.documentElement);
          glow2 = (cs.getPropertyValue('--theme-glow-2') || glow2).trim();
          glow3 = (cs.getPropertyValue('--theme-glow-3') || glow3).trim();
          prim3 = (cs.getPropertyValue('--theme-primary-3') || prim3).trim();
          const gs = parseFloat((cs.getPropertyValue('--grid-highlight-scale') || '1').trim());
          gridScale = isNaN(gs) ? 1 : Math.max(0.6, Math.min(1.8, gs));
          colorCacheAt = now;
        }

        let resizeTimer;
        function resize() {
          w = Math.ceil(window.innerWidth);
          h = Math.ceil(window.innerHeight);
          // Reduce resolution on mobile/tablet for better performance
          const mobileScale = DeviceCapabilities.isMobile ? 0.75 : DeviceCapabilities.isTablet ? 0.9 : 1;
          canvas.width = Math.floor(w * dpr * mobileScale);
          canvas.height = Math.floor(h * dpr * mobileScale);
          canvas.style.width = w + 'px';
          canvas.style.height = h + 'px';
          ctx.setTransform(dpr * mobileScale, 0, 0, dpr * mobileScale, 0, 0);
        }
        window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 120); }, { passive: true });
        resize();

        function drawGrid(time) {
          if (hidden) { requestAnimationFrame(drawGrid); return; }
          
          refreshColors(time);
          const dt = Math.min(48, Math.max(0, time - (lastFrame || time)));
          lastFrame = time;
          t = time * 0.001; // seconds
          ctx.clearRect(0, 0, w, h);
          ctx.lineWidth = 1.4;

          // shimmer factor for subtle motion along lines
          const shimmer = prefersReduced ? 0 : (Math.sin(t * 1.6) + 1) * 0.06 * gridScale; // respect reduced motion

          // use cached theme glow colors (avoid optional chaining for older browsers)

          // base grid (offset by half-spacing so lines avoid common edges)
          const offset = spacing / 2;
          ctx.strokeStyle = `rgba(255,255,255,${(0.14 + shimmer)})`;
          for (let y = offset; y <= h; y += spacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }
          for (let x = offset; x <= w; x += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
          }

          // highlight near pointer: skip heavy blending if we're smooth scrolling
          if (pointer.active && !prefersReduced && !window.__isSmoothScrolling && !document.documentElement.classList.contains('tv')) {
            // Smooth pointer position for buttery motion
            pointer.sx = pointer.sx === undefined ? pointer.tx : lerp(pointer.sx, pointer.tx, 0.25);
            pointer.sy = pointer.sy === undefined ? pointer.ty : lerp(pointer.sy, pointer.ty, 0.25);
            const maxDist = 280 * gridScale; // larger radius for a more prominent aura
            const band = 150 * gridScale; // width of colored intensity band around the pointer
            // Pre-compute common gradient values to reduce redundant calculations
            const cx = Math.max(0, Math.min(1, pointer.sx / w));
            const cy = Math.max(0, Math.min(1, pointer.sy / h));
            const bwH = Math.max(0.02, band / Math.max(1, w)); // band as fraction horizontal
            const bwV = Math.max(0.02, band / Math.max(1, h)); // band as fraction vertical
            const leftStop = Math.max(0, cx - bwH);
            const rightStop = Math.min(1, cx + bwH);
            const topStop = Math.max(0, cy - bwV);
            const bottomStop = Math.min(1, cy + bwV);
            
            for (let y = offset; y <= h; y += spacing) {
              const dy = Math.abs(pointer.sy - y);
              if (dy <= maxDist) {
                const a = Math.exp(-dy / 70) * (1.0 * gridScale); // stronger but still smooth
                // horizontal gradient centered at pointer.sx
                const grad = ctx.createLinearGradient(0, y, w, y);
                grad.addColorStop(0, 'rgba(255,255,255,0)');
                grad.addColorStop(leftStop, glow3);
                grad.addColorStop(cx, prim3);
                grad.addColorStop(rightStop, glow2);
                grad.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.save();
                ctx.globalAlpha *= a;
                ctx.strokeStyle = grad;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
                ctx.restore();
              }
            }
            for (let x = offset; x <= w; x += spacing) {
              const dx = Math.abs(pointer.sx - x);
              if (dx <= maxDist) {
                const a = Math.exp(-dx / 70) * (1.0 * gridScale);
                // vertical gradient centered at pointer.sy
                const grad = ctx.createLinearGradient(x, 0, x, h);
                grad.addColorStop(0, 'rgba(255,255,255,0)');
                grad.addColorStop(topStop, glow3);
                grad.addColorStop(cy, prim3);
                grad.addColorStop(bottomStop, glow2);
                grad.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.save();
                ctx.globalAlpha *= a;
                ctx.strokeStyle = grad;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, h);
                ctx.stroke();
                ctx.restore();
              }
            }
          }
          requestAnimationFrame(drawGrid);
        }
        requestAnimationFrame(drawGrid);

        function setPointer(e) {
          const rect = canvas.getBoundingClientRect();
          pointer.tx = e.clientX - rect.left;
          pointer.ty = e.clientY - rect.top;
          pointer.active = true;
        }
        window.addEventListener('pointermove', setPointer, { passive: true });
        window.addEventListener('pointerleave', () => { pointer.active = false; }, { passive: true });
      })();

      // Card tilt interaction — 3D effects that actually feel good with smooth interpolation
      // The math here calculates tilt based on cursor position relative to card center.
      // Negative values for X rotation because we want natural perspective.
      // Pro tip: The 6-degree max tilt is a sweet spot — noticeable but not nauseating.
      // Added smooth interpolation for buttery 3D effects
      (function() {
        const maxTilt = 6; // degrees
        
        // Only enable tilt when opted in via data-tilt to keep cards basic
        // Skip on low-end and medium devices for better performance
        const tiltCards = document.querySelectorAll('.card[data-tilt]');
        if (DeviceCapabilities.tier !== 'high' || userPrefersReducedMotion()) return;
        
        tiltCards.forEach(card => {
          let targetRx = 0, targetRy = 0;
          let currentRx = 0, currentRy = 0;
          let rafId = null;
          let isActive = false;
          
          const lerp = (a, b, t) => a + (b - a) * t;
          
          function updateTilt() {
            currentRx = lerp(currentRx, targetRx, 0.15);
            currentRy = lerp(currentRy, targetRy, 0.15);
            
            // Stop animation when close enough to target
            const threshold = 0.01;
            if (isActive || Math.abs(currentRx - targetRx) > threshold || Math.abs(currentRy - targetRy) > threshold) {
              card.style.setProperty('--rx', currentRx.toFixed(1) + 'deg');
              card.style.setProperty('--ry', currentRy.toFixed(1) + 'deg');
              rafId = requestAnimationFrame(updateTilt);
            } else {
              rafId = null;
            }
          }
          
          let moveRafId = null;
          card.addEventListener('pointermove', e => {
            isActive = true;
            if (moveRafId) return;
            const rect = card.getBoundingClientRect();
            const px = (e.clientX - rect.left) / rect.width; // 0..1
            const py = (e.clientY - rect.top) / rect.height; // 0..1
            moveRafId = requestAnimationFrame(() => {
              targetRy = (px - 0.5) * (maxTilt * 2);
              targetRx = -(py - 0.5) * (maxTilt * 2);
              if (!rafId) updateTilt();
              moveRafId = null;
            });
          }, { passive: true });
          
          card.addEventListener('pointerleave', () => {
            isActive = false;
            if (moveRafId) { cancelAnimationFrame(moveRafId); moveRafId = null; }
            targetRx = 0;
            targetRy = 0;
            if (!rafId) updateTilt();
          }, { passive: true });
        });
      })();

      // Scroll progress bar
      (function() {
        const bar = document.getElementById('scroll-progress');
        if (!bar) return;
        const update = () => {
          const scrollTop = window.scrollY;
          const docH = document.documentElement.scrollHeight - window.innerHeight;
          const p = docH > 0 ? Math.min(1, scrollTop / docH) : 0;
          bar.style.width = (p * 100) + '%';
        };
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('load', update);
      })();

      // Show floating to-top button when user scrolls up
      (function() {
        const toTop = document.getElementById('toTop');
        if (!toTop) return;
        let lastY = window.scrollY;
        let ticking = false;
        function onScroll() {
          const y = window.scrollY;
          const goingUp = y < lastY;
          if (y > 300 && goingUp) toTop.classList.add('visible'); else toTop.classList.remove('visible');
          lastY = y;
          ticking = false;
        }
        window.addEventListener('scroll', () => {
          if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
        }, { passive: true });
      })();

      // Hero typewriter with realistic timing, pause, backspace, shimmer and sparkles
      // This is where personality meets code. Random delays make it feel human,
      // not robotic. The sparkles? Pure joy. Because why not add a bit of magic?
      // The reduced-motion check ensures we're respectful of user preferences.
      // Inspiration: The terminal hackers from 80s movies, but make it modern.
      (function() {
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        let idx = 0;
        let current = '';
        let abort = false;
        let textEl = null;
        let wrapper = null;
        let typerVersion = 0;
        const pendingTimeouts = new Set();

        // Default features; may be overridden by i18n if provided
        let features = [
          'clean',
          'fast',
          'human‑centered',
          'accessible',
          'reliable'
        ];

        function randomDelay(min, max) { return Math.floor(min + Math.random() * (max - min)); }

        function safeSetTimeout(fn, ms) {
          const id = setTimeout(() => {
            pendingTimeouts.delete(id);
            fn();
          }, ms);
          pendingTimeouts.add(id);
          return id;
        }
        function clearPendingTimeouts() {
          pendingTimeouts.forEach(id => clearTimeout(id));
          pendingTimeouts.clear();
        }

        function queryElements() {
          textEl = document.getElementById('typerText');
          wrapper = document.getElementById('typer');
          return textEl && wrapper;
        }

        function spawnSparkles() {
          if (!wrapper) return;
          const s = document.createElement('div');
          s.className = 'sparkles';
          for (let i = 0; i < 5; i++) {
            const dot = document.createElement('i');
            dot.style.left = (40 + Math.random() * 20) + '%';
            dot.style.top = (20 + Math.random() * 60) + '%';
            dot.style.animationDelay = (i * 60) + 'ms';
            s.appendChild(dot);
          }
          wrapper.appendChild(s);
          safeSetTimeout(() => s.remove(), 900);
        }

        async function typeText(text) {
          const v = typerVersion;
          for (let i = 0; i < text.length; i++) {
            if (abort || !textEl || v !== typerVersion) return;
            current += text[i];
            await new Promise(r => { requestAnimationFrame(() => { if (textEl) textEl.textContent = current; r(); }); });
            await new Promise(r => safeSetTimeout(r, randomDelay(45, 120)));
          }
        }
        async function backspace(count) {
          const v = typerVersion;
          for (let i = 0; i < count; i++) {
            if (abort || !textEl || v !== typerVersion) return;
            current = current.slice(0, -1);
            await new Promise(r => { requestAnimationFrame(() => { if (textEl) textEl.textContent = current; r(); }); });
            await new Promise(r => safeSetTimeout(r, randomDelay(28, 70)));
          }
        }

        async function loop() {
          const v = typerVersion;
          if (!wrapper) return;
          wrapper.classList.add('typer-fire');
          while (!abort) {
            if (v !== typerVersion) break;
            const word = features[idx % features.length];
            wrapper.classList.remove('typer-shimmer', 'typer-glow');
            await typeText(word);
            if (!wrapper) break;
            wrapper.classList.add('typer-glow', 'typer-shimmer');
            if (!prefersReduced) spawnSparkles();
            await new Promise(r => safeSetTimeout(r, 3000));
            if (!wrapper) break;
            wrapper.classList.remove('typer-glow', 'typer-shimmer');
            await backspace(word.length);
            await new Promise(r => safeSetTimeout(r, 100));
            idx++;
          }
        }

        function start() {
          if (!queryElements()) return;
          current = '';
          if (textEl) textEl.textContent = '';
          abort = false;
          clearPendingTimeouts();
          typerVersion++;
          // Allow i18n to provide localized features
          if (typeof window.getI18nFeatures === 'function') {
            const localized = window.getI18nFeatures();
            if (Array.isArray(localized) && localized.length > 0) features = localized;
            else features = ['clean','fast','human‑centered','accessible','reliable'];
          }
          if (prefersReduced) {
            if (textEl) textEl.textContent = features[0] || '';
          } else {
            loop();
          }
        }

        function stop() { abort = true; clearPendingTimeouts(); typerVersion++; }

        // Expose reinit so translations that replace DOM can restart the typer
        window.typerReinit = function() {
          stop();
          // Give DOM a moment to update
          safeSetTimeout(() => { idx = 0; start(); }, 30);
        };

        // Kick off
        start();
        window.addEventListener('beforeunload', () => { abort = true; });
      })();

      // Dynamic age calculation (DOB: 2010-08-23)
      // Because updating your age manually every year is a pain,
      // and we're developers. We automate the boring stuff.
      // This calculates age properly accounting for birth month/day,
      // because not all years are the same length (looking at you, leap years).
      (function() {
        const out = document.getElementById('age');
        if (!out) return;
        const dob = new Date('2010-08-23T00:00:00Z');
        function computeAge() {
          const now = new Date();
          let age = now.getUTCFullYear() - dob.getUTCFullYear();
          const m = now.getUTCMonth() - dob.getUTCMonth();
          if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) {
            age--;
          }
          out.textContent = String(age);
        }
        computeAge();
        // Update daily at midnight
        const msUntilTomorrow = new Date(new Date().setHours(24,0,0,0)) - new Date();
        setTimeout(() => { computeAge(); setInterval(computeAge, 24*60*60*1000); }, msUntilTomorrow);
      })();

  // Toast notification helper — because alerts are so 2010
      (function() {
        const toast = document.getElementById('toast');
        function showToast(message, duration = 2500) {
          if (!toast) return;
          toast.textContent = message;
          toast.classList.add('show');
          setTimeout(() => toast.classList.remove('show'), duration);
        }
        window.showToast = showToast; // Global for other functions
      })();

      // Unified tooltip manager — prevents overlap and fits design language
      (function(){
        const layer = document.getElementById('tooltip');
        if (!layer) return;
        const prefersReduced = userPrefersReducedMotion();
        const followPointer = !prefersReduced;
        let activeEl = null;
        let rafId = 0;
        const margin = 10; // gap from element

        function placeTooltip(target, text, mouseX, mouseY){
          if (!text) return hide();
          layer.textContent = text;
          layer.setAttribute('aria-hidden', 'false');
          layer.classList.add('show');
          const rect = target.getBoundingClientRect();
          const tt = layer.getBoundingClientRect();

          // Preferred: above center
          let x = Math.round(rect.left + rect.width/2 - tt.width/2);
          let y = Math.round(rect.top - tt.height - margin);
          let side = 'top';

          // If above overflows, try below
          if (y < 8) {
            y = Math.round(rect.bottom + margin);
            side = 'bottom';
          }

          // Clamp horizontally to viewport
          const vw = Math.max(0, window.innerWidth);
          const vh = Math.max(0, window.innerHeight);
          x = Math.min(vw - tt.width - 8, Math.max(8, x));

          // If still overlapping with target, nudge sideways based on pointer
          if (!(rect.bottom + margin <= y || y + tt.height + margin <= rect.top)) {
            if (mouseX !== undefined) {
              const preferLeft = mouseX > rect.left + rect.width/2;
              x = preferLeft ? Math.max(8, rect.left - tt.width - margin)
                             : Math.min(vw - tt.width - 8, rect.right + margin);
              // Align vertically with mouse position if available
              const ty = Math.round((mouseY ?? (rect.top + rect.height/2)) - tt.height/2);
              y = Math.min(vh - tt.height - 8, Math.max(8, ty));
              side = preferLeft ? 'left' : 'right';
            }
          }

          layer.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
          layer.dataset.side = side;
        }

        function hide(){
          layer.classList.remove('show');
          layer.setAttribute('aria-hidden', 'true');
          layer.style.transform = 'translate(-9999px, -9999px)';
          delete layer.dataset.side;
          activeEl = null;
        }

        function onEnter(e){
          const t = e.currentTarget;
          const text = t.getAttribute('data-tooltip');
          if (!text) return;
          activeEl = t;
          // Initial placement near pointer if available
          placeTooltip(t, text, e.clientX, e.clientY);
        }
        function onMove(e){
          if (!activeEl) return;
          if (!followPointer) return;
          // Throttle with rAF
          cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
            if (!activeEl) return;
            const text = activeEl.getAttribute('data-tooltip');
            if (text) {
              placeTooltip(activeEl, text, e.clientX, e.clientY);
            }
          });
        }
        function onLeave(){ hide(); }

        function bind(el){
          el.addEventListener('mouseenter', onEnter);
          el.addEventListener('mousemove', onMove, { passive: true });
          el.addEventListener('mouseleave', onLeave);
          // Keyboard focus support
          el.addEventListener('focus', (e) => onEnter(e));
          el.addEventListener('blur', onLeave);
        }

        function init(){
          // Attach to anything with data-tooltip
          document.querySelectorAll('[data-tooltip]').forEach(bind);
          // Mutations: bind dynamically added nodes (e.g., language change updates)
          const mo = new MutationObserver((muts) => {
            for (const m of muts) {
              m.addedNodes && m.addedNodes.forEach(node => {
                if (!(node instanceof Element)) return;
                if (node.hasAttribute && node.hasAttribute('data-tooltip')) bind(node);
                node.querySelectorAll && node.querySelectorAll('[data-tooltip]').forEach(bind);
              });
            }
          });
          mo.observe(document.body, { childList: true, subtree: true });
        }

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', init);
        } else { init(); }

        // Hide on Escape
        window.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
      })();

      // Enhanced global error handling — user-friendly, prevents spam, handles all error types
      (function(){
        const overlay = document.getElementById('errorOverlay');
        if (!overlay) return;
        
        // Error tracking to prevent spam and duplicates
        const seenErrors = new Set();
        let lastErrorTime = 0;
        const ERROR_COOLDOWN = 2000; // 2 seconds minimum between errors
        let errorCount = 0;
        const MAX_ERRORS = 5; // Max errors to show before suppressing
        
        // Categorize errors for better user messaging
        function categorizeError(msg, detail) {
          if (!msg || msg === 'null' || msg === 'undefined') return 'unknown';
          const msgLower = msg.toLowerCase();
          if (msgLower.includes('network') || msgLower.includes('fetch') || msgLower.includes('xmlhttprequest')) return 'network';
          if (msgLower.includes('script') || msgLower.includes('loading')) return 'loading';
          if (msgLower.includes('permission') || msgLower.includes('denied')) return 'permission';
          if (msgLower.includes('quota') || msgLower.includes('storage')) return 'storage';
          if (detail && detail.includes('ResizeObserver')) return 'benign'; // Safe to ignore
          return 'runtime';
        }
        
        // Get user-friendly message based on error category
        function getUserFriendlyMessage(category, originalMsg) {
          const messages = {
            network: 'Network connection issue. Please check your internet and try again.',
            loading: 'Failed to load a resource. The page may not work properly.',
            permission: 'Permission denied. Some features may not work.',
            storage: 'Browser storage limit reached. Try clearing your cache.',
            benign: 'Minor internal notification (safe to ignore).',
            unknown: 'Something unexpected happened.',
            runtime: originalMsg || 'An error occurred while running the page.'
          };
          return messages[category] || messages.runtime;
        }
        
        function showError(msg, detail){
          // Filter out blank, false, or useless errors
          if (!msg || msg === 'null' || msg === 'undefined' || msg === '' || msg === 'Script error.') {
            return; // Silently ignore unhelpful errors
          }
          
          // Check cooldown to prevent spam
          const now = Date.now();
          if (now - lastErrorTime < ERROR_COOLDOWN) return;
          lastErrorTime = now;
          
          // Check if we've seen this exact error before
          const errorKey = `${msg}:${detail?.substring(0, 100) || ''}`;
          if (seenErrors.has(errorKey)) return; // Don't show duplicates
          seenErrors.add(errorKey);
          
          // Check max error limit
          errorCount++;
          if (errorCount > MAX_ERRORS) {
            console.warn(`Max errors (${MAX_ERRORS}) reached. Suppressing further error displays.`);
            return;
          }
          
          // Categorize the error
          const category = categorizeError(msg, detail);
          
          // Skip benign errors (like ResizeObserver loop notifications)
          if (category === 'benign') {
            console.info('Benign error ignored:', msg);
            return;
          }
          
          // Build error UI
          overlay.innerHTML = '';
          overlay.style.display = 'block';
          overlay.style.position = 'fixed'; overlay.style.inset = '20px'; overlay.style.zIndex = '9999';
          overlay.style.background = 'rgba(20,20,20,0.95)'; 
          overlay.style.border = '1px solid rgba(255,100,100,0.3)'; 
          overlay.style.borderRadius = '16px';
          overlay.style.backdropFilter = 'blur(12px) saturate(120%)'; 
          overlay.style.padding = '24px';
          overlay.style.maxWidth = '600px';
          overlay.style.margin = 'auto';
          overlay.style.boxShadow = '0 8px 32px rgba(0,0,0,0.6)';
          
          // Icon based on category
          const icon = category === 'network' ? '[Network]' : category === 'permission' ? '[Permission]' : '[Error]';
          
          const title = document.createElement('div'); 
          title.style.fontWeight = '700'; 
          title.style.marginBottom = '12px'; 
          title.style.fontSize = '18px';
          title.style.display = 'flex';
          title.style.alignItems = 'center';
          title.style.gap = '8px';
          title.innerHTML = `<span style="font-size: 24px">${icon}</span> Error Handled`;
          
          const message = document.createElement('div'); 
          message.style.color = '#f5f5f5'; 
          message.style.lineHeight = '1.6';
          message.style.marginBottom = '12px';
          message.textContent = getUserFriendlyMessage(category, msg);
          
          // Technical details (collapsed by default)
          const details = document.createElement('details'); 
          details.style.marginTop = '12px';
          details.style.padding = '12px';
          details.style.background = 'rgba(0,0,0,0.3)';
          details.style.borderRadius = '8px';
          details.style.border = '1px solid rgba(255,255,255,0.1)';
          
          const sum = document.createElement('summary'); 
          sum.textContent = 'Technical Details'; 
          sum.style.cursor = 'pointer';
          sum.style.fontWeight = '600';
          sum.style.marginBottom = '8px';
          details.appendChild(sum);
          
          const pre = document.createElement('pre'); 
          pre.style.whiteSpace = 'pre-wrap'; 
          pre.style.fontSize = '11px'; 
          pre.style.color = '#999'; 
          pre.style.fontFamily = 'monospace';
          pre.style.maxHeight = '200px';
          pre.style.overflow = 'auto';
          pre.textContent = `${msg}\n\n${detail || 'No additional details'}`;
          details.appendChild(pre);
          
          // Action buttons
          const btnContainer = document.createElement('div');
          btnContainer.style.display = 'flex';
          btnContainer.style.gap = '8px';
          btnContainer.style.marginTop = '16px';
          
          const dismissBtn = document.createElement('button'); 
          dismissBtn.className = 'btn primary'; 
          dismissBtn.textContent = 'Dismiss'; 
          dismissBtn.addEventListener('click', () => { 
            overlay.style.display = 'none'; 
            overlay.innerHTML = ''; 
          });
          
          const reloadBtn = document.createElement('button'); 
          reloadBtn.className = 'btn ghost'; 
          reloadBtn.textContent = 'Reload Page';
          reloadBtn.addEventListener('click', () => window.location.reload());
          
          btnContainer.append(dismissBtn, reloadBtn);
          overlay.append(title, message, details, btnContainer);
          
          // Show toast for quick notification
          window.showToast && window.showToast(`${icon} Error: ${getUserFriendlyMessage(category, msg).substring(0, 60)}...`);
        }
        
        // Global error handler
        window.addEventListener('error', (e) => { 
          e.preventDefault(); // Prevent default browser error handling
          showError(e.message, (e.error && e.error.stack) || ''); 
        });
        
        // Promise rejection handler
        window.addEventListener('unhandledrejection', (e) => { 
          e.preventDefault(); // Prevent console spam
          const reason = e.reason || {};
          const msg = reason.message || reason.toString() || 'Unhandled promise rejection';
          const stack = reason.stack || (typeof reason === 'object' ? JSON.stringify(reason, null, 2) : String(reason));
          showError(msg, stack);
        });
      })();

      // Global copy toast — surface feedback whenever user copies text
      (function(){
        let lastToastAt = 0;
        document.addEventListener('copy', () => {
          const now = Date.now();
          if (now - lastToastAt < 800) return; // avoid duplicate spam from programmatic copies
          lastToastAt = now;
          window.showToast && window.showToast('Copied to clipboard.');
        });
      })();

      // Particle effects system — adds delightful sparkles to buttons and text
      // Creates a sense of magic and responsiveness throughout the site
      (function() {
        const allowParticles = !userPrefersReducedMotion() && DeviceCapabilities.tier !== 'low';
        if (!allowParticles) {
          window.spawnButtonParticles = function noop() {};
          return;
        }
        function createParticle(x, y, spread = 40) {
          const particle = document.createElement('div');
          particle.className = 'particle';
          
          // Random trajectory with spread
          const angle = (Math.random() - 0.5) * Math.PI * 0.8; // Slightly upward bias
          const distance = 20 + Math.random() * spread;
          const tx = Math.cos(angle) * distance;
          const ty = Math.sin(angle) * distance - Math.abs(Math.sin(angle)) * 10; // More upward
          
          particle.style.left = x + 'px';
          particle.style.top = y + 'px';
          particle.style.setProperty('--tx', tx + 'px');
          particle.style.setProperty('--ty', ty + 'px');
          
          // Random size variation
          const size = 3 + Math.random() * 2;
          particle.style.width = size + 'px';
          particle.style.height = size + 'px';
          
          // Random animation delay for staggered effect
          particle.style.animationDelay = (Math.random() * 100) + 'ms';
          
          document.body.appendChild(particle);
          setTimeout(() => particle.remove(), 1200);
        }
        
        function spawnButtonParticles(btn) {
          const rect = btn.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          
          // Spawn cluster of particles from button center - reduced count for performance
          const baseCount = DeviceCapabilities.tier === 'high' ? 6 : 3;
          const count = baseCount + Math.floor(Math.random() * (DeviceCapabilities.tier === 'high' ? 4 : 2));
          for (let i = 0; i < count; i++) {
            const offsetX = (Math.random() - 0.5) * rect.width * 0.6;
            const offsetY = (Math.random() - 0.5) * rect.height * 0.6;
            setTimeout(() => {
              createParticle(centerX + offsetX, centerY + offsetY, 50);
            }, i * 15);
          }
        }
        
        function spawnTextParticles(el, e) {
          const rect = el.getBoundingClientRect();
          const x = e.clientX || (rect.left + rect.width / 2);
          const y = e.clientY || (rect.top + rect.height / 2);
          
          // Fewer, more subtle particles for text
          const count = 3 + Math.floor(Math.random() * 3);
          for (let i = 0; i < count; i++) {
            setTimeout(() => {
              createParticle(x, y, 30);
            }, i * 40);
          }
        }
  window.spawnButtonParticles = spawnButtonParticles;
        
        // Add particles to buttons on click
        document.addEventListener('DOMContentLoaded', () => {
          // Buttons get particles on click (already handled in setupButtonFeedback)
          
          // Add particles to text elements on hover/click
          document.querySelectorAll('.particle-target, h1, h2, h3, .section-title, .chip, .tag').forEach(el => {
            let lastHover = 0;
            el.addEventListener('mouseenter', (e) => {
              const now = Date.now();
              if (now - lastHover > 300) { // Throttle to avoid spam
                spawnTextParticles(el, e);
                lastHover = now;
              }
            });
            
            el.addEventListener('click', (e) => {
              spawnTextParticles(el, e);
            });
          });
          
          // Add particles to section titles on interaction
          document.querySelectorAll('.section-title').forEach(el => {
            el.addEventListener('mouseenter', (e) => spawnTextParticles(el, e));
          });
          
          // More particles for tags/chips on hover
          document.querySelectorAll('.chip, .tag').forEach(el => {
            el.addEventListener('mouseenter', (e) => {
              const rect = el.getBoundingClientRect();
              const x = rect.left + rect.width / 2;
              const y = rect.top + rect.height / 2;
              const count = 4 + Math.floor(Math.random() * 3);
              for (let i = 0; i < count; i++) {
                setTimeout(() => createParticle(x, y, 25), i * 30);
              }
            });
          });
        });
      })();

      // Fire highlight utility — creates clean fiery glow animation
      // Immediate response with smooth animations
      (function() {
        function highlightElement(selector, scrollDelay = 0) {
          const el = document.querySelector(selector);
          if (!el) return;
          
          // Add fire-highlight class immediately if not present
          if (!el.classList.contains('fire-highlight')) {
            el.classList.add('fire-highlight');
          }
          
          // Start scroll immediately (non-blocking)
          const scrollY = Math.max(0, el.offsetTop - 100);
          const scroller = typeof window.smoothScrollTo === 'function'
            ? window.smoothScrollTo
            : (target => window.scrollTo({ top: target, behavior: userPrefersReducedMotion() ? 'auto' : 'smooth' }));
          scroller(scrollY, 600);
          
          // Start highlight immediately - don't wait for scroll
          requestAnimationFrame(() => {
            el.classList.add('active');
            
            // Remove highlight after 3 seconds
            setTimeout(() => {
              el.classList.remove('active');
            }, 3000);
          });
        }
        
        window.highlightElement = highlightElement; // Global for other functions
      })();

      // Copy email helpers with toast notification and fire highlight (spelling is hard sometimes)
      // Immediate response with visual feedback
      (function() {
        const email = 'mayukhjit.chakraborty@gmail.com';
        const copy = async (btn) => {
          // Immediate visual feedback
          if (btn) {
            btn.classList.add('clicked');
            btn.classList.add('clicked-shake');
            setTimeout(() => btn.classList.remove('clicked'), 200);
            setTimeout(() => btn.classList.remove('clicked-shake'), 260);
          }
          window.playUiPop && window.playUiPop({ frequency: 420 });
          
          try {
            await navigator.clipboard.writeText(email);
            window.showToast && window.showToast('Email copied to clipboard.');
            // Highlight email immediately
            requestAnimationFrame(() => {
              window.highlightElement && window.highlightElement('#emailLink', 0);
            });
          } catch (e) {
            // Fallback for older browsers (yes this will look old school)
            const ta = document.createElement('textarea');
            ta.value = email; document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); document.body.removeChild(ta);
            window.showToast && window.showToast('Email copied to clipboard.');
            requestAnimationFrame(() => {
              window.highlightElement && window.highlightElement('#emailLink', 0);
            });
          }
        };
        const b1 = document.getElementById('copyEmail');
        const b2 = document.getElementById('copyEmailFooter');
        b1 && b1.addEventListener('click', () => copy(b1));
        b2 && b2.addEventListener('click', () => copy(b2));
      })();

      // Button fire highlights — immediate response with smooth animations
      (function() {
        // Immediate button click feedback for all action buttons
        function setupButtonFeedback(btn) {
          btn.addEventListener('click', function(e) {
            // Immediate visual feedback - no delay
            const reduce = userPrefersReducedMotion();
            this.classList.add('clicked');
            if (!reduce) {
              this.classList.add('clicked-shake');
              setTimeout(() => this.classList.remove('clicked-shake'), 260);
              if (typeof window.spawnButtonParticles === 'function') {
                window.spawnButtonParticles(this);
              }
            }
            setTimeout(() => this.classList.remove('clicked'), 200);
          }, { passive: true });
        }
        
        // Wait for DOM to be fully loaded
        setTimeout(() => {
          // "Let's work together" button → highlight email
          document.querySelectorAll('a.btn[href="#contact"]').forEach(btn => {
            if (btn.textContent.includes('work together') || btn.textContent.includes('Collaborate')) {
              setupButtonFeedback(btn);
              btn.addEventListener('click', (e) => {
                e.preventDefault();
                // Immediate action - no delay
                requestAnimationFrame(() => {
                  window.highlightElement && window.highlightElement('#emailLink', 0);
                });
              });
            }
          });
          
          // "View Projects" button → highlight projects section
          document.querySelectorAll('a.btn[href="#projects"]').forEach(btn => {
            if (btn.textContent.includes('Projects')) {
              setupButtonFeedback(btn);
              btn.addEventListener('click', (e) => {
                e.preventDefault();
                const projectsSection = document.querySelector('#projects');
                if (projectsSection) {
                  // Start immediately - no delays
                  projectsSection.classList.add('fire-highlight');
                  smoothScrollTo(Math.max(0, projectsSection.offsetTop - 100), 600);
                  // Activate highlight immediately
                  requestAnimationFrame(() => {
                    projectsSection.classList.add('active');
                    setTimeout(() => {
                      projectsSection.classList.remove('active');
                    }, 3000);
                  });
                }
              });
            }
          });
          
          // "Collaborate" button in vision section → highlight email
          document.querySelectorAll('.card .btn[href="#contact"]').forEach(btn => {
            if (btn.textContent.includes('Collaborate')) {
              setupButtonFeedback(btn);
              btn.addEventListener('click', (e) => {
                e.preventDefault();
                requestAnimationFrame(() => {
                  window.highlightElement && window.highlightElement('#emailLink', 0);
                });
              });
            }
          });
          
          // Setup feedback for all other buttons too
          document.querySelectorAll('.btn').forEach(btn => {
            if (!btn.classList.contains('clicked')) {
              setupButtonFeedback(btn);
            }
          });
        }, 100);
      })();

      // Command Palette — the Swiss Army knife of navigation
      // Pro tip: This is where the magic happens. Press Cmd+K (or Ctrl+K) to open.
      (function() {
        const cmdk = document.getElementById('cmdk');
        const cmdkInput = document.getElementById('cmdkInput');
        const cmdkList = document.getElementById('cmdkList');
        if (!cmdk || !cmdkInput || !cmdkList) return;

  // Command definitions — each action is a small helper function
        const commands = [
          // Navigation
          {
            id: 'home',
            title: 'Go to Home',
            category: 'Navigation',
            keywords: ['home', 'top', 'start', 'hero'],
            action: () => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              cmdk.classList.remove('open');
            }
          },
          {
            id: 'projects',
            title: 'Go to Projects',
            category: 'Navigation',
            keywords: ['project', 'work', 'portfolio'],
            action: () => {
              const el = document.querySelector('#projects');
              if (el) {
                smoothScrollTo(Math.max(0, el.offsetTop - 70), 600);
                cmdk.classList.remove('open');
              }
            }
          },
          {
            id: 'vision',
            title: 'Go to Vision',
            category: 'Navigation',
            keywords: ['vision', 'future', 'music', 'ai'],
            action: () => {
              const el = document.querySelector('#vision');
              if (el) {
                smoothScrollTo(Math.max(0, el.offsetTop - 70), 600);
                cmdk.classList.remove('open');
              }
            }
          },
          {
            id: 'why',
            title: 'Why me?',
            category: 'Navigation',
            keywords: ['why', 'hire', 'about'],
            action: () => {
              const el = document.querySelector('#why');
              if (el) {
                smoothScrollTo(Math.max(0, el.offsetTop - 70), 600);
                cmdk.classList.remove('open');
              }
            }
          },
          {
            id: 'faq',
            title: 'Go to FAQ',
            category: 'Navigation',
            keywords: ['faq', 'question', 'answer', 'help'],
            action: () => {
              const el = document.querySelector('#faq');
              if (el) {
                smoothScrollTo(Math.max(0, el.offsetTop - 70), 600);
                cmdk.classList.remove('open');
              }
            }
          },
          {
            id: 'skills',
            title: 'View Skills',
            category: 'Navigation',
            keywords: ['skill', 'tech', 'stack'],
            action: () => {
              const el = document.querySelector('#skills');
              if (el) {
                smoothScrollTo(Math.max(0, el.offsetTop - 70), 600);
                cmdk.classList.remove('open');
              }
            }
          },
          {
            id: 'contact',
            title: 'Go to Contact',
            category: 'Navigation',
            keywords: ['contact', 'email', 'reach'],
            action: () => {
              const el = document.querySelector('#contact');
              if (el) {
                smoothScrollTo(Math.max(0, el.offsetTop - 70), 600);
                cmdk.classList.remove('open');
              }
            }
          },
          // Actions
          {
            id: 'copy-email',
            title: 'Copy Email Address',
            category: 'Actions',
            keywords: ['email', 'copy', 'contact'],
            action: () => {
              const email = 'mayukhjit.chakraborty@gmail.com';
              navigator.clipboard.writeText(email).then(() => {
                window.showToast && window.showToast('✓ Email copied to clipboard');
                cmdk.classList.remove('open');
              }).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = email; document.body.appendChild(ta); ta.select();
                document.execCommand('copy'); document.body.removeChild(ta);
                window.showToast && window.showToast('✓ Email copied to clipboard');
                cmdk.classList.remove('open');
              });
            }
          },
          {
            id: 'github',
            title: 'Open GitHub Profile',
            category: 'Actions',
            keywords: ['github', 'code', 'repo'],
            action: () => {
              window.open('https://github.com/mayukhjit-c', '_blank');
              cmdk.classList.remove('open');
            }
          },
          {
            id: 'linkedin',
            title: 'Open LinkedIn',
            category: 'Actions',
            keywords: ['linkedin', 'professional', 'network'],
            action: () => {
              window.open('https://www.linkedin.com/in/mayukhjitchakraborty/', '_blank');
              cmdk.classList.remove('open');
            }
          },
          {
            id: 'spotify',
            title: 'Listen on Spotify',
            category: 'Actions',
            keywords: ['spotify', 'music', 'listen'],
            action: () => {
              window.open('https://open.spotify.com/artist/your-id', '_blank');
              cmdk.classList.remove('open');
            }
          },
          {
            id: 'youtube',
            title: 'Watch on YouTube',
            category: 'Actions',
            keywords: ['youtube', 'video', 'watch'],
            action: () => {
              window.open('https://youtube.com/@mayukhjitc', '_blank');
              cmdk.classList.remove('open');
            }
          },
          {
            id: 'top',
            title: 'Scroll to Top',
            category: 'Actions',
            keywords: ['top', 'home', 'beginning'],
            action: () => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              cmdk.classList.remove('open');
            }
          },
          {
            id: 'bottom',
            title: 'Scroll to Bottom',
            category: 'Actions',
            keywords: ['bottom', 'end', 'footer'],
            action: () => {
              window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
              cmdk.classList.remove('open');
            }
          },
          {
            id: 'keyboard-shortcuts',
            title: 'View Keyboard Shortcuts',
            category: 'Help',
            keywords: ['shortcuts', 'keyboard', 'keys', 'help'],
            action: () => {
              window.showToast && window.showToast('H=Home • P=Projects • S=Skills • C=Contact • J/K=Scroll • ?=Help • Cmd+K=Commands');
              cmdk.classList.remove('open');
            }
          },
          {
            id: 'easter-egg',
            title: 'Easter Egg',
            category: 'Fun',
            keywords: ['easter', 'egg', 'secret', 'konami'],
            action: () => {
              window.showToast && window.showToast('You found an easter egg! Keep exploring...');
              // Add a subtle celebration effect
              document.body.style.animation = 'none';
              setTimeout(() => {
                document.body.style.animation = 'rainbowPulse 0.6s ease';
              }, 10);
              cmdk.classList.remove('open');
            }
          }
        ];

        // Customization commands
        let ambientStrength = 1.0;
        let gridHighlight = 1.0;
        let effectsPaused = false;
        function setAmbientStrength(val){ ambientStrength = Math.max(0.5, Math.min(1.5, val)); document.body.style.setProperty('--ambient-scale', String(ambientStrength)); }
        function setGridHighlight(val){ gridHighlight = Math.max(0.6, Math.min(1.6, val)); document.documentElement.style.setProperty('--grid-highlight-scale', String(gridHighlight)); }
        function toggleEffects(){ effectsPaused = !effectsPaused; if (effectsPaused) { window.__isSmoothScrolling = true; } else { window.__isSmoothScrolling = false; } }

        commands.push(
          { id: 'ambient-up', title: 'Ambient glow: stronger', keywords: ['ambient','background','glow','color'], action: () => setAmbientStrength(ambientStrength + 0.1) },
          { id: 'ambient-down', title: 'Ambient glow: softer', keywords: ['ambient','background','glow','color'], action: () => setAmbientStrength(ambientStrength - 0.1) },
          { id: 'grid-strong', title: 'Grid highlight: stronger', keywords: ['grid','highlight','hover'], action: () => setGridHighlight(gridHighlight + 0.1) },
          { id: 'grid-soft', title: 'Grid highlight: softer', keywords: ['grid','highlight','hover'], action: () => setGridHighlight(gridHighlight - 0.1) },
          { id: 'effects-toggle', title: 'Toggle visual effects', keywords: ['effects','particles','background'], action: () => { toggleEffects(); window.showToast && window.showToast(effectsPaused ? 'Effects paused' : 'Effects resumed'); } },
          { id: 'themes-slow', title: 'Theme rotation: slow', keywords: ['theme','palette','rotation','slow'], action: () => { window.__toggleSlowThemes && window.__toggleSlowThemes(true); window.showToast && window.showToast('Theme rotation slowed'); } },
          { id: 'themes-normal', title: 'Theme rotation: normal', keywords: ['theme','palette','rotation','normal'], action: () => { window.__toggleSlowThemes && window.__toggleSlowThemes(false); window.showToast && window.showToast('Theme rotation normal'); } }
        );

        let selectedIndex = 0;
        let filteredCommands = commands;

        function renderCommands() {
          cmdkList.innerHTML = '';
          
          if (filteredCommands.length === 0) {
            cmdkList.innerHTML = '<div class="cmdk-empty">No commands found. Try a different search.</div>';
            return;
          }
          
          // Group by category
          const grouped = {};
          filteredCommands.forEach(cmd => {
            const cat = cmd.category || 'Other';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(cmd);
          });
          
          let globalIndex = 0;
          Object.keys(grouped).forEach(category => {
            // Add category header
            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'cmdk-category';
            categoryHeader.textContent = category;
            cmdkList.appendChild(categoryHeader);
            
            grouped[category].forEach(cmd => {
              const item = document.createElement('div');
              item.className = 'cmdk-item';
              item.setAttribute('role', 'option');
              item.setAttribute('aria-selected', globalIndex === selectedIndex);
              item.innerHTML = `
                <span>${cmd.title}</span>
                ${globalIndex === selectedIndex ? '<span class="cmdk-kbd">↵</span>' : ''}
              `;
              item.addEventListener('click', () => cmd.action());
              cmdkList.appendChild(item);
              globalIndex++;
            });
          });
        }

        function filterCommands(query) {
          const q = query.toLowerCase().trim();
          if (!q) {
            filteredCommands = commands;
            selectedIndex = 0;
            renderCommands();
            return;
          }
          filteredCommands = commands.filter(cmd => {
            return cmd.title.toLowerCase().includes(q) ||
                   cmd.keywords.some(kw => kw.toLowerCase().includes(q));
          });
          selectedIndex = Math.max(0, Math.min(selectedIndex, filteredCommands.length - 1));
          renderCommands();
        }

        function openPalette() {
          cmdk.classList.add('open');
          cmdkInput.focus();
          cmdkInput.value = '';
          filteredCommands = commands;
          selectedIndex = 0;
          renderCommands();
        }

        function closePalette() {
          cmdk.classList.remove('open');
          cmdkInput.blur();
        }

        // Keyboard shortcuts: Cmd+K or Ctrl+K to open
        window.addEventListener('keydown', (e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            if (cmdk.classList.contains('open')) {
              closePalette();
            } else {
              openPalette();
            }
          }
          if (e.key === 'Escape' && cmdk.classList.contains('open')) {
            closePalette();
          }
        });
        
        // Additional global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
          // Skip if command palette is open or user is typing
          if (cmdk.classList.contains('open') || document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
          
          // Cmd+/ or Ctrl+/ → Quick help
          if ((e.metaKey || e.ctrlKey) && e.key === '/') {
            e.preventDefault();
            window.showToast && window.showToast('Shortcuts: H=Home, P=Projects, S=Skills, C=Contact, T=Top, B=Bottom, J/K=Scroll, ?=Help');
          }
          
          // J/K → Scroll down/up (vim-style)
          if (e.key === 'j') {
            e.preventDefault();
            window.scrollBy({ top: 100, behavior: 'smooth' });
          }
          if (e.key === 'k' && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            window.scrollBy({ top: -100, behavior: 'smooth' });
          }
          
          // G/gg → Go to bottom/top
          if (e.key === 'g') {
            if (window.__lastGPress && Date.now() - window.__lastGPress < 500) {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
              window.__lastGPress = 0;
            } else {
              window.__lastGPress = Date.now();
            }
          }
          if (e.key === 'G' && e.shiftKey) {
            e.preventDefault();
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
          }
          
          // Quick navigation shortcuts
          if (e.key === 'h') {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          if (e.key === 'p') {
            e.preventDefault();
            const el = document.querySelector('#projects');
            if (el) smoothScrollTo(Math.max(0, el.offsetTop - 70), 400);
          }
          if (e.key === 's') {
            e.preventDefault();
            const el = document.querySelector('#skills');
            if (el) smoothScrollTo(Math.max(0, el.offsetTop - 70), 400);
          }
          if (e.key === 'c') {
            e.preventDefault();
            const el = document.querySelector('#contact');
            if (el) smoothScrollTo(Math.max(0, el.offsetTop - 70), 400);
          }
          if (e.key === 't') {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          if (e.key === 'b') {
            e.preventDefault();
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
          }
          
          // ? → Show shortcuts help
          if (e.key === '?' && e.shiftKey) {
            e.preventDefault();
            openPalette();
          }
        });

        // Handle input filtering
        cmdkInput.addEventListener('input', (e) => {
          filterCommands(e.target.value);
        });

        // Handle keyboard navigation
        cmdkInput.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % filteredCommands.length;
            renderCommands();
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = selectedIndex === 0 ? filteredCommands.length - 1 : selectedIndex - 1;
            renderCommands();
          } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
            e.preventDefault();
            filteredCommands[selectedIndex].action();
          }
        });

        // Close on backdrop click
        cmdk.addEventListener('click', (e) => {
          if (e.target === cmdk) closePalette();
        });
      })();

      // Modal functionality — because details matter
      (function() {
        const modal = document.getElementById('modal');
        const modalClose = document.getElementById('modalClose');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalMedia = document.getElementById('modalMedia');
        if (!modal || !modalClose) return;
  let lastFocus = null;

        // Project data — each project gets its moment in the spotlight
        const projectData = {
          gcsemate: {
            title: 'GCSEMate',
            description: 'GCSE revision companion offering structured subjects, notes, and past papers for focused study.',
            details: 'Built with a focus on clarity and accessibility, GCSEMate helps students navigate their revision journey with structured content and intuitive navigation. The platform combines clean UI with performant backend architecture.',
            tech: ['Web App', 'Education', 'UX', 'React', 'Node.js'],
            url: 'https://gcsemate.com'
          },
          codebuilder: {
            title: 'CodeBuilder AI',
            description: 'Autonomous web app that generates startup ideas, analyzes profitability, considers marketing & branding, then fully implements working webapps using Gemini 2.5 Pro.',
            details: 'An autonomous AI system that demonstrates end-to-end product development. CodeBuilder AI generates innovative startup concepts, performs deep market analysis including profitability assessment, develops comprehensive marketing strategies and branding guidelines, identifies improvement areas, and then autonomously builds fully functional web applications using Google\'s Gemini 2.5 Pro. This project showcases advanced AI orchestration, full-stack development automation, and intelligent decision-making systems.',
            tech: ['AI', 'Autonomous Systems', 'Gemini 2.5 Pro', 'Full-stack', 'Machine Learning'],
            url: null
          },
          studio: {
            title: 'Subscriberlytics',
            description: 'Track and analyze your subscriptions with real‑time currency conversion, comprehensive insights, and offline PWA support.',
            details: 'Subscriberlytics is a privacy‑first subscription manager. It offers advanced analytics (cost breakdowns, value analysis, visual charts), export/import, keyboard shortcuts, 30+ currencies with automatic conversion, and installs as a PWA for offline use. Clean, accessible UI with smooth animations and responsive design.',
            tech: ['Analytics', 'PWA', 'Vanilla JS', 'CSS', 'Currency', 'Accessibility'],
            url: 'https://github.com/mayukhjit-c/subscriberlytics'
          }
        };

        function openModal(projectId) {
          const data = projectData[projectId];
          if (!data) return;
          lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          modalTitle.textContent = data.title;
          modalBody.innerHTML = `
            <p class="subtitle">${data.description}</p>
            <p>${data.details}</p>
            <div class="badges" style="margin-top: 16px;">
              ${data.tech.map(t => `<span class="badge-tech">${t}</span>`).join('')}
            </div>
            ${data.url ? `<div style="margin-top: 20px;"><a class="btn primary" href="${data.url}" target="_blank" rel="noopener">Visit ${data.title} <svg class="icon" aria-hidden="true"><use href="#icon-external"/></svg></a></div>` : ''}
          `;
          modalMedia.innerHTML = ''; // Clear media for now
          modal.classList.add('open');
          modalClose.focus();
        }

        function closeModal() {
          modal.classList.remove('open');
          if (lastFocus && typeof lastFocus.focus === 'function') {
            lastFocus.focus({ preventScroll: true });
          }
          lastFocus = null;
        }

        // Bind modal triggers
        document.querySelectorAll('[data-open-modal]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            const projectId = btn.getAttribute('data-open-modal');
            openModal(projectId);
          });
        });

        modalClose.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
          if (e.target === modal) closeModal();
        });
        window.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && modal.classList.contains('open')) {
            closeModal();
          }
        });
      })();

      // Easter Egg: Konami Code — classic sequence, slightly more useful now
      // Try: ↑ ↑ ↓ ↓ ← → ← → B A (or just mash keys in sequence)
      (function() {
        const konamiCode = [
          'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
          'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
          'KeyB', 'KeyA'
        ];
        let konamiIndex = 0;
        window.addEventListener('keydown', (e) => {
          if (e.key === konamiCode[konamiIndex]) {
            konamiIndex++;
            if (konamiIndex === konamiCode.length) {
              konamiIndex = 0;
              // Open command palette as a practical easter surprise
              const cmdk = document.getElementById('cmdk');
              if (cmdk && !cmdk.classList.contains('open')) {
                cmdk.classList.add('open');
                const input = document.getElementById('cmdkInput');
                input && input.focus();
              }
              // Also toggle a slower theme rotation for a bit of calm
              if (typeof window.__toggleSlowThemes === 'function') {
                window.__toggleSlowThemes(true);
                setTimeout(() => window.__toggleSlowThemes(false), 120000); // 2 mins
              }
              window.showToast && window.showToast('Secret mode enabled. Press Esc to close.');
            }
          } else {
            konamiIndex = 0;
          }
        });
      })();

      // Easter Egg: Brand dot click counter — click the dot 7 times for a surprise
      (function() {
        const brandDot = document.querySelector('.brand .dot');
        if (!brandDot) return;
        let clickCount = 0;
        let lastClickTime = 0;
        brandDot.style.cursor = 'pointer';
        function spawnDotSmoke(originEl) {
          try {
            const rect = originEl.getBoundingClientRect();
            const wrap = document.createElement('div');
            wrap.className = 'dot-smoke';
            wrap.style.position = 'fixed';
            wrap.style.left = (rect.left + rect.width / 2) + 'px';
            wrap.style.top = (rect.top + rect.height / 2) + 'px';
            wrap.style.transform = 'translate(-50%, -50%)';
            for (let i = 0; i < 10; i++) {
              const puff = document.createElement('span');
              puff.className = 'smoke-puff';
              const angle = (Math.PI * 2) * (i / 10) + (Math.random() * 0.6 - 0.3);
              const radius = 12 + Math.random() * 16;
              const dx = Math.cos(angle) * radius;
              const dy = Math.sin(angle) * radius - (6 + Math.random() * 10);
              puff.style.setProperty('--dx', dx + 'px');
              puff.style.setProperty('--dy', dy + 'px');
              puff.style.left = '0px';
              puff.style.top = '0px';
              puff.style.animationDelay = (i * 12) + 'ms';
              wrap.appendChild(puff);
            }
            document.body.appendChild(wrap);
            setTimeout(() => wrap.remove(), 1100);
          } catch (_) {}
        }
        brandDot.addEventListener('click', () => {
          const now = Date.now();
          if (now - lastClickTime > 2000) clickCount = 0; // Reset if too slow
          clickCount++;
          lastClickTime = now;
          // spawn red smoke diffusion on each click
          spawnDotSmoke(brandDot);
          if (clickCount === 7) {
            window.showToast && window.showToast('7 clicks! You discovered the secret dot. Impressive persistence!');
            // Make it dance
            brandDot.style.animation = 'none';
            setTimeout(() => {
              brandDot.style.animation = 'pulse 0.5s ease 3';
            }, 10);
            clickCount = 0;
          }
        });
      })();

      // Easter Egg: Triple-click logo for secret message
      (function() {
        const brand = document.querySelector('.brand');
        if (!brand) return;
        let clickCount = 0;
        let timeout;
        brand.addEventListener('click', (e) => {
          if (e.target !== brand && !brand.contains(e.target)) return;
          clickCount++;
          clearTimeout(timeout);
          timeout = setTimeout(() => { clickCount = 0; }, 600);
          
            if (clickCount === 3) {
            clickCount = 0;
            const messages = [
              '"Code by day, music by night — building stuff that matters."',
              '"Every line of code is a beat in the song of creation."',
              '"Shipping fast, learning faster, improving always."',
              '"Good design is invisible. Great design is unforgettable."',
              '"Focus, flow, iterate — that\'s the developer\'s groove."'
            ];
            const msg = messages[Math.floor(Math.random() * messages.length)];
            window.showToast && window.showToast(msg);
          }
        });
      })();

      // Easter Egg: Hold Shift while scrolling for slow-mo smooth scroll
      (function() {
        let smoothScrollMultiplier = 1;
        window.addEventListener('keydown', (e) => {
          if (e.shiftKey && e.key === 'Shift' && smoothScrollMultiplier === 1) {
            smoothScrollMultiplier = 0.5;
            window.showToast && window.showToast('Slow-mo scrolling enabled. Release Shift to return to normal.');
          }
        });
        window.addEventListener('keyup', (e) => {
          if (e.key === 'Shift' && smoothScrollMultiplier !== 1) {
            smoothScrollMultiplier = 1;
            window.showToast && window.showToast('Normal scrolling restored!');
          }
        });
        // Apply multiplier to smooth scroll function
        const originalSmoothScrollTo = window.smoothScrollTo;
        if (originalSmoothScrollTo) {
          window.smoothScrollTo = function(target, duration) {
            return originalSmoothScrollTo(target, duration * (1 / smoothScrollMultiplier));
          };
        }
      })();

      // Easter Egg: Type "dev" anywhere on the page
      (function() {
        let typed = '';
        const trigger = 'dev';
        let timeout;
        window.addEventListener('keypress', (e) => {
          // Ignore if typing in input
          if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
          
          typed += e.key.toLowerCase();
          clearTimeout(timeout);
          timeout = setTimeout(() => { typed = ''; }, 2000);
          
          if (typed.includes(trigger)) {
            typed = '';
            const devMsgs = [
              'Developer mode: Unlocked!',
              'You found the dev portal! (Just kidding, there isn\'t one... yet.)',
              'Pro tip: Open DevTools (F12) to see my code comments!',
              '"The best code is code that explains itself." — Me, probably',
              'You typed "dev"! Here\'s a secret: I obsess over performance.'
            ];
            window.showToast && window.showToast(devMsgs[Math.floor(Math.random() * devMsgs.length)]);
          }
        });
      })();

      // Easter Egg: Click all section icons in order
      (function() {
        const requiredSections = ['#projects', '#vision', '#why', '#skills'];
        let clickedInOrder = [];
        
        requiredSections.forEach((selector, index) => {
          const section = document.querySelector(selector);
          if (!section) return;
          const icon = section.querySelector('.section-title .icon');
          if (!icon) return;
          
          icon.style.cursor = 'pointer';
          icon.addEventListener('click', (e) => {
            e.stopPropagation();
            
            if (clickedInOrder.length === index && clickedInOrder.indexOf(selector) === -1) {
              clickedInOrder.push(selector);
              
              if (clickedInOrder.length === requiredSections.length) {
                window.showToast && window.showToast('Incredible! You clicked all section icons in order! You win... bragging rights!');
                clickedInOrder = [];
                
                // Celebration animation
                requiredSections.forEach(sel => {
                  const s = document.querySelector(sel);
                  if (s) {
                    s.style.animation = 'none';
                    setTimeout(() => {
                      s.style.animation = 'pulse 0.4s ease';
                    }, 10);
                  }
                });
              }
            } else if (clickedInOrder.indexOf(selector) === -1) {
              // Clicked out of order, reset
              clickedInOrder = [selector];
            }
          });
        });
      })();

      // Haptic feedback helper for touch devices
      (function() {
        // Check if haptic feedback is supported
        const supportsHaptics = 'vibrate' in navigator;
        
        window.triggerHaptic = function(type = 'light') {
          if (!supportsHaptics) return;
          
          // Different vibration patterns for different feedback types
          const patterns = {
            light: [10],
            medium: [20],
            heavy: [30],
            success: [10, 20, 10],
            error: [50, 20, 50]
          };
          
          const pattern = patterns[type] || patterns.light;
          navigator.vibrate(pattern);
        };
        
        // Add haptic feedback to interactive elements on touch devices
        // Consolidated single listener for better performance
        if (supportsHaptics) {
          document.addEventListener('touchstart', (e) => {
            // Check in priority order: buttons, then tags/chips, then cards
            if (e.target.closest('.btn')) {
              window.triggerHaptic('light');
            } else if (e.target.closest('.tag, .chip')) {
              window.triggerHaptic('light');
            } else if (e.target.closest('.card')) {
              window.triggerHaptic('light');
            }
          }, { passive: true });
        }
      })();

      // Easter Egg: Double-tap anywhere to spawn a burst of particles
      (function() {
        let lastTap = 0;
        document.addEventListener('touchend', (e) => {
          const now = Date.now();
          if (now - lastTap < 300) {
            // Double tap detected
            const touch = e.changedTouches[0];
            if (touch && window.spawnButtonParticles) {
              // Create fake button to spawn particles
              const fakeBtn = { getBoundingClientRect: () => ({
                left: touch.clientX - 25,
                top: touch.clientY - 25,
                width: 50,
                height: 50
              })};
              window.spawnButtonParticles(fakeBtn);
              window.showToast && window.showToast('Sparkles!');
              // Trigger haptic feedback
              window.triggerHaptic && window.triggerHaptic('success');
            }
          }
          lastTap = now;
        }, { passive: true });
      })();

      // Easter Egg: Shake device/window for surprise (mobile)
      (function() {
        if (!window.DeviceMotionEvent) return;
        let lastShake = 0;
        const shakeThreshold = 25;
        let lastX, lastY, lastZ;
        
        window.addEventListener('devicemotion', (e) => {
          const acc = e.accelerationIncludingGravity;
          if (!acc) return;
          
          const now = Date.now();
          if (now - lastShake < 1000) return;
          
          if (lastX !== undefined) {
            const deltaX = Math.abs(acc.x - lastX);
            const deltaY = Math.abs(acc.y - lastY);
            const deltaZ = Math.abs(acc.z - lastZ);
            
            if (deltaX + deltaY + deltaZ > shakeThreshold) {
              lastShake = now;
              // Trigger theme change or fun effect
              window.showToast && window.showToast('🎲 Shake detected! Colors are shifting...');
              // Can trigger a theme switch here if desired
            }
          }
          
          lastX = acc.x;
          lastY = acc.y;
          lastZ = acc.z;
        }, { passive: true });
      })();

      // Request Idle Callback polyfill for better performance on low-end devices
      window.requestIdleCallback = window.requestIdleCallback || function(cb) {
        const start = Date.now();
        return setTimeout(function() {
          cb({
            didTimeout: false,
            timeRemaining: function() {
              return Math.max(0, 50 - (Date.now() - start));
            }
          });
        }, 1);
      };

      window.cancelIdleCallback = window.cancelIdleCallback || function(id) {
        clearTimeout(id);
      };

      // Performance Monitor - Track FPS and frame times for debugging
      const PerformanceMonitor = (function() {
        let frames = [];
        let lastTime = performance.now();
        const maxSamples = 60;
        
        function recordFrame() {
          const now = performance.now();
          const delta = now - lastTime;
          lastTime = now;
          
          frames.push(delta);
          if (frames.length > maxSamples) {
            frames.shift();
          }
        }
        
        function getMetrics() {
          if (frames.length === 0) return { fps: 60, avgFrameTime: 16.67, maxFrameTime: 16.67 };
          
          const avgFrameTime = frames.reduce((a, b) => a + b, 0) / frames.length;
          const fps = 1000 / avgFrameTime;
          const maxFrameTime = Math.max(...frames);
          
          return { fps: Math.round(fps), avgFrameTime: avgFrameTime.toFixed(2), maxFrameTime: maxFrameTime.toFixed(2) };
        }
        
        return { recordFrame, getMetrics };
      })();
      
      // Expose performance metrics for debugging
      window.getPerformanceMetrics = () => PerformanceMonitor.getMetrics();

      // Entrance Animation System - Intersection Observer for performance
      (function() {
        if (!('IntersectionObserver' in window)) return;
        
        const observerOptions = {
          root: null,
          rootMargin: '0px 0px -100px 0px',
          threshold: 0.1
        };
        
        // Special handling for skill categories - sequential animation
        const skillsObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const skillCategories = document.querySelectorAll('.skill-category');
              let delay = 0;
              skillCategories.forEach((category, index) => {
                setTimeout(() => {
                  const animationType = category.dataset.animate || 'fade-in';
                  category.classList.add(animationType);
                }, delay);
                delay += 150; // Stagger by 150ms
              });
              skillsObserver.unobserve(entry.target);
            }
          });
        }, observerOptions);
        
        // Observe skills container for sequential animation
        const skillsContainer = document.querySelector('.skills-container');
        if (skillsContainer) {
          skillsObserver.observe(skillsContainer);
        }
        
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const element = entry.target;
              // Skip skill categories as they're handled separately
              if (element.classList.contains('skill-category')) return;
              
              const animationType = element.dataset.animate || 'fade-in';
              element.classList.add(animationType);
              observer.unobserve(element);
            }
          });
        }, observerOptions);
        
        // Observe all elements with data-animate attribute except skill categories
        window.requestIdleCallback(() => {
          document.querySelectorAll('[data-animate]').forEach(el => {
            if (!el.classList.contains('skill-category')) {
              observer.observe(el);
            }
          });
        });
      })();

      // Unified Event Delegation System for better performance
      (function() {
        // Single delegated click handler for all interactive elements
        document.addEventListener('click', (e) => {
          const target = e.target;
          
          // Button clicks with ripple effect
          const btn = target.closest('.btn');
          if (btn) {
            btn.classList.add('clicked');
            setTimeout(() => btn.classList.remove('clicked'), 200);
            PerformanceMonitor.recordFrame();
          }
          
          // Card clicks
          const card = target.closest('.card');
          if (card && !btn) {
            card.classList.add('clicked');
            setTimeout(() => card.classList.remove('clicked'), 200);
          }
        }, { passive: false });
        
        // Delegated hover tracking for cursor effects
        let lastHoverTarget = null;
        document.addEventListener('mousemove', (e) => {
          const target = e.target.closest('[data-cursor]');
          if (target !== lastHoverTarget) {
            if (lastHoverTarget) {
              lastHoverTarget.style.removeProperty('--mx');
              lastHoverTarget.style.removeProperty('--my');
            }
            lastHoverTarget = target;
          }
          
          if (target) {
            const rect = target.getBoundingClientRect();
            const mx = ((e.clientX - rect.left) / rect.width) * 100;
            const my = ((e.clientY - rect.top) / rect.height) * 100;
            target.style.setProperty('--mx', `${mx}%`);
            target.style.setProperty('--my', `${my}%`);
          }
        }, { passive: true });
      })();

      // Unique Feature: Time-based greeting message - shows personality
      (function() {
        const hour = new Date().getHours();
        let greeting = '';
        let emoji = '';
        
        if (hour >= 5 && hour < 12) {
          greeting = 'Good morning!';
          emoji = '🌅';
        } else if (hour >= 12 && hour < 17) {
          greeting = 'Good afternoon!';
          emoji = '☀️';
        } else if (hour >= 17 && hour < 21) {
          greeting = 'Good evening!';
          emoji = '🌆';
        } else {
          greeting = 'Burning the midnight oil?';
          emoji = '🌙';
        }
        
        // Show greeting after initial load - use requestIdleCallback for better performance
        window.requestIdleCallback(() => {
          setTimeout(() => {
            if (window.showToast) {
              window.showToast(`${emoji} ${greeting} Welcome to my portfolio!`);
            }
          }, 2000);
        });
      })();

      // Unique Feature: Long-press tooltips for mobile (accessibility!)
      (function() {
        let longPressTimer;
        let currentTooltip = null;
        
        document.addEventListener('touchstart', (e) => {
          const target = e.target.closest('[data-tooltip], [title]');
          if (!target) return;
          
          const tooltipText = target.getAttribute('data-tooltip') || target.getAttribute('title');
          if (!tooltipText) return;
          
          longPressTimer = setTimeout(() => {
            // Show custom mobile tooltip
            if (currentTooltip) currentTooltip.remove();
            
            const tooltip = document.createElement('div');
            tooltip.className = 'mobile-tooltip';
            tooltip.textContent = tooltipText;
            tooltip.style.cssText = `
              position: fixed;
              bottom: 20px;
              left: 50%;
              transform: translateX(-50%);
              background: rgba(20, 20, 20, 0.95);
              color: white;
              padding: 12px 20px;
              border-radius: 12px;
              font-size: 14px;
              z-index: 10000;
              max-width: 80vw;
              text-align: center;
              backdrop-filter: blur(10px);
              -webkit-backdrop-filter: blur(10px);
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
              animation: fadeInUp 0.3s ease;
            `;
            document.body.appendChild(tooltip);
            currentTooltip = tooltip;
            
            // Haptic feedback
            window.triggerHaptic && window.triggerHaptic('medium');
            
            // Auto-remove after 3 seconds
            setTimeout(() => {
              if (currentTooltip === tooltip) {
                tooltip.style.animation = 'fadeOutDown 0.3s ease';
                setTimeout(() => tooltip.remove(), 300);
                currentTooltip = null;
              }
            }, 3000);
          }, 500); // 500ms long press
        }, { passive: true });
        
        document.addEventListener('touchend', () => {
          clearTimeout(longPressTimer);
        }, { passive: true });
        
        document.addEventListener('touchmove', () => {
          clearTimeout(longPressTimer);
        }, { passive: true });
      })();

      // Unique Feature: Idle detection - subtle animation after inactivity
      (function() {
        let idleTimer;
        let isIdle = false;
        const idleTimeout = 30000; // 30 seconds
        
        function resetIdle() {
          clearTimeout(idleTimer);
          isIdle = false;
          idleTimer = setTimeout(() => {
            isIdle = true;
            // Subtle reminder that the page is interactive
            if (window.showToast) {
              const messages = [
                  'Still here? Try clicking around - there are surprises!',
                  'Psst... try the Konami code (↑↑↓↓←→←→BA)',
                  'The colors change every few seconds. Watch closely!',
                  'Try double-tapping anywhere for sparkles!',
                  'Click the section icons in order for a reward!'
                ];
              const msg = messages[Math.floor(Math.random() * messages.length)];
              window.showToast(msg);
            }
          }, idleTimeout);
        }
        
        ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'].forEach(event => {
          document.addEventListener(event, resetIdle, { passive: true });
        });
        
        resetIdle();
      })();

      // Unique Feature: Progress indicator for long content
      (function() {
        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          height: 3px;
          background: linear-gradient(90deg, var(--theme-primary-3), var(--theme-primary-5));
          width: 0%;
          z-index: 9999;
          transition: width 0.1s ease;
          pointer-events: none;
        `;
        document.body.appendChild(progressBar);
        
        function updateProgress() {
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
          const progress = (scrollTop / scrollHeight) * 100;
          progressBar.style.width = progress + '%';
          
          // Adaptive opacity - hide when at top
          progressBar.style.opacity = progress < 5 ? '0' : '1';
        }
        
        window.addEventListener('scroll', updateProgress, { passive: true });
        updateProgress();
      })();

      // Unique Feature: Celebrate milestones (scroll depth achievements)
      (function() {
        const milestones = [
          { percent: 25, message: 'Quarter way through! Keep scrolling!', triggered: false },
          { percent: 50, message: 'Halfway there! You\'re doing great!', triggered: false },
          { percent: 75, message: 'Almost done! Just a bit more!', triggered: false },
          { percent: 100, message: 'You made it to the bottom! Thanks for exploring!', triggered: false }
        ];
        
        function checkMilestones() {
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
          const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
          const progress = (scrollTop / scrollHeight) * 100;
          
          milestones.forEach(milestone => {
            if (!milestone.triggered && progress >= milestone.percent) {
              milestone.triggered = true;
              window.showToast && window.showToast(milestone.message);
              window.triggerHaptic && window.triggerHaptic('success');
            }
          });
        }
        
        // Throttle scroll handler for performance
        let scrollTimeout;
        window.addEventListener('scroll', () => {
          clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(checkMilestones, 300);
        }, { passive: true });
      })();

      // Theme Manager — rotates palettes and renders subtle themed effects
      // Themes: fire (smoke + crackle), ice (snow blizzard), forest (branches + sub-branches), lilac (bubbles), fog (fog layer)
      (function() {
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const root = document.documentElement;
        // Feature detect color-mix and mark fallback class
        try { if (!CSS.supports('background: color-mix(in oklab, #fff 10%, #000)')) { document.documentElement.classList.add('no-colormix'); } } catch(_) {}
        // Coarse pointer scale for effects and hover bands
        const pointerCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

        const themes = [
          {
            id: 'fire',
            vars: {
              p1: '#fff8', p2: '#ffd166', p3: '#ff9f1c', p4: '#ff6a00', p5: '#e85d04', p6: '#9d0208',
              g1: 'rgba(255,200,100,0.75)', g2: 'rgba(255,120,0,0.35)', g3: 'rgba(255,90,0,0.25)', g4: 'rgba(255,170,0,0.18)',
              filter: 'none'
            }
          },
          {
            id: 'ice',
            vars: {
              p1: '#f8ffff', p2: '#90d5ff', p3: '#5bb3ff', p4: '#0084ff', p5: '#0066cc', p6: '#004499',
              g1: 'rgba(144,213,255,0.75)', g2: 'rgba(91,179,255,0.35)', g3: 'rgba(0,132,255,0.25)', g4: 'rgba(144,213,255,0.18)',
              filter: 'none'
            }
          },
          {
            id: 'forest',
            vars: {
              p1: '#f6fff6', p2: '#a8e6a1', p3: '#6edb7a', p4: '#37b24d', p5: '#2f9e44', p6: '#1b7a32',
              g1: 'rgba(104, 220, 130, 0.75)', g2: 'rgba(55, 178, 77, 0.35)', g3: 'rgba(31, 124, 54, 0.25)', g4: 'rgba(168, 230, 161, 0.18)',
              filter: 'none'
            }
          },
          {
            id: 'lilac',
            vars: {
              p1: '#fff8ff', p2: '#d9aaff', p3: '#b885ff', p4: '#9966ff', p5: '#7a33ff', p6: '#5c00cc',
              g1: 'rgba(217,170,255,0.75)', g2: 'rgba(184,133,255,0.35)', g3: 'rgba(153,102,255,0.25)', g4: 'rgba(217,170,255,0.18)',
              filter: 'none'
            }
          },
          {
            id: 'fog',
            vars: {
              p1: '#ffffff', p2: '#dcdcdc', p3: '#bfbfbf', p4: '#9a9a9a', p5: '#7d7d7d', p6: '#5f5f5f',
              g1: 'rgba(230,230,230,0.75)', g2: 'rgba(200,200,200,0.35)', g3: 'rgba(160,160,160,0.25)', g4: 'rgba(220,220,220,0.18)',
              filter: 'none'
            }
          }
        ];

        // Color interpolation utilities for smooth transitions
        // Memoization cache for color parsing - significant performance improvement
        const colorCache = new Map();
        function hexToRgb(hex) {
          // Check cache first for O(1) lookup
          if (colorCache.has(hex)) {
            return colorCache.get(hex);
          }
          
          let result;
          // Handle rgba strings like rgba(255,200,100,0.75)
          if (hex.startsWith('rgba') || hex.startsWith('rgb')) {
            const match = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
            if (match) {
              result = {
                r: parseInt(match[1]),
                g: parseInt(match[2]),
                b: parseInt(match[3]),
                a: match[4] ? parseFloat(match[4]) : 1
              };
            }
          }
          // Handle 4-digit hex with alpha shorthand (e.g., #fff8 -> rgba(255,255,255,0.533))
          if (!result) {
            const hex4Match = /^#?([a-f\d]{3})([a-f\d])$/i.exec(hex);
            if (hex4Match) {
              const s = hex4Match[1];
              result = {
                r: parseInt(s[0] + s[0], 16),
                g: parseInt(s[1] + s[1], 16),
                b: parseInt(s[2] + s[2], 16),
                a: parseInt(hex4Match[2] + hex4Match[2], 16) / 255
              };
            }
          }
          // Handle short hex (e.g., #fff -> #ffffff)
          if (!result && /^#?[a-f\d]{3}$/i.test(hex)) {
            const shorthand = hex.replace('#', '');
            result = {
              r: parseInt(shorthand[0] + shorthand[0], 16),
              g: parseInt(shorthand[1] + shorthand[1], 16),
              b: parseInt(shorthand[2] + shorthand[2], 16),
              a: 1
            };
          }
          // Handle 8-digit hex with alpha (e.g., #ffffff88)
          if (!result) {
            const hex8Match = /^#?([a-f\d]{6})([a-f\d]{2})$/i.exec(hex);
            if (hex8Match) {
              result = {
                r: parseInt(hex8Match[1].substring(0, 2), 16),
                g: parseInt(hex8Match[1].substring(2, 4), 16),
                b: parseInt(hex8Match[1].substring(4, 6), 16),
                a: parseInt(hex8Match[2], 16) / 255
              };
            }
          }
          // Handle standard 6-digit hex colors
          if (!result) {
            const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            result = match ? {
              r: parseInt(match[1], 16),
              g: parseInt(match[2], 16),
              b: parseInt(match[3], 16),
              a: 1
            } : { r: 255, g: 255, b: 255, a: 1 };
          }
          
          // Cache the result for future lookups
          colorCache.set(hex, result);
          return result;
        }
        
        function rgbToHex(r, g, b) {
          return "#" + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
        }
        
        function rgbaToString(r, g, b, a) {
          return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
        }
        
        // Cache for alpha channel detection to avoid repeated regex tests
        const alphaCache = new Map();
        function hasAlphaChannel(color) {
          if (alphaCache.has(color)) {
            return alphaCache.get(color);
          }
          const result = color.startsWith('rgba') || /#?[a-f\d]{4}$/i.test(color) || /#?[a-f\d]{8}$/i.test(color);
          alphaCache.set(color, result);
          return result;
        }
        
        function interpolateColor(color1, color2, t) {
          const c1 = hexToRgb(color1);
          const c2 = hexToRgb(color2);
          const hasAlpha1 = hasAlphaChannel(color1);
          const hasAlpha2 = hasAlphaChannel(color2);
          const useAlpha = hasAlpha1 || hasAlpha2 || c1.a !== 1 || c2.a !== 1;
          
          const r = c1.r + (c2.r - c1.r) * t;
          const g = c1.g + (c2.g - c1.g) * t;
          const b = c1.b + (c2.b - c1.b) * t;
          const a = useAlpha ? (c1.a + (c2.a - c1.a) * t) : 1;
          
          return useAlpha ? rgbaToString(r, g, b, a) : rgbToHex(r, g, b);
        }
        
        // Linear easing for perfectly even-rate crossfades (less "surprise" than cubic)
        function linearEase(t) { return t; }
        
        let currentThemeVars = {};
        let isTransitioning = false;
        
        function applyTheme(theme, instant = false) {
          root.classList.remove('theme-fire','theme-ice','theme-forest','theme-lilac','theme-fog');
          root.classList.add(`theme-${theme.id}`);
          const v = theme.vars;
          
          if (instant || Object.keys(currentThemeVars).length === 0) {
            // Apply instantly on first load
            currentThemeVars = { ...v };
            root.style.setProperty('--theme-primary-1', v.p1);
            root.style.setProperty('--theme-primary-2', v.p2);
            root.style.setProperty('--theme-primary-3', v.p3);
            root.style.setProperty('--theme-primary-4', v.p4);
            root.style.setProperty('--theme-primary-5', v.p5);
            root.style.setProperty('--theme-primary-6', v.p6);
            root.style.setProperty('--theme-glow-1', v.g1);
            root.style.setProperty('--theme-glow-2', v.g2);
            root.style.setProperty('--theme-glow-3', v.g3);
            root.style.setProperty('--theme-glow-4', v.g4);
            root.style.setProperty('--theme-filter', v.filter);
            // Also sync accent variables immediately
            root.style.setProperty('--accent', v.p4);
            root.style.setProperty('--accent-2', v.p3);
            return;
          }
          
          // Smooth transition over 3 seconds
          if (isTransitioning) return; // Don't start a new transition if one is in progress
          isTransitioning = true;
          
          const startVars = { ...currentThemeVars };
          const endVars = { ...v };
          const duration = 4500; // smoother 4.5 seconds
          const startTime = performance.now();
          
          // Pre-compute color pairs and RGB values to avoid redundant parsing
          const colorPairs = [];
          ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].forEach(key => {
            if (startVars[key] !== endVars[key]) {
              const num = key.slice(1);
              const c1 = hexToRgb(startVars[key]);
              const c2 = hexToRgb(endVars[key]);
              const useAlpha = hasAlphaChannel(startVars[key]) || hasAlphaChannel(endVars[key]) || c1.a !== 1 || c2.a !== 1;
              colorPairs.push({ propName: `--theme-primary-${num}`, c1, c2, useAlpha });
            }
          });
          ['g1', 'g2', 'g3', 'g4'].forEach(key => {
            if (startVars[key] !== endVars[key]) {
              const num = key.slice(1);
              const c1 = hexToRgb(startVars[key]);
              const c2 = hexToRgb(endVars[key]);
              const useAlpha = hasAlphaChannel(startVars[key]) || hasAlphaChannel(endVars[key]) || c1.a !== 1 || c2.a !== 1;
              colorPairs.push({ propName: `--theme-glow-${num}`, c1, c2, useAlpha });
            }
          });
          // Accent pairs
          const acc1c1 = hexToRgb(startVars.p4);
          const acc1c2 = hexToRgb(endVars.p4);
          const acc1Alpha = hasAlphaChannel(startVars.p4) || hasAlphaChannel(endVars.p4) || acc1c1.a !== 1 || acc1c2.a !== 1;
          const acc2c1 = hexToRgb(startVars.p3);
          const acc2c2 = hexToRgb(endVars.p3);
          const acc2Alpha = hasAlphaChannel(startVars.p3) || hasAlphaChannel(endVars.p3) || acc2c1.a !== 1 || acc2c2.a !== 1;
          
          function animate() {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = linearEase(progress);
            
            // Interpolate pre-computed color pairs (direct RGB interpolation, no parsing)
            for (const pair of colorPairs) {
              const r = pair.c1.r + (pair.c2.r - pair.c1.r) * eased;
              const g = pair.c1.g + (pair.c2.g - pair.c1.g) * eased;
              const b = pair.c1.b + (pair.c2.b - pair.c1.b) * eased;
              const a = pair.useAlpha ? (pair.c1.a + (pair.c2.a - pair.c1.a) * eased) : 1;
              const value = pair.useAlpha ? rgbaToString(r, g, b, a) : rgbToHex(r, g, b);
              root.style.setProperty(pair.propName, value);
            }
            // Interpolate accent pair
            const r1 = acc1c1.r + (acc1c2.r - acc1c1.r) * eased;
            const g1 = acc1c1.g + (acc1c2.g - acc1c1.g) * eased;
            const b1 = acc1c1.b + (acc1c2.b - acc1c1.b) * eased;
            const a1 = acc1Alpha ? (acc1c1.a + (acc1c2.a - acc1c1.a) * eased) : 1;
            const acc = acc1Alpha ? rgbaToString(r1, g1, b1, a1) : rgbToHex(r1, g1, b1);
            
            const r2 = acc2c1.r + (acc2c2.r - acc2c1.r) * eased;
            const g2 = acc2c1.g + (acc2c2.g - acc2c1.g) * eased;
            const b2 = acc2c1.b + (acc2c2.b - acc2c1.b) * eased;
            const a2 = acc2Alpha ? (acc2c1.a + (acc2c2.a - acc2c1.a) * eased) : 1;
            const acc2 = acc2Alpha ? rgbaToString(r2, g2, b2, a2) : rgbToHex(r2, g2, b2);
            
            root.style.setProperty('--accent', acc);
            root.style.setProperty('--accent-2', acc2);
            
            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              currentThemeVars = { ...endVars };
              isTransitioning = false;
              // Set final values to ensure accuracy
              root.style.setProperty('--theme-primary-1', endVars.p1);
              root.style.setProperty('--theme-primary-2', endVars.p2);
              root.style.setProperty('--theme-primary-3', endVars.p3);
              root.style.setProperty('--theme-primary-4', endVars.p4);
              root.style.setProperty('--theme-primary-5', endVars.p5);
              root.style.setProperty('--theme-primary-6', endVars.p6);
              root.style.setProperty('--theme-glow-1', endVars.g1);
              root.style.setProperty('--theme-glow-2', endVars.g2);
              root.style.setProperty('--theme-glow-3', endVars.g3);
              root.style.setProperty('--theme-glow-4', endVars.g4);
              root.style.setProperty('--theme-filter', endVars.filter);
              root.style.setProperty('--accent', endVars.p4);
              root.style.setProperty('--accent-2', endVars.p3);
            }
          }
          
          requestAnimationFrame(animate);
        }

        // Themed overlay effects on a lightweight canvas
        let fx, ctx, w = 0, h = 0;
        let dpr = Math.min(1.5, window.devicePixelRatio || 1) * DeviceCapabilities.getCanvasScale();
        let isLowPowerMode = false;
        
        // Monitor battery status for adaptive performance
        DeviceCapabilities.checkLowPowerMode((lowPower) => {
          isLowPowerMode = lowPower;
          if (lowPower && !perfMode) {
            // Reduce particle counts in low power mode
            const particleLimit = Math.floor(DeviceCapabilities.getParticleLimit() * 0.5);
            if (state.parts && state.parts.length > particleLimit) {
              state.parts.length = particleLimit;
            }
          }
        });
        // Defer visual effects until after initial view or first interaction
        let effectsEnabled = false;
        let effectsAlpha = 0;
        let perfMode = false; // enable when FPS is low
        let lastTick = 0, fpsEMA = 60;
        function animateEffectsAlpha() {
          if (!effectsEnabled) return;
          effectsAlpha = Math.min(1, effectsAlpha + 0.045);
          if (effectsAlpha < 1) requestAnimationFrame(animateEffectsAlpha);
        }
        const enableEffects = () => {
          if (effectsEnabled) return;
          effectsEnabled = true;
          effectsAlpha = 0;
          // Reseed particles now that effects are enabled
          resetFor(themes[themeIndex].id);
          requestAnimationFrame(animateEffectsAlpha);
        };
        // Enable after 4s or on first interaction (whichever comes first)
        setTimeout(enableEffects, 4000);
        const firstInteraction = () => { enableEffects(); window.removeEventListener('scroll', firstInteraction); window.removeEventListener('pointermove', firstInteraction); };
        window.addEventListener('scroll', firstInteraction, { passive: true });
        window.addEventListener('pointermove', firstInteraction, { passive: true });
        let resizeId;
        function ensureCanvas() {
          if (!fx) {
            fx = document.createElement('canvas');
            fx.id = 'fx-layer';
            Object.assign(fx.style, {
              position: 'fixed', inset: '0', zIndex: '0', pointerEvents: 'none'
            });
            document.body.prepend(fx);
            ctx = fx.getContext('2d');
          }
          const nw = Math.ceil(window.innerWidth);
          const nh = Math.ceil(window.innerHeight);
          if (nw !== w || nh !== h) {
            w = nw; h = nh; fx.width = Math.floor(w * dpr); fx.height = Math.floor(h * dpr);
            fx.style.width = w + 'px'; fx.style.height = h + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          }
        }
        window.addEventListener('resize', () => { cancelAnimationFrame(resizeId); resizeId = requestAnimationFrame(ensureCanvas); }, { passive: true });
        // Enhanced interactive background clicks with performance optimization
        function spawnBurst(x, y, themeId) {
          if (prefersReduced || isLowPowerMode) return;
          
          // Adaptive particle count based on device capabilities and viewport
          const burstScale = DeviceCapabilities.getBurstScale();
          const viewportScale = DeviceCapabilities.getViewportScale();
          const combinedScale = burstScale * viewportScale;
          
          const burst = { x, y, themeId, life: 0, max: 1200, items: [] };
          const add = (o) => burst.items.push(o);
          
          if (themeId === 'fire') {
            const count = Math.floor(26 * combinedScale);
            for (let i = 0; i < count; i++) {
              const a = Math.random() * Math.PI * 2; 
              const s = (0.8 + Math.random()*1.6) * viewportScale;
              const r = (0.8 + Math.random()*1.6) * viewportScale;
              add({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 0.4, r, life: 0, max: 700 + Math.random()*500 });
            }
          } else if (themeId === 'ice') {
            const rings = Math.max(1, Math.ceil(3 * combinedScale));
            for (let i = 0; i < rings; i++) {
              const vr = (1.6 + i*0.3) * viewportScale;
              add({ x, y, ring: true, r: 2 * viewportScale, vr, life: 0, max: 900 });
            }
          } else if (themeId === 'forest') {
            const petals = Math.max(3, Math.floor(8 * combinedScale)); 
            for (let i = 0; i < petals; i++) {
              const vr = 0.9 * viewportScale;
              add({ x, y, petal: true, a: (i/petals)*Math.PI*2, r: 0, vr, life: 0, max: 1000 });
            }
          } else if (themeId === 'lilac') {
            const count = Math.max(6, Math.floor(14 * combinedScale));
            for (let i = 0; i < count; i++) { 
              const a = Math.random()*Math.PI*2; 
              const s = (0.9 + Math.random()*1.4) * viewportScale;
              const r = (1.2 + Math.random()*1.8) * viewportScale;
              add({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, r, life: 0, max: 800 }); 
            }
          } else if (themeId === 'fog') {
            const count = Math.max(4, Math.floor(10 * combinedScale));
            for (let i = 0; i < count; i++) {
              const r = (4 + Math.random()*6) * viewportScale;
              const vr = (0.3 + Math.random()*0.4) * viewportScale;
              const ox = (Math.random()-0.5)*8 * viewportScale;
              const oy = (Math.random()-0.5)*8 * viewportScale;
              add({ x, y, smoke: true, r, vr, life: 0, max: 1400, ox, oy });
            }
          }
          (state.bursts || (state.bursts = [])).push(burst);
        }
        // Touch-optimized burst spawning with throttling on mobile
        let lastBurstTime = 0;
        const burstCooldown = DeviceCapabilities.isMobile ? 300 : DeviceCapabilities.isTablet ? 200 : 100; // ms between bursts
        const maxConcurrentBursts = DeviceCapabilities.isMobile ? 2 : DeviceCapabilities.isTablet ? 3 : 5; // Limit active bursts
        
        window.addEventListener('pointerdown', (e) => {
          const now = Date.now();
          // Throttle burst spawning on mobile to prevent lag from rapid taps
          if (now - lastBurstTime < burstCooldown) return;
          
          // Limit concurrent bursts to prevent memory/performance issues
          if (state.bursts && state.bursts.length >= maxConcurrentBursts) {
            state.bursts.shift(); // Remove oldest burst
          }
          
          lastBurstTime = now;
          const themeId = themes[themeIndex].id;
          spawnBurst(e.clientX, e.clientY, themeId);
        }, { passive: true });

        // Particles for effects
        const state = { t: 0, parts: [], sparks: [], cross: null };
        const branchState = { branches: [], exit: null };
        let fogPhase = 0; // 0..1 smoothed alpha for fog
        let fogTarget = 0;
        function resetFor(themeId, prevThemeId) {
          // Snapshot current parts BEFORE clearing, so crossfade always has something to draw
          const prevSnapshot = (state.parts && state.parts.length) ? state.parts.map(p => ({ ...p })) : (state.partsPrev || []);
          state.parts.length = 0;
          state.sparks.length = 0;
          // Crossfade: keep a fading copy of old parts
          if (prevThemeId && !prefersReduced) {
            // Limit old parts for performance during crossfade, especially for ice
            const prevCopy = prevSnapshot.map(p => ({ ...p }));
            let dur = 2600;
            let limited = prevCopy;
            if (prevThemeId === 'ice') {
              dur = 3200; // slightly longer for a calmer fade-out
              const cap = 100; // cap fading flakes to avoid jitter/lag
              if (prevCopy.length > cap) limited = prevCopy.slice(0, cap);
            }
            state.cross = {
              oldTheme: prevThemeId,
              oldParts: limited,
              t: 0, dur
            };
            // Ensure effects layer is visible during crossfade
            effectsEnabled = true;
            effectsAlpha = Math.max(effectsAlpha, 0.9);
          } else {
            state.cross = null;
          }
          // Seed a small number of elements per theme - adaptive based on device and viewport
          const particleLimit = DeviceCapabilities.getParticleLimit();
          const viewportScale = DeviceCapabilities.getViewportScale();
          const baseCount = (themeId === 'forest' ? 18 : themeId === 'ice' ? 110 : 28);
          const coarseScale = pointerCoarse ? 0.7 : 1;
          const deviceScale = particleLimit === 0 ? 0 : Math.min(1, particleLimit / baseCount);
          // Further reduce on very small screens (mobile portrait)
          const screenScale = window.innerWidth < 768 ? 0.6 : 1;
          const count = (!effectsEnabled || prefersReduced) ? 0 : Math.floor(baseCount * (perfMode ? 0.7 : 1) * coarseScale * deviceScale * screenScale);
          for (let i = 0; i < count; i++) {
            if (themeId === 'ice') {
              // Snowflake - scale size and velocity by viewport
              state.parts.push({
                x: Math.random() * w, y: Math.random() * h,
                r: (1 + Math.random() * 2.6) * viewportScale,
                vx: (-0.15 + Math.random() * 0.3) * viewportScale,
                vy: (0.25 + Math.random() * 0.55) * viewportScale,
                sway: Math.random() * Math.PI * 2,
                swayAmp: 0.6 + Math.random() * 1.2,
                life: 0, max: 12000 + Math.random() * 8000,
                data: Math.random()
              });
            } else if (themeId === 'forest') {
              state.parts.push({
                x: Math.random() * w, y: Math.random() * h,
                r: (2 + Math.random() * 6) * viewportScale,
                vx: (Math.random() - 0.5) * 0.2 * viewportScale,
                vy: (Math.random() - 0.5) * 0.2 * viewportScale,
                life: 0, max: 4000 + Math.random() * 4000,
                data: Math.random()
              });
            } else if (themeId === 'fire') {
              state.parts.push({
                x: Math.random() * w, y: h * (0.55 + Math.random() * 0.45),
                r: (2 + Math.random() * 6) * viewportScale,
                vx: (Math.random() - 0.5) * 0.15 * viewportScale,
                vy: (-0.1 - Math.random() * 0.1) * viewportScale,
                life: 0, max: 5000 + Math.random() * 4000,
                data: Math.random()
              });
            } else {
              state.parts.push({
                x: Math.random() * w, y: Math.random() * h,
                r: (2 + Math.random() * 6) * viewportScale,
                vx: (Math.random() - 0.5) * 0.2 * viewportScale,
                vy: (Math.random() - 0.5) * 0.2 * viewportScale,
                life: 0, max: 4000 + Math.random() * 4000,
                data: Math.random()
              });
            }
          }
          if (themeId === 'forest') {
            initBranches();
          } else {
            // If leaving forest, capture an exit animation snapshot that rolls back
            if (prevThemeId === 'forest' && branchState.branches.length) {
              branchState.exit = {
                branches: branchState.branches.map(b => ({ ...b, points: b.points.map(pt => ({...pt})) })),
                phase: 1.0
              };
            }
            branchState.branches = [];
          }
          if (themeId === 'fog') { fogTarget = 1; } else { fogTarget = 0; }
          // Preserve current parts for next crossfade
          state.partsPrev = state.parts.map(p => ({ ...p }));
        }

        let themeIndex = 0; applyTheme(themes[themeIndex], true);
        ensureCanvas(); resetFor(themes[themeIndex].id);
        // Initialize enter fade for first theme
        state.enter = { t: 1200, dur: 1200 };

        // Dynamic favicon based on theme colors
        function generateFavicon(){
          try {
            const cs = getComputedStyle(document.documentElement);
            const p3 = cs.getPropertyValue('--theme-primary-3').trim() || '#ffffff';
            const p5 = cs.getPropertyValue('--theme-primary-5').trim() || '#999999';
            const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
            const c = canvas.getContext('2d');
            const g = c.createLinearGradient(0,0,64,64); g.addColorStop(0, p3); g.addColorStop(1, p5);
            c.fillStyle = g; c.fillRect(0,0,64,64);
            c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(0,48,64,16);
            c.fillStyle = '#000'; c.font = 'bold 36px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText('M', 32, 30);
            const url = canvas.toDataURL('image/png');
            let link = document.querySelector('link[rel="icon"][data-gen="1"]');
            if (!link) { link = document.createElement('link'); link.setAttribute('rel','icon'); link.setAttribute('data-gen','1'); document.head.appendChild(link); }
            link.setAttribute('href', url);
          } catch (_) { /* ignore */ }
        }
        generateFavicon();

        function drawFireSmoke(p) {
          ctx.fillStyle = 'rgba(255, 180, 120, 0.04)';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 1.4, 0, Math.PI * 2); ctx.fill();
          p.vx *= 0.99; p.vy = -0.12 - p.data * 0.08; // drift upward
        }
        function spawnFireSpark() {
          if (state.sparks.length > 220) return;
          state.sparks.push({
            x: Math.random() * w,
            y: h * (0.65 + Math.random() * 0.35),
            vx: (Math.random() - 0.5) * 0.25,
            vy: -0.35 - Math.random() * 0.35,
            life: 0,
            max: 700 + Math.random() * 700,
            r: 0.8 + Math.random() * 1.4,
            hue: 20 + Math.random() * 40
          });
        }
        function drawFireSpark(s) {
          const a = 1 - (s.life / s.max);
          ctx.fillStyle = `rgba(255, ${160 + Math.random()*60|0}, 60, ${0.25 * a})`;
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
          s.vx *= 0.995; s.vy *= 0.99; s.vx += (Math.random() - 0.5) * 0.02;
        }
        function drawBurst(b, dt) {
          const k = b.life / b.max; const alpha = Math.max(0, 1 - k);
          // Use delta time for consistent speed across all frame rates
          const dtScale = dt / 16.67; // Normalize to 60fps baseline
          
          if (b.themeId === 'fire') {
            for (const it of b.items) {
              const a = 1 - (it.life / it.max);
              ctx.fillStyle = `rgba(255,170,60,${0.35 * a * alpha})`;
              ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, Math.PI*2); ctx.fill();
              it.x += it.vx * dtScale; it.y += it.vy * dtScale; it.vy += 0.006 * dtScale; it.life += dt;
            }
          } else if (b.themeId === 'ice') {
            ctx.strokeStyle = `rgba(200,230,255,${0.45*alpha})`; ctx.lineWidth = 1;
            for (const it of b.items) { it.r += it.vr * dtScale; it.life += dt; ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, Math.PI*2); ctx.stroke(); }
          } else if (b.themeId === 'forest') {
            for (const it of b.items) { it.r += it.vr * dtScale; it.life += dt; ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.a); ctx.fillStyle = `rgba(104,220,130,${0.25*alpha})`; ctx.beginPath(); ctx.ellipse(it.r*1.2, 0, 8, 5, 0, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle = `rgba(60,160,90,${0.5*alpha})`; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(it.r*1.2, -3); ctx.lineTo(it.r*1.2, 3); ctx.stroke(); ctx.restore(); }
          } else if (b.themeId === 'lilac') {
            for (const it of b.items) { const a = 1 - (it.life/it.max); ctx.fillStyle = `rgba(255,255,255,${0.28*a*alpha})`; ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, Math.PI*2); ctx.fill(); it.x += it.vx * dtScale; it.y += it.vy * dtScale; it.life += dt; }
          } else if (b.themeId === 'fog') {
            for (const it of b.items) { ctx.fillStyle = `rgba(255,60,60,${0.08*alpha})`; ctx.beginPath(); ctx.arc(it.x + it.ox, it.y + it.oy, it.r, 0, Math.PI*2); ctx.fill(); it.r += it.vr * dtScale; it.ox *= Math.pow(0.99, dtScale); it.oy *= Math.pow(0.99, dtScale); it.life += dt; }
          }
          b.life += dt;
        }
        function drawSnowflake(p) {
          // Fade in/out envelope over life (roll in/out)
          const lifeT = (p.life % p.max) / p.max; // 0..1 looping
          const sIn = Math.min(1, lifeT / 0.25);
          const sOut = Math.min(1, (1 - lifeT) / 0.3);
          const a = Math.max(0, (sIn*sIn*(3 - 2*sIn)) * (sOut*sOut*(3 - 2*sOut)));
          // wind sway + gentle spin (roll)
          p.vx = Math.sin(state.t * 0.001 + p.sway) * (0.08 * p.swayAmp);
          p.rot = (p.rot || 0) + (p.spin || 0.002 + Math.random()*0.002);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          if (p._crossScale) { ctx.scale(p._crossScale, p._crossScale); }
          ctx.globalAlpha *= a;
          ctx.strokeStyle = 'rgba(220,240,255,0.45)';
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(-p.r, 0);
          ctx.lineTo(p.r, 0);
          ctx.moveTo(0, -p.r);
          ctx.lineTo(0, p.r);
          ctx.stroke();
          // glow
          ctx.fillStyle = 'rgba(220,240,255,0.15)';
          ctx.beginPath(); ctx.arc(0, 0, p.r * 1.6, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        function drawLeaves(p) {
          // Better leaf shape with vein
          ctx.fillStyle = 'rgba(80, 200, 120, 0.12)';
          ctx.strokeStyle = 'rgba(60, 160, 90, 0.15)';
          ctx.lineWidth = 0.5;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.data * Math.PI * 2);
          // Leaf shape (teardrop)
          ctx.beginPath();
          ctx.ellipse(0, 0, p.r * 1.5, p.r * 0.8, 0, 0, Math.PI * 2);
          ctx.fill();
          // Vein
          ctx.beginPath();
          ctx.moveTo(0, -p.r * 0.8);
          ctx.lineTo(0, p.r * 0.8);
          ctx.stroke();
          ctx.restore();
          p.vy = 0.06 + p.data * 0.1; p.vx += (Math.sin(state.t * 0.001 + p.data * 6) * 0.015);
        }
        
        // Brown branches growing from edges with recursive sub-branches
        function initBranches() {
          branchState.branches = [];
          // Create branches from edges, with precomputed curved paths (no wiggle)
          const edgePoints = [
            {x: 0, y: h * 0.3, angle: 0},
            {x: 0, y: h * 0.7, angle: 0},
            {x: w, y: h * 0.2, angle: Math.PI},
            {x: w, y: h * 0.8, angle: Math.PI},
            {x: w * 0.2, y: 0, angle: -Math.PI/2},
            {x: w * 0.8, y: 0, angle: -Math.PI/2},
            {x: w * 0.3, y: h, angle: Math.PI/2},
            {x: w * 0.7, y: h, angle: Math.PI/2}
          ];
          const branchCount = 6;
          for (let i = 0; i < branchCount; i++) {
            const ep = edgePoints[Math.floor(Math.random() * edgePoints.length)];
            const baseAngle = ep.angle + (Math.random() - 0.5) * 0.4;
            const totalLength = 80 + Math.random() * 120;
            const segments = 8 + Math.floor(Math.random() * 6);
            const thickness = 1.5 + Math.random() * 2.5;
            // Precompute a gentle, organic curve with small, fixed deviations
            const points = [{ x: ep.x, y: ep.y }];
            let cx = ep.x, cy = ep.y, ca = baseAngle;
            const segLen = totalLength / segments;
            for (let s = 0; s < segments; s++) {
              // small fixed curvature
              ca += (Math.random() - 0.5) * 0.15;
              cx += Math.cos(ca) * segLen;
              cy += Math.sin(ca) * segLen;
              points.push({ x: cx, y: cy });
            }
            // generate sub-branches from mid segments
            const subs = [];
            for (let s = 2; s < points.length - 2; s += 2 + (Math.random()*2|0)) {
              const from = points[s];
              const ang = baseAngle + (Math.random() - 0.5) * 1.4;
              const len = totalLength * (0.25 + Math.random() * 0.35);
              const segs = 5 + Math.floor(Math.random() * 4);
              const subPts = [{ x: from.x, y: from.y }];
              let sca = ang; let sx = from.x; let sy = from.y;
              for (let k = 0; k < segs; k++) {
                sca += (Math.random() - 0.5) * 0.25;
                sx += Math.cos(sca) * (len / segs);
                sy += Math.sin(sca) * (len / segs);
                subPts.push({ x: sx, y: sy });
              }
              subs.push({ points: subPts, thickness: Math.max(0.5, thickness * 0.6), growth: 0, totalLength: len, segments: segs });
            }
            branchState.branches.push({ points, thickness, growth: 0, totalLength, segments, subs });
          }
        }
        
        function drawBranches(now) {
          ctx.strokeStyle = 'rgba(101, 67, 33, 0.28)';
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          function drawTinyLeaf(x, y, angle, scale, alpha) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.scale(scale, scale);
            ctx.globalAlpha *= alpha;
            // leaf body
            ctx.fillStyle = 'rgba(80, 200, 120, 0.28)';
            ctx.beginPath();
            ctx.ellipse(0, 0, 5, 3, 0, 0, Math.PI * 2);
            ctx.fill();
            // veins
            ctx.strokeStyle = 'rgba(50, 140, 85, 0.6)';
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(0, -3);
            ctx.lineTo(0, 3);
            ctx.moveTo(0, -1.5);
            ctx.lineTo(2.2, -0.5);
            ctx.moveTo(0, 1.5);
            ctx.lineTo(-2.2, 0.5);
            ctx.stroke();
            ctx.restore();
          }
          for (const branch of branchState.branches) {
            // Timelapse growth: accelerate early, slow later
            branch.growth = Math.min(1, branch.growth + 0.0035);
            const targetLength = branch.totalLength * branch.growth;
            let drawn = 0;
            ctx.lineWidth = Math.max(0.6, branch.thickness * (0.6 + 0.4 * branch.growth));
            ctx.beginPath();
            const pts = branch.points;
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
              const px = pts[i - 1];
              const py = pts[i];
              const seg = Math.hypot(py.x - px.x, py.y - px.y);
              if (drawn + seg <= targetLength) {
                ctx.lineTo(py.x, py.y);
                drawn += seg;
              } else {
                const remain = Math.max(0, targetLength - drawn);
                if (remain > 0) {
                  const t = remain / seg;
                  ctx.lineTo(px.x + (py.x - px.x) * t, px.y + (py.y - px.y) * t);
                }
                break;
              }
            }
            ctx.stroke();
            // add small green leaves along grown segments
            const pts2 = branch.points;
            const leavesCount = Math.floor(pts2.length * Math.max(0, branch.growth - 0.2));
            for (let i = 2; i < leavesCount; i += 2) {
              const a = pts2[i - 1];
              const b = pts2[i];
              const ang = Math.atan2(b.y - a.y, b.x - a.x);
              const midx = (a.x + b.x) / 2;
              const midy = (a.y + b.y) / 2;
              drawTinyLeaf(midx, midy, ang + Math.PI/2, 1, 0.9);
            }
            // draw sub-branches with slightly delayed growth
            if (branch.subs) {
              ctx.save();
              ctx.strokeStyle = 'rgba(101, 67, 33, 0.22)';
              for (const sb of branch.subs) {
                sb.growth = Math.min(1, sb.growth + 0.003);
                const tgt = sb.totalLength * Math.max(0, branch.growth - 0.15) * sb.growth;
                let d2 = 0;
                ctx.lineWidth = Math.max(0.45, sb.thickness * (0.5 + 0.4 * sb.growth));
                ctx.beginPath();
                const sp = sb.points;
                ctx.moveTo(sp[0].x, sp[0].y);
                for (let i = 1; i < sp.length; i++) {
                  const a = sp[i - 1]; const b = sp[i];
                  const seg = Math.hypot(b.x - a.x, b.y - a.y);
                  if (d2 + seg <= tgt) { ctx.lineTo(b.x, b.y); d2 += seg; }
                  else { const rm = Math.max(0, tgt - d2); if (rm > 0) { const t = rm / seg; ctx.lineTo(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t); } break; }
                }
                ctx.stroke();
                // leaves on sub-branches
                const sp2 = sb.points;
                const cnt = Math.floor(sp2.length * Math.max(0, sb.growth - 0.2));
                for (let j = 2; j < cnt; j += 2) {
                  const a2 = sp2[j - 1];
                  const b2 = sp2[j];
                  const ang2 = Math.atan2(b2.y - a2.y, b2.x - a2.x);
                  const mx = (a2.x + b2.x) / 2;
                  const my = (a2.y + b2.y) / 2;
                  drawTinyLeaf(mx, my, ang2 + Math.PI/2, 0.9, 0.85);
                }
              }
              ctx.restore();
            }
          }
        }
        function drawBranchesExit() {
          if (!branchState.exit) return;
          const ex = branchState.exit;
          ctx.save();
          ctx.globalAlpha *= Math.max(0, ex.phase);
          ctx.strokeStyle = 'rgba(101, 67, 33, 0.24)';
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          for (const b of ex.branches) {
            const target = b.totalLength * Math.max(0, ex.phase);
            let drawn = 0; ctx.lineWidth = Math.max(0.5, b.thickness * ex.phase);
            ctx.beginPath(); const pts = b.points; ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
              const p0 = pts[i-1], p1 = pts[i]; const seg = Math.hypot(p1.x-p0.x, p1.y-p0.y);
              if (drawn + seg <= target) { ctx.lineTo(p1.x, p1.y); drawn += seg; }
              else { const rm = Math.max(0, target - drawn); if (rm > 0) { const t = rm/seg; ctx.lineTo(p0.x + (p1.x-p0.x)*t, p0.y + (p1.y-p0.y)*t);} break; }
            }
            ctx.stroke();
          }
          ctx.restore();
          ex.phase -= 0.02;
          if (ex.phase <= 0) branchState.exit = null;
        }
        function drawBubbles(p) {
          // Glassmorphic purple bubbles with gradient and highlight
          // Add soft fade/scale envelope for silky enter/crossfade
          const k = Math.min(1, Math.max(0, p.life / (p.max || 1000)));
          const fadeIn = Math.min(1, k / 0.25);
          const fadeOut = Math.min(1, (1 - k) / 0.25);
          const env = (fadeIn * fadeIn * (3 - 2 * fadeIn)) * (fadeOut * fadeOut * (3 - 2 * fadeOut));
          const scale = (p._crossScale !== undefined) ? p._crossScale : (0.9 + 0.1 * env);
          ctx.save();
          ctx.globalAlpha *= env;
          ctx.translate(p.x, p.y);
          ctx.scale(scale, scale);
          const grad = ctx.createRadialGradient(
            p.x - p.r * 0.3, p.y - p.r * 0.3, 0,
            p.x, p.y, p.r * 1.2
          );
          grad.addColorStop(0, 'rgba(217, 180, 255, 0.25)');
          grad.addColorStop(0.5, 'rgba(184, 133, 255, 0.15)');
          grad.addColorStop(1, 'rgba(153, 102, 255, 0.05)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, 0, p.r, 0, Math.PI * 2);
          ctx.fill();
          // Highlight
          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.beginPath();
          ctx.ellipse(- p.r * 0.3, - p.r * 0.3, p.r * 0.4, p.r * 0.25, -0.5, 0, Math.PI * 2);
          ctx.fill();
          // Outer ring
          ctx.strokeStyle = 'rgba(217, 170, 255, 0.3)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(0, 0, p.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
          // gentle drift with slight damping for stability
          p.vy = -0.06 - p.data * 0.08; p.vx *= 0.992;
        }
        function drawFog(now) {
          // Smooth fog using a phase that eases to target
          const envelope = 0.85 * fogPhase; // max density scaled
          for (let layer = 0; layer < 3; layer++) {
            const offset = layer * 200 + Math.sin(now * 0.0003 + layer) * 50;
            const g = ctx.createRadialGradient(
              w*0.4 + offset, h*0.5 + layer * 100, 30,
              w*0.4 + offset, h*0.5 + layer * 100, Math.max(w,h)*0.7
            );
            const base = (0.08 - layer * 0.02) * envelope;
            g.addColorStop(0, `rgba(240,240,250,${base})`);
            g.addColorStop(0.5, `rgba(220,220,230,${base * 0.6})`);
            g.addColorStop(1, 'rgba(200,200,210,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);
          }
        }

        // Helper: Update performance mode based on FPS
        function updatePerfMode(dt) {
          const fps = dt > 0 ? 1000 / dt : 60;
          fpsEMA = fpsEMA * 0.9 + fps * 0.1;
          const shouldPerf = fpsEMA < 50;
          
          if (shouldPerf && !perfMode) {
            perfMode = true;
            dpr = 1;
            ensureCanvas();
            // Reduce theme transition duration for better performance
            if (window.__toggleSlowThemes) window.__toggleSlowThemes(true);
          } else if (!shouldPerf && perfMode && dpr < 1.5) {
            perfMode = false;
            dpr = Math.min(1.5, window.devicePixelRatio || 1);
            ensureCanvas();
            // Restore normal theme transitions
            if (window.__toggleSlowThemes) window.__toggleSlowThemes(false);
          }
        }

        // Helper: Draw crossfade old theme particles
        function drawCrossfadeParts(cross, smoothScrolling, dt) {
          if (smoothScrolling || !cross || !cross.oldParts || cross.t >= cross.dur) return;
          
          const ratio = cross.t / cross.dur;
          const eased = ratio * ratio * (3 - 2 * ratio);
          const a = 1 - eased;
          
          ctx.save();
          ctx.globalAlpha *= a;
          
          if (cross.oldTheme === 'fire') {
            for (const p of cross.oldParts) drawFireSmoke(p);
          } else if (cross.oldTheme === 'ice') {
            for (const p of cross.oldParts) {
              const localRatio = cross.t / cross.dur;
              const localEased = localRatio * localRatio * (3 - 2 * localRatio);
              p.vx = (p.vx || 0) * 0.96;
              p.vy = (p.vy || 0.4) * 0.96;
              p.swayAmp = (p.swayAmp || 1) * 0.98;
              p.x += (Math.sin(state.t * 0.001 + (p.sway || 0)) * (0.08 * (p.swayAmp || 1))) + (p.vx || 0);
              p.y += (p.vy || 0.4);
              p.life = (p.life || 0) + 16;
              p._crossScale = Math.max(0.3, 1 - localEased * 0.85);
              drawSnowflake(p);
            }
          } else if (cross.oldTheme === 'forest') {
            for (const p of cross.oldParts) drawLeaves(p);
          } else if (cross.oldTheme === 'lilac') {
            for (const p of cross.oldParts) {
              p.vx = (p.vx || 0) * 0.97;
              p.vy = (p.vy || -0.05) * 0.97;
              p.x += p.vx;
              p.y += p.vy;
              p.life = (p.life || 0) + dt;
              p._crossScale = Math.max(0.4, 1 - eased * 0.8);
              drawBubbles(p);
            }
          }
          
          ctx.restore();
        }

        // Helper: Draw current theme particles
        function drawCurrentTheme(themeId, enterAlpha, smoothScrolling, now) {
          const step = smoothScrolling ? 2 : 1;
          ctx.save();
          ctx.globalAlpha *= enterAlpha;
          
          if (themeId === 'fire') {
            for (let i = 0; i < state.parts.length; i += step) {
              drawFireSmoke(state.parts[i]);
            }
            ctx.restore();
            // Sparks
            if (!perfMode && !smoothScrolling && Math.random() < 0.5) {
              spawnFireSpark();
            }
            for (let i = state.sparks.length - 1; i >= 0; i--) {
              const s = state.sparks[i];
              drawFireSpark(s);
              s.x += s.vx;
              s.y += s.vy;
              s.life += 16;
              if (s.life > s.max || s.y < -10) {
                state.sparks.splice(i, 1);
              }
            }
          } else if (themeId === 'ice') {
            for (let i = 0; i < state.parts.length; i += step) {
              drawSnowflake(state.parts[i]);
            }
            ctx.restore();
          } else if (themeId === 'forest') {
            if (!smoothScrolling) drawBranches(now);
            for (let i = 0; i < state.parts.length; i += step) {
              drawLeaves(state.parts[i]);
            }
            ctx.restore();
          } else if (themeId === 'lilac') {
            for (let i = 0; i < state.parts.length; i += step) {
              drawBubbles(state.parts[i]);
            }
            ctx.restore();
          }
        }

        function tick(now) {
          ensureCanvas();
          const dt = Math.max(0, Math.min(48, now - (state._lastTick || now)));
          state._lastTick = now;
          state.t = now;
          ctx.clearRect(0, 0, w, h);
          const themeId = themes[themeIndex].id;

          updatePerfMode(dt);

          if (effectsEnabled) {
            ctx.save();
            ctx.globalAlpha = effectsAlpha;
            fogPhase += (fogTarget - fogPhase) * 0.04;
            drawBranchesExit();
            
            // Crossfade old theme particles
            drawCrossfadeParts(state.cross, window.__isSmoothScrolling, dt);
            if (state.cross && state.cross.t < state.cross.dur) {
              state.cross.t += dt;
            }
            
            // Calculate enter fade-in alpha
            let enterAlpha = 1;
            if (state.enter) {
              const ep = Math.min(1, state.enter.t / state.enter.dur);
              enterAlpha = ep * ep * (3 - 2 * ep);
            }
            
            // Draw current theme
            drawCurrentTheme(themeId, enterAlpha, window.__isSmoothScrolling, now);
            
            // Draw fog
            if (themeId === 'fog' || fogPhase > 0.001) {
              drawFog(now);
            }
            
            // Draw interactive bursts with delta time for consistent speed
            if (state.bursts && state.bursts.length) {
              for (let i = state.bursts.length - 1; i >= 0; i--) {
                const b = state.bursts[i];
                drawBurst(b, dt);
                if (b.life >= b.max) {
                  state.bursts.splice(i, 1);
                }
              }
            }
            ctx.restore();
          }

          // Integrate particles with delta time for consistent speed
          const dtScale = dt / 16.67; // Normalize to 60fps baseline
          for (const p of state.parts) {
            p.x += p.vx * dtScale; p.y += p.vy * dtScale; p.life += dt;
            if (p.x < -10) p.x = w + 10; if (p.x > w + 10) p.x = -10;
            if (p.y < -10) p.y = h + 10; if (p.y > h + 10) p.y = -10;
            // Loop life for snowflakes to keep fade cycling
            if (themeId === 'ice' && p.life > p.max) p.life = 0;
          }
          // Advance enter fade
          if (state.enter && state.enter.t < state.enter.dur) state.enter.t += dt;
          if (!prefersReduced) requestAnimationFrame(tick);
        }
        if (!prefersReduced) requestAnimationFrame(tick);

        // Rotate theme at a configurable interval with smooth crossfade and safe re-entry
        let nextThemeTimeout;
        let themeIntervalMs = 5000;
        window.__toggleSlowThemes = function(slow){ themeIntervalMs = slow ? 9000 : 5000; };
        function scheduleNextTheme() {
          clearTimeout(nextThemeTimeout);
          nextThemeTimeout = setTimeout(() => {
            const prev = themes[themeIndex].id;
            themeIndex = (themeIndex + 1) % themes.length;
            const newTheme = themes[themeIndex];
            applyTheme(newTheme);
            // Make sure visual effects are enabled for visible crossfades
            enableEffects();
            resetFor(newTheme.id, prev);
            scheduleNextTheme();
          }, themeIntervalMs);
        }
        scheduleNextTheme();
      })();

      // i18n: simple native UI translations with RTL support
      (function(){
        const htmlEl = document.documentElement;
        const langSelect = document.getElementById('langSelect');
        if (!langSelect) return;
        const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur']);
        const DICT = {
          en: {
            'nav.projects': 'Projects', 'nav.vision': 'Vision', 'nav.why': 'Why me?', 'nav.faq': 'FAQ', 'nav.skills': 'Skills', 'nav.contact': 'Contact',
            'kicker.role': 'Full‑stack Web Developer & Designer', 'kicker.loc': 'Based in London, UK', 'kicker.age': 'Age', 'kicker.status': 'Currently seeking experience',
            'hero.title': 'I design and build <span id="typer" class="typer" data-tooltip="Watch the colors flow"><span class="smoke" aria-hidden="true"></span><span id="typerText" class="typer-text"></span><span class="caret" aria-hidden="true"></span></span> software.',
            'hero.subtitle': 'I focus on clarity, performance, and maintainability. I enjoy shipping polished user experiences and robust backend systems with a pragmatic, modern stack. I built this website myself from scratch.',
            'hero.availability': 'Open to internships / part‑time',
            'cta.projects': 'View Projects <svg class="icon" aria-hidden="true"><use href="#icon-external"/></svg>',
            'cta.copy': 'Copy Email <svg class="icon" aria-hidden="true"><use href="#icon-copy"/></svg>',
            'cta.resume': 'Résumé'
          },
          ar: {
            'nav.projects': 'المشاريع', 'nav.vision': 'الرؤية', 'nav.why': 'لماذا أنا؟', 'nav.faq': 'الأسئلة الشائعة', 'nav.skills': 'المهارات', 'nav.contact': 'تواصل',
            'kicker.role': 'مطوّر ويب متكامل ومصمم', 'kicker.loc': 'مقيم في لندن، المملكة المتحدة', 'kicker.age': 'العمر', 'kicker.status': 'أبحث عن خبرة عملية',
            'hero.title': 'أصمّم وأبني <span id="typer" class="typer" data-tooltip="شاهد الألوان تتدفق"><span class="smoke" aria-hidden="true"></span><span id="typerText" class="typer-text"></span><span class="caret" aria-hidden="true"></span></span> برمجيات.',
            'hero.subtitle': 'أركّز على الوضوح والأداء وقابلية الصيانة. أحب تقديم تجارب مستخدم مصقولة وأنظمة خلفية قوية بمنهج عملي حديث.',
            'hero.availability': 'متاح لتدريبات أو عمل جزئي',
            'cta.projects': 'عرض المشاريع <svg class="icon" aria-hidden="true"><use href="#icon-external"/></svg>',
            'cta.copy': 'نسخ البريد الإلكتروني <svg class="icon" aria-hidden="true"><use href="#icon-copy"/></svg>',
            'cta.resume': 'السيرة الذاتية'
          },
          es: {
            'nav.projects': 'Proyectos', 'nav.vision': 'Visión', 'nav.why': '¿Por qué yo?', 'nav.faq': 'FAQ', 'nav.skills': 'Habilidades', 'nav.contact': 'Contacto',
            'kicker.role': 'Desarrollador Full‑stack y Diseñador', 'kicker.loc': 'Con base en Londres, Reino Unido', 'kicker.age': 'Edad', 'kicker.status': 'Buscando experiencia',
            'hero.title': 'Diseño y construyo software <span id="typer" class="typer" data-tooltip="Mira fluir los colores"><span class="smoke" aria-hidden="true"></span><span id="typerText" class="typer-text"></span><span class="caret" aria-hidden="true"></span></span>.',
            'hero.subtitle': 'Me centro en claridad, rendimiento y mantenibilidad. Disfruto de experiencias pulidas y backend robusto con un stack moderno.',
            'hero.availability': 'Abierto a prácticas / medio tiempo',
            'cta.projects': 'Ver Proyectos <svg class="icon" aria-hidden="true"><use href="#icon-external"/></svg>',
            'cta.copy': 'Copiar Email <svg class="icon" aria-hidden="true"><use href="#icon-copy"/></svg>',
            'cta.resume': 'Currículum'
          },
          fr: {
            'nav.projects': 'Projets', 'nav.vision': 'Vision', 'nav.why': 'Pourquoi moi ?', 'nav.faq': 'FAQ', 'nav.skills': 'Compétences', 'nav.contact': 'Contact',
            'kicker.role': 'Développeur Full‑stack & Designer', 'kicker.loc': 'Basé à Londres, Royaume‑Uni', 'kicker.age': 'Âge', 'kicker.status': 'À la recherche d\'expérience',
            'hero.title': 'Je conçois et construis des <span id="typer" class="typer" data-tooltip="Regardez les couleurs s\'écouler"><span class="smoke" aria-hidden="true"></span><span id="typerText" class="typer-text"></span><span class="caret" aria-hidden="true"></span></span> logiciels.',
            'hero.subtitle': 'Je privilégie clarté, performance et maintenabilité. J\'aime livrer des expériences soignées et des backends robustes.',
            'hero.availability': 'Ouvert aux stages / temps partiel',
            'cta.projects': 'Voir les Projets <svg class="icon" aria-hidden="true"><use href="#icon-external"/></svg>',
            'cta.copy': 'Copier l\'email <svg class="icon" aria-hidden="true"><use href="#icon-copy"/></svg>',
            'cta.resume': 'CV'
          },
          de: {
            'nav.projects': 'Projekte', 'nav.vision': 'Vision', 'nav.why': 'Warum ich?', 'nav.faq': 'FAQ', 'nav.skills': 'Fähigkeiten', 'nav.contact': 'Kontakt',
            'kicker.role': 'Full‑stack Webentwickler & Designer', 'kicker.loc': 'Mit Sitz in London, UK', 'kicker.age': 'Alter', 'kicker.status': 'Suche Erfahrung',
            'hero.title': 'Ich entwerfe und baue <span id="typer" class="typer" data-tooltip="Sieh den Farbenfluss"><span class="smoke" aria-hidden="true"></span><span id="typerText" class="typer-text"></span><span class="caret" aria-hidden="true"></span></span> Software.',
            'hero.subtitle': 'Fokus auf Klarheit, Performance und Wartbarkeit. Polierte UX und robuste Backends.',
            'hero.availability': 'Offen für Praktika / Teilzeit',
            'cta.projects': 'Projekte ansehen <svg class="icon" aria-hidden="true"><use href="#icon-external"/></svg>',
            'cta.copy': 'E-Mail kopieren <svg class="icon" aria-hidden="true"><use href="#icon-copy"/></svg>',
            'cta.resume': 'Lebenslauf'
          },
          pt: { 'nav.projects':'Projetos','nav.vision':'Visão','nav.why':'Por que eu?','nav.faq':'FAQ','nav.skills':'Habilidades','nav.contact':'Contato',
                'kicker.role':'Desenvolvedor Full‑stack & Designer','kicker.loc':'Baseado em Londres, Reino Unido','kicker.age':'Idade','kicker.status':'Buscando experiência',
                'hero.title':'Eu projeto e construo <span id="typer" class="typer" data-tooltip="Veja as cores fluírem"><span class="smoke" aria-hidden="true"></span><span id="typerText" class="typer-text"></span><span class="caret" aria-hidden="true"></span></span> software.',
                'hero.subtitle':'Foco em clareza, desempenho e manutenção. UX polida e backends robustos.',
                'hero.availability':'Aberto a estágios / meio período',
                'cta.projects':'Ver Projetos <svg class="icon" aria-hidden="true"><use href="#icon-external"/></svg>','cta.copy':'Copiar Email <svg class="icon" aria-hidden="true"><use href="#icon-copy"/></svg>','cta.resume':'Currículo' },
          ru: { 'nav.projects':'Проекты','nav.vision':'Видение','nav.why':'Почему я?','nav.faq':'FAQ','nav.skills':'Навыки','nav.contact':'Контакты',
                'kicker.role':'Фул‑стек разработчик и дизайнер','kicker.loc':'Лондон, Великобритания','kicker.age':'Возраст','kicker.status':'Ищу опыт',
                'hero.title':'Я проектирую и создаю <span id="typer" class="typer" data-tooltip="Смотрите, как текут цвета"><span class="smoke" aria-hidden="true"></span><span id="typerText" class="typer-text"></span><span class="caret" aria-hidden="true"></span></span> софт.',
                'hero.subtitle':'Фокус на ясности, производительности и поддерживаемости. Аккуратный UX и надёжный бэкенд.',
                'hero.availability':'Открыт к стажировкам / part‑time',
                'cta.projects':'Смотреть проекты <svg class="icon" aria-hidden="true"><use href="#icon-external"/></svg>','cta.copy':'Скопировать email <svg class="icon" aria-hidden="true"><use href="#icon-copy"/></svg>','cta.resume':'Резюме' },
          hi: { 'nav.projects':'प्रोजेक्ट्स','nav.vision':'विजन','nav.why':'क्यों मैं?','nav.faq':'FAQ','nav.skills':'स्किल्स','nav.contact':'संपर्क',
                'kicker.role':'फुल‑स्टैक वेब डेवलपर और डिज़ाइनर','kicker.loc':'लंदन, यूके','kicker.age':'उम्र','kicker.status':'अनुभव की तलाश में',
                'hero.title':'मैं <span id="typer" class="typer" data-tooltip="रंगों का प्रवाह देखें"><span class="smoke" aria-hidden="true"></span><span id="typerText" class="typer-text"></span><span class="caret" aria-hidden="true"></span></span> सॉफ़्टवेयर डिज़ाइन और बनाता हूँ.',
                'hero.subtitle':'स्पष्टता, प्रदर्शन और अनुरक्षण पर ध्यान। परिष्कृत UX और मज़बूत बैकएंड।',
                'hero.availability':'इंटर्नशिप / पार्ट‑टाइम के लिए उपलब्ध',
                'cta.projects':'प्रोजेक्ट्स देखें <svg class="icon" aria-hidden="true"><use href="#icon-external"/></svg>','cta.copy':'ईमेल कॉपी करें <svg class="icon" aria-hidden="true"><use href="#icon-copy"/></svg>','cta.resume':'रिज़्यूमे' },
          bn: { 'nav.projects':'প্রজেক্ট','nav.vision':'ভিশন','nav.why':'আমাকেই কেন?','nav.faq':'FAQ','nav.skills':'স্কিলস','nav.contact':'যোগাযোগ',
                'kicker.role':'ফুল‑স্ট্যাক ওয়েব ডেভেলপার ও ডিজাইনার','kicker.loc':'লন্ডন, যুক্তরাজ্য','kicker.age':'বয়স','kicker.status':'অভিজ্ঞতা খুঁজছি',
                'hero.title':'আমি <span id="typer" class="typer" data-tooltip="রঙের প্রবাহ দেখুন"><span class="smoke" aria-hidden="true"></span><span id="typerText" class="typer-text"></span><span class="caret" aria-hidden="true"></span></span> সফটওয়্যার ডিজাইন ও তৈরি করি।',
                'hero.subtitle':'স্বচ্ছতা, পারফরম্যান্স ও মেইনটেনেবিলিটিতে ফোকাস।',
                'hero.availability':'ইন্টার্নশিপ / পার্ট‑টাইমের জন্য উন্মুক্ত',
                'cta.projects':'প্রজেক্ট দেখুন <svg class="icon" aria-hidden="true"><use href="#icon-external"/></svg>','cta.copy':'ইমেল কপি <svg class="icon" aria-hidden="true"><use href="#icon-copy"/></svg>','cta.resume':'রেজিউমে' },
          zh: { 'nav.projects':'项目','nav.vision':'愿景','nav.why':'为什么选择我？','nav.faq':'常见问题','nav.skills':'技能','nav.contact':'联系',
                'kicker.role':'全栈网页开发者与设计师','kicker.loc':'常驻英国伦敦','kicker.age':'年龄','kicker.status':'寻求实践经验',
                'hero.title':'我设计并构建 <span id="typer" class="typer" data-tooltip="欣赏流动的色彩"><span class="smoke" aria-hidden="true"></span><span id="typerText" class="typer-text"></span><span class="caret" aria-hidden="true"></span></span> 软件。',
                'hero.subtitle':'专注清晰、性能与可维护性。追求精致体验与可靠后端。',
                'hero.availability':'可参与实习 / 兼职',
                'cta.projects':'查看项目 <svg class="icon" aria-hidden="true"><use href="#icon-external"/></svg>','cta.copy':'复制邮箱 <svg class="icon" aria-hidden="true"><use href="#icon-copy"/></svg>','cta.resume':'简历' },
          ja: { 'nav.projects':'プロジェクト','nav.vision':'ビジョン','nav.why':'私を選ぶ理由','nav.faq':'FAQ','nav.skills':'スキル','nav.contact':'連絡先',
                'kicker.role':'フルスタック開発者・デザイナー','kicker.loc':'英国ロンドン拠点','kicker.age':'年齢','kicker.status':'経験を募集中',
                'hero.title':'私は <span id="typer" class="typer" data-tooltip="色の流れを見て"><span class="smoke" aria-hidden="true"></span><span id="typerText" class="typer-text"></span><span class="caret" aria-hidden="true"></span></span> ソフトウェアを設計・構築します。',
                'hero.subtitle':'明快さ、性能、保守性を重視。洗練されたUXと堅牢なバックエンド。',
                'hero.availability':'インターン / パートタイム可',
                'cta.projects':'プロジェクトを見る <svg class="icon" aria-hidden="true"><use href="#icon-external"/></svg>','cta.copy':'メールをコピー <svg class="icon" aria-hidden="true"><use href="#icon-copy"/></svg>','cta.resume':'履歴書' }
        };

        function applyLang(lang){
          const dict = DICT[lang] || DICT.en;
          document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) el.innerHTML = dict[key];
          });
          htmlEl.setAttribute('lang', lang);
          const isRtl = RTL_LANGS.has(lang);
          htmlEl.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
          // After DOM updates, re-init the typewriter safely
          if (typeof window.typerReinit === 'function') {
            window.typerReinit();
          }
        }

        // Persist selection
        const stored = localStorage.getItem('lang');
        if (stored && DICT[stored]) {
          langSelect.value = stored;
          applyLang(stored);
        }
        langSelect.addEventListener('change', () => {
          const lang = langSelect.value;
          localStorage.setItem('lang', lang);
          applyLang(lang);
        });

        // Optionally allow localized feature list for the typewriter
        window.getI18nFeatures = function() {
          const lang = htmlEl.getAttribute('lang') || 'en';
          const dict = DICT[lang] || DICT.en;
          // If a localized list exists, return it; else undefined
          return Array.isArray(dict.features) ? dict.features : undefined;
        };
      })();
      // Header state: add subtle style when scrolled
      (function(){
        const onScroll = () => {
          document.body.classList.toggle('scrolled', window.scrollY > 8);
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
      })();
