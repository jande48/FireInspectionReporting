# MezaOC Backend

Django REST Framework backend API for MezaOC.

## Setup

1. **Create and activate virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Create `.env` file:**
   Copy the example below and fill in your values:
   ```env
   SECRET_KEY=your-secret-key-here
   DEBUG=True
   ALLOWED_HOSTS=localhost,127.0.0.1
   
   # Database connection string
   # Format: postgresql://user:password@host:port/dbname
   DATABASE_URL=postgresql://username:password@localhost:5432/mezaoc_db
   
   # CORS Settings (comma-separated)
   CORS_ALLOWED_ORIGINS=http://localhost:3000,exp://localhost:8081
   ```

4. **Run migrations:**
   ```bash
   python manage.py migrate
   ```

5. **Create superuser (optional):**
   ```bash
   python manage.py createsuperuser
   ```

6. **Run development server:**
   ```bash
   python manage.py runserver
   ```

## API Endpoints

### Authentication Endpoints

- `POST /api/auth/register/` - Register a new user
- `POST /api/auth/login/` - Login and get JWT tokens
- `POST /api/auth/logout/` - Logout (blacklist refresh token)
- `GET /api/auth/profile/` - Get current user profile (requires authentication)
- `PUT/PATCH /api/auth/profile/update/` - Update user profile (requires authentication)
- `POST /api/auth/token/refresh/` - Refresh access token

### Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <access_token>
```

## Database

The project uses PostgreSQL by default. Set the `DATABASE_URL` environment variable in your `.env` file.

Example formats:
- PostgreSQL: `postgresql://user:password@localhost:5432/dbname`
- MySQL: `mysql://user:password@localhost:3306/dbname`

## Project Structure

```
backend/
├── config/          # Django project settings
├── users/           # User authentication app
├── manage.py        # Django management script
└── requirements.txt # Python dependencies
```
