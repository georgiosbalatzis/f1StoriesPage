// episodes.js - Clean YouTube API integration for main page
document.addEventListener('DOMContentLoaded', function() {
    // YouTube channel details
    const channelId = 'UCTSK8lbEiHJ10KVFrhNaL4g'; // F1 Stories channel ID
    const maxResults = 3; // Number of videos to display on main page

    // YouTube API Key
    const apiKey = 'AIzaSyCE0vy99ror_w6PJtVGSnahyCz8n4Fq0P8';

    // Function to fetch videos using YouTube's RSS feed
    async function fetchChannelVideos() {
        try {
            // Use YouTube's RSS feed which doesn't require an API key
            const proxyUrl = 'https://api.allorigins.win/raw?url=';
            const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
            const response = await fetch(proxyUrl + encodeURIComponent(feedUrl));

            if (!response.ok) {
                throw new Error(`RSS feed request failed: ${response.status}`);
            }

            const xmlText = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "application/xml");

            // Extract video information from the feed
            const entries = xmlDoc.getElementsByTagName('entry');

            if (!entries || entries.length === 0) {
                throw new Error('No entries found in RSS feed');
            }

            // Collect video IDs
            const videoIds = [];
            for (let i = 0; i < Math.min(entries.length, maxResults); i++) {
                const videoId = entries[i].getElementsByTagName('yt:videoId')[0].textContent;
                videoIds.push(videoId);
            }

            // Get additional details about these videos
            if (videoIds.length === 0) {
                throw new Error('No video IDs extracted from RSS feed');
            }

            const detailsEndpoint = `https://www.googleapis.com/youtube/v3/videos?key=${apiKey}&id=${videoIds.join(',')}&part=snippet,contentDetails,statistics`;
            const detailsResponse = await fetch(detailsEndpoint);

            if (!detailsResponse.ok) {
                throw new Error(`Video details API failed: ${detailsResponse.status}`);
            }

            const detailsData = await detailsResponse.json();

            if (!detailsData.items || detailsData.items.length === 0) {
                throw new Error('No video details found in API response');
            }

            // Process the video details
            return detailsData.items.map(item => ({
                id: item.id,
                title: item.snippet.title,
                description: item.snippet.description.substring(0, 100) +
                    (item.snippet.description.length > 100 ? '...' : ''),
                date: new Date(item.snippet.publishedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                duration: formatDuration(item.contentDetails.duration),
                viewCount: formatViewCount(item.statistics.viewCount)
            }));

        } catch (error) {
            console.error('Error fetching channel videos:', error);

            // Try the YouTube Search API as alternative
            try {
                console.log('Using YouTube Search API as alternative method...');
                const searchEndpoint = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${channelId}&part=snippet&order=date&maxResults=${maxResults}&type=video`;
                const searchResponse = await fetch(searchEndpoint);

                if (!searchResponse.ok) {
                    throw new Error(`Search API failed: ${searchResponse.status}`);
                }

                const searchData = await searchResponse.json();

                if (!searchData.items || searchData.items.length === 0) {
                    throw new Error('No videos found in search API response');
                }

                // Get the video IDs from search results
                const videoIds = searchData.items.map(item => item.id.videoId);

                // Get additional details
                const detailsEndpoint = `https://www.googleapis.com/youtube/v3/videos?key=${apiKey}&id=${videoIds.join(',')}&part=snippet,contentDetails,statistics`;
                const detailsResponse = await fetch(detailsEndpoint);

                if (!detailsResponse.ok) {
                    throw new Error(`Video details API failed: ${detailsResponse.status}`);
                }

                const detailsData = await detailsResponse.json();

                if (!detailsData.items || detailsData.items.length === 0) {
                    throw new Error('No video details found in API response');
                }

                // Process the video details
                return detailsData.items.map(item => ({
                    id: item.id,
                    title: item.snippet.title,
                    description: item.snippet.description.substring(0, 100) +
                        (item.snippet.description.length > 100 ? '...' : ''),
                    date: new Date(item.snippet.publishedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    }),
                    duration: formatDuration(item.contentDetails.duration),
                    viewCount: formatViewCount(item.statistics.viewCount)
                }));

            } catch (searchError) {
                console.error('Alternative method also failed:', searchError);
                throw new Error('Could not retrieve videos after multiple attempts');
            }
        }
    }

    // Format ISO 8601 duration to readable format
    function formatDuration(isoDuration) {
        if (!isoDuration) return '0:00';

        const match = isoDuration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
        if (!match) return '0:00';

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

    // Format view count
    function formatViewCount(count) {
        if (!count) return '0 views';

        if (count >= 1000000) {
            return (count / 1000000).toFixed(1) + 'M views';
        } else if (count >= 1000) {
            return (count / 1000).toFixed(1) + 'K views';
        } else {
            return count + ' views';
        }
    }

    // Create video card HTML
    function createVideoCardHTML(video) {
        return `
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
                        <div class="video-duration position-absolute bottom-0 end-0 bg-dark px-2 py-1 m-2 rounded-pill">${video.duration}</div>
                    </div>
                    <div class="p-3 d-flex flex-column">
                        <h3 class="text-info mb-2 fs-5">${video.title}</h3>
                        <p class="text-light mb-2 flex-grow-1 video-description">${video.description}</p>
                        <div class="d-flex justify-content-between align-items-center text-muted small">
                            <span>${video.date}</span>
                            <span>${video.viewCount}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Display videos on the main page
    async function displayVideos() {
        const episodesGrid = document.querySelector('.episode-grid');
        if (!episodesGrid) {
            console.error('Episode grid element not found!');
            return;
        }

        // Show loading state
        episodesGrid.innerHTML = '<div class="col-12 text-center"><div class="spinner-border text-light" role="status"><span class="visually-hidden">Loading...</span></div></div>';

        try {
            // Fetch videos from the channel
            const videos = await fetchChannelVideos();

            if (!videos || videos.length === 0) {
                throw new Error('No videos found');
            }

            // Clear the loading indicator
            episodesGrid.innerHTML = '';

            // Add video cards to the grid
            videos.forEach(video => {
                const videoCardHTML = createVideoCardHTML(video);
                episodesGrid.insertAdjacentHTML('beforeend', videoCardHTML);
            });

        } catch (error) {
            console.error('Error displaying videos:', error);
            episodesGrid.innerHTML = '<div class="col-12 text-center"><p>No videos available. Please check back later.</p></div>';
        }
    }

    // If the API key is not set, display a message
    if (!apiKey || apiKey === 'YOUR_API_KEY') {
        const episodesGrid = document.querySelector('.episode-grid');
        if (episodesGrid) {
            episodesGrid.innerHTML = '<div class="col-12 text-center"><p>YouTube API key not configured. Please check back later.</p></div>';
        }
    } else {
        // Initialize display
        displayVideos();
    }
});