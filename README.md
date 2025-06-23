LoreCrafter - AI Worldbuilding Assistant

LoreCrafter is a full-stack, AI-powered worldbuilding assistant designed for writers, game designers, and creatives. It helps users generate and manage structured lore for their fantasy or sci-fi universes, transforming high-level ideas into interconnected, visual, and manageable data.

Features
This application provides a suite of tools to bring a fictional world to life:

🤖 AI Content Generation: Automatically generate rich lore for characters and locations using free-tier LLMs.

🕸️ Interactive Relationship Graph: Visualize connections between lore elements with a dynamic graph powered by Cytoscape.js.

🗺️ Interactive World Map: Pan and zoom across a custom map image using Leaflet.js, and interactively place markers for your locations.

🗂️ Full Data Management: Complete Create, Read, and Delete functionality for all generated lore, giving the user full control over their world.

🔗 Interconnectivity: Link characters to their home locations, building a web of relationships.

💾 JSON Export: One-click export of your entire world's data as a single, well-structured JSON file for backup and external use.

Technology Stack
LoreCrafter is built with a modern, free-tier-friendly technology stack:

Backend: Python with Flask

Frontend: Vanilla JavaScript (ES6+), HTML5, and Tailwind CSS (via CDN)

Database: MongoDB Atlas

Visualization: Cytoscape.js & Leaflet.js

Deployment: Configured for Render

Local Development Setup
To run this project on your local machine, follow these steps:

1. Clone the Repository:

git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name

2. Set Up Python Environment:
It is highly recommended to use a virtual environment.

# Create a virtual environment
python -m venv .venv

# Activate it (on Windows)
.venv\Scripts\activate

# Activate it (on macOS/Linux)
source .venv/bin/activate

3. Install Dependencies:

pip install -r requirements.txt

4. Configure Environment Variables:
Create a file named .env in the project root with the following content:

# .env file

# Your MongoDB Atlas connection string
DATABASE_URL="mongodb+srv://..."

# Your API key from https://openrouter.ai/
OPENROUTER_API_KEY="sk-or-..."

5. Run the Application:
Start the backend server:

python app.py

Then, open the Frontend/index.html file directly in your web browser.

Deployment
This project is ready to be deployed on Render. The render.yaml file in the repository automates the setup. Remember to set the DATABASE_URL and OPENROUTER_API_KEY as environment variables in the Render dashboard for the API service.