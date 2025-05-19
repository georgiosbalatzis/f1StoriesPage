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

    // Function to determine which race is next
    function findNextRace() {
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

                return {
                    race: races[i],
                    index: i
                };
            }
        }

        // If all races are in the past, return the last race
        races.forEach(race => {
            race.status = "completed";
        });

        return {
            race: races[races.length - 1],
            index: races.length - 1,
            seasonEnded: true
        };
    }

    // Clear any existing race highlight first
    function clearExistingRaceHighlight() {
        // First, let's get all elements from the next-race-highlight that might contain race info
        const nextRaceElements = document.querySelectorAll('.next-race-highlight *');

        // Clear any existing hardcoded races
        nextRaceElements.forEach(element => {
            // Clear text content of elements that might contain race names
            if (element.id === 'next-race-name' ||
                element.id === 'next-race-circuit' ||
                element.className === 'race-title' ||
                element.className === 'race-circuit') {
                element.textContent = '';
            }

            // Clear flag if it exists
            if (element.id === 'next-race-flag') {
                element.textContent = '';
            }

            // Clear any countdown elements
            if (element.id === 'count-days' ||
                element.id === 'count-hours' ||
                element.id === 'count-mins') {
                element.textContent = '';
            }
        });
    }

    // Set the next race highlight in the sidebar
    function updateNextRaceHighlight(race, seasonEnded) {
        // First clear any existing hardcoded content
        clearExistingRaceHighlight();

        // Get the next race highlight container
        const highlightContainer = document.querySelector('.next-race-highlight');
        if (!highlightContainer) {
            console.error('Next race highlight container not found');
            return;
        }

        // Get elements inside the highlight container
        const raceNameEl = highlightContainer.querySelector('#next-race-name');
        const raceCircuitEl = highlightContainer.querySelector('#next-race-circuit');
        const raceFlagEl = highlightContainer.querySelector('#next-race-flag');

        // Update the race info
        if (raceNameEl) {
            raceNameEl.textContent = seasonEnded ? 'Season Complete' : race.name;
        } else {
            console.warn('Race name element not found in highlight');
        }

        if (raceCircuitEl) {
            raceCircuitEl.textContent = seasonEnded ? 'See you next season!' : race.circuit;
        } else {
            console.warn('Race circuit element not found in highlight');
        }

        if (raceFlagEl) {
            raceFlagEl.textContent = race.flag;
        } else {
            console.warn('Race flag element not found in highlight');
        }

        // Update the countdown
        updateRaceCountdown(race.date, seasonEnded);
    }

    // Update the race countdown in the sidebar
    function updateRaceCountdown(raceDate, seasonEnded) {
        // Get countdown elements
        const daysEl = document.getElementById('count-days');
        const hoursEl = document.getElementById('count-hours');
        const minsEl = document.getElementById('count-mins');

        if (!daysEl || !hoursEl || !minsEl) {
            console.warn('Countdown elements not found');
            return;
        }

        // If season has ended, just show zeros
        if (seasonEnded) {
            daysEl.textContent = '0';
            hoursEl.textContent = '00';
            minsEl.textContent = '00';
            return;
        }

        // Calculate time until race
        const now = new Date();
        const diff = raceDate - now;

        // If the race has already started
        if (diff <= 0) {
            daysEl.textContent = '0';
            hoursEl.textContent = '00';
            minsEl.textContent = '00';
            return;
        }

        // Calculate days, hours, minutes
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        // Update countdown elements
        daysEl.textContent = days.toString();
        hoursEl.textContent = hours.toString().padStart(2, '0');
        minsEl.textContent = mins.toString().padStart(2, '0');

        // Schedule next update
        setTimeout(() => updateRaceCountdown(raceDate, seasonEnded), 60000); // Update every minute
    }

    // Get races to display in the list
    function getDisplayRaces() {
        if (nextRaceIndex === -1) {
            return races.slice(0, 6);
        }

        // Get upcoming races (next race + 5 more)
        const upcomingRaces = races.slice(nextRaceIndex, Math.min(races.length, nextRaceIndex + 6));

        // If showing past races, include up to 5 past races
        if (showingPastRaces && nextRaceIndex > 0) {
            const pastRaces = races.slice(Math.max(0, nextRaceIndex - 5), nextRaceIndex);
            return [...pastRaces, ...upcomingRaces];
        }

        return upcomingRaces;
    }

    // Populate the races list
    function populateRacesList() {
        const racesList = document.getElementById('upcoming-races-list');
        if (!racesList) {
            console.error('Races list element not found');
            return;
        }

        // Clear the list
        racesList.innerHTML = '';

        // Get races to display
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
        if (!toggleBtn) {
            console.warn('Past races toggle button not found');
            return;
        }

        toggleBtn.addEventListener('click', function() {
            // Toggle state
            showingPastRaces = !showingPastRaces;

            // Update button text
            this.textContent = showingPastRaces ? 'Hide Past Races' : 'Show Past Races';

            // Update races list
            populateRacesList();
        });
    }

    // Setup navbar countdown if elements exist
    function setupNavbarCountdown(race, seasonEnded) {
        // Check if navbar countdown elements exist
        const navCountdown = document.getElementById('race-countdown');
        const mobileCountdown = document.getElementById('race-countdown-mobile');

        if (!navCountdown && !mobileCountdown) {
            return; // No navbar countdown elements found
        }

        // Get navbar race elements
        const navRaceName = document.querySelector('.navbar .race-info #next-race-name');
        const navRaceFlag = document.querySelector('.navbar .race-flag #race-flag-emoji');

        // Update navbar race info
        if (navRaceName) {
            navRaceName.textContent = seasonEnded ? 'Season Over' : (race.shortName || race.name);
        }

        if (navRaceFlag) {
            navRaceFlag.textContent = race.flag;
        }

        // Function to update navbar countdown
        function updateNavbarCountdown() {
            if (!navCountdown && !mobileCountdown) return;

            // If season has ended
            if (seasonEnded) {
                if (navCountdown) navCountdown.textContent = 'Season Over';
                if (mobileCountdown) mobileCountdown.textContent = 'End';
                return;
            }

            // Calculate time remaining
            const now = new Date();
            const raceDate = race.date;
            const diff = raceDate - now;

            // If race has already started
            if (diff <= 0) {
                if (navCountdown) navCountdown.textContent = 'Race Today!';
                if (mobileCountdown) mobileCountdown.textContent = 'Today';
                return;
            }

            // Calculate time units
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            // Update countdown displays
            if (navCountdown) {
                navCountdown.textContent = `${days}d ${hours}h ${mins}m`;
            }

            if (mobileCountdown) {
                mobileCountdown.textContent = days > 0 ? `${days}d` : `${hours}h`;
            }

            // Schedule next update
            setTimeout(updateNavbarCountdown, 60000); // Update every minute
        }

        // Start updating navbar countdown
        updateNavbarCountdown();
    }

    // Initialize the F1 calendar
    function initializeCalendar() {
        // Find the next race
        const { race: nextRace, index, seasonEnded } = findNextRace();
        nextRaceIndex = index;

        console.log(`Next race determined: ${nextRace.name}, Index: ${index}`);

        // Update the next race highlight
        updateNextRaceHighlight(nextRace, seasonEnded);

        // Populate the races list
        populateRacesList();

        // Setup past races toggle
        setupPastRacesToggle();

        // Setup navbar countdown
        setupNavbarCountdown(nextRace, seasonEnded);
    }

    // We need to wait a bit to make sure DOM is fully loaded and any other scripts have run
    setTimeout(() => {
        console.log('Initializing F1 Calendar');
        initializeCalendar();
    }, 100);
});