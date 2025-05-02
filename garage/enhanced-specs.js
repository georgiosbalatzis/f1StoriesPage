// Enhanced F1 Team Data Integration Script - 2025 Season
document.addEventListener('DOMContentLoaded', function() {
    // Enhanced team data with driver information and constructor details
    const enhancedTeamData = {
        williams: {
            name: "Williams FW47",
            description: "The Williams FW47 represents a significant step forward for the team, featuring innovative aerodynamics and improved power unit integration. The team has focused on optimizing the car's performance in high-speed corners while maintaining stability in low-speed sections.",
            specs: [
                {title: "Power Unit", value: "Mercedes-AMG F1 M14"},
                {title: "ERS", value: "Mercedes-AMG HPP"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "372 km/h"},
                {title: "0-100 km/h", value: "2.6 seconds"},
                {title: "Team Principal", value: "James Vowles"},
                {title: "Constructor", value: "Williams Grand Prix Engineering"},
                {title: "Base", value: "Grove, United Kingdom"},
                {title: "First F1 Season", value: "1977"}
            ],
            drivers: [
                {
                    name: "Alex Albon",
                    number: "23",
                    nationality: "Thai-British",
                    age: "29"
                },
                {
                    name: "Carlos Sainz",
                    number: "55",
                    nationality: "Spanish",
                    age: "31"
                }
            ]
        },
        mercedes: {
            name: "Mercedes W16",
            description: "The Mercedes W16 continues the team's pursuit of aerodynamic excellence with significant upgrades to the floor and sidepod design. The power unit remains a class leader in both power and efficiency, while the suspension system has been completely redesigned for better mechanical grip.",
            specs: [
                {title: "Power Unit", value: "Mercedes-AMG F1 M14"},
                {title: "ERS", value: "Mercedes-AMG HPP"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "378 km/h"},
                {title: "0-100 km/h", value: "2.5 seconds"},
                {title: "Team Principal", value: "Toto Wolff"},
                {title: "Constructor", value: "Mercedes-AMG Petronas Formula One Team"},
                {title: "Base", value: "Brackley, United Kingdom"},
                {title: "First F1 Season", value: "1954 (returned in 2010)"}
            ],
            drivers: [
                {
                    name: "George Russell",
                    number: "63",
                    nationality: "British",
                    age: "27"
                },
                {
                    name: "Andrea Kimi Antonelli",
                    number: "87",
                    nationality: "Italian",
                    age: "19"
                }
            ]
        },
        redbull: {
            name: "Red Bull RB21",
            description: "The Red Bull RB21 evolves the successful concepts from previous seasons with refined aerodynamics and improved packaging. Adrian Newey's influence is evident in the intricate aero surfaces that maximize downforce while minimizing drag, making it formidable on all circuit types.",
            specs: [
                {title: "Power Unit", value: "Honda RBPT H003"},
                {title: "ERS", value: "Honda RBPT"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "375 km/h"},
                {title: "0-100 km/h", value: "2.4 seconds"},
                {title: "Team Principal", value: "Christian Horner"},
                {title: "Constructor", value: "Red Bull Racing Honda RBPT"},
                {title: "Base", value: "Milton Keynes, United Kingdom"},
                {title: "First F1 Season", value: "2005"}
            ],
            drivers: [
                {
                    name: "Max Verstappen",
                    number: "1",
                    nationality: "Dutch",
                    age: "28"
                },
                {
                    name: "Yuki Tsunoda",
                    number: "22",
                    nationality: "Japanese",
                    age: "25"
                }
            ]
        },
        ferrari: {
            name: "Ferrari SF-25",
            description: "The Ferrari SF-25 represents a new design philosophy for the Scuderia, with radical changes to the cooling system and bodywork. The power unit delivers exceptional driveability and peak performance, while the innovative suspension system provides excellent tire management.",
            specs: [
                {title: "Power Unit", value: "Ferrari 068/9"},
                {title: "ERS", value: "Ferrari"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "374 km/h"},
                {title: "0-100 km/h", value: "2.5 seconds"},
                {title: "Team Principal", value: "Frédéric Vasseur"},
                {title: "Constructor", value: "Scuderia Ferrari"},
                {title: "Base", value: "Maranello, Italy"},
                {title: "First F1 Season", value: "1950"}
            ],
            drivers: [
                {
                    name: "Charles Leclerc",
                    number: "16",
                    nationality: "Monegasque",
                    age: "28"
                },
                {
                    name: "Lewis Hamilton",
                    number: "44",
                    nationality: "British",
                    age: "40"
                }
            ]
        },
        mclaren: {
            name: "McLaren MCL39",
            description: "The McLaren MCL39 builds on the team's recent success with enhanced aerodynamic efficiency and mechanical grip. Technical Director James Key has focused on optimizing the floor and diffuser to generate maximum downforce with minimal drag, resulting in a versatile machine suited to all track types.",
            specs: [
                {title: "Power Unit", value: "Mercedes-AMG F1 M14"},
                {title: "ERS", value: "Mercedes-AMG HPP"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "376 km/h"},
                {title: "0-100 km/h", value: "2.5 seconds"},
                {title: "Team Principal", value: "Andrea Stella"},
                {title: "Constructor", value: "McLaren Formula 1 Team"},
                {title: "Base", value: "Woking, United Kingdom"},
                {title: "First F1 Season", value: "1966"}
            ],
            drivers: [
                {
                    name: "Lando Norris",
                    number: "4",
                    nationality: "British",
                    age: "26"
                },
                {
                    name: "Oscar Piastri",
                    number: "81",
                    nationality: "Australian",
                    age: "24"
                }
            ]
        },
        aston: {
            name: "Aston Martin AMR25",
            description: "The Aston Martin AMR25 showcases the team's growing technical capabilities with an aggressive design approach. The innovative front wing and nose cone work in harmony with the revised floor to create a consistent aerodynamic platform, while the Mercedes power unit provides excellent performance.",
            specs: [
                {title: "Power Unit", value: "Mercedes-AMG F1 M14"},
                {title: "ERS", value: "Mercedes-AMG HPP"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "371 km/h"},
                {title: "0-100 km/h", value: "2.6 seconds"},
                {title: "Team Principal", value: "Mike Krack"},
                {title: "Constructor", value: "Aston Martin Aramco F1 Team"},
                {title: "Base", value: "Silverstone, United Kingdom"},
                {title: "First F1 Season", value: "2021 (as Aston Martin)"}
            ],
            drivers: [
                {
                    name: "Fernando Alonso",
                    number: "14",
                    nationality: "Spanish",
                    age: "44"
                },
                {
                    name: "Lance Stroll",
                    number: "18",
                    nationality: "Canadian",
                    age: "27"
                }
            ]
        },
        alpine: {
            name: "Alpine A525",
            description: "The Alpine A525 represents a significant evolution in the team's design philosophy with dramatic changes to the sidepod and cooling systems. The revised Renault power unit delivers improved power and reliability, while the upgraded suspension enhances mechanical grip across various circuit conditions.",
            specs: [
                {title: "Power Unit", value: "Renault E-Tech RE25"},
                {title: "ERS", value: "Renault"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "370 km/h"},
                {title: "0-100 km/h", value: "2.6 seconds"},
                {title: "Team Principal", value: "Oliver Oakes"},
                {title: "Constructor", value: "BWT Alpine F1 Team"},
                {title: "Base", value: "Enstone, United Kingdom"},
                {title: "First F1 Season", value: "2021 (as Alpine)"}
            ],
            drivers: [
                {
                    name: "Pierre Gasly",
                    number: "10",
                    nationality: "French",
                    age: "29"
                },
                {
                    name: "Jack Doohan",
                    number: "5",
                    nationality: "Australian",
                    age: "22"
                }
            ]
        },
        haas: {
            name: "Haas VF-25",
            description: "The Haas VF-25 features a comprehensive redesign that addresses the team's previous weaknesses. The revised aerodynamic package offers improved performance across varying conditions, while the Ferrari power unit integration has been optimized to enhance cooling efficiency and overall reliability.",
            specs: [
                {title: "Power Unit", value: "Ferrari 068/9"},
                {title: "ERS", value: "Ferrari"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "369 km/h"},
                {title: "0-100 km/h", value: "2.7 seconds"},
                {title: "Team Principal", value: "Ayao Komatsu"},
                {title: "Constructor", value: "MoneyGram Haas F1 Team"},
                {title: "Base", value: "Kannapolis, United States"},
                {title: "First F1 Season", value: "2016"}
            ],
            drivers: [
                {
                    name: "Oliver Bearman",
                    number: "50",
                    nationality: "British",
                    age: "20"
                },
                {
                    name: "Esteban Ocon",
                    number: "31",
                    nationality: "French",
                    age: "29"
                }
            ]
        },
        sauber: {
            name: "Sauber C44",
            description: "The Sauber C44, the team's final car before transitioning to Audi, incorporates several innovative aerodynamic concepts. The revised floor and diffuser generate significant downforce, while the efficient packaging of the Ferrari power unit allows for aggressive bodywork solutions to minimize drag.",
            specs: [
                {title: "Power Unit", value: "Ferrari 068/9"},
                {title: "ERS", value: "Ferrari"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "368 km/h"},
                {title: "0-100 km/h", value: "2.7 seconds"},
                {title: "Team Principal", value: "Alessandro Alunni Bravi"},
                {title: "Constructor", value: "Kick Sauber F1 Team"},
                {title: "Base", value: "Hinwil, Switzerland"},
                {title: "First F1 Season", value: "1993"}
            ],
            drivers: [
                {
                    name: "Nico Hulkenberg",
                    number: "27",
                    nationality: "German",
                    age: "38"
                },
                {
                    name: "Gabriel Bortoleto",
                    number: "96",
                    nationality: "Brazilian",
                    age: "21"
                }
            ]
        },
        "racing-bulls": {
            name: "Racing Bulls VCARB01",
            description: "The Racing Bulls VCARB01 demonstrates the team's technical progress with innovative solutions throughout the car. The Honda power unit is packaged efficiently to allow for compact bodywork, while the redesigned suspension improves mechanical grip in both low and high-speed corners.",
            specs: [
                {title: "Power Unit", value: "Honda RBPT H003"},
                {title: "ERS", value: "Honda RBPT"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "370 km/h"},
                {title: "0-100 km/h", value: "2.6 seconds"},
                {title: "Team Principal", value: "Laurent Mekies"},
                {title: "Constructor", value: "Visa Cash App Racing Bulls Honda RBPT"},
                {title: "Base", value: "Faenza, Italy"},
                {title: "First F1 Season", value: "2024 (as Racing Bulls)"}
            ],
            drivers: [
                {
                    name: "Liam Lawson",
                    number: "40",
                    nationality: "New Zealander",
                    age: "23"
                },
                {
                    name: "Isack Hadjar",
                    number: "41",
                    nationality: "French",
                    age: "20"
                }
            ]
        }
    };

    // Enhanced styles to be added to the document
    const enhancedStyles = `
    /* Enhanced F1 Team Specs Styles */
    .driver-section {
        background: rgba(0, 10, 30, 0.6);
        padding: 1.5rem;
        border-radius: 10px;
        margin: 1rem 0 2rem;
        border-left: 3px solid var(--primary-color, #0073e6);
        transition: all 0.3s ease;
    }

    .driver-section:hover {
        background: rgba(0, 20, 40, 0.7);
        transform: translateY(-3px);
        box-shadow: 0 6px 15px rgba(0, 0, 0, 0.3);
    }

    .drivers-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1.5rem;
        margin-top: 1rem;
    }

    .driver-card {
        display: flex;
        background: rgba(0, 0, 0, 0.4);
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid rgba(0, 115, 230, 0.2);
        transition: all 0.3s ease;
    }

    .driver-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
        border-color: var(--primary-color, #0073e6);
    }

    .driver-number {
        width: 70px;
        background: rgba(0, 115, 230, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        font-weight: bold;
        color: var(--highlight-color, #00ffff);
    }

    .driver-info {
        flex: 1;
        padding: 1rem;
    }

    .driver-name {
        font-size: 1.2rem;
        font-weight: bold;
        margin-bottom: 0.25rem;
        color: #ffffff;
    }

    .driver-details {
        font-size: 0.9rem;
        color: #ccc;
    }

    .constructor-section {
        margin-top: 2rem;
        background: rgba(0, 0, 0, 0.4);
        border-radius: 10px;
        padding: 1.5rem;
        border: 1px solid rgba(0, 115, 230, 0.1);
    }

    .constructor-title {
        color: var(--highlight-color, #00ffff);
        font-size: 1.3rem;
        margin-bottom: 1rem;
        border-bottom: 1px solid rgba(0, 115, 230, 0.3);
        padding-bottom: 0.5rem;
    }

    .constructor-info {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
    }

    .info-card {
        background: rgba(0, 0, 0, 0.3);
        padding: 1rem;
        border-radius: 8px;
        border-left: 3px solid var(--spec-border, #0073e6);
    }

    .info-label {
        font-size: 0.9rem;
        color: #aaa;
        margin-bottom: 0.25rem;
    }

    .info-value {
        font-size: 1rem;
        color: #fff;
        font-weight: 500;
    }

    /* Responsive adjustments */
    @media (max-width: 767px) {
        .drivers-grid {
            grid-template-columns: 1fr;
        }
        
        .constructor-info {
            grid-template-columns: 1fr;
        }
    }
    `;

    // Function to add styles to document
    function addStyles() {
        const styleElement = document.createElement('style');
        styleElement.textContent = enhancedStyles;
        document.head.appendChild(styleElement);
    }

    // Add the styles to document
    addStyles();

    // Get the team car info element where we'll inject our enhanced content
    const teamCarInfo = document.getElementById('team-car-info');
    if (!teamCarInfo) return;

    // Function to update car info with enhanced content
    function updateCarInfo(teamId) {
        // Get team data from the enhanced data object
        const team = enhancedTeamData[teamId];
        if (!team) return;

        // Create specs HTML
        let specsHtml = '<div class="car-specs">';
        team.specs.forEach(spec => {
            specsHtml += `
                <div class="spec-item">
                    <div class="spec-title">${spec.title}</div>
                    <div class="spec-value">${spec.value}</div>
                </div>
            `;
        });
        specsHtml += '</div>';

        // Create drivers section HTML
        let driversHtml = `
            <div class="driver-section">
                <h4>2025 Driver Lineup</h4>
                <div class="drivers-grid">
        `;
        
        // Add each driver
        team.drivers.forEach(driver => {
            driversHtml += `
                <div class="driver-card">
                    <div class="driver-number">${driver.number}</div>
                    <div class="driver-info">
                        <div class="driver-name">${driver.name}</div>
                        <div class="driver-details">
                            <div>${driver.nationality}</div>
                            <div>Age: ${driver.age}</div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        driversHtml += `
                </div>
            </div>
        `;

        // Create constructor info section
        let constructorHtml = `
            <div class="constructor-section">
                <h4 class="constructor-title">Constructor Information</h4>
                <div class="constructor-info">
                    <div class="info-card">
                        <div class="info-label">Official Name</div>
                        <div class="info-value">${team.specs.find(spec => spec.title === "Constructor")?.value || 'N/A'}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">Team Principal</div>
                        <div class="info-value">${team.specs.find(spec => spec.title === "Team Principal")?.value || 'N/A'}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">Base</div>
                        <div class="info-value">${team.specs.find(spec => spec.title === "Base")?.value || 'N/A'}</div>
                    </div>
                    <div class="info-card">
                        <div class="info-label">First F1 Season</div>
                        <div class="info-value">${team.specs.find(spec => spec.title === "First F1 Season")?.value || 'N/A'}</div>
                    </div>
                </div>
            </div>
        `;

        // Update car info HTML
        teamCarInfo.innerHTML = `
            <h3 class="model-title">${team.name}</h3>
            <p class="model-description">${team.description}</p>
            ${driversHtml}
            <h4>Technical Specifications</h4>
            ${specsHtml}
            ${constructorHtml}
        `;
    }

    // Enhance the existing showModel function to update car info with our enhanced data
    const originalShowModel = window.showModel;
    if (typeof originalShowModel === 'function') {
        window.showModel = function(teamId) {
            // Call the original function first
            originalShowModel(teamId);
            
            // Then enhance the car info section
            setTimeout(() => {
                updateCarInfo(teamId);
            }, 1000); // Wait a bit after the original function completes
        };
    }

    // Add event listeners to team badges to use our enhanced function
    const teamBadges = document.querySelectorAll('.team-badge');
    teamBadges.forEach(badge => {
        const teamId = badge.getAttribute('data-team');
        if (teamId) {
            // Replace the original click handler
            badge.outerHTML = badge.outerHTML;
        }
    });

    // Re-attach event listeners after replacing HTML
    document.querySelectorAll('.team-badge').forEach(badge => {
        badge.addEventListener('click', function() {
            const teamId = this.getAttribute('data-team');
            if (teamId && typeof window.showModel === 'function') {
                window.showModel(teamId);
            }
        });
    });

    // Initialize with a team if one is already selected
    const activeTeamBadge = document.querySelector('.team-badge.active');
    if (activeTeamBadge) {
        const teamId = activeTeamBadge.getAttribute('data-team');
        if (teamId) {
            setTimeout(() => {
                updateCarInfo(teamId);
            }, 1000);
        }
    }
});
