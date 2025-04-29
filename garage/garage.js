document.addEventListener('DOMContentLoaded', function() {
    // Initialize page elements
    const teamBadges = document.querySelectorAll('.team-badge');
    const modelFrames = document.querySelectorAll('.model-frame');
    const loadingSpinner = document.querySelector('.loading-spinner');
    const modelNotSelected = document.querySelector('.model-not-selected');
    const teamCarInfo = document.getElementById('team-car-info');

    // Car data
    const carData = {
        williams: {
            name: "Williams FW47",
            description: "The Williams FW47 represents a significant step forward for the team, featuring innovative aerodynamics and improved power unit integration. The team has focused on optimizing the car's performance in high-speed corners while maintaining stability in low-speed sections.",
            specs: [
                {title: "Power Unit", value: "Mercedes-AMG F1 M14"},
                {title: "ERS", value: "Mercedes-AMG HPP"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "372 km/h"},
                {title: "0-100 km/h", value: "2.6 seconds"},
                {title: "Drivers", value: "Alex Albon, Carlos Sainz"}
            ]
        },
        mercedes: {
            name: "Mercedes W16",
            description: "The Mercedes W16 continues the team's pursuit of aerodynamic excellence with significant upgrades to the floor and sidepod design. The power unit remains a class leader in both power and efficiency, while the suspension system has been completely redesigned for better mechanical grip.",
            specs: [
                {title: "Power Unit", value: "Mercedes-AMG F1 M14"},
                {title: "ERS", value: "Mercedes-AMG HPP"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "378 km/h"},
                {title: "0-100 km/h", value: "2.5 seconds"},
                {title: "Drivers", value: "George Russell, Andrea Kimi Antonelli"}
            ]
        },
        redbull: {
            name: "Red Bull RB21",
            description: "The Red Bull RB21 evolves the successful concepts from previous seasons with refined aerodynamics and improved packaging. Adrian Newey's influence is evident in the intricate aero surfaces that maximize downforce while minimizing drag, making it formidable on all circuit types.",
            specs: [
                {title: "Power Unit", value: "Honda RBPT H003"},
                {title: "ERS", value: "Honda RBPT"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "375 km/h"},
                {title: "0-100 km/h", value: "2.4 seconds"},
                {title: "Drivers", value: "Max Verstappen, Yuki Tsunoda"}
            ]
        },
        ferrari: {
            name: "Ferrari SF-25",
            description: "The Ferrari SF-25 represents a new design philosophy for the Scuderia, with radical changes to the cooling system and bodywork. The power unit delivers exceptional driveability and peak performance, while the innovative suspension system provides excellent tire management.",
            specs: [
                {title: "Power Unit", value: "Ferrari 068/9"},
                {title: "ERS", value: "Ferrari"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "374 km/h"},
                {title: "0-100 km/h", value: "2.5 seconds"},
                {title: "Drivers", value: "Charles Leclerc, Lewis Hamilton"}
            ]
        },
        mclaren: {
            name: "McLaren MCL39",
            description: "The McLaren MCL39 builds on the team's recent success with enhanced aerodynamic efficiency and mechanical grip. Technical Director James Key has focused on optimizing the floor and diffuser to generate maximum downforce with minimal drag, resulting in a versatile machine suited to all track types.",
            specs: [
                {title: "Power Unit", value: "Mercedes-AMG F1 M14"},
                {title: "ERS", value: "Mercedes-AMG HPP"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "376 km/h"},
                {title: "0-100 km/h", value: "2.5 seconds"},
                {title: "Drivers", value: "Lando Norris, Oscar Piastri"}
            ]
        },
        aston: {
            name: "Aston Martin AMR25",
            description: "The Aston Martin AMR25 showcases the team's growing technical capabilities with an aggressive design approach. The innovative front wing and nose cone work in harmony with the revised floor to create a consistent aerodynamic platform, while the Mercedes power unit provides excellent performance.",
            specs: [
                {title: "Power Unit", value: "Mercedes-AMG F1 M14"},
                {title: "ERS", value: "Mercedes-AMG HPP"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "371 km/h"},
                {title: "0-100 km/h", value: "2.6 seconds"},
                {title: "Drivers", value: "Fernando Alonso, Lance Stroll"}
            ]
        },
        alpine: {
            name: "Alpine A525",
            description: "The Alpine A525 represents a significant evolution in the team's design philosophy with dramatic changes to the sidepod and cooling systems. The revised Renault power unit delivers improved power and reliability, while the upgraded suspension enhances mechanical grip across various circuit conditions.",
            specs: [
                {title: "Power Unit", value: "Renault E-Tech RE25"},
                {title: "ERS", value: "Renault"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "370 km/h"},
                {title: "0-100 km/h", value: "2.6 seconds"},
                {title: "Drivers", value: "Pierre Gasly, Jack Doohan"}
            ]
        },
        haas: {
            name: "Haas VF-25",
            description: "The Haas VF-25 features a comprehensive redesign that addresses the team's previous weaknesses. The revised aerodynamic package offers improved performance across varying conditions, while the Ferrari power unit integration has been optimized to enhance cooling efficiency and overall reliability.",
            specs: [
                {title: "Power Unit", value: "Ferrari 068/9"},
                {title: "ERS", value: "Ferrari"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "369 km/h"},
                {title: "0-100 km/h", value: "2.7 seconds"},
                {title: "Drivers", value: "Oliver Bearman, Esteban Ocon"}
            ]
        },
        sauber: {
            name: "Sauber C44",
            description: "The Sauber C44, the team's final car before transitioning to Audi, incorporates several innovative aerodynamic concepts. The revised floor and diffuser generate significant downforce, while the efficient packaging of the Ferrari power unit allows for aggressive bodywork solutions to minimize drag.",
            specs: [
                {title: "Power Unit", value: "Ferrari 068/9"},
                {title: "ERS", value: "Ferrari"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "368 km/h"},
                {title: "0-100 km/h", value: "2.7 seconds"},
                {title: "Drivers", value: "Nico Hulkenberg, Gabriel Bortoleto"}
            ]
        },
        "racing-bulls": {
            name: "VCARB VCARB01",
            description: "The VCARB VCARB01 demonstrates the team's technical progress with innovative solutions throughout the car. The Honda power unit is packaged efficiently to allow for compact bodywork, while the redesigned suspension improves mechanical grip in both low and high-speed corners.",
            specs: [
                {title: "Power Unit", value: "Honda RBPT H003"},
                {title: "ERS", value: "Honda RBPT"},
                {title: "Weight", value: "798 kg (with driver)"},
                {title: "Top Speed", value: "370 km/h"},
                {title: "0-100 km/h", value: "2.6 seconds"},
                {title: "Drivers", value: "Liam Lawson, Isack Hadjar"}
            ]
        }
    };

    // Function to hide all models
    function hideAllModels() {
        modelFrames.forEach(frame => {
            frame.classList.remove('visible');
            // Ensure pointer events are disabled when hidden
            frame.style.pointerEvents = 'none';
        });
        modelNotSelected.style.display = 'block';
        loadingSpinner.style.display = 'none';
    }

    // Function to show selected model
    function showModel(teamId) {
        hideAllModels();

        // Reset active state on all badges
        teamBadges.forEach(badge => {
            badge.classList.remove('active');
        });

        // Set active state on selected badge
        document.querySelector(`.team-badge[data-team="${teamId}"]`).classList.add('active');

        // Show loading spinner
        loadingSpinner.style.display = 'block';
        modelNotSelected.style.display = 'none';

        // Get model element
        const modelElement = document.getElementById(`${teamId}-model`);

        // Show model (with a slight delay to simulate loading)
        setTimeout(() => {
            loadingSpinner.style.display = 'none';
            modelElement.classList.add('visible');
            // Enable pointer events on the visible model
            modelElement.style.pointerEvents = 'auto';

            // Update car info
            updateCarInfo(teamId);
        }, 800);
    }

    // Function to update car information
    function updateCarInfo(teamId) {
        const car = carData[teamId];

        // Create car specs HTML
        let specsHtml = '<div class="car-specs">';
        car.specs.forEach(spec => {
            specsHtml += `
                <div class="spec-item">
                    <div class="spec-title">${spec.title}</div>
                    <div class="spec-value">${spec.value}</div>
                </div>
            `;
        });
        specsHtml += '</div>';

        // Update car info HTML
        teamCarInfo.innerHTML = `
            <h3 class="model-title">${car.name}</h3>
            <p class="model-description">${car.description}</p>
            <h4>Technical Specifications</h4>
            ${specsHtml}
        `;

        // Update document title to include car name
        document.querySelector('.model-title').textContent = car.name;
    }

    // Add click event listeners to team badges
    teamBadges.forEach(badge => {
        badge.addEventListener('click', function() {
            const teamId = this.getAttribute('data-team');
            showModel(teamId);
        });
    });

    // Initialize with all models hidden
    hideAllModels();

    // Fade-in animations
    const fadeElements = document.querySelectorAll('.fade-in');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    fadeElements.forEach(element => {
        observer.observe(element);
    });

    // Scroll to top button
    const scrollToTopBtn = document.getElementById('scroll-to-top');

    window.addEventListener('scroll', function() {
        if (window.pageYOffset > 300) {
            scrollToTopBtn.classList.add('visible');
        } else {
            scrollToTopBtn.classList.remove('visible');
        }
    });

    scrollToTopBtn.addEventListener('click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});