document.addEventListener('DOMContentLoaded', function() {
    // Quiz state variables
    let quizData;
    let currentQuestionIndex = 0;
    let userAnswers = [];
    let dataLoaded = false;

    // Lazy loading variables
    let retryCount = 0;
    const maxRetries = 3;

    // DOM Elements
    const welcomeScreen = document.getElementById('welcome-screen');
    const quizCard = document.getElementById('quiz-card');
    const startQuizBtn = document.getElementById('start-quiz');
    const quizProgress = document.getElementById('quiz-progress');
    const questionContainer = document.getElementById('question-container');
    const questionText = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const resultsContainer = document.getElementById('results-container');
    const restartQuizBtn = document.getElementById('restart-quiz');

    // Create Loading Indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = '<div class="spinner"></div><p>Loading F1 data...</p>';
    document.body.appendChild(loadingIndicator);

    // Load quiz data from JSON file
    async function loadQuizData() {
        try {
            const response = await fetch('quizdata.json');

            if (!response.ok) {
                throw new Error(`Network response was not ok (${response.status} ${response.statusText})`);
            }

            const data = await response.json();
            quizData = data;
            dataLoaded = true;
            console.log('Quiz data loaded successfully');

            // Hide loading indicator when data is loaded
            hideLoadingIndicator();

            // Preload images for better performance
            preloadImages();

            return true;
        } catch (error) {
            console.error('Error loading quiz data:', error);

            // Retry loading if possible
            if (retryCount < maxRetries) {
                retryCount++;
                console.log(`Retrying data load (${retryCount}/${maxRetries})...`);
                setTimeout(loadQuizData, 1000); // Wait 1 second before retry
            } else {
                // Show error in loading indicator
                loadingIndicator.innerHTML = `
                    <div style="color: #ff5555;"><i class="fas fa-exclamation-circle"></i></div>
                    <p>Failed to load quiz data. Please refresh the page.</p>
                    <button class="cta-button" onclick="location.reload()">Refresh</button>
                `;
            }

            return false;
        }
    }

    // Preload important images
    function preloadImages() {
        if (!quizData) return;

        // Preload team logos
        quizData.teams.forEach(team => {
            const img = new Image();
            img.src = team.image;
        });

        // Preload first 5 driver images (most likely matches)
        quizData.drivers.slice(0, 5).forEach(driver => {
            const img = new Image();
            img.src = driver.image;
        });
    }

    // Hide loading indicator
    function hideLoadingIndicator() {
        loadingIndicator.style.opacity = '0';
        setTimeout(() => {
            loadingIndicator.style.display = 'none';
        }, 500);
    }

    // Initialize progress steps
    function initializeProgressSteps() {
        quizProgress.innerHTML = '';
        for (let i = 0; i < quizData.questions.length; i++) {
            const step = document.createElement('div');
            step.classList.add('progress-step');
            step.setAttribute('aria-label', `Question ${i+1} of ${quizData.questions.length}`);

            if (i === currentQuestionIndex) {
                step.classList.add('active');
                step.setAttribute('aria-current', 'step');
            } else if (i < currentQuestionIndex) {
                step.classList.add('completed');
            }

            quizProgress.appendChild(step);
        }
    }

    // Display current question
    function displayQuestion() {
        const currentQuestion = quizData.questions[currentQuestionIndex];
        questionText.textContent = currentQuestion.question;
        optionsContainer.innerHTML = '';

        // Set accessibility attributes
        optionsContainer.setAttribute('aria-labelledby', 'question-text');

        // Create question number info for screen readers
        const questionInfo = document.createElement('div');
        questionInfo.className = 'sr-only';
        questionInfo.textContent = `Question ${currentQuestionIndex + 1} of ${quizData.questions.length}`;
        questionContainer.insertBefore(questionInfo, questionText);

        // Create options
        currentQuestion.options.forEach((option, index) => {
            const optionElement = document.createElement('div');
            optionElement.classList.add('option');
            optionElement.setAttribute('role', 'radio');
            optionElement.setAttribute('tabindex', '0');
            optionElement.setAttribute('aria-checked', userAnswers[currentQuestionIndex] === index ? 'true' : 'false');

            if (userAnswers[currentQuestionIndex] === index) {
                optionElement.classList.add('selected');
            }

            optionElement.innerHTML = `
                <span class="option-text">${option}</span>
                <span class="option-checkmark"><i class="fas fa-check"></i></span>
            `;

            // Add both click and keyboard (Enter/Space) events
            optionElement.addEventListener('click', () => selectOption(index));
            optionElement.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectOption(index);
                }
            });

            optionsContainer.appendChild(optionElement);
        });

        // Update navigation buttons
        prevBtn.classList.toggle('btn-disabled', currentQuestionIndex === 0);
        prevBtn.setAttribute('aria-disabled', currentQuestionIndex === 0);

        if (currentQuestionIndex === quizData.questions.length - 1) {
            nextBtn.textContent = 'See Results';
            nextBtn.setAttribute('aria-label', 'See your results');
        } else {
            nextBtn.textContent = 'Next';
            nextBtn.setAttribute('aria-label', 'Next question');
        }

        nextBtn.classList.toggle('btn-disabled', userAnswers[currentQuestionIndex] === undefined);
        nextBtn.setAttribute('aria-disabled', userAnswers[currentQuestionIndex] === undefined);

        // Animate question appearance
        questionContainer.classList.remove('active');
        setTimeout(() => {
            questionContainer.classList.add('active');
        }, 10);

        // Update progress steps
        initializeProgressSteps();

        // Set focus to the first option or the selected option for keyboard users
        setTimeout(() => {
            const selectedOption = optionsContainer.querySelector('.selected');
            if (selectedOption) {
                selectedOption.focus();
            } else {
                const firstOption = optionsContainer.querySelector('.option');
                if (firstOption) firstOption.focus();
            }
        }, 100);
    }

    // Select an option
    function selectOption(index) {
        userAnswers[currentQuestionIndex] = index;

        // Update UI to show selected option
        const options = optionsContainer.querySelectorAll('.option');
        options.forEach((option, i) => {
            option.classList.toggle('selected', i === index);
            option.setAttribute('aria-checked', i === index ? 'true' : 'false');
        });

        // Enable next button since an option was selected
        nextBtn.classList.remove('btn-disabled');
        nextBtn.setAttribute('aria-disabled', 'false');

        // Auto-advance after a short delay if not the last question
        if (currentQuestionIndex < quizData.questions.length - 1) {
            setTimeout(() => {
                goToNextQuestion();
            }, 500);
        }
    }

    // Go to next question
    function goToNextQuestion() {
        // Prevent proceeding if next button is disabled
        if (nextBtn.classList.contains('btn-disabled')) return;

        if (currentQuestionIndex < quizData.questions.length - 1) {
            currentQuestionIndex++;
            displayQuestion();
        } else {
            showResults();
        }
    }

    // Go to previous question
    function goToPreviousQuestion() {
        // Prevent proceeding if previous button is disabled
        if (prevBtn.classList.contains('btn-disabled')) return;

        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            displayQuestion();
        }
    }

    // Calculate results
    function calculateResults() {
        const teamScores = {};
        const driverScores = {};

        // Initialize scores
        quizData.teams.forEach(team => {
            teamScores[team.name] = 0;
        });

        quizData.drivers.forEach(driver => {
            driverScores[driver.name] = 0;
        });

        // Calculate scores based on affinities
        userAnswers.forEach((answer, questionIndex) => {
            quizData.teams.forEach(team => {
                // Higher score when team affinity matches user answer
                const affinity = team.affinities[questionIndex];
                const score = affinity === answer ? 10 : 10 - Math.abs(affinity - answer) * 2;
                teamScores[team.name] += score;
            });

            quizData.drivers.forEach(driver => {
                const affinity = driver.affinities[questionIndex];
                const score = affinity === answer ? 10 : 10 - Math.abs(affinity - answer) * 2;
                driverScores[driver.name] += score;
            });
        });

        // Find best matches
        let bestTeam = { name: '', score: 0 };
        let bestDriver = { name: '', score: 0 };

        for (const [teamName, score] of Object.entries(teamScores)) {
            if (score > bestTeam.score) {
                bestTeam = { name: teamName, score };
            }
        }

        for (const [driverName, score] of Object.entries(driverScores)) {
            if (score > bestDriver.score) {
                bestDriver = { name: driverName, score };
            }
        }

        const maxPossibleScore = quizData.questions.length * 10;
        const teamMatchPercentage = Math.round((bestTeam.score / maxPossibleScore) * 100);
        const driverMatchPercentage = Math.round((bestDriver.score / maxPossibleScore) * 100);

        return {
            team: {
                ...quizData.teams.find(team => team.name === bestTeam.name),
                matchPercentage: teamMatchPercentage
            },
            driver: {
                ...quizData.drivers.find(driver => driver.name === bestDriver.name),
                matchPercentage: driverMatchPercentage
            }
        };
    }

    // Show results
    function showResults() {
        const results = calculateResults();

        // Hide quiz card and show results
        quizCard.style.display = 'none';
        resultsContainer.style.display = 'block';

        // Populate team result
        const teamImage = document.getElementById('team-image');
        teamImage.src = results.team.image;
        teamImage.alt = `${results.team.name} logo`;

        document.getElementById('team-name').textContent = results.team.name;
        document.getElementById('team-subtitle').textContent = results.team.subtitle;
        document.getElementById('team-description').textContent = results.team.description;
        document.getElementById('team-match-percentage').textContent = `${results.team.matchPercentage}%`;

        // Populate driver result
        const driverImage = document.getElementById('driver-image');
        driverImage.src = results.driver.image;
        driverImage.alt = `Photo of ${results.driver.name}`;

        document.getElementById('driver-name').textContent = results.driver.name;
        document.getElementById('driver-subtitle').textContent = results.driver.subtitle;
        document.getElementById('driver-description').textContent = results.driver.description;
        document.getElementById('driver-match-percentage').textContent = `${results.driver.matchPercentage}%`;

        // Show driver's team
        const driverTeam = results.driver.team || '';
        const driverTeamElement = document.getElementById('driver-team');
        if (driverTeamElement && driverTeam) {
            driverTeamElement.textContent = `Current Team: ${driverTeam}`;
            driverTeamElement.style.display = 'block';
        } else if (driverTeamElement) {
            driverTeamElement.style.display = 'none';
        }

        // Animate results appearance
        setTimeout(() => {
            resultsContainer.classList.add('active');

            // Animate progress bars
            setTimeout(() => {
                const teamMatchValue = document.getElementById('team-match-value');
                const driverMatchValue = document.getElementById('driver-match-value');

                teamMatchValue.style.width = `${results.team.matchPercentage}%`;
                driverMatchValue.style.width = `${results.driver.matchPercentage}%`;

                // Set aria values for accessibility
                teamMatchValue.setAttribute('aria-valuenow', results.team.matchPercentage);
                driverMatchValue.setAttribute('aria-valuenow', results.driver.matchPercentage);
            }, 500);
        }, 100);

        // Setup social sharing
        setupSocialSharing(results);

        // Set focus to restart button for keyboard users
        setTimeout(() => {
            restartQuizBtn.focus();
        }, 1000);

        // Track completion if Google Analytics is available
        if (typeof gtag === 'function') {
            gtag('event', 'quiz_completed', {
                'event_category': 'engagement',
                'event_label': 'F1 Affinity Quiz',
                'team_match': results.team.name,
                'driver_match': results.driver.name
            });
        }
    }

    // Setup social sharing links
    function setupSocialSharing(results) {
        const shareText = `I'm a ${results.team.matchPercentage}% match with ${results.team.name} and ${results.driver.matchPercentage}% match with ${results.driver.name} in the F1 Affinity Quiz! Find your F1 matches:`;
        const shareUrl = encodeURIComponent(window.location.href);
        const shareTextEncoded = encodeURIComponent(shareText);

        const twitterShare = document.querySelector('.share-twitter');
        const fbShare = document.querySelector('.share-facebook');
        const whatsappShare = document.querySelector('.share-whatsapp');

        // Set proper sharing URLs
        twitterShare.href = `https://twitter.com/intent/tweet?text=${shareTextEncoded}&url=${shareUrl}`;
        fbShare.href = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}&quote=${shareTextEncoded}`;
        whatsappShare.href = `https://wa.me/?text=${shareTextEncoded} ${shareUrl}`;

        // Set aria labels with proper context
        twitterShare.setAttribute('aria-label', `Share your ${results.team.name} and ${results.driver.name} match on Twitter`);
        fbShare.setAttribute('aria-label', `Share your ${results.team.name} and ${results.driver.name} match on Facebook`);
        whatsappShare.setAttribute('aria-label', `Share your ${results.team.name} and ${results.driver.name} match on WhatsApp`);

        // Track sharing if Google Analytics is available
        const shareButtons = document.querySelectorAll('.social-share a');
        shareButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                if (typeof gtag === 'function') {
                    gtag('event', 'share', {
                        'event_category': 'engagement',
                        'event_label': this.classList.contains('share-twitter') ? 'Twitter' :
                            this.classList.contains('share-facebook') ? 'Facebook' : 'WhatsApp',
                        'value': 1
                    });
                }
            });
        });
    }

    // Restart quiz
    function restartQuiz() {
        currentQuestionIndex = 0;
        userAnswers = Array(quizData.questions.length).fill(undefined);
        resultsContainer.classList.remove('active');

        setTimeout(() => {
            resultsContainer.style.display = 'none';
            quizCard.style.display = 'block';
            displayQuestion();
        }, 300);

        // Track restart if Google Analytics is available
        if (typeof gtag === 'function') {
            gtag('event', 'restart_quiz', {
                'event_category': 'engagement',
                'event_label': 'F1 Affinity Quiz'
            });
        }
    }

    // Start quiz
    function startQuiz() {
        if (!dataLoaded) {
            // Show loading message if data isn't loaded yet
            loadingIndicator.style.display = 'flex';
            loadingIndicator.style.opacity = '1';
            loadingIndicator.innerHTML = '<div class="spinner"></div><p>Loading F1 data...</p>';

            // Try to load data again
            loadQuizData().then(success => {
                if (success) {
                    hideLoadingIndicator();
                    startQuizAfterDataLoad();
                }
            });
            return;
        }

        startQuizAfterDataLoad();
    }

    // Function to start quiz after data is loaded
    function startQuizAfterDataLoad() {
        welcomeScreen.style.display = 'none';
        quizCard.style.display = 'block';
        currentQuestionIndex = 0;
        userAnswers = Array(quizData.questions.length).fill(undefined);
        displayQuestion();

        // Track quiz start if Google Analytics is available
        if (typeof gtag === 'function') {
            gtag('event', 'start_quiz', {
                'event_category': 'engagement',
                'event_label': 'F1 Affinity Quiz'
            });
        }
    }

    // Handle keyboard navigation
    function handleKeyboardNavigation() {
        // Quiz navigation with keyboard
        document.addEventListener('keydown', function(e) {
            // Only handle navigation keys when quiz is active
            if (quizCard.style.display === 'none') return;

            // Arrow keys for navigation between questions
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                if (!nextBtn.classList.contains('btn-disabled')) {
                    e.preventDefault();
                    goToNextQuestion();
                }
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                if (!prevBtn.classList.contains('btn-disabled')) {
                    e.preventDefault();
                    goToPreviousQuestion();
                }
            }

            // Number keys 1-4 for selecting options
            if (['1', '2', '3', '4'].includes(e.key)) {
                const index = parseInt(e.key) - 1;
                const options = optionsContainer.querySelectorAll('.option');
                if (index >= 0 && index < options.length) {
                    e.preventDefault();
                    selectOption(index);
                }
            }
        });
    }

    // Handle touch gestures for mobile users
    function setupTouchGestures() {
        let touchStartX = 0;
        let touchEndX = 0;

        // Detect swipe direction
        function checkDirection() {
            if (quizCard.style.display === 'none') return;

            const threshold = 100; // Minimum swipe distance

            if (touchEndX < touchStartX - threshold) {
                // Swipe left - go to next question
                if (!nextBtn.classList.contains('btn-disabled')) {
                    goToNextQuestion();
                }
            } else if (touchEndX > touchStartX + threshold) {
                // Swipe right - go to previous question
                if (!prevBtn.classList.contains('btn-disabled')) {
                    goToPreviousQuestion();
                }
            }
        }

        document.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
        });

        document.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            checkDirection();
        });
    }

    // Optimize performance by reducing animations when needed
    function optimizePerformance() {
        // Check if device is low-end
        const isLowEndDevice = navigator.hardwareConcurrency <= 2 ||
            navigator.deviceMemory <= 2 ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (isLowEndDevice) {
            // Add class to body to reduce animations
            document.body.classList.add('reduce-animations');

            // Remove background animations
            const streaks = document.querySelectorAll('.streak');
            streaks.forEach(streak => streak.style.display = 'none');

            document.querySelector('.background').style.animation = 'none';
        }
    }

    // Improve page load times
    function optimizeLoadTime() {
        // Lazy load team and driver images after first 5
        if (quizData && quizData.teams && quizData.drivers) {
            // Lazy load remaining team images
            quizData.teams.slice(5).forEach(team => {
                team.lazyLoad = true;
            });

            // Lazy load remaining driver images
            quizData.drivers.slice(5).forEach(driver => {
                driver.lazyLoad = true;
            });
        }
    }

    // Handle network issues
    function handleNetworkStatus() {
        window.addEventListener('online', function() {
            // Retry loading data if it failed before
            if (!dataLoaded) {
                loadQuizData();
            }
        });

        window.addEventListener('offline', function() {
            // Notify user if they go offline during quiz
            if (dataLoaded) {
                const notification = document.createElement('div');
                notification.className = 'offline-notification';
                notification.innerHTML = '<i class="fas fa-wifi-slash"></i> You are offline. Your progress will be saved.';
                document.body.appendChild(notification);

                setTimeout(() => {
                    notification.style.opacity = '0';
                    setTimeout(() => {
                        document.body.removeChild(notification);
                    }, 500);
                }, 3000);
            }
        });
    }

    // Save quiz progress in browser storage
    function saveProgress() {
        // Only save if we have answers to save
        if (userAnswers.length === 0) return;

        try {
            localStorage.setItem('f1quiz_progress', JSON.stringify({
                answers: userAnswers,
                currentIndex: currentQuestionIndex,
                timestamp: new Date().getTime()
            }));
        } catch (e) {
            console.warn('Could not save quiz progress to localStorage', e);
        }
    }

    // Load saved progress
    function loadSavedProgress() {
        try {
            const savedData = localStorage.getItem('f1quiz_progress');
            if (!savedData) return false;

            const progress = JSON.parse(savedData);
            const timestamp = progress.timestamp;
            const now = new Date().getTime();

            // Only load progress if it's less than 1 day old
            if (now - timestamp < 24 * 60 * 60 * 1000) {
                userAnswers = progress.answers;
                currentQuestionIndex = progress.currentIndex;
                return true;
            } else {
                // Clear old saved data
                localStorage.removeItem('f1quiz_progress');
                return false;
            }
        } catch (e) {
            console.warn('Could not load saved quiz progress', e);
            return false;
        }
    }

    // Check for saved progress when starting
    function checkForSavedProgress() {
        if (loadSavedProgress()) {
            // Show a notification about saved progress
            const notification = document.createElement('div');
            notification.className = 'progress-notification';
            notification.innerHTML = `
                <div class="notification-content">
                    <p>Would you like to continue your previous quiz?</p>
                    <div class="notification-buttons">
                        <button id="continue-quiz" class="cta-button">Continue</button>
                        <button id="new-quiz" class="cta-button btn-prev">Start New</button>
                    </div>
                </div>
            `;

            document.body.appendChild(notification);

            // Handle user choice
            document.getElementById('continue-quiz').addEventListener('click', function() {
                document.body.removeChild(notification);
                startQuizAfterDataLoad();
            });

            document.getElementById('new-quiz').addEventListener('click', function() {
                document.body.removeChild(notification);
                userAnswers = Array(quizData.questions.length).fill(undefined);
                currentQuestionIndex = 0;
                startQuizAfterDataLoad();
            });

            return true;
        }

        return false;
    }

    // Initialize app
    function init() {
        // Load quiz data
        loadQuizData();

        // Setup event listeners
        startQuizBtn.addEventListener('click', startQuiz);
        nextBtn.addEventListener('click', goToNextQuestion);
        prevBtn.addEventListener('click', goToPreviousQuestion);
        restartQuizBtn.addEventListener('click', restartQuiz);

        // Setup navigation
        handleKeyboardNavigation();
        setupTouchGestures();

        // Optimize performance
        optimizePerformance();

        // Handle network issues
        handleNetworkStatus();

        // Automatically save progress when changes happen
        setInterval(saveProgress, 5000);

        // Social sharing functionality
        document.querySelectorAll('.social-share a').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                window.open(this.href, 'share-dialog', 'width=800,height=600');
            });
        });

        // Navbar scroll effect
        window.addEventListener('scroll', function() {
            const navbar = document.querySelector('.navbar');
            if (window.scrollY > 10) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }

    // Initialize everything
    init();
});