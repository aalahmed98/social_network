# S-Network: Social Networking Platform

A social networking platform with user authentication, profiles, posts, and real-time chat.

## Features

### User Authentication

- Registration with email and password
- Login/Logout
- Session management

### User Profiles

- View and edit user profile information
- Upload profile picture
- Set profile visibility (public/private)

### Posts

- Create posts with text content and optional images/GIFs
- Set post privacy levels:
  - Public: Visible to all users
  - Almost Private: Visible only to followers
  - Private: Visible only to selected followers
- Comment on posts
- View posts feed based on privacy settings

### Chat (Coming Soon)

- Real-time messaging between users
- Group chats
- Send images in chats

## Technology Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend

- Go
- SQLite
- Gorilla Mux for routing
- Gorilla WebSocket (for real-time chat)

## Getting Started

1. Clone the repository
2. Install dependencies:

   ```
   # Frontend
   npm install

   # Backend
   go mod download
   ```

3. Start the development servers:

   ```
   # Frontend
   npm run dev

   # Backend
   go run backend/server.go
   ```

4. Open your browser and navigate to http://localhost:3000
