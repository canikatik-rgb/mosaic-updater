/**
 * Sign Up Wizard - Multi-Step Controller
 * Handles step-by-step registration with animated transitions
 */

// Step definitions
const SIGNUP_STEPS = [
    {
        id: 'basics',
        title: 'Hello! 👋',
        subtitle: "Let's get to know you.",
        visual: 'step1.png'
    },
    {
        id: 'credentials',
        title: 'Account Details',
        subtitle: 'Create your email and password to sign in.',
        visual: 'step2.png'
    },
    {
        id: 'profession',
        title: 'What Do You Do?',
        subtitle: 'We want to provide the best experience for you.',
        visual: 'step3.png'
    },
    {
        id: 'referral',
        title: 'How Did You Hear About Us?',
        subtitle: 'This helps us grow.',
        visual: 'step4.png'
    },
    {
        id: 'purpose',
        title: 'What Will You Use It For?',
        subtitle: 'You can select multiple options.',
        visual: 'step5.png'
    }
];

// Profession options
const PROFESSIONS = [
    { value: 'developer', label: 'Developer', icon: 'fa-code' },
    { value: 'designer', label: 'Designer', icon: 'fa-palette' },
    { value: 'engineer', label: 'Engineer', icon: 'fa-cogs' },
    { value: 'academic', label: 'Academic', icon: 'fa-graduation-cap' },
    { value: 'journalist', label: 'Journalist', icon: 'fa-newspaper' },
    { value: 'student', label: 'Student', icon: 'fa-book' },
    { value: 'researcher', label: 'Researcher', icon: 'fa-microscope' },
    { value: 'lawyer', label: 'Lawyer', icon: 'fa-balance-scale' },
    { value: 'musician', label: 'Musician', icon: 'fa-music' },
    { value: 'other', label: 'Other', icon: 'fa-ellipsis-h' }
];

// Referral sources
const REFERRAL_SOURCES = [
    { value: 'colleague', label: 'Colleague', icon: 'fa-user-friends' },
    { value: 'google', label: 'Google', icon: 'fa-google' },
    { value: 'youtube', label: 'YouTube', icon: 'fa-youtube' },
    { value: 'social', label: 'Social Media', icon: 'fa-share-alt' },
    { value: 'email', label: 'Email', icon: 'fa-envelope' }
];

// Usage purposes
const USAGE_PURPOSES = [
    { value: 'automation', label: 'Automations', icon: 'fa-robot' },
    { value: 'visual_programming', label: 'Visual Programming', icon: 'fa-project-diagram' },
    { value: 'campaign', label: 'Campaign Management', icon: 'fa-bullhorn' },
    { value: 'research', label: 'Deep Research', icon: 'fa-search' },
    { value: 'homework', label: 'Homework', icon: 'fa-tasks' },
    { value: 'collaboration', label: 'Collaboration', icon: 'fa-users' }
];

// State
let currentStep = 0;
let formData = {
    fullName: '',
    email: '',
    password: '',
    profession: null,
    professionOther: '',
    referral: null,
    purposes: new Set()
};

/**
 * Show sign up screen
 */
function showSignUpScreen() {
    const signupScreen = document.getElementById('signup-screen');
    const signinScreen = document.getElementById('signin-screen');

    if (signinScreen) signinScreen.classList.add('hidden');
    if (signupScreen) signupScreen.classList.remove('hidden');

    // Reset state
    currentStep = 0;
    formData = {
        fullName: '',
        email: '',
        password: '',
        profession: null,
        professionOther: '',
        referral: null,
        purposes: new Set()
    };

    // Show first step
    updateStep(0);
    hideSignUpError();

    console.log('[SignUp] Wizard started');
}

/**
 * Hide sign up screen
 */
function hideSignUpScreen() {
    const signupScreen = document.getElementById('signup-screen');
    const signinScreen = document.getElementById('signin-screen');

    if (signupScreen) signupScreen.classList.add('hidden');
    if (signinScreen) signinScreen.classList.remove('hidden');
}

/**
 * Update current step
 */
function updateStep(stepIndex, direction = 'forward') {
    const steps = document.querySelectorAll('.signup-step');
    const progressSteps = document.querySelectorAll('.signup-progress-step');
    const visuals = document.querySelectorAll('.signup-visual');

    // Update progress bar
    progressSteps.forEach((step, i) => {
        step.classList.remove('active', 'completed');
        if (i < stepIndex) {
            step.classList.add('completed');
        } else if (i === stepIndex) {
            step.classList.add('active');
        }
    });

    // Animate steps
    steps.forEach((step, i) => {
        step.classList.remove('active', 'exit-left');

        if (i === stepIndex) {
            // Show new step
            setTimeout(() => {
                step.classList.add('active');
            }, 50);
        } else if (i === currentStep && direction === 'forward') {
            // Exit current step to left
            step.classList.add('exit-left');
        }
    });

    // Update visuals
    visuals.forEach((visual, i) => {
        visual.classList.toggle('active', i === stepIndex);
    });

    currentStep = stepIndex;
}

/**
 * Go to next step
 */
function nextStep() {
    if (!validateCurrentStep()) {
        return;
    }

    if (currentStep < SIGNUP_STEPS.length - 1) {
        updateStep(currentStep + 1, 'forward');
    } else {
        // Final step - submit
        handleSignUp();
    }
}

/**
 * Go to previous step
 */
function prevStep() {
    if (currentStep > 0) {
        updateStep(currentStep - 1, 'backward');
    } else {
        hideSignUpScreen();
    }
}

/**
 * Validate current step
 */
function validateCurrentStep() {
    hideSignUpError();

    switch (SIGNUP_STEPS[currentStep].id) {
        case 'basics':
            const fullName = document.getElementById('signup-fullname')?.value.trim();
            if (!fullName) {
                showSignUpError('Please enter your full name.');
                return false;
            }
            formData.fullName = fullName;
            return true;

        case 'credentials':
            const email = document.getElementById('signup-email')?.value.trim();
            const password = document.getElementById('signup-password')?.value;

            if (!email || !email.includes('@')) {
                showSignUpError('Please enter a valid email address.');
                return false;
            }
            if (!password || password.length < 6) {
                showSignUpError('Password must be at least 6 characters.');
                return false;
            }
            formData.email = email;
            formData.password = password;
            return true;

        case 'profession':
            if (!formData.profession) {
                showSignUpError('Please select a profession.');
                return false;
            }
            if (formData.profession === 'other') {
                const otherInput = document.getElementById('signup-profession-other-input')?.value.trim();
                if (!otherInput) {
                    showSignUpError('Please enter your profession.');
                    return false;
                }
                formData.professionOther = otherInput;
            }
            return true;

        case 'referral':
            if (!formData.referral) {
                showSignUpError('Please select an option.');
                return false;
            }
            return true;

        case 'purpose':
            if (formData.purposes.size === 0) {
                showSignUpError('Please select at least one purpose.');
                return false;
            }
            return true;
    }

    return true;
}

/**
 * Handle sign up submission
 */
async function handleSignUp() {
    const submitBtn = document.querySelector('.signup-step.active .signup-btn-primary');

    if (submitBtn) {
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;
    }

    try {
        const supabase = window.getSupabase();
        if (!supabase) {
            throw new Error('Supabase bağlantısı kurulamadı.');
        }

        // Prepare metadata
        const metadata = {
            full_name: formData.fullName,
            profession: formData.profession === 'other' ? formData.professionOther : formData.profession,
            referral_source: formData.referral,
            usage_purposes: Array.from(formData.purposes)
        };

        // Sign up with Supabase
        const { data, error } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
            options: {
                data: metadata,
                emailRedirectTo: 'mosaic://auth/verify'
            }
        });

        if (error) {
            throw error;
        }

        console.log('[SignUp] Success:', data);

        // Show success state
        showSignUpSuccess(formData.email);

    } catch (error) {
        console.error('[SignUp] Error:', error);
        showSignUpError(error.message || 'An error occurred during registration.');
    } finally {
        if (submitBtn) {
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    }
}

/**
 * Show success state
 */
function showSignUpSuccess(email) {
    const stepsContainer = document.querySelector('.signup-steps-container');
    const progressBar = document.querySelector('.signup-progress');
    const successContainer = document.querySelector('.signup-success');

    if (stepsContainer) stepsContainer.style.display = 'none';
    if (progressBar) progressBar.style.display = 'none';
    if (successContainer) {
        successContainer.style.display = 'block';
        const emailSpan = successContainer.querySelector('.signup-success-email');
        if (emailSpan) emailSpan.textContent = email;
    }
}

/**
 * Show error message
 */
function showSignUpError(message) {
    const errorDiv = document.getElementById('signup-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
    }
}

/**
 * Hide error message
 */
function hideSignUpError() {
    const errorDiv = document.getElementById('signup-error');
    if (errorDiv) {
        errorDiv.classList.remove('show');
    }
}

/**
 * Handle option selection
 */
function handleOptionSelect(type, value) {
    if (type === 'profession') {
        formData.profession = value;

        // Update UI
        document.querySelectorAll('#step-profession .signup-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.value === value);
        });

        // Show/hide other input
        const otherInput = document.getElementById('signup-profession-other');
        if (value === 'other') {
            otherInput?.classList.add('show');
            document.getElementById('signup-profession-other-input')?.focus();
        } else {
            otherInput?.classList.remove('show');
        }

    } else if (type === 'referral') {
        formData.referral = value;

        // Update UI
        document.querySelectorAll('#step-referral .signup-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.value === value);
        });

    } else if (type === 'purpose') {
        if (formData.purposes.has(value)) {
            formData.purposes.delete(value);
        } else {
            formData.purposes.add(value);
        }

        // Update UI
        document.querySelectorAll('#step-purpose .signup-option').forEach(opt => {
            opt.classList.toggle('selected', formData.purposes.has(opt.dataset.value));
        });
    }
}

/**
 * Initialize sign up wizard
 */
function initSignUpScreen() {
    const signupScreen = document.getElementById('signup-screen');
    if (!signupScreen) return;

    // Back button
    const backBtn = document.getElementById('signup-back');
    if (backBtn) {
        backBtn.addEventListener('click', prevStep);
    }

    // Next/Submit buttons
    document.querySelectorAll('.signup-btn-next').forEach(btn => {
        btn.addEventListener('click', nextStep);
    });

    // Previous buttons
    document.querySelectorAll('.signup-btn-prev').forEach(btn => {
        btn.addEventListener('click', prevStep);
    });

    // Profession options
    document.querySelectorAll('#step-profession .signup-option').forEach(opt => {
        opt.addEventListener('click', () => {
            handleOptionSelect('profession', opt.dataset.value);
        });
    });

    // Referral options
    document.querySelectorAll('#step-referral .signup-option').forEach(opt => {
        opt.addEventListener('click', () => {
            handleOptionSelect('referral', opt.dataset.value);
        });
    });

    // Purpose options
    document.querySelectorAll('#step-purpose .signup-option').forEach(opt => {
        opt.addEventListener('click', () => {
            handleOptionSelect('purpose', opt.dataset.value);
        });
    });

    // Sign in link
    const signinLink = document.getElementById('signup-signin-link');
    if (signinLink) {
        signinLink.addEventListener('click', (e) => {
            e.preventDefault();
            hideSignUpScreen();
        });
    }

    // Enter key navigation
    document.querySelectorAll('.signup-input').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                nextStep();
            }
        });
    });
}

// Export functions
window.showSignUpScreen = showSignUpScreen;
window.hideSignUpScreen = hideSignUpScreen;
window.initSignUpScreen = initSignUpScreen;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initSignUpScreen, 150);
});
