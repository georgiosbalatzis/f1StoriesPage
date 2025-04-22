// Full comparison-enabled telemetry viewer with dual driver support

const drivers = {
    33: {
        name: "Max Verstappen",
        color: "#1E41FF",
        logo: "https://upload.wikimedia.org/wikipedia/en/thumb/0/05/Red_Bull_Racing_logo.svg/2560px-Red_Bull_Racing_logo.svg.png",
        data: [
            { date: "2023-11-12T14:10:00.000Z", lap_number: 1, speed: 320, throttle: 95, brake: 0, n_gear: 8, drs: 1, x: 10, y: 40 },
            { date: "2023-11-12T14:10:01.000Z", lap_number: 1, speed: 310, throttle: 90, brake: 5, n_gear: 7, drs: 1, x: 20, y: 45 },
            { date: "2023-11-12T14:10:02.000Z", lap_number: 1, speed: 300, throttle: 85, brake: 10, n_gear: 6, drs: 0, x: 30, y: 50 },
            { date: "2023-11-12T14:10:03.000Z", lap_number: 1, speed: 280, throttle: 60, brake: 30, n_gear: 5, drs: 0, x: 40, y: 55 }
        ]
    },
    44: {
        name: "Lewis Hamilton",
        color: "#00D2BE",
        logo: "https://upload.wikimedia.org/wikipedia/en/thumb/8/81/Mercedes_AMG_Petronas_F1_Logo.svg/2560px-Mercedes_AMG_Petronas_F1_Logo.svg.png",
        data: [
            { date: "2023-11-12T14:10:00.000Z", lap_number: 1, speed: 315, throttle: 94, brake: 1, n_gear: 8, drs: 1, x: 10, y: 40 },
            { date: "2023-11-12T14:10:01.000Z", lap_number: 1, speed: 305, throttle: 89, brake: 4, n_gear: 7, drs: 1, x: 20, y: 45 },
            { date: "2023-11-12T14:10:02.000Z", lap_number: 1, speed: 295, throttle: 82, brake: 12, n_gear: 6, drs: 0, x: 30, y: 50 },
            { date: "2023-11-12T14:10:03.000Z", lap_number: 1, speed: 270, throttle: 55, brake: 35, n_gear: 5, drs: 0, x: 40, y: 55 }
        ]
    }
};

function createUI() {
    const ui = document.createElement('div');
    ui.style = 'text-align:center; margin:2rem auto';
    ui.innerHTML = `
    <label>Driver A:</label>
    <select id="driverA">${Object.entries(drivers).map(([k, d]) => `<option value="${k}">${d.name}</option>`).join('')}</select>
    <label style="margin-left:1rem;">Driver B:</label>
    <select id="driverB">${Object.entries(drivers).map(([k, d]) => `<option value="${k}">${d.name}</option>`).join('')}</select>
    <div style="margin-top:1rem">
      <label>Lap:</label>
      <select id="lapSelect"><option value="1">1</option></select>
      <button id="playBtn">▶ Play Lap</button>
    </div>
    <svg id="trackMap" width="300" height="150" style="margin-top:2rem; background:#111; border-radius:12px; box-shadow: 0 0 10px #0af;">
      <circle id="dotA" r="6" fill="#1E41FF" />
      <circle id="dotB" r="6" fill="#00D2BE" />
    </svg>
  `;
    document.body.insertBefore(ui, document.querySelector('canvas'));

    document.getElementById('driverA').addEventListener('change', renderCharts);
    document.getElementById('driverB').addEventListener('change', renderCharts);
    document.getElementById('playBtn').addEventListener('click', playLap);
    renderCharts();
}

function renderCharts() {
    const a = +document.getElementById('driverA').value;
    const b = +document.getElementById('driverB').value;
    const lap = +document.getElementById('lapSelect').value;
    const dataA = drivers[a].data.filter(d => d.lap_number === lap);
    const dataB = drivers[b].data.filter(d => d.lap_number === lap);

    const labels = dataA.map(d => new Date(d.date).toLocaleTimeString());

    const ctx = document.getElementById("telemetryChart").getContext("2d");
    if (window.telemetryChart) window.telemetryChart.destroy();
    window.telemetryChart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [
                { label: `${drivers[a].name} Speed`, data: dataA.map(d => d.speed), borderColor: drivers[a].color, fill: false },
                { label: `${drivers[b].name} Speed`, data: dataB.map(d => d.speed), borderColor: drivers[b].color, borderDash: [5,5], fill: false }
            ]
        },
        options: { responsive: true }
    });

    const ctx2 = document.getElementById("brakeThrottleChart").getContext("2d");
    if (window.brakeThrottleChart) window.brakeThrottleChart.destroy();
    window.brakeThrottleChart = new Chart(ctx2, {
        type: "line",
        data: {
            labels,
            datasets: [
                { label: `${drivers[a].name} Throttle`, data: dataA.map(d => d.throttle), borderColor: 'lime', fill: false },
                { label: `${drivers[b].name} Throttle`, data: dataB.map(d => d.throttle), borderColor: 'yellow', borderDash: [5,5], fill: false },
                { label: `${drivers[a].name} Brake`, data: dataA.map(d => d.brake), borderColor: 'crimson', fill: false },
                { label: `${drivers[b].name} Brake`, data: dataB.map(d => d.brake), borderColor: 'orange', borderDash: [5,5], fill: false }
            ]
        },
        options: { responsive: true }
    });
}

function playLap() {
    const a = +document.getElementById('driverA').value;
    const b = +document.getElementById('driverB').value;
    const lap = +document.getElementById('lapSelect').value;
    const dotA = document.getElementById('dotA');
    const dotB = document.getElementById('dotB');
    const dataA = drivers[a].data.filter(d => d.lap_number === lap);
    const dataB = drivers[b].data.filter(d => d.lap_number === lap);
    let i = 0;
    const interval = setInterval(() => {
        if (i >= dataA.length || i >= dataB.length) return clearInterval(interval);
        dotA.setAttribute('cx', dataA[i].x);
        dotA.setAttribute('cy', dataA[i].y);
        dotB.setAttribute('cx', dataB[i].x);
        dotB.setAttribute('cy', dataB[i].y);
        i++;
    }, 500);
}

window.addEventListener("DOMContentLoaded", createUI);