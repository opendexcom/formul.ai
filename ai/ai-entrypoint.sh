#!/bin/bash

ollama serve & 
sleep 3
ollama pull mistral:latest 

while true; do
    sleep 1000
done