#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
TOOLS_DIR="$SCRIPT_DIR/tools"

# List all js files in the tools directory
echo "Available scripts:"
echo "-----------------"

# Get all JS files
scripts=()
i=1
for file in "$TOOLS_DIR"/*.js; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        scripts+=("$filename")
        echo "[$i] $filename"
        i=$((i+1))
    fi
done

# If no scripts found
if [ ${#scripts[@]} -eq 0 ]; then
    echo "No JavaScript scripts found in $TOOLS_DIR"
    exit 1
fi

# Prompt user to select a script
echo ""
echo "Enter the number of the script you want to run (or 'q' to quit):"
read -r choice

# Check if user wants to quit
if [[ "$choice" == "q" || "$choice" == "Q" ]]; then
    echo "Exiting..."
    exit 0
fi

# Validate input
if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt ${#scripts[@]} ]; then
    echo "Invalid selection. Please enter a number between 1 and ${#scripts[@]}."
    exit 1
fi

# Get the selected script
selected_script="${scripts[$choice-1]}"

# Display script usage information first (by running it without args)
echo ""
echo "Script help for $selected_script:"
echo "-----------------"
node "$TOOLS_DIR/$selected_script" 2>&1 | head -n 10
echo "-----------------"

# Ask for arguments with context
echo ""
echo "Arguments for $selected_script (press Enter for none):"
read -r script_args

echo ""
echo "Running: $selected_script $script_args"
echo "-----------------"

# Only proceed with arguments if they were provided
if [ -n "$script_args" ]; then
    node "$TOOLS_DIR/$selected_script" $script_args
fi 