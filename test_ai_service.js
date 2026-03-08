const axios = require('axios');

const AI_SERVICE_URL = "https://ai-xw67.onrender.com/ai/coach";

async function testAiService() {
    console.log("Testing AI Service Connectivity...");

    const payload = {
        question: "How am I doing this week?",
        tracker_data: [
            { date: "2026-03-08", task: "Workout", completed: true, streak: 5, category: "fitness" },
            { date: "2026-03-07", task: "Workout", completed: true, streak: 4, category: "fitness" },
            { date: "2026-03-06", task: "Reading", completed: false, streak: 0, category: "study" }
        ]
    };

    try {
        const response = await axios.post(AI_SERVICE_URL, payload);
        console.log("Success! Received response from Render AI Service:");
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.error("Error connecting to AI Service:", err.message);
        if (err.response) {
            console.error("Status:", err.response.status);
            console.error("Data:", err.response.data);
        }
    }
}

testAiService();
