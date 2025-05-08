document.addEventListener('DOMContentLoaded', function() {
    // Quiz state variables
    let quizData;
    let currentQuestionIndex = 0;
    let userAnswers = [];

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

    // Load quiz data from JSON file
    fetch('quizdata.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            quizData = data;
            console.log('Quiz data loaded successfully');
        })
        .catch(error => {
            console.error('Error loading quiz data:', error);
            alert('Failed to load quiz data. Please refresh the page.');
        });

    // Initialize progress steps
    function initializeProgressSteps() {
        quizProgress.innerHTML = '';
        for (let i = 0; i < quizData.questions.length; i++) {
            const step = document.createElement('div');
            step.classList.add('progress-step');
            if (i === currentQuestionIndex) {
                step.classList.add('active');
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

        currentQuestion.options.forEach((option, index) => {
            const optionElement = document.createElement('div');
            optionElement.classList.add('option');
            if (userAnswers[currentQuestionIndex] === index) {
                optionElement.classList.add('selected');
            }

            optionElement.innerHTML = `
                <span class="option-text">${option}</span>
                <span class="option-checkmark"><i class="fas fa-check"></i></span>
            `;

            optionElement.addEventListener('click', () => selectOption(index));
            optionsContainer.appendChild(optionElement);
        });

        // Update navigation buttons
        prevBtn.classList.toggle('btn-disabled', currentQuestionIndex === 0);

        if (currentQuestionIndex === quizData.questions.length - 1) {
            nextBtn.textContent = 'See Results';
        } else {
            nextBtn.textContent = 'Next';
        }

        nextBtn.classList.toggle('btn-disabled', userAnswers[currentQuestionIndex] === undefined);

        // Animate question appearance
        questionContainer.classList.remove('active');
        setTimeout(() => {
            questionContainer.classList.add('active');
        }, 10);

        // Update progress steps
        initializeProgressSteps();
    }

    // Select an option
    function selectOption(index) {
        userAnswers[currentQuestionIndex] = index;

        // Update UI to show selected option
        const options = optionsContainer.querySelectorAll('.option');
        options.forEach((option, i) => {
            option.classList.toggle('selected', i === index);
        });

        // Enable next button since an option was selected
        nextBtn.classList.remove('btn-disabled');
    }

    // Go to next question
    function goToNextQuestion() {
        if (currentQuestionIndex < quizData.questions.length - 1) {
            currentQuestionIndex++;
            displayQuestion();
        } else {
            showResults();
        }
    }

    // Go to previous question
    function goToPreviousQuestion() {
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
        document.getElementById('team-image').src = results.team.image;
        document.getElementById('team-name').textContent = results.team.name;
        document.getElementById('team-subtitle').textContent = results.team.subtitle;
        document.getElementById('team-description').textContent = results.team.description;
        document.getElementById('team-match-percentage').textContent = `${results.team.matchPercentage}%`;

        // Populate driver result
        document.getElementById('driver-image').src = results.driver.image;
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
                document.getElementById('team-match-value').style.width = `${results.team.matchPercentage}%`;
                document.getElementById('driver-match-value').style.width = `${results.driver.matchPercentage}%`;
            }, 500);
        }, 100);

        // Setup social sharing
        setupSocialSharing(results);
    }

    // Setup social sharing links
    function setupSocialSharing(results) {
        const shareText = `I'm a ${results.team.matchPercentage}% match with ${results.team.name} and ${results.driver.matchPercentage}% match with ${results.driver.name} in the F1 Affinity Quiz! Find your F1 matches:`;
        const shareUrl = encodeURIComponent(window.location.href);
        const shareTextEncoded = encodeURIComponent(shareText);

        document.querySelector('.share-twitter').href = `https://twitter.com/intent/tweet?text=${shareTextEncoded}&url=${shareUrl}`;
        document.querySelector('.share-facebook').href = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}&quote=${shareTextEncoded}`;
        document.querySelector('.share-whatsapp').href = `https://wa.me/?text=${shareTextEncoded} ${shareUrl}`;
    }

    // Restart quiz
    function restartQuiz() {
        currentQuestionIndex = 0;
        userAnswers = [];
        resultsContainer.classList.remove('active');

        setTimeout(() => {
            resultsContainer.style.display = 'none';
            quizCard.style.display = 'block';
            displayQuestion();
        }, 300);
    }

    // Start quiz
    function startQuiz() {
        if (!quizData) {
            alert('Quiz data is still loading. Please wait a moment and try again.');
            return;
        }

        welcomeScreen.style.display = 'none';
        quizCard.style.display = 'block';
        currentQuestionIndex = 0;
        userAnswers = Array(quizData.questions.length).fill(undefined);
        displayQuestion();
    }

    // Event listeners
    startQuizBtn.addEventListener('click', startQuiz);
    nextBtn.addEventListener('click', goToNextQuestion);
    prevBtn.addEventListener('click', goToPreviousQuestion);
    restartQuizBtn.addEventListener('click', restartQuiz);

    // Navbar scroll effect
    window.addEventListener('scroll', function() {
        const navbar = document.querySelector('.navbar');
        if (window.scrollY > 10) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Social sharing functionality
    document.querySelectorAll('.social-share a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            window.open(this.href, 'share-dialog', 'width=800,height=600');
        });
    });

    // Loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = '<div class="spinner"></div><p>Loading F1 data...</p>';
    document.body.appendChild(loadingIndicator);

    // Hide loading indicator when data is loaded or after timeout
    const hideLoadingIndicator = () => {
        loadingIndicator.style.opacity = '0';
        setTimeout(() => {
            loadingIndicator.style.display = 'none';
        }, 500);
    };

    // Check if data is loaded every 100ms
    const checkDataLoaded = setInterval(() => {
        if (quizData) {
            hideLoadingIndicator();
            clearInterval(checkDataLoaded);
        }
    }, 100);

    // Timeout after 5 seconds regardless
    setTimeout(() => {
        hideLoadingIndicator();
        clearInterval(checkDataLoaded);
    }, 5000);
});