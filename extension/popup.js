// popup.js

document.addEventListener('DOMContentLoaded', function () {
    // Get the button element
    var checkButton = document.getElementById("checkButton");

    // Add a click event listener to the button
    checkButton.addEventListener("click", function () {
        submitVideo();
    });
});

function submitVideo() {
    document.getElementById("result").innerText = "Please wait while we process your video...";

    // Get the video link from the input
    var videoLink = document.getElementById("videoLink").value;

    // Send the video link to the Flask backend using fetch
    fetch('http://127.0.0.1:5000/predict', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ video_link: videoLink })
    })
        .then(response => response.json())
        .then(data => {
            // Update the result div with the prediction result
            document.getElementById("result").innerText = "Prediction: " + data.prediction;
        })
        .catch(error => {
            console.error('Error:', error);
        });
}
