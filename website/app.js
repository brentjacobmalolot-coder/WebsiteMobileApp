'use strict';

const App = {
    state: {
        isLoaded: false,
        isMenuOpen: false,
        currentSection: 'hero',
        connectionStatus: 'secure'
    },

    init() {
        this.setupEventListeners();
        this.initializeComponents();
        this.startLoadingSequence();
    },

    setupEventListeners() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.bindEvents());
        } else {
            this.bindEvents();
        }
    },

    bindEvents() {
        this.initNavigation();
        this.initMobileDrawer();
        this.initScrollEffects();
        this.initScrollReveal();
        this.initButtons();
        this.initKeyboardShortcuts();
        this.initWindowEvents();
    },

    initializeComponents() {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    startLoadingSequence() {
        const loadingScreen = document.getElementById('loadingScreen');
        setTimeout(() => {
            if (loadingScreen) {
                loadingScreen.classList.add('hidden');
                this.state.isLoaded = true;
                this.triggerInitialReveals();
            }
        }, 2200);
    },

    triggerInitialReveals() {
        const heroElements = document.querySelectorAll('.hero-content.reveal');
        heroElements.forEach((el, index) => {
            setTimeout(() => el.classList.add('visible'), index * 200);
        });
    }
};

App.initNavigation = function() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section[id]');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const targetSection = document.querySelector(targetId);

            if (targetSection) {
                const offsetTop = targetSection.offsetTop - 80;
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
                this.updateActiveNavLink(link);
            }
        });
    });

    this.handleSectionObserver(sections, navLinks);
};

App.updateActiveNavLink = function(activeLink) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    if (activeLink) activeLink.classList.add('active');
};

App.handleSectionObserver = function(sections, navLinks) {
    const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const sectionId = entry.target.getAttribute('id');
                this.state.currentSection = sectionId;

                navLinks.forEach(link => {
                    const href = link.getAttribute('href');
                    if (href === `#${sectionId}`) {
                        this.updateActiveNavLink(link);
                    }
                });
            }
        });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));
};

App.initMobileDrawer = function() {
    const mobileToggle = document.getElementById('mobileToggle');
    const drawer = document.getElementById('mobileDrawer');
    const overlay = document.getElementById('drawerOverlay');
    const closeBtn = document.getElementById('drawerClose');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

    if (!mobileToggle || !drawer || !overlay) return;

    const openDrawer = () => {
        drawer.classList.add('open');
        overlay.classList.add('open');
        this.state.isMenuOpen = true;
        document.body.style.overflow = 'hidden';
    };

    const closeDrawer = () => {
        drawer.classList.remove('open');
        overlay.classList.remove('open');
        this.state.isMenuOpen = false;
        document.body.style.overflow = '';
    };

    mobileToggle.addEventListener('click', openDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    overlay.addEventListener('click', closeDrawer);

    mobileNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            closeDrawer();
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            if (targetSection) {
                setTimeout(() => {
                    const offsetTop = targetSection.offsetTop - 80;
                    window.scrollTo({ top: offsetTop, behavior: 'smooth' });
                }, 300);
            }
        });
    });
};

App.initScrollEffects = function() {
    const navHeader = document.getElementById('navHeader');
    if (!navHeader) return;

    let ticking = false;

    const handleScroll = () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll > 50) {
            navHeader.classList.add('scrolled');
        } else {
            navHeader.classList.remove('scrolled');
        }

        ticking = false;
    };

    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(handleScroll);
            ticking = true;
        }
    }, { passive: true });
};

App.initScrollReveal = function() {
    const revealElements = document.querySelectorAll('.reveal:not(.hero-content)');

    if (!('IntersectionObserver' in window)) {
        revealElements.forEach(el => el.classList.add('visible'));
        return;
    }

    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -100px 0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    revealElements.forEach(el => observer.observe(el));
};

App.initButtons = function() {
    const demoBtn = document.getElementById('heroDemoBtn');
    if (demoBtn) {
        demoBtn.addEventListener('click', () => {
            document.getElementById('features').scrollIntoView({ behavior: 'smooth' });
        });
    }

    const learnBtn = document.getElementById('heroLearnBtn');
    if (learnBtn) {
        learnBtn.addEventListener('click', () => {
            document.getElementById('about').scrollIntoView({ behavior: 'smooth' });
        });
    }
};

App.showToast = function(title, message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: 'check-circle',
        error: 'x-circle',
        warning: 'alert-triangle',
        info: 'info'
    };

    toast.innerHTML = `
        <div class="toast-icon">
            <i data-lucide="${icons[type] || 'info'}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" aria-label="Close">
            <i data-lucide="x"></i>
        </button>
    `;

    container.appendChild(toast);

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => this.dismissToast(toast));

    setTimeout(() => this.dismissToast(toast), duration);
};

App.dismissToast = function(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.remove('show');
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 400);
};

App.initKeyboardShortcuts = function() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.state.isMenuOpen) {
            const overlay = document.getElementById('drawerOverlay');
            if (overlay) overlay.click();
        }

        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            this.showToast('Quick Search', 'Search functionality coming soon.', 'info');
        }
    });
};

App.initWindowEvents = function() {
    window.addEventListener('online', () => {
        this.state.connectionStatus = 'secure';
        this.showToast('Connection Restored', 'You are back online. All systems operational.', 'success');
    });

    window.addEventListener('offline', () => {
        this.state.connectionStatus = 'offline';
        this.showToast('Connection Lost', 'Working in offline mode. Messages will sync when restored.', 'warning');
    });

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (window.innerWidth > 768 && this.state.isMenuOpen) {
                const overlay = document.getElementById('drawerOverlay');
                if (overlay) overlay.click();
            }
        }, 250);
    });
};

App.init();
