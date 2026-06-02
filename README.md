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

### Authentication & Onboarding
- Email/password authentication with JWT tokens
- Auto-accept pending invitations on registration — users who register with an email that has a pending invite are automatically added to the organization, division, or project

### Role-Based Access Control
- Scoped role hierarchy: Core Board → Division Head → Project Lead → Member
- Core Board members have admin privileges across all scopes (create, update, delete tasks in any division or project)
- Regular members can self-assign tasks within their scope
- Invitation-only membership management with member picker and email invite

### Workspace Hierarchy
- Organization → Division → Project three-level hierarchy
- Member lists for organizations, divisions, and projects (visible to any member of the parent scope)
- Invite members via parent-scope member picker or by email address

### Task Management
- Task assignment to individuals via member picker
- Auto self-assignment: creating a task with no assignees automatically assigns the creator
- Core Board can create, update, and delete tasks in any scope
- Division Heads and Project Leads can assign tasks to members within their scope
- Status tracking (To Do, In Progress, Done) — assigned users can update status only

### Calendar & Events
- Scoped calendar events (organization, division, project level)
- Individual assignees on events at any scope
- Division-level assignees on organization-scoped events
- Event type classification (Event, Meeting, Milestone)
- Time-range filtering on calendar feed

### Additional Features
- Scoped document repositories with role-based permissions
- Organization announcements and broadcast feed
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
- Member lists: organization, division, and project member endpoints
- Invitations and membership onboarding (auto-accept on registration)
- Documents and downloads
- Tasks with individual assignees and self-assignment
- Announcements
- Calendar events with individual and division assignees
- Notifications and reminder generation
- Dashboard aggregation

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
