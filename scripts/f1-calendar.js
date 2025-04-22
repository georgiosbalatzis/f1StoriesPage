// f1-calendar.js - Enhanced calendar with improved date display
document.addEventListener('DOMContentLoaded', function() {
    // Sample race data for 2025 (would typically come from an API)
    const races2025 = [
        {
            name: "Bahrain Grand Prix",
            circuit: "Bahrain International Circuit",
            date: new Date(2025, 2, 9),
            completed: true
        },
        {
            name: "Saudi Arabian Grand Prix",
            circuit: "Jeddah Corniche Circuit",
            date: new Date(2025, 2, 16),
            completed: true
        },
        {
            name: "Australian Grand Prix",
            circuit: "Albert Park Circuit",
            date: new Date(2025, 2, 30),
            completed: true
        },
        {
            name: "Japanese Grand Prix",
            circuit: "Suzuka International Racing Course",
            date: new Date(2025, 3, 13),
            completed: true
        },
        {
            name: "Chinese Grand Prix",
            circuit: "Shanghai International Circuit",
            date: new Date(2025, 3, 20),
            completed: true
        },
        {
            name: "Miami Grand Prix",
            circuit: "Miami International Autodrome",
            date: new Date(2025, 4, 4)
        },
        {
            name: "Emilia Romagna Grand Prix",
            circuit: "Autodromo Enzo e Dino Ferrari",
            date: new Date(2025, 4, 18)
        },
        {
            name: "Monaco Grand Prix",
            circuit: "Circuit de Monaco",
            date: new Date(2025, 4, 25)
        },
        {
            name: "Canadian Grand Prix",
            circuit: "Circuit Gilles Villeneuve",
            date: new Date(2025, 5, 8)
        },
        {
            name: "Spanish Grand Prix",
            circuit: "Circuit de Barcelona-Catalunya",
            date: new Date(2025, 5, 22)
        },
        {
            name: "Austrian Grand Prix",
            circuit: "Red Bull Ring",
            date: new Date(2025, 5, 29)
        },
        {
            name: "British Grand Prix",
            circuit: "Silverstone Circuit",
            date: new Date(2025, 6, 6)
        },
        {
            name: "Hungarian Grand Prix",
            circuit: "Hungaroring",
            date: new Date(2025, 6, 27)
        },
        {
            name: "Belgian Grand Prix",
            circuit: "Circuit de Spa-Francorchamps",
            date: new Date(2025, 7, 3)
        },
        {
            name: "Dutch Grand Prix",
            circuit: "Circuit Zandvoort",
            date: new Date(2025, 7, 24)
        },
        {
            name: "Italian Grand Prix",
            circuit: "Autodromo Nazionale di Monza",
            date: new Date(2025, 7, 31)
        },
        {
            name: "Azerbaijan Grand Prix",
            circuit: "Baku City Circuit",
            date: new Date(2025, 8, 14)
        },
        {
            name: "Singapore Grand Prix",
            circuit: "Marina Bay Street Circuit",
            date: new Date(2025, 8, 21)
        },
        {
            name: "United States Grand Prix",
            circuit: "Circuit of the Americas",
            date: new Date(2025, 9, 19)
        },
        {
            name: "Mexico City Grand Prix",
            circuit: "Autódromo Hermanos Rodríguez",
            date: new Date(2025, 9, 26)
        },
        {
            name: "São Paulo Grand Prix",
            circuit: "Interlagos Circuit",
            date: new Date(2025, 10, 9)
        },
        {
            name: "Las Vegas Grand Prix",
            circuit: "Las Vegas Strip Circuit",
            date: new Date(2025, 10, 23)
        },
        {
            name: "Qatar Grand Prix",
            circuit: "Losail International Circuit",
            date: new Date(2025, 11, 7)
        },
        {
            name: "Abu Dhabi Grand Prix",
            circuit: "Yas Marina Circuit",
            date: new Date(2025, 11, 14)
        }
    ];

    // Get current date (for comparing with race dates)
    const today = new Date();

    // Find the next race (first race that hasn't happened yet)
    const nextRace = races2025.find(race => race.date > today && !race.completed);

    // Format date into readable string
    function formatDate(date) {
        const options = { month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    }

    // Get month name
    function getMonthName(date) {
        return date.toLocaleDateString('en-US', { month: 'short' });
    }

    // Get day of month
    function getDayOfMonth(date) {
        return date.getDate();
    }

    // Update the next race information
    function updateNextRaceInfo() {
        if (!nextRace) return;

        // Update next race header
        const nextRaceNameElement = document.getElementById('next-race-name');
        const nextRaceCircuitElement = document.getElementById('next-race-circuit');
        const nextRaceFlagElement = document.getElementById('next-race-flag');

        if (nextRaceNameElement) nextRaceNameElement.textContent = nextRace.name;
        if (nextRaceCircuitElement) nextRaceCircuitElement.textContent = nextRace.circuit;

        // Update flag (using emoji as placeholder)
        if (nextRaceFlagElement) {
            nextRaceFlagElement.textContent = getCountryFlagEmoji(nextRace.name);
        }

        // Update countdown timer
        updateCountdown();
    }

    // Generate a flag emoji based on the race name
    function getCountryFlagEmoji(raceName) {
        // Map race names to country flag emojis
        const flagMap = {
            "Bahrain": "🇧🇭",
            "Saudi Arabian": "🇸🇦",
            "Australian": "🇦🇺",
            "Japanese": "🇯🇵",
            "Chinese": "🇨🇳",
            "Miami": "🇺🇸",
            "Emilia Romagna": "🇮🇹",
            "Monaco": "🇲🇨",
            "Canadian": "🇨🇦",
            "Spanish": "🇪🇸",
            "Austrian": "🇦🇹",
            "British": "🇬🇧",
            "Hungarian": "🇭🇺",
            "Belgian": "🇧🇪",
            "Dutch": "🇳🇱",
            "Italian": "🇮🇹",
            "Azerbaijan": "🇦🇿",
            "Singapore": "🇸🇬",
            "United States": "🇺🇸",
            "Mexico City": "🇲🇽",
            "São Paulo": "🇧🇷",
            "Las Vegas": "🇺🇸",
            "Qatar": "🇶🇦",
            "Abu Dhabi": "🇦🇪"
        };

        // Extract the country/city name from race name
        const parts = raceName.split(' ');
        const country = parts[0] + (parts.length > 1 && parts[1] === "Arabian" ? " Arabian" :
            parts.length > 1 && parts[1] === "United" ? " United" :
                parts.length > 1 && parts[1] === "City" ? " City" : "");

        // Return the flag emoji or a default globe
        return flagMap[country] || "🏁";
    }

    // Update countdown timer
    function updateCountdown() {
        if (!nextRace) return;

        const countdownElement = document.getElementById('sidebar-countdown');
        if (!countdownElement) return;

        const now = new Date();
        const timeRemaining = nextRace.date - now;

        if (timeRemaining <= 0) {
            // Race day has arrived
            document.getElementById('count-days').textContent = '0';
            document.getElementById('count-hours').textContent = '00';
            document.getElementById('count-mins').textContent = '00';
            return;
        }

        // Convert remaining time to days, hours, minutes
        const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

        // Update DOM
        document.getElementById('count-days').textContent = days;
        document.getElementById('count-hours').textContent = hours.toString().padStart(2, '0');
        document.getElementById('count-mins').textContent = minutes.toString().padStart(2, '0');
    }

    // Populate the upcoming races list
    function populateRacesList() {
        const upcomingRacesList = document.getElementById('upcoming-races-list');
        if (!upcomingRacesList) return;

        // Clear any existing placeholders
        upcomingRacesList.innerHTML = '';

        const today = new Date();
        let foundNext = false;

        // Split races into upcoming and past
        const upcomingRaces = [];
        const pastRaces = [];

        races2025.forEach(race => {
            if (race.date > today && !race.completed) {
                upcomingRaces.push(race);
            } else {
                pastRaces.push(race);
            }
        });

        // Sort upcoming races by date (closest first)
        upcomingRaces.sort((a, b) => a.date - b.date);

        // Sort past races by date (most recent first)
        pastRaces.sort((a, b) => b.date - a.date);

        // Add upcoming races (limited to next 5)
        upcomingRaces.slice(0, 5).forEach(race => {
            const isNext = !foundNext;
            if (isNext) foundNext = true;

            const raceElement = document.createElement('li');
            raceElement.className = `race-item ${isNext ? 'next' : 'upcoming'}`;

            raceElement.innerHTML = `
                <div class="race-date">
                    <span class="date-day">${getDayOfMonth(race.date)}</span>
                    <span class="date-month">${getMonthName(race.date)}</span>
                </div>
                <div class="race-name">
                    <span class="race-title">${race.name}</span>
                    <span class="race-circuit">${race.circuit}</span>
                </div>
                <div class="race-status ${isNext ? 'next' : 'upcoming'}"></div>
            `;

            upcomingRacesList.appendChild(raceElement);
        });

        // Add past races (limited to last 3)
        pastRaces.slice(0, 3).forEach(race => {
            const raceElement = document.createElement('li');
            raceElement.className = 'race-item completed race-past';
            raceElement.style.display = 'none'; // Hidden by default

            raceElement.innerHTML = `
                <div class="race-date">
                    <span class="date-day">${getDayOfMonth(race.date)}</span>
                    <span class="date-month">${getMonthName(race.date)}</span>
                </div>
                <div class="race-name">
                    <span class="race-title">${race.name}</span>
                    <span class="race-circuit">${race.circuit}</span>
                </div>
                <div class="race-status completed"></div>
            `;

            upcomingRacesList.appendChild(raceElement);
        });
    }

    // Show/hide past races
    function setupToggleButton() {
        const toggleButton = document.getElementById('toggle-past-races');
        if (!toggleButton) return;

        toggleButton.addEventListener('click', function() {
            const pastRaces = document.querySelectorAll('.race-past');
            const isShowing = this.textContent.includes('Hide');

            pastRaces.forEach(race => {
                race.style.display = isShowing ? 'none' : 'flex';
            });

            this.textContent = isShowing ? 'Show Past Races' : 'Hide Past Races';
        });
    }

    // Initialize the F1 calendar
    function initCalendar() {
        updateNextRaceInfo();
        populateRacesList();
        setupToggleButton();

        // Update countdown every minute
        setInterval(updateCountdown, 60000);
    }

    // Run initialization
    initCalendar();
});