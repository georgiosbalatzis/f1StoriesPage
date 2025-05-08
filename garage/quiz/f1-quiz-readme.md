# F1 Affinity Quiz

A modern, sleek, and interactive web application that helps users discover which Formula 1 team and driver best match their preferences and personality.

## Overview

The F1 Affinity Quiz is designed with visual appeal and user experience in mind, featuring:

- Animated gradient background with light streaks
- Smooth transitions between questions
- Responsive design for all devices
- Modern UI with F1 Stories branding
- Interactive multiple-choice questions
- Detailed results with match percentages
- Social sharing functionality

## Files Structure

- `index.html` - Main HTML structure
- `styles.css` - All styling including animations and responsive design
- `script.js` - Quiz logic, question handling, and results calculation

## How to Use

1. Upload all three files to your web hosting
2. Replace placeholder images with F1-related graphics
3. Customize quiz questions and team/driver profiles if desired
4. Link from your main website

## Customization Guide

### Adding Your Own Images

Replace the placeholder images with your own F1 graphics:

1. For the welcome screen F1 car silhouette:
   ```html
   <img src="path/to/your/f1-car.png" alt="F1 Car" class="welcome-f1-car">
   ```

2. For team and driver images, update the image paths in the `quizData` object in `script.js`:
   ```javascript
   teams: [
     {
       name: "Mercedes AMG Petronas",
       // ...
       image: "path/to/mercedes-logo.png",
       // ...
     }
   ]
   ```

### Modifying Questions

To change, add, or remove questions, edit the `questions` array in the `quizData` object in `script.js`:

```javascript
questions: [
  {
    question: "Your new question text here?",
    options: [
      "Option 1",
      "Option 2",
      "Option 3",
      "Option 4"
    ]
  },
  // Add more questions...
]
```

### Customizing Teams and Drivers

You can modify or add teams and drivers in their respective arrays in `script.js`. Make sure to update the `affinities` array for each team/driver to match the number of questions.

```javascript
teams: [
  {
    name: "Your Team Name",
    subtitle: "Team Nickname",
    description: "Detailed description of the team...",
    image: "path/to/team-image.png",
    affinities: [0, 1, 2, 3, 1, ...] // One value per question
  }
]
```

### Understanding Affinities

The affinity system works by matching user answers with team/driver preferences:

- Each question has 4 options (indexed 0-3)
- Each team and driver has an array of "affinities" with one value per question
- The affinity value (0-3) represents which answer option best matches that team/driver
- Perfect matches (same value) give 10 points, with points decreasing for less perfect matches
- The final match percentage is calculated from the total score

## Enhancing the Quiz

### Adding More Questions

For a deeper and more accurate quiz, increase the number of questions. When adding questions:

1. Add the new question object to the `questions` array
2. Add a corresponding affinity value to each team's and driver's `affinities` array
3. Test the quiz to ensure balanced results

### Custom CSS Themes

You can create alternative color themes by modifying the gradient colors in the CSS:

```css
.background {
    background: linear-gradient(-45deg, #YOUR_COLOR1, #YOUR_COLOR2, #YOUR_COLOR3, #YOUR_COLOR4);
}
```

## Technical Information

- Built with vanilla JavaScript (no frameworks required)
- Uses CSS animations for visual effects
- Includes FontAwesome for icons
- Bootstrap for basic layout
- Mobile-responsive design
- Compatible with all modern browsers

## Integration with F1 Stories Website

To integrate with your main F1 Stories website:

1. Match the navbar links to your site structure
2. Ensure consistency with your brand colors
3. Update social media links in the footer
4. Consider adding this to your main navigation menu

## Support

For any issues or questions, please contact your web developer or reach out through the F1 Stories contact form.

Enjoy your F1 Affinity Quiz!
