from pathlib import Path

from flask import Flask, render_template
import firebase_admin
from firebase_admin import credentials

# Resolve path from project root so it works no matter where you run flask from
_project_root = Path(__file__).resolve().parent.parent
_cred_path = _project_root / ".auth" / "raikeshacks.json"

cred = credentials.Certificate(str(_cred_path))
firebase_admin.initialize_app(cred)


# python3 -m venv venv
# source venv/bin/activate
# Flask run --debug     or     flask --app app/path.py run --debug
# deactivate
app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")