#!/bin/bash
set -e
echo "launching server..."
node server.js
echo "launching client A..."
explorer.exe http://127.0.0.1:8082/client.html &
echo "launching client B..."
explorer.exe http://127.0.0.1:8082/client.html &
echo "waiting for all processes to finish..."
wait
echo "Done."