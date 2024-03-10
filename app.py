from flask import Flask, render_template, request, jsonify
from flask_cors import CORS  # Import CORS

app = Flask(__name__)
CORS(app)

@app.route('/')
def index():
    return render_template('popup.html')

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    video_link = data.get('video_link', '')

    # Perform deep fake detection logic (replace this with your actual logic)
    prediction = perform_deep_fake_detection(video_link)

    # Return the prediction as JSON
    return jsonify({'prediction': prediction})

def perform_deep_fake_detection(video_link):
    # Placeholder logic for deep fake detection
    # Replace this with your actual detection logic
    # For now, assume the prediction is 'Fake' if the video link is not empty
    # return 'Fake' if video_link else 'Not a valid video link'
    return video_link
if __name__ == '__main__':
    app.run(debug=True)
