/**
 * CampusAlert - Interactive JavaScript
 * St. Columban College Security Portal
 */

'use strict';

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Hide loading overlay
    setTimeout(() => {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }, 1500);

    // Initialize all components
    initRainEffect();
    initNavbar();
    initParallax();
    initFormInteractions();
    initNotificationBell();
    initProfileAnimation();
    initToast();
});

// ============================================
// RAIN EFFECT
// ============================================
function initRainEffect() {
    const rainContainer = document.getElementById('rainEffect');
    if (!rainContainer) return;

    const dropCount = 100;

    for (let i = 0; i < dropCount; i++) {
        const drop = document.createElement('div');
        drop.className = 'rain-drop';
        drop.style.left = `${Math.random() * 100}%`;
        drop.style.animationDelay = `${Math.random() * 2}s`;
        drop.style.animationDuration = `${0.5 + Math.random() * 0.5}s`;
        rainContainer.appendChild(drop);
    }
}

// ============================================
// NAVBAR SCROLL EFFECT
// ============================================
function initNavbar() {
    const navbar = document.getElementById('navbar');
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const navLinks = document.getElementById('navLinks');

    if (!navbar) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    if (mobileMenuToggle && navLinks) {
        mobileMenuToggle.addEventListener('click', () => {
            mobileMenuToggle.classList.toggle('active');
            navLinks.classList.toggle('active');
        });
    }
}

// ============================================
// PARALLAX EFFECT
// ============================================
function initParallax() {
    const container = document.getElementById('parallaxContainer');
    const card = document.getElementById('loginCard');

    if (!card) return;

    document.addEventListener('mousemove', (e) => {
        const mouseX = e.clientX / window.innerWidth - 0.5;
        const mouseY = e.clientY / window.innerHeight - 0.5;

        const rotateX = mouseY * 8;
        const rotateY = -mouseX * 8;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(20px)`;
    });

    document.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateZ(0)';
        card.style.transition = 'transform 0.5s ease';
    });

    document.addEventListener('mouseenter', () => {
        card.style.transition = 'transform 0.1s ease-out';
    });
}

// ============================================
// FORM INTERACTIONS
// ============================================
function initFormInteractions() {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const emailIcon = document.getElementById('emailIcon');
    const passwordIcon = document.getElementById('passwordIcon');
    const passwordToggle = document.getElementById('passwordToggle');
    const signinBtn = document.getElementById('signinBtn');
    const loginForm = document.getElementById('loginForm');
    const checkboxWrapper = document.getElementById('rememberCheckbox');
    const checkbox = document.getElementById('checkboxIndicator');
    const googleBtn = document.getElementById('googleSigninBtn');

    // Icon morph on focus
    if (emailInput && emailIcon) {
        emailInput.addEventListener('focus', () => {
            emailIcon.classList.add('morph');
            setTimeout(() => emailIcon.classList.remove('morph'), 400);
        });
    }

    if (passwordInput && passwordIcon) {
        passwordInput.addEventListener('focus', () => {
            passwordIcon.classList.add('morph');
            setTimeout(() => passwordIcon.classList.remove('morph'), 400);
        });
    }

    // Password visibility toggle
    if (passwordToggle && passwordInput) {
        passwordToggle.addEventListener('click', () => {
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;

            const eyeOpen = passwordToggle.querySelector('.eye-open');
            const eyeClosed = passwordToggle.querySelector('.eye-closed');

            if (type === 'text') {
                if (eyeOpen) eyeOpen.style.display = 'none';
                if (eyeClosed) eyeClosed.style.display = 'block';
            } else {
                if (eyeOpen) eyeOpen.style.display = 'block';
                if (eyeClosed) eyeClosed.style.display = 'none';
            }
        });
    }

    // Checkbox toggle
    if (checkboxWrapper && checkbox) {
        checkboxWrapper.addEventListener('click', () => {
            checkbox.classList.toggle('checked');
        });
    }

    // Form submission with loading animation
    if (loginForm && signinBtn) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();

            signinBtn.classList.add('loading');
            signinBtn.innerHTML = '<span class="btn-text"><div class="spinner"></div>Signing in...</span>';

            // Simulate login
            setTimeout(() => {
                signinBtn.classList.remove('loading');
                signinBtn.innerHTML = `<span class="btn-text">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Welcome Back!
                </span>`;

                const card = document.getElementById('loginCard');
                if (card) card.classList.add('success');

                showToast('Login Successful', 'Redirecting to your dashboard...');

                setTimeout(() => {
                    signinBtn.innerHTML = `<span class="btn-text">
                        Sign In
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"/>
                            <polyline points="12 5 19 12 12 19"/>
                        </svg>
                    </span>`;
                    if (card) card.classList.remove('success');
                }, 2000);
            }, 2000);
        });
    }

    // Google sign in
    if (googleBtn) {
        googleBtn.addEventListener('click', () => {
            showToast('Google Sign-In', 'Redirecting to Google...');
        });
    }
}

// ============================================
// NOTIFICATION BELL
// ============================================
function initNotificationBell() {
    const bell = document.getElementById('notificationBell');

    if (!bell) return;

    // Simulate notification jiggle
    setTimeout(() => {
        bell.classList.add('jiggle');
        setTimeout(() => bell.classList.remove('jiggle'), 500);
    }, 3000);

    bell.addEventListener('click', () => {
        bell.classList.add('jiggle');
        setTimeout(() => bell.classList.remove('jiggle'), 500);
        showToast('Notifications', 'You have 3 unread notifications');
    });

    // Periodic jiggle
    setInterval(() => {
        bell.classList.add('jiggle');
        setTimeout(() => bell.classList.remove('jiggle'), 500);
    }, 15000);
}

// ============================================
// PROFILE ANIMATION
// ============================================
function initProfileAnimation() {
    const profile = document.getElementById('profileIcon');
    const inner = document.getElementById('profileLottie');

    if (!profile) return;

    if (inner) {
        profile.addEventListener('mouseenter', () => {
            inner.style.transform = 'scale(1.1)';
            inner.style.transition = 'transform 0.3s ease';
        });

        profile.addEventListener('mouseleave', () => {
            inner.style.transform = 'scale(1)';
        });
    }

    profile.addEventListener('click', () => {
        showToast('Profile', 'Opening user profile...');
    });
}

// ============================================
// TOAST NOTIFICATION
// ============================================
function initToast() {
    const toast = document.getElementById('toast');
    const closeBtn = document.getElementById('toastClose');

    if (closeBtn && toast) {
        closeBtn.addEventListener('click', () => {
            toast.classList.remove('show');
        });
    }
}

/**
 * Show a toast notification
 * @param {string} title - Toast title
 * @param {string} message - Toast message
 */
function showToast(title, message) {
    const toast = document.getElementById('toast');

    if (!toast) return;

    const toastTitle = toast.querySelector('.toast-title');
    const toastMessage = toast.querySelector('.toast-message');

    if (toastTitle) toastTitle.textContent = title;
    if (toastMessage) toastMessage.textContent = message;

    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// Expose showToast globally
window.showToast = showToast;

// ============================================
// EXPORTED MODULE (for future use)
// ============================================
const CampusAlert = {
    showToast,
    initRainEffect,
    initNavbar,
    initParallax,
    initFormInteractions,
    initNotificationBell,
    initProfileAnimation,
    initToast
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CampusAlert;
}
