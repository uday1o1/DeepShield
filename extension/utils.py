import os

def clear_downloads(folder_path):

    try:
        # Check if the folder exists
        if os.path.exists(folder_path):
            # Iterate through all files in the folder and delete them
            for filename in os.listdir(folder_path):
                file_path = os.path.join(folder_path, filename)
                os.remove(file_path)
            
            print(f"All files in the folder '{folder_path}' have been deleted.")
        else:
            print(f"The folder '{folder_path}' does not exist.")
            
    except Exception as e:
        print(f"An error occurred: {e}")
