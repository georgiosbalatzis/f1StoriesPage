// Complete F1 Calendar Implementation
document.addEventListener('DOMContentLoaded', function() {
    // F1 Calendar data for 2025 season
    const races = [
        {
            name: "Bahrain Grand Prix",
            shortName: "Bahrain",
            circuit: "Bahrain International Circuit",
            location: "Sakhir",
            date: new Date(2025, 2, 2), // March 2, 2025
            countryCode: "bh",
            flag: "🇧🇭"
        },
        {
            name: "Saudi Arabian Grand Prix",
            shortName: "Saudi Arabia",
            circuit: "Jeddah Corniche Circuit",
            location: "Jeddah",
            date: new Date(2025, 2, 9), // March 9, 2025
            countryCode: "sa",
            flag: "🇸🇦"
        },
        {
            name: "Australian Grand Prix",
            shortName: "Australia",
            circuit: "Albert Park Circuit",
            location: "Melbourne",
            date: new Date(2025, 2, 23), // March 23, 2025
            countryCode: "au",
            flag: "🇦🇺"
        },
        {
            name: "Japanese Grand Prix",
            shortName: "Japan",
            circuit: "Suzuka International Racing Course",
            location: "Suzuka",
            date: new Date(2025, 3, 6), // April 6, 2025
            countryCode: "jp",
            flag: "🇯🇵"
        },
        {
            name: "Chinese Grand Prix",
            shortName: "China",
            circuit: "Shanghai International Circuit",
            location: "Shanghai",
            date: new Date(2025, 3, 20), // April 20, 2025
            countryCode: "cn",
            flag: "🇨🇳"
        },
        {
            name: "Miami Grand Prix",
            shortName: "Miami",
            circuit: "Miami International Autodrome",
            location: "Miami",
            date: new Date(2025, 4, 4), // May 4, 2025
            countryCode: "us",
            flag: "🇺🇸"
        },
        {
            name: "Emilia Romagna Grand Prix",
            shortName: "Emilia Romagna",
            circuit: "Autodromo Enzo e Dino Ferrari",
            location: "Imola",
            date: new Date(2025, 4, 18), // May 18, 2025
            countryCode: "it",
            flag: "🇮🇹"
        },
        {
            name: "Monaco Grand Prix",
            shortName: "Monaco",
            circuit: "Circuit de Monaco",
            location: "Monaco",
            date: new Date(2025, 4, 25), // May 25, 2025
            countryCode: "mc",
            flag: "🇲🇨"
        },
        {
            name: "Spanish Grand Prix",
            shortName: "Spain",
            circuit: "Circuit de Barcelona-Catalunya",
            location: "Barcelona",
            date: new Date(2025, 5, 1), // June 1, 2025
            countryCode: "es",
            flag: "🇪🇸"
        },
        {
            name: "Canadian Grand Prix",
            shortName: "Canada",
            circuit: "Circuit Gilles Villeneuve",
            location: "Montreal",
            date: new Date(2025, 5, 15), // June 15, 2025
            countryCode: "ca",
            flag: "🇨🇦"
        },
        {
            name: "Austrian Grand Prix",
            shortName: "Austria",
            circuit: "Red Bull Ring",
            location: "Spielberg",
            date: new Date(2025, 5, 29), // June 29, 2025
            countryCode: "at",
            flag: "🇦🇹"
        },
        {
            name: "British Grand Prix",
            shortName: "Great Britain",
            circuit: "Silverstone Circuit",
            location: "Silverstone",
            date: new Date(2025, 6, 13), // July 13, 2025
            countryCode: "gb",
            flag: "🇬🇧"
        },
        {
            name: "Hungarian Grand Prix",
            shortName: "Hungary",
            circuit: "Hungaroring",
            location: "Budapest",
            date: new Date(2025, 6, 27), // July 27, 2025
            countryCode: "hu",
            flag: "🇭🇺"
        },
        {
            name: "Belgian Grand Prix",
            shortName: "Belgium",
            circuit: "Circuit de Spa-Francorchamps",
            location: "Spa-Francorchamps",
            date: new Date(2025, 7, 3), // August 3, 2025
            countryCode: "be",
            flag: "🇧🇪"
        },
        {
            name: "Dutch Grand Prix",
            shortName: "Netherlands",
            circuit: "Circuit Zandvoort",
            location: "Zandvoort",
            date: new Date(2025, 7, 31), // August 31, 2025
            countryCode: "nl",
            flag: "🇳🇱"
        },
        {
            name: "Italian Grand Prix",
            shortName: "Italy",
            circuit: "Autodromo Nazionale Monza",
            location: "Monza",
            date: new Date(2025, 8, 7), // September 7, 2025
            countryCode: "it",
            flag: "🇮🇹"
        },
        {
            name: "Azerbaijan Grand Prix",
            shortName: "Azerbaijan",
            circuit: "Baku City Circuit",
            location: "Baku",
            date: new Date(2025, 8, 14), // September 14, 2025
            countryCode: "az",
            flag: "🇦🇿"
        },
        {
            name: "Singapore Grand Prix",
            shortName: "Singapore",
            circuit: "Marina Bay Street Circuit",
            location: "Singapore",
            date: new Date(2025, 8, 28), // September 28, 2025
            countryCode: "sg",
            flag: "🇸🇬"
        },
        {
            name: "United States Grand Prix",
            shortName: "USA",
            circuit: "Circuit of the Americas",
            location: "Austin",
            date: new Date(2025, 9, 5), // October 5, 2025
            countryCode: "us",
            flag: "🇺🇸"
        },
        {
            name: "Mexican Grand Prix",
            shortName: "Mexico",
            circuit: "Autódromo Hermanos Rodríguez",
            location: "Mexico City",
            date: new Date(2025, 9, 19), // October 19, 2025
            countryCode: "mx",
            flag: "🇲🇽"
        },
        {
            name: "Brazilian Grand Prix",
            shortName: "Brazil",
            circuit: "Autódromo José Carlos Pace",
            location: "Sao Paulo",
            date: new Date(2025, 10, 2), // November 2, 2025
            countryCode: "br",
            flag: "🇧🇷"
        },
        {
            name: "Las Vegas Grand Prix",
            shortName: "Las Vegas",
            circuit: "Las Vegas Strip Circuit",
            location: "Las Vegas",
            date: new Date(2025, 10, 16), // November 16, 2025
            countryCode: "us",
            flag: "🇺🇸"
        },
        {
            name: "Qatar Grand Prix",
            shortName: "Qatar",
            circuit: "Lusail International Circuit",
            location: "Lusail",
            date: new Date(2025, 10, 30), // November 30, 2025
            countryCode: "qa",
            flag: "🇶🇦"
        },
        {
            name: "Abu Dhabi Grand Prix",
            shortName: "Abu Dhabi",
            circuit: "Yas Marina Circuit",
            location: "Yas Marina",
            date: new Date(2025, 11, 7), // December 7, 2025
            countryCode: "ae",
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

    // Function to determine which race is next with corrected date comparison
    function determineNextRace() {
        const now = new Date();

        // Loop through races to find the next one
        for (let i = 0; i < races.length; i++) {
            const raceDate = races[i].date;

            // Check if the race is today (same year, month, and day)
            const isRaceToday = raceDate.getFullYear() === now.getFullYear() &&
                raceDate.getMonth() === now.getMonth() &&
                raceDate.getDate() === now.getDate();

            // Consider a race as "next" if it's either today or in the future
            if (raceDate > now || isRaceToday) {
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

    // ========== BLOG CALENDAR FUNCTIONS ==========

    // Setup the next race highlight for the blog sidebar
    function setupBlogCalendar() {
        // Determine which race is next
        nextRaceIndex = determineNextRace();
        const nextRace = races[nextRaceIndex];

        if (!nextRace) {
            console.error("Could not determine the next race");
            return;
        }

        // Get the sidebar elements
        const nextRaceName = document.getElementById('next-race-name');
        const nextRaceCircuit = document.getElementById('next-race-circuit');
        const nextRaceFlag = document.getElementById('next-race-flag');

        // These elements are in the blog sidebar
        if (nextRaceName) nextRaceName.textContent = nextRace.name;
        if (nextRaceCircuit) nextRaceCircuit.textContent = nextRace.circuit;
        if (nextRaceFlag) nextRaceFlag.textContent = nextRace.flag;

        // Setup countdown in sidebar
        const countDays = document.getElementById('count-days');
        const countHours = document.getElementById('count-hours');
        const countMins = document.getElementById('count-mins');

        if (countDays || countHours || countMins) {
            updateSidebarCountdown(nextRace.date);
            setInterval(() => updateSidebarCountdown(nextRace.date), 60000);
        }

        // Populate races list
        populateRacesList();

        // Setup toggle for past races
        setupPastRacesToggle();
    }

    // Update sidebar countdown
    function updateSidebarCountdown(raceDate) {
        const countDays = document.getElementById('count-days');
        const countHours = document.getElementById('count-hours');
        const countMins = document.getElementById('count-mins');

        if (!countDays && !countHours && !countMins) return;

        // Calculate time difference
        const now = new Date();
        const diff = raceDate - now;

        if (diff <= 0) {
            // Race has passed or is happening now
            if (countDays) countDays.textContent = "0";
            if (countHours) countHours.textContent = "00";
            if (countMins) countMins.textContent = "00";
            return;
        }

        // Calculate days, hours, minutes
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        // Update the DOM
        if (countDays) countDays.textContent = days;
        if (countHours) countHours.textContent = hours.toString().padStart(2, '0');
        if (countMins) countMins.textContent = mins.toString().padStart(2, '0');
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

    // ========== NAVBAR COUNTDOWN FUNCTIONS ==========

    // Check if navbar countdown elements exist
    const navCountdownTimer = document.getElementById('race-countdown');
    const navMobileCountdown = document.getElementById('race-countdown-mobile');

    function setupNavbarCountdown() {
        if (!navCountdownTimer && !navMobileCountdown) return;

        // Convert our race data to the format expected by navbar countdown
        const navRaceCalendar = races.map(race => ({
            name: race.name,
            shortName: race.shortName,
            location: race.location,
            countryCode: race.countryCode,
            date: race.date.toISOString()
        }));

        // Function to find the next upcoming race for navbar
        function getNavNextRace() {
            const now = new Date();

            // Find the first race that's in the future
            const nextRace = navRaceCalendar.find(race => new Date(race.date) > now);

            // If no future races found, return the last race
            return nextRace || (navRaceCalendar.length ? navRaceCalendar[navRaceCalendar.length - 1] : null);
        }

        // Function to update navbar race info
        function updateNavRaceInfo(race) {
            if (!race) return;

            const raceNameElement = document.getElementById('next-race-name');
            const flagElement = document.getElementById('race-flag-emoji');

            if (raceNameElement) {
                raceNameElement.textContent = race.shortName || race.name.split(' ')[0];
            }

            if (flagElement) {
                // Use flag directly from our race data
                const originalRace = races.find(r => r.name === race.name);
                flagElement.textContent = originalRace ? originalRace.flag : '🏁';
            }
        }

        // Function to update navbar countdown
        function updateNavCountdown() {
            // Find the next race from navbar calendar
            const nextRace = getNavNextRace();
            if (!nextRace) return;

            const raceDate = new Date(nextRace.date);
            const now = new Date();

            // Calculate time difference
            const timeDiff = raceDate - now;

            // If race has passed, update to the next race
            if (timeDiff <= 0) {
                // This will re-run the whole system and find a new next race
                initializeCalendar();
                return;
            }

            // Calculate days, hours, minutes
            const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

            // Update DOM elements
            if (navCountdownTimer) {
                navCountdownTimer.textContent = `${days}d ${hours}h ${minutes}m`;
            }

            if (navMobileCountdown) {
                // Simpler display for mobile
                navMobileCountdown.textContent = days > 0 ? `${days}d` : `${hours}h`;
            }

            // Update every minute
            setTimeout(updateNavCountdown, 60000);
        }

        // Initialize navbar countdown
        const nextRace = getNavNextRace();
        if (nextRace) {
            updateNavRaceInfo(nextRace);
            updateNavCountdown();
        }
    }

    // Main initialization function
    function initializeCalendar() {
        // Setup blog calendar
        setupBlogCalendar();

        // Setup navbar countdown
        setupNavbarCountdown();
    }

    // Start everything
    initializeCalendar();
});