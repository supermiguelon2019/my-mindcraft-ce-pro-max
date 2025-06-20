#!/bin/bash
set -e

echo "Installing dependencies..."
npm install || {
    echo "Error installing dependencies"
    read -p "Press enter to exit"
    exit 1
}
echo "Dependencies installed successfully!"
read -p "Press enter to exit"
