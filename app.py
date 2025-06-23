import os
import requests
import json
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from pymongo import MongoClient
from bson import ObjectId # Required to handle ObjectId conversion errors

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)

# --- Database Connection ---
try:
    # Get the database connection string from environment variables
    client = MongoClient(os.environ.get("DATABASE_URL"))
    # Select your database (will be created if it doesn't exist)
    db = client.lorecrafter
    # Send a ping to confirm a successful connection
    client.admin.command('ping')
    print("✅ Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print(f"❌ Could not connect to MongoDB: {e}")
    client = None
    db = None
# -------------------------

@app.route("/")
def index():
    """A simple welcome message to confirm the server is running."""
    return jsonify({"status": "ok", "message": "Welcome to the LoreCrafter API!"})

@app.route("/api/health")
def health_check():
    """Provides a health check for the API and its database connection."""
    db_status = "connected" if client else "disconnected"
    return jsonify({"status": "ok", "message": "LoreCrafter API is running!", "database": db_status})

@app.route("/api/generate/character", methods=['POST'])
def generate_character():
    """
    Generates a character based on a world prompt using an LLM and saves it to the database.
    """
    if db is None:
        return jsonify({"error": "Database not connected"}), 500

    data = request.get_json()
    if not data or 'prompt' not in data:
        return jsonify({"error": "Request body must be JSON and contain a 'prompt' key"}), 400

    world_prompt = data.get('prompt')
    if not world_prompt:
        return jsonify({"error": "Prompt is required"}), 400

    try:
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {os.environ.get('OPENROUTER_API_KEY')}",
                "Content-Type": "application/json"
            },
            json={
                "model": "openai/gpt-3.5-turbo",
                "messages": [
                    {"role": "system", "content": "You are a worldbuilding assistant. Create a single, compelling character for a fictional world. Provide the output as a JSON object with three keys: 'name', 'backstory', and 'role'."},
                    {"role": "user", "content": f"The world is: {world_prompt}"}
                ],
                "response_format": {"type": "json_object"}
            }
        )
        response.raise_for_status()

        generated_json_string = response.json()['choices'][0]['message']['content']
        character_data = json.loads(generated_json_string)

    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"API request failed: {e}"}), 500
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        return jsonify({"error": f"Failed to parse LLM response: {e}", "raw_response": response.text}), 500

    try:
        characters_collection = db.characters
        insert_result = characters_collection.insert_one(character_data)
    except Exception as e:
        return jsonify({"error": f"Failed to save character to database: {e}"}), 500

    character_data['_id'] = str(insert_result.inserted_id)

    return jsonify(character_data), 201

@app.route("/api/generate/location", methods=['POST'])
def generate_location():
    """
    Generates a location based on a world prompt using an LLM and saves it to the database.
    """
    if db is None:
        return jsonify({"error": "Database not connected"}), 500

    data = request.get_json()
    world_prompt = data.get('prompt')

    if not world_prompt:
        return jsonify({"error": "Prompt is required"}), 400

    try:
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {os.environ.get('OPENROUTER_API_KEY')}",
                "Content-Type": "application/json"
            },
            json={
                "model": "openai/gpt-3.5-turbo",
                "messages": [
                    {"role": "system", "content": "You are a worldbuilding assistant. Create a single, interesting location for a fictional world. Provide the output as a JSON object with two keys: 'name' and 'description'."},
                    {"role": "user", "content": f"The world is: {world_prompt}"}
                ],
                "response_format": {"type": "json_object"}
            }
        )
        response.raise_for_status()
        
        generated_json_string = response.json()['choices'][0]['message']['content']
        location_data = json.loads(generated_json_string)

    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"API request failed: {e}"}), 500
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        return jsonify({"error": f"Failed to parse LLM response: {e}", "raw_response": response.text}), 500

    locations_collection = db.locations
    insert_result = locations_collection.insert_one(location_data)

    location_data['_id'] = str(insert_result.inserted_id)
    
    return jsonify(location_data), 201

@app.route("/api/characters", methods=['GET'])
def get_all_characters():
    """Fetches all characters from the database."""
    if db is None:
        return jsonify({"error": "Database not connected"}), 500

    try:
        all_characters = list(db.characters.find({}))
        for character in all_characters:
            character['_id'] = str(character['_id'])
        
        return jsonify(all_characters), 200
    except Exception as e:
        return jsonify({"error": f"Failed to fetch characters: {e}"}), 500

@app.route("/api/locations", methods=['GET'])
def get_all_locations():
    """Fetches all locations from the database."""
    if db is None:
        return jsonify({"error": "Database not connected"}), 500

    try:
        all_locations = list(db.locations.find({}))
        for location in all_locations:
            location['_id'] = str(location['_id'])
        
        return jsonify(all_locations), 200
    except Exception as e:
        return jsonify({"error": f"Failed to fetch locations: {e}"}), 500

@app.route("/api/characters/<character_id>", methods=['DELETE'])
def delete_character(character_id):
    """Deletes a specific character from the database."""
    if db is None:
        return jsonify({"error": "Database not connected"}), 500

    try:
        obj_id = ObjectId(character_id)
        delete_result = db.characters.delete_one({'_id': obj_id})

        if delete_result.deleted_count == 1:
            return jsonify({"message": "Character deleted successfully"}), 200
        else:
            return jsonify({"error": "Character not found"}), 404

    except Exception as e:
        return jsonify({"error": f"Failed to delete character: {e}"}), 500

@app.route("/api/locations/<location_id>", methods=['DELETE'])
def delete_location(location_id):
    """Deletes a specific location from the database."""
    if db is None:
        return jsonify({"error": "Database not connected"}), 500

    try:
        obj_id = ObjectId(location_id)
        delete_result = db.locations.delete_one({'_id': obj_id})

        if delete_result.deleted_count == 1:
            return jsonify({"message": "Location deleted successfully"}), 200
        else:
            return jsonify({"error": "Location not found"}), 404
    except Exception as e:
        return jsonify({"error": f"Failed to delete location: {e}"}), 500

@app.route("/api/characters/<character_id>/link_location", methods=['PUT'])
def link_character_location(character_id):
    """Updates a character to link them to a location."""
    if db is None:
        return jsonify({"error": "Database not connected"}), 500

    try:
        data = request.get_json()
        location_id = data.get('location_id')

        if not location_id:
            return jsonify({"error": "location_id is required"}), 400

        char_obj_id = ObjectId(character_id)
        
        update_result = db.characters.update_one(
            {'_id': char_obj_id},
            {'$set': {'location_id': location_id}}
        )

        if update_result.matched_count == 1:
            return jsonify({"message": "Character updated successfully"}), 200
        else:
            return jsonify({"error": "Character not found"}), 404

    except Exception as e:
        return jsonify({"error": f"Failed to update character: {e}"}), 500

@app.route("/api/locations/<location_id>/set_coords", methods=['PUT'])
def set_location_coordinates(location_id):
    """Updates a location with X and Y coordinates."""
    if db is None:
        return jsonify({"error": "Database not connected"}), 500

    try:
        data = request.get_json()
        coords = {
            "x": data.get('x'),
            "y": data.get('y')
        }

        if coords["x"] is None or coords["y"] is None:
            return jsonify({"error": "x and y coordinates are required"}), 400

        # Find the location by its ID
        loc_obj_id = ObjectId(location_id)
        
        # Update the location document with the new coordinates
        update_result = db.locations.update_one(
            {'_id': loc_obj_id},
            {'$set': {'coords': coords}}
        )

        if update_result.matched_count == 1:
            return jsonify({"message": "Location coordinates updated successfully"}), 200
        else:
            return jsonify({"error": "Location not found"}), 404

    except Exception as e:
        return jsonify({"error": f"Failed to update location coordinates: {e}"}), 500

@app.route("/api/graph-data", methods=['GET'])
def get_graph_data():
    """Formats all lore data for Cytoscape.js."""
    if db is None:
        return jsonify({"error": "Database not connected"}), 500

    try:
        nodes = []
        edges = []

        # Get all characters and format them as nodes
        characters = list(db.characters.find({}))
        for char in characters:
            nodes.append({
                "data": {
                    "id": str(char['_id']),
                    "label": char['name'],
                    "type": "character"
                }
            })
            # If the character is linked to a location, create an edge
            if 'location_id' in char and char['location_id']:
                edges.append({
                    "data": {
                        "source": str(char['_id']),
                        "target": str(char['location_id']),
                        "label": "lives in"
                    }
                })

        # Get all locations and format them as nodes
        locations = list(db.locations.find({}))
        for loc in locations:
            nodes.append({
                "data": {
                    "id": str(loc['_id']),
                    "label": loc['name'],
                    "type": "location"
                }
            })
        
        # Combine nodes and edges into a single elements object
        elements = {"nodes": nodes, "edges": edges}
        return jsonify(elements), 200

    except Exception as e:
        return jsonify({"error": f"Failed to fetch graph data: {e}"}), 500

@app.route("/api/export/json", methods=['GET'])
def export_world_to_json():
    """Gathers all data from the database and returns it as a single JSON object."""
    if db is None:
        return jsonify({"error": "Database not connected"}), 500

    try:
        world_data = {}

        # Fetch and process characters
        all_characters = list(db.characters.find({}))
        for char in all_characters:
            char['_id'] = str(char['_id'])
        world_data['characters'] = all_characters

        # Fetch and process locations
        all_locations = list(db.locations.find({}))
        for loc in all_locations:
            loc['_id'] = str(loc['_id'])
        world_data['locations'] = all_locations
        
        # In the future, we would add factions, events, etc. here

        return jsonify(world_data), 200

    except Exception as e:
        return jsonify({"error": f"Failed to export world data: {e}"}), 500

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5001, debug=True)