#!/bin/bash
set -e

echo "Starting MindCraft-CE..."
npm run gui || {
    echo "Error starting application"
    read -p "Press enter to exit"
    exit 1
}
