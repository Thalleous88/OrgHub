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

### Frontend
- **React** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and dev server
- **ESLint** - Code linting

## Features

- User authentication and authorization
- Task management and tracking
- Team collaboration tools
- RESTful API architecture
- Modern responsive UI
- Secure data handling

## Installation

### Prerequisites

- Python 3.10 or higher
- Node.js and npm
- PostgreSQL database

### Backend Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd orghub
   ```

2. Create a virtual environment:
   ```bash
   python -m venv .venv
   # On Windows:
   .venv\Scripts\activate
   # On macOS/Linux:
   source .venv/bin/activate
   ```

3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up environment variables:
   Create a `.env` file in the backend directory with:
   ```
   SECRET_KEY=your-secret-key-here
   DATABASE_URL=postgresql://user:password@localhost:5432/orghub
   ```

5. Run database migrations:
   ```bash
   cd backend
   python manage.py migrate
   ```

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
   cd backend
   python manage.py runserver
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

The backend provides a REST API. Once the server is running, you can access the API documentation at `http://localhost:8000/api/`.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
