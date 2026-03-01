# Building Events Dashboard

A modern, multi-tenant web application for managing and viewing building events. It allows users to browse scheduled events grouped by organizations, manage organizations, assign roles, and sync event schedules with calendar applications.

![Earlybird logo](earlybird.png)
Link: https://raikes-hacks-toju.vercel.app/

## Features

- **Interactive Dashboard:** View events via a real-time updating dashboard featuring a clean timeline view and a date picker.
- **Organization Management:** Users can create organizations, generate invite codes, and join existing organizations.
- **Role-Based Access Control (RBAC):** Organization members can be assigned roles such as `owner`, `admin`, and `viewer` with granular permissions for editing and deleting events.
- **Calendar Synchronization:** Generate `.ics` files to easily add individual events or sync entire organization schedules with external calendar apps (Google Calendar, Apple Calendar, Outlook).
- **Real-time Sync:** Uses Firebase Firestore listeners to update the UI instantly across all clients when events or organizations change.
- **Authentication:** Secure Google Sign-In powered by Firebase Authentication and session cookies.

## Tech Stack

### Backend
- **Python / Flask:** Web framework for serving the app and REST API.
- **Firebase Admin SDK:** Server-side token verification, user management, and Firestore interaction.
- **iCalendar:** Python library to generate `.ics` calendar feeds dynamically.

### Frontend
- **Vanilla JavaScript (ES6 Modules):** Modularized frontend logic (`main.js`, `api.js`, `ui-render.js`, `admin.js`, `calendar.js`).
- **Firebase JS SDK (v10+):** Client-side authentication and real-time database subscriptions.
- **CSS3:** Custom responsive styling with CSS variables and flexbox/grid layouts.
- **Lucide Icons:** Clean and modern SVG icon pack.

## Getting Started

### Prerequisites
- Python 3.8+
- Node.js (for managing any frontend deps, though native JS is used)
- A Firebase Project with:
  - Firestore Database enabled.
  - Google Sign-In Authentication enabled.

### Environment Setup

1. Clone the repository and navigate to the root directory.
2. Create a `.env` file in the root directory and populate it with your Firebase configuration and Flask secret keys:

```env
# Flask
FLASK_SECRET_KEY=your_super_secret_key
FLASK_ENV=development
PORT=5000

# App Admin (Global super-users)
ADMIN_EMAILS=admin@example.com,another@example.com

# Firebase Client Configuration
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
FIREBASE_APP_ID=your_app_id

# Firebase Admin Configuration
# EITHER set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON file:
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
# OR if using environment variables for the service account directly:
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY="your_private_key"
```

### Installation

1. Create a virtual environment and activate it:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```
2. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

### Running the App

Start the Flask development server:
```bash
python api/app.py
```
Or use the Flask CLI:
```bash
export FLASK_APP=api/app.py
flask run
```

Navigate to `http://localhost:5000` in your web browser.

## Project Structure

- `api/app.py`: Main Flask application file, handles routing, session management, and auth endpoints.
- `api/src/`: Contains backend logic like user management and decorators.
- `api/templates/`: HTML templates (e.g., `index.html`, `login.html`).
- `api/static/`: Static assets.
  - `css/`: Stylesheets.
  - `js/`: Modular JavaScript files (`main.js` is the entry point).
- `requirements.txt`: Python dependencies.
- `package.json`: NPM dependencies (if applicable/expanding).

## Database Schema (Firestore)

- **`users`**: Stores user profiles and their organization memberships.
- **`organizations`**: Stores organization details, invite codes, and member maps.
- **`events`**: Stores event metadata (`title`, `start`, `end`, `room_id`, `org_id`, `organizer`, `status`).
- **`rooms`**: (Optional/Legacy) Stores physical room or location definitions.

## License
MIT License
