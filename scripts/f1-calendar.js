// Improved F1 Calendar Implementation
document.addEventListener('DOMContentLoaded', function() {
    // F1 Calendar data for 2025 season
    const races = [
        {
            name: "Bahrain Grand Prix",
            circuit: "Bahrain International Circuit",
            date: new Date(2025, 2, 2), // March 2, 2025
            flag: "🇧🇭"
        },
        {
            name: "Saudi Arabian Grand Prix",
            circuit: "Jeddah Corniche Circuit",
            date: new Date(2025, 2, 9), // March 9, 2025
            flag: "🇸🇦"
        },
        {
            name: "Australian Grand Prix",
            circuit: "Albert Park Circuit",
            date: new Date(2025, 2, 23), // March 23, 2025
            flag: "🇦🇺"
        },
        {
            name: "Japanese Grand Prix",
            circuit: "Suzuka International Racing Course",
            date: new Date(2025, 3, 6), // April 6, 2025
            flag: "🇯🇵"
        },
        {
            name: "Chinese Grand Prix",
            circuit: "Shanghai International Circuit",
            date: new Date(2025, 3, 20), // April 20, 2025
            flag: "🇨🇳"
        },
        {
            name: "Miami Grand Prix",
            circuit: "Miami International Autodrome",
            date: new Date(2025, 4, 4), // May 4, 2025
            flag: "🇺🇸"
        },
        {
            name: "Emilia Romagna Grand Prix",
            circuit: "Autodromo Enzo e Dino Ferrari",
            date: new Date(2025, 4, 18), // May 18, 2025
            flag: "🇮🇹"
        },
        {
            name: "Monaco Grand Prix",
            circuit: "Circuit de Monaco",
            date: new Date(2025, 5, 1), // June 1, 2025
            flag: "🇲🇨"
        },
        {
            name: "Canadian Grand Prix",
            circuit: "Circuit Gilles Villeneuve",
            date: new Date(2025, 5, 15), // June 15, 2025
            flag: "🇨🇦"
        },
        {
            name: "Spanish Grand Prix",
            circuit: "Circuit de Barcelona-Catalunya",
            date: new Date(2025, 5, 29), // June 29, 2025
            flag: "🇪🇸"
        },
        {
            name: "Austrian Grand Prix",
            circuit: "Red Bull Ring",
            date: new Date(2025, 6, 13), // July 13, 2025
            flag: "🇦🇹"
        },
        {
            name: "British Grand Prix",
            circuit: "Silverstone Circuit",
            date: new Date(2025, 6, 27), // July 27, 2025
            flag: "🇬🇧"
        },
        {
            name: "Hungarian Grand Prix",
            circuit: "Hungaroring",
            date: new Date(2025, 7, 3), // August 3, 2025
            flag: "🇭🇺"
        },
        {
            name: "Belgian Grand Prix",
            circuit: "Circuit de Spa-Francorchamps",
            date: new Date(2025, 7, 31), // August 31, 2025
            flag: "🇧🇪"
        },
        {
            name: "Dutch Grand Prix",
            circuit: "Circuit Zandvoort",
            date: new Date(2025, 8, 7), // September 7, 2025
            flag: "🇳🇱"
        },
        {
            name: "Italian Grand Prix",
            circuit: "Autodromo Nazionale Monza",
            date: new Date(2025, 8, 14), // September 14, 2025
            flag: "🇮🇹"
        },
        {
            name: "Azerbaijan Grand Prix",
            circuit: "Baku City Circuit",
            date: new Date(2025, 8, 28), // September 28, 2025
            flag: "🇦🇿"
        },
        {
            name: "Singapore Grand Prix",
            circuit: "Marina Bay Street Circuit",
            date: new Date(2025, 9, 5), // October 5, 2025
            flag: "🇸🇬"
        },
        {
            name: "United States Grand Prix",
            circuit: "Circuit of the Americas",
            date: new Date(2025, 9, 19), // October 19, 2025
            flag: "🇺🇸"
        },
        {
            name: "Mexican Grand Prix",
            circuit: "Autódromo Hermanos Rodríguez",
            date: new Date(2025, 10, 2), // November 2, 2025
            flag: "🇲🇽"
        },
        {
            name: "Brazilian Grand Prix",
            circuit: "Autódromo José Carlos Pace",
            date: new Date(2025, 10, 16), // November 16, 2025
            flag: "🇧🇷"
        },
        {
            name: "Las Vegas Grand Prix",
            circuit: "Las Vegas Strip Circuit",
            date: new Date(2025, 10, 30), // November 30, 2025
            flag: "🇺🇸"
        },
        {
            name: "Qatar Grand Prix",
            circuit: "Lusail International Circuit",
            date: new Date(2025, 11, 7), // December 7, 2025
            flag: "🇶🇦"
        },
        {
            name: "Abu Dhabi Grand Prix",
            circuit: "Yas Marina Circuit",
            date: new Date(2025, 11, 14), // December 14, 2025
            flag: "🇦🇪"
        }
    ];

    // Variables to track state
    let showingPastRaces = false;
    let nextRaceIndex = -1;

    // Helper function to format date to display the month in text format
    function formatDate(date) {
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const month = months[date.getMonth()];
        const day = date.getDate();
        return { month, day };
    }

    // Function to determine which race is next
    function determineNextRace() {
        const now = new Date();

        // Loop through races to find the next one
        for (let i = 0; i < races.length; i++) {
            // If this race is in the future, it's the next one
            if (races[i].date > now) {
                // Set status for all races
                races.forEach((race, index) => {
                    if (index < i) {
                        race.status = "completed";
                    } else if (index === i) {
                        race.status = "next";
                    } else {
                        race.status = "upcoming";
                    }
                });

                return i; // Return the index of the next race
            }
        }

        // If all races are in the past, just mark them all as completed
        // and return the last race (for the season finale)
        races.forEach(race => race.status = "completed");
        return races.length - 1;
    }

    // Setup the next race highlight using the determined next race
    function setupNextRaceHighlight() {
        // Determine which race is next
        nextRaceIndex = determineNextRace();
        const nextRace = races[nextRaceIndex];

        if (!nextRace) {
            console.error("Could not determine the next race");
            return;
        }

        // Set the next race in the UI - SIDEBAR HIGHLIGHT SECTION
        // Update sidebar next race highlight
        const sidebarNextRaceName = document.getElementById('next-race-name');
        const sidebarNextRaceCircuit = document.getElementById('next-race-circuit');
        const sidebarNextRaceFlag = document.getElementById('next-race-flag');

        // Update sidebar race name
        if (sidebarNextRaceName) {
            sidebarNextRaceName.textContent = nextRace.name;
        }

        // Update sidebar circuit name
        if (sidebarNextRaceCircuit) {
            sidebarNextRaceCircuit.textContent = nextRace.circuit;
        }

        // Update sidebar race flag
        if (sidebarNextRaceFlag) {
            sidebarNextRaceFlag.textContent = nextRace.flag;
        }

        // Update race flag for any other elements using the race flag emoji
        const raceFlagEmojis = document.querySelectorAll('#race-flag-emoji');
        raceFlagEmojis.forEach(element => {
            if (element) element.textContent = nextRace.flag;
        });

        // Start countdown to the next race
        updateCountdown(nextRace.date);

        // Update countdown every minute
        setInterval(() => updateCountdown(nextRace.date), 60000);

        // Also update the race info in the navbar
        updateNavbarRaceInfo(nextRace);
    }

    // Update the race info in the navbar
    function updateNavbarRaceInfo(race) {
        // Check if navbar race elements exist
        const navbarRaceName = document.getElementById('next-race-name');
        const navbarRaceFlag = document.getElementById('race-flag-emoji');

        if (navbarRaceName) {
            navbarRaceName.textContent = race.name;
        }

        if (navbarRaceFlag) {
            navbarRaceFlag.textContent = race.flag;
        }
    }

    // Update the countdown
    function updateCountdown(raceDate) {
        // Get DOM elements for sidebar countdown
        const countDays = document.getElementById('count-days');
        const countHours = document.getElementById('count-hours');
        const countMins = document.getElementById('count-mins');

        // Get DOM elements for navbar countdown
        const mainCountdown = document.getElementById('race-countdown');
        const mobileCountdown = document.getElementById('race-countdown-mobile');

        // Proceed only if at least one element exists
        if (!countDays && !countHours && !countMins && !mainCountdown && !mobileCountdown) {
            return;
        }

        // Calculate time difference
        const now = new Date();
        const diff = raceDate - now;

        if (diff <= 0) {
            // The race has passed, should recalculate the next race
            console.log("Race has passed, recalculating...");
            const newNextRaceIndex = determineNextRace();

            // If the next race has changed, update the display
            if (newNextRaceIndex !== nextRaceIndex) {
                nextRaceIndex = newNextRaceIndex;
                // If there's still a next race, update the countdown
                if (nextRaceIndex !== -1 && nextRaceIndex < races.length) {
                    setupNextRaceHighlight();
                }
            } else {
                // No new next race (season is over), show a message
                if (mainCountdown) mainCountdown.textContent = "Season Complete";
                if (mobileCountdown) mobileCountdown.textContent = "End";

                // Update sidebar countdown to zeros
                if (countDays) countDays.textContent = "0";
                if (countHours) countHours.textContent = "00";
                if (countMins) countMins.textContent = "00";

                // Update sidebar to show season finale info
                const sidebarNextRaceName = document.getElementById('next-race-name');
                if (sidebarNextRaceName) {
                    sidebarNextRaceName.textContent = "Season Finale";
                }

                const sidebarNextRaceCircuit = document.getElementById('next-race-circuit');
                if (sidebarNextRaceCircuit) {
                    const lastRace = races[races.length - 1];
                    sidebarNextRaceCircuit.textContent = lastRace ? lastRace.circuit : "See you next season!";
                }
            }
            return;
        }

        // Calculate days, hours, minutes and seconds
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        // Update sidebar countdown if elements exist
        if (countDays) countDays.textContent = days;
        if (countHours) countHours.textContent = hours.toString().padStart(2, '0');
        if (countMins) countMins.textContent = mins.toString().padStart(2, '0');

        // Update countdown text in navbar if it exists
        if (mainCountdown) {
            mainCountdown.textContent = `${days}d ${hours}h ${mins}m`;
        }

        // Update mobile countdown if it exists
        if (mobileCountdown) {
            mobileCountdown.textContent = days > 0 ? `${days}d` : `${hours}h`;
        }
    }

    // Get races to display based on current state
    function getDisplayRaces() {
        if (nextRaceIndex === -1) {
            // Fallback if next race not determined
            return races.slice(0, 6);
        }

        // Get upcoming races (next race + 5 more)
        const upcomingRaces = races.slice(nextRaceIndex, nextRaceIndex + 6);

        // If showing past races, include up to 5 past races before the next one
        if (showingPastRaces && nextRaceIndex > 0) {
            const pastRaces = races.slice(Math.max(0, nextRaceIndex - 5), nextRaceIndex);
            return [...pastRaces, ...upcomingRaces];
        }

        // Otherwise just return the upcoming races
        return upcomingRaces;
    }

    // Populate races list
    function populateRacesList() {
        const racesList = document.getElementById('upcoming-races-list');
        if (!racesList) return;

        // Clear any existing races or placeholders
        racesList.innerHTML = '';

        // Get races to display based on current state
        const displayRaces = getDisplayRaces();

        // Add each race to the list
        displayRaces.forEach(race => {
            const { month, day } = formatDate(race.date);

            // Create race item
            const raceItem = document.createElement('li');
            raceItem.className = `race-item ${race.status}`;

            // Create race content
            raceItem.innerHTML = `
                <div class="race-date">
                    <span class="date-day">${day}</span>
                    <span class="date-month">${month}</span>
                </div>
                <div class="race-name">
                    <span class="race-title">${race.flag} ${race.name}</span>
                    <span class="race-circuit">${race.circuit}</span>
                </div>
                <span class="race-status ${race.status}"></span>
            `;

            // Add to the list
            racesList.appendChild(raceItem);
        });
    }

    // Setup toggle for past races
    function setupPastRacesToggle() {
        const toggleBtn = document.getElementById('toggle-past-races');
        if (!toggleBtn) return;

        toggleBtn.addEventListener('click', function() {
            // Toggle the display state
            showingPastRaces = !showingPastRaces;

            // Update button text
            this.textContent = showingPastRaces ? 'Hide Past Races' : 'Show Past Races';

            // Re-populate the races list with the new state
            populateRacesList();
        });
    }

    // Initialize the F1 calendar
    function initF1Calendar() {
        setupNextRaceHighlight();
        populateRacesList();
        setupPastRacesToggle();
    }

    // Start everything
    initF1Calendar();
});