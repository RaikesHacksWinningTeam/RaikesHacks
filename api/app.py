from flask import Flask, render_template

# python3 -m venv venv
# source venv/bin/activate
# Flask run --debug     or     flask --app app/path.py run --debug
# deactivate
app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")