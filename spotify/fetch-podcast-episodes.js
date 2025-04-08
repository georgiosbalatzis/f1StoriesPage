/**
 * F1 Stories Podcast - RSS Feed Fetcher
 * This script fetches podcast episodes from the RSS feed, saves them to a JSON file,
 * and updates the website with the latest episodes in a two-column layout.
 */

// Requires these npm packages:
// npm install rss-parser fs path

const RSSParser = require('rss-parser');
const fs = require('fs');
const path = require('path');

// Constants
const RSS_FEED_URL = 'https://anchor.fm/s/101588098/podcast/rss';
const JSON_OUTPUT_PATH = path.join(__dirname, 'data', 'episodes.json');
const MAX_EPISODES = 10; // Number of episodes to fetch (5 per column in desktop view)
const HTML_FILE_PATH = path.join(__dirname, 'index.html'); // Update this path if needed

// Create directory if it doesn't exist
const dataDir = path.dirname(JSON_OUTPUT_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Create RSS Parser instance
const parser = new RSSParser({
    customFields: {
        item: [
            'itunes:episode',
            'itunes:duration',
            'itunes:season',
            'itunes:image',
            'enclosure'
        ]
    }
});

/**
 * Fetches podcast episodes from the RSS feed
 */
async function fetchEpisodes() {
    try {
        console.log(`Fetching podcast feed from ${RSS_FEED_URL}...`);
        const feed = await parser.parseURL(RSS_FEED_URL);

        // Process episodes
        const episodes = feed.items.slice(0, MAX_EPISODES).map((item, index) => {
            // Extract Spotify episode ID from HTML content if available
            let spotifyId = null;
            const spotifyMatch = item.content?.match(/open\.spotify\.com\/episode\/([a-zA-Z0-9]+)/);
            if (spotifyMatch && spotifyMatch[1]) {
                spotifyId = spotifyMatch[1];
            }

            return {
                id: index + 1,
                title: item.title || `Episode ${feed.items.length - index}`,
                number: item['itunes:episode'] || `${feed.items.length - index}`,
                spotifyId: spotifyId,
                description: item.contentSnippet || '',
                pubDate: item.pubDate || new Date().toISOString(),
                duration: item['itunes:duration'] || '',
                audioUrl: item.enclosure?.url || '',
                imageUrl: item['itunes:image']?.href || feed.image?.url || '',
                link: item.link || ''
            };
        });

        // Save to JSON file
        const jsonData = {
            podcastTitle: feed.title || 'F1 Stories Podcast',
            podcastDescription: feed.description || 'Your Pit Stop for All Things Formula 1',
            podcastImage: feed.image?.url || '',
            lastUpdated: new Date().toISOString(),
            episodeCount: episodes.length,
            episodes: episodes
        };

        fs.writeFileSync(JSON_OUTPUT_PATH, JSON.stringify(jsonData, null, 2));
        console.log(`Successfully saved ${episodes.length} episodes to ${JSON_OUTPUT_PATH}`);

        // Generate HTML for episodes
        updateWebsiteHTML(episodes);

        return episodes;
    } catch (error) {
        console.error('Error fetching or parsing RSS feed:', error);
        throw error;
    }
}

/**
 * Updates the website HTML with the latest episodes
 * @param {Array} episodes - The parsed episode data
 */
function updateWebsiteHTML(episodes) {
    if (!episodes || episodes.length === 0) {
        console.error('No episodes available to update HTML');
        return;
    }

    try {
        // Check if the HTML file exists
        if (!fs.existsSync(HTML_FILE_PATH)) {
            console.error(`HTML file not found at ${HTML_FILE_PATH}`);
            return;
        }

        let htmlContent = fs.readFileSync(HTML_FILE_PATH, 'utf8');

        // First episode featured in main player
        const mainEpisode = episodes[0];
        const otherEpisodes = episodes.slice(1); // Skip the latest episode for the list

        // Update main player if we have a Spotify ID
        if (mainEpisode && mainEpisode.spotifyId) {
            const mainPlayerRegex = /<iframe id="spotify-main-player"[^>]*src="[^"]*"/i;

            if (mainPlayerRegex.test(htmlContent)) {
                const mainPlayerReplacement = `<iframe id="spotify-main-player" src="https://open.spotify.com/embed/episode/${mainEpisode.spotifyId}"`;
                htmlContent = htmlContent.replace(mainPlayerRegex, mainPlayerReplacement);
                console.log('Updated main player with latest episode');
            } else {
                console.warn('Main player element not found in HTML, could not update');
            }
        }

        // Generate episode cards HTML
        // Split episodes into two columns
        const leftColumnEpisodes = otherEpisodes.slice(0, Math.ceil(otherEpisodes.length / 2));
        const rightColumnEpisodes = otherEpisodes.slice(Math.ceil(otherEpisodes.length / 2));

        // Function to generate an episode card HTML
        const generateEpisodeCard = (episode) => {
            const episodeNumber = episode.number || '';
            const episodeTitle = episode.title || '';

            return `
        <!-- Episode ${episodeNumber} -->
        <div class="episode-card">
            <div class="episode-title">
                <span class="episode-number">#${episodeNumber}</span> ${episodeTitle}
            </div>
            ${episode.spotifyId ?
                `<iframe src="https://open.spotify.com/embed/episode/${episode.spotifyId}" width="100%" height="152" frameBorder="0" allowtransparency="true" allow="encrypted-media"></iframe>` :
                `<div class="episode-placeholder">
                  <p>${episode.description || 'Episode description not available'}</p>
                  <a href="${episode.link || '#'}" target="_blank" class="btn btn-primary">Listen Now</a>
              </div>`}
        </div>`;
        };

        // Create two-column layout HTML
        const episodesHTML = `
    <div class="col-12 col-md-6">
        ${leftColumnEpisodes.map(episode => generateEpisodeCard(episode)).join('')}
    </div>
    <div class="col-12 col-md-6">
        ${rightColumnEpisodes.map(episode => generateEpisodeCard(episode)).join('')}
    </div>`;

        // Find episode list section and update it
        const episodeListSectionRegex = /<section class="episode-list">[\s\S]*?<div class="row">([\s\S]*?)<\/div>\s*<\/div>\s*<\/section>/i;

        if (episodeListSectionRegex.test(htmlContent)) {
            const episodeListReplacement = `<section class="episode-list">
    <div class="container">
        <h2 class="text-center mb-4">Latest Episodes</h2>
        <div class="episode-grid row">
${episodesHTML}
        </div>
    </div>
</section>`;

            htmlContent = htmlContent.replace(episodeListSectionRegex, episodeListReplacement);
            console.log('Updated episode list section with two-column layout');
        } else {
            console.warn('Episode list section not found in HTML, could not update');
        }

        // Save the updated HTML
        fs.writeFileSync(HTML_FILE_PATH, htmlContent);
        console.log(`Successfully updated HTML file at ${HTML_FILE_PATH}`);
    } catch (error) {
        console.error('Error updating website HTML:', error);
        throw error;
    }
}

// Execute the main function
if (require.main === module) {
    fetchEpisodes()
        .then(() => console.log('Process completed successfully'))
        .catch(err => {
            console.error('Error in main process:', err);
            process.exit(1);
        });
}

// Export for potential use with other scripts
module.exports = {
    fetchEpisodes
};