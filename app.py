import os
import requests
import json
from flask import Flask, jsonify, request, render_template, redirect, url_for, session
from flask_cors import CORS
from dotenv import load_dotenv
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

# Load environment variables from a .env file
load_dotenv()

# Initialize Flask App, correctly pointing to the static and template folders
app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "a-super-secret-key-that-is-long-and-random")

# --- CORS Configuration ---
# This allows the frontend to communicate with this backend.
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

# --- Database Connection ---
try:
    # Connect to MongoDB using the connection string from your .env file
    client = MongoClient(os.environ.get("DATABASE_URL"))
    db = client.lorecrafter
    # The ping command is a simple way to verify that the connection is alive.
    client.admin.command('ping')
    print("✅ Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print(f"❌ Could not connect to MongoDB: {e}")
    client = None
    db = None

# --- Helper function for JSON serialization ---
def serialize_doc(doc):
    """Converts a MongoDB document to a JSON-serializable dictionary."""
    if doc and '_id' in doc:
        # Convert the ObjectId to a string so it can be sent as JSON
        doc['_id'] = str(doc['_id'])
    return doc

# --- Page Serving Routes ---

@app.route("/")
def entry_point():
    """Redirects the base URL to the login page for a better user flow."""
    return redirect(url_for('login_page'))

@app.route("/login")
def login_page():
    """Renders the login.html template from the 'templates' folder."""
    return render_template("login.html")

@app.route("/index")
def dashboard():
    """
    Renders the main application dashboard (index.html).
    This route is now protected; it will redirect to login if the user is not authenticated.
    """
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template("index.html")

@app.route("/settings")
def settings_page():
    """Renders the settings page. Protected route."""
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template("settings.html")

# --- API Authentication Routes (Now Functional) ---

@app.route("/api/login", methods=['POST'])
def handle_login():
    """Handles the login form submission by verifying user credentials."""
    if db is None: return jsonify({"error": "Database not connected"}), 500
    
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = db.users.find_one({"email": email})

    if not user or not check_password_hash(user['password'], password):
        return jsonify({"error": "Invalid email or password"}), 401
    
    # Store user's ID in the session to mark them as logged in
    session['user_id'] = str(user['_id'])
    
    return jsonify({"message": "Login successful!", "redirect_url": url_for('dashboard')}), 200

@app.route("/api/register", methods=['POST'])
def handle_register():
    """Handles user registration by creating a new user in the database."""
    if db is None: return jsonify({"error": "Database not connected"}), 500

    data = request.get_json()
    username = data.get("username")
    email = data.get("email")
    password = data.get("password")

    if not username or not email or not password:
        return jsonify({"error": "Username, email, and password are required"}), 400

    if db.users.find_one({"email": email}):
        return jsonify({"error": "An account with this email already exists"}), 409

    hashed_password = generate_password_hash(password)
    
    db.users.insert_one({
        "username": username,
        "email": email,
        "password": hashed_password,
        "created_at": datetime.utcnow()
    })
    
    return jsonify({"message": "Registration successful! You can now log in."}), 201

@app.route("/api/logout", methods=['POST'])
def handle_logout():
    """Logs the user out by clearing their session."""
    session.pop('user_id', None)
    return jsonify({"message": "Logout successful", "redirect_url": url_for('login_page')}), 200

# --- Core API Routes (Now Protected and User-Scoped) ---

@app.route("/api/health")
def health_check():
    """Provides a health check for the API and its database connection."""
    db_status = "connected" if client else "disconnected"
    return jsonify({"status": "ok", "message": "API is running!", "database": db_status})

# Helper function to check session before proceeding with API calls
def check_session():
    return 'user_id' in session

@app.route("/api/generate/<item_type>", methods=['POST'])
def generate_item(item_type):
    """A single, dynamic route to handle generation for both characters and locations."""
    if not check_session(): return jsonify({"error": "Unauthorized"}), 401
    if db is None: return jsonify({"error": "Database not connected"}), 500
    if item_type not in ['character', 'location']:
        return jsonify({"error": "Invalid item type specified"}), 400

    data = request.get_json()
    world_prompt = data.get('prompt')
    if not world_prompt: return jsonify({"error": "A world prompt is required"}), 400

    prompts = {
        "character": {
            "system": "You are a worldbuilding assistant. Create a single, compelling character. Provide the output as a JSON object with 'name', 'role', 'physical_description', 'personality_traits', and a detailed 'backstory' (at least two paragraphs).",
            "default_color": "#58a6ff"
        },
        "location": {
            "system": "You are a worldbuilding assistant. Create a single, interesting location. Provide the output as a JSON object with 'name' and 'description' (at least two paragraphs).",
            "default_color": "#00ffd5"
        }
    }
    
    current_prompt = prompts[item_type]

    try:
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {os.environ.get('OPENROUTER_API_KEY')}",
                "Content-Type": "application/json"
            },
            json={
                "model": "mistralai/mistral-7b-instruct-v0.2", 
                "messages": [
                    {"role": "system", "content": current_prompt["system"]},
                    {"role": "user", "content": f"The world is: {world_prompt}"}
                ],
                "response_format": {"type": "json_object"}
            }
        )
        response.raise_for_status()
        item_data = json.loads(response.json()['choices'][0]['message']['content'])
        
        # --- ADDED: Tag data with the current user's ID ---
        item_data['user_id'] = session['user_id']
        
        item_data['color'] = current_prompt['default_color']
        item_data['created_at'] = datetime.utcnow()
        if item_type == 'location':
            item_data['coords'] = None
        
        insert_result = db[item_type + 's'].insert_one(item_data)
        item_data['_id'] = str(insert_result.inserted_id)
        
        return jsonify(item_data), 201
    except requests.exceptions.RequestException as e:
        print(f"Error during API call to OpenRouter: {e}")
        return jsonify({"error": f"Failed to connect to the AI service: {e}"}), 500
    except Exception as e:
        print(f"Error during data processing: {e}")
        return jsonify({"error": f"An unexpected error occurred: {e}"}), 500


@app.route("/api/characters", methods=['GET'])
def get_all_characters():
    """Fetches all characters from the database for the logged-in user."""
    if not check_session(): return jsonify({"error": "Unauthorized"}), 401
    if db is None: return jsonify({"error": "Database not connected"}), 500
    
    # --- MODIFIED: Find only characters belonging to the current user ---
    all_characters = [serialize_doc(doc) for doc in db.characters.find({'user_id': session['user_id']})]
    return jsonify(all_characters), 200

@app.route("/api/locations", methods=['GET'])
def get_all_locations():
    """Fetches all locations from the database for the logged-in user."""
    if not check_session(): return jsonify({"error": "Unauthorized"}), 401
    if db is None: return jsonify({"error": "Database not connected"}), 500
    
    # --- MODIFIED: Find only locations belonging to the current user ---
    all_locations = [serialize_doc(doc) for doc in db.locations.find({'user_id': session['user_id']})]
    return jsonify(all_locations), 200


@app.route("/api/<item_type>/<item_id>", methods=['DELETE'])
def delete_item(item_type, item_id):
    """A single dynamic route to delete a character or location, checking for ownership."""
    if not check_session(): return jsonify({"error": "Unauthorized"}), 401
    if db is None: return jsonify({"error": "Database not connected"}), 500
    if item_type not in ['characters', 'locations']:
        return jsonify({"error": "Invalid item type"}), 400
    
    try:
        obj_id = ObjectId(item_id)
        # --- MODIFIED: Ensure the user can only delete their own item ---
        query = {'_id': obj_id, 'user_id': session['user_id']}
        result = db[item_type].delete_one(query)
        
        if result.deleted_count == 1:
            if item_type == 'locations':
                # Also unlink this location from any of the user's characters
                db.characters.update_many(
                    {'location_id': item_id, 'user_id': session['user_id']}, 
                    {'$unset': {'location_id': ''}}
                )
            return jsonify({"message": f"{item_type[:-1].capitalize()} deleted successfully"}), 200
        else:
            return jsonify({"error": "Item not found or you do not have permission to delete it"}), 404
    except Exception as e:
        return jsonify({"error": f"Failed to delete item: {e}"}), 500


@app.route("/api/characters/<character_id>/link_location", methods=['PUT'])
def link_character_location(character_id):
    """Updates a character to link them to a location, checking for ownership."""
    if not check_session(): return jsonify({"error": "Unauthorized"}), 401
    if db is None: return jsonify({"error": "Database not connected"}), 500
    
    data = request.get_json()
    location_id = data.get('location_id')
    if not location_id: return jsonify({"error": "location_id is required"}), 400
    
    try:
        # --- MODIFIED: Ensure the user can only update their own character ---
        query = {'_id': ObjectId(character_id), 'user_id': session['user_id']}
        update = {'$set': {'location_id': location_id}}
        result = db.characters.update_one(query, update)

        if result.matched_count == 1:
            return jsonify({"message": "Character updated successfully"}), 200
        else:
            return jsonify({"error": "Character not found or you do not have permission to update it"}), 404
    except Exception as e:
        return jsonify({"error": f"Failed to update character: {e}"}), 500

@app.route("/api/locations/<location_id>/set_coords", methods=['PUT'])
def set_location_coordinates(location_id):
    """Updates a location with X and Y coordinates from the map, checking for ownership."""
    if not check_session(): return jsonify({"error": "Unauthorized"}), 401
    if db is None: return jsonify({"error": "Database not connected"}), 500
    
    data = request.get_json()
    coords = {"x": data.get('x'), "y": data.get('y')}
    if coords["x"] is None or coords["y"] is None:
        return jsonify({"error": "Both x and y coordinates are required"}), 400
    
    try:
        # --- MODIFIED: Ensure the user can only update their own location ---
        query = {'_id': ObjectId(location_id), 'user_id': session['user_id']}
        update = {'$set': {'coords': coords}}
        result = db.locations.update_one(query, update)

        if result.matched_count == 1:
            return jsonify({"message": "Location coordinates updated successfully"}), 200
        else:
            return jsonify({"error": "Location not found or you do not have permission to update it"}), 404
    except Exception as e:
        return jsonify({"error": f"Failed to update location: {e}"}), 500

@app.route("/api/<item_type>/<item_id>/color", methods=['PUT'])
def set_item_color(item_type, item_id):
    """A new dynamic route to update the color for an item, checking for ownership."""
    if not check_session(): return jsonify({"error": "Unauthorized"}), 401
    if db is None: return jsonify({"error": "Database not connected"}), 500
    if item_type not in ['characters', 'locations']:
        return jsonify({"error": "Invalid item type"}), 400
    
    data = request.get_json()
    color = data.get('color')
    if not color: return jsonify({"error": "Color value is required"}), 400
    
    try:
        # --- MODIFIED: Ensure the user can only update their own item's color ---
        query = {'_id': ObjectId(item_id), 'user_id': session['user_id']}
        update = {'$set': {'color': color}}
        result = db[item_type].update_one(query, update)

        if result.matched_count == 1:
            return jsonify({"message": f"{item_type[:-1].capitalize()} color updated"}), 200
        else:
            return jsonify({"error": "Item not found or you do not have permission to update it"}), 404
    except Exception as e:
        return jsonify({"error": f"Failed to update color: {e}"}), 500


@app.route("/api/export/json", methods=['GET'])
def export_world_to_json():
    """Gathers all data for the logged-in user and returns it as a single JSON object."""
    if not check_session(): return jsonify({"error": "Unauthorized"}), 401
    if db is None: return jsonify({"error": "Database not connected"}), 500
    
    try:
        # --- MODIFIED: Export only data belonging to the current user ---
        user_id = session['user_id']
        world_data = {
            'characters': [serialize_doc(doc) for doc in db.characters.find({'user_id': user_id})],
            'locations': [serialize_doc(doc) for doc in db.locations.find({'user_id': user_id})]
        }
        return jsonify(world_data), 200
    except Exception as e:
        return jsonify({"error": f"Failed to export world data: {e}"}), 500


if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5001, debug=True)