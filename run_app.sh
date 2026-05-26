#!/bin/bash

# Determine the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "Starting Masson's Trichrome Deconvolution App..."

# Activate virtual environment
if [ -d "backend/venv" ]; then
    source backend/venv/bin/activate
else
    echo "Virtual environment not found in backend/venv. Attempting to create one..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cd ..
fi

# Ensure dependencies are installed (optional check, can be commented out for speed)
# pip install -r backend/requirements.txt

# Start the server and open the browser
# We run uvicorn in the background and then open the browser
# Alternatively, Python snippet to open browser after delay

(sleep 2 && open "http://127.0.0.1:8000") &

echo "Starting backend server..."
cd backend
# uvicorn main:app --reload
# Using standard run for stability
uvicorn main:app
