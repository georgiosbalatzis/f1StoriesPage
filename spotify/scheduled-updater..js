/**
 * F1 Stories Podcast - Scheduled RSS Feed Updater
 *
 * This script can be set up as a cron job or scheduled task to
 * automatically update the podcast episodes on a regular schedule.
 *
 * Run this with a scheduler like node-cron or as a system cron job:
 * Example (refreshes every day at 2 AM):
 * 0 2 * * * node /path/to/this/script.js
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const scriptPath = path.join(__dirname, 'fetch-podcast-episodes.js');
const logFilePath = path.join(__dirname, 'logs', 'podcast-updater.log');

// Ensure log directory exists
const logDir = path.dirname(logFilePath);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Logs a message to the log file
 * @param {string} message - The message to log
 */
function logMessage(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;

    // Append to log file
    fs.appendFileSync(logFilePath, logEntry);

    // Also output to console
    console.log(message);
}

/**
 * Runs the podcast updater script
 */
function runUpdater() {
    logMessage('Starting podcast RSS feed update...');

    // Execute the main podcast updater script
    exec(`node "${scriptPath}"`, (error, stdout, stderr) => {
        if (error) {
            logMessage(`Error running updater: ${error.message}`);
            return;
        }

        if (stderr) {
            logMessage(`Updater stderr: ${stderr}`);
        }

        logMessage(`Updater stdout: ${stdout}`);
        logMessage('Podcast RSS feed update completed successfully');
    });
}

// Run immediately when this script is executed
runUpdater();

// Export for potential use with other scheduling systems
module.exports = {
    runUpdater
};
