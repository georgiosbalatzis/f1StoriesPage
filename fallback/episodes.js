// episodes.js - Handles dynamic YouTube video loading and embedding
document.addEventListener('DOMContentLoaded', function() {
    // YouTube channel details
    const channelId = 'UCTSK8lbEiHJ10KVFrhNaL4g'; // F1 Stories channel ID
    const maxResults = 6; // Number of videos to display

    // YouTube API Key
    const apiKey = 'AIzaSyCE0vy99ror_w6PJtVGSnahyCz8n4Fq0P8';

    // Set to false to use the YouTube API to fetch latest videos
    const useFallbackVideos = false;

    // Function to fetch latest videos from YouTube channel
    async function fetchLatestVideos() {
        try {
            const endpoint = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${channelId}&part=snippet,id&order=date&maxResults=${maxResults}&type=video`;

            const response = await fetch(endpoint);

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            return data.items;
        } catch (error) {
            console.error('Error fetching YouTube videos:', error);
            return [];
        }
    }

    // Function to get video details (for duration, view count, etc.)
    async function fetchVideoDetails(videoIds) {
        try {
            const endpoint = `https://www.googleapis.com/youtube/v3/videos?key=${apiKey}&id=${videoIds.join(',')}&part=snippet,contentDetails,statistics`;

            const response = await fetch(endpoint);

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            return data.items;
        } catch (error) {
            console.error('Error fetching video details:', error);
            return [];
        }
    }

    // Format date to readable format
    function formatDate(isoDate) {
        const date = new Date(isoDate);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // Format view count
    function formatViewCount(count) {
        if (count >= 1000000) {
            return (count / 1000000).toFixed(1) + 'M views';
        } else if (count >= 1000) {
            return (count / 1000).toFixed(1) + 'K views';
        } else {
            return count + ' views';
        }
    }

    // Convert ISO 8601 duration to readable format
    function formatDuration(isoDuration) {
        const match = isoDuration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);

        const hours = (match[1] && match[1].replace('H', '')) || 0;
        const minutes = (match[2] && match[2].replace('M', '')) || 0;
        const seconds = (match[3] && match[3].replace('S', '')) || 0;

        let result = '';

        if (hours > 0) {
            result += hours + ':';
            result += minutes.toString().padStart(2, '0') + ':';
        } else {
            result += minutes + ':';
        }

        result += seconds.toString().padStart(2, '0');

        return result;
    }

    // Create and display video cards in the Episodes section
    async function displayVideos() {
        const episodesGrid = document.querySelector('.episode-grid');
        if (!episodesGrid) return;

        // Show loading state
        episodesGrid.innerHTML = '<div class="col-12 text-center"><div class="spinner-border text-light" role="status"><span class="visually-hidden">Loading...</span></div></div>';

        try {
            // Fetch videos
            const videos = await fetchLatestVideos();

            if (videos.length === 0) {
                episodesGrid.innerHTML = '<div class="col-12 text-center"><p>No videos found. Please check back later.</p></div>';
                return;
            }

            // Get video IDs for detailed information
            const videoIds = videos.map(video => video.id.videoId);

            // Get detailed information for each video
            const videoDetails = await fetchVideoDetails(videoIds);

            // Clear loading indicator
            episodesGrid.innerHTML = '';

            // Create a video card for each video
            videoDetails.forEach(video => {
                const videoId = video.id;
                const title = video.snippet.title;
                const description = video.snippet.description;
                const publishedAt = formatDate(video.snippet.publishedAt);
                const viewCount = formatViewCount(video.statistics.viewCount);
                const duration = formatDuration(video.contentDetails.duration);

                const videoCard = document.createElement('div');
                videoCard.className = 'col-md-6 col-lg-4 mb-4';
                videoCard.innerHTML = `
                    <div class="episode-card h-100">
                        <div class="video-container position-relative">
                            <div class="ratio ratio-16x9">
                                <iframe 
                                    src="https://www.youtube.com/embed/${videoId}?rel=0" 
                                    title="${title}"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                    allowfullscreen
                                ></iframe>
                            </div>
                            <div class="video-duration position-absolute bottom-0 end-0 bg-dark px-2 py-1 m-2 rounded-pill">${duration}</div>
                        </div>
                        <div class="p-3 d-flex flex-column">
                            <h3 class="text-info mb-2 fs-5">${title}</h3>
                            <p class="text-light mb-2 flex-grow-1 video-description">${description.substring(0, 100)}${description.length > 100 ? '...' : ''}</p>
                            <div class="d-flex justify-content-between align-items-center text-muted small">
                                <span>${publishedAt}</span>
                                <span>${viewCount}</span>
                            </div>
                        </div>
                    </div>
                `;

                episodesGrid.appendChild(videoCard);
            });

        } catch (error) {
            console.error('Error displaying videos:', error);
            episodesGrid.innerHTML = '<div class="col-12 text-center"><p>Error loading videos. Please try again later.</p></div>';
        }
    }

    // Initialize display
    displayVideos();

    // Fallback to static content if API fails
    function displayFallbackVideos() {
        const episodesGrid = document.querySelector('.episode-grid');
        if (!episodesGrid) return;

        console.log('Using fallback video data');

        // YouTube video IDs from the original site's script.js
        const fallbackVideos = [
            {
                id: 'iY5nVt-2HQw',
                title: 'F1 Stories: Behind the Scenes (BTS)',
                description: 'An exclusive look behind the scenes of our F1 Stories podcast, sharing insights and insider moments.',
                date: 'March 15, 2024'
            },
            {
                id: '7p3PrJTR50w',
                title: 'China GP: First Day Insights',
                description: 'Comprehensive analysis of the first day of practice and sprint qualifying at the Chinese Grand Prix.',
                date: 'April 19, 2024'
            },
            {
                id: 'nvL9hyWemCs',
                title: 'BetCast #2: Chinese Grand Prix Betting Special',
                description: 'Our expert betting insights and predictions for the upcoming Chinese Grand Prix race.',
                date: 'April 20, 2024'
            },
            {
                id: 'WJXVeRIJRGs',
                title: 'Australian GP Recap',
                description: 'In-depth review and analysis of the Australian Grand Prix, including key moments and team performances.',
                date: 'March 24, 2024'
            },
            {
                id: 'Xj3R1vy8eIs',
                title: 'First Practice Session Insights',
                description: 'Detailed breakdown of the first practice sessions, highlighting team strategies and driver performances.',
                date: 'April 5, 2024'
            }
        ];

        // Clear any existing content
        episodesGrid.innerHTML = '';

        // Create video cards using Bootstrap column classes
        fallbackVideos.forEach(video => {
            const videoCardHTML = `
                <div class="col-md-6 col-lg-4 mb-4">
                    <div class="episode-card h-100">
                        <div class="video-container position-relative">
                            <div class="ratio ratio-16x9">
                                <iframe 
                                    src="https://www.youtube.com/embed/${video.id}?rel=0" 
                                    title="${video.title}"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                    allowfullscreen
                                ></iframe>
                            </div>
                        </div>
                        <div class="p-3 d-flex flex-column">
                            <h3 class="text-info mb-2 fs-5">${video.title}</h3>
                            <p class="text-light mb-3 flex-grow-1">${video.description}</p>
                            <div class="text-muted text-end small">${video.date}</div>
                        </div>
                    </div>
                </div>
            `;

            episodesGrid.insertAdjacentHTML('beforeend', videoCardHTML);
        });
    }

    // If the API key is not set or API fails or forced fallback, use fallback content
    if (apiKey === 'YOUR_API_KEY' || useFallbackVideos) {
        displayFallbackVideos();
    }
});