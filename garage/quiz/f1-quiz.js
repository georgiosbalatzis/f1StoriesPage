document.addEventListener('DOMContentLoaded', function() {
    // Quiz Data
    const quizData = {
        questions: [
            {
                question: "What's most important to you in Formula 1?",
                options: [
                    "Pure speed and performance",
                    "Technical innovation",
                    "Racing heritage and tradition",
                    "Driver skill and overtaking"
                ]
            },
            {
                question: "Which racing style do you prefer?",
                options: [
                    "Aggressive and bold",
                    "Calculated and strategic",
                    "Smooth and consistent",
                    "Adaptable to any condition"
                ]
            },
            {
                question: "How do you feel about team orders?",
                options: [
                    "They're necessary - the team comes first",
                    "Only acceptable in championship-deciding situations",
                    "Drivers should be free to race each other",
                    "Depends on the specific situation"
                ]
            },
            {
                question: "Which track type do you enjoy most?",
                options: [
                    "High-speed circuits with long straights",
                    "Technical tracks with challenging corners",
                    "Street circuits with walls close to the track",
                    "Classic tracks with history and character"
                ]
            },
            {
                question: "What's your approach to risk-taking?",
                options: [
                    "Go for the gap, always",
                    "Calculate risk vs. reward before any move",
                    "Prefer consistency over risky moves",
                    "Take big risks only when necessary"
                ]
            },
            {
                question: "How do you handle pressure situations?",
                options: [
                    "Thrive under pressure - bring it on!",
                    "Stay cool and analytical",
                    "Focus on routine and consistency",
                    "Adapt my approach based on the situation"
                ]
            },
            {
                question: "What aspect of car development interests you most?",
                options: [
                    "Aerodynamic performance",
                    "Power unit efficiency",
                    "Mechanical grip and handling",
                    "Overall balance and drivability"
                ]
            },
            {
                question: "How would you describe your personality?",
                options: [
                    "Passionate and emotional",
                    "Analytical and precise",
                    "Calm and composed",
                    "Versatile and adaptive"
                ]
            },
            {
                question: "What's your communication style?",
                options: [
                    "Direct and to the point",
                    "Detailed and thorough",
                    "Diplomatic and considerate",
                    "Depends on who I'm talking to"
                ]
            },
            {
                question: "What do you value most in a race weekend?",
                options: [
                    "Securing pole position",
                    "Having the fastest car in race trim",
                    "Consistent performance across all sessions",
                    "Maximizing points regardless of starting position"
                ]
            }
        ],
        teams: [
            {
                name: "Mercedes AMG Petronas",
                subtitle: "The Silver Arrows",
                description: "Mercedes combines technical excellence with efficiency. A dominant force in the turbo-hybrid era, their approach emphasizes engineering precision and systematic improvement.",
                image: "https://www.formula1.com/content/dam/fom-website/teams/2023/mercedes-logo.png.transform/2col/image.png",
                affinities: [1, 2, 0, 3, 1, 1, 1, 2, 1, 2]
            },
            {
                name: "Red Bull Racing",
                subtitle: "The Bulls",
                description: "Red Bull thrives on boldness and aggressive strategy. With a focus on aerodynamic excellence, they favor drivers who push limits and can handle a car that's quick but sometimes challenging.",
                image: "https://www.formula1.com/content/dam/fom-website/teams/2023/red-bull-racing-logo.png.transform/2col/image.png",
                affinities: [0, 0, 2, 1, 0, 0, 0, 0, 0, 0]
            },
            {
                name: "Scuderia Ferrari",
                subtitle: "The Prancing Horse",
                description: "F1's most storied team blends tradition with passion. Ferrari values heritage while pursuing excellence, with an emotional approach to racing that resonates with fans worldwide.",
                image: "https://www.formula1.com/content/dam/fom-website/teams/2023/ferrari-logo.png.transform/2col/image.png",
                affinities: [2, 0, 1, 3, 0, 0, 1, 0, 2, 0]
            },
            {
                name: "McLaren",
                subtitle: "The Papaya",
                description: "McLaren balances innovation with racing heritage. With renewed momentum, they combine technical precision with a positive team culture and strategic intelligence.",
                image: "https://www.formula1.com/content/dam/fom-website/teams/2023/mclaren-logo.png.transform/2col/image.png",
                affinities: [0, 3, 2, 1, 3, 3, 3, 1, 1, 3]
            },
            {
                name: "Aston Martin",
                subtitle: "The Green Team",
                description: "Aston Martin exemplifies British engineering with ambitious goals. Their methodical approach focuses on steady progress while building a foundation for future success.",
                image: "https://www.formula1.com/content/dam/fom-website/teams/2023/aston-martin-logo.png.transform/2col/image.png",
                affinities: [2, 1, 3, 3, 2, 2, 2, 2, 2, 1]
            },
            {
                name: "Alpine F1 Team",
                subtitle: "The French Flag",
                description: "Alpine brings French flair to Formula 1 with a focus on technical innovation and efficiency. Their balanced approach prioritizes smart resource allocation and consistent improvement.",
                image: "https://www.formula1.com/content/dam/fom-website/teams/2023/alpine-logo.png.transform/2col/image.png",
                affinities: [1, 2, 1, 2, 1, 3, 1, 1, 3, 2]
            },
            {
                name: "Williams Racing",
                subtitle: "The Grove-based Team",
                description: "Williams combines rich heritage with a renewed push toward competitiveness. Their approach values technical ingenuity and driver development with a fighting spirit.",
                image: "https://www.formula1.com/content/dam/fom-website/teams/2023/williams-logo.png.transform/2col/image.png",
                affinities: [3, 1, 2, 3, 2, 2, 2, 3, 1, 1]
            },
            {
                name: "Haas F1 Team",
                subtitle: "The American Outfit",
                description: "Haas takes a pragmatic approach to Formula 1, focusing on efficiency and smart resource allocation. They value straightforward solutions and adaptability.",
                image: "https://www.formula1.com/content/dam/fom-website/teams/2023/haas-f1-team-logo.png.transform/2col/image.png",
                affinities: [1, 3, 0, 0, 3, 0, 2, 3, 0, 3]
            },
            {
                name: "Kick Sauber",
                subtitle: "The Swiss Precision",
                description: "Sauber combines Swiss precision with racing passion. Their methodical approach focuses on technical excellence and driver development with an eye toward the future.",
                image: "https://www.formula1.com/content/dam/fom-website/teams/2024/kick-sauber-logo.png.transform/2col/image.png",
                affinities: [2, 2, 1, 2, 2, 2, 3, 2, 2, 1]
            },
            {
                name: "VCARB Racing Bulls",
                subtitle: "The Sister Team",
                description: "Racing Bulls combines Italian flair with Red Bull DNA. They focus on developing young talent while providing a proving ground for innovative technical solutions.",
                image: "data/RB.webp",
                affinities: [0, 1, 2, 1, 0, 1, 0, 0, 1, 2]
            }
        ],
        drivers: [
            {
                name: "Lewis Hamilton",
                subtitle: "7-time World Champion",
                description: "Combines natural talent with meticulous preparation. Hamilton excels in all conditions and is known for both speed and consistency. A master of tire management and race craft.",
                image: "https://www.formula1.com/content/dam/fom-website/drivers/L/LEWHAM01_Lewis_Hamilton/lewham01.png.transform/2col/image.png",
                affinities: [3, 2, 1, 3, 3, 1, 3, 0, 0, 3]
            },
            {
                name: "Max Verstappen",
                subtitle: "The Flying Dutchman",
                description: "Aggressive, fearless and exceptionally talented. Verstappen has lightning reflexes and an instinctive racing style, always pushing to the absolute limit in any situation.",
                image: "https://www.formula1.com/content/dam/fom-website/drivers/M/MAXVER01_Max_Verstappen/maxver01.png.transform/2col/image.png",
                affinities: [0, 0, 2, 1, 0, 0, 3, 0, 0, 1]
            },
            {
                name: "Charles Leclerc",
                subtitle: "The Monegasque Prince",
                description: "Combines raw speed with emotional determination. Leclerc is exceptional in qualifying, with a driving style that's both precise and passionate - always giving everything for the team.",
                image: "https://www.formula1.com/content/dam/fom-website/drivers/C/CHALEC01_Charles_Leclerc/chalec01.png.transform/2col/image.png",
                affinities: [0, 0, 0, 2, 0, 0, 0, 0, 2, 0]
            },
            {
                name: "Lando Norris",
                subtitle: "The Rising Star",
                description: "A new generation talent with exceptional adaptability. Norris combines natural speed with a thoughtful approach to racing and strong technical feedback.",
                image: "https://www.formula1.com/content/dam/fom-website/drivers/L/LANNOR01_Lando_Norris/lannor01.png.transform/2col/image.png",
                affinities: [2, 3, 2, 1, 2, 3, 3, 3, 1, 2]
            },
            {
                name: "Fernando Alonso",
                subtitle: "El Matador",
                description: "The complete package of experience, race craft and determination. Alonso adapts to any car or condition, with strategic intelligence and unmatched first-lap abilities.",
                image: "https://www.formula1.com/content/dam/fom-website/drivers/F/FERALO01_Fernando_Alonso/feralo01.png.transform/2col/image.png",
                affinities: [3, 2, 1, 2, 1, 2, 2, 2, 0, 3]
            },
            {
                name: "Carlos Sainz",
                subtitle: "The Smooth Operator",
                description: "Intelligent, consistent and technically astute. Sainz brings a methodical approach to racing with excellent adaptability and race pace, regardless of conditions.",
                image: "https://www.formula1.com/content/dam/fom-website/drivers/C/CARSAI01_Carlos_Sainz/carsai01.png.transform/2col/image.png",
                affinities: [1, 2, 1, 3, 2, 1, 2, 2, 2, 2]
            },
            {
                name: "George Russell",
                subtitle: "Mr. Saturday",
                description: "Combines raw speed with analytical thinking. Russell excels in qualifying and brings a meticulous, engineering-focused approach to his driving with excellent technical feedback.",
                image: "https://www.formula1.com/content/dam/fom-website/drivers/G/GEORUS01_George_Russell/georus01.png.transform/2col/image.png",
                affinities: [2, 3, 0, 1, 1, 2, 2, 1, 1, 1]
            },
            {
                name: "Oscar Piastri",
                subtitle: "The Rookie Sensation",
                description: "Calm, composed and remarkably consistent. Piastri combines a methodical approach with natural speed and excellent race craft beyond his years.",
                image: "https://www.formula1.com/content/dam/fom-website/drivers/O/OSCPIA01_Oscar_Piastri/oscpia01.png.transform/2col/image.png",
                affinities: [1, 2, 1, 1, 2, 3, 3, 2, 1, 2]
            },
            {
                name: "Alexander Albon",
                subtitle: "The Comeback Kid",
                description: "Resilient, technically adept and intelligent. Albon excels at extracting maximum performance from limited resources with excellent race craft and consistency.",
                image: "https://www.formula1.com/content/dam/fom-website/drivers/A/ALEALB01_Alexander_Albon/alealb01.png.transform/2col/image.png",
                affinities: [3, 1, 2, 3, 2, 2, 2, 2, 2, 3]
            },
            {
                name: "Sergio Perez",
                subtitle: "The Tire Whisperer",
                description: "Master of tire management and race strategy. Perez combines intelligent racing with a team-focused approach and exceptional skill in preserving his equipment.",
                image: "https://www.formula1.com/content/dam/fom-website/drivers/S/SERPER01_Sergio_Perez/serper01.png.transform/2col/image.png",
                affinities: [1, 2, 0, 3, 2, 1, 0, 1, 2, 3]
            }
        ]
    };

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

    // Quiz State
    let currentQuestionIndex = 0;
    let userAnswers = [];

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
});