LoreCrafter - AI Worldbuilding Assistant
LoreCrafter is a full-stack, AI-powered worldbuilding assistant designed for writers, game designers, and creatives. It helps users generate and manage structured lore for their fantasy or sci-fi universes, transforming high-level ideas into interconnected, visual, and manageable data.

Features
This application provides a suite of tools to bring a fictional world to life:

🤖 AI Content Generation: Uses free-tier LLMs via OpenRouter to automatically generate rich lore for:
Characters: Names, backstories, and roles.
Locations: Names and vivid descriptions.
🕸️ Interactive Relationship Graph: A dynamic graph powered by Cytoscape.js visualizes the connections between lore elements, such as a character living in a specific location.
🗺️ Interactive World Map: A pannable and zoomable map canvas built with Leaflet.js. Users can:
Upload and display their own custom map image.
Interactively place markers for their generated locations.
🗂️ Full Data Management: Complete Create, Read, and Delete (CRD) functionality for all generated lore, giving the user full control over their world.
🔗 Interconnectivity: Link different lore types together, starting with assigning a 'Home Location' to characters.
💾 JSON Export: A one-click export feature to download the entire world's data as a single, well-structured JSON file for backup or external use.
Technology Stack
LoreCrafter is built with a modern, free-tier-friendly technology stack:

Backend: Python with the Flask framework.
Frontend: Vanilla JavaScript (ES6+), HTML5, and Tailwind CSS (via CDN).
Database: MongoDB Atlas (Cloud-hosted NoSQL database).
Visualization Libraries:
Cytoscape.js for the relationship graph.
Leaflet.js for the interactive map.
Deployment: Configured for easy deployment on Render via a render.yaml blueprint.
Local Development Setup
To run this project on your local machine, follow these steps:

1. Clone the Repository:

Bash

git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name
2. Set Up Python Environment:
It is highly recommended to use a virtual environment.

Bash

# Create a virtual environment
python -m venv .venv

# Activate it
# On Windows:
# .venv\Scripts\activate
# On macOS/Linux:
# source .venv/bin/activate
3. Install Dependencies:

Bash

pip install -r requirements.txt
4. Configure Environment Variables:
Create a file named .env in the root of the project directory. This file holds your secret keys and should not be committed to Git.

# .env file

# Your MongoDB Atlas connection string
DATABASE_URL="mongodb+srv://..."

# Your API key from https://openrouter.ai/
OPENROUTER_API_KEY="sk-or-..."
5. Run the Application:
You need to run the backend server and open the frontend file separately.

Start the Backend Server:

Bash

python app.py
The server will start on http://localhost:5001.

Open the Frontend:
Navigate to the Frontend/ directory and open the index.html file directly in your web browser (e.g., Chrome, Firefox).

Deployment
This project is ready to be deployed on Render.

Push your final code to a GitHub repository.
In the Render dashboard, create a new "Blueprint Instance" and point it to your repository.
Render will automatically detect the render.yaml file and configure the Flask web service and the static site.
Important: You must manually set the DATABASE_URL and OPENROUTER_API_KEY as Environment Variables in the Render dashboard for your lorecrafter-api service, as they are not synced from the .yaml file for security reasons.