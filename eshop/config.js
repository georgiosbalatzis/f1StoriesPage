// Google Sheets CSV URL for F1 Gear product data
const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT0OVN9h7XTQSvlf4SFMoYp8jMqQ1fYWVV8IGt8hVLWUDI57JhHILTbGy_pJQMyzFKpooCQCOBWdqaa/pub?output=csv";

// Enhanced logging function
function logCSVFetchError(error) {
    console.error('CSV Fetch Error:', {
        message: error.message,
        stack: error.stack,
        url: GOOGLE_SHEET_CSV_URL
    });

    // Create visible error message
    const errorContainer = document.getElementById('error-container') ||
        (() => {
            const el = document.createElement('div');
            el.id = 'error-container';
            el.className = 'fixed top-0 left-0 right-0 bg-red-500 text-white p-4 text-center z-50';
            document.body.prepend(el);
            return el;
        })();

    errorContainer.innerHTML = `
        <strong>Error Loading Products:</strong> 
        ${error.message}<br>
        <small>Check console for details</small>
    `;
    errorContainer.style.display = 'block';
}

// Utility to test CSV fetch
async function testCSVFetch() {
    try {
        console.log('Attempting to fetch CSV from:', GOOGLE_SHEET_CSV_URL);
        const response = await fetch(GOOGLE_SHEET_CSV_URL);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const text = await response.text();
        console.log('CSV Fetch Successful');
        console.log('First 500 characters:', text.slice(0, 500));
        console.log('Total characters:', text.length);
        console.log('First few lines:', text.split('\n').slice(0, 5));
    } catch (error) {
        logCSVFetchError(error);
    }
}

// Uncomment to test CSV fetch manually
// testCSVFetch();