// F1 Calendar Past Races Fix
// This code fixes the issue with the "Show Past Races" button not working

document.addEventListener('DOMContentLoaded', function() {
    // Reference to the toggle button
    const togglePastRacesBtn = document.getElementById('toggle-past-races');
    
    // Reference to the races list
    const upcomingRacesList = document.getElementById('upcoming-races-list');
    
    // Check if elements exist
    if (!togglePastRacesBtn || !upcomingRacesList) {
        console.error('Calendar elements not found');
        return;
    }
    
    // Variable to track if past races are shown
    let pastRacesShown = false;
    
    // Fix the toggle button functionality
    togglePastRacesBtn.addEventListener('click', function() {
        pastRacesShown = !pastRacesShown;
        
        // Update button text
        togglePastRacesBtn.textContent = pastRacesShown ? 'Hide Past Races' : 'Show Past Races';
        
        // Get all race items including those that might be hidden
        const allRaceItems = upcomingRacesList.querySelectorAll('.race-item');
        
        // Toggle visibility of completed races
        allRaceItems.forEach(item => {
            if (item.classList.contains('completed')) {
                item.style.display = pastRacesShown ? 'flex' : 'none';
            }
        });
        
        // Check if we need to load past races (they might not be in the DOM yet)
        if (pastRacesShown && allRaceItems.length === 0) {
            // If no race items found, we might need to load them
            loadPastRaces();
        }
    });
    
    // Function to load past races if they're not already loaded
    function loadPastRaces() {
        // Check if window.raceCalendar exists (from your f1-calendar.js)
        if (window.raceCalendar && window.raceCalendar.length > 0) {
            displayPastRaces(window.raceCalendar);
        } else {
            // If the race calendar isn't loaded yet, try to load it
            fetchRaceCalendar()
                .then(calendar => {
                    window.raceCalendar = calendar;
                    displayPastRaces(calendar);
                })
                .catch(error => {
                    console.error('Error loading race calendar:', error);
                });
        }
    }
    
    // Function to display past races
    function displayPastRaces(calendar) {
        const now = new Date();
        
        // Filter past races
        const pastRaces = calendar.filter(race => new Date(race.date) < now);
        
        // If there are no past races in the DOM, add them
        if (pastRaces.length > 0 && !upcomingRacesList.querySelector('.race-item.completed')) {
            pastRaces.forEach(race => {
                // Create race item
                const raceItem = document.createElement('li');
                raceItem.className = 'race-item completed';
                raceItem.style.display = pastRacesShown ? 'flex' : 'none';
                
                // Format date
                const raceDate = new Date(race.date);
                const formattedDay = raceDate.getDate();
                const formattedMonth = raceDate.toLocaleString('en-US', { month: 'short' });
                
                // Flag emoji for race
                const flagEmoji = getFlagEmoji(race.countryCode) || '🏁';
                
                raceItem.innerHTML = `
                    <div class="race-date">
                        <span class="date-month">${formattedMonth}</span>
                        <span class="date-day">${formattedDay}</span>
                    </div>
                    <div class="race-name">
                        <span class="race-title">${race.shortName || race.name}</span>
                        <span class="race-circuit">${race.location} ${flagEmoji}</span>
                    </div>
                    <span class="race-status completed"></span>
                `;
                
                // Add to list
                upcomingRacesList.appendChild(raceItem);
            });
        }
    }
    
    // Helper function to get flag emoji
    function getFlagEmoji(countryCode) {
        const flagEmojis = {
            'ae': '🇦🇪', // UAE (Abu Dhabi)
            'at': '🇦🇹', // Austria
            'au': '🇦🇺', // Australia
            'az': '🇦🇿', // Azerbaijan
            'bh': '🇧🇭', // Bahrain
            'be': '🇧🇪', // Belgium
            'br': '🇧🇷', // Brazil
            'ca': '🇨🇦', // Canada
            'cn': '🇨🇳', // China
            'nl': '🇳🇱', // Netherlands
            'es': '🇪🇸', // Spain
            'us': '🇺🇸', // USA
            'fr': '🇫🇷', // France
            'gb': '🇬🇧', // Great Britain
            'hu': '🇭🇺', // Hungary
            'it': '🇮🇹', // Italy
            'jp': '🇯🇵', // Japan
            'mc': '🇲🇨', // Monaco
            'mx': '🇲🇽', // Mexico
            'qa': '🇶🇦', // Qatar
            'sa': '🇸🇦', // Saudi Arabia
            'sg': '🇸🇬', // Singapore
            'us-tx': '🇺🇸', // USA (Texas)
            'us-fl': '🇺🇸'  // USA (Florida)
        };
        
        return countryCode ? flagEmojis[countryCode.toLowerCase()] : null;
    }
    
    // Function to fetch race calendar if needed
    function fetchRaceCalendar() {
        return new Promise((resolve, reject) => {
            // First try to check if the calendar is already in the window object
            if (window.raceCalendar && window.raceCalendar.length > 0) {
                resolve(window.raceCalendar);
                return;
            }
            
            // Use fallback data as in your existing script
            const fallbackCalendar = [
                {
                    name: 'Australian Grand Prix',
                    shortName: 'Australia',
                    location: 'Melbourne',
                    countryCode: 'au',
                    date: '2025-03-16T05:00:00Z'
                },
                {
                    name: 'Chinese Grand Prix',
                    shortName: 'China',
                    location: 'Shanghai',
                    countryCode: 'cn',
                    date: '2025-03-23T07:00:00Z'
                },
                {
                    name: 'Japanese Grand Prix',
                    shortName: 'Japan',
                    location: 'Suzuka',
                    countryCode: 'jp',
                    date: '2025-04-06T05:00:00Z'
                },
                {
                    name: 'Bahrain Grand Prix',
                    shortName: 'Bahrain',
                    location: 'Sakhir',
                    countryCode: 'bh',
                    date: '2025-04-13T15:00:00Z'
                },
                {
                    name: 'Saudi Arabian Grand Prix',
                    shortName: 'Saudi Arabia',
                    location: 'Jeddah',
                    countryCode: 'sa',
                    date: '2025-04-20T17:00:00Z'
                },
                {
                    name: 'Miami Grand Prix',
                    shortName: 'Miami',
                    location: 'Miami',
                    countryCode: 'us',
                    date: '2025-05-04T19:00:00Z'
                }
            ];
            
            // Return the fallback data
            resolve(fallbackCalendar);
        });
    }
}); 