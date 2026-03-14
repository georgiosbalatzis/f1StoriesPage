// script.js — Minimal supplemental script
// Core functionality is in f1-optimized.js
// This file only provides animation keyframes that aren't in a CSS file.

// Add dynamic styles for animations
document.head.insertAdjacentHTML('beforeend', `
    <style>
        /* Pulse animation for CTAs */
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(0, 115, 230, 0.7); }
            70% { box-shadow: 0 0 0 15px rgba(0, 115, 230, 0); }
            100% { box-shadow: 0 0 0 0 rgba(0, 115, 230, 0); }
        }
        .pulse { animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

        /* Modal button glow effect */
        @keyframes buttonGlow {
            0% { box-shadow: 0 0 0 0 rgba(0, 115, 230, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(0, 115, 230, 0); }
            100% { box-shadow: 0 0 0 0 rgba(0, 115, 230, 0); }
        }
        .pulse-glow { animation: buttonGlow 2s infinite; }

        /* Enhanced transitions for social link items */
        .social-link-item { transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .social-link-item:hover { background-color: rgba(255,255,255,0.05); transform: translateX(5px); }
        .social-link-item a { transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .social-link-item:hover a { transform: scale(1.1); box-shadow: 0 4px 10px rgba(0, 115, 230, 0.3); }
    </style>
`);
