// Fallback Flag System - For browsers with emoji compatibility issues
document.addEventListener('DOMContentLoaded', function() {
    // Flag fallback system
    const flagFallbacks = {
        "🇧🇭": '<span class="flag-fallback" title="Bahrain">BHR</span>',
        "🇸🇦": '<span class="flag-fallback" title="Saudi Arabia">SAU</span>',
        "🇦🇺": '<span class="flag-fallback" title="Australia">AUS</span>',
        "🇯🇵": '<span class="flag-fallback" title="Japan">JPN</span>',
        "🇨🇳": '<span class="flag-fallback" title="China">CHN</span>',
        "🇺🇸": '<span class="flag-fallback" title="United States">USA</span>',
        "🇮🇹": '<span class="flag-fallback" title="Italy">ITA</span>',
        "🇲🇨": '<span class="flag-fallback" title="Monaco">MON</span>',
        "🇨🇦": '<span class="flag-fallback" title="Canada">CAN</span>',
        "🇪🇸": '<span class="flag-fallback" title="Spain">ESP</span>',
        "🇦🇹": '<span class="flag-fallback" title="Austria">AUT</span>',
        "🇬🇧": '<span class="flag-fallback" title="United Kingdom">GBR</span>',
        "🇭🇺": '<span class="flag-fallback" title="Hungary">HUN</span>',
        "🇧🇪": '<span class="flag-fallback" title="Belgium">BEL</span>',
        "🇳🇱": '<span class="flag-fallback" title="Netherlands">NED</span>',
        "🇦🇿": '<span class="flag-fallback" title="Azerbaijan">AZE</span>',
        "🇸🇬": '<span class="flag-fallback" title="Singapore">SGP</span>',
        "🇲🇽": '<span class="flag-fallback" title="Mexico">MEX</span>',
        "🇧🇷": '<span class="flag-fallback" title="Brazil">BRA</span>',
        "🇶🇦": '<span class="flag-fallback" title="Qatar">QAT</span>',
        "🇦🇪": '<span class="flag-fallback" title="United Arab Emirates">UAE</span>'
    };

    // Function to check if emoji are supported
    function checkEmojiSupport() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const emojiString = '🇮🇹'; // Testing with one flag emoji

        ctx.fillText(emojiString, -2, 4);
        return ctx.getImageData(0, 0, 1, 1).data[3] !== 0; // Check if the emoji was rendered
    }

    // Function to replace flag emojis with fallbacks
    function replaceFlagEmojis() {
        // If emojis are supported, don't do anything
        if (checkEmojiSupport()) return;

        // Replace flags in the next race display
        const nextRaceFlag = document.getElementById('next-race-flag');
        if (nextRaceFlag && flagFallbacks[nextRaceFlag.textContent]) {
            nextRaceFlag.innerHTML = flagFallbacks[nextRaceFlag.textContent];
        }

        // Replace flags in the race list
        document.querySelectorAll('.race-title').forEach(titleElement => {
            for (const [emoji, fallback] of Object.entries(flagFallbacks)) {
                if (titleElement.textContent.includes(emoji)) {
                    titleElement.innerHTML = titleElement.innerHTML.replace(emoji, fallback);
                }
            }
        });
    }

    // Add the CSS for fallback flags
    function addFallbackStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .flag-fallback {
                display: inline-block;
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(0, 115, 230, 0.5);
                border-radius: 3px;
                padding: 2px 4px;
                font-size: 0.7rem;
                font-weight: bold;
                color: #fff;
                margin-right: 5px;
            }
        `;
        document.head.appendChild(style);
    }

    // Initialize the flag fallback system
    function initFlagFallbacks() {
        addFallbackStyles();
        // We'll call replaceFlagEmojis with a slight delay to ensure races are loaded
        setTimeout(replaceFlagEmojis, 1000);
    }

    // Start the fallback system
    initFlagFallbacks();
});