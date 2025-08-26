// F1 History Widget
document.addEventListener('DOMContentLoaded', function() {
    // Get current date
    const today = new Date();
    let currentDate = new Date(today);
    const month = currentDate.getMonth() + 1;
    const day = currentDate.getDate();
    let dateKey = `${month}-${day}`;

    // Initialize date picker
    initializeDatePicker();

    // Load initial data
    loadEvents(dateKey);

    // Function to initialize date picker
    function initializeDatePicker() {
        const widgetContainer = document.querySelector('.f1-this-day-widget');
        if (!widgetContainer) return;

        // Create date picker container
        const datePickerContainer = document.createElement('div');
        datePickerContainer.className = 'date-picker-container';
        datePickerContainer.innerHTML = `
            <div class="date-picker">
                <button class="prev-date"><i class="fas fa-chevron-left"></i></button>
                <span class="current-date">${day} ${getMonthName(month)}</span>
                <button class="next-date"><i class="fas fa-chevron-right"></i></button>
            </div>
        `;

        // Insert date picker after header
        const header = widgetContainer.querySelector('.f1-history-header');
        if (header) {
            header.appendChild(datePickerContainer);
        }

        // Add event listeners for date navigation
        const prevButton = datePickerContainer.querySelector('.prev-date');
        const nextButton = datePickerContainer.querySelector('.next-date');
        const currentDateSpan = datePickerContainer.querySelector('.current-date');

        prevButton.addEventListener('click', () => {
            currentDate.setDate(currentDate.getDate() - 1);
            updateDateDisplay();
        });

        nextButton.addEventListener('click', () => {
            currentDate.setDate(currentDate.getDate() + 1);
            updateDateDisplay();
        });

        function updateDateDisplay() {
            const newMonth = currentDate.getMonth() + 1;
            const newDay = currentDate.getDate();
            dateKey = `${newMonth}-${newDay}`;
            currentDateSpan.textContent = `${newDay} ${getMonthName(newMonth)}`;
            loadEvents(dateKey);
        }
    }

    // Function to load events
    function loadEvents(dateKey) {
        fetch('/data/f1-history.json')
            .then(response => response.json())
            .then(data => {
                let events = data.events[dateKey];
                
                if (events && events.length > 0) {
                    events = removeDuplicateEvents(events);
                    displayEvents(events);
                } else {
                    displayNoEvents();
                }
            })
            .catch(error => {
                console.error('Σφάλμα φόρτωσης ιστορικών δεδομένων F1:', error);
                displayError();
            });
    }

    // Function to display events
    function displayEvents(events) {
        const widgetContainer = document.querySelector('.f1-this-day-widget');
        if (!widgetContainer) return;

        // Sort events by importance
        events.sort((a, b) => b.importance - a.importance);

        // Create events container
        let widgetContent = `
            <div class="f1-history-events">
        `;

        // Add each event
        events.forEach(event => {
            const eventCategory = event.category || 'general';
            const importanceLevel = event.importance || 2;
            
            widgetContent += `
                <div class="f1-history-event ${eventCategory} importance-${importanceLevel}">
                    <div class="event-year">${event.year}</div>
                    <div class="event-content">
                        <p class="event-description">${event.event}</p>
                        ${event.driver ? `<p class="event-details"><strong>Οδηγός:</strong> ${event.driver}</p>` : ''}
                        ${event.team ? `<p class="event-details"><strong>Ομάδα:</strong> ${event.team}</p>` : ''}
                        ${event.circuit ? `<p class="event-details"><strong>Πίστα:</strong> ${event.circuit}</p>` : ''}
                    </div>
                </div>
            `;
        });

        widgetContent += `</div>`;

        // Update widget content
        const eventsContainer = widgetContainer.querySelector('.f1-history-events');
        if (eventsContainer) {
            eventsContainer.innerHTML = widgetContent;
        } else {
            widgetContainer.innerHTML += widgetContent;
        }
    }

    // Function to share event on social media
    function shareEvent(event) {
        const shareText = `${event.year}: ${event.event}`;
        const shareUrl = window.location.href;
        
        // Create share URLs for different platforms
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
        const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        
        // Open share dialog
        window.open(twitterUrl, '_blank');
    }

    // Function to show more events
    function showMoreEvents(events) {
        // Implement modal or expanded view logic here
        console.log('Showing more events:', events);
    }

    // Helper function to get month name in Greek
    function getMonthName(monthNumber) {
        const monthNames = [
            'Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου', 
            'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου'
        ];
        return monthNames[monthNumber - 1];
    }

    // Function to remove duplicate events
    function removeDuplicateEvents(events) {
        const uniqueEventKeys = new Set();
        const uniqueEvents = [];

        events.forEach(event => {
            // Create a more specific key that includes the year, driver, and event description
            const eventKey = `${event.year}-${event.driver || ''}-${event.event.substring(0, 30)}`;
            
            if (!uniqueEventKeys.has(eventKey)) {
                uniqueEventKeys.add(eventKey);
                uniqueEvents.push(event);
            }
        });
        
        return uniqueEvents;
    }

    // Function to display "no events" message
    function displayNoEvents() {
        const widgetContainer = document.querySelector('.f1-this-day-widget');
        if (!widgetContainer) return;

        const eventsContainer = widgetContainer.querySelector('.f1-history-events');
        if (eventsContainer) {
            eventsContainer.innerHTML = `
                <div class="f1-history-no-events">
                    <p>Δεν υπάρχουν καταγεγραμμένα γεγονότα για αυτή την ημερομηνία.</p>
                </div>
            `;
        }
    }

    // Function to display error message
    function displayError() {
        const widgetContainer = document.querySelector('.f1-this-day-widget');
        if (!widgetContainer) return;

        const eventsContainer = widgetContainer.querySelector('.f1-history-events');
        if (eventsContainer) {
            eventsContainer.innerHTML = `
                <div class="f1-history-error">
                    <p>Σφάλμα κατά τη φόρτωση των δεδομένων.</p>
                </div>
            `;
        }
    }
}); 