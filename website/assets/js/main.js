/**
 * CampusAlert Pro — Main JavaScript
 * Handles navigation, scroll effects, and interactive behaviors
 */

(function() {
    'use strict';

    // ==========================================================================
    // Configuration
    // ==========================================================================

    const CONFIG = {
        scrollThreshold: 10,
        smoothScrollDuration: 500,
        animationDelay: 300
    };

    // ==========================================================================
    // Smooth Scroll for Anchor Links
    // ==========================================================================

    function initSmoothScroll() {
        const anchorLinks = document.querySelectorAll('a[href^="#"]');

        anchorLinks.forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                const href = this.getAttribute('href');

                // Skip if it's just "#"
                if (href === '#') return;

                const target = document.querySelector(href);

                if (target) {
                    e.preventDefault();

                    const headerOffset = 80;
                    const elementPosition = target.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });

                    // Update URL without triggering scroll
                    history.pushState(null, '', href);
                }
            });
        });
    }

    // ==========================================================================
    // Navigation Shadow on Scroll
    // ==========================================================================

    function initNavScrollEffect() {
        const nav = document.querySelector('nav');

        if (!nav) return;

        let lastScrollY = window.scrollY;

        function updateNavShadow() {
            const currentScrollY = window.scrollY;

            if (currentScrollY > CONFIG.scrollThreshold) {
                nav.classList.add('shadow-md');
            } else {
                nav.classList.remove('shadow-md');
            }

            lastScrollY = currentScrollY;
        }

        // Throttle scroll events for performance
        let ticking = false;

        window.addEventListener('scroll', function() {
            if (!ticking) {
                window.requestAnimationFrame(function() {
                    updateNavShadow();
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });

        // Initial check
        updateNavShadow();
    }

    // ==========================================================================
    // Intersection Observer for Animations
    // ==========================================================================

    function initScrollAnimations() {
        const animatedElements = document.querySelectorAll('.feature-card, .hero-section');

        if (!animatedElements.length) return;

        const observerOptions = {
            root: null,
            rootMargin: '0px 0px -50px 0px',
            threshold: 0.1
        };

        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        animatedElements.forEach(function(element) {
            element.style.opacity = '0';
            element.style.transform = 'translateY(20px)';
            element.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
            observer.observe(element);
        });
    }

    // ==========================================================================
    // Phone Mockup Animation
    // ==========================================================================

    function initPhoneMockupAnimation() {
        const phoneMockup = document.querySelector('.phone-frame');

        if (!phoneMockup) return;

        // Add floating animation delay
        phoneMockup.style.animationDelay = '0s';
    }

    // ==========================================================================
    // Live Notification Card
    // ==========================================================================

    function initNotificationCard() {
        const notificationCard = document.querySelector('.notification-card');

        if (!notificationCard) return;

        // Ensure animation plays on page load
        notificationCard.style.animationPlayState = 'running';
    }

    // ==========================================================================
    // Stats Counter Animation
    // ==========================================================================

    function initStatsCounter() {
        const statNumbers = document.querySelectorAll('.stat-number');

        if (!statNumbers.length) return;

        const observerOptions = {
            root: null,
            threshold: 0.5
        };

        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        statNumbers.forEach(function(stat) {
            observer.observe(stat);
        });
    }

    function animateCounter(element) {
        const target = parseInt(element.getAttribute('data-target'), 10);
        const duration = 2000;
        const step = target / (duration / 16);
        let current = 0;

        const timer = setInterval(function() {
            current += step;

            if (current >= target) {
                element.textContent = formatNumber(target);
                clearInterval(timer);
            } else {
                element.textContent = formatNumber(Math.floor(current));
            }
        }, 16);
    }

    function formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M+';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K+';
        }
        return num.toString();
    }

    // ==========================================================================
    // Mobile Menu Toggle
    // ==========================================================================

    function initMobileMenu() {
        const menuButton = document.querySelector('button[aria-label="Open menu"]');
        const nav = document.querySelector('nav');

        if (!menuButton || !nav) return;

        const mobileMenu = document.createElement('div');
        mobileMenu.className = 'mobile-menu';
        mobileMenu.innerHTML = `
            <div class="fixed inset-0 z-40 bg-black/50 hidden" id="mobile-menu-overlay"></div>
            <div class="fixed top-16 right-0 bottom-0 w-64 bg-white shadow-xl z-50 transform translate-x-full transition-transform duration-300" id="mobile-menu-panel">
                <div class="p-6 space-y-4">
                    <a href="#features" class="block text-forest-700 font-medium hover:text-forest-500">Features</a>
                    <a href="#architecture" class="block text-forest-700 font-medium hover:text-forest-500">Architecture</a>
                    <a href="#admin" class="block text-forest-700 font-medium hover:text-forest-500">Admin Portal</a>
                    <a href="#download" class="block text-forest-700 font-medium hover:text-forest-500">Download</a>
                    <hr class="border-forest-100">
                    <a href="#download" class="block text-center px-4 py-2 bg-forest-500 text-white font-semibold rounded-lg hover:bg-forest-600">Get App</a>
                </div>
            </div>
        `;

        document.body.appendChild(mobileMenu);

        const overlay = document.getElementById('mobile-menu-overlay');
        const panel = document.getElementById('mobile-menu-panel');

        function openMenu() {
            overlay.classList.remove('hidden');
            panel.classList.remove('translate-x-full');
        }

        function closeMenu() {
            overlay.classList.add('hidden');
            panel.classList.add('translate-x-full');
        }

        menuButton.addEventListener('click', openMenu);
        overlay.addEventListener('click', closeMenu);

        // Close menu on link click
        panel.querySelectorAll('a').forEach(function(link) {
            link.addEventListener('click', closeMenu);
        });
    }

    // ==========================================================================
    // Status Indicator Heartbeat
    // ==========================================================================

    function initStatusIndicator() {
        const statusIndicator = document.querySelector('.status-indicator');

        if (!statusIndicator) return;

        // Add heartbeat animation
        statusIndicator.style.animation = 'heartbeat 2s ease-in-out infinite';
    }

    // ==========================================================================
    // Dark Mode Toggle (if implemented)
    // ==========================================================================

    function initThemeToggle() {
        const themeToggle = document.querySelector('[data-theme-toggle]');

        if (!themeToggle) return;

        const savedTheme = localStorage.getItem('theme') || 'light';

        function setTheme(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
        }

        themeToggle.addEventListener('click', function() {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            setTheme(newTheme);
        });

        // Initialize theme
        setTheme(savedTheme);
    }

    // ==========================================================================
    // Escape Key Handler
    // ==========================================================================

    function initEscapeHandler() {
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                const mobileMenu = document.getElementById('mobile-menu-panel');
                const overlay = document.getElementById('mobile-menu-overlay');

                if (mobileMenu && !mobileMenu.classList.contains('translate-x-full')) {
                    overlay.classList.add('hidden');
                    mobileMenu.classList.add('translate-x-full');
                }
            }
        });
    }

    // ==========================================================================
    // Initialize All Features
    // ==========================================================================

    function init() {
        initSmoothScroll();
        initNavScrollEffect();
        initScrollAnimations();
        initPhoneMockupAnimation();
        initNotificationCard();
        initStatsCounter();
        initMobileMenu();
        initStatusIndicator();
        initThemeToggle();
        initEscapeHandler();

        // Mark initialization complete
        document.body.classList.add('js-initialized');
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
