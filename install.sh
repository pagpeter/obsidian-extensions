#!/bin/bash

# Check if correct number of arguments provided
if [ $# -ne 2 ]; then
    echo "Usage: $0 <plugin-name> <destination-path>"
    exit 1
fi

PLUGIN_NAME=$1
DESTINATION=$2

# Check if plugin directory exists
if [ ! -d "$PLUGIN_NAME" ]; then
    echo "Error: Plugin directory '$PLUGIN_NAME' not found"
    exit 1
fi

# Check if main.ts exists
if [ ! -f "$PLUGIN_NAME/main.ts" ]; then
    echo "Error: main.ts not found in '$PLUGIN_NAME'"
    exit 1
fi

# Run npm build in plugin directory
echo "Building $PLUGIN_NAME..."
cd "$PLUGIN_NAME" && npm run build
cd - > /dev/null

if [ $? -ne 0 ]; then
    echo "Error: TypeScript compilation failed"
    exit 1
fi

# Create destination directory if it doesn't exist
PLUGIN_DIR="$DESTINATION/.obsidian/plugins/$PLUGIN_NAME"
mkdir -p "$PLUGIN_DIR"

# Copy .js and .json files, excluding node_modules
echo "Copying files to $PLUGIN_DIR..."
find "$PLUGIN_NAME" -name "*.js" -o -name "*.json" | grep -v node_modules | while read file; do
    cp "$file" "$PLUGIN_DIR/"
    echo "Copied: $(basename "$file")"
done

echo "Installation complete!"