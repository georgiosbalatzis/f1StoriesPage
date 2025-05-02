// F1 Driver Cards with Car Images - Final Version
document.addEventListener('DOMContentLoaded', function() {
    console.log("F1 Driver Cards - Starting initialization");

    // Enhanced team data with driver information and constructor standings
    const enhancedTeamData = {
        williams: {
            drivers: [
                {
                    name: "Alex Albon",
                    number: "23",
                    id: "albon",
                    nationality: "Thai-British",
                    age: "29",
                    points: "20",
                    position: "8th"
                },
                {
                    name: "Carlos Sainz",
                    number: "55",
                    id: "sainz",
                    nationality: "Spanish",
                    age: "31",
                    points: "5",
                    position: "15th"
                }
            ],
            constructor: {
                name: "Williams Grand Prix Engineering",
                principal: "James Vowles",
                base: "Grove, United Kingdom",
                firstSeason: "1977",
                championshipPosition: "4th",
                points: "78",
                powerUnit: "Mercedes-AMG F1 M14",
                chassis: "FW47",
                carImage: "data/williams-car.png" // Path to car image
            }
        },
        mercedes: {
            drivers: [
                {
                    name: "George Russell",
                    number: "63",
                    id: "russell",
                    nationality: "British",
                    age: "27",
                    points: "73",
                    position: "4th"
                },
                {
                    name: "Andrea Kimi Antonelli",
                    number: "87",
                    id: "antonelli",
                    nationality: "Italian",
                    age: "19",
                    points: "38",
                    position: "6th"
                }
            ],
            constructor: {
                name: "Mercedes-AMG Petronas Formula One Team",
                principal: "Toto Wolff",
                base: "Brackley, United Kingdom",
                firstSeason: "1954 (returned in 2010)",
                championshipPosition: "3rd",
                points: "89",
                powerUnit: "Mercedes-AMG F1 M14",
                chassis: "W16",
                carImage: "data/mercedes-car.png"
            }
        },
        redbull: {
            drivers: [
                {
                    name: "Max Verstappen",
                    number: "1",
                    id: "max_verstappen",
                    nationality: "Dutch",
                    age: "28",
                    points: "87",
                    position: "3rd"
                },
                {
                    name: "Yuki Tsunoda",
                    number: "22",
                    id: "tsunoda",
                    nationality: "Japanese",
                    age: "25",
                    points: "5",
                    position: "16th"
                }
            ],
            constructor: {
                name: "Red Bull Racing Honda RBPT",
                principal: "Christian Horner",
                base: "Milton Keynes, United Kingdom",
                firstSeason: "2005",
                championshipPosition: "2nd",
                points: "111",
                powerUnit: "Honda RBPT H003",
                chassis: "RB21",
                carImage: "data/redbull-car.png"
            }
        },
        ferrari: {
            drivers: [
                {
                    name: "Charles Leclerc",
                    number: "16",
                    id: "leclerc",
                    nationality: "Monegasque",
                    age: "28",
                    points: "47",
                    position: "5th"
                },
                {
                    name: "Lewis Hamilton",
                    number: "44",
                    id: "hamilton",
                    nationality: "British",
                    age: "40",
                    points: "31",
                    position: "7th"
                }
            ],
            constructor: {
                name: "Scuderia Ferrari",
                principal: "Frédéric Vasseur",
                base: "Maranello, Italy",
                firstSeason: "1950",
                championshipPosition: "5th",
                points: "25",
                powerUnit: "Ferrari 068/9",
                chassis: "SF-25",
                carImage: "data/ferrari-car.png"
            }
        },
        mclaren: {
            drivers: [
                {
                    name: "Lando Norris",
                    number: "4",
                    id: "norris",
                    nationality: "British",
                    age: "26",
                    points: "89",
                    position: "2nd"
                },
                {
                    name: "Oscar Piastri",
                    number: "81",
                    id: "piastri",
                    nationality: "Australian",
                    age: "24",
                    points: "99",
                    position: "1st"
                }
            ],
            constructor: {
                name: "McLaren Formula 1 Team",
                principal: "Andrea Stella",
                base: "Woking, United Kingdom",
                firstSeason: "1966",
                championshipPosition: "1st",
                points: "188",
                powerUnit: "Mercedes-AMG F1 M14",
                chassis: "MCL39",
                carImage: "data/mclaren-car.png"
            }
        },
        aston: {
            drivers: [
                {
                    name: "Fernando Alonso",
                    number: "14",
                    id: "alonso",
                    nationality: "Spanish",
                    age: "44",
                    points: "0",
                    position: "17th"
                },
                {
                    name: "Lance Stroll",
                    number: "18",
                    id: "stroll",
                    nationality: "Canadian",
                    age: "27",
                    points: "10",
                    position: "10th"
                }
            ],
            constructor: {
                name: "Aston Martin Aramco F1 Team",
                principal: "Mike Krack",
                base: "Silverstone, United Kingdom",
                firstSeason: "2021 (as Aston Martin)",
                championshipPosition: "7th",
                points: "10",
                powerUnit: "Mercedes-AMG F1 M14",
                chassis: "AMR25",
                carImage: "data/aston-car.png"
            }
        },
        alpine: {
            drivers: [
                {
                    name: "Pierre Gasly",
                    number: "10",
                    id: "gasly",
                    nationality: "French",
                    age: "29",
                    points: "6",
                    position: "11th"
                },
                {
                    name: "Jack Doohan",
                    number: "5",
                    id: "doohan",
                    nationality: "Australian",
                    age: "22",
                    points: "0",
                    position: "19th"
                }
            ],
            constructor: {
                name: "BWT Alpine F1 Team",
                principal: "Oliver Oakes",
                base: "Enstone, United Kingdom",
                firstSeason: "2021 (as Alpine)",
                championshipPosition: "8th",
                points: "8",
                powerUnit: "Renault E-Tech RE25",
                chassis: "A525",
                carImage: "data/alpine-car.png"
            }
        },
        haas: {
            drivers: [
                {
                    name: "Oliver Bearman",
                    number: "50",
                    id: "bearman",
                    nationality: "British",
                    age: "20",
                    points: "6",
                    position: "13th"
                },
                {
                    name: "Esteban Ocon",
                    number: "31",
                    id: "ocon",
                    nationality: "French",
                    age: "29",
                    points: "14",
                    position: "9th"
                }
            ],
            constructor: {
                name: "MoneyGram Haas F1 Team",
                principal: "Ayao Komatsu",
                base: "Kannapolis, United States",
                firstSeason: "2016",
                championshipPosition: "9th",
                points: "6",
                powerUnit: "Ferrari 068/9",
                chassis: "VF-25",
                carImage: "data/haas-car.png"
            }
        },
        sauber: {
            drivers: [
                {
                    name: "Nico Hulkenberg",
                    number: "27",
                    id: "hulkenberg",
                    nationality: "German",
                    age: "38",
                    points: "6",
                    position: "12th"
                },
                {
                    name: "Gabriel Bortoleto",
                    number: "96",
                    id: "bortoleto",
                    nationality: "Brazilian",
                    age: "21",
                    points: "0",
                    position: "20th"
                }
            ],
            constructor: {
                name: "Kick Sauber F1 Team",
                principal: "Alessandro Alunni Bravi",
                base: "Hinwil, Switzerland",
                firstSeason: "1993",
                championshipPosition: "10th",
                points: "6",
                powerUnit: "Ferrari 068/9",
                chassis: "C44",
                carImage: "data/sauber-car.png"
            }
        },
        "racing-bulls": {
            drivers: [
                {
                    name: "Liam Lawson",
                    number: "40",
                    id: "lawson",
                    nationality: "New Zealander",
                    age: "23",
                    points: "0",
                    position: "18th"
                },
                {
                    name: "Isack Hadjar",
                    number: "41",
                    id: "hadjar",
                    nationality: "French",
                    age: "20",
                    points: "5",
                    position: "14th"
                }
            ],
            constructor: {
                name: "Visa Cash App Racing Bulls Honda RBPT",
                principal: "Laurent Mekies",
                base: "Faenza, Italy",
                firstSeason: "2024 (as Racing Bulls)",
                championshipPosition: "6th",
                points: "20",
                powerUnit: "Honda RBPT H003",
                chassis: "VCARB01",
                carImage: "data/racing-bulls-car.png"
            }
        }
    };

    // Add refined CSS
    const driversCSS = `
    <style id="f1-drivers-css">
    /* Common section styling */
    .info-section {
        background: rgba(0, 0, 0, 0.5);
        padding: 1.8rem;
        border-radius: 10px;
        margin: 1.5rem 0;
        position: relative;
        border: 1px solid rgba(0, 115, 230, 0.1);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
    }
    
    .info-section::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 5px;
        background: linear-gradient(90deg, var(--primary-color, #0073e6), var(--highlight-color, #00ffff));
        background-size: 200% 100%;
        animation: gradientFlow 3s linear infinite;
    }
    
    .section-title {
        color: var(--highlight-color, #00ffff) !important;
        font-size: 1.5rem;
        margin-bottom: 1.2rem;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid rgba(0, 115, 230, 0.3);
        font-weight: bold;
    }
    
    /* Driver section styling */
    .drivers-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 2rem;
        margin-top: 1.5rem;
    }
    
    .driver-card {
        position: relative;
        background: rgba(20, 20, 40, 0.7);
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
        height: 170px; /* Increased height for more spacing */
        display: flex;
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        border: 1px solid rgba(0, 115, 230, 0.3);
    }
    
    .driver-card:hover {
        transform: translateY(-5px) scale(1.02);
        box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5);
        border-color: var(--highlight-color, #00ffff);
    }
    
    .driver-info {
        flex: 1;
        padding: 1.25rem;
        position: relative;
        z-index: 2;
    }
    
    .driver-name {
        font-size: 1.4rem;
        font-weight: bold;
        margin-bottom: 0.5rem;
        color: #ffffff;
    }
    
    .driver-number-container {
        position: absolute;
        right: 0;
        top: 0;
        height: 100%;
        width: 90px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        background: linear-gradient(90deg, rgba(20, 20, 40, 0.0), rgba(0, 115, 230, 0.2));
        border-left: 1px solid rgba(0, 115, 230, 0.1);
    }
    
    .driver-number {
        font-size: 2.8rem;
        font-weight: 800;
        color: var(--highlight-color, #00ffff);
        text-align: center;
        font-family: 'Formula1', 'Roboto', sans-serif;
        line-height: 1;
    }
    
    .driver-label {
        color: var(--highlight-color, #00ffff);
        font-weight: 500;
        margin-right: 0.5rem;
        display: inline-block;
        min-width: 90px;
    }
    
    .driver-details {
        font-size: 0.9rem;
        color: #ccc;
        line-height: 1.8;
    }
    
    .driver-stats {
        margin-top: 1.2rem;
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
    }
    
    .driver-position {
        font-size: 1.2rem;
        font-weight: bold;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .driver-position-number {
        background: rgba(0, 0, 0, 0.3);
        border-radius: 4px;
        padding: 0.3rem 0.8rem;
        color: #ffffff;
        display: inline-block;
    }
    
    .driver-points {
        font-size: 0.9rem;
        padding-left: 2.5rem;
        color: var(--highlight-color, #00ffff);
    }
    
    .driver-image {
        position: absolute;
        right: 65px;
        bottom: 0;
        height: 180px;
        z-index: 1;
        opacity: 0.7;
        transition: opacity 0.3s ease;
    }
    
    .driver-card:hover .driver-image {
        opacity: 1;
    }
    
    /* Constructor and Technical Info Styling */
    .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
    }
    
    .info-card {
        background: rgba(0, 0, 0, 0.3);
        padding: 1rem;
        border-radius: 8px;
        border-left: 3px solid var(--spec-border, #0073e6);
        transition: all 0.3s ease;
    }
    
    .info-card:hover {
        background: rgba(0, 115, 230, 0.1);
        transform: translateX(5px);
    }
    
    .info-label {
        font-size: 0.9rem;
        color: var(--highlight-color, #00ffff);
        margin-bottom: 0.25rem;
    }
    
    .info-value {
        font-size: 1rem;
        color: #fff;
        font-weight: 500;
    }
    
    /* Constructor section with car image */
    .constructor-section {
        position: relative;
        overflow: hidden;
        min-height: 320px;
    }
    
    .constructor-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 1.5rem;
        position: relative;
        z-index: 2;
    }
    
    .constructor-championship {
        background: rgba(0, 0, 0, 0.3);
        border-radius: 8px;
        padding: 0.8rem 1.2rem;
        text-align: center;
        min-width: 130px;
        border: 1px solid rgba(0, 115, 230, 0.2);
    }
    
    .championship-position {
        font-size: 1.8rem;
        font-weight: bold;
        color: var(--highlight-color, #00ffff);
        margin-bottom: 0.3rem;
    }
    
    .championship-points {
        font-size: 1rem;
        color: #fff;
    }
    
    .constructor-info-container {
        position: relative;
        z-index: 2;
        width: 60%;
    }
    
    .car-image-container {
        position: absolute;
        right: 0;
        bottom: 0;
        width: 40%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        z-index: 1;
        overflow: hidden;
    }
    
    .car-image {
        max-width: 100%;
        max-height: 85%;
        object-fit: contain;
        transform: perspective(800px) rotateY(-15deg);
        filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.5));
        transition: all 0.5s ease;
        opacity: 0.8;
    }
    
    .constructor-section:hover .car-image {
        transform: perspective(800px) rotateY(-8deg) translateX(-20px);
        opacity: 1;
    }
    
    /* If no car image is available, use a fallback */
    .car-image-fallback {
        width: 100%;
        height: 100%;
        background: linear-gradient(45deg, rgba(0, 0, 0, 0), rgba(var(--primary-color-rgb, 0, 115, 230), 0.1));
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 5rem;
        color: rgba(255, 255, 255, 0.1);
    }
    
    @keyframes gradientFlow {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
    }
    
    /* Responsive adjustments */
    @media (max-width: 991px) {
        .constructor-info-container {
            width: 100%;
        }
        
        .car-image-container {
            position: relative;
            width: 100%;
            height: 200px;
            margin-top: 2rem;
            justify-content: center;
        }
        
        .car-image {
            transform: none;
            max-height: 100%;
        }
        
        .constructor-section:hover .car-image {
            transform: translateY(-5px);
        }
    }
    
    @media (max-width: 767px) {
        .drivers-grid,
        .info-grid {
            grid-template-columns: 1fr;
        }
        
        .driver-card {
            height: 150px;
        }
        
        .driver-image {
            height: 150px;
            right: 50px;
        }
        
        .driver-number-container {
            width: 70px;
        }
        
        .driver-number {
            font-size: 2.2rem;
        }
        
        .constructor-header {
            flex-direction: column;
            gap: 1rem;
        }
        
        .constructor-championship {
            align-self: center;
        }
    }
    
    /* Fix for original specs */
    .car-specs {
        display: none;
    }
    
    h4:contains("Technical Specifications") {
        display: none;
    }
    </style>
    `;

    // Append CSS to head
    document.head.insertAdjacentHTML('beforeend', driversCSS);

    // Function to create a fallback car image container with team logo
    function createCarImageFallback(teamId) {
        return `
            <div class="car-image-fallback">
                <i class="fas fa-car-side"></i>
            </div>
        `;
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
                            <div class="driver-position">
                                <span class="driver-label">Position:</span>
                                <span class="driver-position-number">${driver.position}</span>
                            </div>
                            <div class="driver-points">${driver.points} points</div>
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

        // Create constructor info section with championship position and car image
        const constructor = teamInfo.constructor;
        const carImage = constructor.carImage ?
            `<img src="${constructor.carImage}" alt="${constructor.name} car" class="car-image" onerror="this.parentNode.innerHTML = '${createCarImageFallback(teamId)}'">` :
            createCarImageFallback(teamId);

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
                            <div class="info-value">${constructor.chassis}</div>
                        </div>
                    </div>
                </div>
                
                <div class="car-image-container">
                    ${carImage}
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

        return driversHtml + constructorHtml + techSpecsHtml;
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

        // Get the model title and description
        const modelTitle = teamCarInfo.querySelector('.model-title');
        const modelDescription = teamCarInfo.querySelector('.model-description');

        if (!modelTitle || !modelDescription) {
            console.log("Model title or description not found");
            return;
        }

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
        }

        // Generate enhanced content HTML
        const enhancedHTML = createDriverCardsHTML(teamId);

        // Hide old car-specs (we're keeping them in the DOM but hiding with CSS)
        const carSpecs = teamCarInfo.querySelector('.car-specs');
        if (carSpecs) {
            carSpecs.style.display = 'none';
        }

        // Find Technical Specifications header and hide it (we'll recreate it)
        const headers = teamCarInfo.querySelectorAll('h4');
        if (headers) {
            headers.forEach(header => {
                if (header.textContent.includes('Technical Specifications')) {
                    header.style.display = 'none';
                }
            });
        }

        // Insert the enhanced content after the description
        modelDescription.insertAdjacentHTML('afterend', enhancedHTML);

        console.log("Successfully inserted enhanced content");
    }

    // Continuation of the F1 Driver Cards with Car Images script
    // Wait for the page to load fully
    setTimeout(() => {
        console.log("Delayed initialization starting");
        insertDriverCards();

        // Add event listeners to team badges
        const teamBadges = document.querySelectorAll('.team-badge');
        teamBadges.forEach(badge => {
            badge.addEventListener('click', function() {
                console.log("Team badge clicked:", this.getAttribute('data-team'));
                // Wait for the original click handler to finish
                setTimeout(insertDriverCards, 1500);
            });
        });

        // Add an observer to detect when model changes
        const modelContainer = document.querySelector('.model-container');
        if (modelContainer) {
            const observer = new MutationObserver((mutations) => {
                console.log("Mutation observed in model container");
                setTimeout(insertDriverCards, 1500);
            });

            observer.observe(modelContainer, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class']
            });
        }
    }, 2000);

    // Function to dynamically create car images if none are provided
    function generateCarImage(teamId) {
        // Create a function to generate car images based on team ID
        // This is a fallback if actual car images aren't available

        // Get the active model frame to use as source for the car image
        const modelFrame = document.querySelector(`#${teamId}-model.model-frame.visible`);

        if (modelFrame) {
            // Try to take a screenshot or use the model as image source
            console.log("Could attempt to capture car model as image (not implemented)");
            return false; // Return false to use fallback icon
        }

        // If we couldn't generate an image, return false to use the fallback
        return false;
    }

    // Function to try to find car images from the site
    function findExistingCarImage(teamId) {
        // Check if there's a car image in the page content
        // This could be extended to look for team-specific images
        const heroSection = document.querySelector('.hero-overlay');
        if (heroSection && heroSection.style.backgroundImage) {
            console.log("Found hero image that could be used as car image");
            // Extract background image URL
            const bgImageUrl = heroSection.style.backgroundImage.replace(/url\(['"](.+)['"]\)/, '$1');
            if (bgImageUrl) return bgImageUrl;
        }

        return null;
    }

    // Expose a global function to manually insert driver cards
    window.insertF1DriverCards = insertDriverCards;

    // Function to get car image dynamically
    window.getCarImage = function(teamId) {
        // Try to find existing car image in the page
        const existingImage = findExistingCarImage(teamId);
        if (existingImage) return existingImage;

        // Try to generate a car image from the 3D model
        const generatedImage = generateCarImage(teamId);
        if (generatedImage) return generatedImage;

        // Fallback - try to construct a path based on site structure
        const possiblePaths = [
            `../images/${teamId}-car.png`,
            `../images/cars/${teamId}.png`,
            `data/${teamId}-car.webp`,
            `data/${teamId}.webp`
        ];

        // Return the first possible path (the actual check happens in the img tag with onerror)
        return possiblePaths[0];
    };

    // Add helper function to get team's primary color
    window.getTeamColor = function(teamId) {
        const teamColors = {
            'williams': '#0093EF',
            'mercedes': '#00A19C',
            'redbull': '#0600EF',
            'ferrari': '#F91536',
            'mclaren': '#FF8700',
            'aston': '#006F62',
            'alpine': '#0090FF',
            'haas': '#FFFFFF',
            'sauber': '#52E252',
            'racing-bulls': '#1E3FCC'
        };

        return teamColors[teamId] || '#00FFFF'; // Default to highlight color
    };

    console.log("F1 Driver Cards - Initialization complete");
});