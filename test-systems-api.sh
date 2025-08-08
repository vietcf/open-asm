#!/bin/bash

# Test script for Systems API - Search and Partial Update functionality
# Usage: ./test-systems-api.sh

BASE_URL="http://localhost:3000"
API_VERSION="api/v1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Testing Systems API - Search and Partial Update ===${NC}"

# Step 1: Login to get JWT token
echo -e "\n${YELLOW}1. Getting JWT token...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/$API_VERSION/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "123456"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}Failed to get JWT token. Please check login credentials.${NC}"
  exit 1
fi

echo -e "${GREEN}✓ JWT token obtained${NC}"

# Step 2: Create a test system for search and update testing
echo -e "\n${YELLOW}2. Creating test system...${NC}"
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/$API_VERSION/systems" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "system_id": "TEST-SEARCH-001",
    "name": "Test Search System",
    "alias": ["Original", "Legacy"],
    "description": "System for testing search and partial update",
    "level": 2,
    "department_id": 1
  }')

SYSTEM_ID=$(echo $CREATE_RESPONSE | grep -o '"id":[0-9]*' | cut -d':' -f2)

if [ -z "$SYSTEM_ID" ]; then
  echo -e "${RED}Failed to create test system${NC}"
  echo "Response: $CREATE_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓ Test system created with ID: $SYSTEM_ID${NC}"

# Step 3: Test search functionality
echo -e "\n${YELLOW}3. Testing search functionality...${NC}"

# Test 3a: Search by system name
echo -e "\n${YELLOW}3a. Search by system name 'Test Search'...${NC}"
SEARCH_RESPONSE=$(curl -s "$BASE_URL/$API_VERSION/systems?search=Test%20Search&page=1&pageSize=5" \
  -H "Authorization: Bearer $TOKEN")

SEARCH_COUNT=$(echo $SEARCH_RESPONSE | grep -o '"totalCount":[0-9]*' | cut -d':' -f2)
echo "Search results count: $SEARCH_COUNT"

if [ "$SEARCH_COUNT" -gt "0" ]; then
  echo -e "${GREEN}✓ Search by name working${NC}"
else
  echo -e "${RED}✗ Search by name failed${NC}"
fi

# Test 3b: Search by system ID
echo -e "\n${YELLOW}3b. Search by system ID 'TEST-SEARCH'...${NC}"
SEARCH_ID_RESPONSE=$(curl -s "$BASE_URL/$API_VERSION/systems?search=TEST-SEARCH&page=1&pageSize=5" \
  -H "Authorization: Bearer $TOKEN")

SEARCH_ID_COUNT=$(echo $SEARCH_ID_RESPONSE | grep -o '"totalCount":[0-9]*' | cut -d':' -f2)
echo "Search results count: $SEARCH_ID_COUNT"

if [ "$SEARCH_ID_COUNT" -gt "0" ]; then
  echo -e "${GREEN}✓ Search by system ID working${NC}"
else
  echo -e "${RED}✗ Search by system ID failed${NC}"
fi

# Test 3c: Search with pagination
echo -e "\n${YELLOW}3c. Testing pagination...${NC}"
PAGINATION_RESPONSE=$(curl -s "$BASE_URL/$API_VERSION/systems?page=1&pageSize=2" \
  -H "Authorization: Bearer $TOKEN")

PAGE_SIZE=$(echo $PAGINATION_RESPONSE | grep -o '"pageSize":[0-9]*' | cut -d':' -f2)
echo "Page size: $PAGE_SIZE"

if [ "$PAGE_SIZE" = "2" ]; then
  echo -e "${GREEN}✓ Pagination working${NC}"
else
  echo -e "${RED}✗ Pagination failed${NC}"
fi

# Step 4: Test partial update functionality
echo -e "\n${YELLOW}4. Testing partial update functionality...${NC}"

# Test 4a: Get original system data
echo -e "\n${YELLOW}4a. Getting original system data...${NC}"
ORIGINAL_RESPONSE=$(curl -s "$BASE_URL/$API_VERSION/systems/$SYSTEM_ID" \
  -H "Authorization: Bearer $TOKEN")

ORIGINAL_NAME=$(echo $ORIGINAL_RESPONSE | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
ORIGINAL_LEVEL=$(echo $ORIGINAL_RESPONSE | grep -o '"level":[0-9]*' | cut -d':' -f2)
ORIGINAL_DESC=$(echo $ORIGINAL_RESPONSE | grep -o '"description":"[^"]*"' | cut -d'"' -f4)

echo "Original name: $ORIGINAL_NAME"
echo "Original level: $ORIGINAL_LEVEL" 
echo "Original description: $ORIGINAL_DESC"

# Test 4b: Update only name (should preserve other fields)
echo -e "\n${YELLOW}4b. Updating only name...${NC}"
UPDATE_NAME_RESPONSE=$(curl -s -X PUT "$BASE_URL/$API_VERSION/systems/$SYSTEM_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "Updated Name Only"}')

# Get updated system
UPDATED_RESPONSE=$(curl -s "$BASE_URL/$API_VERSION/systems/$SYSTEM_ID" \
  -H "Authorization: Bearer $TOKEN")

UPDATED_NAME=$(echo $UPDATED_RESPONSE | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
UPDATED_LEVEL=$(echo $UPDATED_RESPONSE | grep -o '"level":[0-9]*' | cut -d':' -f2)
UPDATED_DESC=$(echo $UPDATED_RESPONSE | grep -o '"description":"[^"]*"' | cut -d'"' -f4)

echo "Updated name: $UPDATED_NAME"
echo "Updated level: $UPDATED_LEVEL"
echo "Updated description: $UPDATED_DESC"

if [ "$UPDATED_NAME" = "Updated Name Only" ] && [ "$UPDATED_LEVEL" = "$ORIGINAL_LEVEL" ] && [ "$UPDATED_DESC" = "$ORIGINAL_DESC" ]; then
  echo -e "${GREEN}✓ Partial update (name only) working correctly${NC}"
else
  echo -e "${RED}✗ Partial update (name only) failed${NC}"
fi

# Test 4c: Update only level (should preserve other fields)
echo -e "\n${YELLOW}4c. Updating only level...${NC}"
UPDATE_LEVEL_RESPONSE=$(curl -s -X PUT "$BASE_URL/$API_VERSION/systems/$SYSTEM_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"level": 5}')

# Get updated system
FINAL_RESPONSE=$(curl -s "$BASE_URL/$API_VERSION/systems/$SYSTEM_ID" \
  -H "Authorization: Bearer $TOKEN")

FINAL_NAME=$(echo $FINAL_RESPONSE | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
FINAL_LEVEL=$(echo $FINAL_RESPONSE | grep -o '"level":[0-9]*' | cut -d':' -f2)
FINAL_DESC=$(echo $FINAL_RESPONSE | grep -o '"description":"[^"]*"' | cut -d'"' -f4)

echo "Final name: $FINAL_NAME"
echo "Final level: $FINAL_LEVEL"
echo "Final description: $FINAL_DESC"

if [ "$FINAL_NAME" = "Updated Name Only" ] && [ "$FINAL_LEVEL" = "5" ] && [ "$FINAL_DESC" = "$ORIGINAL_DESC" ]; then
  echo -e "${GREEN}✓ Partial update (level only) working correctly${NC}"
else
  echo -e "${RED}✗ Partial update (level only) failed${NC}"
fi

# Step 5: Clean up - delete test system
echo -e "\n${YELLOW}5. Cleaning up...${NC}"
DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/$API_VERSION/systems/$SYSTEM_ID" \
  -H "Authorization: Bearer $TOKEN")

echo -e "${GREEN}✓ Test system deleted${NC}"

echo -e "\n${YELLOW}=== Testing Complete ===${NC}"
