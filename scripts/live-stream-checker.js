// live-stream-checker.js - Dynamic YouTube Live Stream Detector
document.addEventListener('DOMContentLoaded', function() {
    // Check for live streams immediately
    checkAndDisplayLiveStream();

    // Also check for live streams every 5 minutes
    setInterval(checkAndDisplayLiveStream, 5 * 60 * 1000);
});

// Function to check for and display live streams
async function checkAndDisplayLiveStream() {
    // Remove existing live stream section if it exists
    const existingSection = document.getElementById('live-stream');
    if (existingSection) {
        existingSection.remove();
    }

    const channelId = 'UCTSK8lbEiHJ10KVFrhNaL4g'; // F1 Stories channel ID
    const apiKey = 'AIzaSyCE0vy99ror_w6PJtVGSnahyCz8n4Fq0P8';

    try {
        // First try to get live streams using the search endpoint
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${apiKey}`;
        const searchResponse = await fetch(searchUrl);

        if (!searchResponse.ok) {
            throw new Error(`Live stream search failed: ${searchResponse.status}`);
        }

        const searchData = await searchResponse.json();

        // Check if there are any live streams
        if (searchData.items && searchData.items.length > 0) {
            // We have a live stream!
            const liveStream = searchData.items[0]; // Get the first live stream
            const videoId = liveStream.id.videoId;
            const streamTitle = liveStream.snippet.title;

            // Create the live stream section
            createLiveStreamSection(videoId, streamTitle);
        } else {
            console.log('No live streams currently active');
        }
    } catch (error) {
        console.error('Error checking for live streams:', error);

        // Try alternative method using videos endpoint for upcoming streams
        try {
            // Get uploaded videos playlist ID first
            const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`;
            const channelResponse = await fetch(channelUrl);

            if (!channelResponse.ok) {
                throw new Error(`Channel details request failed: ${channelResponse.status}`);
            }

            const channelData = await channelResponse.json();

            if (channelData.items && channelData.items.length > 0) {
                const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

                // Get recent uploads to check for upcoming or active streams
                const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=5&playlistId=${uploadsPlaylistId}&key=${apiKey}`;
                const playlistResponse = await fetch(playlistUrl);

                if (!playlistResponse.ok) {
                    throw new Error(`Playlist items request failed: ${playlistResponse.status}`);
                }

                const playlistData = await playlistResponse.json();

                // Check for videos with "live" or "stream" in the title as a fallback
                const potentialLiveStream = playlistData.items.find(item =>
                    item.snippet.title.toLowerCase().includes('live') ||
                    item.snippet.title.toLowerCase().includes('stream')
                );

                if (potentialLiveStream) {
                    const videoId = potentialLiveStream.snippet.resourceId.videoId;
                    const streamTitle = potentialLiveStream.snippet.title;

                    // Get video details to confirm if it's actually live
                    const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${videoId}&key=${apiKey}`;
                    const videoResponse = await fetch(videoUrl);

                    if (videoResponse.ok) {
                        const videoData = await videoResponse.json();

                        if (videoData.items && videoData.items.length > 0) {
                            const videoItem = videoData.items[0];

                            // Check if it has liveStreamingDetails and is live
                            if (videoItem.liveStreamingDetails) {
                                createLiveStreamSection(videoId, streamTitle);
                            }
                        }
                    }
                }
            }
        } catch (fallbackError) {
            console.error('Fallback method also failed:', fallbackError);
        }
    }
}

// Function to create the live stream section in the DOM
function createLiveStreamSection(videoId, streamTitle) {
    // Create section HTML
    const liveStreamHTML = `
        <section id="live-stream" class="fade-in py-5">
            <div class="container">
                <h2 class="text-center mb-4">
                    <span class="live-indicator">🔴 LIVE NOW</span>
                </h2>
                <div class="row justify-content-center">
                    <div class="col-lg-8">
                        <h3 class="text-center text-info mb-4">${streamTitle}</h3>
                        <div class="ratio ratio-16x9 live-stream-container">
                            <iframe 
                                src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0" 
                                title="F1 Stories Live Stream"
                                frameborder="0" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowfullscreen>
                            </iframe>
                        </div>
                        <div class="text-center mt-4">
                            <a href="https://www.youtube.com/watch?v=${videoId}" target="_blank" class="cta-button">
                                <i class="fab fa-youtube me-2"></i>Watch on YouTube
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    `;

    // Insert the section after the hero but before podcasts
    const heroSection = document.getElementById('hero');
    if (heroSection) {
        heroSection.insertAdjacentHTML('afterend', liveStreamHTML);

        // Add animation and styles
        const liveStreamSection = document.getElementById('live-stream');

        // Add specific styles for the live stream section
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            .live-indicator {
                display: inline-flex;
                align-items: center;
                color: #ff0000;
                animation: pulse-live 1.5s infinite;
                font-weight: bold;
            }
            
            @keyframes pulse-live {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }
            
            .live-stream-container {
                box-shadow: 0 0 30px rgba(255, 0, 0, 0.3);
                border-radius: 10px;
                overflow: hidden;
                transition: all 0.5s ease;
            }
            
            .live-stream-container:hover {
                box-shadow: 0 0 40px rgba(255, 0, 0, 0.5);
                transform: scale(1.02);
            }
        `;
        document.head.appendChild(styleElement);

        // Trigger the fade-in animation
        setTimeout(() => {
            liveStreamSection.classList.add('visible');
        }, 300);

        // Initialize any observers or animations that might be needed
        if (typeof observer !== 'undefined') {
            observer.observe(liveStreamSection);
        }
    }
}