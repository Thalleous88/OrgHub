# OrgHub

A comprehensive organization productivity application designed to streamline team collaboration, task management, and workflow efficiency.

## Contributors

- **Sebastian Ronny - [@Thalleous88](https://github.com/Thalleous88)** 
- **Xander Trevor Tengari - [@xanderteng](https://github.com/xanderteng)**
- **Jordhy Alexander Wibisono - [@Jordhy-jpg](https://github.com/Jordhy-jpg)**

## Tech Stack

### Backend
- **Python** (3.10+)
- **Django** - Web framework
- **Django REST Framework** - API development
- **PostgreSQL** - Database
- **JWT Authentication** - Secure user authentication
- **CORS Headers** - Cross-origin resource sharing
- **uv** - Python dependency and command runner

### Frontend
- **React** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and dev server
- **ESLint** - Code linting

## Features

- Email/password authentication with JWT tokens
- Scoped role-based access control for organizations, divisions, and projects
- Invitation-only membership management
- Organization, division, and project workspace hierarchy
- Task assignment and status tracking
- Scoped document repositories with role-based permissions
- Organization announcements and broadcast feed
- Calendar events, meetings, and milestones
- Dashboard aggregation for personal and management views
- In-app notifications and reminder generation
- RESTful API architecture
- Modern responsive UI
- Secure data handling

## Installation

### Prerequisites

- Python 3.10 or higher
- uv
- Node.js and npm
- PostgreSQL database

### Backend Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd orghub
   ```

2. Navigate to the backend directory:
   ```bash
   cd Backend
   ```

3. Install backend dependencies:
   ```bash
   uv sync
   ```

4. Set up environment variables:
   Create `Backend/.env` with:
   ```env
   SECRET_KEY=your-secret-key-here
   DEBUG=True
   DATABASE_URL=postgresql://user:password@localhost:5432/orghub
   ```

5. Run database migrations:
   ```bash
   uv run python backend/manage.py migrate
   ```

6. Verify the backend configuration:
   ```bash
   uv run python backend/manage.py check
   ```

Backend dependencies are managed by `Backend/pyproject.toml` and `Backend/uv.lock`. Do not use the stale root-level `requirements.txt` workflow for backend setup.

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Application

### Development Mode

1. Start the backend server:
   ```bash
   cd Backend
   uv run python backend/manage.py runserver
   ```

2. Start the frontend development server:
   ```bash
   cd frontend
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:5173` (frontend) and `http://localhost:8000` (backend API).

### Production Build

1. Build the frontend:
   ```bash
   cd frontend
   npm run build
   ```

2. The built files will be in `frontend/dist/`

3. For production deployment, configure your web server to serve the frontend static files and proxy API requests to the Django backend.

## API Documentation

The backend provides a REST API under `http://localhost:8000/api/`.

Comprehensive backend API documentation is available in [`Backend/API_DOCS.md`](Backend/API_DOCS.md).

Implemented backend API areas include:

- Auth/profile: registration, login, current user, profile update
- JWT utility routes: token, refresh, verify
- Workspace hierarchy: organizations, divisions, projects
- Invitations and membership onboarding
- Documents and downloads
- Tasks and task status updates
- Announcements
- Calendar events, meetings, and milestones
- Notifications and reminder generation
- Dashboard aggregation

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
