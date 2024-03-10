import os
from tensorflow import keras
from tensorflow.keras.models import load_model

current_directory = os.path.abspath(os.getcwd())

model_path = os.path.join(current_directory, 'models', 'model_2048.keras')

print(model_path)

model = load_model(model_path)

print(model.summary())