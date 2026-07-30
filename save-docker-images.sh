#!/bin/bash

# Script to save all openasm_app Docker images
# Usage: ./save-docker-images.sh

echo "=== Docker Image Save Script ==="
echo "Saving all openasm_app images..."

# Create backup directory
BACKUP_DIR="./docker-backups"
mkdir -p "$BACKUP_DIR"

# Get all openasm_app images
IMAGES=$(sudo docker images --format "table {{.Repository}}:{{.Tag}}" | grep openasm_app | grep -v "REPOSITORY")

echo "Found images:"
echo "$IMAGES"
echo ""

# Save each image
for image in $IMAGES; do
    # Extract version from tag
    version=$(echo $image | cut -d':' -f2)
    
    # Create filename
    filename="${BACKUP_DIR}/openasm_app_${version}.tar.gz"
    
    echo "Saving $image to $filename..."
    
    # Save with gzip compression
    sudo docker save "$image" | gzip > "$filename"
    
    # Get file size
    size=$(du -h "$filename" | cut -f1)
    echo "Saved: $filename (Size: $size)"
    echo ""
done

echo "=== Backup Complete ==="
echo "All images saved to: $BACKUP_DIR"
echo ""

# Show summary
echo "Backup Summary:"
ls -lh "$BACKUP_DIR"/*.tar.gz
