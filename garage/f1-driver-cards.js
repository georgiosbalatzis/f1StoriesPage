// F1 Driver Cards Script - Updated with external JSON and standings tables
document.addEventListener('DOMContentLoaded', function() {
    console.log("F1 Driver Cards - Starting initialization");

    // Variables to store team data
    let enhancedTeamData = {};
    let driverStandings = [];
    let teamStandings = [];

    // Ensure CSS is loaded
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'f1-driver-cards.css';
    document.head.appendChild(cssLink);

    // Load team data from JSON file
    fetch('f1-teams-data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load team data');
            }
            return response.json();
        })
        .then(data => {
            // Extract standings data
            driverStandings = data.standings.drivers;
            teamStandings = data.standings.teams;

            // Remove standings from team data
            const {standings, ...teamsOnly} = data;
            enhancedTeamData = teamsOnly;

            console.log("Team data loaded successfully");
            init();
        })
        .catch(error => {
            console.error("Error loading team data:", error);
            // Fall back to built-in standings if JSON can't be loaded
            displayStandingsTables();
        });

    // Initialize after data is loaded
    function init() {
        // Check if a team is already selected
        const activeTeamBadge = document.querySelector('.team-badge.active');
        if (activeTeamBadge) {
            // Team is selected, show team details
            setTimeout(insertDriverCards, 500);
        } else {
            // No team selected, show standings tables
            displayStandingsTables();
        }

        // Add event listeners to team badges
        addTeamBadgeListeners();

        // Add observer to detect model changes
        setupModelChangeDetection();

        // Add reset button
        addResetButton();
    }

    // Function to find driver points from standings
    function findDriverPoints(driverName) {
        if (!driverStandings || driverStandings.length === 0) return '0';

        // Find driver in standings
        const driver = driverStandings.find(d => d.driver === driverName);
        return driver ? driver.points : '0';
    }

    // Function to create driver cards HTML for a team
    function createDriverCardsHTML(teamId) {
        if (!enhancedTeamData[teamId]) {
            console.error("Team data not found for:", teamId);
            return '';
        }

        const teamInfo = enhancedTeamData[teamId];

        // Create drivers section HTML
        let driversHtml = `
            <div class="info-section driver-section">
                <h4 class="section-title">2025 Driver Lineup</h4>
                <div class="drivers-grid">
        `;

        // Add each driver with headshot image
        teamInfo.drivers.forEach(driver => {
            driversHtml += `
                <div class="driver-card">
                    <div class="driver-info">
                        <div class="driver-name">${driver.name}</div>
                        <div class="driver-details">
                            <div><span class="driver-label">Nationality:</span>${driver.nationality}</div>
                            <div><span class="driver-label">Age:</span>${driver.age}</div>
                        </div>
                            <div class="driver-stats">
                            <div class="driver-stats-row">
                                <div class="driver-position">
                                    <span class="driver-label">Position:</span>
                                    <span class="driver-position-number">${driver.position}</span>
                                </div>
                                <div class="driver-points">
                                    <span class="driver-label">Points:</span>
                                    <span class="driver-points-number">${findDriverPoints(driver.name) || '0'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="driver-number-container">
                        <div class="driver-number">${driver.number}</div>
                    </div>
                    <img src="https://r2.blaineharper.com/def/f1_headshot_trans/f1/drivers/${driver.id}/2025/headshot_trans.webp" 
                         alt="${driver.name}" 
                         class="driver-image"
                         onerror="this.style.display='none'"
                    />
                </div>
            `;
        });

        driversHtml += `
                </div>
            </div>
        `;

        // Create constructor info section with championship position and car icon
        const constructor = teamInfo.constructor;

        let constructorHtml = `
            <div class="info-section constructor-section">
                <div class="constructor-header">
                    <h4 class="section-title">Constructor Information</h4>
                    <div class="constructor-championship">
                        <div class="championship-position">${constructor.championshipPosition}</div>
                        <div class="championship-points">${constructor.points} POINTS</div>
                    </div>
                </div>
                
                <div class="constructor-info-container">
                    <div class="info-grid">
                        <div class="info-card">
                            <div class="info-label">Official Name</div>
                            <div class="info-value">${constructor.name}</div>
                        </div>
                        <div class="info-card">
                            <div class="info-label">Team Principal</div>
                            <div class="info-value">${constructor.principal}</div>
                        </div>
                        <div class="info-card">
                            <div class="info-label">Base</div>
                            <div class="info-value">${constructor.base}</div>
                        </div>
                        <div class="info-card">
                            <div class="info-label">First F1 Season</div>
                            <div class="info-value">${constructor.firstSeason}</div>
                        </div>
                        <div class="info-card">
                            <div class="info-label">Power Unit</div>
                            <div class="info-value">${constructor.powerUnit}</div>
                        </div>
                        <div class="info-card">
                            <div class="info-label">Chassis</div>
                            <div class="info-value">${constructor.chassis} <i class="fas fa-car-side car-icon"></i></div>
                        </div>
                    </div>
                </div>
                
                <div class="car-image-container">
                    <img src="data/${teamId}-car.webp" 
                         alt="${constructor.name} car" 
                         class="car-image" 
                         onerror="this.onerror=null; this.src='data/${teamId}-car.webp'; this.onerror=function(){this.parentNode.innerHTML = '<div class=\\'car-image-fallback\\'><i class=\\'fas fa-car-side\\'></i></div>'}"
                    >
                </div>
            </div>
        `;

        // Extract tech specs from the page and reformat them
        const techSpecs = extractTechSpecs();
        let techSpecsHtml = '';

        if (techSpecs && techSpecs.length > 0) {
            techSpecsHtml = `
                <div class="info-section tech-section">
                    <h4 class="section-title">Technical Specifications</h4>
                    <div class="info-grid">
            `;

            // Filter out the "Drivers" spec if it exists
            const filteredSpecs = techSpecs.filter(spec => spec.title !== "Drivers");

            filteredSpecs.forEach(spec => {
                techSpecsHtml += `
                    <div class="info-card">
                        <div class="info-label">${spec.title}</div>
                        <div class="info-value">${spec.value}</div>
                    </div>
                `;
            });

            techSpecsHtml += `
                    </div>
                </div>
            `;
        }

        // Add reset button
        let resetButtonHtml = `
            <div class="reset-button-container">
                <button id="reset-team-button" class="reset-team-button">
                    <i class="fas fa-home"></i> Return to Standings
                </button>
            </div>
        `;

        return resetButtonHtml + driversHtml + constructorHtml + techSpecsHtml;
    }

    // Function to create standings tables HTML
    function createStandingsTablesHTML() {
        let html = `
            <div class="info-section instructions-section">
                <h4 class="section-title">Select a Team</h4>
                <p class="instructions-text">
                    Click on any team badge above to view detailed information about the team, 
                    including driver details, constructor information, and technical specifications.
                </p>
                <div class="team-badges-preview">
                    ${createTeamBadgesPreview()}
                </div>
            </div>
            
            <div class="info-section standings-section">
                <h4 class="section-title">2025 Constructor Standings</h4>
                <div class="standings-table-container">
                    <table class="standings-table constructor-standings">
                        <thead>
                            <tr>
                                <th>Pos</th>
                                <th>Team</th>
                                <th>Points</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        // Add constructor standings rows
        teamStandings.forEach(team => {
            html += `
                <tr>
                    <td>${team.position}</td>
                    <td>${team.team}</td>
                    <td>${team.points}</td>
                </tr>
            `;
        });

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div class="info-section standings-section">
                <h4 class="section-title">2025 Driver Standings</h4>
                <div class="standings-table-container">
                    <table class="standings-table driver-standings">
                        <thead>
                            <tr>
                                <th>Pos</th>
                                <th>Driver</th>
                                <th>Team</th>
                                <th>Points</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        // Add driver standings rows
        driverStandings.forEach(driver => {
            html += `
                <tr>
                    <td>${driver.position}</td>
                    <td>${driver.driver}</td>
                    <td>${driver.team}</td>
                    <td>${driver.points}</td>
                </tr>
            `;
        });

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        return html;
    }

    // Function to create a preview of team badges
    function createTeamBadgesPreview() {
        // This is just a visual helper for users
        return `
            <div class="team-badges-preview-container">
                <i class="fas fa-arrow-up pulse-animation"></i>
                <p>Select a team badge from above to view details</p>
            </div>
        `;
    }

    // Function to extract technical specifications from the existing page
    function extractTechSpecs() {
        const specs = [];
        const specItems = document.querySelectorAll('.spec-item');

        if (specItems.length === 0) {
            return null;
        }

        specItems.forEach(item => {
            const titleEl = item.querySelector('.spec-title');
            const valueEl = item.querySelector('.spec-value');

            if (titleEl && valueEl) {
                specs.push({
                    title: titleEl.textContent,
                    value: valueEl.textContent
                });
            }
        });

        return specs;
    }

    // Function to display standings tables
    function displayStandingsTables() {
        console.log("Displaying standings tables");

        // Find the team car info element
        const teamCarInfo = document.getElementById('team-car-info');
        if (!teamCarInfo) {
            console.error("Team car info element not found");
            return;
        }

        // Clear existing content
        teamCarInfo.innerHTML = '';

        // Generate standings tables HTML
        const tablesHTML = createStandingsTablesHTML();

        // Insert the tables
        teamCarInfo.innerHTML = tablesHTML;

        // Update model container to show "no model selected" state
        updateModelContainerState(true);

        console.log("Successfully displayed standings tables");
    }

    // Function to update model container visibility
    function updateModelContainerState(showNotSelected) {
        const modelContainer = document.querySelector('.model-container');
        if (!modelContainer) return;

        const modelNotSelected = modelContainer.querySelector('.model-not-selected');
        const loadingSpinner = modelContainer.querySelector('.loading-spinner');

        if (showNotSelected) {
            // Show "not selected" state
            if (modelNotSelected) modelNotSelected.style.display = 'block';
            if (loadingSpinner) loadingSpinner.style.display = 'none';

            // Hide all model frames
            const modelFrames = modelContainer.querySelectorAll('.model-frame');
            modelFrames.forEach(frame => {
                frame.classList.remove('visible');
            });
        }
    }

    // Function to insert driver cards
    function insertDriverCards() {
        console.log("Attempting to insert driver cards");

        // Try to find the active team
        const activeTeamBadge = document.querySelector('.team-badge.active');
        if (!activeTeamBadge) {
            console.log("No active team badge found");
            return;
        }

        const teamId = activeTeamBadge.getAttribute('data-team');
        if (!teamId) {
            console.log("No team ID found on active badge");
            return;
        }

        console.log("Found active team:", teamId);

        // Find the team car info element
        const teamCarInfo = document.getElementById('team-car-info');
        if (!teamCarInfo) {
            console.log("Team car info element not found");
            return;
        }

        // Save the related articles section before modifying the DOM
        const relatedArticles = teamCarInfo.querySelector('#related-articles');

        // Check if enhanced content already exists
        if (teamCarInfo.querySelector('.driver-section')) {
            console.log("Enhanced content already exists, will remove and rebuild");
            // Remove existing driver section
            const driverSection = teamCarInfo.querySelector('.driver-section');
            if (driverSection) driverSection.remove();

            // Remove existing constructor section
            const constructorSection = teamCarInfo.querySelector('.constructor-section');
            if (constructorSection) constructorSection.remove();

            // Remove existing tech section
            const techSection = teamCarInfo.querySelector('.tech-section');
            if (techSection) techSection.remove();

            // Remove reset button
            const resetButton = teamCarInfo.querySelector('.reset-button-container');
            if (resetButton) resetButton.remove();
        }

        // Generate enhanced content HTML
        const enhancedHTML = createDriverCardsHTML(teamId);

        // Clear team car info and add new content
        teamCarInfo.innerHTML = enhancedHTML;

        // Re-append the related articles section if it existed
        if (relatedArticles) {
            teamCarInfo.appendChild(relatedArticles);
        }

        // Add click event to reset button
        const resetButton = document.getElementById('reset-team-button');
        if (resetButton) {
            resetButton.addEventListener('click', resetTeamSelection);
        }

        console.log("Successfully inserted enhanced content");
    }

    // Function to reset team selection
    function resetTeamSelection(event) {
        // Prevent the default anchor behavior
        if (event) event.preventDefault();

        console.log("Resetting team selection");

        // Remove active class from all team badges
        const teamBadges = document.querySelectorAll('.team-badge');
        teamBadges.forEach(badge => {
            badge.classList.remove('active');
        });

        // Reset background color scheme
        resetTeamColorScheme();

        // Display standings tables
        displayStandingsTables();
    }

    // Function to reset team color scheme (copied from original script)
    function resetTeamColorScheme() {
        // Remove all team color classes from body
        document.body.classList.remove(
            'team-alpine',
            'team-mercedes',
            'team-redbull',
            'team-aston',
            'team-williams',
            'team-mclaren',
            'team-ferrari',
            'team-sauber',
            'team-racing-bulls',
            'team-haas'
        );

        // Reset hero background if it exists
        const heroElement = document.getElementById('hero');
        const heroOverlay = document.querySelector('.hero-overlay');

        if (heroElement && heroOverlay) {
            // Remove background image
            heroOverlay.classList.remove('image-bg');
            heroOverlay.style.backgroundImage = 'url("data/default.webp")';

            // Remove team background class
            heroElement.classList.remove('has-team-bg');
        }
    }

    // Function to add reset button to the model view
    function addResetButton() {
        // Check if button already exists
        if (document.getElementById('reset-team-button')) return;

        // Find the team car info element
        const teamCarInfo = document.getElementById('team-car-info');
        if (!teamCarInfo) return;

        // Create button element
        const resetButtonContainer = document.createElement('div');
        resetButtonContainer.className = 'reset-button-container';
        resetButtonContainer.innerHTML = `
            <button id="reset-team-button" class="reset-team-button">
                <i class="fas fa-home"></i> Return to Standings
            </button>
        `;

        // Add event listener
        const resetButton = resetButtonContainer.querySelector('#reset-team-button');
        resetButton.addEventListener('click', resetTeamSelection);

        // Add to page if a team is selected
        const activeTeamBadge = document.querySelector('.team-badge.active');
        if (activeTeamBadge) {
            // Insert at beginning of team car info
            teamCarInfo.insertBefore(resetButtonContainer, teamCarInfo.firstChild);
        }
    }

    // Function to add event listeners to team badges
    function addTeamBadgeListeners() {
        const teamBadges = document.querySelectorAll('.team-badge');
        teamBadges.forEach(badge => {
            badge.addEventListener('click', function () {
                const teamId = this.getAttribute('data-team');
                if (teamId) {
                    console.log("Team badge clicked:", teamId);

                    // Check if data is loaded
                    if (Object.keys(enhancedTeamData).length === 0) {
                        console.log("Team data not yet loaded, displaying standings");
                        displayStandingsTables();
                        return;
                    }

                    // Wait for the original click handler to finish
                    setTimeout(() => {
                        // Insert driver cards
                        insertDriverCards();

                        // Add reset button if it doesn't exist
                        addResetButton();
                    }, 1500);
                }
            });
        });
    }

    // Function to setup observer for model changes
    function setupModelChangeDetection() {
        const modelContainer = document.querySelector('.model-container');
        if (modelContainer) {
            const observer = new MutationObserver((mutations) => {
                console.log("Mutation observed in model container");

                // Check if data is loaded
                if (Object.keys(enhancedTeamData).length === 0) {
                    console.log("Team data not yet loaded, displaying standings");
                    return;
                }

                setTimeout(() => {
                    // Check if a team is selected
                    const activeTeamBadge = document.querySelector('.team-badge.active');
                    if (activeTeamBadge) {
                        // A team is selected, show team details
                        insertDriverCards();

                        // Add reset button if it doesn't exist
                        addResetButton();
                    }
                }, 1500);
            });

            observer.observe(modelContainer, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class']
            });
        }
    }

    // Add CSS for standings tables and reset button
    function addStandingsCSS() {
        // Check if styles already exist
        if (document.getElementById('f1-standings-css')) return;

        const styles = `
            <style id="f1-standings-css">
                /* Standings Tables */
                .standings-section {
                    padding: 1.5rem;
                }
                
                .standings-table-container {
                    overflow-x: auto;
                    margin-top: 1rem;
                }
                
                .standings-table {
                    width: 100%;
                    border-collapse: collapse;
                    color: #ffffff;
                    min-width: 500px;
                }
                
                .standings-table th,
                .standings-table td {
                    padding: 0.8rem 1rem;
                    text-align: left;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }
                
                .standings-table th {
                    background: rgba(0, 0, 0, 0.4);
                    color: var(--highlight-color, #00ffff);
                    font-weight: 600;
                    position: sticky;
                    top: 0;
                    z-index: 10;
                }
                
                .standings-table tr:nth-child(even) {
                    background: rgba(255, 255, 255, 0.03);
                }
                
                .standings-table tr:hover {
                    background: rgba(0, 115, 230, 0.1);
                }
                
                /* First 3 positions highlighted */
                .standings-table tbody tr:nth-child(1) td:first-child {
                    color: gold;
                    font-weight: bold;
                }
                
                .standings-table tbody tr:nth-child(2) td:first-child {
                    color: silver;
                    font-weight: bold;
                }
                
                .standings-table tbody tr:nth-child(3) td:first-child {
                    color: #cd7f32;
                    font-weight: bold;
                }
                
                /* Instructions Section */
                .instructions-section {
                    text-align: center;
                    padding: 2rem;
                }
                
                .instructions-text {
                    margin-bottom: 2rem;
                    font-size: 1.1rem;
                    color: #ccc;
                    line-height: 1.6;
                }
                
                .team-badges-preview {
                    margin-top: 2rem;
                }
                
                .team-badges-preview-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1rem;
                }
                
                .pulse-animation {
                    font-size: 2rem;
                    color: var(--highlight-color, #00ffff);
                    animation: pulse 2s infinite;
                }
                
                @keyframes pulse {
                    0% { transform: translateY(0); opacity: 0.7; }
                    50% { transform: translateY(-10px); opacity: 1; }
                    100% { transform: translateY(0); opacity: 0.7; }
                }
                
                /* Reset Button Styling */
                .reset-button-container {
                    display: flex;
                    justify-content: center;
                    margin: 1rem 0;
                }
                
                .reset-team-button {
                    background: rgba(0, 0, 0, 0.6);
                    color: white;
                    border: 1px solid var(--highlight-color, #00ffff);
                    padding: 0.8rem 1.5rem;
                    border-radius: 30px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                
                .reset-team-button:hover {
                    background: rgba(0, 115, 230, 0.2);
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
                }
                
                .reset-team-button i {
                    font-size: 1.1rem;
                }
                
                /* Mobile responsiveness */
                @media (max-width: 767px) {
                    .standings-table {
                        min-width: 400px;
                    }
                    
                    .standings-table th,
                    .standings-table td {
                        padding: 0.6rem 0.8rem;
                        font-size: 0.9rem;
                    }
                    
                    .instructions-text {
                        font-size: 1rem;
                    }
                }
                
                @media (max-width: 480px) {
                    .standings-table {
                        min-width: 350px;
                    }
                    
                    .standings-table th,
                    .standings-table td {
                        padding: 0.5rem 0.6rem;
                        font-size: 0.8rem;
                    }
                    
                    .reset-team-button {
                        padding: 0.6rem 1.2rem;
                        font-size: 0.9rem;
                    }
                }
            </style>
        `;

        // Add styles to head
        document.head.insertAdjacentHTML('beforeend', styles);
    }

    // Add standings CSS
    addStandingsCSS();

    // Expose global functions
    window.insertF1DriverCards = insertDriverCards;
    window.resetTeamSelection = resetTeamSelection;
    window.displayStandingsTables = displayStandingsTables;

    console.log("F1 Driver Cards - Initialization pending data load");
});