const build = require('./build');

if (require.main === module) {
    build.processBlogEntries().catch(error => {
        console.error('Blog processing failed:', error);
        process.exitCode = 1;
    });
}

module.exports = build;
